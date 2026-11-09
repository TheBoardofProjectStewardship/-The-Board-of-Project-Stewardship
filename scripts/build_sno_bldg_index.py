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

Usage:
  python3 scripts/build_sno_bldg_index.py [--xlsx PATH] [--out assets/data/sno-bldg]
"""
from __future__ import annotations

import argparse
import json
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ITEM = "3c5edc985cec4fba8b3938d16ed1d3c3"
ITEM_URL = "https://www.arcgis.com/sharing/rest/content/items/" + ITEM
DATA_URL = ITEM_URL + "/data"
KEEP = ("PIN", "ImprType", "Stories", "YrBuilt", "FinSize", "AttGarSF", "DetGarSF", "LastUpdD")


def source_modified() -> str:
    with urllib.request.urlopen(ITEM_URL + "?f=json", timeout=60) as resp:
        item = json.loads(resp.read().decode("utf-8"))
    ms = item.get("modified") or item.get("created") or 0
    return datetime.fromtimestamp(ms / 1000, timezone.utc).date().isoformat()


def num(value) -> float:
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return 0.0


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


def build(xlsx: Path, out: Path, source_modified_day: str) -> None:
    import openpyxl

    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.json"):
        old.unlink()
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(h) if h is not None else "" for h in next(rows)]
    index = {name: header.index(name) for name in KEEP}
    # One primary dwelling row per PIN, plus garage floor from that row.
    # Another row's garage counts only when the dwelling row has none.
    primary: dict[str, dict] = {}
    extra_gar: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
    dwell_count: dict[str, int] = defaultdict(int)
    for row in rows:
        pin = str(row[index["PIN"]] or "").strip()
        if not pin or not pin.isdigit():
            continue
        att = num(row[index["AttGarSF"]])
        det = num(row[index["DetGarSF"]])
        if dwelling(row[index["ImprType"]]):
            dwell_count[pin] += 1
            fin = num(row[index["FinSize"]])
            rec = {
                "fin": fin,
                "year": int(num(row[index["YrBuilt"]])),
                "stories": num(row[index["Stories"]]),
                "att": att,
                "det": det,
                "updated": day(row[index["LastUpdD"]]),
            }
            prev = primary.get(pin)
            if prev is None or fin > prev["fin"]:
                if prev and (prev["att"] or prev["det"]):
                    extra_gar[pin][0] += prev["att"]
                    extra_gar[pin][1] += prev["det"]
                primary[pin] = rec
            elif att or det:
                extra_gar[pin][0] += att
                extra_gar[pin][1] += det
        elif att or det:
            extra_gar[pin][0] += att
            extra_gar[pin][1] += det
    wb.close()

    shards: dict[str, dict] = defaultdict(dict)
    for pin, rec in primary.items():
        extra = extra_gar.get(pin, [0.0, 0.0])
        att = rec["att"] if rec["att"] > 0 else extra[0]
        det = rec["det"] if rec["det"] > 0 else extra[1]
        if rec["fin"] <= 0 and att <= 0 and det <= 0:
            continue
        year = rec["year"] if rec["year"] > 1800 else 0
        stories = rec["stories"] if rec["stories"] > 0 else 0
        shards[pin[:4]][pin] = [
            int(rec["fin"]) if rec["fin"] > 0 else 0,
            year,
            stories,
            int(round(att)) if att > 0 else 0,
            int(round(det)) if det > 0 else 0,
            dwell_count[pin],
            rec["updated"],
        ]
    built = datetime.now(timezone.utc).date().isoformat()
    meta = {
        "v": 1,
        "built": built,
        "sourceModified": source_modified_day,
        "source": "Snohomish County Improvement Records (SnocoGIS). Physical building fields only.",
        "sourceUrl": ITEM_URL,
        "cadence": "Not a live assessor query. sourceModified is the SnocoGIS item date. built is the day this extract was written. The house-size workflow rebuilds this directory weekly once that workflow file is on the default branch.",
        "fields": ["FinSize", "YrBuilt", "Stories", "AttGarSF", "DetGarSF", "dwellingRowCount", "rowUpdated"],
        "omitted": "Owner names, taxpayer names, site addresses, photos, sketches, and notes are not copied.",
        "meaning": {
            "FinSize": "Finished size on the largest dwelling improvement row. Not a roof outline and not garage floor area.",
            "AttGarSF": "Attached garage floor area. Not added to the footprint.",
            "DetGarSF": "Detached garage floor area. Not added to the footprint.",
        },
        "parcels": sum(len(v) for v in shards.values()),
        "shards": len(shards),
    }
    (out / "_meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    total = 0
    for key, data in shards.items():
        payload = {
            "src": meta["source"],
            "asOf": built,
            "sourceModified": source_modified_day,
            "fields": meta["fields"],
            "b": data,
        }
        path = out / f"{key}.json"
        path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        total += path.stat().st_size
    print(json.dumps({"parcels": meta["parcels"], "shards": meta["shards"], "bytes": total, "built": built, "sourceModified": source_modified_day}))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", default="")
    parser.add_argument("--out", default=str(ROOT / "assets" / "data" / "sno-bldg"))
    args = parser.parse_args()
    modified = source_modified()
    xlsx = Path(args.xlsx) if args.xlsx else Path("/tmp/sno-impr.xlsx")
    if not xlsx.exists():
        urllib.request.urlretrieve(DATA_URL, xlsx)
    build(xlsx, Path(args.out), modified)


if __name__ == "__main__":
    main()
