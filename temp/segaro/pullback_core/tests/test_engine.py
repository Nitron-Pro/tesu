#!/usr/bin/env python3
# OWNED BY SEGARO. Copy bots must never edit.
"""Synthetic rule tests for pullback_core (run: python3 /workspace/pullback_core/tests/test_engine.py)."""
import sys, os, json; sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pullback_core import PullbackEngine
T = 180
def hist(n=20, base=1.1000):  # flat history, TR = 0.0010 -> ATR = 0.0010
    return [(i * T, base, base + 0.0005, base - 0.0005, base) for i in range(n)]
def run(bars, side='SELL', last=None, **kw):
    e = PullbackEngine('TEST', side, '3m', tf_seconds=T, **kw); h = hist()
    if last: h[-1] = (h[-1][0],) + tuple(last)          # custom order-time candle (o, h, l, c)
    ev = e.start(h); t = h[-1][0]
    for (o, hi, lo, c) in bars:
        t += T; ev += e.feed((t, o, hi, lo, c))
        if e.finished: break
    return ev, e
def types(ev): return [x['type'] for x in ev]
def near(a, b): return abs(a - b) < 1e-9
ok = True
def check(name, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + name); ok &= bool(cond)

# A = 1.1005, ATR ~0.0010 -> buffer 0.0001
ev, e = run([(1.1000, 1.1003, 1.0990, 1.0992),   # red
             (1.0992, 1.0998, 1.0988, 1.0996),   # white -> STOP 1.0987, SL 1.0998, TP 1.0987-2*0.0011=1.0965
             (1.0996, 1.1000, 1.0990, 1.0993),   # red, high 1.1000 > SL -> SL 1.1000 (rule 6)
             (1.0993, 1.0997, 1.0991, 1.0995),   # white -> STOP 1.0990, SL 1.0997 (rule 5, sl_mode=white)
             (1.0995, 1.0996, 1.0989, 1.0990)], sl_mode='white')  # low 1.0989 <= 1.0990 -> trigger
p = [x for x in ev if x['type'] == 'pending_placed'][0]
check('rule 4 placement', near(p['entry'], 1.0987) and near(p['sl'], 1.0998) and near(p['tp'][0], 1.0965))
mv = [x for x in ev if x['type'] == 'pending_moved']
check('rule 6 SL up', near(mv[0]['sl'], 1.1000) and near(mv[0]['entry'], 1.0987))
check('rule 5 move to new white', near(mv[1]['entry'], 1.0990) and near(mv[1]['sl'], 1.0997))
tr = [x for x in ev if x['type'] == 'triggered'][0]
check('rule 7 trigger at stop', near(tr['fill_price'], 1.0990) and types(ev)[-1] == 'done')

# DEFAULT sl_mode=max keeps 1.1000 (new white high 1.0997 lower); a higher white high still raises SL
ev, e = run([(1.1000, 1.1003, 1.0990, 1.0992), (1.0992, 1.0998, 1.0988, 1.0996), (1.0996, 1.1000, 1.0990, 1.0993),
             (1.0993, 1.0997, 1.0991, 1.0995), (1.0995, 1.1002, 1.0993, 1.1001)])
mv = [x for x in ev if x['type'] == 'pending_moved']
check('default sl_mode=max keeps higher SL', e.sl_mode == 'max' and near(mv[1]['sl'], 1.1000) and near(mv[1]['entry'], 1.0990))
check('sl_mode=max raises SL to higher white high', near(mv[2]['sl'], 1.1002) and near(mv[2]['entry'], 1.0992))

# rule 3b: RED order-time (A) candle counts as the red move -> first white places the stop
ev, e = run([(1.0996, 1.1000, 1.0994, 1.0999)], last=(1.1003, 1.1005, 1.0995, 1.0997))
check('3b red start candle -> next white places stop', ev[0].get('a_candle_counts_as_move') and 'pending_placed' in types(ev)
      and near([x for x in ev if x['type'] == 'pending_placed'][0]['entry'], 1.0993))
# rule 3b on A_reset: red candle making a new high
ev, e = run([(1.1004, 1.1012, 1.0998, 1.1000),   # new high 1.1012, closes red -> counts as move
             (1.1000, 1.1006, 1.0999, 1.1004)])  # white -> stop
