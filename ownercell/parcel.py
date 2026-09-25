"""Name -> owner-occupied home address from county/state parcel layers (port of engine.py parcel).

Why unchanged in logic: the PARCEL table and the LAST FIRST / FIRST LAST owner-string checks
are Anas's measured path. Only the failure mode changed: three endpoint failures raise Frozen
(persisted, resumable) instead of exiting.
"""
import json
import os
import re
import urllib.request
from collections import defaultdict
from concurrent import futures
from typing import Any, Callable, Dict, List, Optional

from . import http
from .common import load_json, street_ok, work_dir
from .errors import Frozen

Row = Dict[str, Any]

PARCEL: Dict[str, Dict[str, Any]] = {
    "NC": {"url": "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0", "fields": "ownname,siteadd,scity,szip,parusecode",
           "where": lambda f, l: "ownname LIKE '%%%s%%' AND ownname LIKE '%%%s%%'" % (l, f), "name": "ownname", "street": "siteadd", "city": "scity", "zip": "szip"},
    "FL": {"url": "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0",
           "fields": "OWN_NAME,PHY_ADDR1,PHY_CITY,PHY_ZIPCD,OWN_ADDR1,OWN_CITY,OWN_ZIPCD", "where": lambda f, l: "OWN_NAME LIKE '%s %s%%'" % (l, f),
           "name": "OWN_NAME", "street": "PHY_ADDR1", "city": "PHY_CITY", "zip": "PHY_ZIPCD"},
    "AZ": {"url": "https://services.arcgis.com/ykpntM6e3tHvzKRJ/arcgis/rest/services/Parcel_Data_View/FeatureServer/0",
           "fields": "OwnerName,OwnerAddressLine1,OwnerCity,OwnerState,OwnerZipCode",
           "where": lambda f, l: "OwnerName LIKE '%s %s%%' AND PropertyUseDescription LIKE 'SFR%%'" % (l, f),
           "name": "OwnerName", "street": "OwnerAddressLine1", "city": "OwnerCity", "zip": "OwnerZipCode"},
    "TX": {"url": "https://services1.arcgis.com/7DRakJXKPEhwv0fM/arcgis/rest/services/stratmap25_landparcels_48453_travis_202508/FeatureServer/0",
           "fields": "OWNER_NAME,MAIL_LINE1,MAIL_CITY,MAIL_ZIP", "where": lambda f, l: "OWNER_NAME LIKE '%s %s%%'" % (l, f),
           "name": "OWNER_NAME", "street": "MAIL_LINE1", "city": "MAIL_CITY", "zip": "MAIL_ZIP"},
    "GA": {"url": "https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/Tax_Parcels/FeatureServer/0", "fields": "Owner,OwnerAddr1,OwnerAddr2,Address",
           "where": lambda f, l: "Owner LIKE '%s %s%%'" % (l, f), "name": "Owner", "street": "OwnerAddr1", "city": "OwnerAddr2", "zip": "OwnerAddr2"},
    "TN": {"url": "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Parcels_view/FeatureServer/0", "fields": "Owner,OwnAddr1,OwnCity,OwnZip",
           "where": lambda f, l: "Owner LIKE '%s %s%%'" % (l, f), "name": "Owner", "street": "OwnAddr1", "city": "OwnCity", "zip": "OwnZip"},
    "WA": {"url": "https://services6.arcgis.com/z6WYi9VRHfgwgtyW/arcgis/rest/services/Parcels/FeatureServer/0", "fields": "OWNERNAME,OWNERLINE1,OWNERCITY,OWNERZIP",
           "where": lambda f, l: "OWNERNAME LIKE '%s %s%%'" % (l, f), "name": "OWNERNAME", "street": "OWNERLINE1", "city": "OWNERCITY", "zip": "OWNERZIP"},
}


def arcgis(url: str, where: str, fields: str, n: int = 5, timeout: int = 40) -> Optional[List[Dict[str, Any]]]:
    """None on any failure (the caller counts failures); [] when the query simply matched nothing."""
    u = url.rstrip("/") + "/query?" + http.encode({"where": where, "outFields": fields, "returnGeometry": "false", "f": "json", "resultRecordCount": n})
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=http.UA), timeout=timeout))
    except (OSError, ValueError):
        return None
    if "error" in d:
        return None
    return [f["attributes"] for f in d.get("features", [])]


HCAD: Dict[str, List[Row]] = {}


def hcad_index(work: str) -> None:
    """LAST|FIRST -> owner-occupied home index from HCAD real_acct.txt (Harris County TX), built once."""
    idx_p = os.path.join(work, "hcad_index.json")
    if os.path.exists(idx_p):
        HCAD.update(load_json(idx_p))
        return
    src = next((p for p in [os.path.join(work, "real_acct.txt"), "/root/leadlist/states/tx/real_acct.txt"] if os.path.exists(p)), None)
    if not src:
        return
    print("  indexing HCAD (one-time, about 2 min)...", flush=True)
    idx: Dict[str, List[Row]] = defaultdict(list)
    with open(src, encoding="latin-1") as f:
        hdr = {h: i for i, h in enumerate(f.readline().rstrip("\n").split("\t"))}
        for line in f:
            c = line.rstrip("\n").split("\t")
            if len(c) < len(hdr) or c[hdr["state_class"]] != "A1" or c[hdr["mail_addr_1"]] != c[hdr["site_addr_1"]]:
                continue
            t = c[hdr["mailto"]].replace("&", " ").split()
            if len(t) < 2:
                continue
            idx["%s|%s" % (t[0], t[1])].append({"owner": c[hdr["mailto"]], "street": c[hdr["mail_addr_1"]], "city": c[hdr["mail_city"]].title(), "zip": c[hdr["mail_zip"]][:5]})
    with open(idx_p, "w") as f:
        json.dump(idx, f)
    HCAD.update(idx)


