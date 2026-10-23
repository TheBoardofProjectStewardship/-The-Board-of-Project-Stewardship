"""Assessor house-size index and the site-visit calculator wording."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "tools" / "site-visit" / "index.html"
INDEX = ROOT / "assets" / "data" / "house-size"
CREDIT = "King County Assessor and Snohomish County Assessor public records"


class HouseSizePageTests(unittest.TestCase):
    def test_page_credits_assessors_and_prices_added_area_only(self):
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn('<script src="house-size-lookup.js"></script>', html)
        self.assertIn(CREDIT, html)
        self.assertIn('id="existing_sqft"', html)
        self.assertIn('id="house_size_total"', html)
        self.assertIn("Square feet to add or build", html)
        self.assertNotIn("Estimated Square Footage", html)
        self.assertIn("$62,000", html)
        self.assertIn("$5,000", html)
        self.assertIn("$15,000", html)
        self.assertIn("if(isChecked('cb_geotech')) total += 15000;", html)
        self.assertIn("total += (sqft * tierPrice);", html)
        calc = html.split("function updateCalculator()", 1)[1].split("document.querySelectorAll('.calc-input')", 1)[0]
        self.assertIn("est_sqft", calc)
        self.assertNotIn("existing_sqft", calc)

    def test_workflow_rebuilds_weekly(self):
        yml = (ROOT / ".github" / "workflows" / "house-size-index.yml").read_text(encoding="utf-8")
        self.assertIn("workflow_dispatch", yml)
        self.assertIn("0 12 * * 1", yml)
        self.assertIn("python3 scripts/build_index.py --out assets/data/house-size", yml)
        lookup = (ROOT / "tools" / "site-visit" / "house-size-lookup.js").read_text(encoding="utf-8")
        self.assertIn("'/assets/data/house-size'", lookup)
        self.assertNotIn("'/data/house-size'", lookup)
        self.assertNotIn("board_intake", yml)
        self.assertNotIn("--apply", yml)
        script = (ROOT / "scripts" / "build_index.py").read_text(encoding="utf-8")
        self.assertNotIn("Taxpayer", script)
        self.assertNotIn("OwnerName", script)
        self.assertIn("SqFtTotLiving", script)
        self.assertIn("FinSize", script)


class HouseSizeIndexTests(unittest.TestCase):
    def test_ruffner_seattle_record(self):
        shard = json.loads((INDEX / "king" / "277.json").read_text(encoding="utf-8"))
        rec = shard["2770600432"]
        self.assertEqual(rec[:5], [3240, 1985, 4, 2, "res"])
        self.assertEqual(len(rec), 5)

    def test_index_meta_and_no_owner_fields(self):
        meta = json.loads((INDEX / "meta.json").read_text(encoding="utf-8"))
        self.assertGreater(meta["king"]["parcels"], 500000)
        self.assertGreater(meta["snoh"]["parcels"], 200000)
        sample = json.loads((INDEX / "snoh" / "0037.json").read_text(encoding="utf-8"))
        rec = sample["00370400000200"]
        self.assertEqual(rec, [1865, 1954, 3, 1, "res"])


if __name__ == "__main__":
    unittest.main()
