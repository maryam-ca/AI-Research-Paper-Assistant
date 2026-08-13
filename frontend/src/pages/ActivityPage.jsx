import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Sparkles, X, Download } from 'lucide-react';
import apiClient from '../api/client';

const ICONS = {
  upload: '⬆', analyze: '🧠', question: '💬', tag: '🏷', favorite: '⭐',
};

export default function ActivityPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [digest, setDigest] = useState(null);
  const [digestBusy, setDigestBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.get('/activity')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const genDigest = async () => {
    setDigestBusy(true);
    try {
      const res = await apiClient.post('/digest', { frequency: 'weekly' });
      setDigest(res);
    } catch (e) {
      alert(e.message);
    } finally {
      setDigestBusy(false);
    }
  };

  const downloadDigest = () => {
    if (!digest?.markdown) return;
    const blob = new Blob([digest.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weekly_digest.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Activity</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Recent actions across your whole library.
          </p>
        </div>
        <button className="btn-ghost" onClick={genDigest} disabled={digestBusy}>
          <Sparkles size={16} className={digestBusy ? 'animate-pulse text-primary' : ''} /> Generate Digest
        </button>
      </div>

      {digest && (
        <div className="mt-4 card p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Weekly Digest ({digest.paper_count} papers)</span>
            <div className="flex items-center gap-2">
              <button className="btn-ghost p-1" onClick={downloadDigest}><Download size={16} /></button>
              <button className="btn-ghost p-1" onClick={() => setDigest(null)}><X size={16} /></button>
            </div>
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-sm">{digest.markdown}</pre>
        </div>
      )}

      <ol className="relative mt-6 max-w-2xl border-l border-slate-200 dark:border-slate-700 pl-4">
        {loading && <li className="text-slate-400">Loading…</li>}
        {!loading && items.length === 0 && (
          <li className="text-sm text-slate-400">No activity yet.</li>
        )}
        {items.map((it, i) => (
          <li key={i} className="mb-4">
            <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
              {ICONS[it.action] || '•'}
            </span>
            <button
              className="text-left text-sm hover:text-primary"
              onClick={() => navigate(`/paper/${it.paper_id}`)}
            >
              <span className="font-semibold capitalize">{it.action}</span>
              <span className="text-slate-500 dark:text-slate-400"> — {it.details}</span>
              <span className="block text-xs text-slate-400">{it.paper_title}</span>
            </button>
            <p className="text-[11px] text-slate-400">
              {it.timestamp ? new Date(it.timestamp).toLocaleString() : ''}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
