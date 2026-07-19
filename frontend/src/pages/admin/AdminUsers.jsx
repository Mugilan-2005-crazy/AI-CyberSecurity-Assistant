/**
 * pages/admin/AdminUsers.jsx
 * Admin — User Management. Lists users, toggles active status,
 * changes role, and deletes accounts. Searchable.
 */
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api.js';
import Loader from '../../components/ui/Loader.jsx';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get(`/admin/users?q=${q}`).then((r) => setUsers(r.users)).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line

  const toggleActive = async (u) => {
    await api.patch(`/admin/users/${u._id}`, { isActive: !u.isActive });
    toast.success('Updated');
    load();
  };
  const toggleRole = async (u) => {
    await api.patch(`/admin/users/${u._id}`, { role: u.role === 'admin' ? 'user' : 'admin' });
    toast.success('Role changed');
    load();
  };
  const remove = async (u) => {
    if (!confirm(`Delete ${u.email}?`)) return;
    await api.delete(`/admin/users/${u._id}`);
    toast.success('Deleted');
    load();
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <input className="input max-w-xs" placeholder="Search users..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-700">
              <th className="py-2">Name</th><th>Email</th><th>Role</th><th>Active</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b border-slate-800">
                <td className="py-2">{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.isActive ? '✅' : '⛔'}</td>
                <td className="space-x-2">
                  <button className="text-primary hover:underline" onClick={() => toggleActive(u)}>Toggle</button>
                  <button className="text-warning hover:underline" onClick={() => toggleRole(u)}>Role</button>
                  <button className="text-danger hover:underline" onClick={() => remove(u)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
