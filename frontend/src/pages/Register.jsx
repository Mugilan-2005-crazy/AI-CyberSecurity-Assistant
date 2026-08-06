/**
 * pages/Register.jsx
 * Registration form. New accounts require email verification
 * (a link is emailed). We inform the user to check their inbox.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthShell } from './Login.jsx';
import PasswordInput from '../components/ui/PasswordInput.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters';
    if (!EMAIL_RE.test(form.email)) next.email = 'Enter a valid email address';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created! Check your email to verify.');
      setSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell title={t('auth.checkInbox')}>
        <div className="text-center space-y-4">
          <p className="text-slate-400">
            {t('auth.verifyEmailText')} <span className="text-primary">{form.email}</span>.
            {t('auth.verifyEmailTextEnd')}
          </p>
          <Link to="/login" className="btn-primary w-full inline-block text-center">{t('auth.continueToLogin')}</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.registerTitle')}>
      <form onSubmit={submit} className="space-y-4" noValidate aria-label="Registration form">
        <div>
          <label htmlFor="reg-name" className="text-sm">{t('auth.name')}</label>
          <input id="reg-name" className="input" value={form.name} onChange={update('name')} placeholder={t('auth.namePlaceholder')} required />
          {errors.name && <p className="text-danger text-xs mt-1" role="alert">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="reg-email" className="text-sm">{t('auth.email')}</label>
          <input id="reg-email" type="email" className="input" value={form.email} onChange={update('email')} placeholder={t('auth.emailPlaceholder')} required />
          {errors.email && <p className="text-danger text-xs mt-1" role="alert">{errors.email}</p>}
        </div>
        <PasswordInput
          id="reg-password"
          label={t('auth.passwordMin')}
          value={form.password}
          onChange={update('password')}
          placeholder={t('auth.passwordPlaceholder')}
          error={errors.password}
          minLength={8}
          required
          autoComplete="new-password"
        />
        <button className="btn-cyber w-full" disabled={loading} type="submit">
          {loading ? t('auth.creating') : t('auth.registerBtn')}
        </button>
      </form>
      <p className="mt-4 text-sm text-center text-slate-400">
        {t('auth.alreadyHaveAccount')}{' '}
        <Link to="/login" className="hover:text-primary">{t('auth.signInLink')}</Link>
      </p>
    </AuthShell>
  );
}
