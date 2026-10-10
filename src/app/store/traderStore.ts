import { create } from "zustand";
import { SystemService } from "@/core/services/system";

export interface AccountInfo {
  login: number;
  trade_mode: number;
  balance: number;
  equity: number;
  profit: number;
  margin: number;
  margin_free: number;
  margin_level: number;
  currency: string;
  server: string;
  company: string;
}

export interface OpenPosition {
  ticket: number;
  time: string;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  price_open: number;
  price_current: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  magic: number;
  comment: string;
}

export interface BotInstance {
  bot_id: string;
  symbol: string;
  side: "BUY" | "SELL";
  timeframe: string;
  risk_usd: number;
  base_risk_usd?: number;
  rr_ratio?: number;
  is_double?: boolean;
  consecutive_losses?: number;
  max_open_positions?: number;
  open_positions_count?: number;
  martingale_enabled?: boolean;
  martingale_step_pct?: number;
  stop_above_price?: number | null;
  stop_below_price?: number | null;
  stop_reason?: string | null;
  state: "WAITING_PULLBACK" | "PENDING_ACTIVE" | "POSITION_ACTIVE" | "FINISHED" | "CANCELLED";
  A: number | null;
  atr14: number;
  pending_entry: number | null;
  pending_sl: number | null;
  pending_tp: number | null;
  pending_ticket: number | null;
  pending_tickets?: number[];
  position_ticket: number | null;
  events: any[];
  performance?: {
    trades_count: number;
    wins: number;
    losses: number;
    win_rate: number;
    total_pnl: number;
    equity_curve?: number[];
    deals?: Array<{
      ticket: number;
      time: string;
      symbol: string;
      profit: number;
      commission: number;
      net_pnl: number;
      volume: number;
    }>;
  };
}

export interface ReportData {
  period_days: number;
  total_trades: number;
  net_profit: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  win_rate: number;
  wins: number;
  losses: number;
  total_commission: number;
  total_swap: number;
  symbols: Record<string, { trades: number; profit: number; wins: number; volume: number }>;
  deals: {
    ticket: number;
    order: number;
    position_id: number;
    time: string;
    symbol: string;
    type: "BUY" | "SELL";
    volume: number;
    price: number;
    profit: number;
    commission: number;
    swap: number;
    net_pnl: number;
    comment: string;
  }[];
}

interface TraderState {
  ws: WebSocket | null;
  isEngineConnected: boolean;
  isMt5Connected: boolean;
  account: AccountInfo | null;
  symbols: Array<{ name: string; description: string; path: string; visible: boolean }>;
  bots: Record<string, BotInstance>;
  archivedBots: Record<string, BotInstance>;
  openPositions: OpenPosition[];
  selectedSymbol: string;
  selectedTimeframe: string;
  riskUsd: number;
  isDouble: boolean;
  reportData: ReportData | null;
  isReportLoading: boolean;

  activeTerminalName: string;
  activeAccountLabel: string;
  setActiveTerminalInfo: (terminalName: string, accountLabel: string) => void;
  connectEngine: () => void;
  fetchSymbols: () => void;
  fetchReport: (days?: number) => void;
  fetchOpenPositions: () => void;
  closePosition: (ticket: number) => void;
  clearArchivedBot: (botId: string) => void;
  startBot: (config: {
    symbol: string;
    side: "BUY" | "SELL";
    timeframe: string;
    risk_usd: number;
    double?: boolean;
    rr_ratio?: number;
    commission_per_lot?: number;
    max_open_positions?: number;
    martingale_enabled?: boolean;
    martingale_step_pct?: number;
    stop_above_price?: number;
    stop_below_price?: number;
  }) => void;
  stopBot: (botId: string) => void;
  deleteBot: (botId: string) => void;
  closeAllBotTrades: (botId: string) => void;
  connectMt5: (credentials: { path?: string; login?: number; password?: string; server?: string }) => void;
}

