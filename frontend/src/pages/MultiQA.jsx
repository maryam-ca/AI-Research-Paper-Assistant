import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listPapers, multiPaperQA } from "../api/client";

function Spinner({ size = 16, color = "currentColor" }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill={color} className="opacity-75" />
    </svg>
  );
}

function SourceBadge({ paper }) {
  const src = paper.metadata?.source || "";
  if (src.startsWith("arxiv:")) return <span className="bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 rounded-md border border-primary/30">arXiv</span>;
  if (src.startsWith("doi:")) return <span className="bg-tertiary/10 text-tertiary text-[11px] font-semibold px-2 py-0.5 rounded-md border border-tertiary/30">DOI</span>;
  return <span className="bg-surface-container text-on-surface-variant text-[11px] font-semibold px-2 py-0.5 rounded-md border border-outline-variant/40">DOC</span>;
}

export default function MultiQA() {
  const [papers, setPapers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [showPaperPicker, setShowPaperPicker] = useState(false);
  const chatEnd = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    listPapers().then(setPapers).catch(() => setPapers([])).finally(() => setLoading(false));
  }, []);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || asking || selectedIds.size === 0) return;
    const text = question.trim(); setQuestion("");
    setChat((p) => [...p, { role: "user", text }]); setAsking(true);
    try {
      const historyForApi = chat.map((m) => ({ role: m.role, text: m.text }));
      const r = await multiPaperQA([...selectedIds], text, historyForApi);
      const aiMsg = { role: "ai", text: r.answer, sources: r.sources, id: Date.now() };
      setChat((p) => [...p, aiMsg]);
    } catch (e) { setChat((p) => [...p, { role: "ai", text: `Error: ${e.message}`, error: true, id: Date.now() }]); }
    finally { setAsking(false); }
  }, [question, asking, chat, selectedIds]);

  const togglePaper = (id) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const selectAll = () => {
    setSelectedIds(new Set(papers.map((p) => p.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto px-8 py-10">
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} color="var(--color-primary)" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-surface">Ask Across Library</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Ask a question and get an answer synthesized from multiple papers in your library.</p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-title-lg text-on-surface">Select Papers</h2>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button onClick={clearSelection} className="text-primary text-body-sm font-medium hover:underline">Clear all</button>
            )}
            <button onClick={selectAll} className="text-primary text-body-sm font-medium hover:underline">Select all ({papers.length})</button>
            <button onClick={() => setShowPaperPicker(!showPaperPicker)} className="bg-primary text-on-primary px-4 py-2 rounded-lg text-body-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">{showPaperPicker ? "expand_less" : "expand_more"}</span>
              {showPaperPicker ? "Hide" : "Show"} papers
            </button>
          </div>
        </div>

        {showPaperPicker && (
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {papers.map((p) => (
              <label key={p.id} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-outline-variant/40 hover:bg-surface-container-low transition-colors cursor-pointer">
                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => togglePaper(p.id)} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
                <SourceBadge paper={p} />
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface truncate">{p.filename || "Untitled"}</p>
                  {p.metadata?.authors?.length > 0 && (
                    <p className="text-body-sm text-on-surface-variant truncate">{p.metadata.authors.slice(0, 2).join(", ")}</p>
                  )}
                </div>
              </label>
            ))}
            {papers.length === 0 && (
              <p className="text-body-md text-on-surface-variant text-center py-8">No papers in library yet.</p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">check_circle</span>
          <span className="text-body-md text-on-surface">
            {selectedIds.size} paper{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 mb-8">
        <h2 className="text-title-lg text-on-surface mb-4">Conversation</h2>
        <div className="space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar">
          {chat.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6 gap-3">
              <div className="w-14 h-14 bg-primary/8 rounded-2xl flex items-center justify-center"><span className="material-symbols-outlined text-3xl text-primary/40">auto_awesome</span></div>
              <p className="text-body-md text-on-surface-variant leading-relaxed max-w-md">Select papers above, then ask a question. The AI will search across all selected papers and provide a synthesized answer with citations.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["What are the common themes across these papers?", "Compare the methodologies used", "What are the key limitations mentioned?"].map((suggestion, i) => (
                  <button key={i} onClick={() => setQuestion(suggestion)} className="text-[12px] text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors border border-primary/10">{suggestion}</button>
                ))}
              </div>
            </div>
          )}
          {chat.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              {msg.role === "ai" && (
                <div className="flex items-start gap-2.5 max-w-[88%]">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 shrink-0 flex items-center justify-center mt-0.5"><span className="material-symbols-outlined text-primary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span></div>
                  <div className={`border rounded-2xl rounded-tl-md p-4 ${msg.error ? "border-error/20 bg-error/5 text-error" : "border-outline-variant/60 bg-surface-container-lowest"}`}>
                    <p className="text-body-md text-on-surface whitespace-pre-line leading-relaxed">{msg.text}</p>
                    {msg.sources?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {msg.sources.map((s, si) => (
                          <Link key={si} to={`/paper/${s.paper_id}`} className="inline-flex items-center px-2.5 py-1 rounded-md bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-bold hover:opacity-80">
                            {s.paper_name} p.{s.page}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {msg.role === "user" && <div className="bg-primary text-on-primary px-4 py-3 rounded-2xl rounded-tr-md max-w-[80%]"><p className="text-body-md">{msg.text}</p></div>}
              <span className="text-[10px] text-outline mt-1 ml-9 uppercase font-semibold tracking-wider">{msg.role === "user" ? "You" : "AI"}</span>
            </div>
          ))}
          {asking && <div className="flex items-start gap-2.5"><div className="w-7 h-7 rounded-lg bg-primary/10 shrink-0 flex items-center justify-center mt-0.5"><span className="material-symbols-outlined text-primary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span></div><div className="border border-outline-variant/60 bg-surface-container-lowest p-4 rounded-2xl rounded-tl-md flex items-center gap-2.5"><div className="flex gap-1"><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0s" }} /><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} /><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} /></div><span className="text-body-md text-on-surface-variant">Searching across papers...</span></div></div>}
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
        <div className="flex items-end gap-2 bg-surface-container-lowest border border-outline/60 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
          <textarea className="flex-1 border-0 focus:ring-0 text-body-md py-2 px-2.5 resize-none bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant/40"
            onInput={(e) => { e.target.style.height = ""; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            placeholder={selectedIds.size === 0 ? "Select at least one paper first..." : "Ask a question across selected papers..."} rows="1" value={question} onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }} disabled={asking || selectedIds.size === 0} />
          <button onClick={handleAsk} disabled={asking || !question.trim() || selectedIds.size === 0}
            className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 mb-0.5 mr-0.5 transition-all hover:opacity-90 active:scale-90 disabled:opacity-30">
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}