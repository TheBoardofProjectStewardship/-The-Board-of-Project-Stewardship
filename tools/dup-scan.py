#!/usr/bin/env python3
"""Fail when image files newly share an md5.

Known pairs are listed in image_md5_baseline.json. A new pair, or a new file
joining an existing pair, fails the check. Removing a known file does not.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = Path(__file__).with_name("image_md5_baseline.json")
EXTS = {".webp", ".jpg", ".jpeg", ".png"}


def duplicate_groups() -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for base in (ROOT / "assets" / "images", ROOT / "assets" / "hero"):
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in EXTS:
                continue
            digest = hashlib.md5(path.read_bytes()).hexdigest()
            found.setdefault(digest, []).append(path.relative_to(ROOT).as_posix())
    return {digest: sorted(paths) for digest, paths in found.items() if len(paths) > 1}


def main() -> None:
    current = duplicate_groups()
    if "--write-baseline" in sys.argv:
        BASELINE.write_text(json.dumps(current, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"wrote {len(current)} duplicate groups")
        return
    baseline = json.loads(BASELINE.read_text(encoding="utf-8")) if BASELINE.is_file() else {}
    problems: list[str] = []
    for digest, paths in sorted(current.items()):
        allowed = set(baseline.get(digest, []))
        extra = [path for path in paths if path not in allowed]
        if extra:
            problems.append(f"{digest}: {', '.join(paths)}")
    if problems:
        print("FAIL: new image files share an md5")
        for line in problems[:30]:
            print(f"  {line}")
        sys.exit(1)
    print(f"OK: {len(current)} known duplicate image groups, no new pairs")


if __name__ == "__main__":
    main()
