import { multiply, percentOf, taxFromInclusive } from './money'
import type { CartLine, Minor, OrderLine, Settings } from './types'

export interface CartTotals {
  subtotal: Minor
  lineDiscounts: Minor
  orderDiscount: Minor
  discount: Minor
  tax: Minor
  total: Minor
}

export function lineTotal(line: CartLine): Minor {
  return Math.max(0, multiply(line.unitPrice, line.quantity) - line.discount)
}

/**
 * Sebediň jemlerini hasaplaýar.
 *
 * `orderDiscount` — bütin çeke berlen goşmaça arzanladyş (minor). Ol setirleriň
 * jeminden köp bolsa, jeme çenli kesilýär, şeýlelikde jem hiç haçan otrisatel
 * bolmaýar.
 */
export function calculateTotals(
  lines: CartLine[],
  orderDiscount: Minor,
  settings: Pick<Settings, 'taxIncluded' | 'taxRateBps'>,
): CartTotals {
  const gross = lines.reduce((sum, line) => sum + multiply(line.unitPrice, line.quantity), 0)
  const lineDiscounts = lines.reduce(
    (sum, line) => sum + Math.min(line.discount, multiply(line.unitPrice, line.quantity)),
    0,
  )
  const afterLines = gross - lineDiscounts
  const appliedOrderDiscount = Math.min(Math.max(0, orderDiscount), afterLines)
  const net = afterLines - appliedOrderDiscount

  const tax = settings.taxIncluded
    ? taxFromInclusive(net, settings.taxRateBps)
    : percentOf(net, settings.taxRateBps)

  return {
    subtotal: gross,
    lineDiscounts,
    orderDiscount: appliedOrderDiscount,
    discount: lineDiscounts + appliedOrderDiscount,
    tax,
    total: settings.taxIncluded ? net : net + tax,
  }
}

export function toOrderLines(lines: CartLine[]): OrderLine[] {
  return lines.map(({ lineId: _lineId, ...rest }) => ({
    ...rest,
    total: lineTotal({ lineId: _lineId, ...rest }),
  }))
}
