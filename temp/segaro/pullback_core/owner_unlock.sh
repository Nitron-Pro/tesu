#!/bin/bash
# OWNED BY SEGARO. Copy bots must never run this. Makes the core writable for an owner update.
chmod -R u+w /workspace/pullback_core && echo "pullback_core UNLOCKED (remember: ./owner_lock.sh after editing + running tests)"
