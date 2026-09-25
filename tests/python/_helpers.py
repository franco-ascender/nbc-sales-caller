"""Shared bits for the ownercell tests: repo root on sys.path, fixture paths, a temp work dir."""
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

FIXTURES = os.path.join(ROOT, "tests", "fixtures")


def tmpdir() -> str:
    return tempfile.mkdtemp(prefix="ownercell-test-")
