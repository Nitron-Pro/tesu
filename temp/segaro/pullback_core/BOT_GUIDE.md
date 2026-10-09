# Pullback signal bots — guide for copy bots

> **OWNED BY SEGARO. Copy bots must never edit anything under `/workspace/pullback_core/`** (it is read-only on purpose).
> Your bot's only writable area is `/workspace/pullback_bots/<your-bot>/`. Signals only: nothing here ever places a trade.

## Layout
| Path | Owner | What |
|---|---|---|
| `/workspace/pullback_core/pullback_core/engine.py` | Segaro | detection rules (A, reset, rule 3b, pending place/move, SL max, trigger, no_entry, double/chain counting) |
| `/workspace/pullback_core/pullback_core/{feed,tvfeed,chart,fmt,webhook}.py` | Segaro | TradingView data (no login), charts, text lines, webhook |
| `/workspace/pullback_core/run_bot.py` | Segaro | the runner CLI you call |
| `/workspace/pullback_core/tests/test_engine.py` | Segaro | rule tests |
| `/workspace/pullback_bots/<bot>/config.json` | your bot | your policy (the ONLY file you edit) |
| `/workspace/pullback_bots/<bot>/runs/<run_id>/` | runner | `state.json` (full resumable state), `events.jsonl`, `run.log`, `lock` |
| `/workspace/pullback_bots/<bot>/charts/` | runner | replay charts |
| `/workspace/pullback_bots/<bot>/webhook.env` | your bot (optional) | `WEBHOOK_URL=...` / `WEBHOOK_KEY=...` (Bearer) → actionable events are POSTed as JSON |

Core updates by Segaro propagate automatically (the runner imports the core by path). Never copy core files into your bot dir.

## Commands (replace `teso2` with your bot name)
```bash
cd /workspace/pullback_core
# start a NEW live run (order time = now; A = last closed candle). Prints A_set + run_id, saves state, exits 0.
python3 run_bot.py --bot teso2 --side SELL live
# continue it: waits for candle closes, processes EVERY closed candle since the last one (no gaps),
# exits 0 right after the next actionable event. Relaunch the same command after handling each event.
python3 run_bot.py --bot teso2 live --resume SELL_5m_20260929-161232 [--max-wait 900]
# status of all runs / one run
python3 run_bot.py --bot teso2 status [RUN_ID]
# cancel a run (stops a running resume process, cancels any pending order, prints done)
python3 run_bot.py --bot teso2 cancel RUN_ID
# replay history from an order time (Tehran) + chart
python3 run_bot.py --bot teso2 --side BUY replay --start '2026-09-29 13:00' [--no-chart] [--json]
# one-off parameter change without editing config (new runs / replay only; a run's config is frozen at creation)
python3 run_bot.py --bot teso2 --side SELL --override tf=3 --override double=true --override chain=3 live
```
**Agent loop:** `live` (new) → read run_id → loop: `live --resume RUN_ID` → handle the printed event(s) → repeat
until an event with `"type": "done"` (or `no_entry`, which is always followed by `done`) or exit code 2.
Use `--max-wait SEC` if your tool calls have a time limit: exit code 4 = nothing happened yet, just resume again.
Only one process per run is allowed (a second resume gets exit code 2 "already running").

### Exit codes
| code | meaning |
|---|---|
| 0 | event(s) printed — read the JSON lines (also after `done`) |
| 1 | error (bad config/args, feed unavailable on a new run) |
| 2 | run not found / not active (finished, cancelled) / already running |
| 4 | `--max-wait` reached, no actionable event (JSON `{"type":"waiting",...}`) — resume again |

### Which events make `live` exit (config `exit_on`, default)
`A_set_start` (new run confirmation), `pending_placed`, `pending_moved`, `triggered`, `A_reset_cancel` (an A reset that
cancelled a pending order), `no_entry`, `done`, `feed_error`. Other events (A_reset with no pending order, chain-leg A_set
which is printed together with its `triggered`) are printed and logged but the run keeps going.

## Output
Every event = **one JSON line** (starts with `{`) followed by **one readable line** starting with `» ` (Persian when
`language` = `fa`, English when `en`). All events are also appended to `runs/<run_id>/events.jsonl`.

