import { useTranslation } from 'react-i18next';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ThemeToggle } from '../components/ThemeToggle';
import { ComingSoon } from './ComingSoon';
import { SalePage } from './SalePage';
import { CategoriesPage } from './CategoriesPage';
import { ProductsPage } from './ProductsPage';
import { ProductFormPage } from './ProductFormPage';
import { ReceivingPage } from './ReceivingPage';
import { StockAmmarPage } from './StockAmmarPage';
import { StockOutPage } from './StockOutPage';
import { StockLowPage } from './StockLowPage';
import { StockExpiringPage } from './StockExpiringPage';
import { DebtorsPage } from './DebtorsPage';
import { DebtorDetailPage } from './DebtorDetailPage';
import { SuppliersPage } from './SuppliersPage';
import { SupplierDetailPage } from './SupplierDetailPage';
import { DashboardPage } from './DashboardPage';
import { SettingsPage } from './SettingsPage';
import { CashPage } from './CashPage';
import { ReturnsPage } from './ReturnsPage';
import { RevisionPage } from './RevisionPage';
import { StocktakePage } from './StocktakePage';
import { SecondShopPage } from './SecondShopPage';
import { RecipesPage } from './RecipesPage';
import { NeededProductsPage } from './NeededProductsPage';

// Sidebar navigation (SPEC §9). Screens not yet built fall back to ComingSoon.
const NAV_ITEMS = [
  { key: 'nav.sale', path: '/sale' },
  { key: 'nav.products', path: '/products' },
  { key: 'nav.categories', path: '/categories' },
  { key: 'nav.goodsReceive', path: '/receiving' },
  { key: 'nav.warehouse', path: '/stock/ammar' },
  { key: 'product.outOfStock', path: '/stock/out-of-stock' },
  { key: 'product.lowStock', path: '/stock/low-stock' },
  { key: 'product.expiringSoon', path: '/stock/expiring-soon' },
  { key: 'nav.cashRegister', path: '/cash' },
  { key: 'nav.customerDebt', path: '/customer-debt' },
  { key: 'nav.supplierDebt', path: '/supplier-debt' },
  { key: 'nav.returns', path: '/returns' },
  { key: 'nav.stocktake', path: '/stocktake' },
  { key: 'nav.revision', path: '/revision' },
  { key: 'nav.secondShop', path: '/second-shop' },
  { key: 'nav.recipes', path: '/recipes' },
  { key: 'nav.neededProducts', path: '/needed-products' },
  { key: 'nav.currency', path: '/currency' },
  { key: 'nav.reports', path: '/reports' },
  { key: 'nav.users', path: '/users' },
  { key: 'nav.settings', path: '/settings' },
] as const;

export function BackOfficeShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <aside className="w-56 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 overflow-y-auto">
        <div className="font-bold text-lg mb-4">{t('app.name')}</div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${
                  isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
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
        <main className="flex-1 p-6 overflow-y-auto">
          <Routes>
            <Route path="/sale" element={<SalePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<ProductFormPage />} />
            <Route path="/products/:id" element={<ProductFormPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/receiving" element={<ReceivingPage />} />
            <Route path="/stock/ammar" element={<StockAmmarPage />} />
            <Route path="/stock/out-of-stock" element={<StockOutPage />} />
            <Route path="/stock/low-stock" element={<StockLowPage />} />
            <Route path="/stock/expiring-soon" element={<StockExpiringPage />} />
            <Route path="/customer-debt" element={<DebtorsPage />} />
            <Route path="/customer-debt/:id" element={<DebtorDetailPage />} />
            <Route path="/supplier-debt" element={<SuppliersPage />} />
            <Route path="/supplier-debt/:id" element={<SupplierDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/reports" element={<DashboardPage />} />
            <Route path="/cash" element={<CashPage />} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/revision" element={<RevisionPage />} />
            <Route path="/stocktake" element={<StocktakePage />} />
            <Route path="/second-shop" element={<SecondShopPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/needed-products" element={<NeededProductsPage />} />
            {NAV_ITEMS.filter(
              (i) =>
                ![
                  '/sale',
                  '/products',
                  '/receiving',
                  '/categories',
                  '/stock/ammar',
                  '/stock/out-of-stock',
                  '/stock/low-stock',
                  '/stock/expiring-soon',
                  '/customer-debt',
                  '/supplier-debt',
                  '/settings',
                  '/reports',
                  '/cash',
                  '/returns',
                  '/revision',
                  '/stocktake',
                  '/second-shop',
                  '/recipes',
                  '/needed-products',
                ].includes(i.path),
            ).map((item) => (
              <Route
                key={item.path}
                path={item.path}
                element={<ComingSoon titleKey={item.key} />}
              />
            ))}
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
