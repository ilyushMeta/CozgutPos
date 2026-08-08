import type { Category, Product } from '../domain/types'
import type { AppState } from './schema'
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from './schema'
import { newId } from '../lib/id'

/**
 * Ilkinji açylyşda demo maglumat — ulanyjy boş ekrana däl-de, işläp duran
 * kassa gelsin. Sazlamalarda «Ähli maglumaty poz» arkaly aýrylýar.
 */
export function createSeedState(): AppState {
  const now = new Date().toISOString()

  const categories: Category[] = [
    { id: newId(), name: 'Içgiler', color: '#0ea5e9', sortOrder: 0 },
    { id: newId(), name: 'Çörek', color: '#f59e0b', sortOrder: 1 },
    { id: newId(), name: 'Süýt önümleri', color: '#22c55e', sortOrder: 2 },
    { id: newId(), name: 'Hojalyk harytlary', color: '#a855f7', sortOrder: 3 },
  ]

  const [drinks, bakery, dairy, household] = categories

  const define = (
    name: string,
    price: number,
    categoryId: string | null,
    stock: number | null,
    barcode: string | null,
    unit: Product['unit'] = 'pcs',
  ): Product => ({
    id: newId(),
    name,
    barcode,
    categoryId,
    price,
    cost: Math.round(price * 0.75),
    stock,
    unit,
    active: true,
    createdAt: now,
    updatedAt: now,
  })

  const products: Product[] = [
    define('Suw 0.5 l', 250, drinks.id, 120, '4780001000018'),
    define('Çaý «Ahal» 100 g', 1450, drinks.id, 40, '4780001000025'),
    define('Kola 1 l', 1200, drinks.id, 36, '4780001000032'),
    define('Çörek', 200, bakery.id, 60, '4780001000049'),
    define('Bulka', 150, bakery.id, 45, '4780001000056'),
    define('Süýt 1 l', 900, dairy.id, 24, '4780001000063'),
    define('Gatyk 400 g', 700, dairy.id, 30, '4780001000070'),
    define('Peýnir', 4800, dairy.id, 8, '4780001000087', 'kg'),
    define('Sabyn', 850, household.id, 50, '4780001000094'),
    define('Paket', 50, household.id, null, null),
  ]

  return {
    version: SCHEMA_VERSION,
    settings: DEFAULT_SETTINGS,
    categories,
    products,
    orders: [],
    receiptCounter: { year: new Date().getFullYear(), seq: 0 },
  }
}
