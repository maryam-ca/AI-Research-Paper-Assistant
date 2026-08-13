import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Star } from 'lucide-react';
import PaperCardMenu from './PaperCardMenu';
import { useAppStore } from '../store/appStore';
import apiClient from '../api/client';

export default function PaperCard({ paper, selected, onToggleSelect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const navigate = useNavigate();

  function statusClass(status) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'reading': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
    case 'reviewed': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300';
    default: return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300';
  }
}

const toggleFavorite = async (e) => {
    e.stopPropagation();
    setFavorite((v) => !v);
    try {
      await apiClient.post(`/papers/${paper.id}/activity`, {
        action: 'favorite',
        details: favorite ? 'unstarred' : 'starred',
      });
    } catch (_) { /* non-critical */ }
  };

  return (
    <div
      className="card group relative cursor-pointer transition hover:shadow-md"
      onClick={() => navigate(`/paper/${paper.id}`)}
    >
      <div className="relative h-40 overflow-hidden bg-slate-200 dark:bg-slate-700">
        {paper.thumbnail_url ? (
          <img src={`${apiClient.baseUrl}/papers/${paper.id}/thumbnail`} alt={paper.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">No preview</div>
        )}
        <button
          className="absolute right-2 top-2 rounded-full bg-white/80 p-1 hover:bg-white dark:bg-slate-900/70"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          aria-label="Paper menu"
        >
          <MoreVertical size={16} />
        </button>
        <div className="absolute left-2 top-2 flex gap-1">
          <button
            className="rounded-full bg-white/80 p-1 hover:bg-white dark:bg-slate-900/70"
            onClick={toggleFavorite}
            aria-label="Favorite"
          >
            <Star size={16} className={favorite ? 'fill-terracotta text-terracotta' : ''} />
          </button>
          {onToggleSelect && (
            <label
              className="flex items-center rounded-full bg-white/80 px-1.5 py-1 text-xs text-slate-700 hover:bg-white dark:bg-slate-900/70 dark:text-cream"
              onClick={(e) => e.stopPropagation()}
            >
              <input type="checkbox" checked={!!selected} onChange={() => onToggleSelect(paper.id)} className="accent-terracotta" />
            </label>
          )}
        </div>
        {menuOpen && <PaperCardMenu paper={paper} onClose={() => setMenuOpen(false)} />}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 font-display text-sm font-bold leading-snug">{paper.title}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
          {paper.authors ? paper.authors.slice(0, 3).join(', ') : 'Unknown authors'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`badge badge-${paper.source_type || 'pdf'}`}>{paper.source_type}</span>
          {paper.complexity_level && (
            <span className={`badge ${paper.complexity_level === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : paper.complexity_level === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
              {paper.complexity_level}
            </span>
          )}
          {paper.bias_risk && (
            <span className={`badge ${paper.bias_risk === 'low' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : paper.bias_risk === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}`}>
              {paper.bias_risk} bias
            </span>
          )}
          <span className={`badge ${statusClass(paper.reading_status)}`}>{paper.reading_status || 'not_started'}</span>
          <span className="text-[11px] text-slate-400">
            {paper.upload_date ? new Date(paper.upload_date).toLocaleDateString() : ''}
          </span>
        </div>
        {paper.keywords && paper.keywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {paper.keywords.slice(0, 4).map((k) => (
              <button
                key={k}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-primary-50 hover:text-primary dark:bg-slate-700 dark:text-slate-300"
                onClick={(e) => { e.stopPropagation(); navigate(`/?topic=${encodeURIComponent(k)}`); }}
              >
                #{k}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
