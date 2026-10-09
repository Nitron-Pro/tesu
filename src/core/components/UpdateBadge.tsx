import { Sparkles, RefreshCw } from "lucide-react";
import { useUpdaterStore } from "@/core/store/updaterStore";
import { useSettingsStore } from "@/core/store/settingsStore";
import { cn } from "@/core/utils/cn";

export const UpdateBadge = () => {
  const { updateAvailable, updateDownloaded, availableVersion, openUpdateModal } =
    useUpdaterStore();
  const { t } = useSettingsStore();

  if (!updateAvailable && !updateDownloaded) return null;

  return (
    <button
      onClick={openUpdateModal}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all animate-pulse cursor-pointer shadow-sm",
        updateDownloaded
          ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25"
          : "bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25"
      )}
      title={updateDownloaded ? t("updateDownloadedPrompt") : t("newVersionAvailable")}
    >
      {updateDownloaded ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>{t("restartToApply")}</span>
        </>
      ) : (
        <>
          <Sparkles className="w-3 h-3" />
          <span>v{availableVersion} {t("available")}</span>
        </>
      )}
    </button>
  );
};
