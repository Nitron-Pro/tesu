"""THIN WRAPPER around /workspace/pullback_core (legacy replay.py / live.py keep working). Do not add logic here."""
import os, sys; sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, '/workspace/pullback_core')
from pullback_core import tvfeed                                   # noqa: F401
from pullback_core.feed import TZ, parse_tf, resolve, decimals, fetch_closed, parse_tehran   # noqa: F401
from pullback_core.fmt import fmt_event                            # noqa: F401
from pullback_core.chart import chart                              # noqa: F401
from pullback_core import webhook as _wh

def post_webhook(obj, env_path=os.path.join(HERE, 'webhook.env')):
    return _wh.post_webhook(obj, env_path)
