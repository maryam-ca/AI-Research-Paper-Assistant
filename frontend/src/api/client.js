const API_BASE = "http://localhost:8000/api";

const TIMEOUT_MS = 60_000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail;
      try {
        const body = await res.json();
        detail = body.detail;
      } catch {
        detail = res.statusText;
      }

      if (res.status === 429) {
        throw new Error("Rate limit exceeded. Please wait a moment and try again.");
      }
      throw new Error(detail || `Request failed (${res.status})`);
    }

    return res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. The server may be processing a large file.");
    }
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      throw new Error("Cannot reach the server. Is the backend running on localhost:8000?");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadPaper(file) {
  const form = new FormData();
  form.append("file", file);
  return request("/papers/upload", { method: "POST", body: form });
}

export async function fetchByIdOrDoi({ arxivId, doi }) {
  const params = new URLSearchParams();
  if (arxivId) params.set("arxiv_id", arxivId);
  if (doi) params.set("doi", doi);
  return request(`/papers/fetch?${params}`, { method: "POST" });
}

export async function listPapers() {
  return request("/papers");
}

export async function getPaper(id) {
  return request(`/papers/${id}`);
}

export async function askQuestion(id, question) {
  return request(`/papers/${id}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export async function comparePapers(paperIds) {
  return request("/papers/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_ids: paperIds }),
  });
}

export async function getCitation(id, style = "apa") {
  return request(`/papers/${id}/citation?style=${encodeURIComponent(style)}`);
}
