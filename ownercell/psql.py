"""Run one SQL statement through the psql binary.

Why: psycopg2 is not installed and the worker must stay standard library. Parameters go in
as psql variables (-v name=value) and are referenced as :'name' or :name in the SQL, so
nothing is string-interpolated into the statement. A missing binary or a non-zero exit
raises Frozen; there is deliberately no fallback to a local file.
"""
import shutil
import subprocess
from typing import Dict, List, Optional

from .errors import Frozen

PSQL_FLAGS = ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"]


def redact(text: str, database_url: str) -> str:
    """Never echo the connection string (it holds the password)."""
    return text.replace(database_url, "[database_url]")[:300]


def run(database_url: str, sql: str, variables: Dict[str, str], step: str = "psql",
        binary: Optional[str] = None, timeout: int = 60) -> str:
    """Return trimmed stdout of psql. Frozen on any failure."""
    exe = binary or shutil.which("psql")
    if not exe:
        raise Frozen(step, "psql binary not found on PATH; install postgresql client")
    cmd: List[str] = [exe] + PSQL_FLAGS
    for name, value in variables.items():
        cmd += ["-v", "%s=%s" % (name, value)]
    cmd += ["-c", sql, database_url]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as e:
        raise Frozen(step, "psql failed to run: %s" % type(e).__name__)
    if proc.returncode != 0:
        raise Frozen(step, "psql exit %d: %s" % (proc.returncode, redact(proc.stderr.strip(), database_url)))
    return proc.stdout.strip()
