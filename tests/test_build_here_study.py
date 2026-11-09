#!/usr/bin/env python3
"""Measurement honesty, scenario states, and the downloadable study file."""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEASURES = ROOT / "assets/js/build-here-measures.js"
EXPORT = ROOT / "assets/js/build-here-export.js"


def node_call(module, expr):
    script = (
        "const M = require(process.argv[1]);\n"
        "const out = (" + expr + ");\n"
        "console.log(JSON.stringify(out));\n"
    )
    return json.loads(subprocess.check_output(["node", "-e", script, str(module)], text=True))


class MeasureTests(unittest.TestCase):
    def test_no_records(self):
        data = node_call(MEASURES, "({ open: M.openArea(null, {}), cards: M.scenarios({}) })")
        self.assertIsNone(data["open"]["sf"])
        self.assertFalse(data["open"]["verifiedLandscape"])
        self.assertTrue(all(c["state"] == "nodata" for c in data["cards"]))

    def test_partial_lot_without_zoning(self):
        cards = node_call(MEASURES, "M.scenarios({ lot: 12088, roof: 3278, zoningCoded: false })")
        by = {c["id"]: c for c in cards}
        self.assertEqual(by["addition"]["state"], "partial")
        self.assertIn("not coded", by["addition"]["line"])
        self.assertEqual(by["remodel"]["state"], "partial")
        self.assertNotEqual(by["remodel"]["state"], "ready")
        self.assertIn("living area", by["remodel"]["line"].lower())

    def test_roof_is_not_landscape_and_not_added_to_living(self):
        expr = """
        M.assemble({
          lot: 12088,
          coverageSf: 3278,
          driveSf: null,
          hardSf: null,
          records: [
            { kind: 'living', sf: 2400, source: 'Assessor living area', retrieved: '2024-06-01', method: 'assessor extract', confidence: 'Medium', automatic: true },
            { kind: 'roof', sf: 3278, source: 'Roof outline', retrieved: '2026-11-09', method: 'roof outline', confidence: 'Medium', automatic: true, note: 'Not living area' }
          ]
        })
        """
        data = node_call(MEASURES, expr)
        self.assertEqual(data["open"]["sf"], 8810)
        self.assertFalse(data["open"]["verifiedLandscape"])
        self.assertNotIn("Remaining landscape", data["open"]["label"])
        self.assertIn("not landscaping", data["open"]["note"])
        amounts = [m["sf"] for m in data["measures"]]
        self.assertIn(2400, amounts)
        self.assertIn(3278, amounts)
        self.assertNotIn(2400 + 3278, amounts)
        self.assertTrue(any("not added" in n for n in data["notes"]))

    def test_unknown_paving_is_not_zero(self):
        rejected = node_call(MEASURES, "M.cleanMeasure({ kind: 'driveway', sf: 0, method: 'assessor', source: 'card' })")
        self.assertFalse(rejected["ok"])
        self.assertIn("0", rejected["error"])
        kept = node_call(MEASURES, "M.sfOrUnknown({ sf: 0 })")
        self.assertIsNone(kept)
        classified = node_call(MEASURES, "M.sfOrUnknown({ sf: 0, measuredZero: true })")
        self.assertEqual(classified, 0)
        photo = node_call(MEASURES, "M.cleanMeasure({ kind: 'driveway', sf: 400, method: 'aerial', source: 'photo' })")
        self.assertFalse(photo["ok"])
        ranged = node_call(MEASURES, "M.cleanMeasure({ kind: 'driveway', method: 'photo', sfLow: 300, sfHigh: 500, source: 'aerial' })")
        self.assertTrue(ranged["ok"])
        self.assertIsNone(ranged["measure"]["sf"])

    def test_assessor_and_listing_disagree_and_can_be_stale(self):
        expr = """
        M.assemble({
          lot: 10000,
          coverageSf: null,
          driveSf: null,
          hardSf: null,
          records: [
            { kind: 'living', sf: 2100, source: 'County assessor', retrieved: '2024-01-15', method: 'assessor extract', confidence: 'Medium', automatic: true },
            { kind: 'living', sf: 2480, source: 'Listing page typed by you', url: 'https://example.com/listing', retrieved: '2026-03-01', method: 'listing', confidence: 'Low', automatic: false }
          ]
        })
        """
        data = node_call(MEASURES, expr)
        self.assertEqual(len(data["conflicts"]), 1)
        self.assertIn("2100", data["conflicts"][0]["note"])
        self.assertIn("2480", data["conflicts"][0]["note"])
        self.assertIn("2024-01-15", data["conflicts"][0]["note"])
        self.assertIn("2026-03-01", data["conflicts"][0]["note"])
        self.assertTrue(data["stale"])
        self.assertEqual(len(data["measures"]), 2)

    def test_address_edit_keeps_the_old_number_visible(self):
        expr = """
        (() => {
          const base = [{ kind: 'living', sf: 2100, source: 'County assessor', retrieved: '2026-01-01', method: 'assessor extract', confidence: 'Medium', automatic: true }];
          const records = M.withEdit(base, 'living', 1800, '2026-11-09');
          return M.assemble({ lot: 8000, coverageSf: null, driveSf: null, hardSf: null, records: records });
        })()
        """
        data = node_call(MEASURES, expr)
        amounts = sorted(m["sf"] for m in data["measures"])
        self.assertEqual(amounts, [1800, 2100])
        self.assertEqual(len(data["conflicts"]), 1)

    def test_ready_addition_uses_real_room(self):
        cards = node_call(MEASURES, "M.scenarios({ lot: 7200, living: 2000, roof: 1400, zoningCoded: true, roomFar: 900, roomCov: 400, floorCap: 2900, aduRule: 'Up to two ADUs' })")
        by = {c["id"]: c for c in cards}
        self.assertEqual(by["addition"]["state"], "ready")
        self.assertIn("900", by["addition"]["metric"])
        self.assertEqual(by["adu"]["state"], "ready")
        self.assertEqual(by["teardown"]["state"], "ready")
        self.assertEqual(by["remodel"]["state"], "ready")
        self.assertNotIn("permit", by["addition"]["line"].split("not a permit")[0].lower() + "x")


class ExportTests(unittest.TestCase):
    def test_download_file_is_not_the_print_dialog(self):
        expr = r"""
        M.buildStudyFile({
          address: 'Sample lot (not a property record)',
          date: '2026-11-09',
          limitations: 'Planning estimate only. Not a permit determination.',
          sources: [{ name: 'County parcels', ok: true, note: 'outline' }, { name: 'Listing site', ok: false, note: 'not fetched' }],
          bodyHtml: '<section class="bh-page"><h2>Study</h2><button type="button">Print</button><iframe src="https://maps.example/embed"></iframe><video src="x.mp4"></video><p>Roof outline 3278 sf</p><div class="bh-map-frame"><iframe src="https://maps.example/2"></iframe></div></section>'
        })
        """
        html = node_call(EXPORT, expr)
        self.assertIn("Sample lot (not a property record)", html)
        self.assertIn("2026-11-09", html)
        self.assertIn("County parcels", html)
        self.assertIn("Not a permit determination", html)
        self.assertIn("Roof outline 3278 sf", html)
        self.assertIn("@page", html)
        self.assertIn("page-break-after:always", html)
        self.assertNotIn("<button", html.lower())
        self.assertNotIn("<iframe", html.lower())
        self.assertNotIn("<video", html.lower())
        self.assertIn("Map embed omitted", html)


if __name__ == "__main__":
    unittest.main()
