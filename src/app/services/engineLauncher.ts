import { SidecarService } from "@/core/services/sidecar";

/**
 * Service to manage the Python Trading Engine for Tesu
 * Uses Nora Core's generic SidecarService without modifying Nora Rust core.
 */
export const EngineLauncher = {
  /**
   * Launch Python trading engine via Nora Sidecar
   */
  async start(): Promise<void> {
    const isFree = await SidecarService.checkPortAvailable(9182);
    if (!isFree) {
      console.log("[EngineLauncher] Engine is already running on port 9182");
      return;
    }

    // Try launching standalone engine executable via Nora's smart sidecar resolver
    const candidates = [
      { command: "tesu_engine.exe", args: [] },
      { command: "tesu_engine", args: [] },
      { command: "engine.exe", args: [] },
      { command: "engine", args: [] },
      { command: "pythonw", args: ["engine/main.py"] },
      { command: "python", args: ["engine/main.py"] },
      { command: "py", args: ["engine/main.py"] },
    ];

    for (const cand of candidates) {
      try {
        const res = await SidecarService.startSidecar({
          name: "tesu_engine",
          command: cand.command,
          args: cand.args,
          checkPort: 9182,
        });

        if (res.running) {
          console.log(`[EngineLauncher] Engine successfully started with ${cand.command} (PID: ${res.pid})`);
          return;
        }
      } catch (err) {
        // Continue trying next candidate
      }
    }
  },

  /**
   * Stop trading engine
   */
  async stop(): Promise<void> {
    await SidecarService.stopSidecar("tesu_engine");
  },
};
