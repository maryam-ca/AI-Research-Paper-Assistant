import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import apiClient from '../api/client';
import { useAppStore } from '../store/appStore';

export default function UploadCard({ onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const fileRef = useRef(null);
  const setPapers = useAppStore((s) => s.setPapers);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setProgress('Uploading…');
    try {
      const paper = await apiClient.upload('/papers/upload', file);
      setProgress('Analyzing…');
      await apiClient.post(`/papers/${paper.id}/analyze`);
      const papers = await apiClient.get('/papers');
      setPapers(papers);
      setProgress('Done');
      onUploaded && onUploaded(paper);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(''), 1500);
    }
  };

  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-6 text-center">
      <UploadCloud className="text-terracotta" size={32} />
      <div>
        <p className="font-display font-semibold">Upload a paper</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">PDF or DOCX</p>
      </div>
      <button className="btn-primary" disabled={busy} onClick={() => fileRef.current.click()}>
        {busy ? progress : 'Choose file'}
      </button>
      <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFile} />
    </div>
  );
}