r = [x for x in ev if x['type'] == 'A_reset'][0]
check('3b red A_reset candle -> next white places stop', r['a_candle_counts_as_move'] and types(ev)[-1] == 'pending_placed')
# white A_reset candle -> still needs a red first
ev, e = run([(1.1000, 1.1012, 1.0999, 1.1010), (1.1010, 1.1011, 1.1005, 1.1009)])
check('3b white A_reset candle -> needs red first', 'pending_placed' not in types(ev) and e.phase == 'wait_white')
# chain leg: red trigger candle counts as the move for leg 2
ev, e = run([(1.1000, 1.1003, 1.0990, 1.0992), (1.0992, 1.0998, 1.0988, 1.0996), (1.0996, 1.0997, 1.0985, 1.0986),
             (1.0986, 1.0990, 1.0984, 1.0989)], chain=2)
a2 = [x for x in ev if x['type'] == 'A_set' and x['leg'] == 2][0]
check('3b chain leg: red trigger candle counts', a2['a_candle_counts_as_move'] and types(ev)[-1] == 'pending_placed')
# chain leg: white trigger candle and white SL candle -> leg 2 waits for red
ev, e = run([(1.1000, 1.1003, 1.0990, 1.0992), (1.0992, 1.0998, 1.0988, 1.0996), (1.0996, 1.0997, 1.0985, 1.0997),
             (1.0997, 1.0998, 1.0993, 1.0996)], chain=2)
a2 = [x for x in ev if x['type'] == 'A_set' and x['leg'] == 2][0]
check('3b chain leg: white SL & trigger candle -> wait red', not a2['a_candle_counts_as_move'] and 'pending_placed' not in types(ev)[-1:])
# chain leg: SL set by a RED candle (rule 6), white trigger candle -> counts
ev, e = run([(1.1000, 1.1003, 1.0990, 1.0992), (1.0992, 1.0998, 1.0988, 1.0996), (1.0996, 1.1001, 1.0990, 1.0991),
             (1.0991, 1.0992, 1.0985, 1.0992), (1.0992, 1.0996, 1.0991, 1.0995)], chain=2)
a2 = [x for x in ev if x['type'] == 'A_set' and x['leg'] == 2][0]
check('3b chain leg: red SL candle counts', a2['a_candle_counts_as_move'] and near(a2['A'], 1.1001) and types(ev)[-1] == 'pending_placed')
# BUY mirror of 3b: WHITE candle making the low -> next red places the BUY STOP (high + buffer, SL low)
ev, e = run([(1.0996, 1.0998, 1.0990, 1.0992)], side='BUY', last=(1.0990, 1.0996, 1.0980, 1.0994))
p = [x for x in ev if x['type'] == 'pending_placed']
check('3b BUY: white low candle -> next red places BUY STOP', p and near(p[0]['entry'], 1.0998 + 0.1 * p[0]['atr']) and near(p[0]['sl'], 1.0990))

# rule 2 reset cancels pending
ev, e = run([(1.1000, 1.1003, 1.0990, 1.0992), (1.0992, 1.0998, 1.0988, 1.0996), (1.0996, 1.1010, 1.0993, 1.1008)])
r = [x for x in ev if x['type'] == 'A_reset'][0]
check('rule 2 reset + cancel', near(r['A'], 1.1010) and r['pending_cancelled'] and e.phase == 'wait_red')

# white before any red is ignored
ev, e = run([(1.0995, 1.1000, 1.0994, 1.0999)])
check('rule 3 needs red first', 'pending_placed' not in types(ev) and e.phase == 'wait_red')

# rule 8 no_entry: A - 5*ATR = 1.1005 - 0.0050 = 1.0955
ev, e = run([(1.1000, 1.1002, 1.0970, 1.0972), (1.0972, 1.0975, 1.0950, 1.0952)])
check('rule 8 no_entry', types(ev)[-2:] == ['no_entry', 'done'])

