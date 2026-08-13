import { useEffect, useState } from 'react';
import { X, Languages } from 'lucide-react';
import apiClient from '../api/client';

const LANGS = [
  ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['zh', 'Chinese'],
  ['ja', 'Japanese'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['pt', 'Portuguese'],
];

export default function TranslateModal({ paperId, onClose }) {
  const [lang, setLang] = useState('es');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = (l) => {
    setBusy(true);
    setError(null);
    apiClient.post(`/papers/${paperId}/translate`, { target_language: l })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };

  useEffect(() => { run(lang); }, [paperId]); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Languages size={18} className="text-primary" />
            <h2 className="font-display text-lg font-bold">Translate Summary</h2>
          </div>
          <button className="btn-ghost p-1" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-700">
          <span className="text-sm text-slate-500">Language:</span>
          <select className="input w-40" value={lang} onChange={(e) => { setLang(e.target.value); run(e.target.value); }}>
            {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-auto p-5">
          {busy && <p className="text-sm text-slate-400">Translating…</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {data && (
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold">Executive Summary</h3>
                <p className="whitespace-pre-wrap leading-relaxed">{data.executive_summary}</p>
              </section>
              {data.key_findings && data.key_findings.length > 0 && (
                <section>
                  <h3 className="font-semibold">Key Findings</h3>
                  <ul className="list-disc pl-5">
                    {data.key_findings.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
