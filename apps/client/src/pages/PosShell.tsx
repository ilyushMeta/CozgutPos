import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ThemeToggle } from '../components/ThemeToggle';
import { SalePage } from './SalePage';

/** Cashier POS shell (SPEC §5.2) — full-screen Söwda for the CASHIER role. */
export function PosShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="font-bold text-lg">
          {t('app.name')} — {t('nav.sale')}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {user?.username} ({t('auth.cashier')})
          </span>
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
        <SalePage />
      </main>
    </div>
  );
}
