"""argparse front end: engine.py's commands plus route, coverage, resume, outcomes import.

Why the shape: the same flags as engine.py so Anas's runbooks keep working; paid commands
run inside jobs.run so a Frozen leaves <work>/.job.json in needs_attention and `resume <dir>`
continues. The only sys.exit is in __main__.
"""
import argparse
import json
import os
import re
import time
from typing import Any, Dict, List, Optional

from . import brain, deliver, investors, jobs, names, outcomes, parcel, scrape, trace, verify
from .common import UNIT_CENTS, load_json, require_key, load_env, save, show_addresses, work_dir
from .errors import Frozen
from .meter import FileMeter

DOC = """ownercell: one CLI for every lane. Nothing is spent without --go and a meter check."""


def _meter(work: str) -> FileMeter:
    return FileMeter(os.path.join(work, "spend.json"))


def _preflight(label: str, n: int, unit_cents: float, meter: FileMeter, go: bool) -> bool:
    print(scrape.estimate_line(label, n, unit_cents, meter))
    d = meter.check(label, "estimate", n, unit_cents)
    if not d.allowed:
        print("STOP: would exceed the cap (%s). Ask for a higher cap." % d.reason)
        return False
    if not go:
        print("Dry run. Re-run with --go to spend this. (Rule: nothing is spent that was not in the last message.)")
        return False
    return True


def cmd_meter(a: Any, work: str) -> int:
    path = os.path.join(work, "spend.json")
    if a.new and os.path.exists(path):
        os.replace(path, os.path.join(work, "spend_%s_%s.json" % (re.sub(r"[^A-Za-z0-9]+", "_", a.new), time.strftime("%Y%m%d%H%M"))))
        print("  archived previous meter; new job: %s" % a.new)
    m = FileMeter(path, cap_cents=int(round(a.cap * 100)) if a.cap is not None else None, credits_held=a.credits)
    if a.reset:
        m.state.update({"spent": 0.0, "log": [], "daily": {}})
        m._save()
    print(m.line())
    for l in m.state["log"][-10:]:
        print("   %s  %-12s n=%-5s $%.2f" % (l.get("ts"), l.get("step"), l.get("n"), l.get("cost", 0)))
    return 0


def cmd_scrape(a: Any, work: str) -> int:
    meter, env = _meter(work), load_env()
    cities = [c.strip() for c in a.cities.split(";") if c.strip()]
    qs = ["%s, %s" % (a.kw, c) for c in cities]
    if not _preflight("scrape %d queries x %d businesses, then verify each" % (len(qs), a.limit), len(qs) * a.limit,
                      UNIT_CENTS["scrape"] + UNIT_CENTS["verify"], meter, a.go):
        return 0

    def step(state: jobs.JobState) -> None:
        rows = scrape.outscraper(qs, a.limit, require_key(env, "OUTSCRAPER_API_KEY", "scrape"), meter)
        allow = scrape.allow_pattern(a.kw, a.allow)
        biz, drops, unjudged = scrape.filter_rows(rows, allow)
        print("  scraped %d, kept %d, dropped %s, kept-without-category %d (allowlist: /%s/)" % (len(rows), len(biz), dict(drops), unjudged, allow.pattern))
        if not biz:
            raise Frozen("scrape", "nothing to verify")
        v, stop = verify.verify([b["phone"] for b in biz], require_key(env, "BATCHDATA_API_KEY", "verify"), meter)
        mob, cl = verify.apply_verification(biz, v)
        print("RESULT %s: %d verified -> %d mobile (%.0f%%) -> %d clean (%.0f%%)" % (a.tag, len(biz), mob, mob / len(biz) * 100, cl, cl / len(biz) * 100))
        save(a.tag, "traced", biz, work)
        if stop:
            state.reason = "stopped by meter: %s" % stop.reason

    return 0 if jobs.run(jobs.JobState(work, data={"cmd": "scrape", "args": vars(a)}), step) else 2


