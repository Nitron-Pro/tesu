#!/usr/bin/env python3
"""Live pullback stop-entry signals (signals only, never trades).
usage: live.py SYMBOL SIDE TF [--double] [--chain N] [--rr 2] [--buffer 0.1] [--cancel-atr 5] [--sl-mode white|max]
               [--until 'YYYY-MM-DD HH:MM' (Tehran) | EPOCH] [--run-id ID]
 - order time = now: A is set from the LAST CLOSED candle at start.
 - polls right after every candle close (close + 0.3 s, quick retries every 0.5 s until the closed candle is there,
   gives up after 25 s -> market closed/quiet; after 3 such misses only one fetch per close), feeds CLOSED candles only.
 - every event -> state/<run_id>.jsonl (+ printed) and POSTed as JSON to WEBHOOK_URL in webhook.env (Bearer WEBHOOK_KEY)
   if that file exists (posting runs in a background thread so it never delays candle processing).
 - websocket errors are retried forever (1-5 s back-off); after 180 s of continuous failure a 'feed_error' event is emitted
   once (and 'feed_recovered' when data comes back).
 - exits after done / no_entry, at --until (emits done reason=until), or on SIGTERM/SIGINT (done reason=stopped)."""
import argparse, os, sys, time, json, signal, threading, queue, datetime
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import common as C
from engine import PullbackEngine, tstr

