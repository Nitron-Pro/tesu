"""
Tesu Engine Main Server
Manages multiple running bot instances, monitors MT5 ticks in real-time,
enforces risk rules (daily drawdown, working hours, auto close, risk-free trailing),
and communicates via ultra-fast local WebSocket with the Nora/Tauri Frontend.
"""

import asyncio
import json
import logging
import datetime
import os
from typing import Dict, Any, Set, Optional
import websockets

from mt5_bridge import MT5Bridge
from pullback_engine import PullbackStrategyInstance, calculate_atr14
from telegram_bot import TelegramNotifier

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TesuServer")

WS_HOST = "127.0.0.1"
WS_PORT = 9182

class TesuManager:
    def __init__(self):
        self.bridge = MT5Bridge()
        self.bots: Dict[str, PullbackStrategyInstance] = {}
        self.archived_bots: Dict[str, Dict[str, Any]] = {}
        self.connected_clients: Set[Any] = set()
        self.running = True
        self.accounts_config: list = []
        self.magic_base = 88000
        # Generate dynamic initial magic based on current timestamp to guarantee absolute uniqueness across runs
        self.next_magic = 88000 + (int(datetime.datetime.now().timestamp()) % 100000) * 10
        self.telegram: TelegramNotifier = TelegramNotifier(
            token=os.environ.get("TELEGRAM_BOT_TOKEN", ""),
            chat_id=os.environ.get("TELEGRAM_CHAT_ID", ""),
            on_command_callback=self.handle_external_command
        )

    async def handle_external_command(self, data: Dict[str, Any]) -> Any:
        action = data.get("action")
        if action == "START_BOT":
            await self.start_bot_instance(data)
        elif action == "STOP_ALL":
            for bid in list(self.bots.keys()):
                self.stop_bot_instance(bid)
        elif action == "START_PRESET":
            preset_code = data.get("preset_code", "").upper().strip()
            side = data.get("side", "BUY").upper()
            # Find preset in saved presets
            presets_file = os.path.join(os.path.dirname(__file__), "presets.json")
            if os.path.exists(presets_file):
                try:
                    with open(presets_file, "r", encoding="utf-8") as f:
                        saved_presets = json.load(f)
                        for p in saved_presets:
                            if p.get("code", "").upper() == preset_code:
                                bot_cfg = {
                                    "symbol": p.get("symbol", "XAUUSD"),
                                    "side": side,
                                    "timeframe": p.get("timeframe", "1m"),
                                    "risk_usd": float(p.get("riskUsd", 20.0)),
                                    "rr_ratio": float(p.get("rrRatio", 2.0)),
                                    "double": bool(p.get("isDouble", False)),
                                    "max_open_positions": int(p.get("maxOpenPositions", 0)),
                                    "martingale_enabled": bool(p.get("martingaleEnabled", False)),
                                    "martingale_step_pct": float(p.get("martingaleStepPct", 10.0)),
                                }
                                await self.start_bot_instance(bot_cfg)
                                return f"✅ ربات با پریست <b>{p.get('name')}</b> ({preset_code}) برای جهت <b>{side}</b> فعال شد."
                except Exception as e:
                    logger.error(f"Error loading preset {preset_code}: {e}")
            return f"❌ پریست با کد {preset_code} یافت نشد."
        elif action == "LIST_PRESETS":
            presets_file = os.path.join(os.path.dirname(__file__), "presets.json")
            if os.path.exists(presets_file):
                try:
                    with open(presets_file, "r", encoding="utf-8") as f:
                        saved_presets = json.load(f)
                        if saved_presets:
                            lines = ["📋 <b>لیست پریست‌های ذخیره شده:</b>"]
                            for p in saved_presets:
                                lines.append(
                                    f"• کد: <code>{p.get('code')}</code> | نام: {p.get('name')}\n"
                                    f"  نماد: {p.get('symbol')} | ریسک: {p.get('riskUsd')}$ | دبل: {'بله' if p.get('isDouble') else 'خیر'}\n"
                                    f"  دستور اجرا: <code>/run {p.get('code')} BUY</code> یا <code>SELL</code>"
                                )
                            return "\n\n".join(lines)
                except Exception as e:
                    logger.error(f"Error reading presets: {e}")
            return "هنوز پریستی ذخیره نشده است."
        elif action == "GET_STATUS":
            acc = self.bridge.get_account_summary()
            if not acc:
                return "❌ عدم ارتباط با MT5"
            active = [b for b in self.bots.values() if b.state not in ["FINISHED", "CANCELLED"]]
            open_orders = 0
            for b in active:
                magic = b.config.get("magic", self.magic_base)
                open_orders += len(self.bridge.get_open_positions_by_magic(magic))
            return (
                f"📊 <b>وضعیت اتصال و حساب متاتریدر ۵:</b>\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"کارگزاری (Company): <b>{acc.get('company')}</b>\n"
                f"سرور متاتریدر: <code>{acc.get('server')}</code>\n"
                f"شماره حساب (Login): <code>{acc.get('login')}</code>\n"
                f"موجودی (Balance): <b>${acc['balance']:.2f} {acc.get('currency')}</b>\n"
                f"ارزش ویژه (Equity): <b>${acc['equity']:.2f}</b>\n"
                f"سود/زیان باز: <b>{'+' if acc['profit'] >= 0 else ''}${acc['profit']:.2f}</b>\n"
                f"مارجین آزاد: <b>${acc.get('margin_free', 0):.2f}</b>\n"
                f"سطح مارجین: <b>{acc.get('margin_level', 0):.0f}%</b>\n"
                f"ربات‌های فعال: <b>{len(active)}</b> عدد\n"
                f"پوزیشن‌های باز: <b>{open_orders}</b> عدد"
            )
        elif action == "GET_SYMBOLS_SUMMARY":
            symbols = self.bridge.get_all_symbols()
            if not symbols:
                return "❌ نمادی دریافت نشد یا متاتریدر متصل نیست."
            acc = self.bridge.get_account_summary()
            broker_name = acc.get("company", "MT5") if acc else "MT5"
            top_symbols = [s["name"] for s in symbols[:35]]
            return (
                f"🏛 <b>نمادهای فعال در کارگزاری {broker_name}:</b>\n"
                f"تعداد کل نمادها: <b>{len(symbols)}</b> نماد\n\n"
                f"نمادهای پرمعامله:\n<code>{', '.join(top_symbols)}</code>\n\n"
                f"<i>برای شروع ترید از دستور <code>/buy</code>، <code>/sell</code> یا <code>/run [کد]</code> استفاده کنید.</i>"
            )

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts JSON payload to all connected Tauri UI clients."""
        if not self.connected_clients:
            return
        payload = json.dumps(message)
        dead_clients = set()
        for client in self.connected_clients:
            try:
                await client.send(payload)
            except Exception:
                dead_clients.add(client)
        self.connected_clients.difference_update(dead_clients)

    async def handle_client(self, websocket: Any):
        """Handles incoming IPC messages from Tauri frontend."""
        self.connected_clients.add(websocket)
        logger.info(f"Frontend client connected: {websocket.remote_address}")
        try:
            # Send initial state
            symbols_list = self.bridge.get_all_symbols() if self.bridge.is_connected else []
            open_pos = self.bridge.get_all_open_positions() if self.bridge.is_connected else []
            await websocket.send(json.dumps({
                "type": "INIT_STATE",
                "connected_to_mt5": self.bridge.is_connected,
                "account": self.bridge.get_account_summary(),
                "symbols": symbols_list,
                "bots": {bid: self.serialize_bot(bot) for bid, bot in self.bots.items()},
                "archived_bots": self.archived_bots,
                "open_positions": open_pos
            }))

            async for msg_str in websocket:
                try:
                    data = json.loads(msg_str)
                    cmd = data.get("action")
                    logger.info(f"Received UI Command: {cmd} with payload: {data}")
                    await self.dispatch_command(cmd, data, websocket)
                except Exception as e:
                    logger.error(f"Error handling message: {e}", exc_info=True)
                    await websocket.send(json.dumps({"type": "ERROR", "message": str(e)}))
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.connected_clients.discard(websocket)
            logger.info("Frontend client disconnected")

    async def periodic_telegram_reporter(self):
        """Sends periodic trading reports and status to Telegram every 5 minutes."""
        while self.running:
            try:
                await asyncio.sleep(300) # every 5 minutes
                if self.telegram.token and self.telegram.chat_id and self.bridge.is_connected:
                    acc = self.bridge.get_account_summary()
                    if acc:
                        active = [b for b in self.bots.values() if b.state not in ["FINISHED", "CANCELLED"]]
                        open_orders = 0
                        for b in active:
                            magic = b.config.get("magic", self.magic_base)
                            pos = self.bridge.get_open_positions_by_magic(magic)
                            open_orders += len(pos)

                        report_msg = (
                            f"⏱ <b>گزارش دوره‌ای سیستم ترید (Tesu):</b>\n"
                            f"━━━━━━━━━━━━━━━━━━\n"
                            f"کارگزاری/سرور: <code>{acc['server']}</code>\n"
                            f"حساب: <code>{acc['login']}</code>\n"
                            f"موجودی (Balance): <b>${acc['balance']:.2f}</b>\n"
                            f"اکوئیتی (Equity): <b>${acc['equity']:.2f}</b>\n"
                            f"سود شناور (Floating): <b>{'+' if acc['profit'] >= 0 else ''}${acc['profit']:.2f}</b>\n"
                            f"ربات‌های فعال: <b>{len(active)}</b> عدد\n"
                            f"پوزیشن‌های باز در بازار: <b>{open_orders}</b> عدد"
                        )
                        await self.telegram.send_message(report_msg)
            except Exception as e:
                logger.error(f"Error in periodic telegram reporter: {e}")
                await asyncio.sleep(30)

    def serialize_bot(self, bot: PullbackStrategyInstance) -> Dict[str, Any]:
        magic = bot.config.get("magic", self.magic_base)
        open_pos = self.bridge.get_open_positions_by_magic(magic) if self.bridge.is_connected else []
        
        # Calculate bot performance strictly from deals that belong to this bot's lifetime and magic
        start_time = bot.start_time if hasattr(bot, "start_time") else (datetime.datetime.now() - datetime.timedelta(days=1))
        now_dt = datetime.datetime.now()
        deals = self.bridge.get_history_deals(start_time - datetime.timedelta(minutes=5), now_dt + datetime.timedelta(days=1)) if self.bridge.is_connected else []
        
        # Filter strictly by this bot's unique magic number and exit deal (entry == 1)
        bot_deals = [d for d in deals if d.magic == magic and d.entry == 1]
        # Sort deals chronologically
        bot_deals_sorted = sorted(bot_deals, key=lambda x: x.time)
        
        equity_curve = [0.0]
        cumulative = 0.0
        deals_list = []
        for d in bot_deals_sorted:
            pnl = float(d.profit) + float(d.commission or 0.0) + float(d.swap or 0.0)
            cumulative = round(cumulative + pnl, 2)
            equity_curve.append(cumulative)
            deals_list.append({
                "ticket": d.ticket,
                "time": datetime.datetime.fromtimestamp(d.time).strftime("%H:%M:%S"),
                "symbol": d.symbol,
                "profit": round(float(d.profit), 2),
                "commission": round(float(d.commission or 0.0), 2),
                "net_pnl": round(pnl, 2),
                "volume": float(d.volume)
            })
        
        total_pnl = round(cumulative, 2)
        wins = sum(1 for d in bot_deals if d.profit > 0)
        losses = sum(1 for d in bot_deals if d.profit < 0)
        
        return {
            "bot_id": bot.bot_id,
            "magic": magic,
            "symbol": bot.symbol,
            "side": bot.side,
            "timeframe": bot.timeframe,
            "risk_usd": bot.current_risk_usd,
            "base_risk_usd": bot.base_risk_usd,
            "rr_ratio": bot.rr_ratio,
            "is_double": bot.is_double,
            "consecutive_losses": bot.consecutive_losses,
            "max_open_positions": bot.max_open_positions,
            "martingale_enabled": bot.martingale_enabled,
            "martingale_step_pct": bot.martingale_step_pct,
            "stop_above_price": bot.stop_above_price,
            "stop_below_price": bot.stop_below_price,
            "stop_reason": bot.stop_reason,
            "open_positions_count": len(open_pos),
            "state": bot.state,
            "A": bot.A,
            "atr14": bot.atr14,
            "pending_entry": bot.pending_entry,
            "pending_sl": bot.pending_sl,
            "pending_tp": bot.pending_tp,
            "pending_ticket": bot.pending_ticket,
            "pending_tickets": bot.pending_tickets,
            "position_ticket": bot.position_ticket,
            "events": bot.events if bot.events else [],
            "performance": {
                "trades_count": len(bot_deals),
                "wins": wins,
                "losses": losses,
                "win_rate": round((wins / len(bot_deals) * 100), 1) if bot_deals else 0.0,
                "total_pnl": total_pnl,
                "equity_curve": equity_curve,
                "deals": deals_list
            }
        }

    async def dispatch_command(self, cmd: str, data: Dict[str, Any], sender: Any):
        if cmd == "CONNECT_MT5":
            # Rule: When switching terminals/accounts, stop and cancel all active bots first
            active_bot_ids = list(self.bots.keys())
            if active_bot_ids:
                logger.info(f"Switching MT5 connection: Stopping {len(active_bot_ids)} active bot(s)...")
                for b_id in active_bot_ids:
                    b = self.bots[b_id]
                    b.state = "CANCELLED"
                    # Cancel pending orders if any
                    tickets = b.pending_tickets if b.pending_tickets else ([b.pending_ticket] if b.pending_ticket else [])
                    for t in tickets:
                        if t and self.bridge.is_connected:
                            self.bridge.cancel_order(t)
                    b.pending_ticket = None
                    b.pending_tickets = []
                    # Archive bot
                    serialized = self.serialize_bot(b)
                    self.archived_bots[b_id] = serialized
                    del self.bots[b_id]
                    await self.broadcast({
                        "type": "BOT_DELETED",
                        "bot_id": b_id,
                        "archived_bot": serialized
                    })

            # Disconnect current MT5 bridge if connected
            if self.bridge.is_connected:
                self.bridge.disconnect()

            path = data.get("path")
            login = data.get("login")
            pwd = data.get("password")
            server = data.get("server")
            self.bridge = MT5Bridge(terminal_path=path, login=login, password=pwd, server=server)
            success = self.bridge.connect()
            summary = self.bridge.get_account_summary() if success else None
            symbols_list = self.bridge.get_all_symbols() if success else []
            error_msg = self.bridge.last_error_message if not success else None
            await self.broadcast({
                "type": "MT5_STATUS",
                "connected": success,
                "account": summary,
                "symbols": symbols_list,
                "error": error_msg
            })

        elif cmd == "START_BOT":
            await self.start_bot_instance(data, sender)

        elif cmd == "STOP_BOT":
            bot_id = data.get("bot_id")
            self.stop_bot_instance(bot_id)

        elif cmd == "DELETE_BOT":
            bot_id = data.get("bot_id")
            if bot_id in self.bots:
                bot = self.bots[bot_id]
                bot.state = "CANCELLED"
                # Cancel all pending if any
                tickets = bot.pending_tickets if bot.pending_tickets else ([bot.pending_ticket] if bot.pending_ticket else [])
                for t in tickets:
                    if t:
                        self.bridge.cancel_order(t)
                bot.pending_ticket = None
                bot.pending_tickets = []
                # Close open positions if any
                magic = bot.config.get("magic", self.magic_base)
                self.bridge.close_all_bot_trades(magic)
                
                # Snapshot bot before removal for archive
                serialized = self.serialize_bot(bot)
                self.archived_bots[bot_id] = serialized
                
                # Remove from active bots dictionary
                del self.bots[bot_id]
                logger.info(f"Bot {bot_id} cancelled and archived.")
                await self.broadcast({
                    "type": "BOT_DELETED",
                    "bot_id": bot_id,
                    "archived_bot": serialized
                })

        elif cmd == "CLOSE_ALL":
            bot_id = data.get("bot_id")
            if bot_id in self.bots:
                bot = self.bots[bot_id]
                bot.state = "CANCELLED"
                magic = bot.config.get("magic", self.magic_base)
                self.bridge.close_all_bot_trades(magic)
                serialized = self.serialize_bot(bot)
                self.archived_bots[bot_id] = serialized
                del self.bots[bot_id]
                await self.broadcast({
                    "type": "BOT_DELETED",
                    "bot_id": bot_id,
                    "archived_bot": serialized
                })

        elif cmd == "CLOSE_OPEN_POSITION":
            ticket = data.get("ticket")
            if ticket:
                success = self.bridge.close_position(int(ticket))
                open_pos = self.bridge.get_all_open_positions()
                await self.broadcast({
                    "type": "POSITIONS_UPDATE",
                    "positions": open_pos
                })

        elif cmd == "CONFIG_TELEGRAM":
            token = data.get("token", "")
            chat_id = data.get("chat_id", "")
            self.telegram.token = token
            self.telegram.chat_id = chat_id
            self.telegram.api_url = f"https://api.telegram.org/bot{token}"
            if token and not self.telegram.running:
                asyncio.create_task(self.telegram.poll_updates())
            await self.broadcast({
                "type": "TELEGRAM_CONFIGURED",
                "configured": bool(token and chat_id)
            })

        elif cmd == "GET_SYMBOLS":
            symbols_list = self.bridge.get_all_symbols()
            await sender.send(json.dumps({
                "type": "SYMBOLS_DATA",
                "symbols": symbols_list
            }))

        elif cmd == "SYNC_PRESETS":
            presets_list = data.get("presets", [])
            presets_file = os.path.join(os.path.dirname(__file__), "presets.json")
            try:
                with open(presets_file, "w", encoding="utf-8") as f:
                    json.dump(presets_list, f, ensure_ascii=False, indent=2)
                logger.info(f"Synchronized {len(presets_list)} presets to presets.json")
            except Exception as e:
                logger.error(f"Failed to sync presets: {e}")

        elif cmd == "GET_OPEN_POSITIONS":
            open_pos = self.bridge.get_all_open_positions() if self.bridge.is_connected else []
            await sender.send(json.dumps({
                "type": "POSITIONS_UPDATE",
                "positions": open_pos
            }))

        elif cmd == "GET_REPORT":
            days = int(data.get("days", 30))
            report = self.bridge.get_full_trading_report(days=days)
            # Broadcast to all connected clients so active tabs and senders receive report data reliably
            await self.broadcast({
                "type": "REPORT_DATA",
                "report": report
            })

    async def start_bot_instance(self, data: Dict[str, Any], sender: Optional[Any] = None):
        bot_id = data.get("bot_id") or f"bot_{len(self.bots) + 1}_{int(asyncio.get_event_loop().time())}"
        data["magic"] = self.next_magic
        self.next_magic += 1
        bot = PullbackStrategyInstance(bot_id, data)
        # Resolve real broker symbol name (e.g. XAUUSD -> XAUUSD_o)
        real_symbol = self.bridge.resolve_symbol(bot.symbol)
        bot.symbol = real_symbol
        logger.info(f"Starting bot {bot_id} | Symbol: {real_symbol} | Side: {bot.side} | RiskUSD: {bot.current_risk_usd}$ | Double: {bot.is_double} | Magic: {data['magic']}")
        candles = self.bridge.get_closed_candles(real_symbol, bot.timeframe, count=30)
        if candles:
            atr = calculate_atr14(candles)
            bot.on_start(candles[-1], atr)
            self.bots[bot_id] = bot
            logger.info(f"Bot {bot_id} started on {real_symbol} with A={bot.A}, ATR={atr}, Magic={data['magic']}")
            await self.broadcast({
                "type": "BOT_STARTED",
                "bot": self.serialize_bot(bot)
            })
            if self.telegram.token:
                await self.telegram.send_message(
                    f"✅ <b>ربات {bot_id} فعال شد:</b>\n"
                    f"نماد: {bot.symbol} ({bot.side})\n"
                    f"نقطه A: {bot.A}\n"
                    f"ATR: {bot.atr14:.5f}\n"
                    f"ریسک: {bot.current_risk_usd}$"
                )
        else:
            logger.error(f"Could not fetch candle data for {bot.symbol} (real: {real_symbol})")
            if sender:
                await sender.send(json.dumps({
                    "type": "ERROR",
                    "message": f"Could not fetch candle data for {bot.symbol}"
                }))

    def stop_bot_instance(self, bot_id: str):
        if bot_id in self.bots:
            bot = self.bots[bot_id]
            bot.state = "CANCELLED"
            tickets = bot.pending_tickets if bot.pending_tickets else ([bot.pending_ticket] if bot.pending_ticket else [])
            for t in tickets:
                if t:
                    self.bridge.cancel_order(t)
            bot.pending_ticket = None
            bot.pending_tickets = []
            asyncio.create_task(self.broadcast({
                "type": "BOT_STOPPED",
                "bot_id": bot_id
            }))

    async def main_loop(self):
        """Ultra-fast background loop checking candle closes, order triggers, and risk management."""
        loop_counter = 0
        while self.running:
            try:
                loop_counter += 1
                if self.bridge.is_connected:
                    # Account metrics update
                    account = self.bridge.get_account_summary()
                    if account:
                        await self.broadcast({"type": "ACCOUNT_UPDATE", "account": account})

                    # Periodically (every ~2 seconds = 4 loops) broadcast all live open positions
                    if loop_counter % 4 == 0:
                        open_pos = self.bridge.get_all_open_positions()
                        await self.broadcast({
                            "type": "POSITIONS_UPDATE",
                            "positions": open_pos
                        })

                if self.bridge.is_connected and self.bots:

                    # Check each active bot
                    now_dt = datetime.datetime.now()
                    deals_history = self.bridge.get_history_deals(now_dt - datetime.timedelta(minutes=30), now_dt)

                    for bot_id, bot in list(self.bots.items()):
                        if bot.state in ["FINISHED", "CANCELLED"]:
                            continue

                        magic = bot.config.get("magic", self.magic_base)
                        open_positions = self.bridge.get_open_positions_by_magic(magic)

                        # Check closed deals to detect Loss or Target Hit for Martingale & Risk management
                        if deals_history:
                            for d in deals_history:
                                # entry == 1 means closing deal (out)
                                if d.magic == magic and d.entry == 1:
                                    deal_ticket = d.ticket
                                    if deal_ticket not in bot.processed_deals:
                                        bot.processed_deals.add(deal_ticket)
                                        # Profit < 0 => Loss
                                        if d.profit < 0:
                                            bot.on_trade_loss(d.position_id)
                                        elif d.profit > 0:
                                            bot.on_trade_target_hit(d.position_id, is_main_target=True)

                        # Check if pending order was filled (triggered) into an open position
                        all_pendings = bot.pending_tickets if bot.pending_tickets else ([bot.pending_ticket] if bot.pending_ticket else [])
                        if all_pendings:
                            active_pendings_in_mt5 = [o.ticket for o in self.bridge.get_pending_orders_by_magic(magic)]
                            # If none of the bot's pendings exist in MT5 anymore
                            any_still_pending = any(t in active_pendings_in_mt5 for t in all_pendings)
                            if not any_still_pending:
                                if open_positions:
                                    bot.state = "POSITION_ACTIVE"
                                    bot.pending_ticket = None
                                    bot.pending_tickets = []
                                    bot.log_event("ORDER_FILLED", {"open_positions": len(open_positions)})
                                    # Continue cycle: find new A and keep looking for next entry
                                    candles_curr = self.bridge.get_closed_candles(bot.symbol, bot.timeframe, count=15)
                                    if candles_curr:
                                        atr_curr = calculate_atr14(candles_curr)
                                        new_A = candles_curr[-1]["high"] if bot.side == "SELL" else candles_curr[-1]["low"]
                                        bot.restart_after_trigger(new_A, atr_curr)
                                        await self.broadcast({"type": "BOT_UPDATED", "bot": self.serialize_bot(bot)})
                                else:
                                    # Orders were cancelled or deleted manually
                                    bot.pending_ticket = None
                                    bot.pending_tickets = []

                        # Check working hours
                        work_hours = bot.config.get("working_hours")
                        if work_hours:
                            now_time = datetime.datetime.now().strftime("%H:%M")
                            start_h = work_hours.get("start", "00:00")
                            end_h = work_hours.get("end", "23:59")
                            if not (start_h <= now_time <= end_h):
                                continue

                        # Enforce Max Open Positions constraint
                        # In double mode, each entry creates 2 MT5 positions, so effective trades = len(open_positions) / 2
                        max_allowed_positions = bot.max_open_positions * 2 if bot.is_double else bot.max_open_positions
                        if bot.max_open_positions > 0 and len(open_positions) >= max_allowed_positions:
                            # Max concurrent positions reached, pause pending orders temporarily until a position closes
                            tickets = bot.pending_tickets if bot.pending_tickets else ([bot.pending_ticket] if bot.pending_ticket else [])
                            if tickets:
                                for t in tickets:
                                    if t:
                                        self.bridge.cancel_order(t)
                                bot.pending_ticket = None
                                bot.pending_tickets = []
                                bot.state = "WAITING_PULLBACK"
                                bot.log_event("PENDING_PAUSED_MAX_POSITIONS", {"open_count": len(open_positions), "max_positions": max_allowed_positions})
                                await self.broadcast({"type": "BOT_UPDATED", "bot": self.serialize_bot(bot)})
                            continue

                        # Fetch candles for new candle close detection
                        candles = self.bridge.get_closed_candles(bot.symbol, bot.timeframe, count=30)
                        if candles:
                            latest = candles[-1]
                            if latest["time"] > bot.last_candle_time:
                                atr = calculate_atr14(candles)
                                # Fetch live spread in price units
                                sym_info = self.bridge.get_symbol_info(bot.symbol)
                                spread_pts = sym_info["spread"] if sym_info else 0
                                pt = sym_info["point"] if sym_info else 0.01
                                spread_price = spread_pts * pt

                                action_req = bot.process_new_candle(latest, atr, spread_price=spread_price)
                                action_type = action_req.get("action")

                                if action_type == "PLACE_PENDING":
                                    entry = action_req["price"]
                                    sl = action_req["sl"]
                                    tp = action_req["tp"]
                                    side = action_req["side"]
                                    comm = bot.config.get("commission_per_lot", None)
                                    risk_to_use = bot.current_risk_usd

                                    if bot.is_double:
                                        # Double positions: 1:1 and Main target
                                        dist = abs(entry - sl)
                                        # To ensure 1:1 covers commission and yields true net profit = risk,
                                        # we expand tp1 and tp by the commission distance in price
                                        comm_rate = comm if (comm is not None and comm > 0) else self.bridge.get_auto_commission_per_lot(bot.symbol)
                                        sym_info = self.bridge.get_symbol_info(bot.symbol)
                                        tick_size = sym_info["trade_tick_size"] if sym_info and sym_info["trade_tick_size"] else 0.01
                                        tick_val = sym_info["trade_tick_value"] if sym_info and sym_info["trade_tick_value"] else 1.0
                                        # Price offset required to pay for round-trip commission
                                        comm_price_offset = (comm_rate * tick_size / tick_val) if tick_val > 0 else 0.0

                                        # Target 1:1 covers loss distance + commission
                                        target1_dist = dist + comm_price_offset
                                        target2_dist = (dist * bot.rr_ratio) + comm_price_offset

                                        tp1 = entry - target1_dist if side == "SELL" else entry + target1_dist
                                        tp2 = entry - target2_dist if side == "SELL" else entry + target2_dist

                                        lots_half = self.bridge.calculate_lot_size(bot.symbol, risk_to_use / 2.0, entry, sl, commission_per_lot=comm)

                                        t1 = self.bridge.send_stop_order(bot.symbol, side, entry, sl, tp1, lots_half, magic, comment=f"Tesu_{bot.bot_id}_1")
                                        t2 = self.bridge.send_stop_order(bot.symbol, side, entry, sl, tp2, lots_half, magic, comment=f"Tesu_{bot.bot_id}_2")
                                        bot.pending_ticket = t2 or t1
                                        bot.pending_tickets = [t for t in [t1, t2] if t is not None]
                                        bot.log_event("DOUBLE_ORDER_PLACED", {"t1": t1, "t2": t2, "lots": lots_half, "risk": risk_to_use, "tp1": tp1, "tp2": tp2})
                                    else:
                                        # Single position: also add commission offset to TP so net gain matches full R
                                        comm_rate = comm if (comm is not None and comm > 0) else self.bridge.get_auto_commission_per_lot(bot.symbol)
                                        sym_info = self.bridge.get_symbol_info(bot.symbol)
                                        tick_size = sym_info["trade_tick_size"] if sym_info and sym_info["trade_tick_size"] else 0.01
                                        tick_val = sym_info["trade_tick_value"] if sym_info and sym_info["trade_tick_value"] else 1.0
                                        comm_price_offset = (comm_rate * tick_size / tick_val) if tick_val > 0 else 0.0

                                        dist = abs(entry - sl)
                                        target_dist = (dist * bot.rr_ratio) + comm_price_offset
                                        adjusted_tp = entry - target_dist if side == "SELL" else entry + target_dist

                                        lots = self.bridge.calculate_lot_size(bot.symbol, risk_to_use, entry, sl, commission_per_lot=comm)
                                        ticket = self.bridge.send_stop_order(
                                            symbol=bot.symbol,
                                            side=side,
                                            price=entry,
                                            sl=sl,
                                            tp=adjusted_tp,
                                            volume=lots,
                                            magic=magic,
                                            comment=f"Tesu_{bot.bot_id}"
                                        )
                                        if ticket:
                                            bot.pending_ticket = ticket
                                            bot.pending_tickets = [ticket]
                                            bot.log_event("ORDER_PLACED", {"ticket": ticket, "lots": lots, "entry": entry, "sl": sl, "tp": adjusted_tp, "spread": spread_price, "commission": comm, "risk": risk_to_use})

                                elif action_type == "MOVE_PENDING":
                                    tickets_to_move = bot.pending_tickets if bot.pending_tickets else ([bot.pending_ticket] if bot.pending_ticket else [])
                                    entry = action_req["price"]
                                    sl = action_req["sl"]
                                    side = bot.side
                                    comm = bot.config.get("commission_per_lot", None)
                                    risk_to_use = bot.current_risk_usd

                                    if bot.is_double and len(tickets_to_move) >= 2:
                                        # Distinct recalculation of 1:1 TP and Main RR TP
                                        dist = abs(entry - sl)
                                        comm_rate = comm if (comm is not None and comm > 0) else self.bridge.get_auto_commission_per_lot(bot.symbol)
                                        sym_info = self.bridge.get_symbol_info(bot.symbol)
                                        tick_size = sym_info["trade_tick_size"] if sym_info and sym_info["trade_tick_size"] else 0.01
                                        tick_val = sym_info["trade_tick_value"] if sym_info and sym_info["trade_tick_value"] else 1.0
                                        comm_price_offset = (comm_rate * tick_size / tick_val) if tick_val > 0 else 0.0

                                        target1_dist = dist + comm_price_offset
                                        target2_dist = (dist * bot.rr_ratio) + comm_price_offset

                                        tp1 = entry - target1_dist if side == "SELL" else entry + target1_dist
                                        tp2 = entry - target2_dist if side == "SELL" else entry + target2_dist

                                        # Move t1 (1:1) and t2 (Main RR)
                                        t1 = tickets_to_move[0]
                                        t2 = tickets_to_move[1]
                                        res1 = self.bridge.modify_order(t1, entry, sl, tp1, bot.symbol)
                                        res2 = self.bridge.modify_order(t2, entry, sl, tp2, bot.symbol)
                                        if res1 or res2:
                                            bot.log_event("DOUBLE_ORDER_MODIFIED", {
                                                "t1": t1, "tp1": tp1,
                                                "t2": t2, "tp2": tp2,
                                                "entry": entry, "sl": sl
                                            })
                                    else:
                                        tp = action_req["tp"]
                                        for t in tickets_to_move:
                                            res = self.bridge.modify_order(t, entry, sl, tp, bot.symbol)
                                            if res:
                                                bot.log_event("ORDER_MODIFIED", {"ticket": t, "entry": entry, "sl": sl, "tp": tp})

                                elif action_type == "CANCEL_PENDING":
                                    tickets_to_cancel = action_req.get("tickets") or ([action_req.get("ticket")] if action_req.get("ticket") else [])
                                    if not tickets_to_cancel and bot.pending_tickets:
                                        tickets_to_cancel = list(bot.pending_tickets)
                                    for t in tickets_to_cancel:
                                        if t:
                                            self.bridge.cancel_order(t)
                                            bot.log_event("ORDER_CANCELLED", {"ticket": t, "reason": action_req.get("reason")})
                                    bot.pending_ticket = None
                                    bot.pending_tickets = []

                                elif action_type == "STOP_BOT":
                                    tickets_to_cancel = action_req.get("tickets") or []
                                    for t in tickets_to_cancel:
                                        if t:
                                            self.bridge.cancel_order(t)
                                    bot.pending_ticket = None
                                    bot.pending_tickets = []
                                    bot.state = "CANCELLED"
                                    bot.log_event("BOT_AUTO_STOPPED", {"reason": action_req.get("reason")})
                                    if self.telegram.token:
                                        asyncio.create_task(self.telegram.send_message(
                                            f"🛑 <b>ربات {bot.bot_id} متوقف شد:</b>\n"
                                            f"دلیل: رسیدن قیمت به حد تعیین شده ({action_req.get('reason')})"
                                        ))

                                await self.broadcast({
                                    "type": "BOT_UPDATED",
                                    "bot": self.serialize_bot(bot)
                                })

            except Exception as e:
                logger.error(f"Error in main loop: {e}", exc_info=True)

            # Polling delay: 500ms for ultra responsiveness without CPU overload
            await asyncio.sleep(0.5)

async def main():
    manager = TesuManager()
    # Try initial auto-connect to currently open MT5
    manager.bridge.connect()

    server = await websockets.serve(manager.handle_client, WS_HOST, WS_PORT)
    logger.info(f"Tesu Trading Engine WebSocket running on ws://{WS_HOST}:{WS_PORT}")
    
    await asyncio.gather(
        server.wait_closed(),
        manager.main_loop(),
        manager.periodic_telegram_reporter()
    )

if __name__ == "__main__":
    asyncio.run(main())