def cmd_names(a: Any, work: str) -> int:
    save(a.tag, "names", names.run(a, work), work)
    return 0


def cmd_parcel(a: Any, work: str) -> int:
    picks = parcel.run(load_json(a.inp), a.state.upper(), work)
    save(a.tag, "picks", show_addresses(picks), work)
    return 0


def cmd_investors(a: Any, work: str) -> int:
    out = investors.run(a.state, a.county, a.min, a.max, a.n, a.seed)
    save(a.tag, "picks", show_addresses(out), work)
    return 0


def cmd_trace(a: Any, work: str, cursor: int = 0) -> int:
    meter, env = _meter(work), load_env()
    picks = show_addresses(load_json(a.inp))
    withphone = [p for p in picks if p.get("phone")]
    totrace = [p for p in picks if not p.get("phone")]
    if cursor == 0:
        ok = _preflight("trace %d + verify %d" % (len(totrace), len(withphone)), len(totrace), UNIT_CENTS["trace"], meter, a.go) if totrace \
            else _preflight("verify %d" % len(withphone), len(withphone), UNIT_CENTS["verify"], meter, a.go)
        if not ok:
            return 0
    key = require_key(env, "BATCHDATA_API_KEY", "trace")
    partial = os.path.join(work, "traced_%s.partial.json" % a.tag)

    def step(state: jobs.JobState) -> None:
        start = state.cursor
        if start and os.path.exists(partial):
            totrace[:start] = load_json(partial)[:start]  # already paid for; never re-trace
        elif withphone:
            v, _ = verify.verify([p["phone"] for p in withphone], key, meter)
            for p in withphone:
                x = v.get(p["phone"], {})
                p.update({"type": x.get("type"), "dnc": bool(x.get("dnc")), "tcpa": bool(x.get("tcpa")), "lane": "C-registry"})
        try:
            nxt, stop = trace.trace(totrace, key, meter, start=start)
        except Frozen as fz:
            with open(partial, "w") as f:
                json.dump(totrace, f, indent=1)
            fz.resume.setdefault("cursor", _done_cursor(totrace))
            raise
        state.cursor = nxt
        mob, cl = trace.finalize(picks)
        print("RESULT %s: %d traced -> %d mobile (%.0f%%) -> %d clean (%.0f%%)" % (a.tag, len(picks), mob, mob / max(len(picks), 1) * 100, cl, cl / max(len(picks), 1) * 100))
        save(a.tag, "traced", picks, work)
        if stop:
            state.reason = "stopped by meter: %s" % stop.reason

    st = jobs.JobState(work, cursor=cursor, data={"cmd": "trace", "args": vars(a)})
    return 0 if jobs.run(st, step) else 2


def _done_cursor(rows: List[Dict[str, Any]]) -> int:
    n = 0
    for p in rows:
        if "trace_status" not in p:
            break
        n += 1
    return n


def cmd_deliver(a: Any, work: str) -> int:
    rows: List[Dict[str, Any]] = []
    for p in a.inp:
        rows += load_json(p)
    m = _meter(work)
    deliver.build(a.name, rows, a.outdir, a.dnc, a.master, m.line(), float(m.state["spent"]), float(m.state["cap"]))
    return 0


def cmd_route(a: Any, work: str) -> int:
    print(json.dumps(brain.route(a.industry, a.state), indent=1))
    return 0


def cmd_coverage(a: Any, work: str) -> int:
    cells = brain.coverage()
    if a.json:
        print(json.dumps(cells, indent=1))
    else:
        for c in cells:
            print("%-28s %s  %s  %-10s %s" % (c["industry"], c["state"], c["recipe"], c["legal_status"], "available" if c["available"] else "no path"))
    return 0


