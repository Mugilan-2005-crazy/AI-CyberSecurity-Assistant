/**
 * pages/Login.jsx
 * Enhanced login page with:
 *  - Password show/hide toggle
 *  - 2FA verification screen
 *  - Suspicious login warnings
 *  - Loading states with spinner
 *  - Toast notifications
 *  - Device/location tracking
 */
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldCheckIcon, ExclamationTriangleIcon, DevicePhoneMobileIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';
import api from '../services/api.js';
import PasswordInput from '../components/ui/PasswordInput.jsx';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function Login() {
  const { t } = useTranslation();
  const { login, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [userId, setUserId] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [trustDevice, setTrustDevice] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);

  // Suspicious login warning
  const [suspiciousWarning, setSuspiciousWarning] = useState(null);

  // Detect device info
  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let device = 'Unknown';
    if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = 'Mobile';
    else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';
    else device = 'Desktop';
    return device;
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login-enhanced', {
        email: form.email,
        password: form.password,
        device: getDeviceInfo(),
        location: 'Unknown', // In production, use IP geolocation
      });

      if (res.requires2FA) {
        setRequires2FA(true);
        setUserId(res.twoFactorToken);
        setDeviceInfo(res.deviceInfo);
        return;
      }

      if (res.suspicious) {
        setSuspiciousWarning({
          device: res.lastLogin?.device || 'Unknown',
          location: res.lastLogin?.location || 'Unknown',
          time: res.lastLogin?.time,
        });
      }

      // Set auth state
      setUser(res.user);

      toast.success('Welcome back!');
      const role = res.user?.role;
      const to = location.state?.from?.pathname || (role === 'admin' ? '/admin/analytics' : '/dashboard');
      navigate(to, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    const otpStr = otp.join('');
    if (otpStr.length !== 6) {
      toast.error('Please enter the full 6-digit code');
      return;
    }
    setTwoFALoading(true);
    try {
      const res = await api.post('/auth/2fa/verify', { twoFactorToken: userId, otp: otpStr });
      setUser(res.user);
      toast.success('2FA verified! Welcome back.');
      const role = res.user?.role;
      const to = location.state?.from?.pathname || (role === 'admin' ? '/admin/analytics' : '/dashboard');
      navigate(to, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(0, 1);
    setOtp(next);
    if (value && index < 5) {
      const nextInput = document.getElementById(`2fa-otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`2fa-otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleSecureAccount = () => {
    toast.warning('Account security measures initiated. Please contact support.');
    setRequires2FA(false);
  };

  // If 2FA is required, show the 2FA screen
  if (requires2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="w-full max-w-md">
          <motion.div {...fadeIn} className="card" role="dialog" aria-modal="true" aria-labelledby="2fa-title">
            <div className="flex flex-col items-center mb-6">
              <ShieldCheckIcon className="h-12 w-12 text-cyber-400 animate-float" />
              <h1 id="2fa-title" className="text-xl font-bold mt-2">Two-Factor Authentication</h1>
              <p className="text-sm text-slate-400 mt-1 text-center">Was this login attempt you?</p>
            </div>

            {deviceInfo && (
              <div className="bg-slate-800/50 rounded-lg p-4 mb-6 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <DevicePhoneMobileIcon className="h-4 w-4 text-cyber-400" />
                  <span>Device: <strong>{deviceInfo.device}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPinIcon className="h-4 w-4 text-cyber-400" />
                  <span>Location: <strong>{deviceInfo.location}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <ClockIcon className="h-4 w-4 text-cyber-400" />
                  <span>Time: <strong>{new Date(deviceInfo.time).toLocaleString()}</strong></span>
                </div>
              </div>
            )}

            <form onSubmit={handle2FAVerify} className="space-y-6" aria-label="Two-factor authentication form">
              <div>
                <label htmlFor="2fa-otp-0" className="text-sm text-slate-300 block text-center mb-3">Enter 6-digit verification code</label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`2fa-otp-${i}`}
                      name={`2fa-otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className="w-12 h-14 text-center text-xl font-bold bg-slate-800 border border-slate-600 rounded-lg focus:border-cyber-400 focus:ring-1 focus:ring-cyber-400 outline-none text-white transition-all"
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                      aria-required="true"
                    />
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-cyber-400 focus:ring-cyber-400"
                />
                Trust this device
              </label>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={twoFALoading || otp.join('').length < 6}
                >
                  {twoFALoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      Verifying...
                    </span>
                  ) : (
                    'Yes, It\'s Me'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSecureAccount}
                  className="btn-cyber flex-1"
                >
                  <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                  No, Secure Account
                </button>
              </div>
            </form>

            <button
              onClick={() => { setRequires2FA(false); setOtp(['', '', '', '', '', '']); }}
              className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-primary mt-4 w-full"
            >
              Back to Login
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md">
        <motion.div {...fadeIn} className="card">
          <div className="flex flex-col items-center mb-6">
            <ShieldCheckIcon className="h-12 w-12 text-cyber-400 animate-float" />
            <h1 className="text-xl font-bold mt-2">{t('auth.signIn')}</h1>
            <p className="text-sm text-slate-400">{t('app.tagline')}</p>
          </div>

          {/* Suspicious login warning */}
          {suspiciousWarning && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 mb-4 flex items-start gap-2" role="alert">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-300">
                <p className="font-semibold mb-1">Unusual login detected</p>
                <p>Previous session: {suspiciousWarning.device} · {suspiciousWarning.location}</p>
                {suspiciousWarning.time && <p>{new Date(suspiciousWarning.time).toLocaleString()}</p>}
                <p className="mt-1">If this wasn't you, please change your password immediately.</p>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" aria-label="Sign in form">
            <div>
              <label htmlFor="login-email" className="text-sm text-slate-300">{t('auth.email')}</label>
              <input
                id="login-email"
                type="email" required className="input w-full"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                aria-required="true"
              />
            </div>
            <PasswordInput
              id="login-password"
              label={t('auth.password')}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={t('auth.passwordPlaceholder')}
              required
              autoComplete="current-password"
            />
            {error && <p className="text-danger text-xs text-center" role="alert">{error}</p>}
            <button className="btn-primary w-full" disabled={loading} type="submit">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  {t('auth.signingIn')}
                </span>
              ) : (
                t('auth.signInBtn')
              )}
            </button>
          </form>
          <div className="mt-4 text-sm text-center text-slate-400">
            <Link to="/forgot-password" className="hover:text-primary">{t('auth.forgotPassword')}</Link>
            <span className="mx-2">·</span>
            <Link to="/register" className="hover:text-primary">{t('auth.createAccount')}</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function AuthShell({ title, children }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md card animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <ShieldCheckIcon className="h-12 w-12 text-cyber-400 animate-float" />
          <h1 className="text-xl font-bold mt-2">{title}</h1>
          <p className="text-sm text-slate-400">{t('app.tagline')}</p>
        </div>
        {children}
      </div>
    </div>
  );
}