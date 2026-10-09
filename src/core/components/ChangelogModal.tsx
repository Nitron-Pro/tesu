import { X, Sparkles, Calendar, CheckCircle2 } from "lucide-react";
import changelogData from "@/app/changelog.json";
import { APP_CONFIG } from "@/app/config";
import { useSettingsStore } from "@/core/store/settingsStore";
import { Button } from "@/components/ui/Button";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal = ({ isOpen, onClose }: ChangelogModalProps) => {
  const { t } = useSettingsStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-[520px] max-w-[92vw] max-h-[85vh] bg-popover border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-popover-foreground">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{t("whatsNew")}</h3>
              <p className="text-[11px] text-muted-foreground">
                {APP_CONFIG.appName} release notes & history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Changelog Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {changelogData.map((item, index) => (
            <div key={index} className="space-y-2.5 border-b border-border/60 pb-5 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-mono">
                    v{item.version}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {item.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span className="font-mono">{item.date}</span>
                </div>
              </div>

              <ul className="space-y-1.5 pt-1">
                {item.highlights.map((h, hIdx) => (
                  <li key={hIdx} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-mono">
            {t("currentVersion")}: v{APP_CONFIG.version}
          </span>
          <Button onClick={onClose} size="sm">
            {t("gotIt")}
          </Button>
        </div>
      </div>
    </div>
  );
};
