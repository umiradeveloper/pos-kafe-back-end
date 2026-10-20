import { CashMovementType } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OpenShiftDto {
  @IsInt({ message: 'Modal awal harus berupa angka' })
  @Min(0)
  openingCash!: number;
}

export class CloseShiftDto {
  @IsInt({ message: 'Uang fisik di laci harus berupa angka' })
  @Min(0)
  closingCash!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CashMovementDto {
  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @IsInt()
  @Min(1, { message: 'Jumlah harus lebih dari 0' })
  amount!: number;

  @IsString()
  @IsNotEmpty({ message: 'Keterangan wajib diisi' })
  @MaxLength(255)
  note!: string;
}

export class ShiftQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
