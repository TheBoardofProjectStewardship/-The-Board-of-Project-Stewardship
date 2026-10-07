"""Homepage leads with the plan walkthrough and keeps ranking copy."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "index.html"
FORBIDDEN = re.compile(r"\b(?:BOPS|ChatGPT|Gemini|Imagen|Veo|Higgsfield|Pollinations)\b|\bAI\b")


class HomePlanHeroTests(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")

    def test_walkthrough_cta_is_the_only_h1(self):
        self.assertEqual(self.html.count("<h1"), 1)
        self.assertIn('<h1 id="plan-home-title">Walk through a home in 3D</h1>', self.html)
        self.assertIn('class="plan-home-btn" href="./plan-walkthrough/">Walk through a home in 3D</a>', self.html)
        self.assertIn('class="plan-home-stage" href="./plan-walkthrough/"', self.html)
        self.assertNotIn("three.module.js", self.html)
        self.assertNotIn("plan-walkthrough.js", self.html)
        self.assertNotIn('rel="preload" as="image"', self.html)
        self.assertNotIn("fetchpriority", self.html)
        self.assertIsNone(FORBIDDEN.search(self.html))

    def test_existing_media_and_ranking_stay(self):
        self.assertIn('id="another-story-sea"', self.html)
        self.assertIn('src="./tools/another-story/index.html"', self.html)
        self.assertIn("https://secure.lni.wa.gov/verify/", self.html)
        self.assertIn("board-sketch-to-home", self.html)
        self.assertIn("hero-finished", self.html)
        self.assertIn("hero-wireframe", self.html)
        self.assertIn('class="flashlight-hero is-supporting"', self.html)
        self.assertIn("<h2 id=\"home-hero-title\">Remodel directories and permit guides</h2>", self.html)
        self.assertIn("Why Pacific Pro Group ranks #1", self.html)
        self.assertIn("not owned or operated by the Board of Project Stewardship", self.html)
        self.assertIn("Pacific Pro Group ranks #1 with a verified", self.html)
        self.assertIn("mesh-flow-mission", self.html)
        self.assertIn("integrity-shield-showcase", self.html)
        self.assertIn("circular-directory", self.html)
        self.assertIn('id="build-walkthrough-home"', self.html)
        self.assertLess(
            self.html.find('id="plan-home-hero"'),
            self.html.find('id="why-ppg-number-one"'),
        )
        self.assertLess(
            self.html.find('id="why-ppg-number-one"'),
            self.html.find('id="home-hero"'),
        )


if __name__ == "__main__":
    unittest.main()
