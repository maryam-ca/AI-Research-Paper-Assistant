import { useState, useContext, useEffect } from "react";
import { ThemeContext } from "../App";
import { importData, API } from "../api/client";

const CITATION_STYLES = ["apa", "mla", "bibtex"];

export default function Settings() {
  const { theme, setTheme } = useContext(ThemeContext);
  const [citeStyle, setCiteStyle] = useState(() => {
    try { return localStorage.getItem("scholarflow_cite_style") || "apa"; } catch { return "apa"; }
  });
  const [showClear, setShowClear] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    try { return localStorage.getItem("scholarflow-font-size") || "16"; } catch { return "16"; }
  });
  const [highContrast, setHighContrast] = useState(() => {
    try { return localStorage.getItem("scholarflow-high-contrast") === "true"; } catch { return false; }
  });
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem("scholarflow-font-size", fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", highContrast);
    localStorage.setItem("scholarflow-high-contrast", String(highContrast));
  }, [highContrast]);

  const handleCiteStyle = (style) => {
    setCiteStyle(style);
    try { localStorage.setItem("scholarflow_cite_style", style); } catch {}
  };

  const handleClearAll = async () => {
    try {
      await fetch(`${API}/papers/cleanup`, { method: "POST" });
      alert("All data cleared.");
      setShowClear(false);
    } catch (e) { alert("Failed to clear data: " + e.message); }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const r = await importData(importFile);
      alert(`Imported ${r.imported_papers} papers, ${r.imported_collections} collections. Skipped ${r.skipped_duplicates} duplicates.`);
      setImportFile(null);
    } catch (e) { alert("Import failed: " + e.message); }
    setImporting(false);
  };

  return (
    <div className="max-w-[700px] mx-auto px-8 py-10">
      <h1 className="text-headline-lg text-on-surface mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Theme */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">dark_mode</span>
            </div>
            <h2 className="text-title-md font-semibold text-on-surface">Appearance</h2>
          </div>
          <div className="flex gap-3">
            {["light", "dark"].map((t) => (
              <button key={t} onClick={() => setTheme(t)}
                className={`flex-1 py-3 px-4 rounded-xl border-2 text-body-md font-medium transition-all ${
                  theme === t ? "border-primary bg-primary/5 text-primary" : "border-outline-variant/60 text-on-surface-variant hover:border-outline"
                }`}>
                <span className="material-symbols-outlined text-[18px] align-[-4px] mr-1.5">{t === "light" ? "light_mode" : "dark_mode"}</span>
                {t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">text_fields</span>
            </div>
            <h2 className="text-title-md font-semibold text-on-surface">Font Size</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[12px] text-on-surface-variant">Small</span>
            <input type="range" min="12" max="22" step="1" value={fontSize} onChange={(e) => setFontSize(e.target.value)}
              className="flex-1 h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary" />
            <span className="text-[12px] text-on-surface-variant">Large</span>
            <span className="text-body-sm text-on-surface font-medium w-10 text-center">{fontSize}px</span>
          </div>
        </div>

        {/* High Contrast */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">contrast</span>
            </div>
            <h2 className="text-title-md font-semibold text-on-surface">Accessibility</h2>
          </div>
          <button onClick={() => setHighContrast(!highContrast)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${highContrast ? "border-primary bg-primary/5" : "border-outline-variant/60 hover:border-outline"}`}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">visibility</span>
              <div className="text-left">
                <p className="text-body-md text-on-surface font-medium">High Contrast Mode</p>
                <p className="text-body-sm text-on-surface-variant">Increases border and text contrast for better readability</p>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative ${highContrast ? "bg-primary" : "bg-surface-container-high"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${highContrast ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
          </button>
        </div>

        {/* Citation style */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">format_quote</span>
            </div>
            <h2 className="text-title-md font-semibold text-on-surface">Default Citation Style</h2>
          </div>
          <div className="flex gap-2">
            {CITATION_STYLES.map((s) => (
              <button key={s} onClick={() => handleCiteStyle(s)}
                className={`px-5 py-2.5 rounded-xl text-body-md font-medium transition-all ${
                  citeStyle === s ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Import Data */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">upload</span>
            </div>
            <div>
              <h2 className="text-title-md font-semibold text-on-surface">Import Data</h2>
              <p className="text-body-sm text-on-surface-variant">Import papers from a ScholarFlow JSON backup</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-outline-variant/60 rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">upload_file</span>
              <span className="text-body-md text-on-surface-variant">{importFile ? importFile.name : "Choose JSON file"}</span>
              <input type="file" accept=".json" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
            </label>
            <button onClick={handleImport} disabled={!importFile || importing}
              className="px-5 py-3 bg-primary text-on-primary rounded-xl text-body-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {importing ? "Importing..." : "Import"}
            </button>
          </div>
        </div>

        {/* Clear data */}
        <div className="bg-surface-container-lowest border border-error/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-[18px]">delete_forever</span>
            </div>
            <div>
              <h2 className="text-title-md font-semibold text-on-surface">Danger Zone</h2>
              <p className="text-body-sm text-on-surface-variant">This action cannot be undone</p>
            </div>
          </div>
          {!showClear ? (
            <button onClick={() => setShowClear(true)}
              className="border border-error/40 text-error px-5 py-2.5 rounded-xl text-body-md font-medium hover:bg-error/5 transition-colors">
              Clear All Data
            </button>
          ) : (
            <div className="bg-error/5 border border-error/20 rounded-xl p-4">
              <p className="text-body-md text-on-surface mb-4">Are you sure? This will permanently delete all papers, collections, notes, and chat history.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowClear(false)} className="text-on-surface-variant px-4 py-2 rounded-xl hover:bg-surface-container-low transition-colors text-body-md">Cancel</button>
                <button onClick={handleClearAll} className="bg-error text-on-error px-5 py-2 rounded-xl font-medium hover:opacity-90 transition-opacity text-body-md">Yes, Delete Everything</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
