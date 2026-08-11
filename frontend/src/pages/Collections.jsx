import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listCollections, createCollection, deleteCollection, getCollection, removeFromCollection, exportPaperMarkdown, getRelatedPapers, regenerateSummary, bulkDelete, suggestTags, generateLitReview, exportCollectionBibtex, getPaperThumbnailUrl } from "../api/client";

function Spinner({ size = 20 }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
    </svg>
  );
}

function SourceBadge({ paper }) {
  const src = paper.metadata?.source || "";
  if (src.startsWith("arxiv:")) return <span className="bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 rounded-md border border-primary/30">arXiv</span>;
  if (src.startsWith("doi:")) return <span className="bg-tertiary/10 text-tertiary text-[11px] font-semibold px-2 py-0.5 rounded-md border border-tertiary/30">DOI</span>;
  return <span className="bg-surface-container text-on-surface-variant text-[11px] font-semibold px-2 py-0.5 rounded-md border border-outline-variant/40">PDF</span>;
}

function CollectionCard({ col, onDelete, onClick }) {
  const color = col.color || "#3525cd";
  return (
    <div onClick={onClick}
      className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 cursor-pointer hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <span className="material-symbols-outlined text-[20px]" style={{ color }}>folder</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(col.id); }}
          className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg hover:bg-error/10 flex items-center justify-center transition-all">
          <span className="material-symbols-outlined text-[18px] text-error">delete</span>
        </button>
      </div>
      <h3 className="text-title-md text-on-surface mb-1 group-hover:text-primary transition-colors">{col.name}</h3>
      {col.category && <span className="inline-block bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-md mb-2">{col.category}</span>}
      {col.description && <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-3">{col.description}</p>}
      <div className="flex items-center gap-1.5 text-on-surface-variant">
        <span className="material-symbols-outlined text-[14px]">description</span>
        <span className="text-body-sm">{col.paper_count || 0} papers</span>
      </div>
    </div>
  );
}

function PaperInCollection({ paper, onRemove, onRegenerate, onShare, onViewRelated, onExport, onDelete, onPreview }) {
  const [showKebab, setShowKebab] = useState(false);
  const [thumbUrl, setThumbUrl] = useState(null);
  const kebabRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (kebabRef.current && !kebabRef.current.contains(e.target)) {
        setShowKebab(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!paper.id) return;
    const url = getPaperThumbnailUrl(paper.id);
    fetch(url, { method: "HEAD" }).then((r) => { if (r.ok) setThumbUrl(url); }).catch(() => {});
  }, [paper.id]);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 flex items-center justify-between group hover:shadow-md transition-all">
      <Link to={`/paper/${paper.id}`} className="flex items-center gap-3 flex-1 min-w-0 no-underline">
        {thumbUrl ? (
          <div className="w-12 h-14 shrink-0 rounded-lg overflow-hidden bg-surface-container cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onPreview) onPreview(thumbUrl); }}>
            <img src={thumbUrl} alt="" className="w-full h-full object-cover object-top pointer-events-none" />
          </div>
        ) : (
          <SourceBadge paper={paper} />
        )}
        <div className="min-w-0">
          <h4 className="text-body-md text-on-surface group-hover:text-primary transition-colors truncate">{paper.filename || "Untitled"}</h4>
          {paper.metadata?.authors?.length > 0 && (
            <p className="text-body-sm text-on-surface-variant truncate">{paper.metadata.authors.slice(0, 2).join(", ")}</p>
          )}
        </div>
      </Link>
      <div className="flex items-center gap-1.5 relative shrink-0" ref={kebabRef}>
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
            <hr className="my-1 border-outline-variant/30" />
            <button onClick={() => { onRemove(paper.id); setShowKebab(false); }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-error">close</span>Remove from Collection
            </button>
            {paper.executive_summary && (
              <button onClick={async () => { setShowKebab(false); try { const r = await suggestTags(paper.id); alert("Suggested tags: " + r.suggested_tags.join(", ")); } catch (e) { alert(e.message); } }} className="w-full text-left px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">label</span>Suggest Tags
              </button>
            )}
            <button onClick={() => { onDelete(paper.id); setShowKebab(false); }} className="w-full text-left px-3 py-2 text-body-sm text-error hover:bg-error/5 transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">delete</span>Delete Paper
            </button>
          </div>
        )}
        <button onClick={() => onRemove(paper.id)}
          className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg hover:bg-error/10 flex items-center justify-center transition-all shrink-0 ml-2">
          <span className="material-symbols-outlined text-[16px] text-error">close</span>
        </button>
      </div>
    </div>
  );
}

