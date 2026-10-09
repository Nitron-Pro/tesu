#!/usr/bin/env python3
"""Replay the pullback stop-entry engine on TradingView history.
usage: replay.py SYMBOL SIDE TF --start 'YYYY-MM-DD HH:MM' [--double] [--chain N] [--rr 2] [--buffer 0.1]
                 [--cancel-atr 5] [--sl-mode white|max] [--chart PATH | --no-chart] [--json] [--dump-bars]
 --start = order time (Tehran). The last candle CLOSED at/before it is the order-time candle (A = its high for SELL / low for BUY).
 SYMBOL: 'EURUSD' -> FOREXCOM:EURUSD, or a full TradingView id. TF: 3, 3m, M3, 15, 1h, H1, 60, 4h, D."""
import argparse, os, sys, time, json
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import common as C
from engine import PullbackEngine, tstr

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('symbol'); ap.add_argument('side', type=str.upper, choices=['BUY', 'SELL']); ap.add_argument('tf')
    ap.add_argument('--start', required=True); ap.add_argument('--double', action='store_true')
    ap.add_argument('--chain', type=int, default=1); ap.add_argument('--rr', type=float, default=2.0)
    ap.add_argument('--buffer', type=float, default=0.1); ap.add_argument('--cancel-atr', type=float, default=5.0)
    ap.add_argument('--sl-mode', choices=['white', 'max'], default='max')
    ap.add_argument('--chart'); ap.add_argument('--no-chart', action='store_true'); ap.add_argument('--json', action='store_true')
    ap.add_argument('--dump-bars', action='store_true', help='print every candle fed (for manual rule checks)')
    ap.add_argument('--dec', type=int, help='output price decimals (default: auto = price digits + 1; e.g. 3 for JPY pairs)')
    a = ap.parse_args()
    tv = C.resolve(a.symbol); iv, tfs, lab = C.parse_tf(a.tf); st = C.parse_tehran(a.start)
    n = min(5000, int((time.time() - st) // tfs) + 400)
    bars, _ = C.fetch_closed(tv, iv, tfs, n)
    k = max([i for i, b in enumerate(bars) if b[0] + tfs <= st], default=None)
    if k is None or k < 30: sys.exit('not enough history before --start (have %d bars from %s)' % (len(bars), tstr(bars[0][0]) if bars else '-'))
    dec = (a.dec - 1) if a.dec is not None else C.decimals(bars[k][4])
    eng = PullbackEngine(tv, a.side, lab, rr=a.rr, buffer=a.buffer, double=a.double, chain=a.chain, cancel_atr=a.cancel_atr,
                         sl_mode=a.sl_mode, tf_seconds=tfs, dec=dec + 1)
    print('# %s %s %s  order time %s Tehran -> order-time candle %s (close %s)  bars fed after it: %d  rr=%g buffer=%g double=%s chain=%d sl_mode=%s'
          % (tv, a.side, lab, a.start, tstr(bars[k][0]), tstr(bars[k][0] + tfs), len(bars) - k - 1, a.rr, a.buffer, a.double, a.chain, a.sl_mode))
    events = eng.start(bars[:k + 1]); last_i = k
    if a.dump_bars: print('   bar %s O %s H %s L %s C %s  (order-time candle)' % (tstr(bars[k][0]), *bars[k][1:]))
    for i in range(k + 1, len(bars)):
        ev = eng.feed(bars[i])
        if a.dump_bars:
            b = bars[i]; col = 'white' if b[4] > b[1] else 'red' if b[4] < b[1] else 'doji'
            print('   bar %s O %s H %s L %s C %s %-5s phase=%s' % (tstr(b[0]), *b[1:], col, eng.phase))
        events += ev
        if ev: last_i = i
        if eng.finished: break
    for e in events:
        print(json.dumps(e, ensure_ascii=False) if a.json else C.fmt_event(e, dec + 1))
    if not eng.finished:
        print('%s  (end of data: still running, phase=%s)' % (tstr(bars[-1][0]), eng.phase))
    if not a.no_chart:
        path = a.chart or os.path.join(HERE, 'charts', '%s_%s_%s_%s.png' % (tv.replace(':', '-'), a.side, lab, a.start.replace(' ', '_').replace(':', '')))
        lo = max(0, k - 20); hi = min(len(bars), (last_i if eng.finished else len(bars) - 1) + 15)
        title = '%s %s %s  order %s  rr=%g buf=%g%s%s' % (tv, lab, a.side, a.start, a.rr, a.buffer, ' double' if a.double else '',
                                                        ' chain%d' % a.chain if a.chain > 1 else '')
        C.chart(bars[lo:hi], eng.trace, events, path, title, tfs, dec + 1)
        print('# chart:', path)

if __name__ == '__main__':
    main()
