/**
 * pages/Settings.jsx
 * ------------------------------------------------------------
 * Professional Cybersecurity Security Center settings page.
 * Sections:
 *   1. Security Overview Card (score, password strength, email/2FA status, recommendations)
 *   2. Two Factor Authentication (enable/disable UI)
 *   3. Login Activity (device, browser, location, sessions)
 *   4. Password Management (change password with toggle)
 *   5. Privacy Controls (chat history, AI analysis, notifications, email alerts)
 *   6. Notification Preferences (login alerts, threat alerts, reports)
 * Preserves existing theme, language, and notification features.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  SunIcon, MoonIcon, ComputerDesktopIcon, ShieldCheckIcon,
  KeyIcon, EnvelopeIcon, LockClosedIcon, EyeIcon,
  DevicePhoneMobileIcon, GlobeAltIcon, ClockIcon,
  CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon,
  SparklesIcon, BellIcon, BellAlertIcon, DocumentTextIcon,
  ChatBubbleLeftRightIcon, DocumentArrowDownIcon, ArrowRightOnRectangleIcon,
  FingerPrintIcon, UserIcon, CpuChipIcon,
} from '@heroicons/react/24/outline';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import StateView from '../components/ui/StateView.jsx';
import PasswordInput from '../components/ui/PasswordInput.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import api from '../services/api.js';
import endpoints from '../services/endpoints.js';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const float = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

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
  return { email: true, inApp: true, loginAlerts: true, threatAlerts: true, reportNotifications: true, saveChatHistory: true, aiFileAnalysis: true, securityNotifications: true };
};

export default function Settings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password management
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Login sessions with loading state
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);

  // Simulate fetching sessions
  useEffect(() => {
    const timer = setTimeout(() => {
      setSessions([
        { id: 1, device: 'Chrome / Windows', browser: 'Chrome 125', location: 'Chennai, India', time: new Date(Date.now() - 3600000), active: true, icon: DevicePhoneMobileIcon, ip: '192.168.1.105' },
        { id: 2, device: 'Safari / macOS', browser: 'Safari 18', location: 'Mumbai, India', time: new Date(Date.now() - 86400000 * 3), active: false, icon: ComputerDesktopIcon, ip: '10.0.0.42' },
        { id: 3, device: 'Firefox / Linux', browser: 'Firefox 126', location: 'Bangalore, India', time: new Date(Date.now() - 86400000 * 7), active: false, icon: CpuChipIcon, ip: '172.16.0.88' },
      ]);
      setSessionsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const flip = async (k) => {
    setSaving(true);
    const next = { ...prefs, [k]: !prefs[k] };
    setTimeout(() => {
      setPrefs(next);
      localStorage.setItem('notificationPrefs', JSON.stringify(next));
      toast.success(`${k.replace(/([A-Z])/g, ' $1').trim()} updated`);
      setSaving(false);
    }, 600);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (pwForm.newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      await endpoints.changePassword(pwForm.current, pwForm.newPw);
      toast.success('Password updated successfully');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError(err.response?.data?.message || 'Password change failed');
      toast.error(err.response?.data?.message || 'Password change failed');
    } finally {
      setPwLoading(false);
    }
  };

  const toggle2FA = async () => {
    setTwoFAEnabled(!twoFAEnabled);
    toast.success(twoFAEnabled ? '2FA Disabled' : '2FA Enabled (simulated)');
  };

  const logoutDevice = (sessionId) => {
    setSessions(sessions.filter(s => s.id !== sessionId));
    toast.success('Device logged out');
  };

  const logoutAllDevices = () => {
    setSessions([]);
    logout();
    toast.success('Signed out from all devices');
  };

  // Derived security score
  const getPasswordStrength = (pw) => {
    if (!pw) return { label: 'Empty', score: 0, color: 'text-slate-400' };
    if (pw.length < 6) return { label: 'Weak', score: 25, color: 'text-red-400' };
    if (pw.length < 8) return { label: 'Fair', score: 50, color: 'text-amber-400' };
    if (pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) return { label: 'Strong', score: 100, color: 'text-green-400' };
    return { label: 'Good', score: 75, color: 'text-cyber-400' };
  };

  const securityScore = user?.isEmailVerified ? (twoFAEnabled ? 95 : 75) : 40;
  const securityLabel = securityScore >= 80 ? 'Excellent' : securityScore >= 60 ? 'Good' : securityScore >= 40 ? 'Fair' : 'Poor';
  const securityColor = securityScore >= 80 ? 'text-green-400' : securityScore >= 60 ? 'text-cyber-400' : securityScore >= 40 ? 'text-amber-400' : 'text-red-400';
  const pwStrength = getPasswordStrength(pwForm.newPw || (user?.password ? 'existing' : ''));

  const rel = (iso) => {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={stagger}
      className="space-y-6 animate-fade-in max-w-3xl mx-auto"
    >
      {/* Animated cyber background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute top-20 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-40 -right-40 w-96 h-96 bg-cyber-500/5 rounded-full blur-3xl"
        />
      </div>

      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Security Center</h1>
            <p className="text-sm text-slate-400">Monitor and protect your account</p>
          </div>
        </div>
      </motion.div>

      {/* ─── 1. Security Overview Card ─────────────────── */}
      <motion.div variants={float}>
        <Card 
          title="Security Overview" 
          description="Your account security at a glance" 
          className="backdrop-blur-xl bg-white/60 dark:bg-surface-card/60 border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-primary/10 transition-shadow"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Security score with animated ring */}
            <div className="md:col-span-1 flex flex-col items-center justify-center p-4 rounded-xl bg-gradient-to-br from-slate-50/80 to-slate-100/80 dark:from-slate-800/40 dark:to-slate-900/40 border border-slate-200/50 dark:border-slate-700/50">
              <div className="relative h-28 w-28 flex items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90 transform">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-slate-200 dark:text-slate-700"
                  />
                  <motion.circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    className={securityColor.replace('text-', 'stroke-')}
                    initial={{ strokeDashoffset: 301.59 }}
                    animate={{ strokeDashoffset: 301.59 - (301.59 * securityScore) / 100 }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    style={{ strokeDasharray: 301.59 }}
                  />
                </svg>
                <div className="relative text-center">
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    className={`text-3xl font-bold ${securityColor}`}
                  >
                    {securityScore}
                  </motion.span>
                  <span className="text-xs text-slate-400 block">%</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">Security Score</p>
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className={`text-xs font-semibold ${securityColor}`}
              >
                {securityLabel}
              </motion.span>
            </div>

            {/* Status items with enhanced visuals */}
            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: KeyIcon, label: 'Password', value: pwStrength.label, color: pwStrength.color, badge: pwStrength.color, desc: 'Strength indicator' },
                { icon: EnvelopeIcon, label: 'Email Verified', value: user?.isEmailVerified ? 'Verified' : 'Pending', color: user?.isEmailVerified ? 'text-green-400' : 'text-amber-400', badge: user?.isEmailVerified ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                { icon: FingerPrintIcon, label: 'Two-Factor Auth', value: twoFAEnabled ? 'Enabled' : 'Disabled', color: twoFAEnabled ? 'text-green-400' : 'text-slate-400', badge: twoFAEnabled ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
                { icon: UserIcon, label: 'Account Role', value: user?.role || 'User', color: 'text-cyber-400', badge: user?.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
              ].map((s) => (
                <motion.div
                  key={s.label}
                  whileHover={{ scale: 1.02 }}
                  className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-br from-slate-50/80 to-slate-100/80 dark:from-slate-800/40 dark:to-slate-900/40 border border-slate-200/50 dark:border-slate-700/50 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${s.color.replace('text-', 'bg-').replace('400', '500/10')} ${s.color}`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm text-slate-300 block">{s.label}</span>
                      <span className="text-xs text-slate-500">{s.desc}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${s.badge} backdrop-blur-sm`}>
                    {s.value}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Enhanced recommendations */}
          <AnimatePresence>
            {(!user?.isEmailVerified || !twoFAEnabled) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 animate-pulse">
                      <ExclamationTriangleIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-300 mb-2">Security Recommendations</p>
                      <ul className="space-y-1.5">
                        {!user?.isEmailVerified && (
                          <motion.li
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="text-xs text-amber-200 flex items-center gap-2"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            Verify your email address to enable account recovery
                          </motion.li>
                        )}
                        {!twoFAEnabled && (
                          <motion.li
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-xs text-amber-200 flex items-center gap-2"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            Enable two-factor authentication for additional account protection
                          </motion.li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* ─── 2. Two Factor Authentication ──────────────── */}
      <motion.div variants={fadeUp}>
        <Card 
          title="Two-Factor Authentication" 
          description="Add an extra layer of security to your account" 
          className="backdrop-blur-xl bg-white/60 dark:bg-surface-card/60 border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-primary/10 transition-shadow"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-br from-slate-50/80 to-slate-100/80 dark:from-slate-800/40 dark:to-slate-900/40 border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-4 flex-1">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                className={`p-3.5 rounded-xl ${twoFAEnabled ? 'bg-green-500/10 text-green-400 shadow-lg shadow-green-500/20' : 'bg-slate-500/10 text-slate-400'} transition-all`}
              >
                <ShieldCheckIcon className="h-7 w-7" />
              </motion.div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-200">Status: <span className={twoFAEnabled ? 'text-green-400' : 'text-slate-400'}>{twoFAEnabled ? 'Active' : 'Inactive'}</span></p>
                <p className="text-xs text-slate-400 mt-1">
                  {twoFAEnabled
                    ? '🔒 Your account is protected with 2FA. Each login requires a verification code.'
                    : '⚠️ Protect your account by enabling 2FA. Each login will require a verification code.'}
                </p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={toggle2FA}
              className={`relative h-9 w-16 rounded-full transition-all duration-300 shrink-0 ${twoFAEnabled ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30' : 'bg-gradient-to-r from-slate-600 to-slate-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
              aria-pressed={twoFAEnabled}
            >
              <span className={`absolute top-1 h-7 w-7 rounded-full bg-white transition-all duration-300 shadow-lg ${twoFAEnabled ? 'left-8' : 'left-1'}`} />
            </motion.button>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {[
              { icon: CheckCircleIcon, text: 'Code via authenticator app' },
              { icon: CheckCircleIcon, text: 'Recovery codes provided' },
              { icon: CheckCircleIcon, text: 'Trusted device option' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10">
                <feature.icon className="h-4 w-4 text-cyber-400 shrink-0" />
                <span className="text-xs text-slate-400">{feature.text}</span>
              </div>
            ))}
          </motion.div>
        </Card>
      </motion.div>

      {/* ─── 3. Login Activity ─────────────────────────── */}
      <motion.div variants={fadeUp}>
        <Card 
          title="Login Activity" 
          description="Recent sign-in sessions and active devices" 
          className="backdrop-blur-xl bg-white/60 dark:bg-surface-card/60 border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-primary/10 transition-shadow"
        >
          {sessions.length === 0 ? (
            <StateView
              type="empty"
              title="No active sessions"
              description="There are no active login sessions"
            />
          ) : (
            <motion.div variants={stagger} className="space-y-3">
              {sessions.map((s, i) => (
                <motion.div
                  key={s.id}
                  variants={fadeUp}
                  whileHover={{ scale: 1.01 }}
                  className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-br from-slate-50/80 to-slate-100/80 dark:from-slate-800/40 dark:to-slate-900/40 border border-slate-200/50 dark:border-slate-700/50 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <motion.div
                      whileHover={{ rotate: 15 }}
                      className={`p-2.5 rounded-xl ${s.active ? 'bg-green-500/10 text-green-400 shadow-lg shadow-green-500/20' : 'bg-slate-500/10 text-slate-400'} transition-all shrink-0`}
                    >
                      <s.icon className="h-5 w-5" />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-200">{s.device}</p>
                        {s.active && (
                          <motion.span
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50"
                            title="Active now"
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-slate-400">
                        <span className="px-1.5 py-0.5 rounded bg-slate-500/10 font-mono">{s.browser}</span>
                        <span>•</span>
                        <GlobeAltIcon className="h-3 w-3" />
                        <span>{s.location}</span>
                        <span>•</span>
                        <ClockIcon className="h-3 w-3" />
                        <span>{rel(s.time)}</span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-1">IP: {s.ip}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium border backdrop-blur-sm ${s.active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      {s.active ? '● Active' : rel(s.time)}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => logoutDevice(s.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
                      title="Logout device"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="text-xs text-slate-400">
              Signed in as <strong className="text-slate-300 font-mono">{user?.email}</strong>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={logoutAllDevices}
              className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            >
              Sign out all devices
            </motion.button>
          </motion.div>
        </Card>
      </motion.div>

      {/* ─── 4. Password Management ────────────────────── */}
      <motion.div variants={fadeUp}>
        <Card 
          title="Password Management" 
          description="Update your account password" 
          className="backdrop-blur-xl bg-white/60 dark:bg-surface-card/60 border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-primary/10 transition-shadow"
        >
          <form onSubmit={handleChangePassword} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-1"
            >
              <label className="text-sm text-slate-300 font-medium">Current Password</label>
              <PasswordInput
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                placeholder="Enter current password"
                required
                autoComplete="current-password"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PasswordInput
                  label="New Password"
                  value={pwForm.newPw}
                  onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })}
                  placeholder="Min. 8 characters"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
                <PasswordInput
                  label="Confirm New Password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  placeholder="Re-enter new password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
            </motion.div>
            
            {/* Password strength indicator */}
            {pwForm.newPw && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Password Strength</span>
                  <span className={`font-medium ${pwStrength.color}`}>{pwStrength.label}</span>
                </div>
                <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pwStrength.score}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full rounded-full ${pwStrength.score === 100 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : pwStrength.score >= 75 ? 'bg-gradient-to-r from-cyber-500 to-cyber-400' : pwStrength.score >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                  />
                </div>
              </motion.div>
            )}

            {pwError && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2"
              >
                <XCircleIcon className="h-4 w-4 shrink-0" />
                {pwError}
              </motion.div>
            )}

            {pwSuccess && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2"
              >
                <CheckCircleIcon className="h-4 w-4 shrink-0" />
                Password updated successfully
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className={`flex items-center gap-1.5 ${pwForm.newPw.length >= 8 ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  <span>Min 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${pwForm.newPw === pwForm.confirm && pwForm.confirm ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  <span>Match</span>
                </div>
                <div className={`flex items-center gap-1.5 ${pwForm.newPw && /[A-Z]/.test(pwForm.newPw) && /[0-9]/.test(pwForm.newPw) ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  <span>Strong</span>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={pwLoading || !pwForm.current || pwForm.newPw.length < 8 || pwForm.newPw !== pwForm.confirm}
                className="btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LockClosedIcon className="h-4 w-4 inline mr-2" />
                {pwLoading ? 'Updating...' : 'Update Password'}
              </motion.button>
            </div>
          </form>
        </Card>
      </motion.div>

      {/* ─── 5. Privacy Controls ───────────────────────── */}
      <motion.div variants={fadeUp}>
        <Card 
          title="Privacy Controls" 
          description="Manage your data and privacy preferences" 
          className="backdrop-blur-xl bg-white/60 dark:bg-surface-card/60 border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-primary/10 transition-shadow"
        >
          <motion.div variants={stagger} className="space-y-1">
            {[
              { k: 'saveChatHistory', icon: ChatBubbleLeftRightIcon, label: 'Save Chat History', desc: 'Store AI chatbot conversations for future reference' },
              { k: 'aiFileAnalysis', icon: DocumentTextIcon, label: 'AI File Analysis Permission', desc: 'Allow AI to analyze uploaded files for threats' },
              { k: 'securityNotifications', icon: BellIcon, label: 'Security Notifications', desc: 'Receive in-app security alerts and warnings' },
              { k: 'email', icon: EnvelopeIcon, label: 'Email Alerts', desc: 'Receive security notifications via email' },
            ].map((row) => (
              <motion.div
                key={row.k}
                variants={fadeUp}
                whileHover={{ scale: 1.01 }}
                className="group flex items-center justify-between py-4 px-3 rounded-xl hover:bg-slate-500/5 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-xl transition-all ${prefs[row.k] ? 'bg-primary/10 text-primary' : 'bg-slate-500/10 text-slate-400 group-hover:bg-slate-500/20'}`}>
                    <row.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">{row.label}</p>
                    <p className="text-xs text-slate-400">{row.desc}</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => flip(row.k)}
                  disabled={saving}
                  className={`relative h-7 w-12 rounded-full transition-all duration-300 shrink-0 ml-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 ${prefs[row.k] ? 'bg-gradient-to-r from-primary to-cyber-500 shadow-lg shadow-primary/30' : 'bg-slate-600 dark:bg-slate-600'}`}
                  aria-pressed={prefs[row.k]}
                >
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all duration-300 shadow-md ${prefs[row.k] ? 'left-6' : 'left-0.5'}`} />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        </Card>
      </motion.div>

      {/* ─── 6. Notification Preferences ───────────────── */}
      <motion.div variants={fadeUp}>
        <Card 
          title="Notification Preferences" 
          description="Configure which alerts you receive" 
          className="backdrop-blur-xl bg-white/60 dark:bg-surface-card/60 border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-primary/10 transition-shadow"
        >
          <motion.div variants={stagger} className="space-y-1">
            {[
              { k: 'loginAlerts', icon: BellAlertIcon, label: 'Login Alerts', desc: 'Get notified when a new device logs into your account' },
              { k: 'threatAlerts', icon: ExclamationTriangleIcon, label: 'Threat Alerts', desc: 'Receive alerts when threats are detected in your scans' },
              { k: 'reportNotifications', icon: DocumentArrowDownIcon, label: 'Report Notifications', desc: 'Get notified when security reports are generated' },
            ].map((row) => (
              <motion.div
                key={row.k}
                variants={fadeUp}
                whileHover={{ scale: 1.01 }}
                className="group flex items-center justify-between py-4 px-3 rounded-xl hover:bg-slate-500/5 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-xl transition-all ${prefs[row.k] ? 'bg-primary/10 text-primary' : 'bg-slate-500/10 text-slate-400 group-hover:bg-slate-500/20'}`}>
                    <row.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">{row.label}</p>
                    <p className="text-xs text-slate-400">{row.desc}</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => flip(row.k)}
                  disabled={saving}
                  className={`relative h-7 w-12 rounded-full transition-all duration-300 shrink-0 ml-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 ${prefs[row.k] ? 'bg-gradient-to-r from-primary to-cyber-500 shadow-lg shadow-primary/30' : 'bg-slate-600 dark:bg-slate-600'}`}
                  aria-pressed={prefs[row.k]}
                >
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all duration-300 shadow-md ${prefs[row.k] ? 'left-6' : 'left-0.5'}`} />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        </Card>
      </motion.div>

      {/* ─── Theme & Language (preserved from original) ── */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <Card 
            title="Appearance" 
            description="Choose your theme" 
            className="backdrop-blur-xl bg-white/60 dark:bg-surface-card/60 border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-primary/10 transition-shadow"
          >
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((tItem) => {
                const active = theme === tItem.key;
                return (
                  <motion.button
                    key={tItem.key}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setTheme(tItem.key); toast.success(`Theme: ${tItem.label}`); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      active ? 'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/30'
                    }`}
                    aria-pressed={active}
                  >
                    <tItem.icon className="h-6 w-6" />
                    <span className="text-xs font-semibold">{tItem.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card 
            title="Language" 
            description="Interface language" 
            className="backdrop-blur-xl bg-white/60 dark:bg-surface-card/60 border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-primary/10 transition-shadow"
          >
            <LanguageSelector />
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}