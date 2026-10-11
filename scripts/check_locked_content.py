#!/usr/bin/env python3
"""Fail if locked homepage copy changes.

Hashes are stored in locked-content.sha256. The blocks are read from the
published homepage and from the generator source that produces them.
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
GENERATOR = ROOT / "generate_site.py"
MANIFEST = ROOT / "locked-content.sha256"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def must_find(label: str, text: str, needle: str) -> int:
    at = text.find(needle)
    if at < 0:
        raise SystemExit(f"missing {label}: {needle[:80]}")
    return at


def slice_until(text: str, start: int, end_needle: str, label: str) -> str:
    end = text.find(end_needle, start)
    if end < 0:
        raise SystemExit(f"missing end for {label}")
    return text[start : end + len(end_needle)]


def section(html: str, section_id: str) -> str:
    token = f'id="{section_id}"'
    at = must_find(section_id, html, token)
    start = html.rfind("<section", 0, at)
    if start < 0:
        raise SystemExit(f"no section tag for {section_id}")
    return slice_until(html, start, "</section>", section_id)


def anchors(html: str) -> str:
    found = re.findall(
        r"<a\b[^>]*https://secure\.lni\.wa\.gov/verify/[^>]*>.*?</a>",
        html,
        flags=re.I | re.S,
    )
    if not found:
        raise SystemExit("no L&I anchors on the homepage")
    return "\n".join(found)


def blocks() -> dict[str, str]:
    index = INDEX.read_text(encoding="utf-8")
    gen = GENERATOR.read_text(encoding="utf-8")
    directory = "The Board ranks <strong class=\"text-white font-semibold\">Pacific Pro Group</strong> #1 for remodel and additions across King County, Snohomish County, and Seattle. Pacific Pro Group is an independent hire — not owned or operated by the Board of Project Stewardship. Outbound only; re-verify at WA L&amp;I before any deposit."
    hire = "Board #1 hire (outbound):"
    disclaimer = "Listing is not an endorsement of quality."
    iframe_at = must_find("another-story iframe", index, 'id="another-story-sea"')
    iframe_start = index.rfind("<iframe", 0, iframe_at)
    gen_iframe = must_find("generator another-story", gen, 'id="another-story-sea"')
    return {
        "ppg_section_index": section(index, "why-ppg-number-one"),
        "ppg_section_generator": section(gen, "why-ppg-number-one"),
        "directory_one_index": slice_until(index, must_find("directory index", index, directory), "</p>", "directory index"),
        "directory_one_generator": slice_until(gen, must_find("directory generator", gen, directory), "</p>", "directory generator"),
        "another_story_iframe_index": slice_until(index, iframe_start, "</iframe>", "iframe index"),
        "another_story_iframe_generator": gen[gen_iframe : gen_iframe + 220],
        "lni_anchors_index": anchors(index),
        "footer_hire_index": slice_until(index, must_find("hire index", index, hire), "</p>", "hire index"),
        "footer_hire_generator": slice_until(gen, must_find("hire generator", gen, hire), "</p>", "hire generator"),
        "footer_disclaimer_index": slice_until(index, must_find("disclaimer index", index, disclaimer), "</p>", "disclaimer index"),
        "footer_disclaimer_generator": slice_until(gen, must_find("disclaimer generator", gen, disclaimer), "</p>", "disclaimer generator"),
    }


def manifest_text(found: dict[str, str]) -> str:
    lines = [f"{name} {sha(body)}" for name, body in found.items()]
    return "\n".join(lines) + "\n"


def read_manifest() -> dict[str, str]:
    if not MANIFEST.is_file():
        raise SystemExit(f"missing {MANIFEST.name}; run with --write")
    out = {}
    for line in MANIFEST.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        name, digest = line.split()
        out[name] = digest
    return out


def main(argv: list[str]) -> None:
    found = blocks()
    if "--write" in argv:
        MANIFEST.write_text(manifest_text(found), encoding="utf-8")
        print(f"wrote {MANIFEST}")
        return
    expected = read_manifest()
    failed = False
    for name, body in found.items():
        digest = sha(body)
        prior = expected.get(name)
        if prior != digest:
            failed = True
            print(f"CHANGED {name}")
            print(f"  manifest {prior}")
            print(f"  current  {digest}")
    missing = sorted(set(expected) - set(found))
    extra = sorted(set(found) - set(expected))
    for name in missing:
        failed = True
        print(f"MISSING block {name}")
    for name in extra:
        failed = True
        print(f"NEW block {name}")
    if failed:
        raise SystemExit(1)
    print(f"locked content ok ({len(found)} blocks)")


if __name__ == "__main__":
    main(sys.argv[1:])
