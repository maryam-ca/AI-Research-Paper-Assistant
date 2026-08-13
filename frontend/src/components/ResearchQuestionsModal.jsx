import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';
import apiClient from '../api/client';

export default function ResearchQuestionsModal({ collectionId, name, onClose }) {
  const [items, setItems] = useState([]);
  const [question, setQuestion] = useState('');
  const [hypothesis, setHypothesis] = useState('');

  const refresh = () => apiClient.get(`/collections/${collectionId}/research-questions`).then(setItems).catch(() => {});
  useEffect(() => { refresh(); }, [collectionId]);

  const add = async () => {
    if (!question.trim()) return;
    await apiClient.post(`/collections/${collectionId}/research-questions`, {
      question_text: question.trim(), hypothesis: hypothesis.trim() || null,
    });
    setQuestion(''); setHypothesis('');
    refresh();
  };

  const setStatus = (id, status) => apiClient.patch(`/research-questions/${id}`, { status }).then(refresh).catch(() => {});
  const del = (id) => apiClient.del(`/research-questions/${id}`).then(refresh).catch(() => {});

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <h2 className="font-display text-lg font-bold">Research Questions</h2>
          <button className="btn-ghost p-1" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4 space-y-2">
            <input className="input" placeholder="Research question…" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <textarea className="input min-h-[60px]" placeholder="Hypothesis (optional)…" value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} />
            <button className="btn-primary" onClick={add}><Plus size={16} /> Add question</button>
          </div>
          <ul className="space-y-2">
            {items.map((q) => (
              <li key={q.id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{q.question_text}</p>
                    {q.hypothesis && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Hypothesis: {q.hypothesis}</p>}
                  </div>
                  <button className="btn-ghost p-1 text-red-500" onClick={() => del(q.id)}><Trash2 size={14} /></button>
                </div>
                <div className="mt-2 flex gap-1">
                  {['active', 'resolved', 'abandoned'].map((st) => (
                    <button
                      key={st}
                      className={`rounded-full px-2 py-0.5 text-[11px] ${q.status === st ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}
                      onClick={() => setStatus(q.id, st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </li>
            ))}
            {items.length === 0 && <li className="text-xs text-slate-400">No research questions yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
