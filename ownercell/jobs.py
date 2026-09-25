"""Job state: freeze on Frozen, persist, resume from the cursor.

Why: the build plan's state machine is draft, quoted, sample_running, sample_done, running,
delivered, needs_attention. A worker that raises mid-loop must leave enough on disk that the
next run continues without repeating paid calls. State lives in <out>/.job.json.
"""
import json
import os
import time
from typing import Any, Callable, Dict, Optional

from .errors import Frozen

STATUSES = ("draft", "quoted", "sample_running", "sample_done", "running", "delivered", "needs_attention")
FILE = ".job.json"


class JobState:
    def __init__(self, out_dir: str, status: str = "draft", step: str = "", cursor: int = 0, spend: Optional[Dict[str, Any]] = None,
                 reason: str = "", resume: Optional[Dict[str, Any]] = None, data: Optional[Dict[str, Any]] = None) -> None:
        self.out_dir, self.status, self.step, self.cursor = out_dir, status, step, cursor
        self.spend, self.reason, self.resume, self.data = dict(spend or {}), reason, dict(resume or {}), dict(data or {})
        self.updated = ""

    @property
    def path(self) -> str:
        return os.path.join(self.out_dir, FILE)

    def set(self, status: str, **fields: Any) -> None:
        if status not in STATUSES:
            raise ValueError("unknown status %s" % status)
        self.status = status
        for k, v in fields.items():
            setattr(self, k, v)
        self.save()

    def to_dict(self) -> Dict[str, Any]:
        return {"status": self.status, "step": self.step, "cursor": self.cursor, "spend": self.spend, "reason": self.reason,
                "resume": self.resume, "data": self.data, "updated": self.updated}

    def save(self) -> str:
        os.makedirs(self.out_dir, exist_ok=True)
        self.updated = time.strftime("%Y-%m-%dT%H:%M:%S")
        with open(self.path, "w") as f:
            json.dump(self.to_dict(), f, indent=1)
        return self.path

    @classmethod
    def load(cls, out_dir: str) -> "JobState":
        p = os.path.join(out_dir, FILE)
        if not os.path.exists(p):
            raise Frozen("resume", "no %s in %s" % (FILE, out_dir))
        with open(p) as f:
            d = json.load(f)
        return cls(out_dir, d.get("status", "draft"), d.get("step", ""), int(d.get("cursor", 0)), d.get("spend"), d.get("reason", ""), d.get("resume"), d.get("data"))


StepFn = Callable[[JobState], Any]


def run(state: JobState, step_fn: StepFn, running_status: str = "running", done_status: str = "delivered") -> bool:
    """Run step_fn(state). On Frozen: persist needs_attention with the cursor and return False."""
    state.set(running_status)
    try:
        step_fn(state)
    except Frozen as fz:
        cursor = fz.resume.get("cursor", state.cursor)
        state.set("needs_attention", step=fz.step, reason=fz.reason, resume=fz.resume, cursor=int(cursor) if isinstance(cursor, int) else state.cursor)
        print("FROZEN at %s (cursor %s): %s. State saved to %s" % (fz.step, state.cursor, fz.reason, state.path))
        return False
    state.set(done_status, reason="")
    return True


def resume(out_dir: str, step_fn: StepFn, done_status: str = "delivered") -> bool:
    """Continue a needs_attention job from its cursor; step_fn reads state.cursor and skips finished work."""
    state = JobState.load(out_dir)
    if state.status not in ("needs_attention", "running", "sample_running"):
        print("job in %s is not resumable" % state.status)
        return False
    print("RESUME %s from step %s cursor %d" % (out_dir, state.step, state.cursor))
    return run(state, step_fn, done_status=done_status)
