"""
MT5 Bridge Manager - Multi-terminal & Multi-account controller
Handles low-latency connection, quote retrieval, and ultra-fast order execution.
"""

import MetaTrader5 as mt5
import logging
import datetime
from typing import Optional, Dict, Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MT5Bridge")

TIMEFRAME_MAP = {
    "1m": mt5.TIMEFRAME_M1,
    "5m": mt5.TIMEFRAME_M5,
    "15m": mt5.TIMEFRAME_M15,
    "30m": mt5.TIMEFRAME_M30,
    "1h": mt5.TIMEFRAME_H1,
    "4h": mt5.TIMEFRAME_H4,
    "1d": mt5.TIMEFRAME_D1,
}

class MT5Bridge:
    def __init__(self, terminal_path: Optional[str] = None, login: Optional[int] = None, password: Optional[str] = None, server: Optional[str] = None):
        self.terminal_path = terminal_path
        self.login = login
        self.password = password
        self.server = server
        self.is_connected = False
        self.last_error_message: Optional[str] = None
        self._symbol_cache: Dict[str, Any] = {}

    def connect(self) -> bool:
        """Initializes connection to MT5 terminal."""
        init_kwargs: Dict[str, Any] = {}
        if self.terminal_path:
            init_kwargs["path"] = self.terminal_path
        if self.login:
            init_kwargs["login"] = int(self.login)
        if self.password:
            init_kwargs["password"] = self.password
        if self.server:
            init_kwargs["server"] = self.server

        if not mt5.initialize(**init_kwargs):
            err = mt5.last_error()
            self.last_error_message = f"خطای راه‌اندازی متاتریدر (کد {err[0]}): {err[1]}"
            logger.error(f"MT5 initialize failed: {self.last_error_message}")
            self.is_connected = False
            return False

        account_info = mt5.account_info()
        if account_info is None:
            err = mt5.last_error()
            self.last_error_message = f"خطای ورود به حساب (کد {err[0]}): {err[1]}"
            logger.error(f"Failed to get account info: {self.last_error_message}")
            self.is_connected = False
            return False

        self.last_error_message = None
        self.is_connected = True
        logger.info(f"Connected to MT5 - Account: {account_info.login}, Server: {account_info.server}, Balance: {account_info.balance}")
        return True

    def disconnect(self):
        """Disconnects from MT5 terminal."""
        mt5.shutdown()
        self.is_connected = False
        self._symbol_cache.clear()

    def get_account_summary(self) -> Optional[Dict[str, Any]]:
        """Returns balance, equity, margin, floating PnL."""
        if not self.is_connected and not self.connect():
            return None
        info = mt5.account_info()
        if info is None:
            return None
        return {
            "login": info.login,
            "trade_mode": info.trade_mode,
            "balance": info.balance,
            "equity": info.equity,
            "profit": info.profit,
            "margin": info.margin,
            "margin_free": info.margin_free,
            "margin_level": info.margin_level,
            "currency": info.currency,
            "server": info.server,
            "company": info.company,
        }

    def get_all_symbols(self) -> List[Dict[str, Any]]:
        """Returns all available tradable symbols in the connected MT5 broker."""
        if not self.is_connected and not self.connect():
            return []
        
        symbols = mt5.symbols_get()
        if not symbols:
            return []

        result = []
        for s in symbols:
            # We filter visible or major tradable instruments
            result.append({
                "name": s.name,
                "description": s.description or s.name,
                "path": s.path or "",
                "visible": bool(s.visible),
                "digits": s.digits,
                "spread": s.spread,
                "point": s.point
            })
        return result

    def resolve_symbol(self, symbol: str) -> str:
        """Resolves broker-specific symbol suffixes (e.g. XAUUSD -> XAUUSD_o, XAUUSD.m, etc.)."""
        # 1. Exact check
        info = mt5.symbol_info(symbol)
        if info is not None:
            return symbol

        # 2. Check cached all symbols
        all_symbols = mt5.symbols_get()
        if all_symbols:
            # Look for exact match with prefix/suffix (e.g. XAUUSD_o, XAUUSDm, etc.)
            clean_input = symbol.upper().replace("/", "").replace("_", "").replace(".", "")
            for s in all_symbols:
                clean_s = s.name.upper().replace("/", "").replace("_", "").replace(".", "")
                if clean_input in clean_s or clean_s.startswith(clean_input):
                    return s.name

        return symbol

    def get_symbol_info(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Caches and returns symbol specifications for fast lot calculation."""
        resolved = self.resolve_symbol(symbol)
        if resolved in self._symbol_cache:
            return self._symbol_cache[resolved]

        info = mt5.symbol_info(resolved)
        if info is None:
            # Try selecting symbol in MarketWatch
            if mt5.symbol_select(resolved, True):
                info = mt5.symbol_info(resolved)
            if info is None:
                logger.error(f"Symbol {symbol} (resolved: {resolved}) not found in MT5")
                return None

        data = {
            "name": info.name,
            "point": info.point,
            "digits": info.digits,
            "spread": info.spread,
            "trade_tick_size": info.trade_tick_size,
            "trade_tick_value": info.trade_tick_value,
            "volume_min": info.volume_min,
            "volume_max": info.volume_max,
            "volume_step": info.volume_step,
            "trade_contract_size": info.trade_contract_size,
        }
        self._symbol_cache[symbol] = data
        self._symbol_cache[resolved] = data
        return data

    def get_auto_commission_per_lot(self, symbol: str) -> float:
        """
        Auto-detects round-trip commission per 1.0 lot directly from recent deal history in MT5.
        """
        resolved = self.resolve_symbol(symbol)
        try:
            import datetime
            now_dt = datetime.datetime.now()
            # Check deals over the last 30 days
            deals = mt5.history_deals_get(now_dt - datetime.timedelta(days=30), now_dt)
            if deals:
                comm_samples = []
                for d in deals:
                    # In MT5 entry deal (entry==0) often has negative commission (e.g. -0.84 for 0.24 lot = -3.5/lot per side)
                    if d.symbol == resolved and d.volume > 0 and d.commission != 0:
                        # Full round-trip is 2x one-way entry commission
                        comm_samples.append(abs(d.commission) / float(d.volume) * 2.0)
                if comm_samples:
                    avg_comm = round(sum(comm_samples) / len(comm_samples), 2)
                    logger.info(f"Detected round-trip commission for {symbol}: ${avg_comm}/lot")
                    return avg_comm
        except Exception as e:
            logger.warning(f"Failed to auto-detect commission for {symbol}: {e}")

        # Intelligent fallbacks based on broker averages
        clean_s = resolved.upper()
        if "XAU" in clean_s or "GOLD" in clean_s:
            return 10.0
        elif "JPY" in clean_s:
            return 7.0
        return 7.0

    def calculate_lot_size(self, symbol: str, risk_usd: float, entry_price: float, sl_price: float, commission_per_lot: Optional[float] = None) -> float:
        """
        Calculates exact lot size based on dollar risk budget, taking commission into account.
        Total Loss on Stop = Lots * ( (Distance_Price / Tick_Size) * Tick_Value ) + Lots * Commission_Per_Lot
        Therefore: Lots = Risk_USD / ( Price_Loss_Per_Lot + Commission_Per_Lot )
        """
        sym_info = self.get_symbol_info(symbol)
        if not sym_info:
            return 0.01

        if commission_per_lot is None or commission_per_lot <= 0:
            commission_per_lot = self.get_auto_commission_per_lot(symbol)

        distance_price = abs(entry_price - sl_price)
        if distance_price <= 0:
            return sym_info["volume_min"]

        tick_size = sym_info["trade_tick_size"] if sym_info["trade_tick_size"] and sym_info["trade_tick_size"] > 0 else sym_info["point"]
        tick_value = sym_info["trade_tick_value"] if sym_info["trade_tick_value"] and sym_info["trade_tick_value"] > 0 else 1.0

        # Loss per 1.0 lot for this price distance
        price_loss_per_lot = (distance_price / tick_size) * tick_value
        total_loss_per_lot = price_loss_per_lot + commission_per_lot
        if total_loss_per_lot <= 0:
            return sym_info["volume_min"]

        raw_lot = risk_usd / total_loss_per_lot
        step = sym_info["volume_step"] if sym_info["volume_step"] and sym_info["volume_step"] > 0 else 0.01
        
        # Round to nearest step with high precision
        lots = round(round(raw_lot / step) * step, 2)
        lots = max(sym_info["volume_min"], min(sym_info["volume_max"], lots))
        logger.info(
            f"[{symbol}] Lot calculation details: "
            f"Risk: ${risk_usd} | RawLot: {raw_lot:.4f} -> FinalLot: {lots} | "
            f"Distance: {distance_price:.5f} | TickSize: {tick_size} | TickVal: {tick_value} | "
            f"LossPerLot: ${price_loss_per_lot:.2f} | CommPerLot: ${commission_per_lot:.2f} | Step: {step}"
        )
        return lots

    def get_closed_candles(self, symbol: str, timeframe_str: str, count: int = 50) -> List[Dict[str, Any]]:
        """Gets closed candle history (excluding incomplete current candle)."""
        resolved = self.resolve_symbol(symbol)
        tf = TIMEFRAME_MAP.get(timeframe_str.lower(), mt5.TIMEFRAME_M5)
        # Fetch count + 1 so we can discard the currently forming candle at index 0 or last
        rates = mt5.copy_rates_from_pos(resolved, tf, 1, count)
        if rates is None or len(rates) == 0:
            logger.warning(f"Failed to fetch rates for {symbol} (resolved: {resolved})")
            return []

        candles = []
        for r in rates:
            candles.append({
                "time": int(r["time"]),
                "open": float(r["open"]),
                "high": float(r["high"]),
                "low": float(r["low"]),
                "close": float(r["close"]),
                "tick_volume": int(r["tick_volume"]),
                "spread": int(r["spread"]),
                "is_bull": float(r["close"]) >= float(r["open"]),
            })
        return candles

    def send_stop_order(
        self,
        symbol: str,
        side: str,  # "BUY" or "SELL"
        price: float,
        sl: float,
        tp: float,
        volume: float,
        magic: int,
        comment: str = "TesuBot"
    ) -> Optional[int]:
        """Places a BUY_STOP or SELL_STOP pending order."""
        resolved = self.resolve_symbol(symbol)
        sym_info = self.get_symbol_info(resolved)
        if not sym_info:
            return None

        digits = sym_info["digits"]
        order_type = mt5.ORDER_TYPE_BUY_STOP if side.upper() == "BUY" else mt5.ORDER_TYPE_SELL_STOP

        request = {
            "action": mt5.TRADE_ACTION_PENDING,
            "symbol": resolved,
            "volume": float(volume),
            "type": order_type,
            "price": round(price, digits),
            "sl": round(sl, digits),
            "tp": round(tp, digits),
            "deviation": 20,
            "magic": int(magic),
            "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_RETURN,
        }

        result = mt5.order_send(request)
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            logger.error(f"Order send failed ({side} STOP at {price}): {result.retcode if result else mt5.last_error()} - {result.comment if result else ''}")
            return None

        logger.info(f"Order placed successfully: Ticket #{result.order} | {side} STOP at {price} SL={sl} TP={tp} Vol={volume}")
        return result.order

    def modify_order(self, ticket: int, price: float, sl: float, tp: float, symbol: str) -> bool:
        """Modifies pending order price, SL, and TP."""
        sym_info = self.get_symbol_info(symbol)
        digits = sym_info["digits"] if sym_info else 5

        request = {
            "action": mt5.TRADE_ACTION_MODIFY,
            "order": int(ticket),
            "price": round(price, digits),
            "sl": round(sl, digits),
            "tp": round(tp, digits),
            "type_time": mt5.ORDER_TIME_GTC,
        }
        result = mt5.order_send(request)
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            logger.error(f"Modify order #{ticket} failed: {result.retcode if result else mt5.last_error()} - {result.comment if result else ''}")
            return False
        return True

    def modify_position_sl(self, ticket: int, sl: float, symbol: str) -> bool:
        """Modifies Stop Loss of an open active position (Breakeven / Trailing)."""
        position = mt5.positions_get(ticket=ticket)
        if not position:
            return False

        pos = position[0]
        sym_info = self.get_symbol_info(symbol)
        digits = sym_info["digits"] if sym_info else 5

        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "position": int(ticket),
            "sl": round(sl, digits),
            "tp": pos.tp,
        }
        result = mt5.order_send(request)
        return result is not None and result.retcode == mt5.TRADE_RETCODE_DONE

    def cancel_order(self, ticket: int) -> bool:
        """Cancels a pending order."""
        request = {
            "action": mt5.TRADE_ACTION_REMOVE,
            "order": int(ticket),
        }
        result = mt5.order_send(request)
        return result is not None and result.retcode == mt5.TRADE_RETCODE_DONE

    def close_position(self, ticket: int) -> bool:
        """Closes an open position at current market price."""
        position = mt5.positions_get(ticket=ticket)
        if not position:
            return False
        pos = position[0]
        symbol = pos.symbol
        sym_info = self.get_symbol_info(symbol)
        tick = mt5.symbol_info_tick(symbol)
        if not tick or not sym_info:
            return False

        order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
        price = tick.bid if order_type == mt5.ORDER_TYPE_SELL else tick.ask

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": int(ticket),
            "symbol": symbol,
            "volume": pos.volume,
            "type": order_type,
            "price": price,
            "deviation": 20,
            "magic": pos.magic,
            "comment": "TesuBot Close",
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        result = mt5.order_send(request)
        return result is not None and result.retcode == mt5.TRADE_RETCODE_DONE

    def get_all_open_positions(self) -> List[Dict[str, Any]]:
        """Returns all open positions with full details for UI dashboard."""
        if not self.is_connected and not self.connect():
            return []
        positions = mt5.positions_get()
        if not positions:
            return []
        
        result = []
        for p in positions:
            side = "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL"
            result.append({
                "ticket": p.ticket,
                "time": datetime.datetime.fromtimestamp(p.time).strftime("%Y-%m-%d %H:%M:%S"),
                "symbol": p.symbol,
                "type": side,
                "volume": float(p.volume),
                "price_open": float(p.price_open),
                "price_current": float(p.price_current),
                "sl": float(p.sl),
                "tp": float(p.tp),
                "profit": round(float(p.profit), 2),
                "swap": round(float(p.swap), 2),
                "magic": int(p.magic),
                "comment": str(p.comment or "")
            })
        return result

    def get_open_positions_by_magic(self, magic: int) -> List[Any]:
        """Returns list of open positions matching magic number."""
        positions = mt5.positions_get()
        if not positions:
            return []
        return [p for p in positions if p.magic == magic]

    def get_pending_orders_by_magic(self, magic: int) -> List[Any]:
        """Returns list of active pending orders matching magic number."""
        orders = mt5.orders_get()
        if not orders:
            return []
        return [o for o in orders if o.magic == magic]

    def get_history_deals(self, from_date: Any, to_date: Any) -> List[Any]:
        """Gets closed deal history within date range."""
        deals = mt5.history_deals_get(from_date, to_date)
        if not deals:
            return []
        return list(deals)

    def close_all_bot_trades(self, magic: int):
        """Emergency Close: Closes all positions and deletes pending orders matching magic number."""
        orders = mt5.orders_get()
        if orders:
            for o in orders:
                if o.magic == magic:
                    self.cancel_order(o.ticket)

        positions = mt5.positions_get()
        if positions:
            for p in positions:
                if p.magic == magic:
                    self.close_position(p.ticket)

    def get_full_trading_report(self, days: int = 30) -> Dict[str, Any]:
        """
        Extracts comprehensive MT5 deal & order history and calculates professional analytics
        (Win rate, profit factor, total trades, net profit, drawdown, best/worst trade, symbol breakdowns).
        """
        if not self.is_connected:
            return {"error": "MT5 not connected"}

        # Ensure to_date covers broker server time (brokers in EET/EEST can be hours ahead of local time)
        # Adding 1 full day guarantees all recent and today's real-time closed deals are included
        now_dt = datetime.datetime.now()
        to_date = now_dt + datetime.timedelta(days=1)
        from_date = now_dt - datetime.timedelta(days=days)
        deals = mt5.history_deals_get(from_date, to_date)
        if not deals:
            return {
                "period_days": days,
                "total_trades": 0,
                "net_profit": 0.0,
                "gross_profit": 0.0,
                "gross_loss": 0.0,
                "profit_factor": 0.0,
                "win_rate": 0.0,
                "wins": 0,
                "losses": 0,
                "total_commission": 0.0,
                "total_swap": 0.0,
                "deals": []
            }

        out_deals = []
        gross_profit = 0.0
        gross_loss = 0.0
        total_comm = 0.0
        total_swap = 0.0
        wins = 0
        losses = 0
        symbol_stats: Dict[str, Dict[str, Any]] = {}

        for d in deals:
            # We filter for out deals (entry == 1) or in/out to get actual trades
            # entry: 0=IN, 1=OUT, 2=IN/OUT
            total_comm += float(d.commission or 0.0)
            total_swap += float(d.swap or 0.0)

            if d.entry == 1:  # trade exit
                profit = float(d.profit)
                pnl = profit + float(d.commission or 0.0) + float(d.swap or 0.0)
                if profit > 0:
                    gross_profit += profit
                    wins += 1
                elif profit < 0:
                    gross_loss += abs(profit)
                    losses += 1

                sym = d.symbol
                if sym not in symbol_stats:
                    symbol_stats[sym] = {"trades": 0, "profit": 0.0, "wins": 0, "volume": 0.0}
                symbol_stats[sym]["trades"] += 1
                symbol_stats[sym]["profit"] = round(symbol_stats[sym]["profit"] + pnl, 2)
                symbol_stats[sym]["volume"] = round(symbol_stats[sym]["volume"] + float(d.volume), 2)
                if profit > 0:
                    symbol_stats[sym]["wins"] += 1

                deal_time_str = datetime.datetime.fromtimestamp(d.time).strftime("%Y-%m-%d %H:%M:%S")
                # MT5 deal type: 0=DEAL_TYPE_BUY, 1=DEAL_TYPE_SELL.
                # Notice: for an exit deal (entry==1), a BUY position is closed with a SELL deal (d.type==1).
                # Therefore, the original trade direction is the opposite of the exit deal type!
                trade_direction = "BUY" if d.type == 1 else "SELL"
                out_deals.append({
                    "ticket": d.ticket,
                    "order": d.order,
                    "position_id": d.position_id,
                    "time": deal_time_str,
                    "symbol": d.symbol,
                    "type": trade_direction,
                    "volume": float(d.volume),
                    "price": float(d.price),
                    "profit": round(profit, 2),
                    "commission": round(float(d.commission or 0.0), 2),
                    "swap": round(float(d.swap or 0.0), 2),
                    "net_pnl": round(pnl, 2),
                    "comment": str(d.comment or "")
                })

        total_trades = wins + losses
        win_rate = round((wins / total_trades * 100), 1) if total_trades > 0 else 0.0
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (99.9 if gross_profit > 0 else 0.0)
        net_profit = round(gross_profit - gross_loss + total_comm + total_swap, 2)

        return {
            "period_days": days,
            "total_trades": total_trades,
            "net_profit": net_profit,
            "gross_profit": round(gross_profit, 2),
            "gross_loss": round(gross_loss, 2),
            "profit_factor": profit_factor,
            "win_rate": win_rate,
            "wins": wins,
            "losses": losses,
            "total_commission": round(total_comm, 2),
            "total_swap": round(total_swap, 2),
            "symbols": symbol_stats,
            "deals": sorted(out_deals, key=lambda x: x["time"], reverse=True)
        }
