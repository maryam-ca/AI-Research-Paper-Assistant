import { useEffect, useRef, useState } from 'react';
import { Send, X, FileText, Sparkles } from 'lucide-react';
import apiClient from '../api/client';

export default function QAPanel({ paperId, open, onClose }) {
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sugLoading, setSugLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    apiClient.get(`/papers/${paperId}/questions`).then(setHistory).catch(() => {});
    loadSuggestions();
  }, [open, paperId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history, busy]);

  const loadSuggestions = async () => {
    setSugLoading(true);
    try {
      const lastQ = history.length ? history[history.length - 1].question : null;
      const res = await apiClient.post(`/papers/${paperId}/suggest-questions`,
        lastQ ? { previous_question: lastQ } : {});
      setSuggestions(res.suggestions || []);
    } catch (_) {
      setSuggestions([]);
    } finally {
      setSugLoading(false);
    }
  };

  const ask = async () => {
    if (!question.trim() || busy) return;
    const q = question.trim();
    setQuestion('');
    setBusy(true);
    setSuggestions([]);
    setHistory((h) => [...h, { question: q, answer: null, cited_pages: [] }]);
    try {
      const res = await apiClient.post(`/papers/${paperId}/question`, { question: q });
      setHistory((h) => [...h, { question: q, answer: res.answer, cited_pages: res.cited_pages || [] }]);
      loadSuggestions();
    } catch (e) {
      setHistory((h) => [...h, { question: q, answer: `Error: ${e.message}`, cited_pages: [] }]);
      setBusy(false);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute right-0 top-0 z-30 flex h-full w-full max-w-md flex-col border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-3">
        <span className="font-display font-semibold">Ask about this paper</span>
        <button className="btn-ghost p-1" onClick={onClose}><X size={18} /></button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto p-4">
        {history.length === 0 && <p className="text-sm text-slate-400">Ask a question to get grounded answers with page citations.</p>}
        {history.map((item, i) => (
          <div key={i} className="space-y-2">
            <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-terracotta px-3 py-2 text-sm text-white">{item.question}</div>
            <div className="w-fit max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-700">
              {item.answer ?? <span className="text-slate-400">Thinking…</span>}
              {item.cited_pages && item.cited_pages.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.cited_pages.map((p, j) => (
                    <span key={j} className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] dark:bg-slate-600">
                      <FileText size={11} /> p.{p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 p-3">
        {suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 hover:border-primary hover:text-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                onClick={() => { setQuestion(s); ask(); }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Ask a question…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
          />
          <button className="btn-ghost px-2" title="Suggest follow-up questions" onClick={loadSuggestions} disabled={sugLoading}>
            <Sparkles size={16} className={sugLoading ? 'animate-pulse text-primary' : 'text-slate-400'} />
          </button>
          <button className="btn-primary" onClick={ask} disabled={busy}><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
