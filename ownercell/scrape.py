"""Lane A: Outscraper Google Maps scrape, filters, then verify (port of engine.py cmd_scrape).

Why the filters live in their own function: the brain's recipe A "filter" step lists them
(no phone, toll-free, duplicates, non-operational, chains, allowlist) and the sample gate
needs their counts without re-scraping.
"""
import re
import time
from collections import Counter
from typing import Any, Callable, Dict, List, Optional, Tuple

from . import http
from .common import TOLLFREE, UNIT_CENTS, p10
from .errors import Frozen

VENDOR = "outscraper"
CHAIN = re.compile(r"(?i)\b(franchise|corporate|headquarters|inc\.? national|nationwide)\b")
SEARCH_URL = "https://api.outscraper.cloud/maps/search-v3?"


def outscraper(queries: List[str], limit: int, key: str, meter: Any, get: Optional[Callable[..., Any]] = None,
               sleep: Callable[[float], None] = time.sleep, unit_cents: float = UNIT_CENTS["scrape"]) -> List[Dict[str, Any]]:
    """Async Outscraper job: submit, poll up to 12 minutes, charge the rows actually returned."""
    get = get or http.get_json
    gate = meter.check("scrape", VENDOR, len(queries) * limit, unit_cents)
    if not gate.allowed:
        raise Frozen("scrape", "cap before scrape (%s): %d cents remaining" % (gate.reason, gate.remaining_cents), {"cursor": 0})
    parts = [("query", q) for q in queries] + [("limit", str(limit)), ("async", "true"), ("region", "US")]
    headers = {"X-API-KEY": key}
    d = get(SEARCH_URL + http.encode(parts), headers=headers, timeout=90, step="scrape")
    loc = d.get("results_location") if isinstance(d, dict) else None
    if not loc:
        raise Frozen("scrape", "Outscraper returned no results_location: %s" % http.body_head(str(d), headers))
    for _ in range(90):
        sleep(8)
        r = get(loc, headers=headers, step="scrape")
        status = r.get("status") if isinstance(r, dict) else None
        if status == "Success":
            rows: List[Dict[str, Any]] = []
            for b in r.get("data", []):
                rows.extend(b if isinstance(b, list) else [b])
            meter.charge("scrape", VENDOR, len(rows), unit_cents)  # bug 5 fix: actual rows, not queries*limit
            return rows
        if status in ("Error", "Failed"):
            raise Frozen("scrape", "Outscraper job failed: %s" % http.body_head(str(r), headers), {"results_location": loc})
    raise Frozen("scrape", "Outscraper job timed out after 12 minutes", {"results_location": loc})


def allow_pattern(kw: str, allow: Optional[str]) -> "re.Pattern[str]":
    if allow:
        return re.compile(allow, re.I)
    words = [re.escape(w) for w in kw.lower().replace("contractor", "").split() if len(w) > 3]
    return re.compile("|".join(words) or "x^", re.I)


def filter_rows(rows: List[Dict[str, Any]], allow: "re.Pattern[str]") -> Tuple[List[Dict[str, Any]], Counter, int]:
    """engine.py's filter chain, unchanged. Returns (kept, drop counts, kept-without-category)."""
    seen, biz, drops, unjudged = set(), [], Counter(), 0
    for r in rows:
        p = p10(r.get("phone"))
        if not p:
            drops["no_phone"] += 1
            continue
        if p in seen:
            drops["dup"] += 1
            continue
        if p[:3] in TOLLFREE:
            drops["tollfree"] += 1
            continue
        if (r.get("business_status") or "OPERATIONAL") != "OPERATIONAL":
            drops["closed"] += 1
            continue
        if CHAIN.search(r.get("name") or ""):
            drops["chain"] += 1
            continue
        hay = " ".join(str(r.get(k) or "") for k in ("category", "subtypes", "name")).lower()
        if not allow.search(hay):
            if r.get("category") or r.get("subtypes"):
                drops["off-category"] += 1
                continue
            unjudged += 1  # Google gave no category: kept, counted
        seen.add(p)
        biz.append({"company": r.get("name"), "phone": p, "city": r.get("city"), "state": r.get("state_code"), "street": r.get("street"),
                    "zip": r.get("postal_code"), "rating": r.get("rating"), "reviews": r.get("reviews"),
                    "maps": "https://www.google.com/maps/place/?q=place_id:%s" % r.get("place_id") if r.get("place_id") else "",
                    "website": r.get("website"), "category": r.get("category"), "owner_first": "", "owner_last": "", "email": "", "lane": "A"})
    return biz, drops, unjudged


def estimate_line(label: str, n: int, unit_cents: float, meter: Any) -> str:
    return "ESTIMATE: %s: %d x $%.4f = $%.2f   (%s)" % (label, n, unit_cents / 100, n * unit_cents / 100, meter.line())
