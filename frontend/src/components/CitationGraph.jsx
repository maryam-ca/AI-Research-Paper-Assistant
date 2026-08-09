import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRelatedPapers } from "../api/client";

export default function CitationGraph({ paperId }) {
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    getRelatedPapers(paperId, 8)
      .then((r) => setRelated(r.related || []))
      .catch(() => setRelated([]))
      .finally(() => setLoading(false));
  }, [paperId]);

  if (loading || related.length === 0) return null;

  const width = 600;
  const height = 360;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 130;

  const nodes = related.map((p, i) => {
    const angle = (2 * Math.PI * i) / related.length - Math.PI / 2;
    return {
      ...p,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  return (
    <div className="mt-8 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[18px]">hub</span>
        </div>
        <div>
          <h2 className="text-headline-md text-on-surface">Citation Network</h2>
          <p className="text-[11px] text-on-surface-variant">Related papers by content similarity</p>
        </div>
      </div>
      <div className="flex justify-center">
        <svg width={width} height={height} className="max-w-full">
          {/* Edges */}
          {nodes.map((n, i) => (
            <line key={`e-${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y}
              stroke="var(--color-primary)" strokeWidth="1" strokeOpacity="0.2" />
          ))}
          {/* Center node */}
          <circle cx={cx} cy={cy} r={28} fill="var(--color-primary)" opacity="0.9" />
          <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--color-on-primary)" fontSize="9" fontWeight="600">
            THIS
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--color-on-primary)" fontSize="9" fontWeight="600">
            PAPER
          </text>
          {/* Related nodes */}
          {nodes.map((n, i) => {
            const score = Math.round(n.score * 100);
            const r = 18 + (score / 100) * 10;
            return (
              <g key={i} onClick={() => nav(`/paper/${n.id}`)} className="cursor-pointer">
                <circle cx={n.x} cy={n.y} r={r}
                  fill="var(--color-surface-container)" stroke="var(--color-primary)" strokeWidth="1.5" strokeOpacity="0.4"
                  className="hover:stroke-[2px] transition-all" />
                <text x={n.x} y={n.y + 3} textAnchor="middle" fill="var(--color-primary)" fontSize="8" fontWeight="600">
                  {score}%
                </text>
                <text x={n.x} y={n.y + r + 12} textAnchor="middle" fill="var(--color-on-surface-variant)" fontSize="9" className="pointer-events-none">
                  {(n.filename || "Untitled").slice(0, 18)}{(n.filename || "").length > 18 ? "..." : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
