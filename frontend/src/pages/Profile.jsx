/**
 * pages/Profile.jsx
 * ------------------------------------------------------------
 * User profile page. Shows identity, verification/role status,
 * and allows editing the display name via the auth context.
 * Security-sensitive actions (password/email) are intentionally
 * delegated to dedicated flows; this view is read + light-edit.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { toast } from 'react-toastify';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user?.name || '');

  const save = () => {
    // Local-only update for Phase 1 (no dedicated PATCH endpoint yet).
    setUser({ ...user, name });
    setOpen(false);
    toast.success('Profile updated');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Profile</h1>

      <Card>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-cyber-500 flex items-center justify-center text-white text-2xl font-bold">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold">{user?.name}</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <div className="mt-1 flex gap-2">
              <Badge tone={user?.role === 'admin' ? 'danger' : 'info'}>{user?.role}</Badge>
              <Badge tone={user?.isEmailVerified ? 'success' : 'warning'}>
                {user?.isEmailVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
          </div>
          <button className="btn-primary" onClick={() => setOpen(true)}>Edit</button>
        </div>
      </Card>

      <Card title="Account Details">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-slate-400">User ID</dt><dd className="font-mono break-all">{user?.id}</dd></div>
          <div><dt className="text-slate-400">Role</dt><dd>{user?.role}</dd></div>
          <div><dt className="text-slate-400">Email</dt><dd>{user?.email}</dd></div>
          <div><dt className="text-slate-400">Status</dt><dd>{user?.isEmailVerified ? 'Active' : 'Pending verification'}</dd></div>
        </dl>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit Profile">
        <label className="text-sm">Display name</label>
        <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  );
}
