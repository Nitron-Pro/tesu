# OWNED BY SEGARO. Copy bots must never edit. (detection core; per-bot policy lives in /workspace/pullback_bots/<bot>/config.json)
"""Pullback stop-entry signal engine (signals only, never trades). Pure state machine fed CLOSED candles.

SELL rules (BUY = exact mirror; implemented by mirroring prices: o,h,l,c -> -o,-l,-h,-c, so 'white' <-> 'red'):
 1. start: A = high of the last closed candle; ATR14 (Wilder, same TF) recorded at that candle. ATR recomputed at every A reset.
 2. a later candle with high > A -> new A = that high, pending cancelled, process restarts (fresh ATR at that candle).
 3. wait for >= 1 red candle after A.
 4. first white candle after the red(s): SELL STOP at white.low - buffer*ATR, SL = white.high, TP = entry - RR*(SL-entry).
 5. pending & a new white candle closes (not breaking A): entry -> that white's low - buffer*ATR, SL -> max(current SL, its high)
    (sl_mode='max', DEFAULT since 2026-09-29) or exactly that white's high (sl_mode='white').
 3b (2026-09-29): if the candle that sets A is itself RED (SELL; BUY: a WHITE candle making the low), it already counts as the
    red move -> the very next white candle places the stop. Applies at start, on every A_reset and on chain legs (see below).
 6. pending & any candle high > current SL (and <= A): SL -> that high. TP recomputed on every change.
 7. trigger: candle low <= stop -> filled at the stop price.
 8. cancel: lowest low of the candles after A <= A - cancel_atr*ATR(at A) with no entry -> no_entry, stop.
 double: every entry = 2 positions (TP 1:1 and TP 1:RR). chain N: after a trigger, that position's SL becomes the new A
 (fresh ATR at the trigger candle) and the process repeats until N entries triggered. Chain-leg rule 3b: the new leg
 starts in 'wait_white' if the candle that made that SL level is red OR the trigger candle is red (a red candle after the SL
 candle = the red move); otherwise it waits for a red candle after the trigger candle.
 Same-candle trigger + SL/A break: the entry counts (positions are not tracked after the fill); the note is info only.
Candle (bar) = (ts_open_unix, o, h, l, c). Doji (c == o) is neither white nor red.
"""
import datetime, zoneinfo
TZ = zoneinfo.ZoneInfo('Asia/Tehran')

def tstr(ts): return datetime.datetime.fromtimestamp(ts, TZ).strftime('%Y-%m-%d %H:%M')

class WilderATR:
    """Wilder ATR(n): running mean of TR for the first n bars (SMA seed), then (prev*(n-1)+TR)/n. Includes the current bar."""
    def __init__(self, n=14): self.n = n; self.prev_c = None; self.count = 0; self.sum = 0.0; self.value = None
    def update(self, h, l, c):
        tr = h - l if self.prev_c is None else max(h - l, abs(h - self.prev_c), abs(l - self.prev_c))
        self.prev_c = c; self.count += 1
        if self.count <= self.n: self.sum += tr; self.value = self.sum / self.count
        else: self.value = (self.value * (self.n - 1) + tr) / self.n
        return self.value

