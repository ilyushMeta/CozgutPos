import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ThemeToggle } from '../components/ThemeToggle';

// Sidebar navigation keys (SPEC §9). Screens are built in later phases.
const NAV_KEYS = [
  'nav.sale',
  'nav.goodsReceive',
  'nav.warehouse',
  'nav.cashRegister',
  'nav.customerDebt',
  'nav.supplierDebt',
  'nav.returns',
  'nav.stocktake',
  'nav.revision',
  'nav.secondShop',
  'nav.recipes',
  'nav.neededProducts',
  'nav.currency',
  'nav.reports',
  'nav.users',
  'nav.settings',
] as const;

export function BackOfficeShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <aside className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3">
        <div className="font-bold text-lg mb-4">{t('app.name')}</div>
        <nav className="space-y-1">
          {NAV_KEYS.map((key) => (
            <div
              key={key}
              className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
            >
              {t(key)}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('auth.welcome')}, {user?.username} ({t('auth.admin')})
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <ThemeToggle />
            <button
              onClick={logout}
              className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-sm"
            >
              {t('auth.logout')}
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <p className="text-gray-500 dark:text-gray-400">
            {t('app.name')} — {t('reports.title')} ({t('app.loading')})
          </p>
        </main>
      </div>
    </div>
  );
}
