import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Component, createContext, useState, useEffect, useContext, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Library from "./pages/Library";
import PaperDetail from "./pages/PaperDetail";
import Collections from "./pages/Collections";
import Recent from "./pages/Recent";
import Settings from "./pages/Settings";
import SharePage from "./pages/SharePage";
import MultiQA from "./pages/MultiQA";
import Search from "./pages/Search";
import Activity from "./pages/Activity";
import KeyboardShortcuts from "./pages/KeyboardShortcuts";
import Support from "./pages/Support";
import ReadingStats from "./pages/ReadingStats";
import CollectionSharePage from "./pages/CollectionSharePage";
import NotificationBell from "./components/NotificationBell";

export const ThemeContext = createContext({ theme: "light", setTheme: () => {} });
export const NotificationContext = createContext({ notifications: [], unreadCount: 0, fetchNotifications: () => {}, markRead: () => {}, markAllRead: () => {}, open: false, setOpen: () => {} });

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-surface p-8">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-10 max-w-lg w-full text-center">
            <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-error text-3xl">error</span>
            </div>
            <h2 className="text-headline-md text-on-surface mb-3">Something went wrong</h2>
            <p className="text-body-md text-on-surface-variant mb-6">{this.state.error.message}</p>
            <button onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}
              className="bg-primary text-on-primary px-8 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity">
              Back to Library
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const { globalSearch } = await import("./api/client");
      const r = await globalSearch(q.trim());
      setResults(r);
    } catch { setResults(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const t = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const total = (results?.papers?.length || 0) + (results?.notes?.length || 0) + (results?.qa?.length || 0);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-surface-container-low border border-outline/60 rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all w-64">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search..."
          className="flex-1 border-0 focus:ring-0 text-body-sm bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant/50"
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults(null); }} className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
      {open && query.trim() && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto custom-scrollbar">
            {loading && (
              <div className="p-4 text-center text-body-sm text-on-surface-variant">Searching...</div>
            )}
            {!loading && results && total === 0 && (
              <div className="p-4 text-center text-body-sm text-on-surface-variant">No results found</div>
            )}
            {!loading && results && total > 0 && (
              <>
                {results.papers?.length > 0 && (
                  <div>
                    <p className="px-4 py-2 text-[10px] font-semibold text-outline uppercase tracking-wider border-b border-outline-variant/30">Papers</p>
                    {results.papers.slice(0, 4).map((p) => (
                      <button key={p.id} onClick={() => { navigate(`/paper/${p.id}`); setOpen(false); setQuery(""); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors flex items-center gap-3">
                        <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                        <span className="text-body-sm text-on-surface truncate">{p.filename || "Untitled"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.notes?.length > 0 && (
                  <div>
                    <p className="px-4 py-2 text-[10px] font-semibold text-outline uppercase tracking-wider border-b border-outline-variant/30">Notes</p>
                    {results.notes.slice(0, 3).map((n) => (
                      <button key={n.id} onClick={() => { navigate(`/paper/${n.paper_id}`); setOpen(false); setQuery(""); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors flex items-center gap-3">
                        <span className="material-symbols-outlined text-[14px] text-secondary">edit_note</span>
                        <span className="text-body-sm text-on-surface truncate">{n.text}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.qa?.length > 0 && (
                  <div>
                    <p className="px-4 py-2 text-[10px] font-semibold text-outline uppercase tracking-wider border-b border-outline-variant/30">Q&A</p>
                    {results.qa.slice(0, 3).map((q) => (
                      <button key={q.id} onClick={() => { navigate(`/paper/${q.paper_id}`); setOpen(false); setQuery(""); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors flex items-center gap-3">
                        <span className="material-symbols-outlined text-[14px] text-success">chat</span>
                        <span className="text-body-sm text-on-surface truncate">{q.question}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => { navigate(`/search?q=${encodeURIComponent(query)}`); setOpen(false); setQuery(""); }}
                  className="w-full text-center py-2.5 text-primary text-body-sm font-medium hover:bg-primary/5 border-t border-outline-variant/30">
                  View all results
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TopBar() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useContext(ThemeContext);
  const onDetail = loc.pathname.startsWith("/paper/");
  const onShare = loc.pathname.startsWith("/share/");

  if (onShare) return null;

  return (
    <header className="fixed top-0 left-0 right-0 xl:left-64 h-16 bg-surface/80 dark:bg-surface/90 backdrop-blur-xl flex items-center justify-between px-8 z-40 border-b border-outline-variant/60">
      <div className="flex items-center gap-3">
        {!onDetail ? (
          <>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center xl:hidden">
              <span className="material-symbols-outlined text-on-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
            </div>
            <h1 className="text-headline-md font-bold text-primary hidden sm:block" style={{ fontFamily: "var(--font-family-heading)" }}>ScholarFlow</h1>
          </>
        ) : (
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span className="text-body-md font-medium hidden sm:inline">Library</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {!onDetail && <GlobalSearch />}
        {!onDetail && (
          <span className="text-body-sm text-on-surface-variant hidden md:inline italic" style={{ fontFamily: "var(--font-family-body)" }}>AI Research Assistant</span>
        )}
        <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="w-9 h-9 rounded-full bg-surface-container-high dark:bg-surface-container-high flex items-center justify-center hover:ring-2 hover:ring-primary/20 transition-all text-on-surface-variant hover:text-primary"
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: theme === "dark" ? "'FILL' 1" : "" }}>
            {theme === "light" ? "dark_mode" : "light_mode"}
          </span>
        </button>
        <NotificationBell />
        <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
          <span className="material-symbols-outlined text-on-primary-container text-[18px]">person</span>
        </div>
      </div>
    </header>
  );
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("scholarflow_theme") || "light"; } catch { return "light"; }
  });

  useEffect(() => {
    try { localStorage.setItem("scholarflow_theme", theme); } catch {}
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { getNotifications } = await import("./api/client");
      const data = await getNotifications(50, false);
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    try {
      const { markNotificationRead } = await import("./api/client");
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Failed to mark notification read:", e);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const { markAllNotificationsRead } = await import("./api/client");
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all notifications read:", e);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, fetchNotifications, markRead, markAllRead, open, setOpen }}>
      {children}
    </NotificationContext.Provider>
  );
}

function GlobalKeyboardShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "?") { e.preventDefault(); navigate("/shortcuts"); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <BrowserRouter>
            <GlobalKeyboardShortcuts />
            <div className="min-h-screen bg-surface flex" style={{ fontFamily: "var(--font-family-ui)" }}>
              <Sidebar />
              <div className="flex-1 min-w-0">
                <TopBar />
                <main className="pt-16 min-h-screen">
                  <Routes>
                    <Route path="/" element={<Library />} />
                    <Route path="/paper/:id" element={<PaperDetail />} />
                    <Route path="/collections" element={<Collections />} />
                    <Route path="/recent" element={<Recent />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/shortcuts" element={<KeyboardShortcuts />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/stats" element={<ReadingStats />} />
                    <Route path="/share/:id" element={<SharePage />} />
                    <Route path="/collection-share/:id" element={<CollectionSharePage />} />
                    <Route path="/multi-qa" element={<MultiQA />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </div>
          </BrowserRouter>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
