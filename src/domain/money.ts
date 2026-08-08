import type { LocaleCode, Minor } from './types'

const MINOR_PER_MAJOR = 100

const INTL_LOCALE: Record<LocaleCode, string> = {
  tm: 'tk-TM',
  ru: 'ru-RU',
  en: 'en-US',
  tr: 'tr-TR',
}

/** Ýarym teňňeleri iň ýakyn bitine tegeleýär (banker däl, adaty tegelekleme). */
export function roundMinor(value: number): Minor {
  return Math.round(value)
}

export function multiply(amount: Minor, quantity: number): Minor {
  return roundMinor(amount * quantity)
}

/** `bps` — basis points: 1200 = 12.00%. */
export function percentOf(amount: Minor, bps: number): Minor {
  return roundMinor((amount * bps) / 10_000)
}

/**
 * Baha salgydy öz içine alýan bolsa, içindäki salgyt paýyny çykarýar.
 * total = net + net*rate  =>  salgyt = total * rate / (1 + rate)
 */
export function taxFromInclusive(amount: Minor, bps: number): Minor {
  return roundMinor((amount * bps) / (10_000 + bps))
}

export function parseMajor(input: string): Minor | null {
  const normalized = input.trim().replace(',', '.')
  if (normalized === '' || !/^\d*\.?\d*$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return roundMinor(value * MINOR_PER_MAJOR)
}

export function toMajor(amount: Minor): number {
  return amount / MINOR_PER_MAJOR
}

export function formatMoney(amount: Minor, currency: string, locale: LocaleCode): string {
  try {
    return new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toMajor(amount))
  } catch {
    // Nätanyş walýuta kody — Intl ýalňyşlyk berýär, ýönekeý görnüşe geçýäris.
    return `${toMajor(amount).toFixed(2)} ${currency}`
  }
}

export function formatNumber(value: number, locale: LocaleCode): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: 3,
  }).format(value)
}

export function formatDateTime(iso: string, locale: LocaleCode): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
