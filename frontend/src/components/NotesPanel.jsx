import { useEffect, useState } from 'react';
import { Tag, Plus, Highlighter, Trash2 } from 'lucide-react';
import apiClient from '../api/client';

export default function NotesPanel({ paperId }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');
  const [highlights, setHighlights] = useState([]);
  const [hlText, setHlText] = useState('');
  const [hlPage, setHlPage] = useState('');

  const refresh = () => {
    apiClient.get(`/papers/${paperId}/notes`).then(setNotes).catch(() => {});
    apiClient.get(`/papers/${paperId}/highlights`).then(setHighlights).catch(() => {});
  };

  useEffect(() => { refresh(); }, [paperId]);

  const addNote = async () => {
    if (!text.trim()) return;
    await apiClient.post(`/papers/${paperId}/notes`, {
      note_text: text.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setText(''); setTags('');
    refresh();
  };

  const addHighlight = async () => {
    if (!hlText.trim()) return;
    await apiClient.post(`/papers/${paperId}/highlights`, {
      text: hlText.trim(),
      page_number: hlPage ? parseInt(hlPage, 10) : null,
    });
    setHlText(''); setHlPage('');
    refresh();
  };

  const delHighlight = async (hid) => {
    await apiClient.del(`/papers/${paperId}/highlights/${hid}`);
    refresh();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-terracotta">
          <Tag size={18} /> <h3>Notes & Tags</h3>
        </div>
        <div className="space-y-2">
          <textarea className="input min-h-[80px]" placeholder="Add a note…" value={text} onChange={(e) => setText(e.target.value)} />
          <input className="input" placeholder="tags, comma, separated" value={tags} onChange={(e) => setTags(e.target.value)} />
          <button className="btn-primary" onClick={addNote}><Plus size={16} /> Add note</button>
        </div>
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="card p-3 text-sm">
              <p>{n.note_text}</p>
              {n.tags && n.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {n.tags.map((t, i) => (
                    <span key={i} className="rounded-full bg-terracotta/10 px-2 py-0.5 text-xs text-terracotta">#{t}</span>
                  ))}
                </div>
              )}
            </li>
          ))}
          {notes.length === 0 && <li className="text-xs text-slate-400">No notes yet.</li>}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-terracotta">
          <Highlighter size={18} /> <h3>Highlights</h3>
        </div>
        <div className="space-y-2">
          <textarea className="input min-h-[60px]" placeholder="Highlighted passage…" value={hlText} onChange={(e) => setHlText(e.target.value)} />
          <div className="flex gap-2">
            <input className="input w-32" placeholder="page #" value={hlPage} onChange={(e) => setHlPage(e.target.value)} />
            <button className="btn-primary" onClick={addHighlight}><Plus size={16} /> Add</button>
          </div>
        </div>
        <ul className="space-y-2">
          {highlights.map((h) => (
            <li key={h.id} className="card flex items-start justify-between gap-2 p-3 text-sm">
              <div>
                <p>{h.text}</p>
                {h.page_number != null && <span className="text-[11px] text-slate-400">p.{h.page_number}</span>}
              </div>
              <button className="btn-ghost p-1 text-red-500" onClick={() => delHighlight(h.id)}><Trash2 size={14} /></button>
            </li>
          ))}
          {highlights.length === 0 && <li className="text-xs text-slate-400">No highlights yet.</li>}
        </ul>
      </div>
    </div>
  );
}
