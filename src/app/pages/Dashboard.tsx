import { useState, useEffect } from "react";
import { 
  Radio, 
  RefreshCw, 
  CheckCircle, 
  ShieldCheck,
  Cpu,
  Layers,
  ArrowUpRight
} from "lucide-react";
import { HardwareService, SerialPortInfo } from "@/core/services/hardware";
import { useSettingsStore } from "@/core/store/settingsStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { APP_CONFIG } from "@/app/config";

export const Dashboard = () => {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const { t } = useSettingsStore();

  const scanPorts = async () => {
    setScanning(true);
    try {
      const result = await HardwareService.listSerialPorts();
      setPorts(result);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    scanPorts();
  }, []);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-card via-card to-muted/40 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t("appName")}
            </h1>
            <Badge variant="outline" className="font-mono">
              v{APP_CONFIG.version}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            {t("tagline")}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-background/90 border border-border px-3.5 py-1.5 rounded-xl text-xs font-medium text-emerald-500 shadow-sm shrink-0">
          <ShieldCheck className="w-4 h-4" />
          <span>{t("engineActive")}</span>
        </div>
      </div>

      {/* Hardware COM Ports Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>{t("scanSerialPorts")}</CardTitle>
              <CardDescription>{t("scanSubtitle")}</CardDescription>
            </div>
          </div>
          <Button
            onClick={scanPorts}
            disabled={scanning}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
            <span>{scanning ? t("scanning") : t("rescan")}</span>
          </Button>
        </CardHeader>

        <CardContent>
          <div className="border border-border/80 rounded-xl overflow-hidden bg-background/50">
            {ports.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {t("noPortsFound")}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {ports.map((port, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-3 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                        {port.port_name}
                      </span>
                      <span className="text-muted-foreground truncate max-w-md">
                        {port.port_type}
                      </span>
                    </div>
                    <Badge variant="success" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>{t("available")}</span>
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Layers className="w-4 h-4 text-primary" />
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <CardTitle className="text-xs pt-2">Core vs App Isolation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Base system logic is strictly contained in <code className="text-primary font-mono">src/core/</code>. Build new apps in <code className="text-primary font-mono">src/app/</code>.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Cpu className="w-4 h-4 text-primary" />
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <CardTitle className="text-xs pt-2">Hardware Abstraction</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Safe Rust bindings for COM ports, raw thermal printers, barcode scanners, and system hardware queries.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Radio className="w-4 h-4 text-primary" />
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <CardTitle className="text-xs pt-2">Offline-First & Updater</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              In-app update engine with daily auto-check, local changelog popup, and seamless transition to cloud releases.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
