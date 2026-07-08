/**
 * Seed script (SPEC §12 Phase 1). Idempotent-ish: safe to re-run on an empty DB.
 * Creates admin+cashier, demo categories/products/batches (2 batches for FIFO
 * tests), PaymentDiscounts, ExchangeRate, Settings defaults, License, code seqs.
 */
import { PrismaClient, Role, Currency, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── Users (bcrypt hashes; temporary dev passwords) ──────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  const cashierHash = await bcrypt.hash('kassir123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminHash, role: Role.ADMIN },
  });
  await prisma.user.upsert({
    where: { username: 'kassir' },
    update: {},
    create: { username: 'kassir', passwordHash: cashierHash, role: Role.CASHIER },
  });

  // ── Categories ──────────────────────────────────────────────────────────────
  const azyk = await prisma.category.upsert({
    where: { name: 'Azyk' },
    update: {},
    create: { name: 'Azyk' },
  });
  const icgi = await prisma.category.upsert({
    where: { name: 'Içgi' },
    update: {},
    create: { name: 'Içgi' },
  });

  // ── Products + batches (2 batches each → FIFO by receivedAt) ─────────────────
  const products = [
    { name: 'Çörek', code: '1001', categoryId: azyk.id },
    { name: 'Süýt 1L', code: '1002', categoryId: azyk.id },
    { name: 'Suw 0.5L', code: '2001', categoryId: icgi.id },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: { name: p.name, code: p.code, categoryId: p.categoryId, lowStockThreshold: 10 },
    });

    const existing = await prisma.stockBatch.count({ where: { productId: product.id } });
    if (existing === 0) {
      await prisma.stockBatch.createMany({
        data: [
          {
            productId: product.id,
            qtyInitial: 100,
            qtyRemaining: 100,
            buyPrice: 3,
            sellPrice: 5,
            currency: Currency.TMT,
            receivedAt: new Date('2026-06-01T09:00:00'),
          },
          {
            productId: product.id,
            qtyInitial: 50,
            qtyRemaining: 50,
            buyPrice: 3.5,
            sellPrice: 5.5,
            currency: Currency.TMT,
            receivedAt: new Date('2026-06-15T09:00:00'),
          },
        ],
      });
    }
  }

  // ── Payment discounts (SPEC §5.11) ──────────────────────────────────────────
  for (const method of [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.DEBT]) {
    await prisma.paymentDiscount.upsert({
      where: { method },
      update: {},
      create: { method, percent: 0 },
    });
  }

  // ── Exchange rate (initial) ─────────────────────────────────────────────────
  const rateCount = await prisma.exchangeRate.count();
  if (rateCount === 0) {
    await prisma.exchangeRate.create({ data: { rate: 19.65 } });
  }

  // ── Settings defaults (replaces legacy C:\xampp\*.txt) ──────────────────────
  const defaults: Record<string, string> = {
    'server.mode': 'SERVER',
    'receipt.shopHeader': 'Çözgüt Dükany',
    'printer.name': '',
    'printer.copies': '1',
    'costing.method': 'fifo',
    'scale.enabled': 'false',
    'scale.pluPath': '',
    'sms.gatewayIp': '',
    'sms.token': '',
    'ui.language': 'tm',
    'app.firstRunDone': 'false',
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // ── License (30-day trial) ──────────────────────────────────────────────────
  const today = new Date();
  await prisma.license.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      remainingDays: 30,
      lastSeenDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      plan: 'TRIAL',
    },
  });

  // ── Code sequences (SPEC §6.9) ──────────────────────────────────────────────
  for (const pool of ['product', 'composite', 'debtor', 'supplier', 'invoice']) {
    await prisma.codeSequence.upsert({
      where: { pool },
      update: {},
      create: { pool, next: pool === 'product' ? 3000 : 1 },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete: admin/admin123, kassir/kassir123');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
