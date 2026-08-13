import { useEffect, useState } from 'react';
import apiClient from '../api/client';

export default function SummaryTab({ paperId }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    setState({ loading: true, data: null, error: null });
    apiClient.get(`/papers/${paperId}/summary`)
      .then((data) => active && setState({ loading: false, data, error: null }))
      .catch((error) => active && setState({ loading: false, data: null, error }));
    return () => { active = false; };
  }, [paperId]);

  if (state.loading) return <div className="p-6 text-slate-400">Generating summary…</div>;
  if (state.error) return (
    <div className="p-6 text-sm text-red-600">
      No summary yet. <button className="btn-ghost underline" onClick={() => window.location.reload()}>Run analysis</button> first.
    </div>
  );

  const { executive_summary, detailed_summary, key_findings } = state.data;
  return (
    <div className="space-y-6 p-6">
      <section>
        <h3 className="mb-2 text-terracotta">Executive Summary</h3>
        <p className="leading-relaxed">{executive_summary}</p>
      </section>
      <section>
        <h3 className="mb-2 text-terracotta">Detailed Summary</h3>
        <div className="whitespace-pre-line leading-relaxed">{detailed_summary}</div>
      </section>
      {key_findings && key_findings.length > 0 && (
        <section>
          <h3 className="mb-2 text-terracotta">Key Findings</h3>
          <ul className="list-disc space-y-1 pl-5">
            {key_findings.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
