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
            # The shared Another Story callout uses the sitewide em dash.
            prose = re.sub(
                r'\s*<section id="another-story-cta"[\s\S]*?</section>',
                "",
                body,
            ) if path == PAGE else body
            self.assertIsNone(re.search(r"\bAI\b", text), path.name)
            self.assertNotIn("\u2014", prose, path.name)
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
        self.assertIn('id="another-story-cta"', text)
        self.assertNotIn('id="another-story-sea"', text)
        self.assertNotIn("fc-price", text)
        self.assertNotIn("Budget and resale calculator", text)

    def test_budget_calculator_removed(self):
        home = (ROOT / "index.html").read_text(encoding="utf-8")
        for needle in ("budget-calculator", "hc-example", "home-calculator", "Budget and resale calculator"):
            self.assertNotIn(needle, home)
        self.assertIn('id="feasibility-calculator"', home)
        self.assertIn('id="scroll-house"', home)
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
                self.assertTrue(re.search(r"seattle\.gov|municode\.com|kingcounty\.gov|edmonds\.municipal\.codes|snohomish\.county\.codes|codepublishing\.com|leg\.wa\.gov|municipal\.codes|ecode360\.com|\.gov|\.us|\.org|\.com|\.net", rule["src"]["url"]), rule)


CITY_HALLS = {
    # key: (city hall address, county records name). Census or Esri finds the
    # point; the King County parcel CTYNAME or Snohomish SAS_Cities NAME names the city.
    "lynnwood": ("19100 44th Ave W, Lynnwood, WA 98036", "LYNNWOOD"),
    "bothell": ("18415 101st Ave NE, Bothell, WA 98011", "Bothell"),
    "shoreline": ("17500 Midvale Ave N, Shoreline, WA 98133", "Shoreline"),
    "mountlaketerrace": ("6100 219th St SW, Mountlake Terrace, WA 98043", "MOUNTLAKE TERRACE"),
    "millcreek": ("15728 Main St, Mill Creek, WA 98012", "MILL CREEK"),
    "everett": ("2930 Wetmore Ave, Everett, WA 98201", "EVERETT"),
    "mukilteo": ("11930 Cyrus Way, Mukilteo, WA 98275", "MUKILTEO"),
    "lakeforestpark": ("17425 Ballinger Way NE, Lake Forest Park, WA 98155", "Lake Forest Park"),
    "woodinville": ("17301 133rd Ave NE, Woodinville, WA 98072", "Woodinville"),
    "kirkland": ("123 5th Ave, Kirkland, WA 98033", "Kirkland"),
    "redmond": ("15670 NE 85th St, Redmond, WA 98052", "Redmond"),
    "bellevue": ("450 110th Ave NE, Bellevue, WA 98004", "Bellevue"),
    "renton": ("1055 S Grady Way, Renton, WA 98057", "RENTON"),
    "sammamish": ("801 228th Ave SE, Sammamish, WA 98075", "SAMMAMISH"),
    "issaquah": ("130 E Sunset Way, Issaquah, WA 98027", "ISSAQUAH"),
    "beauxarts": ("10550 SE 27th St, Beaux Arts, WA 98004", "Beaux Arts"),
    "seatac": ("4800 S 188th St, SeaTac, WA 98188", "SeaTac"),
    "goldbar": ("107 5th St, Gold Bar, WA 98251", "GOLD BAR"),
}

PRIORITY_SAMPLES = {
    "lynnwood": "RN", "bothell": "R-L1", "shoreline": "NR3", "mountlaketerrace": "R-1",
    "millcreek": "NR", "everett": "NR", "mukilteo": "RD 7.2", "lakeforestpark": "RS 7200",
    "woodinville": "R-4", "kirkland": "RS 7.2", "redmond": "NR", "bellevue": "SR-3",
    "renton": "R-8", "sammamish": "R-4", "issaquah": "SF-S",
}


class BuildHereCitiesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script = r"""
        const R = require(process.argv[1]);
        const halls = JSON.parse(process.argv[2]), samples = JSON.parse(process.argv[3]);
        const out = { keys: Object.keys(R.CITY), city: R.CITY, resolve: {}, rs: {}, base: {} };
        for (const k in halls) out.resolve[k] = R.cityKey(halls[k][1].toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()));
        for (const k in samples) out.rs[k] = R.pick({ juris: 'city', city: k, zone: samples[k], lot: 7200, units: 1 });
        for (const k of Object.keys(R.CITY)) out.base[k] = R.pick({ juris: 'city', city: k, zone: 'ZZ-unknown', lot: 7200, units: 1 });
        out.other = R.pick({ juris: 'other', zone: 'R-1', lot: 7200 });
        out.mlt3 = R.pick({ juris: 'city', city: 'mountlaketerrace', zone: 'R-2', lot: 6000, units: 3 });
        out.red8 = R.pick({ juris: 'city', city: 'redmond', zone: 'NR', lot: 9000, units: 8 });
        out.lyn4 = R.pick({ juris: 'city', city: 'lynnwood', zone: 'RN', lot: 6000, units: 4 });
        console.log(JSON.stringify(out));
        """
        cls.d = json.loads(subprocess.check_output(["node", "-e", script, str(ROOT / "assets/js/build-here-rules.js"), json.dumps(CITY_HALLS), json.dumps(PRIORITY_SAMPLES)], text=True))
        cls.data = json.loads((ROOT / "data/build-here/jurisdictions.json").read_text())

    def test_every_city_is_listed(self):
        # 39 King + 20 Snohomish cities, minus Seattle, Kenmore and Edmonds (own rule sets); Bothell sits in both.
        self.assertEqual(len(self.d["keys"]), 55)
        self.assertEqual(sorted(self.d["keys"]), sorted(self.data["cities"]))
        for k, c in self.d["city"].items():
            self.assertTrue(c["home"].startswith("https://"), k)
            self.assertTrue(c["code"]["url"].startswith("https://"), k)
            self.assertIn(c["tier"], [0, 1, 2, 3], k)
            self.assertTrue(self.data["cities"][k]["cityHall"], k)
            self.assertEqual(self.data["cities"][k]["lastVerified"], "2026-10-22", k)

    def test_city_hall_records_resolve(self):
        for k, v in CITY_HALLS.items():
            self.assertEqual(self.d["resolve"][k], k, v)

    def test_priority_cities_have_coded_zones(self):
        for k, rs in self.d["rs"].items():
            self.assertIsNotNone(rs, k)
            self.assertEqual(rs["key"], "city-" + k, k)
            labels = [r["label"] for r in rs["rules"]]
            self.assertIn("Maximum height", labels, k)
            self.assertIn("ADUs (state law)", labels, k)
            self.assertIn("Middle housing (state law)", labels, k)
            if k != "redmond":  # Redmond NR setbacks live in RZC 21.16.200, not yet coded
                self.assertTrue(any(r["value"] for r in rs["rules"] if "setback" in r["label"].lower()), k)
            for r in rs["rules"]:
                self.assertTrue(r["src"]["url"].startswith("https://"), (k, r))

    def test_every_city_gets_a_report(self):
        for k, rs in self.d["base"].items():
            self.assertIsNotNone(rs, k)
            self.assertTrue(rs["key"].startswith("city-"), k)
            self.assertTrue(any(r["src"]["url"] == self.d["city"][k]["code"]["url"] for r in rs["rules"]), k)
        self.assertIsNone(self.d["other"])

    def test_city_math(self):
        self.assertEqual(self.d["rs"]["lynnwood"]["floorCap"], 4320)
        self.assertEqual(self.d["lyn4"]["floorCap"], 7200)
        self.assertEqual(self.d["mlt3"]["floorCap"], 4800)
        self.assertEqual(self.d["red8"]["floorCap"], 15000)
        self.assertEqual(self.d["rs"]["lakeforestpark"]["coverage"], 2520)
        self.assertEqual(self.d["rs"]["bellevue"]["coverage"], 2880)
        self.assertEqual(self.d["rs"]["renton"]["impervious"], 4680)
        self.assertEqual(self.d["rs"]["mukilteo"]["setbacks"], {"front": 20, "rear": 5, "side": 5})


if __name__ == "__main__":
    unittest.main()
