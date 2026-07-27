/**
 * pages/ForgotPassword.jsx
 * Requests a password-reset email. We don't reveal whether the
 * email exists (generic success message).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import api from '../services/api.js';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('If the email exists, a reset link was sent.');
    } catch {
      toast.error('Request failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full animate-fade-in">
        <h1 className="text-xl font-bold mb-2">{t('auth.forgotPasswordTitle')}</h1>
        {sent ? (
          <p className="text-slate-400">{t('auth.checkInbox')}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input type="email" required className="input" placeholder={t('auth.emailPlaceholder')}
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn-primary w-full">{t('auth.sendResetLink')}</button>
          </form>
        )}
        <Link to="/login" className="text-sm text-primary hover:underline mt-4 inline-block">{t('common.back')}</Link>
      </div>
    </div>
  );
}
