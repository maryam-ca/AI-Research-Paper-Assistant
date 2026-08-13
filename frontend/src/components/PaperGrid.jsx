import PaperCard from './PaperCard';
import { useAppStore } from '../store/appStore';

export default function PaperGrid({ papers }) {
  const { toggleCompare, compareSelection } = useAppStore();
  if (!papers || papers.length === 0) {
    return <div className="card p-12 text-center text-slate-400">No papers found.</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {papers.map((p) => (
        <PaperCard
          key={p.id}
          paper={p}
          selected={compareSelection.includes(p.id)}
          onToggleSelect={toggleCompare}
        />
      ))}
    </div>
  );
}
