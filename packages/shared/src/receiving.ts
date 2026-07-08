import { z } from 'zod';
import { Currency, PaymentSource } from './enums.js';

/** One receiving-cart line: either an existing product or an inline new one. */
export const receivingLineSchema = z
  .object({
    productId: z.coerce.number().int().positive().optional(),
    newProduct: z
      .object({
        name: z.string().min(1).max(191),
        code: z.string().min(1).max(64).optional(),
        categoryId: z.coerce.number().int().positive().nullable().optional(),
      })
      .optional(),
    qty: z.coerce.number().positive(),
    buyPrice: z.coerce.number().nonnegative(),
    sellPrice: z.coerce.number().nonnegative(),
    sellPriceUSD: z.coerce.number().nonnegative().optional(),
    currency: z.nativeEnum(Currency).default(Currency.TMT),
    expiryDate: z.coerce.date().nullable().optional(),
    lowStockThreshold: z.coerce.number().nonnegative().optional(),
    isScaleItem: z.boolean().optional(),
  })
  .refine((line) => !!line.productId || !!line.newProduct, {
    message: 'productId or newProduct is required',
    path: ['productId'],
  });
export type ReceivingLineInput = z.infer<typeof receivingLineSchema>;

/**
 * Haryt goş (receiving) submission (SPEC §5.3/§6.8). One invoice, one funding
 * source — see PaymentSource doc comment for why cashbox/supplier-credit are
 * mutually exclusive rather than a partial split.
 */
export const receivingSchema = z
  .object({
    lines: z.array(receivingLineSchema).min(1),
    paymentSource: z.nativeEnum(PaymentSource).default(PaymentSource.NONE),
    supplierId: z.coerce.number().int().positive().optional(),
  })
  .refine((body) => body.paymentSource !== PaymentSource.SUPPLIER_CREDIT || !!body.supplierId, {
    message: 'supplierId is required for SUPPLIER_CREDIT',
    path: ['supplierId'],
  });
export type ReceivingInput = z.infer<typeof receivingSchema>;
