#!/usr/bin/env python3
"""Client-side floor-plan dimension check. No network."""
from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class FloorPlanDimensionCheckTests(unittest.TestCase):
    def test_page_mentions_dimension_check(self) -> None:
        import generate_site as gs

        html = gs.build_floor_plan_3d_page()
        self.assertIn('id="fp-dimcheck"', html)
        self.assertIn('id="fp-labeled"', html)
        self.assertIn('id="fp-measured"', html)
        self.assertIn('id="fp-ceiling"', html)
        self.assertIn('id="fp-check-summary"', html)
        self.assertIn('id="fp-3d-hold"', html)
        self.assertIn("Check the plan", html)
        self.assertIn("floor-plan-check.js", (ROOT / "assets" / "js" / "floor-plan-3d.js").read_text(encoding="utf-8"))
        lowered = html.lower()
        for banned in ("chatgpt", "higgsfield", "artificial intelligence", " llm", "openai"):
            self.assertNotIn(banned, lowered)
        self.assertNotIn("BOPS", html)

    def test_check_module(self) -> None:
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        proc = subprocess.run(
            [node, str(ROOT / "tests" / "floor_plan_check_smoke.mjs")],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("ok", proc.stdout)


if __name__ == "__main__":
    unittest.main()
