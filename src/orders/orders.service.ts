import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OrderStatus, OrderType, PaymentMethod, Prisma, Role, StockMovementType } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { localDateKey, resolveRange } from '../common/utils/date.util';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ShiftsService } from '../shifts/shifts.service';
import { CreateOrderDto, OrderQueryDto, VoidOrderDto } from './orders.dto';

const orderDetailInclude = {
  items: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shifts: ShiftsService,
    private readonly settings: SettingsService,
  ) {}

  async create(user: AuthUser, dto: CreateOrderDto) {
    const shift = await this.shifts.findOpenShift(user.id);
    if (!shift) throw new BadRequestException('Buka shift terlebih dahulu sebelum bertransaksi');

    // Ambil data produk terbaru dari database (harga tidak dipercaya dari client)
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lines = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive) {
        throw new BadRequestException(`Produk #${item.productId} tidak tersedia`);
      }
      return {
        product,
        qty: item.qty,
        note: item.note?.trim() || null,
        subtotal: product.price * item.qty,
      };
    });

    // Hitung total
    const setting = await this.settings.get();
    const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
    const discount = Math.min(dto.discount ?? 0, subtotal);
    const base = subtotal - discount;
    const serviceCharge = Math.round((base * setting.servicePercent) / 100);
    const tax = Math.round(((base + serviceCharge) * setting.taxPercent) / 100);
    const total = base + serviceCharge + tax;

    let paidAmount = total;
    let changeAmount = 0;
    if (dto.paymentMethod === PaymentMethod.CASH) {
      paidAmount = dto.paidAmount ?? 0;
      if (paidAmount < total) {
        throw new BadRequestException(`Uang yang diterima kurang dari total (Rp ${total.toLocaleString('id-ID')})`);
      }
      changeAmount = paidAmount - total;
    }

    // Total qty per produk, untuk pengurangan stok
    const qtyPerProduct = new Map<number, number>();
    for (const l of lines) {
      if (l.product.trackStock) {
        qtyPerProduct.set(l.product.id, (qtyPerProduct.get(l.product.id) ?? 0) + l.qty);
      }
    }

    // Nomor invoice bisa bentrok jika dua kasir menyimpan bersamaan → coba ulang
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const invoiceNo = await this.nextInvoiceNo(tx);

          const stockAfter = new Map<number, number>();
          for (const [productId, qty] of qtyPerProduct) {
            const res = await tx.product.updateMany({
              where: { id: productId, stock: { gte: qty } },
              data: { stock: { decrement: qty } },
            });
            const fresh = await tx.product.findUniqueOrThrow({
              where: { id: productId },
              select: { name: true, stock: true },
            });
            if (res.count === 0) {
              throw new BadRequestException(`Stok ${fresh.name} tidak cukup (sisa ${fresh.stock})`);
            }
            stockAfter.set(productId, fresh.stock);
          }

          const order = await tx.order.create({
            data: {
              invoiceNo,
              shiftId: shift.id,
              userId: user.id,
              orderType: dto.orderType,
              tableNo: dto.orderType === OrderType.DINE_IN ? dto.tableNo?.trim() || null : null,
              customerName: dto.customerName?.trim() || null,
              subtotal,
              discount,
              serviceCharge,
              tax,
              total,
              paymentMethod: dto.paymentMethod,
              paidAmount,
              changeAmount,
              note: dto.note?.trim() || null,
              items: {
                create: lines.map((l) => ({
                  productId: l.product.id,
                  productName: l.product.name,
                  price: l.product.price,
                  cost: l.product.cost,
                  qty: l.qty,
                  note: l.note,
                  subtotal: l.subtotal,
                })),
              },
            },
            include: orderDetailInclude,
          });

          if (qtyPerProduct.size > 0) {
            await tx.stockMovement.createMany({
              data: [...qtyPerProduct].map(([productId, qty]) => ({
                productId,
                userId: user.id,
                type: StockMovementType.SALE,
                qty: -qty,
                stockAfter: stockAfter.get(productId)!,
                reference: invoiceNo,
              })),
            });
          }

          return order;
        });
      } catch (e) {
        const duplicateInvoice = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (duplicateInvoice && attempt < 5) continue;
        throw e;
      }
    }
  }

  async findAll(user: AuthUser, query: OrderQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { gte, lt } = resolveRange(query.from, query.to);

    const where: Prisma.OrderWhereInput = { createdAt: { gte, lt } };
    if (query.status) where.status = query.status;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [{ invoiceNo: { contains: q } }, { customerName: { contains: q } }, { tableNo: { contains: q } }];
    }
    // Kasir hanya melihat transaksinya sendiri
    if (user.role === Role.CASHIER) where.userId = user.id;

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { user: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(user: AuthUser, id: number) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id }, include: orderDetailInclude });
    if (user.role === Role.CASHIER && order.userId !== user.id) {
      throw new ForbiddenException('Anda hanya bisa melihat transaksi sendiri');
    }
    return order;
  }

  /** Batalkan transaksi dan kembalikan stok. */
  async void(user: AuthUser, id: number, dto: VoidOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (order.status === OrderStatus.VOID) {
        throw new BadRequestException('Transaksi ini sudah dibatalkan');
      }

      const qtyPerProduct = new Map<number, number>();
      for (const item of order.items) {
        if (item.productId) {
          qtyPerProduct.set(item.productId, (qtyPerProduct.get(item.productId) ?? 0) + item.qty);
        }
      }

      for (const [productId, qty] of qtyPerProduct) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product || !product.trackStock) continue;
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: qty } },
        });
        await tx.stockMovement.create({
          data: {
            productId,
            userId: user.id,
            type: StockMovementType.VOID,
            qty,
            stockAfter: updated.stock,
            reference: order.invoiceNo,
            note: `Void: ${dto.reason.trim()}`,
          },
        });
      }

      return tx.order.update({
        where: { id },
        data: { status: OrderStatus.VOID, voidReason: dto.reason.trim(), voidedAt: new Date() },
        include: orderDetailInclude,
      });
    });
  }

  /** Format: INV-YYYYMMDD-0001 (berurutan per hari, zona waktu toko). */
  private async nextInvoiceNo(tx: Prisma.TransactionClient) {
    const prefix = `INV-${localDateKey(new Date()).replace(/-/g, '')}-`;
    const last = await tx.order.findFirst({
      where: { invoiceNo: { startsWith: prefix } },
      orderBy: { invoiceNo: 'desc' },
      select: { invoiceNo: true },
    });
    const next = last ? Number(last.invoiceNo.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }
}
