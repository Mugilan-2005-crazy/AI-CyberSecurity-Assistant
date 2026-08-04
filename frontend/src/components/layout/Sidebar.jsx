/**
 * components/layout/Sidebar.jsx
 * Navigation sidebar with module links, active highlighting,
 * and an admin section shown only to admins. Collapses to a
 * mobile drawer on small screens.
 */
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheckIcon, LinkIcon, KeyIcon, EnvelopeIcon, DocumentIcon,
  QrCodeIcon, ChatBubbleLeftRightIcon, DocumentTextIcon,
  UsersIcon, ChartBarIcon, UserCircleIcon, ClockIcon, CogIcon,
  BeakerIcon, SparklesIcon, GlobeAltIcon, BellIcon, BuildingOfficeIcon,
  ExclamationTriangleIcon, ShareIcon, CloudIcon, CubeIcon, ServerStackIcon,
  SignalIcon, HeartIcon, ChartPieIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext.jsx';

// Workspace (overview & management)
const workspace = [
  { to: '/dashboard', labelKey: 'dashboard.title', icon: ShieldCheckIcon },
  { to: '/profile', labelKey: 'profile.title', icon: UserCircleIcon },
  { to: '/history', labelKey: 'history.title', icon: ClockIcon },
  { to: '/reports', labelKey: 'reports.title', icon: DocumentTextIcon },
  { to: '/settings', labelKey: 'settings.title', icon: CogIcon },
];

// Security modules
const modules = [
  { to: '/scan/url', labelKey: 'modules.urlScanner.title', icon: LinkIcon },
  { to: '/scan/password', labelKey: 'modules.passwordAnalyzer.title', icon: KeyIcon },
  { to: '/scan/email', labelKey: 'modules.emailPhishing.title', icon: EnvelopeIcon },
  { to: '/scan/file', labelKey: 'modules.fileScanner.title', icon: DocumentIcon },
  { to: '/scan/qr', labelKey: 'modules.qrChecker.title', icon: QrCodeIcon },
  { to: '/dashboard/ai-chatbot', labelKey: 'chatbot.title', icon: ChatBubbleLeftRightIcon },
];

const aiModules = [
  { to: '/ai-analyzer', labelKey: 'AI Analyst', icon: SparklesIcon },
];

const threatIntelNav = [
  { to: '/threat-intel', labelKey: 'Threat Intel Center', icon: GlobeAltIcon },
];

const alertsNav = [
  { to: '/notifications', labelKey: 'Notifications', icon: BellIcon },
  { to: '/ueba', labelKey: 'UEBA Analytics', icon: ExclamationTriangleIcon },
];

const observabilityNav = [
  { to: '/admin/observability', labelKey: 'Observability', icon: SignalIcon },
  { to: '/admin/observability/system', labelKey: 'System Overview', icon: ChartBarIcon },
  { to: '/admin/observability/health', labelKey: 'Health Dashboard', icon: HeartIcon },
];

const adminNav = [
  { to: '/admin/soc', labelKey: 'dashboard.title', icon: BeakerIcon },
  { to: '/admin/users', labelKey: 'settings.account', icon: UsersIcon },
  { to: '/admin/analytics', labelKey: 'settings.title', icon: ChartBarIcon },
  { to: '/admin/executive', labelKey: 'Executive Command Center', icon: BuildingOfficeIcon },
  { to: '/admin/incident-reports', labelKey: 'AI Incident Reports', icon: ExclamationTriangleIcon },
  { to: '/admin/knowledge-graph', labelKey: 'Security Knowledge Graph', icon: ShareIcon },
  { to: '/admin/ueba', labelKey: 'UEBA Dashboard', icon: ExclamationTriangleIcon },
  { to: '/admin/cloud-security', labelKey: 'Cloud Security', icon: CloudIcon },
  { to: '/admin/container-security', labelKey: 'Container Security', icon: CubeIcon },
  { to: '/admin/kubernetes', labelKey: 'Kubernetes Security', icon: ServerStackIcon },
  { to: '/admin/observability', labelKey: 'Observability', icon: SignalIcon },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const { t } = useTranslation();
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
          {t(n.labelKey)}
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
          <Group title={t('dashboard.allModules').replace(' modules', '')} items={workspace} />
          <Group title={t('modules.urlScanner.title').replace(' Security Scanner', '')} items={modules} />

          {(user?.role === 'admin' || user?.role === 'security_manager') && <Group title={t('settings.security')} items={adminNav} />}
          <Group title="AI" items={aiModules} />
          <Group title="Threat Intel" items={threatIntelNav} />
          <Group title="Alerts" items={alertsNav} />
        </nav>

        <div className="mt-2 px-3 py-2 text-xs text-slate-400 border-t border-slate-200 dark:border-slate-700">
          v1.0 · Protected
        </div>
      </aside>
    </>
  );
}
