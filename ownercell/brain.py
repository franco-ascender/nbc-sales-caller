"""Routing brain: mirror of src/lib/lead-engine-brain.ts.

Why a mirror and not a port with improvements: the TypeScript UI quotes a job with route()
and this worker executes it. If the two disagree the customer is billed for one recipe and
receives another. tests/fixtures/brain-routes.json is the shared contract; every change here
must keep every vector green on both sides.
"""
import json
import math
import os
import re
from typing import Any, Dict, List, Optional

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PATHS = [os.path.join(ROOT, "src", "data", "lead-engine-brain.json"), os.path.join(ROOT, "handoff", "02_brain_v2.json")]
RECIPES = ("A", "B", "C", "D")
LEGAL = ("ok", "restricted", "prohibited")
STATE_CODE = re.compile(r"^[A-Z]{2}$")


class BrainError(ValueError):
    pass


def _record(v: Any) -> bool:
    return isinstance(v, dict)


def _num(v: Any, label: str, lo: float = 0, hi: float = 1e9) -> float:
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < lo or v > hi:
        raise BrainError("%s must be a number between %s and %s" % (label, lo, hi))
    return v


def _str(v: Any, label: str) -> str:
    if not isinstance(v, str) or not v.strip():
        raise BrainError("%s must be a non-empty string" % label)
    return v


def _strings(v: Any) -> List[str]:
    return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []


