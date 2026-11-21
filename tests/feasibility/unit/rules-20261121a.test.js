/* Rules added in assets/feasibility/20261121a. node tests/feasibility/unit/rules-20261121a.test.js */
"use strict";
var t = require("./_t.js");
var R = require("../../../assets/feasibility/20261121a/build-here-rules.js");
var Ms = require("../../../assets/feasibility/20261121a/build-here-measures.js");

function pick(o) { return R.pick(o); }

var lr1m = pick({ juris: "seattle", zone: "LR1 (M)", lot: 4000, units: 1, mha: "M" });
t.ok("LR1 (M) uses the MHA floor-area column, 1.3", lr1m.floorCap === 5200 && lr1m.setbacks.front === 7 && lr1m.setbacks.rear === 7 && lr1m.setbacks.side === 5 && lr1m.setbacks.rearAlley === 0 && lr1m.height.ft === 32, [lr1m.floorCap, lr1m.setbacks, lr1m.height.ft]);
t.ok("LR1 without a suffix stays at FAR 1.0 and the same 32 ft", pick({ juris: "seattle", zone: "LR1", lot: 4000 }).floorCap === 4000 && pick({ juris: "seattle", zone: "LR1", lot: 4000 }).height.ft === 32);
var lr2m = pick({ juris: "seattle", zone: "LR2 (M)", lot: 5000 });
var lr2 = pick({ juris: "seattle", zone: "LR2", lot: 5000 });
t.ok("LR2 (M) is FAR 1.4 and 40 ft; LR2 without the suffix is FAR 1.1 and 32 ft", lr2m.floorCap === 7000 && lr2m.height.ft === 40 && lr2.floorCap === 5500 && lr2.height.ft === 32);
var lr3 = pick({ juris: "seattle", zone: "LR3 (M1)", lot: 6000 });
t.ok("LR3 (M1) is 40 ft with the suffix and does not say the unsuffixed house height", lr3.floorCap === 10800 && lr3.height.ft === 40 && /40 ft with an MHA suffix/.test(lr3.height.text) && !/without an MHA suffix is 32/.test(JSON.stringify(lr3)) && !/Stacked dwelling units can be higher/.test(lr3.height.text));
t.ok("LR3 without a suffix is 32 ft", R.pick({ juris: "seattle", zone: "LR3", lot: 6000 }).height.ft === 32);
t.ok("LR3 RC (M) is LR3 with the suffix", R.parseLr("LR3 RC (M)").base === "LR3" && R.parseLr("LR3 RC (M)").mha === "M" && R.pick({ juris: "seattle", zone: "LR3 RC (M)", lot: 5000 }).height.ft === 40);
t.ok("LR3-RC (M) with a hyphen is LR3 with the suffix", R.parseLr("LR3-RC (M)").base === "LR3" && R.parseLr("LR3-RC (M)").mha === "M" && R.pick({ juris: "seattle", zone: "LR3-RC (M)", lot: 5000 }).height.ft === 40);
t.ok("RM 1.5 with a space is RM-1.5", R.pick({ juris: "edmonds", zone: "RM 1.5", lot: 6000 }).setbacks.side === 10 && R.pick({ juris: "edmonds", zone: "RM 1.5", lot: 6000 }).key === "edmonds-rm");
t.ok("LR standards cite Ord. 127376", lr1m.sources.some(function (s) { return /23\.45\.518/.test(s.label) && /127376/.test(s.label); }) && lr1m.sources.some(function (s) { return /23\.45\.514/.test(s.label) && /127376/.test(s.label); }));
t.ok("MIO-65-LR3 is not read as LR3", R.parseLr("MIO-65-LR3 (M)") === null && R.pick({ juris: "seattle", zone: "MIO-65-LR3 (M)", zoneClass: "Major Institutions" }).key !== "seattle-lr");
["NC2-55 (M)", "NC2P-65 (M1)", "C1-55 (M)"].forEach(function (z) {
  var rs = R.pick({ juris: "seattle", zone: z, zoneClass: "Commercial/Mixed Use", lot: 5000 });
  t.ok(z + " is not a house zone", rs.residential === false && !rs.setbacks.front && rs.assumed !== true, rs.key);
});
var bd = R.pick({ juris: "edmonds", zone: "BD1", lot: 8000 });
t.ok("Edmonds BD1 is not a house zone", bd.residential === false && !bd.setbacks.front);
["BC", "BN", "CG2", "OS", "P"].forEach(function (z) {
  t.ok("Edmonds " + z + " is not a house zone", R.pick({ juris: "edmonds", zone: z }).residential === false);
});
["UR3", "RE-1", "RS", "SF-3", "R-1"].forEach(function (z) {
  var rs = R.pick({ juris: "outside", zone: z, lot: 7000, stateAbbr: "TX" });
  t.ok(z + " uses typical residential assumptions", rs.assumed === true && rs.residential === true && rs.setbacks.front === 25 && rs.caveat === R.TYPICAL, rs.key);
});
function stateLaw(rs) {
  return rs.residential === true && rs.assumed !== true && !rs.setbacks.front && rs.rules.some(function (r) { return /Middle housing/.test(r.label); }) && rs.rules.some(function (r) { return /HB 1110|36\.70A\.635/.test(String(r.value) + String(r.note) + (r.src && r.src.label || "")); }) && rs.rules.some(function (r) { return /ADU/.test(r.label) && /36\.70A\.680|HB 1337/.test(String(r.note) + (r.src && r.src.label || "")); });
}
var waCity = R.pick({ juris: "city", city: "redmond", zone: "R-1", lot: 7000, stateAbbr: "WA" });
t.ok("an uncoded residential city zone keeps the state-law rows and no assumed setbacks", stateLaw(waCity));
t.ok("Bellevue R-1 keeps the state-law rows", stateLaw(R.pick({ juris: "city", city: "bellevue", zone: "R-1", lot: 8000, stateAbbr: "WA" })));
t.ok("Everett UR4 keeps the state-law rows", stateLaw(R.pick({ juris: "city", city: "everett", zone: "UR4", lot: 6000, stateAbbr: "WA" })));
t.ok("Edmonds RS-8 keeps the state-law rows", stateLaw(R.pick({ juris: "edmonds", zone: "RS-8", lot: 7000, stateAbbr: "WA" })));
var everett = R.pick({ juris: "city", city: "everett", zone: "UR3", lot: 6000, stateAbbr: "WA" });
t.ok("Everett UR3 is a house zone under state law, not typical setbacks", stateLaw(everett) && !/not a house lot/.test(JSON.stringify(everett)));
t.ok("an uncoded Seattle residential zone keeps the state-law rows", stateLaw(R.pick({ juris: "seattle", zone: "SF5000", lot: 5000, stateAbbr: "WA" })));
t.ok("an uncoded Kenmore residential zone keeps the state-law rows", stateLaw(R.pick({ juris: "kenmore", zone: "RS", lot: 8000, stateAbbr: "WA" })));
t.ok("Kenmore R-1 stays on the coded table", R.pick({ juris: "kenmore", zone: "R-1", lot: 20000 }).key === "kenmore" && R.pick({ juris: "kenmore", zone: "R-1", lot: 20000 }).setbacks.front === 20);
var pd = R.pick({ juris: "outside", zone: "PD", lot: 8000, stateAbbr: "OH" });
t.ok("PD is unrecognized and is not called a house lot or a typical house", pd.unrecognized === true && pd.residential == null && pd.assumed !== true && !pd.setbacks.front && /not recognized/.test(pd.caveat) && !/not a house lot/.test(pd.caveat));
var sea = R.pick({ juris: "seattle", zone: "SF5000", stateAbbr: "WA", lot: 5000 });
t.ok("Seattle is never said to be off the middle housing list", !/not on the state middle housing list/.test(JSON.stringify(sea)) && !/not on the state middle housing list/.test(JSON.stringify(R.pick({ juris: "seattle", zone: "", stateAbbr: "WA" }))));
var edm = R.pick({ juris: "edmonds", zone: "BD1", lot: 8000 });
t.ok("Edmonds commercial zones link ECDC Title 16", edm.residential === false && edm.sources.some(function (s) { return s.url === "https://edmonds.municipal.codes/ECDC/16"; }));
var Sum = require("../../../assets/feasibility/20261121a/build-here-summary.js");
var fs = require("fs");
var nc = R.pick({ juris: "seattle", zone: "NC2-55 (M)", zoneClass: "Commercial/Mixed Use", stateAbbr: "WA", lot: 5000 });
var Fc = Sum.facts({ stateAbbr: "WA", juris: "seattle", matched: "5400 BALLARD AVE NW" }, { zone: "NC2-55 (M)", existing: 1200 }, nc, { effective: { living: 1200 } }, {}, null);
t.ok("a commercial lot does not say existing finished living", Fc.living && Fc.living.label.indexOf("Existing finished living") < 0, Fc.living && Fc.living.label);
var permit = Sum.blocks(Fc).building.filter(function (r) { return r.key === "permits"; })[0];
t.ok("a commercial permit line does not offer an addition, ADU or new house", permit && permit.v.indexOf("addition, ADU or new house") < 0, permit && permit.v);
var pageJs = fs.readFileSync(require("path").join(__dirname, "../../../assets/feasibility/20261121a/build-here.js"), "utf8");
t.ok("the area heading is neutral", pageJs.indexOf("House, garage, driveway and open area") < 0 && pageJs.indexOf("Buildings, paving and open area") >= 0);
var lr3Facts = Sum.blocks(Sum.facts({ stateAbbr: "WA", juris: "seattle", city: "Seattle" }, { zone: "LR3 (M)", lot: 6000 }, lr3, {}, {}, null)).building.filter(function (r) { return r.key === "height"; })[0];
t.ok("the LR3 height row does not repeat 40 ft or say stacked units are higher", lr3Facts && lr3Facts.v.indexOf("40 ft · 40 ft") < 0 && lr3Facts.v.indexOf("Stacked dwelling units can be higher") < 0 && /40 ft with an MHA suffix/.test(lr3Facts.v), lr3Facts && lr3Facts.v);
var cwFacts = Sum.facts({ stateAbbr: "WA", juris: "edmonds", city: "Edmonds", matched: "144 RAILROAD AVE" }, { zone: "CW", lot: 20000 }, R.pick({ juris: "edmonds", zone: "CW", lot: 20000 }), { effective: {} }, {}, null);
var chapter = Sum.blocks(cwFacts).building.filter(function (r) { return r.key === "chapter"; })[0];
t.ok("Railroad shows the Edmonds code chapter", chapter && /ECDC/.test(chapter.v), chapter && chapter.v);
var blankPermit = Sum.blocks(Sum.facts({ stateAbbr: "WA", juris: "city" }, { zone: "" }, R.pick({ juris: "city", city: "", zone: "", stateAbbr: "WA" }), {}, {}, null)).building.filter(function (r) { return r.key === "permits"; })[0];
t.ok("a blank city does not print City of undefined", blankPermit && blankPermit.v.indexOf("undefined") < 0 && JSON.stringify(blankPermit).indexOf("City of undefined") < 0, blankPermit && blankPermit.v);
var pdCards = Ms.scenarios({ unrecognized: true, lot: 8000, living: 1500, roof: 900, zoningCoded: false });
["addition", "adu", "shop", "teardown"].forEach(function (id) {
  var card = pdCards.filter(function (c) { return c.id === id; })[0];
  t.ok(id + " card says the zone is not recognized", card && /not recognized/.test(card.line) && /confirm locally/i.test(card.metric), card && card.line);
});
var blankCards = Ms.scenarios({ blank: true, unrecognized: true, lot: 5000, living: 1200, roof: 900 });
["addition", "adu", "shop", "teardown"].forEach(function (id) {
  var card = blankCards.filter(function (c) { return c.id === id; })[0];
  t.ok(id + " card says no zone was found", card && card.line === "No zone was found for this lot, confirm with your local planning department." && !/not recognized/.test(card.line), card && card.line);
});
var blankRs = R.pick({ juris: "seattle", zone: "", stateAbbr: "WA" });
t.ok("a blank Seattle zone is not called unrecognized", blankRs.blank === true && blankRs.caveat === "No zone was found for this lot, confirm with your local planning department.");
var pdOpts = Ms.options({ unrecognized: true, zoningCoded: false, effective: { living: 1500, roof: 900 }, envArea: 2000 });
["adu", "shop", "teardown"].forEach(function (id) {
  var opt = pdOpts.filter(function (o) { return o.id === id; })[0];
  t.ok(id + " option says the zone is not recognized", opt && /not recognized/.test(opt.why) && opt.footprintSf == null, opt && opt.why);
});
var FcSide = Sum.facts({ stateAbbr: "WA", juris: "seattle", matched: "5400 BALLARD AVE NW" }, { zone: "NC2-55 (M)", existing: 1200 }, nc, { effective: { living: 1200 } }, {}, { ok: true, hasGeo: true, sidewalks: [], trees: [], streets: [] });
var nonresBlocks = Sum.blocks(FcSide);
t.ok("a commercial lot hides the new-house row", !nonresBlocks.building.some(function (r) { return r.key === "newHouse" || /New house \(teardown\)/.test(r.k); }));
t.ok("a commercial sidewalk note does not mention a new house", nonresBlocks.landscaping.filter(function (r) { return r.key === "sidewalk"; })[0].v.indexOf("with a new house") < 0);
var ballardRoof = Sum.facts({ stateAbbr: "WA", juris: "seattle", city: "Seattle" }, { zone: "NC2-55 (M)" }, nc, {}, {}, { ok: true, sidewalks: [] });
ballardRoof = Sum.blocks(ballardRoof);
t.ok("a commercial re-roof note is not the one-family exemption", ballardRoof.roofing.filter(function (r) { return r.key === "reroofRule"; })[0].v.indexOf("one- or two-family") < 0);
t.ok("a commercial lot hides the ADU row", !nonresBlocks.building.some(function (r) { return r.key === "adu"; }));
t.ok("a commercial lot hides garage and deck", !nonresBlocks.remodel.some(function (r) { return r.key === "garage" || /Garage/.test(r.k); }));
t.ok("a commercial kitchen note does not cite the residential code", nonresBlocks.remodel.filter(function (r) { return r.key === "kitchenBath"; })[0].v.indexOf("residential code") < 0);
t.ok("a commercial asbestos line says the building", (function () { var a = nonresBlocks.remodel.filter(function (r) { return r.key === "asbestos"; })[0]; return a && a.v.indexOf("the building") >= 0 && a.v.indexOf("the house") < 0; })());
var ballardMiss = Sum.blocks(Sum.facts({ stateAbbr: "WA", juris: "seattle", city: "Seattle" }, { zone: "NC2-55 (M)" }, nc, { effective: {} }, {}, null));
t.ok("a commercial lot does not say living area is missing", ballardMiss.remodel.filter(function (r) { return r.key === "house"; })[0].v.indexOf("Living area") < 0);
var countyLot = R.pick({ juris: "kc", zone: "IH", stateAbbr: "WA", lot: 40000 });
var countyWalk = Sum.blocks(Sum.facts({ stateAbbr: "WA", juris: "kc", county: "King County" }, { zone: "IH" }, countyLot, {}, {}, { ok: true, hasGeo: true, sidewalks: [], trees: [], streets: [] })).landscaping.filter(function (r) { return r.key === "sidewalk"; })[0];
t.ok("an unincorporated sidewalk names the county", countyWalk && /King County/.test(countyWalk.v) && !/the city/i.test(countyWalk.v), countyWalk && countyWalk.v);
var houseWalk = Sum.blocks(Sum.facts({ stateAbbr: "WA", juris: "seattle", city: "Seattle" }, { zone: "LR1 (M)", lot: 4000 }, R.pick({ juris: "seattle", zone: "LR1 (M)", lot: 4000, mha: "M" }), {}, {}, { ok: true, hasGeo: true, sidewalks: [], trees: [], streets: [] })).landscaping.filter(function (r) { return r.key === "sidewalk"; })[0];
t.ok("a residential sidewalk sentence capitalizes the city", houseWalk && /complete\. The City of Seattle can ask/.test(houseWalk.v) && houseWalk.v.indexOf(". the ") < 0, houseWalk && houseWalk.v);
var deptWalk = Sum.blocks(Sum.facts({ stateAbbr: "TX", juris: "outside" }, { zone: "", lot: 8000 }, R.pick({ juris: "outside", zone: "", lot: 8000, stateAbbr: "TX" }), {}, {}, { ok: true, hasGeo: true, sidewalks: [], trees: [], streets: [] })).landscaping.filter(function (r) { return r.key === "sidewalk"; })[0];
t.ok("a residential sidewalk sentence capitalizes the planning department", deptWalk && /complete\. The local planning department can ask/.test(deptWalk.v), deptWalk && deptWalk.v);
var txRules = R.pick({ juris: "outside", zone: "", lot: 8000, stateAbbr: "TX" });
t.ok("an out-of-state lot with no zone uses typical assumptions", txRules.assumed === true && txRules.setbacks.front === 25);
t.ok("an out-of-state study does not carry the Washington parking cap", txRules.site.parking == null && txRules.site.wa === false);
t.ok("an NR lot is unchanged", pick({ juris: "seattle", zone: "NR3", lot: 5000, units: 1 }).floorCap === 3000 && pick({ juris: "seattle", zone: "NR3", lot: 5000 }).setbacks.front === 15);

