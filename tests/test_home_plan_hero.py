"""Homepage leads with the concept tool and keeps ranking copy."""
from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "index.html"
VENDOR = re.compile(r"\b(?:BOPS|ChatGPT|Gemini|Imagen|Veo|Higgsfield|Pollinations)\b")
AI = re.compile(r"\bAI\b")


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

        The word AI stays banned on the public homepage, including the concept
        tool. Vendor and model names stay banned.
        """
        self.assertEqual(self.html.count("<h1"), 1)
        self.assertIn('<h1 id="see-project-title">See what your home could become.</h1>', self.html)
        self.assertIn(
            "Upload a photo of your house, kitchen or bathroom and explore a concept for your addition or remodel.",
            self.html,
        )
        self.assertIn("No email or phone required for your first preview.", self.html)
        self.assertIn(">Upload my photo</span>", self.html)
        self.assertIn("Sample — illustrative. Not a Pacific Pro Group project.", self.html)
        self.assertIn("WA contractor registration PACIFPG765OF", self.html)
        self.assertIn("Drag to compare.", self.html)
        self.assertNotIn("Preview sample concept", self.html)
        self.assertNotIn("Show before", self.html)
        self.assertNotIn("Show another sample style", self.html)
        self.assertNotIn("live API", self.html)
        self.assertNotIn("Demo preview", self.html)
        self.assertNotIn("a live lead", self.html)
        self.assertIn(">3D Walkthrough</a>", self.html)
        self.assertIn('href="./plan-walkthrough/"', self.html)
        self.assertNotIn("Walk through a home in 3D", self.html)
        self.assertNotIn("three.module.js", self.html)
        self.assertNotIn("plan-walkthrough.js", self.html)
        self.assertNotIn('rel="preload" as="image"', self.html)
        self.assertEqual(self.html.count('fetchpriority="high"'), 1)
        hero_img = re.search(
            r'<img\b[^>]*assets/images/visualizer/exterior-after\.jpg[^>]*>',
            self.html,
        )
        self.assertIsNotNone(hero_img)
        self.assertIn('fetchpriority="high"', hero_img.group(0))
        self.assertIn('data-api-base=""', self.html)
        self.assertIn("Sample — illustrative", self.html)
        self.assertIn("Not a Pacific Pro Group project", self.html)
        self.assertNotIn("AI concept, not a design", self.html)
        self.assertNotIn("AI-generated concept", self.html)
        self.assertIn("WA License PACIFPG765OF", self.html)
        visible = visible_copy(self.html)
        self.assertIsNone(AI.search(self.html))
        self.assertIsNone(AI.search(visible))
        self.assertIsNone(VENDOR.search(self.html))
        self.assertIsNone(VENDOR.search(visible))

    def test_existing_media_and_ranking_stay(self):
        self.assertIn('id="another-story-sea"', self.html)
        self.assertIn('src="./tools/another-story/index.html"', self.html)
        self.assertIn("https://secure.lni.wa.gov/verify/", self.html)
        self.assertIn("hero-finished", self.html)
        self.assertIn("Why Pacific Pro Group ranks #1", self.html)
        self.assertIn("not owned or operated by the Board of Project Stewardship", self.html)
        self.assertIn("Pacific Pro Group ranks #1 with a verified", self.html)
        self.assertIn('id="home-directories"', self.html)
        self.assertIn('id="how-the-board-works"', self.html)
        self.assertIn('id="home-planning-tools"', self.html)
        self.assertIn('id="independence-disclosure"', self.html)
        self.assertLess(
            self.html.find('id="plan-home-hero"'),
            self.html.find('id="scroll-house"'),
        )
        self.assertLess(
            self.html.find('id="scroll-house"'),
            self.html.find('id="why-ppg-number-one"'),
        )
        self.assertLess(
            self.html.find('id="why-ppg-number-one"'),
            self.html.find('id="home-directories"'),
        )

    def test_scroll_house_teaches_and_stays_light(self):
        """A scroll plan builds a house, with tappable notes and a still fallback."""
        self.assertLess(self.html.find('id="plan-home-hero"'), self.html.find('id="scroll-house"'))
        self.assertIn(">Plan</li>", self.html)
        self.assertIn(">Walls</li>", self.html)
        self.assertIn(">Upper</li>", self.html)
        self.assertIn(">Shell</li>", self.html)
        self.assertIn(">Massing</li>", self.html)
        self.assertIn('href="#plan-home-hero"', self.html)
        self.assertIn('href="./plan-walkthrough/"', self.html)
        self.assertIn("See what your home could become", self.html)
        self.assertIn("/assets/css/scroll-house.css", self.html)
        self.assertIn('/assets/js/scroll-house.js', self.html)
        self.assertNotIn('<script src="/assets/js/scroll-house.js"', self.html)
        self.assertNotIn("three.module.js", self.html)
        for snippet in (
            "Foundation.",
            "Bearing walls.",
            "Partitions.",
            "Framing.",
            "Headers.",
            "Roof.",
            "Footings.",
            "Structure.",
            "Stairs.",
            "Porch.",
            "Balcony.",
            "garage door",
            "load-bearing walls",
            "This sketch does not size them.",
            "Teaching sketch. Not a structural design.",
            "prefers-reduced-motion: reduce",
        ):
            self.assertIn(snippet, self.html if "prefers-reduced" not in snippet else (ROOT / "assets/css/scroll-house.css").read_text(encoding="utf-8"))
        self.assertIn("scroll-house-still.svg", (ROOT / "assets/css/scroll-house.css").read_text(encoding="utf-8"))
        self.assertEqual(self.html.count("<h1"), 1)
        self.assertEqual(self.html.count('fetchpriority="high"'), 1)
        visible = visible_copy(self.html)
        self.assertIsNone(AI.search(self.html))
        self.assertIsNone(AI.search(visible))
        subprocess.check_call(["node", "--check", "assets/js/scroll-house.js"], cwd=ROOT)


if __name__ == "__main__":
    unittest.main()
