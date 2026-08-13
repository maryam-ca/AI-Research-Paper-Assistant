// Service worker: no persistent logic needed for quick-add (the popup talks
// directly to the ScholarFlow API). Kept for MV3 compliance / future use.
chrome.runtime.onInstalled.addListener(() => {
  console.log("ScholarFlow Quick Add installed");
});
