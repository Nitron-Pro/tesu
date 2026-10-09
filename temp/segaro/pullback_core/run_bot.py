#!/usr/bin/env python3
# OWNED BY SEGARO. Copy bots must never edit.
"""Pullback signal runner (signals only, never trades). Detection rules live in pullback_core/engine.py; every per-bot
policy comes from /workspace/pullback_bots/<bot>/config.json (+ --override key=value).

  run_bot.py --bot NAME --side SELL|BUY [--override k=v ...] replay --start 'YYYY-MM-DD HH:MM' [--no-chart] [--json]
  run_bot.py --bot NAME --side SELL|BUY [--override k=v ...] live            # NEW run: prints A_set, saves state, exits 0
  run_bot.py --bot NAME live --resume RUN_ID [--max-wait SEC]                # continue; exits 0 after the next actionable event
  run_bot.py --bot NAME status [RUN_ID]
  run_bot.py --bot NAME cancel RUN_ID
Exit codes: 0 = event(s) printed (read the JSON lines), 1 = error, 2 = run not found / not active / already running,
            4 = --max-wait reached with no actionable event (just --resume again).
Output: every event = one JSON line (starts with '{') + one readable line starting with '» '. See BOT_GUIDE.md."""
import sys, os, json, time, datetime, argparse, fcntl, signal, math
sys.dont_write_bytecode = True
CORE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, CORE)
from pullback_core import PullbackEngine, feed, fmt, webhook
from pullback_core.feed import tstr, TZ

BOTS_ROOT = os.environ.get('PULLBACK_BOTS_ROOT', '/workspace/pullback_bots')
DEFAULTS = dict(
    symbol='EURUSD', tf='5', double=False, chain=1, rr=2.0, double_rr_first=1.0, buffer_atr=0.1, cancel_atr=5.0,
    sl_mode='max', atr_period=14,
    max_minutes=None,            # run ends (done reason=max_minutes) this many minutes after the order time
    until=None,                  # 'YYYY-MM-DD HH:MM' Tehran (or 'HH:MM' = next such time) -> done reason=until
    stop_after_stopout=False,    # chain: end the run when an already-filled position hits its SL before the next entry
    language='fa',               # readable line: 'fa' or 'en'
    exit_on=['A_set_start', 'pending_placed', 'pending_moved', 'triggered', 'A_reset_cancel', 'no_entry', 'done', 'feed_error'],
    poll_first_delay=0.3, poll_retry=0.5, poll_giveup=25.0, feed_error_after_s=180.0,
    live_max_wait_s=None,        # default for --max-wait
    webhook=True,                # POST actionable events if <bot>/webhook.env exists
    chart_on_replay=True, history_bars=400)
ACTIONABLE = set(DEFAULTS['exit_on'])

def die(msg, code=1):
    print(json.dumps(dict(type='error', error=msg), ensure_ascii=False)); print('» ERROR: ' + msg); sys.exit(code)

# ---------------- config ----------------
def load_config(bot, overrides):
    bdir = os.path.join(BOTS_ROOT, bot)
    path = os.path.join(bdir, 'config.json')
    if not os.path.exists(path): die('no config: %s' % path)
    cfg = dict(DEFAULTS)
    try: user = json.load(open(path))
    except Exception as e: die('bad config.json: %s' % e)
    unknown = [k for k in user if k not in DEFAULTS and not k.startswith('_')]
    cfg.update({k: v for k, v in user.items() if not k.startswith('_')})
    for o in overrides or []:
        if '=' not in o: die('override must be key=value: %s' % o)
        k, v = o.split('=', 1); k = k.strip()
        if k not in DEFAULTS: die('unknown override key %s (known: %s)' % (k, ', '.join(DEFAULTS)))
        try: v = json.loads(v)
        except Exception: pass
        cfg[k] = v
    if unknown: sys.stderr.write('warning: unknown config keys ignored: %s\n' % unknown)
    return bdir, cfg

