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
    def test_finsize_is_not_living_area_and_warns_on_the_cards(self):
        made = node_call(MEASURES, "M.countyFinSizeRecord([1865, 1954, 1, 240, 0, 2, '2020-12-02'])")
        self.assertEqual(made["confidence"], "Low")
        self.assertIn("not total finished living area", made["note"])
        self.assertIn("2 active dwelling rows", made["note"])
        self.assertIn("largest FinSize", made["note"])
        self.assertIn("not added", made["note"])
        data = node_call(MEASURES, """M.resolveStudy({
          lot: 10000, zoningCoded: true, hasFloorCap: true, floorCap: 3000, coverageCap: 4000,
          auto: {
            living: { sf: 1600, source: 'Another finished-area figure', method: 'assessor extract', confidence: 'Medium' },
            roof: { sf: 1934, source: 'Mapped roof outline', method: 'roof outline' },
            countyFinSize: M.countyFinSizeRecord([1865, 1954, 1, 240, 0, 2, '2020-12-02']),
            attachedGarage: { sf: 240, source: 'AttGarSF', method: 'assessor extract' }
          }
        })""")
        self.assertEqual(data["effective"]["living"], 1600)
        self.assertEqual(data["effective"]["buildings"], 1934)
        self.assertNotEqual(data["effective"]["buildings"], 1934 + 240)
        kinds = {m["kind"]: m for m in data["bundle"]["measures"]}
        self.assertIn("basement", kinds["countyFinSize"]["label"].lower())
        self.assertIn("not total finished living area", kinds["countyFinSize"]["note"])
        self.assertTrue(any("Both stay visible" in n for n in data["bundle"]["notes"]))
        remodel = next(c for c in data["cards"] if c["id"] == "remodel")
        self.assertIn("1600", remodel["line"])
        self.assertIn("not used as finished living area", remodel["line"])
        self.assertIn("largest row", remodel["line"])
        self.assertNotIn("1865 sf living", remodel["line"])

    def test_workbook_source_is_gated_off_and_not_published(self):
        js = (ROOT / "assets/js/build-here.js").read_text(encoding="utf-8")
        landscape = (ROOT / "assets/js/build-here-landscape.js").read_text(encoding="utf-8")
        script = (ROOT / "scripts/build_sno_bldg_index.py").read_text(encoding="utf-8")
        workflow = (ROOT / ".github/workflows/house-size-index.yml").read_text(encoding="utf-8")
        config = (ROOT / "_config.yml").read_text(encoding="utf-8")
        self.assertIn("var SNO_IMPR_ENABLED = false", js)
        self.assertNotIn("/assets/data/sno-bldg/", js)
        self.assertIn("Not enabled", js)
        self.assertIn('== "A"', script)
        self.assertIn("HOLD:", script)
        self.assertNotIn("sno-bldg", workflow)
        self.assertIn("assets/data/sno-bldg", config)
        self.assertFalse((ROOT / "assets/data/sno-bldg").exists())
        self.assertNotIn("exportImage", landscape)
        self.assertNotIn("Aspect Map", landscape)
        self.assertNotIn("Preset 10ft", landscape)
        self.assertIn("contour and aspect pictures are not shown", landscape)


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


