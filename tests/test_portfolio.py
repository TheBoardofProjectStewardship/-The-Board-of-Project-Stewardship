"""Portfolio grid and per-project 3D model pages (shared house model engine)."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import portfolio_site as ps  # noqa: E402

ENGINE = ROOT / "assets/js/house-model.js"
MAGNOLIA = ROOT / "assets/js/house-model-magnolia.js"
CSS = ROOT / "assets/css/house-model.css"


class PortfolioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.projects = ps.load_projects()
        cls.pages = ps.pages()

    def test_published_pages_match_generator(self):
        for rel, text in self.pages.items():
            self.assertEqual((ROOT / rel).read_text(encoding="utf-8"), text, rel)

    def test_grid_lists_every_project_magnolia_first(self):
        grid = self.pages["portfolio/index.html"]
        hrefs = re.findall(r'<a href="/portfolio/([^"/]+)/" class="block', grid)
        self.assertEqual(hrefs, [p["slug"] for p in self.projects])
        self.assertEqual(hrefs[0], "magnolia")
        self.assertIn("one-story-house-shop", hrefs)
        self.assertEqual(grid.count('class="portfolio-card'), len(self.projects))
        for p in self.projects:
            self.assertTrue((ROOT / p["thumb"].lstrip("/")).is_file(), p["thumb"])
        self.assertIn('<link rel="canonical" href="https://boardofprojectstewardship.com/portfolio/">', grid)

    def test_model_pages_use_shared_engine(self):
        for p in self.projects:
            html = self.pages[f"portfolio/{p['slug']}/index.html"]
            self.assertIn('/assets/js/house-model.js', html)
            self.assertIn('/assets/css/house-model.css', html)
            self.assertIn(f'data-ppgm-project="{p["slug"]}"', html)
            self.assertEqual(html.count('class="ppgm-step-number"'), 6)
            self.assertEqual(html.count("<h1"), 1)
            for ctl in ("ppgm-scrub", "ppgm-room-select", 'data-ppgm-view="plan"', 'data-ppgm-view="perspective"', 'data-ppgm-zoom="in"'):
                self.assertIn(ctl, html)
            if p["engine"] == "magnolia":
                self.assertIn("/assets/js/house-model-magnolia.js", html)
                self.assertLess(html.index("house-model-magnolia.js"), html.index('src="/assets/js/house-model.js"'))
            else:
                cfg = json.loads(re.search(r'<script type="application/json" class="ppgm-config">(.*?)</script>', html, re.S).group(1))
                self.assertEqual(cfg, ps.load_config(p))

    def test_house_config_is_plan_data(self):
        cfg = ps.load_config(next(p for p in self.projects if p["engine"] == "config"))
        names = {r["name"] for r in cfg["rooms"]}
        for room in ("Primary Bedroom", "Bedroom A", "Bedroom B", "Kitchen", "Living Room + Dining Room", "Garage", "Shop", "Den", "Laundry", "Pantry", "Hallway"):
            self.assertIn(room, names)
        self.assertEqual(cfg["totalSqft"], 6720)
        area = {r["name"]: r["area"] for r in cfg["rooms"]}
        self.assertEqual(area["Garage"], 2511)
        self.assertEqual(area["Living Room + Dining Room"], 506)
        self.assertEqual(next(r for r in cfg["rooms"] if r["name"] == "Living Room + Dining Room")["ch"], 14)
        self.assertGreater(len(cfg["walls"]), 100)
        kinds = {o["kind"] for o in cfg["openings"]}
        self.assertTrue({"W", "D", "G", "bay"} <= kinds)
        self.assertEqual([s["id"] for s in cfg["stages"]], list(ps.STAGE_PROGRESS))

    def test_copy_rules(self):
        # Our content only: the shared site chrome (nav, footer, the sitewide Another Story card) is out of scope.
        def own(page):
            body = page.split('<main id="main-content">', 1)[1]
            return body.split('Board feature', 1)[0]
        files = [own(t) for t in self.pages.values()] + [f.read_text(encoding="utf-8") for f in (ENGINE, MAGNOLIA, CSS, ps.DATA / "projects.json")]
        files += [(ps.DATA / p["config"]).read_text(encoding="utf-8") for p in self.projects if p.get("config")]
        for text in files:
            self.assertNotIn("\u2014", text)
            self.assertIsNone(re.search(r"\bAI\b", text))
        for text in self.pages.values():
            self.assertIsNone(re.search(r"\bAI\b", text))
            words = {hashlib.sha256(w.encode()).hexdigest() for w in re.findall(r"[a-z]+", text.lower())}
            self.assertNotIn("647416db44109913416c6018f221224f8d7ecc370923031579ecb0a4f6dce8ae", words)  # private client surname, stored only as a hash

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_engine_builds_each_project(self):
        script = f"""
