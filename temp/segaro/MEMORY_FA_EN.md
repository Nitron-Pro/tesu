# Segaro saved memory (2026-09-30)

## Preferences
- Speak Persian (Farsi). Number every question.
- White candle = bullish. Signals only, no trading. The method is separate from the power-line bots.

## Method rules (SELL; BUY is the mirror)
- On a command, A = the high of the latest closed candle. ATR14 (same TF) is taken at A and re-taken on every A reset.
- A break of A, even by a wick, makes that high the new A and restarts the process.
- Wait for red candle(s). If the candle that made A is itself red, it counts as the pullback.
- On the first white candle after that: sell stop = its low - 0.1xATR14, SL = its high, TP = 1:2 (temporary).
- Not triggered and a new white candle forms without breaking A: move the stop under its low; SL = the higher of the current SL and the new candle's high.
- A wick above the SL but not above A raises the SL to that high.
- Once triggered, the entry counts even if the same candle breaks A. My job with that position is done.
- If the lowest low since A reaches A - 5xATR14 with no entry: announce no entry.
- By default the process continues even after a stop-out. Cancel or stop conditions come with each command.
- دبل (double) = 2 positions per entry (1:1 + main target). دوگانه/سه‌گانه (chain 2/3) = the filled entry's SL becomes the new A and the process repeats. دوگانه دبل = 4 positions.

## Structure
- Core /workspace/pullback_core (owned by Segaro, read-only; owner_unlock.sh / owner_lock.sh).
- Copies: /workspace/pullback_bots/<bot>/config.json. teso2 = EURUSD FOREXCOM 5m, chain 2, single, TP 1:2.
- Data: TradingView anonymous websocket, FOREXCOM:EURUSD.
- Standing rule (from teso2): check every 5 minutes and send ENTRY/MOVE/CANCEL to Trador immediately.
