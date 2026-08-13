import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';

function BarRow({ label, value, max, color = 'bg-primary' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 shrink-0 truncate text-slate-500 dark:text-slate-400">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-slate-400">{value}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [params] = useSearchParams();
  const collectionId = params.get('collection');

  useEffect(() => {
    const q = collectionId ? `?collection_id=${collectionId}` : '';
    apiClient.get(`/analytics/dashboard${q}`).then(setData).catch(() => {});
  }, [collectionId]);

  if (!data) return <div className="p-6 text-slate-400">Loading analytics…</div>;

  const maxTopic = data.top_topics.length ? data.top_topics[0][1] : 1;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="font-display text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {data.total} papers in {collectionId ? 'this collection' : 'your library'}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-3xl font-bold">{data.total}</div>
          <div className="text-xs text-slate-400">Papers</div>
        </div>
        <div className="card p-4">
          <div className="text-3xl font-bold">{data.avg_rigor ?? '—'}</div>
          <div className="text-xs text-slate-400">Avg rigor /100</div>
        </div>
        <div className="card p-4">
          <div className="text-3xl font-bold">{data.avg_reproducibility ?? '—'}</div>
          <div className="text-xs text-slate-400">Avg reproducibility /100</div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 font-semibold">Top Topics</h3>
          <div className="space-y-2">
            {data.top_topics.map(([k, v]) => (
              <BarRow key={k} label={k} value={v} max={maxTopic} />
            ))}
            {data.top_topics.length === 0 && <p className="text-xs text-slate-400">No keywords yet.</p>}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold">Reading Status</h3>
          <div className="space-y-2">
            {Object.entries(data.status_distribution).map(([k, v]) => (
              <BarRow key={k} label={k} value={v} max={Math.max(...Object.values(data.status_distribution))} color="bg-sky-500" />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold">Source</h3>
          <div className="space-y-2">
            {Object.entries(data.source_distribution).map(([k, v]) => (
              <BarRow key={k} label={k} value={v} max={Math.max(...Object.values(data.source_distribution))} color="bg-violet-500" />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold">Complexity</h3>
          <div className="space-y-2">
            {Object.entries(data.complexity_distribution).map(([k, v]) => (
              <BarRow key={k} label={k} value={v} max={Math.max(...Object.values(data.complexity_distribution))} color="bg-amber-500" />
            ))}
          </div>
        </div>

        <div className="card p-5 md:col-span-2">
          <h3 className="mb-3 font-semibold">Papers Added by Month</h3>
          <div className="space-y-2">
            {Object.entries(data.monthly_added).map(([k, v]) => (
              <BarRow key={k} label={k} value={v} max={Math.max(...Object.values(data.monthly_added))} color="bg-emerald-500" />
            ))}
            {Object.keys(data.monthly_added).length === 0 && <p className="text-xs text-slate-400">No data.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
