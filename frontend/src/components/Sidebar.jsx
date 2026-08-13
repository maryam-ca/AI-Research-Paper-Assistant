import { NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Library, Clock, Search, Activity, Settings, Keyboard, LifeBuoy, Moon, Sun, BarChart3,
  PanelLeftClose, PanelLeftOpen, Pin, PinOff,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import apiClient from '../api/client';
import CollectionsList from './CollectionsList';

const NAV = [
  { to: '/', label: 'Library', icon: Library, end: true },
  { to: '/recent', label: 'Recent', icon: Clock },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const FOOT = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/shortcuts', label: 'Key Shortcuts', icon: Keyboard },
  { to: '/support', label: 'Support', icon: LifeBuoy },
];

const AUTO_HIDE_MS = 10000;

export default function Sidebar() {
  const { darkMode, toggleDarkMode } = useAppStore();
  const setCollections = useAppStore((s) => s.setCollections);
  const [open, setOpen] = useState(true);
  const [pinned, setPinned] = useState(localStorage.getItem('sidebarPinned') === 'true');
  const timer = useRef(null);

  const clear = () => clearTimeout(timer.current);
  const expand = () => { clear(); setOpen(true); };
  const scheduleCollapse = () => {
    clear();
    if (pinned) return;
    timer.current = setTimeout(() => setOpen(false), AUTO_HIDE_MS);
  };

  useEffect(() => {
    if (pinned) { clear(); setOpen(true); }
    else scheduleCollapse();
    return clear;
  }, [pinned]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    apiClient.get('/collections').then(setCollections).catch(() => {});
  }, [setCollections]);

  const toggle = () => {
    const nextPinned = !pinned;
    setPinned(nextPinned);
    localStorage.setItem('sidebarPinned', String(nextPinned));
    if (nextPinned) { clear(); setOpen(true); }
    else { clear(); setOpen(false); }
  };

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-primary-50 text-primary dark:bg-primary-700/30'
        : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
    }`;

  return (
    <>
      {!open && (
        <>
          <div onMouseEnter={expand} className="fixed left-0 top-0 z-30 h-screen w-3" />
          <button
            onClick={toggle}
            title="Open sidebar"
            className="btn-primary fixed left-3 top-3 z-40 rounded-lg px-3 py-2 shadow-lg"
          >
            <PanelLeftOpen size={18} />
          </button>
        </>
      )}

      <nav
        onMouseEnter={expand}
        onMouseLeave={scheduleCollapse}
        className={`relative z-40 flex h-screen shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-cream transition-[width] duration-300 dark:border-slate-700 dark:bg-slate-800 ${open ? 'w-64' : 'w-0 border-r-0'}`}
      >
        <div className="flex w-64 flex-1 flex-col">
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-display text-xl font-bold text-primary">ScholarFlow</span>
            <div className="flex items-center gap-1">
              <button onClick={toggle} title={pinned ? 'Unpin / collapse' : 'Pin open'} className="btn-ghost px-2 py-1">
                {pinned ? <PinOff size={16} /> : <Pin size={16} />}
              </button>
              <button onClick={toggle} title="Collapse sidebar" className="btn-ghost px-2 py-1">
                <PanelLeftClose size={16} />
              </button>
            </div>
          </div>

          <div className="px-3">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkCls}>
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </div>

          <div className="mt-4 flex-1 overflow-auto px-3">
            <CollectionsList />
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-slate-700">
            {FOOT.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={linkCls}>
                <Icon size={18} /> {label}
              </NavLink>
            ))}
            <button className="btn-ghost w-full justify-between" onClick={toggleDarkMode}>
              <span className="flex items-center gap-3"><Moon size={18} /> {darkMode ? 'Light mode' : 'Dark mode'}</span>
              <span>{darkMode ? '☀' : '☾'}</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
