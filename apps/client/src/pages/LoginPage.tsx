import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginInput, type LicenseStatus } from '@cozgut/shared';
import { login, fetchLicenseStatus } from '../api';
import { useAuthStore } from '../store/auth';
import { LanguageSwitch } from '../components/LanguageSwitch';

export function LoginPage() {
  const { t } = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginInput>();

  useEffect(() => {
    fetchLicenseStatus()
      .then(setLicense)
      .catch(() => setLicense(null));
  }, []);

  async function onSubmit(values: LoginInput) {
    setError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setError(t('auth.invalidCredentials'));
      return;
    }
    try {
      const result = await login(values.username, values.password);
      setAuth(result);
    } catch {
      setError(t('auth.invalidCredentials'));
    }
  }

  const blocked = license?.blocked ?? false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('app.name')}</h1>
          <LanguageSwitch />
        </div>

        {license && (
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {license.unlimited
              ? `${t('license.title')}: ${t('license.unlimited')}`
              : `${t('license.remainingDays')}: ${license.remainingDays}`}
          </p>
        )}

        {blocked && (
          <p className="mb-4 rounded bg-red-100 text-red-700 px-3 py-2 text-sm">
            {t(`license.${license?.blockReason ?? 'expired'}`)}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.username')}
            </label>
            <input
              {...register('username')}
              autoFocus
              disabled={blocked}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.password')}
            </label>
            <input
              {...register('password')}
              type="password"
              disabled={blocked}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || blocked}
            className="w-full rounded bg-blue-600 hover:bg-blue-700 text-white py-2 font-medium disabled:opacity-50"
          >
            {t('auth.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
