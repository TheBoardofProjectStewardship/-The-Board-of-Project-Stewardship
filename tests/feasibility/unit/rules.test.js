/* Unit tests for assets/js/build-here-rules.js.   node tests/unit/rules.test.js */
"use strict";
var t = require("./_t.js");
var R = require("../../../assets/feasibility/build-here-rules.js");

function texts(rs) { return JSON.stringify(rs.rules.map(function (r) { return [r.label, r.value, r.note]; })) + " " + rs.floorCapLabel; }
function noZero(rs) { return !/(^|[^0-9,.])0 sf|= 0\b|NaN|undefined/.test(texts(rs)); }

/* ---- a missing lot size never becomes a cap of 0 ---- */
t.ok("fmt(null) is a dash, not 0", R.fmt(null) === "—" && R.fmt(undefined) === "—" && R.fmt("") === "—" && R.fmt(1234.4) === "1,234");
var cases = [
  { juris: "seattle", zone: "NR2" }, { juris: "kc", zone: "R-6" }, { juris: "kc", zone: "RA-5" }, { juris: "edmonds", zone: "LDR-S" },
  { juris: "sno", zone: "R-5" }, { juris: "kenmore", zone: "R-6" }, { juris: "kenmore", zone: "R-1" },
  { juris: "city", city: "redmond", zone: "NR" }, { juris: "city", city: "lynnwood", zone: "RN" }, { juris: "city", city: "kirkland", zone: "RS 7.2" },
  { juris: "city", city: "sammamish", zone: "R-4" }, { juris: "city", city: "bothell", zone: "R-L1" }, { juris: "city", city: "issaquah", zone: "SF-S" }
];
cases.forEach(function (c) {
  var rs = R.pick(Object.assign({ lot: null, units: 1 }, c));
  var name = c.juris + " " + (c.city || "") + " " + c.zone;
  t.ok("no lot, " + name + ": rules come back", !!rs);
  if (!rs) return;
  t.ok("no lot, " + name + ": coverage and impervious caps are null, not 0", rs.coverage == null && (rs.impervious == null));
  t.ok("no lot, " + name + ": no rule text says 0 sf or NaN", noZero(rs), texts(rs).slice(0, 300));
  if (!(c.city === "redmond")) t.ok("no lot, " + name + ": floor cap is null", rs.floorCap == null, rs.floorCap);
});
var red0 = R.pick({ juris: "city", city: "redmond", zone: "NR", lot: null, units: 1 });
t.ok("Redmond's floor cap does not depend on the lot, so it stays", red0.floorCap === 4500);
var sea = R.pick({ juris: "seattle", zone: "NR3", lot: 5000, units: 1 });
t.ok("Seattle NR with a lot is unchanged: FAR 0.6, 50% coverage", sea.floorCap === 3000 && sea.coverage === 2500 && sea.setbacks.front === 15 && sea.setbacks.rearAlley === 0);
t.ok("Seattle small lot keeps the 2,500 sf floor", R.pick({ juris: "seattle", zone: "NR3", lot: 3000, units: 1 }).floorCap === 2500);
var kc = R.pick({ juris: "kc", zone: "R-6", lot: 7200 });
t.ok("King County urban with a lot is unchanged", kc.impervious === 5040 && kc.farNone === true && kc.setbacks.front === 10 && kc.setbacks.garage === 20);

/* ---- zone suffixes and city keys ---- */
var kp = R.pick({ juris: "kc", zone: "R-6-P", lot: 7200 });
t.ok("a -P suffix falls back to the base zone, with a note", !!kp && kp.impervious === 5040 && /property-specific/.test(kp.overlayNote), kp && kp.overlayNote);
var kso = R.pick({ juris: "kc", zone: "RA-5-SO", lot: 200000 });
t.ok("a -SO suffix falls back to the base zone, with a note", !!kso && /overlay/.test(kso.overlayNote));
t.ok("a zone without a suffix has no overlay note", !kc.overlayNote);
t.ok("Edmonds LDR-S is not read as a suffix", R.stripOverlay("LDR-S").overlay === "" && !!R.pick({ juris: "edmonds", zone: "LDR-S", lot: 8000 }));
t.ok("a city zone with a suffix is found", R.findZone("shoreline", "NR3-P") === "NR3" && R.findZone("renton", "R-8") === "R-8");
t.ok("an unknown zone is still not coded", R.pick({ juris: "kc", zone: "NB-P", lot: 7200 }) === null);
t.ok("cityKey: Census place names", R.cityKey("Redmond city") === "redmond" && R.cityKey("City of Redmond") === "redmond" && R.cityKey("Beaux Arts Village town") === "beauxarts" && R.cityKey("Lake Forest Park") === "lakeforestpark" && R.cityKey("SeaTac") === "seatac");

