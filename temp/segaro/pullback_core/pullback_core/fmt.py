# OWNED BY SEGARO. Copy bots must never edit.
"""Readable event lines: English (fmt_event) and Persian (fmt_event_fa)."""
from .feed import TZ

def fmt_event(e, dec):
    f = lambda x: ('%.*f' % (dec, x)) if isinstance(x, (int, float)) else '-'
    tp = '/'.join(f(t) for t in e['tp']) if e.get('tp') else '-'
    base = '%s  %-3s %-4s leg%d  %-14s A=%s ATR=%s' % (e['candle_time_tehran'], e['tf'], e['side'], e['leg'], e['type'],
                                                     f(e['A']), ('%.*f' % (dec + 1, e['atr'])) if e.get('atr') else '-')
    t = e['type']
    if t in ('pending_placed', 'pending_moved'):
        base += '  STOP %s  SL %s  TP %s' % (f(e['entry']), f(e['sl']), tp)
        if t == 'pending_moved': base += '  (was STOP %s SL %s; %s)' % (f(e['previous_entry']), f(e['previous_sl']), e['reason'])
    elif t == 'triggered':
        base += '  FILLED @ %s  SL %s  TP %s  entries=%d' % (f(e['fill_price']), f(e['sl']), tp, e['entries_so_far'])
        if e.get('notes'): base += '  [' + '; '.join(e['notes']) + ']'
    elif t == 'A_reset':
        base += '  (was %s%s)' % (f(e['previous_A']), ', pending cancelled' if e['pending_cancelled'] else '')
        if e.get('note'): base += '  ' + e['note']
    elif t == 'no_entry':
        base += '  lowest/highest since A %s beyond threshold %s' % (f(e['lowest_since_A']), f(e['threshold']))
    elif t in ('done', 'A_set'):
        base += '  ' + str(e.get('reason') or e.get('note') or '')
    return base


_FA_T = {'A_set': 'مرجع A تعیین شد', 'A_reset': 'A جابه‌جا شد (ریست)', 'pending_placed': 'سفارش استاپ گذاشته شد',
         'pending_moved': 'سفارش استاپ جابه‌جا شد', 'triggered': 'سفارش فعال شد (ورود)', 'no_entry': 'بدون ورود (لغو)',
         'done': 'پایان', 'feed_error': 'خطای دیتا', 'feed_recovered': 'دیتا برگشت'}
_FA_SIDE = {'BUY': 'خرید', 'SELL': 'فروش'}

def fmt_event_fa(e, dec):
    """Persian one-liner (prices/times in Latin digits so they can be copied)."""
    f = lambda x: ('%.*f' % (dec, x)) if isinstance(x, (int, float)) else '-'
    t = e.get('type'); side = e.get('side', '')
    parts = ['[%s]' % _FA_T.get(t, t), '%s %s %s' % (e.get('symbol', ''), e.get('tf', ''), _FA_SIDE.get(side, side))]
    if e.get('leg'): parts.append('مرحله %s' % e['leg'])
    if e.get('candle_time_tehran'): parts.append('کندل %s تهران' % e['candle_time_tehran'])
    if t in ('pending_placed', 'pending_moved'):
        parts.append('%s STOP %s | حد ضرر %s | حد سود %s' % (side, f(e['entry']), f(e['sl']), ' / '.join(f(x) for x in e['tp'] or [])))
        if t == 'pending_moved': parts.append('(قبلی: STOP %s، SL %s)' % (f(e.get('previous_entry')), f(e.get('previous_sl'))))
    elif t == 'triggered':
        parts.append('ورود %s | حد ضرر %s | حد سود %s | ورود شماره %s' % (f(e['fill_price']), f(e['sl']), ' / '.join(f(x) for x in e['tp'] or []), e.get('entries_so_far')))
    elif t in ('A_set', 'A_reset'):
        parts.append('A=%s' % f(e.get('A')))
        if t == 'A_reset' and e.get('pending_cancelled'): parts.append('سفارش قبلی لغو شد')
        if e.get('a_candle_counts_as_move'): parts.append('کندل A خودش حرکت حساب شد')
    elif t == 'no_entry':
        parts.append('قیمت %s ATR از A دور شد بدون ورود' % e.get('cancel_atr', ''))
    elif t == 'done':
        parts.append('دلیل: %s' % e.get('reason', ''))
    elif t in ('feed_error', 'feed_recovered'):
        parts.append(str(e.get('error', '')))
    return ' | '.join(parts)
