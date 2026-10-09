#!/usr/bin/env python3
"""Block until any watched run has unsent Trador lines or its watcher process exited. Prints them. Usage: relay_wait.py RUN_ID..."""
import sys, os, json, time, subprocess
S = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'state')
runs = sys.argv[1:]
def alive(r): return subprocess.run(['pgrep', '-f', 'run-id %s' % r], capture_output=True).returncode == 0
while True:
    out = []; ended = []
    for r in runs:
        f = os.path.join(S, r + '.trador.jsonl'); sent = os.path.join(S, r + '.sent')
        lines = open(f).read().splitlines() if os.path.exists(f) else []
        n = int(open(sent).read() or 0) if os.path.exists(sent) else 0
        for l in lines[n:]: out.append((r, json.loads(l)))
        if not alive(r): ended.append(r)
    if out or ended:
        for r, j in out: print('NEW', r, j['seq'], j['time_tehran'], '::', j['line'])
        for r in ended: print('ENDED', r)
        sys.exit(0)
    time.sleep(2)
