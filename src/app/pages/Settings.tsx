import { useSettingsStore } from "@/core/store/settingsStore";
import { useUpdaterStore } from "@/core/store/updaterStore";
import { Moon, Globe, RefreshCw, Sparkles, Server, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { APP_CONFIG } from "@/app/config";

export const Settings = () => {
  const { theme, language, autoUpdate, setTheme, setLanguage, setAutoUpdate, t } =
    useSettingsStore();

  const {
    currentVersion,
    isChecking,
    lastCheckedTime,
    checkForUpdates,
    simulateReleaseAvailable,
    resetVersion,
  } = useUpdaterStore();

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          {t("systemSettings")}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("settingsSubtitle")}
        </p>
      </div>

      <div className="space-y-4">
        {/* Appearance & Theme */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs flex items-center gap-2">
              <Moon className="w-4 h-4 text-primary" />
              <span>{t("themeAppearance")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-xs">
              <div>
                <p className="font-medium text-foreground">{t("themeMode")}</p>
                <p className="text-muted-foreground text-[11px]">
                  {t("themeModeDesc")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl border border-border/60">
                <Button
                  onClick={() => setTheme("dark")}
                  variant={theme === "dark" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                >
                  {t("dark")}
                </Button>
                <Button
                  onClick={() => setTheme("light")}
                  variant={theme === "light" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                >
                  {t("light")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language & Direction */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <span>{t("langDirection")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-xs">
              <div>
                <p className="font-medium text-foreground">{t("activeLanguage")}</p>
                <p className="text-muted-foreground text-[11px]">
                  {t("langDesc")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl border border-border/60">
                <Button
                  onClick={() => setLanguage("en")}
                  variant={language === "en" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                >
                  {t("english")}
                </Button>
                <Button
                  onClick={() => setLanguage("fa")}
                  variant={language === "fa" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                >
                  {t("persian")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Updates & Releases Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <span>{t("updatesReleases")}</span>
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px]">
                v{currentVersion}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Version & Check Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs p-3.5 rounded-xl bg-background/50 border border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {APP_CONFIG.appName}
                  </span>
                  <Badge variant="success">{t("stableChannel")}</Badge>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {t("lastChecked")}: {lastCheckedTime || t("never")}
                </p>
              </div>

              <Button
                onClick={() => checkForUpdates(true)}
                disabled={isChecking}
                size="sm"
                className="gap-2 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
                <span>{isChecking ? t("checkingForUpdates") : t("checkForUpdates")}</span>
              </Button>
            </div>

            {/* Background Update Toggle */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
              <div>
                <p className="font-medium text-foreground">{t("autoUpdates")}</p>
                <p className="text-muted-foreground text-[11px]">
                  {t("autoUpdatesDesc")}
                </p>
              </div>
              <button
                onClick={() => setAutoUpdate(!autoUpdate)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                  autoUpdate ? "bg-primary" : "bg-muted border border-border"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-background shadow-sm transition-transform ${
                    autoUpdate ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Server Endpoint architecture info */}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5" />
                <span className="text-[11px]">{t("endpointLabel")}:</span>
              </div>
              <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                {APP_CONFIG.updaterEndpoint}
              </code>
            </div>

            {/* Developer Testing Bar for Updater Flow */}
            <div className="p-3 rounded-xl bg-card border border-dashed border-border/80 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Dev & Offline Testing Tools
              </span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => simulateReleaseAvailable("1.1.0")}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-[11px] h-7"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{t("testNewRelease")}</span>
                </Button>
                <Button
                  onClick={resetVersion}
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-[11px] h-7 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t("resetVersionSimulation")}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
