import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Share2, Users, FileDown, FolderPlus, Image, Trash2,
} from 'lucide-react';
import apiClient from '../api/client';
import { useAppStore } from '../store/appStore';

export default function PaperCardMenu({ paper, onClose }) {
  const ref = useRef(null);
  const { collections, removePaper } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const call = async (fn) => {
    try {
      await fn();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div
      ref={ref}
      className="absolute right-2 top-10 z-20 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 text-sm shadow-lg"
    >
      <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
        onClick={() => call(async () => { await apiClient.post(`/papers/${paper.id}/analyze`); alert('Analysis re-run'); })}>
        <RefreshCw size={15} /> Regenerate Summary
      </button>
      <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
        onClick={() => call(async () => { const md = await apiClient.get(`/papers/${paper.id}/export`); navigator.clipboard.writeText(md); alert('Markdown copied to clipboard'); })}>
        <FileDown size={15} /> Export Markdown
      </button>
      <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
        onClick={() => navigate(`/paper/${paper.id}`)}>
        <Users size={15} /> View Related Papers
      </button>
      <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
        onClick={() => call(async () => { const data = await apiClient.get(`/papers/${paper.id}/summary`); navigator.clipboard.writeText(data.executive_summary || ''); alert('Digest copied to clipboard'); })}>
        <Share2 size={15} /> Share Digest
      </button>

      <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
      <div className="px-3 py-1 text-xs uppercase tracking-wide text-slate-400">Add to collection</div>
      {collections.map((c) => (
        <button key={c.id} className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
          onClick={() => call(async () => { await apiClient.post(`/collections/${c.id}/papers`, { paper_id: paper.id }); alert(`Added to ${c.name}`); })}>
          <FolderPlus size={15} /> {c.name}
        </button>
      ))}

      <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
      <label className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10">
        <Image size={15} /> Change Thumbnail
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => call(async () => {
            const f = e.target.files[0];
            if (f) { await apiClient.upload(`/papers/${paper.id}/thumbnail`, f); alert('Thumbnail updated'); }
          })}
        />
      </label>
      <button className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        onClick={() => call(async () => {
          if (confirm('Delete this paper? This removes the paper and all related data.')) {
            await apiClient.del(`/papers/${paper.id}`);
            removePaper(paper.id);
            onClose();
          }
        })}>
        <Trash2 size={15} /> Delete
      </button>
    </div>
  );
}
