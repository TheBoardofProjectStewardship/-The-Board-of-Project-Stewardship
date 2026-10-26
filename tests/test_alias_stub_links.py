"""Published posts and root pages must not link alias redirect stubs.

kitchens.html, plumbing.html, and directories.html are noindex meta-refresh
aliases. Daily posts should link the real hubs (kitchen.html, plumber.html,
directory.html). The stub files themselves stay in place and are not scanned.
"""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import generate_site as gs  # noqa: E402

ALIAS_STUBS = frozenset({"kitchens.html", "plumbing.html", "directories.html"})
HREF_RE = re.compile(r"""href=(["'])([^"']+)\1""", re.I)
MD_LINK_RE = re.compile(r"""\[[^\]]*\]\(([^)\s]+)\)""")
BOARD_HOSTS = frozenset({"boardofprojectstewardship.com", "www.boardofprojectstewardship.com"})


def _html_path(href: str) -> str:
    return unquote(href.split("#", 1)[0].split("?", 1)[0].strip())


def _alias_target(page: Path, href: str) -> str | None:
    raw = _html_path(href)
    if not raw or raw.startswith(("mailto:", "tel:", "javascript:", "#")):
        return None
    if raw.startswith("//"):
        raw = "https:" + raw
    if raw.startswith(("http://", "https://")):
        parsed = urlparse(raw)
        if parsed.netloc.lower() not in BOARD_HOSTS:
            return None
        target = (ROOT / parsed.path.lstrip("/")).resolve()
    elif raw.startswith("/"):
        target = (ROOT / raw.lstrip("/")).resolve()
    else:
        target = (page.parent / raw).resolve()
    try:
        rel = target.relative_to(ROOT.resolve())
    except ValueError:
        return None
    if rel.as_posix() in ALIAS_STUBS:
        return rel.as_posix()
    return None


class AliasStubLinkTests(unittest.TestCase):
    def test_published_posts_and_root_pages_skip_alias_stubs(self):
        pages = sorted(ROOT.glob("*.html")) + sorted((ROOT / "posts").glob("*.html"))
        markdown = sorted((ROOT / "posts").glob("*.md"))
        self.assertGreaterEqual(len(pages), 1)
        self.assertGreaterEqual(len(markdown), 1)
        for name in ALIAS_STUBS:
            stub = ROOT / name
            self.assertTrue(stub.is_file(), name)
            text = stub.read_text(encoding="utf-8")
            self.assertIn('http-equiv="refresh"', text)
            self.assertIn("noindex, follow", text)

        failures: list[str] = []
        checked = 0
        for path in pages:
            if path.parent == ROOT and path.name in ALIAS_STUBS:
                continue
            checked += 1
            text = path.read_text(encoding="utf-8")
            for match in HREF_RE.finditer(text):
                alias = _alias_target(path, match.group(2))
                if alias:
                    failures.append(f"{path.relative_to(ROOT)}: href links {alias} ({match.group(2)})")
        for path in markdown:
            checked += 1
            text = path.read_text(encoding="utf-8")
            for match in MD_LINK_RE.finditer(text):
                alias = _alias_target(path, match.group(1))
                if alias:
                    failures.append(f"{path.relative_to(ROOT)}: markdown link to {alias} ({match.group(1)})")
        self.assertGreater(checked, len(ALIAS_STUBS))
        self.assertEqual(failures, [])

    def test_not_found_page_omits_canonical(self):
        for label, html in (
            ("404.html", (ROOT / "404.html").read_text(encoding="utf-8")),
            ("build_404_page()", gs.build_404_page()),
        ):
            self.assertIn('content="noindex, follow"', html, label)
            self.assertNotIn('rel="canonical"', html, label)
            self.assertNotIn('property="og:url"', html, label)


if __name__ == "__main__":
    unittest.main()
