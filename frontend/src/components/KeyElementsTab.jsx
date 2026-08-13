import { useEffect, useState } from 'react';
import apiClient from '../api/client';

const FIELDS = [
  ['problem', 'Problem'],
  ['methodology', 'Methodology'],
  ['results', 'Results'],
  ['limitations', 'Limitations'],
  ['contributions', 'Contributions'],
  ['future_work', 'Future Work'],
];

export default function KeyElementsTab({ paperId }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    apiClient.get(`/papers/${paperId}/elements`)
      .then((data) => active && setState({ loading: false, data, error: null }))
      .catch((error) => active && setState({ loading: false, data: null, error }));
    return () => { active = false; };
  }, [paperId]);

  if (state.loading) return <div className="p-6 text-slate-400">Extracting key elements…</div>;
  if (state.error) return <div className="p-6 text-sm text-red-600">No extracted elements yet. Run analysis first.</div>;

  return (
    <div className="grid gap-4 p-6 sm:grid-cols-2">
      {FIELDS.map(([key, label]) => (
        <div key={key} className="card p-4">
          <h4 className="mb-1 text-sm font-semibold text-terracotta">{label}</h4>
          <p className="text-sm leading-relaxed">{state.data[key] || '—'}</p>
        </div>
      ))}
    </div>
  );
}
