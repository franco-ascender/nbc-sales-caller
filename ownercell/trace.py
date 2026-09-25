"""BatchData skip trace (Lane B/C) with identity-based result matching.

Why: engine.py zipped the request chunk with results['persons'] by position (bug 1). BatchData
returns persons in its own order and may omit misses, so a wrong person could be assigned to
a name. Here each request carries a key built from normalised name + street + ZIP; the
response is matched on its echoed input (meta/input/request) when present, otherwise on the
returned propertyAddress + name. Unmatched rows stay unknown with trace_status 'unmatched'.
"""
import json
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

from . import http
from .common import UNIT_CENTS
from .meter import Decision

URL = "https://api.batchdata.com/api/v1/property/skip-trace"
VENDOR = "batchdata"
CHUNK = 50


def _norm(s: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


def request_key(first: Any, last: Any, street: Any, zip_code: Any) -> str:
    return "|".join([_norm(first), _norm(last), _norm(street), _norm(zip_code)[:5]])


def build_request(p: Dict[str, Any]) -> Dict[str, Any]:
    return {"propertyAddress": {"street": p.get("street"), "city": p.get("city"), "state": p.get("state"), "zip": p.get("zip", "")},
            "name": {"first": p.get("first"), "last": p.get("last")}}


def _echo_candidates(res: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Places BatchData may echo the input, most trustworthy first; the returned record itself last."""
    out = []
    for path in (("meta", "input"), ("meta", "request"), ("input",), ("request",)):
        node: Any = res
        for k in path:
            node = node.get(k) if isinstance(node, dict) else None
        if isinstance(node, dict):
            out.append(node)
    out.append(res)
    return out


def response_keys(res: Dict[str, Any]) -> List[str]:
    keys = []
    for c in _echo_candidates(res):
        addr = c.get("propertyAddress") or c.get("address") or {}
        name = c.get("name") or {}
        if not isinstance(addr, dict) or not isinstance(name, dict):
            continue
        k = request_key(name.get("first"), name.get("last"), addr.get("street"), addr.get("zip"))
        if k != "|||" and k not in keys:
            keys.append(k)
    return keys


def match_results(chunk: List[Dict[str, Any]], persons: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    """Index into chunk -> person. Each response is used once; ambiguous keys (duplicate inputs) are skipped."""
    index: Dict[str, List[int]] = {}
    for i, p in enumerate(chunk):
        index.setdefault(request_key(p.get("first"), p.get("last"), p.get("street"), p.get("zip")), []).append(i)
    matched: Dict[int, Dict[str, Any]] = {}
    for res in persons:
        if not isinstance(res, dict):
            continue
        for k in response_keys(res):
            slots = [i for i in index.get(k, []) if i not in matched]
            if len(slots) == 1:  # exactly one free input carries this key
                matched[slots[0]] = res
                break
    return matched


def apply_person(p: Dict[str, Any], res: Dict[str, Any]) -> None:
    ph = sorted(res.get("phoneNumbers", []), key=lambda x: -(x.get("score") or 0))
    mob = [x for x in ph if (x.get("type") or "").lower() == "mobile"]
    best = next((x for x in mob if not x.get("dnc") and not x.get("tcpa")), mob[0] if mob else None)
    p["phone"] = best.get("number") if best else ""
    p["type"] = best.get("type") if best else (ph[0].get("type") if ph else None)
    p["dnc"] = bool(best.get("dnc")) if best else False
    p["tcpa"] = bool(best.get("tcpa")) if best else False
    em = res.get("emails") or []
    p["email"] = (em[0].get("email") if isinstance(em[0], dict) else em[0]) if em else ""
    p["lane"] = "B"
    p["trace_status"] = "matched"


def mark_unknown(p: Dict[str, Any]) -> None:
    p.update({"phone": "", "type": None, "dnc": False, "tcpa": False, "email": p.get("email") or "", "lane": "B", "trace_status": "unmatched"})


def trace(totrace: List[Dict[str, Any]], key: str, meter: Any, get: Optional[Callable[..., Any]] = None, start: int = 0,
          unit_cents: float = UNIT_CENTS["trace"]) -> Tuple[int, Optional[Decision]]:
    """Trace rows in place from `start`. Returns (next_cursor, stop_decision_or_None)."""
    get = get or http.get_json
    headers = {"Authorization": "Bearer %s" % key, "Content-Type": "application/json"}
    for i in range(start, len(totrace), CHUNK):
        chunk = totrace[i:i + CHUNK]
        gate = meter.check("skip trace", VENDOR, len(chunk), unit_cents)
        if not gate.allowed:
            print("  CAP before trace chunk (%s): stopping cleanly; %d traced so far." % (gate.reason, i))
            return i, gate
        r = get(URL, headers=headers, data=json.dumps({"requests": [build_request(p) for p in chunk]}).encode(), step="trace")
        http.body_error(r, "trace", URL)
        persons = ((r.get("results") or {}).get("persons") or []) if isinstance(r, dict) else []
        meter.charge("skip trace", VENDOR, len(chunk), unit_cents)  # BatchData bills per request sent
        matched = match_results(chunk, persons)
        for j, p in enumerate(chunk):
            if j in matched:
                apply_person(p, matched[j])
            else:
                mark_unknown(p)
    return len(totrace), None


def finalize(picks: List[Dict[str, Any]]) -> Tuple[int, int]:
    for p in picks:
        p["company"] = p.get("company") or ""
        p["owner_first"], p["owner_last"] = p.get("first", ""), p.get("last", "")
        p.setdefault("maps", "")
        p.setdefault("rating", "")
        p.setdefault("reviews", "")
        p["clean"] = (p.get("type") or "").lower() == "mobile" and not p.get("dnc") and not p.get("tcpa")
    mob = sum((p.get("type") or "").lower() == "mobile" for p in picks)
    return mob, sum(p["clean"] for p in picks)
