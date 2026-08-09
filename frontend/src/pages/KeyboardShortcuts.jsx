import { useContext } from "react";
import { ThemeContext } from "../App";

const SHORTCUTS = [
  { category: "Navigation", items: [
    { keys: ["/"], description: "Focus search bar" },
    { keys: ["U"], description: "Upload document" },
    { keys: ["Esc"], description: "Close panels / clear selection" },
    { keys: ["←"], description: "Previous tab (paper detail)" },
    { keys: ["→"], description: "Next tab (paper detail)" },
  ]},
  { category: "Paper Detail", items: [
    { keys: ["1-9"], description: "Switch to tab by number" },
    { keys: ["P"], description: "Toggle PDF viewer" },
    { keys: ["C"], description: "Open citation panel" },
    { keys: ["Q"], description: "Toggle AI chat" },
  ]},
  { category: "General", items: [
    { keys: ["?"], description: "Open keyboard shortcuts" },
  ]},
];

export default function KeyboardShortcuts() {
  const { theme } = useContext(ThemeContext);

  return (
    <div className="max-w-[700px] mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-surface">Keyboard Shortcuts</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Navigate faster with keyboard shortcuts</p>
      </div>

      <div className="space-y-6">
        {SHORTCUTS.map((group) => (
          <div key={group.category} className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden">
            <div className="px-6 py-3 border-b border-outline-variant/40">
              <h2 className="text-title-md font-semibold text-on-surface">{group.category}</h2>
            </div>
            <div className="divide-y divide-outline-variant/30">
              {group.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-body-md text-on-surface">{item.description}</span>
                  <div className="flex items-center gap-1.5">
                    {item.keys.map((key, ki) => (
                      <span key={ki}>
                        <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-surface-container-high border border-outline-variant/60 rounded-lg text-[12px] font-mono font-medium text-on-surface shadow-sm">
                          {key}
                        </kbd>
                        {ki < item.keys.length - 1 && <span className="text-on-surface-variant/40 mx-0.5">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[20px]">lightbulb</span>
          <div>
            <p className="text-body-md font-medium text-primary">Pro Tip</p>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Press <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-surface-container-high border border-outline-variant/60 rounded text-[10px] font-mono font-medium text-on-surface mx-0.5">/</kbd> from anywhere in the Library to instantly focus the search bar.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
