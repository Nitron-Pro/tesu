import { useState } from "react";
import { 
  Bell, 
  Trash2, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle 
} from "lucide-react";
import { useNotificationStore, ToastItem } from "@/core/store/notificationStore";

const icons = {
  info: <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />,
  success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
  error: <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />,
};

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { history, clearHistory, markAllAsRead } = useNotificationStore();

  const unreadCount = history.filter((h) => !h.read).length;

  const handleToggle = () => {
    if (!isOpen) {
      markAllAsRead();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute end-0 top-full mt-1.5 w-80 rounded-xl border border-border bg-popover shadow-xl z-50 text-popover-foreground animate-in fade-in-50 zoom-in-95 duration-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60 bg-muted/30">
              <div className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">Notifications</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({history.length}/10)
                </span>
              </div>
              <div className="flex items-center gap-1">
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted/70 transition-colors cursor-pointer"
                    title="Clear notification history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-border/40">
              {history.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No notifications recorded yet.
                </div>
              ) : (
                history.map((item: ToastItem) => (
                  <div
                    key={item.id}
                    className="p-3 text-xs hover:bg-muted/40 transition-colors flex items-start gap-2.5"
                  >
                    {icons[item.type]}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold text-foreground text-[11px] truncate">
                          {item.title}
                        </p>
                        <span className="text-[9px] text-muted-foreground font-mono shrink-0">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {item.message && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                          {item.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
