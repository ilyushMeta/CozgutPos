import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listDebtors, listSuppliers } from '../api';
import { sumMoney } from '@cozgut/shared';

const tileCls = 'bg-white dark:bg-gray-800 rounded-lg shadow p-4';

/**
 * Minimal dashboard (SPEC §5.13 is Phase 6 — charts, all report tables). This
 * covers only Phase 4's own acceptance requirement: customer/supplier debt
 * totals and an overdue-debtor list.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: debtors = [] } = useQuery({ queryKey: ['debtors'], queryFn: () => listDebtors() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const tmtTotal = sumMoney(
    debtors.filter((d) => d.accountCurrency === 'TMT').map((d) => d.balance),
  );
  const usdTotal = sumMoney(
    debtors.filter((d) => d.accountCurrency === 'USD').map((d) => d.balance),
  );
  const supplierTotal = sumMoney(suppliers.map((s) => s.balance));
  const overdue = debtors.filter((d) => d.isOverdue);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('reports.title')}</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className={tileCls}>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('reports.customerDebtTotal')}
          </div>
          <div className="text-xl font-semibold">
            {tmtTotal.toFixed(2)} TMT {usdTotal.greaterThan(0) ? `/ ${usdTotal.toFixed(2)} $` : ''}
          </div>
        </div>
        <div className={tileCls}>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('reports.supplierDebtTotal')}
          </div>
          <div className="text-xl font-semibold">{supplierTotal.toFixed(2)} TMT</div>
        </div>
        <div className={tileCls}>
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('debt.overdue')}</div>
          <div className="text-xl font-semibold">{overdue.length}</div>
        </div>
      </div>

      <div className={tileCls}>
        <h2 className="font-medium mb-3">{t('reports.overdueDebtors')}</h2>
        {overdue.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noResults')}</p>
        ) : (
          <ul className="space-y-1">
            {overdue.map((d) => (
              <li key={d.id} className="text-sm flex justify-between">
                <button
                  onClick={() => navigate(`/customer-debt/${d.id}`)}
                  className="text-blue-600 hover:underline"
                >
                  {d.name}
                </button>
                <span className="text-red-600 dark:text-red-400">
                  {d.overdueAmount} {d.accountCurrency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
