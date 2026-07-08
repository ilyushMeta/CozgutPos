import { useTranslation } from 'react-i18next';

/** TM/RU language toggle (SPEC §9). Persists choice in localStorage. */
export function LanguageSwitch() {
  const { i18n } = useTranslation();

  function change(lng: 'tm' | 'ru') {
    void i18n.changeLanguage(lng);
    localStorage.setItem('lang', lng);
  }

  return (
    <div className="flex gap-1 text-sm">
      {(['tm', 'ru'] as const).map((lng) => (
        <button
          key={lng}
          onClick={() => change(lng)}
          className={`px-2 py-1 rounded ${
            i18n.language === lng
              ? 'bg-blue-600 text-white'
              : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
