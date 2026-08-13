import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

const SHORTCUTS = [
  { keys: ['/'], desc: 'Jump to Search' },
  { keys: ['G', 'L'], desc: 'Go to Library' },
  { keys: ['G', 'R'], desc: 'Go to Recent' },
  { keys: ['G', 'A'], desc: 'Go to Activity' },
  { keys: ['D'], desc: 'Toggle dark mode' },
  { keys: ['?'], desc: 'Open this shortcuts page' },
];

function isTyping() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export default function ShortcutsPage() {
  const navigate = useNavigate();
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);

  useEffect(() => {
    function onKey(e) {
      if (isTyping()) return;
      const k = e.key.toLowerCase();
      if (k === '/') { e.preventDefault(); navigate('/search'); }
      else if (k === 'g') {
        // wait for a second key
        const handler = (e2) => {
          const k2 = e2.key.toLowerCase();
          if (k2 === 'l') navigate('/');
          else if (k2 === 'r') navigate('/recent');
          else if (k2 === 'a') navigate('/activity');
          document.removeEventListener('keydown', handler);
        };
        document.addEventListener('keydown', handler);
        setTimeout(() => document.removeEventListener('keydown', handler), 1000);
      } else if (k === 'd') { toggleDarkMode(); }
      else if (k === '?') { navigate('/shortcuts'); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate, toggleDarkMode]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="font-display text-2xl font-bold">Key Shortcuts</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Keyboard shortcuts are active anywhere in the app (except while typing in a field).
      </p>

      <div className="card mt-6 divide-y divide-slate-200 dark:divide-slate-700">
        {SHORTCUTS.map((s) => (
          <div key={s.desc} className="flex items-center justify-between py-3">
            <span className="text-sm">{s.desc}</span>
            <span className="flex gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="kbd">{k}</kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
