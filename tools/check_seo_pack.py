#!/usr/bin/env python3
"""Grep-style checks for the BOPS SEO + header pack (fixes 21, 25, 28)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEN = (ROOT / "generate_site.py").read_text(encoding="utf-8")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def main() -> None:
    if re.search(r'"parentOrganization"', GEN):
        fail("generate_site.py must not emit parentOrganization")
    if "SearchAction" in GEN and "skip fix #21" not in GEN:
        fail("SearchAction present without skip documentation")
    if re.search(r'"@type":\s*"LocalBusiness"', GEN):
        fail("Board/generator must not emit LocalBusiness")
    if re.search(r'"@type":\s*"NewsMediaOrganization"', GEN):
        fail("Generator must not emit NewsMediaOrganization")

    html_files = list(ROOT.glob("*.html")) + list((ROOT / "posts").glob("*.html"))
    if not html_files:
        fail("no generated HTML found")

    sample = (ROOT / "index.html").read_text(encoding="utf-8")
    for needle in (
        'id="main-content"',
        'class="skip-link"',
        'name="theme-color"',
        'og:site_name',
        'og:locale',
        'twitter:image:alt',
        'strict-origin-when-cross-origin',
        'max-image-preview:large',
        "fonts.googleapis.com",
        "fonts.gstatic.com",
        "aria-controls=\"mobile-nav\"",
        "Board #1 · Pacific Pro Group",
    ):
        if needle not in sample:
            fail(f"index.html missing {needle}")

    if "parentOrganization" in sample or "associated with PPG" in sample.lower():
        fail("index.html contains independent-Board lock violation")

    for path in html_files:
        text = path.read_text(encoding="utf-8")
        if '"@type": "LocalBusiness"' in text or '"@type": "NewsMediaOrganization"' in text:
            fail(f"{path.name} emits forbidden schema type")
        if "SearchAction" in text:
            fail(f"{path.name} emits SearchAction")
        if 'id="main-content"' not in text:
            fail(f"{path.name} missing main#main-content")

    if not (ROOT / "404.html").is_file():
        fail("404.html missing")
    if not (ROOT / "blog" / "rss.xml").is_file():
        fail("blog/rss.xml missing")

    crumbs = 0
    for path in html_files:
        if '"@type": "BreadcrumbList"' in path.read_text(encoding="utf-8"):
            crumbs += 1
    if crumbs < 10:
        fail(f"expected BreadcrumbList on directories + posts, found {crumbs}")

    print(f"OK: checked {len(html_files)} HTML files; BreadcrumbList on {crumbs}")


if __name__ == "__main__":
    main()
