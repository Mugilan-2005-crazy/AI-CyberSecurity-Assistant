/**
 * pages/Register.jsx
 * Registration form. New accounts require email verification
 * (a link is emailed). We inform the user to check their inbox.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthShell } from './Login.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created! Check your email to verify.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm">Name</label>
          <input className="input" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
        </div>
        <div>
          <label className="text-sm">Email</label>
          <input type="email" className="input" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@domain.com" />
        </div>
        <div>
          <label className="text-sm">Password (min 8 chars)</label>
          <input type="password" className="input" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
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
