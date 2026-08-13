const DEFAULT_API = "http://localhost:8000/api";

function setStatus(msg, isError) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = isError ? "#dc2626" : "#047857";
}

async function getApi() {
  const stored = await chrome.storage.local.get("apiUrl");
  const api = stored.apiUrl || DEFAULT_API;
  document.getElementById("api").value = api;
  return api;
}

document.addEventListener("DOMContentLoaded", async () => {
  const api = await getApi();

  // Prefill current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    document.getElementById("url").value = tab.url;
    const link = document.getElementById("current");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("url").value = tab.url;
    });
  }

  document.getElementById("api").addEventListener("change", (e) => {
    chrome.storage.local.set({ apiUrl: e.target.value.trim() || DEFAULT_API });
  });

  document.getElementById("add").addEventListener("click", async () => {
    const url = document.getElementById("url").value.trim();
    if (!url) return setStatus("Enter a URL first.", true);
    const btn = document.getElementById("add");
    btn.disabled = true;
    setStatus("Adding…");
    try {
      const res = await fetch(`${api}/papers/quick-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const paper = await res.json();
      setStatus(`Added: ${paper.title || "paper"}`);
    } catch (err) {
      setStatus(`Failed: ${err.message}`, true);
    } finally {
      btn.disabled = false;
    }
  });
});
