"""The site-visit tool page loads the keyless parcel lookup and its disclaimer."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "tools" / "site-visit" / "index.html"
LOOKUP = ROOT / "tools" / "site-visit" / "parcel-lookup.js"
UI = ROOT / "tools" / "site-visit" / "parcel-ui.js"
DISCLAIMER = "Public county records; not a permit or zoning determination."


class ParcelLookupPageTests(unittest.TestCase):
    def test_page_includes_lookup_script_and_disclaimer(self):
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn('<script src="parcel-lookup.js"></script>', html)
        self.assertIn('<script src="parcel-ui.js"></script>', html)
        self.assertIn(DISCLAIMER, html)
        self.assertIn('id="parcel_lookup_btn"', html)
        self.assertIn('id="parcel_card"', html)
        self.assertLess(
            html.index('id="client_address"'),
            html.index('id="parcel_lookup_btn"'),
        )
        self.assertIn("https://cdn.jsdelivr.net/npm/chart.js", html)
        self.assertIn("board.goodSteward.siteVisit.v1", html)
        self.assertIn("$62,000", html)
        self.assertIn("$5,000", html)
        self.assertIn("$15,000", html)

        lookup = LOOKUP.read_text(encoding="utf-8")
        self.assertIn("lookupParcel", lookup)
        self.assertNotIn("apiKey", lookup)
        self.assertNotIn("api_key", lookup)
        self.assertNotRegex(lookup, r"owner|taxpayer", msg="parcel lookup must not surface owner names")

        ui = UI.read_text(encoding="utf-8")
        self.assertIn(DISCLAIMER, html)
        self.assertIn("<em>unknown</em>", ui)
        self.assertNotIn("est_sqft').value", ui)
        self.assertNotIn('getElementById("est_sqft").value', ui)
        self.assertNotIn("est_sqft.value =", ui)
        self.assertIn("existing_sqft", ui)
        self.assertNotRegex(ui, r"owner|taxpayer")

        gen = (ROOT / "generate_site.py").read_text(encoding="utf-8")
        self.assertIn('tools/site-visit/index.html', gen)
        self.assertNotIn("(SITE_DIR / \"tools\" / \"site-visit\"", gen)


if __name__ == "__main__":
    unittest.main()
