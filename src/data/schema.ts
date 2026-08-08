import type { Category, Order, Product, Settings } from '../domain/types'

/** Ätiýaçlyk nusgalary okanymyzda migrasiýa gerekmi diýip barlamak üçin. */
export const SCHEMA_VERSION = 1

export const STORAGE_KEY = 'cozgutpos:v1'

export interface AppState {
  version: number
  settings: Settings
  categories: Category[]
  products: Product[]
  orders: Order[]
  /** Çek belgilerini yzygiderli bermek üçin ýyllyk sanaç. */
  receiptCounter: { year: number; seq: number }
}

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'CozgutPos',
  locale: 'tm',
  currency: 'TMT',
  taxIncluded: true,
  taxRateBps: 0,
  receiptFooter: '',
}
