"""Minimal xlsx writer and reader on zipfile + xml.etree.

Why: openpyxl is not installed on the worker and must not be. The deliverable is a plain
workbook (List / Summary / Legal Notes) and the round trip only needs to read back Called
and Outcome keyed by Ledger Id, so hand-written SpreadsheetML is enough. Strings are written
inline; the reader also understands shared strings because Excel rewrites the file that way.
"""
import re
import zipfile
from typing import Any, Dict, List, Optional, Sequence, Union
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

Cell = Union[str, int, float, None]
NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PKG = "http://schemas.openxmlformats.org/package/2006/relationships"


def col_letter(i: int) -> str:
    s = ""
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def col_index(letters: str) -> int:
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def _clean(text: str) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)


def _cell_xml(ref: str, v: Cell, style: Optional[int]) -> str:
    s = ' s="%d"' % style if style else ""
    if v is None or v == "":
        return ""
    if isinstance(v, bool):
        return '<c r="%s" t="b"%s><v>%d</v></c>' % (ref, s, int(v))
    if isinstance(v, (int, float)):
        return '<c r="%s"%s><v>%r</v></c>' % (ref, s, v)
    return '<c r="%s" t="inlineStr"%s><is><t xml:space="preserve">%s</t></is></c>' % (ref, s, escape(_clean(str(v))))


def _sheet_xml(rows: Sequence[Sequence[Cell]], widths: Optional[Sequence[float]], header_style: bool) -> str:
    out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', '<worksheet xmlns="%s">' % NS]
    if header_style and rows:
        out.append('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>')
    if widths:
        out.append("<cols>" + "".join('<col min="%d" max="%d" width="%s" customWidth="1"/>' % (i, i, w) for i, w in enumerate(widths, 1)) + "</cols>")
    out.append("<sheetData>")
    for r, row in enumerate(rows, 1):
        cells = "".join(_cell_xml("%s%d" % (col_letter(c), r), v, 1 if header_style and r == 1 else None) for c, v in enumerate(row, 1))
        out.append('<row r="%d">%s</row>' % (r, cells))
    out.append("</sheetData>")
    if header_style and len(rows) > 1:
        out.append('<autoFilter ref="A1:%s%d"/>' % (col_letter(max(len(rows[0]), 1)), len(rows)))
    out.append("</worksheet>")
    return "".join(out)


STYLES = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="%s">'
          '<fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>'
          '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
          '<fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/></patternFill></fill></fills>'
          '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>'
          '<cellXfs count="2"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1" applyAlignment="1">'
          '<alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>') % NS


def write_workbook(path: str, sheets: Dict[str, Sequence[Sequence[Cell]]], widths: Optional[Dict[str, Sequence[float]]] = None,
                   header_sheets: Sequence[str] = ("List",)) -> None:
    """sheets is an ordered dict name -> rows. header_sheets get bold header, freeze pane, autofilter."""
    names = list(sheets)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                   + "".join('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' % i
                             for i in range(1, len(names) + 1)) + "</Types>")
        z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="%s">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' % NS_PKG)
        z.writestr("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="%s" xmlns:r="%s"><sheets>%s</sheets></workbook>'
                   % (NS, NS_R, "".join('<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (escape(n), i, i) for i, n in enumerate(names, 1))))
        z.writestr("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="%s">%s'
                   '<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
                   % (NS_PKG, "".join('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>' % (i, i)
                                      for i in range(1, len(names) + 1))))
        z.writestr("xl/styles.xml", STYLES)
        for i, n in enumerate(names, 1):
            z.writestr("xl/worksheets/sheet%d.xml" % i, _sheet_xml(sheets[n], (widths or {}).get(n), n in header_sheets))


def _shared_strings(z: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iter("{%s}t" % NS)) for si in root.iter("{%s}si" % NS)]


def _sheet_paths(z: zipfile.ZipFile) -> Dict[str, str]:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    targets = {r.get("Id"): r.get("Target") for r in rels.iter("{%s}Relationship" % NS_PKG)}
    out = {}
    for sh in wb.iter("{%s}sheet" % NS):
        target = targets.get(sh.get("{%s}id" % NS_R), "")
        out[sh.get("name") or ""] = target if target.startswith("/") else "xl/" + target
    return {k: v.lstrip("/") for k, v in out.items()}


def read_sheet(path: str, sheet: str = "List") -> List[List[str]]:
    """Rows of strings; gaps filled with ''. Numbers come back as their text."""
    with zipfile.ZipFile(path) as z:
        paths = _sheet_paths(z)
        if sheet not in paths:
            raise KeyError("sheet %r not in workbook (have %s)" % (sheet, list(paths)))
        shared = _shared_strings(z)
        root = ET.fromstring(z.read(paths[sheet]))
    rows: List[List[str]] = []
    for row in root.iter("{%s}row" % NS):
        cells: Dict[int, str] = {}
        for c in row.iter("{%s}c" % NS):
            ref = re.match(r"([A-Z]+)", c.get("r") or "A")
            idx = col_index(ref.group(1)) if ref else len(cells) + 1
            t = c.get("t")
            v = c.find("{%s}v" % NS)
            if t == "s" and v is not None and v.text is not None:
                cells[idx] = shared[int(v.text)]
            elif t == "inlineStr":
                cells[idx] = "".join(x.text or "" for x in c.iter("{%s}t" % NS))
            else:
                cells[idx] = (v.text or "") if v is not None else ""
        width = max(cells) if cells else 0
        rows.append([cells.get(i, "") for i in range(1, width + 1)])
    return rows


def read_records(path: str, sheet: str = "List") -> List[Dict[str, Any]]:
    """Header row -> list of dicts (row_number included, 1-based like Excel)."""
    rows = read_sheet(path, sheet)
    if not rows:
        return []
    header = rows[0]
    out = []
    for n, r in enumerate(rows[1:], 2):
        rec = {h: (r[i] if i < len(r) else "") for i, h in enumerate(header) if h}
        rec["row_number"] = n
        out.append(rec)
    return out
