"""Homepage leads with the concept tool and keeps ranking copy."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "index.html"
VENDOR = re.compile(r"\b(?:BOPS|ChatGPT|Gemini|Imagen|Veo|Higgsfield|Pollinations)\b")
AI = re.compile(r"\bAI\b")
ALLOWED_AI = (
    "AI concept, not a design",
    "AI-generated concept",
)


def visible_copy(html: str) -> str:
    alts = " ".join(re.findall(r'\balt="([^"]*)"', html))
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return html_unescape(text + " " + alts)


def html_unescape(text: str) -> str:
    return (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#39;", "'")
        .replace("&quot;", '"')
    )


class HomePlanHeroTests(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")

    def test_walkthrough_cta_is_the_only_h1(self):
        """The concept tool is the only H1. The 3D walkthrough is a nav link.

        Alex: this replaces the previous assertion that the walkthrough sentence
        was the homepage H1, and it allows the disclosure phrases below while
        vendor and model names stay banned.
        """
        self.assertEqual(self.html.count("<h1"), 1)
        self.assertIn('<h1 id="see-project-title">See your addition / remodel</h1>', self.html)
        self.assertIn("See your home project before you build.", self.html)
        self.assertIn(">3D Walkthrough</a>", self.html)
        self.assertIn('href="./plan-walkthrough/"', self.html)
        self.assertNotIn("Walk through a home in 3D", self.html)
        self.assertNotIn("three.module.js", self.html)
        self.assertNotIn("plan-walkthrough.js", self.html)
        self.assertNotIn('rel="preload" as="image"', self.html)
        self.assertNotIn("fetchpriority", self.html)
        self.assertIn('data-api-base=""', self.html)
        self.assertIn("Sample — illustrative", self.html)
        self.assertIn("WA License PACIFPG765OF", self.html)
        visible = visible_copy(self.html)
        for phrase in ALLOWED_AI:
            self.assertIn(phrase, visible)
            visible = visible.replace(phrase, "")
        self.assertIsNone(AI.search(visible))
        self.assertIsNone(VENDOR.search(self.html))
        self.assertIsNone(VENDOR.search(visible))

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