| field | meaning |
|---|---|
| `type` | `A_set`, `A_reset`, `pending_placed`, `pending_moved`, `triggered`, `no_entry`, `done`, `feed_error`, `waiting`, `status`, `error` |
| `symbol`, `side`, `tf` | e.g. `FOREXCOM:EURUSD`, `SELL`/`BUY`, `5m` |
| `leg` | chain leg (1..chain) |
| `candle_time_tehran` / `candle_close_tehran` / `candle_ts` | the candle that caused the event: open time (as TradingView labels it), close time, unix open |
| `A`, `atr` | current reference extreme and the ATR(14, Wilder, same TF) recorded when A was set |
| `entry`, `sl`, `tp` | current stop-entry price, stop loss, take-profit list (1 value; 2 when double: `[1:double_rr_first, 1:rr]`) |
| `pending_now` | the pending stop order after this event (`null` = none) |
| `previous_entry`, `previous_sl`, `reason` | on `pending_moved` |
| `previous_A`, `pending_cancelled`, `a_candle_counts_as_move` | on `A_reset` / `A_set` (rule 3b) |
| `fill_price`, `positions[]`, `entries_so_far`, `notes` | on `triggered`; `positions[]` = {entry, sl, tp, rr}; notes are info only |
| `reason` | on `done`: all entries triggered / no_entry / deadline / stopout / cancelled |
| `stale`, `catching_up_bars_left` | the event is from a candle older than 2 bars (resume after a pause) / more backlog candles follow |
| `run_id`, `bot`, `emitted_at` | bookkeeping (emitted_at in Tehran time) |

## Config (`/workspace/pullback_bots/<bot>/config.json`)
Edit it with any JSON editor; new runs pick it up (running runs keep their frozen copy). Keys starting with `_` are comments.
| key | default | meaning |
|---|---|---|
| `symbol` | `EURUSD` | `EURUSD` → `FOREXCOM:EURUSD`; or a full TradingView id |
| `tf` | `5` | minutes (`1`,`3`,`5`,`15`,`60`) or `1h`,`4h`,`D` |
| `double` | false | 2 positions per entry: TP at `double_rr_first` R and at `rr` R |
| `chain` | 1 | number of entries; after each fill its SL becomes the new A |
| `rr` | 2.0 | main target in R |
| `double_rr_first` | 1.0 | first target of a double entry |
| `buffer_atr` | 0.1 | stop entry offset beyond the pullback candle, in ATR |
| `cancel_atr` | 5.0 | no_entry when price runs this many ATR from A without an entry (0 = off) |
| `sl_mode` | `max` | `max`: new pullback candle can only raise (sell) / lower (buy) the SL; `white`: SL = new pullback candle's extreme |
| `atr_period` | 14 | ATR length |
| `max_minutes` | null | end the run (done, reason deadline) N minutes after the order time |
| `until` | null | `'YYYY-MM-DD HH:MM'` or `'HH:MM'` (Tehran) → end the run then |
| `stop_after_stopout` | false | chain: end the run if an already-filled position hits its SL before the next entry |
| `language` | `fa` | readable line language (`fa`/`en`) |
| `exit_on` | see above | which event kinds make `live` exit |
| `live_max_wait_s` | null | default for `--max-wait` |
| `webhook` | true | POST actionable events if `webhook.env` exists |
| `poll_first_delay`, `poll_retry`, `poll_giveup`, `feed_error_after_s` | 0.3, 0.5, 25, 180 | live polling timings (s) |
| `chart_on_replay`, `history_bars` | true, 400 | replay chart; bars fetched for ATR warm-up |

## Rules (summary; SELL — BUY is the exact mirror). Closed candles only; white = bullish, red = bearish.
1. A = high of the order-time candle; ATR recorded then (recomputed at every A reset). 2. A candle with high > A → new A,
pending cancelled. 3. Wait for ≥1 red candle after A; **3b**: if the candle that sets A is itself red, it counts (chain legs:
the SL candle or the trigger candle red). 4. First white after that → SELL STOP = white.low − buffer·ATR, SL = white.high,
TP = entry − rr·(SL − entry). 5. New white while pending → stop moves to its low − buffer; SL = max(SL, its high).
6. Any candle high above SL (≤ A) → SL up. 7. Candle low ≤ stop → filled at the stop. 8. Lowest low since A ≤ A − cancel_atr·ATR → no_entry.

## Owner (Segaro) only
`./owner_unlock.sh` → edit → `./owner_lock.sh` (runs the tests, refuses to lock if any fail).
