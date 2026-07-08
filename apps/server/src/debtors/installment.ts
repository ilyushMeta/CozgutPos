import { money, type Numeric } from '@cozgut/shared';

export interface InstallmentRow {
  dueDate: Date;
  amount: ReturnType<typeof money>;
  openingBalance: ReturnType<typeof money>;
  closingBalance: ReturnType<typeof money>;
}

/** Whole calendar months between two dates (SPEC §6.5: "monthsN = max(1, whole
 * months between saleDate and dueDate)"). A partial trailing month doesn't count. */
export function wholeMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Split a debt amount into N equal monthly installment rows (SPEC §6.5).
 * `noDueDate` ("möhletsiz") forces N=1 with dueDate=saleDate; otherwise
 * N = max(1, whole months between saleDate and dueDate) and each row's own
 * dueDate = saleDate + n months.
 *
 * Rows track a running balance of THIS installment plan only (starts at the
 * full amount, ends at exactly 0) — see the plan's Context note on why this
 * is kept separate from Customer.balance, which is the debtor's aggregate
 * balance across all debts.
 */
export function splitInstallments(
  amount: Numeric,
  saleDate: Date,
  dueDate: Date | null,
  noDueDate: boolean,
): InstallmentRow[] {
  const total = money(amount);
  const monthsN = noDueDate || !dueDate ? 1 : Math.max(1, wholeMonthsBetween(saleDate, dueDate));
  const base = money(total.dividedBy(monthsN));

  const rows: InstallmentRow[] = [];
  let opening = total;
  for (let n = 1; n <= monthsN; n++) {
    const isLast = n === monthsN;
    // The last row absorbs any rounding remainder so the sum is always exact
    // and the schedule always ends at closingBalance=0.
    const rowAmount = isLast ? opening : base;
    const closing = money(opening.minus(rowAmount));
    rows.push({
      dueDate: noDueDate || !dueDate ? saleDate : addMonths(saleDate, n),
      amount: rowAmount,
      openingBalance: opening,
      closingBalance: closing,
    });
    opening = closing;
  }
  return rows;
}
