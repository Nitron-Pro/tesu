import { useSettingsStore } from "@/core/store/settingsStore";
import { useUpdaterStore } from "@/core/store/updaterStore";
import { useNotificationStore } from "@/core/store/notificationStore";
import { sendWindowsTestNotification } from "@/core/services/systemNotify";
import { Moon, Globe, RefreshCw, Server, Type, Bell } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { APP_CONFIG } from "@/app/config";

export const Settings = () => {
  const { theme, language, faFont, enFont, autoUpdate, setTheme, setLanguage, setFaFont, setEnFont, setAutoUpdate, t } =
    useSettingsStore();
  const { toast } = useNotificationStore();

  const {
    currentVersion,
    isChecking,
    lastCheckedTime,
    checkForUpdates,
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
                  onClick={() => setTheme("midnight")}
                  variant={theme === "midnight" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                >
                  {t("midnight")}
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" />
              <span>{t("fontPair")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-xs gap-3">
              <div>
                <p className="font-medium text-foreground">{t("faFont")}</p>
                <p className="text-muted-foreground text-[11px]">{t("faFontDesc")}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl border border-border/60">
                <Button onClick={() => setFaFont("vazirmatn")} variant={faFont === "vazirmatn" ? "default" : "ghost"} size="sm" className="h-7 text-xs">{t("fontVazir")}</Button>
                <Button onClick={() => setFaFont("estedad")} variant={faFont === "estedad" ? "default" : "ghost"} size="sm" className="h-7 text-xs">{t("fontEstedad")}</Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs gap-3 pt-3 border-t border-border/60">
              <div>
                <p className="font-medium text-foreground">{t("enFont")}</p>
                <p className="text-muted-foreground text-[11px]">{t("enFontDesc")}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl border border-border/60">
                <Button onClick={() => setEnFont("inter")} variant={enFont === "inter" ? "default" : "ghost"} size="sm" className="h-7 text-xs">{t("fontInter")}</Button>
                <Button onClick={() => setEnFont("dm-sans")} variant={enFont === "dm-sans" ? "default" : "ghost"} size="sm" className="h-7 text-xs">{t("fontDm")}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span>{t("testWindowsNotify")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const result = await sendWindowsTestNotification(
                  APP_CONFIG.appName,
                  "Tesu Windows notification test"
                );
                if (result.ok) {
                  toast({ type: "success", title: t("testWindowsNotify"), message: t("notifySent"), duration: 7000 });
                } else if (result.detail === "permission-denied") {
                  toast({ type: "warning", title: t("testWindowsNotify"), message: t("notifyDenied") });
                } else {
                  toast({ type: "error", title: t("notifyFailed"), message: result.detail, duration: 8000 });
                }
              }}
            >
              {t("testWindowsNotify")}
            </Button>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
