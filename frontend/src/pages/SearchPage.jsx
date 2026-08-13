import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import apiClient from '../api/client';
import PaperGrid from '../components/PaperGrid';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [papers, setPapers] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/papers')
      .then(setAll)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = query.toLowerCase().trim();
    setPapers(q ? all.filter((p) => (p.title || '').toLowerCase().includes(q)) : all);
  }, [query, all]);

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-bold">Search</h1>
      <div className="relative mt-4 max-w-xl">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          autoFocus
          placeholder="Search papers by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="mt-6">
        {loading ? <p className="text-slate-400">Loading…</p> : <PaperGrid papers={papers} />}
      </div>
    </div>
  );
}
