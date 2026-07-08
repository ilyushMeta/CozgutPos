import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReceivingService } from './receiving.service.js';
import { CodesService } from '../codes/codes.service.js';
import { CashService } from '../cash/cash.service.js';

const INCOMING = ['SALE_CASH', 'DEPOSIT', 'DEBT_PAYMENT_IN'];
const OUTGOING = ['WITHDRAWAL', 'PURCHASE_PAYMENT'];

function makeState() {
  return {
    seqs: { invoice: 1, product: 3000 } as Record<string, number>,
    products: new Map<number, any>([
      [1, { id: 1, name: 'Bar haryt', code: '1001', isScaleItem: false }],
    ]),
    nextProductId: 2,
    batches: [] as any[],
    suppliers: new Map<number, any>([[1, { id: 1, code: '8000', balance: '100.00' }]]),
    supplierDebtMoves: [] as any[],
    cashMoves: [] as any[],
    exchangeRate: { rate: '20.00', effectiveFrom: new Date() },
  };
}

function makePrisma(state: ReturnType<typeof makeState>) {
  const tx = {
    product: {
      create: vi.fn(async ({ data }: any) => {
        const p = { id: state.nextProductId++, isScaleItem: false, ...data };
        state.products.set(p.id, p);
        return p;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const p = state.products.get(where.id);
        Object.assign(p, data);
        return p;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const p = state.products.get(where.id);
        if (!p) throw new Error('not found');
        return p;
      }),
    },
    stockBatch: {
      create: vi.fn(async ({ data }: any) => {
        const b = { id: state.batches.length + 1, ...data };
        state.batches.push(b);
        return b;
      }),
    },
    supplier: {
      findUnique: vi.fn(async ({ where }: any) => state.suppliers.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const s = state.suppliers.get(where.id);
        Object.assign(s, data);
        return s;
      }),
    },
    supplierDebtMove: {
      create: vi.fn(async ({ data }: any) => {
        state.supplierDebtMoves.push(data);
        return { id: state.supplierDebtMoves.length, ...data };
      }),
    },
    exchangeRate: {
      findFirst: vi.fn(async () => state.exchangeRate),
    },
    cashMove: {
      aggregate: vi.fn(async ({ where }: any) => {
        const types: string[] = where.type.in;
        const isIncoming = types.every((t) => INCOMING.includes(t));
        const relevant = state.cashMoves.filter((m) =>
          (isIncoming ? INCOMING : OUTGOING).includes(m.type),
        );
        const sum = relevant.reduce((acc, m) => acc + Number(m.amount), 0);
        return { _sum: { amount: relevant.length ? sum : null } };
      }),
      create: vi.fn(async ({ data }: any) => {
        state.cashMoves.push(data);
        return { id: state.cashMoves.length, ...data };
      }),
    },
  };

  return {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    product: {
      findUnique: vi.fn(async ({ where }: any) => {
        for (const p of state.products.values()) if (p.code === where.code) return p;
        return null;
      }),
    },
    codeSequence: {
      upsert: vi.fn(async ({ where, create }: any) => {
        if (!(where.pool in state.seqs)) state.seqs[where.pool] = create.next;
        return { pool: where.pool, next: state.seqs[where.pool] };
      }),
      update: vi.fn(async ({ where }: any) => {
        state.seqs[where.pool] += 1;
        return { pool: where.pool, next: state.seqs[where.pool] };
      }),
    },
  } as any;
}

function makePlu() {
  return { exportSafely: vi.fn(async () => undefined) };
}

function makeServices(state: ReturnType<typeof makeState>) {
  const prisma = makePrisma(state);
  const codes = new CodesService(prisma);
  const cash = new CashService(prisma);
  const plu = makePlu();
  return { prisma, plu, svc: new ReceivingService(prisma, codes, cash, plu as any) };
}

