import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { globalSearch } from "../api/client";

function getSavedSearches() {
  try { return JSON.parse(localStorage.getItem("scholarflow_saved_searches") || "[]"); } catch { return []; }
}

function saveSearch(query) {
  const searches = getSavedSearches();
  if (!searches.includes(query) && query.trim()) {
    searches.unshift(query);
    if (searches.length > 10) searches.pop();
    localStorage.setItem("scholarflow_saved_searches", JSON.stringify(searches));
  }
}

function removeSavedSearch(query) {
  const searches = getSavedSearches().filter(s => s !== query);
  localStorage.setItem("scholarflow_saved_searches", JSON.stringify(searches));
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedSearches, setSavedSearches] = useState(getSavedSearches);
  const navigate = useNavigate();

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const r = await globalSearch(q.trim());
      setResults(r);
    } catch { setResults(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const t = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const handleSaveSearch = () => {
    saveSearch(query);
    setSavedSearches(getSavedSearches());
  };

  const handleRemoveSaved = (q) => {
    removeSavedSearch(q);
    setSavedSearches(getSavedSearches());
  };

  const total = (results?.papers?.length || 0) + (results?.notes?.length || 0) + (results?.qa?.length || 0);

  return (
    <div className="max-w-[800px] mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-surface">Search</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Search across all papers, notes, and Q&A history</p>
      </div>

      <div className="mb-8 relative">
        <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline/60 rounded-2xl px-5 py-4 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
          <span className="material-symbols-outlined text-[24px] text-on-surface-variant">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search papers, notes, Q&A..."
            autoFocus
            className="flex-1 border-0 focus:ring-0 text-body-lg bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant/50"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>
        {query.trim() && results && total > 0 && (
          <button onClick={handleSaveSearch} className="mt-2 flex items-center gap-1.5 text-[12px] text-primary font-medium hover:underline">
            <span className="material-symbols-outlined text-[14px]">bookmark_add</span>Save this search
          </button>
        )}
      </div>

      {!query.trim() && savedSearches.length > 0 && (
        <div className="mb-8">
          <p className="text-[11px] font-semibold text-outline uppercase tracking-wider mb-3">Saved Searches</p>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((s) => (
              <div key={s} className="flex items-center gap-1.5 bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-1.5 group">
                <button onClick={() => setQuery(s)} className="text-body-sm text-on-surface hover:text-primary transition-colors">{s}</button>
                <button onClick={() => handleRemoveSaved(s)} className="text-on-surface-variant/40 hover:text-error transition-colors opacity-0 group-hover:opacity-100">
                  <span className="material-symbols-outlined text-[12px]">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 space-y-3">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!loading && results && total === 0 && (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-4 block">search_off</span>
          <p className="text-title-md text-on-surface mb-2">No results found</p>
          <p className="text-body-md text-on-surface-variant">Try different keywords</p>
        </div>
      )}

      {!loading && results && total > 0 && (
        <div className="space-y-6">
          <p className="text-body-sm text-on-surface-variant">{total} result{total !== 1 ? "s" : ""} found</p>

          {results.papers?.length > 0 && (
            <div>
              <p className="px-2 py-1.5 text-[10px] font-semibold text-outline uppercase tracking-wider mb-2">Papers ({results.papers.length})</p>
              <div className="space-y-2">
                {results.papers.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/paper/${p.id}`)}
                    className="w-full text-left bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 hover:shadow-md transition-all flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px] text-primary">description</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md text-on-surface font-medium truncate">{p.filename || "Untitled"}</p>
                      {p.executive_summary && <p className="text-body-sm text-on-surface-variant line-clamp-1 mt-0.5">{p.executive_summary}</p>}
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.notes?.length > 0 && (
            <div>
              <p className="px-2 py-1.5 text-[10px] font-semibold text-outline uppercase tracking-wider mb-2">Notes ({results.notes.length})</p>
              <div className="space-y-2">
                {results.notes.map((n) => (
                  <button key={n.id} onClick={() => navigate(`/paper/${n.paper_id}`)}
                    className="w-full text-left bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 hover:shadow-md transition-all flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px] text-secondary">edit_note</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md text-on-surface truncate">{n.text}</p>
                      <p className="text-body-sm text-on-surface-variant mt-0.5">{n.paper_name || "Paper"}</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.qa?.length > 0 && (
            <div>
              <p className="px-2 py-1.5 text-[10px] font-semibold text-outline uppercase tracking-wider mb-2">Q&A ({results.qa.length})</p>
              <div className="space-y-2">
                {results.qa.map((q) => (
                  <button key={q.id} onClick={() => navigate(`/paper/${q.paper_id}`)}
                    className="w-full text-left bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 hover:shadow-md transition-all flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px] text-tertiary">chat</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md text-on-surface truncate">{q.question}</p>
                      <p className="text-body-sm text-on-surface-variant mt-0.5">{q.paper_name || "Paper"}</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!results && !loading && (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-6xl text-outline-variant/30 mb-4 block">manage_search</span>
          <p className="text-title-md text-on-surface mb-2">Start typing to search</p>
          <p className="text-body-md text-on-surface-variant">Search across papers, notes, and Q&A history</p>
        </div>
      )}
    </div>
  );
}