class ReviewRegressionTests(unittest.TestCase):
    """Guards for the defects fixed after the PR #208 review."""

    RULES = ROOT / "assets/js/build-here-rules.js"
    MAIN = ROOT / "assets/js/build-here.js"
    LANDSCAPE = ROOT / "assets/js/build-here-landscape.js"

    def test_rule_sets_say_when_a_zone_is_not_coded_and_when_far_is_none(self):
        data = node_call(self.RULES, """({
          kent: M.pick({ juris: 'city', city: 'kent', zone: 'SR-6', lot: 7200, units: 1 }),
          snoUrban: M.pick({ juris: 'sno', zone: 'R-7,200', lot: 7200 }),
          edmonds: M.pick({ juris: 'edmonds', zone: 'LDR-M', lot: 10000 }),
          kenmore: M.pick({ juris: 'kenmore', zone: 'R-6', lot: 7200 }),
          kcUrban: M.pick({ juris: 'kc', zone: 'R6', lot: 7200 }),
          kirkland: M.pick({ juris: 'city', city: 'kirkland', zone: 'RS 8.5', lot: 8500, units: 1 }),
          seattle: M.pick({ juris: 'seattle', zone: 'NR3', lot: 5000, units: 1 })
        })""")
        self.assertIs(data["kent"]["coded"], False)
        self.assertIs(data["snoUrban"]["coded"], False)
        for key in ("edmonds", "kenmore", "kcUrban"):
            self.assertIs(data[key].get("farNone"), True, key)
            self.assertNotEqual(data[key].get("coded"), False, key)
        # Kirkland on a 7,200 sf or larger lot: the table has a floor-area rule this file does not code.
        self.assertIsNone(data["kirkland"]["floorCap"])
        self.assertIsNone(data["kirkland"].get("farNone"))
        self.assertIsNotNone(data["seattle"]["floorCap"])
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn("zoningCoded: coded,", main)
        self.assertNotIn("zoningCoded: !!rs", main)
        self.assertNotIn("hasFloorCap: !!(rs", main)

    def test_unknown_floor_area_limit_is_never_worded_as_none(self):
        cards = node_call(MEASURES, """M.scenarios({
          lot: 8500, living: 2600, roof: 1900, zoningCoded: true, hasFloorCap: null,
          floorCap: null, roomFar: null, fullCov: 4250, roomCov: 2350, hasImpervious: false,
          aduStateNote: 'Cities inside the urban growth area must allow two ADUs per lot'
        })""")
        by = {c["id"]: c for c in cards}
        for key in ("addition", "teardown"):
            self.assertEqual(by[key]["state"], "partial", key)
            self.assertIn("not coded here", by[key]["line"], key)
            self.assertNotIn("no floor-area ratio", by[key]["line"].lower(), key)
        self.assertNotEqual(by["shop"]["state"], "ready")
        self.assertIn("floor-area limit may also apply", by["shop"]["line"])
        text = " ".join(c["line"] for c in cards)
        self.assertNotIn("The zone is recognized", text)

    def test_statewide_adu_floor_alone_is_not_ready(self):
        floor_only = node_call(MEASURES, """M.scenarios({ lot: 7200, living: 1800, roof: 1500, zoningCoded: false,
          aduStateNote: 'Cities inside the urban growth area must allow two ADUs per lot' })""")
        adu = next(c for c in floor_only if c["id"] == "adu")
        self.assertEqual(adu["state"], "partial")
        self.assertIn("State-law floor only", adu["metric"])
        self.assertIn("does not say an ADU fits", adu["line"])
        local = node_call(MEASURES, "M.scenarios({ lot: 7200, zoningCoded: true, aduRule: 'Up to 2 per lot', aduStateNote: 'x' })")
        self.assertEqual(next(c for c in local if c["id"] == "adu")["state"], "ready")
        main = (ROOT / "assets/js/build-here.js").read_text(encoding="utf-8")
        self.assertIn("/state law/i.test(r.label)", main)

    def test_site_and_match_cautions_drop_ready_cards_to_partial(self):
        base = "lot: 5000, living: 2000, roof: 1400, zoningCoded: true, hasFloorCap: true, floorCap: 3000, roomFar: 1000, roomCov: 1100, fullCov: 2500, hasImpervious: false, aduRule: 'Up to 2 per lot'"
        clean = {c["id"]: c for c in node_call(MEASURES, "M.scenarios({ " + base + " })")}
        self.assertTrue(all(c["state"] == "ready" for c in clean.values()))
        site = {c["id"]: c for c in node_call(MEASURES, "M.scenarios({ " + base + ", siteCaution: 'This lot has a mapped critical area or hazard.' })")}
        for key in ("addition", "adu", "shop", "teardown"):
            self.assertEqual(site[key]["state"], "partial", key)
            self.assertIn("mapped critical area", site[key]["line"], key)
        self.assertEqual(site["remodel"]["state"], "ready")
        match = node_call(MEASURES, "M.scenarios({ " + base + ", matchCaution: 'This lot was matched by location.' })")
        self.assertTrue(all(c["state"] == "partial" and "matched by location" in c["line"] for c in match))

    def test_missing_house_footprint_is_not_zero(self):
        data = node_call(MEASURES, """M.resolveStudy({
          lot: 10000, zoningCoded: true, hasFloorCap: false, coverageCap: 3500, auto: {},
          manual: [{ kind: 'detachedGarage', sf: 400, source: 'Survey sheet', method: 'survey', confidence: 'Medium' }]
        })""")
        self.assertIsNone(data["effective"]["buildings"])
        self.assertIsNone(data["effective"]["roomCov"])
        self.assertNotEqual(data["cards"][0]["state"], "ready")
        self.assertTrue(any("not treated as zero" in n for n in data["bundle"]["notes"]))

    def test_typed_gross_floor_area_sets_floor_room(self):
        data = node_call(MEASURES, """M.resolveStudy({
          lot: 5000, zoningCoded: true, hasFloorCap: true, floorCap: 3000, coverageCap: 2500,
          auto: { living: { sf: 2200, source: 'Assessor', method: 'assessor extract' }, roof: { sf: 1300, source: 'Outline', method: 'roof outline' } },
          manual: [{ kind: 'gfa', sf: 2950, source: 'Permit plan A1.0', method: 'permit', confidence: 'Medium' }]
        })""")
        self.assertEqual(data["effective"]["floorUsed"], 2950)
        self.assertEqual(data["effective"]["floorBasis"], "gfa")
        self.assertEqual(data["effective"]["roomFar"], 50)
        self.assertEqual(data["effective"]["living"], 2200)
        self.assertIn("gross floor area you entered", data["cards"][0]["line"])
        plain = node_call(MEASURES, """M.resolveStudy({ lot: 5000, zoningCoded: true, hasFloorCap: true, floorCap: 3000,
          auto: { living: { sf: 2200, source: 'Assessor', method: 'assessor extract' } } })""")
        self.assertEqual(plain["effective"]["roomFar"], 800)
        self.assertIn("stands in for code-counted floor area", plain["cards"][0]["line"])

    def test_snohomish_footprint_has_one_source_and_parcels_are_ranked(self):
        main = self.MAIN.read_text(encoding="utf-8")
        sno = main.split("function snoParcel(", 1)[1].split("/* County-use hold.", 1)[0]
        self.assertNotIn("BUILDINGS__roofprints", sno)
        self.assertNotIn("s.footprint =", sno)
        king = main.split("function kingParcel(", 1)[1].split("function snoParcel(", 1)[0]
        for body in (king, sno):
            self.assertNotIn("(j.features || [])[0]", body)
            self.assertNotIn("(k.features || [])[0]", body)
            self.assertIn("rankParcels(", body)
            self.assertIn("noteParcelMatch(", body)
        self.assertIn("PointAddress|Subaddress|StreetAddress", main)

    def test_stylesheet_does_not_change_how_a_host_page_prints(self):
        css = CSS.read_text(encoding="utf-8")
        self.assertNotIn("body *{visibility:hidden}", css)
        self.assertNotIn("#bh-report{position:absolute", css)
        self.assertNotIn(",button,iframe,video,", css)
        self.assertNotIn("@page", css)
        self.assertNotIn("{*,*::before", css)
        self.assertEqual(css.count("td[data-label]::before"), css.count(".bh-page td[data-label]::before"))
        self.assertIn("body.bh-printing>*:not(#bh-print-host){display:none!important}", css)
        self.assertIn(".bh-print-copy .bh-scenario{animation:none!important}", css)
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn('window.addEventListener("beforeprint"', main)
        self.assertIn('window.addEventListener("afterprint", cleanupPrint)', main)

    def test_outline_is_registered_to_the_photo_on_screen_and_in_the_file(self):
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn('preserveAspectRatio="xMidYMid slice"', main)
        css = CSS.read_text(encoding="utf-8")
        self.assertIn(".bh-stage-map .bh-aerial-frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}", css)
        html = node_call(EXPORT, "M.buildStudyFile({ address: 'Sample lot', date: '2026-11-12', bodyHtml: '<p>x</p>', baseHref: 'https://example.com/', brand: 'Example Builders' })")
        self.assertIn(".bh-aerial-frame svg{position:absolute;inset:0;width:100%;height:100%;background:transparent}", html)
        self.assertIn(".bh-scenario-svg{width:100%;height:auto}", html)
        self.assertIn("@media screen and (max-width:699px)", html)
        self.assertIn("overflow-wrap:anywhere", html)
        self.assertIn('<base href="https://example.com/">', html)
        self.assertIn("<header><p>Example Builders</p>", html)
        self.assertIn("<title>Feasibility study: Sample lot</title>", html)

    def test_map_data_is_escaped_and_the_address_stays_home(self):
        main = self.MAIN.read_text(encoding="utf-8")
        landscape = self.LANDSCAPE.read_text(encoding="utf-8")
        self.assertIn("s.hazards.map(esc).join", main)
        self.assertNotIn('s.hazards.join(", ")', main)
        self.assertIn("safeUrl(a.Property_Account_Summary)", main)
        self.assertNotIn("mail.ru", landscape)
        self.assertNotIn("localStorage.setItem", main)
        self.assertNotIn('"https://maps.google.com/maps?q=" + mapsQ', main)
        self.assertNotIn("bh-photoreal-3d", main)
        self.assertIn("DISCOVERY_HOST.test(r.url)", landscape)
        self.assertIn('params.delete("address")', main)

    def test_nothing_found_is_only_said_about_what_was_searched(self):
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn('permitSearch: "none"', main)
        self.assertIn("Permit history was not searched.", main)
        self.assertNotIn("in the public permit layers we can read from the browser", main)
        self.assertIn("Only county layers were read.", main)
        self.assertIn("if (!jobs.length) return Promise.resolve();", main)