def normalize_industry(text: str) -> str:
    t = re.sub(r"[_\-/,.()]+", " ", text.lower())
    t = re.sub(r"[^a-z0-9 ]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def validate(raw: Any) -> Dict[str, Any]:
    """Same checks as loadBrain(); a bad edit fails on boot, not on the first paid call."""
    if not _record(raw):
        raise BrainError("brain file must be an object")
    out: Dict[str, Any] = {"version": _str(raw.get("version"), "version"),
                           "credit_value_usd": _num(raw.get("credit_value_usd"), "credit_value_usd", 0.01, 10),
                           "spend_cap_ratio": _num(raw.get("spend_cap_ratio"), "spend_cap_ratio", 0.05, 1),
                           "rescrub_days": _num(raw.get("rescrub_days"), "rescrub_days", 1, 365)}
    sample = raw.get("sample")
    if not _record(sample):
        raise BrainError("sample missing")
    out["sample"] = {"target_cells": _num(sample.get("target_cells"), "sample.target_cells", 1, 1000),
                     "abort_below_fraction_of_expected": _num(sample.get("abort_if_clean_rate_below_fraction_of_expected"), "sample.abort", 0.05, 1),
                     "default_cities": _strings(sample.get("default_cities"))}
    if not out["sample"]["default_cities"]:
        raise BrainError("sample.default_cities empty")
    costs = raw.get("unit_costs_usd")
    if not _record(costs):
        raise BrainError("unit_costs_usd missing")
    out["unit_costs_usd"] = {k: _num(v, "unit_costs_usd.%s" % k, 0, 100) for k, v in costs.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}
    for req in ("scrape_per_business", "verify_per_number", "trace_per_person"):
        if req not in out["unit_costs_usd"]:
            raise BrainError("unit_costs_usd.%s missing" % req)
    recipes_raw = raw.get("recipes")
    if not _record(recipes_raw):
        raise BrainError("recipes missing")
    out["recipes"] = {}
    for key in RECIPES:
        e = recipes_raw.get(key)
        if not _record(e):
            raise BrainError("recipe %s missing" % key)
        steps = e.get("steps") if isinstance(e.get("steps"), list) else []
        out["recipes"][key] = {"key": key, "name": _str(e.get("name"), "recipe %s name" % key),
                               "credits_per_clean_cell": _num(e.get("credits_per_clean_cell"), "recipe %s credits" % key, 1, 100),
                               "paid_steps": [str(s.get("step")) for s in steps if _record(s) and s.get("paid") is True]}
    inds = raw.get("industries")
    if not _record(inds):
        raise BrainError("industries missing")
    out["industries"] = []
    for key, e in inds.items():
        if not _record(e):
            raise BrainError("industry %s must be an object" % key)
        if e.get("recipe") not in RECIPES:
            raise BrainError("industry %s recipe must be A-D" % key)
        ns = {s: src for s, src in e.get("name_source", {}).items() if isinstance(src, str)} if _record(e.get("name_source")) else {}
        expected_clean = _num(e.get("expected_clean"), "industry %s expected_clean" % key, 0, 1)
        out["industries"].append({"key": key, "aliases": [normalize_industry(a) for a in _strings(e.get("aliases"))], "recipe": e["recipe"],
                                  "keyword": e.get("keyword") if isinstance(e.get("keyword"), str) else None,
                                  "allow": e.get("allow") if isinstance(e.get("allow"), str) else None, "name_source": ns,
                                  "expected_clean": expected_clean,
                                  "expected_any": _num(e.get("expected_any", expected_clean), "industry %s expected_any" % key, 0, 1),
                                  "n": _num(e.get("n", 0), "industry %s n" % key, 0, 1e7),
                                  "measured_by": e.get("measured_by") if isinstance(e.get("measured_by"), str) else "unknown",
                                  "notes": e.get("notes") if isinstance(e.get("notes"), str) else None})
    if not out["industries"]:
        raise BrainError("no industries")
    states_raw = raw.get("states")
    if not _record(states_raw):
        raise BrainError("states missing")
    out["states"] = {}
    for code, e in states_raw.items():
        if not STATE_CODE.match(code) or not _record(e):
            continue
        legal = e.get("legal_status", "ok")
        if legal not in LEGAL:
            raise BrainError("state %s legal_status invalid" % code)
        out["states"][code] = {"code": code, "legal_status": legal, "legal_note": e.get("legal_note") if isinstance(e.get("legal_note"), str) else None,
                               "registry_phone": _strings(e.get("registry_phone")), "notes": e.get("notes") if isinstance(e.get("notes"), str) else None}
    out["output_columns"] = _strings(raw.get("output_columns"))
    for col in ("Cell Phone", "Time Zone", "Called", "Outcome", "Ledger Id"):
        if col not in out["output_columns"]:
            raise BrainError("output_columns missing %s" % col)
    dw = raw.get("dial_window_local")
    if not _record(dw):
        raise BrainError("dial_window_local missing")
    out["dial_window"] = {"start": _str(dw.get("start"), "dial start"), "end": _str(dw.get("end"), "dial end")}
    if out["dial_window"]["start"] < "08:00" or out["dial_window"]["end"] > "20:00":
        raise BrainError("dial window must sit inside 08:00-20:00")
    return out


_cache: Dict[str, Dict[str, Any]] = {}


def load(path: Optional[str] = None) -> Dict[str, Any]:
    """Application copy first, handoff original as fallback. Cached per path."""
    candidates = [path] if path else DEFAULT_PATHS
    for p in candidates:
        if p and os.path.exists(p):
            if p not in _cache:
                with open(p) as f:
                    _cache[p] = validate(json.load(f))
            return _cache[p]
    raise BrainError("brain file not found: %s" % ", ".join(str(c) for c in candidates))


def match_industry(text: str, state: str, source: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Longest exact key/alias, then alias inside text, then text inside alias; ties prefer the state."""
    wanted = normalize_industry(text)
    if not wanted:
        return None
    matches = []
    for ind in source["industries"]:
        score = 0
        for name in [normalize_industry(ind["key"])] + ind["aliases"]:
            if name == wanted:
                score = max(score, 1000 + len(name))
            elif name in wanted and re.search(r"\b%s\b" % re.escape(name), wanted):
                score = max(score, 500 + len(name))
            elif wanted in name and re.search(r"\b%s\b" % re.escape(wanted), name):
                score = max(score, 100 + len(wanted))
        if score == 0:
            continue
        if state in ind["name_source"] or "*" in ind["name_source"]:
            score += 10
        if ind["measured_by"] == "anas":
            score += 1
        matches.append((score, ind))
    if not matches:
        return None
    matches.sort(key=lambda m: -m[0])  # stable: first-declared wins a tie, like Array.sort
    return matches[0][1]


def route(industry_text: str, state_input: str, source: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    source = source or load()
    state = state_input.strip().upper()
    if not STATE_CODE.match(state):
        raise BrainError("state must be a two-letter code")
    ind = match_industry(industry_text, state, source)
    if not ind:
        raise BrainError('no industry in the brain matches "%s"' % industry_text)
    st = source["states"].get(state) or {"code": state, "legal_status": "ok", "legal_note": None, "registry_phone": [], "notes": None}
    if ind["recipe"] == "A":
        sources = ["Google Maps: %s" % ind["keyword"] if ind["keyword"] else "Google Maps"]
    else:
        src = ind["name_source"].get(state, ind["name_source"].get("*"))
        sources = [src] if src else []
    recipe, legal_status, legal_note, reason, fallback = ind["recipe"], "ok", None, "%s: recipe %s" % (ind["key"], ind["recipe"]), None
    if ind["recipe"] != "A":
        if not sources:
            reason, legal_status, legal_note, fallback = "%s: no %s source for %s" % (ind["key"], ind["recipe"], state), "restricted", "No name source for %s. Recipe A only." % state, "A"
        if st["legal_status"] != "ok":
            legal_status, legal_note = st["legal_status"], st["legal_note"]
            if st["legal_status"] == "prohibited":
                fallback, reason = "A", "%s: licensee lists prohibited in %s" % (ind["key"], state)
    return {"industry": ind["key"], "state": state, "recipe": recipe, "fallback_recipe": fallback, "sources": sources,
            "expected_clean": ind["expected_clean"], "expected_any": ind["expected_any"], "n": ind["n"], "measured_by": ind["measured_by"],
            "credits_per_clean_cell": source["recipes"][recipe]["credits_per_clean_cell"], "legal_status": legal_status,
            "legal_note": legal_note, "reason": reason}


def coverage(source: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    source = source or load()
    cells = []
    for ind in source["industries"]:
        for state in sorted(source["states"]):
            a = route(ind["key"], state, source)
            cells.append({"industry": ind["key"], "state": state, "recipe": a["recipe"], "legal_status": a["legal_status"],
                          "available": a["legal_status"] != "prohibited" and (a["recipe"] == "A" or len(a["sources"]) > 0),
                          "expected_clean": a["expected_clean"], "measured_by": a["measured_by"]})
    return cells


def credits_for_cells(target_cells: int, credits_per_clean_cell: float) -> int:
    return int(math.ceil(target_cells * credits_per_clean_cell))


def cap_cents_for_credits(credits: float, source: Optional[Dict[str, Any]] = None) -> int:
    source = source or load()
    return int(math.floor(credits * source["credit_value_usd"] * 100 * source["spend_cap_ratio"]))
