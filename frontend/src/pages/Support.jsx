export default function Support() {
  return (
    <div className="max-w-[700px] mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-surface">Support</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Get help with ScholarFlow</p>
      </div>

      <div className="space-y-6">
        {/* Quick Links */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <h2 className="text-title-md font-semibold text-on-surface mb-4">Quick Help</h2>
          <div className="space-y-3">
            {[
              { icon: "upload_file", title: "Upload a Paper", desc: "Click 'Upload Document' on the Library page, or press U on your keyboard." },
              { icon: "link", title: "Fetch from arXiv/DOI", desc: "Paste an arXiv ID or DOI in the fetch input on the Library page." },
              { icon: "chat", title: "Ask Questions", desc: "Open any paper and use the AI Chat panel to ask grounded questions." },
              { icon: "auto_awesome", title: "Compare Papers", desc: "Select 2+ papers in the Library and click 'Compare'." },
              { icon: "share", title: "Share a Paper", desc: "Open a paper, go to the Share tab, and copy the share link." },
              { icon: "folder", title: "Organize with Collections", desc: "Create collections on the Collections page, then add papers from the Library." },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-container-low/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[18px]">{item.icon}</span>
                </div>
                <div>
                  <p className="text-body-md font-medium text-on-surface">{item.title}</p>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supported Formats */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <h2 className="text-title-md font-semibold text-on-surface mb-4">Supported File Formats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {["PDF", "DOCX", "TXT", "Markdown", "RTF", "LaTeX", "HTML", "EPUB"].map((fmt) => (
              <div key={fmt} className="bg-surface rounded-xl px-4 py-2.5 text-center border border-outline-variant/30">
                <p className="text-body-sm font-medium text-on-surface">{fmt}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
          <h2 className="text-title-md font-semibold text-on-surface mb-4">Tips</h2>
          <ul className="space-y-2.5">
            {[
              "Use keyboard shortcut / to quickly focus the search bar.",
              "Press U to open the file upload dialog from anywhere in the Library.",
              "Select multiple papers to compare them side by side.",
              "Add papers to collections to keep your research organized.",
              "Use the 'Suggest Tags' feature to auto-tag papers with AI.",
              "Export your data anytime from Settings for a full backup.",
            ].map((tip, i) => (
              <li key={i} className="flex gap-2 text-body-sm text-on-surface-variant">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Version */}
        <div className="text-center py-6">
          <p className="text-body-sm text-on-surface-variant">ScholarFlow v1.0</p>
          <p className="text-[11px] text-on-surface-variant/50 mt-1">AI-Powered Research Paper Assistant</p>
        </div>
      </div>
    </div>
  );
}
