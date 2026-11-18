/* Unit tests for assets/js/build-here-measures.js.   node tests/unit/measures.test.js */
"use strict";
var t = require("./_t.js");
var M = require("../../../assets/feasibility/build-here-measures.js");

function auto(sf, extra) { return Object.assign({ sf: sf, source: "test", method: "assessor extract", retrieved: "2026-11-01" }, extra || {}); }

/* ---- which typed figure wins: the one entered last ---- */
var manual = [{ kind: "living", sf: 2000, source: "assessor card", method: "assessor", confidence: "Medium", seq: 1 }];
var later = M.resolveStudy({ lot: 9600, auto: { living: auto(1840) }, manual: manual, edit: { living: { sf: 2200, seq: 2 } }, date: "2026-11-17" });
t.ok("an edit made after a typed source wins", later.effective.living === 2200, later.effective.living);
var earlier = M.resolveStudy({ lot: 9600, auto: { living: auto(1840) }, manual: [{ kind: "living", sf: 2000, source: "assessor card", method: "assessor", seq: 5 }], edit: { living: { sf: 2200, seq: 2 } }, date: "2026-11-17" });
t.ok("a typed source added after the edit wins", earlier.effective.living === 2000, earlier.effective.living);
var legacy = M.resolveStudy({ lot: 9600, auto: { living: auto(1840) }, manual: [{ kind: "living", sf: 2000, source: "card", method: "assessor" }], edit: { living: 2200 }, date: "2026-11-17" });
t.ok("without sequence numbers the old order holds (the list's last typed row)", legacy.effective.living === 2000);
t.ok("the study says which figure the math uses", later.bundle.notes.some(function (n) { return /The math uses 2200 sf/.test(n); }), later.bundle.notes);
t.ok("an automatic figure is used when nothing is typed", M.resolveStudy({ lot: 9600, auto: { living: auto(1840) } }).effective.living === 1840);

/* ---- open area is never negative ---- */
var neg = M.openArea(1000, { buildings: 1500 });
t.ok("buildings larger than the lot give 0 open area and a warning, not a negative", neg.sf === 0 && /larger than the lot/.test(neg.note), neg);
t.ok("unknown lot gives no open area", M.openArea(null, { buildings: 100 }).sf === null);
t.ok("unknown paving is not landscaping", M.openArea(9600, { buildings: 1600 }).verifiedLandscape === false);

/* ---- floor area accounting: the Redmond example (5514 160th Ave NE) ---- */
var redAuto = { living: auto(1840), roof: auto(1581, { method: "roof outline" }), basementGarage: auto(550), basementTotal: auto(1170), basementFinished: auto(620), other: auto(60, { method: "building outline" }) };
var plain = M.resolveStudy({ lot: 9600, zoningCoded: true, hasFloorCap: true, floorCap: 4500, coverageCap: 4800, imperviousCap: 6720, auto: redAuto });
t.ok("with no accounting rule, floor area used is living area alone (as before)", plain.effective.floorUsed === 1840 && plain.effective.floorBasis === "living" && plain.effective.roomFar === 2660);
var red = M.resolveStudy({ lot: 9600, zoningCoded: true, hasFloorCap: true, floorCap: 4500, coverageCap: 4800, imperviousCap: 6720, auto: redAuto, accounting: { farIncludesGarage: true, farIncludesBasement: true, farIncludesAccessory: true, verify: true } });
t.ok("Redmond counts the 550 sf garage and the 60 sf shed: 2,450 sf, as on PPG's sheet", red.effective.floorUsed === 2450 && red.effective.floorBasis === "counted", red.effective.floorUsed);
t.ok("room left is 2,050 sf, not 2,660", red.effective.roomFar === 2050);
t.ok("the finished basement is not counted twice", red.effective.floorParts.every(function (p) { return p.key !== "basementUnfinished"; }), red.effective.floorParts);
t.ok("the counted parts are listed", red.effective.floorParts.map(function (p) { return p.key; }).join(",") === "living,basementGarage,accessory");
var noGar = M.resolveStudy({ lot: 9600, zoningCoded: true, hasFloorCap: true, floorCap: 4500, auto: { living: auto(1840) }, accounting: { farIncludesGarage: true } });
t.ok("a counted garage that is not on record makes the figure a minimum, not a zero", noGar.effective.floorUsed === 1840 && noGar.effective.floorMissing[0] === "garage" && noGar.bundle.notes.some(function (n) { return /minimum/.test(n); }));
var garNone = M.resolveStudy({ lot: 9600, zoningCoded: true, hasFloorCap: true, floorCap: 4500, auto: { living: auto(1840) }, accounting: { farIncludesGarage: true }, garageNone: true });
t.ok("a record that says there is no garage is not a missing garage", garNone.effective.floorMissing.length === 0);
var typedGfa = M.resolveStudy({ lot: 9600, floorCap: 4500, auto: redAuto, accounting: { farIncludesGarage: true }, manual: [{ kind: "gfa", sf: 2600, source: "plans", method: "permit" }] });
t.ok("a typed gross floor area replaces the whole count", typedGfa.effective.floorUsed === 2600 && typedGfa.effective.floorBasis === "gfa");

