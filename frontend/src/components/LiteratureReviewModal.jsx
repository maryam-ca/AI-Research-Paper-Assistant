import { useEffect, useState } from 'react';
import { X, Download, FileText } from 'lucide-react';
import apiClient from '../api/client';

export default function LiteratureReviewModal({ collectionId, name, onClose }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [tone, setTone] = useState('academic');
  const [length, setLength] = useState('standard');

  const run = (t, l) => {
    setBusy(true);
    apiClient.post(`/collections/${collectionId}/generate-literature-review`, { tone: t, length: l })
      .then(setData)
      .catch((e) => setData({ error: e.message }))
      .finally(() => setBusy(false));
  };

  useEffect(() => { run(tone, length); }, [collectionId]); // eslint-disable-line

  const download = () => {
    if (!data?.markdown) return;
    const blob = new Blob([`# Literature Review: ${name}\n\n${data.markdown}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_literature_review.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <div>
            <h2 className="font-display text-lg font-bold">Literature Review</h2>
            <p className="text-xs text-slate-400">{name} · {data?.paper_count || 0} papers</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="input w-28" value={tone} onChange={(e) => { setTone(e.target.value); run(e.target.value, length); }}>
              <option value="academic">Academic</option>
              <option value="casual">Casual</option>
              <option value="critical">Critical</option>
            </select>
            <select className="input w-28" value={length} onChange={(e) => { setLength(e.target.value); run(tone, e.target.value); }}>
              <option value="brief">Brief</option>
              <option value="standard">Standard</option>
              <option value="extensive">Extensive</option>
            </select>
            <button className="btn-ghost p-1" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {busy && <p className="text-sm text-slate-400">Generating review…</p>}
          {data?.error && <p className="text-sm text-red-500">{data.error}</p>}
          {data?.sections && (
            <div className="prose-sm max-w-none space-y-4 text-sm dark:text-slate-200">
              {Object.entries(data.sections).map(([k, v]) => v && (
                <section key={k}>
                  <h3 className="font-display font-semibold capitalize">{k.replace('_', ' ')}</h3>
                  <div className="whitespace-pre-wrap leading-relaxed">{v}</div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
          <button className="btn-primary" onClick={download} disabled={!data?.markdown}><Download size={16} /> Download Markdown</button>
        </div>
      </div>
    </div>
  );
}
