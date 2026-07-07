import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tm from '@cozgut/shared/locales/tm';
import ru from '@cozgut/shared/locales/ru';

// Turkmen (Latin) is the default operator language; Russian is the second locale.
void i18n.use(initReactI18next).init({
  resources: {
    tm: { translation: tm },
    ru: { translation: ru },
  },
  lng: localStorage.getItem('lang') ?? 'tm',
  fallbackLng: 'tm',
  interpolation: { escapeValue: false },
});

export default i18n;
