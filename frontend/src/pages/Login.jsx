/**
 * pages/Login.jsx
 * Login page with email/password, redirect on success, and a
 * link to the registration and forgot-password flows.
 */
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success('Welcome back!');
      const role = user?.role;
      const to = location.state?.from?.pathname || (role === 'admin' ? '/admin/analytics' : '/dashboard');
      navigate(to, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t('auth.signIn')}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm">{t('auth.email')}</label>
          <input type="email" required className="input" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('auth.emailPlaceholder')} />
        </div>
        <div>
          <label className="text-sm">{t('auth.password')}</label>
          <input type="password" required className="input" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('auth.passwordPlaceholder')} />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? t('auth.signingIn') : t('auth.signInBtn')}
        </button>
      </form>
      <div className="mt-4 text-sm text-center text-slate-400">
        <Link to="/forgot-password" className="hover:text-primary">{t('auth.forgotPassword')}</Link>
        <span className="mx-2">·</span>
        <Link to="/register" className="hover:text-primary">{t('auth.createAccount')}</Link>
      </div>
    </AuthShell>
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
