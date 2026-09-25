"""Free owner-name sources (port of engine.py cmd_names, one function per source).

Why: registers are free but slow; nothing here touches the meter. fl_cpa used openpyxl in
engine.py and now goes through ownercell.xlsx. Network failures raise Frozen so a job is
persisted, never exited.
"""
import csv
import html as H
import json
import os
import random
import re
import urllib.request
from collections import Counter
from concurrent import futures
from typing import Any, Callable, Dict, List, Optional

from . import http, xlsx
from .common import download, load_json, p10, work_dir
from .errors import Frozen

Row = Dict[str, Any]
SOURCES = ("fl_re", "fl_cpa", "tx_trec", "az_adre", "il_idfpr", "pa_pals", "nppes", "firms")


def split_name(s: Optional[str], fmt: str) -> "tuple[str, str]":
    s = (s or "").strip()
    if fmt == "last_first":
        last, _, rest = s.partition(",")
        first = (rest.split() or [""])[0]
    else:
        t = s.split()
        first, last = (t[0], t[-1]) if len(t) >= 2 else ("", s)
        if last.upper() in ("JR", "SR", "II", "III", "IV") and len(t) >= 3:
            last = t[-2]
    return first.title(), last.title()


def fl_re(a: Any, work: str) -> List[Row]:
    out: List[Row] = []
    city = (a.city or "").upper()
    for rgn in (a.region or "1,2,3,4,5,6,7").split(","):
        path = os.path.join(work, "RE_rgn%s.csv" % rgn)
        if not os.path.exists(path):
            download("https://www2.myfloridalicense.com/sto/file_download/extracts/RE_rgn%s.csv" % rgn, path, "names")
        with open(path, encoding="latin-1") as f:
            for r in csv.reader(f):
                if len(r) < 22 or r[4] != "BK Broker" or r[14] != "Current" or r[15] != "Active" or r[9] != "FL" or "," not in r[2]:
                    continue
                if a.pm and not re.search(r"(?i)property m|rental|leasing|mgmt|management", r[21]):
                    continue
                if city and r[8].upper() != city:
                    continue
                fn, ln = split_name(r[2], "last_first")
                out.append({"first": fn, "last": ln, "company": r[21], "street": r[5], "city": r[8].title(), "state": "FL", "zip": r[10][:5], "source": "FL DBPR"})
    return out


def fl_cpa(a: Any, work: str) -> List[Row]:
    path = os.path.join(work, "fl_cpa.xlsx")
    city = (a.city or "").upper()
    if not os.path.exists(path):
        try:
            page = urllib.request.urlopen(urllib.request.Request("https://www2.myfloridalicense.com/certified-public-accounting/public-records/", headers=http.UA), timeout=60).read().decode("utf8", "ignore")
        except OSError as e:
            raise Frozen("names", "FL CPA public-records page unreachable: %s" % type(e).__name__)
        m = re.search(r"https://www2\.myfloridalicense\.com/cpa/licensereports/cpalicensedata\d+\.xlsx", page)
        if not m:
            raise Frozen("names", "FL CPA xlsx link not found on public-records page")
        download(m.group(0), path, "names")
    out: List[Row] = []
    for r in xlsx.read_sheet(path, "CPAs (0101)"):
        r = r + [""] * (14 - len(r))
        if r[0] != "0101" or r[13] != "Current" or r[10] != "FL" or not r[6]:
            continue
        if city and r[9].upper() != city:
            continue
        fn, ln = split_name(r[5], "last_first")
        out.append({"first": fn, "last": ln, "company": "", "street": r[6], "city": r[9].title(), "state": "FL", "zip": r[11][:5], "source": "FL DBPR CPA"})
    return out


def tx_trec(a: Any, work: str) -> List[Row]:
    path = os.path.join(work, "trec.csv")
    if not os.path.exists(path):
        download("https://data.texas.gov/api/views/s7ft-44qi/rows.csv?accessType=DOWNLOAD", path, "names")
    out: List[Row] = []
    with open(path) as f:
        for r in csv.DictReader(f):
            if r["License Type"] != "Broker Individual" or r["Status"] != "Active" or not r["First Name"]:
                continue
            if a.county and r["County"].upper() != a.county.upper():
                continue
            out.append({"first": r["First Name"].title(), "last": r["Last Name"].title(), "company": r.get("Related License Full Name", ""), "city": "", "state": "TX", "county": r["County"], "source": "TREC"})
    return out


