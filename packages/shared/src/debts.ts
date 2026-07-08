import { z } from 'zod';
import { Currency } from './enums.js';

/** Debtor (karzçy) CRUD (SPEC §5.5). `code` omitted → server auto-generates
 * (SPEC §6.9). `accountCurrency` is frozen at creation semantics (SPEC §14:
 * "debtor currency handling via account type" must not change once sales
 * exist against it — the server does not currently block editing it, but
 * client UI should treat it as effectively fixed once a debtor has history). */
export const debtorSchema = z.object({
  name: z.string().min(1).max(191),
  code: z.string().min(1).max(64).optional(),
  phone: z.string().max(32).optional(),
  note: z.string().optional(),
  accountCurrency: z.nativeEnum(Currency).optional().default(Currency.TMT),
});
export type DebtorInput = z.infer<typeof debtorSchema>;

/** Supplier (karz dükan) CRUD (SPEC §5.6). */
export const supplierUpsertSchema = z.object({
  name: z.string().min(1).max(191),
  code: z.string().min(1).max(64).optional(),
  phone: z.string().max(32).optional(),
  note: z.string().optional(),
});
export type SupplierUpsertInput = z.infer<typeof supplierUpsertSchema>;

/** Karz tölemek (SPEC §5.5) — amount is entered in the debtor's own account currency. */
export const debtPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
  sendSms: z.boolean().optional().default(false),
});
export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>;

/** Dükan karz tölemek (SPEC §5.6) — always TMT (cashbox payment). */
export const supplierPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
});
export type SupplierPaymentInput = z.infer<typeof supplierPaymentSchema>;
