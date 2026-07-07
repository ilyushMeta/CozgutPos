export * from './money.js';
export * from './enums.js';
export * from './dto.js';
export * from './csv.js';
export * from './translit.js';
export * from './catalog.js';
export * from './receiving.js';

// Locale dictionaries are consumed only by the client (i18next). They are
// exposed via the `@cozgut/shared/locales/*` subpath exports (raw JSON) so the
// server bundle never pulls JSON at runtime. See packages/shared/package.json.
export type LocaleKey = 'tm' | 'ru';
