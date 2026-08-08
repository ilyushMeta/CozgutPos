/**
 * Ähli pul mukdarlary MINOR birlikde (teňňe/kopeýka/cent) bitin san hökmünde
 * saklanýar. Float ýalňyşlyklaryndan gaça durmak üçin hiç haçan `number` bilen
 * bölünen pul saklamaň — `src/domain/money.ts` ulanyň.
 */
export type Minor = number

export type Id = string

export type LocaleCode = 'tm' | 'ru' | 'en' | 'tr'

export interface Category {
  id: Id
  name: string
  color: string
  sortOrder: number
}

export interface Product {
  id: Id
  name: string
  barcode: string | null
  categoryId: Id | null
  /** Satyş bahasy, minor birlikde. */
  price: Minor
  /** Satyn alyş bahasy — peýda hasaplamak üçin. */
  cost: Minor
  /** Ammardaky mukdar. `null` — yzarlanmaýar (mysal üçin hyzmat). */
  stock: number | null
  unit: Unit
  active: boolean
  createdAt: string
  updatedAt: string
}

export type Unit = 'pcs' | 'kg' | 'l' | 'm' | 'pack'

export interface CartLine {
  /** Sebetdäki setiriň öz id-si — bir haryt birnäçe gezek goşulyp bilner. */
  lineId: Id
  productId: Id
  name: string
  unit: Unit
  unitPrice: Minor
  quantity: number
  /** Setire berlen arzanladyş, minor birlikde (jemi setir üçin). */
  discount: Minor
}

export type PaymentMethod = 'cash' | 'card' | 'transfer'

export interface OrderLine extends Omit<CartLine, 'lineId'> {
  /** Setiriň jemi: unitPrice * quantity - discount */
  total: Minor
}

export interface Order {
  id: Id
  /** Ynsan okap bilýän çek belgisi, mysal üçin `2026-0042`. */
  receiptNo: string
  lines: OrderLine[]
  subtotal: Minor
  discount: Minor
  tax: Minor
  total: Minor
  paymentMethod: PaymentMethod
  /** Nagt tölegde müşderiniň berdigi — gaýtargy hasaplamak üçin. */
  tendered: Minor | null
  change: Minor
  createdAt: string
  /** Yzyna gaýtarylan bolsa — asyl çek. */
  refundOf: Id | null
}

export interface Settings {
  storeName: string
  locale: LocaleCode
  /** ISO 4217, mysal üçin `TMT`. */
  currency: string
  /** Bahalaryň içinde salgyt barmy (inclusive) ýa-da üstüne goşulýarmy. */
  taxIncluded: boolean
  /** Salgyt göterimi, ýüzden bir bölek: 1200 = 12.00% */
  taxRateBps: number
  receiptFooter: string
}
