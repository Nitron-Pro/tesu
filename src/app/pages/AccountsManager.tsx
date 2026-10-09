import { useState } from "react";
import { useTraderStore } from "@/app/store/traderStore";
import { 
  Wallet, 
  FolderOpen, 
  Key, 
  Server, 
  ShieldAlert, 
  RefreshCw,
  Power
} from "lucide-react";

export function AccountsManager() {
  const { isMt5Connected, account, connectMt5 } = useTraderStore();

  const [path, setPath] = useState("C:\\Program Files\\MetaTrader 5\\terminal64.exe");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [dailyLossLimit, setDailyLossLimit] = useState(50);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    connectMt5({
      path: path.trim() || undefined,
      login: login ? Number(login) : undefined,
      password: password || undefined,
      server: server.trim() || undefined,
    });
    setTimeout(() => setIsConnecting(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
          <Wallet className="w-5 h-5 text-primary" />
          مدیریت متاتریدرها و حساب‌های معاملاتی
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          تنظیم و اتصال چندگانه به پایانه‌های فعال MT5 روی ویندوز با تفکیک لاگین و بروکر
        </p>
      </div>

      {/* Active Account Details */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isMt5Connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <h2 className="text-sm font-bold text-foreground">حساب فعال جاری</h2>
          </div>
          <span className="text-xs font-mono bg-muted px-2.5 py-1 rounded text-muted-foreground">
            {isMt5Connected ? `متصل: #${account?.login}` : "ترمینال متصل نیست"}
          </span>
        </div>

        {isMt5Connected && account ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 font-mono text-sm">
            <div className="bg-muted/40 p-3 rounded-lg">
              <span className="text-xs text-muted-foreground block font-sans">بروکر و سرور</span>
              <span className="font-semibold text-foreground">{account.server}</span>
              <span className="text-[10px] text-muted-foreground block">{account.company}</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-lg">
              <span className="text-xs text-muted-foreground block font-sans">موجودی (Balance)</span>
              <span className="font-bold text-foreground text-base">${account.balance.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground block">{account.currency}</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-lg">
              <span className="text-xs text-muted-foreground block font-sans">اکوئیتی (Equity)</span>
              <span className="font-bold text-primary text-base">${account.equity.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground block">شناور: {account.profit.toFixed(2)}$</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-lg">
              <span className="text-xs text-muted-foreground block font-sans">مارجین آزاد</span>
              <span className="font-semibold text-foreground">${account.margin_free.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground block">سطح: {account.margin_level?.toFixed(0)}%</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-xs">
            برای دریافت زنده بالانس، ابتدا مسیر متاتریدر یا مشخصات حساب را در فرم زیر وارد و دکمه اتصال را بزنید.
          </div>
        )}
      </div>

      {/* Add / Switch Terminal Form */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          اتصال به پایانه متاتریدر جدید
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Path */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              مسیر فایل اجرایی متاتریدر (terminal64.exe)
            </label>
            <div className="relative">
              <FolderOpen className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="C:\Program Files\MetaTrader 5\terminal64.exe"
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <span className="text-[10px] text-muted-foreground block mt-1">
              اگر این فیلد خالی بماند، به متاتریدر فعالِ در حال اجرای ویندوز متصل می‌شود.
            </span>
          </div>

          {/* Login */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">شماره حساب (Login Number)</label>
            <input
              type="number"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="اختیاری (اگر روی MT5 فعال است)"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">رمز عبور (Password)</label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور حساب"
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Server */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">نام سرور بروکر (Server)</label>
            <input
              type="text"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="مثال: MetaQuotes-Demo یا ICMarkets-Live"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Daily Drawdown Killswitch */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              سقف حد ضرر روزانه (Max Daily Loss $)
            </label>
            <div className="relative">
              <ShieldAlert className="w-4 h-4 absolute left-3 top-2.5 text-rose-500" />
              <input
                type="number"
                min="0"
                value={dailyLossLimit}
                onChange={(e) => setDailyLossLimit(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs font-mono font-bold text-rose-500 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {isConnecting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            راه‌اندازی و اتصال پایانه
          </button>
        </div>
      </div>
    </div>
  );
}
