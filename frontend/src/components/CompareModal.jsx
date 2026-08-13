import { useEffect, useState } from 'react';
import { X, GitCompare } from 'lucide-react';
import apiClient from '../api/client';
import { useAppStore } from '../store/appStore';

export default function CompareModal() {
  const { setCompareOpen } = useAppStore();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const selection = useAppStore((s) => s.compareSelection);

  useEffect(() => {
    if (selection.length < 2) return;
    setBusy(true);
    apiClient.post('/papers/compare', { paper_ids: selection })
      .then((r) => { setResult(r); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [selection]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="card flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2"><GitCompare className="text-terracotta" /> <h2 className="font-display text-lg font-bold">Compare Papers</h2></div>
          <button className="btn-ghost p-1" onClick={() => setCompareOpen(false)}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {selection.length < 2 && <p className="text-sm text-slate-400">Select at least two papers from the library to compare.</p>}
          {busy && <p className="text-sm text-slate-400">Comparing…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-terracotta">Methodologies</h3>
                {Object.entries(result.methodologies || {}).map(([title, m]) => (
                  <div key={title} className="mb-2"><p className="text-sm font-semibold">{title}</p><p className="text-sm">{m}</p></div>
                ))}
              </section>
              <section>
                <h3 className="mb-2 text-terracotta">Findings</h3>
                {Object.entries(result.findings || {}).map(([title, arr]) => (
                  <div key={title} className="mb-2">
                    <p className="text-sm font-semibold">{title}</p>
                    <ul className="list-disc pl-5 text-sm">{arr.map((f, i) => <li key={i}>{f}</li>)}</ul>
                  </div>
                ))}
              </section>
              <section>
                <h3 className="mb-2 text-terracotta">Key Differences</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {(result.differences || []).map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
