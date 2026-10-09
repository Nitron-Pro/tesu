import { invoke } from "@tauri-apps/api/core";

export interface SystemInfo {
  os: string;
  arch: string;
  app_version: string;
}

export const SystemService = {
  async getSystemInfo(): Promise<SystemInfo> {
    try {
      return await invoke<SystemInfo>("get_system_info");
    } catch (e) {
      return {
        os: "windows",
        arch: "x86_64",
        app_version: "1.0.0",
      };
    }
  },

  async exitApp(): Promise<void> {
    try {
      await invoke("exit_app");
    } catch (e) {
      console.warn("exitApp fallback for browser mode");
      window.close();
    }
  },

  async startPythonEngine(): Promise<string> {
    try {
      return await invoke<string>("start_python_engine");
    } catch (e) {
      console.warn("startPythonEngine error or browser mode", e);
      return String(e);
    }
  },
};
