#!/usr/bin/env python3
"""The build-here feasibility tool stays sourced, honest and on brand."""
import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "build-here.html"
JS = [ROOT / "assets/js/build-here.js", ROOT / "assets/js/build-here-rules.js", ROOT / "assets/css/build-here.css"]


def main_text():
    html = PAGE.read_text(encoding="utf-8")
    return html.split('<main id="main-content">', 1)[1].split("</main>", 1)[0]


class BuildHereTest(unittest.TestCase):
    def test_no_forbidden_words_or_em_dashes(self):
        for path in [PAGE, *JS]:
            text = path.read_text(encoding="utf-8")
            body = main_text() if path == PAGE else text
            self.assertIsNone(re.search(r"\bAI\b", text), path.name)
            self.assertNotIn("\u2014", body, path.name)
            self.assertIsNone(re.search(r"\bBOPS\b", body), path.name)

    def test_never_calls_ppg_new(self):
        for path in [PAGE, *JS]:
            self.assertIsNone(re.search(r"new\W+(?:\w+\W+){0,3}pacific pro|pacific pro\w*\W+(?:\w+\W+){0,3}(?:is|are)\s+new", path.read_text(encoding="utf-8"), re.I))

    def test_page_is_linked_and_in_sitemap(self):
        self.assertIn("https://boardofprojectstewardship.com/build-here.html", (ROOT / "sitemap.xml").read_text())
        self.assertIn('href="./build-here.html"', (ROOT / "index.html").read_text())
        self.assertIn('rel="canonical" href="https://boardofprojectstewardship.com/build-here.html"', PAGE.read_text())

    def test_disclaimer_and_cta(self):
        text = main_text()
        self.assertIn("not a legal, zoning or permit determination", text)
        for href in ("./additions.html", "./how-we-rank.html"):
            self.assertIn(href, text)
        self.assertIn("editorial@boardofprojectstewardship.com", text)
        self.assertEqual(text.count("bh-example"), 9)

    def test_rules_math_and_sources(self):
        script = r"""
        const R = require(process.argv[1]);
        const out = {
          surber: R.pick({juris:'seattle', zone:'NR1', lot:6216, units:1}),
          small: R.pick({juris:'seattle', zone:'NR3', lot:3000, units:1}),
          edm: R.pick({juris:'edmonds', zone:'LDR-M', lot:10000}),
          kc: R.pick({juris:'kc', zone:'R6', lot:7200}),
          sno: R.pick({juris:'sno', zone:'R-5', lot:217800}),
          snoUrban: R.pick({juris:'sno', zone:'R-7200', lot:7200}),
          other: R.pick({juris:'other', zone:'R-1', lot:7200})
        };
        console.log(JSON.stringify(out));
        """
        data = json.loads(subprocess.check_output(["node", "-e", script, str(ROOT / "assets/js/build-here-rules.js")], text=True))
        self.assertEqual(data["surber"]["floorCap"], 3730)
        self.assertEqual(data["surber"]["coverage"], 2176)
        self.assertEqual(data["surber"]["setbacks"], {"front": 15, "rear": 15, "side": 5, "rearAlley": 0})
        self.assertEqual(data["small"]["floorCap"], 2500)
        self.assertEqual(data["edm"]["coverage"], 3500)
        self.assertEqual(data["kc"]["impervious"], 5040)
        self.assertEqual(data["sno"]["coverage"], 76230)
        self.assertIsNone(data["other"])
        self.assertTrue(all(r["value"] is None for r in data["snoUrban"]["rules"][:2]))
        for key in ("surber", "edm", "kc", "sno", "snoUrban"):
            for rule in data[key]["rules"]:
                self.assertTrue(rule["src"]["url"].startswith("https://"), rule)
                self.assertTrue(re.search(r"seattle\.gov|municode\.com|kingcounty\.gov|edmonds\.municipal\.codes|snohomish\.county\.codes", rule["src"]["url"]), rule)


if __name__ == "__main__":
    unittest.main()
