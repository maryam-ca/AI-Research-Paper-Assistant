// Minimal content script: expose the page title + any PDF link to the popup
// via the messaging API. The popup uses the active tab URL directly, so this
// is only a lightweight helper for detecting PDFs.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_PAGE_INFO") {
    const pdf = Array.from(document.querySelectorAll("a[href$='.pdf']"))
      .map((a) => a.href)[0] || null;
    sendResponse({ title: document.title, pdf });
  }
  return true;
});
