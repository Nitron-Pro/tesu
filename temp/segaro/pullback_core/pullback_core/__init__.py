# OWNED BY SEGARO. Copy bots must never edit.
"""pullback_core: shared pullback stop-entry detection core (signals only, never trades).
Import from bots with:  sys.path.insert(0, '/workspace/pullback_core'); from pullback_core import PullbackEngine"""
import sys as _s; _s.dont_write_bytecode = True
from .engine import PullbackEngine, WilderATR, tstr
from . import feed, fmt, webhook
__version__ = '1.0.0'
