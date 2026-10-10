import { useState, useEffect } from "react";
import { useTraderStore } from "@/app/store/traderStore";
import { 
  Wallet, 
  FolderOpen, 
  Key, 
  Server, 
  ShieldAlert, 
  RefreshCw,
  Power,
  Plus,
  Trash2,
  Monitor,
  UserCheck,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from "lucide-react";

export interface AccountEntry {
  id: string;
  label: string;
  login: string;
  server: string;
  password?: string;
}

export interface TerminalProfile {
  id: string;
  name: string;
  path: string;
  accounts: AccountEntry[];
}

const STORAGE_KEY = "tesu_saved_terminals_v1";

const DEFAULT_PROFILES: TerminalProfile[] = [
  {
    id: "default_mt5",
    name: "متاتریدر پیش‌فرض ویندوز",
    path: "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
    accounts: [
      {
        id: "demo_1",
        label: "اکانت دمو ۱",
        login: "",
        server: "",
        password: ""
      }
    ]
  }
];

export function AccountsManager() {
  const { isMt5Connected, account, connectMt5, bots, mt5ConnectionError } = useTraderStore();

  // Saved profiles
  const [terminals, setTerminals] = useState<TerminalProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load saved terminals", e);
    }
    return DEFAULT_PROFILES;
  });

  // Selected Active Terminal & Account ID
  const [activeAccountKey, setActiveAccountKey] = useState<string | null>(() => {
    return localStorage.getItem("tesu_active_account_key") || null;
  });

  // Modal / Form state for adding Terminal
  const [showAddTerminalModal, setShowAddTerminalModal] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState("");
  const [newTerminalPath, setNewTerminalPath] = useState("C:\\Program Files\\MetaTrader 5\\terminal64.exe");

  // Modal / Form state for adding Account to a Terminal
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [targetTerminalId, setTargetTerminalId] = useState<string | null>(null);
  const [newAccountLabel, setNewAccountLabel] = useState("");
  const [newAccountLogin, setNewAccountLogin] = useState("");
  const [newAccountServer, setNewAccountServer] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");

  // UI state: Collapsed terminals
  const [collapsedTerminals, setCollapsedTerminals] = useState<Record<string, boolean>>({});

  // Direct custom connect state
  const [customPath, setCustomPath] = useState("C:\\Program Files\\MetaTrader 5\\terminal64.exe");
  const [customLogin, setCustomLogin] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [customServer, setCustomServer] = useState("");
  const [dailyLossLimit, setDailyLossLimit] = useState(50);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);

  // Save terminals to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(terminals));
    } catch (e) {
      console.error("Failed to persist terminals", e);
    }
  }, [terminals]);

  // Save current active terminal/account label if MT5 connects
  useEffect(() => {
    if (isMt5Connected && account) {
      if (!useTraderStore.getState().activeTerminalName) {
        useTraderStore.getState().setActiveTerminalInfo(account.company || "متاتریدر ۵", `#${account.login}`);
      }
    }
  }, [isMt5Connected, account]);

  const activeBotsCount = Object.keys(bots).length;

  const toggleCollapse = (termId: string) => {
    setCollapsedTerminals((prev) => ({ ...prev, [termId]: !prev[termId] }));
  };

  const handleAddTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerminalName.trim()) return;

    // Create terminal with a default ready-to-connect active account entry
    const termId = "term_" + Date.now();
    const newProfile: TerminalProfile = {
      id: termId,
      name: newTerminalName.trim(),
      path: newTerminalPath.trim(),
      accounts: [
        {
          id: "acc_active_" + Date.now(),
          label: "حساب فعال این متاتریدر",
          login: "",
          server: "",
          password: "",
        }
      ]
    };

    setTerminals((prev) => [...prev, newProfile]);
    setNewTerminalName("");
    setNewTerminalPath("C:\\Program Files\\MetaTrader 5\\terminal64.exe");
    setShowAddTerminalModal(false);
  };

  const handleDeleteTerminal = (termId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("آیا از حذف این پایانه متاتریدر و تمام اکانت‌های آن اطمینان دارید؟")) {
      setTerminals((prev) => prev.filter((t) => t.id !== termId));
    }
  };

  const openAddAccountModal = (termId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetTerminalId(termId);
    setNewAccountLabel("");
    setNewAccountLogin("");
    setNewAccountServer("");
    setNewAccountPassword("");
    setShowAddAccountModal(true);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTerminalId || !newAccountLabel.trim()) return;

    const newAcc: AccountEntry = {
      id: "acc_" + Date.now(),
      label: newAccountLabel.trim(),
      login: newAccountLogin.trim(),
      server: newAccountServer.trim(),
      password: newAccountPassword.trim()
    };

    setTerminals((prev) =>
      prev.map((t) => {
        if (t.id === targetTerminalId) {
          return { ...t, accounts: [...t.accounts, newAcc] };
        }
        return t;
      })
    );

    setShowAddAccountModal(false);
    setTargetTerminalId(null);
  };

  const handleDeleteAccount = (termId: string, accId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTerminals((prev) =>
      prev.map((t) => {
        if (t.id === termId) {
          return { ...t, accounts: t.accounts.filter((a) => a.id !== accId) };
        }
        return t;
      })
    );
  };

  // Switch / Connect to an account
  const handleSwitchAccount = (term: TerminalProfile, acc?: AccountEntry) => {
    const key = acc ? `${term.id}_${acc.id}` : `${term.id}_default`;
    if (activeBotsCount > 0) {
      const confirmSwitch = confirm(
        `هشدار: شما ${activeBotsCount} ربات فعال دارید!\nسوئیچ به متاتریدر/حساب جدید باعث توقف کامل ربات‌های فعال جاری خواهد شد.\nآیا ادامه می‌دهید؟`
      );
      if (!confirmSwitch) return;
    }

    setConnectingKey(key);
    setActiveAccountKey(key);
    localStorage.setItem("tesu_active_account_key", key);

    useTraderStore.getState().setActiveTerminalInfo(term.name, acc?.label || "حساب فعال");

    connectMt5({
      path: term.path.trim() || undefined,
      login: acc?.login ? Number(acc.login) : undefined,
      password: acc?.password || undefined,
      server: acc?.server?.trim() || undefined,
    });

    setTimeout(() => {
      setConnectingKey(null);
    }, 2000);
  };

  // Connect directly from bottom form
  const handleDirectConnect = () => {
    if (activeBotsCount > 0) {
      const confirmSwitch = confirm(
        `هشدار: شما ${activeBotsCount} ربات فعال دارید!\nسوئیچ به پایانه جدید باعث توقف ربات‌های فعال جاری خواهد شد.\nآیا ادامه می‌دهید؟`
      );
      if (!confirmSwitch) return;
    }

    setIsConnecting(true);
    setActiveAccountKey(null);
    localStorage.removeItem("tesu_active_account_key");

    useTraderStore.getState().setActiveTerminalInfo("اتصال دستی", customLogin ? `#${customLogin}` : "حساب جاری");

    connectMt5({
      path: customPath.trim() || undefined,
      login: customLogin ? Number(customLogin) : undefined,
      password: customPassword || undefined,
      server: customServer.trim() || undefined,
    });
    setTimeout(() => setIsConnecting(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Wallet className="w-5 h-5 text-primary" />
            مدیریت پایانه‌های MT5 و حساب‌های معاملاتی
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            پایانه‌های مستقل متاتریدر ۵ و اکانت‌های متصل را ذخیره کرده و با یک کلیک بین آن‌ها سوئیچ کنید.
          </p>
        </div>

        <button
          onClick={() => setShowAddTerminalModal(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          افزودن متاتریدر جدید
        </button>
      </div>

      {/* Active Warning Banner if Bots are Running */}
      {activeBotsCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 text-amber-500 text-xs font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>
            توجه: در حال حاضر <b>{activeBotsCount} ربات فعال</b> در حال اجراست. در صورت سوئیچ به هر متاتریدر یا اکانت دیگر، برای جلوگیری از اختلال در سفارشات، ربات‌های قبلی به صورت خودکار متوقف و آرشیو خواهند شد.
          </span>
        </div>
      )}

      {/* Active Account Live Card */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isMt5Connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <h2 className="text-sm font-bold text-foreground">پایانه و حساب فعال کنونی</h2>
          </div>
          <span className="text-xs font-mono bg-muted px-2.5 py-1 rounded text-muted-foreground">
            {isMt5Connected ? `متصل به #${account?.login}` : "هیچ پایانه‌ای متصل نیست"}
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
          <div className="text-center py-6 text-muted-foreground text-xs space-y-2">
            <div>برای فعال‌سازی و دریافت زنده بالانس، از لیست زیر روی دکمه «سوئیچ و اتصال» یکی از حساب‌ها کلیک کنید یا فرم اتصال مستقیم را تکمیل نمایید.</div>
            {mt5ConnectionError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 font-medium text-xs max-w-xl mx-auto">
                {mt5ConnectionError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminals & Accounts Hierarchy Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          پایانه‌ها و حساب‌های ذخیره‌شده ({terminals.length} متاتریدر)
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {terminals.map((term) => {
            const isCollapsed = collapsedTerminals[term.id];
            return (
              <div
                key={term.id}
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-all"
              >
                {/* Terminal Header */}
                <div 
                  onClick={() => toggleCollapse(term.id)}
                  className="p-4 bg-muted/20 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{term.name}</span>
                        <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          {term.accounts.length} اکانت
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground truncate block max-w-xl dir-ltr text-right">
                        {term.path}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwitchAccount(term);
                      }}
                      className="text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-semibold"
                      title="اتصال مستقیم به این متاتریدر با اکانت فعال فعلی آن"
                    >
                      <Power className="w-3.5 h-3.5" />
                      اتصال به این MT5
                    </button>

                    <button
                      onClick={(e) => openAddAccountModal(term.id, e)}
                      className="text-xs bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                      title="افزودن حساب جدید به این پایانه"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      افزودن حساب
                    </button>

                    <button
                      onClick={(e) => handleDeleteTerminal(term.id, e)}
                      className="p-1.5 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 rounded-lg transition-colors"
                      title="حذف این پایانه"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button className="p-1.5 text-muted-foreground hover:text-foreground">
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Accounts Sub-list */}
                {!isCollapsed && (
                  <div className="p-4 space-y-2">
                    {term.accounts.length === 0 ? (
                      <div className="text-center py-5 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
                        هنوز اکانتی برای این متاتریدر ثبت نشده است. روی «افزودن حساب» کلیک کنید.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {term.accounts.map((acc) => {
                          const key = `${term.id}_${acc.id}`;
                          const isCurrentActive = activeAccountKey === key && isMt5Connected;
                          const isThisConnecting = connectingKey === key;

                          return (
                            <div
                              key={acc.id}
                              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                                isCurrentActive
                                  ? "bg-primary/5 border-primary shadow-sm"
                                  : "bg-background border-border hover:border-primary/40"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <UserCheck className={`w-4 h-4 ${isCurrentActive ? "text-primary" : "text-muted-foreground"}`} />
                                    <span className="text-xs font-bold text-foreground">{acc.label}</span>
                                  </div>
                                  <div className="text-[11px] font-mono text-muted-foreground space-y-0.5">
                                    <div>لاگین: <b className="text-foreground">{acc.login || "پیش‌فرض MT5"}</b></div>
                                    <div>سرور: <span className="text-foreground">{acc.server || "پیش‌فرض"}</span></div>
                                  </div>
                                </div>

                                <button
                                  onClick={(e) => handleDeleteAccount(term.id, acc.id, e)}
                                  className="text-muted-foreground hover:text-rose-500 p-1 rounded transition-colors"
                                  title="حذف اکانت"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="pt-1 border-t border-border/50 flex items-center justify-between">
                                {isCurrentActive ? (
                                  <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    اکانت متصل فعلی
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">غیرمتصل</span>
                                )}

                                <button
                                  onClick={() => handleSwitchAccount(term, acc)}
                                  disabled={isThisConnecting || isCurrentActive}
                                  className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                                    isCurrentActive
                                      ? "bg-muted text-muted-foreground cursor-default"
                                      : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                  }`}
                                >
                                  {isThisConnecting ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      در حال سوئیچ...
                                    </>
                                  ) : isCurrentActive ? (
                                    "متصل"
                                  ) : (
                                    <>
                                      <Power className="w-3.5 h-3.5" />
                                      سوئیچ و اتصال
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual Direct Connection Form */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          اتصال دستی موقت یا خارج از لیست
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              مسیر فایل اجرایی متاتریدر (terminal64.exe)
            </label>
            <div className="relative">
              <FolderOpen className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="C:\Program Files\MetaTrader 5\terminal64.exe"
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <span className="text-[10px] text-muted-foreground block mt-1">
              اگر این فیلد خالی بماند، به متاتریدر فعالِ در حال اجرای ویندوز متصل می‌شود.
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">شماره حساب (Login Number)</label>
            <input
              type="number"
              value={customLogin}
              onChange={(e) => setCustomLogin(e.target.value)}
              placeholder="اختیاری (اگر روی MT5 فعال است)"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">رمز عبور (Password)</label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="password"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder="رمز عبور حساب"
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">نام سرور بروکر (Server)</label>
            <input
              type="text"
              value={customServer}
              onChange={(e) => setCustomServer(e.target.value)}
              placeholder="مثال: MetaQuotes-Demo یا ICMarkets-Live"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>

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
            onClick={handleDirectConnect}
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

      {/* Modal: Add Terminal */}
      {showAddTerminalModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              ثبت متاتریدر جدید
            </h3>
            <p className="text-xs text-muted-foreground">
              مسیر نصب فایل اجرایی متاتریدر مورد نظر را روی هارد ویندوز مشخص کنید.
            </p>

            <form onSubmit={handleAddTerminal} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">نام یا عنوان پایانه</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: متاتریدر آلپاری یا پراپ فاندد"
                  value={newTerminalName}
                  onChange={(e) => setNewTerminalName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  مسیر فایل terminal64.exe
                </label>
                <input
                  type="text"
                  required
                  value={newTerminalPath}
                  onChange={(e) => setNewTerminalPath(e.target.value)}
                  placeholder="C:\Program Files\MetaTrader 5\terminal64.exe"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary dir-ltr"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTerminalModal(false)}
                  className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm"
                >
                  ذخیره پایانه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Account */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              افزودن حساب معاملاتی جدید
            </h3>
            <p className="text-xs text-muted-foreground">
              مشخصات حساب متصل به این پایانه را جهت ذخیره و سوییچ سریع وارد کنید.
            </p>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">برچسب یا عنوان حساب</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: اکانت اصلی طلا یا حساب آزمایشی"
                  value={newAccountLabel}
                  onChange={(e) => setNewAccountLabel(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">شماره لاگین (اختیاری)</label>
                  <input
                    type="number"
                    placeholder="مثال: 5041238"
                    value={newAccountLogin}
                    onChange={(e) => setNewAccountLogin(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">نام سرور (اختیاری)</label>
                  <input
                    type="text"
                    placeholder="مثال: Alpari-MT5-Demo"
                    value={newAccountServer}
                    onChange={(e) => setNewAccountServer(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">رمز عبور (اختیاری)</label>
                <input
                  type="password"
                  placeholder="رمز عبور حساب"
                  value={newAccountPassword}
                  onChange={(e) => setNewAccountPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm"
                >
                  ذخیره حساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