def make_engine(cfg, side, ref_price):
    tv = feed.resolve(cfg['symbol']); iv, tfs, lab = feed.parse_tf(cfg['tf'])
    dec = feed.decimals(ref_price) + 1
    e = PullbackEngine(tv, side, lab, rr=float(cfg['rr']), buffer=float(cfg['buffer_atr']), double=bool(cfg['double']),
                       chain=int(cfg['chain']), cancel_atr=float(cfg['cancel_atr']), sl_mode=cfg['sl_mode'], tf_seconds=tfs,
                       dec=dec, double_rr_first=float(cfg['double_rr_first']), atr_period=int(cfg['atr_period']))
    return e, tv, iv, tfs, dec

def deadline_of(cfg, start_ts):
    d = []
    if cfg.get('max_minutes'): d.append(start_ts + float(cfg['max_minutes']) * 60)
    u = cfg.get('until')
    if u:
        u = str(u).strip()
        if len(u) <= 5:
            base = datetime.datetime.fromtimestamp(start_ts, TZ); hh, mm = map(int, u.split(':'))
            t = base.replace(hour=hh, minute=mm, second=0, microsecond=0)
            if t.timestamp() <= start_ts: t += datetime.timedelta(days=1)
            d.append(t.timestamp())
        else: d.append(feed.parse_tehran(u))
    return min(d) if d else None

# ---------------- policy layer on top of the engine ----------------
def policy_after_bar(eng, run, bar, events, tfs):
    """runner policies: stop_after_stopout (tracks filled positions only for this), deadline by candle close time."""
    cfg = run['config']; out = list(events)
    for e in events:
        if e['type'] == 'triggered':
            run.setdefault('filled', []).append(dict(entry=e['fill_price'], sl=e['sl'], leg=e['leg'], ts=e['candle_ts'], open=True))
    if not eng.finished and cfg.get('stop_after_stopout'):
        for p in run.get('filled', []):
            if not p['open'] or bar[0] <= p['ts']: continue
            hit = bar[2] >= p['sl'] if eng.side == 'SELL' else bar[3] <= p['sl']
            if hit:
                p['open'] = False; eng.finished = True
                out.append(eng._ev('done', bar, reason='stopout: leg %d position hit SL %s (stop_after_stopout)' % (p['leg'], p['sl']),
                                   total_positions=len(eng.positions)))
                break
    if not eng.finished and run.get('deadline_ts') and bar[0] + tfs >= run['deadline_ts']:
        eng.finished = True
        out.append(eng._ev('done', bar, reason='deadline (%s) reached' % tstr(run['deadline_ts']), total_positions=len(eng.positions)))
    return out

def is_actionable(e, exit_on):
    t = e['type']
    if t == 'A_reset': return 'A_reset_cancel' in exit_on and e.get('pending_cancelled')
    if t == 'A_set': return 'A_set_start' in exit_on and e.get('leg') == 1 and e.get('start')
    return t in exit_on

# ---------------- output ----------------
def emit(run, e, dec, bdir, post):
    e = dict(e); e.setdefault('run_id', run.get('run_id')); e['bot'] = run['bot']
    e['emitted_at'] = datetime.datetime.now(TZ).isoformat(timespec='seconds')
    e['pending_now'] = run.get('eng_pending')
    print(json.dumps(e, ensure_ascii=False))
    line = fmt.fmt_event_fa(e, dec) if run['config'].get('language') == 'fa' else fmt.fmt_event(e, dec) if 'leg' in e else json.dumps(e)
    print('» ' + line); sys.stdout.flush()
    if run.get('run_dir'):
        with open(os.path.join(run['run_dir'], 'events.jsonl'), 'a') as f: f.write(json.dumps(e, ensure_ascii=False) + '\n')
    if post and run['config'].get('webhook', True):
        st = webhook.post_webhook(e, os.path.join(bdir, 'webhook.env'))
        if run.get('run_dir'):
            with open(os.path.join(run['run_dir'], 'run.log'), 'a') as f: f.write('%s webhook %s -> %s\n' % (time.strftime('%F %T'), e['type'], st))
    run['last_event'] = dict(type=e['type'], candle_time_tehran=e.get('candle_time_tehran'), emitted_at=e['emitted_at'])

