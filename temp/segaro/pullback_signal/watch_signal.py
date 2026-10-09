#!/usr/bin/env python3
"""Single-entry pullback stop-entry WATCH for any symbol, with extra signal-cancel conditions and Trador-format lines.
Signals only: never trades. Writes every Trador line to an outbox file (state/<run_id>.trador.jsonl, one JSON per line:
{"seq":n,"time_tehran":..,"line":"ENTRY | ..."}); the agent running the watch relays those lines to Trador.
usage: watch_signal.py SYMBOL SIDE TF --ref BASE [--base-stop P] [--h1-invalid P] [--dec N] [--rr 2] [--buffer 0.1]
                       [--cancel-atr 5] [--feed-dead 600] [--run-id ID]
 SYMBOL: AUDJPY -> FOREXCOM:AUDJPY, or full id (SAXO:XAUUSD). REF lines use the part after ':' (e.g. AUDJPY / XAUUSD).
 --dec default: 3 for JPY pairs, 2 for XAU, 5 otherwise.
 --base-stop: BUY -> any candle low < P before entry cancels; SELL -> any high > P.
 --h1-invalid: BUY -> a closed 1h candle with close < P cancels; SELL -> close > P.
 Order refs: <BASE>-1, then -2 ... after an A reset voids a pending order."""
import argparse, os, sys, time, json, datetime
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import common as C
from engine import PullbackEngine, tstr

