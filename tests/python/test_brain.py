import json
import os
import unittest

from _helpers import FIXTURES

from ownercell import brain


class BrainRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with open(os.path.join(FIXTURES, "brain-routes.json")) as f:
            cls.vectors = json.load(f)
        cls.b = brain.load()

    def test_every_shared_vector(self) -> None:
        for case in self.vectors["cases"]:
            with self.subTest(industry=case["industry"], state=case["state"]):
                r = brain.route(case["industry"], case["state"], self.b)
                self.assertEqual(r["recipe"], case["recipe"])
                self.assertEqual(r["legal_status"], case["legalStatus"])
                self.assertEqual(r["industry"], case["industryKey"])
                self.assertAlmostEqual(r["expected_clean"], case["expectedClean"])
                self.assertEqual(r["credits_per_clean_cell"], case["creditsPerCleanCell"])
                self.assertEqual(r["fallback_recipe"], case["fallbackRecipe"])
                self.assertEqual(r["state"], case["state"].upper())

    def test_unmatched_and_bad_states_raise(self) -> None:
        for text in self.vectors["unmatched"]:
            with self.assertRaises(brain.BrainError):
                brain.route(text, "FL", self.b)
        for state in self.vectors["badStates"]:
            with self.assertRaises(brain.BrainError):
                brain.route("hvac", state, self.b)

    def test_route_keys_match_ts_shape(self) -> None:
        r = brain.route("hvac", "FL", self.b)
        self.assertEqual(sorted(r), sorted(["industry", "state", "recipe", "fallback_recipe", "sources", "expected_clean", "expected_any", "n",
                                            "measured_by", "credits_per_clean_cell", "legal_status", "legal_note", "reason"]))
        self.assertEqual(r["sources"], ["Google Maps: hvac contractor"])

    def test_coverage_and_money(self) -> None:
        cells = brain.coverage(self.b)
        self.assertEqual(len(cells), len(self.b["industries"]) * len(self.b["states"]))
        sc = [c for c in cells if c["industry"] == "contractor_registry" and c["state"] == "SC"][0]
        self.assertFalse(sc["available"])
        self.assertEqual(brain.credits_for_cells(20, 2), 40)
        self.assertEqual(brain.cap_cents_for_credits(100, self.b), 600)  # 100 credits x $0.10 x 0.6

    def test_validation_rejects_bad_file(self) -> None:
        with open(os.path.join(brain.ROOT, "src", "data", "lead-engine-brain.json")) as f:
            raw = json.load(f)
        raw["dial_window_local"]["end"] = "21:00"
        with self.assertRaises(brain.BrainError):
            brain.validate(raw)


if __name__ == "__main__":
    unittest.main()
