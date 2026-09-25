"""The one exception the engine raises when it cannot continue.

engine.py used die() (print + sys.exit) at ~30 sites. A worker that exits cannot persist
where it stopped, so the operator had to re-run and re-spend. Frozen carries everything a
resume needs; jobs.run() catches it, writes needs_attention and returns. Only the CLI's
last line ever calls sys.exit.
"""
from typing import Any, Dict, Optional


class Frozen(Exception):
    """A step stopped: HTTP failure, cap, missing key, unexpected body.

    step:   which step froze (scrape, verify, trace, parcel, deliver, meter, outcomes).
    reason: one human line, never containing a secret.
    resume: JSON-serialisable dict with what is needed to continue (cursor, partial output path).
    """

    def __init__(self, step: str, reason: str, resume: Optional[Dict[str, Any]] = None) -> None:
        super().__init__("%s: %s" % (step, reason))
        self.step = step
        self.reason = reason
        self.resume = dict(resume or {})

    def to_dict(self) -> Dict[str, Any]:
        return {"step": self.step, "reason": self.reason, "resume": self.resume}
