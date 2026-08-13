import { useAppStore } from '../store/appStore';
import apiClient from '../api/client';
import { FONT_OPTIONS, CURSOR_OPTIONS, ACCENT_OPTIONS, applyAppearance } from '../appearance';

export default function SettingsPage() {
  const { darkMode, toggleDarkMode } = useAppStore();
  const apiBase = apiClient.baseUrl;

  const appFont = localStorage.getItem('appFont') || 'sans';
  const appCursor = localStorage.getItem('appCursor') || 'auto';
  const appAccent = localStorage.getItem('appAccent') || '#4f46e5';

  const setVal = (key, value) => {
    localStorage.setItem(key, value);
    applyAppearance();
  };

  const selectCls = 'input w-56';
  const labelCls = 'text-sm text-slate-500 dark:text-slate-400';

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      <section className="card mt-6 p-5">
        <h3 className="font-semibold">Appearance</h3>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className={labelCls}>UI font style</span>
          <select className={selectCls} value={appFont} onChange={(e) => setVal('appFont', e.target.value)}>
            {FONT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className={labelCls}>Pointer / cursor style</span>
          <select className={selectCls} value={appCursor} onChange={(e) => setVal('appCursor', e.target.value)}>
            {CURSOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className={labelCls}>Accent color (buttons, links, sidebar, headings)</span>
          <div className="flex items-center gap-2">
            {ACCENT_OPTIONS.map((o) => (
              <button
                key={o.value}
                title={o.label}
                onClick={() => setVal('appAccent', o.value)}
                className={`h-7 w-7 rounded-full border-2 ${appAccent === o.value ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
                style={{ backgroundColor: o.value }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className={labelCls}>Dark mode</span>
          <button className="btn-primary" onClick={toggleDarkMode}>
            {darkMode ? 'Switch to Light' : 'Switch to Dark'}
          </button>
        </div>
      </section>

      <section className="card mt-4 p-5">
        <h3 className="font-semibold">Backend</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">API base URL</dt>
            <dd className="font-mono">{apiBase}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Environment</dt>
            <dd>{import.meta.env.MODE}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-400">
          Model, database, and storage configuration live in the backend
          environment variables (<code> GEMINI_API_KEY</code>, <code>DATABASE_URL</code>).
        </p>
      </section>

      <section className="card mt-4 p-5">
        <h3 className="font-semibold">Data</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Papers, summaries, and embeddings are stored in Postgres. Delete a paper
          from its card menu (⋮ → Delete) to permanently remove it and all related data.
        </p>
      </section>
    </div>
  );
}
