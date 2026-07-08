import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeOwnPassword } from '../api';
import { useAuthStore } from '../store/auth';

/** Blocking modal for migrated legacy accounts (SPEC §10 step 4, User.mustResetPassword). */
export function ForcePasswordResetModal() {
  const { t } = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsDontMatch'));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await changeOwnPassword(newPassword);
      setAuth(result);
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          {t('auth.mustResetPasswordTitle')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('auth.mustResetPasswordBody')}
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.newPassword')}
            </label>
            <input
              type="password"
              required
              minLength={4}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.confirmPassword')}
            </label>
            <input
              type="password"
              required
              minLength={4}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2"
          >
            {t('auth.saveNewPassword')}
          </button>
        </form>
      </div>
    </div>
  );
}
