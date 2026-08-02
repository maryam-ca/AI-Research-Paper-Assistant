import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listPapers, uploadPaper, fetchByIdOrDoi, comparePapers } from "../api/client";

export default function Library() {
  const [papers, setPapers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [compareResult, setCompareResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();

  const fetchLibrary = () => {
    setLoadingList(true);
    listPapers()
      .then(setPapers)
      .catch(() => setPapers([]))
      .finally(() => setLoadingList(false));
  };

  useEffect(() => { fetchLibrary(); }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const result = await uploadPaper(file);
      navigate(`/paper/${result.paper_id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
      e.target.value = "";
    }
  };

  const handleFetch = async () => {
    if (!query.trim()) return;
    setProcessing(true);
    try {
      const isDoi = query.startsWith("10.") || query.includes("/");
      const result = await fetchByIdOrDoi(
        isDoi ? { doi: query } : { arxivId: query }
      );
      navigate(`/paper/${result.paper_id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCompare = async () => {
    if (selected.size < 2) return;
    setComparing(true);
    setShowModal(true);
    try {
      const result = await comparePapers([...selected]);
      setCompareResult(result);
    } catch (err) {
      setCompareResult({ error: err.message });
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          {papers.length} paper{papers.length !== 1 ? "s" : ""}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Upload PDF</h2>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFile}
            disabled={processing}
            className="block w-full text-sm text-gray-700 file:mr-2 file:py-2 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:cursor-pointer hover:file:bg-gray-100"
          />
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Fetch by ID / DOI</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="arXiv ID or DOI"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              disabled={processing}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleFetch}
              disabled={processing || !query.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? "..." : "Fetch"}
            </button>
          </div>
        </div>
      </div>

      {processing && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-blue-700">Processing paper, this may take a moment...</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-700">Your Papers</h2>
          {selected.size >= 2 && (
            <button
              onClick={handleCompare}
              disabled={comparing}
              className="rounded bg-purple-600 px-4 py-1.5 text-xs text-white font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {comparing ? "Comparing..." : `Compare Selected (${selected.size})`}
            </button>
          )}
        </div>

        {loadingList ? (
          <p className="text-gray-500 text-sm">Loading library...</p>
        ) : papers.length === 0 ? (
          <p className="text-gray-400 text-sm">No papers yet. Upload a PDF or fetch by ID above.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {papers.map((p) => (
              <div
                key={p.id}
                className={`flex items-start gap-3 rounded-lg border p-4 transition ${
                  selected.has(p.id) ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <Link to={`/paper/${p.id}`} className="flex-1 no-underline">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                    {p.filename || "Untitled"}
                  </h3>
                  {p.metadata?.published_date && (
                    <p className="text-xs text-gray-400 mt-0.5">{p.metadata.published_date}</p>
                  )}
                  {p.metadata?.authors?.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.metadata.authors.slice(0, 3).join(", ")}
                      {p.metadata.authors.length > 3 ? " et al." : ""}
                    </p>
                  )}
                  {p.executive_summary && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                      {p.executive_summary}
                    </p>
                  )}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Paper Comparison</h2>
              <button
                onClick={() => { setShowModal(false); setCompareResult(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {comparing && (
                <div className="flex items-center gap-3 text-gray-500">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm">Running comparison across papers...</p>
                </div>
              )}

              {compareResult && !comparing && compareResult.error && (
                <p className="text-sm text-red-600">{compareResult.error}</p>
              )}

              {compareResult && !comparing && !compareResult.error && (
                <div className="flex flex-col gap-4 text-sm text-gray-700">
                  {compareResult.overview && (
                    <Section title="Overview" content={compareResult.overview} />
                  )}
                  {compareResult.methodologies && (
                    <Section title="Methodologies" content={compareResult.methodologies} />
                  )}
                  {compareResult.findings && (
                    <Section title="Findings" content={compareResult.findings} />
                  )}
                  {compareResult.strengths_weaknesses && (
                    <Section title="Strengths & Weaknesses" content={compareResult.strengths_weaknesses} />
                  )}
                  {compareResult.gaps && (
                    <Section title="Gaps" content={compareResult.gaps} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, content }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{title}</h3>
      <div className="rounded border border-gray-200 p-3 whitespace-pre-line leading-relaxed">
        {typeof content === "object" ? JSON.stringify(content, null, 2) : content}
      </div>
    </div>
  );
}
