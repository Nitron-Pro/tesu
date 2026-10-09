"""Minimal no-login TradingView websocket client (tvDatafeed-style) using only the stdlib."""
import socket, ssl, os, base64, json, random, string, struct, time, re

def _ws_connect(host, path, origin, timeout=20):
    raw = socket.create_connection((host, 443), timeout=timeout)
    s = ssl.create_default_context().wrap_socket(raw, server_hostname=host)
    key = base64.b64encode(os.urandom(16)).decode()
    req = ('GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
           'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\nOrigin: %s\r\n'
           'User-Agent: Mozilla/5.0\r\n\r\n') % (path, host, key, origin)
    s.sendall(req.encode())
    resp = b''
    while b'\r\n\r\n' not in resp:
        ch = s.recv(4096)
        if not ch: raise ConnectionError('handshake closed')
        resp += ch
    head, rest = resp.split(b'\r\n\r\n', 1)
    if b' 101 ' not in head.split(b'\r\n')[0]: raise ConnectionError('handshake failed: %r' % head[:120])
    return s, rest

def _send(s, text):
    data = text.encode(); mask = os.urandom(4)
    hdr = bytearray([0x81]); n = len(data)
    if n < 126: hdr.append(0x80 | n)
    elif n < 65536: hdr.append(0x80 | 126); hdr += struct.pack('>H', n)
    else: hdr.append(0x80 | 127); hdr += struct.pack('>Q', n)
    s.sendall(bytes(hdr) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

class _Reader:
    def __init__(self, s, buf): self.s = s; self.buf = buf
    def _need(self, n):
        while len(self.buf) < n:
            ch = self.s.recv(65536)
            if not ch: raise ConnectionError('closed')
            self.buf += ch
    def frame(self):
        self._need(2); b0, b1 = self.buf[0], self.buf[1]; op = b0 & 0x0f; n = b1 & 0x7f; p = 2
        if n == 126: self._need(4); n = struct.unpack('>H', self.buf[2:4])[0]; p = 4
        elif n == 127: self._need(10); n = struct.unpack('>Q', self.buf[2:10])[0]; p = 10
        self._need(p + n); payload = self.buf[p:p + n]; self.buf = self.buf[p + n:]
        return op, b0 & 0x80, payload
    def message(self):
        parts = b''
        while True:
            op, fin, pl = self.frame()
            if op == 8: raise ConnectionError('server close')
            if op in (9, 10): continue
            parts += pl
            if fin: return parts.decode('utf-8', 'replace')

def _wrap(obj):
    m = json.dumps(obj, separators=(',', ':'))
    return '~m~%d~m~%s' % (len(m), m)

def _msg(func, params): return _wrap({'m': func, 'p': params})

def get_bars(symbol, interval='60', n_bars=300, timeout=25):
    """symbol like 'SAXO:XAUUSD'. Returns list of (ts, o, h, l, c) ascending (ts = bar open, unix seconds)."""
    s, rest = _ws_connect('data.tradingview.com', '/socket.io/websocket?from=chart%2F', 'https://www.tradingview.com', timeout)
    s.settimeout(timeout)
    rd = _Reader(s, rest)
    rnd = lambda p: p + ''.join(random.choice(string.ascii_lowercase) for _ in range(12))
    cs = rnd('cs_')
    for m in (_msg('set_auth_token', ['unauthorized_user_token']),
              _msg('chart_create_session', [cs, '']),
              _msg('resolve_symbol', [cs, 'symbol_1', '=' + json.dumps({'symbol': symbol, 'adjustment': 'splits', 'session': 'regular'})]),
              _msg('create_series', [cs, 's1', 's1', 'symbol_1', interval, n_bars])):
        _send(s, m)
    bars = None; t0 = time.time(); err = None
    while time.time() - t0 < timeout:
        txt = rd.message()
        for part in re.split(r'~m~\d+~m~', txt):
            if not part: continue
            if part.startswith('~h~'): _send(s, '~m~%d~m~%s' % (len(part), part)); continue
            try: j = json.loads(part)
            except Exception: continue
            m = j.get('m')
            if m in ('symbol_error', 'series_error', 'critical_error', 'protocol_error'): err = '%s %s' % (m, j.get('p'))
            if m in ('timescale_update', 'du'):
                ser = j['p'][1].get('s1', {}).get('s')
                if ser: bars = [(int(x['v'][0]), x['v'][1], x['v'][2], x['v'][3], x['v'][4]) for x in ser]
            if m == 'series_completed' and bars: s.close(); return bars
        if err: s.close(); raise RuntimeError(err)
    s.close()
    if bars: return bars
    raise TimeoutError('no bars for %s' % symbol)

if __name__ == '__main__':
    import sys, datetime
    for sym in sys.argv[1:] or ['FOREXCOM:EURUSD']:
        b = get_bars(sym, n_bars=150)
        print(sym, len(b), datetime.datetime.utcfromtimestamp(b[0][0]), '->', datetime.datetime.utcfromtimestamp(b[-1][0]), b[-1])