var rm = pick({ juris: "edmonds", zone: "RM-1.5", lot: 6000 });
t.ok("Edmonds RM-1.5 is 15/10/15, 25 ft, 45% coverage, no floor-area ratio", rm.farNone === true && rm.coverage === 2700 && rm.setbacks.front === 15 && rm.setbacks.side === 10 && rm.setbacks.rear === 15 && rm.height.ft === 25, rm.setbacks);
t.ok("RM-3 side setback is 15 ft", pick({ juris: "edmonds", zone: "RM-3", lot: 9000 }).setbacks.side === 15 && pick({ juris: "edmonds", zone: "RM-3", lot: 9000 }).coverage === 4050);
t.ok("RM cites ECDC 16.30.030", rm.sources[0].url.indexOf("edmonds.municipal.codes/ECDC/16.30.030") >= 0);
t.ok("Edmonds LDR-S is unchanged", pick({ juris: "edmonds", zone: "LDR-S", lot: 8000 }).setbacks.front === 20 && pick({ juris: "edmonds", zone: "LDR-S", lot: 8000 }).coverage === 2800);

var cw = pick({ juris: "edmonds", zone: "CW", lot: 20000 });
t.ok("CW is not a house lot and has no setbacks", cw.residential === false && cw.assumed !== true && !cw.setbacks.front, cw);
var optsCw = Ms.options({ zoningCoded: false, nonres: true, effective: { living: 8000, roof: 4000 }, envArea: 5000 });
t.ok("a commercial lot does not get an addition footprint", optsCw.filter(function (o) { return o.kind === "addition"; })[0].footprintSf == null && /not a house lot/i.test(optsCw[0].why));

