import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { completeFirstRun } from '../api';
import { LanguageSwitch } from '../components/LanguageSwitch';

/**
 * First-run setup wizard (SPEC §3): choose Server or Client(server IP).
 * Replaces the legacy C:\Windows\System32\System.dll marker file.
 */
export function FirstRunWizard({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'SERVER' | 'CLIENT'>('SERVER');
  const [serverIp, setServerIp] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await completeFirstRun(mode, mode === 'CLIENT' ? serverIp : undefined);
      onDone();
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-gray-900 dark:text-white">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">{t('settings.firstRun.title')}</h1>
          <LanguageSwitch />
        </div>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {t('settings.firstRun.choose')}
        </p>

        <div className="space-y-3 mb-4">
          {(['SERVER', 'CLIENT'] as const).map((m) => (
            <label
              key={m}
              className={`block rounded border p-3 cursor-pointer ${
                mode === m
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === m}
                onChange={() => setMode(m)}
                className="mr-2"
              />
              <span className="font-medium">
                {m === 'SERVER' ? t('settings.server') : t('settings.client')}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-5">
                {m === 'SERVER'
                  ? t('settings.firstRun.serverDesc')
                  : t('settings.firstRun.clientDesc')}
              </p>
            </label>
          ))}
        </div>

        {mode === 'CLIENT' && (
          <div className="mb-4">
            <label className="block text-sm mb-1">{t('settings.serverIp')}</label>
            <input
              value={serverIp}
              onChange={(e) => setServerIp(e.target.value)}
              placeholder="192.168.1.10"
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2"
            />
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          onClick={finish}
          disabled={saving || (mode === 'CLIENT' && !serverIp)}
          className="w-full rounded bg-blue-600 hover:bg-blue-700 text-white py-2 font-medium disabled:opacity-50"
        >
          {t('app.confirm')}
        </button>
      </div>
    </div>
  );
}
