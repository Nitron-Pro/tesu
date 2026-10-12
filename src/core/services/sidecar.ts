import { invoke } from "@tauri-apps/api/core";

export interface SidecarStatus {
  name: string;
  running: boolean;
  pid?: number;
  message: string;
}

export interface StartSidecarOptions {
  /** Unique name identifier for the sidecar process (e.g. "python_engine", "cpp_worker") */
  name: string;
  /** Executable binary or command path (e.g. "python", "engines/engine.exe") */
  command: string;
  /** Command line arguments */
  args?: string[];
  /** Optional working directory */
  workingDir?: string;
  /** Optional TCP port to verify is free before starting */
  checkPort?: number;
}

export const SidecarService = {
  /**
   * Check if a specific TCP port is free on localhost
   */
  async checkPortAvailable(port: number): Promise<boolean> {
    try {
      return await invoke<boolean>("check_port_available", { port });
    } catch (e) {
      console.warn("checkPortAvailable fallback (browser/mock):", e);
      return true;
    }
  },

  /**
   * Generic starter for any external sidecar binary (Python, C++, Go, Node)
   * Runs detached in the background without creating a console window on Windows.
   */
  async startSidecar(options: StartSidecarOptions): Promise<SidecarStatus> {
    const { name, command, args = [], workingDir, checkPort } = options;

    // Check port conflict if requested
    if (checkPort) {
      const isFree = await this.checkPortAvailable(checkPort);
      if (!isFree) {
        return {
          name,
          running: false,
          message: `Port ${checkPort} is already in use by another process.`,
        };
      }
    }

    try {
      return await invoke<SidecarStatus>("start_sidecar", {
        name,
        command,
        args,
        workingDir: workingDir || null,
      });
    } catch (e) {
      const err = String(e);
      console.error(`Failed to start sidecar [${name}]:`, err);
      return {
        name,
        running: false,
        message: err,
      };
    }
  },

  /**
   * Stop an active sidecar by name
   */
  async stopSidecar(name: string): Promise<SidecarStatus> {
    try {
      return await invoke<SidecarStatus>("stop_sidecar", { name });
    } catch (e) {
      return {
        name,
        running: false,
        message: String(e),
      };
    }
  },

  /**
   * Check if a sidecar is alive and get its status
   */
  async getStatus(name: string): Promise<SidecarStatus> {
    try {
      return await invoke<SidecarStatus>("get_sidecar_status", { name });
    } catch (e) {
      return {
        name,
        running: false,
        message: String(e),
      };
    }
  },

  /**
   * Retrieve standard directories used by Nora for sidecars and data:
   * - exe_dir: Directory where the main executable resides (for portable mode)
   * - app_local_data_dir / suggested_bin_dir: %LOCALAPPDATA%/com.app/bin/
   * - app_data_dir: %APPDATA%/com.app/
   * - resource_dir: Bundled resources directory
   */
  async getSidecarDirectories(): Promise<Record<string, string>> {
    try {
      return await invoke<Record<string, string>>("get_sidecar_directories");
    } catch (e) {
      console.warn("getSidecarDirectories fallback:", e);
      return {};
    }
  },

  /**
   * List of sidecar binaries embedded directly into the executable at compile-time
   */
  async listEmbeddedSidecars(): Promise<string[]> {
    try {
      return await invoke<string[]>("list_embedded_sidecars");
    } catch (e) {
      console.warn("listEmbeddedSidecars fallback:", e);
      return [];
    }
  },
};