var tx = pick({ juris: "outside", zone: "", lot: 9000 });
t.ok("an uncoded residential lot gets typical assumptions, not a blank", tx.assumed === true && tx.setbacks.front === 25 && tx.setbacks.side === 10 && tx.setbacks.rear === 25 && tx.height.ft === 30 && tx.floorCap == null, tx.setbacks);
t.ok("the typical label does not name a place", R.TYPICAL === "Typical residential assumptions, confirm with your local planning department. These are not the local code." && !/\b(Seattle|Edmonds|Texas|Washington|covers|not covered)\b/.test(R.TYPICAL));
var opts = Ms.options({ zoningCoded: false, assumed: true, effective: { roof: 1600 }, envArea: 4000, heightFt: 30 });
var add = opts.filter(function (o) { return o.id === "addition"; })[0];
t.ok("the concept addition is drawn and labeled as an assumption", add.footprintSf === 750 && add.feasible === null && add.why === R.TYPICAL, add);

var banned = ["\u2014", "PPG", "turf", "lawn"];
[R.TYPICAL, R.NONRES_NOTE, add.why, cw.caveat].forEach(function (s) {
  banned.forEach(function (w) { t.ok("copy avoids " + w, String(s).indexOf(w) < 0, s); });
  t.ok("copy does not say AI", !/\bAI\b/.test(String(s)));
});

