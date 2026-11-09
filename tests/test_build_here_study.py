#!/usr/bin/env python3
"""Measurement honesty, scenario states, and the downloadable study file."""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEASURES = ROOT / "assets/js/build-here-measures.js"
EXPORT = ROOT / "assets/js/build-here-export.js"
STAGE = ROOT / "assets/js/build-here-stage.js"
CSS = ROOT / "assets/css/build-here.css"


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
        self.assertIn("2000", by["remodel"]["line"])
        self.assertIn("1400", by["remodel"]["line"])
        self.assertNotIn("1 sf living", by["remodel"]["line"])
        self.assertIn("2000", by["remodel"]["metric"])
        self.assertIn("does not say a permit will be issued", by["addition"]["line"])

    def test_edmonds_without_far_uses_coverage_not_a_fake_floor_cap(self):
        cards = node_call(MEASURES, """M.scenarios({
          lot: 10000, living: null, roof: 2000, zoningCoded: true, hasFloorCap: false,
          floorCap: null, roomFar: null, roomCov: 1500, fullCov: 3500, envArea: 6000,
          hasImpervious: false, roomImp: null
        })""")
        by = {c["id"]: c for c in cards}
        self.assertNotIn("floor-area cap is coded", by["addition"]["line"])
        self.assertEqual(by["addition"]["state"], "ready")
        self.assertIn("1500", by["addition"]["metric"])
        self.assertIn("no floor-area ratio", by["addition"]["line"].lower())
        self.assertIn("3500", by["teardown"]["metric"])
        self.assertNotIn("paving was not measured", by["shop"]["line"])
        self.assertEqual(by["shop"]["state"], "ready")
        self.assertNotIn("floor-area cap", by["remodel"]["line"])

    def test_zero_capacity_is_not_ready(self):
        cards = node_call(MEASURES, """M.scenarios({
          lot: 8000, living: 3000, roof: 2800, zoningCoded: true, hasFloorCap: true,
          floorCap: 3000, roomFar: 0, roomCov: 0, fullCov: 2800, hasImpervious: true, roomImp: -20
        })""")
        by = {c["id"]: c for c in cards}
        self.assertNotEqual(by["addition"]["state"], "ready")
        self.assertNotEqual(by["shop"]["state"], "ready")

    def test_manual_living_and_paving_change_the_math(self):
        data = node_call(MEASURES, """M.resolveStudy({
          lot: 12088, zoningCoded: true, hasFloorCap: false, floorCap: null, coverageCap: 4200,
          imperviousCap: null, envArea: 5000,
          auto: { roof: { sf: 3278, source: 'Mapped roof outline', method: 'roof outline', confidence: 'Low' } },
          manual: [
            { kind: 'living', sf: 1800, source: 'Assessor card', method: 'assessor', retrieved: '2026-11-09', confidence: 'Medium' },
            { kind: 'driveway', sf: 600, source: 'Survey', method: 'survey', retrieved: '2026-11-09', confidence: 'High' },
            { kind: 'hardscape', sf: 200, source: 'Survey', method: 'survey', retrieved: '2026-11-09', confidence: 'High' }
          ]
        })""")
        by = {c["id"]: c for c in data["cards"]}
        self.assertEqual(data["effective"]["living"], 1800)
        self.assertEqual(data["effective"]["buildings"], 3278)
        self.assertTrue(data["bundle"]["open"]["verifiedLandscape"])
        self.assertEqual(data["bundle"]["open"]["sf"], 12088 - 3278 - 600 - 200)
        self.assertNotIn("Surveyed", " ".join(m["label"] for m in data["bundle"]["measures"] if m["kind"] == "roof"))
        self.assertTrue(any(not m["automatic"] and m["kind"] == "living" for m in data["bundle"]["measures"]))
        self.assertIn("coverage", by["addition"]["line"].lower())

    def test_photo_cannot_be_high_confidence(self):
        photo = node_call(MEASURES, "M.cleanMeasure({ kind: 'driveway', method: 'photo', sfLow: 200, sfHigh: 400, source: 'picture', confidence: 'High' })")
        self.assertTrue(photo["ok"])
        self.assertEqual(photo["measure"]["confidence"], "Low")
        self.assertIsNone(photo["measure"]["sf"])
        listing = node_call(MEASURES, "M.cleanMeasure({ kind: 'living', method: 'listing', sf: 1900, source: 'Listing page', confidence: 'High' })")
        tape = node_call(MEASURES, "M.cleanMeasure({ kind: 'living', method: 'tape', sf: 1900, source: 'Tape', confidence: 'High' })")
        survey = node_call(MEASURES, "M.cleanMeasure({ kind: 'footprint', method: 'survey', sf: 1900, source: 'Survey sheet', confidence: 'High' })")
        self.assertEqual(listing["measure"]["confidence"], "Low")
        self.assertEqual(tape["measure"]["confidence"], "Low")
        self.assertEqual(survey["measure"]["confidence"], "Medium")

    def test_manual_paving_sets_impervious_used_for_zoning(self):
        data = node_call(MEASURES, """M.resolveStudy({
          lot: 10000, zoningCoded: true, hasFloorCap: false, coverageCap: 3500, imperviousCap: 4500,
          auto: { roof: { sf: 2000, source: 'Roof outline', method: 'roof outline' } },
          manual: [
            { kind: 'driveway', sf: 500, source: 'Survey', method: 'survey', confidence: 'High' },
            { kind: 'hardscape', sf: 100, source: 'Survey', method: 'survey', confidence: 'Medium' }
          ]
        })""")
        self.assertEqual(data["effective"]["impervious"], 2600)
        self.assertEqual(data["effective"]["roomImp"], 1900)
        by_kind = {m["kind"]: m for m in data["bundle"]["measures"]}
        self.assertEqual(by_kind["driveway"]["sf"], 500)
        self.assertEqual(by_kind["driveway"]["method"], "survey")
        self.assertFalse(by_kind["driveway"]["automatic"])
        self.assertEqual(by_kind["driveway"]["confidence"], "Medium")
        self.assertEqual(by_kind["hardscape"]["sf"], 100)
        self.assertEqual(by_kind["hardscape"]["confidence"], "Medium")
        self.assertNotEqual(by_kind["driveway"]["confidence"], "High")
        shop = next(c for c in data["cards"] if c["id"] == "shop")
        self.assertEqual(shop["state"], "ready")
        self.assertIn("1900", shop["line"])
        self.assertIn("impervious", shop["line"])
        blank = node_call(MEASURES, """M.resolveStudy({
          lot: 10000, zoningCoded: true, hasFloorCap: false, coverageCap: 3500, imperviousCap: 4500,
          auto: { roof: { sf: 2000, source: 'Roof outline', method: 'roof outline' } }
        })""")
        self.assertIsNone(blank["effective"]["impervious"])
        self.assertIsNone(blank["effective"]["roomImp"])
        blank_shop = next(c for c in blank["cards"] if c["id"] == "shop")
        self.assertEqual(blank_shop["state"], "partial")
        self.assertIn("not filled in as zero", blank_shop["line"])

    def test_remodel_card_uses_the_real_areas_not_a_boolean(self):
        cards = node_call(MEASURES, """M.scenarios({
          lot: 7643, living: 2430, roof: 1934, zoningCoded: true, hasFloorCap: false,
          floorCap: null, fullCov: null, hasImpervious: true, roomImp: null,
          aduRule: 'Up to 2 ADUs in the urban area'
        })""")
        by = {c["id"]: c for c in cards}
        self.assertEqual(by["remodel"]["state"], "ready")
        self.assertIn("2430 sf living area", by["remodel"]["line"])
        self.assertIn("1934 sf roof outline", by["remodel"]["line"])
        self.assertEqual(by["remodel"]["metric"], "2430 sf living area")
        self.assertEqual(by["shop"]["state"], "partial")
        self.assertIn("not filled in as zero", by["shop"]["line"])
        self.assertNotIn("Needs a footprint", by["shop"]["metric"])

    def test_detached_footprint_counts_once_toward_coverage(self):
        data = node_call(MEASURES, """M.resolveStudy({
          lot: 10000, zoningCoded: true, hasFloorCap: false, coverageCap: 3500,
          auto: {
            roof: { sf: 2000, source: 'Roof outline', method: 'roof outline' },
            detached: { sf: 400, source: 'Detached outline', method: 'building outline' },
            attachedGarage: { sf: 240, source: 'Assessor garage floor', method: 'assessor extract' }
          }
        })""")
        self.assertEqual(data["effective"]["buildings"], 2400)
        self.assertEqual(data["effective"]["roomCov"], 1100)


