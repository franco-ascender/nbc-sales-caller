import unittest
from datetime import datetime, timezone

import _helpers  # noqa: F401

from ownercell import tz


class Zones(unittest.TestCase):
    def test_zip_vectors_match_ts_test(self) -> None:
        expected = {"33602": "America/New_York", "32502": "America/Chicago", "79901": "America/Denver", "37201": "America/Chicago", "37902": "America/New_York"}
        for z, zone in expected.items():
            self.assertEqual(tz.zone_for_zip(z), zone, z)
        self.assertEqual(tz.zone_for_zip("33602-1234"), "America/New_York")
        self.assertEqual(tz.zone_for_zip(33602), "America/New_York")
        self.assertIsNone(tz.zone_for_zip("x"))
        self.assertIsNone(tz.zone_for_zip(None))

    def test_resolve_zone_falls_back_to_engine_tables(self) -> None:
        self.assertEqual(tz.resolve_zone(zip_code="79901", state="TX", city="El Paso"), "America/Denver")
        self.assertEqual(tz.resolve_zone(state="TX", city="El Paso"), "America/Denver")
        self.assertEqual(tz.resolve_zone(state="TN", city="Knoxville"), "America/New_York")
        self.assertEqual(tz.resolve_zone(state="TN", city="Nashville"), "America/Chicago")
        self.assertEqual(tz.resolve_zone(state="FL", city="Pensacola"), "America/Chicago")
        self.assertEqual(tz.resolve_zone(state="AZ"), "America/Phoenix")
        self.assertEqual(tz.resolve_zone(state="TX", phone10="9155551234"), "America/Denver")
        self.assertIsNone(tz.resolve_zone(state="ZZ"))
        self.assertIsNone(tz.resolve_zone())
        self.assertEqual(tz.tz_label("TX", "El Paso"), "Mountain")

    def test_window_edges(self) -> None:
        evening = datetime(2026, 9, 16, 0, 0, tzinfo=timezone.utc)  # 20:00 New York (closed), 19:00 Chicago (open)
        self.assertFalse(tz.within_dial_window(evening, "America/New_York"))
        self.assertTrue(tz.within_dial_window(evening, "America/Chicago"))
        morning = datetime(2026, 9, 16, 12, 0, tzinfo=timezone.utc)  # 08:00 New York (open), 07:00 Chicago (closed)
        self.assertTrue(tz.within_dial_window(morning, "America/New_York"))
        self.assertFalse(tz.within_dial_window(morning, "America/Chicago"))
        self.assertTrue(tz.within_dial_window(datetime(2026, 9, 16, 12, 0), "America/New_York"))  # naive == UTC

    def test_hold_back(self) -> None:
        rows = [{"id": 1, "zip": "33602"}, {"id": 2, "zip": "x"}, {"id": 3, "zip": "79901"}, {"id": 4, "state": "ZZ"}]
        deliverable, held = tz.hold_back_without_zone(rows)
        self.assertEqual([r["id"] for r in deliverable], [1, 3])
        self.assertEqual([h["row"]["id"] for h in held], [2, 4])
        self.assertTrue(all(h["reason"] == "time_zone_unresolved" for h in held))


if __name__ == "__main__":
    unittest.main()
