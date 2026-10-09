import { useState } from "react";
import { useTraderStore } from "@/app/store/traderStore";
import { Send, Key, CheckCircle2, ShieldCheck, MessageSquare } from "lucide-react";

export function TelegramSettings() {
  const { ws } = useTraderStore();
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          action: "CONFIG_TELEGRAM",
          token: token.trim(),
          chat_id: chatId.trim(),
        })
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
          <Send className="w-5 h-5 text-primary" />
          تنظیمات و راه‌اندازی ربات تلگرام
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          ارسال سیگنال‌ها، وضعیت معاملات و امکان اجرای دستور خرید/فروش از راه دور در تلگرام
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4 max-w-2xl">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          مشخصات ربات تلگرام (Telegram Bot API)
        </h2>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">توکن ربات (Bot Token)</label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
          />
          <span className="text-[10px] text-muted-foreground block mt-1">
            از BotFather@ در تلگرام دریافت می‌شود.
          </span>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">شناسه عددی اکانت شما (Chat ID)</label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="مثال: 987654321"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
          />
          <span className="text-[10px] text-muted-foreground block mt-1">
            برای امنیت، ربات تنها به دستوراتی که از این Chat ID ارسال شود پاسخ می‌دهد.
          </span>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {saved ? (
            <span className="text-xs text-emerald-500 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              تنظیمات در موتور ذخیره و تلگرام متصل شد!
            </span>
          ) : (
            <span />
          )}

          <button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            ذخیره و فعال‌سازی ربات تلگرام
          </button>
        </div>
      </div>

      {/* Guide Card */}
      <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-3 max-w-2xl text-xs text-muted-foreground">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          دستورات قابل ارسال از تلگرام:
        </h3>
        <ul className="space-y-1.5 font-mono text-[11px] list-disc list-inside">
          <li><code>/sell XAUUSD 10 5m</code> - شروع ربات سل طلا با ۱۰ دلار ریسک در تایم‌فریم ۵ دقیقه</li>
          <li><code>/buy EURUSD 20 15m</code> - شروع ربات بای یورو با ۲۰ دلار ریسک در تایم‌فریم ۱۵ دقیقه</li>
          <li><code>/status</code> - دریافت آخرین وضعیت بالانس و ربات‌های فعال</li>
          <li><code>/stop</code> یا <code>/closeall</code> - توقف فوری تمام ربات‌ها و لغو اردرها</li>
        </ul>
      </div>
    </div>
  );
}
