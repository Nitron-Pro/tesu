NOTE (2026-09-29): LEGACY. engine/tvfeed/common are thin wrappers over /workspace/pullback_core (owned by Segaro).
New bots: use /workspace/pullback_core/run_bot.py with /workspace/pullback_bots/<bot>/config.json (see BOT_GUIDE.md).

Pullback stop-entry signal engine (signals only, never trades). Data: TradingView websocket, no login (private tvfeed.py copy).
Files: engine.py (state machine), replay.py (history + PNG), live.py (poll each close, jsonl + optional webhook),
       common.py (fetch/format/chart/webhook), test_engine.py (synthetic rule tests), charts/, state/<run_id>.jsonl|.log
Replay:  python3 replay.py EURUSD SELL 3 --start '2026-09-29 12:00' [--double] [--chain N] [--rr 2] [--buffer 0.1]
         [--cancel-atr 5] [--sl-mode white|max] [--chart PATH|--no-chart] [--json] [--dump-bars]
Live:    nohup python3 live.py EURUSD SELL 3 --double --chain 2 --until '2026-09-29 23:00' > state/live.out 2>&1 &
Webhook: create webhook.env with WEBHOOK_URL=... and WEBHOOK_KEY=... (Bearer). Absent -> events are only logged.
Tests:   python3 test_engine.py

Rules (SELL; BUY mirror). Closed candles only. white = bullish, red = bearish, doji = neither.
 1 A = high of the order-time candle; ATR14 (Wilder, same TF) at that candle; recomputed on every A reset.
 2 high > A -> new A, pending cancelled, restart.
 3 wait for >= 1 red candle after A.
 3b (2026-09-29) if the candle that sets A (start, A_reset) is itself RED (BUY: WHITE candle making the low), it counts as
    the red move -> the very next white places the stop. Chain legs: counts if the candle that made the SL level is red
    OR the trigger candle is red; otherwise wait for a red after the trigger candle.
 4 first white after the red(s): SELL STOP = white.low - buffer*ATR, SL = white.high, TP = entry - RR*(SL-entry).
 5 pending + new white: STOP -> new white.low - buffer*ATR; SL -> max(SL, white.high)  [default --sl-mode max;
    --sl-mode white = exactly the new white's high].
 6 pending + any candle high > SL (<= A): SL -> that high. TP recomputed on every change.
 7 low <= STOP -> filled at the STOP price (entry counts even if the same candle also hit SL/A: info note only;
    positions are not tracked after the fill).
 8 lowest low of candles after A <= A - 5*ATR (--cancel-atr) without entry -> no_entry.
 --double: 2 positions per entry (TP 1:1 and 1:RR). --chain N: after a fill, the fill's SL becomes the new A (fresh ATR at
 the trigger candle) until N entries. double + chain 2 = 4 positions.
