/**
 * pages/Register.jsx
 * Registration form. New accounts require email verification
 * (a link is emailed). We inform the user to check their inbox.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthShell } from './Login.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
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
      <AuthShell title="Check your inbox">
        <div className="text-center space-y-4">
          <p className="text-slate-400">
            We sent a verification link to <span className="text-primary">{form.email}</span>.
            Please verify your email before signing in.
          </p>
          <Link to="/login" className="btn-primary w-full inline-block text-center">Continue to login</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="text-sm">Name</label>
          <input className="input" value={form.name} onChange={update('name')} placeholder="Jane Doe" />
          {errors.name && <p className="text-danger text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="text-sm">Email</label>
          <input type="email" className="input" value={form.email} onChange={update('email')} placeholder="you@domain.com" />
          {errors.email && <p className="text-danger text-xs mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="text-sm">Password (min 8 chars)</label>
          <input type="password" className="input" value={form.password} onChange={update('password')} placeholder="••••••••" />
          {errors.password && <p className="text-danger text-xs mt-1">{errors.password}</p>}
        </div>
        <button className="btn-cyber w-full" disabled={loading}>
          {loading ? 'Creating...' : 'Register'}
        </button>
      </form>
      <p className="mt-4 text-sm text-center text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="hover:text-primary">Sign in</Link>
      </p>
    </AuthShell>
  );
}
