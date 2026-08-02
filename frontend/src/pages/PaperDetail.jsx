import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { getPaper, askQuestion, getCitation } from "../api/client";

const TABS = [
  { key: "executive", label: "Executive Summary" },
  { key: "detailed", label: "Detailed Summary" },
  { key: "findings", label: "Key Findings" },
  { key: "elements", label: "Key Elements" },
];

const CITATION_STYLES = ["apa", "mla", "bibtex"];

export default function PaperDetail() {
  const { id } = useParams();
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("executive");

  const [chatHistory, setChatHistory] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef(null);

  const [citation, setCitation] = useState(null);
  const [citeStyle, setCiteStyle] = useState("apa");
  const [citing, setCiting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPaper(id)
      .then(setPaper)
      .catch(() => setPaper(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    const q = question.trim();
    setQuestion("");
    setChatHistory((prev) => [...prev, { role: "user", text: q }]);
    setAsking(true);
    try {
      const res = await askQuestion(id, q);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: res.answer, sources: res.sources },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${err.message}`, error: true },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const handleCite = async (style) => {
    setCiteStyle(style);
    setCiting(true);
    try {
      const res = await getCitation(id, style);
      setCitation(res.citation);
    } catch (err) {
      setCitation(err.message);
    } finally {
      setCiting(false);
    }
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading paper...</p>;
  if (!paper) return <p className="text-red-500 text-sm">Paper not found.</p>;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-amber-700">
          AI-generated content. For personal use only. Always verify against the original paper.
        </p>
      </div>

      <header>
        <h1 className="text-xl font-semibold text-gray-900">{paper.filename}</h1>
        {paper.metadata?.authors?.length > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            {paper.metadata.authors.join(", ")}
          </p>
        )}
        {paper.metadata?.source && (
          <p className="text-xs text-gray-400 mt-1">{paper.metadata.source}</p>
        )}
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[120px]">
        {activeTab === "executive" && (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {paper.executive_summary || "No executive summary available."}
          </p>
        )}
        {activeTab === "detailed" && (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {paper.detailed_summary || "No detailed summary available."}
          </p>
        )}
        {activeTab === "findings" && (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {paper.key_findings || "No key findings available."}
          </p>
        )}
        {activeTab === "elements" && (
          <div className="grid gap-3">
            {paper.key_elements ? (
              Object.entries(paper.key_elements).map(([key, val]) => (
                <div key={key} className="rounded border border-gray-200 p-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {key.replace(/_/g, " ")}
                  </h3>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                    {Array.isArray(val) ? val.join("\n") : val}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No key elements available.</p>
            )}
          </div>
        )}
      </div>

      {paper.attribution_report && Object.keys(paper.attribution_report).length > 0 && (
        <section className="border-t border-gray-200 pt-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Source Attribution</h2>
          <div className="grid gap-2">
            {Object.entries(paper.attribution_report).map(([field, report]) => (
              <div key={field} className="rounded border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {field.replace(/_/g, " ")}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    report.flagged > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                  }`}>
                    {report.supported}/{report.total_sentences} supported
                  </span>
                </div>
                {report.flagged_details?.length > 0 && (
                  <ul className="mt-2 text-xs text-amber-600 list-disc list-inside">
                    {report.flagged_details.map((f, i) => (
                      <li key={i} className="line-clamp-1">"{f.sentence}"</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-gray-200 pt-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Ask a Question</h2>

        <div className="rounded-lg border border-gray-200 bg-gray-50 flex flex-col" style={{ height: "360px" }}>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {chatHistory.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-8">
                Ask anything about this paper. Answers are grounded in the document with cited page numbers.
              </p>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : msg.error
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-white text-gray-700 border border-gray-200"
                  }`}
                >
                  {msg.text}
                  {msg.sources?.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Sources: pages {msg.sources.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-gray-200 p-3 flex gap-2">
            <input
              type="text"
              placeholder="What methodology did the authors use?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              disabled={asking}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <button
              onClick={handleAsk}
              disabled={asking || !question.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {asking ? "..." : "Ask"}
            </button>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-200 pt-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Citation</h2>
        <div className="flex gap-2 mb-2">
          {CITATION_STYLES.map((s) => (
            <button
              key={s}
              onClick={() => handleCite(s)}
              disabled={citing}
              className={`px-3 py-1 text-xs rounded border font-medium ${
                citeStyle === s
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        {citation && (
          <pre className="text-xs text-gray-700 bg-gray-50 rounded border border-gray-200 p-3 whitespace-pre-wrap">
            {citation}
          </pre>
        )}
      </section>
    </div>
  );
}
