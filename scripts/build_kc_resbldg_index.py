#!/usr/bin/env python3
"""Download King County Assessor Residential Building extract and shard by PIN prefix.

Produces assets/data/kc-resbldg/{XX}.json used by Build Here to autofill finished living SF.
Usage: python3 scripts/build_kc_resbldg_index.py
"""
from __future__ import annotations

import csv
import json
import time
import urllib.request
import zipfile
from collections import defaultdict
from io import TextIOWrapper
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "data" / "kc-resbldg"
ZIP_URL = "https://aqua.kingcounty.gov/extranet/assessor/Residential%20Building.zip"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for p in OUT.glob("*.json"):
        p.unlink()

    print("Downloading", ZIP_URL)
    req = urllib.request.Request(ZIP_URL, headers={"User-Agent": "BOPS-BuildHere/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        zip_bytes = resp.read()
    print("zip bytes", len(zip_bytes))

    shards: dict[str, dict[str, list]] = defaultdict(dict)
    n = 0
    with zipfile.ZipFile(__import__("io").BytesIO(zip_bytes)) as zf:
        name = next(x for x in zf.namelist() if x.lower().endswith(".csv"))
        with zf.open(name) as raw:
            reader = csv.DictReader(TextIOWrapper(raw, encoding="utf-8", errors="replace"))
            for row in reader:
                major = (row.get("Major") or "").strip().zfill(6)
                minor = (row.get("Minor") or "").strip().zfill(4)
                pin = major + minor
                try:
                    liv = int(float(row.get("SqFtTotLiving") or 0))
                except Exception:
                    liv = 0
                if liv <= 0:
                    continue
                def num(key: str) -> float:
                    try:
                        return float(row.get(key) or 0)
                    except Exception:
                        return 0.0
                yr = int(num("YrBuilt"))
                st = num("Stories")
                fp1 = int(num("SqFt1stFloor"))
                gar = int(num("SqFtGarageAttached") + num("SqFtGarageBasement"))
                rec = [liv, yr if yr > 1800 else 0, st if st > 0 else 0, fp1 if fp1 > 0 else 0, gar if gar > 0 else 0]
                shard = major[:2]
                if pin in shards[shard]:
                    prev = shards[shard][pin]
                    shards[shard][pin] = [
                        prev[0] + rec[0],
                        prev[1] if prev[1] and (not rec[1] or prev[1] <= rec[1]) else rec[1],
                        max(prev[2], rec[2]),
                        prev[3] + rec[3],
                        prev[4] + rec[4],
                    ]
                else:
                    shards[shard][pin] = rec
                n += 1

    meta = {
        "v": 1,
        "built": time.strftime("%Y-%m-%d"),
        "source": "King County Assessor EXTR_ResBldg.csv (Residential Building.zip)",
        "sourceUrl": ZIP_URL,
        "rows": n,
        "parcels": sum(len(s) for s in shards.values()),
        "shards": sorted(shards.keys()),
        "fields": ["SqFtTotLiving", "YrBuilt", "Stories", "SqFt1stFloor", "garageAttached+Basement"],
    }
    (OUT / "_meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    total = 0
    for sh, data in shards.items():
        text = json.dumps({"src": meta["source"], "asOf": meta["built"], "b": data}, separators=(",", ":"))
        path = OUT / f"{sh}.json"
        path.write_text(text, encoding="utf-8")
        total += path.stat().st_size
    print("wrote", len(shards), "shards,", round(total / 1024 / 1024, 2), "MB,", n, "buildings")


if __name__ == "__main__":
    main()
