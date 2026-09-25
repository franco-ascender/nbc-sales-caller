"""Small helpers shared by several steps (ported from engine.py's helpers block).

Why here: p10(), street_ok(), save() and the work directory were module globals in
engine.py; every step module needs them and none owns them.
"""
import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from .errors import Frozen
from .http import UA

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOLLFREE = {"800", "888", "877", "866", "855", "844", "833", "822"}
UNIT_CENTS = {"scrape": 0.37, "verify": 0.7, "trace": 7.0}  # engine.py P_SCRAPE/P_VERIFY/P_TRACE in cents


def work_dir() -> str:
    """OWNERCELL_WORK, then engine.py's ENGINE_WORK, then ./work."""
    w = os.environ.get("OWNERCELL_WORK") or os.environ.get("ENGINE_WORK") or os.path.join(os.getcwd(), "work")
    os.makedirs(w, exist_ok=True)
    return w


def load_env() -> Dict[str, str]:
    """Process env wins; then .env files. Values are never printed."""
    env: Dict[str, str] = {}
    for cand in (os.path.join(ROOT, ".env.local"), os.path.join(ROOT, ".env"), os.path.join(ROOT, "handoff", ".env")):
        if os.path.exists(cand):
            with open(cand) as f:
                for line in f:
                    if "=" in line and not line.startswith("#"):
                        k, v = line.strip().split("=", 1)
                        env.setdefault(k.strip(), v.strip().strip('"'))
    env.update({k: v for k, v in os.environ.items() if k.endswith("_API_KEY")})
    return env


def require_key(env: Dict[str, str], name: str, step: str) -> str:
    key = env.get(name)
    if not key:
        raise Frozen(step, "%s missing from environment or .env" % name)
    return key


def p10(raw: Optional[str]) -> Optional[str]:
    d = re.sub(r"\D", "", raw or "")
    if len(d) == 11 and d[0] == "1":
        d = d[1:]
    return d if len(d) == 10 and d[0] not in "01" else None


def street_ok(a: Optional[str]) -> bool:
    return bool(a) and bool(re.match(r"^\d+ +[A-Za-z0-9]", a.strip())) and not re.search(
        r"(?i)\b(ste|suite|unit|apt|floor|fl|pmb)\b|#|p\.?o\.? ?box", a)


def save(tag: str, kind: str, obj: Any, work: Optional[str] = None) -> str:
    p = os.path.join(work or work_dir(), "%s_%s.json" % (kind, tag))
    with open(p, "w") as f:
        json.dump(obj, f, indent=1)
    print("  -> %s  (%d records)" % (p, len(obj)))
    return p


def load_json(path: str) -> Any:
    with open(path) as f:
        return json.load(f)


def show_addresses(picks: List[Dict[str, Any]], k: int = 3) -> List[Dict[str, Any]]:
    print("ADDRESS CHECK (eyeball before any trace):")
    for p in picks[:k]:
        print("   %s %s | %s | %s %s %s" % (p["first"], p["last"], p.get("street"), p.get("city"), p.get("state"), p.get("zip", "")))
    bad = [p for p in picks if not street_ok(p.get("street"))]
    if bad:
        print("   WARNING: %d records have a suspicious street (e.g. %r). They are dropped." % (len(bad), bad[0].get("street")))
    return [p for p in picks if street_ok(p.get("street"))]


def download(url: str, path: str, step: str = "download") -> None:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
    except urllib.error.HTTPError as e:
        raise Frozen(step, "HTTP %d downloading %s" % (e.code, url.split("?")[0]))
    except OSError as e:
        raise Frozen(step, "%s downloading %s" % (type(e).__name__, url.split("?")[0]))
