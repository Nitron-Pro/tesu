import { Sparkles, Download, RefreshCw, CheckCircle, X, ArrowRight } from "lucide-react";
import { useUpdaterStore } from "@/core/store/updaterStore";
import { useSettingsStore } from "@/core/store/settingsStore";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export const UpdateModal = () => {
  const {
    showUpdateModal,
    dismissModal,
    isChecking,
    isDownloading,
    downloadProgress,
    updateAvailable,
    updateDownloaded,
    availableVersion,
    currentVersion,
    releaseChangelog,
    downloadUpdate,
    applyAndRestart,
  } = useUpdaterStore();
  const { t } = useSettingsStore();

  if (!showUpdateModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-[480px] max-w-[92vw] bg-popover border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-popover-foreground">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {updateDownloaded
                  ? t("updateDownloadedPrompt")
                  : updateAvailable
                  ? t("newVersionAvailable")
                  : t("checkForUpdates")}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                {t("currentVersion")}: v{currentVersion}
              </p>
            </div>
          </div>
          <button
            onClick={dismissModal}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {isChecking ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">{t("checkingForUpdates")}</p>
            </div>
          ) : !updateAvailable ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">{t("upToDate")}</p>
              <p className="text-xs text-muted-foreground font-mono">
                v{currentVersion} is currently the latest version.
              </p>
            </div>
          ) : (
            <>
              {/* New Version Info */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      v{availableVersion}
                    </span>
                    <Badge variant="success">New Release</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Available for download & upgrade
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <span>v{currentVersion}</span>
                  <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                  <span className="text-primary font-bold">v{availableVersion}</span>
                </div>
              </div>

              {/* Changelog Highlights */}
              {releaseChangelog && releaseChangelog.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground">
                    Highlights in this version:
                  </h4>
                  <ul className="space-y-1.5 max-h-36 overflow-y-auto pe-1">
                    {releaseChangelog.map((item, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Download Progress Bar */}
              {isDownloading && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t("downloadingUpdate")}</span>
                    <span className="font-mono font-medium">{downloadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismissModal}>
            {t("postpone")}
          </Button>

          {updateDownloaded ? (
            <Button
              variant="default"
              size="sm"
              onClick={applyAndRestart}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t("restartToApply")}</span>
            </Button>
          ) : updateAvailable ? (
            <Button
              variant="default"
              size="sm"
              disabled={isDownloading}
              onClick={downloadUpdate}
              className="gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? t("downloadingUpdate") : t("downloadUpdate")}</span>
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={dismissModal}>
              {t("gotIt")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
