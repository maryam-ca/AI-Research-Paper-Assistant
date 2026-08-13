import { Download, Copy, Quote } from 'lucide-react';
import apiClient from '../api/client';

function buildCitations(paper) {
  const authors = (paper.authors || []).join(', ');
  const year = paper.upload_date ? new Date(paper.upload_date).getFullYear() : 'n.d.';
  const title = paper.title || 'Untitled';
  return {
    apa: `${authors} (${year}). ${title}.`,
    mla: `${authors}. "${title}." ${year}.`,
    bibtex: `@article{${paper.id?.slice(0, 8) || 'ref'},\n  title={${title}},\n  author={${authors}},\n  year={${year}}\n}`,
  };
}

export default function ExportOptions({ paper }) {
  const copy = async (text) => {
    await navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const exportFormat = async (format, ext, mime) => {
    const content = await apiClient.get(`/papers/${paper.id}/export?format=${format}`);
    const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paper.title || 'paper'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cite = buildCitations(paper);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-ghost" onClick={() => exportFormat('markdown', 'md', 'text/markdown')}><Download size={15} /> Markdown</button>
      <button className="btn-ghost" onClick={() => exportFormat('obsidian', 'md', 'text/markdown')}>Obsidian</button>
      <button className="btn-ghost" onClick={() => exportFormat('notion', 'json', 'application/json')}>Notion</button>
      <button className="btn-ghost" onClick={() => copy(cite.apa)}><Quote size={15} /> APA</button>
      <button className="btn-ghost" onClick={() => copy(cite.mla)}>MLA</button>
      <button className="btn-ghost" onClick={() => copy(cite.bibtex)}>BibTeX</button>
      <button className="btn-ghost" onClick={() => copy(cite.apa)}><Copy size={15} /> Copy citation</button>
    </div>
  );
}
