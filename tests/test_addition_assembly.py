#!/usr/bin/env python3
"""Rear-addition scroll page. No network. Does not regenerate the site."""
from __future__ import annotations

import re
import shutil
import subprocess
import unittest
from pathlib import Path

import generate_site as gs

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "addition-assembly.html"
FORBIDDEN = re.compile(
    r"\b(?:BOPS|ChatGPT|Claude|Gemini|Imagen|Veo|Higgsfield|Pollinations|LLM)\b|\bAI\b|artificial intelligence",
    re.I,
)


class AdditionAssemblyTests(unittest.TestCase):
    def test_page_matches_generator_and_stays_in_sitemap(self) -> None:
        built = gs.build_addition_assembly_page()
        self.assertEqual(built, PAGE.read_text(encoding="utf-8"))
        for needle in (
            "Footing and foundation tie-in",
            "Floor framing",
            "Wall framing",
            "Sheathing and weather barrier",
            "Roof framing and roofing",
            "Windows and doors with flashing",
            "Siding and trim",
            "Motion is reduced",
            "addition-assembly.css",
            "addition-assembly.js",
            "aa-sequence",
            "Illustration only",
        ):
            self.assertIn(needle, built)
        self.assertIsNone(FORBIDDEN.search(built))
        self.assertNotIn("BOPS", built)
        css = (ROOT / "assets" / "css" / "addition-assembly.css").read_text(encoding="utf-8")
        script = (ROOT / "assets" / "js" / "addition-assembly.js").read_text(encoding="utf-8")
        self.assertIn("prefers-reduced-motion: reduce", css)
        self.assertIn("three@0.160.0/build/three.module.js", script)
        self.assertIsNone(FORBIDDEN.search(css))
        self.assertIsNone(FORBIDDEN.search(script))
        passed = gs.apply_performance_pass(built)
        self.assertIn("addition-assembly.js", passed)
        self.assertIn("Footing and foundation tie-in", passed)

    def test_linked_from_good_steward_only(self) -> None:
        steward = (ROOT / "good-steward.html").read_text(encoding="utf-8")
        home = (ROOT / "index.html").read_text(encoding="utf-8")
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("./addition-assembly.html", steward)
        self.assertIn("Rear Addition Sequence", steward)
        self.assertNotIn("addition-assembly", home)
        self.assertNotIn("addition-assembly", gs.nav_html("home"))
        self.assertNotIn("addition-assembly", gs.footer_html("./", "home", "2026-10-19"))
        self.assertIn("https://boardofprojectstewardship.com/addition-assembly.html", sitemap)
        self.assertIn('href="{public_tool_href(\'addition-assembly\')}"', (ROOT / "generate_site.py").read_text(encoding="utf-8"))
        self.assertIn(
            '(SITE_DIR / "addition-assembly.html").write_text(build_addition_assembly_page()',
            (ROOT / "generate_site.py").read_text(encoding="utf-8"),
        )

    def test_sitemap_generator_keeps_the_url(self) -> None:
        path = ROOT / "sitemap.xml"
        before = path.read_bytes()
        try:
            gs.write_sitemap([])
            text = path.read_text(encoding="utf-8")
            self.assertIn("https://boardofprojectstewardship.com/addition-assembly.html", text)
            self.assertIn("https://boardofprojectstewardship.com/floor-plan-3d.html", text)
        finally:
            path.write_bytes(before)
        self.assertEqual(path.read_bytes(), before)

    def test_script_parses(self) -> None:
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        subprocess.check_call([node, "--check", "assets/js/addition-assembly.js"], cwd=ROOT)
        proc = subprocess.run(
            [node, "--input-type=module", "-e",
             "import { stageIndex, progressFromScroll } from './assets/js/addition-assembly.js';"
             "if (stageIndex(0) !== 0 || stageIndex(1) !== 7) throw new Error('stage');"
             "if (progressFromScroll(-450, 1000, 100) !== 0.5) throw new Error('scroll');"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)


if __name__ == "__main__":
    unittest.main()