def cmd_resume(a: Any, work: str) -> int:
    st = jobs.JobState.load(a.dir)
    data = st.data or {}
    if data.get("cmd") != "trace":
        print("resume supports trace jobs; %s is %s (%s)" % (a.dir, st.status, data.get("cmd")))
        return 2
    args = argparse.Namespace(**data["args"])
    args.go = True
    return cmd_trace(args, a.dir, cursor=st.cursor)


def cmd_outcomes(a: Any, work: str) -> int:
    rows = outcomes.read_outcomes(a.xlsx)
    print("read %d outcome rows from %s" % (len(rows), a.xlsx))
    if a.post:
        env = load_env()
        url = os.environ.get("DATABASE_URL") or env.get("DATABASE_URL")
        if not url or not a.operator:
            raise Frozen("outcomes", "DATABASE_URL and --operator are required to post")
        print("posted %d outcomes" % outcomes.post_outcomes(rows, url, a.operator))
    return 0


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="ownercell", description=DOC)
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("meter"); m.add_argument("--cap", type=float); m.add_argument("--credits", type=float, help="credits held; cap = credits x credit value x ratio")
    m.add_argument("--reset", action="store_true"); m.add_argument("--new", metavar="JOB")
    s = sub.add_parser("scrape"); s.add_argument("--tag", required=True); s.add_argument("--kw", required=True); s.add_argument("--cities", required=True)
    s.add_argument("--limit", type=int, default=40); s.add_argument("--go", action="store_true"); s.add_argument("--allow")
    n = sub.add_parser("names"); n.add_argument("--tag", required=True); n.add_argument("--source", required=True, choices=names.SOURCES)
    for flag in ("--state", "--city", "--county", "--industry", "--taxonomy", "--orgname", "--region", "--surnames"):
        n.add_argument(flag)
    n.add_argument("--pm", action="store_true"); n.add_argument("--in", dest="inp"); n.add_argument("--n", type=int, default=200); n.add_argument("--seed", type=int, default=1)
    p = sub.add_parser("parcel"); p.add_argument("--tag", required=True); p.add_argument("--in", dest="inp", required=True); p.add_argument("--state", required=True)
    i = sub.add_parser("investors"); i.add_argument("--tag", required=True); i.add_argument("--state", required=True); i.add_argument("--county", required=True)
    i.add_argument("--min", type=int, default=3); i.add_argument("--max", type=int, default=8); i.add_argument("--n", type=int, default=100); i.add_argument("--seed", type=int, default=1)
    t = sub.add_parser("trace"); t.add_argument("--tag", required=True); t.add_argument("--in", dest="inp", required=True); t.add_argument("--go", action="store_true")
    d = sub.add_parser("deliver"); d.add_argument("--name", required=True); d.add_argument("--in", dest="inp", nargs="+", required=True)
    d.add_argument("--dnc", choices=["strict", "flag"], default="strict"); d.add_argument("--master", help="prior deliveries CSV (default env OWNERCELL_MASTER_CSV or <outdir>/MASTER - all owner cells.csv)")
    d.add_argument("--outdir", default=os.path.join(os.getcwd(), "out"))
    r = sub.add_parser("route"); r.add_argument("industry"); r.add_argument("state")
    c = sub.add_parser("coverage"); c.add_argument("--json", action="store_true")
    rs = sub.add_parser("resume"); rs.add_argument("dir")
    o = sub.add_parser("outcomes"); osub = o.add_subparsers(dest="sub", required=True)
    oi = osub.add_parser("import"); oi.add_argument("xlsx"); oi.add_argument("--post", action="store_true"); oi.add_argument("--operator")
    return ap


def main(argv: Optional[List[str]] = None) -> int:
    a = build_parser().parse_args(argv)
    work = work_dir()
    try:
        return globals()["cmd_" + a.cmd](a, work)
    except Frozen as fz:
        print("STOP (%s): %s" % (fz.step, fz.reason))
        return 2
    except (brain.BrainError, outcomes.OutcomeError) as e:
        print("STOP: %s" % e)
        return 2
