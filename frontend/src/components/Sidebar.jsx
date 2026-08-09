import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { ThemeContext } from "../App";

const primaryNav = [
  { to: "/", icon: "book_2", label: "Library" },
  { to: "/collections", icon: "folder", label: "Collections" },
  { to: "/recent", icon: "history", label: "Recent" },
  { to: "/search", icon: "search", label: "Search" },
  { to: "/activity", icon: "trending_up", label: "Activity" },
];

const secondaryNav = [
  { to: "/settings", icon: "settings", label: "Settings" },
  { to: "/shortcuts", icon: "keyboard", label: "Keyboard Shortcuts" },
  { to: "/support", icon: "help", label: "Support" },
];

export default function Sidebar() {
  const loc = useLocation();
  const navTo = useNavigate();
  const { theme, setTheme } = useContext(ThemeContext);

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-surface border-r border-outline-variant/60 flex flex-col py-6 px-3 z-50">
      <div className="mb-8 px-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-on-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
        </div>
        <div>
          <h1 className="text-title-lg font-bold text-on-surface leading-tight" style={{ fontFamily: "var(--font-family-heading)" }}>ScholarFlow</h1>
          <p className="text-body-sm text-on-surface-variant italic" style={{ fontFamily: "var(--font-family-body)" }}>Academic Workspace</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        <div className="px-2 py-1 text-[10px] font-semibold text-outline uppercase tracking-wider">Browse</div>
        {primaryNav.map((item) => {
          const active = loc.pathname === item.to || (item.to !== "/" && loc.pathname.startsWith(item.to));
          return (
            <Link key={item.to} to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-body-md transition-all duration-150 ${
                active ? "bg-primary/10 text-primary font-medium" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}>
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}

        <div className="my-4 border-t border-outline-variant/60" />
        <div className="px-2 py-1 text-[10px] font-semibold text-outline uppercase tracking-wider">Settings</div>
        {secondaryNav.map((item) => {
          const active = loc.pathname === item.to || (item.to !== "/" && loc.pathname.startsWith(item.to));
          return (
            <Link key={item.to} to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-body-md transition-all duration-150 ${
                active ? "bg-primary/10 text-primary font-medium" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}>
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 px-1 border-t border-outline-variant/60 pt-4">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-body-sm text-on-surface-variant">Theme</span>
          <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center hover:ring-2 hover:ring-primary/20 transition-all text-on-surface-variant hover:text-primary"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: theme === "dark" ? "'FILL' 1" : "" }}>
              {theme === "light" ? "dark_mode" : "light_mode"}
            </span>
          </button>
        </div>
        <button onClick={() => navTo("/")}
          className="w-full bg-primary text-on-primary font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-150 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98]">
          <span className="material-symbols-outlined text-[20px]">upload_file</span>
          Upload Document
        </button>
        <div className="pt-3">
          <div className="flex items-center gap-3 px-4 py-2.5 text-on-surface-variant text-body-md">
            <span className="material-symbols-outlined text-[20px]">info</span>
            <span>v1.0 ScholarFlow</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
