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
t.ok("LR3 (M1) is 40 ft with the suffix and does not say the unsuffixed house height", lr3.floorCap === 10800 && lr3.height.ft === 40 && /40 ft with an MHA suffix/.test(lr3.height.text) && !/without an MHA suffix is 32/.test(JSON.stringify(lr3)));
t.ok("LR3 without a suffix is 32 ft", R.pick({ juris: "seattle", zone: "LR3", lot: 6000 }).height.ft === 32);
t.ok("LR3 RC (M) is LR3 with the suffix", R.parseLr("LR3 RC (M)").base === "LR3" && R.parseLr("LR3 RC (M)").mha === "M" && R.pick({ juris: "seattle", zone: "LR3 RC (M)", lot: 5000 }).height.ft === 40);
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
var everett = R.pick({ juris: "city", city: "everett", zone: "UR3", lot: 6000, stateAbbr: "WA" });
t.ok("Everett UR3 is typical residential, not a non-house lot", everett.assumed === true && everett.residential === true && !/not a house lot/.test(JSON.stringify(everett)));
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

t.done();