export default function Collections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [thumbModal, setThumbModal] = useState(null);
  const [newColor, setNewColor] = useState("#3525cd");
  const [creating, setCreating] = useState(false);
  const [filterCategory, setFilterCategory] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    listCollections().then(setCollections).catch(() => setCollections([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (id) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const c = await getCollection(id);
      setSelected(c);
    } catch { setSelected(null); }
    finally { setLoadingDetail(false); }
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const c = await createCollection(newName.trim(), newDesc.trim(), newCategory.trim());
      if (c?.id && newColor !== "#3525cd") {
        const { updateCollectionColor } = await import("../api/client");
        await updateCollectionColor(c.id, newColor);
      }
      setNewName(""); setNewDesc(""); setNewCategory(""); setNewColor("#3525cd"); setShowCreate(false);
      load();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this collection?")) return;
    try {
      await deleteCollection(id);
      if (selectedId === id) { setSelectedId(null); setSelected(null); }
      load();
    } catch (e) { alert(e.message); }
  };

  const handleRemovePaper = async (paperId) => {
    if (!selectedId) return;
    try {
      await removeFromCollection(selectedId, paperId);
      loadDetail(selectedId);
      load();
    } catch (e) { alert(e.message); }
  };

  const handleRegenerate = (paperId) => navigate(`/paper/${paperId}?action=regenerate`);
  const handleShare = (paperId) => navigator.clipboard.writeText(`${window.location.origin}/share/${paperId}`).then(() => alert("Share link copied!"));
  const handleViewRelated = (paperId) => navigate(`/paper/${paperId}?tab=related`);
  const handleExport = async (paperId) => {
    try { await exportPaperMarkdown(paperId); }
    catch (e) { alert(e.message); }
  };
  const handleDeletePaper = async (paperId) => {
    if (!confirm("Delete this paper?")) return;
    try { await bulkDelete([paperId]); loadDetail(selectedId); load(); }
    catch (e) { alert(e.message); }
  };

  if (selectedId) {
    return (
      <div className="max-w-[1000px] mx-auto px-8 py-10">
        <button onClick={() => { setSelectedId(null); setSelected(null); }}
          className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-body-md font-medium mb-6">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All Collections
        </button>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-20"><Spinner /></div>
        ) : selected ? (
          <div>
            <div className="mb-8">
              <h1 className="text-headline-lg text-on-surface mb-2">{selected.name}</h1>
              {selected.description && <p className="text-body-md text-on-surface-variant">{selected.description}</p>}
              <p className="text-body-sm text-on-surface-variant mt-1">{selected.papers?.length || 0} papers</p>
              {selected.papers?.length > 0 && (
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button onClick={async () => { try { await generateLitReview(selectedId); } catch (e) { alert(e.message); } }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-body-sm font-medium hover:bg-primary/20 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>Literature Review
                  </button>
                  <button onClick={() => exportCollectionBibtex(selectedId)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container text-on-surface-variant text-body-sm font-medium hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined text-[16px]">download</span>Export BibTeX
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/collection-share/${selectedId}`); alert("Collection share link copied!"); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container text-on-surface-variant text-body-sm font-medium hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined text-[16px]">share</span>Share Collection
                  </button>
                </div>
              )}
            </div>
            {selected.papers?.length > 0 ? (
              <div className="space-y-3">
                {selected.papers.map((p) => (
                  <PaperInCollection key={p.id} paper={p} onRemove={handleRemovePaper} onRegenerate={handleRegenerate} onShare={handleShare} onViewRelated={handleViewRelated} onExport={handleExport} onDelete={handleDeletePaper} onPreview={(url) => setThumbModal(url + "?v=" + Date.now())} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-primary">folder_open</span>
                </div>
                <p className="text-title-md text-on-surface mb-2">No papers in this collection yet</p>
                <p className="text-body-sm text-on-surface-variant mb-4">Go to Library and use "Add to Collection" on paper cards.</p>
                <Link to="/" className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2 rounded-xl text-body-sm font-medium hover:opacity-90 transition-opacity">
                  <span className="material-symbols-outlined text-[16px]">book_2</span>Go to Library
                </Link>
              </div>
            )}
          </div>
        ) : (
          <p className="text-on-surface-variant">Collection not found.</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-headline-lg text-on-surface">Collections</h1>
          <p className="text-body-md text-on-surface-variant mt-1">Organize your papers into collections</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-primary text-on-primary font-semibold py-2.5 px-5 rounded-xl flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98]">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Collection
        </button>
      </div>

      {showCreate && (
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 mb-8 shadow-sm">
          <h3 className="text-title-md font-semibold text-on-surface mb-4">Create Collection</h3>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Collection name"
            className="w-full border border-outline/60 rounded-xl px-4 py-2.5 text-body-md mb-3 bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-on-surface-variant/50" />
          <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2}
            className="w-full border border-outline/60 rounded-xl px-4 py-2.5 text-body-md mb-4 bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none placeholder:text-on-surface-variant/50" />
          <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category (e.g. Thesis Research, Side Reading)"
            className="w-full border border-outline/60 rounded-xl px-4 py-2.5 text-body-md mb-4 bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-on-surface-variant/50" />
          <div className="flex items-center gap-3 mb-4">
            <span className="text-body-sm text-on-surface-variant">Cover Color:</span>
            <div className="flex gap-2">
              {["#3525cd", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#6b7280"].map(c => (
                <button key={c} onClick={() => setNewColor(c)} className={`w-7 h-7 rounded-full border-2 transition-all ${newColor === c ? "border-on-surface scale-110" : "border-transparent hover:scale-105"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-on-surface-variant px-4 py-2 rounded-xl hover:bg-surface-container-low transition-colors text-body-md font-medium">Cancel</button>
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              className="bg-primary text-on-primary px-5 py-2 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2">
              {creating && <Spinner size={16} />}Create
            </button>
          </div>
        </div>
      )}

      {!loading && collections.length > 0 && (() => {
        const cats = [...new Set(collections.map((c) => c.category).filter(Boolean))];
        if (cats.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setFilterCategory(null)} className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all border ${!filterCategory ? "bg-primary text-on-primary border-primary" : "bg-surface-container text-on-surface-variant border-outline-variant/40 hover:border-primary/40"}`}>All</button>
            {cats.map((cat) => (<button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? null : cat)} className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all border ${filterCategory === cat ? "bg-primary text-on-primary border-primary" : "bg-surface-container text-on-surface-variant border-outline-variant/40 hover:border-primary/40"}`}>{cat}</button>))}
          </div>
        );
      })()}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-4">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-4xl text-primary">folder</span>
          </div>
          <p className="text-title-md text-on-surface mb-2">No collections yet</p>
          <p className="text-body-md text-on-surface-variant mb-6">Create your first collection to organize papers</p>
          <button onClick={() => setShowCreate(true)}
            className="bg-primary text-on-primary font-semibold py-3 px-6 rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all">
            Create Collection
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.filter((c) => !filterCategory || c.category === filterCategory).map((col) => (
            <CollectionCard key={col.id} col={col} onDelete={handleDelete} onClick={() => loadDetail(col.id)} />
          ))}
        </div>
      )}

      {thumbModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8 cursor-pointer" onClick={() => setThumbModal(null)}>
          <button onClick={() => setThumbModal(null)} className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-10">
            <span className="material-symbols-outlined text-white text-[24px]">close</span>
          </button>
          <img src={thumbModal} alt="Thumbnail" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
