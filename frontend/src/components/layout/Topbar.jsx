/**
 * components/layout/Topbar.jsx
 * Top bar with mobile menu toggle, theme switch, notifications
 * dropdown, and user menu (logout).
 */
import { useEffect, useRef, useState } from 'react';
import { BellIcon, SunIcon, MoonIcon, Bars3Icon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Topbar({ onMenu }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    api.get('/admin/notifications').then((r) => setNotes(r.notifications)).catch(() => {});
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = notes.filter((n) => !n.read).length;

  return (
    <header className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-700 glass sticky top-0 z-20">
      <button className="lg:hidden p-2" onClick={onMenu} aria-label="Menu">
        <Bars3Icon className="h-6 w-6" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button onClick={toggle} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </button>

        <div className="relative" ref={ref}>
          <button onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 relative" aria-label="Notifications">
            <BellIcon className="h-5 w-5" />
            {unread > 0 && <span className="absolute top-1 right-1 h-2 w-2 bg-danger rounded-full" />}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-72 card z-30 max-h-80 overflow-y-auto animate-fade-in">
              <p className="font-semibold mb-2">Notifications</p>
              {notes.length === 0 && <p className="text-sm text-slate-400">No notifications</p>}
              {notes.map((n) => (
                <div key={n._id} className="text-sm py-2 border-b border-slate-700 last:border-0">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-slate-400">{n.message}</p>
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