class ExportTests(unittest.TestCase):
    def test_download_file_is_not_the_print_dialog(self):
        expr = r"""
        M.buildStudyFile({
          address: 'Sample lot (not a property record)',
          date: '2026-11-09',
          limitations: 'Planning estimate only. Not a permit determination.',
          sources: [{ name: 'County parcels', ok: true, note: 'outline' }, { name: 'Listing site', ok: false, note: 'not fetched' }],
          bodyHtml: '<section class="bh-page"><h2>Study</h2><button type="button">Print</button><iframe src="https://maps.example/embed"></iframe><video src="x.mp4"></video><p>Roof outline 3278 sf</p><svg class="bh-siteplan"><path class="bh-lot" fill="#f3f1ea" stroke="#1f2933" d="M0 0 L10 0 L10 10 Z"/></svg><div class="bh-map-frame bh-noprint"><iframe src="https://maps.example/2"></iframe></div><p class="bh-print-only">Map embed omitted from print.</p></section>'
        })
        """
        html = node_call(EXPORT, expr)
        self.assertIn("Sample lot (not a property record)", html)
        self.assertIn("2026-11-09", html)
        self.assertIn("County parcels", html)
        self.assertIn("Not a permit determination", html)
        self.assertIn("Roof outline 3278 sf", html)
        self.assertIn("@page", html)
        self.assertIn("page-break-after:auto", html)
        self.assertIn(".bh-lot{fill:#f3f1ea", html)
        self.assertNotIn("page-break-after:always", html)
        self.assertNotIn("<button", html.lower())
        self.assertNotIn("<iframe", html.lower())
        self.assertNotIn("<video", html.lower())
        self.assertIn("Map embed omitted", html)

    def test_saved_file_resolves_site_links_and_drops_edit_controls(self):
        expr = r"""
        M.buildStudyFile({
          address: 'Sample lot (not a property record)',
          date: '2026-11-09',
          limitations: 'Planning estimate only. This is not a legal, zoning, or permit determination. Unknown driveway stays blank. A roof outline is not living area.',
          sources: [{ name: 'County parcels', ok: true, note: 'outline', url: 'https://gis.example/parcels' }],
          bodyHtml: '<p><a href="#bh-confirm">Edit the facts used on these cards</a></p><p><a href="./permits.html">Permit resources</a> <a href="./bid-comparison.html">How to compare bids</a></p><div class="bh-cta"><h3>Talk</h3><p><a class="bh-btn" href="./additions.html">Additions rankings</a></p></div>'
        })
        """
        html = node_call(EXPORT, expr)
        self.assertIn('<base href="https://boardofprojectstewardship.com/">', html)
        self.assertIn('href="./permits.html"', html)
        self.assertIn('href="./bid-comparison.html"', html)
        self.assertNotIn("#bh-confirm", html)
        self.assertNotIn("bh-cta", html)
        self.assertNotIn("Additions rankings", html)
        self.assertIn("not living area", html)
        self.assertIn("https://gis.example/parcels", html)

    def test_stripping_the_edit_link_does_not_leave_a_second_period(self):
        stage = node_call(STAGE, "M.renderStage({ address: 'Sample lot', date: '2026-11-09', placeLine: 'Example County (sample)', cards: [] })")
        self.assertIn('href="#bh-confirm"', stage)
        self.assertNotIn("permit. .", stage)
        self.assertIn("Nothing here is a permit.", stage)
        saved = node_call(EXPORT, "M.buildStudyFile({ address: 'Sample lot', date: '2026-11-09', bodyHtml: " + json.dumps(stage) + " })")
        self.assertNotIn("#bh-confirm", saved)
        self.assertNotIn("permit. .", saved)
        self.assertIn("Nothing here is a permit.", saved)
        self.assertIn(".bh-stage-place", saved)
        self.assertIn("color:#102a1c", saved)
        legacy = node_call(EXPORT, """M.buildStudyFile({
          address: 'Sample lot', date: '2026-11-09',
          bodyHtml: '<p class="bh-muted">Nothing here is a permit. <a href="#bh-confirm">Edit the facts used on these cards</a>.</p>'
        })""")
        self.assertNotIn("#bh-confirm", legacy)
        self.assertNotIn("permit. .", legacy)
        self.assertIn("Nothing here is a permit.", legacy)

    def test_print_header_color_comes_after_the_screen_mint(self):
        css = CSS.read_text(encoding="utf-8")
        screen_at = css.find("color:#d1fae5!important")
        self.assertGreater(screen_at, 0)
        later = css[screen_at:]
        print_at = later.find("@media print")
        self.assertGreater(print_at, 0)
        block = later[print_at:]
        self.assertIn(".bh-stage-fade .bh-kicker", block)
        self.assertIn(".bh-stage-fade .bh-stage-place", block)
        self.assertIn(".bh-stage-fade .bh-stage-date", block)
        self.assertIn("color:#102a1c!important", block)


