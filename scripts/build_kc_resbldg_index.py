#!/usr/bin/env python3
"""Download King County Assessor Residential Building extract and shard by PIN prefix.

Produces assets/data/kc-resbldg/{XX}.json used by Build Here to autofill finished living SF.
Usage: python3 scripts/build_kc_resbldg_index.py [--out DIR] [--zip LOCAL.zip] [--min-parcels N]

One record per parcel: [SqFtTotLiving, YrBuilt, Stories, SqFt1stFloor, garage, buildingRecords].
The extract has one row per residential building. A parcel with several rows (a house and a
backyard cottage, say) gets the sum of living area, first-floor area and garage area, the earliest
year built and the tallest story count. The last element is how many rows were combined, and the
page says so beside the figure. Index files built before this field existed have five elements.

The new index is built in a sibling folder and swapped in only after every shard is written, so a
failed download, a truncated file or a crash leaves the published index as it was. The earlier
version of this script deleted the published shards before it started the download.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import shutil
import time
import urllib.request
import zipfile
from collections import defaultdict
from email.utils import parsedate_to_datetime
from io import TextIOWrapper
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "data" / "kc-resbldg"
ZIP_URL = "https://aqua.kingcounty.gov/extranet/assessor/Residential%20Building.zip"
SOURCE = "King County Assessor EXTR_ResBldg.csv (Residential Building.zip)"
FIELDS = ["SqFtTotLiving", "YrBuilt", "Stories", "SqFt1stFloor", "garageAttached+Basement", "buildingRecords"]


def _num(row: dict, key: str) -> float:
    try:
        return float(row.get(key) or 0)
    except (TypeError, ValueError):
        return 0.0


def aggregate(rows) -> tuple[dict[str, dict[str, list]], int]:
    """Combine building rows into one record per parcel. Returns (shards, building rows kept)."""
    shards: dict[str, dict[str, list]] = defaultdict(dict)
    n = 0
    for row in rows:
        major = (row.get("Major") or "").strip().zfill(6)
        minor = (row.get("Minor") or "").strip().zfill(4)
        pin = major + minor
        liv = int(_num(row, "SqFtTotLiving"))
        if liv <= 0:
            continue
        yr = int(_num(row, "YrBuilt"))
        st = _num(row, "Stories")
        fp1 = int(_num(row, "SqFt1stFloor"))
        gar = int(_num(row, "SqFtGarageAttached") + _num(row, "SqFtGarageBasement"))
        rec = [liv, yr if yr > 1800 else 0, st if st > 0 else 0, fp1 if fp1 > 0 else 0, gar if gar > 0 else 0, 1]
        shard = major[:2]
        prev = shards[shard].get(pin)
        if prev:
            shards[shard][pin] = [
                prev[0] + rec[0],
                prev[1] if prev[1] and (not rec[1] or prev[1] <= rec[1]) else rec[1],
                max(prev[2], rec[2]),
                prev[3] + rec[3],
                prev[4] + rec[4],
                prev[5] + 1,
            ]
        else:
            shards[shard][pin] = rec
        n += 1
    return shards, n


def fetch_zip(url: str = ZIP_URL) -> tuple[bytes, str]:
    """Returns (zip bytes, date on the county file as YYYY-MM-DD, or "" when the server does not say)."""
    req = urllib.request.Request(url, headers={"User-Agent": "BOPS-BuildHere/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = resp.read()
        stamp = resp.headers.get("Last-Modified") or ""
    try:
        day = parsedate_to_datetime(stamp).date().isoformat() if stamp else ""
    except (TypeError, ValueError):
        day = ""
    return data, day


def rows_from_zip(zip_bytes: bytes):
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        name = next(x for x in zf.namelist() if x.lower().endswith(".csv"))
        with zf.open(name) as raw:
            yield from csv.DictReader(TextIOWrapper(raw, encoding="utf-8", errors="replace"))


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
        text = json.dumps({"src": meta["source"], "asOf": meta["built"], "srcDate": meta.get("sourceDate", ""), "b": data}, separators=(",", ":"))
        path = tmp / f"{sh}.json"
        path.write_text(text, encoding="utf-8")
        total += path.stat().st_size
    if out.exists():
        out.rename(old)
    tmp.rename(out)
    if old.exists():
        shutil.rmtree(old)
    return total


def build(out: Path = OUT, zip_path: Path | None = None, min_parcels: int = 100000, fetch=fetch_zip) -> dict:
    """Download (or read), combine, check, then publish. Raises before anything published is touched."""
    if zip_path:
        zip_bytes, source_day = Path(zip_path).read_bytes(), ""
    else:
        if fetch is fetch_zip:
            print("Downloading", ZIP_URL)
        zip_bytes, source_day = fetch()
    print("zip bytes", len(zip_bytes))
    shards, n = aggregate(rows_from_zip(zip_bytes))
    parcels = sum(len(s) for s in shards.values())
    if parcels < min_parcels:
        raise SystemExit(f"Only {parcels} parcels came out of the county file (expected at least {min_parcels}). "
                         "The published index was left as it was. Pass --min-parcels to override.")
    meta = {
        "v": 2,
        "built": time.strftime("%Y-%m-%d"),
        "sourceDate": source_day,
        "source": SOURCE,
        "sourceUrl": ZIP_URL,
        "rows": n,
        "parcels": parcels,
        "multiBuildingParcels": sum(1 for s in shards.values() for r in s.values() if r[5] > 1),
        "shards": sorted(shards.keys()),
        "fields": FIELDS,
    }
    total = write_index(out, shards, meta)
    print("wrote", len(shards), "shards,", round(total / 1024 / 1024, 2), "MB,", n, "buildings,", parcels, "parcels")
    return meta


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--zip", type=Path, default=None, help="read a downloaded Residential Building.zip instead of fetching it")
    ap.add_argument("--min-parcels", type=int, default=100000)
    args = ap.parse_args(argv)
    build(args.out, args.zip, args.min_parcels)


if __name__ == "__main__":
    main()
