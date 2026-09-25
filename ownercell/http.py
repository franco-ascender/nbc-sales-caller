"""HTTP JSON client on urllib with a bounded retry loop.

Why: engine.py died on the first HTTP error, including transient 429/5xx from Outscraper
and BatchData. We retry those (and timeouts) up to 5 times with exponential backoff and
jitter, then raise Frozen with a body head. We never switch vendor (handoff rule). Other
4xx are permanent and raise immediately. BatchData reports "Insufficient balance" as a
403 code inside a 200 body, so body_error() inspects the payload too.
"""
import json
import random
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, Optional

from .errors import Frozen

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/120"}
RETRY_CODES = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 5
BODY_HEAD = 300


def safe_url(url: str) -> str:
    """Host and path only: query strings can carry keys."""
    return url.split("?")[0]


def body_head(body: Any, headers: Optional[Dict[str, str]] = None) -> str:
    """First 300 chars of a body with any header value (API keys) redacted."""
    text = body.decode("utf8", "ignore") if isinstance(body, (bytes, bytearray)) else str(body)
    for value in (headers or {}).values():
        for token in str(value or "").split():  # "Bearer KEY" redacts KEY on its own too
            if len(token) >= 8 and token in text:
                text = text.replace(token, "[redacted]")
    return text[:BODY_HEAD]


def _backoff(attempt: int) -> float:
    return min(30.0, (2 ** attempt) * 0.5) + random.uniform(0, 0.5)


def get_json(url: str, timeout: int = 60, headers: Optional[Dict[str, str]] = None, data: Optional[bytes] = None,
             step: str = "http", attempts: int = MAX_ATTEMPTS, sleep: Callable[[float], None] = time.sleep) -> Any:
    """GET (or POST when data is given) and parse JSON. Raises Frozen, never exits."""
    hdrs = dict(UA)
    hdrs.update(headers or {})
    last = ""
    for attempt in range(attempts):
        req = urllib.request.Request(url, headers=hdrs, data=data)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
            try:
                return json.loads(raw.decode("utf8", "ignore"))
            except ValueError:
                raise Frozen(step, "non-JSON body from %s: %s" % (safe_url(url), body_head(raw, hdrs)))
        except urllib.error.HTTPError as e:
            head = body_head(e.read(), hdrs)
            last = "HTTP %d from %s, body: %s" % (e.code, safe_url(url), head)
            if e.code not in RETRY_CODES:
                raise Frozen(step, last)
        except (urllib.error.URLError, socket.timeout, ConnectionError, OSError) as e:
            last = "%s: %s, %s" % (type(e).__name__, str(e)[:120], safe_url(url))
        if attempt + 1 < attempts:
            sleep(_backoff(attempt))
    raise Frozen(step, "gave up after %d attempts: %s" % (attempts, last))


def body_error(payload: Any, step: str, url: str) -> None:
    """BatchData puts status.code 403 "Insufficient balance" inside a 200 body. Freeze on it."""
    if not isinstance(payload, dict):
        return
    status = payload.get("status")
    code = status.get("code") if isinstance(status, dict) else None
    if isinstance(code, int) and code >= 400:
        raise Frozen(step, "vendor body code %d from %s: %s" % (code, safe_url(url), body_head(json.dumps(status))))
    if payload.get("error") and not payload.get("results"):
        raise Frozen(step, "vendor error from %s: %s" % (safe_url(url), body_head(json.dumps(payload.get("error")))))


def encode(params: Any) -> str:
    return urllib.parse.urlencode(params)
