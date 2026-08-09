import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listActivities } from "../api/client";

const ACTION_ICONS = {
  upload: "upload_file",
  fetch: "link",
  ask: "chat",
  compare: "compare",
  bulk_delete: "delete",
  add_to_collection: "folder",
  regenerate: "refresh",
  share: "share",
};

const ACTION_LABELS = {
  upload: "Uploaded a paper",
  fetch: "Fetched a paper",
  ask: "Asked a question",
  compare: "Compared papers",
  bulk_delete: "Deleted papers",
  add_to_collection: "Added to collection",
  regenerate: "Regenerated summary",
  share: "Shared paper digest",
};

export default function Activity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    listActivities(100).then(setActivities).catch(() => setActivities([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-[800px] mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-surface">Activity</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Full log of your research activity</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-4 py-4">
              <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl">
          <span className="material-symbols-outlined text-6xl text-outline-variant/40 mb-4 block">trending_up</span>
          <p className="text-title-md text-on-surface mb-2">No activity yet</p>
          <p className="text-body-md text-on-surface-variant mb-6">Your research activity will appear here</p>
          <button onClick={() => navigate("/")} className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity">
            Go to Library
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl divide-y divide-outline-variant/30">
          {activities.map((a) => {
            const icon = ACTION_ICONS[a.action] || "circle";
            const label = ACTION_LABELS[a.action] || a.action;
            return (
              <div key={a.id} className="flex items-start gap-4 px-6 py-4 hover:bg-surface-container-low/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface">
                    <span className="font-medium">{label}</span>
                    {a.detail && <span className="text-on-surface-variant"> — {a.detail.length > 80 ? a.detail.slice(0, 80) + "..." : a.detail}</span>}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/60 mt-1">
                    {new Date(a.created_at * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
