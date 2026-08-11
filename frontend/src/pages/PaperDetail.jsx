import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPaper, askQuestion, getCitation, listNotes, createNote, updateNote, deleteNote, getNoteVersions, revertNote, getQaHistory, exportPaperMarkdown, getRelatedPapers, updateReadingProgress, regenerateSummary, generateFlashcards, computeReadability, extractFiguresTables, generateSimplifiedSummary, translateSummary, suggestTags, togglePin, detectContradictions, getReadNextRecommendations, API, uploadThumbnail, getPaperThumbnailUrl } from "../api/client";
import PdfViewer from "../components/PdfViewer";
import CitationGraph from "../components/CitationGraph";
import WordCloud from "../components/WordCloud";

const TABS = [
  { key: "executive", label: "Executive Summary", icon: "summarize" },
  { key: "detailed", label: "Detailed Summary", icon: "article" },
  { key: "findings", label: "Key Findings", icon: "science" },
  { key: "elements", label: "Key Elements", icon: "category" },
  { key: "notes", label: "Notes", icon: "edit_note" },
  { key: "flashcards", label: "Flashcards", icon: "style" },
  { key: "figures", label: "Figures & Tables", icon: "table_chart" },
  { key: "simplified", label: "Explain Like I'm New", icon: "school" },
  { key: "related", label: "Related Papers", icon: "hub" },
  { key: "citations", label: "Citation Graph", icon: "account_tree" },
  { key: "contradictions", label: "Contradictions", icon: "compare" },
  { key: "read-next", label: "Read Next", icon: "recommend" },
  { key: "danger", label: "Danger Zone", icon: "warning" },
  { key: "share", label: "Share", icon: "share" },
];
const STYLES = ["apa", "mla", "bibtex"];

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
  if (src.startsWith("arxiv:")) return <span className="bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-1 rounded-md border border-primary/30">arXiv</span>;
  if (src.startsWith("doi:")) return <span className="bg-tertiary/10 text-tertiary text-[11px] font-semibold px-2.5 py-1 rounded-md border border-tertiary/30">DOI</span>;
  return <span className="bg-surface-container text-on-surface-variant text-[11px] font-semibold px-2.5 py-1 rounded-md border border-outline-variant/40">PDF</span>;
}

function PaperThumb({ paperId, thumbVersion }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    setUrl(null);
    if (!paperId) return;
    const u = getPaperThumbnailUrl(paperId);
    fetch(u, { method: "HEAD" }).then((r) => { if (r.ok) setUrl(u + "?v=" + thumbVersion); }).catch(() => {});
  }, [paperId, thumbVersion]);
  if (url) {
    return <img src={url} alt="Thumbnail" className="w-full h-full object-cover object-top" />;
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-tertiary/10">
      <span className="material-symbols-outlined text-on-surface-variant/30 text-[36px]">description</span>
    </div>
  );
}

function NotesTab({ paperId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [pageRef, setPageRef] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [versionsNoteId, setVersionsNoteId] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listNotes(paperId).then(setNotes).catch(() => setNotes([])).finally(() => setLoading(false));
  }, [paperId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!text.trim()) return;
    try { await createNote(paperId, text.trim(), pageRef ? parseInt(pageRef) : null); setText(""); setPageRef(""); load(); } catch (e) { alert(e.message); }
  };
  const handleUpdate = async (noteId) => {
    if (!editText.trim()) return;
    try { await updateNote(noteId, editText.trim()); setEditingId(null); setEditText(""); load(); } catch (e) { alert(e.message); }
  };
  const handleDelete = async (noteId) => { try { await deleteNote(noteId); load(); } catch (e) { alert(e.message); } };

  const loadVersions = async (noteId) => {
    if (versionsNoteId === noteId) { setVersionsNoteId(null); setVersions([]); return; }
    setVersionsNoteId(noteId);
    setLoadingVersions(true);
    try { const v = await getNoteVersions(noteId); setVersions(v); }
    catch { setVersions([]); }
    finally { setLoadingVersions(false); }
  };

  const handleRevert = async (noteId, versionId) => {
    try { await revertNote(noteId, versionId); load(); setVersionsNoteId(null); setVersions([]); }
    catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-[18px]">edit_note</span></div>
        <h2 className="text-headline-md text-on-surface">Notes</h2>
      </div>
      <div className="bg-surface rounded-xl p-4 border border-outline-variant/40 mb-6">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note..." rows={3}
          className="w-full border-0 focus:ring-0 text-body-md bg-transparent text-on-surface outline-none resize-none placeholder:text-on-surface-variant/50 mb-3" />
        <div className="flex items-center gap-3">
          <input value={pageRef} onChange={(e) => setPageRef(e.target.value)} placeholder="Page # (optional)" type="number" min="1"
            className="w-28 border border-outline/60 rounded-lg px-3 py-1.5 text-body-sm bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none" />
          <button onClick={handleAdd} disabled={!text.trim()} className="bg-primary text-on-primary px-4 py-1.5 rounded-lg text-body-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 ml-auto">Add Note</button>
        </div>
      </div>
      {loading ? <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}</div>
        : notes.length === 0 ? <div className="text-center py-10"><span className="material-symbols-outlined text-4xl text-outline-variant/40 mb-2 block">edit_note</span><p className="text-on-surface-variant">No notes yet</p></div>
        : <div className="space-y-3">{notes.map((n) => (
          <div key={n.id} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/40 group">
            {editingId === n.id ? (
              <div><textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} className="w-full border border-outline/60 rounded-lg px-3 py-2 text-body-md bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none resize-none mb-2" />
                <div className="flex gap-2 justify-end"><button onClick={() => setEditingId(null)} className="text-on-surface-variant px-3 py-1 rounded-lg text-[12px] hover:bg-surface-container-low">Cancel</button><button onClick={() => handleUpdate(n.id)} className="bg-primary text-on-primary px-3 py-1 rounded-lg text-[12px] font-medium hover:opacity-90">Save</button></div>
              </div>
            ) : (
              <div><p className="text-body-md text-on-surface whitespace-pre-line leading-relaxed">{n.text}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                    {n.page_ref && <span className="bg-surface-container px-2 py-0.5 rounded">p. {n.page_ref}</span>}
                    <span>{new Date(n.created_at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => loadVersions(n.id)} className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center" title="Version history"><span className="material-symbols-outlined text-[14px] text-on-surface-variant">history</span></button>
                    <button onClick={() => { setEditingId(n.id); setEditText(n.text); }} className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center"><span className="material-symbols-outlined text-[14px] text-on-surface-variant">edit</span></button>
                    <button onClick={() => handleDelete(n.id)} className="w-7 h-7 rounded hover:bg-error/10 flex items-center justify-center"><span className="material-symbols-outlined text-[14px] text-error">delete</span></button>
                  </div>
                </div>
              </div>
            )}
            {versionsNoteId === n.id && (
              <div className="mt-3 pt-3 border-t border-outline-variant/30">
                <p className="text-[11px] font-semibold text-outline uppercase tracking-wider mb-2">Version History</p>
                {loadingVersions ? <p className="text-[12px] text-on-surface-variant">Loading...</p>
                  : versions.length === 0 ? <p className="text-[12px] text-on-surface-variant/60">No previous versions</p>
                  : <div className="space-y-1.5">{versions.map((v) => (
                    <div key={v.id} className="flex items-start gap-2 bg-surface rounded-lg p-2.5 border border-outline-variant/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-on-surface-variant/70 mb-1">{new Date(v.created_at * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        <p className="text-[12px] text-on-surface line-clamp-2">{v.text}</p>
                      </div>
                      <button onClick={() => handleRevert(n.id, v.id)}
                        className="text-[11px] text-primary font-medium hover:underline shrink-0 px-2 py-1 rounded hover:bg-primary/5">
                        Revert
                      </button>
                    </div>
                  ))}</div>
                }
              </div>
            )}
          </div>
        ))}</div>
      }
    </div>
  );
}

