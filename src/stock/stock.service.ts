import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { resolveRange } from '../common/utils/date.util';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto, StockQueryDto } from './stock.dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  findMovements(query: StockQueryDto) {
    const where: Prisma.StockMovementWhereInput = {};
    if (query.productId) where.productId = query.productId;
    if (query.type) where.type = query.type;
    if (query.from || query.to) {
      const { gte, lt } = resolveRange(query.from, query.to);
      where.createdAt = { gte, lt };
    }

    return this.prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  async adjust(user: AuthUser, dto: AdjustStockDto) {
    return this.prisma.$transaction(async (tx) => {
      // Kunci baris produk selama transaksi agar tidak bentrok dengan penjualan
      const rows = await tx.$queryRaw<{ id: number; stock: number; trackStock: number | boolean }[]>`
        SELECT id, stock, trackStock FROM products WHERE id = ${dto.productId} FOR UPDATE`;
      const product = rows[0];
      if (!product) throw new BadRequestException('Produk tidak ditemukan');
      if (!product.trackStock) throw new BadRequestException('Produk ini tidak menggunakan stok');

      const current = Number(product.stock);
      let delta: number;
      if (dto.type === StockMovementType.IN) delta = dto.qty;
      else if (dto.type === StockMovementType.OUT) delta = -dto.qty;
      else delta = dto.qty - current; // ADJUST: set ke jumlah fisik

      if (dto.type !== StockMovementType.ADJUST && dto.qty === 0) {
        throw new BadRequestException('Jumlah harus lebih dari 0');
      }
      const stockAfter = current + delta;
      if (stockAfter < 0) {
        throw new BadRequestException(`Stok tidak cukup. Stok saat ini ${current}`);
      }

      await tx.product.update({ where: { id: dto.productId }, data: { stock: stockAfter } });
      return tx.stockMovement.create({
        data: {
          productId: dto.productId,
          userId: user.id,
          type: dto.type,
          qty: delta,
          stockAfter,
          note: dto.note.trim(),
        },
        include: { product: { select: { id: true, name: true } } },
      });
    });
  }
}
