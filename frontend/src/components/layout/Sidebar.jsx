/**
 * components/layout/Sidebar.jsx
 * Navigation sidebar with module links, active highlighting,
 * and an admin section shown only to admins. Collapses to a
 * mobile drawer on small screens.
 */
import { NavLink } from 'react-router-dom';
import {
  ShieldCheckIcon, LinkIcon, KeyIcon, EnvelopeIcon, DocumentIcon,
  QrCodeIcon, ChatBubbleLeftRightIcon, DocumentTextIcon,
  UsersIcon, ChartBarIcon, UserCircleIcon, ClockIcon, CogIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext.jsx';

// Workspace (overview & management)
const workspace = [
  { to: '/dashboard', label: 'Dashboard', icon: ShieldCheckIcon },
  { to: '/profile', label: 'Profile', icon: UserCircleIcon },
  { to: '/history', label: 'Scan History', icon: ClockIcon },
  { to: '/reports', label: 'Reports', icon: DocumentTextIcon },
  { to: '/settings', label: 'Settings', icon: CogIcon },
];

// Security modules
const modules = [
  { to: '/scan/url', label: 'URL Scanner', icon: LinkIcon },
  { to: '/scan/password', label: 'Password Analyzer', icon: KeyIcon },
  { to: '/scan/email', label: 'Email Phishing', icon: EnvelopeIcon },
  { to: '/scan/file', label: 'File Scanner', icon: DocumentIcon },
  { to: '/scan/qr', label: 'QR Checker', icon: QrCodeIcon },
  { to: '/dashboard/ai-chatbot', label: 'AI Chatbot', icon: ChatBubbleLeftRightIcon },
];

const adminNav = [
  { to: '/admin/users', label: 'User Management', icon: UsersIcon },
  { to: '/admin/analytics', label: 'Analytics', icon: ChartBarIcon },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      isActive ? 'bg-primary text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
    }`;

  const Group = ({ title, items }) => (
    <>
      {title && <p className="text-xs uppercase tracking-wider text-slate-400 px-3 mt-4 mb-1">{title}</p>}
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} className={linkCls} onClick={onClose}>
          <n.icon className="h-5 w-5" />
          {n.label}
        </NavLink>
      ))}
    </>
  );

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed lg:static z-40 h-full w-64 bg-white dark:bg-surface-card border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-1 transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <ShieldCheckIcon className="h-8 w-8 text-cyber-400" />
          <span className="font-bold text-lg">CyberSec</span>
        </div>

        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
          <Group title="Workspace" items={workspace} />
          <Group title="Security Modules" items={modules} />

          {user?.role === 'admin' && <Group title="Admin" items={adminNav} />}
        </nav>

        <div className="mt-2 px-3 py-2 text-xs text-slate-400 border-t border-slate-200 dark:border-slate-700">
          v1.0 · Protected
        </div>
      </aside>
    </>
  );
}
