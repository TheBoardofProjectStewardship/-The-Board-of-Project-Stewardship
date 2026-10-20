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
        self.assertNotIn("fc-price", text)
        self.assertNotIn("Budget and resale calculator", text)

    def test_budget_calculator_removed(self):
        home = (ROOT / "index.html").read_text(encoding="utf-8")
        for needle in ("budget-calculator", "hc-example", "home-calculator", "Budget and resale calculator"):
            self.assertNotIn(needle, home)
        self.assertIn('id="feasibility-calculator"', home)
        self.assertIn('id="build-walkthrough"', home)
        self.assertFalse((ROOT / "assets/js/home-calculator.js").exists())
        self.assertFalse((ROOT / "assets/css/home-calculator.css").exists())
        js = (ROOT / "assets/js/build-here.js").read_text(encoding="utf-8")
        self.assertNotIn("budget-calculator", js)
        gen = (ROOT / "generate_site.py").read_text(encoding="utf-8")
        self.assertNotIn("home_budget_calculator", gen)

    def test_report_tool_on_homepage(self):
        home = (ROOT / "index.html").read_text(encoding="utf-8")
        # Directly after the 3D Magnolia scroll house (#scroll-house), inside one layout wrapper.
        import sys
        sys.path.insert(0, str(ROOT))
        import generate_site
        frag, _css = generate_site.home_scroll_house()
        end = home.index(frag.strip()[-200:]) + 200
        j = home.index('id="bh-home"')
        between = home[end:j]
        self.assertEqual(between.split()[:2], ['<div', 'class="max-w-6xl'])
        self.assertEqual(between.count("<section"), 1)
        self.assertNotIn("</section>", between)
        k = home.index('<section id="mission"')
        self.assertLess(j, k)
        self.assertLess(k, home.index('id="integrity-shield"'))
        tail = home[home.index("</section>", home.index('id="bh-report-wrap"')) + len("</section>"):k]
        self.assertEqual(tail.count("</section>"), 1)
        self.assertNotIn("<section", tail)
        sec = home[j:k]
        for needle in ('id="bh-form"', 'id="bh-address"', 'id="bh-confirm"', 'id="bh-report"', 'id="bh-print"',
                       "/assets/js/build-here.js", "/assets/js/build-here-rules.js", "/assets/css/build-here.css",
                       "not a legal, zoning or permit determination", "./build-here.html"):
            self.assertIn(needle, sec)
        self.assertEqual(home.count('id="bh-address"'), 1)
        self.assertEqual(home.count("<h1"), 1)
        self.assertNotIn("\u2014", sec)
        import sys
        sys.path.insert(0, str(ROOT))
        import generate_site
        self.assertIn(generate_site.home_feasibility_tool_section(), home)
        self.assertNotIn('id="bh-lead"', sec)
        js = (ROOT / "assets/js/build-here.js").read_text(encoding="utf-8")
        self.assertIn('if ($("bh-lead-address"))', js)
        self.assertIn('if ($("bh-lead"))', js)

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
          other: R.pick({juris:'other', zone:'R-1', lot:7200}),
          surber2: R.pick({juris:'seattle', zone:'NR1', lot:6216, units:2}),
          ken4: R.pick({juris:'kenmore', zone:'R4', lot:15603}),
          ken1small: R.pick({juris:'kenmore', zone:'R-1', lot:12000}),
          ken1: R.pick({juris:'kenmore', zone:'R-1', lot:20000})
        };
        console.log(JSON.stringify(out));
        """
        data = json.loads(subprocess.check_output(["node", "-e", script, str(ROOT / "assets/js/build-here-rules.js")], text=True))
        self.assertEqual(data["surber"]["floorCap"], 3730)
        self.assertEqual(data["surber"]["coverage"], 3108)
        self.assertEqual(data["surber"]["setbacks"], {"front": 15, "rear": 15, "side": 5, "rearAlley": 0})
        self.assertEqual(data["small"]["floorCap"], 2500)
        self.assertEqual(data["edm"]["coverage"], 3500)
        self.assertEqual(data["kc"]["impervious"], 5040)
        self.assertEqual(data["sno"]["coverage"], 76230)
        self.assertIsNone(data["other"])
        self.assertEqual(data["surber2"]["floorCap"], 4973)
        self.assertEqual(data["ken4"]["impervious"], 7021)
        self.assertEqual(data["ken4"]["imperviousMax"], 8582)
        self.assertEqual(data["ken4"]["setbacks"], {"front": 15, "rear": 20, "side": 7.5})
        self.assertEqual(data["ken1small"]["setbacks"]["rear"], 20)
        self.assertEqual(data["ken1"]["setbacks"], {"front": 20, "rear": 5, "side": 5})
        self.assertEqual(data["ken1"]["impervious"], 6000)
        self.assertTrue(all(r["value"] is None for r in data["snoUrban"]["rules"][:2]))
        for key in ("surber", "edm", "kc", "sno", "snoUrban", "ken4"):
            for rule in data[key]["rules"]:
                self.assertTrue(rule["src"]["url"].startswith("https://"), rule)
                self.assertTrue(re.search(r"seattle\.gov|municode\.com|kingcounty\.gov|edmonds\.municipal\.codes|snohomish\.county\.codes|codepublishing\.com|leg\.wa\.gov", rule["src"]["url"]), rule)


if __name__ == "__main__":
    unittest.main()
