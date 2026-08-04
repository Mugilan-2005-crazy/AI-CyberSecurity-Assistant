/**
 * components/layout/Topbar.jsx
 * Top bar with mobile menu toggle, theme switch, notifications
 * dropdown, and user menu (logout).
 */
import { useEffect, useRef, useState } from 'react';
import { BellIcon, SunIcon, MoonIcon, Bars3Icon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import api, { setToken } from '../../services/api.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useNotifications from '../../hooks/useNotifications.js';
import ConnectionIndicator from './ConnectionIndicator.jsx';
import LanguageSelector from '../LanguageSelector.jsx';

export default function Topbar({ onMenu }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const { notifications, unreadCount, markAllRead, markRead, deleteNotification, connectionState, reconnectAttempt } = useNotifications({ autoConnectSocket: true });

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleMarkRead = async (id) => {
    await markRead(id);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  const handleDelete = async (id) => {
    await deleteNotification(id);
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-700 glass sticky top-0 z-20">
      <button className="lg:hidden p-2" onClick={onMenu} aria-label="Menu">
        <Bars3Icon className="h-6 w-6" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <ConnectionIndicator connectionState={connectionState} reconnectAttempt={reconnectAttempt} />
        <LanguageSelector />
        <button onClick={toggle} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </button>

        <div className="relative" ref={ref}>
          <button onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 relative" aria-label="Notifications">
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && <span className="absolute top-1 right-1 h-2 w-2 bg-danger rounded-full" />}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-72 card z-30 max-h-80 overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {!notifications.length && <p className="text-sm text-slate-400">You're all caught up.</p>}
              {notifications.map((n) => (
                <div key={n.id} className={`text-sm py-2 border-b border-slate-700 last:border-0 ${!n.read ? 'bg-slate-50/50 dark:bg-slate-800/40' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{n.title}</p>
                      <p className="text-slate-400">{n.message}</p>
                      <p className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-0.5" />}
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                        title="Mark as read"
                      >
                        {n.read ? '' : '✓'}
                      </button>
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="text-xs text-slate-400 hover:text-red-400"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pl-2">
          <span className="hidden sm:block text-sm">{user?.name}</span>
          <button onClick={logout} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Logout">
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