class SnohomishImprovementTests(unittest.TestCase):
    PIN = "00370400000200"

    def test_record_reader_keeps_garage_floor_off_the_footprint(self):
        row = node_call(MEASURES, "M.readSnoImprovement([1865, 1954, 1, 240, 0, 1, '2020-12-02'])")
        self.assertEqual(row["fin"], 1865)
        self.assertEqual(row["year"], 1954)
        self.assertEqual(row["stories"], 1)
        self.assertEqual(row["attGar"], 240)
        self.assertIsNone(row["detGar"])
        data = node_call(MEASURES, """M.resolveStudy({
          lot: 10000, zoningCoded: true, hasFloorCap: false, coverageCap: 4000,
          auto: {
            roof: { sf: 1934, source: 'Mapped roof outline', method: 'roof outline' },
            attachedGarage: { sf: 240, source: 'AttGarSF', method: 'assessor extract' },
            detachedGarageFloor: { sf: 600, source: 'DetGarSF', method: 'assessor extract' }
          }
        })""")
        self.assertEqual(data["effective"]["buildings"], 1934)
        kinds = {m["kind"]: m["sf"] for m in data["bundle"]["measures"]}
        self.assertEqual(kinds["attachedGarage"], 240)
        self.assertEqual(kinds["detachedGarageFloor"], 600)
        self.assertNotIn("footprint", kinds)

    def test_public_pin_matches_the_existing_house_size_index(self):
        shard = json.loads((ROOT / "assets/data/sno-bldg" / (self.PIN[:4] + ".json")).read_text(encoding="utf-8"))
        house = json.loads((ROOT / "assets/data/house-size/snoh" / (self.PIN[:4] + ".json")).read_text(encoding="utf-8"))
        rec = shard["b"][self.PIN]
        self.assertEqual(rec[0], house[self.PIN][0])
        self.assertEqual(rec[1], house[self.PIN][1])
        self.assertEqual(rec[2], house[self.PIN][3])
        self.assertEqual(rec, [1865, 1954, 1, 240, 0, 1, "2020-12-02"])
        self.assertEqual(shard["sourceModified"], "2026-07-30")
        self.assertIn("FinSize", shard["fields"])
        self.assertNotIn("Owner", shard["fields"])
        self.assertNotIn("Site_Address", json.dumps(shard["b"][self.PIN]))
        meta = json.loads((ROOT / "assets/data/sno-bldg/_meta.json").read_text(encoding="utf-8"))
        self.assertGreater(meta["parcels"], 200000)
        self.assertIn("Owner names", meta["omitted"])
        script = (ROOT / "scripts/build_sno_bldg_index.py").read_text(encoding="utf-8")
        self.assertIn('"PIN", "ImprType", "Stories", "YrBuilt", "FinSize", "AttGarSF", "DetGarSF", "LastUpdD"', script)
        self.assertNotIn("Owner_Name", script)
        self.assertNotIn("Taxpayer", script)


class TerrainEstimateTests(unittest.TestCase):
    def test_downhill_direction_is_opposite_the_uphill_gradient(self):
        west = node_call(ROOT / "assets/js/build-here-landscape.js", "M.fallFromGradient(1, 0)")
        south = node_call(ROOT / "assets/js/build-here-landscape.js", "M.fallFromGradient(0, 1)")
        flat = node_call(ROOT / "assets/js/build-here-landscape.js", "M.fallFromGradient(0, 0)")
        self.assertEqual(west["compass"], "west")
        self.assertEqual(west["deg"], 270)
        self.assertEqual(south["compass"], "south")
        self.assertEqual(south["deg"], 180)
        self.assertEqual(flat["compass"], "flat")
        self.assertIsNone(flat["deg"])


if __name__ == "__main__":
    unittest.main()