/* ---- combined side setbacks ---- */
var kirk = R.pick({ juris: "city", city: "kirkland", zone: "RS7.2", lot: 7000 });
t.ok("Kirkland 5 min / 15 combined is drawn 7.5 a side", kirk.setbacks.side === 7.5 && kirk.setbacks.sideMin === 5 && kirk.setbacks.sideCombined === 15, kirk.setbacks);
var lfp = R.pick({ juris: "city", city: "lakeforestpark", zone: "RS-7.2", lot: 7200 });
t.ok("Lake Forest Park 15 combined is drawn 7.5 a side", lfp.setbacks.side === 7.5);
var ren4 = R.pick({ juris: "city", city: "renton", zone: "R-4", lot: 9000 }), ren6 = R.pick({ juris: "city", city: "renton", zone: "R-6", lot: 7000 });
t.ok("Renton R-4 20 combined is 10 a side, R-6 15 combined is 7.5", ren4.setbacks.side === 10 && ren6.setbacks.side === 7.5);
var ken = R.pick({ juris: "kenmore", zone: "R-6", lot: 7200 });
t.ok("Kenmore keeps 7.5 a side and now says why", ken.setbacks.side === 7.5 && ken.setbacks.sideCombined === 15);
var iss = R.pick({ juris: "city", city: "issaquah", zone: "SF-S", lot: 9600 });
t.ok("a zone with a plain side setback is unchanged", iss.setbacks.side === 8 && iss.setbacks.sideCombined === undefined);

/* ---- Redmond NR, coded with a verify tag ---- */
var red = R.pick({ juris: "city", city: "redmond", zone: "NR", lot: 9600, units: 1 });
t.ok("Redmond NR setbacks: front 10, side 3, street side 10, rear 5, alley 2", red.setbacks.front === 10 && red.setbacks.side === 3 && red.setbacks.streetSide === 10 && red.setbacks.rear === 5 && red.setbacks.rearAlley === 2 && red.setbacks.buildingSep === 5, red.setbacks);
t.ok("Redmond NR carries the verify tag", red.setbackVerify === true && red.rules.some(function (r) { return r.label === "Front setback" && /10 ft \(verify\)/.test(r.value); }));
t.ok("Redmond NR caps: 4,500 sf floor area, 50% coverage, 70% impervious, 38 ft", red.floorCap === 4500 && red.coverage === 4800 && red.impervious === 6720 && red.height.ft === 38);
t.ok("Redmond NR counts garage and basement in floor area, marked verify", red.accounting.farIncludesGarage === true && red.accounting.farIncludesBasement === true && red.accounting.verify === true);
t.ok("Redmond setback source is the city page, not RZC 21.16.200", /redmond\.gov/.test(red.setbackSrc.url));
var partial = [["woodinville", "R-4"], ["renton", "R-8"], ["shoreline", "NR1"], ["mountlaketerrace", "R-2"]];
partial.forEach(function (c) {
  var rs = R.pick({ juris: "city", city: c[0], zone: c[1], lot: 7000 }), sb = rs.setbacks;
  t.ok(c[0] + " " + c[1] + " still has an uncoded setback, shown as verify and never as 0", [sb.front, sb.side, sb.rear].some(function (x) { return x == null; }) && [sb.front, sb.side, sb.rear].every(function (x) { return x !== 0; }), sb);
});

