/**
 * components/LanguageSelector.jsx
 * ------------------------------------------------------------
 * Language selector dropdown for the Cyber Security Assistant.
 * Persists selection in localStorage and syncs with backend.
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { GlobeAltIcon } from '@heroicons/react/24/outline';

const LANGUAGES = [
  { code: 'en', labelKey: 'language.en', local: 'English' },
  { code: 'ta', labelKey: 'language.ta', local: 'Tamil' },
  { code: 'tanglish', labelKey: 'language.tanglish', local: 'Tanglish' },
  { code: 'hi', labelKey: 'language.hi', local: 'Hindi' },
];

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const { updateLanguage } = useAuth();

  const change = async (e) => {
    const lng = e.target.value;
    i18n.changeLanguage(lng);
    try {
      await updateLanguage(lng);
    } catch {
      // backend sync failed, but local preference is saved
    }
  };

  return (
    <div className="relative">
      <label htmlFor="language-select" className="sr-only">{t('language.selectLanguage')}</label>
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
        <GlobeAltIcon className="h-4 w-4 text-slate-500" />
        <select
          id="language-select"
          value={i18n.language}
          onChange={change}
          className="bg-transparent text-sm border-none outline-none cursor-pointer text-slate-700 dark:text-slate-200"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="text-slate-900">
              {l.local}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