def parcel_lookup(n: Row, state: str, work: str, get: Optional[Callable[..., Any]] = None) -> Optional[List[Row]]:
    get = get or http.get_json
    f, l = n["first"].upper().replace("'", "''"), n["last"].upper().replace("'", "''")
    if state == "TX" and os.path.exists(os.path.join(work, "hcad_index.json")):
        return HCAD.get("%s|%s" % (l, f), [])
    if state == "IL":
        d = get("https://datacatalog.cookcountyil.gov/resource/3723-97qp.json?" + http.encode({"$where": "year='2025' AND owner_address_name like '%s%%%s'" % (f, l), "$limit": 3,
                "$select": "owner_address_name,owner_address_full,owner_address_city_name,owner_address_zipcode_1,prop_address_full"}), step="parcel")
        return [{"owner": x["owner_address_name"], "street": x.get("owner_address_full"), "city": x.get("owner_address_city_name"), "zip": (x.get("owner_address_zipcode_1") or "")[:5]}
                for x in d if x.get("prop_address_full") and x.get("owner_address_full") and x["prop_address_full"].split()[0] == x["owner_address_full"].split()[0]]
    if state == "PA":
        q = "SELECT owner_1,location,zip_code FROM opa_properties_public WHERE owner_1 LIKE '%s %s%%' AND (mailing_street IS NULL OR mailing_street=location) LIMIT 3" % (l, f)
        d = get("https://phl.carto.com/api/v2/sql?" + http.encode({"q": q}), step="parcel").get("rows", [])
        return [{"owner": x["owner_1"], "street": x["location"], "city": "Philadelphia", "zip": (x.get("zip_code") or "")[:5]} for x in d]
    P = PARCEL.get(state)
    if not P:
        raise Frozen("parcel", "no parcel source for %s, Lane A only there" % state)
    r = arcgis(P["url"], P["where"](f, l), P["fields"], 5)
    if r is None:
        return None
    out = []
    for x in r:
        o = (x.get(P["name"]) or "").upper()
        if re.search(r"TRUST|LLC|INC\b|CORP", o):
            continue
        st, city, z = (x.get(P["street"]) or "").strip(), (x.get(P["city"]) or "").strip(), ""
        if state == "NC" and city:
            st = re.sub(r"\s*,?\s*%s\s+NC$" % re.escape(city.upper()), "", st, flags=re.I)
            st = re.sub(r",.*$", "", st)
        if state == "GA":
            m = re.match(r"^(.*?)\s+GA\s+(\d{5})", city or "")
            city, z = (m.group(1), m.group(2)) if m else (city, "")
        z = str(x.get(P["zip"]) or "")[:5] if state != "GA" else z
        out.append({"owner": x.get(P["name"]), "street": st, "city": city.title(), "zip": z})
    return out


def resolve_one(n: Row, st: str, work: str, hits: Optional[List[Row]]) -> Optional[Row]:
    """Exactly one owner-occupied home whose owner string names this person, else None."""
    if hits is None:
        return None
    hits = [h for h in hits if street_ok(h.get("street"))]
    f, l = n["first"].upper(), n["last"].upper()
    hits = [h for h in hits if re.search(r"\b%s\b[, ]+(?:[A-Z]+ )?%s\w*" % (re.escape(l), re.escape(f)), (h.get("owner") or "").upper())
            or re.search(r"\b%s\b[A-Z ]*\b%s\b" % (re.escape(f), re.escape(l)), (h.get("owner") or "").upper())]
    owners = {re.sub(r"[^A-Z]", "", (h.get("owner") or "").upper())[:12] for h in hits}
    if not hits or len(owners) != 1:
        return None
    h = hits[0]
    return dict(n, street=h["street"], city=h.get("city") or n.get("city", ""), state=st, zip=h.get("zip", ""), owner=h.get("owner"))


def run(names: List[Row], st: str, work: Optional[str] = None, lookup: Callable[..., Optional[List[Row]]] = parcel_lookup) -> List[Row]:
    work = work or work_dir()
    if st == "TX":
        hcad_index(work)
    fails = [0]

    def one(n: Row) -> Optional[Row]:
        if fails[0] >= 3:
            return None
        hits = lookup(n, st, work)
        if hits is None:
            fails[0] += 1
            return None
        return resolve_one(n, st, work, hits)

    with futures.ThreadPoolExecutor(6) as ex:
        picks = [p for p in ex.map(one, names) if p]
    if fails[0] >= 3:
        raise Frozen("parcel", "%s parcel endpoint failed or timed out 3 times, stopping (no retry loop). Try later or another county." % st, {"resolved": len(picks)})
    print("PARCEL: %d of %d names resolved to exactly one home (%.0f%%)" % (len(picks), len(names), len(picks) / max(len(names), 1) * 100))
    return picks