def default_dec(tv):
    s = tv.split(':')[-1].upper()
    return 3 if 'JPY' in s else 2 if s.startswith('XAU') else 5

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('symbol'); ap.add_argument('side', type=str.upper, choices=['BUY', 'SELL']); ap.add_argument('tf')
    ap.add_argument('--ref', required=True); ap.add_argument('--base-stop', type=float); ap.add_argument('--h1-invalid', type=float)
    ap.add_argument('--dec', type=int); ap.add_argument('--rr', type=float, default=2.0); ap.add_argument('--buffer', type=float, default=0.1)
    ap.add_argument('--cancel-atr', type=float, default=5.0); ap.add_argument('--feed-dead', type=float, default=600)
    ap.add_argument('--run-id'); ap.add_argument('--chain', type=int, default=1)
    a = ap.parse_args()
    tv = C.resolve(a.symbol); iv, tfs, lab = C.parse_tf(a.tf); name = tv.split(':')[-1]
    dec = a.dec if a.dec is not None else default_dec(tv); buy = a.side == 'BUY'
    run_id = a.run_id or '%s_%s_%s_watch_%s' % (name, a.side, lab, datetime.datetime.now(C.TZ).strftime('%Y%m%d-%H%M%S'))
    os.makedirs(os.path.join(HERE, 'state'), exist_ok=True)
    base = os.path.join(HERE, 'state', run_id)
    logf = open(base + '.log', 'a'); evf = open(base + '.jsonl', 'a'); outf = open(base + '.trador.jsonl', 'a')
    def now_t(): return datetime.datetime.now(C.TZ).strftime('%Y-%m-%d %H:%M:%S')
    def log(*x):
        line = now_t() + ' ' + ' '.join(str(v) for v in x); logf.write(line + '\n'); logf.flush(); print(line, flush=True)
    seq = [0]
    def trador(line):
        seq[0] += 1; outf.write(json.dumps(dict(seq=seq[0], time_tehran=now_t(), line=line)) + '\n'); outf.flush(); log('TRADOR>>', line)
    def ev(e): e = dict(e); e['emitted_at'] = now_t(); evf.write(json.dumps(e) + '\n'); evf.flush(); log('EVENT', json.dumps(e))
    F = lambda p: ('%.' + str(dec) + 'f') % p
    st = dict(n=1, live=None)          # live = (stop, sl, tp) strings of the announced pending order
    def ref(): return '%s-%d' % (a.ref, st['n'])
    def order_vals(eng):
        e = round(eng._p(eng.entry), dec); s = round(eng._p(eng.sl), dec)
        return F(e), F(s), F(round(e + a.rr * (e - s), dec))
    def cancel_live(why):
        if st['live']:
            trador('CANCEL | %s | REF %s' % (name, ref())); st['live'] = None; st['n'] += 1
        else: log('cancel (%s): no pending order announced -> nothing sent' % why)

    fail = dict(since=None)
    def fetch(iv_, tfs_, n):
        delay = 2.0
        while True:
            try:
                b, forming = C.fetch_closed(tv, iv_, tfs_, n)
                if not b: raise RuntimeError('no bars')
                fail['since'] = None; return b, forming
            except Exception as ex:
                t = time.time(); fail['since'] = fail['since'] or t
                log('fetch error:', type(ex).__name__, ex, 'failing for %.0fs' % (t - fail['since']))
                if t - fail['since'] > a.feed_dead: return None, None
                time.sleep(delay); delay = min(20.0, delay * 1.5)
    def dead():
        ev(dict(type='feed_dead', seconds=a.feed_dead)); cancel_live('feed dead'); log('STOP: feed broken > %ds' % a.feed_dead); sys.exit(3)

    bars, _ = fetch(iv, tfs, 400)
    if bars is None: dead()
    eng = PullbackEngine(tv, a.side, lab, rr=a.rr, buffer=a.buffer, double=False, chain=a.chain, cancel_atr=a.cancel_atr,
                         sl_mode='max', tf_seconds=tfs, dec=None)
    log('start %s %s %s dec=%d ref=%s base_stop=%s h1_invalid=%s run=%s pid=%d' % (tv, a.side, lab, dec, a.ref, a.base_stop, a.h1_invalid, run_id, os.getpid()))
    for e in eng.start(bars): ev(e)
    last_ts = bars[-1][0]
    last_h1 = None
    if a.h1_invalid is not None:
        h1, _ = fetch('60', 3600, 20)
        if h1 is None: dead()
        last_h1 = h1[-1][0]; log('H1 baseline: last closed H1 %s close %s' % (tstr(last_h1), h1[-1][4]))

    def finish(why, code=0): log('FINISHED:', why); sys.exit(code)
    while True:
        B = (int(time.time() // tfs) + 1) * tfs
        time.sleep(max(0.0, B + 1.0 - time.time()))
        new = []; t0 = time.time()
        while True:
            bars, forming = fetch(iv, tfs, 100)
            if bars is None: dead()
            new = [b for b in bars if b[0] > last_ts]
            if new or time.time() - t0 > 40: break
            time.sleep(1.5)
        if not new: log('no new closed %s candle at %s (quiet/closed market?)' % (lab, tstr(B))); continue
        for b in new:
            last_ts = b[0]
            col = 'bull' if b[4] > b[1] else 'bear' if b[4] < b[1] else 'doji'
            log('candle %s O %s H %s L %s C %s %s' % (tstr(b[0]), *b[1:], col))
            evs = eng.feed(b)
            for e in evs: ev(e)
            types = [e['type'] for e in evs]
            if 'triggered' in types:
                trg = [e for e in evs if e['type'] == 'triggered'][0]
                log('ENTRY %d TRIGGERED at %s (candle %s)' % (st['n'], trg.get('fill_price'), tstr(b[0])))
                st['live'] = None; st['n'] += 1
                if 'done' in types: finish('ALL %d ENTRIES TRIGGERED' % a.chain)
            if 'A_reset' in types and evs[0].get('pending_cancelled'):
                cancel_live('A reset')
            if 'no_entry' in types:
                cancel_live('no entry'); finish('NO ENTRY (5 ATR run without entry)')
            # extra: base stop
            if a.base_stop is not None and ((buy and b[3] < a.base_stop) or (not buy and b[2] > a.base_stop)):
                ev(dict(type='base_stop_broken', candle=tstr(b[0]), low=b[3], high=b[2], base_stop=a.base_stop))
                cancel_live('base stop'); finish('CANCELLED: base stop %s broken by candle %s' % (a.base_stop, tstr(b[0])))
            if 'pending_placed' in types:
                v = order_vals(eng); st['live'] = v
                trador('ENTRY | %s | %s | STOP %s | SL %s | TP %s | DOUBLE no | REF %s' % (name, a.side, v[0], v[1], v[2], ref()))
            elif 'pending_moved' in types and st['live']:
                v = order_vals(eng)
                if v != st['live']:
                    st['live'] = v; trador('MOVE | %s | REF %s | STOP %s | SL %s | TP %s' % (name, ref(), *v))
                else: log('pending moved but unchanged after rounding -> nothing sent')
        # extra: H1 close invalidation
        if a.h1_invalid is not None and B % 3600 == 0:
            h1 = None
            for _ in range(20):
                h1, _f = fetch('60', 3600, 20)
                if h1 is None: dead()
                if h1[-1][0] > last_h1: break
                time.sleep(2)
            for hb in [x for x in h1 if x[0] > last_h1]:
                last_h1 = hb[0]; log('H1 close %s O %s H %s L %s C %s' % (tstr(hb[0]), *hb[1:]))
                if (buy and hb[4] < a.h1_invalid) or (not buy and hb[4] > a.h1_invalid):
                    ev(dict(type='h1_invalidation', candle=tstr(hb[0]), close=hb[4], level=a.h1_invalid))
                    cancel_live('H1 invalidation'); finish('CANCELLED: H1 candle %s closed %s beyond %s' % (tstr(hb[0]), hb[4], a.h1_invalid))

if __name__ == '__main__':
    main()
