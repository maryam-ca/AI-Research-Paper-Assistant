import { useEffect, useState } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import apiClient from '../api/client';

const ICONS = {
  upload: '⬆', analyze: '🧠', question: '💬', tag: '🏷', favorite: '⭐',
};

export default function ActivityLog({ paperId }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    apiClient.get(`/papers/${paperId}/activity`).then(setItems).catch(() => {});
  }, [paperId]);

  return (
    <div className="space-y-3 p-6">
      <div className="flex items-center gap-2 text-terracotta"><ActivityIcon size={18} /> <h3>Activity</h3></div>
      <ol className="relative border-l border-slate-200 dark:border-slate-700 pl-4">
        {items.map((it, i) => (
          <li key={i} className="mb-3">
            <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-terracotta text-[10px] text-white">
              {ICONS[it.action] || '•'}
            </span>
            <p className="text-sm"><span className="font-semibold capitalize">{it.action}</span> — {it.details}</p>
            <p className="text-[11px] text-slate-400">{it.timestamp ? new Date(it.timestamp).toLocaleString() : ''}</p>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-slate-400">No activity recorded.</li>}
      </ol>
    </div>
  );
}
