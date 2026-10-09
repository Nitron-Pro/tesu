import { useState, useEffect } from "react";
import { 
  Radio, 
  RefreshCw, 
  Printer, 
  Terminal, 
  Send, 
  CheckCircle, 
  Bell, 
  Trash2,
  FileText
} from "lucide-react";
import { HardwareService, SerialPortInfo, PrinterInfo } from "@/core/services/hardware";
import { useSettingsStore } from "@/core/store/settingsStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

export const HardwareTest = () => {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [commandInput, setCommandInput] = useState<string>("PING");
  const [isScanning, setIsScanning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "System HAL initialized. Select a port and send commands.",
  ]);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  const { t } = useSettingsStore();

  const loadHardware = async () => {
    setIsScanning(true);
    try {
      const [portsList, printersList] = await Promise.all([
        HardwareService.listSerialPorts(),
        HardwareService.listPrinters(),
      ]);
      setPorts(portsList);
      setPrinters(printersList);

      if (portsList.length > 0 && !selectedPort) {
        setSelectedPort(portsList[0].port_name);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    loadHardware();
  }, []);

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPort || !commandInput.trim()) return;

    setIsSending(true);
    const cmd = commandInput.trim();
    const timestamp = new Date().toLocaleTimeString();

    setTerminalLogs((prev) => [
      ...prev,
      `[${timestamp}] TX -> ${selectedPort} (${baudRate} baud): ${cmd}`,
    ]);

    try {
      const res = await HardwareService.sendCommand(selectedPort, cmd, baudRate);
      setTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] RX <- ${res.response}`,
      ]);
    } catch (err) {
      setTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ERROR: ${String(err)}`,
      ]);
    } finally {
      setIsSending(false);
      setCommandInput("");
    }
  };

  const handlePrintTestReceipt = async (printerName: string) => {
    setIsPrinting(true);
    try {
      // ESC/POS raw bytes: Initialize [0x1B, 0x40], Text, Line Feed [0x0A], Cut Paper [0x1D, 0x56, 0x00]
      const escPosSample = [
        0x1b, 0x40, // Init
        0x4e, 0x4f, 0x52, 0x41, 0x20, 0x54, 0x45, 0x53, 0x54, 0x0a, // "NORA TEST\n"
        0x1d, 0x56, 0x00, // Cut
      ];

      const res = await HardwareService.printEscPos(printerName, escPosSample);
      setTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] PRINTER: ${res.message}`,
      ]);
    } catch (err) {
      setTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] PRINTER ERROR: ${String(err)}`,
      ]);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } =
        await import("@tauri-apps/plugin-notification");

      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }

      if (permissionGranted) {
        sendNotification({
          title: "Nora Hardware Engine",
          body: "System hardware scan completed successfully offline.",
        });
        setNotificationStatus(t("notificationSent"));
      } else {
        setNotificationStatus("Notification permission not granted.");
      }
    } catch (e) {
      // Browser preview fallback
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("Nora Hardware Engine", {
            body: "System hardware scan completed successfully offline (Web).",
          });
          setNotificationStatus(t("notificationSent"));
        } else {
          Notification.requestPermission().then((p) => {
            if (p === "granted") {
              new Notification("Nora Hardware Engine", {
                body: "System hardware scan completed successfully offline (Web).",
              });
              setNotificationStatus(t("notificationSent"));
            }
          });
        }
      } else {
        alert("Notification: System hardware scan completed successfully offline.");
        setNotificationStatus(t("notificationSent"));
      }
    }

    setTimeout(() => setNotificationStatus(null), 4000);
  };

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Top Banner with Rescan and Notification Test */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{t("hardware")}</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              HAL V2.0
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("scanSubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleTestNotification}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Bell className="w-3.5 h-3.5 text-primary" />
            <span>{t("sendNotification")}</span>
          </Button>

          <Button
            onClick={loadHardware}
            disabled={isScanning}
            size="sm"
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? t("scanning") : t("rescan")}</span>
          </Button>
        </div>
      </div>

      {notificationStatus && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs flex items-center gap-2 animate-in fade-in-50">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notificationStatus}</span>
        </div>
      )}

      {/* Grid: Ports List & Serial Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Available Ports & Control */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                <span>{t("serialPorts")}</span>
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {ports.length} Found
              </Badge>
            </div>
            <CardDescription className="text-[11px]">
              Select target port and baud rate to send raw commands
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="border border-border/70 rounded-xl overflow-hidden bg-background/50 divide-y divide-border/60 max-h-48 overflow-y-auto">
              {ports.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {t("noPortsFound")}
                </div>
              ) : (
                ports.map((p) => (
                  <div
                    key={p.port_name}
                    onClick={() => setSelectedPort(p.port_name)}
                    className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                      selectedPort === p.port_name
                        ? "bg-primary/10 border-s-2 border-primary"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border/60">
                        {p.port_name}
                      </span>
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {p.port_type}
                      </span>
                    </div>
                    {selectedPort === p.port_name && (
                      <Badge variant="success" className="gap-1 text-[9px]">
                        <CheckCircle className="w-2.5 h-2.5" />
                        <span>Active</span>
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Baud rate & Command Dispatch */}
            <form onSubmit={handleSendCommand} className="space-y-2.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground text-[11px]">{t("baudRate")}:</span>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className="bg-background border border-input rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                >
                  <option value={9600}>9600 bps</option>
                  <option value={19200}>19200 bps</option>
                  <option value={38400}>38400 bps</option>
                  <option value={57600}>57600 bps</option>
                  <option value={115200}>115200 bps</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder={t("commandInputPlaceholder")}
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSending || !selectedPort}
                  className="gap-1 shrink-0 px-3"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t("sendCommand")}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Card 2: Serial Terminal Monitor */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <span>{t("terminalOutput")}</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTerminalLogs([])}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              title={t("clearTerminal")}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col">
            <div className="flex-1 min-h-[220px] max-h-[260px] bg-black/90 text-emerald-400 font-mono text-[11px] p-3.5 rounded-xl border border-border/80 overflow-y-auto space-y-1 select-text">
              {terminalLogs.length === 0 ? (
                <div className="text-neutral-500 italic">Terminal ready. Waiting for events...</div>
              ) : (
                terminalLogs.map((log, index) => (
                  <div key={index} className="leading-relaxed break-all">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Printers & Raw ESC/POS Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              <span>{t("installedPrinters")}</span>
            </CardTitle>
            <Badge variant="outline" className="font-mono text-[10px]">
              {printers.length} Printers
            </Badge>
          </div>
          <CardDescription className="text-[11px]">
            Thermal POS receipts, system spooler, and raw ESC/POS integration
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {printers.map((printer) => (
              <div
                key={printer.name}
                className="p-3.5 rounded-xl border border-border bg-background/50 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-foreground truncate">
                      {printer.name}
                    </span>
                    {printer.is_default && (
                      <Badge variant="secondary" className="text-[9px]">
                        {t("defaultPrinter")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">
                    Port: {printer.port}
                  </p>
                </div>

                <Button
                  onClick={() => handlePrintTestReceipt(printer.name)}
                  disabled={isPrinting}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 w-full text-[11px] h-7"
                >
                  <FileText className="w-3 h-3 text-primary" />
                  <span>{isPrinting ? t("printing") : t("printTestReceipt")}</span>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
