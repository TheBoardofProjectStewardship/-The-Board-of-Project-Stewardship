#!/usr/bin/env python3
"""Stop a held dataset from being published by accident.

data/build-here/data-holds.json lists folders that must not hold published files until a question about
the data is answered in writing. This script looks at each one:

  status "held"        files present and no clearance recorded  -> error, exit 1
  status "unverified"  files present and no clearance recorded  -> warning, exit 0 (exit 1 with --strict)
  any status           files present and a clearance recorded   -> ok, and the clearance is printed

A clearance is a short line in the manifest saying who cleared the data, or who decided to publish it, and
when. The Snohomish house-size files (assets/data/house-size/snoh) carry one: the site owner decided on
2026-11-13 to keep publishing them. Nothing is deleted.

Usage: python3 scripts/check_data_holds.py [--root DIR] [--strict]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = Path("data") / "build-here" / "data-holds.json"


def published_files(folder: Path) -> int:
    return sum(1 for p in folder.rglob("*") if p.is_file()) if folder.is_dir() else 0


def check(root: Path, strict: bool = False) -> tuple[int, list[str]]:
    holds = json.loads((root / MANIFEST).read_text(encoding="utf-8"))["holds"]
    lines, failed = [], False
    for h in holds:
        count = published_files(root / h["path"])
        cleared = str(h.get("clearance") or "").strip()
        if not count:
            lines.append(f"ok       {h['path']}: nothing published")
        elif cleared:
            lines.append(f"ok       {h['path']}: {count} files, cleared ({cleared})")
        elif h.get("status") == "held" or strict:
            failed = True
            lines.append(f"::error::{h['path']}: {count} files are published and no clearance is recorded. {h['reason']}")
        else:
            lines.append(f"::warning::{h['path']}: {count} files are published and where they come from is not recorded. {h['reason']}")
    return (1 if failed else 0), lines


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Check that no held dataset is published.")
    ap.add_argument("--root", type=Path, default=ROOT)
    ap.add_argument("--strict", action="store_true", help="treat an unverified dataset as an error too")
    args = ap.parse_args(argv)
    code, lines = check(args.root, args.strict)
    print("\n".join(lines))
    return code


if __name__ == "__main__":
    sys.exit(main())