/* ---- impervious: a missing part gives a floor, never a total ---- */
t.ok("paving unknown: no impervious total, a known floor, and the missing parts named", plain.effective.impervious === null && plain.effective.impKnown === 1641 && plain.effective.impMissing.length === 2, plain.effective);
var full = M.resolveStudy({ lot: 9600, imperviousCap: 6720, auto: { roof: auto(1600, { method: "roof outline" }), drive: auto(600, { method: "paved-surface layer" }), hard: auto(300, { method: "paved-surface layer" }) } });
t.ok("all parts known: a total and room left", full.effective.impervious === 2500 && full.effective.roomImp === 4220 && full.effective.impMissing.length === 0);

/* ---- option sizes ---- */
function opts(eff, extra) {
  var list = M.options(Object.assign({ effective: eff, zoningCoded: true, hasFloorCap: true, floorCap: 4500, coverageCap: 4800, imperviousCap: 6720, envArea: 7700, stories: 1, firstFloor: 1220, heightFt: 38, adu: { status: "state" } }, extra || {}));
  var by = {}; list.forEach(function (o) { by[o.id] = o; }); return by;
}
var o1 = opts(red.effective);
t.ok("addition: 1,500 sf on two levels, 750 sf footprint (the mockup's Option 1)", o1.addition.gfaSf === 1500 && o1.addition.levels === 2 && o1.addition.footprintSf === 750 && o1.addition.feasible === true, o1.addition);
t.ok("new house: the full 4,500 sf cap on two levels", o1.teardown.gfaSf === 4500 && o1.teardown.footprintSf === 2250 && o1.teardown.feasible === true, o1.teardown);
t.ok("detached ADU: 1,000 sf from the state floor, marked not known because the city limit is not coded", o1.adu.gfaSf === 1000 && o1.adu.feasible === null && /state law/.test(o1.adu.why), o1.adu);
t.ok("shop: a two-car footprint, concept only while paving is unknown", o1.shop.footprintSf === 576 && o1.shop.feasible === true);
t.ok("remodel adds no footprint", o1.remodel.footprintSf === 0 && o1.remodel.feasible === true);
var tight = opts(Object.assign({}, red.effective, { roomFar: 400, roomCov: 3000 }));
t.ok("addition is held to the floor room left", tight.addition.gfaSf === 400 && tight.addition.footprintSf === 200 && /floor room/.test(tight.addition.notes.join(" ")), tight.addition);
var noCov = opts(Object.assign({}, red.effective, { roomCov: 40 }));
t.ok("no ground room on a one-story house: the concept is a second story", noCov.addition.kind === "secondStory" && noCov.addition.footprintSf === 0 && noCov.addition.gfaSf === 1220, noCov.addition);
t.ok("no ground room: a detached ADU and a shop do not fit, and the reason is given", noCov.adu.feasible === false && /basement or garage conversion/.test(noCov.adu.why) && noCov.shop.feasible === false);
var noCov2 = opts(Object.assign({}, red.effective, { roomCov: 40 }), { stories: 2 });
t.ok("no ground room on a two-story house: no addition, with the reason", noCov2.addition.feasible === false && /2 stories/.test(noCov2.addition.why));
var over = opts(Object.assign({}, red.effective, { roomFar: -100 }));
t.ok("at the floor cap: no addition", over.addition.feasible === false);
/* Where it can sit is a separate question from how big it may be. */
t.ok("with a setback envelope nothing is said about placement", !o1.addition.placement && !o1.teardown.placement && !/not checked/.test(o1.addition.notes.join(" ")));
var noEnv = opts(red.effective, { envArea: null });
t.ok("no setback envelope: the size still fits the caps, and it is marked as not placed", noEnv.addition.feasible === true && noEnv.addition.placement === "unchecked" && /where it can sit on the lot is not checked/.test(noEnv.addition.notes.join(" ")), noEnv.addition);
t.ok("the same for a new house and a shop", noEnv.teardown.placement === "unchecked" && noEnv.shop.placement === "unchecked" && /not checked/.test(noEnv.teardown.notes.join(" ")));
t.ok("a remodel and a second story add no footprint, so nothing is said about placement", !noEnv.remodel.placement && !opts(Object.assign({}, red.effective, { roomCov: 40 }), { envArea: null }).addition.placement);
var zeroEnv = opts(red.effective, { envArea: 0 });
t.ok("no area left inside the setbacks: no new footprint fits, and the reason is given", zeroEnv.addition.feasible === false && zeroEnv.teardown.feasible === false && zeroEnv.shop.feasible === false && /No area is left inside the setbacks/.test(zeroEnv.teardown.why) && zeroEnv.remodel.feasible === true, [zeroEnv.addition.why, zeroEnv.shop.feasible]);
var unk = M.options({ effective: {}, zoningCoded: false });
t.ok("zoning not coded: nothing is sized and nothing is zero", unk.every(function (o) { return o.id === "remodel" || (o.feasible === null && o.footprintSf === null && o.gfaSf === null); }), unk);
var farUnknown = opts(Object.assign({}, red.effective, { roomFar: null }), { hasFloorCap: null, floorCap: null });
t.ok("a zone whose floor limit is not coded gives a concept, never a yes", farUnknown.addition.feasible === null && farUnknown.teardown.feasible === null);
var coded = opts(red.effective, { adu: { status: "coded", maxSf: 1200, heightFt: 24 } });
t.ok("a coded ADU limit is used, capped at the 1,000 sf concept size", coded.adu.gfaSf === 1000 && coded.adu.feasible === true);