describe('ReceivingService (SPEC §5.3/§6.8)', () => {
  let state: ReturnType<typeof makeState>;

  beforeEach(() => {
    state = makeState();
  });

  it('NONE: creates a batch for an existing product with no money movement', async () => {
    const { svc } = makeServices(state);
    const result = await svc.receive({
      paymentSource: 'NONE' as any,
      lines: [{ productId: 1, qty: 10, buyPrice: 5, sellPrice: 8, currency: 'TMT' as any }],
    } as any);

    expect(result.batches).toHaveLength(1);
    expect(result.total).toBe('50.00');
    expect(state.cashMoves).toHaveLength(0);
    expect(state.supplierDebtMoves).toHaveLength(0);
  });

  it('NONE: creates a brand-new product inline with an auto-generated code', async () => {
    const { svc } = makeServices(state);
    const result = await svc.receive({
      paymentSource: 'NONE' as any,
      lines: [
        {
          newProduct: { name: 'Täze haryt' },
          qty: 4,
          buyPrice: 25,
          sellPrice: 30,
          currency: 'TMT' as any,
        },
      ],
    } as any);

    const createdProductId = result.batches[0].productId;
    expect(state.products.get(createdProductId).code).toBe('3000');
    expect(result.total).toBe('100.00');
  });

  it('CASHBOX: records a PURCHASE_PAYMENT cash move for the invoice total, no supplier move', async () => {
    const { svc } = makeServices(state);
    const result = await svc.receive({
      paymentSource: 'CASHBOX' as any,
      lines: [{ productId: 1, qty: 2, buyPrice: 15, sellPrice: 20, currency: 'TMT' as any }],
    } as any);

    expect(result.total).toBe('30.00');
    expect(state.cashMoves).toHaveLength(1);
    expect(state.cashMoves[0].type).toBe('PURCHASE_PAYMENT');
    expect(state.cashMoves[0].amount).toBe('30.00');
    expect(state.supplierDebtMoves).toHaveLength(0);
  });

  it('SUPPLIER_CREDIT: increases supplier balance and logs a PURCHASE move, no cash move', async () => {
    const { svc } = makeServices(state);
    const result = await svc.receive({
      paymentSource: 'SUPPLIER_CREDIT' as any,
      supplierId: 1,
      lines: [{ productId: 1, qty: 3, buyPrice: 10, sellPrice: 14, currency: 'TMT' as any }],
    } as any);

    expect(result.total).toBe('30.00');
    expect(state.suppliers.get(1).balance).toBe('130.00'); // 100 opening + 30
    expect(state.supplierDebtMoves).toHaveLength(1);
    expect(state.supplierDebtMoves[0]).toMatchObject({
      type: 'PURCHASE',
      amount: '30.00',
      opening: '100.00',
      closing: '130.00',
    });
    expect(state.cashMoves).toHaveLength(0);
  });

  it('USD currency: converts buyPrice/sellPrice to TMT using the current rate and snapshots buyRate', async () => {
    const { svc } = makeServices(state);
    const result = await svc.receive({
      paymentSource: 'NONE' as any,
      lines: [{ productId: 1, qty: 1, buyPrice: 2, sellPrice: 3, currency: 'USD' as any }],
    } as any);

    const batch = state.batches[0];
    expect(batch.currency).toBe('USD');
    expect(batch.buyPrice).toBe('40.00'); // 2 USD * 20.00 rate
    expect(batch.sellPrice).toBe('60.00'); // 3 USD * 20.00 rate
    expect(batch.sellPriceUSD).toBe('3.00');
    expect(batch.buyRate).toBe('20.00');
    expect(result.total).toBe('40.00');
  });

  it('sums multiple lines into one invoice total under one invoiceNo', async () => {
    const { svc } = makeServices(state);
    const result = await svc.receive({
      paymentSource: 'NONE' as any,
      lines: [
        { productId: 1, qty: 2, buyPrice: 10, sellPrice: 12, currency: 'TMT' as any },
        {
          newProduct: { name: 'Ikinji haryt' },
          qty: 1,
          buyPrice: 5,
          sellPrice: 7,
          currency: 'TMT' as any,
        },
      ],
    } as any);

    expect(result.total).toBe('25.00'); // 2*10 + 1*5
    expect(state.batches[0].invoiceNo).toBe(state.batches[1].invoiceNo);
  });

  describe('PLU re-export trigger (SPEC §7.3)', () => {
    it('fires after commit when a scale-item product is touched', async () => {
      const { svc, plu } = makeServices(state);
      await svc.receive({
        paymentSource: 'NONE' as any,
        lines: [
          {
            newProduct: { name: 'Terezi haryt' },
            qty: 1,
            buyPrice: 1,
            sellPrice: 2,
            currency: 'TMT' as any,
            isScaleItem: true,
          },
        ],
      } as any);
      expect(plu.exportSafely).toHaveBeenCalledTimes(1);
    });

    it('does not fire when no line touches a scale item', async () => {
      const { svc, plu } = makeServices(state);
      await svc.receive({
        paymentSource: 'NONE' as any,
        lines: [{ productId: 1, qty: 1, buyPrice: 1, sellPrice: 2, currency: 'TMT' as any }],
      } as any);
      expect(plu.exportSafely).not.toHaveBeenCalled();
    });
  });
});
