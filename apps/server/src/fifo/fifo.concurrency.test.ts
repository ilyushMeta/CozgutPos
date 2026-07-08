import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { FifoService } from './fifo.service.js';

/**
 * Real-database proof of SPEC §11 / CLAUDE.md golden rule #6: two concurrent
 * sales must not oversell one stock batch. Mocked-Prisma unit tests (see
 * fifo.service.test.ts) can't exercise this — MySQL's row locking is the
 * actual safety mechanism, so this test talks to the real dev database.
 */
function loadEnv(): void {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '../../.env');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^"(.*)"$/, '$1');
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

const prisma = new PrismaClient();
const fifo = new FifoService();

describe('FifoService concurrency (real DB, SPEC §11)', () => {
  let productId: number;
  let batchId: number;

  beforeAll(async () => {
    await prisma.$connect();
    const category = await prisma.category.findFirst();
    const product = await prisma.product.create({
      data: {
        name: 'Concurrency test product',
        code: `CONC-TEST-${Date.now()}`,
        categoryId: category?.id,
      },
    });
    productId = product.id;
    const batch = await prisma.stockBatch.create({
      data: {
        productId,
        qtyInitial: '10.000',
        qtyRemaining: '10.000',
        buyPrice: '1.00',
        sellPrice: '2.00',
        currency: 'TMT',
        receivedAt: new Date(),
      },
    });
    batchId = batch.id;
  });

  afterAll(async () => {
    await prisma.stockBatch.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.$disconnect();
  });

  it('never lets two parallel sales oversell one batch (10 in stock, 6+6 requested)', async () => {
    const attempt = (qty: number) =>
      prisma
        .$transaction((tx) => fifo.deduct(tx, productId, qty))
        .then(() => ({ ok: true as const }))
        .catch((e: Error) => ({ ok: false as const, message: e.message }));

    const [a, b] = await Promise.all([attempt(6), attempt(6)]);

    const succeeded = [a, b].filter((r) => r.ok);
    const failed = [a, b].filter((r) => !r.ok);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({
      ok: false,
      message: expect.stringContaining('insufficient stock'),
    });

    const finalBatch = await prisma.stockBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(finalBatch.qtyRemaining.toFixed(3)).toBe('4.000'); // 10 - 6, never negative, never double-deducted
  });

  it('lets two parallel sales both succeed when their sum fits (3+3 of 10)', async () => {
    // Reset the batch back to 10 for an independent scenario.
    await prisma.stockBatch.update({ where: { id: batchId }, data: { qtyRemaining: '10.000' } });

    const attempt = (qty: number) => prisma.$transaction((tx) => fifo.deduct(tx, productId, qty));
    const results = await Promise.allSettled([attempt(3), attempt(3)]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const finalBatch = await prisma.stockBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(finalBatch.qtyRemaining.toFixed(3)).toBe('4.000'); // 10 - 3 - 3
  });
});