# double + chain2 = 4 positions; leg 2 A = SL of leg 1
ev, e = run([(1.1000, 1.1003, 1.0990, 1.0992), (1.0992, 1.0998, 1.0988, 1.0996), (1.0996, 1.0997, 1.0985, 1.0986),
             (1.0986, 1.0990, 1.0975, 1.0977), (1.0977, 1.0985, 1.0974, 1.0983), (1.0983, 1.0984, 1.0960, 1.0962)],
            double=True, chain=2)
a2 = [x for x in ev if x['type'] == 'A_set' and x['leg'] == 2]
t1 = [x for x in ev if x['type'] == 'triggered']
check('chain leg2 A = leg1 SL', a2 and near(a2[0]['A'], 1.0998))
check('double+chain2 -> 4 positions', len(e.positions) == 4 and len(t1) == 2 and near(t1[0]['positions'][0]['tp'], 1.0987 - 0.0011))

# BUY mirror of the first scenario
mir = lambda b: (2.2 - b[0], 2.2 - b[2], 2.2 - b[1], 2.2 - b[3])
ev_b, _ = PullbackEngine, None
def runb(bars, **kw):
    e = PullbackEngine('TEST', 'BUY', '3m', tf_seconds=T, **kw); h = [(t, 2.2 - o, 2.2 - l, 2.2 - hh, 2.2 - c) for (t, o, hh, l, c) in hist()]
    ev = e.start(h); t = h[-1][0]
    for b in bars:
        t += T; ev += e.feed((t,) + b)
        if e.finished: break
    return ev
sb = [(1.1000, 1.1003, 1.0990, 1.0992), (1.0992, 1.0998, 1.0988, 1.0996), (1.0996, 1.1000, 1.0990, 1.0993),
      (1.0993, 1.0997, 1.0991, 1.0995), (1.0995, 1.0996, 1.0989, 1.0990)]
evs, _ = run(sb); evb = runb([mir(b) for b in sb])
check('BUY is exact mirror', types(evs) == types(evb) and all(
    (x['entry'] is None and y['entry'] is None) or near(x['entry'], 2.2 - y['entry']) for x, y in zip(evs, evb)))

# double_rr_first parameter
ev, e = run([(1.1000, 1.1003, 1.0990, 1.0992), (1.0992, 1.0998, 1.0988, 1.0996)], double=True, double_rr_first=1.5)
p = [x for x in ev if x['type'] == 'pending_placed'][0]
check('double_rr_first=1.5', near(p['tp'][0], 1.0987 - 1.5 * 0.0011) and near(p['tp'][1], 1.0987 - 2 * 0.0011))
# cancel_atr <= 0 disables no_entry
ev, e = run([(1.1000, 1.1002, 1.0970, 1.0972), (1.0972, 1.0975, 1.0900, 1.0902)], cancel_atr=0)
check('cancel_atr=0 disables no_entry', 'no_entry' not in types(ev))

# persistence: stop after k bars, JSON round-trip, continue == uninterrupted run
seq = [(1.1000, 1.1003, 1.0990, 1.0992), (1.0992, 1.0998, 1.0988, 1.0996), (1.0996, 1.1000, 1.0990, 1.0993),
       (1.0993, 1.0997, 1.0991, 1.0995), (1.0995, 1.0996, 1.0980, 1.0981), (1.0981, 1.0990, 1.0979, 1.0988),
       (1.0988, 1.0989, 1.0970, 1.0971), (1.0971, 1.0978, 1.0969, 1.0977), (1.0977, 1.0979, 1.0950, 1.0951)]
full, ef = run(seq, chain=3, double=True)
for cut in range(0, len(seq)):
    e1 = PullbackEngine('TEST', 'SELL', '3m', tf_seconds=T, chain=3, double=True); h = hist(); evs = e1.start(h); t = h[-1][0]
    for b in seq[:cut]: t += T; evs += e1.feed((t,) + b)
    e2 = PullbackEngine.from_state(json.loads(json.dumps(e1.to_state())))
    for b in seq[cut:]:
        if e2.finished: break
        t += T; evs += e2.feed((t,) + b)
    same = [json.dumps(x, sort_keys=True) for x in evs] == [json.dumps(x, sort_keys=True) for x in full]
    if not same: break
check('state round-trip at every cut point == uninterrupted run', same)
check('pending property', ef.pending is None)
sys.exit(0 if ok else 1)
