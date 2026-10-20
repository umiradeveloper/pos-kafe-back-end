import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { addDays, localDateKey, localHour, resolveRange } from '../common/utils/date.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(from?: string, to?: string) {
    const range = resolveRange(from, to);
    const paidWhere = { status: OrderStatus.PAID, createdAt: { gte: range.gte, lt: range.lt } };

    const [orders, items, voidCount, topProducts, byCashierRaw, lowStock] = await Promise.all([
      this.prisma.order.findMany({
        where: paidWhere,
        select: {
          createdAt: true,
          subtotal: true,
          discount: true,
          serviceCharge: true,
          tax: true,
          total: true,
          paymentMethod: true,
          orderType: true,
        },
      }),
      this.prisma.orderItem.findMany({
        where: { order: paidWhere },
        select: { qty: true, cost: true },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.VOID, createdAt: { gte: range.gte, lt: range.lt } },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productName'],
        where: { order: paidWhere },
        _sum: { qty: true, subtotal: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 10,
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: paidWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.product.findMany({
        where: { isActive: true, trackStock: true, stock: { lte: this.prisma.product.fields.minStock } },
        select: { id: true, name: true, stock: true, minStock: true },
        orderBy: { stock: 'asc' },
        take: 20,
      }),
    ]);

    // Ringkasan angka
    const sum = (key: 'subtotal' | 'discount' | 'serviceCharge' | 'tax' | 'total') =>
      orders.reduce((acc, o) => acc + o[key], 0);
    const grossSales = sum('subtotal');
    const discount = sum('discount');
    const netSales = grossSales - discount;
    const cogs = items.reduce((acc, i) => acc + i.cost * i.qty, 0);
    const totalCollected = sum('total');

    // Per hari (semua tanggal dalam rentang, termasuk yang kosong)
    const daily = new Map<string, { date: string; total: number; count: number }>();
    for (let d = range.fromKey; d <= range.toKey; d = addDays(d, 1)) {
      daily.set(d, { date: d, total: 0, count: 0 });
      if (daily.size > 400) break;
    }
    // Per jam (pola jam ramai)
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, count: 0 }));
    // Per metode bayar
    const payments = Object.values(PaymentMethod).map((method) => ({ method, total: 0, count: 0 }));
    // Per jenis pesanan
    const orderTypes = { DINE_IN: { total: 0, count: 0 }, TAKEAWAY: { total: 0, count: 0 } };

    for (const o of orders) {
      const day = daily.get(localDateKey(o.createdAt));
      if (day) {
        day.total += o.total;
        day.count += 1;
      }
      const hour = localHour(o.createdAt);
      hourly[hour].total += o.total;
      hourly[hour].count += 1;
      const pay = payments.find((p) => p.method === o.paymentMethod)!;
      pay.total += o.total;
      pay.count += 1;
      orderTypes[o.orderType].total += o.total;
      orderTypes[o.orderType].count += 1;
    }

    // Nama kasir
    const users = await this.prisma.user.findMany({
      where: { id: { in: byCashierRaw.map((r) => r.userId) } },
      select: { id: true, name: true },
    });
    const byCashier = byCashierRaw
      .map((r) => ({
        userId: r.userId,
        name: users.find((u) => u.id === r.userId)?.name ?? `User #${r.userId}`,
        total: r._sum.total ?? 0,
        count: r._count._all,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      range: { from: range.fromKey, to: range.toKey },
      totals: {
        orderCount: orders.length,
        voidCount,
        grossSales, // total harga item sebelum diskon
        discount,
        netSales, // setelah diskon, sebelum pajak & service
        serviceCharge: sum('serviceCharge'),
        tax: sum('tax'),
        totalCollected, // uang yang diterima (termasuk pajak & service)
        cogs, // HPP
        grossProfit: netSales - cogs,
        averageOrder: orders.length ? Math.round(totalCollected / orders.length) : 0,
        itemsSold: items.reduce((acc, i) => acc + i.qty, 0),
      },
      daily: [...daily.values()],
      hourly,
      payments,
      orderTypes,
      topProducts: topProducts.map((p) => ({
        name: p.productName,
        qty: p._sum.qty ?? 0,
        total: p._sum.subtotal ?? 0,
      })),
      byCashier,
      lowStock,
    };
  }
}
