# OWNED BY SEGARO. Copy bots must never edit.
"""Market data: TradingView websocket (no login) via tvfeed; symbol / timeframe helpers."""
import time, datetime, zoneinfo
from . import tvfeed
TZ = zoneinfo.ZoneInfo('Asia/Tehran')

def parse_tf(tf):
    """'3', '3m', 'M3', '15', '1h', 'H1', '60', '4h', 'D' -> (tv_interval, seconds, label)"""
    t = str(tf).strip().upper()
    if t in ('D', '1D'): return 'D', 86400, 'D'
    if t.startswith('M') and t[1:].isdigit(): t = t[1:]
    if t.startswith('H') and t[1:].isdigit(): t = str(int(t[1:]) * 60)
    if t.endswith('H') and t[:-1].isdigit(): t = str(int(t[:-1]) * 60)
    if t.endswith('M') and t[:-1].isdigit(): t = t[:-1]
    n = int(t); lab = ('%dm' % n) if n < 60 else ('%dh' % (n // 60))
    return str(n), n * 60, lab

def resolve(sym):
    """'EURUSD' -> 'FOREXCOM:EURUSD'; full TradingView ids pass through."""
    s = str(sym).strip().upper()
    return s if ':' in s else 'FOREXCOM:' + s

def decimals(price):
    return 5 if price < 20 else 3 if price < 1000 else 2

def fetch_closed(tv, interval, tfs, n, now=None, timeout=20):
    """-> (closed bars oldest first [(ts_open, o, h, l, c)], forming_bar_present). Drops mid-bar snapshots
    (only TFs <= 1h are epoch-aligned; 4h/D follow the FX session)."""
    raw = tvfeed.get_bars(tv, interval, max(10, min(5000, int(n))), timeout=timeout)
    now = now or time.time()
    al = [tuple(r) for r in raw if tfs > 3600 or r[0] % tfs == 0]
    closed = [r for r in al if r[0] + tfs <= now]
    forming = any(r[0] + tfs > now for r in al)
    return closed, forming

def tstr(ts): return datetime.datetime.fromtimestamp(ts, TZ).strftime('%Y-%m-%d %H:%M')

def parse_tehran(s):
    return datetime.datetime.strptime(s.strip(), '%Y-%m-%d %H:%M').replace(tzinfo=TZ).timestamp()
