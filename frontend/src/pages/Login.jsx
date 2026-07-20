/**
 * pages/Login.jsx
 * Login page with email/password, redirect on success, and a
 * link to the registration and forgot-password flows.
 */
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function Login() {
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
    <AuthShell title="Sign in to your account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm">Email</label>
          <input type="email" required className="input" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@domain.com" />
        </div>
        <div>
          <label className="text-sm">Password</label>
          <input type="password" required className="input" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <div className="mt-4 text-sm text-center text-slate-400">
        <Link to="/forgot-password" className="hover:text-primary">Forgot password?</Link>
        <span className="mx-2">·</span>
        <Link to="/register" className="hover:text-primary">Create account</Link>
      </div>
    </AuthShell>
  );
}

export function AuthShell({ title, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md card animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <ShieldCheckIcon className="h-12 w-12 text-cyber-400 animate-float" />
          <h1 className="text-xl font-bold mt-2">{title}</h1>
          <p className="text-sm text-slate-400">AI-powered Cyber Security Assistant</p>
        </div>
        {children}
      </div>
    </div>
  );
}
