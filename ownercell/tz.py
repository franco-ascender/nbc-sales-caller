"""Time zone per row and the 08:00 to 20:00 recipient-local dial window.

Why: Florida caps telemarketing at 8pm local and we use that window everywhere. A guessed
zone is how someone gets a call at 6am, so ZIP (finest grain) resolves first, engine.py's
state/city table is the fallback, and a row with no zone is HELD, never delivered (engine.py
shipped it with an empty Time Zone cell; bug 2).
"""
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP_TABLE = os.path.join(ROOT, "src", "data", "lead-engine-zip-timezones.json")
START_MINUTES, END_MINUTES = 8 * 60, 20 * 60
HELD_REASON = "time_zone_unresolved"

EASTERN, CENTRAL, MOUNTAIN, ARIZONA, PACIFIC, ALASKA, HAWAII = ("America/New_York", "America/Chicago", "America/Denver",
                                                               "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu")
_NAMES = {"Eastern": EASTERN, "Central": CENTRAL, "Mountain": MOUNTAIN, "Pacific": PACIFIC, "Alaska": ALASKA, "Hawaii": HAWAII}

# Ported from engine.py STATE_TZ. Arizona is mapped to America/Phoenix (no DST) instead of Denver so the
# local clock is right in summer; engine.py's label "Mountain" was correct for the sheet but wrong by an hour.
_STATE = dict([(s, "Eastern") for s in "CT DE FL GA ME MD MA NH NJ NY NC OH PA RI SC VT VA WV MI IN KY".split()]
              + [(s, "Central") for s in "TN AL AR IL IA KS LA MN MS MO NE ND OK SD TX WI".split()]
              + [(s, "Mountain") for s in "CO ID MT NM UT WY".split()]
              + [(s, "Pacific") for s in "NV CA OR WA".split()] + [("AK", "Alaska"), ("HI", "Hawaii")])
STATE_TZ = {s: _NAMES[n] for s, n in _STATE.items()}
STATE_TZ["AZ"] = ARIZONA
TZ_EXC = {("TX", "EL PASO"): MOUNTAIN, ("FL", "PENSACOLA"): CENTRAL, ("FL", "PANAMA CITY"): CENTRAL, ("FL", "FORT WALTON BEACH"): CENTRAL,
          ("FL", "DESTIN"): CENTRAL, ("FL", "TALLAHASSEE"): EASTERN, ("TN", "KNOXVILLE"): EASTERN, ("TN", "CHATTANOOGA"): EASTERN,
          ("TN", "JOHNSON CITY"): EASTERN, ("KY", "LOUISVILLE"): EASTERN, ("KY", "LEXINGTON"): EASTERN, ("KY", "BOWLING GREEN"): CENTRAL,
          ("KY", "PADUCAH"): CENTRAL, ("IN", "EVANSVILLE"): CENTRAL, ("IN", "GARY"): CENTRAL, ("MI", "IRONWOOD"): CENTRAL,
          ("ID", "BOISE"): MOUNTAIN, ("ID", "COEUR D ALENE"): PACIFIC, ("OR", "ONTARIO"): MOUNTAIN, ("ND", "DICKINSON"): MOUNTAIN,
          ("SD", "RAPID CITY"): MOUNTAIN, ("NE", "SCOTTSBLUFF"): MOUNTAIN, ("KS", "GOODLAND"): MOUNTAIN}
# Area codes of the minority zone in split states (from lead-engine-timezone.ts); used only when city is unknown.
AREA_CODES = {"915": MOUNTAIN, "423": EASTERN, "865": EASTERN, "219": CENTRAL, "270": CENTRAL, "364": CENTRAL, "606": EASTERN, "859": EASTERN, "502": EASTERN}

_table: Optional[Dict[str, Dict[str, str]]] = None


def _load_table() -> Dict[str, Dict[str, str]]:
    global _table
    if _table is None:
        with open(ZIP_TABLE) as f:
            raw = json.load(f)
        _table = {"prefix": raw.get("prefix", {}), "zip": raw.get("zip", {})}
    return _table


def zip5(value: Any) -> Optional[str]:
    if not isinstance(value, (str, int)) or isinstance(value, bool):
        return None
    m = re.match(r"^\s*(\d{5})(?:-?\d{4})?\s*$", str(value))
    return m.group(1) if m else None


def zone_for_zip(value: Any) -> Optional[str]:
    z = zip5(value)
    if not z:
        return None
    t = _load_table()
    return t["zip"].get(z) or t["prefix"].get(z[:3])


def tz_label(state: Optional[str], city: Optional[str]) -> str:
    """engine.py tz(): the sheet label (Eastern, Central...) for a state/city pair."""
    zone = TZ_EXC.get(((state or "").upper(), (city or "").upper()), STATE_TZ.get((state or "").upper(), ""))
    inv = {v: k for k, v in _NAMES.items()}
    inv[ARIZONA] = "Mountain"
    return inv.get(zone, "")


def resolve_zone(zip_code: Any = None, state: Optional[str] = None, city: Optional[str] = None, phone10: Optional[str] = None) -> Optional[str]:
    """ZIP first, then the state/city exceptions, then area code, then the state default."""
    zone = zone_for_zip(zip_code)
    if zone:
        return zone
    st, ct = (state or "").strip().upper(), (city or "").strip().upper()
    if (st, ct) in TZ_EXC:
        return TZ_EXC[(st, ct)]
    if phone10 and re.match(r"^\d{10}$", phone10) and phone10[:3] in AREA_CODES and st in ("TX", "TN", "IN", "KY"):
        return AREA_CODES[phone10[:3]]
    return STATE_TZ.get(st) or None


def local_minutes(dt_utc: datetime, zone: str) -> int:
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    local = dt_utc.astimezone(ZoneInfo(zone))
    return local.hour * 60 + local.minute


def within_dial_window(dt_utc: datetime, zone: str) -> bool:
    m = local_minutes(dt_utc, zone)
    return START_MINUTES <= m < END_MINUTES


def zone_of_row(row: Dict[str, Any]) -> Optional[str]:
    return resolve_zone(row.get("zip"), row.get("state"), row.get("city"), row.get("phone"))


def hold_back_without_zone(rows: List[Dict[str, Any]], zone_of: Callable[[Dict[str, Any]], Optional[str]] = zone_of_row
                           ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """(deliverable, held). Held entries are {"row": row, "reason": "time_zone_unresolved"}."""
    deliverable, held = [], []
    for row in rows:
        if zone_of(row):
            deliverable.append(row)
        else:
            held.append({"row": row, "reason": HELD_REASON})
    return deliverable, held
