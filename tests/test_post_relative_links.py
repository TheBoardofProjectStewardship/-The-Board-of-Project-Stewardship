"""Relative links inside posts/*.html must resolve to files in this repo.

The More guides block used to emit href="../<slug>.html" from /posts/<slug>.html,
which resolves to /<slug>.html and 404s. Sibling posts are the bare filename.
"""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import generate_site as gs  # noqa: E402

HREF_RE = re.compile(r"""href=(["'])([^"']+)\1""", re.I)
MORE_GUIDES_RE = re.compile(
    r'More guides</p><ul class="space-y-2 text-sm text-slate-300 font-light">(.*?)</ul>',
    re.S,
)


def _html_path(href: str) -> str:
    return unquote(href.split("#", 1)[0].split("?", 1)[0].strip())


def _is_skippable(raw: str) -> bool:
    return (not raw) or raw.startswith(("http://", "https://", "mailto:", "tel:", "//", "#"))


class PostRelativeLinkTests(unittest.TestCase):
    def test_related_guides_are_sibling_post_files(self):
        posts = gs.load_posts()
        self.assertGreaterEqual(len(posts), 1)
        for post in posts:
            links = gs.related_guides_for_post(post, posts, "../")
            for _title, href in links:
                self.assertFalse(href.startswith("../"), href)
                self.assertFalse(href.startswith("/"), href)
                self.assertNotIn("/", href)
                self.assertTrue(href.endswith(".html"), href)
                self.assertNotEqual(href, post["out_name"])
                self.assertTrue((ROOT / "posts" / href).is_file(), href)

    def test_every_post_relative_html_href_resolves(self):
        pages = sorted((ROOT / "posts").glob("*.html"))
        self.assertGreaterEqual(len(pages), 1)
        failures: list[str] = []
        more_guides_pages = 0
        for path in pages:
            text = path.read_text(encoding="utf-8")
            for match in HREF_RE.finditer(text):
                raw = _html_path(match.group(2))
                if _is_skippable(raw) or not raw.endswith(".html"):
                    continue
                if raw.startswith("/"):
                    target = (ROOT / raw.lstrip("/")).resolve()
                else:
                    target = (path.parent / raw).resolve()
                try:
                    target.relative_to(ROOT.resolve())
                except ValueError:
                    failures.append(f"{path.name}: {match.group(2)} escapes the repo")
                    continue
                if not target.is_file():
                    failures.append(
                        f"{path.name}: {match.group(2)} -> missing {target.relative_to(ROOT)}"
                    )
            more = MORE_GUIDES_RE.search(text)
            if not more:
                continue
            more_guides_pages += 1
            for match in HREF_RE.finditer(more.group(1)):
                href = match.group(2)
                self.assertFalse(
                    href.startswith("../"),
                    f"{path.name} More guides link climbs out of posts/: {href}",
                )
                self.assertTrue(
                    (path.parent / _html_path(href)).is_file(),
                    f"{path.name} More guides target missing: {href}",
                )
        self.assertEqual(failures, [])
        self.assertGreaterEqual(more_guides_pages, 1)
