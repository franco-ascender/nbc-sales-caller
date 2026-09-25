"""The single gate every paid call goes through.

Why: the handoff's non-negotiable rule is "never spend without a cap check; on cap, deliver
what exists, settle, stop". engine.py checked an estimate and then recorded the same
estimate (bug 5); here check() runs before the vendor call with the estimate and charge()
records the ACTUAL units returned. Two backends share one interface: FileMeter (same JSON
as engine.py's spend.json, so old files load) and PostgresMeter (public.lead_engine_meter
via psql, the source of truth once a job is in the database).
"""
import json
import os
import time
import uuid
from collections import namedtuple
from typing import Any, Dict, Optional

from . import psql
from .errors import Frozen

Decision = namedtuple("Decision", "allowed remaining_cents reason spend_id")

DEFAULT_DAILY_CEILING_CENTS = 5000
ALERT_FRACTION = 0.8
EPS = 1e-6


def daily_ceiling_cents(vendor: str) -> int:
    raw = os.environ.get("OWNERCELL_DAILY_CEILING_%s_CENTS" % vendor.upper())
    try:
        return int(raw) if raw else DEFAULT_DAILY_CEILING_CENTS
    except ValueError:
        return DEFAULT_DAILY_CEILING_CENTS


def cap_cents_from_credits(credits_held: float, credit_value_usd: float, spend_cap_ratio: float) -> int:
    """credits * $0.10 * 0.6 by default; both numbers come from the brain, never hardcoded."""
    return int(credits_held * credit_value_usd * 100 * spend_cap_ratio + EPS)


class FileMeter:
    """JSON meter. Shape: {cap: usd, spent: usd, log: [...], credits_held, daily: {date: {vendor: cents}}}."""

    def __init__(self, path: str, cap_cents: Optional[int] = None, credits_held: Optional[float] = None,
                 brain: Optional[Dict[str, Any]] = None) -> None:
        self.path = path
        self.state = self._load()
        if credits_held is not None:
            self.state["credits_held"] = credits_held
        if cap_cents is not None:
            self.state["cap"] = round(cap_cents / 100.0, 4)
        elif credits_held is not None:
            b = brain or self._brain_money()
            self.state["cap"] = round(cap_cents_from_credits(credits_held, b["credit_value_usd"], b["spend_cap_ratio"]) / 100.0, 4)
        self.alert = False
        self._save()

    @staticmethod
    def _brain_money() -> Dict[str, float]:
        from . import brain as brain_mod
        b = brain_mod.load()
        return {"credit_value_usd": b["credit_value_usd"], "spend_cap_ratio": b["spend_cap_ratio"]}

    def _load(self) -> Dict[str, Any]:
        if os.path.exists(self.path):
            with open(self.path) as f:
                s = json.load(f)
        else:
            s = {"cap": 0.0, "spent": 0.0, "log": []}
        s.setdefault("log", [])
        s.setdefault("daily", {})
        s.setdefault("credits_held", None)
        return s

    def _save(self) -> None:
        d = os.path.dirname(self.path)
        if d:
            os.makedirs(d, exist_ok=True)
        with open(self.path, "w") as f:
            json.dump(self.state, f, indent=1)

    @property
    def cap_cents(self) -> int:
        return int(round(float(self.state["cap"]) * 100))

    @property
    def spent_cents(self) -> float:
        return round(float(self.state["spent"]) * 100, 4)

    @property
    def remaining_cents(self) -> int:
        return max(0, int(self.cap_cents - self.spent_cents + EPS))

    def line(self) -> str:
        return "METER $%.2f of $%.2f cap" % (self.state["spent"], self.state["cap"])

    def _daily(self, vendor: str) -> float:
        return float(self.state["daily"].get(time.strftime("%Y-%m-%d"), {}).get(vendor, 0))

    def check(self, step: str, vendor: str, units: int, unit_cents: float) -> Decision:
        """Would this spend fit? Pure: records nothing."""
        cost = round(units * unit_cents, 4)
        if self.spent_cents + cost > self.cap_cents + EPS:
            return Decision(False, self.remaining_cents, "cap", None)
        ceiling = daily_ceiling_cents(vendor)
        if self._daily(vendor) + cost > ceiling + EPS:
            self.alert = True
            return Decision(False, self.remaining_cents, "daily_ceiling", None)
        return Decision(True, self.remaining_cents, "ok", None)

    def charge(self, step: str, vendor: str, units: int, unit_cents: float) -> Decision:
        """Check, then record the actual units. Returns allowed=False (nothing recorded) on cap."""
        decision = self.check(step, vendor, units, unit_cents)
        if not decision.allowed:
            return decision
        cost = round(units * unit_cents, 4)
        spend_id = uuid.uuid4().hex
        self.state["spent"] = round(float(self.state["spent"]) + cost / 100.0, 6)
        self.state["log"].append({"step": step, "vendor": vendor, "n": units, "cost": round(cost / 100.0, 6), "cents": cost,
                                  "ts": time.strftime("%Y-%m-%d %H:%M"), "spend_id": spend_id})
        day = self.state["daily"].setdefault(time.strftime("%Y-%m-%d"), {})
        day[vendor] = round(float(day.get(vendor, 0)) + cost, 4)
        if day[vendor] >= ALERT_FRACTION * daily_ceiling_cents(vendor):
            self.alert = True
        self._save()
        return Decision(True, self.remaining_cents, "ok", spend_id)


METER_SQL = ("select public.lead_engine_meter(:'operator'::uuid, :'job'::uuid, :'vendor', :'step', "
             ":units::int, :cents::int)")


class PostgresMeter:
    """Delegates the cap decision to public.lead_engine_meter. No local fallback, by design."""

    def __init__(self, database_url: str, operator_id: str, job_id: str, binary: Optional[str] = None) -> None:
        self.database_url, self.operator_id, self.job_id, self.binary = database_url, operator_id, job_id, binary
        self.alert = False

    def _call(self, step: str, vendor: str, units: int, cents: int) -> Decision:
        out = psql.run(self.database_url, METER_SQL, {"operator": self.operator_id, "job": self.job_id, "vendor": vendor,
                                                      "step": step, "units": str(units), "cents": str(cents)},
                       step="meter", binary=self.binary)
        try:
            d = json.loads(out)
        except ValueError:
            raise Frozen("meter", "lead_engine_meter returned non-JSON: %s" % out[:120])
        if not isinstance(d, dict) or "allowed" not in d:
            raise Frozen("meter", "lead_engine_meter returned an unexpected shape")
        return Decision(bool(d["allowed"]), int(d.get("remaining_cents") or 0), str(d.get("reason") or ""), d.get("spend_id"))

    def check(self, step: str, vendor: str, units: int, unit_cents: float) -> Decision:
        """Zero-unit call reads remaining_cents; the fit test is local so nothing is recorded."""
        probe = self._call(step, vendor, 0, 0)
        cost = int(round(units * unit_cents + 0.499999))
        if not probe.allowed or cost > probe.remaining_cents:
            return Decision(False, probe.remaining_cents, probe.reason if probe.reason and probe.reason != "ok" else "cap", None)
        return Decision(True, probe.remaining_cents, "ok", None)

    def charge(self, step: str, vendor: str, units: int, unit_cents: float) -> Decision:
        cents = int(round(units * unit_cents + 0.499999))
        return self._call(step, vendor, units, cents)

    def line(self) -> str:
        return "METER (postgres) job %s" % self.job_id
