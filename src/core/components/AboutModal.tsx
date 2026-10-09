import { X, Globe, ShieldCheck, Cpu } from "lucide-react";
import { APP_CONFIG } from "@/app/config";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useUpdaterStore } from "@/core/store/updaterStore";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal = ({ isOpen, onClose }: AboutModalProps) => {
  const { t, language } = useSettingsStore();
  const { currentVersion } = useUpdaterStore();

  if (!isOpen) return null;

  const aboutInfo = APP_CONFIG.about;
  const description = language === "fa" 
    ? (aboutInfo?.descriptionFa || aboutInfo?.descriptionEn || t("tagline"))
    : (aboutInfo?.descriptionEn || t("tagline"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
      <div 
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 text-card-foreground relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand / Logo & Name */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-black text-xl shadow-md shadow-primary/20">
            {APP_CONFIG.appName.charAt(0)}
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              {APP_CONFIG.appName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-semibold">
                v{currentVersion}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Core v{APP_CONFIG.coreVersion}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Description */}
        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/50 mb-5">
          {description}
        </p>

        {/* App Meta Details */}
        <div className="space-y-2.5 text-xs mb-6">
          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">{t("appIdentifier")}</span>
            <span className="font-mono text-[11px] text-foreground font-medium">{APP_CONFIG.appId}</span>
          </div>

          {aboutInfo?.developer && (
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">{t("developer")}</span>
              <span className="text-foreground font-medium">{aboutInfo.developer}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              {t("coreFramework")}
            </span>
            <span className="text-foreground font-medium">Tauri 2.0 (Rust + Vite)</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              {t("license")}
            </span>
            <span className="text-emerald-500 font-medium">{t("offlineCommercial")}</span>
          </div>

          {aboutInfo?.website && (
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                Website
              </span>
              <a 
                href={aboutInfo.website}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-mono text-[11px]"
              >
                {aboutInfo.website.replace("https://", "")}
              </a>
            </div>
          )}
        </div>

        {/* Footer & Copyright */}
        <div className="pt-2 text-center border-t border-border/50">
          <p className="text-[10px] text-muted-foreground">
            {aboutInfo?.copyright || `© 2026 ${APP_CONFIG.appName}. All rights reserved.`}
          </p>
        </div>
      </div>
    </div>
  );
};
