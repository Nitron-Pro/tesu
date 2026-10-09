"""
Telegram Bot Integration for Tesu Trader
Allows remote monitoring and instant trade execution from Telegram:
e.g. commands:
  /sell XAUUSD 10
  /buy EURUSD 20 5m
  /status
  /cancel bot_id
  /closeall
"""

import asyncio
import logging
import json
import urllib.request
import urllib.parse
from typing import Optional, Dict, Any, Callable

logger = logging.getLogger("TesuTelegram")

class TelegramNotifier:
    def __init__(self, token: str, chat_id: str, on_command_callback: Optional[Callable] = None):
        self.token = token.strip()
        self.chat_id = chat_id.strip()
        self.on_command = on_command_callback
        self.api_url = f"https://api.telegram.org/bot{self.token}"
        self.running = False
        self.last_update_id = 0

    def send_message_sync(self, text: str) -> bool:
        """Sends a Telegram message synchronously."""
        if not self.token or not self.chat_id:
            return False
        try:
            url = f"{self.api_url}/sendMessage"
            data = urllib.parse.urlencode({
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": "HTML"
            }).encode("utf-8")
            req = urllib.request.Request(url, data=data)
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status == 200
        except Exception as e:
            logger.error(f"Failed to send Telegram message: {e}")
            return False

    async def send_message(self, text: str):
        """Asynchronously dispatches Telegram message."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.send_message_sync, text)

    async def poll_updates(self):
        """Long-polling for user commands from Telegram."""
        if not self.token:
            return

        self.running = True
        logger.info("Telegram polling started...")

        while self.running:
            try:
                url = f"{self.api_url}/getUpdates?offset={self.last_update_id + 1}&timeout=20"
                req = urllib.request.Request(url)
                
                loop = asyncio.get_event_loop()
                def fetch():
                    try:
                        with urllib.request.urlopen(req, timeout=25) as response:
                            return json.loads(response.read().decode("utf-8"))
                    except Exception:
                        return None

                res = await loop.run_in_executor(None, fetch)
                if res and res.get("ok"):
                    for update in res.get("result", []):
                        self.last_update_id = update["update_id"]
                        msg = update.get("message")
                        if not msg:
                            continue

                        sender_chat = str(msg.get("chat", {}).get("id"))
                        # Security check: only allow commands from the configured chat_id
                        if sender_chat != self.chat_id:
                            continue

                        text = msg.get("text", "").strip()
                        if text and self.on_command:
                            await self.handle_telegram_command(text)

            except Exception as e:
                logger.error(f"Telegram polling error: {e}")
                await asyncio.sleep(5)

            await asyncio.sleep(1)

    async def handle_telegram_command(self, text: str):
        """Parses and executes telegram bot commands."""
        parts = text.split()
        cmd = parts[0].lower()

        # Examples:
        # /sell XAUUSD 10 5m
        # /buy EURUSD 15
        if cmd in ["/sell", "/buy"]:
            side = "SELL" if cmd == "/sell" else "BUY"
            symbol = parts[1].upper() if len(parts) > 1 else "XAUUSD"
            risk = float(parts[2]) if len(parts) > 2 else 10.0
            tf = parts[3].lower() if len(parts) > 3 else "5m"

            reply = f"🚀 <b>دستور ترید دریافت شد</b>\nنماد: {symbol}\nجهت: {side}\nریسک: {risk}$\nتایم‌فریم: {tf}"
            await self.send_message(reply)

            if self.on_command:
                await self.on_command({
                    "action": "START_BOT",
                    "symbol": symbol,
                    "side": side,
                    "risk_usd": risk,
                    "timeframe": tf,
                    "rr_ratio": 2.0,
                    "double": False
                })

        elif cmd in ["/status", "/account", "/info"]:
            if self.on_command:
                status_text = await self.on_command({"action": "GET_STATUS"})
                await self.send_message(status_text or "اطلاعاتی یافت نشد.")

        elif cmd in ["/symbols", "/pairs", "/market"]:
            if self.on_command:
                symbols_text = await self.on_command({"action": "GET_SYMBOLS_SUMMARY"})
                await self.send_message(symbols_text or "نمادی یافت نشد.")

        elif cmd in ["/presets", "/preset", "/list"]:
            if self.on_command:
                presets_text = await self.on_command({"action": "LIST_PRESETS"})
                await self.send_message(presets_text or "پریستی یافت نشد.")

        elif cmd in ["/run", "/preset_run"]:
            # e.g. /run P1 BUY or /run GOLD30 SELL
            if len(parts) >= 3:
                code = parts[1].upper()
                side = parts[2].upper()
                if side not in ["BUY", "SELL"]:
                    await self.send_message("❌ جهت معامله باید BUY یا SELL باشد.\nمثال: <code>/run P1 BUY</code>")
                elif self.on_command:
                    res_msg = await self.on_command({
                        "action": "START_PRESET",
                        "preset_code": code,
                        "side": side
                    })
                    await self.send_message(res_msg)
            else:
                await self.send_message("💡 روش استفاده:\n<code>/run [کد پریست] [BUY/SELL]</code>\nمثال: <code>/run P1 BUY</code>\nبرای مشاهده لیست کدها: <code>/presets</code>")

        elif cmd in ["/closeall", "/stop"]:
            if self.on_command:
                await self.on_command({"action": "STOP_ALL"})
                await self.send_message("🛑 تمام ربات‌ها و اردرهای معلق با موفقیت لغو شدند.")

        elif cmd in ["/help", "/start"]:
            help_text = (
                "🤖 <b>راهنمای ربات معاملاتی Tesu Trader:</b>\n"
                "━━━━━━━━━━━━━━━━━━\n"
                "📊 <b>وضعیت و اطلاعات حساب:</b>\n"
                "• <code>/status</code> یا <code>/account</code> : دریافت اطلاعات دقیق بروکر، موجودی، اکوئیتی و پوزیشن‌ها\n"
                "• <code>/symbols</code> : دریافت لیست نمادهای قابل معامله بروکر فعلی\n\n"
                "📋 <b>پریست‌ها و اجرای تنظیمات:</b>\n"
                "• <code>/presets</code> : نمایش پریست‌های ذخیره شده\n"
                "• <code>/run [کد] [BUY/SELL]</code> : اجرای فوری پریست (مثال: <code>/run P1 BUY</code>)\n\n"
                "⚡ <b>ترید سریع دستی:</b>\n"
                "• <code>/buy [نماد] [ریسک] [تایم]</code> (مثال: <code>/buy XAUUSD 30 1m</code>)\n"
                "• <code>/sell [نماد] [ریسک] [تایم]</code> (مثال: <code>/sell AUDUSD 20 5m</code>)\n\n"
                "🛑 <b>توقف اضطراری:</b>\n"
                "• <code>/stop</code> یا <code>/closeall</code> : لغو تمام اردرها و بستن معاملات"
            )
            await self.send_message(help_text)