/* ---- structured height, ADU, site rules ---- */
t.ok("height is a number where the text has one", sea.height.ft === 32 && kc.height.ft === 35 && ren4.height.ft === 32 && kirk.height.ft === 25);
t.ok("Seattle ADU is coded", sea.adu.status === "coded" && sea.adu.maxCount === 2 && sea.adu.maxSf === 1000 && sea.adu.rearSetback === 5);
var sam = R.pick({ juris: "city", city: "sammamish", zone: "R-8", lot: 8000 });
t.ok("Sammamish detached ADU numbers are fields, not only a note", sam.adu.status === "coded" && sam.adu.heightFt === 24 && sam.adu.rearSetback === 5 && sam.adu.sideSetback === 5);
var muk = R.pick({ juris: "city", city: "mukilteo", zone: "RD7.2", lot: 7200 });
t.ok("Mukilteo's two ADUs are read from the table", muk.adu.status === "coded" && muk.adu.maxCount === 2);
t.ok("a table with no ADU numbers falls back to the state floor and says so", iss.adu.status === "state" && /1,000 sf/.test(iss.adu.text));
var ev = R.pick({ juris: "city", city: "everett", zone: "NR", lot: 5000 });
t.ok("Everett street side and alley setbacks are fields", ev.setbacks.streetSide === 5 && ev.setbacks.rearAlley === 0 && ev.adu.heightFt === 18);
t.ok("site rules: asbestos applies whatever the year, with a source and date", /whatever the year/.test(sea.site.asbestos.v) && sea.site.asbestos.checked === "Nov 2026" && /1978/.test(sea.site.lead.v));
t.ok("site rules: Seattle re-roof rule is coded, another city's is not", !!sea.site.reroof.v && sea.site.reroof.checked === "Nov 2026" && red.site.reroof.v === null);
t.ok("site rules: Seattle drainage is text with no checked date (prints verify)", !!sea.site.drainage.v && sea.site.drainage.checked === null && /2026/.test(sea.site.drainage.v));
t.ok("site rules: fences are not coded anywhere, and say so", sea.site.fence.v === null && /not coded/.test(sea.site.fence.note));

/* ---- Sammamish setbacks follow the planned house, not always the largest ---- */
var samBig = R.pick({ juris: "city", city: "sammamish", zone: "R-6", lot: 10000, house: 1800 });
var samAdd = R.pick({ juris: "city", city: "sammamish", zone: "R-6", lot: 10000, house: 1800, planned: 500 });
t.ok("no plan: the row for the largest house the cap allows", samBig.setbacks.front === 20 && samBig.setbacks.side === 10);
t.ok("a 500 sf addition to an 1,800 sf house uses the under-2,500 row", samAdd.setbacks.front === 15 && samAdd.setbacks.side === 5 && samAdd.setbacks.rear === 15, samAdd.setbacks);

/* ---- energy credits (2021 WSEC-R R406.3) ---- */
function cr(kind, sf, d) { return R.energyCredits(kind, sf, d || "2026-11-17"); }
t.ok("addition under 150 sf is exempt", cr("addition", 120).credits === 0);
t.ok("addition 150 to 500 sf: 2.0", cr("addition", 150).credits === 2 && cr("addition", 500).credits === 2);
t.ok("addition over 500 and under 1,500 sf: 5.0", cr("addition", 501).credits === 5 && cr("addition", 1499).credits === 5);
t.ok("addition of exactly 1,500 sf: 8.0, flagged verify (PPG's study used 5)", cr("addition", 1500).credits === 8 && cr("addition", 1500).state === "verify");
t.ok("new house: 5.0 under 1,500, 8.0 to 5,000, 9.0 above", cr("new", 1200).credits === 5 && cr("new", 4500).credits === 8 && cr("new", 5200).credits === 9);
t.ok("no size, no credits and no zero", cr("addition", null).credits === null && cr("new", 0).credits === null);
t.ok("from May 3, 2027 the 2021 table is not used", cr("new", 4500, "2027-05-03").credits === null && cr("new", 4500, "2027-05-03").state === "verify" && cr("new", 4500, "2027-05-02").credits === 8);

t.done();