export const useTraderStore = create<TraderState>((set, get) => ({
  ws: null,
  isEngineConnected: false,
  isMt5Connected: false,
  account: null,
  symbols: [],
  bots: {},
  archivedBots: {},
  openPositions: [],
  selectedSymbol: "XAUUSD",
  selectedTimeframe: "5m",
  riskUsd: 20.0,
  isDouble: false,
  reportData: null,
  isReportLoading: false,
  activeTerminalName: localStorage.getItem("tesu_active_terminal_name") || "",
  activeAccountLabel: localStorage.getItem("tesu_active_account_label") || "",

  setActiveTerminalInfo: (terminalName: string, accountLabel: string) => {
    try {
      localStorage.setItem("tesu_active_terminal_name", terminalName);
      localStorage.setItem("tesu_active_account_label", accountLabel);
    } catch (e) {}
    set({ activeTerminalName: terminalName, activeAccountLabel: accountLabel });
  },

  connectEngine: () => {
    const existing = get().ws;
    if (existing && existing.readyState === WebSocket.OPEN) return;

    try {
      const socket = new WebSocket("ws://127.0.0.1:9182");

      socket.onopen = () => {
        set({ ws: socket, isEngineConnected: true });
        // Sync presets from localStorage to engine upon connection
        try {
          const savedPresets = localStorage.getItem("tesu_bot_presets");
          if (savedPresets) {
            socket.send(JSON.stringify({ action: "SYNC_PRESETS", presets: JSON.parse(savedPresets) }));
          }
        } catch (e) {
          console.error("Failed to sync presets on open", e);
        }
      };

      socket.onerror = () => {
        // Automatically attempt to start Standalone Engine / Python Engine if connection fails
        SystemService.startPythonEngine().catch(() => {});
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "INIT_STATE") {
            set({
              isMt5Connected: msg.connected_to_mt5,
              account: msg.account,
              symbols: msg.symbols || [],
              bots: msg.bots || {},
              archivedBots: msg.archived_bots || {},
              openPositions: msg.open_positions || [],
            });
          } else if (msg.type === "MT5_STATUS") {
            set({
              isMt5Connected: msg.connected,
              account: msg.account,
              symbols: msg.symbols || [],
            });
          } else if (msg.type === "SYMBOLS_DATA") {
            set({ symbols: msg.symbols || [] });
          } else if (msg.type === "POSITIONS_UPDATE") {
            set({ openPositions: msg.positions || [] });
          } else if (msg.type === "ACCOUNT_UPDATE") {
            set({ account: msg.account });
          } else if (msg.type === "BOT_STARTED" || msg.type === "BOT_UPDATED") {
            set((state) => ({
              bots: { ...state.bots, [msg.bot.bot_id]: msg.bot },
            }));
          } else if (msg.type === "BOT_STOPPED") {
            set((state) => {
              const updated = { ...state.bots };
              if (updated[msg.bot_id]) {
                updated[msg.bot_id].state = "CANCELLED";
              }
              return { bots: updated };
            });
          } else if (msg.type === "BOT_DELETED") {
            set((state) => {
              const updatedBots = { ...state.bots };
              const updatedArchived = { ...state.archivedBots };
              if (msg.archived_bot) {
                updatedArchived[msg.bot_id] = msg.archived_bot;
              } else if (updatedBots[msg.bot_id]) {
                updatedArchived[msg.bot_id] = { ...updatedBots[msg.bot_id], state: "CANCELLED" };
              }
              delete updatedBots[msg.bot_id];
              return { bots: updatedBots, archivedBots: updatedArchived };
            });
          } else if (msg.type === "REPORT_DATA") {
            set({ reportData: msg.report, isReportLoading: false });
          } else if (msg.type === "ERROR") {
            set({ isReportLoading: false });
            alert(`خطا: ${msg.message}`);
          }
        } catch (e) {
          console.error("Failed to parse trader ws message", e);
        }
      };

      socket.onclose = () => {
        set({ isEngineConnected: false, isMt5Connected: false });
        setTimeout(() => get().connectEngine(), 3000);
      };
    } catch (e) {
      console.error("Could not connect to Trader Engine WS", e);
    }
  },

  startBot: (config) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          action: "START_BOT",
          ...config,
        })
      );
    }
  },

  stopBot: (botId) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "STOP_BOT", bot_id: botId }));
    }
  },

  deleteBot: (botId) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "DELETE_BOT", bot_id: botId }));
    }
  },

  closeAllBotTrades: (botId) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "CLOSE_ALL", bot_id: botId }));
    }
  },

  connectMt5: (credentials) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "CONNECT_MT5", ...credentials }));
    }
  },

  fetchSymbols: () => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "GET_SYMBOLS" }));
    }
  },

  fetchReport: (days = 30) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      set({ isReportLoading: true });
      ws.send(JSON.stringify({ action: "GET_REPORT", days }));
    } else {
      // If not connected, reconnect first
      get().connectEngine();
      setTimeout(() => {
        const activeWs = get().ws;
        if (activeWs && activeWs.readyState === WebSocket.OPEN) {
          set({ isReportLoading: true });
          activeWs.send(JSON.stringify({ action: "GET_REPORT", days }));
        }
      }, 500);
    }
  },

  fetchOpenPositions: () => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "GET_OPEN_POSITIONS" }));
    }
  },

  closePosition: (ticket: number) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "CLOSE_OPEN_POSITION", ticket }));
    }
  },

  clearArchivedBot: (botId: string) => {
    set((state) => {
      const updated = { ...state.archivedBots };
      delete updated[botId];
      return { archivedBots: updated };
    });
  },
}));
