import { Minus, Square, Copy, X } from "lucide-react";
import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { APP_CONFIG } from "@/app/config";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useUpdaterStore } from "@/core/store/updaterStore";
import { SystemService } from "@/core/services/system";

interface CustomTitlebarProps {
  onOpenSettings?: () => void;
  onOpenChangelog?: () => void;
}

export const CustomTitlebar = ({}: CustomTitlebarProps) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { t } = useSettingsStore();
  const { currentVersion } = useUpdaterStore();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupWindowState = async () => {
      try {
        const appWindow = getCurrentWindow();
        const max = await appWindow.isMaximized();
        setIsMaximized(max);

        unlisten = await appWindow.onResized(async () => {
          try {
            const isMax = await appWindow.isMaximized();
            setIsMaximized(isMax);
          } catch (e) {
            // ignore
          }
        });
      } catch (e) {
        // Fallback for browser mode
      }
    };

    setupWindowState();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.log("Minimize clicked (browser preview mode)", e);
    }
  };

  const handleMaximizeToggle = async () => {
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      const max = await win.isMaximized();
      setIsMaximized(max);
    } catch (e) {
      console.log("Toggle maximize clicked (browser preview mode)", e);
    }
  };

  const handleClose = async () => {
    try {
      await SystemService.exitApp();
    } catch (e) {
      console.log("Close clicked (browser preview mode)", e);
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="h-9 w-full bg-background/95 border-b border-border/60 flex items-center justify-between select-none px-3 z-50 text-foreground"
    >
      {/* App Title & Dynamic Icon */}
      <div className="flex items-center gap-2 pointer-events-none">
        <img 
          src="/logo.png" 
          alt="Tesu Logo" 
          className="w-5 h-5 object-contain filter drop-shadow" 
          onError={(e) => {
            // fallback if not found
            (e.currentTarget as HTMLElement).style.display = "none";
          }}
        />
        <span className="text-xs font-semibold tracking-wide">
          {APP_CONFIG.appName}
        </span>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
          v{currentVersion}
        </span>
      </div>

      {/* Window Controls (Minimize, Maximize/Restore, Close) */}
      <div className="flex items-center h-full -me-3">
        <button
          onClick={handleMinimize}
          className="h-full px-3.5 hover:bg-muted/70 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          title={t("minimize")}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximizeToggle}
          className="h-full px-3.5 hover:bg-muted/70 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          title={isMaximized ? t("restore") : t("maximize")}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors text-muted-foreground cursor-pointer"
          title={t("close")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
