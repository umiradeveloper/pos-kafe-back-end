import { Injectable } from '@nestjs/common';
import { Prisma, Role, StockMovementType } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = {};
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [{ name: { contains: q } }, { sku: { contains: q } }];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.active === 'true') where.isActive = true;
    if (query.lowStock === 'true') {
      where.trackStock = true;
      where.stock = { lte: this.prisma.product.fields.minStock };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });

    // Kasir tidak perlu melihat harga modal
    if (user.role === Role.CASHIER) {
      return products.map(({ cost: _cost, ...p }) => p);
    }
    return products;
  }

  findOne(id: number) {
    return this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async create(user: AuthUser, dto: CreateProductDto) {
    const trackStock = dto.trackStock ?? true;
    const initialStock = trackStock ? (dto.stock ?? 0) : 0;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name.trim(),
          sku: dto.sku?.trim() || null,
          categoryId: dto.categoryId ?? null,
          price: dto.price,
          cost: dto.cost ?? 0,
          trackStock,
          stock: initialStock,
          minStock: dto.minStock ?? 0,
          imageUrl: dto.imageUrl || null,
          isActive: dto.isActive ?? true,
        },
      });
      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            userId: user.id,
            type: StockMovementType.IN,
            qty: initialStock,
            stockAfter: initialStock,
            note: 'Stok awal',
          },
        });
      }
      return product;
    });
  }

  update(id: number, dto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        sku: dto.sku === undefined ? undefined : dto.sku.trim() || null,
        categoryId: dto.categoryId,
        price: dto.price,
        cost: dto.cost,
        trackStock: dto.trackStock,
        minStock: dto.minStock,
        imageUrl: dto.imageUrl === undefined ? undefined : dto.imageUrl || null,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Produk yang belum pernah terjual dihapus permanen.
   * Produk yang sudah punya riwayat penjualan hanya dinonaktifkan agar laporan tetap utuh.
   */
  async remove(id: number) {
    const sold = await this.prisma.orderItem.count({ where: { productId: id } });
    if (sold > 0) {
      await this.prisma.product.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, message: 'Produk sudah pernah terjual, jadi dinonaktifkan (bukan dihapus)' };
    }
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true, message: 'Produk dihapus' };
  }
}
