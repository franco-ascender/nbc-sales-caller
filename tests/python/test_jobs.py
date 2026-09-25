import json
import os
import unittest

from _helpers import tmpdir

from ownercell import jobs
from ownercell.errors import Frozen
from ownercell.meter import FileMeter


def _read(path):
    with open(path) as f:
        return json.load(f)


class FreezeResume(unittest.TestCase):
    def test_freeze_mid_loop_then_resume_without_repeating_paid_calls(self) -> None:
        out = tmpdir()
        meter = FileMeter(os.path.join(out, "spend.json"), cap_cents=10000)
        rows = list(range(10))
        done = []
        blow_up = {"at": 4}

        def step(state):
            for i in range(state.cursor, len(rows)):
                if i == blow_up["at"]:
                    blow_up["at"] = None
                    raise Frozen("verify", "HTTP 503 from vendor", {"cursor": i})
                meter.charge("verify", "batchdata", 1, 7)
                done.append(rows[i])
                state.cursor = i + 1

        state = jobs.JobState(out, data={"cmd": "test"})
        self.assertFalse(jobs.run(state, step))
        saved = _read(state.path)
        self.assertEqual(saved["status"], "needs_attention")
        self.assertEqual(saved["cursor"], 4)
        self.assertEqual(saved["step"], "verify")
        self.assertIn("503", saved["reason"])
        self.assertEqual(len(meter.state["log"]), 4)

        self.assertTrue(jobs.resume(out, step))
        saved = _read(state.path)
        self.assertEqual(saved["status"], "delivered")
        self.assertEqual(saved["cursor"], 10)
        self.assertEqual(done, rows)
        self.assertEqual(len(meter.state["log"]), 10)  # each paid unit charged exactly once

    def test_delivered_job_is_not_resumable(self) -> None:
        out = tmpdir()
        jobs.JobState(out, status="delivered").save()
        self.assertFalse(jobs.resume(out, lambda s: None))

    def test_missing_state_freezes(self) -> None:
        with self.assertRaises(Frozen):
            jobs.JobState.load(tmpdir())


if __name__ == "__main__":
    unittest.main()
