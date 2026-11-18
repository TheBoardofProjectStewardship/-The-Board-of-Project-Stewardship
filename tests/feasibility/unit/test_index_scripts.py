#!/usr/bin/env python3
"""Checks for the two county index builders. No network. Run with:

    python3 tests/unit/test_index_scripts.py

King County: a small made-up county file goes through scripts/build_kc_resbldg_index.py and the
records are read back. Snohomish: made-up workbook rows go through collect() in
scripts/build_sno_bldg_index.py, and the hold on that script is checked.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True  # no __pycache__ left in scripts/
sys.path.insert(0, str(ROOT / "scripts" / "feasibility"))

import build_kc_resbldg_index as kc  # noqa: E402
import build_sno_bldg_index as sno  # noqa: E402

passed = failed = 0


def ok(name: str, cond: bool, detail=None) -> None:
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
    print(("ok    " if cond else "FAIL  ") + name + ("" if cond or detail is None else "  [" + str(detail) + "]"))


def exits(fn) -> str:
    """The message of the SystemExit that fn raises, or "" when it does not raise one."""
    try:
        fn()
    except SystemExit as e:
        return str(e) or "exit"
    return ""


# ---------------------------------------------------------------- King County

KC_HEAD = ["Major", "Minor", "BldgNbr", "Address", "Stories", "SqFt1stFloor", "SqFtHalfFloor", "SqFt2ndFloor", "SqFtUpperFloor",
           "SqFtTotLiving", "SqFtTotBasement", "SqFtFinBasement", "SqFtGarageBasement", "SqFtGarageAttached", "SqFtDeck",
           "Bedrooms", "BathHalfCount", "Bath3qtrCount", "BathFullCount", "YrBuilt", "YrRenovated"]


def kc_row(**kw) -> dict:
    base = {"Major": "215500", "Minor": "300", "BldgNbr": "1", "Address": "NOT COPIED", "Stories": "1", "SqFt1stFloor": "1220",
            "SqFtHalfFloor": "0", "SqFt2ndFloor": "0", "SqFtUpperFloor": "0", "SqFtTotLiving": "1840", "SqFtTotBasement": "1220",
            "SqFtFinBasement": "620", "SqFtGarageBasement": "0", "SqFtGarageAttached": "550", "SqFtDeck": "180", "Bedrooms": "3",
            "BathHalfCount": "0", "Bath3qtrCount": "1", "BathFullCount": "1", "YrBuilt": "1967", "YrRenovated": "0"}
    base.update(kw)
    return base


def kc_zip(rows: list[dict], head: list[str] = KC_HEAD, bom: bool = False) -> bytes:
    text = io.StringIO()
    w = csv.DictWriter(text, fieldnames=head, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        info = zipfile.ZipInfo("EXTR_ResBldg.csv", date_time=(2026, 10, 28, 6, 0, 0))
        zf.writestr(info, ("﻿" if bom else "") + text.getvalue())
    return buf.getvalue()


ROWS = [
    kc_row(),                                                                    # the plain house
    kc_row(Major="215500", Minor="0310", SqFtTotLiving="2400", Stories="2", SqFt2ndFloor="900", SqFtUpperFloor="100",
           SqFtTotBasement="0", SqFtFinBasement="0", SqFtGarageAttached="0", SqFtDeck="0", Bedrooms="4",
           BathFullCount="2", Bath3qtrCount="0", BathHalfCount="1", YrBuilt="2004", YrRenovated="2019"),
    # one parcel, two building rows: a house and a cottage
    kc_row(Minor="0320", SqFtTotLiving="1500", YrBuilt="1950", Stories="1.5", SqFtGarageAttached="400", SqFtDeck="100", YrRenovated="1990"),
    kc_row(Minor="0320", BldgNbr="2", SqFtTotLiving="600", YrBuilt="2015", Stories="2", SqFt1stFloor="300", SqFtTotBasement="0",
           SqFtFinBasement="0", SqFtGarageAttached="0", SqFtDeck="0", Bedrooms="1", Bath3qtrCount="1", BathFullCount="0", YrRenovated="0"),
    # blanks: garage, deck, baths and year are not on record
    kc_row(Minor="0330", SqFtGarageAttached="", SqFtGarageBasement="", SqFtDeck=" ", BathFullCount="", YrBuilt="0", YrRenovated="",
           Stories="", SqFtTotBasement="n/a"),
    # two rows where one is blank in a summed column: the parcel value is not known, not a partial sum
    kc_row(Minor="0340", SqFtGarageAttached="300"),
    kc_row(Minor="0340", BldgNbr="2", SqFtGarageAttached=""),
    kc_row(Minor="0350", SqFtTotLiving="0"),                                       # no living area: left out
    kc_row(Major="", Minor="0360"),                                                # no parcel number: left out
    kc_row(Major="3", Minor="12", SqFtTotLiving="1,050"),                          # short numbers are padded; a comma is read
]

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    src = tmp / "Residential Building.zip"
    src.write_bytes(kc_zip(ROWS))
    out = tmp / "site" / "kc-resbldg"
    meta = kc.build(out, src, min_parcels=1)
    files = sorted(p.name for p in out.iterdir())
    ok("KC: one file per two-digit prefix, and _meta.json", files == ["00.json", "21.json", "_meta.json"], files)
    shard = json.loads((out / "21.json").read_text())
    b = shard["b"]
    ok("KC: the shard says it is version 3", shard.get("v") == 3 and meta["v"] == 3)
    ok("KC: the date inside the zip is the county file date when none is given", shard.get("srcDate") == "2026-10-28" and meta["sourceDate"] == "2026-10-28", shard.get("srcDate"))
    ok("KC: fifteen values in a record", all(len(r) == 15 for r in b.values()))
    ok("KC: the plain house reads back in the documented order",
       b["2155000300"] == [1840, 1967, 1, 1220, 550, 1, 0, 1220, 620, 0, 0, 180, 3, 1.75, 0], b["2155000300"])
    ok("KC: second floor and upper floor are added, baths are weighted", b["2155000310"][9] == 1000 and b["2155000310"][13] == 2.5, b["2155000310"])
    ok("KC: a zero in the county file stays a zero (no garage, no basement)", b["2155000310"][4] == 0 and b["2155000310"][7] == 0)
    two = b["2155000320"]
    ok("KC: two building rows are one record with a count of 2", two[5] == 2 and meta["multiBuildingParcels"] == 2, two)
    ok("KC: living area, garage, deck, bedrooms and baths are summed", two[0] == 2100 and two[4] == 400 and two[11] == 100 and two[12] == 4 and two[13] == 2.5, two)
    ok("KC: the earliest year built, the tallest story count, the latest renovation", two[1] == 1950 and two[2] == 2 and two[14] == 1990, two)
    blank = b["2155000330"]
    ok("KC: a blank cell is null, never 0", blank[4] is None and blank[6] is None and blank[11] is None and blank[13] is None and blank[14] is None, blank)
    ok("KC: a year built of 0, a blank story count and an unreadable cell are null", blank[1] is None and blank[2] is None and blank[7] is None, blank)
    ok("KC: a blank in one of two rows makes the sum null, not a partial sum", b["2155000340"][4] is None and b["2155000340"][0] == 3680, b["2155000340"])
    ok("KC: a row with no living area is left out and counted", "2155000350" not in b and meta["rowsWithoutLivingArea"] == 1)
    ok("KC: a row with no parcel number is left out and counted", meta["rowsWithoutParcelNumber"] == 1)
    short = json.loads((out / "00.json").read_text())["b"]
    ok("KC: short Major and Minor are padded to a ten-digit PIN", list(short) == ["0000030012"] and short["0000030012"][0] == 1050, list(short))
    ok("KC: whole numbers have no decimal point in the file", '"2155000320":[2100,1950,2,' in (out / "21.json").read_text())
    ok("KC: no address or name is copied", "NOT COPIED" not in (out / "21.json").read_text() and "Address" not in json.dumps(meta))
    ok("KC: _meta.json lists the shards for the plugin's status line", meta["shards"] == ["00", "21"] and meta["parcels"] == 6, meta["parcels"])
    ok("KC: nothing left behind beside the index", sorted(p.name for p in out.parent.iterdir()) == ["kc-resbldg"])

    # A date given by hand wins over the one inside the zip.
    meta2 = kc.build(out, src, min_parcels=1, source_date="2026-11-03")
    ok("KC: --source-date is used when given", meta2["sourceDate"] == "2026-11-03" and json.loads((out / "21.json").read_text())["srcDate"] == "2026-11-03")
    ok("KC: a date that is not a date is refused", "source-date" in exits(lambda: kc.build(out, src, min_parcels=1, source_date="last week")))

    # A county file that has lost a column must not replace the published index.
    before = (out / "21.json").read_text()
    bad = tmp / "bad.zip"
    bad.write_bytes(kc_zip(ROWS, [h for h in KC_HEAD if h != "SqFtTotLiving"]))
    msg = exits(lambda: kc.build(out, bad, min_parcels=1))
    ok("KC: a file without the living-area column stops the build", "SqFtTotLiving" in msg, msg)
    ok("KC: and the published index is left as it was", (out / "21.json").read_text() == before)
    few = exits(lambda: kc.build(out, src, min_parcels=100000))
    ok("KC: too few parcels stops the build and leaves the index", "Only 6 parcels" in few and (out / "21.json").read_text() == before, few)

    # A file that has lost an optional column still builds; the value is null and the column is named.
    thin = tmp / "thin.zip"
    thin.write_bytes(kc_zip(ROWS, [h for h in KC_HEAD if h != "SqFtDeck"], bom=True))
    meta3 = kc.build(tmp / "thin" / "kc-resbldg", thin, min_parcels=1)
    rec = json.loads((tmp / "thin" / "kc-resbldg" / "21.json").read_text())["b"]["2155000300"]
    ok("KC: a column the file no longer has is null in every record and named in _meta.json", rec[11] is None and meta3["missingColumns"] == ["SqFtDeck"], meta3["missingColumns"])
    ok("KC: a byte-order mark before the header does not hide the first column", rec[0] == 1840)

# ---------------------------------------------------------------- Snohomish

SN_HEAD = ["PIN", "OwnerName", "ImprType", "Stories", "YrBuilt", "FinSize", "AttGarSF", "DetGarSF", "LastUpdD", "ImpStat"]


def sn(pin, kind="DWELLING", stories=1, year=1978, fin=1500, att=440, det=None, upd="03/14/2024", stat="A"):
    return (pin, "NOT COPIED", kind, stories, year, fin, att, det, upd, stat)


SN_ROWS = [
    sn("00373300100100"),                                                   # house with an attached garage; detached is blank
    sn("00373300100200", att=0, det=0),                                     # the workbook says no garage
    sn("00373300100300", att=None, det=None, year=0, stories=None),         # blanks
    sn("00373300100400", att=None), sn("00373300100400", kind="DETGAR", fin=None, att=None, det=576),   # garage on another row
    sn("00373300100500", att=None), sn("00373300100500", kind="DETGAR", fin=None, att=None, det=576, stat="I"),  # that row is not active
    sn("00373300100600", fin=900), sn("00373300100600", fin=2100, year=1999, stories=2.0, att=None),    # two dwellings: the larger one
    sn("00373300100700", stat="I"),                                         # not an active record
    sn("ABC", fin=1000),                                                    # not a parcel number
    sn("00480000000100", fin=None, att=None, det=None),                     # nothing to publish
]

shards = sno.collect(SN_HEAD, iter(SN_ROWS))
s = shards.get("0037", {})
ok("SNO: records are grouped by the first four digits", sorted(shards) == ["0037"], sorted(shards))
ok("SNO: seven values in the documented order", s.get("00373300100100") == [1500, 1978, 1, 440, None, 1, "2024-03-14"], s.get("00373300100100"))
ok("SNO: a blank detached garage is null, never 0", s["00373300100100"][4] is None)
ok("SNO: a zero in the workbook stays a zero", s["00373300100200"][3] == 0 and s["00373300100200"][4] == 0, s["00373300100200"])
ok("SNO: a year of 0 and a blank story count are null", s["00373300100300"][1] is None and s["00373300100300"][2] is None and s["00373300100300"][3] is None, s["00373300100300"])
ok("SNO: garage area on another active row is used when the dwelling row has none", s["00373300100400"][4] == 576, s["00373300100400"])
ok("SNO: garage area on a row that is not active is not used", s["00373300100500"][4] is None, s["00373300100500"])
ok("SNO: the larger of two dwelling rows is kept, with a count of 2", s["00373300100600"][:3] == [2100, 1999, 2] and s["00373300100600"][5] == 2, s["00373300100600"])
ok("SNO: the smaller dwelling's garage is carried when the larger has none", s["00373300100600"][3] == 440, s["00373300100600"])
ok("SNO: a record that is not active, a bad PIN and an empty record are left out",
   "00373300100700" not in s and "ABC" not in json.dumps(shards) and "0048" not in shards)
ok("SNO: no owner name is copied", "NOT COPIED" not in json.dumps(shards) and "OwnerName" not in sno.KEEP and "OwnerName" not in sno.FIELDS)
ok("SNO: a workbook that lost a column stops the build", "FinSize" in exits(lambda: sno.collect([h for h in SN_HEAD if h != "FinSize"], iter(SN_ROWS))))

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "sno-bldg"
    meta = {"v": sno.VERSION, "built": "2026-11-17", "sourceModified": "2026-11-01", "source": "test", "fields": sno.FIELDS}
    sno.write_index(out, shards, meta)
    shard = json.loads((out / "0037.json").read_text())
    ok("SNO: the shard says it is version 2 and writes null for a blank", shard["v"] == 2 and "null" in (out / "0037.json").read_text())
    ok("SNO: nothing left behind beside the index", sorted(p.name for p in out.parent.iterdir()) == ["sno-bldg"])

# The hold. The script refuses to run without the override, and refuses to write inside the repository.
argv = sys.argv
try:
    sys.argv = ["build_sno_bldg_index.py"]
    ok("SNO: refuses to run without --hold-override", exits(sno.main).startswith("HOLD"))
    sys.argv = ["build_sno_bldg_index.py", "--hold-override", "--out", str(ROOT / "assets" / "data" / "sno-bldg")]
    ok("SNO: refuses to write inside the repository even with the override", exits(sno.main).startswith("HOLD"))
    sys.argv = ["build_sno_bldg_index.py", "--hold-override"]
    ok("SNO: refuses to run with no output folder", exits(sno.main).startswith("HOLD"))
finally:
    sys.argv = argv

print("\n" + (f"{failed} check(s) failed, {passed} passed" if failed else f"all {passed} checks passed"))
sys.exit(1 if failed else 0)
