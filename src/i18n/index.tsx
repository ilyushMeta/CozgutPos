import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { LocaleCode } from '../domain/types'
import { en } from './locales/en'
import type { Dictionary } from './locales/en'
import { ru } from './locales/ru'
import { tm } from './locales/tm'
import { tr } from './locales/tr'

const DICTIONARIES: Record<LocaleCode, Dictionary> = { tm, ru, en, tr }

/** Dil çalyşdyryjyda görkezilýän tertip we atlar (hemişe öz dilinde). */
export const LOCALES: ReadonlyArray<{ code: LocaleCode; label: string }> = [
  { code: 'tm', label: 'Türkmen' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
]

/** `'pos.total'` görnüşindäki iki derejeli açarlar. */
export type TranslationKey = {
  [Section in keyof Dictionary]: `${Section & string}.${keyof Dictionary[Section] & string}`
}[keyof Dictionary]

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

interface I18nValue {
  locale: LocaleCode
  t: Translate
}

const I18nContext = createContext<I18nValue | null>(null)

function lookup(dict: Dictionary, key: TranslationKey): string | undefined {
  const [section, entry] = key.split('.') as [keyof Dictionary, string]
  const table = dict[section] as Record<string, string> | undefined
  return table?.[entry]
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export function I18nProvider({ locale, children }: { locale: LocaleCode; children: ReactNode }) {
  const t = useCallback<Translate>(
    (key, params) => {
      // Terjime ýetmedik ýagdaýynda iňlis dilinden, ol hem ýok bolsa açaryň özünden.
      const template = lookup(DICTIONARIES[locale], key) ?? lookup(en as Dictionary, key) ?? key
      return interpolate(template, params)
    },
    [locale],
  )

  const value = useMemo<I18nValue>(() => ({ locale, t }), [locale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n I18nProvider-iň içinde ulanylmaly')
  return value
}
