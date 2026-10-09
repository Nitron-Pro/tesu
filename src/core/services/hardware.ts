import { invoke } from "@tauri-apps/api/core";

export interface SerialPortInfo {
  port_name: string;
  port_type: string;
}

export interface SendCommandResponse {
  success: boolean;
  bytes_written: number;
  response: string;
}

export interface PrinterInfo {
  name: string;
  is_default: boolean;
  port: string;
}

export interface PrintResult {
  success: boolean;
  message: string;
}

export const HardwareService = {
  /**
   * Scan and list all available serial COM ports on the Windows machine
   */
  async listSerialPorts(): Promise<SerialPortInfo[]> {
    try {
      return await invoke<SerialPortInfo[]>("list_serial_ports");
    } catch (error) {
      console.warn("HardwareService.listSerialPorts error or browser mode:", error);
      // Fallback demo mock if running in browser
      return [
        { port_name: "COM1", port_type: "Communications Port (RS232)" },
        { port_name: "COM3", port_type: "USB (VID: 2341, PID: 0043) Arduino Uno" },
        { port_name: "COM4", port_type: "USB (VID: 0416, PID: 5011) POS Thermal Printer" },
      ];
    }
  },

  /**
   * Send a raw string or hex command to a serial device (Arduino, Scales, Barcode Scanners)
   */
  async sendCommand(
    portName: string,
    command: string,
    baudRate = 9600,
    timeoutMs = 1500
  ): Promise<SendCommandResponse> {
    try {
      return await invoke<SendCommandResponse>("send_serial_command", {
        portName,
        baudRate,
        command,
        timeoutMs,
      });
    } catch (error) {
      console.warn("HardwareService.sendCommand browser fallback:", error);
      // Fallback simulated echo for browser preview
      return {
        success: true,
        bytes_written: command.length,
        response: `[Echo from ${portName}]: ACK: ${command.trim()}`,
      };
    }
  },

  /**
   * List installed Windows printers (Thermal, PDF, Laser, Network)
   */
  async listPrinters(): Promise<PrinterInfo[]> {
    try {
      return await invoke<PrinterInfo[]>("list_printers");
    } catch (error) {
      console.warn("HardwareService.listPrinters browser fallback:", error);
      return [
        { name: "Microsoft Print to PDF", is_default: true, port: "PORTPROMPT:" },
        { name: "Bixolon SRP-350plus Thermal POS", is_default: false, port: "USB001" },
        { name: "Epson TM-T20II Receipt", is_default: false, port: "COM4" },
      ];
    }
  },

  /**
   * Send raw ESC/POS bytes to a thermal receipt printer
   */
  async printEscPos(printerName: string, data: number[]): Promise<PrintResult> {
    try {
      return await invoke<PrintResult>("print_raw_esc_pos", {
        printerName,
        data,
      });
    } catch (error) {
      console.warn("HardwareService.printEscPos browser fallback:", error);
      return {
        success: true,
        message: `Simulated receipt printed on '${printerName}' (${data.length} bytes)`,
      };
    }
  },
};