def az_adre(a: Any, work: str) -> List[Row]:
    path = os.path.join(work, "adre.csv")
    if not os.path.exists(path):
        download("https://services.azre.gov/PdbWeb/List/DownloadList/1", path, "names")
    out: List[Row] = []
    with open(path, encoding="latin-1") as f:
        for r in csv.DictReader(f):
            if r["LicType"].strip() != "Broker" or r["LicStatus"].strip() != "Active" or not r["FirstName"].strip():
                continue
            if a.county and r["MailingCounty"].strip().upper() != a.county.upper():
                continue
            out.append({"first": r["FirstName"].strip().title(), "last": r["LastName"].strip().title(), "company": r["EmployerLegalName"], "city": r["MailingCity"].title(), "state": "AZ", "county": r["MailingCounty"].strip(), "source": "ADRE"})
    return out


def il_idfpr(a: Any, work: str) -> List[Row]:
    desc = {"cpa": "LICENSED CERTIFIED PUBLIC ACCOUNTANT", "realtor": "LICENSED REAL ESTATE MANAGING BROKER"}.get(a.industry, a.industry)
    w = "license_status='ACTIVE' AND business='N' AND description='%s'" % desc + (" AND county='%s'" % a.county.upper() if a.county else "")
    d = http.get_json("https://illinois-edp.data.socrata.com/resource/pzzh-kp68.json?" + http.encode({"$where": w, "$limit": a.n * 5}), step="names")
    return [{"first": r["first_name"].split()[0].title(), "last": r["last_name"].title(), "company": "", "city": (r.get("city") or "").title(), "state": "IL", "county": r.get("county", ""), "source": "IDFPR"}
            for r in d if r.get("first_name") and r.get("last_name")]


def pa_pals(a: Any, work: str) -> List[Row]:
    prof = {"realtor": "Real Estate Commission", "cpa": "Accountancy"}.get(a.industry, a.industry)
    seen, out = set(), []  # type: ignore[var-annotated]
    surnames = (a.surnames or "Smith,Johnson,Williams,Brown,Jones,Davis,Miller,Wilson,Nguyen,Cohen,Rodriguez,Kim,Green,Thomas,Jackson,Lee,Patel,Martinez,Garcia,Anderson").split(",")
    for last in surnames:
        for page in range(1, 8):
            body = json.dumps({"OptPersonFacility": "Person", "LastName": last, "FirstName": "", "IsFacility": 0, "State": "Pennsylvania", "County": a.county or "", "PageNo": page}).encode()
            try:
                rs = json.load(urllib.request.urlopen(urllib.request.Request("https://www.pals.pa.gov/api/Search/SearchForPersonOrFacilty", data=body, headers=dict(http.UA, **{"Content-Type": "application/json"})), timeout=30))
            except (OSError, ValueError):
                break  # engine.py: a failed page ends this surname, never the run
            if not rs:
                break
            for r in rs:
                if r.get("ProfessionType") == prof and r.get("Status") == "Active" and r.get("FirstName") and r["LicenseNumber"] not in seen:
                    seen.add(r["LicenseNumber"])
                    out.append({"first": r["FirstName"].title(), "last": r["LastName"].title(), "company": "", "city": (r.get("City") or "").title(), "state": "PA", "county": r.get("County", ""), "phone": p10(r.get("PhoneNo1")), "email": r.get("Emailid1") or "", "source": "PALS"})
            if rs[0].get("TotalRecords", 0) <= page * 50:
                break
    return out


