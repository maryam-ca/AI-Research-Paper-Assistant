import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, GitCompare, LayoutGrid, List, Trash2, X, CheckSquare, BookOpen, Table2 } from 'lucide-react';
import apiClient from '../api/client';
import { useAppStore } from '../store/appStore';
import PaperCard from '../components/PaperCard';
import PaperRow from '../components/PaperRow';
import UploadCard from '../components/UploadCard';
import FetchCard from '../components/FetchCard';
import LiteratureReviewModal from '../components/LiteratureReviewModal';
import CompareMatrixModal from '../components/CompareMatrixModal';
import ResearchQuestionsModal from '../components/ResearchQuestionsModal';

export default function LibraryPage() {
  const { papers, setPapers, toggleCompare, compareSelection, setCompareOpen, removePaper, collections } = useAppStore();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('grid');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [complexity, setComplexity] = useState('');
  const [bias, setBias] = useState('');
  const [source, setSource] = useState('');
  const [year, setYear] = useState('');
  const [params, setParams] = useSearchParams();
  const collectionId = params.get('collection');
  const topic = params.get('topic') || '';
  const [lrOpen, setLrOpen] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [rqOpen, setRqOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      let list = await apiClient.get('/papers');
      if (collectionId) {
        const inColl = await apiClient.get(`/collections/${collectionId}/papers`);
        const ids = new Set(inColl.map((p) => p.id));
        list = list.filter((p) => ids.has(p.id));
      }
      setPapers(list);
    };
    load().catch((e) => alert(e.message));
  }, [collectionId, setPapers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = papers.filter((p) => {
      const hay = `${p.title || ''} ${p.abstract || ''} ${(p.keywords || []).join(' ')}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (status && (p.reading_status || 'not_started') !== status) return false;
      if (complexity && p.complexity_level !== complexity) return false;
      if (bias && (p.bias_risk || 'medium') !== bias) return false;
      if (source && p.source_type !== source) return false;
      if (year && p.upload_date && new Date(p.upload_date).getFullYear() !== parseInt(year, 10)) return false;
      if (topic && !(p.keywords || []).some((k) => k.toLowerCase() === topic.toLowerCase())) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'newest') return new Date(b.upload_date) - new Date(a.upload_date);
      return (a.title || '').localeCompare(b.title || '');
    });
    return list;
  }, [papers, search, sort, status, complexity, source, topic]);

  const clearTopic = () => {
    const next = new URLSearchParams(params);
    next.delete('topic');
    setParams(next);
  };

  const bulkDelete = async () => {
    if (compareSelection.length === 0) return;
    if (!confirm(`Delete ${compareSelection.length} selected paper(s)? This cannot be undone.`)) return;
    setBusy(true);
    try {
      for (const id of [...compareSelection]) {
        await apiClient.del(`/papers/${id}`);
        removePaper(id);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSelectAll = () => {
    if (compareSelection.length === filtered.length) {
      filtered.forEach((p) => { if (compareSelection.includes(p.id)) toggleCompare(p.id); });
    } else {
      filtered.forEach((p) => { if (!compareSelection.includes(p.id)) toggleCompare(p.id); });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <UploadCard />
        <FetchCard />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search title, abstract, keywords…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Status: All</option>
          <option value="not_started">Not started</option>
          <option value="reading">Reading</option>
          <option value="reviewed">Reviewed</option>
          <option value="completed">Completed</option>
        </select>
        <select className="input w-36" value={complexity} onChange={(e) => setComplexity(e.target.value)}>
          <option value="">Complexity: All</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select className="input w-36" value={bias} onChange={(e) => setBias(e.target.value)}>
          <option value="">Bias: All</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select className="input w-32" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Source: All</option>
          <option value="pdf">PDF</option>
          <option value="arxiv">arXiv</option>
          <option value="doi">DOI</option>
          <option value="url">Link</option>
        </select>
        <input className="input w-24" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
        <select className="input w-40" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest</option>
          <option value="title">Title A–Z</option>
        </select>

        <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-600">
          <button className={`rounded-l-lg p-2 ${view === 'grid' ? 'bg-primary text-white' : 'text-slate-500'}`} title="Grid view" onClick={() => setView('grid')}>
            <LayoutGrid size={16} />
          </button>
          <button className={`rounded-r-lg p-2 ${view === 'list' ? 'bg-primary text-white' : 'text-slate-500'}`} title="List view" onClick={() => setView('list')}>
            <List size={16} />
          </button>
        </div>

        <button className="btn-primary" onClick={() => setCompareOpen(true)}>
          <GitCompare size={16} /> Compare ({compareSelection.length})
        </button>
        {collectionId && (
          <button className="btn-ghost" onClick={() => setLrOpen(true)}>
            <BookOpen size={16} /> Literature Review
          </button>
        )}
        {collectionId && (
          <button className="btn-ghost" onClick={() => setRqOpen(true)}>
            <Check size={16} /> Research Questions
          </button>
        )}
        {compareSelection.length >= 2 && (
          <button className="btn-ghost" onClick={() => setMatrixOpen(true)}>
            <Table2 size={16} /> Methodology Matrix
          </button>
        )}
      </div>

      {topic && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-primary dark:bg-primary-700/30">Topic: #{topic}</span>
          <button className="btn-ghost text-sm" onClick={clearTopic}>Clear</button>
        </div>
      )}

      {compareSelection.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/40 dark:bg-red-900/10">
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            {compareSelection.length} selected
          </span>
          <button className="btn-ghost text-sm" onClick={toggleSelectAll}>
            <CheckSquare size={15} /> {compareSelection.length === filtered.length ? 'Clear' : 'Select all'}
          </button>
          <button className="btn-ghost text-sm text-red-600" onClick={bulkDelete} disabled={busy}>
            <Trash2 size={15} /> {busy ? 'Deleting…' : 'Delete selected'}
          </button>
          <button className="btn-ghost text-sm" onClick={() => compareSelection.forEach((id) => toggleCompare(id))}>
            <X size={15} /> Cancel
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">No papers yet. Upload or fetch a paper to get started.</div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <PaperCard
              key={p.id}
              paper={p}
              selected={compareSelection.includes(p.id)}
              onToggleSelect={toggleCompare}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:bg-slate-800/60">
            <span className="w-4" />
            <span className="w-12" />
            <span className="flex-1">Title</span>
            <span className="hidden sm:block">Source</span>
            <span className="hidden w-24 text-right md:block">Date</span>
            <span className="w-[88px] text-right">Actions</span>
          </div>
          {filtered.map((p) => (
            <PaperRow
              key={p.id}
              paper={p}
              selected={compareSelection.includes(p.id)}
              onToggleSelect={toggleCompare}
            />
          ))}
        </div>
      )}

      {lrOpen && collectionId && (
        <LiteratureReviewModal
          collectionId={collectionId}
          name={collections.find((c) => c.id === collectionId)?.name || 'Collection'}
          onClose={() => setLrOpen(false)}
        />
      )}
      {matrixOpen && (
        <CompareMatrixModal paperIds={compareSelection} onClose={() => setMatrixOpen(false)} />
      )}
      {rqOpen && collectionId && (
        <ResearchQuestionsModal
          collectionId={collectionId}
          name={collections.find((c) => c.id === collectionId)?.name || 'Collection'}
          onClose={() => setRqOpen(false)}
        />
      )}
    </div>
  );
}
