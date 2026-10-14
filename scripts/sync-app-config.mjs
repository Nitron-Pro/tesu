/**
 * Nora Core - App Configuration Synchronizer
 * Automatically synchronizes branding, metadata and update endpoints
 * from `src/app/config.ts` into `src-tauri/tauri.conf.json` and `Cargo.toml`.
 *
 * This allows child applications (like Tesu) to manage all metadata
 * strictly inside `src/app/` without touching `src-tauri/`.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const appConfigFile = path.join(rootDir, "src", "app", "config.ts");
const tauriConfigFile = path.join(rootDir, "src-tauri", "tauri.conf.json");
const customIconsDir = path.join(rootDir, "src", "app", "assets", "icons");
const customBinDir = path.join(rootDir, "src", "app", "assets", "bin");
const tauriIconsDir = path.join(rootDir, "src-tauri", "icons");
const tauriBinDir = path.join(rootDir, "src-tauri", "bin");

function extractValue(content, key) {
  const regex = new RegExp(`${key}:\\s*["']([^"']+)["']`);
  const match = content.match(regex);
  return match ? match[1] : null;
}

function sync() {
  if (!fs.existsSync(appConfigFile)) {
    console.warn("[sync-app-config] src/app/config.ts not found, skipping sync.");
    return;
  }

  const appConfigRaw = fs.readFileSync(appConfigFile, "utf8");
  const appName = extractValue(appConfigRaw, "appName") || "Nora";
  const appId = extractValue(appConfigRaw, "appId") || "com.nora.base";
  const version = extractValue(appConfigRaw, "version") || "1.0.0";
  const updaterEndpoint = extractValue(appConfigRaw, "updaterEndpoint");

  if (!fs.existsSync(tauriConfigFile)) {
    console.warn("[sync-app-config] src-tauri/tauri.conf.json not found.");
    return;
  }

  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigFile, "utf8"));

  // 1. Sync branding metadata
  tauriConfig.productName = appName;
  tauriConfig.version = version;
  tauriConfig.identifier = appId;

  if (tauriConfig.app && tauriConfig.app.windows && tauriConfig.app.windows[0]) {
    tauriConfig.app.windows[0].title = appName;
  }

  // 2. Sync updater endpoint if present
  if (updaterEndpoint) {
    if (!tauriConfig.plugins) tauriConfig.plugins = {};
    if (!tauriConfig.plugins.updater) tauriConfig.plugins.updater = {};
    tauriConfig.plugins.updater.endpoints = [updaterEndpoint];
  }

  // 3. Sync custom app icons if provided in src/app/assets/icons/
  if (fs.existsSync(customIconsDir)) {
    const customFiles = fs.readdirSync(customIconsDir);
    if (customFiles.length > 0) {
      if (!fs.existsSync(tauriIconsDir)) {
        fs.mkdirSync(tauriIconsDir, { recursive: true });
      }
      for (const file of customFiles) {
        fs.copyFileSync(
          path.join(customIconsDir, file),
          path.join(tauriIconsDir, file)
        );
      }
      console.log(`[sync-app-config] Synced ${customFiles.length} custom icons from src/app/assets/icons/`);
    }
  }

  // 4. Sync embedded sidecar binaries/resources if provided in src/app/assets/bin/
  if (fs.existsSync(customBinDir)) {
    const customBinFiles = fs.readdirSync(customBinDir);
    if (customBinFiles.length > 0) {
      if (!fs.existsSync(tauriBinDir)) {
        fs.mkdirSync(tauriBinDir, { recursive: true });
      }
      for (const file of customBinFiles) {
        fs.copyFileSync(
          path.join(customBinDir, file),
          path.join(tauriBinDir, file)
        );
      }
      console.log(`[sync-app-config] Synced ${customBinFiles.length} sidecar binaries from src/app/assets/bin/`);

      // Ensure bundle resources include bin/* so they are packaged into final executable/installer
      if (!tauriConfig.bundle) tauriConfig.bundle = {};
      if (!Array.isArray(tauriConfig.bundle.resources)) {
        tauriConfig.bundle.resources = [];
      }
      if (!tauriConfig.bundle.resources.includes("bin/*")) {
        tauriConfig.bundle.resources.push("bin/*");
      }
    }
  }

  fs.writeFileSync(tauriConfigFile, JSON.stringify(tauriConfig, null, 2), "utf8");
  console.log(`[sync-app-config] Successfully synchronized config for: "${appName}" (v${version}, ${appId})`);
}

sync();
