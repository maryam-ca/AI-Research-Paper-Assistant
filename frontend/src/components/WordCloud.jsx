import { useMemo } from "react";

export default function WordCloud({ text }) {
  const words = useMemo(() => {
    if (!text) return [];
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "as", "is", "was", "are", "were", "been", "be", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "shall", "can", "this", "that", "these", "those", "it", "its", "we", "our", "they", "their", "he", "she", "his", "her", "not", "no", "if", "then", "than", "so", "very", "just", "also", "more", "some", "any", "all", "each", "every", "which", "what", "who", "whom", "how", "when", "where", "while", "although", "because", "since", "unless", "until", "during", "before", "after", "above", "below", "between", "through", "about", "into", "over", "under", "again", "further", "here", "there", "all", "both", "few", "most", "other", "some", "such", "only", "own", "same", "too", "well", "back", "even", "still", "new", "use", "used", "using", "one", "two", "first", "second", "however", "example", "paper", "research", "study", "results", "method", "methods", "approach", "model", "data", "based", "different", "significant", "analysis", "show", "propose", "proposed", "using", "performance", "present", "demonstrate", "result", "effect", "given", "high", "large", "well", "known", "figure", "table", "section", "et", "al", "fig", "ref"]);
    
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/);
    const freq = {};
    cleaned.forEach(w => {
      if (w.length > 2 && !stopWords.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });
    
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word, count], i) => ({
        word,
        count,
        size: Math.max(0.75, 1.5 - (i * 0.03)),
        opacity: Math.max(0.4, 1 - (i * 0.02)),
      }));
  }, [text]);

  if (words.length === 0) {
    return (
      <div className="text-center py-8">
        <span className="material-symbols-outlined text-3xl text-outline-variant/40 mb-2 block">word_cloud</span>
        <p className="text-body-sm text-on-surface-variant">Not enough text to generate word cloud</p>
      </div>
    );
  }

  const colors = ["text-primary", "text-secondary", "text-tertiary", "text-on-surface-variant", "text-primary/70", "text-secondary/70"];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-4">
      {words.map((w, i) => (
        <span
          key={w.word}
          className={`${colors[i % colors.length]} font-semibold cursor-default transition-transform hover:scale-110`}
          style={{ fontSize: `${w.size}rem`, opacity: w.opacity }}
          title={`${w.count} occurrences`}
        >
          {w.word}
        </span>
      ))}
    </div>
  );
}
