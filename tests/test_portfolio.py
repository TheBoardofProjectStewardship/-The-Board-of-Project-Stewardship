"""Portfolio grid and per-project 3D model pages (shared house model engine)."""
from __future__ import annotations

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
        self.assertIn("one-story-house-shop-garage", hrefs)
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
        files = list(self.pages.values()) + [f.read_text(encoding="utf-8") for f in (ENGINE, MAGNOLIA, CSS, ps.DATA / "projects.json")]
        files += [(ps.DATA / p["config"]).read_text(encoding="utf-8") for p in self.projects if p.get("config")]
        for text in files:
            self.assertNotIn("\u2014", text)
            self.assertIsNone(re.search(r"\bAI\b", text))
            self.assertNotIn("McGillivray", text)

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


if __name__ == "__main__":
    unittest.main()
