import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Star, Trash2, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import apiClient from '../api/client';

export default function PaperRow({ paper, selected, onToggleSelect }) {
  const [favorite, setFavorite] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { removePaper } = useAppStore();

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

  const onDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this paper? This removes the paper and all related data.')) return;
    setDeleting(true);
    try {
      await apiClient.del(`/papers/${paper.id}`);
      removePaper(paper.id);
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  };

  const iconBtn =
    'rounded-md p-1.5 text-slate-500 hover:bg-black/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white';

  return (
    <div
      className={`group flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-3 py-2.5 last:border-0 ${
        selected ? 'bg-primary-50 dark:bg-primary-700/20' : 'hover:bg-black/[0.02] dark:hover:bg-white/5'
      } cursor-pointer`}
      onClick={() => navigate(`/paper/${paper.id}`)}
    >
      <input
        type="checkbox"
        checked={!!selected}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggleSelect(paper.id)}
        className="accent-primary"
        aria-label="Select paper"
      />

      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 dark:bg-slate-700">
        {paper.thumbnail_url ? (
          <img src={`${apiClient.baseUrl}/papers/${paper.id}/thumbnail`} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText size={20} className="text-slate-400" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-sm font-bold leading-snug">{paper.title}</h3>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {paper.authors ? paper.authors.slice(0, 3).join(', ') : 'Unknown authors'}
        </p>
      </div>

      <span className={`badge badge-${paper.source_type || 'pdf'} hidden sm:inline-flex`}>{paper.source_type}</span>
      <span className="hidden w-24 shrink-0 text-right text-[11px] text-slate-400 md:block">
        {paper.upload_date ? new Date(paper.upload_date).toLocaleDateString() : ''}
      </span>

      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button className={iconBtn} title="Open" onClick={() => navigate(`/paper/${paper.id}`)}>
          <Eye size={16} />
        </button>
        <button className={iconBtn} title="Favorite" onClick={toggleFavorite}>
          <Star size={16} className={favorite ? 'fill-terracotta text-terracotta' : ''} />
        </button>
        <button
          className={`${iconBtn} ${deleting ? 'opacity-50' : ''}`}
          title="Delete"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
