import { useState, useMemo, useEffect } from "react";
import { useTraderStore } from "@/app/store/traderStore";
import { 
  Calendar, 
  RefreshCw, 
  BarChart3, 
  TrendingUp, 
  Layers, 
  X, 
  PieChart, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2
} from "lucide-react";

export function ReportsPage() {
  const { reportData, isReportLoading, isMt5Connected, fetchReport } = useTraderStore();
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<"overview" | "symbols" | "history">("overview");
  const [selectedSymbolModal, setSelectedSymbolModal] = useState<string | null>(null);

  useEffect(() => {
    if (isMt5Connected) {
      fetchReport(days);
    }
  }, [isMt5Connected, days, fetchReport]);

  const stats = reportData;

  // Calculate Cumulative Equity Curve / Profit progression
  const equityPoints = useMemo(() => {
    if (!stats?.deals || stats.deals.length === 0) return [];
    // Sort chronological (oldest to newest)
    const sorted = [...stats.deals].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    let running = 0;
    return sorted.map((d) => {
      running += d.net_pnl;
      return {
        ticket: d.ticket,
        time: d.time.slice(5, 16), // MM-DD HH:mm
        pnl: d.net_pnl,
        equity: Math.round(running * 100) / 100,
        symbol: d.symbol
      };
    });
  }, [stats?.deals]);

  // Hourly / Day-of-week win rate analytics
  const timeAnalytics = useMemo(() => {
    if (!stats?.deals || stats.deals.length === 0) return { buyWins: 0, buyTotal: 0, sellWins: 0, sellTotal: 0 };
    let buyWins = 0, buyTotal = 0, sellWins = 0, sellTotal = 0;
    stats.deals.forEach(d => {
      if (d.type === "BUY") {
        buyTotal++;
        if (d.net_pnl >= 0) buyWins++;
      } else {
        sellTotal++;
        if (d.net_pnl >= 0) sellWins++;
      }
    });
    return { buyWins, buyTotal, sellWins, sellTotal };
  }, [stats?.deals]);

  // Deals specific to selected symbol for Modal
  const symbolModalDeals = useMemo(() => {
    if (!selectedSymbolModal || !stats?.deals) return [];
    return stats.deals.filter(d => d.symbol === selectedSymbolModal);
  }, [selectedSymbolModal, stats?.deals]);

  // Best & Worst Trade
  const { bestTrade, worstTrade } = useMemo(() => {
    if (!stats?.deals || stats.deals.length === 0) return { bestTrade: 0, worstTrade: 0 };
    const profits = stats.deals.map(d => d.net_pnl);
    return {
      bestTrade: Math.max(...profits),
      worstTrade: Math.min(...profits)
    };
  }, [stats?.deals]);

  // SVG dimensions for equity curve
  const chartHeight = 160;
  const chartWidth = 700;
  const svgPath = useMemo(() => {
    if (equityPoints.length < 2) return "";
    const values = equityPoints.map(p => p.equity);
    const minVal = Math.min(0, ...values);
    const maxVal = Math.max(1, ...values);
    const range = (maxVal - minVal) || 1;

    const points = equityPoints.map((p, idx) => {
      const x = (idx / (equityPoints.length - 1)) * (chartWidth - 20) + 10;
      const y = chartHeight - ((p.equity - minVal) / range) * (chartHeight - 30) - 15;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${points.join(" L ")}`;
  }, [equityPoints]);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <BarChart3 className="w-5 h-5 text-primary" />
            داشبورد تحلیلی و ژورنال معاملات MT5
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            آمار تحلیلی لحظه‌ای، منحنی سود، تفکیک نمادها و بررسی عملکرد زنده
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Days Filter */}
          <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground ms-1" />
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  days === d
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d === 7 ? "۷ روز" : d === 14 ? "۱۴ روز" : d === 30 ? "۳۰ روز" : "۳ ماه"}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchReport(days)}
            disabled={isReportLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all shadow-sm ${
              isReportLoading
                ? "bg-primary/20 text-primary border-primary/40 cursor-wait"
                : "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent active:scale-95"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReportLoading ? "animate-spin" : ""}`} />
            {isReportLoading ? "در حال دریافت..." : "بروزرسانی"}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "overview"
              ? "bg-primary/15 text-primary border border-primary/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          دید کلی و نمودارها
        </button>

        <button
          onClick={() => setActiveTab("symbols")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "symbols"
              ? "bg-primary/15 text-primary border border-primary/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          تفکیک نمادها ({stats?.symbols ? Object.keys(stats.symbols).length : 0})
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "history"
              ? "bg-primary/15 text-primary border border-primary/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          ژورنال دیل‌ها ({stats?.deals?.length || 0})
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Net Profit */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
          <p className="text-[11px] text-muted-foreground font-medium">سود / زیان خالص</p>
          <p className={`text-lg font-bold mt-1.5 flex items-center gap-1 ${
            (stats?.net_profit || 0) >= 0 ? "text-emerald-500" : "text-rose-500"
          }`}>
            {(stats?.net_profit || 0) >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {(stats?.net_profit || 0) >= 0 ? "+" : ""}${stats ? stats.net_profit.toFixed(2) : "0.00"}
          </p>
          <span className="text-[10px] text-muted-foreground">بعد از کسر کامل کمیسیون</span>
        </div>

        {/* Win Rate */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[11px] text-muted-foreground font-medium">نرخ برد (Win Rate)</p>
          <p className="text-lg font-bold mt-1.5 text-primary font-mono">
            {stats ? stats.win_rate : "0.0"}%
          </p>
          <div className="flex items-center gap-2 mt-1 text-[10px]">
            <span className="text-emerald-500 font-medium">✓ {stats?.wins || 0} برد</span>
            <span className="text-rose-500 font-medium">✗ {stats?.losses || 0} باخت</span>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[11px] text-muted-foreground font-medium">فاکتور سود (PF)</p>
          <p className="text-lg font-bold mt-1.5 text-foreground font-mono">
            {stats ? stats.profit_factor : "0.00"}
          </p>
          <span className="text-[10px] text-muted-foreground">سود ناخالص / ضرر</span>
        </div>

        {/* Total Trades */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[11px] text-muted-foreground font-medium">تعداد معاملات</p>
          <p className="text-lg font-bold mt-1.5 text-foreground font-mono">
            {stats ? stats.total_trades : "0"}
          </p>
          <span className="text-[10px] text-muted-foreground">دیل‌های بسته شده</span>
        </div>

        {/* Best / Worst Trade */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[11px] text-muted-foreground font-medium">بهترین / بدترین ترید</p>
          <p className="text-xs font-bold mt-1.5 text-emerald-500 font-mono">
            بهترین: +${bestTrade.toFixed(2)}
          </p>
          <p className="text-xs font-bold text-rose-500 font-mono">
            بدترین: ${worstTrade.toFixed(2)}
          </p>
        </div>

        {/* Total Commission */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[11px] text-muted-foreground font-medium">کمیسیون پرداختی</p>
          <p className="text-lg font-bold mt-1.5 text-amber-500 font-mono">
            ${stats ? Math.abs(stats.total_commission).toFixed(2) : "0.00"}
          </p>
          <span className="text-[10px] text-muted-foreground">پرداختی کارگزاری</span>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & CHARTS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Visual Equity Curve Chart */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  منحنی رشد سود خالص (Cumulative PnL Curve)
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  روند تغییرات تجمعی بالانس حاصل از معاملات انجام شده در بازه انتخابی
                </p>
              </div>
              <div className="text-xs font-bold font-mono px-3 py-1 rounded-lg bg-muted text-foreground">
                خالص فعلی: {(stats?.net_profit || 0) >= 0 ? "+" : ""}${stats ? stats.net_profit.toFixed(2) : "0.00"}
              </div>
            </div>

            {equityPoints.length >= 2 ? (
              <div className="w-full overflow-hidden bg-muted/20 border border-border/50 rounded-xl p-4">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44 overflow-visible">
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={(stats?.net_profit || 0) >= 0 ? "#10b981" : "#f43f5e"} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={(stats?.net_profit || 0) >= 0 ? "#10b981" : "#f43f5e"} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal zero line */}
                  <line 
                    x1="0" 
                    y1={chartHeight / 2} 
                    x2={chartWidth} 
                    y2={chartHeight / 2} 
                    stroke="currentColor" 
                    strokeOpacity="0.15" 
                    strokeDasharray="4 4" 
                  />

                  {/* Curve Path */}
                  <path
                    d={svgPath}
                    fill="none"
                    stroke={(stats?.net_profit || 0) >= 0 ? "#10b981" : "#f43f5e"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* End Dot */}
                  {equityPoints.length > 0 && (
                    <circle
                      cx={chartWidth - 10}
                      cy={
                        chartHeight - 
                        ((equityPoints[equityPoints.length - 1].equity - Math.min(0, ...equityPoints.map(p => p.equity))) /
                        ((Math.max(1, ...equityPoints.map(p => p.equity)) - Math.min(0, ...equityPoints.map(p => p.equity))) || 1)) * 
                        (chartHeight - 30) - 15
                      }
                      r="4"
                      className={(stats?.net_profit || 0) >= 0 ? "fill-emerald-500" : "fill-rose-500"}
                    />
                  )}
                </svg>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 font-mono px-1">
                  <span>شروع ({equityPoints[0]?.time || "--"})</span>
                  <span>تعداد کل گام‌ها: {equityPoints.length}</span>
                  <span>پایان ({equityPoints[equityPoints.length - 1]?.time || "--"})</span>
                </div>
              </div>
            ) : (
              <div className="bg-muted/20 border border-dashed border-border rounded-xl p-8 text-center text-xs text-muted-foreground">
                برای رسم نمودار رشد نیاز به حداقل ۲ معامله ثبت شده در این بازه است.
              </div>
            )}
          </div>

          {/* Directional Win Rates & Volume Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buy vs Sell Win Rate */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                تحلیل جهت معاملات (BUY در برابر SELL)
              </h3>
              
              <div className="space-y-3">
                {/* BUY Progress */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-emerald-500">خرید (BUY) - {timeAnalytics.buyTotal} معامله</span>
                    <span className="font-mono">
                      {timeAnalytics.buyTotal > 0 ? ((timeAnalytics.buyWins / timeAnalytics.buyTotal) * 100).toFixed(1) : 0}% برد
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${timeAnalytics.buyTotal > 0 ? (timeAnalytics.buyWins / timeAnalytics.buyTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* SELL Progress */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-rose-500">فروش (SELL) - {timeAnalytics.sellTotal} معامله</span>
                    <span className="font-mono">
                      {timeAnalytics.sellTotal > 0 ? ((timeAnalytics.sellWins / timeAnalytics.sellTotal) * 100).toFixed(1) : 0}% برد
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-rose-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${timeAnalytics.sellTotal > 0 ? (timeAnalytics.sellWins / timeAnalytics.sellTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Summary Insights */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                شاخص‌های کیفی حساب
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs my-auto">
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-muted-foreground block text-[10px]">میانگین سود هر معامله</span>
                  <span className={`font-bold font-mono text-sm ${
                    ((stats?.net_profit || 0) / (stats?.total_trades || 1)) >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    ${stats && stats.total_trades > 0 ? (stats.net_profit / stats.total_trades).toFixed(2) : "0.00"}
                  </span>
                </div>

                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-muted-foreground block text-[10px]">سود ناخالص کل</span>
                  <span className="font-bold font-mono text-sm text-emerald-500">
                    +${stats ? stats.gross_profit.toFixed(2) : "0.00"}
                  </span>
                </div>

                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-muted-foreground block text-[10px]">زیان ناخالص کل</span>
                  <span className="font-bold font-mono text-sm text-rose-500">
                    -${stats ? stats.gross_loss.toFixed(2) : "0.00"}
                  </span>
                </div>

                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-muted-foreground block text-[10px]">تعداد نمادهای فعال</span>
                  <span className="font-bold font-mono text-sm text-foreground">
                    {stats?.symbols ? Object.keys(stats.symbols).length : 0} نماد
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SYMBOLS BREAKDOWN WITH MODAL CLICK */}
      {activeTab === "symbols" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              کارت‌های تفکیک عملکرد هر نماد (برای مشاهده تاریخچه و جزییات نماد کلیک کنید)
            </h2>
          </div>

          {stats && stats.symbols && Object.keys(stats.symbols).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(stats.symbols).map(([sym, data]) => {
                const symWinRate = data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(0) : "0";
                const isProfit = data.profit >= 0;
                return (
                  <div 
                    key={sym} 
                    onClick={() => setSelectedSymbolModal(sym)}
                    className="bg-card hover:bg-muted/40 border border-border hover:border-primary/50 transition-all rounded-xl p-4 cursor-pointer shadow-sm group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base text-foreground group-hover:text-primary transition-colors">{sym}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                      </div>
                      <span className={`text-sm font-bold font-mono ${isProfit ? "text-emerald-500" : "text-rose-500"}`}>
                        {isProfit ? "+" : ""}${data.profit.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>تعداد کل معاملات:</span>
                        <span className="font-mono font-bold text-foreground">{data.trades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>حجم مجموع معاملات:</span>
                        <span className="font-mono">{data.volume.toFixed(2)} لات</span>
                      </div>
                      <div className="flex justify-between">
                        <span>نرخ برد:</span>
                        <span className={`font-mono font-bold ${Number(symWinRate) >= 50 ? "text-emerald-500" : "text-amber-500"}`}>
                          {symWinRate}% ({data.wins} برد)
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-primary/80 flex items-center justify-end font-medium">
                      کلیک برای جزییات کامل تریدها ←
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card/40 border border-border border-dashed rounded-xl p-12 text-center text-muted-foreground text-xs">
              معامله‌ای برای تفکیک نمادها یافت نشد.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMPLETE TRADES TABLE */}
      {activeTab === "history" && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border/80 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">
              تاریخچه آخرین معاملات بسته شده ({stats?.deals?.length || 0})
            </h2>
            <span className="text-[11px] text-muted-foreground font-mono">
              ساعت سرور متاتریدر ۵
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-muted/60 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border/60 font-medium">
                <tr>
                  <th className="py-2.5 px-3 text-start">تیکت</th>
                  <th className="py-2.5 px-3 text-start">زمان</th>
                  <th className="py-2.5 px-3 text-start">نماد</th>
                  <th className="py-2.5 px-3 text-start">نوع</th>
                  <th className="py-2.5 px-3 text-start">حجم (لات)</th>
                  <th className="py-2.5 px-3 text-start">قیمت خروج</th>
                  <th className="py-2.5 px-3 text-start">کمیسیون</th>
                  <th className="py-2.5 px-3 text-start">سود / زیان خالص</th>
                  <th className="py-2.5 px-3 text-start">توضیح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {stats?.deals && stats.deals.length > 0 ? (
                  stats.deals.map((deal) => {
                    const isWin = deal.net_pnl >= 0;
                    return (
                      <tr key={deal.ticket} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-muted-foreground">#{deal.ticket}</td>
                        <td className="py-2.5 px-3 text-foreground/80 font-sans text-[11px]">{deal.time}</td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">{deal.symbol}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            deal.type === "BUY" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                          }`}>
                            {deal.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{deal.volume.toFixed(2)}</td>
                        <td className="py-2.5 px-3">{deal.price.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-amber-500">${deal.commission.toFixed(2)}</td>
                        <td className={`py-2.5 px-3 font-bold ${isWin ? "text-emerald-500" : "text-rose-500"}`}>
                          {isWin ? "+" : ""}${deal.net_pnl.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-muted-foreground font-sans truncate max-w-[150px]">
                          {deal.comment || "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground text-xs font-sans">
                      {isReportLoading ? "در حال دریافت اطلاعات از MT5..." : "معامله‌ای در این بازه زمانی یافت نشد."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POPUP MODAL FOR SELECTED SYMBOL REPORT */}
      {selectedSymbolModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">
                  گزارش اختصاصی معاملات نماد: <span className="text-primary">{selectedSymbolModal}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedSymbolModal(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Summary Strip */}
            {stats?.symbols?.[selectedSymbolModal] && (
              <div className="grid grid-cols-4 gap-2 p-4 border-b border-border/60 bg-card text-xs">
                <div>
                  <span className="text-muted-foreground text-[10px] block">سود خالص نماد</span>
                  <span className={`text-base font-bold font-mono ${
                    stats.symbols[selectedSymbolModal].profit >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    {stats.symbols[selectedSymbolModal].profit >= 0 ? "+" : ""}${stats.symbols[selectedSymbolModal].profit.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">تعداد معاملات</span>
                  <span className="text-base font-bold font-mono text-foreground">
                    {stats.symbols[selectedSymbolModal].trades}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">برد / باخت</span>
                  <span className="text-base font-bold font-mono text-foreground">
                    {stats.symbols[selectedSymbolModal].wins}W / {stats.symbols[selectedSymbolModal].trades - stats.symbols[selectedSymbolModal].wins}L
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">حجم کل معاملات</span>
                  <span className="text-base font-bold font-mono text-primary">
                    {stats.symbols[selectedSymbolModal].volume.toFixed(2)} Lot
                  </span>
                </div>
              </div>
            )}

            {/* Modal Deals List */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-xs text-start">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60 font-medium">
                  <tr>
                    <th className="py-2 px-2 text-start">زمان</th>
                    <th className="py-2 px-2 text-start">جهت</th>
                    <th className="py-2 px-2 text-start">حجم</th>
                    <th className="py-2 px-2 text-start">قیمت</th>
                    <th className="py-2 px-2 text-start">کمیسیون</th>
                    <th className="py-2 px-2 text-start">سود خالص</th>
                    <th className="py-2 px-2 text-start">توضیح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {symbolModalDeals.map((deal) => {
                    const isWin = deal.net_pnl >= 0;
                    return (
                      <tr key={deal.ticket} className="hover:bg-muted/30">
                        <td className="py-2 px-2 font-sans text-[11px] text-muted-foreground">{deal.time}</td>
                        <td className="py-2 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            deal.type === "BUY" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                          }`}>
                            {deal.type}
                          </span>
                        </td>
                        <td className="py-2 px-2">{deal.volume.toFixed(2)}</td>
                        <td className="py-2 px-2">{deal.price.toFixed(2)}</td>
                        <td className="py-2 px-2 text-amber-500">${deal.commission.toFixed(2)}</td>
                        <td className={`py-2 px-2 font-bold ${isWin ? "text-emerald-500" : "text-rose-500"}`}>
                          {isWin ? "+" : ""}${deal.net_pnl.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 font-sans text-[11px] text-muted-foreground truncate max-w-[120px]">
                          {deal.comment || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-border flex justify-end bg-muted/20">
              <button
                onClick={() => setSelectedSymbolModal(null)}
                className="px-4 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs cursor-pointer hover:bg-primary/90"
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
