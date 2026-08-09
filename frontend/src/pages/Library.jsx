import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listPapers, uploadPaper, fetchByIdOrDoi, fetchFromUrl, comparePapers, searchPapers, globalSearch, listCollections, addToCollection, getStats, bulkDelete, bulkAddToCollection, bulkExportBibtex, exportPaperMarkdown, getRelatedPapers, regenerateSummary, computeReadability, updatePaperStatus, suggestTags, methodologyCompare, getReadingReminders, toggleFavorite, listFavorites, bulkUpdateTags, checkDuplicate, generatePrintableCitations, suggestTagsForUpload, updatePaperTags } from "../api/client";

function UndoToast({ message, onUndo, onDismiss }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xl px-5 py-3 flex items-center gap-4">
        <span className="text-body-sm text-on-surface">{message}</span>
        <button onClick={onUndo} className="text-primary text-body-sm font-semibold hover:underline">Undo</button>
        <button onClick={onDismiss} className="text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
}

function Spinner({ size = 20, color = "currentColor" }) {
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
  return <span className="bg-surface-container text-on-surface-variant text-[11px] font-semibold px-2 py-0.5 rounded-md border border-outline-variant/40">PDF</span>;
}

const THUMBNAIL_GRADIENTS = [
  "from-primary/15 to-tertiary/15", "from-secondary/15 to-primary/10",
  "from-amber-500/15 to-orange-500/15", "from-rose-500/10 to-primary/10",
  "from-teal-500/10 to-secondary/15", "from-primary/10 to-amber-500/10",
];
const THUMBNAIL_ICONS = ["description", "science", "psychology", "biotech", "hub", "menu_book"];

function PaperThumbnail({ title, source }) {
  const hash = (title || "").split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const grad = THUMBNAIL_GRADIENTS[Math.abs(hash) % THUMBNAIL_GRADIENTS.length];
  const icon = THUMBNAIL_ICONS[Math.abs(hash) % THUMBNAIL_ICONS.length];
  return (
    <div className={`w-full h-24 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center`}>
      <span className="material-symbols-outlined text-on-surface-variant/40 text-[28px]">{icon}</span>
    </div>
  );
}

const SECTION_LABELS = { executive: "Summary", detailed: "Detail", findings: "Findings", elements: "Elements" };