/* ---- cards ---- */
var cards = red.cards, byId = {}; cards.forEach(function (c) { byId[c.id] = c; });
t.ok("five cards, in order", cards.map(function (c) { return c.id; }).join(",") === "addition,adu,shop,teardown,remodel");
t.ok("the addition card uses the counted floor area", /2050 sf/.test(byId.addition.metric), byId.addition.metric);
var aduNoCov = M.scenarios({ lot: 9600, living: 1840, roof: 1600, zoningCoded: true, hasFloorCap: false, roomCov: 0, fullCov: 1600, aduRule: "Up to 2 per lot" });
t.ok("an ADU card is not Ready when no coverage room is left", aduNoCov.filter(function (c) { return c.id === "adu"; })[0].state === "partial");

/* ---- Snohomish house-size record ---- */
var hs = M.readHouseSize([1850, 1978, 3, 1.5, "res"]);
t.ok("house-size record is read by position", hs.fin === 1850 && hs.year === 1978 && hs.beds === 3 && hs.stories === 1.5);
var blank = M.readHouseSize([null, null, null, null, "res"]);
t.ok("blanks stay null", blank.fin === null && blank.year === null && blank.beds === null && blank.stories === null);
t.ok("a zero in an old file is read as missing, not as a 0 sf house", M.readHouseSize([0, 0, 0, 0, "res"]).fin === null);
t.ok("the note says FinSize is not total living area", /not used as total finished living area/.test(M.houseSizeNote()));
var fin = M.resolveStudy({ lot: 9000, zoningCoded: true, hasFloorCap: true, floorCap: 5400, auto: { countyFinSize: auto(1850, { confidence: "Low" }) } });
t.ok("FinSize is shown on the ledger and not used as living area", fin.effective.countyFinSize === 1850 && fin.effective.living === null && fin.effective.roomFar === null);

t.done();
