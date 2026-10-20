import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Pengaturan toko
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: 'Kafe Senja',
      address: 'Jl. Contoh No. 1, Jakarta',
      phone: '0812-0000-0000',
      taxPercent: 10,
      servicePercent: 0,
      receiptFooter: 'Terima kasih, sampai jumpa lagi!',
    },
  });

  // Pengguna awal
  const users: { name: string; username: string; password: string; role: Role }[] = [
    { name: 'Pemilik', username: 'owner', password: 'owner123', role: Role.OWNER },
    { name: 'Admin', username: 'admin', password: 'admin123', role: Role.ADMIN },
    { name: 'Kasir 1', username: 'kasir', password: 'kasir123', role: Role.CASHIER },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, password: await bcrypt.hash(u.password, 10) },
    });
  }

  // Kategori & produk contoh
  const catalog: Record<string, { name: string; price: number; cost: number; stock: number; trackStock?: boolean }[]> = {
    Kopi: [
      { name: 'Espresso', price: 18000, cost: 6000, stock: 100 },
      { name: 'Americano', price: 22000, cost: 7000, stock: 100 },
      { name: 'Cappuccino', price: 28000, cost: 9000, stock: 100 },
      { name: 'Kopi Susu Gula Aren', price: 25000, cost: 8000, stock: 100 },
      { name: 'Caffe Latte', price: 28000, cost: 9000, stock: 100 },
    ],
    'Non-Kopi': [
      { name: 'Matcha Latte', price: 30000, cost: 11000, stock: 60 },
      { name: 'Coklat Panas', price: 26000, cost: 9000, stock: 60 },
      { name: 'Teh Tarik', price: 20000, cost: 6000, stock: 60 },
      { name: 'Air Mineral', price: 8000, cost: 3000, stock: 48 },
    ],
    Makanan: [
      { name: 'Nasi Goreng Kampung', price: 35000, cost: 14000, stock: 30 },
      { name: 'Mie Goreng Spesial', price: 32000, cost: 12000, stock: 30 },
      { name: 'Chicken Katsu Rice', price: 40000, cost: 17000, stock: 25 },
    ],
    Snack: [
      { name: 'French Fries', price: 22000, cost: 8000, stock: 40 },
      { name: 'Croissant Butter', price: 24000, cost: 10000, stock: 15 },
      { name: 'Pisang Goreng Keju', price: 20000, cost: 7000, stock: 20 },
    ],
  };

  let sortOrder = 0;
  let skuCounter = 1;
  for (const [categoryName, products] of Object.entries(catalog)) {
    const category = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName, sortOrder: sortOrder++ },
    });
    for (const p of products) {
      const sku = `P${String(skuCounter++).padStart(4, '0')}`;
      await prisma.product.upsert({
        where: { sku },
        update: {},
        create: {
          ...p,
          sku,
          categoryId: category.id,
          trackStock: p.trackStock ?? true,
          minStock: 5,
        },
      });
    }
  }

  console.log('Seed selesai. Login: owner/owner123, admin/admin123, kasir/kasir123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
