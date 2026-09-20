#!/usr/bin/env python3
"""Grep-style checks for BOPS chrome + SEO lock (Chief of Staff rules)."""
from __future__ import annotations

import html
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
    if re.search(r'"alternateName"\s*:', GEN):
        fail("generator must not emit Organization alternateName (no BOPS alias)")
    if re.search(r"[>|]\s*BOPS\b", GEN) or re.search(r">BOPS<", GEN):
        fail("generator still emits public-facing BOPS chrome")

    html_files = list(ROOT.glob("*.html")) + list((ROOT / "posts").glob("*.html"))
    if not html_files:
        fail("no generated HTML found")

    bops_token = re.compile(r"(?<![A-Za-z0-9])BOPS(?![A-Za-z0-9])")
    for path in html_files:
        text = path.read_text(encoding="utf-8")
        cleaned = re.sub(r"<!--.*?-->", "", text, flags=re.S)
        cleaned = cleaned.replace("prose-bops", "").replace("bops-tool-seo", "")
        if bops_token.search(cleaned):
            fail(f"{path.name} still contains public-facing BOPS")
        if '"alternateName"' in text:
            fail(f"{path.name} still emits JSON-LD alternateName")
        titles = (
            re.findall(r"<title>([^<]+)</title>", text)
            + re.findall(r'property="og:title" content="([^"]+)"', text)
            + re.findall(r'name="twitter:title" content="([^"]+)"', text)
        )
        for raw in titles:
            title = html.unescape(raw)
            if bops_token.search(title):
                fail(f"{path.name} title still uses BOPS: {title}")
            if re.search(r"Board of(?! Project Stewardship)", title):
                fail(f"{path.name} title chops the Board name: {title}")

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
        "Site Visit Checklist",
        "PM Dashboard",
        "Another Story",
        "Tools",
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
    # Alex 2026-09-20: do not require "not a GC" (undercuts hire intent).
    low = sample.lower()
    if "standards and contractor directories" not in low and "construction standards and contractor" not in low:
        fail("homepage/org missing Board standards/directories one-liner")
    if "ppg-associated" in low or "owned editorial" in low or "parentorganization" in low:
        fail("homepage/org has banned PPG-ownership / owned-editorial phrasing")
    if 'id="contact"' not in sample or EDITORIAL not in sample.split('id="contact"', 1)[1][:400]:
        fail("index.html missing editorial@ contact strip")

    write_page = ROOT / "write.html"
    if write_page.is_file():
        wtxt = write_page.read_text(encoding="utf-8")
        if 'content="noindex, follow"' not in wtxt:
            fail("write.html must be noindex, follow")

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8") if (ROOT / "sitemap.xml").is_file() else ""
    if "write.html" in sitemap:
        fail("write.html must not appear in sitemap.xml")
    if "tools/another-story/index.html" not in sitemap:
        fail("sitemap missing public Another Story tool URL")
    for rel in ("site-visit.html", "pm-dashboard.html", "good-steward.html", "another-story.html"):
        if rel not in sitemap:
            fail(f"sitemap missing {rel}")

    trades = (ROOT / "trades.html").read_text(encoding="utf-8")
    if '"@type": "ItemList"' not in trades:
        fail("trades.html missing ItemList")
    if '"@type": "FAQPage"' not in trades:
        fail("trades.html missing FAQPage")

    blog = (ROOT / "blog.html").read_text(encoding="utf-8")
    if '"@type": "CollectionPage"' not in blog and '"@type": "ItemList"' not in blog:
        fail("blog.html missing CollectionPage or ItemList")

    for path in html_files:
        text = path.read_text(encoding="utf-8")
        if re.search(r'href="/tools/', text) or re.search(r'src="/tools/', text):
            fail(f"{path.name} uses root-absolute /tools/ href or src")

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

    if not (ROOT / "assets" / "icons" / "favicon.svg").is_file():
        fail("favicon.svg missing")
    if not (ROOT / "assets" / "icons" / "favicon.ico").is_file():
        fail("favicon.ico missing (must deploy, not gitignore-only)")
    if not (ROOT / "assets" / "icons" / "apple-touch-icon.png").is_file():
        fail("apple-touch-icon.png missing (must deploy, not gitignore-only)")

    additions = (ROOT / "additions.html").read_text(encoding="utf-8")
    if 'id="another-story-sea-embed"' not in additions:
        fail("directory pages must keep sitewide Another Story embed (Alex lock)")
    if 'id="good-steward-tools-embed"' in additions:
        fail("directory pages must not embed twin Good Steward 1400px iframes")
    if 'id="good-steward-cta"' not in additions:
        fail("directory pages missing compact Good Steward CTA strip")
    if 'id="another-story-sea-embed"' not in sample:
        fail("homepage must keep sitewide Another Story embed")
    if 'id="good-steward-tools-embed"' in sample:
        fail("homepage must not embed twin Good Steward 1400px iframes")
    steward_page = (ROOT / "good-steward.html").read_text(encoding="utf-8")
    if 'id="good-steward-tools-embed"' not in steward_page:
        fail("good-steward.html must keep full tool embeds")
    if 'id="another-story-sea-embed"' not in steward_page:
        fail("good-steward.html must keep sitewide Another Story embed")

    for path in html_files:
        text = path.read_text(encoding="utf-8")
        for m in re.finditer(r'property="og:image" content="([^"]+)"', text):
            if "cloudfront.net" in m.group(1) or m.group(1).lower().endswith(".png"):
                fail(f"{path.name} og:image is CloudFront/PNG ({m.group(1)})")

    for rel in ("tools/site-visit/index.html", "tools/pm-dashboard/index.html", "tools/another-story/index.html"):
        tpath = ROOT / rel
        if not tpath.is_file():
            fail(f"{rel} missing")
        ttxt = tpath.read_text(encoding="utf-8")
        if 'rel="canonical"' not in ttxt or "og:image" not in ttxt or "application/ld+json" not in ttxt:
            fail(f"{rel} missing description/canonical/OG/JSON-LD")
        if "favicon.svg" not in ttxt:
            fail(f"{rel} missing favicon")

    story_tool = (ROOT / "tools" / "another-story" / "index.html").read_text(encoding="utf-8")
    if re.search(r'class="smallcaps">Pacific Pro Group<', story_tool):
        fail("Another Story iframe chrome still brands Pacific Pro Group as owner")
    if "Board feature" not in story_tool:
        fail("Another Story iframe chrome missing Board feature framing")

    if "site-visit.html" not in header or "pm-dashboard.html" not in header:
        fail("header Tools group must link site-visit.html and pm-dashboard.html")
    if "tools/site-visit/" in header or "tools/pm-dashboard/" in header:
        fail("header must use Board landings, not raw tools/ app URLs")

    for rel, title_bit in (
        ("site-visit.html", "Site Visit"),
        ("pm-dashboard.html", "PM"),
        ("another-story.html", "Another Story"),
        ("good-steward.html", "Good Steward"),
    ):
        landing = ROOT / rel
        if not landing.is_file():
            fail(f"{rel} missing")
        ltxt = landing.read_text(encoding="utf-8")
        if 'id="main-content"' not in ltxt or 'rel="canonical"' not in ltxt:
            fail(f"{rel} missing page_shell head/nav landmarks")
        if f"https://boardofprojectstewardship.com/{rel}" not in ltxt:
            fail(f"{rel} canonical is not the Board landing")
        if title_bit.lower() not in ltxt.lower():
            fail(f"{rel} missing expected title copy ({title_bit})")

    print(f"OK: checked {len(html_files)} HTML files; BreadcrumbList on {crumbs}")


if __name__ == "__main__":
    main()
