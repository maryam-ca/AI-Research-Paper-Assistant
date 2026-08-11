export const API = import.meta.env.VITE_API_URL || "/api";
const T = 60_000;
const LT = 180_000;

async function req(path, opts = {}, timeout = T) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(`${API}${path}`, { ...opts, signal: ac.signal });
    if (!r.ok) {
      let m; try { m = (await r.json()).detail; } catch { m = r.statusText; }
      if (r.status === 429) throw new Error("Rate limited. Wait a moment.");
      throw new Error(m || `Request failed (${r.status})`);
    }
    return r.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Request timed out.");
    if (e.message?.includes("Failed to fetch")) throw new Error(`Cannot reach server at ${API}.`);
    throw e;
  } finally { clearTimeout(t); }
}

async function reqDownload(path, filename) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), LT);
  try {
    const r = await fetch(`${API}${path}`, { signal: ac.signal });
    if (!r.ok) throw new Error(`Download failed (${r.status})`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } finally { clearTimeout(t); }
}

const jsonPost = (path, body, timeout) => req(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, timeout);

export const uploadPaper = (file) => {
  const fd = new FormData(); fd.append("file", file);
  return req("/papers/upload", { method: "POST", body: fd }, LT);
};
export const fetchByIdOrDoi = ({ arxivId, doi }) => {
  const p = new URLSearchParams();
  if (arxivId) p.set("arxiv_id", arxivId);
  if (doi) p.set("doi", doi);
  return req(`/papers/fetch?${p}`, { method: "POST" }, LT);
};
export const fetchFromUrl = (url) => jsonPost("/papers/fetch-url", { url }, LT);
export const listPapers = () => req("/papers");
export const getPaper = (id) => req(`/papers/${id}`);
export const getPaperFileUrl = (id) => `${API}/papers/${id}/file`;
export const getPaperThumbnailUrl = (id) => `${API}/papers/${id}/thumbnail`;
export const uploadThumbnail = (id, file) => {
  const fd = new FormData(); fd.append("file", file);
  return req(`/papers/${id}/thumbnail`, { method: "POST", body: fd }, LT);
};
export const deleteThumbnail = (id) =>
  req(`/papers/${id}/thumbnail`, { method: "DELETE" }, LT);
export const askQuestion = (id, question, history = []) =>
  jsonPost(`/papers/${id}/ask`, { question, history }, LT);
export const comparePapers = (ids) => jsonPost("/papers/compare", { paper_ids: ids }, LT);
export const getCitation = (id, style = "apa") =>
  req(`/papers/${id}/citation?style=${encodeURIComponent(style)}`);

export const searchPapers = (q) => req(`/papers/search?q=${encodeURIComponent(q)}`);
export const globalSearch = (q) => req(`/papers/global-search?q=${encodeURIComponent(q)}`);
export const listRecent = () => req("/papers/recent");
export const listActivities = (limit = 50) => req(`/papers/activities?limit=${limit}`);
export const getStats = () => req("/papers/stats");
export const updatePaperTags = (id, tags) =>
  req(`/papers/${id}/tags`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }) });
export const getRelatedPapers = (id, limit = 5) => req(`/papers/${id}/related?limit=${limit}`);
export const updateReadingProgress = (id, section) => jsonPost(`/papers/${id}/progress`, { section });

