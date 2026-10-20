"""Homepage leads with the concept tool and keeps ranking copy."""
from __future__ import annotations

import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import generate_site as gs  # noqa: E402
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

    def test_removed_sections_stay_off_the_homepage(self):
        """Oct 2026: the photo visualizer, process, field gallery, learn and
        journal sections were removed from the homepage. Their pages and
        images stay. The page keeps one H1 and the word AI stays banned.
        """
        self.assertEqual(self.html.count("<h1"), 1)
        self.assertIn('<h1 class="sr-only">Board of Project Stewardship:', self.html)
        for gone in (
            'id="plan-home-hero"', "See what your home could become", "Upload my photo", "/assets/js/visualizer.js",
            "/assets/css/visualizer.css", 'id="how-the-board-works"', "How the Board works",
            'id="field-gallery"', "Standards you can see", 'id="learn"', "Planning hubs &amp; client tools",
            'id="cornerstone-reading"', "Cornerstone reading", "Photo visualizer",
        ):
            self.assertNotIn(gone, self.html)
        for anchor in ("plan-home-hero", "how-the-board-works", "field-gallery", "cornerstone-reading"):
            self.assertNotIn("#" + anchor, self.html)
        self.assertNotIn('href="#learn"', self.html)
        self.assertNotIn('href="./#learn"', self.html)
        gen = (ROOT / "generate_site.py").read_text(encoding="utf-8")
        self.assertNotIn("{plan_html}", gen)
        for f in ("assets/js/visualizer.js", "assets/css/visualizer.css"):
            self.assertTrue((ROOT / f).exists(), f)
        self.assertIn(">3D Walkthrough</a>", self.html)
        self.assertIn('href="./plan-walkthrough/"', self.html)
        self.assertNotIn("three.module.js", self.html)
        self.assertNotIn("plan-walkthrough.js", self.html)
        order = [self.html.find(x) for x in ('id="scroll-house"', 'id="bh-home"', '<section id="mission"', 'id="why-ppg-number-one"', 'id="integrity-shield"')]
        self.assertNotIn(-1, order)
        self.assertEqual(order, sorted(order))
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
        self.assertNotIn('id="build-walkthrough-home"', self.html)
        self.assertNotIn('<section id="build-walkthrough"', self.html)
        self.assertNotIn("See how a project is built", self.html)
        self.assertTrue((ROOT / "build-walkthrough.html").exists())
        self.assertTrue((ROOT / "tools/build-walkthrough/index.html").exists())
        self.assertLess(
            self.html.find('id="scroll-house"'),
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
        self.assertLess(self.html.find('id="scroll-house"'), self.html.find('id="why-ppg-number-one"'))
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
        self.assertIn('<a class="sh-btn" href="#bh-home">What can I build here?</a>', self.html)
        self.assertIn('href="./plan-walkthrough/"', self.html)
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
        self.assertLessEqual(self.html.count('fetchpriority="high"'), 1)
        visible = visible_copy(self.html)
        self.assertIsNone(AI.search(self.html))
        self.assertIsNone(AI.search(visible))
        subprocess.check_call(["node", "--check", "assets/js/scroll-house.js"], cwd=ROOT)
        subprocess.check_call(["node", "--check", "assets/js/scroll-house-magnolia.js"], cwd=ROOT)

    def test_visualizer_links_skip_index_html_and_fragments_stay_noindex(self):
        self.assertNotIn("#plan-home-hero", (ROOT / "generate_site.py").read_text(encoding="utf-8"))
        for name in (
            "additions.html",
            "adu.html",
            "bathrooms.html",
            "home-addition-planning.html",
            "kitchen-remodel-planning.html",
            "kitchen.html",
        ):
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertIn('href="./build-here.html"', text)
            self.assertNotIn("#plan-home-hero", text)
        section = (ROOT / "sections" / "scroll-house.html").read_text(encoding="utf-8")
        self.assertIn('<meta name="robots" content="noindex">', section)
        fragment, _css = gs.home_scroll_house()
        self.assertNotIn('name="robots"', fragment)
        self.assertTrue(fragment.lstrip().startswith("<section"))
        snippet = (ROOT / "tools" / "another-story" / "embed-snippet.html").read_text(encoding="utf-8")
        self.assertIn('<meta name="robots" content="noindex">', snippet)
        self.assertIn('id="another-story-sea"', snippet)
        self.assertIn('src="/tools/another-story/index.html"', snippet)
        self.assertIn("another-story:resize", snippet)
        for name in (
            "posts/2026-10-13-kitchen-remodel-issaquah-wa.html",
            "posts/2026-10-13-kitchen-remodel-issaquah-wa.md",
            "posts/2026-10-07-kitchen-remodel-kirkland-wa.html",
            "posts/2026-10-07-kitchen-remodel-kirkland-wa.md",
        ):
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertNotIn("kitchens.html", text)
            self.assertIn("kitchen.html", text)


if __name__ == "__main__":
    unittest.main()
