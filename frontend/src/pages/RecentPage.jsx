import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import PaperGrid from '../components/PaperGrid';

export default function RecentPage() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/papers')
      .then((list) => {
        const sorted = [...list].sort(
          (a, b) => new Date(b.upload_date) - new Date(a.upload_date)
        );
        setPapers(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-bold">Recent</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Papers sorted by most recently added.
      </p>
      <div className="mt-6">
        {loading ? <p className="text-slate-400">Loading…</p> : <PaperGrid papers={papers} />}
      </div>
    </div>
  );
}
