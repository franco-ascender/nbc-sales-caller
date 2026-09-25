"""Lane C investors/developers: individuals owning N parcels in a NC county (port of cmd_investors).

Why NC only: the grouped statistics query is written against the NC OneMap layer; other
states need a county file grouped locally (master prompt Lane C). That limit is preserved.
"""
import json
import random
import re
from typing import Any, Callable, Dict, List, Optional

from . import http
from .common import street_ok
from .errors import Frozen
from .parcel import PARCEL

BAD = re.compile(r"LLC|INC\b|TRUST|ASSOC|CHURCH|CITY|COUNTY|BANK|CORP|\bLP\b|\bL P\b|LTD|PARTNERS|HOMES|PROPERTIES|HOLDINGS|GROUP|COMPANY|\bCO\b|DEVELOPMENT|INVEST|"
                 r"CAPITAL|HOUSING|AUTHORITY|STATE|BOARD|SCHOOL|HOA|ASSN|MINISTR|FOUNDATION|VENTURES|REALTY|ENTERPRISES|FUND|ESTATES|BUILDERS|CONSTRUCTION|RENTALS|"
                 r"MANAGEMENT|PARTNERSHIP|CAROLINA|UNIVERSITY|HOSPITAL|COMMUNITY|\bLAND\b|DEPARTMENT|DEPT|TOWN OF|APARTMENTS|ET AL|ETAL|&")


def run(state: str, county: str, lo: int, hi: int, n: int, seed: int, get: Optional[Callable[..., Any]] = None) -> List[Dict[str, Any]]:
    get = get or http.get_json
    st = state.upper()
    P = PARCEL.get(st)
    if not P:
        raise Frozen("investors", "no parcel source for that state")
    if st != "NC":
        raise Frozen("investors", "investors grouping is implemented for NC statewide; other states: pull the county file and group locally (master prompt Lane C).")
    params = {"where": "cntyname = '%s' AND ownname IS NOT NULL" % county,
              "outStatistics": json.dumps([{"statisticType": "count", "onStatisticField": "parno", "outStatisticFieldName": "n"}]),
              "groupByFieldsForStatistics": "ownname,mailadd,mcity", "having": "COUNT(parno) >= %d AND COUNT(parno) <= %d" % (lo, hi),
              "orderByFields": "n DESC", "f": "json", "resultRecordCount": 2000}
    d = get(P["url"] + "/query?" + http.encode(params), timeout=150, step="investors")
    out = []
    for r in [x["attributes"] for x in d.get("features", [])]:
        o, m = (r.get("ownname") or "").strip(), (r.get("mailadd") or "").strip()
        if not o or BAD.search(o.upper()) or not re.match(r"^[A-Z][A-Z\-\']+ [A-Z\. ]*[A-Z][A-Z\-\']+$", o):
            continue
        mm = re.match(r"^(.*?)\s+(\d{5})(?:-\d{4})?\s*$", m)
        street, z = (mm.group(1), mm.group(2)) if mm else (m, "")
        if not street_ok(street) or (z and not z.startswith("2")):
            continue
        t = o.split()
        first, last = t[0], t[-1]
        if last in ("JR", "SR", "II", "III"):
            last = t[-2]
        out.append({"first": first.title(), "last": last.title(), "company": "%s properties" % r["n"], "street": street, "city": (r.get("mcity") or "").title(),
                    "state": st, "zip": z, "owner": o, "properties": r["n"], "source": "parcels"})
    random.seed(seed)
    random.shuffle(out)
    out = out[:n]
    print("INVESTORS: %d individual owners with %d-%d properties in %s" % (len(out), lo, hi, county))
    return out
