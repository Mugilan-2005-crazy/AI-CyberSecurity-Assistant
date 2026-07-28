/**
 * pages/admin/AdminUsers.jsx
 * ------------------------------------------------------------
 * Professional User Management table for SOC admin panel.
 * Shows: Username, Email, Role, Account Status, Last Login, Actions.
 * Actions: View, Block/Unblock, Delete, Change Role.
 * Searchable with Framer Motion animations and glassmorphism.
 */
import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  UsersIcon, ShieldCheckIcon, ExclamationTriangleIcon,
  TrashIcon, EyeIcon, CheckCircleIcon, XCircleIcon,
  ArrowPathIcon, MagnifyingGlassIcon, NoSymbolIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import Card from '../../components/ui/Card.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';
import Modal from '../../components/ui/Modal.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rel = (iso) => {
  if (!iso) return 'Never';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [viewUser, setViewUser] = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`/admin/users?q=${q}`)
      .then((r) => setUsers(r.users || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [q]);

  const toggleActive = async (u) => {
    setActionLoading(u._id);
    try {
      await api.patch(`/admin/users/${u._id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? 'User blocked' : 'User unblocked');
      load();
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleRole = async (u) => {
    setActionLoading(u._id);
    try {
      const newRole = u.role === 'admin' ? 'user' : 'admin';
      await api.patch(`/admin/users/${u._id}`, { role: newRole });
      toast.success(`Role changed to ${newRole}`);
      load();
    } catch {
      toast.error('Role change failed');
    } finally {
      setActionLoading(null);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Are you sure you want to delete ${u.name} (${u.email})? This action cannot be undone.`)) return;
    setActionLoading(u._id);
    try {
      await api.delete(`/admin/users/${u._id}`);
      toast.success('User deleted');
      load();
    } catch {
      toast.error('Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with search */}
      <motion.div
        initial="hidden" animate="show"
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-slate-400">{users.length} users found</p>
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9 max-w-xs"
            placeholder="Search users by name or email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        initial="hidden" animate="show" variants={stagger}
      >
        {[
          { label: 'Total Users', value: users.length, icon: UsersIcon, color: 'text-cyber-400' },
          { label: 'Admins', value: users.filter((u) => u.role === 'admin').length, icon: ShieldCheckIcon, color: 'text-primary' },
          { label: 'Active', value: users.filter((u) => u.isActive).length, icon: CheckCircleIcon, color: 'text-green-400' },
          { label: 'Blocked', value: users.filter((u) => !u.isActive).length, icon: XCircleIcon, color: 'text-danger' },
        ].map((s) => (
          <motion.div key={s.label} variants={fadeUp} className="text-center p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-sm">
            <s.icon className={`h-5 w-5 mx-auto ${s.color}`} />
            <p className={`text-lg font-bold mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Users table */}
      <motion.div
        initial="hidden" animate="show" variants={fadeUp}
      >
        <Card className="overflow-hidden backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="py-3 px-4 font-medium">User</th>
                  <th className="py-3 px-4 font-medium hidden sm:table-cell">Email</th>
                  <th className="py-3 px-4 font-medium">Role</th>
                  <th className="py-3 px-4 font-medium hidden md:table-cell">Status</th>
                  <th className="py-3 px-4 font-medium hidden lg:table-cell">Last Login</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u, i) => (
                    <motion.tr
                      key={u._id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyber-400 to-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <span className="font-medium truncate max-w-[140px]">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 hidden sm:table-cell truncate max-w-[180px]">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {u.role === 'admin' ? <ShieldCheckIcon className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {u.isActive ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
                          {u.isActive ? 'Active' : 'Blocked'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 hidden lg:table-cell">{rel(u.lastLogin)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewUser(u)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-cyber-400 transition-colors"
                            title="View user"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={actionLoading === u._id}
                            className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                              u.isActive ? 'text-amber-400 hover:text-amber-300' : 'text-green-400 hover:text-green-300'
                            } disabled:opacity-50`}
                            title={u.isActive ? 'Block user' : 'Unblock user'}
                          >
                            {actionLoading === u._id ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : u.isActive ? (
                              <NoSymbolIcon className="h-4 w-4" />
                            ) : (
                              <CheckCircleIcon className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => toggleRole(u)}
                            disabled={actionLoading === u._id}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                            title={`Change to ${u.role === 'admin' ? 'user' : 'admin'}`}
                          >
                            {actionLoading === u._id ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheckIcon className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => remove(u)}
                            disabled={actionLoading === u._id}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-danger transition-colors disabled:opacity-50"
                            title="Delete user"
                          >
                            {actionLoading === u._id ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <TrashIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {/* View User Modal */}
      {viewUser && (
        <Modal onClose={() => setViewUser(null)} title="User Details">
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-700">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyber-400 to-primary flex items-center justify-center text-white text-2xl font-bold">
                {viewUser.name ? viewUser.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div>
                <h3 className="text-lg font-bold">{viewUser.name}</h3>
                <p className="text-sm text-slate-400">{viewUser.email}</p>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                  viewUser.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-500/10 text-slate-400'
                }`}>
                  {viewUser.role}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-xs text-slate-400">Status</p>
                <p className={`font-medium ${viewUser.isActive ? 'text-green-400' : 'text-red-400'}`}>
                  {viewUser.isActive ? 'Active' : 'Blocked'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-xs text-slate-400">Email Verified</p>
                <p className={`font-medium ${viewUser.isEmailVerified ? 'text-green-400' : 'text-amber-400'}`}>
                  {viewUser.isEmailVerified ? 'Verified' : 'Pending'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-xs text-slate-400">Last Login</p>
                <p className="font-medium text-slate-300">{rel(viewUser.lastLogin)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-xs text-slate-400">Joined</p>
                <p className="font-medium text-slate-300">
                  {viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
              {viewUser.language && (
                <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <p className="text-xs text-slate-400">Language</p>
                  <p className="font-medium text-slate-300 capitalize">{viewUser.language}</p>
                </div>
              )}
              {viewUser._id && (
                <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <p className="text-xs text-slate-400">User ID</p>
                  <p className="font-medium text-slate-300 text-xs truncate">{viewUser._id}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { toggleActive(viewUser); setViewUser(null); }}
                className={`btn flex-1 justify-center ${viewUser.isActive ? 'btn-primary' : 'btn-cyber'}`}
              >
                {viewUser.isActive ? 'Block User' : 'Unblock User'}
              </button>
              <button
                onClick={() => { toggleRole(viewUser); setViewUser(null); }}
                className="btn flex-1 justify-center"
              >
                Make {viewUser.role === 'admin' ? 'User' : 'Admin'}
              </button>
              <button
                onClick={() => { remove(viewUser); setViewUser(null); }}
                className="btn flex-1 justify-center text-danger border border-danger/30 hover:bg-danger/10"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}