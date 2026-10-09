---
name: stop-entry-pullback-method
description: >-
  Use this when the user orders a sell (or buy) entry signal with their pullback
  stop-order method (سل استاپ زیر کندل سفید بعد از قرمزها), not the power-line
  method.
---
# Pullback stop-entry method (sell; buy is the exact mirror)

Signals only: never place trades. Once an entry triggers, that position is no longer our concern (only continue for chain legs).
Engine: /workspace/pullback_signal (replay.py for history tests with charts, live.py for live runs; data FOREXCOM:EURUSD via TradingView websocket). Default test TF: 5m.
White candle = bullish (green).

1. On "start sell", the high of the latest candle is the reference high (A). Record ATR14 (same TF) when A is set; recompute it every time A resets.
2. Any later candle whose high (wick counts) exceeds A: new A, process restarts (new ATR).
3. Wait for one or more consecutive red candles. If the candle that made A is itself red, it already counts as the pullback.
4. First white candle after the red(s): sell stop just below its low (buffer = 0.1 x ATR14, provisional). SL = its high.
5. Not triggered and a new white candle forms without breaking A: move the sell stop below the new white candle's low. SL = the higher of current SL and that candle's high.
6. Not triggered and any candle prints a high above current SL but not above A: move SL to that high.
7. TP 1:2 for now.
8. Lowest low since A reaches 5 x ATR14 (ATR at A) below A with no entry: announce "no entry" and stop.
9. If a candle triggers the entry and also breaks A, the entry counts.
10. Extra cancel conditions come with each order; default is continue.

Modifiers:
- دبل: each entry point gets two positions, TP 1:1 and TP at main target.
- دوگانه / سه‌گانه: after an entry triggers, its SL becomes the new A and the process repeats, for 2 or 3 entries total, same target. Continue even if an earlier one stops out.
- دوگانه دبل = 4 positions.

Buy: mirror everything.
Always number questions to the user; talk in Persian.
