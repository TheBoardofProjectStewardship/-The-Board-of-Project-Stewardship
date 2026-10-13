#!/usr/bin/env python3
"""Fail if the standalone word AI appears in public page copy."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AI = re.compile(r"\bAI\b")
SKIP_DIRS = {"node_modules", ".git", "state", "worker"}


def public_html() -> list[Path]:
    found = []
    for path in ROOT.rglob("*.html"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        found.append(path)
    return found


def visible_copy(html: str) -> str:
    alts = " ".join(re.findall(r'\balt="([^"]*)"', html))
    titles = " ".join(re.findall(r"<title>(.*?)</title>", html, flags=re.I | re.S))
    metas = " ".join(
        re.findall(
            r'<meta\b[^>]*(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"[^>]*content="([^"]*)"',
            html,
            flags=re.I,
        )
    )
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return text + " " + alts + " " + titles + " " + metas


def violations() -> list[str]:
    out = []
    for path in public_html():
        html = path.read_text(encoding="utf-8", errors="replace")
        if AI.search(visible_copy(html)):
            out.append(str(path.relative_to(ROOT)))
    return out


def main() -> int:
    found = violations()
    if found:
        print("standalone AI in public copy:")
        for name in found:
            print(f"  {name}")
        return 1
    print(f"public copy ok ({len(public_html())} html files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
