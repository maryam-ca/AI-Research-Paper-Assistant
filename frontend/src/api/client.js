// Single source of truth for backend URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(method, endpoint, body, isForm = false) {
  const headers = {};
  let payload = body;
  if (!isForm && body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE_URL}${endpoint}`, { method, headers, body: payload });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch (_) { /* ignore */ }
    throw new Error(detail);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

const apiClient = {
  baseUrl: API_BASE_URL,
  get: (endpoint) => request('GET', endpoint),
  post: (endpoint, body) => request('POST', endpoint, body),
  put: (endpoint, body) => request('PUT', endpoint, body),
  patch: (endpoint, body) => request('PATCH', endpoint, body),
  del: (endpoint) => request('DELETE', endpoint),
  upload: (endpoint, file, field = 'file') => {
    const form = new FormData();
    form.append(field, file);
    return request('POST', endpoint, form, true);
  },
};

export default apiClient;
