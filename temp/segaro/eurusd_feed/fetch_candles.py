#!/usr/bin/env python3
"""usage: fetch_candles.py [SYMBOL=FOREXCOM:EURUSD] [INTERVAL=3] [N=100]  -> CSV (Tehran time of bar OPEN), last row may be forming"""
import sys, time, datetime, zoneinfo, os
sys.dont_write_bytecode = True; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tvfeed
sym = sys.argv[1] if len(sys.argv) > 1 else 'FOREXCOM:EURUSD'
iv = sys.argv[2] if len(sys.argv) > 2 else '3'
n = int(sys.argv[3]) if len(sys.argv) > 3 else 100
TZ = zoneinfo.ZoneInfo('Asia/Tehran')
t0 = time.time(); bars = tvfeed.get_bars(sym, iv, n); dt = time.time() - t0
sec = {'D': 86400, 'W': 604800}.get(iv, None) or int(iv) * 60
now = time.time()
print('# %s interval=%s bars=%d fetch=%.2fs' % (sym, iv, len(bars), dt))
print('open_time_tehran,open,high,low,close,closed')
for ts, o, h, l, c in bars:
    print('%s,%s,%s,%s,%s,%d' % (datetime.datetime.fromtimestamp(ts, TZ).strftime('%Y-%m-%d %H:%M'), o, h, l, c, ts + sec <= now))
