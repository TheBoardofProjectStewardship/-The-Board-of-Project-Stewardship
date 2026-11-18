/* A study to test with: a rectangular lot shaped like the mockup's (5514 160th Ave NE, Redmond), with the
   street on its west side. Every figure here is made up for the tests. Nothing is read from the network.
   state() returns what the page holds after a lookup; context() works out the figures the way the page does. */
"use strict";
globalThis.BuildHereGeom = require("../../../assets/feasibility/build-here-geom.js");
globalThis.BuildHereRules = require("../../../assets/feasibility/build-here-rules.js");
var G = globalThis.BuildHereGeom, R = globalThis.BuildHereRules;
var Ms = require("../../../assets/feasibility/build-here-measures.js");

var LAT = 47.6573, LON = -122.1273, W = 120.69, H = 79.56;
var fr = G.frame(LAT, LON);
function ll(x, y) { return fr.inv(x, y); }
function rectLL(x0, y0, x1, y1) { return [ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)]; }
function rectFt(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]; }
var X0 = -W / 2, X1 = W / 2, Y0 = -H / 2, Y1 = H / 2;
var LOT = [rectLL(X0, Y0, X1, Y1)];
/* Neighbors: north, south, east (behind), and across the 60 ft street to the west. The county query also returns the lot itself. */
function neighbors(o) {
  o = o || {};
  var n = [LOT[0], rectLL(X0, Y1, X1, Y1 + 80)];
  if (!o.corner) n.push(rectLL(X0, Y0 - 80, X1, Y0));
  n.push(rectLL(X1 + (o.rearGap || 0), Y0, X1 + (o.rearGap || 0) + 120, Y1));
  n.push(rectLL(X0 - 180, Y0, X0 - 60, Y1));
  if (o.corner) n.push(rectLL(X0, Y0 - 140, X1, Y0 - 60));
  return n;
}
var HOUSE = rectFt(-42, -22, -8, 24.5);          // 34 x 46.5 = 1,581 sf
function geo(o) {
  o = o || {};
  var streets = [{ line: [[X0 - 30, -400], [X0 - 30, 400]], name: "160th Avenue Northeast", kind: "street" }];
  if (o.corner) streets.push({ line: [[-400, Y0 - 30], [400, Y0 - 30]], name: "Northeast 55th Street", kind: "street" });
  if (o.alley) streets.push({ line: [[X1 + 8, -400], [X1 + 8, 400]], name: "", kind: "alley" });
  // Ground that falls 19 ft from the street to the back of the lot.
  var x0 = X0 - 40, y0 = Y0 - 40, step = 10, nx = Math.ceil((W + 80) / step) + 1, ny = Math.ceil((H + 80) / step) + 1, vals = [];
  for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) vals.push(179 - (x0 + i * step - X0) * 19 / W);
  var buildings = o.noHouse ? [] : [{ ring: HOUSE, rings: [HOUSE], sf: 1581, sfOnLot: 1581, role: "house", straddle: false, note: "" }];
  if (o.shed) buildings.push({ ring: rectFt(30, 20, 42, 32), rings: [rectFt(30, 20, 42, 32)], sf: 144, sfOnLot: 144, role: "other", straddle: false, note: "" });
  buildings.push({ ring: rectFt(-40, Y1 + 12, 0, Y1 + 50), rings: [rectFt(-40, Y1 + 12, 0, Y1 + 50)], sf: 1520, sfOnLot: null, role: "neighbor", straddle: false, note: "" });
  return {
    frame: { lat0: fr.lat0, lon0: fr.lon0 }, lot: [rectFt(X0, Y0, X1, Y1)], point: [-30, 0], buildings: buildings,
    drives: [], driveLines: o.drive ? [{ line: [[X0 - 30, -30], [-42, -30]], widthFt: 10 }] : [], hard: [], streets: o.noStreets ? [] : streets,
    sidewalks: o.sidewalk ? [{ line: [[X0 - 8, -400], [X0 - 8, 400]] }] : [], trees: o.tree ? [{ x: 40, y: -25, src: "OpenStreetMap" }] : [],
    dem: o.noDem ? null : { x0: x0, y0: y0, step: step, nx: nx, ny: ny, vals: vals, res: 1 }, demFine: null,
    src: { buildings: "OpenStreetMap building outlines (volunteer mapped)", paving: "OpenStreetMap driveways and parking", streets: "OpenStreetMap" }
  };
}
function state(o) {
  o = o || {};
  var pt = o.pointSouth ? ll(20, Y0 + 4) : ll(-30, 0), g = geo(o);
  return {
    input: "5514 160th Ave NE, Redmond, WA 98052", matched: "5514 160TH AVE NE, REDMOND, WA, 98052", lon: pt[0], lat: pt[1],
    county: "King County", city: "Redmond", stateAbbr: "WA", stateName: "Washington", juris: "city", cityKey: R.cityKey("Redmond"), jurisLabel: "City of Redmond, King County",
    parcel: "2155000300", assessorUrl: "https://blue.kingcounty.com/Assessor/eRealProperty/Detail.aspx?ParcelNbr=2155000300", parcelMatch: "address",
    lot: 9600, lotSrc: "King County Assessor (LOTSQFT)", lotKind: "record", zone: "NR", zoneSrc: "City of Redmond zoning map",
    existing: 1840, existingSrc: "King County Assessor residential building extract (SqFtTotLiving), county file dated 2026-10-28", existingAsOf: "2026-10-28",
    footprint: o.noHouse ? null : 1581, footprintSrc: o.noHouse ? "" : "OpenStreetMap building outlines (volunteer mapped)", footprintKind: "roof",
    firstFloor: 1220, garageFloor: 550, basementTotal: 1220, basementFinished: 620, basementGarage: null, deck: 180, beds: 3, baths: 1.75,
    yearBuilt: "1967", yearSrc: "King County Assessor residential building extract (YrBuilt)", years: [{ y: 1967, src: "King County Assessor residential building extract (YrBuilt)" }],
    stories: 1, storiesSrc: "King County Assessor residential building extract (Stories)",
    rings: LOT, neighborRings: o.noNeighbors ? null : neighbors(o), hazards: [], hazardNotes: [], hazardSource: "King County Sensitive Areas map service", hazardScope: "parcel", nearNotices: [],
    permits: [], permitSearch: "none", permitLinks: [], frontDir: "",
    imagery: { url: "https://example.org/aerial.jpg", path: "M100 100L700 100L700 500L100 500Z", W: 800, H: 600, credit: "Imagery: King County GIS, 2025 aerial (gismaps.kingcounty.gov)" },
    sources: [], manual: [], prepared: "2026-11-17", owner: "CANARY OWNER NAME",
    landscape: {
      ok: true, mode: "lot", osmUsed: true, notes: [], sources: [], lot: { sf: 9600, outlineSf: Math.round(W * H) }, survey: { plat: "EAST CRESCENT LANE", lot: "30", block: "", major: "215500", minor: "0300" },
      rows: [
        { key: "lot", label: "Lot area", sf: 9600, pct: 100, conf: "High", src: "King County Assessor (LOTSQFT)" },
        o.noHouse ? { key: "house", label: "House footprint", sf: null, conf: "Unavailable", src: "No building outline intersected this lot." } : { key: "house", label: "House footprint (on this lot)", sf: 1581, pct: 16.5, conf: "Medium-low", src: "OpenStreetMap building outlines (volunteer mapped)" },
        { key: "garage", label: "Detached garage / accessory building", sf: null, conf: "Unavailable", src: "No separate garage building is mapped on this lot." },
        o.drive ? { key: "drive", label: "Driveway and parking", est: true, sf: 180, pct: 1.9, conf: "Low (estimated)", src: "OpenStreetMap driveways and parking" } : { key: "drive", label: "Driveway and parking", sf: null, conf: "Unavailable", src: "The layer answered and did not map a driveway." },
        { key: "hard", label: "Walkways, patios, decks and other hardscape", sf: null, conf: "Unavailable", src: "No free public walkway or patio layer covers this address. Left blank, not zero." },
        { key: "land", label: "Unclassified open area (not verified landscaping)", sf: o.noHouse ? null : 8020, verifiedLandscape: false, pct: 83.5, conf: "Low", src: "Lot area minus mapped building coverage only." }
      ],
      slope: { ok: true, step: 4, samples: 600, res: 1, mean: 16, median: 16, p95: 17, max: 18, pct15: 92, pct25: 0, pct40: 0, elevMin: 160, elevMax: 179, fallPct: 15.7, fallDeg: 90, fallCompass: "east" },
      geo: g
    }
  };
}
function view(s, o) {
  o = o || {};
  return { lot: o.lot !== undefined ? o.lot : s.lot, zone: o.zone !== undefined ? o.zone : s.zone, existing: s.existing, footprint: s.footprint, imperv: null, front: "", units: 1, stories: String(s.stories || 1), type: o.type || "addition" };
}
function rules(s, v) { return R.pick({ juris: s.juris, city: s.cityKey, zone: v.zone, lot: v.lot, units: v.units, house: v.existing }); }
function row(s, key) { var rows = s.landscape.rows; for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i]; return null; }
function rec(sf, source, method, extra) { var o = { sf: sf, source: source, retrieved: "2026-11-17", method: method, confidence: "Medium" }; for (var k in (extra || {})) o[k] = extra[k]; return o; }
/* The figures the page works out before it draws: the same call the page makes. envArea comes from the lot lines. */
function context(s, v, rs, envArea) {
  var coded = !!(rs && rs.coded !== false), d = row(s, "drive");
  var solved = Ms.resolveStudy({
    lot: v.lot, date: s.prepared, zoningCoded: coded,
    hasFloorCap: !coded ? null : (rs.floorCap != null ? true : (rs.farNone ? false : null)), floorCap: coded && rs.floorCap != null ? rs.floorCap : null,
    coverageCap: coded && rs.coverage != null ? rs.coverage : null, imperviousCap: coded && rs.impervious != null ? rs.impervious : null,
    imperv: v.imperv, envArea: envArea, accounting: rs ? rs.accounting : null, garageNone: !!s.garageNone, basementNone: !!s.basementNone, edit: {}, manual: s.manual || [],
    auto: {
      living: s.existing != null ? rec(s.existing, s.existingSrc, "assessor extract") : null,
      roof: s.footprint != null ? rec(s.footprint, s.footprintSrc, "roof outline", { confidence: "Low" }) : null,
      firstFloor: s.firstFloor != null ? rec(s.firstFloor, "Assessor first floor", "assessor extract") : null,
      attachedGarage: s.garageFloor > 0 ? rec(s.garageFloor, "Assessor garage area", "assessor extract") : null,
      basementTotal: s.basementTotal > 0 ? rec(s.basementTotal, "Assessor basement", "assessor extract") : null,
      basementFinished: s.basementFinished > 0 ? rec(s.basementFinished, "Assessor finished basement", "assessor extract") : null,
      deck: s.deck > 0 ? rec(s.deck, "Assessor deck", "assessor extract") : null,
      countyFinSize: s.countyFin && s.countyFin.sf > 0 ? rec(s.countyFin.sf, s.countyFin.source, "assessor extract", { confidence: "Low" }) : null,
      drive: d && d.sf != null ? rec(d.sf, d.src, "centerline estimate", { confidence: "Low" }) : null
    }
  });
  var options = Ms.options({
    effective: solved.effective, zoningCoded: coded, hasFloorCap: !coded ? null : (rs.floorCap != null ? true : (rs.farNone ? false : null)), floorCap: coded && rs.floorCap != null ? rs.floorCap : null,
    coverageCap: coded && rs.coverage != null ? rs.coverage : null, imperviousCap: coded && rs.impervious != null ? rs.impervious : null, envArea: envArea,
    stories: parseFloat(v.stories) || null, firstFloor: s.firstFloor, heightFt: rs && rs.height ? rs.height.ft : null, adu: rs ? rs.adu : null
  });
  return { bundle: solved.bundle, cards: solved.cards, effective: solved.effective, options: options, prepared: s.prepared };
}
var BRAND = { name: "Pacific Pro Group LLC", tagline: "Design-Build", phone: "(206) 446-5656", email: "admin@pacificprogroup.com", site: "pacificprogroup.com", services: "Additions · ADUs · New homes · Kitchen & bath remodels · King & Snohomish counties", license: "", logoUrl: "" };

module.exports = { G: G, R: R, Ms: Ms, fr: fr, ll: ll, rectLL: rectLL, rectFt: rectFt, W: W, H: H, X0: X0, X1: X1, Y0: Y0, Y1: Y1, LOT: LOT, HOUSE: HOUSE, neighbors: neighbors, geo: geo, state: state, view: view, rules: rules, context: context, BRAND: BRAND };
