/**
 * pages/Settings.jsx
 * ------------------------------------------------------------
 * Settings page (enterprise dashboard style).
 *  - Theme Preference: Dark / Light / System (via ThemeContext).
 *  - Notification Preferences: Email + In-app (persisted locally;
 *    no backend preference API exists yet).
 *  - API Configuration Status: Gemini / VirusTotal / MongoDB shown
 *    as read-only indicators. No backend endpoint exposes this, so
 *    each renders "Not Available" honestly (no fabricated values).
 *  - Security: Last Password Change (unavailable) + Active Session
 *    (derived from the live auth state).
 * Only files required for Settings are touched; existing backend
 * APIs are used where available, otherwise state is graceful.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { toast } from 'react-toastify';
import { SunIcon, MoonIcon, ComputerDesktopIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';

const THEMES = [
  { key: 'light', label: 'Light', icon: SunIcon },
  { key: 'dark', label: 'Dark', icon: MoonIcon },
  { key: 'system', label: 'System', icon: ComputerDesktopIcon },
];

const loadPrefs = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('notificationPrefs') || 'null');
    if (saved) return saved;
  } catch {}
  return { email: true, inApp: true };
};

export default function Settings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(loadPrefs);

  const flip = (k) => {
    setPrefs((p) => {
      const next = { ...p, [k]: !p[k] };
      localStorage.setItem('notificationPrefs', JSON.stringify(next));
      return next;
    });
  };

  // Read-only API status indicators. No backend endpoint exposes these,
  // so we show "Not Available" rather than inventing values.
  const apiStatus = [
    { key: 'gemini', label: 'Gemini AI' },
    { key: 'virusTotal', label: 'VirusTotal' },
    { key: 'mongodb', label: 'MongoDB' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* Theme preference */}
      <Card title={t('settings.appearance')} description={t('settings.appearance')}>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((tItem) => {
            const active = theme === tItem.key;
            return (
              <button
                key={tItem.key}
                onClick={() => { setTheme(tItem.key); toast.success(`Theme: ${tItem.label}`); }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                aria-pressed={active}
              >
                <tItem.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{tItem.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Notification preferences */}
      <Card title={t('settings.notifications')} description={t('settings.notifications')}>
        {[
          { k: 'email', label: t('settings.notifications'), desc: t('settings.notifications') },
          { k: 'inApp', label: t('settings.notifications'), desc: t('settings.notifications') },
        ].map((row) => (
          <div key={row.k} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-slate-400">{row.desc}</p>
            </div>
            <button
              onClick={() => flip(row.k)}
              className={`relative h-6 w-11 rounded-full transition-colors ${prefs[row.k] ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
              aria-pressed={prefs[row.k]}
              aria-label={row.label}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${prefs[row.k] ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </Card>

      {/* Language preference */}
      <Card title={t('settings.language')} description={t('settings.language')}>
        <LanguageSelector />
      </Card>

      {/* API configuration status (read-only) */}
      <Card title="API Configuration" description="External service connectivity (read-only).">
        <div className="space-y-2">
          {apiStatus.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <p className="text-sm font-medium">{s.label}</p>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <QuestionMarkCircleIcon className="h-4 w-4" />
                Not Available
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Live service status isn't exposed by the API. These indicators show "Not Available" instead of guessed values.
        </p>
      </Card>

      {/* Security */}
      <Card title={t('settings.security')} description={t('settings.security')}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('settings.changePassword')}</p>
              <p className="text-xs text-slate-400">Not tracked by the current API.</p>
            </div>
            <Badge tone="warning">Not Available</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Active session</p>
              <p className="text-xs text-slate-400">{user ? `Signed in as ${user.email}` : 'Not signed in'}</p>
            </div>
            <Badge tone="success">{user ? 'Active' : 'Inactive'}</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
