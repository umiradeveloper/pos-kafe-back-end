import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CashMovementType, OrderStatus, PaymentMethod, Role, ShiftStatus } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { resolveRange } from '../common/utils/date.util';
import { PrismaService } from '../prisma/prisma.service';
import { CashMovementDto, CloseShiftDto, OpenShiftDto, ShiftQueryDto } from './shifts.dto';

const userSelect = { select: { id: true, name: true } } as const;

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Shift yang sedang terbuka milik user (null jika belum buka shift). */
  findOpenShift(userId: number) {
    return this.prisma.shift.findFirst({
      where: { userId, status: ShiftStatus.OPEN },
      orderBy: { openedAt: 'desc' },
    });
  }

  async current(user: AuthUser) {
    const shift = await this.findOpenShift(user.id);
    if (!shift) return { shift: null, summary: null };
    return { shift, summary: await this.summarize(shift.id) };
  }

  async open(user: AuthUser, dto: OpenShiftDto) {
    if (await this.findOpenShift(user.id)) {
      throw new BadRequestException('Anda masih punya shift yang terbuka');
    }
    return this.prisma.shift.create({ data: { userId: user.id, openingCash: dto.openingCash } });
  }

  async addCashMovement(user: AuthUser, dto: CashMovementDto) {
    const shift = await this.requireOpenShift(user.id);
    return this.prisma.cashMovement.create({
      data: { shiftId: shift.id, type: dto.type, amount: dto.amount, note: dto.note.trim() },
    });
  }

  async close(user: AuthUser, dto: CloseShiftDto) {
    const shift = await this.requireOpenShift(user.id);
    const summary = await this.summarize(shift.id);
    return this.prisma.shift.update({
      where: { id: shift.id },
      data: {
        status: ShiftStatus.CLOSED,
        closedAt: new Date(),
        expectedCash: summary.expectedCash,
        closingCash: dto.closingCash,
        difference: dto.closingCash - summary.expectedCash,
        note: dto.note?.trim() || null,
      },
      include: { user: userSelect },
    });
  }

  findAll(query: ShiftQueryDto) {
    const { gte, lt } = resolveRange(query.from, query.to);
    return this.prisma.shift.findMany({
      where: { openedAt: { gte, lt } },
      include: { user: userSelect, _count: { select: { orders: true } } },
      orderBy: { openedAt: 'desc' },
    });
  }

  async findOne(user: AuthUser, id: number) {
    const shift = await this.prisma.shift.findUniqueOrThrow({
      where: { id },
      include: { user: userSelect, cashMovements: { orderBy: { createdAt: 'asc' } } },
    });
    if (user.role === Role.CASHIER && shift.userId !== user.id) {
      throw new ForbiddenException('Anda hanya bisa melihat shift sendiri');
    }
    return { shift, summary: await this.summarize(id) };
  }

  /** Rekap penjualan dan kas dalam satu shift. */
  async summarize(shiftId: number) {
    const shift = await this.prisma.shift.findUniqueOrThrow({ where: { id: shiftId } });

    const [byPayment, voided, cash] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['paymentMethod'],
        where: { shiftId, status: OrderStatus.PAID },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.count({ where: { shiftId, status: OrderStatus.VOID } }),
      this.prisma.cashMovement.groupBy({
        by: ['type'],
        where: { shiftId },
        _sum: { amount: true },
      }),
    ]);

    const payments = Object.values(PaymentMethod).map((method) => {
      const row = byPayment.find((r) => r.paymentMethod === method);
      return { method, count: row?._count._all ?? 0, total: row?._sum.total ?? 0 };
    });
    const totalSales = payments.reduce((sum, p) => sum + p.total, 0);
    const orderCount = payments.reduce((sum, p) => sum + p.count, 0);
    const cashSales = payments.find((p) => p.method === PaymentMethod.CASH)?.total ?? 0;
    const cashIn = cash.find((c) => c.type === CashMovementType.IN)?._sum.amount ?? 0;
    const cashOut = cash.find((c) => c.type === CashMovementType.OUT)?._sum.amount ?? 0;

    return {
      orderCount,
      voidCount: voided,
      totalSales,
      payments,
      openingCash: shift.openingCash,
      cashSales,
      cashIn,
      cashOut,
      expectedCash: shift.openingCash + cashSales + cashIn - cashOut,
    };
  }

  private async requireOpenShift(userId: number) {
    const shift = await this.findOpenShift(userId);
    if (!shift) throw new BadRequestException('Belum ada shift yang dibuka');
    return shift;
  }
}