def nppes(a: Any, work: str) -> List[Row]:
    OWN = re.compile(r"owner|president|partner|principal|ceo|founder|medical director|dds|dmd|dentist|doctor|chiropract|physician|director", re.I)
    BAD = re.compile(r"office manager|practice manager|business manager|credential|billing|administrator|coordinator|bookkeep|consultant|accountant", re.I)
    st, city = (a.state or "").upper(), (a.city or "").upper()
    pats = [a.orgname] if a.orgname else [None]
    if a.industry == "medspa" and not a.orgname:
        pats = ["*med spa*", "*medspa*", "*aesthetic*", "*laser*", "*rejuven*", "*glow*", "*botox*", "*skin*"]
    out: List[Row] = []
    for pat in pats:
        for skip in range(0, 1000, 200):
            q: Dict[str, Any] = {"version": "2.1", "enumeration_type": "NPI-2", "state": st, "limit": 200, "skip": skip}
            if city:
                q["city"] = city
            if pat:
                q["organization_name"] = pat
            elif a.taxonomy:
                q["taxonomy_description"] = a.taxonomy
            rs = http.get_json("https://npiregistry.cms.hhs.gov/api/?" + http.encode(q), step="names").get("results", [])
            for r in rs:
                b = r.get("basic", {})
                t = b.get("authorized_official_title_or_position") or ""
                if not OWN.search(t) or BAD.search(t) or not b.get("authorized_official_first_name"):
                    continue
                loc = [x for x in r.get("addresses", []) if x.get("address_purpose") == "LOCATION"]
                out.append({"first": b["authorized_official_first_name"].title(), "last": b["authorized_official_last_name"].title(), "company": b.get("organization_name", ""), "title": t, "city": (loc[0]["city"] if loc else city).title(), "state": st, "source": "NPPES"})
            if len(rs) < 200:
                break
    return out


STOP = set("law office offices of the firm group associates injury personal attorney attorneys lawyers lawyer at and inc pc pllc pa llp llc accident car auto trial legal counsel partners ltd cpa cpas accounting tax advisors financial solutions consulting services company co realty property management".split())
NOT_FIRST = {"Attorney", "Contact", "About", "Meet", "Call", "Why", "Our", "The", "Choose", "Choosing", "Reviews", "Insurance"}


def firms(a: Any, work: str) -> List[Row]:
    """Scraped firms -> surname in firm name -> first name from the website (attorney style)."""
    biz = load_json(a.inp)

    def one(b: Row) -> List[Row]:
        toks = [t for t in re.findall(r"[A-Za-z'’]+", re.sub(r"[-:|].*$", "", b.get("company") or "")) if t.lower() not in STOP and len(t) > 2 and t[0].isupper()]
        if not toks or not b.get("website"):
            return []
        try:
            txt = H.unescape(re.sub(r"<[^>]+>", " ", urllib.request.urlopen(urllib.request.Request(b["website"], headers=http.UA), timeout=10).read(400000).decode("utf8", "ignore")))
        except (OSError, ValueError):
            return []
        res = []
        for s in toks:
            m = [x for x in re.findall(r"\b([A-Z][a-z]{2,})\s+(?:[A-Z]\.?\s+)?" + re.escape(s) + r"\b", txt) if x.lower() not in STOP and x not in NOT_FIRST]
            if m:
                res.append({"first": Counter(m).most_common(1)[0][0], "last": s, "company": b["company"], "city": b.get("city"), "state": b.get("state"), "source": "firm site"})
        return res

    out: List[Row] = []
    with futures.ThreadPoolExecutor(12) as ex:
        for r in ex.map(one, biz):
            out += r
    return out


def dedupe_and_sample(out: List[Row], n: int, seed: int) -> List[Row]:
    seen, uniq = set(), []  # type: ignore[var-annotated]
    for r in out:
        k = (r["first"].upper(), r["last"].upper(), (r.get("city") or "").upper())
        if r["first"] and r["last"] and k not in seen:
            seen.add(k)
            uniq.append(r)
    random.seed(seed)
    random.shuffle(uniq)
    return uniq[:n]


def run(a: Any, work: Optional[str] = None) -> List[Row]:
    fn: Optional[Callable[[Any, str], List[Row]]] = globals().get(a.source) if a.source in SOURCES else None
    if fn is None:
        raise Frozen("names", "unknown source %s" % a.source)
    uniq = dedupe_and_sample(fn(a, work or work_dir()), a.n, a.seed)
    note = ""
    if a.source in ("fl_re", "fl_cpa"):
        note = ", these already carry a HOME street address; skip parcel, go to trace."
    elif a.source == "pa_pals":
        note = ", %d carry a phone: verify those directly (Recipe C)." % sum(1 for r in uniq if r.get("phone"))
    print("NAMES %s: %d unique owner names from %s%s" % (a.tag, len(uniq), a.source, note))
    return uniq
