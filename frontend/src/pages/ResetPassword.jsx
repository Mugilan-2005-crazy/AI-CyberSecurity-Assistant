/**
 * pages/ResetPassword.jsx
 * Completes the reset using the ?token= from the email link.
 */
import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import api from '../services/api.js';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), password: pw });
      setDone(true);
      toast.success('Password updated');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full animate-fade-in">
        <h1 className="text-xl font-bold mb-2">{t('auth.resetPasswordTitle')}</h1>
        {done ? (
          <p className="text-cyber-400">{t('common.loading')}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input type="password" required minLength={8} className="input" placeholder={t('auth.newPassword')}
              value={pw} onChange={(e) => setPw(e.target.value)} />
            <button className="btn-primary w-full">{t('auth.resetPasswordBtn')}</button>
          </form>
        )}
        <Link to="/login" className="text-sm text-primary hover:underline mt-4 inline-block">{t('common.back')}</Link>
      </div>
    </div>
  );
}
