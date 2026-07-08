export * from './money.js';
export * from './enums.js';
export * from './dto.js';
export * from './csv.js';
export * from './translit.js';
export * from './catalog.js';
export * from './receiving.js';
export * from './sales.js';
export * from './debts.js';
export * from './sms.js';
export * from './cash.js';
export * from './returns.js';
export * from './revision.js';
export * from './secondShop.js';
export * from './recipes.js';
export * from './neededProducts.js';
export * from './dates.js';
export * from './users.js';
export * from './reports.js';
export * from './discounts.js';
export * from './currency.js';
export * from './license.js';
export * from './backup.js';

// Locale dictionaries are consumed only by the client (i18next). They are
// exposed via the `@cozgut/shared/locales/*` subpath exports (raw JSON) so the
// server bundle never pulls JSON at runtime. See packages/shared/package.json.
export type LocaleKey = 'tm' | 'ru';