def js_slice(path, start, end):
    """Source text of the functions between two markers in a browser script, for running under Node."""
    text = Path(path).read_text(encoding="utf-8")
    return text[text.index(start):text.index(end)]


def node_eval(source, expr):
    script = source + "\nconsole.log(JSON.stringify(" + expr + "));\n"
    return json.loads(subprocess.check_output(["node", "-e", script], text=True))


class SecondPassTests(unittest.TestCase):
    """Guards for the Medium findings of the PR #208 review."""

    RULES = ROOT / "assets/js/build-here-rules.js"
    MAIN = ROOT / "assets/js/build-here.js"
    LANDSCAPE = ROOT / "assets/js/build-here-landscape.js"

    def test_typed_areas_are_read_strictly(self):
        src = js_slice(self.MAIN, "  function parseArea(text) {", "  function fieldError(")
        got = node_eval(src, "['-5000','0.25 acres','12 000','5000-6000','1e5','abc','','7200','5,000 sf','1,234.5 sq ft','7200 square feet'].map(t => parseArea(t))")
        for bad in got[:6]:
            self.assertIsNone(bad["value"], bad)
            self.assertTrue(bad["error"], bad)
        self.assertEqual(got[6], {"value": None, "error": ""})
        self.assertEqual([g["value"] for g in got[7:]], [7200, 5000, 1234.5, 7200])
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertNotIn('parseFloat(String($(id).value)', main)
        self.assertIn('el.setAttribute("aria-invalid", "true")', main)

    def test_the_oldest_year_built_wins_whatever_order_the_records_arrive_in(self):
        src = js_slice(self.MAIN, "  function noteYear(s, y, src) {", "  /* ---------- lookup pipeline ---------- */")
        got = node_eval(src, """(() => {
          const a = {}, b = {};
          noteYear(a, 2015, 'city, newest building'); noteYear(a, 1925, 'county extract');
          noteYear(b, '1925', 'county extract'); noteYear(b, 2015, 'city, newest building'); noteYear(b, 0, 'blank'); noteYear(b, 'n/a', 'junk');
          return [a, b];
        })()""")
        for s in got:
            self.assertEqual(s["yearBuilt"], "1925")
            self.assertEqual(s["yearSrc"], "county extract")
            self.assertEqual([r["y"] for r in s["years"]], [1925, 2015])
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertNotIn("s.yearBuilt = f.attributes.YEAR_BUILT", main)
        self.assertIn("The older year is the one used for the asbestos and lead-paint flag.", main)

    def test_a_corner_lot_has_one_front_one_street_side_one_rear_and_one_side(self):
        src = js_slice(self.MAIN, "  function segDistXY(px, py, a, b) {", "  function envelopeRows(ring, edges, dist) {")
        got = node_eval(src, """(() => {
          // 50 x 100 ft lot. Street on the south and the east. Neighbors on the north and the west.
          const ring = [[-25, 0], [25, 0], [25, 100], [-25, 100], [-25, 0]];
          const nb = [[[-25, 100], [25, 100], [25, 200], [-25, 200], [-25, 100]], [[-75, 0], [-25, 0], [-25, 100], [-75, 100], [-75, 0]]];
          const corner = classifyEdges(ring, [0, -5], '', nb);
          const mid = classifyEdges(ring, [0, -5], '', nb.concat([[[25, 0], [75, 0], [75, 100], [25, 100], [25, 0]]]));
          const kinds = (r) => r.edges.map(e => e.kind);
          return { corner: kinds(corner), isCorner: !!corner.corner, mid: kinds(mid), midCorner: !!mid.corner };
        })()""")
        self.assertEqual(got["corner"], ["front", "street", "rear", "side"])
        self.assertTrue(got["isCorner"])
        self.assertEqual(got["mid"], ["front", "side", "rear", "side"])
        self.assertFalse(got["midCorner"])
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn('e.kind === "front" || e.kind === "street" ? sb.front', main)
        self.assertIn("mainRingIndex(s.rings)", main)
        self.assertNotIn("toFeet([s.rings[0]]", main)
        self.assertIn("sitePlanSVG(s, rs) + sitePlanKey(s, rs)", main)
        self.assertEqual(main.count("envelopeRows(ring, ce.edges"), 1)  # one raster per redraw

    def test_a_patio_is_not_the_whole_hardscape(self):
        base = "lot: 10000, zoningCoded: true, hasFloorCap: false, coverageCap: 3500, imperviousCap: 4500, auto: { roof: { sf: 2000, source: 'Roof outline', method: 'roof outline' }%s }, manual: [{ kind: 'driveway', sf: 500, source: 'Survey', method: 'survey' }%s]"
        patio = ", { kind: 'patio', sf: 200, source: 'Tape', method: 'tape' }"
        only = node_call(MEASURES, "M.resolveStudy({ " + base % ("", patio) + " })")
        self.assertIsNone(only["effective"]["hard"])
        self.assertIsNone(only["effective"]["impervious"])
        self.assertFalse(only["bundle"]["open"]["verifiedLandscape"])
        self.assertTrue(any("A patio alone is not all the hardscape" in n for n in only["bundle"]["notes"]))
        self.assertNotEqual(next(c for c in only["cards"] if c["id"] == "shop")["state"], "ready")
        mapped = node_call(MEASURES, "M.resolveStudy({ " + base % (", hard: { sf: 800, source: 'City impervious layer', method: 'paved-surface layer' }", patio) + " })")
        self.assertEqual(mapped["effective"]["hard"], 800)  # the typed patio does not replace the mapped figure
        self.assertTrue(any("already covers patios" in n for n in mapped["bundle"]["notes"]))
        both = node_call(MEASURES, "M.resolveStudy({ " + base % ("", ", { kind: 'hardscape', sf: 300, source: 'Survey', method: 'survey' }" + patio) + " })")
        self.assertEqual(both["effective"]["hard"], 500)
        self.assertTrue(any("added together" in n for n in both["bundle"]["notes"]))

    def test_the_study_says_which_of_two_figures_the_math_uses(self):
        data = node_call(MEASURES, """M.resolveStudy({ lot: 5000, zoningCoded: true, hasFloorCap: true, floorCap: 3000,
          auto: { living: { sf: 2100, source: 'County assessor', method: 'assessor extract' } },
          manual: [{ kind: 'living', sf: 2480, source: 'Listing page', method: 'listing' }] })""")
        self.assertEqual(data["effective"]["living"], 2480)
        note = next(n for n in data["bundle"]["notes"] if "has 2 figures" in n)
        self.assertIn("2480 sf", note)
        self.assertIn("Listing page", note)

    def test_an_impossible_impervious_figure_is_not_used(self):
        data = node_call(MEASURES, """M.resolveStudy({ lot: 10000, zoningCoded: true, hasFloorCap: false, coverageCap: 3500, imperviousCap: 4500, imperv: 1500,
          auto: { roof: { sf: 2000, source: 'Roof outline', method: 'roof outline' } } })""")
        self.assertTrue(data["effective"]["impervRejected"])
        self.assertIsNone(data["effective"]["impervious"])
        self.assertIsNone(data["effective"]["roomImp"])
        self.assertNotEqual(next(c for c in data["cards"] if c["id"] == "shop")["state"], "ready")
        fine = node_call(MEASURES, """M.resolveStudy({ lot: 10000, zoningCoded: true, hasFloorCap: false, coverageCap: 3500, imperviousCap: 4500, imperv: 2600,
          auto: { roof: { sf: 2000, source: 'Roof outline', method: 'roof outline' } } })""")
        self.assertEqual(fine["effective"]["roomImp"], 1900)

    def test_a_draft_zone_or_an_empty_envelope_is_not_ready(self):
        base = "lot: 5000, living: 2000, roof: 1400, zoningCoded: true, hasFloorCap: true, floorCap: 3000, roomFar: 1000, roomCov: 1100, fullCov: 2500, hasImpervious: false, aduRule: 'Up to 2 per lot'"
        draft = {c["id"]: c for c in node_call(MEASURES, "M.scenarios({ " + base + ", envArea: 2100, zoneCaution: 'The zone comes from a draft city layer.' })")}
        for key in ("addition", "adu", "shop", "teardown"):
            self.assertEqual(draft[key]["state"], "partial", key)
            self.assertIn("draft city layer", draft[key]["line"], key)
        self.assertEqual(draft["remodel"]["state"], "ready")
        empty = {c["id"]: c for c in node_call(MEASURES, "M.scenarios({ " + base + ", envArea: 0 })")}
        self.assertEqual(empty["addition"]["state"], "partial")
        self.assertIn("No area is left inside the setbacks", empty["addition"]["line"])
        self.assertNotIn("about 0 sf", empty["addition"]["line"])
        lyn = node_call(self.RULES, "M.CITY.lynnwood.gis")
        self.assertIs(lyn["draft"], True)
        self.assertIn("draft", lyn["name"])
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn("s.zoneDraft = !!g.draft", main)
        self.assertIn("check it against the City of Kenmore zoning map", main)

    def test_sammamish_envelope_uses_the_row_for_the_largest_house_the_lot_can_hold(self):
        data = node_call(self.RULES, """[[7200, null], [4000, null], [10000, null], [7200, 4200]].map(([lot, house]) =>
          M.pick({ juris: 'city', city: 'sammamish', zone: 'R-4', lot: lot, units: 1, house: house }).setbacks)""")
        self.assertEqual(data[0], {"front": 20, "rear": 20, "side": 10})
        self.assertEqual(data[1], {"front": 15, "rear": 15, "side": 5})
        self.assertEqual(data[2], {"front": 25, "rear": 25, "side": 12})
        self.assertEqual(data[3], {"front": 25, "rear": 25, "side": 12})
        sea = node_call(self.RULES, "M.pick({ juris: 'seattle', zone: 'NR3', lot: 5000, units: 6 })")
        self.assertEqual(sea["setbacks"]["front"], 15)
        self.assertIn("10 ft", sea["setbackNote"])
        self.assertIn("base allowance of 4", sea["setbackNote"])

    def test_less_is_taken_and_less_is_shown(self):
        main = self.MAIN.read_text(encoding="utf-8")
        land = self.LANDSCAPE.read_text(encoding="utf-8")
        self.assertIn("h.f.attributes = null;", land)
        self.assertNotIn("out.parcelAttrs", land)
        self.assertIn("!(f.numMatch === 0 && f.dist > 0)", land)
        self.assertNotIn('"parcel " + a.PIN', main)
        self.assertNotIn("a.objectid", main)
        self.assertNotIn("a.project_name", main)
        self.assertNotIn('crossorigin="anonymous"', main)
        self.assertIn("OpenStreetMap contributors", land)
        self.assertIn('(x.pct == null ? "Not measured"', land)
        page = (ROOT / "build-here.html").read_text(encoding="utf-8")
        self.assertIn('<details class="bh-privacy">', page)
        self.assertIn("Esri World Geocoder", page)
        # The county parcel lookup searches by street address, so the notice may not say only a location is sent.
        self.assertIn("ADDR_FULL LIKE", main)
        self.assertIn("The matched address and the location of the lot then go to county, city and state map servers.", page)
        self.assertNotIn("The location of the lot then goes to county", page)

    def test_every_outside_service_has_a_switch_and_the_census_lookup_has_a_relay(self):
        main = self.MAIN.read_text(encoding="utf-8")
        land = self.LANDSCAPE.read_text(encoding="utf-8")
        for needle in ("CFG.services.esriGeocoder === false", "CFG.services.worldImagery === false", "CFG.services.googleMap === false", "if (!CFG.geocodeUrl) return direct();", "CFG.geocodeFallback === false"):
            self.assertIn(needle, main)
        for needle in ("SVC.openStreetMap === false", "SVC.msFootprints !== false", "SVC.parcelDiscovery === false"):
            self.assertIn(needle, land)
        self.assertIn('credentials: "omit"', main)
        self.assertIn("s.lookupError", main)

    def test_failures_are_reported_and_the_test_hook_is_closed(self):
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn("function aerialFailed(s, src)", main)
        self.assertIn("exportStatus(", main)
        self.assertIn("CFG.allowSample ||", main)
        self.assertIn("copyText(", main)
        self.assertNotIn("mailto:editorial@", main)
        self.assertIn('leadEmail: "editorial@boardofprojectstewardship.com"', main)
        self.assertIn('if ($("bh-man-kind")) $("bh-man-kind").focus();', main)
        self.assertIn('<h4 class="bh-scenario-kicker">', STAGE.read_text(encoding="utf-8"))
        self.assertIn('id="bh-export-status"', (ROOT / "build-here.html").read_text(encoding="utf-8"))

    def test_configured_links_keep_to_paths_and_http(self):
        src = js_slice(self.MAIN, "  function linkUrl(u) {", "  (function () { for (var k in CFG.links)")
        got = node_eval(src, "['./permits.html', '/contact/', 'https://example.com/a?b=1', 'HTTP://example.com', 'javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'mailto:a@b.co', '', null].map(linkUrl)")
        self.assertEqual(got, ["./permits.html", "/contact/", "https://example.com/a?b=1", "HTTP://example.com", "", "", "", "", "", ""])
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn("b && b.label && linkUrl(b.url)", main)
        self.assertIn("if (CFG.massingUrl) sessionStorage.setItem(SEED_KEY", main)  # no sketch page, nothing stored

    def test_the_first_screen_map_sets_no_minimum_width(self):
        # A minimum height on a box with an aspect ratio becomes a minimum width (14rem x 3/2 = 336px),
        # which made the study wider than a 390px phone.
        css = CSS.read_text(encoding="utf-8")
        rule = css[css.index(".bh-stage-map{"):]
        rule = rule[:rule.index("}")]
        self.assertIn("aspect-ratio:5/2", rule)
        self.assertNotIn("min-height", rule)

    def test_the_tool_can_be_mounted_outside_the_page_document(self):
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn("var $ = function (id) { return ROOT.getElementById(id); };", main)
        self.assertNotIn("return document.getElementById(id)", main)
        self.assertIn("CFG.autoInit !== false", main)
        self.assertIn("init: init", main)
        self.assertIn('box.className = "bh-report bh-print-copy"', main)
        self.assertIn("body.bh-printing>*:not(#bh-print-host){display:none!important}", main)

    def test_the_sketch_page_does_not_judge_the_stand_in_house(self):
        js = (ROOT / "assets/js/build-here-3d.js").read_text(encoding="utf-8")
        self.assertIn("placeholder: !!placeholder", js)
        self.assertIn("boxes.filter((b) => !b.userData.placeholder)", js)
        self.assertIn("function outline(b)", js)
        self.assertNotIn("corners(b).some((p) => !inEnv", js)
        self.assertIn("if (dirty) { dirty = false; renderer.render(scene, camera); }", js)
        self.assertIn("const u = b.userData, a = -u.rot * Math.PI / 180", js)
        page = (ROOT / "build-here-3d.html").read_text(encoding="utf-8")
        for needle in ('id="b3-x"', 'id="b3-y"', 'aria-label="Width in feet"', 'role="img"', "window.__b3ready", "Design it in 3D: Lot Massing Sketch"):
            self.assertIn(needle, page)

    def test_styles_for_removed_sections_are_gone(self):
        css = CSS.read_text(encoding="utf-8")
        page = (ROOT / "build-here-3d.html").read_text(encoding="utf-8")
        for needle in (".b3-media-grid", ".b3-chaps", ".b3-pin", ".bh-study-media", ".bh-opt-card", ".bh-cover", ".bh-example", "Pascal", "CivilCraft"):
            self.assertNotIn(needle, css, needle)
        for needle in (".b3-media-grid", ".b3-chaps", ".b3-pin", "#b3-frame-wrap"):
            self.assertNotIn(needle, page, needle)

    def test_the_city_data_file_matches_the_rule_tables(self):
        script = """
        const R = require(process.argv[1]), J = require(process.argv[2]), out = [];
        for (const k of Object.keys(R.CITY)) {
          const c = R.CITY[k], j = J.cities[k] || {};
          const pairs = { name: [c.name, j.name], county: [c.county, j.county], tier: [c.tier, j.hb1110Tier], permits: [c.home, j.permits], code: [c.code.url, j.code],
            zoningLayer: [c.gis ? c.gis.url : null, j.zoningLayer], zoneField: [c.gis ? c.gis.field : null, j.zoneField],
            zones: [R.zonesFor(k).slice().sort().join('|'), (j.verifiedZones || []).slice().sort().join('|')] };
          for (const f in pairs) if (pairs[f][0] !== pairs[f][1]) out.push(k + ' ' + f + ': rules ' + pairs[f][0] + ' / data ' + pairs[f][1]);
        }
        console.log(JSON.stringify(out));
        """
        drift = json.loads(subprocess.check_output(["node", "-e", script, str(self.RULES), str(ROOT / "data/build-here/jurisdictions.json")], text=True))
        self.assertEqual(drift, [])


