#!/usr/bin/env python3
"""The illustrated house guide stays original, accurate in structure, and indexable."""
import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN = re.compile(r"\b(?:BOPS|ChatGPT|Gemini|Imagen|Veo|Higgsfield|Pollinations)\b|\bAI\b")
STEPS = [
    "Survey and soils",
    "Stake the corners",
    "Clear and protect",
    "Excavate",
    "Footings",
    "Foundation walls",
    "Dampproof and drain",
    "Under-slab work and the slab",
    "Sill and first floor",
    "Backfill and rough grade",
    "First-floor walls",
    "Second floor and walls",
    "Roof framing",
    "Dry in",
    "Rough-in",
    "Insulate and air-seal",
    "Siding and trim",
    "Drywall and finishes",
    "Final grade and landscape",
]
COLLECTION = [
    "cut-and-fill/",
    "sequence/",
    "building-systems/",
    "load-path/",
    "columns/",
    "beams/",
    "trusses/",
    "lateral-stability/",
    "arches-and-vaults/",
    "foundation-types/",
    "excavation/",
    "spread-footings/",
    "masonry-bonding/",
    "platform-framing/",
    "roof-framing/",
    "truss-connections/",
    "trussed-rafters/",
    "wall-assembly/",
    "stairs/",
    "heating-and-cooling/",
    "plumbing/",
    "electrical/",
]


class LearnPagesTests(unittest.TestCase):
    def test_landing_links_the_whole_map(self):
        html = (ROOT / "learn" / "index.html").read_text(encoding="utf-8")
        self.assertIn("<h1>How a house is built</h1>", html)
        self.assertIn('rel="canonical" href="https://boardofprojectstewardship.com/learn/"', html)
        self.assertIn("Coming soon", html)
        self.assertIn("Teaching sketch", html)
        self.assertIsNone(FORBIDDEN.search(html))
        title = re.search(r"<title>(.*?)</title>", html).group(1)
        self.assertLessEqual(len(title), 60)
        for name in ("Design", "Site and ground", "Structure", "Envelope", "Building physics", "Services", "Interiors", "Construction", "Remodeling existing homes", "PNW regional construction"):
            self.assertIn(name, html)
        for href in COLLECTION:
            self.assertIn(f'href="{href}"', html)
        for step in STEPS:
            self.assertIn(step, html)

    def test_sequence_is_a_real_howto(self):
        html = (ROOT / "learn" / "sequence" / "index.html").read_text(encoding="utf-8")
        self.assertEqual(html.count('"@type": "HowToStep"'), 19)
        self.assertIn("HowTo", html)
        self.assertIn("dateModified", html)
        days = set(re.findall(r'"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"', html))
        self.assertEqual(days, {"2026-10-14"})
        for step in STEPS:
            self.assertIn(step, html)
        self.assertIn("scroll-house.js", html)
        self.assertNotIn("three.module.js", html)
        self.assertIsNone(FORBIDDEN.search(html))

    def test_explore_compare_and_load_path(self):
        explore = (ROOT / "learn" / "explore" / "index.html").read_text(encoding="utf-8")
        compare = (ROOT / "learn" / "compare" / "index.html").read_text(encoding="utf-8")
        load = (ROOT / "learn" / "load-path" / "index.html").read_text(encoding="utf-8")
        self.assertIn("data-learn-view=\"explore\"", explore)
        self.assertIn("Follow the load path", explore)
        self.assertGreaterEqual(compare.count("<h2>"), 12)
        self.assertIn("Coming soon", compare)
        self.assertIn("not a structural design", load.lower())
        self.assertIn("../lateral-stability/", load)
        for page in (explore, compare, load):
            self.assertIn('id="main-content"', page)
            self.assertIsNone(FORBIDDEN.search(page))
            title = re.search(r"<title>(.*?)</title>", page).group(1)
            self.assertLessEqual(len(title), 60)

    def test_homepage_and_sitemap_point_here(self):
        home = (ROOT / "index.html").read_text(encoding="utf-8")
        section = (ROOT / "sections" / "scroll-house.html").read_text(encoding="utf-8")
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn('href="./learn/"', home)
        self.assertIn('href="./learn/"', section)
        self.assertIn("https://boardofprojectstewardship.com/learn/", sitemap)
        self.assertIn("https://boardofprojectstewardship.com/learn/load-path/", sitemap)
        self.assertIn("https://boardofprojectstewardship.com/learn.html", sitemap)
        index = json.loads((ROOT / "search-index.json").read_text(encoding="utf-8"))
        urls = {item["url"] for item in index}
        self.assertIn("/learn/", urls)
        self.assertIn("/learn/sequence/", urls)
        self.assertIn("/learn/electrical/", urls)

    def test_scripts_parse(self):
        subprocess.check_call(["node", "--check", "assets/js/learn-house.js"], cwd=ROOT)
        subprocess.check_call(["node", "--check", "assets/js/scroll-house.js"], cwd=ROOT)


if __name__ == "__main__":
    unittest.main()
