import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRecent, listActivities } from "../api/client";

function Spinner({ size = 20 }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
    </svg>
  );
}

function SourceBadge({ paper }) {
  const src = paper.metadata?.source || "";
  if (src.startsWith("arxiv:")) return <span className="bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 rounded-md border border-primary/30">arXiv</span>;
  if (src.startsWith("doi:")) return <span className="bg-tertiary/10 text-tertiary text-[11px] font-semibold px-2 py-0.5 rounded-md border border-tertiary/30">DOI</span>;
  return <span className="bg-surface-container text-on-surface-variant text-[11px] font-semibold px-2 py-0.5 rounded-md border border-outline-variant/40">PDF</span>;
}

const ACTION_ICONS = {
  upload: "upload_file",
  fetch: "link",
  ask: "chat",
  compare: "compare",
  bulk_delete: "delete",
  add_to_collection: "folder",
};

const ACTION_LABELS = {
  upload: "Uploaded",
  fetch: "Fetched",
  ask: "Asked a question",
  compare: "Compared papers",
  bulk_delete: "Deleted papers",
  add_to_collection: "Added to collection",
};

function ActivityItem({ activity }) {
  const icon = ACTION_ICONS[activity.action] || "circle";
  const label = ACTION_LABELS[activity.action] || activity.action;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-primary text-[16px]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-on-surface">
          <span className="font-medium">{label}</span>
          {activity.detail && <span className="text-on-surface-variant"> — {activity.detail.length > 60 ? activity.detail.slice(0, 60) + "..." : activity.detail}</span>}
        </p>
        <p className="text-[11px] text-on-surface-variant/60 mt-0.5">
          {new Date(activity.created_at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export default function Recent() {
  const [papers, setPapers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    listRecent().then(setPapers).catch(() => setPapers([])).finally(() => setLoadingPapers(false));
    listActivities().then(setActivities).catch(() => setActivities([])).finally(() => setLoadingActivities(false));
  }, []);

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-10">
      <div className="grid lg:grid-cols-5 gap-10">
        {/* Recently Viewed Papers */}
        <div className="lg:col-span-3">
          <div className="mb-8">
            <h1 className="text-headline-lg text-on-surface">Recent</h1>
            <p className="text-body-md text-on-surface-variant mt-1">Papers you viewed most recently</p>
          </div>

          {loadingPapers ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-3">
                  <div className="skeleton h-5 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : papers.length === 0 ? (
            <div className="text-center py-20 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-4xl text-primary">history</span>
              </div>
              <p className="text-title-md text-on-surface mb-2">No recent papers</p>
              <p className="text-body-md text-on-surface-variant mb-6">Papers you view will appear here</p>
              <Link to="/" className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity">
                <span className="material-symbols-outlined text-[18px]">book_2</span>Go to Library
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {papers.map((paper) => (
                <Link key={paper.id} to={`/paper/${paper.id}`}
                  className="block bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 hover:shadow-md transition-all no-underline group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <SourceBadge paper={paper} />
                      <div className="min-w-0">
                        <h4 className="text-body-md text-on-surface group-hover:text-primary transition-colors truncate">{paper.filename || "Untitled"}</h4>
                        {paper.metadata?.authors?.length > 0 && (
                          <p className="text-body-sm text-on-surface-variant truncate">{paper.metadata.authors.slice(0, 2).join(", ")}</p>
                        )}
                      </div>
                    </div>
                    {paper.last_viewed && (
                      <span className="text-[11px] text-on-surface-variant shrink-0 ml-4">
                        {new Date(paper.last_viewed * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="lg:col-span-2">
          <div className="mb-8">
            <h2 className="text-headline-md text-on-surface">Activity</h2>
            <p className="text-body-sm text-on-surface-variant mt-1">Your recent actions</p>
          </div>

          {loadingActivities ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-1/2" /></div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-2xl text-primary">trending_up</span>
              </div>
              <p className="text-body-md text-on-surface-variant mb-3">No activity yet</p>
              <Link to="/" className="text-primary text-body-sm font-medium hover:underline">Start by uploading a paper</Link>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 divide-y divide-outline-variant/30">
              {activities.map((a) => <ActivityItem key={a.id} activity={a} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
