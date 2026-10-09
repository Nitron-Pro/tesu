#!/bin/bash
# OWNED BY SEGARO. Re-locks the core read-only (files and dirs) after an owner update. Runs the tests first.
cd /workspace/pullback_core || exit 1
find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null
python3 tests/test_engine.py >/tmp/pullback_core_tests.txt 2>&1 || { cat /tmp/pullback_core_tests.txt; echo "TESTS FAILED - still unlocked"; exit 1; }
chmod -R a-w /workspace/pullback_core && chmod a+rx /workspace/pullback_core/*.sh /workspace/pullback_core/run_bot.py && echo "pullback_core LOCKED (read-only), $(grep -c PASS /tmp/pullback_core_tests.txt) tests passed"
