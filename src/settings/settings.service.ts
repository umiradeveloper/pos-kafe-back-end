import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ambil pengaturan toko; dibuat otomatis dengan nilai default jika belum ada. */
  get() {
    return this.prisma.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  }

  async update(dto: UpdateSettingsDto) {
    await this.get();
    return this.prisma.setting.update({
      where: { id: 1 },
      data: {
        storeName: dto.storeName?.trim(),
        address: dto.address === undefined ? undefined : dto.address.trim() || null,
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
        taxPercent: dto.taxPercent,
        servicePercent: dto.servicePercent,
        receiptFooter: dto.receiptFooter === undefined ? undefined : dto.receiptFooter.trim() || null,
      },
    });
  }
}
