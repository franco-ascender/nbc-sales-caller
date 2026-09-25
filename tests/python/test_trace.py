import os
import random
import unittest

from _helpers import tmpdir

from ownercell import trace
from ownercell.meter import FileMeter

PICKS = [
    {"first": "Ana", "last": "Lopez", "street": "12 Palm Ave", "city": "Tampa", "state": "FL", "zip": "33602"},
    {"first": "Bo", "last": "Chen", "street": "77 Oak St", "city": "Orlando", "state": "FL", "zip": "32801"},
    {"first": "Cy", "last": "Diaz", "street": "5 Lake Rd", "city": "Miami", "state": "FL", "zip": "33101"},
    {"first": "Di", "last": "Evans", "street": "9 Hill Dr", "city": "Ocala", "state": "FL", "zip": "34470"},
]


def person(p, number, echo="meta"):
    res = {"phoneNumbers": [{"number": number, "type": "Mobile", "score": 90, "dnc": False, "tcpa": False}], "emails": [{"email": p["first"].lower() + "@x.com"}]}
    payload = {"propertyAddress": {"street": p["street"].upper(), "zip": p["zip"]}, "name": {"first": p["first"], "last": p["last"].upper()}}
    if echo == "meta":
        res["meta"] = {"input": payload}
    else:
        res.update(payload)  # no echo: only the returned record's own address + name
    return res


class TraceMatching(unittest.TestCase):
    def test_shuffled_response_matches_right_rows_and_unmatched_stays_unknown(self) -> None:
        picks = [dict(p) for p in PICKS]
        persons = [person(picks[0], "8135550001", "meta"), person(picks[1], "4075550002", "record"), person(picks[2], "3055550003", "meta")]
        persons.append({"phoneNumbers": [{"number": "9995550009", "type": "Mobile"}], "name": {"first": "Zed", "last": "Nobody"},
                        "propertyAddress": {"street": "1 Nowhere", "zip": "00000"}})  # a stranger, must not attach to Di Evans
        random.Random(7).shuffle(persons)
        calls = []

        def fake_get(url, headers=None, data=None, step="", **kw):
            calls.append(data)
            return {"status": {"code": 200}, "results": {"persons": persons}}

        m = FileMeter(os.path.join(tmpdir(), "spend.json"), cap_cents=10000)
        nxt, stop = trace.trace(picks, "key", m, get=fake_get)
        self.assertEqual((nxt, stop), (4, None))
        self.assertEqual(picks[0]["phone"], "8135550001")
        self.assertEqual(picks[1]["phone"], "4075550002")
        self.assertEqual(picks[2]["phone"], "3055550003")
        self.assertEqual(picks[2]["email"], "cy@x.com")
        self.assertEqual(picks[3]["phone"], "")
        self.assertEqual(picks[3]["trace_status"], "unmatched")
        self.assertIsNone(picks[3]["type"])
        self.assertEqual(m.state["log"][0]["n"], 4)  # charged the 4 requests sent
        self.assertEqual(len(calls), 1)

    def test_cap_stops_cleanly_before_the_call(self) -> None:
        picks = [dict(p) for p in PICKS]
        m = FileMeter(os.path.join(tmpdir(), "spend.json"), cap_cents=10)  # 4 x 7 cents does not fit
        nxt, stop = trace.trace(picks, "key", m, get=lambda *a, **k: self.fail("must not call vendor"))
        self.assertEqual(nxt, 0)
        self.assertEqual(stop.reason, "cap")
        self.assertEqual(m.state["log"], [])


if __name__ == "__main__":
    unittest.main()
