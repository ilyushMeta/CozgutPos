/** Domain enums shared between server and client. Mirror the Prisma enums. */

export const Role = {
  ADMIN: 'ADMIN',
  CASHIER: 'CASHIER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Currency = {
  TMT: 'TMT',
  USD: 'USD',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const ShopId = {
  MAIN: 'MAIN',
  SECOND: 'SECOND',
} as const;
export type ShopId = (typeof ShopId)[keyof typeof ShopId];

export const PaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  DEBT: 'DEBT',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const CashMoveType = {
  SALE_CASH: 'SALE_CASH',
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  PURCHASE_PAYMENT: 'PURCHASE_PAYMENT',
  DEBT_PAYMENT_IN: 'DEBT_PAYMENT_IN',
} as const;
export type CashMoveType = (typeof CashMoveType)[keyof typeof CashMoveType];

export const SupplierMoveType = {
  PURCHASE: 'PURCHASE',
  PAYMENT: 'PAYMENT',
} as const;
export type SupplierMoveType = (typeof SupplierMoveType)[keyof typeof SupplierMoveType];

/** Funding source for a goods-receiving invoice (SPEC §5.3/§6.8) — see Phase 2 plan
 * note: legacy ledgers (ammar.karzKot / kassahereket) show no partial-split payment,
 * so an invoice uses exactly one source. */
export const PaymentSource = {
  NONE: 'NONE',
  CASHBOX: 'CASHBOX',
  SUPPLIER_CREDIT: 'SUPPLIER_CREDIT',
} as const;
export type PaymentSource = (typeof PaymentSource)[keyof typeof PaymentSource];

export const LicensePlan = {
  TRIAL: 'TRIAL',
  STANDARD: 'STANDARD',
  UNLIMITED: 'UNLIMITED',
} as const;
export type LicensePlan = (typeof LicensePlan)[keyof typeof LicensePlan];

/** Settings keys (replace legacy C:\xampp\*.txt files). SPEC §3, §4.1 Setting. */
export const SettingKey = {
  SERVER_MODE: 'server.mode', // 'SERVER' | 'CLIENT'
  SERVER_IP: 'server.ip', // when CLIENT
  SHOP_HEADER: 'receipt.shopHeader',
  PRINTER_NAME: 'printer.name',
  PRINT_COPIES: 'printer.copies',
  COSTING_METHOD: 'costing.method', // 'fifo' | 'lifo'
  SCALE_ENABLED: 'scale.enabled',
  SCALE_PLU_PATH: 'scale.pluPath',
  SCALE_COMMAND: 'scale.command',
  SCALE_PLU_TEMPLATE: 'scale.pluTemplate', // placeholders: {plu} {name} {price} {code}
  SMS_GATEWAY_IP: 'sms.gatewayIp',
  SMS_TOKEN: 'sms.token',
  LANGUAGE: 'ui.language', // 'tm' | 'ru'
  FIRST_RUN_DONE: 'app.firstRunDone',
  BACKUP_FOLDER: 'backup.folder',
  BACKUP_RETENTION_DAYS: 'backup.retentionDays',
  BACKUP_PASSWORD: 'backup.password',
  BACKUP_SCHEDULE_ENABLED: 'backup.scheduleEnabled',
} as const;
export type SettingKey = (typeof SettingKey)[keyof typeof SettingKey];