globalThis.BuildHereGeom = require("../../../assets/feasibility/20261121a/build-here-geom.js");
var SP = require("../../../assets/feasibility/20261121a/build-here-siteplan.js");
var G = globalThis.BuildHereGeom;
var fr = G.frame(47.65, -122.39);
function ll(x, y) { return fr.inv(x, y); }
function rect(x0, y0, x1, y1) { return [ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)]; }
[
  { name: "LR1 (M)", spec: { juris: "seattle", zone: "LR1 (M)", lot: 4000, mha: "M" } },
  { name: "NR3", spec: { juris: "seattle", zone: "NR3", lot: 5000, units: 1 } },
  { name: "LDR-S", spec: { juris: "edmonds", zone: "LDR-S", lot: 8000 } },
  { name: "RM-1.5", spec: { juris: "edmonds", zone: "RM-1.5", lot: 6000 } }
].forEach(function (sample) {
  var rs = R.pick(sample.spec);
  var house = rs.residential !== false && !rs.unrecognized;
  var coded = rs.coded !== false && !rs.assumed && house;
  var roomFar = rs.floorCap != null ? rs.floorCap - 1200 : null;
  var roomCov = rs.coverage != null ? rs.coverage - 800 : 2000;
  var opts = Ms.options({ zoningCoded: coded, nonres: false, unrecognized: false, hasFloorCap: coded ? (rs.floorCap != null ? true : (rs.farNone ? false : null)) : null, floorCap: coded ? rs.floorCap : null, coverageCap: coded ? rs.coverage : null, effective: { living: 1200, roof: 800, buildings: 800, roomFar: roomFar, roomCov: roomCov }, envArea: 2500, heightFt: rs.height.ft, adu: rs.adu });
  var F = Sum.facts({ stateAbbr: "WA", juris: sample.spec.juris, city: sample.spec.juris === "seattle" ? "Seattle" : "Edmonds", lot: sample.spec.lot }, { zone: sample.spec.zone, lot: sample.spec.lot, existing: 1200 }, rs, { effective: { living: 1200, roof: 800, buildings: 800, roomFar: roomFar, roomCov: roomCov }, options: opts }, {}, null);
  var add = opts.filter(function (o) { return o.id === "addition" || o.kind === "secondStory"; })[0];
  var M = SP.model({
    rings: [rect(-40, -40, 40, 40)], lon: -122.39, lat: 47.65, setbacks: rs.setbacks, residential: F.residential,
    geo: { frame: { lat0: fr.lat0, lon0: fr.lon0 }, buildings: [{ role: "house", ring: [[-8, -8], [8, -8], [8, 8], [-8, 8], [-8, -8]], sf: 256 }], streets: [], drives: [], driveLines: [], hard: [], sidewalks: [], trees: [] }
  });
  var svg = SP.svg(M, { F: F, opt: add });
  var additionRow = Sum.blocks(F).building.filter(function (r) { return r.key === "addition"; })[0];
  t.ok(sample.name + " draws an addition and labels (E) HOUSE", house && F.residential === true && add && add.footprintSf > 0 && svg.indexOf("(E) HOUSE") >= 0 && additionRow && additionRow.v.indexOf("not a house lot") < 0, [rs.key, rs.residential, add && add.footprintSf, additionRow && additionRow.v]);
});

var solved = Ms.resolveStudy({ lot: 20000, nonres: true, zoningCoded: false, auto: { roof: { sf: 4000, source: "map" }, other: { sf: 900, source: "map" } } });
var cov = SP.tables(null, null, null, { nonres: true, residential: false, lot: { sf: 20000 }, eff: solved.effective, sb: {}, height: {} }).filter(function (t) { return t.id === "coverage"; })[0];
var total = cov.rows.filter(function (r) { return r.k === "TOTAL EXISTING"; })[0];
t.ok("a hidden accessory row still counts in the commercial total", solved.effective.buildings === 4900 && total && total.v.indexOf("4,900") >= 0 && !cov.rows.some(function (r) { return /garage|accessory|shed/i.test(r.k); }), total && total.v);

t.done();
