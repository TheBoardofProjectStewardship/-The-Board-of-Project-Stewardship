"""Chrome-free iframe embed of the homepage 3D Magnolia model."""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import generate_site as gs  # noqa: E402

EMBED = ROOT / "embed" / "magnolia-house.html"
SNIPPET = ROOT / "embed" / "magnolia-house-snippet.txt"


class MagnoliaEmbedTests(unittest.TestCase):
    def setUp(self):
        self.html = EMBED.read_text(encoding="utf-8")

    def test_published_page_matches_generator(self):
        self.assertEqual(self.html, gs.magnolia_embed_html())

    def test_only_the_model_no_site_chrome(self):
        self.assertIn('id="scroll-house" data-sh-embed="1"', self.html)
        self.assertIn("scroll-house-magnolia.js", self.html)
        self.assertIn("/assets/css/scroll-house.css", self.html)
        for chrome in ("site.css", "<header", "<footer", "<nav", "main-nav"):
            self.assertNotIn(chrome, self.html)
        self.assertIn('<meta name="robots" content="noindex">', self.html)
        self.assertEqual(self.html.count("<h1"), 1)
        self.assertIn('name="viewport"', self.html)
        self.assertIn("background: #0c0c0c", self.html)
        self.assertNotIn("Scroll peels", self.html)
        self.assertNotIn("\u2014", self.html)
        self.assertIsNone(re.search(r"\bAI\b", self.html))

    def test_nothing_blocks_framing(self):
        for blocker in ("X-Frame-Options", "frame-ancestors", "top.location", "window.top !=="):
            self.assertNotIn(blocker, self.html)
        self.assertFalse((ROOT / "_headers").exists())

    def test_links_leave_the_frame_and_are_absolute(self):
        self.assertIn('<base href="https://boardofprojectstewardship.com/" target="_blank">', self.html)
        for href in re.findall(r'<a\b[^>]*\shref="([^"]+)"', self.html):
            self.assertTrue(href.startswith("https://boardofprojectstewardship.com/"), href)

    def test_flow_mode_without_page_scroll(self):
        js = (ROOT / "assets/js/scroll-house-magnolia.js").read_text(encoding="utf-8")
        self.assertIn('root.hasAttribute("data-sh-embed") ? false : contentFits()', js)
        self.assertIn("bops-magnolia:resize", self.html)
        self.assertIn('getElementById("main-content")', self.html)
        self.assertIn("clamp(320px, 58vw, 640px)", self.html)

    def test_snippet(self):
        s = SNIPPET.read_text(encoding="utf-8")
        self.assertIn('src="https://boardofprojectstewardship.com/embed/magnolia-house.html"', s)
        self.assertIn('href="https://boardofprojectstewardship.com/projects/magnolia-house-adu-garage/"', s)
        self.assertIn('var ORIGIN = "https://boardofprojectstewardship.com"', s)
        self.assertIn("e.origin !== ORIGIN", s)
        self.assertIn('title="3D model: Magnolia house, ADU and garage"', s)
        self.assertIn("width:100%", s)
        self.assertIn("e.source !== f.contentWindow", s)
        self.assertIn("bops-magnolia:ping", s)
        self.assertIn("bops-magnolia:ping", self.html)
        self.assertNotIn("robots", s)
        self.assertTrue((ROOT / "projects/magnolia-house-adu-garage/index.html").exists())


if __name__ == "__main__":
    unittest.main()
