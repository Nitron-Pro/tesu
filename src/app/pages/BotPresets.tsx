import { useState } from "react";
import { Bot } from "lucide-react";

interface Preset {
  id: string;
  title: string;
  symbol: string;
  timeframe: string;
  defaultRiskUsd: number;
  rrRatio: number;
  double: boolean;
  chain: number;
  workingHours: { start: string; end: string };
  autoCloseTime?: string;
  riskFreeRules: { triggerR: number; moveStopToR: number }[];
}

export function BotPresets() {
  const [presets] = useState<Preset[]>([
    {
      id: "gold-fast-scalp",
      title: "طلا ۵ دقیقه فوق‌سریع",
      symbol: "XAUUSD",
      timeframe: "5m",
      defaultRiskUsd: 10,
      rrRatio: 2.0,
      double: false,
      chain: 1,
      workingHours: { start: "10:30", end: "20:30" },
      autoCloseTime: "23:45",
      riskFreeRules: [{ triggerR: 3.0, moveStopToR: 1.0 }],
    },
    {
      id: "eurusd-chain-double",
      title: "یورودلار زنجیره‌ای دوگانه",
      symbol: "EURUSD",
      timeframe: "5m",
      defaultRiskUsd: 15,
      rrRatio: 2.0,
      double: true,
      chain: 2,
      workingHours: { start: "09:00", end: "18:00" },
      autoCloseTime: "23:00",
      riskFreeRules: [{ triggerR: 2.0, moveStopToR: 0.0 }],
    },
  ]);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Bot className="w-5 h-5 text-primary" />
            الگوها و تمپلیت‌های استراتژی
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            تعریف الگوهای اختصاصی برای هر جفت‌ارز همراه با ساعات کاری، قوانین ریسک‌فری و خروج شبانه
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {presets.map((preset) => (
          <div key={preset.id} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">{preset.title}</h3>
                <span className="text-xs font-mono text-muted-foreground">
                  {preset.symbol} • {preset.timeframe} • ریسک پیش‌فرض: {preset.defaultRiskUsd}$
                </span>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded">
                R:R 1:{preset.rrRatio}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-3 rounded-lg font-mono">
              <div>
                <span className="text-muted-foreground block text-[10px]">حالت معامله:</span>
                <span className="text-foreground font-semibold">
                  {preset.double ? "دوگانه (Double)" : "تک‌پوزیشن"} • زنجیره {preset.chain}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">ساعات کاری:</span>
                <span className="text-foreground font-semibold">
                  {preset.workingHours.start} تا {preset.workingHours.end}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">قاعده ریسک‌فری:</span>
                <span className="text-foreground font-semibold">
                  در ریوارد {preset.riskFreeRules[0]?.triggerR}R ➔ استاپ روی {preset.riskFreeRules[0]?.moveStopToR}R
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">بستن اضطراری شبانه:</span>
                <span className="text-rose-500 font-semibold">{preset.autoCloseTime || "غیرفعال"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
