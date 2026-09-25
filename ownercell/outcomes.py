"""Call outcomes: read Called/Outcome back from the delivered xlsx and post them to Postgres.

Why: the outcome loop is what makes the product defensible (handoff 00, rule "every dial has
an outcome record"). Validation is strict so a typo in the sheet never lands in dial_outcomes.
"""
import re
import time
from typing import Any, Dict, List, Optional

from . import psql, xlsx
from .errors import Frozen

OUTCOMES = ("reached_owner", "gatekeeper", "wrong_number", "voicemail", "disconnected", "opt_out", "no_answer")
SQL = ("select public.lead_engine_record_dial_outcome(:'operator'::uuid, :'ledger'::uuid, :'outcome', "
       ":'dialed_at'::timestamptz, :'notes')")


class OutcomeError(ValueError):
    def __init__(self, row_number: int, message: str) -> None:
        super().__init__("row %d: %s" % (row_number, message))
        self.row_number = row_number


def normalize_outcome(text: str) -> str:
    return re.sub(r"[^a-z_]", "", text.strip().lower().replace(" ", "_").replace("-", "_"))


def read_outcomes(xlsx_path: str, sheet: str = "List") -> List[Dict[str, Any]]:
    """Rows with a Called or Outcome value. Raises OutcomeError(row) on an invalid outcome or missing Ledger Id."""
    out = []
    for rec in xlsx.read_records(xlsx_path, sheet):
        called, outcome, ledger = rec.get("Called", "").strip(), rec.get("Outcome", "").strip(), rec.get("Ledger Id", "").strip()
        if not called and not outcome:
            continue
        if not ledger:
            raise OutcomeError(rec["row_number"], "Ledger Id is empty")
        code = normalize_outcome(outcome) if outcome else ""
        if outcome and code not in OUTCOMES:
            raise OutcomeError(rec["row_number"], "outcome %r is not one of %s" % (outcome, ", ".join(OUTCOMES)))
        out.append({"ledger_id": ledger, "called": called, "outcome": code, "notes": rec.get("Notes", "").strip(), "row_number": rec["row_number"]})
    return out


def post_outcomes(rows: List[Dict[str, Any]], database_url: str, operator_id: str, binary: Optional[str] = None) -> int:
    """One psql call per row; stops with Frozen (carrying the row index) on the first failure."""
    for i, r in enumerate(rows):
        if not r.get("outcome"):
            continue
        dialed = r.get("called") or time.strftime("%Y-%m-%dT%H:%M:%S%z")
        try:
            psql.run(database_url, SQL, {"operator": operator_id, "ledger": r["ledger_id"], "outcome": r["outcome"], "dialed_at": dialed,
                                          "notes": r.get("notes", "")}, step="outcomes", binary=binary)
        except Frozen as fz:
            raise Frozen("outcomes", fz.reason, {"cursor": i, "row_number": r.get("row_number"), "posted": i})
    return sum(1 for r in rows if r.get("outcome"))
