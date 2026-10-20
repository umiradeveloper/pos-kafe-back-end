import { StockMovementType } from '@prisma/client';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const MANUAL_STOCK_TYPES = [StockMovementType.IN, StockMovementType.OUT, StockMovementType.ADJUST] as const;

export class AdjustStockDto {
  @IsInt()
  productId!: number;

  /** IN = tambah, OUT = kurangi, ADJUST = set jumlah akhir (stok opname) */
  @IsIn(MANUAL_STOCK_TYPES)
  type!: (typeof MANUAL_STOCK_TYPES)[number];

  /** Untuk IN/OUT: jumlah perubahan. Untuk ADJUST: jumlah stok fisik hasil hitung. */
  @IsInt()
  @Min(0)
  qty!: number;

  @IsString()
  @IsNotEmpty({ message: 'Keterangan wajib diisi' })
  @MaxLength(255)
  note!: string;
}

export class StockQueryDto {
  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsIn(Object.values(StockMovementType))
  type?: StockMovementType;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
