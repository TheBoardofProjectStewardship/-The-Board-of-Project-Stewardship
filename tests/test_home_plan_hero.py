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
        self.assertIn("board-sketch-to-home", self.html)
        self.assertIn("hero-finished", self.html)
        self.assertIn("hero-wireframe", self.html)
        self.assertIn('class="flashlight-hero is-supporting"', self.html)
        self.assertIn("<h2 id=\"home-hero-title\">Remodel directories and permit guides</h2>", self.html)
        self.assertIn('class="hero-play-slot"', self.html)
        self.assertIn(".flashlight-hero.is-supporting .hero-play-slot", self.html)
        self.assertIn("margin-top: auto", self.html)
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

    def test_scroll_house_teaches_and_stays_light(self):
        """The Magnolia scroll house leads the page, with tappable notes and a still fallback.

        Stage buttons keep the model stages and show the Magnolia labels.
        The drawing script loads on view, not as a blocking tag, and the
        page still has one H1 and one high-priority image.
        """
        self.assertLess(self.html.find('id="scroll-house"'), self.html.find('id="plan-home-hero"'))
        stages = (
            ("house", "House", "0.04", True),
            ("front", "Front", "0.22", False),
            ("roof", "Roof", "0.38", False),
            ("upper", "Main", "0.56", False),
            ("plan", "ADU", "0.74", False),
            ("foundation", "Slab", "0.93", False),
        )
        for stage, label, progress, current in stages:
            current_attr = ' aria-current="step"' if current else ""
            button = (
                f'<button type="button" data-stage="{stage}" '
                f'data-sh-progress="{progress}"{current_attr}>{label}</button>'
            )
            self.assertIn(button, self.html)
            item = (
                f'<li class="is-on" data-stage="{stage}">'
                if current
                else f'<li data-stage="{stage}">'
            )
            self.assertIn(item + button, self.html)
        self.assertNotIn(">Upper</button>", self.html)
        self.assertNotIn(">Plan</button>", self.html)
        self.assertIn('href="#plan-home-hero"', self.html)
        self.assertIn('href="./plan-walkthrough/"', self.html)
        self.assertIn("See what your home could become", self.html)
        self.assertIn("/assets/css/scroll-house.css", self.html)
        self.assertIn('s.src = "/assets/js/scroll-house-magnolia.js?v=9"', self.html)
        self.assertNotIn("/assets/js/scroll-house.js", self.html)
        self.assertNotIn('<script src="/assets/js/scroll-house-magnolia.js"', self.html)
        self.assertNotIn("three.module.js", self.html)
        for snippet in (
            "Foundation.",
            "Partitions.",
            "Framing.",
            "Headers.",
            "Roof.",
            "Footings.",
            "Structure.",
            "Stairs.",
            "Porch.",
            "Deck.",
            "ADU.",
            "The existing deck runs along the main level on the downhill side",
            "The new 865 SF accessory dwelling unit",
            "The tall windows and doors on the deck side take studs out of the wall.",
            "This sketch does not size them.",
            "Teaching sketch. Not a structural design.",
            "prefers-reduced-motion: reduce",
        ):
            self.assertIn(snippet, self.html if "prefers-reduced" not in snippet else (ROOT / "assets/css/scroll-house.css").read_text(encoding="utf-8"))
        css = (ROOT / "assets/css/scroll-house.css").read_text(encoding="utf-8")
        self.assertIn("scroll-house-still.svg", css)
        self.assertNotIn("home-stamp", self.html)
        self.assertNotIn("stamp-of-trust-seal", self.html)
        self.assertIn('class="stamp-badge"', self.html)
        self.assertEqual(self.html.count("<h1"), 1)
        self.assertEqual(self.html.count('fetchpriority="high"'), 1)
        visible = visible_copy(self.html)
        self.assertIsNone(AI.search(self.html))
        self.assertIsNone(AI.search(visible))
        subprocess.check_call(["node", "--check", "assets/js/scroll-house.js"], cwd=ROOT)
        subprocess.check_call(["node", "--check", "assets/js/scroll-house-magnolia.js"], cwd=ROOT)


if __name__ == "__main__":
    unittest.main()
