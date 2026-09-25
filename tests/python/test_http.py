import io
import json
import unittest
import urllib.error
import urllib.request

import _helpers  # noqa: F401  (sys.path)

from ownercell import http
from ownercell.errors import Frozen

KEY = "sk_live_SUPERSECRETKEY123456"


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def http_error(code, body):
    return urllib.error.HTTPError("https://api.example/x?key=" + KEY, code, "err", {}, io.BytesIO(body.encode()))


class GetJson(unittest.TestCase):
    def setUp(self) -> None:
        self.original = urllib.request.urlopen
        self.sleeps = []

    def tearDown(self) -> None:
        urllib.request.urlopen = self.original

    def test_500_then_200_succeeds_after_retry(self) -> None:
        calls = []

        def fake(req, timeout=0):
            calls.append(req.full_url)
            if len(calls) == 1:
                raise http_error(500, "upstream hiccup")
            return FakeResponse(json.dumps({"ok": True}).encode())

        urllib.request.urlopen = fake
        out = http.get_json("https://api.example/x", sleep=self.sleeps.append)
        self.assertEqual(out, {"ok": True})
        self.assertEqual(len(calls), 2)
        self.assertEqual(len(self.sleeps), 1)

    def test_403_insufficient_balance_freezes_without_leaking_key(self) -> None:
        def fake(req, timeout=0):
            raise http_error(403, json.dumps({"status": {"code": 403, "text": "Insufficient balance", "echo": KEY}}))

        urllib.request.urlopen = fake
        with self.assertRaises(Frozen) as ctx:
            http.get_json("https://api.example/x?key=" + KEY, headers={"Authorization": "Bearer " + KEY}, sleep=self.sleeps.append, step="verify")
        reason = ctx.exception.reason
        self.assertIn("balance", reason.lower())
        self.assertNotIn(KEY, reason)
        self.assertNotIn("key=", reason)
        self.assertEqual(ctx.exception.step, "verify")
        self.assertEqual(self.sleeps, [])  # a permanent 4xx is not retried

    def test_gives_up_after_five_attempts(self) -> None:
        def fake(req, timeout=0):
            raise http_error(503, "busy")

        urllib.request.urlopen = fake
        with self.assertRaises(Frozen) as ctx:
            http.get_json("https://api.example/x", sleep=self.sleeps.append)
        self.assertIn("5 attempts", ctx.exception.reason)
        self.assertEqual(len(self.sleeps), 4)

    def test_body_error_detects_batchdata_403_in_200(self) -> None:
        with self.assertRaises(Frozen) as ctx:
            http.body_error({"status": {"code": 403, "text": "Insufficient balance"}}, "verify", "https://api.batchdata.com/x")
        self.assertIn("403", ctx.exception.reason)
        http.body_error({"status": {"code": 200}, "results": {}}, "verify", "u")  # no raise


if __name__ == "__main__":
    unittest.main()
