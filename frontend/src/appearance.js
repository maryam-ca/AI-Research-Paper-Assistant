export const FONT_STACKS = {
  sans: "'Inter', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', ui-monospace, 'Courier New', monospace",
};

export const FONT_OPTIONS = [
  { value: 'sans', label: 'Sans (Inter)' },
  { value: 'serif', label: 'Serif (Georgia)' },
  { value: 'mono', label: 'Mono (JetBrains)' },
];

export const CURSOR_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'pointer', label: 'Hand' },
  { value: 'crosshair', label: 'Crosshair' },
  { value: 'default', label: 'Arrow' },
];

export const ACCENT_OPTIONS = [
  { value: '#4f46e5', label: 'Indigo' },
  { value: '#0d9488', label: 'Teal' },
  { value: '#e11d48', label: 'Rose' },
  { value: '#059669', label: 'Emerald' },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#ea580c', label: 'Orange' },
];

export function applyAppearance() {
  const root = document.documentElement;
  const font = localStorage.getItem('appFont') || 'sans';
  const cursor = localStorage.getItem('appCursor') || 'auto';
  const accent = localStorage.getItem('appAccent') || '#4f46e5';
  root.style.setProperty('--app-font', FONT_STACKS[font] || FONT_STACKS.sans);
  root.style.setProperty('--app-cursor', cursor);
  root.style.setProperty('--app-accent', accent);
}
