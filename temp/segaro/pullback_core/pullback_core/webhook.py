# OWNED BY SEGARO. Copy bots must never edit.
"""Optional JSON webhook poster (WEBHOOK_URL / WEBHOOK_KEY from an env file)."""
import os, json, time

def post_webhook(obj, env_path):
    """POST obj as JSON if webhook.env exists (WEBHOOK_URL, WEBHOOK_KEY). Returns status string; never raises."""
    if not os.path.exists(env_path): return 'no webhook.env (logged only)'
    try:
        env = {}
        for ln in open(env_path):
            ln = ln.strip()
            if ln and not ln.startswith('#') and '=' in ln:
                k, v = ln.split('=', 1); env[k.strip().replace('export ', '')] = v.strip().strip('"\'')
        url, key = env.get('WEBHOOK_URL'), env.get('WEBHOOK_KEY')
        if not url: return 'webhook.env has no WEBHOOK_URL'
        import urllib.request, urllib.error
        hdr = {'Content-Type': 'application/json'}
        if key: hdr['Authorization'] = 'Bearer ' + key
        last = None
        for a in range(3):
            try:
                req = urllib.request.Request(url, data=json.dumps(obj, ensure_ascii=False).encode(), method='POST', headers=hdr)
                with urllib.request.urlopen(req, timeout=15) as r: return 'HTTP %d' % r.status
            except urllib.error.HTTPError as e: last = 'HTTP %d' % e.code
            except Exception as e: last = 'error %s' % type(e).__name__
            time.sleep(2 * (a + 1))
        return last
    except Exception as e:
        return 'error %s' % type(e).__name__

