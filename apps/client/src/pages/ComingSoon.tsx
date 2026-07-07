import { useTranslation } from 'react-i18next';

/** Placeholder for back-office screens not yet built in the current phase. */
export function ComingSoon({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">{t(titleKey)}</h1>
      <p className="text-gray-500 dark:text-gray-400">{t('app.loading')}</p>
    </div>
  );
}
