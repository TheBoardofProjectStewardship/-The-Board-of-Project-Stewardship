#!/usr/bin/env python3
"""PIN-keyed physical building facts from Snohomish Improvement Records.

Source workbook (public SnocoGIS item, not redistributed):
  https://www.arcgis.com/sharing/rest/content/items/3c5edc985cec4fba8b3938d16ed1d3c3/data

RCW 42.56.070(8) tells agencies not to give lists of individuals for a commercial
purpose. This extract keeps parcel physical facts only. It does not copy owner
names, taxpayer names, site addresses, photos, sketches, or notes.

Columns kept: PIN, FinSize, YrBuilt, Stories, AttGarSF, DetGarSF, plus a
dwelling-row count and the dwelling row's LastUpdD. FinSize is the finished
size on the largest dwelling improvement row. It is not a roof outline.
AttGarSF and DetGarSF are garage floor area. They are not added to a footprint.

Index version 2. One record per parcel, seven values, in this order:

  0  FinSize            finished size on the largest active dwelling row
  1  YrBuilt            of that row
  2  Stories            of that row
  3  AttGarSF           attached garage floor area
  4  DetGarSF           detached garage floor area
  5  dwellingRowCount   how many active dwelling rows the parcel has
  6  rowUpdated         LastUpdD of that row, YYYY-MM-DD, or ""

A blank and a zero are different things:

  null  the cell was blank or unreadable in the county workbook. A reader shows
        nothing for it, or "not in public data". It never shows a 0.
  0     the workbook says zero ("no attached garage").

Version 1 wrote 0 for a blank, so a reader could not tell "no garage" from
"not recorded". A year of 0 and a story count of 0 say nothing, so they are null.

Garage area comes from the dwelling row. Another row's garage area is used only
when the dwelling row has none, and only when that other row is active (ImpStat A).
Version 1 also counted garage area on rows the county marks not active.

Held. Do not write shards into this site. The command exits unless
--hold-override is set and --out is outside the repository. The page does not
read this index. The Snohomish house size it shows comes from the house-size
index (scripts/build_index.py), which the site owner chose to keep publishing.
See data/build-here/data-holds.json.

Usage after written clearance only:
  python3 scripts/build_sno_bldg_index.py --hold-override --out /tmp/sno-bldg --xlsx PATH
"""
from __future__ import annotations

import argparse
import json
import shutil
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Feasibility-study copy. Not wired to GitHub Actions and not the live builder.
# Do not commit this script's output. The public site does not read sno-bldg.
# parents[2] is the repository because this file sits in scripts/feasibility/.
ROOT = Path(__file__).resolve().parents[2]
ITEM = "3c5edc985cec4fba8b3938d16ed1d3c3"
ITEM_URL = "https://www.arcgis.com/sharing/rest/content/items/" + ITEM
DATA_URL = ITEM_URL + "/data"
VERSION = 2
KEEP = ("PIN", "ImprType", "Stories", "YrBuilt", "FinSize", "AttGarSF", "DetGarSF", "LastUpdD", "ImpStat")
FIELDS = ["FinSize", "YrBuilt", "Stories", "AttGarSF", "DetGarSF", "dwellingRowCount", "rowUpdated"]


def source_modified() -> str:
    with urllib.request.urlopen(ITEM_URL + "?f=json", timeout=60) as resp:
        item = json.loads(resp.read().decode("utf-8"))
    ms = item.get("modified") or item.get("created") or 0
    return datetime.fromtimestamp(ms / 1000, timezone.utc).date().isoformat()


def num(value) -> float | None:
    """The number in a cell. None when the cell is blank or not a number."""
    if value is None:
        return None
    text = str(value).replace(",", "").strip()
    if not text:
        return None
    try:
        out = float(text)
    except ValueError:
        return None
    return out if out == out and abs(out) != float("inf") else None


def area(value) -> int | None:
    """A floor area. None when blank or negative. 0 when the workbook says 0."""
    n = num(value)
    return None if n is None or n < 0 else int(round(n))


