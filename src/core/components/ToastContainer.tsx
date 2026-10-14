import { 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  X 
} from "lucide-react";
import { useNotificationStore, ToastItem } from "@/core/store/notificationStore";
import { Button } from "@/components/ui/Button";

const icons = {
  info: <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
  error: <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />,
};

const borderColors = {
  info: "border-sky-500/30",
  success: "border-emerald-500/30",
  warning: "border-amber-500/30",
  error: "border-destructive/40",
};

export const ToastContainer = () => {
  const { activeToasts, dismissToast } = useNotificationStore();

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 end-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2 sm:px-0">
      {activeToasts.map((toast: ToastItem) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex flex-col gap-2 p-3.5 rounded-xl bg-card/95 backdrop-blur-md border ${borderColors[toast.type]} shadow-xl text-card-foreground animate-in slide-in-from-bottom-5 fade-in-0 duration-200`}
        >
          <div className="flex items-start gap-2.5">
            {icons[toast.type]}
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs font-semibold text-foreground tracking-tight">
                {toast.title}
              </h4>
              {toast.message && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed break-words">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action buttons (Confirm / Cancel flow) */}
          {(toast.confirmAction || toast.cancelAction) && (
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40 mt-1">
              {toast.cancelAction && (
                <Button
                  onClick={toast.cancelAction.onClick}
                  variant={toast.cancelAction.variant || "outline"}
                  size="sm"
                  className="h-6 text-[11px] px-2.5"
                >
                  {toast.cancelAction.label}
                </Button>
              )}
              {toast.confirmAction && (
                <Button
                  onClick={toast.confirmAction.onClick}
                  variant={toast.confirmAction.variant || "default"}
                  size="sm"
                  className="h-6 text-[11px] px-3 font-medium"
                >
                  {toast.confirmAction.label}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
