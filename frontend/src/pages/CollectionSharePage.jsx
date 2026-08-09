import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getCollectionShareData } from "../api/client";

function SourceBadge({ paper }) {
  const src = paper?.metadata?.source || "";
  if (src.startsWith("arxiv:")) return <span className="bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 rounded-md border border-primary/30">arXiv</span>;
  if (src.startsWith("doi:")) return <span className="bg-tertiary/10 text-tertiary text-[11px] font-semibold px-2 py-0.5 rounded-md border border-tertiary/30">DOI</span>;
  return <span className="bg-surface-container text-on-surface-variant text-[11px] font-semibold px-2 py-0.5 rounded-md border border-outline-variant/40">PDF</span>;
}

export default function CollectionSharePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCollectionShareData(id).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="skeleton h-10 w-48 mx-auto mb-4" />
          <div className="skeleton h-4 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-outline-variant/40 mb-4 block">folder_off</span>
          <p className="text-title-md text-on-surface mb-2">Collection not found</p>
          <p className="text-body-md text-on-surface-variant">This collection may have been removed or the link is invalid.</p>
        </div>
      </div>
    );
  }

  const { collection, papers } = data;

  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-primary/5 border-b border-outline-variant/60">
        <div className="max-w-[800px] mx-auto px-8 py-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">folder</span>
            </div>
            <div>
              <h1 className="text-headline-lg text-on-surface">{collection.name}</h1>
              {collection.description && <p className="text-body-md text-on-surface-variant mt-1">{collection.description}</p>}
            </div>
          </div>
          {collection.category && <span className="inline-block bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-1 rounded-md mb-2">{collection.category}</span>}
          <p className="text-body-sm text-on-surface-variant">{papers.length} paper{papers.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-8 py-8">
        <div className="space-y-4">
          {papers.map((p) => (
            <div key={p.id} className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-3">
                <SourceBadge paper={p} />
                <span className="text-body-sm text-on-surface-variant">
                  {p.metadata?.published_date ? new Date(p.metadata.published_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""}
                </span>
              </div>
              <h3 className="text-title-md text-on-surface mb-2">{p.filename || "Untitled"}</h3>
              {p.metadata?.authors?.length > 0 && (
                <p className="text-body-sm text-on-surface-variant mb-3">{p.metadata.authors.slice(0, 3).join(", ")}{p.metadata.authors.length > 3 && ` +${p.metadata.authors.length - 3} more`}</p>
              )}
              {p.executive_summary && (
                <p className="text-body-sm text-on-surface-variant line-clamp-3 leading-relaxed">{p.executive_summary}</p>
              )}
              {p.key_findings && (
                <div className="mt-3 bg-tertiary/10 border border-tertiary/30 rounded-xl p-4">
                  <p className="text-[11px] font-semibold text-tertiary uppercase tracking-wider mb-1">Key Findings</p>
                  <p className="text-body-sm text-tertiary line-clamp-3">{p.key_findings}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center py-8 mt-8 border-t border-outline-variant/40">
          <p className="text-body-sm text-on-surface-variant">Shared via <span className="font-semibold text-primary">ScholarFlow</span></p>
        </div>
      </div>
    </div>
  );
}
