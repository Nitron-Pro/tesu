# OWNED BY SEGARO. Copy bots must never edit.
"""TradingView-like dark candle chart of an engine run (white bullish / red bearish)."""
import datetime
from .feed import TZ

def chart(bars, trace, events, path, title, tfs, dec):
    """TradingView-like dark candle chart. trace: engine per-candle snapshots; events: engine events."""
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    idx = {b[0]: i for i, b in enumerate(bars)}
    fig, ax = plt.subplots(figsize=(max(10, len(bars) * 0.16), 7), dpi=110)
    fig.patch.set_facecolor('#131722'); ax.set_facecolor('#131722')
    w = 0.6
    for i, (ts, o, h, l, c) in enumerate(bars):
        col = '#ffffff' if c > o else '#ef5350' if c < o else '#b2b5be'
        ax.vlines(i, l, h, color=col, linewidth=0.9)
        ax.add_patch(plt.Rectangle((i - w / 2, min(o, c)), w, max(abs(c - o), 1e-9), facecolor=col, edgecolor=col, linewidth=0.5))
    def steps(key, color, label, ls='-'):
        xs, ys = [], []
        for s in trace:
            if s['ts'] not in idx: continue
            v = s[key]
            if key == 'tp': v = s['tp'][-1] if s['tp'] else None
            xs.append(idx[s['ts']]); ys.append(v if v is not None else float('nan'))
        if xs:
            X, Y = [], []
            for j, (x, y) in enumerate(zip(xs, ys)):   # value set AT candle x holds from x to next
                X += [x - 0.5, x + 0.5]; Y += [y, y]
            ax.plot(X, Y, color=color, linewidth=1.3, linestyle=ls, label=label)
    steps('A', '#ffb74d', 'A (reference)', '--'); steps('entry', '#42a5f5', 'stop entry')
    steps('sl', '#ef5350', 'SL', ':'); steps('tp', '#66bb6a', 'TP (RR)', ':')
    for e in events:
        if e['candle_ts'] not in idx: continue
        x = idx[e['candle_ts']]; t = e['type']
        if t == 'triggered':
            x2 = min(len(bars) - 0.5, x + 12)
            for p in e['positions']:
                ax.hlines(p['tp'], x, x2, color='#66bb6a', linewidth=1, alpha=0.8)
                ax.annotate('TP 1:%g' % p['rr'], (x2, p['tp']), color='#66bb6a', fontsize=7, va='center')
            ax.hlines(e['fill_price'], x, x2, color='#42a5f5', linewidth=1, alpha=0.8)
            ax.hlines(e['sl'], x, x2, color='#ef5350', linewidth=1, alpha=0.8)
            ax.plot(x, e['fill_price'], marker='v' if e['side'] == 'SELL' else '^', color='#ffeb3b', markersize=11, zorder=5)
            ax.annotate('FILL %.*f' % (dec, e['fill_price']), (x, e['fill_price']), xytext=(6, -14 if e['side'] == 'SELL' else 8),
                        textcoords='offset points', color='#ffeb3b', fontsize=8)
        elif t in ('A_set', 'A_reset'):
            ax.plot(x, e['A'], marker='o', color='#ffb74d', markersize=5, zorder=5)
        elif t == 'pending_placed':
            ax.plot(x, e['entry'], marker='>', color='#42a5f5', markersize=7, zorder=5)
        elif t == 'no_entry':
            ax.plot(x, bars[x][3] if e['side'] == 'SELL' else bars[x][2], marker='x', color='#e040fb', markersize=10, zorder=5)
    step = max(1, len(bars) // 14)
    ax.set_xticks(range(0, len(bars), step))
    ax.set_xticklabels([datetime.datetime.fromtimestamp(bars[i][0], TZ).strftime('%m-%d\n%H:%M') for i in range(0, len(bars), step)], color='#b2b5be', fontsize=7)
    ax.tick_params(colors='#b2b5be', labelsize=7); ax.yaxis.tick_right()
    ax.grid(color='#2a2e39', linewidth=0.5)
    for sp in ax.spines.values(): sp.set_color('#2a2e39')
    ax.set_xlim(-1, len(bars)); ax.set_title(title, color='#d1d4dc', fontsize=10)
    ax.legend(loc='upper left', facecolor='#1e222d', edgecolor='#2a2e39', labelcolor='#d1d4dc', fontsize=8)
    fig.tight_layout(); fig.savefig(path, facecolor=fig.get_facecolor()); plt.close(fig)
