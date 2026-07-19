/**
 * pages/Settings.jsx
 * ------------------------------------------------------------
 * Settings page. Manages appearance (dark/light via ThemeContext),
 * notification preferences (local state for Phase 1), and surfaces
 * security shortcuts. All changes are client-side; persistence of
 * prefs can be added later without touching the backend contract.
 */
import { useState } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { toast } from 'react-toastify';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';

export default function Settings() {
  const { theme, toggle } = useTheme();
  const [prefs, setPrefs] = useState({ emailAlerts: true, weeklyDigest: false, threatPush: true });

  const flip = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-slate-400">Switch between dark and light mode.</p>
          </div>
          <button className="btn" onClick={() => { toggle(); toast.success('Theme updated'); }}>
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </Card>

      <Card title="Notifications">
        {[
          { k: 'emailAlerts', label: 'Email alerts', desc: 'Receive emails when threats are detected.' },
          { k: 'weeklyDigest', label: 'Weekly digest', desc: 'A summary of your security posture each week.' },
          { k: 'threatPush', label: 'Threat push', desc: 'Real-time in-app notifications for critical findings.' },
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
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${prefs[row.k] ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </Card>

      <Card title="Security">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Account protection</p>
            <p className="text-xs text-slate-400">Use a password manager and enable MFA where possible.</p>
          </div>
          <Badge tone="success">Healthy</Badge>
        </div>
      </Card>
    </div>
  );
}