FIRST_DELAY, RETRY, FORMING_WAIT, GIVEUP, ERR_EVENT_AFTER = 0.3, 0.5, 1.0, 25.0, 180.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('symbol'); ap.add_argument('side', type=str.upper, choices=['BUY', 'SELL']); ap.add_argument('tf')
    ap.add_argument('--double', action='store_true'); ap.add_argument('--chain', type=int, default=1)
    ap.add_argument('--rr', type=float, default=2.0); ap.add_argument('--buffer', type=float, default=0.1)
    ap.add_argument('--cancel-atr', type=float, default=5.0); ap.add_argument('--sl-mode', choices=['white', 'max'], default='max')
    ap.add_argument('--until'); ap.add_argument('--run-id')
    ap.add_argument('--dec', type=int, help='output price decimals (default: auto = price digits + 1; e.g. 3 for JPY pairs)')
    a = ap.parse_args()
    tv = C.resolve(a.symbol); iv, tfs, lab = C.parse_tf(a.tf)
    until = float('inf')
    if a.until: until = float(a.until) if a.until.replace('.', '').isdigit() else C.parse_tehran(a.until)
    run_id = a.run_id or '%s_%s_%s_%s' % (tv.split(':')[-1], a.side, lab, datetime.datetime.now(C.TZ).strftime('%Y%m%d-%H%M%S'))
    os.makedirs(os.path.join(HERE, 'state'), exist_ok=True)
    jpath = os.path.join(HERE, 'state', run_id + '.jsonl'); lpath = os.path.join(HERE, 'state', run_id + '.log')
    logf = open(lpath, 'a')
    def log(*x):
        line = time.strftime('%H:%M:%S ') + ' '.join(str(v) for v in x)
        logf.write(line + '\n'); logf.flush(); sys.stderr.write(line + '\n'); sys.stderr.flush()

    # webhook poster thread (keeps event order)
    q = queue.Queue()
    def poster():
        while True:
            e = q.get()
            if e is None: q.task_done(); return
            st = C.post_webhook(e); log('webhook', e['type'], '->', st); q.task_done()
    th = threading.Thread(target=poster, daemon=True); th.start()

    dec = [5]
    def emit(e, post=True):
        e = dict(e); e['run_id'] = run_id; e['emitted_at'] = datetime.datetime.now(C.TZ).isoformat(timespec='seconds')
        with open(jpath, 'a') as f: f.write(json.dumps(e, ensure_ascii=False) + '\n')
        print(C.fmt_event(e, dec[0]) if 'leg' in e else json.dumps(e, ensure_ascii=False), flush=True)
        if post: q.put(e)

    def finish(code=0):
        q.put(None); th.join(timeout=60); log('exit'); sys.exit(code)

    eng = None; last_ev_bar = [None]
    def stop_handler(sig, frm):
        log('signal', sig)
        if eng is not None and not eng.finished and last_ev_bar[0] is not None:
            emit(eng._ev('done', last_ev_bar[0], reason='stopped (signal %d)' % sig, total_positions=len(eng.positions)))
        finish(0)
    signal.signal(signal.SIGTERM, stop_handler); signal.signal(signal.SIGINT, stop_handler)

    err = dict(since=None, reported=False)
    def fetch(n):
        """closed bars + forming ts; retries forever (returns None only if --until passed)."""
        delay = 1.0
        while True:
            try:
                raw_closed, forming = C.fetch_closed(tv, iv, tfs, n)
                if not raw_closed: raise RuntimeError('no bars')
                if err['reported']:
                    emit(dict(type='feed_recovered', symbol=tv, side=a.side, tf=lab, failing_for_s=round(time.time() - err['since'])))
                err.update(since=None, reported=False)
                return raw_closed, forming
            except Exception as ex:
                now = time.time(); err['since'] = err['since'] or now
                log('fetch error:', type(ex).__name__, ex)
                if not err['reported'] and now - err['since'] > ERR_EVENT_AFTER:
                    emit(dict(type='feed_error', symbol=tv, side=a.side, tf=lab, error='%s: %s' % (type(ex).__name__, ex),
                              failing_for_s=round(now - err['since']))); err['reported'] = True
                if now >= until: return None, None
                time.sleep(delay); delay = min(5.0, delay * 1.5)

    bars, _ = fetch(400)
    if bars is None: log('until reached before start'); finish(0)
    dec[0] = a.dec if a.dec is not None else C.decimals(bars[-1][4]) + 1
    eng = PullbackEngine(tv, a.side, lab, rr=a.rr, buffer=a.buffer, double=a.double, chain=a.chain, cancel_atr=a.cancel_atr,
                         sl_mode=a.sl_mode, tf_seconds=tfs, dec=dec[0])
    emit(dict(type='run_started', run_id=run_id, symbol=tv, side=a.side, tf=lab, rr=a.rr, buffer=a.buffer, double=a.double,
              chain=a.chain, cancel_atr=a.cancel_atr, sl_mode=a.sl_mode, until=None if until == float('inf') else tstr(until),
              pid=os.getpid()), post=False)
    for e in eng.start(bars): emit(e)
    last_ts = bars[-1][0]; last_ev_bar[0] = bars[-1]
    log('start %s %s %s: order-time candle %s, %d bars, jsonl %s' % (tv, a.side, lab, tstr(last_ts), len(bars), jpath))
    misses = 0
    while True:
        now = time.time()
        B = (int(now // tfs) + 1) * tfs if tfs <= 3600 else max(last_ts + 2 * tfs, now + 60)   # next expected close
        while B <= last_ts + tfs: B += tfs
        if B > until:
            if until > now: time.sleep(until - now)
            emit(eng._ev('done', last_ev_bar[0], reason='until reached', total_positions=len(eng.positions))); finish(0)
        time.sleep(max(0.0, B + FIRST_DELAY - time.time()))
        tries = 0; got = False
        while True:
            tries += 1
            need = min(5000, 60 + int((time.time() - last_ts) // tfs))
            bars, forming = fetch(max(100, need))
            if bars is None: break
            el = time.time() - B
            new = [b for b in bars if b[0] > last_ts]
            if new and (forming or el >= FORMING_WAIT):
                got = True; log('close %s: %d new closed bar(s) after %.2fs (try %d)' % (tstr(B), len(new), el, tries)); break
            if el >= GIVEUP or misses >= 3:
                if new: got = True
                break
            time.sleep(RETRY)
        if not got:
            misses += 1; log('no new closed candle for %s (market closed/quiet?) misses=%d' % (tstr(B), misses)); continue
        misses = 0
        for b in new:
            evs = eng.feed(b); last_ts = b[0]; last_ev_bar[0] = b
            for e in evs: emit(e)
            if eng.finished: finish(0)

if __name__ == '__main__':
    main()
