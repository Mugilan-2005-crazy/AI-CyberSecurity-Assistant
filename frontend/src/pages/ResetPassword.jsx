/**
 * pages/ResetPassword.jsx
 * Completes the reset using the ?token= from the email link.
 * Includes password visibility toggle and loading state.
 */
import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import api from '../services/api.js';
import PasswordInput from '../components/ui/PasswordInput.jsx';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), password: pw });
      setDone(true);
      toast.success('Password updated successfully');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Reset failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex flex-col items-center mb-6">
            <ShieldCheckIcon className="h-12 w-12 text-cyber-400 animate-float" />
            <h1 className="text-xl font-bold mt-2">{t('auth.resetPasswordTitle')}</h1>
            <p className="text-sm text-slate-400 mt-1">Enter your new password</p>
          </div>
          {done ? (
            <div className="text-center space-y-4">
              <CheckBadgeIcon className="h-16 w-16 text-green-400 mx-auto" />
              <p className="text-cyber-400">Password updated! Redirecting to login...</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <PasswordInput
                label="New Password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={t('auth.newPassword')}
                minLength={8}
                required
                autoComplete="new-password"
              />
              {error && <p className="text-danger text-xs text-center">{error}</p>}
              <button className="btn-primary w-full" disabled={loading || pw.length < 8}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </span>
                ) : (
                  t('auth.resetPasswordBtn')
                )}
              </button>
            </form>
          )}
          <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-primary mt-4">
            Back to Login
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
