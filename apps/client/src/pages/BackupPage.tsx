import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBackup,
  deleteBackup,
  fetchSettings,
  listBackups,
  restoreBackup,
  saveSetting,
} from '../api';
import { SettingKey } from '@cozgut/shared';

const inputCls =
  'w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5 text-sm';
const primaryBtnCls = 'px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm';
const secondaryBtnCls = 'px-4 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm';

interface SettingsForm {
  folder: string;
  password: string;
  retentionDays: string;
  scheduleEnabled: boolean;
}

export function BackupPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const { data: backups = [] } = useQuery({ queryKey: ['backups'], queryFn: listBackups });

  const { register, handleSubmit, reset } = useForm<SettingsForm>({
    defaultValues: { folder: '', password: '', retentionDays: '30', scheduleEnabled: false },
  });

  useEffect(() => {
    if (!settings) return;
    reset({
      folder: settings[SettingKey.BACKUP_FOLDER] ?? '',
      password: settings[SettingKey.BACKUP_PASSWORD] ?? '',
      retentionDays: settings[SettingKey.BACKUP_RETENTION_DAYS] ?? '30',
      scheduleEnabled: settings[SettingKey.BACKUP_SCHEDULE_ENABLED] === 'true',
    });
  }, [settings, reset]);

  const saveSettings = useMutation({
    mutationFn: async (v: SettingsForm) => {
      await saveSetting(SettingKey.BACKUP_FOLDER, v.folder);
      await saveSetting(SettingKey.BACKUP_PASSWORD, v.password);
      await saveSetting(SettingKey.BACKUP_RETENTION_DAYS, v.retentionDays);
      await saveSetting(SettingKey.BACKUP_SCHEDULE_ENABLED, String(v.scheduleEnabled));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const [message, setMessage] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      setMessage(t('backup.createSuccess'));
      qc.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (e: any) => setMessage(e?.response?.data?.message ?? 'error'),
  });

  const remove = useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const restore = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('no file');
      await restoreBackup(file, restorePassword);
    },
    onSuccess: () => {
      setMessage(t('backup.restoreSuccess'));
      setRestorePassword('');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (e: any) => setMessage(e?.response?.data?.message ?? 'error'),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">{t('backup.title')}</h1>

      <form
        onSubmit={handleSubmit((v) => saveSettings.mutate(v))}
        className="space-y-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      >
        <label className="block">
          <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            {t('backup.folder')}
          </span>
          <input {...register('folder')} className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            {t('backup.password')}
          </span>
          <input type="password" {...register('password')} className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            {t('backup.retentionDays')}
          </span>
          <input type="number" {...register('retentionDays')} className={inputCls} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('scheduleEnabled')} />
          {t('backup.scheduleEnabled')}
        </label>
        <button type="submit" className={primaryBtnCls}>
          {t('app.save')}
        </button>
      </form>

      {message && <p className="text-sm">{message}</p>}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{t('backup.list')}</h2>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className={primaryBtnCls}
          >
            {t('backup.create')}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1">{t('backup.filename')}</th>
              <th className="py-1">{t('backup.size')}</th>
              <th className="py-1">{t('common.date')}</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.filename} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1">{b.filename}</td>
                <td className="py-1">{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                <td className="py-1">{new Date(b.createdAt).toLocaleString()}</td>
                <td className="py-1">
                  <button
                    onClick={() => {
                      if (window.confirm(t('common.confirmDelete'))) remove.mutate(b.filename);
                    }}
                    className="text-red-600 hover:underline text-xs"
                  >
                    {t('app.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {backups.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noResults')}</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <h2 className="font-medium">{t('backup.restore')}</h2>
        <input ref={fileRef} type="file" accept=".enc" className="text-sm" />
        <input
          type="password"
          value={restorePassword}
          onChange={(e) => setRestorePassword(e.target.value)}
          placeholder={t('backup.password')}
          className={inputCls}
        />
        <button
          onClick={() => {
            if (window.confirm(t('backup.confirmRestore'))) restore.mutate();
          }}
          disabled={!restorePassword || restore.isPending}
          className={`${secondaryBtnCls} w-full`}
        >
          {t('backup.restore')}
        </button>
      </div>
    </div>
  );
}
