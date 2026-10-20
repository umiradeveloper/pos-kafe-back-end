import { OrderStatus, OrderType, PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsInt()
  productId!: number;

  @IsInt()
  @Min(1, { message: 'Jumlah minimal 1' })
  @Max(999)
  qty!: number;

  /** Catatan per item, mis. "less sugar", "tanpa es" */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class CreateOrderDto {
  @IsEnum(OrderType)
  orderType!: OrderType;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tableNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Keranjang masih kosong' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  /** Diskon nominal (Rupiah) untuk seluruh transaksi */
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  /** Uang yang diterima. Untuk non-tunai boleh dikosongkan (otomatis = total). */
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class VoidOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Alasan pembatalan wajib diisi' })
  @MaxLength(255)
  reason!: string;
}

export class OrderQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /** Cari berdasarkan nomor invoice, nama pelanggan, atau nomor meja */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  shiftId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
