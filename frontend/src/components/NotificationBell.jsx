import { useRef, useEffect } from "react";
import { useContext } from "react";
import { NotificationContext } from "../App";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
  const { notifications, unreadCount, open, setOpen, markRead, markAllRead, fetchNotifications } = useContext(NotificationContext);
  const navigate = useNavigate();
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const notificationContent = notifications.length === 0 ? (
    <div className="p-6 text-center text-on-surface-variant italic" style={{ fontFamily: "var(--font-family-body)" }}>No notifications yet</div>
  ) : (
    <div>
      {notifications.map((n) => (
        <button
          key={n.id}
          onClick={() => {
            if (!n.read) markRead(n.id);
            if (n.paper_id) navigate(`/paper/${n.paper_id}`);
            setOpen(false);
          }}
          className={`w-full text-left p-3 border-b border-outline-variant/30 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
        >
          <div className="flex items-start gap-2">
            <span className={`material-symbols-outlined text-[18px] ${n.type === "regeneration" ? "text-primary" : n.type === "comparison" ? "text-secondary" : "text-on-surface-variant"}`}>
              {n.type === "regeneration" ? "refresh" : n.type === "comparison" ? "science" : "info"}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-body-sm font-medium ${!n.read ? "text-on-surface" : "text-on-surface-variant"}`}>{n.title}</p>
              <p className="text-[11px] text-on-surface-variant/70 truncate">{n.message}</p>
              <p className="text-[10px] text-on-surface-variant/50 mt-1">{new Date(n.created_at * 1000).toLocaleString()}</p>
            </div>
            {!n.read && <span className="w-2 h-2 bg-primary rounded-full mt-1 shrink-0" />}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative" ref={notificationRef}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="w-9 h-9 rounded-full bg-surface-container-high dark:bg-surface-container-high flex items-center justify-center hover:ring-2 hover:ring-primary/20 transition-all text-on-surface-variant hover:text-primary relative"
        title="Notifications"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-error rounded-full text-white text-[10px] font-medium flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-outline-variant/40">
            <h3 className="text-title-md font-semibold text-on-surface" style={{ fontFamily: "var(--font-family-heading)" }}>Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-primary text-[12px] font-medium hover:underline">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notificationContent}
          </div>
        </div>
      )}
    </div>
  );
}
