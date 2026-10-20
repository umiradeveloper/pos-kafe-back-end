import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama produk wajib diisi' })
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  categoryId?: number | null;

  @IsInt({ message: 'Harga harus berupa angka' })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  /** Stok awal saat produk dibuat. Perubahan berikutnya lewat menu Stok. */
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsUrl({}, { message: 'URL gambar tidak valid' })
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  categoryId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsUrl({}, { message: 'URL gambar tidak valid' })
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  /** "true" = hanya produk aktif */
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;

  /** "true" = hanya produk yang stoknya di bawah/sama dengan batas minimum */
  @IsOptional()
  @IsIn(['true', 'false'])
  lowStock?: string;
}
