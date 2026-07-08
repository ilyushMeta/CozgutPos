import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activateLicense, fetchLicenseStatus, rebindLicense } from '../api';

const inputCls =
  'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';

export function LicensePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: status } = useQuery({ queryKey: ['license-status'], queryFn: fetchLicenseStatus });

  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const activate = useMutation({
    mutationFn: () => activateLicense({ code }),
    onSuccess: () => {
      setMessage(t('license.activateSuccess'));
      setCode('');
      qc.invalidateQueries({ queryKey: ['license-status'] });
    },
    onError: (e: any) => setMessage(e?.response?.data?.code ?? 'error'),
  });

  const rebind = useMutation({
    mutationFn: rebindLicense,
    onSuccess: () => {
      setMessage(t('license.rebindSuccess'));
      qc.invalidateQueries({ queryKey: ['license-status'] });
    },
  });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">{t('license.title')}</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-2">
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('license.plan')}</div>
        <div className="text-xl font-semibold">{status?.plan ?? '—'}</div>
        {!status?.unlimited && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('license.remainingDays')}: {status?.remainingDays ?? '—'}
          </div>
        )}
        {status?.hardwareMismatch && (
          <div className="rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-3 py-2 text-sm flex items-center justify-between">
            <span>{t('license.hardwareMismatch')}</span>
            <button onClick={() => rebind.mutate()} className="underline">
              {t('license.rebind')}
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) activate.mutate();
        }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-end gap-2"
      >
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('license.activationCode')}
          </label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
        </div>
        <button type="submit" disabled={activate.isPending} className={primaryBtnCls}>
          {t('license.activate')}
        </button>
      </form>

      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
