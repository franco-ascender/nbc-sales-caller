import json
import os
import subprocess
import sys
import unittest

from _helpers import ROOT, tmpdir


def run(*args):
    env = dict(os.environ, OWNERCELL_WORK=tmpdir())
    return subprocess.run([sys.executable, "-m", "ownercell"] + list(args), cwd=ROOT, env=env, capture_output=True, text=True, timeout=60)


class CliSmoke(unittest.TestCase):
    def test_help_exits_zero(self) -> None:
        r = run("--help")
        self.assertEqual(r.returncode, 0, r.stderr)
        for cmd in ("scrape", "names", "parcel", "investors", "trace", "deliver", "route", "coverage", "resume", "outcomes"):
            self.assertIn(cmd, r.stdout)

    def test_route_hvac_fl_is_recipe_a(self) -> None:
        r = run("route", "hvac", "FL")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)["recipe"], "A")

    def test_route_contractors_sc_is_prohibited(self) -> None:
        r = run("route", "contractors", "SC")
        self.assertEqual(r.returncode, 0, r.stderr)
        d = json.loads(r.stdout)
        self.assertEqual(d["legal_status"], "prohibited")
        self.assertEqual(d["fallback_recipe"], "A")

    def test_bad_state_exits_nonzero_without_traceback(self) -> None:
        r = run("route", "hvac", "Florida")
        self.assertEqual(r.returncode, 2)
        self.assertIn("STOP", r.stdout)
        self.assertNotIn("Traceback", r.stderr)

    def test_paid_command_without_go_is_a_dry_run(self) -> None:
        r = run("meter", "--cap", "5")
        self.assertEqual(r.returncode, 0, r.stderr)
        # the meter command uses the fresh work dir per run, so the scrape below gets a 0 cap and stops before any spend
        r = run("scrape", "--tag", "t", "--kw", "roofer", "--cities", "Tampa, FL")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("ESTIMATE", r.stdout)
        self.assertNotIn("Traceback", r.stderr)


if __name__ == "__main__":
    unittest.main()
