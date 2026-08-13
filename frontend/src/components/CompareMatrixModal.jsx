import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import apiClient from '../api/client';

const FIELDS = [
  ['approach', 'Approach'],
  ['sample_size', 'Sample Size'],
  ['duration', 'Duration'],
  ['data_source', 'Data Source'],
  ['control_group', 'Control Group'],
  ['outcome_measures', 'Outcome Measures'],
];

export default function CompareMatrixModal({ paperIds, onClose }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient.post('/papers/compare-matrix', { paper_ids: paperIds })
      .then((r) => setRows(r.rows || []))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [paperIds]);

  const download = () => {
    if (!rows.length) return;
    const esc = (val) => `"${String(val == null ? '' : val).replace(/"/g, '""')}"`;
    const header = ['Paper', ...FIELDS.map((f) => f[1])];
    const body = rows.map((r) => [r.title, ...FIELDS.map((f) => String(r[f[0]] || '').replace(/\n/g, ' '))]);
    const csv = [header, ...body].map((row) => row.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'methodology_comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <h2 className="font-display text-lg font-bold">Methodology Comparison Matrix</h2>
          <div className="flex items-center gap-2">
            <button className="btn-primary" onClick={download} disabled={!rows.length}><Download size={16} /> CSV</button>
            <button className="btn-ghost p-1" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {busy && <p className="text-sm text-slate-400">Building matrix…</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {rows.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-slate-700">
                  <th className="p-2 font-semibold">Paper</th>
                  {FIELDS.map(([, label]) => (
                    <th key={label} className="p-2 font-semibold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.paper_id} className="border-b border-slate-100 align-top dark:border-slate-700">
                    <td className="p-2 font-medium">{r.title}</td>
                    {FIELDS.map(([k]) => (
                      <td key={k} className="p-2 text-slate-600 dark:text-slate-300">{r[k] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
