"""Build the deliverable workbook: List (20 brain columns), Summary, Legal Notes.

Why this differs from engine.py cmd_deliver: (2) rows without a resolvable time zone are held
in <out>/held_<name>.json instead of shipped blind; (3) the legal note states 8:00am to 8:00pm
recipient local and the FL 3-calls-per-24h rule; (4) the master CSV path is an argument or
env, not a hardcoded /mnt path; (6) no em dashes anywhere in output text.
"""
import csv
import json
import os
import time
import uuid
from collections import Counter
from typing import Any, Dict, List, Optional, Sequence, Tuple

from . import brain as brain_mod, tz, xlsx
from .common import p10

Row = Dict[str, Any]
WIDTHS = [5, 15, 34, 30, 7, 8, 16, 6, 18, 22, 26, 34, 10, 14, 30, 12, 16, 18, 14, 36]
LEGAL_NOTES = [
    "DNC and litigator scrub accurate on the build date above. Re-scrub every 31 days.",
    "Manual dialling only. No autodialer, predictive dialer, prerecorded message or ringless voicemail.",
    "Call only between 8:00am and 8:00pm in the recipient's local time (Florida Telemarketing Act 501.616(6) cap, applied everywhere; use the Time Zone column).",
    "Maximum 3 calls per 24 hours to the same recipient on the same subject (Florida 501.616(6)); apply everywhere.",
    "Many of these are owners' personal cells; sole proprietors count as residential subscribers for DNC purposes (Chennette v. Porch.com, 9th Cir. 2022). Have counsel sign off on the calling workflow before volume.",
    "Identify yourself and your company. Keep an internal do-not-call list; honour opt-outs immediately and permanently.",
    "No cold texting.",
    "Rows marked DNC (flag mode only) are for email or ad retargeting, not cold calls.",
]


def master_path(explicit: Optional[str], outdir: str) -> str:
    """--master, then OWNERCELL_MASTER_CSV, then <out>/MASTER - all owner cells.csv (bug 4 fix)."""
    return explicit or os.environ.get("OWNERCELL_MASTER_CSV") or os.path.join(outdir, "MASTER - all owner cells.csv")


def prior_numbers(path: str) -> set:
    prior = set()
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                d = p10(r.get("Cell Phone", ""))
                if d:
                    prior.add(d)
    return prior


def fmt_phone(ph: str) -> str:
    return "(%s) %s-%s" % (ph[:3], ph[3:6], ph[6:])


def select_rows(rows: List[Row], dnc_mode: str, prior: set) -> Tuple[List[Row], Counter]:
    """engine.py's drop chain (not mobile, litigator, dnc strict, dup, already delivered)."""
    seen, out, dropped = set(), [], Counter()  # type: ignore[var-annotated]
    for r in rows:
        ph = r.get("phone")
        if not ph or (r.get("type") or "").lower() != "mobile":
            dropped["not mobile"] += 1
            continue
        if r.get("tcpa"):
            dropped["litigator"] += 1
            continue
        if r.get("dnc") and dnc_mode == "strict":
            dropped["dnc"] += 1
            continue
        if ph in seen:
            dropped["dup"] += 1
            continue
        if ph in prior:
            dropped["already delivered"] += 1
            continue
        seen.add(ph)
        out.append(r)
    return out, dropped


def to_list_row(r: Row, zone: str) -> List[Any]:
    status = "DNC, cell, do not cold call" if r.get("dnc") else "CALLABLE, cell, not DNC, not litigator"
    return [fmt_phone(r["phone"]), r.get("company") or "", r.get("maps") or "", r.get("rating") or "", r.get("reviews") or "", r.get("city") or "",
            r.get("state") or "", zone, ("%s %s" % (r.get("owner_first", ""), r.get("owner_last", ""))).strip(), r.get("email") or "", status,
            "", "", "", r.get("bucket") or "", r.get("source") or r.get("lane") or "", r.get("source_row_id") or "", r.get("license_issue_date") or "",
            r.get("ledger_id") or uuid.uuid4().hex]


def build(name: str, rows: List[Row], outdir: str, dnc_mode: str = "strict", master: Optional[str] = None, meter_line: str = "",
          spent_usd: float = 0.0, cap_usd: float = 0.0, columns: Optional[Sequence[str]] = None) -> Dict[str, Any]:
    """Write <outdir>/<name>.xlsx and held_<name>.json. Returns counts."""
    columns = list(columns or brain_mod.load()["output_columns"])
    os.makedirs(outdir, exist_ok=True)
    prior = prior_numbers(master_path(master, outdir))
    kept, dropped = select_rows(rows, dnc_mode, prior)
    deliverable, held = tz.hold_back_without_zone(kept)  # bug 2 fix
    out = [to_list_row(r, tz.resolve_zone(r.get("zip"), r.get("state"), r.get("city"), r.get("phone")) or "") for r in deliverable]
    out.sort(key=lambda r: (r[10].startswith("DNC"), r[6], -(r[4] or 0) if isinstance(r[4], (int, float)) else 0))
    list_rows: List[List[Any]] = [columns] + [[i] + r for i, r in enumerate(out, 1)]
    cl = sum(1 for r in out if r[10].startswith("CALLABLE"))
    today = time.strftime("%Y-%m-%d")
    summary = [[name, ""], ["Built", today], ["Records in", len(rows)], ["Delivered", len(out)], ["  callable (cell, not DNC)", cl],
               ["  DNC-flagged (flag mode)", len(out) - cl], ["Held back (time zone unresolved)", len(held)], ["Dropped", json.dumps(dict(dropped))],
               ["Yield (callable / records in)", "%.0f%%" % (cl / max(len(rows), 1) * 100)], ["Spend this run", "$%.2f of $%.2f cap" % (spent_usd, cap_usd)],
               ["Cost per callable cell", "$%.3f" % (spent_usd / max(cl, 1))], ["DNC scrub date", today + ", re-scrub every 31 days"],
               ["Dial window", "8:00am to 8:00pm recipient local time"]]
    path = os.path.join(outdir, "%s.xlsx" % name)
    xlsx.write_workbook(path, {"List": list_rows, "Summary": summary, "Legal Notes": [[line] for line in LEGAL_NOTES]},
                        widths={"List": WIDTHS[:len(columns)], "Legal Notes": [120]})
    held_path = os.path.join(outdir, "held_%s.json" % name)
    with open(held_path, "w") as f:
        json.dump(held, f, indent=1)
    print("DELIVERED %s: %d rows (%d callable), held %d (time zone unresolved, see %s), dropped %s %s"
          % (path, len(out), cl, len(held), held_path, dict(dropped), meter_line))
    return {"path": path, "delivered": len(out), "callable": cl, "held": len(held), "dropped": dict(dropped), "held_path": held_path}
