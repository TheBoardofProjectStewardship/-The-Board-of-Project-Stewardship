"""Static checks for the client-side plan walkthrough page."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "plan-walkthrough" / "index.html"
SCRIPT = ROOT / "assets" / "js" / "plan-walkthrough.js"
FORBIDDEN = re.compile(r"\b(?:BOPS|ChatGPT|Gemini|Imagen|Veo|Higgsfield|Pollinations)\b|\bAI\b")


class PlanWalkthroughPageTests(unittest.TestCase):
    def test_page_is_linked_and_self_contained(self):
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn("<title>Plan to 3D Walkthrough | Board of Project Stewardship</title>", html)
        self.assertLessEqual(len("Plan to 3D Walkthrough | Board of Project Stewardship"), 60)
        self.assertIn('rel="canonical" href="https://boardofprojectstewardship.com/plan-walkthrough/"', html)
        self.assertIn('id="another-story-sea"', html)
        self.assertIn("https://secure.lni.wa.gov/verify/", html)
        self.assertIn("For illustration only.", html)
        self.assertIn("not for construction", html.lower())
        self.assertIn('src="/assets/js/plan-walkthrough.js"', html)
        self.assertIn('href="/assets/css/plan-walkthrough.css"', html)
        self.assertNotIn("three.module.js", html)
        self.assertNotIn("pdf.min.mjs", html)
        self.assertIsNone(FORBIDDEN.search(html))
        self.assertIn('"@type": "WebApplication"', html)
        self.assertIn('"price": "0"', html)
        nav = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("plan-walkthrough/", nav)
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://boardofprojectstewardship.com/plan-walkthrough/", sitemap)

    def test_script_has_sample_home_and_no_forbidden_terms(self):
        js = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("Cedar Lane House", js)
        self.assertIn("Watching the build", js)
        self.assertIsNone(FORBIDDEN.search(js))
        for other in ROOT.glob("*.html"):
            text = other.read_text(encoding="utf-8")
            self.assertNotIn("plan-walkthrough.js", text, other.name)


if __name__ == "__main__":
    unittest.main()
