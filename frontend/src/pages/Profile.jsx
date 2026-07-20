/**
 * pages/Profile.jsx
 * ------------------------------------------------------------
 * Professional user profile + account settings.
 *  - Displays identity (name/email), joined date, role/verification,
 *    total scans, total AI chats, and recent activity.
 *  - Allows updating the display name (PATCH /auth/me) and changing
 *    the password (POST /auth/change-password).
 *  - Uses only existing backend APIs (via endpoints.js).
 *  - Loading + empty states, success/error toasts, dashboard design.
 */
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { PencilIcon, KeyIcon } from '@heroicons/react/24/outline';
import endpoints from '../services/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import StateView from '../components/ui/StateView.jsx';
import VerdictBadge from '../components/ui/VerdictBadge.jsx';

const MODULE_ICON = { url: '🔗', password: '🔑', email: '✉️', file: '📄', qr: '🔳' };

export default function Profile() {
  const { user: authUser, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Name-edit modal
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // Password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const load = () => {
    setLoading(true);
    return Promise.all([
      endpoints.getProfile().catch(() => null),
      endpoints.getDashboard().then((d) => d.recentActivity || []).catch(() => []),
    ])
      .then(([p, activity]) => {
        if (p) setProfile(p);
        setRecent(activity);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveName = async () => {
    if (name.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    setNameSaving(true);
    try {
      const u = await endpoints.updateProfileName(name.trim());
      setProfile(u);
      setUser({ ...authUser, name: u.name }); // keep auth context in sync
      setNameOpen(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update name');
    } finally {
      setNameSaving(false);
    }
  };

  const savePassword = async () => {
    if (pw.next.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    try {
      await endpoints.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '' });
      setPwOpen(false);
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (error || !profile) {
    return <StateView type="error" title="Couldn't load profile" message="Try again in a moment." />;
  }

  const joined = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—';

  const stats = [
    { label: 'Total Scans', value: profile.totalScans ?? 0 },
    { label: 'Total AI Chats', value: profile.totalChats ?? 0 },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Profile & Account</h1>

      {/* Identity + quick actions */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-cyber-500 flex items-center justify-center text-white text-2xl font-bold">
            {profile.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold truncate">{profile.name}</p>
            <p className="text-sm text-slate-400 truncate">{profile.email}</p>
            <div className="mt-1 flex gap-2">
              <Badge tone={profile.role === 'admin' ? 'danger' : 'info'}>{profile.role}</Badge>
              <Badge tone={profile.isEmailVerified ? 'success' : 'warning'}>
                {profile.isEmailVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-primary flex items-center gap-1.5" onClick={() => { setName(profile.name); setNameOpen(true); }}>
              <PencilIcon className="h-4 w-4" /> Edit
            </button>
            <button className="btn flex items-center gap-1.5" onClick={() => setPwOpen(true)}>
              <KeyIcon className="h-4 w-4" /> Password
            </button>
          </div>
        </div>
      </Card>

      {/* Account details */}
      <Card title="Account Details">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-slate-400">Name</dt><dd className="font-medium">{profile.name}</dd></div>
          <div><dt className="text-slate-400">Email</dt><dd className="font-medium break-all">{profile.email}</dd></div>
          <div><dt className="text-slate-400">Joined</dt><dd className="font-medium">{joined}</dd></div>
          <div><dt className="text-slate-400">Role</dt><dd className="font-medium">{profile.role}</dd></div>
        </dl>
      </Card>

      {/* Account statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center justify-between">
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className="text-3xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <Card title="Recent Activity" description="Your latest scans">
        {recent.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((r) => (
              <li key={r._id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span aria-hidden="true">{MODULE_ICON[r.type] || '•'}</span>{' '}
                    <span className="uppercase text-xs text-slate-400">{r.type}</span>{' '}
                    <span className="text-slate-500 truncate max-w-[200px] inline-block align-middle">{r.input || '—'}</span>
                  </p>
                  <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <VerdictBadge verdict={r.verdict} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No scans yet. Run a scan to see it here.</p>
        )}
      </Card>

      {/* Edit name modal */}
      <Modal open={nameOpen} onClose={() => setNameOpen(false)} title="Edit Display Name">
        <label className="text-sm">Display name</label>
        <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn" onClick={() => setNameOpen(false)} disabled={nameSaving}>Cancel</button>
          <button className="btn-primary" onClick={saveName} disabled={nameSaving}>
            {nameSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>

      {/* Change password modal */}
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password">
        <div className="space-y-3">
          <div>
            <label className="text-sm">Current password</label>
            <input type="password" className="input mt-1" value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
          </div>
          <div>
            <label className="text-sm">New password (min 8 chars)</label>
            <input type="password" className="input mt-1" value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn" onClick={() => setPwOpen(false)} disabled={pwSaving}>Cancel</button>
          <button className="btn-primary" onClick={savePassword} disabled={pwSaving}>
            {pwSaving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