function RelatedPapers({ paperId }) {
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    getRelatedPapers(paperId).then((r) => setRelated(r.related || [])).catch(() => setRelated([])).finally(() => setLoading(false));
  }, [paperId]);

  if (loading || related.length === 0) return (
    <div className="text-center py-12">
      <span className="material-symbols-outlined text-4xl text-outline-variant/40 mb-3 block">hub</span>
      <p className="text-on-surface-variant">No related papers found.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-[18px]">hub</span></div>
        <h2 className="text-headline-md text-on-surface">Related Papers</h2>
      </div>
      <div className="space-y-3">
        {related.map((p) => (
          <button key={p.id} onClick={() => nav(`/paper/${p.id}`)}
            className="w-full text-left bg-surface rounded-xl p-4 border border-outline-variant/40 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <h4 className="text-body-md text-on-surface font-medium truncate">{p.filename}</h4>
              <span className="text-[10px] text-primary font-semibold shrink-0 ml-2">{Math.round(p.score * 100)}% match</span>
            </div>
            {p.executive_summary && <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">{p.executive_summary}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShareTab({ paper, paperId }) {
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);

  const generateLink = () => {
    const link = `${window.location.origin}/share/${paperId}`;
    setShareLink(link);
    return link;
  };

  const copyLink = () => {
    const link = generateLink();
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-[18px]">share</span></div>
        <h2 className="text-headline-md text-on-surface">Share Paper Digest</h2>
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
        <p className="text-body-md text-on-surface-variant mb-4">Share a read-only digest of this paper with executive summary, key findings, and metadata.</p>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={shareLink || generateLink()}
            readOnly
            className="flex-1 border border-outline/60 rounded-xl px-4 py-2.5 text-body-md bg-surface-container-lowest text-on-surface outline-none placeholder:text-on-surface-variant/50"
          />
          <button onClick={copyLink} className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-[18px]">{copied ? "check" : "content_copy"}</span>
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(paper.filename || "Paper")}&url=${encodeURIComponent(shareLink || generateLink())}`;
          <button onClick={() => window.open(twitterUrl, "_blank")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface hover:bg-surface-container-high transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
            X (Twitter)
          </button>
          const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink || generateLink())}`;
          <button onClick={() => window.open(linkedinUrl, "_blank")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface hover:bg-surface-container-high transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
          </button>
          const mailtoUrl = `mailto:?subject=${encodeURIComponent(paper.filename || "Paper")}&body=${encodeURIComponent(shareLink || generateLink())}`;
          <button onClick={() => window.open(mailtoUrl, "_blank")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-[18px]">email</span>
            Email
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
        <h3 className="text-title-md text-on-surface mb-4">Embed Code</h3>
        <p className="text-body-sm text-on-surface-variant mb-3">Embed this paper's digest in your website or blog:</p>
        <pre className="bg-surface-container-high rounded-xl p-4 text-[11px] text-on-surface-variant overflow-x-auto custom-scrollbar" style={{ fontFamily: "var(--font-family-mono)" }}>
{`<iframe src="${window.location.origin}/share/${paperId}?embed=true" width="100%" height="600" frameborder="0"></iframe>`}
        </pre>
      </div>
    </div>
  );
}

function FlashcardsTab({ paperId }) {
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const loadFlashcards = useCallback(async () => {
    setLoading(true);
    try {
      const r = await generateFlashcards(paperId);
      setFlashcards(r.flashcards || []);
      setCurrentIndex(0);
      setShowAnswer(false);
      setScore({ correct: 0, total: 0 });
    } catch (e) {
      console.error("Failed to generate flashcards:", e);
      setFlashcards([]);
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    loadFlashcards();
  }, [loadFlashcards]);

  const handleAnswer = (isCorrect) => {
    setScore((prev) => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
    setShowAnswer(false);
    setTimeout(() => {
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
    }, 500);
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setScore({ correct: 0, total: 0 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} color="var(--color-primary)" />
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-3 block">style</span>
        <p className="text-on-surface-variant mb-4">No flashcards available.</p>
        <button onClick={loadFlashcards} className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity">
          Generate Flashcards
        </button>
      </div>
    );
  }

  const card = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[18px]">style</span>
          </div>
          <h2 className="text-headline-md text-on-surface">Flashcards</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-body-sm text-on-surface-variant">
            {score.total > 0 ? `${score.correct}/${score.total} correct` : "Review mode"}
          </span>
          <button onClick={resetQuiz} className="text-primary text-body-sm font-medium hover:underline">Restart</button>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
        <div className="w-full bg-surface-container-highest rounded-full h-2 mb-6 overflow-hidden">
          <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-body-sm text-on-surface-variant mb-4 text-center">Card {currentIndex + 1} of {flashcards.length}</p>

        <div className="bg-surface rounded-xl p-8 mb-6 min-h-[200px] flex flex-col justify-center transition-all duration-300" style={{ transform: showAnswer ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          {!showAnswer && (
            <div>
              <span className="inline-block bg-primary/10 text-primary text-[10px] font-semibold px-2 py-1 rounded-md mb-3 capitalize">{card.difficulty || "medium"}</span>
              <h3 className="text-title-lg text-on-surface leading-relaxed">{card.question}</h3>
              {card.page_ref && <p className="text-body-sm text-on-surface-variant mt-3">Page reference: {card.page_ref}</p>}
            </div>
          )}
          {showAnswer && (
            <div style={{ transform: "rotateY(180deg)" }}>
              <span className="inline-block bg-tertiary/10 text-tertiary text-[10px] font-semibold px-2 py-1 rounded-md mb-3">Answer</span>
              <p className="text-body-lg text-on-surface leading-relaxed">{card.answer}</p>
              {card.page_ref && <p className="text-body-sm text-on-surface-variant mt-3">Page reference: {card.page_ref}</p>}
            </div>
          )}
        </div>

        {!showAnswer ? (
          <button onClick={() => setShowAnswer(true)} className="w-full bg-primary text-on-primary py-3 rounded-xl font-medium text-body-md hover:opacity-90 transition-opacity">
            Show Answer
          </button>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => handleAnswer(true)} className="flex-1 bg-tertiary/10 text-tertiary py-3 rounded-xl font-medium text-body-md hover:bg-tertiary/20 transition-colors">
              Correct
            </button>
            <button onClick={() => handleAnswer(false)} className="flex-1 bg-error/10 text-error py-3 rounded-xl font-medium text-body-md hover:bg-error/20 transition-colors">
              Incorrect
            </button>
          </div>
        )}

        {currentIndex === flashcards.length - 1 && showAnswer && (
          <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl text-center">
            <p className="text-body-md text-primary font-semibold">Quiz Complete!</p>
            <p className="text-body-sm text-on-surface-variant mt-1">
              You got {score.correct} out of {score.total} correct ({(score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0)}%)
            </p>
          </div>
        )}

        <div className="flex justify-center gap-2 mt-4">
          {flashcards.map((_, i) => (
            <button key={i} onClick={() => { setCurrentIndex(i); setShowAnswer(false); }} className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentIndex ? "bg-primary" : "bg-outline-variant/40"}`} />
          ))}
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
        <h3 className="text-title-md text-on-surface mb-4">All Flashcards</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
          {flashcards.map((card, i) => (
            <div key={i} className="bg-surface rounded-xl p-4 border border-outline-variant/40">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary shrink-0 mt-0.5">help_outline</span>
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface font-medium">{card.question}</p>
                  <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">{card.answer}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${card.difficulty === "easy" ? "bg-tertiary/10 text-tertiary" : card.difficulty === "hard" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"}`}>{card.difficulty || "medium"}</span>
                    {card.page_ref && <span className="text-[11px] text-on-surface-variant">p. {card.page_ref}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FiguresTablesTab({ paperId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    extractFiguresTables(paperId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [paperId]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Spinner size={32} color="var(--color-primary)" />
    </div>
  );

  if (!data || (!data.figures?.length && !data.tables?.length)) {
    return (
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-3 block">table_chart</span>
        <p className="text-on-surface-variant mb-4">No figures or tables detected.</p>
        <button onClick={() => { setLoading(true); extractFiguresTables(paperId).then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }}
          className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity">
          Extract Figures & Tables
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[18px]">table_chart</span>
        </div>
        <h2 className="text-headline-md text-on-surface">Figures & Tables</h2>
      </div>
      {data.figures?.length > 0 && (
        <div>
          <h3 className="text-title-md font-semibold text-on-surface mb-3">Figures</h3>
          <div className="space-y-3">
            {data.figures.map((fig, i) => (
              <div key={i} className="bg-surface rounded-xl p-5 border border-outline-variant/40">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-[16px]">image</span>
                  <p className="text-body-md font-medium text-on-surface">{fig.label || `Figure ${i + 1}`}</p>
                </div>
                <p className="text-body-sm text-on-surface-variant">{fig.description || fig.text || JSON.stringify(fig)}</p>
                {fig.page_ref && <p className="text-[11px] text-on-surface-variant/60 mt-2">Page {fig.page_ref}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.tables?.length > 0 && (
        <div>
          <h3 className="text-title-md font-semibold text-on-surface mb-3">Tables</h3>
          <div className="space-y-3">
            {data.tables.map((tbl, i) => (
              <div key={i} className="bg-surface rounded-xl p-5 border border-outline-variant/40">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-[16px]">table_chart</span>
                  <p className="text-body-md font-medium text-on-surface">{tbl.label || `Table ${i + 1}`}</p>
                </div>
                <p className="text-body-sm text-on-surface-variant">{tbl.description || tbl.text || JSON.stringify(tbl)}</p>
                {tbl.page_ref && <p className="text-[11px] text-on-surface-variant/60 mt-2">Page {tbl.page_ref}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SimplifiedSummaryTab({ paperId }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [instruction, setInstruction] = useState("");

  useEffect(() => {
    generateSimplifiedSummary(paperId).then((r) => setSummary(r.simplified_summary || "")).catch(() => setSummary("")).finally(() => setLoading(false));
  }, [paperId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const r = await generateSimplifiedSummary(paperId, instruction);
      setSummary(r.simplified_summary || "");
      setInstruction("");
    } catch (e) { alert(e.message); }
    finally { setRegenerating(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Spinner size={32} color="var(--color-primary)" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[18px]">school</span>
        </div>
        <h2 className="text-headline-md text-on-surface">Explain Like I'm New</h2>
      </div>
      {summary ? (
        <div>
          <div className="text-body-lg text-on-surface-variant leading-relaxed whitespace-pre-line">{summary}</div>
          <div className="flex items-center gap-3 mt-4">
            <ListenSummaryButton text={summary} label="Simplified Summary" />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-3 block">school</span>
          <p className="text-on-surface-variant mb-4">No simplified summary available.</p>
          <button onClick={() => { setLoading(true); generateSimplifiedSummary(paperId).then((r) => setSummary(r.simplified_summary || "")).catch(() => setSummary("")).finally(() => setLoading(false)); }}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity">
            Generate Simplified Summary
          </button>
        </div>
      )}
      <div className="bg-surface rounded-xl p-4 border border-outline-variant/40">
        <p className="text-body-sm text-on-surface-variant mb-2">Customize the explanation:</p>
        <div className="flex gap-2">
          <input type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. explain for a high school student..."
            className="flex-1 border border-outline/60 rounded-lg px-3 py-2 text-body-sm bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-on-surface-variant/50" />
          <button onClick={handleRegenerate} disabled={regenerating}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg text-body-sm font-medium hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5 shrink-0">
            {regenerating ? <><Spinner size={12} color="currentColor" /> Generating...</> : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClickableAnswer({ text, onJumpPage }) {
  const parts = text.split(/(\[page \d+\])/g);
  return (
    <p className="text-body-md text-on-surface whitespace-pre-line leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/\[page (\d+)\]/);
        if (match) {
          const pageNum = parseInt(match[1]);
          return (
            <button key={i} onClick={() => onJumpPage(pageNum)}
              className="inline-flex items-center gap-0.5 text-primary font-semibold hover:underline mx-0.5">
              <span className="material-symbols-outlined text-[12px]">description</span>[page {pageNum}]
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function ListenSummaryButton({ text, label }) {
  const [speaking, setSpeaking] = useState(false);

  const handleToggle = () => {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button onClick={handleToggle}
      className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all border ${speaking ? "bg-primary/15 text-primary border-primary/20" : "text-on-surface-variant hover:text-primary border-outline-variant/40 hover:bg-surface-container"}`}>
      <span className="material-symbols-outlined text-[14px]" style={speaking ? { fontVariationSettings: "'FILL' 1" } : {}}>
        {speaking ? "stop" : "volume_up"}
      </span>
      {speaking ? "Stop" : `Listen to ${label || "Summary"}`}
    </button>
  );
}

function RegenerateButton({ paperId, section, currentText, onRegenerated }) {
  const [showInput, setShowInput] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [length, setLength] = useState("medium");

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const r = await regenerateSummary(paperId, section, instruction, length);
      onRegenerated(section, r.text);
      setShowInput(false);
      setInstruction("");
    } catch (e) {
      alert(e.message);
    } finally {
      setRegenerating(false);
    }
  };

  if (showInput) {
    return (
      <div className="flex flex-col gap-3 mt-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. make it shorter, focus on methodology..."
            className="flex-1 border border-outline/60 rounded-lg px-3 py-1.5 text-[12px] bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-on-surface-variant/50"
            onKeyDown={(e) => { if (e.key === "Enter") handleRegenerate(); if (e.key === "Escape") setShowInput(false); }}
            autoFocus
          />
          <button onClick={handleRegenerate} disabled={regenerating}
            className="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-[12px] font-medium hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5 shrink-0">
            {regenerating ? <><Spinner size={12} color="currentColor" /> Regenerating...</> : "Regenerate"}
          </button>
          <button onClick={() => { setShowInput(false); setInstruction(""); }}
            className="text-on-surface-variant hover:text-primary text-[12px] px-2 py-1.5 shrink-0">
            Cancel
          </button>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-on-surface-variant">
          <span className="shrink-0">Length:</span>
          <div className="flex gap-1 bg-surface-container rounded-lg p-0.5" role="radiogroup" aria-label="Summary length">
            {["short", "medium", "long"].map((l) => (
              <button key={l} onClick={() => setLength(l)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${length === l ? "bg-primary text-on-primary" : "hover:bg-surface-container-high"}`}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setShowInput(true)}
      className="flex items-center gap-1.5 text-[12px] text-on-surface-variant hover:text-primary mt-3 px-3 py-1.5 rounded-lg hover:bg-surface-container transition-colors border border-outline-variant/40">
      <span className="material-symbols-outlined text-[14px]">refresh</span>
      Regenerate
    </button>
  );
}

function TranslateButton({ paperId, section, currentText }) {
  const [showSelect, setShowSelect] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [targetLang, setTargetLang] = useState("es");

  const languages = [
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "pt", name: "Portuguese" },
    { code: "it", name: "Italian" },
    { code: "ru", name: "Russian" },
    { code: "ar", name: "Arabic" },
  ];

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const r = await translateSummary(paperId, section, targetLang);
      setTranslatedText(r.translated_summary);
    } catch (e) {
      alert(e.message);
    } finally {
      setTranslating(false);
    }
  };

  const copyTranslation = () => {
    navigator.clipboard.writeText(translatedText).then(() => alert("Translation copied!"));
  };

  if (showSelect) {
    return (
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
            className="border border-outline/60 rounded-lg px-3 py-1.5 text-[12px] bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary/20 outline-none">
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
          <button onClick={handleTranslate} disabled={translating}
            className="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-[12px] font-medium hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5 shrink-0">
            {translating ? <><Spinner size={12} color="currentColor" /> Translating...</> : "Translate"}
          </button>
          <button onClick={() => { setShowSelect(false); setTranslatedText(""); }}
            className="text-on-surface-variant hover:text-primary text-[12px] px-2 py-1.5 shrink-0">
            Cancel
          </button>
        </div>
        {translatedText && (
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-body-sm text-on-surface-variant">Translation ({languages.find(l => l.code === targetLang)?.name}):</span>
              <button onClick={copyTranslation} className="text-primary text-[12px] font-medium hover:underline">Copy</button>
            </div>
            <p className="text-body-sm text-on-surface whitespace-pre-line">{translatedText}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <button onClick={() => setShowSelect(true)}
      className="flex items-center gap-1.5 text-[12px] text-on-surface-variant hover:text-primary mt-3 px-3 py-1.5 rounded-lg hover:bg-surface-container transition-colors border border-outline-variant/40">
      <span className="material-symbols-outlined text-[14px]">translate</span>
      Translate
    </button>
  );
}

function ContradictionsTab({ paperId }) {
  const [contradictions, setContradictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    detectContradictions([paperId]).then(r => { setContradictions(r.contradictions || []); setLoading(false); }).catch(() => setLoading(false));
  }, [paperId]);

  if (loading) return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[18px]">compare</span>
        </div>
        <h2 className="text-headline-md text-on-surface">Contradiction Detection</h2>
      </div>
      {contradictions.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-3 block">check_circle</span>
          <p className="text-on-surface-variant">No contradictions found with other papers in your library.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contradictions.map((c, i) => (
            <div key={i} className="bg-error-container/30 border border-error/20 rounded-xl p-5">
              <h3 className="text-title-sm text-on-surface font-semibold mb-2">{c.contradiction}</h3>
              <p className="text-body-md text-on-surface-variant">{c.detail}</p>
              {c.papers?.length > 0 && (
                <p className="text-[11px] text-outline mt-2">Papers: {c.papers.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadNextTab({ paperId }) {
  const [recs, setRecs] = useState([]);
  const [reasoning, setReasoning] = useState("");
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    getReadNextRecommendations(paperId).then(r => {
      setRecs(r.recommendations || []);
      setReasoning(r.reasoning || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [paperId]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[18px]">recommend</span>
        </div>
        <h2 className="text-headline-md text-on-surface">What to Read Next</h2>
      </div>
      {reasoning && <p className="text-body-sm text-on-surface-variant mb-4 italic">{reasoning}</p>}
      {recs.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-3 block">auto_stories</span>
          <p className="text-on-surface-variant">Add more papers to your library to get personalized reading recommendations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((r, i) => (
            <button key={i} onClick={() => r.paper_id && nav(`/paper/${r.paper_id}`)}
              className="w-full text-left bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">open_in_new</span>
                <div>
                  <p className="text-body-md text-on-surface font-medium">{r.paper_id}</p>
                  <p className="text-body-sm text-on-surface-variant">{r.reason}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DangerZoneTab({ paperId, paper, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Permanently delete this paper? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`${API}/papers/${paperId}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      alert("Delete failed");
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-error/8 flex items-center justify-center">
          <span className="material-symbols-outlined text-error text-[18px]">warning</span>
        </div>
        <h2 className="text-headline-md text-on-surface">Danger Zone</h2>
      </div>
      <div className="bg-error-container/30 border border-error/20 rounded-xl p-6">
        <h3 className="text-title-sm text-on-surface font-semibold mb-2">Delete this paper</h3>
        <p className="text-body-md text-on-surface-variant mb-4">
          Permanently remove this paper and all associated data (notes, highlights, reading progress) from your library. This action cannot be undone.
        </p>
        <button onClick={handleDelete} disabled={deleting}
          className="px-5 py-2 bg-error text-on-error rounded-xl text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {deleting ? "Deleting..." : "Delete Paper Permanently"}
        </button>
      </div>
    </div>
  );
}

export default function PaperDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [paper, setPaper] = useState(null);
  const [thumbVersion, setThumbVersion] = useState(0);
  const [thumbModal, setThumbModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("executive");
  const [chat, setChat] = useState([]);
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const chatEnd = useRef(null);
  const [cite, setCite] = useState(null);
  const [citeStyle, setCiteStyle] = useState("apa");
  const [citing, setCiting] = useState(false);
  const [citeOpen, setCiteOpen] = useState(false);
  const citeRef = useRef(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [progress, setProgress] = useState({});

  const handleRegenerated = useCallback((section, text) => {
    setPaper((prev) => {
      if (!prev) return prev;
      const colMap = { executive: "executive_summary", detailed: "detailed_summary", findings: "key_findings" };
      return { ...prev, [colMap[section]]: text };
    });
  }, []);

  const handleActionRegenerate = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("action") === "regenerate") {
      urlParams.delete("action");
      window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);
      setTab("executive");
      setTimeout(() => {
        const event = new CustomEvent("trigger-regenerate");
        window.dispatchEvent(event);
      }, 100);
    }
  }, []);

  const handleTabParam = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    if (tabParam && TABS.some((t) => t.key === tabParam)) {
      setTab(tabParam);
      urlParams.delete("tab");
      window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);
    }
  }, []);

  useEffect(() => {
    handleActionRegenerate();
    handleTabParam();
  }, [handleActionRegenerate, handleTabParam]);

  useEffect(() => {
    setLoading(true); setChat([]); setProgress({});
    getPaper(id).then((p) => { setPaper(p); setProgress(p.reading_progress || {}); }).catch(() => setPaper(null)).finally(() => setLoading(false));
    getQaHistory(id).then((history) => {
      if (history?.length) {
        const restored = [];
        history.forEach((qa) => {
          restored.push({ role: "user", text: qa.question, id: `h-${qa.id}-q` });
          restored.push({ role: "ai", text: qa.answer, sources: qa.sources || [], follow_ups: qa.follow_ups || [], id: `h-${qa.id}-a` });
        });
        setChat(restored);
      }
    }).catch(() => {});
  }, [id]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, asking]);
  useEffect(() => {
    const h = (e) => { if (citeOpen && citeRef.current && !citeRef.current.contains(e.target)) setCiteOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [citeOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") { setChatOpen(false); setCiteOpen(false); setPdfOpen(false); }
      if (e.key === "ArrowLeft") { const i = TABS.findIndex((t) => t.key === tab); if (i > 0) setTab(TABS[i - 1].key); }
      if (e.key === "ArrowRight") { const i = TABS.findIndex((t) => t.key === tab); if (i < TABS.length - 1) setTab(TABS[i + 1].key); }
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9 && num <= TABS.length) { e.preventDefault(); setTab(TABS[num - 1].key); }
      if (e.key === "p" || e.key === "P") { e.preventDefault(); setPdfOpen((v) => !v); }
      if (e.key === "c" || e.key === "C") { e.preventDefault(); setCiteOpen((v) => !v); }
      if (e.key === "q" || e.key === "Q") { e.preventDefault(); setChatOpen((v) => !v); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [tab]);

  // Track reading progress
  useEffect(() => {
    if (tab && id) {
      updateReadingProgress(id, tab).catch(() => {});
      setProgress((p) => ({ ...p, [tab]: true }));
    }
  }, [tab, id]);

  const speakText = useCallback((text, msgIndex) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; utterance.pitch = 1;
    utterance.onstart = () => setSpeakingId(msgIndex);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => { window.speechSynthesis.cancel(); setSpeakingId(null); }, []);
  useEffect(() => { return () => { window.speechSynthesis.cancel(); }; }, []);

  const handleAsk = useCallback(async () => {
    if (!q.trim() || asking) return;
    const text = q.trim(); setQ("");
    setChat((p) => [...p, { role: "user", text }]); setAsking(true);
    try {
      const historyForApi = chat.map((m) => ({ role: m.role, text: m.text }));
      const r = await askQuestion(id, text, historyForApi);
      const aiMsg = { role: "ai", text: r.answer, sources: r.sources, follow_ups: r.follow_ups || [], id: Date.now() };
      setChat((p) => [...p, aiMsg]);
      if (voiceEnabled) setTimeout(() => speakText(r.answer, aiMsg.id), 300);
    } catch (e) { setChat((p) => [...p, { role: "ai", text: `Error: ${e.message}`, error: true, id: Date.now() }]); }
    finally { setAsking(false); }
  }, [id, q, asking, chat, voiceEnabled, speakText]);

  const handleCite = useCallback(async (style) => {
    setCiteStyle(style); setCiteOpen(false);
    if (!paper?.metadata) { setCite("Citation requires metadata."); return; }
    setCiting(true);
    try { const r = await getCitation(id, style); setCite(r.citation); }
    catch (e) { setCite(e.message); }
    finally { setCiting(false); }
  }, [id, paper]);

  const jumpToPage = useCallback((pageNum) => {
    setPdfOpen(true);
    setPdfPage(pageNum);
  }, []);

  const handleTextSelect = useCallback(async (text, pageNum) => {
    try {
      await createNote(id, text, pageNum);
      alert(`Note created on page ${pageNum}`);
      // Refresh notes if on notes tab
      // The NotesTab component will auto-reload on next visit
    } catch (e) {
      alert("Failed to create note: " + e.message);
    }
  }, [id]);

  if (loading) return <div className="max-w-[840px] mx-auto px-8 py-10 space-y-4"><div className="skeleton h-4 w-20" /><div className="skeleton h-10 w-3/4" /><div className="skeleton h-4 w-1/2" /><div className="skeleton h-64 w-full mt-8" /></div>;
  if (!paper) return <div className="flex flex-col items-center justify-center py-32 gap-4"><div className="w-20 h-20 bg-error-container/30 rounded-2xl flex items-center justify-center"><span className="material-symbols-outlined text-4xl text-error">error</span></div><p className="text-title-lg text-on-surface">Paper not found</p><button onClick={() => nav("/")} className="text-primary text-body-md font-medium hover:underline">Back to Library</button></div>;

  const meta = paper.metadata;
  const readability = meta?.readability;
  const sections = ["executive", "detailed", "findings", "elements"];
  const sectionsRead = sections.filter((s) => progress[s]).length;

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

  return (
    <>
      <div className={`transition-all duration-300 ${chatOpen ? "lg:mr-[420px]" : ""} ${pdfOpen ? "xl:mr-[860px]" : ""}`}>
        <div className="bg-primary px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-on-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <p className="text-on-primary font-semibold" style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}>AI-Generated Summary — For Personal Use Only</p>
          </div>
          <div className="flex items-center gap-2">
            {paper.source_file && (
              <button onClick={() => setPdfOpen((v) => !v)}
                className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-[12px] font-medium">
                <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>{pdfOpen ? "Hide PDF" : "View PDF"}
              </button>
            )}
            <button onClick={() => exportPaperMarkdown(id)} className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-[12px] font-medium">
              <span className="material-symbols-outlined text-[15px]">download</span>Export
            </button>
            <label className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-[12px] font-medium cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try { await uploadThumbnail(id, file); setThumbVersion(v => v + 1); } catch (err) { alert(err.message); }
              }} />
              <span className="material-symbols-outlined text-[15px]">image</span>Thumbnail
            </label>
            <button onClick={() => {
              const summary = [paper.executive_summary, paper.detailed_summary, paper.key_findings].filter(Boolean).join("\n\n---\n\n");
              navigator.clipboard.writeText(summary || "No summary available");
              alert("Summary copied as Markdown!");
            }} className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-[12px] font-medium">
              <span className="material-symbols-outlined text-[15px]">content_copy</span>Copy Summary
            </button>
            <button onClick={() => setChatOpen((v) => !v)} className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-[12px] font-medium">
              <span className="material-symbols-outlined text-[15px]">chat</span>{chatOpen ? "Hide Chat" : "Ask AI"}
            </button>
            <button onClick={() => setCiteOpen((v) => !v)} className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-[12px] font-medium">
              <span className="material-symbols-outlined text-[15px]">format_quote</span>Cite
            </button>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/${id}`); alert("Share link copied!"); }}
              className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-[12px] font-medium">
              <span className="material-symbols-outlined text-[15px]">share</span>Share
            </button>
            {!readability && paper.source_file && (
              <button onClick={async () => { try { await computeReadability(id); alert("Readability computed!"); } catch (e) { alert(e.message); } }}
                className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-[12px] font-medium">
                <span className="material-symbols-outlined text-[15px]">menu_book</span>Readability
              </button>
            )}
            {paper.executive_summary && (
              <button onClick={async () => { try { const r = await suggestTags(id); alert("Suggested tags: " + r.suggested_tags.join(", ")); } catch (e) { alert(e.message); } }}
                className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-[12px] font-medium">
                <span className="material-symbols-outlined text-[15px]">label</span>Suggest Tags
              </button>
            )}
          </div>
        </div>

        <div className="max-w-[840px] mx-auto px-8 py-10">
          <button onClick={() => nav("/")} className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-body-md font-medium mb-6">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>Library
          </button>

          <div className="mb-8">
            <div className="flex items-start gap-6">
              <div className="relative group shrink-0">
                <button
                  onClick={() => { const u = getPaperThumbnailUrl(id); fetch(u, { method: "HEAD" }).then(r => { if (r.ok) { setThumbModal(u + "?v=" + thumbVersion); } }); }}
                  className="block w-28 h-36 rounded-xl overflow-hidden bg-surface-container border border-outline-variant/40 hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
                >
                  <PaperThumb paperId={id} thumbVersion={thumbVersion} />
                </button>
                <label className="absolute bottom-1.5 right-1.5 w-7 h-7 bg-surface-container border border-outline-variant/60 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-surface-container-high">
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try { await uploadThumbnail(id, file); setThumbVersion(v => v + 1); } catch (err) { alert(err.message); }
                  }} />
                  <span className="material-symbols-outlined text-on-surface-variant text-[15px]">edit</span>
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <SourceBadge paper={paper} />
              {meta?.published_date && <span className="text-body-sm text-on-surface-variant">{new Date(meta.published_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>}
              {!meta?.published_date && paper.created_at && <span className="text-body-sm text-on-surface-variant">Added {new Date(paper.created_at * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>}
              <button onClick={async () => { const r = await togglePin(id); setPaper(p => ({ ...p, metadata: { ...p.metadata, pinned: r.pinned } })); }}
                className={`ml-auto flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${paper?.metadata?.pinned ? "bg-primary/10 border-primary/40 text-primary" : "border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-primary"}`}>
                <span className="material-symbols-outlined text-[14px]">{paper?.metadata?.pinned ? "push_pin" : "push_pin"}</span>
                {paper?.metadata?.pinned ? "Pinned" : "Pin"}
              </button>
              <span className="text-[11px] text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-lg">{sectionsRead}/{sections.length} sections read</span>
            </div>
            <h1 className="text-headline-lg text-on-surface mb-4 leading-tight">{paper.filename || "Untitled Paper"}</h1>
            {meta?.authors?.length > 0 && <div className="mb-4"><div className="flex flex-wrap gap-x-4 gap-y-1.5">{meta.authors.map((author, i) => (
              <span key={i} className="text-body-md text-on-surface-variant flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-primary/8 text-primary text-[11px] font-semibold flex items-center justify-center">{author.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>{author}
              </span>
            ))}</div></div>}
            {meta?.abstract && <div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/40 mt-4"><p className="text-[11px] font-semibold text-outline uppercase tracking-wider mb-2">Abstract</p><p className="text-body-md text-on-surface-variant leading-relaxed">{meta.abstract}</p></div>}
            <div className="flex gap-4 mt-5 flex-wrap">
              {meta?.categories?.length > 0 && <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant"><span className="material-symbols-outlined text-[16px]">category</span>{meta.categories.join(", ")}</div>}
              {meta?.journal && <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant"><span className="material-symbols-outlined text-[16px]">book</span>{meta.journal}</div>}
              {meta?.doi && <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant"><span className="material-symbols-outlined text-[16px]">link</span><span className="truncate max-w-[200px]">{meta.doi}</span></div>}
              {readability && readability.difficulty_label && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getDifficultyColor(readability.difficulty_label)} flex items-center gap-1 ml-auto`}>
                  <span className="material-symbols-outlined text-[12px]">menu_book</span>
                  {readability.difficulty_label}
                  {readability.flesch_kincaid_grade !== null && <span>(Gr {readability.flesch_kincaid_grade})</span>}
                </span>
              )}
            </div>
              </div>
            </div>
          </div>

          <div className="flex gap-1 border-b border-outline-variant/60 mb-8 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`relative px-4 py-3.5 text-body-md font-medium transition-colors shrink-0 flex items-center gap-2 ${tab === t.key ? "text-primary tab-active" : "text-on-surface-variant hover:text-on-surface"}`}>
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>{t.label}
                {progress[t.key] && <span className="w-1.5 h-1.5 rounded-full bg-success ml-1" />}
              </button>
            ))}
          </div>

          <article className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8 chat-glow">
            {tab === "executive" && <div><div className="flex items-center gap-3 mb-5"><div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-[18px]">summarize</span></div><h2 className="text-headline-md text-on-surface">Executive Summary</h2></div><div className="text-body-lg text-on-surface-variant leading-relaxed whitespace-pre-line">{paper.executive_summary || <div className="text-center py-12"><span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-3 block">description</span><p className="text-on-surface-variant">No executive summary available.</p></div>}</div>{paper.executive_summary && <div className="flex items-center gap-3 mt-3"><ListenSummaryButton text={paper.executive_summary} label="Executive Summary" /><RegenerateButton paperId={id} section="executive" currentText={paper.executive_summary} onRegenerated={handleRegenerated} /><TranslateButton paperId={id} section="executive" currentText={paper.executive_summary} /></div>}{paper.executive_summary && <div className="mt-6 pt-6 border-t border-outline-variant/40"><h3 className="text-title-md font-semibold text-on-surface mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-primary">word_cloud</span>Key Terms</h3><WordCloud text={paper.executive_summary} /></div>}</div>}
            {tab === "detailed" && <div><div className="flex items-center gap-3 mb-5"><div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-[18px]">article</span></div><h2 className="text-headline-md text-on-surface">Detailed Summary</h2></div><div className="text-body-lg text-on-surface-variant leading-relaxed whitespace-pre-line">{paper.detailed_summary || <div className="text-center py-12"><span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-3 block">description</span><p className="text-on-surface-variant">No detailed summary available.</p></div>}</div>{paper.detailed_summary && <div className="flex items-center gap-3 mt-3"><ListenSummaryButton text={paper.detailed_summary} label="Detailed Summary" /><RegenerateButton paperId={id} section="detailed" currentText={paper.detailed_summary} onRegenerated={handleRegenerated} /><TranslateButton paperId={id} section="detailed" currentText={paper.detailed_summary} /></div>}</div>}
            {tab === "findings" && <div><div className="flex items-center gap-3 mb-5"><div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-[18px]">science</span></div><h2 className="text-headline-md text-on-surface">Key Findings</h2></div><div className="text-body-lg text-on-surface-variant leading-relaxed whitespace-pre-line">{paper.key_findings || <div className="text-center py-12"><span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-3 block">description</span><p className="text-on-surface-variant">No key findings available.</p></div>}</div>{paper.key_findings && <div className="flex items-center gap-3 mt-3"><ListenSummaryButton text={paper.key_findings} label="Key Findings" /><RegenerateButton paperId={id} section="findings" currentText={paper.key_findings} onRegenerated={handleRegenerated} /><TranslateButton paperId={id} section="findings" currentText={paper.key_findings} /></div>}</div>}
            {tab === "elements" && <div><div className="flex items-center gap-3 mb-5"><div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-[18px]">category</span></div><h2 className="text-headline-md text-on-surface">Key Elements</h2></div>{paper.key_elements ? <div className="space-y-4">{Object.entries(paper.key_elements).map(([key, val]) => (<div key={key} className="bg-surface rounded-xl p-5 border border-outline-variant/40"><h3 className="text-label-caps text-primary mb-2" style={{ textTransform: "uppercase" }}>{key.replace(/_/g, " ")}</h3><div className="text-body-md text-on-surface whitespace-pre-line leading-relaxed">{Array.isArray(val) ? val.map((item, i) => (<p key={i} className="mb-1.5 flex gap-2"><span className="text-primary shrink-0 mt-0.5">•</span><span>{item}</span></p>)) : val}</div></div>))}</div> : <div className="text-center py-12"><span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-3 block">category</span><p className="text-on-surface-variant">No key elements available.</p></div>}</div>}
            {tab === "notes" && <NotesTab paperId={id} />}
            {tab === "flashcards" && <FlashcardsTab paperId={id} />}
            {tab === "figures" && <FiguresTablesTab paperId={id} />}
            {tab === "simplified" && <SimplifiedSummaryTab paperId={id} />}
            {tab === "contradictions" && <ContradictionsTab paperId={id} />}
            {tab === "read-next" && <ReadNextTab paperId={id} />}
            {tab === "danger" && <DangerZoneTab paperId={id} paper={paper} onDeleted={() => navigate("/")} />}
          </article>

          {paper.attribution_report && Object.keys(paper.attribution_report).length > 0 && (
            <div className="mt-8 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-5"><div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center"><span className="material-symbols-outlined text-secondary text-[18px]">verified</span></div><h2 className="text-headline-md text-on-surface">Source Attribution</h2></div>
              <div className="space-y-3">{Object.entries(paper.attribution_report).map(([field, r]) => (
                <div key={field} className="bg-surface rounded-xl p-4 border border-outline-variant/40">
                  <div className="flex items-center justify-between mb-2"><span className="text-label-caps text-outline" style={{ textTransform: "uppercase" }}>{field.replace(/_/g, " ")}</span><span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${r.flagged > 0 ? "bg-secondary/10 text-secondary" : "bg-tertiary/10 text-tertiary"}`}>{r.supported}/{r.total_sentences} supported</span></div>
                  {r.flagged_details?.length > 0 && <ul className="text-[12px] text-secondary list-disc list-inside space-y-0.5">{r.flagged_details.map((f, i) => <li key={i} className="line-clamp-1">&quot;{f.sentence}&quot;</li>)}</ul>}
                </div>
              ))}</div>
            </div>
          )}

          <RelatedPapers paperId={id} />
          <CitationGraph paperId={id} />
          <div className="h-8" />
        </div>
      </div>

      {/* PDF Viewer Panel */}
      {pdfOpen && (
        <aside className="fixed right-0 top-16 h-[calc(100vh-64px)] w-[440px] bg-surface-container-lowest border-l border-outline-variant/60 flex flex-col z-30 shadow-xl shadow-black/5">
          <div className="p-3 border-b border-outline-variant/40 flex items-center justify-between shrink-0">
            <span className="text-title-md font-semibold text-on-surface">Source Document</span>
            <button onClick={() => setPdfOpen(false)} className="w-8 h-8 rounded-lg hover:bg-surface-container-low flex items-center justify-center"><span className="material-symbols-outlined text-on-surface-variant text-[20px]">close</span></button>
          </div>
          <div className="flex-1 overflow-hidden">
            <PdfViewer paperId={id} currentPage={pdfPage} onPageChange={setPdfPage} onTextSelect={handleTextSelect} />
          </div>
        </aside>
      )}

      {citeOpen && (
        <div ref={citeRef} className="fixed top-24 right-8 z-50 w-80 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-outline-variant/40"><p className="text-title-md font-semibold text-on-surface mb-1">Cite this paper</p><p className="text-body-sm text-on-surface-variant">Choose a citation format</p></div>
          <div className="flex gap-1 p-2.5 border-b border-outline-variant/40">{STYLES.map((s) => (<button key={s} onClick={() => handleCite(s)} disabled={citing} className={`px-3 py-1.5 text-[12px] rounded-lg font-semibold transition-all ${citeStyle === s ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container-low"}`}>{s.toUpperCase()}</button>))}</div>
          <div className="p-4">{citing ? <div className="flex items-center gap-2 text-on-surface-variant text-[12px]"><Spinner size={14} color="var(--color-primary)" />Generating...</div> : cite ? <pre className="text-[11px] text-on-surface-variant whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-y-auto custom-scrollbar" style={{ fontFamily: "var(--font-family-mono)" }}>{cite}</pre> : <p className="text-[12px] text-on-surface-variant">Select a style above to generate.</p>}</div>
        </div>
      )}

      {chatOpen && (
        <aside className="fixed right-0 top-16 h-[calc(100vh-64px)] w-[420px] bg-surface-container-lowest border-l border-outline-variant/60 flex flex-col z-30 shadow-xl shadow-black/5">
          <div className="p-5 border-b border-outline-variant/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span></div>
              <div><h2 className="text-title-md font-semibold text-on-surface">Ask about this paper</h2><p className="text-[11px] text-on-surface-variant">Grounded in document with citations</p></div>
            </div>
            <button onClick={() => setChatOpen(false)} className="w-8 h-8 rounded-lg hover:bg-surface-container-low flex items-center justify-center"><span className="material-symbols-outlined text-on-surface-variant text-[20px]">close</span></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
            {chat.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                <div className="w-14 h-14 bg-primary/8 rounded-2xl flex items-center justify-center"><span className="material-symbols-outlined text-3xl text-primary/40">chat</span></div>
                <p className="text-body-md text-on-surface-variant leading-relaxed">Ask anything about this paper. Answers are grounded in the document with cited page numbers.</p>
                <div className="flex flex-wrap gap-2 mt-2">{["What is the main contribution?", "Summarize the methodology", "What are the limitations?"].map((suggestion, i) => (
                  <button key={i} onClick={() => setQ(suggestion)} className="text-[12px] text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors border border-primary/10">{suggestion}</button>
                ))}</div>
              </div>
            )}
            {chat.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.role === "ai" && (
                  <div className="flex items-start gap-2.5 max-w-[88%]">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 shrink-0 flex items-center justify-center mt-0.5"><span className="material-symbols-outlined text-primary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span></div>
                    <div className={`border rounded-2xl rounded-tl-md p-4 ${msg.error ? "border-error/20 bg-error/5 text-error" : "border-outline-variant/60 bg-surface-container-lowest chat-glow"}`}>
                      <ClickableAnswer text={msg.text} onJumpPage={jumpToPage} />
                      {msg.sources?.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1">{msg.sources.map((pg, pi) => (
                        <button key={pi} onClick={() => jumpToPage(pg)} className="inline-flex items-center px-2 py-0.5 rounded-md bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-bold hover:opacity-80">p.{pg}</button>
                      ))}</div>}
                      {msg.follow_ups?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">{msg.follow_ups.map((fq, fi) => (
                          <button key={fi} onClick={() => setQ(fq)} className="text-[11px] text-primary bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-lg transition-colors border border-primary/10">{fq}</button>
                        ))}</div>
                      )}
                      {!msg.error && msg.text && (
                        <button onClick={() => speakingId === msg.id ? stopSpeaking() : speakText(msg.text, msg.id)}
                          className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all ${speakingId === msg.id ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"}`}>
                          <span className="material-symbols-outlined text-[14px]" style={speakingId === msg.id ? { fontVariationSettings: "'FILL' 1" } : {}}>volume_up</span>
                          {speakingId === msg.id ? "Stop" : "Listen"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {msg.role === "user" && <div className="bg-primary text-on-primary px-4 py-3 rounded-2xl rounded-tr-md max-w-[80%]"><p className="text-body-md">{msg.text}</p></div>}
                <span className="text-[10px] text-outline mt-1 ml-9 uppercase font-semibold tracking-wider">{msg.role === "user" ? "You" : "AI"}</span>
              </div>
            ))}
            {asking && <div className="flex items-start gap-2.5"><div className="w-7 h-7 rounded-lg bg-primary/10 shrink-0 flex items-center justify-center mt-0.5"><span className="material-symbols-outlined text-primary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span></div><div className="border border-outline-variant/60 bg-surface-container-lowest p-4 rounded-2xl rounded-tl-md chat-glow flex items-center gap-2.5"><div className="flex gap-1 pulse-dot"><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0s" }} /><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} /><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} /></div><span className="text-body-md text-on-surface-variant">Thinking...</span></div></div>}
            <div ref={chatEnd} />
          </div>

          <div className="p-5 border-t border-outline-variant/40 bg-surface-container-lowest">
            <div className="flex items-end gap-2 bg-surface-container-lowest border border-outline/60 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
              <textarea className="flex-1 border-0 focus:ring-0 text-body-md py-2 px-2.5 resize-none bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant/40"
                onInput={(e) => { e.target.style.height = ""; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                placeholder="Ask a question..." rows="1" value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }} disabled={asking} />
              <button onClick={handleAsk} disabled={asking || !q.trim()}
                className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 mb-0.5 mr-0.5 transition-all hover:opacity-90 active:scale-90 disabled:opacity-30">
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </div>
            <div className="flex items-center gap-5 mt-3 px-1">
              <button onClick={() => { setVoiceEnabled((v) => !v); if (voiceEnabled) stopSpeaking(); }}
                className={`flex items-center gap-1.5 transition-colors ${voiceEnabled ? "text-primary" : "text-on-surface-variant hover:text-primary"}`}>
                <span className="material-symbols-outlined text-[16px]" style={voiceEnabled ? { fontVariationSettings: "'FILL' 1" } : {}}>volume_up</span>
                <span className="text-[11px] font-medium">{voiceEnabled ? "Voice On" : "Voice"}</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {!chatOpen && !pdfOpen && (
        <button onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-on-primary rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center z-50 hover:scale-105 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-2xl">chat</span>
        </button>
      )}

      {thumbModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8" onClick={() => setThumbModal(null)}>
          <button onClick={() => setThumbModal(null)} className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-white text-[24px]">close</span>
          </button>
          <img src={thumbModal} alt="Thumbnail" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
