#!/usr/bin/env python3
"""Download King County Assessor Residential Building extract and shard by PIN prefix.

Produces assets/data/kc-resbldg/{XX}.json, which Build Here reads to fill in the house facts of a
King County parcel: living area, year built, stories, first floor, garage, basement, upper floors,
deck, bedrooms, baths and year renovated.

Usage: python3 scripts/build_kc_resbldg_index.py [--out DIR] [--zip LOCAL.zip]
                                                  [--source-date YYYY-MM-DD] [--min-parcels N]

Index version 3. One record per parcel, fifteen values, in this order:

   0  SqFtTotLiving                  finished living area, the sum of the parcel's building rows
   1  YrBuilt                        the earliest year of the rows
   2  Stories                        the tallest of the rows
   3  SqFt1stFloor                   sum
   4  SqFtGarageAttached             sum
   5  buildingRecords                how many building rows were combined
   6  SqFtGarageBasement             sum
   7  SqFtTotBasement                sum
   8  SqFtFinBasement                sum
   9  SqFt2ndFloor + SqFtUpperFloor  sum (floor area above the first floor, half floors apart)
  10  SqFtHalfFloor                  sum
  11  SqFtDeck                       sum
  12  Bedrooms                       sum
  13  baths                          full + 0.75 x three-quarter + 0.5 x half, sum
  14  YrRenovated                    the latest year of the rows

A blank and a zero are different things, and the page treats them differently:

  null  the cell was blank or unreadable in the county file, or the column was not in the file.
        The page shows nothing for it, or "not in public data". It never shows a 0.
  0     the county file says zero. The page may say "none on the assessor record".

The extract has one row per residential building. A parcel with several rows (a house and a backyard
cottage, say) gets one record. Areas and counts are added together. When one of the rows is blank in a
column, the parcel's value for that column is null, because a partial sum would read as the whole.
Rows with no living area are left out, as before; they are counted in _meta.json.

Earlier versions. Version 1 had five values. Version 2 had six: it added the attached and the basement
garage together in position 4 and wrote 0 for a blank. The page still reads both, and treats a 0 from
them as "not known".

The new index is built in a sibling folder and swapped in only after every shard is written, so a
failed download, a truncated file or a crash leaves the published index as it was.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import shutil
import time
import urllib.request
import zipfile
from collections import defaultdict
from email.utils import parsedate_to_datetime
from io import TextIOWrapper
from pathlib import Path

# Feasibility-study copy. Not the live builder (scripts/build_kc_resbldg_index.py).
# parents[2] is the repository because this file sits in scripts/feasibility/.
# The default output is outside the published index so a trial run cannot replace it.
ROOT = Path(__file__).resolve().parents[2]
OUT = Path("/tmp/ppg-feasibility-kc-resbldg")
ZIP_URL = "https://aqua.kingcounty.gov/extranet/assessor/Residential%20Building.zip"
SOURCE = "King County Assessor EXTR_ResBldg.csv (Residential Building.zip)"
VERSION = 3
FIELDS = [
    "SqFtTotLiving", "YrBuilt", "Stories", "SqFt1stFloor", "SqFtGarageAttached", "buildingRecords",
    "SqFtGarageBasement", "SqFtTotBasement", "SqFtFinBasement", "SqFt2ndFloor+SqFtUpperFloor",
    "SqFtHalfFloor", "SqFtDeck", "Bedrooms", "baths(full+0.75x3qtr+0.5xhalf)", "YrRenovated",
]
# Without these three columns there is no index to build.
REQUIRED = ("Major", "Minor", "SqFtTotLiving")
# Every other column the index reads. A column the county file no longer has becomes null in every
# record and is named in _meta.json and on the console.
COLUMNS = (
    "YrBuilt", "Stories", "SqFt1stFloor", "SqFtGarageAttached", "SqFtGarageBasement", "SqFtTotBasement",
    "SqFtFinBasement", "SqFt2ndFloor", "SqFtUpperFloor", "SqFtHalfFloor", "SqFtDeck", "Bedrooms",
    "BathFullCount", "Bath3qtrCount", "BathHalfCount", "YrRenovated",
)
# Positions that are added together when a parcel has more than one building row.
SUMMED = (3, 4, 6, 7, 8, 9, 10, 11, 12, 13)


def _num(row: dict, key: str) -> float | None:
    """The number in a cell. None when the cell is blank, missing or not a number."""
    raw = row.get(key)
    if raw is None:
        return None
    text = str(raw).replace(",", "").strip()
    if not text:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return value if value == value and abs(value) != float("inf") else None


def _area(row: dict, key: str) -> int | None:
    """A floor area or a count. None when blank or negative. 0 when the county file says 0."""
    value = _num(row, key)
    return None if value is None or value < 0 else int(value)


def _year(value: float | None, zero_is_none: bool) -> int | None:
    """A year after 1800. A 0 in YrRenovated is the county saying "not renovated", so it is kept as 0
    there. A 0 in YrBuilt says nothing, so it becomes None."""
    if value is None:
        return None
    if value > 1800:
        return int(value)
    return 0 if value == 0 and not zero_is_none else None


def _add(a, b):
    """The sum of two values. None when either one is not known, so a partial sum is never written."""
    return None if a is None or b is None else a + b


def _baths(row: dict) -> float | None:
    """Full baths count 1, three-quarter baths 0.75, half baths 0.5. None when a count is blank."""
    full, three, half = _area(row, "BathFullCount"), _area(row, "Bath3qtrCount"), _area(row, "BathHalfCount")
    if full is None or three is None or half is None:
        return None
    return full + 0.75 * three + 0.5 * half


def _tidy(value):
    """Whole numbers are written without a decimal point. Other numbers keep two places."""
    if isinstance(value, float):
        return int(value) if value == int(value) else round(value, 2)
    return value


def record(row: dict) -> list | None:
    """One building row as an index record. None when the row has no living area."""
    living = _num(row, "SqFtTotLiving")
    if living is None or living <= 0:
        return None
    stories = _num(row, "Stories")
    return [
        int(living),
        _year(_num(row, "YrBuilt"), True),
        stories if stories is not None and stories > 0 else None,
        _area(row, "SqFt1stFloor"),
        _area(row, "SqFtGarageAttached"),
        1,
        _area(row, "SqFtGarageBasement"),
        _area(row, "SqFtTotBasement"),
        _area(row, "SqFtFinBasement"),
        _add(_area(row, "SqFt2ndFloor"), _area(row, "SqFtUpperFloor")),
        _area(row, "SqFtHalfFloor"),
        _area(row, "SqFtDeck"),
        _area(row, "Bedrooms"),
        _baths(row),
        _year(_num(row, "YrRenovated"), False),
    ]


def combine(prev: list, rec: list) -> list:
    """Two building rows of one parcel as one record."""
    out = list(prev)
    out[0] = prev[0] + rec[0]
    years = [y for y in (prev[1], rec[1]) if y]
    out[1] = min(years) if years else None
    floors = [s for s in (prev[2], rec[2]) if s]
    out[2] = max(floors) if floors else None
    for i in SUMMED:
        out[i] = _add(prev[i], rec[i])
    out[5] = prev[5] + rec[5]
    # The latest renovation year of any row. 0 ("not renovated") only when every row says 0.
    done = [y for y in (prev[14], rec[14]) if y]
    out[14] = max(done) if done else (0 if prev[14] == 0 and rec[14] == 0 else None)
    return out


def aggregate(rows, stats: dict | None = None) -> tuple[dict[str, dict[str, list]], int]:
    """Combine building rows into one record per parcel. Returns (shards, building rows kept).

    `stats`, when given, is filled with the rows skipped and the columns the file did not have.
    Raises SystemExit when a required column is not in the file, before anything is written.
    """
    shards: dict[str, dict[str, list]] = defaultdict(dict)
    kept = skipped = bad_pin = 0
    missing: list[str] = []
    first = True
    for row in rows:
        if first:
            first = False
            lost = [c for c in REQUIRED if c not in row]
            if lost:
                raise SystemExit("The county file has no column named " + ", ".join(lost) + ". The file layout has changed. "
                                 "The published index was left as it was.")
            missing = [c for c in COLUMNS if c not in row]
        major = re.sub(r"\D", "", row.get("Major") or "")
        minor = re.sub(r"\D", "", row.get("Minor") or "")
        if not major or not minor or len(major) > 6 or len(minor) > 4:
            bad_pin += 1
            continue
        major, minor = major.zfill(6), minor.zfill(4)
        rec = record(row)
        if rec is None:
            skipped += 1
            continue
        pin = major + minor
        shard = shards[major[:2]]
        shard[pin] = combine(shard[pin], rec) if pin in shard else rec
        kept += 1
    for shard in shards.values():
        for pin, rec in shard.items():
            shard[pin] = [_tidy(v) for v in rec]
    if stats is not None:
        stats.update({"rowsWithoutLivingArea": skipped, "rowsWithoutParcelNumber": bad_pin, "missingColumns": missing})
    return shards, kept


def fetch_zip(url: str = ZIP_URL) -> tuple[bytes, str]:
    """Returns (zip bytes, date on the county file as YYYY-MM-DD, or "" when the server does not say)."""
    req = urllib.request.Request(url, headers={"User-Agent": "PPG-BuildHere/1.1"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = resp.read()
        stamp = resp.headers.get("Last-Modified") or ""
    try:
        day = parsedate_to_datetime(stamp).date().isoformat() if stamp else ""
    except (TypeError, ValueError):
        day = ""
    return data, day


def _csv_name(zf: zipfile.ZipFile) -> str:
    names = [x for x in zf.namelist() if x.lower().endswith(".csv")]
    if not names:
        raise SystemExit("No .csv file inside the zip. The published index was left as it was.")
    return names[0]


def zip_day(zip_bytes: bytes) -> str:
    """The date the county wrote the CSV, as recorded inside the zip. "" when it cannot be read."""
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            y, m, d = zf.getinfo(_csv_name(zf)).date_time[:3]
        return f"{y:04d}-{m:02d}-{d:02d}" if y > 1990 else ""
    except (zipfile.BadZipFile, KeyError, ValueError):
        return ""


def rows_from_zip(zip_bytes: bytes):
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        with zf.open(_csv_name(zf)) as raw:
            reader = csv.DictReader(TextIOWrapper(raw, encoding="utf-8-sig", errors="replace"))
            if reader.fieldnames:
                reader.fieldnames = [str(name or "").strip() for name in reader.fieldnames]
            yield from reader


def write_index(out: Path, shards: dict[str, dict[str, list]], meta: dict) -> int:
    """Write the whole index beside `out`, then swap it in. Returns bytes written."""
    out = Path(out)
    tmp = out.with_name(out.name + ".tmp")
    old = out.with_name(out.name + ".old")
    for stale in (tmp, old):
        if stale.exists():
            shutil.rmtree(stale)
    tmp.mkdir(parents=True)
    (tmp / "_meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    total = 0
    for sh, data in shards.items():
        text = json.dumps({"v": meta["v"], "src": meta["source"], "asOf": meta["built"], "srcDate": meta.get("sourceDate", ""), "b": data},
                          separators=(",", ":"))
        path = tmp / f"{sh}.json"
        path.write_text(text, encoding="utf-8")
        total += path.stat().st_size
    if out.exists():
        out.rename(old)
    tmp.rename(out)
    if old.exists():
        shutil.rmtree(old)
    return total


def build(out: Path = OUT, zip_path: Path | None = None, min_parcels: int = 100000, fetch=fetch_zip, source_date: str = "") -> dict:
    """Download (or read), combine, check, then publish. Raises before anything published is touched."""
    if source_date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", source_date):
        raise SystemExit("--source-date must look like 2026-11-17.")
    if zip_path:
        zip_bytes, source_day = Path(zip_path).read_bytes(), ""
    else:
        if fetch is fetch_zip:
            print("Downloading", ZIP_URL)
        zip_bytes, source_day = fetch()
    print("zip bytes", len(zip_bytes))
    # The date on the county file: the one given by hand, else the server's, else the one inside the zip.
    source_day = source_date or source_day or zip_day(zip_bytes)
    stats: dict = {}
    shards, n = aggregate(rows_from_zip(zip_bytes), stats)
    parcels = sum(len(s) for s in shards.values())
    if parcels < min_parcels:
        raise SystemExit(f"Only {parcels} parcels came out of the county file (expected at least {min_parcels}). "
                         "The published index was left as it was. Pass --min-parcels to override.")
    if stats.get("missingColumns"):
        print("WARNING: the county file has no column named", ", ".join(stats["missingColumns"]) + ".",
              "Those values are null in every record, and the page will show them as not in public data.")
    meta = {
        "v": VERSION,
        "built": time.strftime("%Y-%m-%d"),
        "sourceDate": source_day,
        "source": SOURCE,
        "sourceUrl": ZIP_URL,
        "rows": n,
        "rowsWithoutLivingArea": stats.get("rowsWithoutLivingArea", 0),
        "rowsWithoutParcelNumber": stats.get("rowsWithoutParcelNumber", 0),
        "parcels": parcels,
        "multiBuildingParcels": sum(1 for s in shards.values() for r in s.values() if r[5] > 1),
        "shards": sorted(shards.keys()),
        "fields": FIELDS,
        "missingColumns": stats.get("missingColumns", []),
        "nulls": "null is a blank in the county file. 0 is the county file saying zero.",
    }
    total = write_index(out, shards, meta)
    print("wrote", len(shards), "shards,", round(total / 1024 / 1024, 2), "MB,", n, "buildings,", parcels, "parcels, index version", VERSION)
    return meta


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--zip", type=Path, default=None, help="read a downloaded Residential Building.zip instead of fetching it")
    ap.add_argument("--source-date", default="", help="the date on the county file, YYYY-MM-DD, when reading a local zip")
    ap.add_argument("--min-parcels", type=int, default=100000)
    args = ap.parse_args(argv)
    build(args.out, args.zip, args.min_parcels, source_date=args.source_date)


if __name__ == "__main__":
    main()
