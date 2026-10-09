import { APP_CONFIG } from "@/app/config";

export interface RemoteReleaseManifest {
  version: string;
  notes: string;
  pub_date: string;
  changelog?: string[];
  platforms?: Record<string, { url: string; signature?: string }>;
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  changelog: string[];
  manifest?: RemoteReleaseManifest;
}

export const UpdaterService = {
  /**
   * Check for updates by fetching the release manifest.
   * Works with local endpoints (e.g. /updates/releases.json)
   * and can be pointed to any remote HTTPS / CDN server.
   */
  async check(): Promise<CheckUpdateResult> {
    const currentVersion = localStorage.getItem("nora_simulated_version") || APP_CONFIG.version;
    const endpoint = APP_CONFIG.updaterEndpoint || "/updates/releases.json";

    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch updates manifest: ${response.statusText}`);
      }

      const manifest: RemoteReleaseManifest = await response.json();
      const hasUpdate = this.compareSemver(manifest.version, currentVersion) > 0;

      return {
        hasUpdate,
        currentVersion,
        latestVersion: manifest.version,
        changelog: manifest.changelog || [manifest.notes],
        manifest,
      };
    } catch (err) {
      console.warn("UpdaterService: manifest fetch error or offline, fallback:", err);
      // Fallback check against local manifest in public
      try {
        const localResp = await fetch("/updates/releases.json");
        const manifest: RemoteReleaseManifest = await localResp.json();
        const hasUpdate = this.compareSemver(manifest.version, currentVersion) > 0;
        return {
          hasUpdate,
          currentVersion,
          latestVersion: manifest.version,
          changelog: manifest.changelog || [manifest.notes],
          manifest,
        };
      } catch (fallbackErr) {
        return {
          hasUpdate: false,
          currentVersion,
          latestVersion: currentVersion,
          changelog: [],
        };
      }
    }
  },

  /**
   * Helper to compare two SemVer strings (e.g. 1.1.0 vs 1.0.0)
   * Returns: 1 if vA > vB, -1 if vA < vB, 0 if equal
   */
  compareSemver(vA: string, vB: string): number {
    const pA = vA.replace(/^v/, "").split(".").map(Number);
    const pB = vB.replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const a = pA[i] || 0;
      const b = pB[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  },
};
