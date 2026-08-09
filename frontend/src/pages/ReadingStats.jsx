import { useEffect, useState } from "react";
import { getReadingStats } from "../api/client";

function StatCard({ icon, label, value, color = "primary" }) {
  const colors = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-tertiary/10 text-tertiary",
    amber: "bg-secondary/10 text-secondary",
    blue: "bg-primary/10 text-primary",
    error: "bg-error/10 text-error",
  };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <p className="text-body-sm text-on-surface-variant">{label}</p>
      </div>
      <p className="text-headline-md font-bold text-on-surface">{value}</p>
    </div>
  );
}

export default function ReadingStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReadingStats().then(setStats).catch(() => setStats(null)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto px-8 py-10">
        <div className="mb-8"><div className="skeleton h-10 w-48" /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-[1000px] mx-auto px-8 py-10">
        <h1 className="text-headline-lg text-on-surface mb-4">Reading Stats</h1>
        <p className="text-on-surface-variant">No stats available yet.</p>
      </div>
    );
  }

  const maxTagCount = Math.max(...(stats.top_tags?.map(t => t.count) || [1]));

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-surface">Reading Stats</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Your research activity overview</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="description" label="Total Papers" value={stats.total_papers} color="primary" />
        <StatCard icon="check_circle" label="Papers Read" value={stats.read_count} color="emerald" />
        <StatCard icon="schedule" label="Reading Now" value={stats.reading_count} color="blue" />
        <StatCard icon="bookmark_add" label="To Read" value={stats.to_read_count} color="amber" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard icon="calendar_month" label="Added This Month" value={stats.papers_this_month} color="primary" />
        <StatCard icon="auto_stories" label="Sections Read" value={stats.total_sections_read} color="emerald" />
        <StatCard icon="functions" label="Avg Sections/Paper" value={stats.avg_sections_per_paper} color="blue" />
      </div>

      {stats.top_tags?.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <h2 className="text-title-md font-semibold text-on-surface mb-4">Top Tags</h2>
          <div className="space-y-3">
            {stats.top_tags.map((t) => (
              <div key={t.tag} className="flex items-center gap-3">
                <span className="text-body-sm text-on-surface w-24 truncate">{t.tag}</span>
                <div className="flex-1 bg-surface-container rounded-full h-4 overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${(t.count / maxTagCount) * 100}%` }} />
                </div>
                <span className="text-[12px] text-on-surface-variant font-medium w-8 text-right">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.total_papers > 0 && (
        <div className="mt-8 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <h2 className="text-title-md font-semibold text-on-surface mb-4">Reading Distribution</h2>
          <div className="flex gap-1 h-8 rounded-xl overflow-hidden">
            {stats.read_count > 0 && <div className="bg-tertiary transition-all" style={{ width: `${(stats.read_count / stats.total_papers) * 100}%` }} title={`Read: ${stats.read_count}`} />}
            {stats.reading_count > 0 && <div className="bg-primary transition-all" style={{ width: `${(stats.reading_count / stats.total_papers) * 100}%` }} title={`Reading: ${stats.reading_count}`} />}
            {stats.to_read_count > 0 && <div className="bg-secondary transition-all" style={{ width: `${(stats.to_read_count / stats.total_papers) * 100}%` }} title={`To Read: ${stats.to_read_count}`} />}
            {stats.archived_count > 0 && <div className="bg-outline-variant transition-all" style={{ width: `${(stats.archived_count / stats.total_papers) * 100}%` }} title={`Archived: ${stats.archived_count}`} />}
          </div>
          <div className="flex gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-tertiary" /><span className="text-[11px] text-on-surface-variant">Read ({stats.read_count})</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary" /><span className="text-[11px] text-on-surface-variant">Reading ({stats.reading_count})</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-secondary" /><span className="text-[11px] text-on-surface-variant">To Read ({stats.to_read_count})</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-outline-variant" /><span className="text-[11px] text-on-surface-variant">Archived ({stats.archived_count})</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
