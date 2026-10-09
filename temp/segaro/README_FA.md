# بکاپ Segaro (ساخت: ۳۰ سپتامبر ۲۰۲۶)

- pullback_core/ : هسته‌ی شناسایی روش پولبک استاپ (engine, feed, chart, run_bot.py, تست‌ها، BOT_GUIDE.md). برای بازگردانی به /workspace/pullback_core کپی کن و ./owner_lock.sh را اجرا کن.
- pullback_bots/ : تنظیمات و اجراهای کپی‌بات‌ها (teso2 = EURUSD، ۵ دقیقه، دوگانه، TP 1:2).
- pullback_signal/ و eurusd_feed/ : نسخه‌ی قدیمی و دریافت داده از TradingView (FOREXCOM:EURUSD).
- skill/stop-entry-pullback-method/SKILL.md : متن کامل قوانین روش.
- agents/segaro و agents/teso2 : پروفایل، تنظیمات و دیتابیس گفتگو/حافظه‌ی هر بات.
- MEMORY_FA_EN.md : حافظه‌ی ذخیره‌شده‌ی قوانین و ترجیحات.

اجرا: cd pullback_core && python3 run_bot.py --bot teso2 --side SELL live