def day(value) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    text = str(value).strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(text[:10], fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def dwelling(kind: str) -> bool:
    return str(kind or "").upper().startswith(("DWELL", "MH", "MHOME"))


def _more(a, b):
    """The sum of two garage areas from other rows. A blank adds nothing."""
    return a if b is None else (b if a is None else a + b)


def collect(header: list[str], rows) -> dict[str, dict[str, list]]:
    """Read the workbook rows into one record per parcel, grouped by the first four digits of the PIN.

    `header` is the first row of the sheet. `rows` yields the rows after it as tuples.
    Raises SystemExit when a column the extract needs is not in the sheet.
    """
    names = [str(h).strip() if h is not None else "" for h in header]
    lost = [name for name in KEEP if name not in names]
    if lost:
        raise SystemExit("The workbook has no column named " + ", ".join(lost) + ". Its layout has changed. Nothing was written.")
    index = {name: names.index(name) for name in KEEP}
    # One primary dwelling row per PIN, plus garage floor from that row.
    # Another active row's garage counts only when the dwelling row has none.
    primary: dict[str, dict] = {}
    extra_gar: dict[str, list] = defaultdict(lambda: [None, None])
    dwell_count: dict[str, int] = defaultdict(int)

    def other(pin: str, att, det) -> None:
        if att:
            extra_gar[pin][0] = _more(extra_gar[pin][0], att)
        if det:
            extra_gar[pin][1] = _more(extra_gar[pin][1], det)

    for row in rows:
        pin = str(row[index["PIN"]] or "").strip()
        if not pin or not pin.isdigit():
            continue
        if str(row[index["ImpStat"]] or "").strip().upper() != "A":
            continue  # not an active improvement row
        att = area(row[index["AttGarSF"]])
        det = area(row[index["DetGarSF"]])
        if dwelling(row[index["ImprType"]]):
            dwell_count[pin] += 1
            fin = area(row[index["FinSize"]])
            year = num(row[index["YrBuilt"]])
            stories = num(row[index["Stories"]])
            rec = {
                "fin": fin,
                "year": int(year) if year is not None and year > 1800 else None,
                "stories": stories if stories is not None and stories > 0 else None,
                "att": att,
                "det": det,
                "updated": day(row[index["LastUpdD"]]),
            }
            prev = primary.get(pin)
            if prev is None or (fin or 0) > (prev["fin"] or 0):
                if prev:
                    other(pin, prev["att"], prev["det"])
                primary[pin] = rec
            else:
                other(pin, att, det)
        else:
            other(pin, att, det)

    shards: dict[str, dict[str, list]] = defaultdict(dict)
    for pin, rec in primary.items():
        extra = extra_gar.get(pin, [None, None])
        # The dwelling row's garage when it has one, else another row's, else what the dwelling row says (0 or blank).
        att = rec["att"] if rec["att"] else (extra[0] if extra[0] else rec["att"])
        det = rec["det"] if rec["det"] else (extra[1] if extra[1] else rec["det"])
        if not rec["fin"] and not att and not det:
            continue  # nothing positive to publish for this parcel
        stories = rec["stories"]
        if isinstance(stories, float) and stories == int(stories):
            stories = int(stories)
        shards[pin[:4]][pin] = [rec["fin"], rec["year"], stories, att, det, dwell_count[pin], rec["updated"]]
    return shards


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
    for key, data in shards.items():
        payload = {
            "v": meta["v"],
            "src": meta["source"],
            "asOf": meta["built"],
            "sourceModified": meta["sourceModified"],
            "fields": meta["fields"],
            "b": data,
        }
        path = tmp / f"{key}.json"
        path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        total += path.stat().st_size
    if out.exists():
        out.rename(old)
    tmp.rename(out)
    if old.exists():
        shutil.rmtree(old)
    return total


def build(xlsx: Path, out: Path, source_modified_day: str) -> dict:
    import openpyxl

    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    try:
        rows = wb.active.iter_rows(values_only=True)
        shards = collect(list(next(rows)), rows)
    finally:
        wb.close()
    built = datetime.now(timezone.utc).date().isoformat()
    meta = {
        "v": VERSION,
        "built": built,
        "sourceModified": source_modified_day,
        "source": "Snohomish County Improvement Records (SnocoGIS). Physical building fields only.",
        "sourceUrl": ITEM_URL,
        "cadence": "Not a live source and not for the public site while the county-use hold is open. sourceModified is the SnocoGIS item date. built is the day this file was written.",
        "fields": FIELDS,
        "nulls": "null is a blank in the county workbook. 0 is the workbook saying zero.",
        "omitted": "Owner names, taxpayer names, site addresses, photos, sketches, and notes are not copied.",
        "meaning": {
            "FinSize": "County finished-size column on the largest active dwelling row (ImpStat A). Basement finished area, lower-level finished area, and attic finished area are separate columns and are not copied. Not proven to be total finished living area.",
            "AttGarSF": "Attached garage floor area. Not added to the footprint.",
            "DetGarSF": "Detached garage floor area. Not added to the footprint.",
        },
        "parcels": sum(len(v) for v in shards.values()),
        "shards": len(shards),
    }
    total = write_index(out, shards, meta)
    print(json.dumps({"parcels": meta["parcels"], "shards": meta["shards"], "bytes": total, "built": built,
                      "sourceModified": source_modified_day, "v": VERSION}))
    return meta


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", default="")
    parser.add_argument("--out", default="")
    parser.add_argument("--hold-override", action="store_true", help="Write outside this repository after written county or counsel clearance.")
    args = parser.parse_args()
    if not args.hold_override:
        raise SystemExit("HOLD: Snohomish Improvement Records are not enabled for this public site. The item terms cover data from which a list of individuals may be compiled. Refusing to build shards.")
    out = Path(args.out).resolve() if args.out else None
    if out is None or out.is_relative_to(ROOT.resolve()):
        raise SystemExit("HOLD: refusing to write the extract inside this repository or its assets directory.")
    modified = source_modified()
    xlsx = Path(args.xlsx) if args.xlsx else Path("/tmp/sno-impr.xlsx")
    if not xlsx.exists():
        urllib.request.urlretrieve(DATA_URL, xlsx)
    build(xlsx, out, modified)


if __name__ == "__main__":
    main()
