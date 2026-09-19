#!/usr/bin/env python3
"""Grep-style checks for BOPS chrome + SEO lock (Chief of Staff rules)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEN = (ROOT / "generate_site.py").read_text(encoding="utf-8")
EDITORIAL = "editorial@boardofprojectstewardship.com"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def main() -> None:
    if re.search(r'"parentOrganization"', GEN):
        fail("generate_site.py must not emit parentOrganization")
    if re.search(r'"isRelatedTo"', GEN):
        fail("generate_site.py must not emit isRelatedTo")
    if "SearchAction" in GEN and "skip fix #21" not in GEN:
        fail("SearchAction present without skip documentation")
    if re.search(r'"@type":\s*"LocalBusiness"', GEN):
        fail("Board/generator must not emit LocalBusiness")
    if re.search(r'"@type":\s*"NewsMediaOrganization"', GEN):
        fail("Generator must not emit NewsMediaOrganization")
    if "admin@" in GEN:
        fail("generator must not mention admin@")
    if EDITORIAL not in GEN:
        fail("generator missing editorial@ public contact")

    html_files = list(ROOT.glob("*.html")) + list((ROOT / "posts").glob("*.html"))
    if not html_files:
        fail("no generated HTML found")

    sample = (ROOT / "index.html").read_text(encoding="utf-8")
    for needle in (
        'id="main-content"',
        'class="skip-link"',
        'name="theme-color"',
        "og:site_name",
        "og:locale",
        "twitter:image:alt",
        "strict-origin-when-cross-origin",
        "fonts.googleapis.com",
        "fonts.gstatic.com",
        'aria-controls="mobile-nav"',
        EDITORIAL,
        'content="index, follow"',
    ):
        if needle not in sample:
            fail(f"index.html missing {needle}")

    sticky = re.search(
        r'<header class="bg-charcoal/80.*?</header>',
        sample,
        flags=re.S,
    )
    if not sticky:
        fail("sticky Board header missing")
    header = sticky.group(0)
    if "pacificprogroup.com" in header.lower() or "pacific pro group" in header.lower():
        fail("header chrome must not contain PPG brand or URL")
    if "admin@" in header:
        fail("header must not use admin@")

    footer = sample.split("<footer", 1)[1] if "<footer" in sample else ""
    if "our company" in footer.lower() or "associated with" in footer.lower():
        fail("footer contains ownership language")
    if EDITORIAL not in footer:
        fail("footer missing editorial@")

    if "hreflang" in sample:
        fail("hreflang must not be emitted")

    nav_needed = (
        "About",
        "Additions",
        "Custom Homes",
        "Edmonds",
        "Kitchen",
        "Bathrooms",
        "Commercial",
        "Spec",
        "Trades",
        "Blog",
        "Good Steward",
        "Another Story",
    )
    chrome = header
    for label in nav_needed:
        if label not in chrome:
            fail(f"nav missing {label}")

    for path in html_files:
        text = path.read_text(encoding="utf-8")
        if '"@type": "LocalBusiness"' in text or '"@type": "NewsMediaOrganization"' in text:
            fail(f"{path.name} emits forbidden schema type")
        if "SearchAction" in text:
            fail(f"{path.name} emits SearchAction")
        if "parentOrganization" in text or "isRelatedTo" in text:
            fail(f"{path.name} emits owner-shaped schema")
        if 'id="main-content"' not in text:
            fail(f"{path.name} missing main#main-content")
        if "netlify.app" in text or "ghost.io" in text:
            fail(f"{path.name} contains netlify.app or ghost.io")
        if "hreflang" in text:
            fail(f"{path.name} emits hreflang")
        if "admin@" in text:
            fail(f"{path.name} contains admin@")
        if 'rel="canonical"' in text and "https://boardofprojectstewardship.com/" not in text:
            fail(f"{path.name} canonical is not absolute Board https")

    if EDITORIAL not in sample:
        fail("Organization/pages missing editorial@")

    post = next((ROOT / "posts").glob("*.html"), None)
    if post:
        ptxt = post.read_text(encoding="utf-8")
        if "BlogPosting" not in ptxt:
            fail(f"{post.name} missing BlogPosting")
        if "BreadcrumbList" not in ptxt:
            fail(f"{post.name} missing BreadcrumbList")

    if not (ROOT / "404.html").is_file():
        fail("404.html missing")
    if not (ROOT / "blog" / "rss.xml").is_file():
        fail("blog/rss.xml missing")

    crumbs = sum(
        1 for path in html_files if '"@type": "BreadcrumbList"' in path.read_text(encoding="utf-8")
    )
    if crumbs < 10:
        fail(f"expected BreadcrumbList on directories + posts, found {crumbs}")

    print(f"OK: checked {len(html_files)} HTML files; BreadcrumbList on {crumbs}")


if __name__ == "__main__":
    main()
