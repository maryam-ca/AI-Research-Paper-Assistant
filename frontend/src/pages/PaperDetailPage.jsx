import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Star, Clock, Languages } from 'lucide-react';
import apiClient from '../api/client';
import { useAppStore } from '../store/appStore';
import SummaryTab from '../components/SummaryTab';
import KeyElementsTab from '../components/KeyElementsTab';
import QAPanel from '../components/QAPanel';
import NotesPanel from '../components/NotesPanel';
import ActivityLog from '../components/ActivityLog';
import ExportOptions from '../components/ExportOptions';
import PaperCard from '../components/PaperCard';
import TranslateModal from '../components/TranslateModal';

const STATUS_PROGRESS = { not_started: 0, reading: 50, reviewed: 80, completed: 100 };

const TABS = ['Summary', 'Key Elements', 'Notes', 'Activity'];

export default function PaperDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const updatePaper = useAppStore((s) => s.updatePaper);
  const [paper, setPaper] = useState(null);
  const [tab, setTab] = useState('Summary');
  const [qaOpen, setQaOpen] = useState(false);
  const [related, setRelated] = useState([]);
  const [translateOpen, setTranslateOpen] = useState(false);

  const setStatus = async (status) => {
    try {
      const updated = await apiClient.patch(`/papers/${id}/status`, { status });
      setPaper((p) => ({ ...p, ...updated }));
      updatePaper(updated);
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    apiClient.get(`/papers/${id}`).then(setPaper).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (tab === 'Related') {
      apiClient.get(`/papers/${id}/similar?limit=8`).then(setRelated).catch(() => {});
    }
  }, [tab, id]);

  if (!paper) return <div className="p-6 text-slate-400">Loading paper…</div>;

  const tabs = [...TABS, 'Related'];

  return (
    <div className="relative flex h-full flex-col">
      <div className="border-b border-slate-200 dark:border-slate-700 p-6">
        <button className="btn-ghost mb-3" onClick={() => navigate('/')}><ArrowLeft size={16} /> Library</button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold">{paper.title}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {paper.authors ? paper.authors.join(', ') : 'Unknown authors'} · <span className="uppercase">{paper.source_type}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {paper.complexity_level && (
                <span className={`badge ${paper.complexity_level === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : paper.complexity_level === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                  {paper.complexity_level}
                </span>
              )}
              {paper.readability_score != null && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  readability {paper.readability_score}/100
                </span>
              )}
              {paper.rigor_score != null && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  rigor {paper.rigor_score}/100
                </span>
              )}
              {paper.reproducibility_score != null && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  reproducible {paper.reproducibility_score}/100
                </span>
              )}
              {paper.reading_time_minutes ? (
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  <Clock size={11} /> ~{paper.reading_time_minutes} min
                </span>
              ) : null}
              <label className="flex items-center gap-1 text-slate-500">
                status:
                <select
                  className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900"
                  value={paper.reading_status || 'not_started'}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="not_started">Not started</option>
                  <option value="reading">Reading</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </div>
            {paper.keywords && paper.keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {paper.keywords.map((k) => (
                  <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">#{k}</span>
                ))}
              </div>
            )}
            {paper.quality_flags && paper.quality_flags.length > 0 && (
              <div className="mt-2">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Quality flags:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {paper.quality_flags.map((f, i) => (
                    <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{f}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                <span>Reading progress</span>
                <span>{STATUS_PROGRESS[paper.reading_status || 'not_started']}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                <div className="h-full bg-primary transition-all" style={{ width: `${STATUS_PROGRESS[paper.reading_status || 'not_started']}%` }} />
              </div>
            </div>
            {paper.abstract && <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">{paper.abstract}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <ExportOptions paper={paper} />
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setTranslateOpen(true)}><Languages size={16} /> Translate</button>
              <button className="btn-primary" onClick={() => setQaOpen(true)}><MessageCircle size={16} /> Ask a question</button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {tabs.map((t) => (
            <button
              key={t}
              className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-terracotta text-terracotta' : 'text-slate-500'}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'Summary' && <SummaryTab paperId={id} />}
        {tab === 'Key Elements' && <KeyElementsTab paperId={id} />}
        {tab === 'Notes' && <NotesPanel paperId={id} />}
        {tab === 'Activity' && <ActivityLog paperId={id} />}
        {tab === 'Related' && (
          <div className="p-6">
            <h3 className="mb-3 text-terracotta">Related Papers</h3>
            {related.length === 0 ? (
              <p className="text-sm text-slate-400">No related papers found (analyze more papers to build similarity).</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {related.map(({ paper, score }) => (
                  <div key={paper.id} className="relative">
                    <PaperCard paper={paper} />
                    <span className="absolute right-2 top-2 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] text-primary dark:bg-primary-700/40">
                      {Math.round(score * 100)}% match
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <QAPanel paperId={id} open={qaOpen} onClose={() => setQaOpen(false)} />
      {translateOpen && <TranslateModal paperId={id} onClose={() => setTranslateOpen(false)} />}
    </div>
  );
}
