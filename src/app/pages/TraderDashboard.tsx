import { useState, useEffect, useRef } from "react";
import { useTraderStore, BotInstance } from "@/app/store/traderStore";
import { 
  Play, 
  Square, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Trash2, 
  Clock, 
  Layers,
  Activity,
  BookmarkPlus,
  FolderOpen,
  Archive,
  BarChart2,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react";

interface SavedPreset {
  id: string;
  code: string;
  name: string;
  symbol: string;
  timeframe: string;
  riskUsd: number;
  rrRatio: number;
  isDouble: boolean;
  maxOpenPositions: number;
  martingaleEnabled: boolean;
  martingaleStepPct: number;
}

export function TraderDashboard() {
  const {
    isEngineConnected,
    isMt5Connected,
    account,
    symbols,
    bots,
    archivedBots,
    openPositions,
    startBot,
    stopBot,
    deleteBot,
    closePosition,
    clearArchivedBot,
    fetchOpenPositions,
  } = useTraderStore();

  const [symbol, setSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("1m");
  const [riskUsd, setRiskUsd] = useState(20);
  const [rrRatio, setRrRatio] = useState(2.0);
  const [isDouble, setIsDouble] = useState(false);
  const [maxOpenPositions, setMaxOpenPositions] = useState(0); // 0 = unlimited
  const [martingaleEnabled, setMartingaleEnabled] = useState(false);
  const [martingaleStepPct, setMartingaleStepPct] = useState(10);
  const [stopAbovePrice, setStopAbovePrice] = useState<string>("");
  const [stopBelowPrice, setStopBelowPrice] = useState<string>("");

  // Presets state
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetCode, setPresetCode] = useState("");
  const [showPresetModal, setShowPresetModal] = useState(false);

  // Symbol Search & Dropdown State
  const [symbolSearchQuery, setSymbolSearchQuery] = useState("");
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);
  const symbolDropdownRef = useRef<HTMLDivElement>(null);

  // Bot report modal
  const [selectedBotForReport, setSelectedBotForReport] = useState<BotInstance | null>(null);
  const [showEventsLog, setShowEventsLog] = useState(false);

  // Close symbol dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (symbolDropdownRef.current && !symbolDropdownRef.current.contains(event.target as Node)) {
        setIsSymbolDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tesu_bot_presets");
      if (saved) {
        const parsed = JSON.parse(saved);
        setPresets(parsed);
        // Sync to Python engine for Telegram access
        syncPresetsToEngine(parsed);
      }
    } catch (e) {
      console.error("Failed to load presets", e);
    }
  }, []);

  const syncPresetsToEngine = (presetsList: SavedPreset[]) => {
    const ws = useTraderStore.getState().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "SYNC_PRESETS", presets: presetsList }));
    }
  };

  const saveCurrentPreset = () => {
    if (!presetName.trim()) return;
    const finalCode = (presetCode.trim() || `P${presets.length + 1}`).toUpperCase().replace(/\s+/g, "");
    const newPreset: SavedPreset = {
      id: Date.now().toString(),
      code: finalCode,
      name: presetName.trim(),
      symbol,
      timeframe,
      riskUsd: Number(riskUsd),
      rrRatio: Number(rrRatio),
      isDouble,
      maxOpenPositions: Number(maxOpenPositions),
      martingaleEnabled,
      martingaleStepPct: Number(martingaleStepPct),
      // Excludes stopAbovePrice and stopBelowPrice per specification
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem("tesu_bot_presets", JSON.stringify(updated));
    syncPresetsToEngine(updated);
    setPresetName("");
    setPresetCode("");
    setShowPresetModal(false);
  };

  const loadPreset = (p: SavedPreset) => {
    setSymbol(p.symbol);
    setTimeframe(p.timeframe);
    setRiskUsd(p.riskUsd);
    setRrRatio(p.rrRatio);
    setIsDouble(p.isDouble);
    setMaxOpenPositions(p.maxOpenPositions ?? 0);
    setMartingaleEnabled(p.martingaleEnabled ?? false);
    setMartingaleStepPct(p.martingaleStepPct ?? 10);
    // Note: Activity range (stopAbovePrice, stopBelowPrice) is left untouched
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    localStorage.setItem("tesu_bot_presets", JSON.stringify(updated));
    syncPresetsToEngine(updated);
  };

  const activeBotList = Object.values(bots);

  const handleLaunch = (side: "BUY" | "SELL") => {
    startBot({
      symbol,
      side,
      timeframe,
      risk_usd: Number(riskUsd),
      rr_ratio: Number(rrRatio),
      double: isDouble,
      max_open_positions: Number(maxOpenPositions),
      martingale_enabled: martingaleEnabled,
      martingale_step_pct: Number(martingaleStepPct),
      stop_above_price: stopAbovePrice ? Number(stopAbovePrice) : undefined,
      stop_below_price: stopBelowPrice ? Number(stopBelowPrice) : undefined,
    });
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Top Status & Account Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* MT5 Status Card */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">MT5 Connection</p>
            <p className="text-sm font-semibold flex items-center gap-2 mt-1">
              {isMt5Connected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-500">Connected ({account?.login || "Active"})</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-500">Disconnected</span>
                </>
              )}
            </p>
          </div>
          <Activity className={`w-6 h-6 ${isEngineConnected ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
        </div>

        {/* Balance Card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="text-xl font-bold mt-1 text-foreground">
            ${account ? account.balance.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
          </p>
          <span className="text-[10px] text-muted-foreground">{account?.currency || "USD"}</span>
        </div>

        {/* Equity Card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Equity</p>
          <p className="text-xl font-bold mt-1 text-primary">
            ${account ? account.equity.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
          </p>
          <span className={`text-[10px] font-medium ${(account?.profit || 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            PnL: {(account?.profit || 0) >= 0 ? "+" : ""}{account?.profit?.toFixed(2) || "0.00"}$
          </span>
        </div>

        {/* Free Margin Card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Free Margin</p>
          <p className="text-xl font-bold mt-1 text-foreground">
            ${account ? account.margin_free.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
          </p>
          <span className="text-[10px] text-muted-foreground">Level: {account?.margin_level?.toFixed(0) || "100"}%</span>
        </div>
      </div>

      {/* Quick Launch & Control Panel */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Quick Launch Pullback Bot
          </h2>

          {/* Presets Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {presets.length > 0 && (
              <div className="flex items-center gap-1.5 bg-muted/50 border border-border/80 px-2.5 py-1 rounded-lg">
                <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground font-medium">پریست‌ها:</span>
                <select
                  onChange={(e) => {
                    const found = presets.find((p) => p.id === e.target.value);
                    if (found) loadPreset(found);
                  }}
                  defaultValue=""
                  className="bg-transparent text-xs font-semibold text-primary focus:outline-none cursor-pointer max-w-[150px] truncate"
                >
                  <option value="" disabled>انتخاب قالب ذخیره شده...</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id} className="bg-card text-foreground">
                      [{p.code || "P"}] {p.name} ({p.symbol} - ${p.riskUsd}{p.isDouble ? " دبل" : ""})
                    </option>
                  ))}
                </select>
                {/* Delete preset button */}
                <button
                  type="button"
                  title="مدیریت و حذف پریست‌ها"
                  onClick={() => {
                    if (presets.length === 1) {
                      deletePreset(presets[0].id);
                    } else {
                      const name = prompt("نام پریست مورد نظر برای حذف را وارد کنید:");
                      if (name) {
                        const target = presets.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
                        if (target) deletePreset(target.id);
                      }
                    }
                  }}
                  className="text-muted-foreground hover:text-rose-500 transition-colors p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowPresetModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-xs font-medium text-foreground cursor-pointer transition-colors shadow-sm"
              title="ذخیره تنظیمات فعلی به عنوان پریست"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-primary" />
              ذخیره قالب فعلی
            </button>
          </div>
        </div>

        {/* Modal / Popover for Preset Name & Telegram Code */}
        {showPresetModal && (
          <div className="mb-4 p-4 bg-muted/40 border border-border rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <span className="text-xs font-medium text-foreground whitespace-nowrap">نام قالب:</span>
              <input
                type="text"
                placeholder="مثلا: طلا تهاجمی 30 دلاری"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCurrentPreset()}
                autoFocus
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2 min-w-[170px]">
              <span className="text-xs font-medium text-foreground whitespace-nowrap" title="کد یکتا برای اجرای دستور در ربات تلگرام">
                کد تلگرام:
              </span>
              <input
                type="text"
                placeholder={`P${presets.length + 1}`}
                value={presetCode}
                onChange={(e) => setPresetCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && saveCurrentPreset()}
                className="w-24 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary uppercase"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveCurrentPreset}
                disabled={!presetName.trim()}
                className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg disabled:opacity-40 cursor-pointer"
              >
                ثبت و ذخیره
              </button>
              <button
                onClick={() => {
                  setShowPresetModal(false);
                  setPresetName("");
                  setPresetCode("");
                }}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs rounded-lg cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
          {/* Symbol with Searchable Dropdown */}
          <div className="relative" ref={symbolDropdownRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground block">Symbol</label>
              {symbols && symbols.length > 0 && (
                <span className="text-[10px] text-primary font-mono font-medium">({symbols.length} نماد)</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSymbolDropdownOpen(!isSymbolDropdownOpen)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground flex items-center justify-between focus:outline-none focus:border-primary text-right"
            >
              <span className="truncate">{symbol}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 mr-1" />
            </button>

            {isSymbolDropdownOpen && (
              <div className="absolute z-50 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in flex flex-col max-h-72">
                <div className="p-2 border-b border-border bg-muted/40">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="جستجوی نماد (مثلا XAU, EUR)..."
                      value={symbolSearchQuery}
                      onChange={(e) => setSymbolSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full bg-background border border-border rounded-lg pr-8 pl-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto p-1 space-y-0.5 divide-y divide-border/30">
                  {symbols && symbols.length > 0 ? (
                    symbols
                      .filter((s) => {
                        const q = symbolSearchQuery.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          s.name.toLowerCase().includes(q) ||
                          (s.description && s.description.toLowerCase().includes(q))
                        );
                      })
                      .map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => {
                            setSymbol(s.name);
                            setIsSymbolDropdownOpen(false);
                            setSymbolSearchQuery("");
                          }}
                          className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-muted transition-colors ${
                            symbol === s.name ? "bg-primary/10 text-primary font-bold" : "text-foreground"
                          }`}
                        >
                          <span className="font-mono">{s.name}</span>
                          {s.description && s.description !== s.name && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                              {s.description}
                            </span>
                          )}
                        </button>
                      ))
                  ) : (
                    ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "NZDUSD", "BTCUSD"]
                      .filter((s) => !symbolSearchQuery || s.toLowerCase().includes(symbolSearchQuery.toLowerCase()))
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSymbol(s);
                            setIsSymbolDropdownOpen(false);
                            setSymbolSearchQuery("");
                          }}
                          className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-mono hover:bg-muted"
                        >
                          {s}
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Timeframe */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
            >
              <option value="1m">M1 (1 Minute)</option>
              <option value="5m">M5 (5 Minutes)</option>
              <option value="15m">M15 (15 Minutes)</option>
              <option value="30m">M30 (30 Minutes)</option>
              <option value="1h">H1 (1 Hour)</option>
              <option value="4h">H4 (4 Hours)</option>
            </select>
          </div>

          {/* R:R Ratio */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">R:R Ratio</label>
            <input
              type="number"
              min="1"
              step="0.5"
              value={rrRatio}
              onChange={(e) => setRrRatio(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Risk USD */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Base Risk ($)</label>
            <div className="relative">
              <DollarSign className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <input
                type="number"
                min="1"
                step="1"
                value={riskUsd}
                onChange={(e) => setRiskUsd(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Max Open Positions */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1" title="حداکثر ترید باز همزمان (0 = بدون محدودیت)">
              Max Open Pos
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={maxOpenPositions}
              onChange={(e) => setMaxOpenPositions(Number(e.target.value))}
              placeholder="0 (Unlimited)"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Action Buttons: SELL / BUY */}
          <div className="flex gap-2">
            <button
              onClick={() => handleLaunch("SELL")}
              disabled={!isMt5Connected}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs shadow-md"
            >
              <TrendingDown className="w-4 h-4" />
              SELL
            </button>
            <button
              onClick={() => handleLaunch("BUY")}
              disabled={!isMt5Connected}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs shadow-md"
            >
              <TrendingUp className="w-4 h-4" />
              BUY
            </button>
          </div>
        </div>

        {/* Second Row: Advanced Strategy Options */}
        <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center gap-6 text-xs">
          {/* Double Target */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="double"
              checked={isDouble}
              onChange={(e) => setIsDouble(e.target.checked)}
              className="rounded border-border text-primary focus:ring-0 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="double" className="text-xs text-foreground cursor-pointer font-medium select-none">
              تارگت دبل (1:1 + Main Target)
            </label>
          </div>

          {/* Incremental / Martingale Option */}
          <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/40">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="martingale"
                checked={martingaleEnabled}
                onChange={(e) => setMartingaleEnabled(e.target.checked)}
                className="rounded border-border text-primary focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="martingale" className="text-xs text-foreground cursor-pointer font-medium select-none">
                پوزیشن‌های افزایشی در ضرر
              </label>
            </div>
            {martingaleEnabled && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">درصد افزایش هر ضرر:</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={martingaleStepPct}
                  onChange={(e) => setMartingaleStepPct(Number(e.target.value))}
                  className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-mono font-bold"
                />
                <span className="text-muted-foreground text-xs">%</span>
              </div>
            )}
          </div>

          {/* Price Range Limits (Stop Above / Stop Below) */}
          <div className="flex items-center gap-4 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/40">
            <span className="text-xs font-semibold text-foreground">محدوده قیمت فعالیت (توقف خودکار بات):</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px]">توقف اگر بالاتر از:</span>
              <input
                type="number"
                step="any"
                placeholder="بدون سقف"
                value={stopAbovePrice}
                onChange={(e) => setStopAbovePrice(e.target.value)}
                className="w-24 bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px]">توقف اگر کمتر از:</span>
              <input
                type="number"
                step="any"
                placeholder="بدون کف"
                value={stopBelowPrice}
                onChange={(e) => setStopBelowPrice(e.target.value)}
                className="w-24 bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
              />
            </div>
          </div>

          <span className="text-[11px] text-muted-foreground/80 font-mono">
            * کمیسیون و اسپرد بر اساس حساب زنده MT5 خودکار محاسبه و کسر می‌شود.
          </span>
        </div>
      </div>

      {/* Active Bots List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Active Strategy Bots ({activeBotList.length})
          </h2>
        </div>

        {activeBotList.length === 0 ? (
          <div className="bg-card/40 border border-border border-dashed rounded-xl p-12 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No active trading bots running</p>
            <p className="text-xs opacity-75 mt-1">Select symbol, side and start a pullback execution above</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeBotList.map((bot) => (
              <div
                key={bot.bot_id}
                className={`bg-card border rounded-xl p-5 shadow-sm space-y-3 transition-all ${
                  bot.state === "CANCELLED" ? "border-border/40 opacity-60" : "border-border"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        bot.side === "SELL" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                      }`}
                    >
                      {bot.side}
                    </span>
                    <span className="font-bold text-sm text-foreground">{bot.symbol}</span>
                    <span className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {bot.timeframe}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      bot.state === "WAITING_PULLBACK"
                        ? "bg-amber-500/10 text-amber-500 animate-pulse"
                        : bot.state === "PENDING_ACTIVE"
                        ? "bg-blue-500/10 text-blue-500 font-bold"
                        : bot.state === "POSITION_ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-500 font-bold"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {bot.state}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Reference Point A</span>
                    <span className="font-semibold text-foreground">{bot.A?.toFixed(5) || "--"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">ATR (14)</span>
                    <span className="font-semibold text-foreground">{bot.atr14?.toFixed(5) || "--"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Pending Entry</span>
                    <span className="font-semibold text-primary">{bot.pending_entry?.toFixed(5) || "--"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Stop Loss</span>
                    <span className="font-semibold text-rose-500">{bot.pending_sl?.toFixed(5) || "--"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Current Risk ($)</span>
                    <span className="font-semibold text-amber-500">
                      ${bot.risk_usd?.toFixed(2) || "20.00"}
                      {bot.consecutive_losses ? ` (${bot.consecutive_losses}L)` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Open Positions</span>
                    <span className="font-semibold text-foreground">
                      {bot.open_positions_count || 0}
                      {bot.max_open_positions ? ` / ${bot.max_open_positions}` : " (Unltd)"}
                    </span>
                  </div>
                  {(bot.stop_above_price || bot.stop_below_price) && (
                    <div className="col-span-2 text-[10px] text-muted-foreground bg-background/50 px-2 py-1 rounded border border-border/40">
                      <span>محدوده فعالیت: </span>
                      {bot.stop_below_price && <span>کف: {bot.stop_below_price} </span>}
                      {bot.stop_above_price && <span>سقف: {bot.stop_above_price}</span>}
                    </div>
                  )}
                  {bot.stop_reason && (
                    <div className="col-span-2 text-[10px] text-rose-500 font-sans bg-rose-500/10 px-2 py-1 rounded">
                      علت توقف: {bot.stop_reason}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setSelectedBotForReport(bot)}
                    className="px-2.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors font-medium cursor-pointer"
                    title="مشاهده گزارش عملکرد و سوابق این ربات"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    گزارش
                  </button>
                  <button
                    onClick={() => stopBot(bot.bot_id)}
                    disabled={bot.state === "CANCELLED"}
                    className="flex-1 bg-muted hover:bg-muted/80 text-foreground text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors font-medium disabled:opacity-40 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Cancel Bot
                  </button>
                  <button
                    onClick={() => deleteBot(bot.bot_id)}
                    className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors font-medium cursor-pointer"
                    title="توقف، بستن معاملات و انتقال به آرشیو"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete & Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. LIVE OPEN POSITIONS (پوزیشن‌های باز جاری) */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-bold text-foreground">
              پوزیشن‌های باز بازار ({openPositions?.length || 0})
            </h2>
            <span className="text-xs text-muted-foreground mr-2">
              (Live Positions in MT5)
            </span>
          </div>

          <button
            onClick={() => fetchOpenPositions()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs text-foreground font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            بروزرسانی زنده
          </button>
        </div>

        {(!openPositions || openPositions.length === 0) ? (
          <div className="bg-card/40 border border-border border-dashed rounded-xl p-8 text-center text-muted-foreground">
            <CheckCircle2 className="w-7 h-7 mx-auto mb-2 opacity-40 text-emerald-500" />
            <p className="text-sm font-medium">هیچ پوزیشن بازی در حال حاضر وجود ندارد</p>
            <p className="text-xs opacity-75 mt-1">تمام معاملات بسته شده‌اند یا ربات هنوز پوزیشنی فعال نکرده است.</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/60 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3">تیکت</th>
                    <th className="py-2.5 px-3">زمان ورود</th>
                    <th className="py-2.5 px-3">نماد</th>
                    <th className="py-2.5 px-3">نوع</th>
                    <th className="py-2.5 px-3">حجم (Lot)</th>
                    <th className="py-2.5 px-3">قیمت ورود</th>
                    <th className="py-2.5 px-3">قیمت فعلی</th>
                    <th className="py-2.5 px-3">حد ضرر (SL)</th>
                    <th className="py-2.5 px-3">حد سود (TP)</th>
                    <th className="py-2.5 px-3">سود شناور (PnL)</th>
                    <th className="py-2.5 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {openPositions.map((pos) => {
                    const isProfit = pos.profit >= 0;
                    return (
                      <tr key={pos.ticket} className="hover:bg-muted/30 transition-colors font-mono">
                        <td className="py-2.5 px-3 font-semibold text-foreground">#{pos.ticket}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-[11px] font-sans">{pos.time}</td>
                        <td className="py-2.5 px-3 font-bold text-foreground">{pos.symbol}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            pos.type === "BUY" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                          }`}>
                            {pos.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{pos.volume}</td>
                        <td className="py-2.5 px-3">{pos.price_open.toFixed(pos.symbol.includes("JPY") || pos.symbol.includes("XAU") ? 2 : 5)}</td>
                        <td className="py-2.5 px-3">{pos.price_current.toFixed(pos.symbol.includes("JPY") || pos.symbol.includes("XAU") ? 2 : 5)}</td>
                        <td className="py-2.5 px-3 text-rose-500 font-semibold">{pos.sl ? pos.sl.toFixed(pos.symbol.includes("JPY") || pos.symbol.includes("XAU") ? 2 : 5) : "--"}</td>
                        <td className="py-2.5 px-3 text-emerald-500 font-semibold">{pos.tp ? pos.tp.toFixed(pos.symbol.includes("JPY") || pos.symbol.includes("XAU") ? 2 : 5) : "--"}</td>
                        <td className={`py-2.5 px-3 font-bold text-sm ${isProfit ? "text-emerald-500" : "text-rose-500"}`}>
                          {isProfit ? "+" : ""}${pos.profit.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => {
                              if (confirm(`آیا از بستن پوزیشن #${pos.ticket} مطمئن هستید؟`)) {
                                closePosition(pos.ticket);
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[11px] font-sans font-medium transition-colors cursor-pointer"
                          >
                            بستن پوزیشن
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. ARCHIVED BOTS (آرشیو ربات‌های خاتمه‌یافته) */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4 pt-4 border-t border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-foreground">
              آرشیو و تاریخچه بات‌ها ({Object.keys(archivedBots || {}).length})
            </h2>
            <span className="text-xs text-muted-foreground mr-2">
              (ربات‌هایی که متوقف یا حذف شده‌اند همراه با سوابق ترید و تنظیمات)
            </span>
          </div>
        </div>

        {Object.keys(archivedBots || {}).length === 0 ? (
          <div className="bg-card/20 border border-border border-dashed rounded-xl p-6 text-center text-muted-foreground">
            <p className="text-xs">هنوز باتی در آرشیو ثبت نشده است. هر بات پس از لغو یا اتمام کار به این بخش اضافه می‌شود.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(archivedBots).map((bot) => (
              <div
                key={bot.bot_id}
                className="bg-card/70 border border-border/80 rounded-xl p-4 shadow-sm space-y-3 opacity-90 hover:opacity-100 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      bot.side === "SELL" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {bot.side}
                    </span>
                    <span className="font-bold text-sm text-foreground">{bot.symbol}</span>
                    <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {bot.timeframe}
                    </span>
                  </div>
                  <span className="text-[10px] bg-muted text-muted-foreground font-mono px-2 py-0.5 rounded">
                    {bot.state}
                  </span>
                </div>

                {/* Performance summary card */}
                <div className="grid grid-cols-3 gap-1.5 text-center bg-muted/40 p-2 rounded-lg font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-sans">تعداد معامله</span>
                    <span className="font-bold text-foreground">{bot.performance?.trades_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-sans">وین‌ریت</span>
                    <span className="font-bold text-foreground">{bot.performance?.win_rate || 0}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-sans">سود کل</span>
                    <span className={`font-bold ${(bot.performance?.total_pnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {(bot.performance?.total_pnl || 0) >= 0 ? "+" : ""}${bot.performance?.total_pnl?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    onClick={() => setSelectedBotForReport(bot)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    مشاهده کارنامه و تنظیمات
                  </button>
                  <button
                    onClick={() => clearArchivedBot(bot.bot_id)}
                    className="p-1.5 text-muted-foreground hover:text-rose-500 rounded transition-colors cursor-pointer"
                    title="حذف کامل از آرشیو"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. MODAL: BOT PERFORMANCE & AUDIT REPORT                      */}
      {/* ------------------------------------------------------------- */}
      {selectedBotForReport && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <BarChart2 className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    گزارش عملکرد و رویدادهای ربات {selectedBotForReport.bot_id}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    نماد: {selectedBotForReport.symbol} | جهت: {selectedBotForReport.side} | تایم‌فریم: {selectedBotForReport.timeframe}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBotForReport(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Performance Stats */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">عملکرد معاملاتی ربات</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-muted/40 p-3 rounded-xl text-center">
                    <span className="text-[11px] text-muted-foreground block">کل تریدها</span>
                    <span className="text-lg font-bold font-mono text-foreground">
                      {selectedBotForReport.performance?.trades_count || 0}
                    </span>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-xl text-center">
                    <span className="text-[11px] text-muted-foreground block">برد / باخت</span>
                    <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                      <span className="text-emerald-500">{selectedBotForReport.performance?.wins || 0}W</span> - <span className="text-rose-500">{selectedBotForReport.performance?.losses || 0}L</span>
                    </span>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-xl text-center">
                    <span className="text-[11px] text-muted-foreground block">وین ریت</span>
                    <span className="text-lg font-bold font-mono text-foreground">
                      {selectedBotForReport.performance?.win_rate || 0}%
                    </span>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-xl text-center">
                    <span className="text-[11px] text-muted-foreground block">سود/زیان خالص</span>
                    <span className={`text-lg font-bold font-mono ${
                      (selectedBotForReport.performance?.total_pnl || 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                    }`}>
                      {(selectedBotForReport.performance?.total_pnl || 0) >= 0 ? "+" : ""}${selectedBotForReport.performance?.total_pnl?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bot Performance Curve (SVG Line Chart) */}
              <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-primary" />
                    نمودار روند عملکرد از زمان استارت ربات (رشد سود و زیان)
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    مجموع: {(selectedBotForReport.performance?.total_pnl || 0) >= 0 ? "+" : ""}${selectedBotForReport.performance?.total_pnl?.toFixed(2) || "0.00"}
                  </span>
                </div>

                {(() => {
                  const curve = selectedBotForReport.performance?.equity_curve && selectedBotForReport.performance.equity_curve.length > 1
                    ? selectedBotForReport.performance.equity_curve
                    : [0, selectedBotForReport.performance?.total_pnl || 0];

                  const minVal = Math.min(0, ...curve);
                  const maxVal = Math.max(0, ...curve);
                  const range = maxVal - minVal === 0 ? 10 : maxVal - minVal;
                  const width = 560;
                  const height = 120;
                  const padding = 20;

                  // Map points to SVG coordinates
                  const points = curve.map((val, i) => {
                    const x = padding + (i / (curve.length - 1 || 1)) * (width - 2 * padding);
                    const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
                    return { x, y, val };
                  });

                  const zeroY = height - padding - ((0 - minVal) / range) * (height - 2 * padding);
                  const pathD = points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, "");
                  const isPositive = (selectedBotForReport.performance?.total_pnl || 0) >= 0;

                  return (
                    <div className="w-full overflow-hidden bg-background/60 rounded-lg p-2 border border-border/40">
                      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
                        {/* Zero axis line */}
                        <line
                          x1={padding}
                          y1={zeroY}
                          x2={width - padding}
                          y2={zeroY}
                          stroke="currentColor"
                          strokeDasharray="4 4"
                          className="text-border"
                          strokeWidth="1.5"
                        />
                        <text x={padding + 4} y={zeroY - 4} className="text-[9px] fill-muted-foreground font-mono">
                          $0.00 (Start)
                        </text>

                        {/* Curve Path */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isPositive ? "#10b981" : "#f43f5e"}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Data Points */}
                        {points.map((p, idx) => (
                          <g key={idx}>
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={idx === points.length - 1 ? "4" : "3"}
                              fill={isPositive ? "#10b981" : "#f43f5e"}
                              className="transition-all"
                            />
                            {/* Final value badge */}
                            {idx === points.length - 1 && (
                              <text
                                x={p.x}
                                y={p.y - 8}
                                textAnchor="middle"
                                className={`text-[10px] font-bold font-mono ${p.val >= 0 ? "fill-emerald-500" : "fill-rose-500"}`}
                              >
                                {p.val >= 0 ? "+" : ""}${p.val.toFixed(1)}
                              </text>
                            )}
                          </g>
                        ))}
                      </svg>
                    </div>
                  );
                })()}

                {/* Closed Deals Breakdown Table */}
                {selectedBotForReport.performance?.deals && selectedBotForReport.performance.deals.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      معاملات ثبت‌شده اختصاصی این بات ({selectedBotForReport.performance.deals.length} ترید):
                    </span>
                    <div className="border border-border/60 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                      <table className="w-full text-[11px] text-right font-mono">
                        <thead className="bg-muted text-muted-foreground">
                          <tr>
                            <th className="py-1 px-2.5">تیکت</th>
                            <th className="py-1 px-2.5">ساعت</th>
                            <th className="py-1 px-2.5">حجم</th>
                            <th className="py-1 px-2.5">سود ناخالص</th>
                            <th className="py-1 px-2.5">کمیسیون</th>
                            <th className="py-1 px-2.5">سود/زیان خالص</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {selectedBotForReport.performance.deals.map((deal) => (
                            <tr key={deal.ticket} className="hover:bg-muted/20">
                              <td className="py-1 px-2.5 font-bold">#{deal.ticket}</td>
                              <td className="py-1 px-2.5 text-muted-foreground font-sans">{deal.time}</td>
                              <td className="py-1 px-2.5">{deal.volume}</td>
                              <td className={`py-1 px-2.5 ${deal.profit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                ${deal.profit.toFixed(2)}
                              </td>
                              <td className="py-1 px-2.5 text-muted-foreground">${deal.commission.toFixed(2)}</td>
                              <td className={`py-1 px-2.5 font-bold ${deal.net_pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {deal.net_pnl >= 0 ? "+" : ""}${deal.net_pnl.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Strategy Parameters */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">تنظیمات و پارامترها</h4>
                <div className="grid grid-cols-3 gap-2 text-xs bg-muted/20 border border-border/50 p-3 rounded-xl font-mono">
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-sans">ریسک اولیه:</span>
                    <span className="font-semibold text-foreground">${selectedBotForReport.base_risk_usd || selectedBotForReport.risk_usd}$</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-sans">نسبت ریسک به ریوارد (R:R):</span>
                    <span className="font-semibold text-foreground">1:{selectedBotForReport.rr_ratio || 2.0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-sans">ورود دو پوزیشنه (دبل):</span>
                    <span className="font-semibold text-foreground">{selectedBotForReport.is_double ? "بله (1:1 + R:R)" : "خیر"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-sans">حداکثر پوزیشن همزمان:</span>
                    <span className="font-semibold text-foreground">{selectedBotForReport.max_open_positions || "نامحدود"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-sans">مارتینگل (افزایشی در ضرر):</span>
                    <span className="font-semibold text-foreground">
                      {selectedBotForReport.martingale_enabled ? `بله (${selectedBotForReport.martingale_step_pct}%)` : "غیرفعال"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-sans">نقطه مبنای A:</span>
                    <span className="font-semibold text-foreground">{selectedBotForReport.A?.toFixed(5) || "--"}</span>
                  </div>
                </div>
              </div>

              {/* Collapsible Bot Audit Events Log */}
              <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
                <button
                  type="button"
                  onClick={() => setShowEventsLog(!showEventsLog)}
                  className="w-full px-4 py-3 bg-muted/40 hover:bg-muted/70 flex items-center justify-between text-xs font-bold text-foreground transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    لاگ و وقایع رفتار استراتژی ({selectedBotForReport.events?.length || 0} رویداد ثبت‌شده)
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-normal">
                    <span>{showEventsLog ? "بستن لاگ" : "مشاهده لاگ"}</span>
                    {showEventsLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {showEventsLog && (
                  <div className="p-3 max-h-56 overflow-y-auto space-y-1.5 font-mono text-[11px] bg-background">
                    {(!selectedBotForReport.events || selectedBotForReport.events.length === 0) ? (
                      <div className="text-muted-foreground text-center py-4 text-xs font-sans">
                        هیچ رویدادی ثبت نشده است.
                      </div>
                    ) : (
                      selectedBotForReport.events.map((ev, idx) => (
                        <div key={idx} className="flex items-start gap-2 border-b border-border/30 pb-1 last:border-b-0">
                          <span className="text-muted-foreground text-[10px] whitespace-nowrap">{ev.time}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-primary/10 text-primary font-bold">
                            {ev.type}
                          </span>
                          <span className="text-foreground/90 truncate flex-1 text-[10px]" title={JSON.stringify(ev)}>
                            {Object.entries(ev)
                              .filter(([k]) => !["time", "bot_id", "type"].includes(k))
                              .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(4) : v}`)
                              .join(" | ")}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-border bg-muted/20 flex justify-end">
              <button
                onClick={() => setSelectedBotForReport(null)}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