const H=require({json.dumps(str(ENGINE))});
globalThis.HouseModelProjects={{}};require({json.dumps(str(MAGNOLIA))});
H.register('magnolia',HouseModelProjects.magnolia);H.useProfile('magnolia');
const a=H.buildModel();
const cfg=require({json.dumps(str(ps.DATA / 'one-story-house-shop-garage.json'))});
H.register('house',cfg);H.useProfile('house');
const b=H.buildModel();
const s=[0.04,0.38,0.56,0.74,0.93].map(p=>H.groupState('upper',p).cut);
console.log(JSON.stringify({{a:a.groups.length,b:b.groups.map(g=>g.id),tris:b.groups.reduce((n,g)=>n+g.solid.length/33,0),rooms:b.rooms.length,cuts:s}}));
"""
        out = json.loads(subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True).stdout)
        self.assertGreater(out["a"], 5)
        self.assertEqual(out["b"], ["site", "upperfloor", "upper", "finish", "fixtures", "roof"])
        self.assertGreater(out["tris"], 2000)
        self.assertGreater(out["rooms"], 40)
        cuts = out["cuts"]
        self.assertEqual(cuts[0], 100)
        self.assertTrue(cuts[1] >= cuts[2] > cuts[3] > cuts[4])

    def test_two_story_config_is_plan_data(self):
        p = next(p for p in self.projects if p["slug"] == "snohomish-two-story")
        cfg = ps.load_config(p)
        self.assertEqual([l["id"] for l in cfg["levels"]], ["main", "upper"])
        self.assertEqual([l["ch"] for l in cfg["levels"]], [10.0, 9.0])
        area = {(r["name"], r["lvl"]): r["area"] for r in cfg["rooms"]}
        for key, val in {("Kitchen", 0): 319.86, ("Dining Room", 0): 279.65, ("Garage", 0): 460.0,
                         ("Master Bedroom", 1): 230.92, ("Bedroom 01", 1): 199.33, ("Bedroom 02", 1): 162.18}.items():
            self.assertEqual(area[key], val)
        for r in cfg["rooms"]:  # traced room polygons stay within 7 percent of the printed area
            if r["area"] and r["ch"] and not r.get("redlined"):  # a redline moved this room's wall after the area was printed
                self.assertLess(abs(r["traced"] - r["area"]) / r["area"], 0.07, r["name"])
        pitches = sorted(g["pitch"] for g in cfg["gableRoof"]["gables"])
        self.assertEqual(pitches, [5, 9.625, 10, 11])
        self.assertTrue(p.get("assumptions"))
        self.assertEqual([s["id"] for s in cfg["stages"]], list(ps.STAGE_PROGRESS))

    def test_second_story_addition_is_plan_data(self):
        p = next(p for p in self.projects if p["slug"] == "second-story-addition")
        cfg = ps.load_config(p)
        self.assertEqual([(l["id"], l["y"] - cfg["floor"]) for l in cfg["levels"]], [("main", 0), ("upper", 8.0)])  # printed 0'-0" and 8'-0"
        upper = {(r["name"], r["area"]) for r in cfg["rooms"] if r["lvl"] == 1 and r["area"]}
        for key in [("Bath", 71), ("Bedroom", 137), ("Storage", 71), ("Bedroom", 138), ("Primary Suite", 226), ("WIC", 58), ("Bath", 91)]:
            self.assertIn(key, upper)
        for r in cfg["rooms"]:  # printed areas only where printed; traced polygons within 3 percent
            if r["area"] and not r.get("areaNotPrinted"):
                self.assertLess(abs(r["traced"] - r["area"]) / r["area"], 0.03, r["name"])
            if r.get("areaNotPrinted"):
                self.assertNotIn("SF", r["text"])
        g = cfg["gableRoof"]["gables"]
        self.assertEqual([(x["pitch"], x["plate"] - cfg["floor"]) for x in g], [(6.0, 17.0)])  # printed 6/12 and 17'-0" plate
        self.assertTrue(p.get("assumptions"))

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_engine_builds_two_story(self):
        script = f"""
