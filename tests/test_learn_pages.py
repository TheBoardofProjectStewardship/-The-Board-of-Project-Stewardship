#!/usr/bin/env python3
"""The illustrated house guide stays original, accurate in structure, and indexable."""
import html as html_lib
import json
import posixpath
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN = re.compile(r"\b(?:BOPS|ChatGPT|Gemini|Imagen|Veo|Higgsfield|Pollinations)\b|\bAI\b")
STEPS = [
    "What the survey has to settle",
    "Corners that survive the dig",
    "Trees and topsoil",
    "The hole for a slab house",
    "Concrete that spreads the walls",
    "Drains the slab will bury",
    "The floor you walk on",
    "Water at the outside of the concrete",
    "Soil back, sloping away",
    "The first story of studs",
    "The bedroom floor and the stair hole",
    "Gable, hip, and the lower roofs",
    "Brace it before it is covered",
    "A roof that sheds",
    "Open walls for the trades",
    "The energy check",
    "The rain coat",
    "Rooms you can live in",
    "Gutters and the final walk",
]
CATEGORIES = [
    "Understanding the site",
    "Following loads",
    "Keeping rain out",
    "Coordinating services",
    "Changing an existing home",
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
        self.assertIn('class="site-seal"', html)
        self.assertIn('class="site-footer-seal"', html)
        self.assertIn('alt="The Board of Project Stewardship seal"', html)
        self.assertIn('rel="canonical" href="https://boardofprojectstewardship.com/learn/"', html)
        self.assertIn("Coming soon", html)
        self.assertIn("Teaching sketch", html)
        self.assertIsNone(FORBIDDEN.search(html))
        title = re.search(r"<title>(.*?)</title>", html).group(1)
        self.assertLessEqual(len(title), 60)
        for name in CATEGORIES:
            self.assertIn(name, html)
        for gone in ("Site and ground", "Building physics", "PNW regional construction", "Remodeling existing homes"):
            self.assertNotIn(gone, html)
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
        self.assertIn("pan-y pinch-zoom", (ROOT / "assets/css/learn.css").read_text(encoding="utf-8"))
        self.assertNotIn("touch-action: none", (ROOT / "assets/css/learn.css").read_text(encoding="utf-8"))
        self.assertNotIn("touch-action: none", (ROOT / "assets/css/scroll-house.css").read_text(encoding="utf-8"))
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
        script = r"""
const api = require("./assets/js/learn-house.js");
const assert = require("assert");
assert.strictEqual(api.gestureMode("touch", 2, 1, false), "pending");
assert.strictEqual(api.gestureMode("touch", 24, 6, false), "orbit");
assert.strictEqual(api.gestureMode("touch", 4, 22, false), "scroll");
assert.strictEqual(api.gestureMode("touch", 4, 22, true), "orbit");
assert.strictEqual(api.gestureMode("mouse", 0, 0, false), "orbit");
assert.strictEqual(api.clampIndex(3.9, 5), 3);
assert.strictEqual(api.clampIndex(-2, 5), 0);
assert.strictEqual(api.clampIndex(NaN, 5), 0);
assert.strictEqual(api.clampIndex(9, 5), 4);
assert.strictEqual(api.stepFromQuery("2", 19), 1);
assert.strictEqual(api.stepFromQuery("2.5", 19), null);
assert.strictEqual(api.stepFromQuery("0", 19), null);
assert.strictEqual(api.stepFromQuery("20", 19), null);
assert.strictEqual(api.stepFromQuery("nope", 19), null);
assert.strictEqual(api.clampPitch(2), api.PITCH_MAX);
assert.strictEqual(api.clampPitch(-2), api.PITCH_MIN);
assert.strictEqual(api.shouldPaintStep(3, 3), false);
assert.strictEqual(api.shouldPaintStep(2, 3), true);
"""
        subprocess.check_call(["node", "-e", script], cwd=ROOT)

    def test_copy_and_viewer_loading(self):
        electrical = (ROOT / "learn" / "electrical" / "index.html").read_text(encoding="utf-8")
        wall = (ROOT / "learn" / "wall-assembly" / "index.html").read_text(encoding="utf-8")
        compare = (ROOT / "learn" / "compare" / "index.html").read_text(encoding="utf-8")
        roof = (ROOT / "learn" / "roof-framing" / "index.html").read_text(encoding="utf-8")
        dig = (ROOT / "learn" / "excavation" / "index.html").read_text(encoding="utf-8")
        explore = (ROOT / "learn" / "explore" / "index.html").read_text(encoding="utf-8")
        self.assertIn("At the service disconnect, the neutral is bonded to the grounding system.", electrical)
        self.assertIn("Downstream panels keep neutral conductors isolated from equipment grounds.", electrical)
        self.assertIn("The barrier and its flashings form the drainage plane.", wall)
        self.assertIn("Direct-applied siding still relies on a properly integrated water-resistive barrier and flashing behind it.", compare)
        self.assertIn("Electric tankless units do not need a combustion vent.", compare)
        self.assertIn("In a conventional tied-rafter roof, a rafter tie or suitably connected ceiling joist", roof)
        self.assertIn("a competent person evaluates the soil", dig)
        self.assertIn('href="../load-path/"', explore)
        self.assertNotIn("scroll-house.js", compare)
        self.assertIn("scroll-house.js", electrical)
        self.assertIn('aria-live="polite"', explore)
        self.assertIn("Reset view", explore)

    def test_generated_pages_resolve(self):
        import sys
        import tempfile
        from html.parser import HTMLParser
        sys.path.insert(0, str(ROOT / "tools"))
        import build_learn

        class Collector(HTMLParser):
            def __init__(self):
                super().__init__()
                self.hrefs = []
                self.ids = set()
                self.canonical = []
                self.jsonld = []
                self._json = False
                self._buf = []
            def handle_starttag(self, tag, attrs):
                attr = dict(attrs)
                if tag == "a" and "href" in attr:
                    self.hrefs.append(attr["href"])
                if "id" in attr:
                    self.ids.add(attr["id"])
                if tag == "link" and attr.get("rel") == "canonical":
                    self.canonical.append(attr.get("href", ""))
                if tag == "script" and attr.get("type") == "application/ld+json":
                    self._json = True
                    self._buf = []
            def handle_endtag(self, tag):
                if tag == "script" and self._json:
                    self.jsonld.append("".join(self._buf))
                    self._json = False
            def handle_data(self, data):
                if self._json:
                    self._buf.append(data)

        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp)
            pages = build_learn.write_pages(dest, update_indexes=False)
            files = {}
            for url, _name, desc in pages:
                text = (dest / url / "index.html").read_text(encoding="utf-8")
                self.assertIsNone(FORBIDDEN.search(text))
                self.assertLessEqual(len(re.search(r"<title>(.*?)</title>", text).group(1)), 60)
                self.assertEqual(text.count('rel="canonical"'), 1)
                self.assertIn('class="site-seal"', text)
                self.assertIn('class="site-footer-seal"', text)
                self.assertGreaterEqual(text.count('alt="The Board of Project Stewardship seal"'), 2)
                meta = re.search(r'<meta name="description" content="([^"]*)"', text)
                self.assertIsNotNone(meta)
                self.assertEqual(html_lib.unescape(meta.group(1)), desc)
                parsed = Collector()
                parsed.feed(text)
                self.assertEqual(len(parsed.canonical), 1)
                self.assertTrue(parsed.jsonld)
                dated = 0
                for block in parsed.jsonld:
                    data = json.loads(block)
                    if data.get("@type") in {"WebPage", "Article", "HowTo", "CollectionPage"}:
                        dated += 1
                        self.assertEqual(data.get("datePublished"), "2026-10-14")
                        self.assertEqual(data.get("dateModified"), "2026-10-14")
                self.assertGreaterEqual(dated, 1)
                files[url] = parsed
            locs = []
            for url, _name, _desc in pages:
                locs.append(build_learn.ORIGIN + "/" + url)
            self.assertEqual(len(locs), len(set(locs)))
            for url, parsed in files.items():
                for href in parsed.hrefs:
                    if href.startswith(("mailto:", "http://", "https://", "tel:")):
                        if href.startswith(build_learn.ORIGIN):
                            target = href[len(build_learn.ORIGIN):]
                        else:
                            continue
                    else:
                        target = href
                    path, _, fragment = target.partition("#")
                    if path.startswith("/"):
                        folder = path.lstrip("/")
                    elif path:
                        folder = posixpath.normpath(posixpath.join(url, path))
                    else:
                        folder = url
                    if folder.endswith("index.html"):
                        folder = folder[: -len("index.html")]
                    if folder and not folder.endswith("/") and "." not in posixpath.basename(folder):
                        folder += "/"
                    if folder.startswith("learn/"):
                        self.assertIn(folder, files, href)
                        if fragment:
                            self.assertIn(fragment, files[folder].ids, href)
                    else:
                        page = ROOT / folder if folder.endswith(".html") else ROOT / folder / "index.html"
                        self.assertTrue(page.exists(), href)
                    if fragment and not folder.startswith("learn/"):
                        page = ROOT / folder / "index.html" if not folder.endswith(".html") else ROOT / folder
                        if page.exists():
                            self.assertIn(f'id="{fragment}"', page.read_text(encoding="utf-8"), href)


if __name__ == "__main__":
    unittest.main()
