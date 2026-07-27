/**
 * i18n/config.js
 * ------------------------------------------------------------
 * i18next configuration for the Cyber Security Assistant.
 * Supports: English, Tamil, Tanglish, Hindi.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ta from './locales/ta.json';
import tanglish from './locales/tanglish.json';
import hi from './locales/hi.json';

import { setLanguage } from '../services/api.js';

const saved = localStorage.getItem('language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ta: { translation: ta },
      tanglish: { translation: tanglish },
      hi: { translation: hi },
    },
    lng: saved,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
  setLanguage(lng);
});

export default i18n;
