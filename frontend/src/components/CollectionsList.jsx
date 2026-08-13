import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Folder, Download } from 'lucide-react';
import apiClient from '../api/client';
import { useAppStore } from '../store/appStore';

export default function CollectionsList() {
  const { collections, setCollections } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [exporting, setExporting] = useState(null);
  const navigate = useNavigate();

  const exportCollection = async (e, c) => {
    e.stopPropagation();
    setExporting(c.id);
    try {
      const md = await apiClient.post(`/collections/${c.id}/export`, { format: 'markdown' });
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${c.name.replace(/\s+/g, '_')}_reading_list.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(null);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    try {
      await apiClient.post('/collections', { name: name.trim() });
      const updated = await apiClient.get('/collections');
      setCollections(updated);
      setName('');
      setShowForm(false);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Collections
        </span>
        <button className="btn-ghost p-1" title="New collection" onClick={() => setShowForm((v) => !v)}>
          <FolderPlus size={16} />
        </button>
      </div>

      {showForm && (
        <div className="mb-2 flex gap-1">
          <input
            className="input"
            placeholder="Collection name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button className="btn-primary" onClick={create}>Add</button>
        </div>
      )}

      <ul className="space-y-1">
        {collections.map((c) => (
           <li key={c.id}>
             <button
               className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
               onClick={() => navigate(`/?collection=${c.id}`)}
             >
               <Folder size={15} className="text-terracotta" />
               <span className="flex-1 truncate">{c.name}</span>
               <span className="text-xs text-slate-400">{c.paper_count}</span>
               <button
                 className="rounded p-1 text-slate-400 hover:text-primary"
                 title="Export reading list"
                 onClick={(e) => exportCollection(e, c)}
               >
                 <Download size={14} className={exporting === c.id ? 'animate-pulse' : ''} />
               </button>
             </button>
           </li>
        ))}
        {collections.length === 0 && (
          <li className="px-2 py-1 text-xs text-slate-400">No collections yet</li>
        )}
      </ul>
    </div>
  );
}
