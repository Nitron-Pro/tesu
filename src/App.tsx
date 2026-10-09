import { useState, useEffect } from "react";
import { CustomTitlebar } from "@/core/components/CustomTitlebar";
import { HeaderActions } from "@/core/components/HeaderActions";
import { AppSidebar } from "@/core/components/AppSidebar";
import { ChangelogModal } from "@/core/components/ChangelogModal";
import { UpdateModal } from "@/core/components/UpdateModal";
import { UpdateBadge } from "@/core/components/UpdateBadge";
import { AboutModal } from "@/core/components/AboutModal";
import { TraderDashboard } from "@/app/pages/TraderDashboard";
import { AccountsManager } from "@/app/pages/AccountsManager";
import { BotPresets } from "@/app/pages/BotPresets";
import { TelegramSettings } from "@/app/pages/TelegramSettings";
import { ReportsPage } from "@/app/pages/ReportsPage";
import { Settings } from "@/app/pages/Settings";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useUpdaterStore } from "@/core/store/updaterStore";
import { useTraderStore } from "@/app/store/traderStore";
import { SystemService } from "@/core/services/system";

export function App() {
  const [currentPath, setCurrentPath] = useState("/");
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const { t } = useSettingsStore();
  const { checkDailyUpdateIfNeeded, checkChangelogOnStartup } = useUpdaterStore();
  const { connectEngine } = useTraderStore();

  useEffect(() => {
    // 0. Auto start Python Engine if needed and connect WebSocket
    SystemService.startPythonEngine().catch(() => {});
    connectEngine();

    // 1. Check if version was recently upgraded -> auto-open What's New modal!
    const hasUpgrade = checkChangelogOnStartup();
    if (hasUpgrade) {
      setChangelogOpen(true);
    }

    // 2. Perform daily background update check (once per 24 hours)
    checkDailyUpdateIfNeeded();
  }, [checkChangelogOnStartup, checkDailyUpdateIfNeeded, connectEngine]);

  const renderContent = () => {
    switch (currentPath) {
      case "/accounts":
        return <AccountsManager />;
      case "/presets":
        return <BotPresets />;
      case "/telegram":
        return <TelegramSettings />;
      case "/reports":
        return <ReportsPage />;
      case "/settings":
        return <Settings />;
      case "/":
      default:
        return <TraderDashboard />;
    }
  };

  const handleExit = () => {
    setExitConfirmOpen(true);
  };

  const confirmExit = async () => {
    setExitConfirmOpen(false);
    await SystemService.exitApp();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* Frameless Top Window Bar */}
      <CustomTitlebar
        onOpenSettings={() => setCurrentPath("/settings")}
        onOpenChangelog={() => setChangelogOpen(true)}
      />

      {/* Main App Body */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* 3-Level Adaptive Sidebar */}
        <AppSidebar
          currentPath={currentPath}
          onNavigate={(path) => setCurrentPath(path)}
        />

        {/* Workspace Area with Universal Header Bar */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          {/* Header Strip */}
          <div className="h-10 border-b border-border/80 px-4 flex items-center justify-between bg-card/20 shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span className="text-foreground/80 font-medium">{t("workspace")}</span>
              <span>&gt;</span>
              <span className="text-primary">{currentPath}</span>
            </div>

            {/* Header Right / Left Actions */}
            <div className="flex items-center gap-2">
              {/* Dynamic Update Badge (shows when update available or downloaded) */}
              <UpdateBadge />

              {/* System Actions & Profile */}
              <HeaderActions
                onOpenSettings={() => setCurrentPath("/settings")}
                onOpenChangelog={() => setChangelogOpen(true)}
                onOpenAbout={() => setAboutOpen(true)}
                onExit={handleExit}
              />
            </div>
          </div>

          {/* Dynamic Page Content */}
          <div className="flex-1 overflow-y-auto">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Changelog Modal (What's New) */}
      <ChangelogModal
        isOpen={changelogOpen}
        onClose={() => setChangelogOpen(false)}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />

      {/* Exit Confirmation Dialog */}
      {exitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-5 text-card-foreground animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-foreground mb-1.5">
              {t("exitConfirmTitle")}
            </h3>
            <p className="text-xs text-muted-foreground mb-5">
              {t("exitConfirmDesc")}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setExitConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted font-medium transition-colors cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                onClick={confirmExit}
                className="px-4 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs hover:bg-destructive/90 font-medium transition-colors shadow-sm cursor-pointer"
              >
                {t("exit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Update Modal (Check / Download / Restart) */}
      <UpdateModal />
    </div>
  );
}

export default App;
