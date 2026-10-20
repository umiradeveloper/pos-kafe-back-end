import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ManagerOnly } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  @ManagerOnly()
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { name: dto.name.trim(), sortOrder: dto.sortOrder ?? 0 } });
  }

  @ManagerOnly()
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name?.trim(), sortOrder: dto.sortOrder },
    });
  }

  /** Produk di kategori ini tidak ikut terhapus, hanya menjadi "tanpa kategori". */
  @ManagerOnly()
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.category.delete({ where: { id } });
    return { message: 'Kategori dihapus' };
  }
}
