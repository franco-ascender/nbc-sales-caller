import json
import os
import unittest

from _helpers import tmpdir

from ownercell import meter
from ownercell.errors import Frozen

BRAIN_MONEY = {"credit_value_usd": 0.1, "spend_cap_ratio": 0.6}


def _read(path):
    with open(path) as f:
        return json.load(f)


class FileMeterAcceptance(unittest.TestCase):
    def setUp(self) -> None:
        self.path = os.path.join(tmpdir(), "spend.json")
        os.environ.pop("OWNERCELL_DAILY_CEILING_BATCHDATA_CENTS", None)

    def test_one_dollar_cap_stops_at_exactly_one_dollar(self) -> None:
        # Build plan Phase 0 acceptance: a fake job with a $1 cap. credits_held such that cap = 100 cents:
        # 100 / (10 cents * 0.6) = 16.67 credits; the spec allows an explicit cap too, so check both agree.
        m = meter.FileMeter(self.path, credits_held=16.6667, brain=BRAIN_MONEY)
        self.assertEqual(m.cap_cents, 100)
        decisions = []
        for _ in range(30):
            d = m.charge("verify", "batchdata", 1, 7)
            decisions.append(d)
            if not d.allowed:
                break
        allowed = [d for d in decisions if d.allowed]
        self.assertEqual(len(allowed), 14)  # 14 x 7 = 98 cents; the 15th would be 105
        last = decisions[-1]
        self.assertFalse(last.allowed)
        self.assertEqual(last.reason, "cap")
        self.assertEqual(last.remaining_cents, 2)
        state = _read(self.path)
        self.assertLessEqual(state["spent"], state["cap"])
        self.assertAlmostEqual(sum(l["cost"] for l in state["log"]), state["spent"], places=6)
        self.assertAlmostEqual(state["spent"], 0.98)
        self.assertEqual(len(state["log"]), 14)
        self.assertTrue(all(l["spend_id"] for l in state["log"]))

    def test_old_engine_meter_file_still_loads(self) -> None:
        with open(self.path, "w") as f:
            json.dump({"cap": 10.0, "spent": 2.5, "log": [{"step": "verify", "n": 10, "cost": 0.07, "ts": "2026-09-01 10:00"}]}, f)
        m = meter.FileMeter(self.path)
        self.assertEqual(m.cap_cents, 1000)
        self.assertEqual(m.remaining_cents, 750)
        self.assertEqual(m.line(), "METER $2.50 of $10.00 cap")
        self.assertTrue(m.charge("verify", "batchdata", 1, 7).allowed)

    def test_check_records_nothing(self) -> None:
        m = meter.FileMeter(self.path, cap_cents=100)
        self.assertTrue(m.check("verify", "batchdata", 5, 7).allowed)
        self.assertFalse(m.check("verify", "batchdata", 15, 7).allowed)
        self.assertEqual(_read(self.path)["log"], [])

    def test_daily_ceiling_stops_and_alerts(self) -> None:
        os.environ["OWNERCELL_DAILY_CEILING_BATCHDATA_CENTS"] = "50"
        try:
            m = meter.FileMeter(self.path, cap_cents=100000)
            results = [m.charge("verify", "batchdata", 1, 7) for _ in range(8)]
        finally:
            del os.environ["OWNERCELL_DAILY_CEILING_BATCHDATA_CENTS"]
        self.assertTrue(all(r.allowed for r in results[:7]))  # 49 cents
        self.assertFalse(results[7].allowed)
        self.assertEqual(results[7].reason, "daily_ceiling")
        self.assertTrue(m.alert)  # 49 >= 80% of 50
        # a different vendor is unaffected
        self.assertTrue(m.charge("scrape", "outscraper", 1, 7).allowed)

    def test_cap_from_credits_uses_brain_numbers(self) -> None:
        self.assertEqual(meter.cap_cents_from_credits(40, 0.1, 0.6), 240)
        self.assertEqual(meter.cap_cents_from_credits(40, 0.25, 0.5), 500)


class PostgresMeterContract(unittest.TestCase):
    def test_missing_psql_freezes(self) -> None:
        m = meter.PostgresMeter("postgres://user:pw@localhost/db", "0" * 32, "1" * 32, binary="/nonexistent/psql")
        with self.assertRaises(Frozen) as ctx:
            m.charge("verify", "batchdata", 10, 7)
        self.assertNotIn("pw@", ctx.exception.reason)

    def test_parses_jsonb_decision(self) -> None:
        captured = {}

        def fake_run(url, sql, variables, step="", binary=None, timeout=60):
            captured.update(variables)
            captured["sql"] = sql
            return json.dumps({"allowed": False, "remaining_cents": 3, "reason": "cap", "spend_id": None})

        original = meter.psql.run
        meter.psql.run = fake_run
        try:
            d = meter.PostgresMeter("postgres://x", "op", "job").charge("verify", "batchdata", 10, 7)
        finally:
            meter.psql.run = original
        self.assertEqual(d, meter.Decision(False, 3, "cap", None))
        self.assertEqual(captured["units"], "10")
        self.assertEqual(captured["cents"], "70")
        self.assertIn(":'operator'::uuid", captured["sql"])
        self.assertNotIn("batchdata", captured["sql"])  # values travel as psql variables, never in the SQL text


if __name__ == "__main__":
    unittest.main()
