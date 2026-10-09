"""
Pullback Strategy Engine - Stop-Entry Pullback Implementation
Faithful reproduction of Segaro/teso2 logic with enhancements for multi-instance,
ATR-14 calculation, trailing pending orders, risk-free trailing and double target support.
"""

from typing import List, Dict, Any, Optional, Set
import datetime
import logging

logger = logging.getLogger("PullbackEngine")

def calculate_atr14(candles: List[Dict[str, Any]]) -> float:
    """Calculates 14-period ATR from closed candles."""
    if len(candles) < 15:
        return 0.0

    trs = []
    for i in range(1, len(candles)):
        current = candles[i]
        prev = candles[i - 1]
        tr = max(
            current["high"] - current["low"],
            abs(current["high"] - prev["close"]),
            abs(current["low"] - prev["close"])
        )
        trs.append(tr)

    # Simple 14-period smoothed/SMA of True Range
    atr_period = 14
    if len(trs) < atr_period:
        return sum(trs) / len(trs) if trs else 0.0
    return sum(trs[-atr_period:]) / atr_period

class PullbackStrategyInstance:
    def __init__(self, bot_id: str, config: Dict[str, Any]):
        self.bot_id = bot_id
        self.config = config
        self.symbol: str = config.get("symbol", "XAUUSD")
        self.side: str = config.get("side", "SELL").upper()  # "BUY" or "SELL"
        self.timeframe: str = config.get("timeframe", "5m")
        self.risk_usd: float = float(config.get("risk_usd", 10.0))
        self.rr_ratio: float = float(config.get("rr_ratio", 2.0))
        self.is_double: bool = bool(config.get("double", False))
        self.chain: int = int(config.get("chain", 1))
        self.commission_per_lot: float = float(config.get("commission_per_lot", 0.0))
        self.max_open_positions: int = int(config.get("max_open_positions", 0))  # 0 means unlimited
        self.martingale_enabled: bool = bool(config.get("martingale_enabled", False))
        self.martingale_step_pct: float = float(config.get("martingale_step_pct", 10.0))  # e.g. 10%
        self.stop_above_price: Optional[float] = float(config["stop_above_price"]) if config.get("stop_above_price") else None
        self.stop_below_price: Optional[float] = float(config["stop_below_price"]) if config.get("stop_below_price") else None
        self.base_risk_usd: float = self.risk_usd
        self.current_risk_usd: float = self.risk_usd
        self.consecutive_losses: int = 0
        self.current_leg: int = 1

        # State tracking
        self.state: str = "WAITING_PULLBACK"  # WAITING_PULLBACK, PENDING_ACTIVE, POSITION_ACTIVE, FINISHED, CANCELLED
        self.stop_reason: Optional[str] = None
        self.start_time: datetime.datetime = datetime.datetime.now()
        self.A: Optional[float] = None
        self.atr14: float = 0.0
        self.has_pullback: bool = False
        self.pending_ticket: Optional[int] = None
        self.pending_tickets: List[int] = []
        self.position_ticket: Optional[int] = None
        self.active_position_tickets: List[int] = []
        self.pending_entry: Optional[float] = None
        self.pending_sl: Optional[float] = None
        self.pending_tp: Optional[float] = None
        self.last_candle_time: int = 0
        self.highest_price_since_entry: float = 0.0
        self.lowest_price_since_entry: float = 999999.0
        self.processed_deals: Set[int] = set()
        self.events: List[Dict[str, Any]] = []

    def on_trade_loss(self, position_id: int):
        """Called when a position hits stop loss."""
        self.consecutive_losses += 1
        if self.martingale_enabled:
            # Increase risk by step percent (e.g. 10 -> 11 -> 12.1)
            self.current_risk_usd = round(self.base_risk_usd * (1.0 + (self.martingale_step_pct / 100.0) * self.consecutive_losses), 2)
            self.log_event("RISK_INCREASED", {
                "consecutive_losses": self.consecutive_losses,
                "new_risk_usd": self.current_risk_usd,
                "position_id": position_id
            })
        else:
            self.log_event("TRADE_LOSS", {"position_id": position_id})

    def on_trade_target_hit(self, position_id: int, is_main_target: bool = True):
        """Called when a position hits target profit."""
        if is_main_target:
            self.consecutive_losses = 0
            self.current_risk_usd = self.base_risk_usd
            self.log_event("RISK_RESET", {
                "reason": "MAIN_TARGET_HIT",
                "risk_usd": self.current_risk_usd,
                "position_id": position_id
            })

    def restart_after_trigger(self, new_A: float, new_atr: float):
        """Continues the bot cycle after an entry or completion so it keeps trading."""
        self.A = new_A
        self.atr14 = new_atr
        self.has_pullback = False
        self.pending_ticket = None
        self.state = "WAITING_PULLBACK"
        self.log_event("CYCLE_RESTARTED", {"new_A": self.A, "atr": self.atr14})

    def log_event(self, event_type: str, data: Dict[str, Any]):
        event = {
            "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "bot_id": self.bot_id,
            "type": event_type,
            **data
        }
        self.events.append(event)
        logger.info(f"[{self.bot_id}] {event_type}: {data}")

    def on_start(self, latest_closed_candle: Dict[str, Any], initial_atr: float):
        """Initializes reference point A on user start command."""
        self.atr14 = initial_atr
        self.last_candle_time = latest_closed_candle["time"]

        if self.side == "SELL":
            self.A = latest_closed_candle["high"]
            # If the candle that made A is itself red (bearish), it counts as pullback
            if not latest_closed_candle["is_bull"]:
                self.has_pullback = True
        else:
            self.A = latest_closed_candle["low"]
            # For BUY: If the candle that made A is green/white (bullish), it counts as pullback
            if latest_closed_candle["is_bull"]:
                self.has_pullback = True

        self.log_event("A_SET", {
            "A": self.A,
            "atr": self.atr14,
            "has_pullback": self.has_pullback,
            "candle_time": self.last_candle_time
        })

    def process_new_candle(self, new_candle: Dict[str, Any], new_atr: float, spread_price: float = 0.0) -> Dict[str, Any]:
        """
        Runs the pullback stop-entry logic upon completion of each new candle.
        spread_price is added to SL for SELL positions and to Entry for BUY positions.
        Returns actions required: {"action": "NONE"|"PLACE_PENDING"|"MOVE_PENDING"|"CANCEL_PENDING"|"STOP_BOT", ...}
        """
        if self.state in ["FINISHED", "CANCELLED"]:
            return {"action": "NONE"}

        self.last_candle_time = new_candle["time"]
        high = new_candle["high"]
        low = new_candle["low"]
        close = new_candle["close"]
        is_bull = new_candle["is_bull"]

        # Check Price Bounds (Stop Above / Stop Below levels)
        if self.stop_above_price is not None and high >= self.stop_above_price:
            self.state = "CANCELLED"
            self.stop_reason = f"High reached stop above limit ({self.stop_above_price})"
            old_pending = self.pending_ticket
            old_tickets = list(self.pending_tickets)
            self.pending_ticket = None
            self.pending_tickets = []
            self.log_event("PRICE_UPPER_LIMIT_REACHED", {"limit": self.stop_above_price, "high": high})
            tickets_to_cancel = old_tickets if old_tickets else ([old_pending] if old_pending else [])
            return {"action": "STOP_BOT", "tickets": tickets_to_cancel, "reason": self.stop_reason}

        if self.stop_below_price is not None and low <= self.stop_below_price:
            self.state = "CANCELLED"
            self.stop_reason = f"Low reached stop below limit ({self.stop_below_price})"
            old_pending = self.pending_ticket
            old_tickets = list(self.pending_tickets)
            self.pending_ticket = None
            self.pending_tickets = []
            self.log_event("PRICE_LOWER_LIMIT_REACHED", {"limit": self.stop_below_price, "low": low})
            tickets_to_cancel = old_tickets if old_tickets else ([old_pending] if old_pending else [])
            return {"action": "STOP_BOT", "tickets": tickets_to_cancel, "reason": self.stop_reason}

        # -------------------------------------------------------------
        # SELL LOGIC (Buy is the exact mirror)
        # -------------------------------------------------------------
        if self.side == "SELL":
            # 1. Break of A (even by wick) resets A and restarts process
            if high > self.A:
                self.A = high
                self.atr14 = new_atr
                self.has_pullback = not is_bull  # if current candle is red, it counts as pullback
                old_pending = self.pending_ticket
                old_tickets = list(self.pending_tickets)
                self.pending_ticket = None
                self.pending_tickets = []
                self.state = "WAITING_PULLBACK"
                self.log_event("A_RESET", {"A": self.A, "atr": self.atr14, "candle_is_red": not is_bull})
                if old_tickets or old_pending:
                    tickets_to_cancel = old_tickets if old_tickets else ([old_pending] if old_pending else [])
                    return {"action": "CANCEL_PENDING", "ticket": old_pending, "tickets": tickets_to_cancel, "reason": "A_BROKEN"}
                return {"action": "NONE"}

            # 2. Invalidation: if price dropped more than 5x ATR without entry -> restart cycle from new low/high
            # Note: Do not reset if we have active open positions
            if low <= (self.A - 5 * self.atr14):
                old_pending = self.pending_ticket
                old_tickets = list(self.pending_tickets)
                self.A = high
                self.atr14 = new_atr
                self.has_pullback = not is_bull
                self.pending_ticket = None
                self.pending_tickets = []
                self.state = "WAITING_PULLBACK"
                self.log_event("CYCLE_RESET_5X_ATR", {"new_A": self.A, "atr": self.atr14})
                if old_tickets or old_pending:
                    tickets_to_cancel = old_tickets if old_tickets else ([old_pending] if old_pending else [])
                    return {"action": "CANCEL_PENDING", "ticket": old_pending, "tickets": tickets_to_cancel, "reason": "5x_ATR_RESET"}
                return {"action": "NONE"}

            # 3. Pullback check: wait for red candle(s)
            if not self.has_pullback:
                if not is_bull:  # red candle
                    self.has_pullback = True
                    self.log_event("PULLBACK_CONFIRMED", {"candle_low": low})
                return {"action": "NONE"}

            # 4. First white candle after pullback -> Place Sell Stop
            if self.has_pullback and self.state == "WAITING_PULLBACK" and is_bull:
                entry = low - (0.1 * self.atr14)
                # In SELL, stop is closed by ASK (Bid + Spread). So SL must cover High + spread.
                sl = high + spread_price
                risk_distance = sl - entry
                tp = entry - (risk_distance * self.rr_ratio)

                self.pending_entry = entry
                self.pending_sl = sl
                self.pending_tp = tp
                self.state = "PENDING_ACTIVE"
                self.log_event("PENDING_PREPARED", {"entry": entry, "sl": sl, "tp": tp, "spread_added": spread_price})
                return {
                    "action": "PLACE_PENDING",
                    "price": entry,
                    "sl": sl,
                    "tp": tp,
                    "side": "SELL"
                }

            # 5. Move Pending if new white candle forms without breaking A or triggering
            if self.state == "PENDING_ACTIVE" and is_bull:
                new_entry = low - (0.1 * self.atr14)
                new_sl = max(self.pending_sl, high + spread_price)
                risk_distance = new_sl - new_entry
                new_tp = new_entry - (risk_distance * self.rr_ratio)

                self.pending_entry = new_entry
                self.pending_sl = new_sl
                self.pending_tp = new_tp
                self.log_event("PENDING_MOVED", {"entry": new_entry, "sl": new_sl, "tp": new_tp})
                return {
                    "action": "MOVE_PENDING",
                    "ticket": self.pending_ticket,
                    "price": new_entry,
                    "sl": new_sl,
                    "tp": new_tp
                }

            # 6. Wick above SL but not above A -> raises SL
            if self.state == "PENDING_ACTIVE" and (high + spread_price) > self.pending_sl and high <= self.A:
                self.pending_sl = high + spread_price
                risk_distance = self.pending_sl - self.pending_entry
                self.pending_tp = self.pending_entry - (risk_distance * self.rr_ratio)
                return {
                    "action": "MOVE_PENDING",
                    "ticket": self.pending_ticket,
                    "price": self.pending_entry,
                    "sl": self.pending_sl,
                    "tp": self.pending_tp
                }

        # -------------------------------------------------------------
        # BUY LOGIC (Mirror of SELL)
        # -------------------------------------------------------------
        else:
            # 1. Break of A (low broken) resets A
            if low < self.A:
                self.A = low
                self.atr14 = new_atr
                self.has_pullback = is_bull
                old_pending = self.pending_ticket
                old_tickets = list(self.pending_tickets)
                self.pending_ticket = None
                self.pending_tickets = []
                self.state = "WAITING_PULLBACK"
                self.log_event("A_RESET", {"A": self.A, "atr": self.atr14, "candle_is_green": is_bull})
                if old_tickets or old_pending:
                    tickets_to_cancel = old_tickets if old_tickets else ([old_pending] if old_pending else [])
                    return {"action": "CANCEL_PENDING", "ticket": old_pending, "tickets": tickets_to_cancel, "reason": "A_BROKEN"}
                return {"action": "NONE"}

            # 2. 5x ATR Invalidation -> restart cycle from new low/high
            # Note: Do not reset if we have active open positions
            if high >= (self.A + 5 * self.atr14):
                old_pending = self.pending_ticket
                old_tickets = list(self.pending_tickets)
                self.A = low
                self.atr14 = new_atr
                self.has_pullback = is_bull
                self.pending_ticket = None
                self.pending_tickets = []
                self.state = "WAITING_PULLBACK"
                self.log_event("CYCLE_RESET_5X_ATR", {"new_A": self.A, "atr": self.atr14})
                if old_tickets or old_pending:
                    tickets_to_cancel = old_tickets if old_tickets else ([old_pending] if old_pending else [])
                    return {"action": "CANCEL_PENDING", "ticket": old_pending, "tickets": tickets_to_cancel, "reason": "5x_ATR_RESET"}
                return {"action": "NONE"}

            # 3. Pullback check: wait for green candle(s)
            if not self.has_pullback:
                if is_bull:
                    self.has_pullback = True
                    self.log_event("PULLBACK_CONFIRMED", {"candle_high": high})
                return {"action": "NONE"}

            # 4. First red candle after pullback -> Place Buy Stop
            # In BUY, order triggers at Ask (High + Spread). SL is at Low.
            if self.has_pullback and self.state == "WAITING_PULLBACK" and not is_bull:
                entry = high + (0.1 * self.atr14) + spread_price
                sl = low
                risk_distance = entry - sl
                tp = entry + (risk_distance * self.rr_ratio)

                self.pending_entry = entry
                self.pending_sl = sl
                self.pending_tp = tp
                self.state = "PENDING_ACTIVE"
                self.log_event("PENDING_PREPARED", {"entry": entry, "sl": sl, "tp": tp, "spread_added": spread_price})
                return {
                    "action": "PLACE_PENDING",
                    "price": entry,
                    "sl": sl,
                    "tp": tp,
                    "side": "BUY"
                }

            # 5. Move Pending if new red candle forms without breaking A
            if self.state == "PENDING_ACTIVE" and not is_bull:
                new_entry = high + (0.1 * self.atr14) + spread_price
                new_sl = min(self.pending_sl, low)
                risk_distance = new_entry - new_sl
                new_tp = new_entry + (risk_distance * self.rr_ratio)

                self.pending_entry = new_entry
                self.pending_sl = new_sl
                self.pending_tp = new_tp
                self.log_event("PENDING_MOVED", {"entry": new_entry, "sl": new_sl, "tp": new_tp})
                return {
                    "action": "MOVE_PENDING",
                    "ticket": self.pending_ticket,
                    "price": new_entry,
                    "sl": new_sl,
                    "tp": new_tp
                }

            # 6. Wick below SL but not below A -> lowers SL
            if self.state == "PENDING_ACTIVE" and low < self.pending_sl and low >= self.A:
                self.pending_sl = low
                risk_distance = self.pending_entry - self.pending_sl
                self.pending_tp = self.pending_entry + (risk_distance * self.rr_ratio)
                return {
                    "action": "MOVE_PENDING",
                    "ticket": self.pending_ticket,
                    "price": self.pending_entry,
                    "sl": self.pending_sl,
                    "tp": self.pending_tp
                }

        return {"action": "NONE"}