class PullbackEngine:
    STATE_VERSION = 1
    def __init__(self, symbol, side, tf, rr=2.0, buffer=0.1, double=False, chain=1, cancel_atr=5.0,
                 sl_mode='max', tf_seconds=None, dec=None, double_rr_first=1.0, atr_period=14, keep_trace=True):
        """rr: main target (TP = entry -/+ rr*risk); double: 2 positions per entry, first TP at double_rr_first*risk;
        chain: number of entries (after a fill its SL becomes the new A); buffer: stop offset in ATR; cancel_atr: no_entry
        distance from A in ATR (<= 0 disables); sl_mode 'max' (default) | 'white'; dec: output rounding decimals."""
        self.symbol, self.side, self.tf = symbol, side.upper(), str(tf)
        assert self.side in ('BUY', 'SELL')
        self.k = 1.0 if self.side == 'SELL' else -1.0         # internal space = SELL logic on k*price
        self.rr, self.buffer, self.double, self.chain = float(rr), float(buffer), bool(double), max(1, int(chain))
        self.cancel_atr, self.sl_mode = float(cancel_atr), sl_mode
        self.double_rr_first = float(double_rr_first); self.keep_trace = bool(keep_trace)
        assert sl_mode in ('max', 'white')
        self.tfs = tf_seconds; self.dec = dec
        self.atr = WilderATR(int(atr_period)); self.started = False; self.finished = False
        self.leg = 1; self.entries = 0; self.positions = []
        self.trace = []          # per-candle snapshot for charts: dict(ts, A, entry, sl, tp)
        self._reset_leg()

    # ---------- helpers ----------
    def _m(self, b):  # mirror a bar into internal (sell) space
        ts, o, h, l, c = b
        return (ts, o, h, l, c) if self.k > 0 else (ts, -o, -l, -h, -c)
    def _p(self, x):  # internal -> real price
        if x is None: return None
        v = x * self.k
        return round(v, self.dec) if self.dec is not None else v
    def _reset_leg(self):
        self.A = None; self.atrA = None; self.phase = 'wait_red'; self.entry = None; self.sl = None
        self.low_since = None; self.a_ts = None; self.sl_red = False; self.a_red = False
    def _tps(self):
        risk = self.sl - self.entry
        return ([self.entry - self.double_rr_first * risk, self.entry - self.rr * risk] if self.double else [self.entry - self.rr * risk])
    def _ev(self, typ, bar, **kw):
        ts = bar[0]
        e = dict(type=typ, symbol=self.symbol, side=self.side, tf=self.tf, leg=self.leg,
                 candle_time_tehran=tstr(ts), candle_close_tehran=tstr(ts + self.tfs) if self.tfs else None, candle_ts=ts,
                 A=self._p(self.A), atr=round(self.atrA, 8) if self.atrA is not None else None,
                 entry=self._p(self.entry), sl=self._p(self.sl),
                 tp=[self._p(t) for t in self._tps()] if self.entry is not None else None)
        e.update(kw); return e
    def _col(self):
        return ('red' if self.k > 0 else 'white') if self.a_red else ('white' if self.k > 0 else 'red')
    def _set_A(self, ib, atr):
        self.A = ib[2]; self.atrA = atr; self.a_ts = ib[0]
        self.a_red = ib[4] < ib[1]                      # rule 3b: a red A candle already counts as the red move
        self.phase = 'wait_white' if self.a_red else 'wait_red'
        self.entry = None; self.sl = None; self.low_since = None; self.sl_red = False
    def _snap(self, ts):
        if not self.keep_trace: return
        self.trace.append(dict(ts=ts, A=self._p(self.A), entry=self._p(self.entry), sl=self._p(self.sl),
                               tp=[self._p(t) for t in self._tps()] if self.entry is not None else None, leg=self.leg))

    # ---------- persistence (resumable runs) ----------
    def to_state(self):
        """JSON-serialisable full state (engine + ATR); from_state() restores it exactly."""
        d = {k: v for k, v in self.__dict__.items() if k != 'atr'}
        d['atr'] = dict(self.atr.__dict__); d['_version'] = self.STATE_VERSION
        return d
    @classmethod
    def from_state(cls, d):
        d = dict(d); v = d.pop('_version', None)
        if v != cls.STATE_VERSION: raise ValueError('engine state version %r != %r' % (v, cls.STATE_VERSION))
        e = cls.__new__(cls); atr = d.pop('atr')
        e.__dict__.update(d); e.atr = WilderATR(atr['n']); e.atr.__dict__.update(atr)
        return e
    @property
    def pending(self):
        """current pending stop order (real prices) or None"""
        if self.phase != 'pending' or self.finished: return None
        return dict(entry=self._p(self.entry), sl=self._p(self.sl), tp=[self._p(t) for t in self._tps()])

    # ---------- API ----------
    def start(self, history):
        """history: closed bars, oldest first; the LAST one is the order-time candle (its high/low = A). Returns events."""
        for b in history: self.atr.update(*self._m(b)[2:5])
        ib = self._m(history[-1]); self._set_A(ib, self.atr.value); self.started = True
        self._snap(ib[0])
        return [self._ev('A_set', history[-1], a_candle_counts_as_move=self.a_red,
                         note='reference %s of order-time candle (%s)%s' % ('high' if self.k > 0 else 'low', self._col(),
                               ' -> counts as the move, next %s candle places the stop' % ('white' if self.k > 0 else 'red') if self.a_red else ''))]

    def feed(self, bar):
        """feed the next CLOSED bar; returns a list of events."""
        if self.finished or not self.started: return []
        ib = self._m(bar); ts, o, h, l, c = ib
        atr_now = self.atr.update(h, l, c)
        ev = []
        white, red = c > o, c < o

        # 7. trigger has priority (a live stop order would have filled; intrabar order unknown)
        if self.phase == 'pending' and l <= self.entry:
            self.entries += 1
            tps = self._tps()
            pos = [dict(entry=self._p(self.entry), sl=self._p(self.sl), tp=self._p(t), rr=(self.double_rr_first if (self.double and i == 0) else self.rr))
                   for i, t in enumerate(tps)]
            self.positions += pos
            notes = []
            if h >= self.sl: notes.append('info: same candle also reached SL')
            if h > self.A: notes.append('info: same candle also exceeded A')
            ev.append(self._ev('triggered', bar, fill_price=self._p(self.entry), positions=pos, entries_so_far=self.entries,
                               notes=notes))
            self._snap(ts)
            if self.entries >= self.chain:
                self.finished = True
                ev.append(self._ev('done', bar, reason='all %d entr%s triggered' % (self.chain, 'y' if self.chain == 1 else 'ies'),
                                   total_positions=len(self.positions)))
                return ev
            # chain: SL of this position becomes new A, fresh ATR at the trigger candle
            new_A = self.sl; sl_red = self.sl_red; self.leg += 1
            self._reset_leg(); self.A = new_A; self.atrA = atr_now; self.a_ts = ts
            self.a_red = sl_red or c < o                 # rule 3b for chain legs: SL candle red or trigger candle red
            self.phase = 'wait_white' if self.a_red else 'wait_red'
            why = 'SL candle' if sl_red else 'trigger candle' if c < o else ''
            ev.append(self._ev('A_set', bar, a_candle_counts_as_move=self.a_red,
                               note='chain leg %d: A = SL of previous entry%s' % (self.leg,
                                     ' (%s %s -> counts as the move)' % (why, 'red' if self.k > 0 else 'white') if self.a_red else '')))
            return ev

        # 2. new extreme beyond A -> reset
        if h > self.A:
            had = self.phase == 'pending'
            old = self._p(self.A); self._set_A(ib, atr_now)
            ev.append(self._ev('A_reset', bar, previous_A=old, pending_cancelled=had, a_candle_counts_as_move=self.a_red,
                               note='A candle %s%s' % (self._col(), ' -> counts as the move' if self.a_red else '')))
            self._snap(ts); return ev

        # 8. cancel: lowest low since A
        self.low_since = l if self.low_since is None else min(self.low_since, l)
        if self.cancel_atr > 0 and self.low_since <= self.A - self.cancel_atr * self.atrA:
            self.finished = True
            ev.append(self._ev('no_entry', bar, lowest_since_A=self._p(self.low_since),
                               threshold=self._p(self.A - self.cancel_atr * self.atrA),
                               reason='price moved %.1f ATR from A without an entry' % self.cancel_atr))
            ev.append(self._ev('done', bar, reason='no_entry', total_positions=len(self.positions)))
            self._snap(ts); return ev

        if self.phase == 'wait_red':
            if red: self.phase = 'wait_white'
        elif self.phase == 'wait_white':
            if white:
                self.entry = l - self.buffer * self.atrA; self.sl = h; self.sl_red = False; self.phase = 'pending'
                ev.append(self._ev('pending_placed', bar))
        elif self.phase == 'pending':
            old_e, old_s = self.entry, self.sl; why = []
            if white:                                                    # rule 5
                self.entry = l - self.buffer * self.atrA
                if self.sl_mode == 'white' or h >= self.sl: self.sl = h; self.sl_red = False
                why.append('new %s candle' % ('white' if self.k > 0 else 'red'))
            elif h > self.sl:                                           # rule 6
                self.sl = h; self.sl_red = red; why.append('%s beyond SL' % ('high' if self.k > 0 else 'low'))
            if (self.entry, self.sl) != (old_e, old_s):
                ev.append(self._ev('pending_moved', bar, previous_entry=self._p(old_e), previous_sl=self._p(old_s), reason=', '.join(why)))
        self._snap(ts)
        return ev
