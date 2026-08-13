import { useState } from 'react';
import { Link2 } from 'lucide-react';
import apiClient from '../api/client';
import { useAppStore } from '../store/appStore';

export default function FetchCard({ onFetched }) {
  const [source, setSource] = useState('arxiv');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const setPapers = useAppStore((s) => s.setPapers);

  const fetch = async () => {
    if (!value.trim()) return;
    setBusy(true);
    setProgress('Fetching metadata…');
    try {
      const paper = await apiClient.post('/papers/fetch', { source, value: value.trim() });
      if (paper.file_url) {
        setProgress('Analyzing…');
        await apiClient.post(`/papers/${paper.id}/analyze`);
      }
      const papers = await apiClient.get('/papers');
      setPapers(papers);
      setProgress('Done');
      onFetched && onFetched(paper);
      setValue('');
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(''), 1500);
    }
  };

  return (
    <div className="card flex flex-col gap-3 p-6">
      <div className="flex items-center gap-2">
        <Link2 className="text-terracotta" size={22} />
        <p className="font-display font-semibold">Fetch by ID</p>
      </div>
      <div className="flex gap-2">
        <select className="input w-28" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="arxiv">arXiv</option>
          <option value="doi">DOI</option>
          <option value="url">Link</option>
        </select>
        <input
          className="input flex-1"
          placeholder={
            source === 'arxiv' ? '2301.00001 or arxiv.org/abs/…'
            : source === 'doi' ? '10.1000/xyz or doi.org/…'
            : 'https://… document link (PDF)'
          }
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetch()}
        />
      </div>
      <button className="btn-primary justify-center" disabled={busy} onClick={fetch}>
        {busy ? progress : 'Fetch & Analyze'}
      </button>
    </div>
  );
}