def save(run, eng):
    run['engine'] = eng.to_state(); run['saved_at'] = datetime.datetime.now(TZ).isoformat(timespec='seconds')
    tmp = os.path.join(run['run_dir'], 'state.json.tmp')
    with open(tmp, 'w') as f: json.dump(run, f, ensure_ascii=False); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, os.path.join(run['run_dir'], 'state.json'))

def log(run, msg):
    with open(os.path.join(run['run_dir'], 'run.log'), 'a') as f: f.write('%s %s\n' % (time.strftime('%F %T'), msg))

# ---------------- replay ----------------
def cmd_replay(a, bdir, cfg):
    if not a.side: die('--side is required')
    st = feed.parse_tehran(a.start)
    iv, tfs, lab = feed.parse_tf(cfg['tf']); tv = feed.resolve(cfg['symbol'])
    n = min(5000, int((time.time() - st) // tfs) + int(cfg['history_bars']))
    bars, _ = feed.fetch_closed(tv, iv, tfs, n)
    k = max([i for i, b in enumerate(bars) if b[0] + tfs <= st], default=None)
    if k is None or k < 30: die('not enough history before --start')
    eng, tv, iv, tfs, dec = make_engine(cfg, a.side, bars[k][4])
    run = dict(bot=a.bot, run_id='replay', config=cfg, deadline_ts=deadline_of(cfg, st), run_dir=None)
    print('# replay %s %s %s bot=%s order %s -> order-time candle %s | chain=%s double=%s rr=%s buffer=%s sl_mode=%s cancel_atr=%s'
          % (tv, a.side.upper(), lab, a.bot, a.start, tstr(bars[k][0]), cfg['chain'], cfg['double'], cfg['rr'], cfg['buffer_atr'],
             cfg['sl_mode'], cfg['cancel_atr']))
    events = eng.start(bars[:k + 1]); last_i = k
    for i in range(k + 1, len(bars)):
        if eng.finished: break
        ev = policy_after_bar(eng, run, bars[i], eng.feed(bars[i]), tfs)
        events += ev
        if ev: last_i = i
    for e in events:
        print(json.dumps(e, ensure_ascii=False) if a.json else fmt.fmt_event(e, dec))
    if not eng.finished: print('%s  (end of data: still running, phase=%s)' % (tstr(bars[-1][0]), eng.phase))
    if cfg.get('chart_on_replay') and not a.no_chart:
        from pullback_core.chart import chart
        os.makedirs(os.path.join(bdir, 'charts'), exist_ok=True)
        path = os.path.join(bdir, 'charts', 'replay_%s_%s_%s.png' % (a.side.upper(), lab, a.start.replace(' ', '_').replace(':', '')))
        lo = max(0, k - 20); hi = min(len(bars), (last_i if eng.finished else len(bars) - 1) + 15)
        chart(bars[lo:hi], eng.trace, events, path, '%s %s %s bot=%s order %s chain=%s%s' % (tv, lab, a.side.upper(), a.bot, a.start,
              cfg['chain'], ' double' if cfg['double'] else ''), tfs, dec)
        print('# chart:', path)

# ---------------- live ----------------
def fetch_with_retry(run, tv, iv, tfs, n, cfg, deadline_wall=None):
    """returns (bars, forming) or raises TimeoutError after feed_error_after_s of continuous failure."""
    t0 = time.time(); delay = 1.0; last = None
    while True:
        try:
            bars, forming = feed.fetch_closed(tv, iv, tfs, n)
            if not bars: raise RuntimeError('no bars')
            return bars, forming
        except Exception as ex:
            last = '%s: %s' % (type(ex).__name__, ex)
            if run.get('run_dir'): log(run, 'fetch error ' + last)
            if time.time() - t0 > float(cfg['feed_error_after_s']): raise TimeoutError(last)
            time.sleep(delay); delay = min(5.0, delay * 1.5)

def acquire_lock(run_dir):
    f = open(os.path.join(run_dir, 'lock'), 'a+')
    try: fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError: return None
    return f

def cmd_live(a, bdir, cfg):
    runs = os.path.join(bdir, 'runs'); os.makedirs(runs, exist_ok=True)
    if a.resume:
        rd = os.path.join(runs, a.resume)
        if not os.path.exists(os.path.join(rd, 'state.json')): die('run not found: %s' % a.resume, 2)
        lk = acquire_lock(rd)
        if not lk: die('run %s is already running in another process' % a.resume, 2)
        run = json.load(open(os.path.join(rd, 'state.json')))
        if run['status'] != 'active': die('run %s is %s (not active)' % (a.resume, run['status']), 2)
        if a.override: sys.stderr.write('note: --override ignored on --resume (config is frozen per run)\n')
        cfg = run['config']; run['run_dir'] = rd
        eng = PullbackEngine.from_state(run['engine'])
        tv = eng.symbol; iv, tfs, lab = feed.parse_tf(cfg['tf']); dec = eng.dec
    else:
        if not a.side: die('--side is required for a new run')
        tv = feed.resolve(cfg['symbol']); iv, tfs, lab = feed.parse_tf(cfg['tf'])
        now = time.time()
        run_id = '%s_%s_%s' % (a.side.upper(), lab, datetime.datetime.now(TZ).strftime('%Y%m%d-%H%M%S'))
        rd = os.path.join(runs, run_id); os.makedirs(rd)
        lk = acquire_lock(rd)
        run = dict(run_id=run_id, bot=a.bot, side=a.side.upper(), symbol=tv, tf=lab, config=cfg, status='active',
                   created_at=datetime.datetime.now(TZ).isoformat(timespec='seconds'), created_ts=now,
                   deadline_ts=deadline_of(cfg, now), run_dir=rd, filled=[])
        try: bars, _ = fetch_with_retry(run, tv, iv, tfs, int(cfg['history_bars']), cfg)
        except TimeoutError as ex:
            run['status'] = 'failed'; json.dump(run, open(os.path.join(rd, 'state.json'), 'w')); die('feed unavailable: %s' % ex)
        eng, tv, iv, tfs, dec = make_engine(cfg, a.side, bars[-1][4])
        evs = eng.start(bars); run['last_ts'] = bars[-1][0]
        for e in evs: e['start'] = True
        run['eng_pending'] = eng.pending
        stop = False
        for e in evs:
            emit(run, e, dec, bdir, post=is_actionable(e, cfg['exit_on'])); stop |= bool(is_actionable(e, cfg['exit_on']))
        save(run, eng); log(run, 'new run, order-time candle %s' % tstr(bars[-1][0]))
        if stop: sys.exit(0)
    run['pid'] = os.getpid(); save(run, eng)
    def on_term(sig, frm):
        log(run, 'terminated by signal %d' % sig); sys.exit(0)
    signal.signal(signal.SIGTERM, on_term)
    max_wait = a.max_wait if a.max_wait is not None else cfg.get('live_max_wait_s')
    t_start = time.time(); exit_on = cfg['exit_on']

    def finish_run(e_list):
        run['status'] = 'finished'; run['pid'] = None; run['eng_pending'] = None; save(run, eng)

    while True:
        # wall-clock deadline (also covers closed markets)
        if run.get('deadline_ts') and time.time() >= run['deadline_ts'] and not eng.finished:
            eng.finished = True; lb = (run['last_ts'], 0, 0, 0, 0)
            e = eng._ev('done', lb, reason='deadline (%s) reached' % tstr(run['deadline_ts']), total_positions=len(eng.positions))
            run['eng_pending'] = None; emit(run, e, dec, bdir, post=True); finish_run([e]); sys.exit(0)
        gap = int((time.time() - run['last_ts']) // tfs)
        try:
            bars, forming = fetch_with_retry(run, tv, iv, tfs, max(100, gap + 60), cfg)
        except TimeoutError as ex:
            e = dict(type='feed_error', symbol=tv, side=eng.side, tf=lab, error=str(ex), failing_for_s=cfg['feed_error_after_s'])
            emit(run, e, dec, bdir, post=True); run['pid'] = None; save(run, eng)
            sys.exit(0 if 'feed_error' in exit_on else 1)
        new = [b for b in bars if b[0] > run['last_ts']]
        if gap > 4900: log(run, 'WARNING gap of %d bars > fetch limit; oldest missing bars skipped' % gap)
        stop = False
        for j, b in enumerate(new):
            evs = policy_after_bar(eng, run, b, eng.feed(b), tfs)
            run['last_ts'] = b[0]; run['eng_pending'] = eng.pending
            behind = len(new) - j - 1
            for e in evs:
                act = is_actionable(e, exit_on)
                if behind: e['catching_up_bars_left'] = behind
                e['stale'] = (time.time() - (b[0] + tfs)) > 2 * tfs
                emit(run, e, dec, bdir, post=bool(act)); stop |= bool(act)
            save(run, eng)
            if eng.finished: finish_run(evs); sys.exit(0)
            if stop: run['pid'] = None; save(run, eng); sys.exit(0)
        # wait for the next candle close
        if max_wait is not None and time.time() - t_start >= float(max_wait):
            print(json.dumps(dict(type='waiting', run_id=run['run_id'], bot=run['bot'], last_candle_tehran=tstr(run['last_ts']),
                                  pending_now=eng.pending, phase=eng.phase), ensure_ascii=False))
            print('» ' + ('هنوز رویدادی نیست؛ دوباره --resume %s اجرا کن' % run['run_id'] if cfg.get('language') == 'fa'
                          else 'no event yet; run --resume %s again' % run['run_id']))
            run['pid'] = None; save(run, eng); sys.exit(4)
        now = time.time()
        B = (int(now // tfs) + 1) * tfs if tfs <= 3600 else max(run['last_ts'] + 2 * tfs, now + 60)
        while B <= run['last_ts'] + tfs: B += tfs
        wake = B + float(cfg['poll_first_delay'])
        if max_wait is not None: wake = min(wake, t_start + float(max_wait))
        if run.get('deadline_ts'): wake = min(wake, run['deadline_ts'])
        time.sleep(max(0.0, wake - time.time()))
        # quick retries until the just-closed candle is available (or give up: market closed)
        t_close = B
        while time.time() < t_close + float(cfg['poll_giveup']) and time.time() >= t_close:
            try: bars, forming = feed.fetch_closed(tv, iv, tfs, 100)
            except Exception as ex: log(run, 'fetch error %s' % ex); time.sleep(1); continue
            if bars and bars[-1][0] > run['last_ts'] and (forming or time.time() - t_close >= 1.0): break
            time.sleep(float(cfg['poll_retry']))

# ---------------- status / cancel ----------------
def run_summary(rd):
    r = json.load(open(os.path.join(rd, 'state.json'))); e = r.get('engine', {})
    alive = False
    if r.get('pid'):
        try: os.kill(r['pid'], 0); alive = True
        except Exception: alive = False
    eng = PullbackEngine.from_state(e) if e else None
    return dict(run_id=r['run_id'], side=r.get('side'), symbol=r.get('symbol'), tf=r.get('tf'), status=r['status'],
                process_running=alive, created_at=r.get('created_at'),
                last_processed_candle_tehran=tstr(r['last_ts']) if r.get('last_ts') else None,
                phase=('finished' if eng.finished else eng.phase) if eng else None, leg=eng.leg if eng else None, entries=eng.entries if eng else None,
                A=eng._p(eng.A) if eng and eng.A is not None else None, pending=eng.pending if eng else None,
                last_event=r.get('last_event'), deadline_tehran=tstr(r['deadline_ts']) if r.get('deadline_ts') else None,
                config=dict((k, r['config'].get(k)) for k in ('symbol', 'tf', 'double', 'chain', 'rr', 'buffer_atr', 'cancel_atr', 'sl_mode')))

def cmd_status(a, bdir, cfg):
    runs = os.path.join(bdir, 'runs')
    ids = [a.run_id] if a.run_id else sorted(os.listdir(runs)) if os.path.isdir(runs) else []
    if not ids: print(json.dumps(dict(type='status', bot=a.bot, runs=[]))); print('» no runs'); return
    for rid in ids:
        rd = os.path.join(runs, rid)
        if not os.path.exists(os.path.join(rd, 'state.json')):
            if a.run_id: die('run not found: %s' % rid, 2)
            continue
        s = run_summary(rd); s['type'] = 'status'; s['bot'] = a.bot
        print(json.dumps(s, ensure_ascii=False))
        p = s['pending']
        print('» %s %s %s %s | last candle %s | leg %s entries %s | %s' % (rid, s['status'], s['side'], s['tf'], s['last_processed_candle_tehran'],
              s['leg'], s['entries'], ('PENDING STOP %s SL %s TP %s' % (p['entry'], p['sl'], p['tp'])) if p else 'phase=%s A=%s' % (s['phase'], s['A'])))

def cmd_cancel(a, bdir, cfg):
    rd = os.path.join(bdir, 'runs', a.run_id); sp = os.path.join(rd, 'state.json')
    if not os.path.exists(sp): die('run not found: %s' % a.run_id, 2)
    r = json.load(open(sp))
    if r['status'] != 'active': die('run %s is already %s' % (a.run_id, r['status']), 2)
    if r.get('pid'):
        try: os.kill(r['pid'], signal.SIGTERM)
        except Exception: pass
    lk = None
    for _ in range(40):
        lk = acquire_lock(rd)
        if lk: break
        time.sleep(0.25)
    if not lk: die('could not stop the running process of %s' % a.run_id)
    r = json.load(open(sp)); r['run_dir'] = rd
    eng = PullbackEngine.from_state(r['engine']); had = eng.pending; eng.finished = True
    r['status'] = 'cancelled'; r['pid'] = None; r['eng_pending'] = None
    e = eng._ev('done', (r['last_ts'], 0, 0, 0, 0), reason='cancelled by bot/user', cancelled_pending=had, total_positions=len(eng.positions))
    emit(r, e, eng.dec, bdir, post=True); save(r, eng)

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--bot', required=True); ap.add_argument('--side', type=str.upper, choices=['BUY', 'SELL'])
    ap.add_argument('--override', action='append', default=[], metavar='KEY=VALUE')
    sp = ap.add_subparsers(dest='mode', required=True)
    r = sp.add_parser('replay'); r.add_argument('--start', required=True); r.add_argument('--no-chart', action='store_true'); r.add_argument('--json', action='store_true')
    l = sp.add_parser('live'); l.add_argument('--resume'); l.add_argument('--max-wait', type=float)
    s = sp.add_parser('status'); s.add_argument('run_id', nargs='?')
    c = sp.add_parser('cancel'); c.add_argument('run_id')
    a = ap.parse_args()
    bdir, cfg = load_config(a.bot, a.override)
    dict(replay=cmd_replay, live=cmd_live, status=cmd_status, cancel=cmd_cancel)[a.mode](a, bdir, cfg)

if __name__ == '__main__':
    main()
