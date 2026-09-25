import os
import unittest
import uuid

from _helpers import tmpdir

from ownercell import brain, deliver, outcomes, xlsx


def rows_for(n):
    return [{"phone": "813555%04d" % i, "type": "Mobile", "dnc": False, "tcpa": False, "company": "Co %d" % i, "city": "Tampa", "state": "FL",
             "zip": "33602", "owner_first": "Ana", "owner_last": "L%d" % i, "email": "", "rating": 4.5, "reviews": 10, "lane": "A",
             "ledger_id": str(uuid.uuid4())} for i in range(n)]


class RoundTrip(unittest.TestCase):
    def test_write_edit_read_outcomes_keyed_by_ledger_id(self) -> None:
        out = tmpdir()
        rows = rows_for(3)
        rows.append(dict(rows_for(1)[0], phone="8135559999", zip="x", state="ZZ", city="Nowhere"))  # no zone: must be held
        result = deliver.build("Test FL", rows, out, spent_usd=0.21, cap_usd=1.0)
        self.assertEqual((result["delivered"], result["held"]), (3, 1))
        columns = brain.load()["output_columns"]
        self.assertEqual(len(columns), 20)
        sheet = xlsx.read_sheet(result["path"], "List")
        self.assertEqual(sheet[0], columns)
        self.assertEqual(len(sheet), 4)
        legal = "\n".join(r[0] for r in xlsx.read_sheet(result["path"], "Legal Notes"))
        self.assertIn("8:00am and 8:00pm", legal)
        self.assertIn("3 calls per 24 hours", legal)
        self.assertNotIn("9pm", legal)
        for name in ("List", "Summary", "Legal Notes"):
            for r in xlsx.read_sheet(result["path"], name):
                self.assertFalse(any("—" in str(c) for c in r), "em dash in %s: %r" % (name, r))
        # a caller fills Called and Outcome (simulate by re-writing the List sheet)
        idx = {c: i for i, c in enumerate(columns)}
        edited = [list(r) for r in sheet]
        edited[1][idx["Called"]], edited[1][idx["Outcome"]], edited[1][idx["Notes"]] = "2026-09-21T10:15:00-04:00", "reached_owner", "wants quote"
        edited[3][idx["Called"]], edited[3][idx["Outcome"]] = "2026-09-21T10:20:00-04:00", "Wrong Number"
        p2 = os.path.join(out, "edited.xlsx")
        xlsx.write_workbook(p2, {"List": edited})
        got = outcomes.read_outcomes(p2)
        self.assertEqual(len(got), 2)
        self.assertEqual(got[0]["ledger_id"], sheet[1][idx["Ledger Id"]])
        self.assertEqual(got[0]["outcome"], "reached_owner")
        self.assertEqual(got[0]["notes"], "wants quote")
        self.assertEqual(got[1]["outcome"], "wrong_number")
        self.assertEqual(got[1]["ledger_id"], sheet[3][idx["Ledger Id"]])

    def test_invalid_outcome_rejected_with_row_number(self) -> None:
        out = tmpdir()
        columns = brain.load()["output_columns"]
        idx = {c: i for i, c in enumerate(columns)}
        row = [""] * len(columns)
        row[idx["Ledger Id"]], row[idx["Outcome"]] = "abc", "left a message"
        p = os.path.join(out, "bad.xlsx")
        xlsx.write_workbook(p, {"List": [columns, [""] * len(columns), row]})
        with self.assertRaises(outcomes.OutcomeError) as ctx:
            outcomes.read_outcomes(p)
        self.assertEqual(ctx.exception.row_number, 3)
        self.assertIn("left a message", str(ctx.exception))

    def test_reader_handles_shared_strings(self) -> None:
        import zipfile
        p = os.path.join(tmpdir(), "shared.xlsx")
        xlsx.write_workbook(p, {"List": [["A", "B"], [1, "x"]]})
        # rewrite sheet1 as Excel would: shared strings table + t="s" cells
        with zipfile.ZipFile(p) as z:
            parts = {n: z.read(n) for n in z.namelist()}
        parts["xl/sharedStrings.xml"] = ('<?xml version="1.0"?><sst xmlns="%s"><si><t>Ledger Id</t></si><si><r><t>ri</t></r><r><t>ch</t></r></si></sst>' % xlsx.NS).encode()
        parts["xl/worksheets/sheet1.xml"] = ('<worksheet xmlns="%s"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row>'
                                             '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2"><v>3</v></c></row></sheetData></worksheet>' % xlsx.NS).encode()
        with zipfile.ZipFile(p, "w") as z:
            for n, b in parts.items():
                z.writestr(n, b)
        self.assertEqual(xlsx.read_sheet(p, "List"), [["Ledger Id"], ["rich", "", "3"]])


if __name__ == "__main__":
    unittest.main()
