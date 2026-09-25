"""BatchData phone verification (line type, DNC, litigator), indexed by number.

Why the meter runs twice per chunk: check() with the chunk size before the call so we never
send a request we cannot pay for; charge() after with the count we actually sent, which is
what BatchData bills. On cap we return what exists plus the stopping Decision so the caller
can deliver, settle and stop (never crash).
"""
import json
from typing import Any, Callable, Dict, List, Optional, Tuple

from . import http
from .common import UNIT_CENTS
from .meter import Decision

URL = "https://api.batchdata.com/api/v1/phone/verification"
VENDOR = "batchdata"
CHUNK = 100


def verify(phones: List[str], key: str, meter: Any, get: Optional[Callable[..., Any]] = None,
           unit_cents: float = UNIT_CENTS["verify"]) -> Tuple[Dict[str, Dict[str, Any]], Optional[Decision]]:
    """Return ({number: record}, stop_decision_or_None). Records are indexed by the returned number."""
    get = get or http.get_json
    out: Dict[str, Dict[str, Any]] = {}
    headers = {"Authorization": "Bearer %s" % key, "Content-Type": "application/json"}
    for i in range(0, len(phones), CHUNK):
        chunk = phones[i:i + CHUNK]
        gate = meter.check("verify", VENDOR, len(chunk), unit_cents)
        if not gate.allowed:
            print("  CAP before verify chunk (%s): stopping cleanly; %d numbers verified so far." % (gate.reason, len(out)))
            return out, gate
        r = get(URL, headers=headers, data=json.dumps({"requests": chunk}).encode(), step="verify")
        http.body_error(r, "verify", URL)
        for p in (r.get("results") or {}).get("phoneNumbers", []) if isinstance(r, dict) else []:
            if p.get("number"):
                out[str(p.get("number"))] = p
        charged = meter.charge("verify", VENDOR, len(chunk), unit_cents)  # actual count sent, not the estimate
        print("  charged verify n=%d, remaining %d cents" % (len(chunk), charged.remaining_cents))
    return out, None


def apply_verification(rows: List[Dict[str, Any]], verified: Dict[str, Dict[str, Any]], phone_key: str = "phone") -> Tuple[int, int]:
    """Copy type/dnc/tcpa/carrier onto rows and compute clean. Returns (mobile, clean) counts."""
    mob = clean = 0
    missing = [b[phone_key] for b in rows if b.get(phone_key) and b[phone_key] not in verified]
    if missing:
        print("  NOTE: BatchData returned no record for %d numbers (charged, treated as not mobile): %s" % (len(missing), missing[:5]))
    for b in rows:
        x = verified.get(b.get(phone_key) or "", {})
        b["type"] = x.get("type")
        b["dnc"] = bool(x.get("dnc"))
        b["tcpa"] = bool(x.get("tcpa"))
        b["carrier"] = x.get("carrier")
        is_mobile = (b["type"] or "").lower() == "mobile"
        b["clean"] = is_mobile and not b["dnc"] and not b["tcpa"]
        mob += is_mobile
        clean += b["clean"]
    return mob, clean
