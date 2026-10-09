import { useState } from "react";
import { 
  Settings, 
  Sparkles, 
  Power, 
  HelpCircle,
  MoreVertical,
  Laptop,
  RefreshCw
} from "lucide-react";
import { APP_CONFIG } from "@/app/config";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useUpdaterStore } from "@/core/store/updaterStore";

interface HeaderActionsProps {
  onOpenSettings: () => void;
  onOpenChangelog: () => void;
  onOpenAbout: () => void;
  onExit: () => void;
}

export const HeaderActions = ({
  onOpenSettings,
  onOpenChangelog,
  onOpenAbout,
  onExit,
}: HeaderActionsProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useSettingsStore();
  const { checkForUpdates, currentVersion } = useUpdaterStore();

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Quick Settings Button */}
      <button
        onClick={onOpenSettings}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        title={t("settings")}
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Profile & System Dropdown */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title={t("settings")}
        >
          <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-semibold text-foreground">
            <Laptop className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute end-0 top-full mt-1.5 w-60 rounded-xl border border-border bg-popover p-1.5 shadow-xl z-50 text-popover-foreground animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="px-2.5 py-2 border-b border-border/60 mb-1">
                <p className="text-xs font-semibold">{APP_CONFIG.appName}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {t("version")} {currentVersion} (Core: {APP_CONFIG.coreVersion})
                </p>
              </div>

              {/* Check for Updates */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  checkForUpdates(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-start transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-primary" />
                <span>{t("checkForUpdates")}</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-start transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t("settings")}</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenChangelog();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-start transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{t("whatsNew")}</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenAbout();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-start transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t("about")}</span>
              </button>

              <div className="h-px bg-border/60 my-1" />

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onExit();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-destructive hover:text-destructive-foreground text-destructive text-start transition-colors cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{t("exit")}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