function PaperCard({ paper, selected, onToggle, onAddToCollection, collections, onRegenerate, onShare, onViewRelated, onExport, onDelete, onFavorite, onStatusChange, viewMode }) {
  const hasSummary = paper.executive_summary || paper.detailed_summary;
  const summaryPreview = (paper.executive_summary || paper.detailed_summary || "").slice(0, 140);
  const authorCount = paper.metadata?.authors?.length || 0;
  const tags = paper.metadata?.tags || [];
  const subjects = paper.metadata?.subjects || [];
  const displayTags = tags.length > 0 ? tags : subjects;
  const [showColMenu, setShowColMenu] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const kebabRef = useRef(null);
  const progress = paper.reading_progress || {};
  const sectionsRead = ["executive", "detailed", "findings", "elements"].filter((s) => progress[s]).length;
  const readability = paper.metadata?.readability;
  const isFavorite = paper.metadata?.is_favorite;
  const status = paper.metadata?.status;

  const getDifficultyColor = (label) => {
    switch (label) {
      case "Very Easy":
      case "Easy":
        return "bg-tertiary/10 text-tertiary border-tertiary/30";
      case "Fairly Easy":
      case "Standard":
        return "bg-primary/10 text-primary border-primary/20";
      case "Fairly Difficult":
      case "Difficult":
        return "bg-secondary/10 text-secondary border-secondary/30";
      case "Very Difficult":
        return "bg-error/10 text-error border-error/20";
      default:
        return "bg-surface-container text-on-surface-variant border-outline-variant/30";
    }
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (kebabRef.current && !kebabRef.current.contains(e.target)) {
        setShowKebab(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div
      className={`bg-surface-container-lowest border rounded-2xl p-6 transition-all duration-200 group cursor-pointer relative hover:shadow-md flex ${viewMode === "grid" ? "flex-col" : "flex-row items-center gap-5"}`}
      style={{ borderColor: selected ? "rgba(53,37,205,0.3)" : "" }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.classList.add("card-ring"); }}
      onMouseLeave={(e) => { e.currentTarget.classList.remove("card-ring"); setShowColMenu(false); }}
    >
      {viewMode === "grid" && <PaperThumbnail title={paper.filename} source={paper.metadata?.source} />}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SourceBadge paper={paper} />
          {hasSummary && <span className="bg-tertiary/10 text-tertiary text-[10px] font-semibold px-2 py-0.5 rounded-md border border-tertiary/30">Analyzed</span>}
          {sectionsRead > 0 && <span className="bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-md">{sectionsRead}/4 read</span>}
          {status && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${status === "read" ? "bg-tertiary/10 text-tertiary border-tertiary/30" : status === "reading" ? "bg-primary/10 text-primary border-primary/30" : status === "to_read" ? "bg-secondary/10 text-secondary border-secondary/30" : "bg-surface-container text-on-surface-variant border-outline-variant/30"}`}>{status === "to_read" ? "To Read" : status === "reading" ? "Reading" : status === "read" ? "Read" : "Archived"}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onFavorite(paper.id); }}
            className={`transition-colors ${isFavorite ? "text-secondary" : "text-on-surface-variant/40 hover:text-secondary"}`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}>
            <span className="material-symbols-outlined text-[16px]" style={isFavorite ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>
          </button>
          <span className="text-body-sm text-on-surface-variant">
            {paper.metadata?.published_date ? new Date(paper.metadata.published_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : paper.created_at ? new Date(paper.created_at * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""}
          </span>
        </div>
      </div>
      <Link to={`/paper/${paper.id}`} className="block no-underline flex-1">
        <h4 className="text-title-md text-on-surface group-hover:text-primary transition-colors line-clamp-2 mb-2 leading-snug">{paper.filename || "Untitled"}</h4>
        {authorCount > 0 && <p className="text-body-sm text-on-surface-variant mb-2 line-clamp-1"><span className="material-symbols-outlined text-[14px] align-[-3px] mr-1">person</span>{paper.metadata.authors.slice(0, 2).join(", ")}{authorCount > 2 && <span className="text-on-surface-variant/60"> +{authorCount - 2} more</span>}</p>}
        {summaryPreview && <p className="text-body-sm text-on-surface-variant/70 mb-4 line-clamp-2 leading-relaxed">{summaryPreview}{summaryPreview.length >= 140 ? "..." : ""}</p>}
        {!summaryPreview && <div className="mb-4 flex items-center gap-1.5 text-on-surface-variant/40"><span className="material-symbols-outlined text-[14px]">description</span><span className="text-body-sm">No summary available</span></div>}
      </Link>
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-outline-variant/30">
        <div className="flex flex-wrap gap-1.5">
          {displayTags.slice(0, 3).map((tag, i) => (<span key={i} className="bg-surface-container text-on-surface-variant text-[11px] px-2.5 py-1 rounded-lg border border-outline-variant/30">{tag}</span>))}
          {readability && readability.difficulty_label && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getDifficultyColor(readability.difficulty_label)} flex items-center gap-1`}>
              <span className="material-symbols-outlined text-[12px]">menu_book</span>
              {readability.difficulty_label}
              {readability.flesch_kincaid_grade !== null && <span>(Gr {readability.flesch_kincaid_grade})</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 relative">
          <button onClick={(e) => { e.stopPropagation(); setShowColMenu(!showColMenu); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-primary" title="Add to Collection">
            <span className="material-symbols-outlined text-[16px]">playlist_add</span>
          </button>
          {showColMenu && collections.length > 0 && (
            <div className="absolute bottom-full right-0 mb-1 w-52 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xl z-50 py-1 max-h-48 overflow-y-auto">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-outline uppercase tracking-wider">Add to collection</p>
              {collections.map((c) => (<button key={c.id} onClick={(e) => { e.stopPropagation(); onAddToCollection(c.id, paper.id); setShowColMenu(false); }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-primary">folder</span>{c.name}</button>))}
            </div>
          )}
          <div className="relative" ref={kebabRef}>
            <button onClick={(e) => { e.stopPropagation(); setShowKebab(!showKebab); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-primary" title="More options">
              <span className="material-symbols-outlined text-[20px]">more_vert</span>
            </button>
            {showKebab && (
              <div className="absolute bottom-full right-0 mb-1 w-56 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                <button onClick={() => { onRegenerate(paper.id); setShowKebab(false); }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">refresh</span>Regenerate Summary
                </button>
                <button onClick={() => { onShare(paper.id); setShowKebab(false); }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">share</span>Share Digest
                </button>
                <button onClick={() => { onViewRelated(paper.id); setShowKebab(false); }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">hub</span>View Related Papers
                </button>
                <button onClick={() => { onExport(paper.id); setShowKebab(false); }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">download</span>Export (Markdown)
                </button>
                <button onClick={() => { onAddToCollection(null, paper.id); setShowKebab(false); }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">playlist_add</span>Add to Collection
                </button>
                {!readability && (
                  <button onClick={async () => { setShowKebab(false); try { await computeReadability(paper.id); alert("Readability computed!"); } catch (e) { alert(e.message); } }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">menu_book</span>Compute Readability
                  </button>
                )}
                {paper.executive_summary && (
                  <button onClick={async () => { setShowKebab(false); try { const r = await suggestTags(paper.id); alert("Suggested tags: " + r.suggested_tags.join(", ")); } catch (e) { alert(e.message); } }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">label</span>Suggest Tags
                  </button>
                )}
                <hr className="my-1 border-outline-variant/30" />
                <button onClick={() => { onDelete(paper.id); setShowKebab(false); }} className="w-full text-left px-3 py-2 text-body-sm text-error hover:bg-error/5 transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">delete</span>Delete
                </button>
              </div>
            )}
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
          </label>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-4"><div className="flex justify-between"><div className="skeleton h-4 w-12" /><div className="skeleton h-4 w-16" /></div><div className="skeleton h-5 w-3/4" /><div className="skeleton h-3 w-1/2" /><div className="skeleton h-3 w-full" /><div className="flex gap-2"><div className="skeleton h-5 w-16" /><div className="skeleton h-5 w-16" /></div></div>;
}

function StatsBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="flex gap-4 mb-8 flex-wrap">
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl px-5 py-3 flex items-center gap-2.5"><span className="material-symbols-outlined text-[18px] text-primary">description</span><div><p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">{stats.total_papers}</p><p className="text-body-sm text-on-surface font-medium">Papers</p></div></div>
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl px-5 py-3 flex items-center gap-2.5"><span className="material-symbols-outlined text-[18px] text-primary">folder</span><div><p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">{stats.total_collections}</p><p className="text-body-sm text-on-surface font-medium">Collections</p></div></div>
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl px-5 py-3 flex items-center gap-2.5"><span className="material-symbols-outlined text-[18px] text-primary">schedule</span><div><p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">{stats.papers_this_week}</p><p className="text-body-sm text-on-surface font-medium">This Week</p></div></div>
      {stats.top_tags?.slice(0, 3).map((t) => (<div key={t.tag} className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl px-4 py-3 flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-outline">label</span><span className="text-body-sm text-on-surface">{t.tag}</span><span className="text-[10px] text-on-surface-variant font-medium">({t.count})</span></div>))}
    </div>
  );
}

function Onboarding({ onUpload, onFetchUrl }) {
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const nav = useNavigate();

  const handleFetchUrl = async () => {
    if (!url.trim()) return;
    setFetching(true);
    try { const r = await fetchFromUrl(url.trim()); nav(`/paper/${r.paper_id}`); }
    catch (e) { alert(e.message); }
    finally { setFetching(false); setUrl(""); setShowUrl(false); }
  };

  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 px-8">
      <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-5xl text-primary">school</span>
      </div>
      <h2 className="text-headline-lg text-on-surface mb-2 text-center">Welcome to ScholarFlow</h2>
      <p className="text-body-md text-on-surface-variant mb-10 text-center max-w-md">Your AI-powered research paper assistant. Get started in 3 simple steps:</p>
      <div className="grid sm:grid-cols-3 gap-6 mb-10 max-w-2xl w-full">
        {[
          { icon: "upload_file", title: "Upload or Fetch", desc: "Upload a PDF, DOCX, TXT, or paste a URL" },
          { icon: "auto_awesome", title: "AI Summary", desc: "Get instant executive & detailed summaries" },
          { icon: "chat", title: "Ask Questions", desc: "Chat with your paper, get cited answers" },
        ].map((step, i) => (
          <div key={i} className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3"><span className="material-symbols-outlined text-primary text-2xl">{step.icon}</span></div>
            <p className="text-[11px] text-primary font-semibold uppercase tracking-wider mb-1">Step {i + 1}</p>
            <h3 className="text-title-md text-on-surface mb-1">{step.title}</h3>
            <p className="text-body-sm text-on-surface-variant">{step.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        <label className="bg-primary text-on-primary font-semibold py-3 px-6 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] flex items-center gap-2">
          <input type="file" accept=".pdf,.txt,.md,.docx,.doc,.rtf,.tex,.html,.htm" onChange={onUpload} className="hidden" />
          <span className="material-symbols-outlined text-[18px]">upload_file</span>Upload a File
        </label>
        <button onClick={() => setShowUrl(!showUrl)} className="border border-outline-variant text-on-surface font-semibold py-3 px-6 rounded-xl hover:bg-surface-container-low transition-all flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">link</span>Paste URL
        </button>
      </div>
      {showUrl && (
        <div className="mt-4 flex gap-2 w-full max-w-md">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/paper.pdf"
            className="flex-1 border border-outline/60 rounded-xl px-4 py-2.5 text-body-md bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-on-surface-variant/50" />
          <button onClick={handleFetchUrl} disabled={fetching || !url.trim()}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-medium hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
            {fetching ? <Spinner size={16} color="currentColor" /> : "Fetch"}
          </button>
        </div>
      )}
    </div>
  );
}

function DiffHighlights({ similarities, differences }) {
  if (!similarities?.length && !differences?.length) return null;
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {similarities?.length > 0 && (
        <div className="bg-tertiary/5 border border-tertiary/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-tertiary text-[20px]">check_circle</span>
            <h3 className="text-title-md font-semibold text-on-surface">Similarities</h3>
          </div>
          <ul className="space-y-2">
            {similarities.map((s, i) => (
              <li key={i} className="flex gap-2 text-body-sm text-on-surface">
                <span className="text-tertiary shrink-0 mt-0.5">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {differences?.length > 0 && (
        <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary text-[20px]">compare</span>
            <h3 className="text-title-md font-semibold text-on-surface">Key Differences</h3>
          </div>
          <div className="space-y-3">
            {differences.map((d, i) => (
              <div key={i} className="bg-surface-container-lowest/80 rounded-xl p-4 border border-secondary/20">
                <p className="text-[11px] font-semibold text-secondary uppercase tracking-wider mb-2">{d.aspect}</p>
                <div className="space-y-1.5">
                  {Object.entries(d.papers || {}).map(([pid, val]) => (
                    <div key={pid} className="flex items-start gap-2 text-[12px]">
                      <span className="bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded text-[10px] shrink-0">{pid.slice(0, 8)}</span>
                      <span className="text-on-surface-variant">{val}</span>
                    </div>
                  ))}
                </div>
                {d.significance && <p className="text-[11px] text-on-surface-variant/70 mt-2 italic">{d.significance}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchDropdown({ results, onClose, navigate }) {
  if (!results) return null;
  const hasResults = (results.papers?.length || 0) + (results.notes?.length || 0) + (results.qa?.length || 0) > 0;
  if (!hasResults) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto custom-scrollbar">
      {results.papers?.length > 0 && (
        <div>
          <p className="px-4 py-2 text-[10px] font-semibold text-outline uppercase tracking-wider border-b border-outline-variant/30">Papers</p>
          {results.papers.slice(0, 5).map((p) => (
            <button key={p.id} onClick={() => { navigate(`/paper/${p.id}`); onClose(); }}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors flex items-center gap-3">
              <span className="material-symbols-outlined text-[14px] text-primary">description</span>
              <span className="text-body-sm text-on-surface truncate">{p.filename || "Untitled"}</span>
            </button>
          ))}
        </div>
      )}
      {results.notes?.length > 0 && (
        <div>
          <p className="px-4 py-2 text-[10px] font-semibold text-outline uppercase tracking-wider border-b border-outline-variant/30">Notes</p>
          {results.notes.slice(0, 5).map((n) => (
            <button key={n.id} onClick={() => { navigate(`/paper/${n.paper_id}`); onClose(); }}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors flex items-center gap-3">
              <span className="material-symbols-outlined text-[14px] text-secondary">edit_note</span>
              <div className="min-w-0">
                <p className="text-[12px] text-on-surface truncate">{n.text}</p>
                <p className="text-[10px] text-on-surface-variant/60">{n.paper_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {results.qa?.length > 0 && (
        <div>
          <p className="px-4 py-2 text-[10px] font-semibold text-outline uppercase tracking-wider border-b border-outline-variant/30">Q&A</p>
          {results.qa.slice(0, 5).map((q) => (
            <button key={q.id} onClick={() => { navigate(`/paper/${q.paper_id}`); onClose(); }}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors flex items-center gap-3">
              <span className="material-symbols-outlined text-[14px] text-tertiary">chat</span>
              <div className="min-w-0">
                <p className="text-[12px] text-on-surface truncate">{q.question}</p>
                <p className="text-[10px] text-on-surface-variant/60">{q.paper_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Library() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [collections, setCollections] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterTag, setFilterTag] = useState(null);
  const [showBulkCol, setShowBulkCol] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("scholarflow-view-mode") || "list");
  const [showPinned, setShowPinned] = useState(true);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState("");
  const [globalResults, setGlobalResults] = useState(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [readingReminders, setReadingReminders] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterSource, setFilterSource] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showBulkTagEditor, setShowBulkTagEditor] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showReminders, setShowReminders] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    listPapers().then(setPapers).catch(() => setPapers([])).finally(() => setLoading(false));
    listCollections().then(setCollections).catch(() => {});
    getStats().then(setStats).catch(() => {});
    getReadingReminders().then(setReadingReminders).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!searchText.trim()) { setGlobalResults(null); setShowSearchDropdown(false); load(); return; }
    const t = setTimeout(() => {
      globalSearch(searchText.trim()).then((r) => { setGlobalResults(r); setShowSearchDropdown(true); }).catch(() => {});
      searchPapers(searchText.trim()).then(setPapers).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchText, load]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "/") { e.preventDefault(); document.querySelector('[data-search]')?.focus(); }
      if (e.key === "u" || e.key === "U") { e.preventDefault(); document.querySelector('[data-upload]')?.click(); }
      if (e.key === "Escape") { setSelected(new Set()); setShowBulkCol(false); setShowUrl(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setBusyLabel("Uploading file...");
    const progressSteps = [
      { delay: 3000, label: "Extracting text from document..." },
      { delay: 8000, label: "Generating embeddings..." },
      { delay: 15000, label: "AI summarizing content..." },
      { delay: 25000, label: "Extracting key elements..." },
      { delay: 35000, label: "Verifying source attribution..." },
    ];
    const timers = progressSteps.map((step) =>
      setTimeout(() => setBusyLabel(step.label), step.delay)
    );
    try {
      const r = await uploadPaper(file);
      timers.forEach(clearTimeout);
      navigate(`/paper/${r.paper_id}`);
      setTimeout(async () => {
        try {
          const { suggested_tags } = await suggestTagsForUpload(r.paper_id);
          if (suggested_tags?.length > 0) {
            const addTags = confirm(`Suggested tags: ${suggested_tags.join(", ")}\n\nAdd these tags to the paper?`);
            if (addTags) {
              const current = r.metadata?.tags || [];
              await updatePaperTags(r.paper_id, [...current, ...suggested_tags]);
            }
          }
        } catch {}
      }, 2000);
    }
    catch (err) { alert(err.message); }
    finally { timers.forEach(clearTimeout); setBusy(false); setBusyLabel(""); e.target.value = ""; }
  };

  const handleFetch = async () => {
    if (!query.trim()) return;
    setBusy(true); setBusyLabel("Fetching from arXiv / DOI...");
    try { const isDoi = query.startsWith("10.") || query.includes("/"); const r = await fetchByIdOrDoi(isDoi ? { doi: query } : { arxivId: query }); navigate(`/paper/${r.paper_id}`); }
    catch (err) { alert(err.message); }
    finally { setBusy(false); setBusyLabel(""); }
  };

  const handleFetchUrl = async () => {
    if (!url.trim()) return;
    setBusy(true); setBusyLabel("Fetching from URL...");
    try { const r = await fetchFromUrl(url.trim()); navigate(`/paper/${r.paper_id}`); }
    catch (err) { alert(err.message); }
    finally { setBusy(false); setBusyLabel(""); setUrl(""); setShowUrl(false); }
  };

  const toggle = (id) => { setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const doCompare = async () => {
    if (selected.size < 2) return;
    setComparing(true); setCompareMode(true); setCompareResult(null);
    try { setCompareResult(await comparePapers([...selected])); }
    catch (err) { setCompareResult({ error: err.message }); }
    finally { setComparing(false); }
  };
  const doMethodologyCompare = async () => {
    if (selected.size < 2) return;
    setComparing(true); setCompareMode(true); setCompareResult(null);
    try { setCompareResult(await methodologyCompare([...selected])); }
    catch (err) { setCompareResult({ error: err.message }); }
    finally { setComparing(false); }
  };
  const handleAddToCollection = async (colId, paperId) => { try { await addToCollection(colId, paperId); } catch (e) { alert(e.message); } };

  const handleBulkAddCollection = async (colId) => {
    try { await bulkAddToCollection([...selected], colId); setShowBulkCol(false); setSelected(new Set()); }
    catch (e) { alert(e.message); }
  };

  const handleBulkExport = async () => {
    try { await bulkExportBibtex([...selected]); }
    catch (e) { alert(e.message); }
  };

  const handleRegenerate = (paperId) => navigate(`/paper/${paperId}?action=regenerate`);
  const handleShare = (paperId) => navigator.clipboard.writeText(`${window.location.origin}/share/${paperId}`).then(() => alert("Share link copied!"));
  const handleViewRelated = (paperId) => navigate(`/paper/${paperId}?tab=related`);
  const handleExport = async (paperId) => {
    try { await exportPaperMarkdown(paperId); }
    catch (e) { alert(e.message); }
  };
  
  const [undoToast, setUndoToast] = useState(null);
  const undoTimerRef = useRef(null);
  
  const handleDelete = async (paperId) => {
    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;
    setUndoToast({ paperId, paperName: paper.filename || "Untitled", action: "delete" });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(async () => {
      try { await bulkDelete([paperId]); load(); setUndoToast(null); }
      catch (e) { alert(e.message); setUndoToast(null); }
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
  };

  const handleBulkDeleteWithUndo = async () => {
    if (!confirm(`Delete ${selected.size} paper(s)?`)) return;
    const ids = [...selected];
    setUndoToast({ paperId: ids.join(","), paperName: `${ids.length} papers`, action: "bulk_delete", count: ids.length });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(async () => {
      try { await bulkDelete(ids); setSelected(new Set()); load(); setUndoToast(null); }
      catch (e) { alert(e.message); setUndoToast(null); }
    }, 5000);
  };

  const handleFavorite = async (paperId) => {
    try { await toggleFavorite(paperId); load(); }
    catch (e) { alert(e.message); }
  };

  const handleStatusChange = async (paperId, status) => {
    try { await updatePaperStatus(paperId, status); load(); }
    catch (e) { alert(e.message); }
  };

  const handleBulkAddTags = async () => {
    if (!bulkTagInput.trim() || selected.size === 0) return;
    const tags = bulkTagInput.split(",").map(t => t.trim()).filter(Boolean);
    try { await bulkUpdateTags([...selected], tags, []); setShowBulkTagEditor(false); setBulkTagInput(""); setSelected(new Set()); load(); }
    catch (e) { alert(e.message); }
  };

  const handleBulkRemoveTags = async () => {
    if (!bulkTagInput.trim() || selected.size === 0) return;
    const tags = bulkTagInput.split(",").map(t => t.trim()).filter(Boolean);
    try { await bulkUpdateTags([...selected], [], tags); setShowBulkTagEditor(false); setBulkTagInput(""); setSelected(new Set()); load(); }
    catch (e) { alert(e.message); }
  };

  const handlePrintCitations = async () => {
    if (selected.size === 0) return;
    try {
      const r = await generatePrintableCitations([...selected], "apa");
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`<html><head><title>Citations</title><style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6}h1{font-size:24px;margin-bottom:20px}.citation{margin-bottom:16px;padding:12px;border-left:3px solid #3525cd;background:#f7f9fb}p{margin:0}</style></head><body><h1>Citations (APA)</h1>${r.citations.map(c => `<div class="citation"><p>${c.citation}</p></div>`).join("")}</body></html>`);
      printWindow.document.close();
      printWindow.print();
    } catch (e) { alert(e.message); }
  };

  const showCompareButtons = selected.size >= 2 && !compareMode;

  const allTags = {};
  papers.forEach((p) => { const tags = p.metadata?.tags || p.metadata?.subjects || []; tags.forEach((t) => { allTags[t] = (allTags[t] || 0) + 1; }); });
  const topTags = Object.entries(allTags).sort((a, b) => b[1] - a[1]).slice(0, 10);
  
  let filteredPapers = papers;
  if (filterTag) filteredPapers = filteredPapers.filter((p) => { const tags = p.metadata?.tags || p.metadata?.subjects || []; return tags.includes(filterTag); });
  if (filterStatus) filteredPapers = filteredPapers.filter((p) => (p.metadata?.status || "to_read") === filterStatus);
  if (filterSource) filteredPapers = filteredPapers.filter((p) => {
    const src = p.metadata?.source || "";
    if (filterSource === "pdf") return !src.startsWith("arxiv:") && !src.startsWith("doi:");
    if (filterSource === "arxiv") return src.startsWith("arxiv:");
    if (filterSource === "doi") return src.startsWith("doi:");
    return true;
  });
  if (showFavoritesOnly) filteredPapers = filteredPapers.filter((p) => p.metadata?.is_favorite);
  if (showPinned) filteredPapers = filteredPapers.filter((p) => p.metadata?.pinned);
  
  filteredPapers = [...filteredPapers].sort((a, b) => {
    if (a.metadata?.pinned && !b.metadata?.pinned) return -1;
    if (!a.metadata?.pinned && b.metadata?.pinned) return 1;
    switch (sortBy) {
      case "oldest": return (a.created_at || 0) - (b.created_at || 0);
      case "title": return (a.filename || "").localeCompare(b.filename || "");
      case "most_notes": return (b.notes_count || 0) - (a.notes_count || 0);
      case "newest": default: return (b.created_at || 0) - (a.created_at || 0);
    }
  });

  if (compareMode) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8"><div><h1 className="text-headline-lg text-on-surface">Compare Papers</h1><p className="text-body-md text-on-surface-variant mt-1">Analyzing {selected.size} selected papers</p></div><button onClick={() => { setCompareMode(false); setCompareResult(null); setSelected(new Set()); }} className="flex items-center gap-2 text-primary hover:text-primary-container font-semibold transition-colors"><span className="material-symbols-outlined">arrow_back</span>Back to Library</button></div>
        {comparing && <div className="flex flex-col items-center justify-center py-20 gap-4"><Spinner size={32} color="var(--color-primary)" /><p className="text-body-md text-on-surface-variant animate-pulse">Running comparison...</p></div>}
        {compareResult?.error && <div className="bg-error-container/30 border border-error/20 rounded-xl p-6 text-error text-body-md">{compareResult.error}</div>}
        {compareResult && !comparing && !compareResult.error && (
          <div className="space-y-8">
            {compareResult.overview && <section><h3 className="text-label-caps text-outline mb-3" style={{ textTransform: "uppercase" }}>Overview</h3><div className="space-y-3">{typeof compareResult.overview === "object" && !Array.isArray(compareResult.overview) ? Object.entries(compareResult.overview).map(([k, v]) => (<div key={k} className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/60"><p className="text-[11px] font-semibold text-outline mb-1 uppercase tracking-wider">{k}</p><p className="text-body-md text-on-surface-variant">{v}</p></div>)) : Array.isArray(compareResult.overview) ? compareResult.overview.map((item, i) => (<div key={i} className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/60"><p className="text-body-md text-on-surface-variant">{typeof item === "object" ? JSON.stringify(item) : item}</p></div>)) : <p className="text-body-md text-on-surface-variant">{compareResult.overview}</p>}</div></section>}
            <DiffHighlights similarities={compareResult.similarities} differences={compareResult.differences} />
            {["methodologies", "findings"].map((key) => { let t = compareResult[key]; if (!t) return null; if (!t.headers && !t.rows) { if (Array.isArray(t) && t.length && typeof t[0] === "object") { const ks = Object.keys(t[0]); t = { headers: ks, rows: t.map((r) => ks.map((k) => r[k] ?? "")) }; } else return null; } if (!t.headers || !t.rows) return null; return (
              <section key={key}><h3 className="text-label-caps text-outline mb-3" style={{ textTransform: "uppercase" }}>{key.replace(/_/g, " ")}</h3><div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl overflow-hidden"><table className="w-full text-left border-collapse"><thead><tr className="bg-surface-container-low border-b border-outline-variant/60">{t.headers.map((h, i) => (<th key={i} className={`px-5 py-3 text-[11px] font-semibold text-outline uppercase tracking-wider ${i > 0 ? "border-l border-outline-variant/60" : ""}`}>{h}</th>))}</tr></thead><tbody className="divide-y divide-outline-variant/40">{t.rows.map((row, ri) => (<tr key={ri}>{row.map((cell, ci) => (<td key={ci} className={`px-5 py-3 text-body-md text-on-surface-variant ${ci === 0 ? "font-medium text-on-surface" : "border-l border-outline-variant/60"}`}>{cell}</td>))}</tr>))}</tbody></table></div></section>
            );})}
            {compareResult.strengths_weaknesses && <section><h3 className="text-label-caps text-outline mb-3" style={{ textTransform: "uppercase" }}>Strengths &amp; Weaknesses</h3><div className="grid md:grid-cols-2 gap-4">{Object.entries(compareResult.strengths_weaknesses).map(([pid, sw]) => (<div key={pid} className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/60"><p className="text-[11px] font-semibold text-outline mb-3 uppercase tracking-wider">{pid}</p>{sw.strengths?.length > 0 && <div className="mb-3"><p className="text-[11px] font-semibold text-tertiary mb-1">Strengths</p><ul className="list-disc list-inside text-[12px] text-on-surface-variant space-y-0.5">{sw.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}{sw.weaknesses?.length > 0 && <div><p className="text-[11px] font-semibold text-secondary mb-1">Weaknesses</p><ul className="list-disc list-inside text-[12px] text-on-surface-variant space-y-0.5">{sw.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}</div>))}</div></section>}
            {compareResult.gaps?.length > 0 && <section><h3 className="text-label-caps text-outline mb-3" style={{ textTransform: "uppercase" }}>Gaps</h3><div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/60"><ul className="list-disc list-inside text-body-md text-on-surface-variant space-y-1">{compareResult.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul></div></section>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-10">
      <div className="mb-8"><h2 className="text-headline-lg text-on-surface">Library</h2><p className="text-body-md text-on-surface-variant mt-1">{papers.length === 0 ? "No papers yet — upload a file or fetch by URL to get started" : `${papers.length} paper${papers.length !== 1 ? "s" : ""} in your collection`}</p></div>

      <StatsBar stats={stats} />

      {/* Reading Reminders */}
      {readingReminders.length > 0 && (
        <div className="mb-6 bg-secondary/5 border border-secondary/20 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-[20px]">schedule</span>
              </div>
              <div>
                <h3 className="text-title-md font-semibold text-on-surface">Reading Reminders</h3>
                <p className="text-body-sm text-secondary">
                  {readingReminders.length} paper{readingReminders.length !== 1 ? "s" : ""} marked "To Read" not opened in 30+ days
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowReminders(!showReminders)}
                className="text-secondary text-body-sm font-medium hover:underline">
                {showReminders ? "Hide" : "View all"}
              </button>
              <button onClick={() => setReadingReminders([])}
                className="text-secondary text-body-sm font-medium hover:underline">
                Dismiss
              </button>
            </div>
          </div>
          {showReminders && (
            <div className="mt-4 space-y-2">
              {readingReminders.slice(0, 5).map((p) => (
                <Link key={p.id} to={`/paper/${p.id}`} className="block bg-surface rounded-xl p-3 border border-secondary/20 hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-3">
                    <SourceBadge paper={p} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md text-on-surface truncate">{p.filename || "Untitled"}</p>
                      <p className="text-body-sm text-on-surface-variant truncate">
                        Added {new Date(p.created_at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {p.last_viewed ? ` • Last opened ${new Date(p.last_viewed * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : " • Never opened"}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-secondary">chevron_right</span>
                  </div>
                </Link>
              ))}
              {readingReminders.length > 5 && (
                <p className="text-body-sm text-secondary text-center">
                  +{readingReminders.length - 5} more...
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-6 relative">
        <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline/60 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">search</span>
          <input data-search type="text" placeholder="Search papers, notes, and Q&A..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
            onFocus={() => { if (globalResults) setShowSearchDropdown(true); }}
            onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
            className="flex-1 border-0 focus:ring-0 text-body-md bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant/50" />
          {searchText && <button onClick={() => { setSearchText(""); setShowSearchDropdown(false); }} className="text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined text-[18px]">close</span></button>}
        </div>
        {showSearchDropdown && <SearchDropdown results={globalResults} onClose={() => setShowSearchDropdown(false)} navigate={navigate} />}
      </div>

      {/* Tag chips */}
      {topTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setFilterTag(null)} className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all border ${!filterTag ? "bg-primary text-on-primary border-primary" : "bg-surface-container text-on-surface-variant border-outline-variant/40 hover:border-primary/40"}`}>All</button>
          {topTags.map(([tag, count]) => (<button key={tag} onClick={() => setFilterTag(filterTag === tag ? null : tag)} className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all border ${filterTag === tag ? "bg-primary text-on-primary border-primary" : "bg-surface-container text-on-surface-variant border-outline-variant/40 hover:border-primary/40"}`}>{tag} <span className="opacity-60">({count})</span></button>))}
        </div>
      )}

      {/* Sort, Filter, Favorites controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-on-surface-variant font-medium">Sort:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="border border-outline/60 rounded-lg px-3 py-1.5 text-[12px] bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="title">Title A-Z</option>
            <option value="most_notes">Most Notes</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-on-surface-variant font-medium">Status:</span>
          <select value={filterStatus || ""} onChange={(e) => setFilterStatus(e.target.value || null)}
            className="border border-outline/60 rounded-lg px-3 py-1.5 text-[12px] bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none">
            <option value="">All</option>
            <option value="to_read">To Read</option>
            <option value="reading">Reading</option>
            <option value="read">Read</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-on-surface-variant font-medium">Source:</span>
          <select value={filterSource || ""} onChange={(e) => setFilterSource(e.target.value || null)}
            className="border border-outline/60 rounded-lg px-3 py-1.5 text-[12px] bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none">
            <option value="">All</option>
            <option value="pdf">PDF Upload</option>
            <option value="arxiv">arXiv</option>
            <option value="doi">DOI</option>
          </select>
        </div>
        <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all border ${showFavoritesOnly ? "bg-secondary/10 text-secondary border-secondary/40" : "bg-surface-container text-on-surface-variant border-outline-variant/40 hover:border-secondary/40"}`}>
          <span className="material-symbols-outlined text-[14px]" style={showFavoritesOnly ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>Favorites
        </button>
        <button onClick={() => setShowPinned(!showPinned)}
          className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all border ${showPinned ? "bg-primary/10 text-primary border-primary/40" : "bg-surface-container text-on-surface-variant border-outline-variant/40 hover:border-primary/40"}`}>
          <span className="material-symbols-outlined text-[14px]">push_pin</span>Pinned
        </button>
        <div className="flex border border-outline-variant/40 rounded-lg overflow-hidden ml-2">
          <button onClick={() => { setViewMode("list"); localStorage.setItem("scholarflow-view-mode", "list"); }}
            className={`px-2.5 py-1.5 text-[12px] transition-colors ${viewMode === "list" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}>
            <span className="material-symbols-outlined text-[14px]">view_list</span>
          </button>
          <button onClick={() => { setViewMode("grid"); localStorage.setItem("scholarflow-view-mode", "grid"); }}
            className={`px-2.5 py-1.5 text-[12px] transition-colors ${viewMode === "grid" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}>
            <span className="material-symbols-outlined text-[14px]">grid_view</span>
          </button>
        </div>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-5 py-3 mb-6 flex items-center justify-between">
          <span className="text-body-md text-primary font-medium">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={handleBulkDeleteWithUndo} className="text-error bg-error/10 px-4 py-1.5 rounded-lg text-[12px] font-medium hover:bg-error/20 transition-colors flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">delete</span>Delete</button>
            <div className="relative">
              <button onClick={() => setShowBulkCol(!showBulkCol)} className="text-primary bg-primary/10 px-4 py-1.5 rounded-lg text-[12px] font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">playlist_add</span>Add to Collection</button>
              {showBulkCol && collections.length > 0 && (
                <div className="absolute top-full right-0 mt-1 w-52 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xl z-50 py-1">{collections.map((c) => (<button key={c.id} onClick={() => handleBulkAddCollection(c.id)} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-primary">folder</span>{c.name}</button>))}</div>
              )}
            </div>
            <button onClick={() => setShowBulkTagEditor(!showBulkTagEditor)} className="text-primary bg-primary/10 px-4 py-1.5 rounded-lg text-[12px] font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">label</span>Tags</button>
            <button onClick={handleBulkExport} className="text-on-surface bg-surface-container px-4 py-1.5 rounded-lg text-[12px] font-medium hover:bg-surface-container-high transition-colors flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">download</span>Export BibTeX</button>
            <button onClick={handlePrintCitations} className="text-on-surface bg-surface-container px-4 py-1.5 rounded-lg text-[12px] font-medium hover:bg-surface-container-high transition-colors flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">print</span>Print Citations</button>
          </div>
        </div>
      )}

      {/* Bulk Tag Editor */}
      {showBulkTagEditor && selected.size > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 mb-6">
          <p className="text-body-sm font-medium text-on-surface mb-3">Bulk Tag Editor — {selected.size} paper{selected.size !== 1 ? "s" : ""} selected</p>
          <div className="flex gap-2">
            <input type="text" value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)}
              placeholder="Enter tags (comma separated)..."
              className="flex-1 border border-outline/60 rounded-lg px-3 py-2 text-[12px] bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-on-surface-variant/50" />
            <button onClick={handleBulkAddTags} disabled={!bulkTagInput.trim()}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg text-[12px] font-medium hover:opacity-90 disabled:opacity-40 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">add</span>Add
            </button>
            <button onClick={handleBulkRemoveTags} disabled={!bulkTagInput.trim()}
              className="bg-error/10 text-error px-4 py-2 rounded-lg text-[12px] font-medium hover:bg-error/20 disabled:opacity-40 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">remove</span>Remove
            </button>
            <button onClick={() => { setShowBulkTagEditor(false); setBulkTagInput(""); }}
              className="text-on-surface-variant hover:text-primary px-3 py-2 text-[12px]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upload / Fetch cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <label className="group relative bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-2xl p-8 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5">
          <input data-upload type="file" accept=".pdf,.txt,.md,.docx,.doc,.rtf,.tex,.html,.htm" onChange={handleUpload} disabled={busy} className="hidden" />
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110 bg-primary/10"><span className="material-symbols-outlined text-3xl text-primary">upload_file</span></div>
          <h3 className="text-title-md text-on-surface mb-1">Upload Document</h3>
          <p className="text-body-sm text-on-surface-variant mb-5 max-w-[240px]">Click to select and upload a file (PDF, TXT, DOCX, MD, and more)</p>
          <span className="bg-primary text-on-primary px-7 py-2.5 rounded-xl text-body-md font-medium shadow-sm group-hover:shadow-md group-hover:shadow-primary/20 transition-all duration-200 active:scale-95">Choose File</span>
        </label>
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8 flex flex-col justify-center card-ring">
          <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 bg-tertiary-container rounded-xl flex items-center justify-center"><span className="material-symbols-outlined text-on-primary text-xl">link</span></div><h3 className="text-title-md text-on-surface">Fetch by ID / DOI / URL</h3></div>
          <p className="text-body-sm text-on-surface-variant mb-5">Import from arXiv, DOI, or paste a direct file URL</p>
          <div className="flex gap-2.5">
            <input type="text" placeholder="arXiv ID, DOI, or URL..." value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()} disabled={busy}
              className="flex-1 border border-outline-variant/80 rounded-xl px-4 py-2.5 text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-on-surface-variant/50" />
            <button onClick={handleFetch} disabled={busy || !query.trim()}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-medium transition-all duration-150 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center gap-2">
              {busy ? <Spinner size={16} color="currentColor" /> : "Fetch"}
            </button>
          </div>
        </div>
      </div>

      {busy && <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8 relative overflow-hidden mb-8"><div className="absolute inset-0 bg-surface-container-lowest/70 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-3"><Spinner size={36} color="var(--color-primary)" /><p className="text-body-md font-medium text-primary animate-pulse">{busyLabel || "Processing..."}</p></div><div className="opacity-30 space-y-3"><div className="skeleton h-5 w-3/4" /><div className="skeleton h-4 w-1/2" /></div></div>}

      {showCompareButtons && (<div className="flex justify-end gap-3 mb-6"><button onClick={doMethodologyCompare} disabled={comparing} className="bg-secondary text-on-secondary px-7 py-2.5 rounded-xl font-semibold flex items-center gap-2.5 transition-all duration-150 hover:shadow-lg active:scale-95 disabled:opacity-50"><span className="material-symbols-outlined text-[18px]">science</span>Compare Methodologies ({selected.size})</button><button onClick={doCompare} disabled={comparing} className="bg-primary text-on-primary px-7 py-2.5 rounded-xl font-semibold flex items-center gap-2.5 transition-all duration-150 hover:shadow-lg hover:shadow-primary/20 active:scale-95 disabled:opacity-50"><span className="material-symbols-outlined text-[18px]">auto_awesome</span>Compare ({selected.size})</button></div>)}

      <div className={viewMode === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
        {loading ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filteredPapers.length === 0 ? (
            papers.length === 0 ? <Onboarding onUpload={handleUpload} onFetchUrl={() => setShowUrl(true)} />
            : <div className="col-span-full flex flex-col items-center justify-center py-24"><div className="w-20 h-20 bg-surface-container rounded-2xl flex items-center justify-center mb-5"><span className="material-symbols-outlined text-4xl text-outline-variant">menu_book</span></div><p className="text-title-md text-on-surface mb-1">No matching papers</p><p className="text-body-md text-on-surface-variant">Try a different search or filter</p></div>
          ) : filteredPapers.map((p) => (<PaperCard key={p.id} paper={p} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} onAddToCollection={handleAddToCollection} collections={collections} onRegenerate={handleRegenerate} onShare={handleShare} onViewRelated={handleViewRelated} onExport={handleExport} onDelete={handleDelete} onFavorite={handleFavorite} onStatusChange={handleStatusChange} viewMode={viewMode} />))
        }
      </div>

      {undoToast && (
        <UndoToast
          message={`${undoToast.action === "bulk_delete" ? `Deleted ${undoToast.count} papers` : `Deleted "${undoToast.paperName}"`}`}
          onUndo={handleUndoDelete}
          onDismiss={handleUndoDelete}
        />
      )}
    </div>
  );
}

