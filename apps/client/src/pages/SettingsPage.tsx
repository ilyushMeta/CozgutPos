import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, saveSetting, testSms } from '../api';
import { SettingKey } from '@cozgut/shared';

const inputCls =
  'w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{label}</span>
      {children}
    </label>
  );
}

/**
 * Minimal Settings screen (SPEC §5.14 is Phase 6 — printer/scale/backup/users
 * sections land there). This covers only Phase 4's own requirement: the SMS
 * gateway config + test button (SPEC §7.4).
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const { register, handleSubmit, reset } = useForm<{ gatewayIp: string; token: string }>({
    defaultValues: { gatewayIp: '', token: '' },
  });

  useEffect(() => {
    if (!settings) return;
    reset({
      gatewayIp: settings[SettingKey.SMS_GATEWAY_IP] ?? '',
      token: settings[SettingKey.SMS_TOKEN] ?? '',
    });
  }, [settings, reset]);

  const save = useMutation({
    mutationFn: async (v: { gatewayIp: string; token: string }) => {
      await saveSetting(SettingKey.SMS_GATEWAY_IP, v.gatewayIp);
      await saveSetting(SettingKey.SMS_TOKEN, v.token);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  const test = useMutation({
    mutationFn: () => testSms(testPhone, testMessage || undefined),
    onSuccess: (result) => {
      setTestResult(
        result.sent ? t('settings.smsSent') : t('settings.smsFailed', { reason: result.reason }),
      );
    },
  });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>

      <form
        onSubmit={handleSubmit((v) => save.mutate(v))}
        className="space-y-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      >
        <h2 className="font-medium">{t('settings.smsGateway')}</h2>
        <Field label={t('settings.smsGateway')}>
          <input {...register('gatewayIp')} className={inputCls} placeholder="192.168.1.50" />
        </Field>
        <Field label={t('settings.smsToken')}>
          <input {...register('token')} className={inputCls} />
        </Field>
        <button type="submit" className={primaryBtnCls}>
          {t('app.save')}
        </button>
      </form>

      <div className="space-y-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="font-medium">{t('settings.testSms')}</h2>
        <Field label={t('settings.testPhone')}>
          <input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            className={inputCls}
            placeholder="+993..."
          />
        </Field>
        <Field label={t('settings.testMessage')}>
          <input
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            className={inputCls}
          />
        </Field>
        <button
          type="button"
          onClick={() => test.mutate()}
          disabled={!testPhone || test.isPending}
          className={primaryBtnCls}
        >
          {t('settings.testSms')}
        </button>
        {testResult && <p className="text-sm">{testResult}</p>}
      </div>
    </div>
  );
}
