import { create } from "zustand";
import { APP_CONFIG } from "@/app/config";
import { UpdaterService } from "@/core/services/updater";
import { useSettingsStore } from "@/core/store/settingsStore";

interface UpdaterState {
  currentVersion: string;
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  availableVersion: string | null;
  releaseChangelog: string[];
  lastCheckedTime: string | null;
  notificationMessage: string | null;
  showUpdateModal: boolean;

  // Actions
  checkForUpdates: (manual?: boolean) => Promise<void>;
  downloadUpdate: () => Promise<void>;
  applyAndRestart: () => void;
  dismissModal: () => void;
  openUpdateModal: () => void;
  checkDailyUpdateIfNeeded: () => Promise<void>;
  checkChangelogOnStartup: () => boolean;
  simulateReleaseAvailable: (simVersion?: string) => void;
  resetVersion: () => void;
}

const STORAGE_LAST_CHECK = "nora_last_update_check";
const STORAGE_LAST_SEEN_VERSION = "nora_last_seen_version";
const STORAGE_SIM_VERSION = "nora_simulated_version";

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  currentVersion: localStorage.getItem(STORAGE_SIM_VERSION) || APP_CONFIG.version,
  isChecking: false,
  isDownloading: false,
  downloadProgress: 0,
  updateAvailable: false,
  updateDownloaded: false,
  availableVersion: null,
  releaseChangelog: [],
  lastCheckedTime: localStorage.getItem(STORAGE_LAST_CHECK),
  notificationMessage: null,
  showUpdateModal: false,

  dismissModal: () => set({ showUpdateModal: false }),
  openUpdateModal: () => set({ showUpdateModal: true }),

  /**
   * Check if an update is available
   */
  checkForUpdates: async (manual = false) => {
    set({ isChecking: true, notificationMessage: null });

    try {
      const result = await UpdaterService.check();
      const nowStr = new Date().toLocaleString();
      localStorage.setItem(STORAGE_LAST_CHECK, nowStr);

      if (result.hasUpdate) {
        set({
          updateAvailable: true,
          availableVersion: result.latestVersion,
          releaseChangelog: result.changelog,
          lastCheckedTime: nowStr,
          isChecking: false,
          showUpdateModal: manual || !useSettingsStore.getState().autoUpdate,
        });

        // If autoUpdate is enabled, automatically begin background download!
        if (useSettingsStore.getState().autoUpdate && !get().updateDownloaded) {
          get().downloadUpdate();
        }
      } else {
        set({
          updateAvailable: false,
          availableVersion: null,
          lastCheckedTime: nowStr,
          isChecking: false,
          notificationMessage: manual ? "upToDate" : null,
          showUpdateModal: manual,
        });
      }
    } catch (err) {
      set({ isChecking: false });
    }
  },

  /**
   * Simulate downloading the update package (works with live progress)
   */
  downloadUpdate: async () => {
    if (get().isDownloading || get().updateDownloaded) return;

    set({ isDownloading: true, downloadProgress: 0 });

    for (let progress = 10; progress <= 100; progress += 15) {
      await new Promise((res) => setTimeout(res, 350));
      set({ downloadProgress: Math.min(progress, 100) });
    }

    set({
      isDownloading: false,
      downloadProgress: 100,
      updateDownloaded: true,
      notificationMessage: "updateDownloadedPrompt",
      showUpdateModal: true,
    });
  },

  /**
   * Restart to apply update:
   * updates the local version, triggers reload, which then shows What's New modal!
   */
  applyAndRestart: () => {
    const nextVersion = get().availableVersion || "1.1.0";
    localStorage.setItem(STORAGE_SIM_VERSION, nextVersion);
    set({
      currentVersion: nextVersion,
      updateAvailable: false,
      updateDownloaded: false,
      availableVersion: null,
      showUpdateModal: false,
    });

    try {
      window.location.reload();
    } catch (e) {
      console.log("Reload fallback");
    }
  },

  /**
   * Daily check: runs once per 24 hours automatically on startup
   */
  checkDailyUpdateIfNeeded: async () => {
    const lastCheck = localStorage.getItem(STORAGE_LAST_CHECK);
    if (!lastCheck) {
      get().checkForUpdates(false);
      return;
    }

    const lastDate = new Date(lastCheck).getTime();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (now - lastDate > oneDayMs) {
      get().checkForUpdates(false);
    }
  },

  /**
   * On startup, check if we upgraded since last run.
   * If yes, return true to prompt the What's New changelog modal!
   */
  checkChangelogOnStartup: () => {
    const activeVersion = localStorage.getItem(STORAGE_SIM_VERSION) || APP_CONFIG.version;
    const lastSeen = localStorage.getItem(STORAGE_LAST_SEEN_VERSION);

    if (lastSeen && lastSeen !== activeVersion) {
      // Version changed! Update last seen and show modal
      localStorage.setItem(STORAGE_LAST_SEEN_VERSION, activeVersion);
      return true;
    }

    if (!lastSeen) {
      // First run: register initial version
      localStorage.setItem(STORAGE_LAST_SEEN_VERSION, activeVersion);
    }

    return false;
  },

  /**
   * For testing & demonstration of the release flow
   */
  simulateReleaseAvailable: (simVersion = "1.1.0") => {
    set({
      updateAvailable: true,
      availableVersion: simVersion,
      updateDownloaded: false,
      releaseChangelog: [
        "Major performance upgrade for Serial port listener",
        "Automatic background updater with daily interval",
        "Enhanced Dark Mode aesthetics & full Persian RTL support",
      ],
      showUpdateModal: true,
    });
  },

  resetVersion: () => {
    localStorage.removeItem(STORAGE_SIM_VERSION);
    localStorage.removeItem(STORAGE_LAST_SEEN_VERSION);
    set({
      currentVersion: APP_CONFIG.version,
      updateAvailable: false,
      updateDownloaded: false,
      availableVersion: null,
      downloadProgress: 0,
      showUpdateModal: false,
    });
    window.location.reload();
  },
}));