class MissingDataFileTests(unittest.TestCase):
    """A data file that is not there leaves the house size out and says so in plain words. It does not stop
    the study, and no parser or network message reaches the page. A file that is there is read as before."""

    MAIN = ROOT / "assets/js/build-here.js"
    FILE = {"src": "test", "asOf": "2026-10-20", "srcDate": "2026-10-14", "b": {"4444444444": [1800, 1962, 1, 1800, 0, 1]}}
    TRIED = "King County Assessor residential building extract"

    def read(self, answer, timeout_ms=20000):
        """Run kingLivingSqft under Node. `answer` is the JavaScript body of a stand-in for fetch(url, options)."""
        reader = js_slice(self.MAIN, "  function kingLivingSqft(s) {", "  /* After landscape split")
        script = """
var TIMEOUT = %d, CFG = { dataBase: "https://files.example/data/" }, asked = [];
function log(s, ok, name, note) { s.sources.push({ ok: ok, name: name, note: note || "" }); }
function noteYear(s, y, src) { s.yearBuilt = String(y); s.yearSrc = src; return true; }
function page(status, body) { return { ok: status >= 200 && status < 300, status: status, text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(body).then(JSON.parse); } }; }
function fetch(url, options) { asked.push(url); %s }
%s
var s = { parcel: "444444-4444", county: "King County", stateAbbr: "WA", existing: null, sources: [], factAttempts: [] };
kingLivingSqft(s).then(function () { console.log(JSON.stringify({ s: s, asked: asked })); }, function (e) { console.log(JSON.stringify({ rejected: String(e) })); });
""" % (timeout_ms, answer, reader)
        out = json.loads(subprocess.check_output(["node", "-e", script], text=True, timeout=30))
        self.assertNotIn("rejected", out, "the reader settles, it never rejects")
        self.assertEqual(out["asked"], ["https://files.example/data/kc-resbldg/44.json"], "one request, and no retry")
        return out["s"]

    def left_out(self, s, why, words):
        """The figure is absent, the reason is recorded once in plain words, and no raw error text is kept."""
        self.assertIsNone(s["existing"])
        self.assertEqual(s["existingFile"], why)
        self.assertNotIn("existingSrc", s)
        self.assertEqual(len(s["factAttempts"]), 1, s["factAttempts"])
        tried = s["factAttempts"][0]
        self.assertEqual((tried["field"], tried["name"], tried["ok"]), ("Finished living area", self.TRIED, False))
        self.assertTrue(tried["note"].startswith("The data file for this parcel (kc-resbldg/44.json) " + words), tried["note"])
        self.assertTrue(tried["note"].endswith(". Living area, year built and stories were not filled in from it."), tried["note"])
        self.assertEqual(s["sources"], [{"ok": False, "name": "King County living area", "note": "the data file " + words}])
        everything = json.dumps(s)
        for raw in ("Unexpected", "SyntaxError", "TypeError", "Failed to fetch", "is not valid JSON", "undefined", "<!doctype"):
            self.assertNotIn(raw, everything)
        return tried["note"]

    def test_a_file_that_is_there_is_read_as_before(self):
        s = self.read("return Promise.resolve(page(200, %s));" % json.dumps(json.dumps(self.FILE)))
        self.assertEqual((s["existing"], s["yearBuilt"], s["stories"], s["firstFloor"]), (1800, "1962", 1, 1800))
        self.assertEqual(s["existingSrc"], "King County Assessor residential building extract (SqFtTotLiving), county file dated 2026-10-14")
        self.assertNotIn("existingFile", s)
        self.assertEqual(s["factAttempts"], [])
        self.assertEqual(s["sources"], [{"ok": True, "name": "King County living area (SqFtTotLiving)", "note": "1800 sf"}])

    def test_a_file_that_is_not_found_leaves_the_house_size_out(self):
        for status in (404, 410):
            with self.subTest(status=status):
                note = self.left_out(self.read("return Promise.resolve(page(%d, 'Not Found'));" % status), "missing", "was not found")
                self.assertNotIn("HTTP", note)

    def test_a_web_page_in_place_of_the_file_is_not_read_as_data(self):
        # A host that answers a missing file with a page and status 200, an empty or cut-off file, and JSON of another shape.
        for body in ("<!doctype html><title>Page not found</title>", "", '{"src":"test","b":{"4444444444":[18', "null", "[]", "{}", '{"b":[]}', '{"b":"none"}', "12"):
            with self.subTest(body=body):
                self.left_out(self.read("return Promise.resolve(page(200, %s));" % json.dumps(body)), "unreadable", "could not be read")

    def test_a_host_that_fails_refuses_or_never_answers_does_not_stop_the_study(self):
        note = self.left_out(self.read("return Promise.resolve(page(503, 'Service Unavailable'));"), "error", "could not be loaded")
        self.assertIn("could not be loaded (HTTP 503). ", note)
        # A host that does not allow this site to read the file, or a dropped connection: the browser rejects the request.
        note = self.left_out(self.read("return Promise.reject(new TypeError('Failed to fetch'));"), "error", "could not be loaded")
        self.assertIn("could not be loaded. ", note)
        # The connection drops while the file is being read.
        self.left_out(self.read("return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.reject(new TypeError('network error')); } });"), "error", "could not be loaded")
        # A host that never answers is given the time limit of a map layer, then dropped.
        never = "return new Promise(function (resolve, reject) { options.signal.addEventListener('abort', function () { var e = new Error('This operation was aborted'); e.name = 'AbortError'; reject(e); }); });"
        note = self.left_out(self.read(never, timeout_ms=1000), "error", "could not be loaded")
        self.assertIn("could not be loaded (it took longer than 1 seconds). ", note)
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn('fetch(CFG.dataBase + file, { credentials: "omit", signal: ctl.signal })', main)

    def test_a_parcel_that_is_not_in_a_good_file_is_still_said_as_that(self):
        other = dict(self.FILE, b={"4411111111": [900, 1950, 1, 900, 0, 1]})
        s = self.read("return Promise.resolve(page(200, %s));" % json.dumps(json.dumps(other)))
        self.assertIsNone(s["existing"])
        self.assertNotIn("existingFile", s)
        self.assertEqual([a["note"] for a in s["factAttempts"]], ["PIN 4444444444 is not in the residential building extract."])

    def test_the_box_for_the_figure_says_why_it_is_empty(self):
        main = self.MAIN.read_text(encoding="utf-8")
        self.assertIn('existingFile: ""', main[main.index("  function blank() {"):main.index("  function log(")])
        form = main[main.index("  function fillForm(s) {"):main.index('$("bh-footprint-src").textContent')]
        self.assertIn('s.existingFile ? "The King County building data file for this parcel could not be loaded, so this box was not filled in. Enter the finished living area from the assessor page."', form)
        self.assertIn('"No finished living area found in the Assessor residential building extract for this PIN. Enter it from the assessor page."', form)
        # The old reader threw the status code and the parser's own message into the list of sources.
        reader = js_slice(self.MAIN, "  function kingLivingSqft(s) {", "  /* After landscape split")
        self.assertNotIn('throw new Error("HTTP " + r.status)', reader)
        self.assertNotIn("r.json()", reader)


if __name__ == "__main__":
    unittest.main()