const H=require({json.dumps(str(ENGINE))});
const cfg=require({json.dumps(str(ps.DATA / 'snohomish-two-story.json'))});
H.register('house2',cfg);H.useProfile('house2');
const m=H.buildModel();
const st=p=>['upper','lower','roof'].map(id=>H.groupState(id,p));
console.log(JSON.stringify({{ids:m.groups.map(g=>g.id),floors:[...new Set(m.labels.map(l=>l.floor))],s:[0.04,0.56,0.74,0.93].map(st)}}));
"""
        out = json.loads(subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True).stdout)
        self.assertEqual(out["ids"], ["site", "lowerfloor", "lower", "lowerFinish", "lowerFix", "upperfloor", "upper", "finish", "fixtures", "roof"])
        self.assertEqual(sorted(out["floors"]), ["main", "upper"])
        house, upper, main, slab = out["s"]
        self.assertTrue(all(g["visible"] and g["cut"] == 100 for g in house))  # opens on the roofed exterior
        self.assertTrue(upper[0]["visible"] and upper[0]["cut"] < 25 and not upper[2]["visible"])
        self.assertFalse(main[0]["visible"])
        self.assertLess(slab[1]["cut"], main[1]["cut"])

    def test_hillside_lindal_adu_is_plan_data(self):
        p = next(p for p in self.projects if p["slug"] == "hillside-lindal-adu")
        cfg = ps.load_config(p)
        self.assertEqual([(l["id"], l["y"]) for l in cfg["levels"]], [("lower", 0), ("main", 10.5), ("upper", 21.0)])  # printed 10'-6" steps
        self.assertEqual([s["id"] for s in cfg["stages"]], list(ps.STAGE_PROGRESS))
        for r in cfg["rooms"]:  # the plans print no room areas
            self.assertTrue(r.get("areaNotPrinted"), r["name"])
            self.assertNotIn("SF", r["text"])
        self.assertIn("preliminary design", (p["kicker"] + p["card"]).lower())
        self.assertTrue(p.get("assumptions"))
        self.assertTrue(cfg["terrain"] and all(v[1] >= 0 for t in cfg["terrain"] for v in t))
        private = {'dbba921ce2051021', '2ea87d43675462ec', 'b7501c4da0b0cfc5', '77646f5a4f316663', '54acfadf2c86190a'}  # sha256 prefixes of the client's private words, kept out of the repo in plain text
        words = set(re.findall(r"[a-z0-9]+", (json.dumps(p) + json.dumps(cfg)).lower()))
        self.assertFalse({hashlib.sha256(w.encode()).hexdigest()[:16] for w in words} & private)

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_engine_builds_three_levels(self):
        script = f"""
const H=require({json.dumps(str(ENGINE))});
const cfg=require({json.dumps(str(ps.DATA / 'hillside-lindal-adu.json'))});
H.register('house3',cfg);H.useProfile('house3');
const m=H.buildModel();
const st=p=>['upper','lower','roof'].map(id=>H.groupState(id,p));
console.log(JSON.stringify({{floors:[...new Set(m.labels.map(l=>l.floor))],s:[0.04,0.56,0.74,0.93].map(st)}}));
"""
        out = json.loads(subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True).stdout)
        self.assertEqual(sorted(out["floors"]), ["lower", "main", "upper"])
        house, upper, main, lower = out["s"]
        self.assertTrue(all(g["visible"] and g["cut"] == 100 for g in house))  # opens on the roofed exterior
        self.assertTrue(upper[0]["visible"] and upper[0]["cut"] < 31 and upper[1]["cut"] == 100)
        self.assertFalse(main[0]["visible"])
        self.assertTrue(10.5 < main[1]["cut"] < 21)  # main floor plan cut
        self.assertLess(lower[1]["cut"], 10.5)  # lower level plan cut


if __name__ == "__main__":
    unittest.main()


class StartViewTests(unittest.TestCase):
    def test_engine_starts_in_3d_exterior(self):
        js = ENGINE.read_text(encoding="utf-8")
        self.assertIn("var START_PROGRESS = 0;", js)
        self.assertIn('history.scrollRestoration = "manual"', js)
        for p in ps.load_projects():
            html = ps.pages()[f"portfolio/{p['slug']}/index.html"]
            self.assertIn('data-ppgm-view="perspective" aria-pressed="true"', html)
            self.assertIn('class="ppgm-is-on" data-ppgm-stage="house"', html)
