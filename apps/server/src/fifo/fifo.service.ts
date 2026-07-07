import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dec, money, qty as qtyRound, type Numeric } from '@cozgut/shared';
import { FifoInsufficientStockException } from './fifo.exceptions.js';

type Tx = Prisma.TransactionClient;

interface BatchRow {
  id: number;
  qtyRemaining: string;
  buyPrice: string;
}

/**
 * FIFO/LIFO stock-batch deduction engine (SPEC §6.2). Concurrency-safe: the
 * candidate batches are read with `FOR UPDATE` inside the caller's
 * transaction, so a second concurrent deduct() for the same product blocks
 * until the first transaction commits or rolls back — two cashiers cannot
 * both read "10 remaining" and both deduct from it (CLAUDE.md golden rule #6,
 * SPEC §11).
 */
@Injectable()
export class FifoService {
  async deduct(tx: Tx, productId: number, requestedQty: Numeric, method: 'fifo' | 'lifo' = 'fifo') {
    const direction = method === 'lifo' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    const batches = await tx.$queryRaw<BatchRow[]>(
      Prisma.sql`
        SELECT id, qtyRemaining, buyPrice
        FROM stock_batches
        WHERE productId = ${productId} AND qtyRemaining > 0
        ORDER BY receivedAt ${direction}
        FOR UPDATE
      `,
    );

    let remaining = qtyRound(requestedQty);
    const breakdown: { batchId: number; qty: string; buyPrice: string }[] = [];
    let cogs = dec(0);

    for (const batch of batches) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const available = dec(batch.qtyRemaining);
      const take = remaining.lessThan(available) ? remaining : available;
      if (take.lessThanOrEqualTo(0)) continue;

      breakdown.push({ batchId: batch.id, qty: take.toFixed(3), buyPrice: batch.buyPrice });
      cogs = cogs.plus(take.times(dec(batch.buyPrice)));

      await tx.stockBatch.update({
        where: { id: batch.id },
        data: { qtyRemaining: available.minus(take).toFixed(3) },
      });

      remaining = remaining.minus(take);
    }

    if (remaining.greaterThan(0)) {
      throw new FifoInsufficientStockException(productId, remaining.toFixed(3));
    }

    return { breakdown, cogs: money(cogs) };
  }
}