export const listCollections = () => req("/papers/collections/all");
export const createCollection = (name, description = "", category = "") => jsonPost("/papers/collections/create", { name, description, category });
export const getCollection = (id) => req(`/papers/collections/${id}`);
export const renameCollection = (id, name) =>
  req(`/papers/collections/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
export const deleteCollection = (id) => req(`/papers/collections/${id}`, { method: "DELETE" });
export const addToCollection = (colId, paperId) => jsonPost(`/papers/collections/${colId}/add`, { paper_id: paperId });
export const removeFromCollection = (colId, paperId) => jsonPost(`/papers/collections/${colId}/remove`, { paper_id: paperId });
export const generateLitReview = (collectionId) => jsonPost("/papers/literature-review", { collection_id: collectionId }, LT);
export const exportCollectionBibtex = (colId) => reqDownload(`/papers/collections/${colId}/export-bibtex`, `collection_${colId}.bib`);

export const listNotes = (paperId) => req(`/papers/${paperId}/notes`);
export const createNote = (paperId, text, pageRef = null) => jsonPost(`/papers/${paperId}/notes`, { text, page_ref: pageRef });
export const updateNote = (noteId, text) => req(`/papers/notes/${noteId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
export const deleteNote = (noteId) => req(`/papers/notes/${noteId}`, { method: "DELETE" });
export const getNoteVersions = (noteId) => req(`/papers/notes/${noteId}/versions`);
export const revertNote = (noteId, versionId) => jsonPost(`/papers/notes/${noteId}/revert`, { version_id: versionId });

export const getQaHistory = (paperId) => req(`/papers/${paperId}/qa-history`);
export const exportPaperMarkdown = (paperId) => reqDownload(`/papers/${paperId}/export-markdown`, `${paperId}.md`);

export const bulkDelete = (paperIds) => jsonPost("/papers/bulk-delete", { paper_ids: paperIds });
export const bulkAddToCollection = (paperIds, collectionId) => jsonPost("/papers/bulk-add-collection", { paper_ids: paperIds, collection_id: collectionId });
export const bulkExportBibtex = (paperIds) => reqDownload("/papers/bulk-export-bibtex", "papers.bib");

export const regenerateSummary = (paperId, section, instruction = "", length = "medium") =>
  jsonPost(`/papers/${paperId}/regenerate`, { section, instruction, length }, LT);

export const generateFlashcards = (paperId) =>
  jsonPost(`/papers/${paperId}/flashcards`, {}, LT);

export const computeReadability = (paperId) =>
  jsonPost(`/papers/${paperId}/readability`, {}, LT);

export const extractFiguresTables = (paperId) =>
  jsonPost(`/papers/${paperId}/figures-tables`, {}, LT);

export const generateSimplifiedSummary = (paperId, instruction = "") =>
  jsonPost(`/papers/${paperId}/simplified`, { instruction }, LT);

export const translateSummary = (paperId, section, targetLanguage) =>
  jsonPost(`/papers/${paperId}/translate`, { section, target_language: targetLanguage }, LT);

export const suggestTags = (paperId) =>
  jsonPost(`/papers/${paperId}/suggest-tags`, {}, LT);

export const multiPaperQA = (paperIds, question, history = []) =>
  jsonPost("/papers/multi-qa", { paper_ids: paperIds, question, history }, LT);

export const methodologyCompare = (paperIds) =>
  jsonPost("/papers/methodology-compare", { paper_ids: paperIds }, LT);

export const getNotifications = (limit = 50, unreadOnly = false) =>
  req(`/papers/notifications?limit=${limit}&unread_only=${unreadOnly}`);

export const markNotificationRead = (notificationId) =>
  jsonPost("/papers/notifications/read", { notification_id: notificationId });

export const markAllNotificationsRead = () =>
  jsonPost("/papers/notifications/read-all", {});

export const getReadingReminders = (days = 30) =>
  req(`/papers/reading-reminders?days=${days}`);

export const exportAllData = () =>
  reqDownload("/papers/export-all", "scholarflow_backup.json");

export const updatePaperStatus = (paperId, status) =>
  jsonPost(`/papers/${paperId}/status`, { status });

export const toggleFavorite = (paperId) =>
  jsonPost(`/papers/${paperId}/favorite`, {});

export const listFavorites = () =>
  req("/papers/favorites");

export const checkDuplicate = (filename) =>
  jsonPost("/papers/check-duplicate", { filename });

export const bulkUpdateTags = (paperIds, tagsToAdd = [], tagsToRemove = []) =>
  req("/papers/bulk-tags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paper_ids: paperIds, tags_to_add: tagsToAdd, tags_to_remove: tagsToRemove }) });

export const getCollectionShareData = (collectionId) =>
  req(`/papers/collections/${collectionId}/share`);

export const generatePrintableCitations = (paperIds, style = "apa") =>
  jsonPost("/papers/citations-print", { paper_ids: paperIds, style });

export const detectThemes = (paperIds) =>
  jsonPost("/papers/themes", { paper_ids: paperIds });

export const getCitationCount = (paperId) =>
  req(`/papers/citation-count/${paperId}`);

export const getReadingStats = () =>
  req("/papers/reading-stats");

export const suggestTagsForUpload = (paperId) =>
  req(`/papers/suggest-tags?paper_id=${encodeURIComponent(paperId)}`);

export const detectContradictions = (paperIds) =>
  req(`/papers/contradictions?paper_ids=${encodeURIComponent(paperIds.join(","))}`);

export const getResearchGaps = (paperIds = []) =>
  req(`/papers/research-gaps?paper_ids=${encodeURIComponent(paperIds.join(","))}`);

export const getReadNextRecommendations = (paperId) =>
  req(`/papers/read-next?paper_id=${encodeURIComponent(paperId)}`);

export const importData = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return fetch(`${API}/papers/import-data`, { method: "POST", body: fd })
    .then((r) => r.json());
};

export const togglePin = (paperId) =>
  jsonPost(`/papers/pin/${paperId}`, {});

export const updateCollectionColor = (collectionId, color) =>
  jsonPost(`/papers/collections/${collectionId}/color`, { color });
