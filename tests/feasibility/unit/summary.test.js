/* Unit tests for assets/js/build-here-summary.js.   node tests/unit/summary.test.js */
"use strict";
var t = require("./_t.js");
var fx = require("./_fixture.js");
var SP = require("../../../assets/feasibility/build-here-siteplan.js");
globalThis.BuildHereSitePlan = SP;
var Sum = require("../../../assets/feasibility/build-here-summary.js");

function study(o, vo) {
  var s = fx.state(o), v = fx.view(s, vo), rs = s.juris === "outside" ? null : fx.rules(s, v);
  var M = SP.model({ rings: s.rings, lon: s.lon, lat: s.lat, neighbors: s.neighborRings, setbacks: rs ? rs.setbacks : {}, setbackVerify: rs && rs.setbackVerify, addrStreet: "160TH AVE NE", geo: s.landscape.geo, slope: s.landscape.slope });
  var ctx = fx.context(s, v, rs, M.ok && M.env ? M.env.area : null);
  var F = Sum.facts(s, v, rs, ctx, { brand: fx.BRAND }, M), B = Sum.blocks(F);
  return { s: s, v: v, rs: rs, M: M, ctx: ctx, F: F, B: B, html: Sum.factsSheet(F, B) };
}
/* A study of the fixture lot after `change` has edited the state: another county, another zone. */
function studyOf(change, vo) {
  var s = fx.state(); change(s);
  var v = fx.view(s, vo), rs = s.juris === "outside" ? null : fx.rules(s, v);
  var M = SP.model({ rings: s.rings, lon: s.lon, lat: s.lat, neighbors: s.neighborRings, setbacks: rs ? rs.setbacks : {}, setbackVerify: rs && rs.setbackVerify, addrStreet: "160TH AVE NE", geo: s.landscape.geo, slope: s.landscape.slope });
  var ctx = fx.context(s, v, rs, M.ok && M.env ? M.env.area : null);
  var F = Sum.facts(s, v, rs, ctx, { brand: fx.BRAND }, M), B = Sum.blocks(F);
  return { s: s, v: v, rs: rs, M: M, ctx: ctx, F: F, B: B, html: Sum.factsSheet(F, B) };
}
function rowOf(B, key) { var r = null; ["building", "remodel", "landscaping", "roofing"].forEach(function (b) { B[b].forEach(function (x) { if (x.key === key) r = x; }); }); return r; }
function allRows(B) { return B.building.concat(B.remodel, B.landscaping, B.roofing); }

var a = study();
/* ---- facts ---- */
t.ok("lot area keeps the record figure and the GIS figure", a.F.lot.sf === 9600 && a.F.lot.kind === "record" && a.F.lot.gisSf === 9602, a.F.lot);
t.ok("the zone name comes from the rules", a.F.zone === "NR" && a.F.zoneName === "Neighborhood Residential", a.F.zoneName);
t.ok("the place is named for verify notes", a.F.place === "the City of Redmond");
t.ok("frontage and the front street come from the drawing", Math.round(a.F.frontage) === 80 && a.F.frontStreet === "160th Avenue Northeast" && a.F.corner === false);
t.ok("the prepared date is written out", a.F.preparedText === "Nov 17, 2026", a.F.preparedText);
t.ok("no owner field is carried into the facts", JSON.stringify(a.F, function (k, v) { return k === "rs" || k === "site" ? undefined : v; }).indexOf("CANARY") < 0);

/* ---- four blocks, every row a fact or a labeled estimate ---- */
t.ok("four blocks with rows", a.B.building.length >= 12 && a.B.remodel.length >= 8 && a.B.landscaping.length >= 9 && a.B.roofing.length >= 5, [a.B.building.length, a.B.remodel.length, a.B.landscaping.length, a.B.roofing.length]);
t.ok("every row has a label, a value and a state", allRows(a.B).every(function (r) { return r.k && r.v && /^(fact|est|partial|missing|verify)$/.test(r.s); }));
t.ok("no row is a bare link", allRows(a.B).every(function (r) {
  if (r.key === "permitHistory" && r.v === "See page 5.") return true;
  return !/https?:\/\//.test(r.v) && !/^\s*(see|open|search|visit)\b/i.test(r.v) && r.v.length >= 4;
}), allRows(a.B).filter(function (r) { return r.key !== "permitHistory" && (/https?:\/\//.test(r.v) || /^\s*(see|open|search|visit)\b/i.test(r.v) || r.v.length < 4); }).map(function (r) { return r.key + ": " + r.v; }));
t.ok("row keys are unique", allRows(a.B).map(function (r) { return r.key; }).sort().join().indexOf(",,") < 0 && new Set(allRows(a.B).map(function (r) { return r.key; })).size === allRows(a.B).length);
t.ok("sources are numbered footnotes", a.B.notes.length >= 6 && a.B.notes.every(function (n, i) { return n.n === i + 1 && n.label; }) && allRows(a.B).some(function (r) { return r.fn.length > 0; }));
t.ok("a footnote number always has a footnote", allRows(a.B).every(function (r) { return r.fn.every(function (n) { return n >= 1 && n <= a.B.notes.length; }); }));

/* ---- Building ---- */
t.ok("height limit carries verify for Redmond NR", /^38 ft \(verify\)/.test(rowOf(a.B, "height").v) && rowOf(a.B, "height").s === "verify");
t.ok("floor area shows cap, existing and room left", /Cap 4,500 sf/.test(rowOf(a.B, "far").v) && /existing ≈ 2,990 sf/.test(rowOf(a.B, "far").v) && /room left ≈ 1,510 sf/.test(rowOf(a.B, "far").v), rowOf(a.B, "far").v);
t.ok("the floor-area row says what Redmond counts", /Garage, basement and outbuilding area are counted/.test(rowOf(a.B, "far").v) && rowOf(a.B, "far").s === "verify");
t.ok("lot coverage shows room left", /Cap 4,800 sf \(50% of the lot\) · existing ≈ 1,581 sf · room left ≈ 3,219 sf/.test(rowOf(a.B, "coverage").v), rowOf(a.B, "coverage").v);
t.ok("impervious with unmeasured paving is ≥ existing and ≤ room left", /existing ≥ 1,581 sf \(.*not measured\) · room left ≤ 5,139 sf/.test(rowOf(a.B, "impervious").v) && rowOf(a.B, "impervious").s === "partial", rowOf(a.B, "impervious").v);
t.ok("setbacks row has the figures and the buildable area", /Front 10 · side 3 · rear 5 ft \(verify\) · ≈ 7,7[0-9]0 sf inside the setbacks/.test(rowOf(a.B, "setbacks").v), rowOf(a.B, "setbacks").v);
t.ok("the addition row says what fits", /Fits the limits as read: ≈ 1,500 sf on 2 levels \(750 sf footprint\)/.test(rowOf(a.B, "addition").v), rowOf(a.B, "addition").v);
t.ok("the second-story row sends the structure question to the site visit", /Height limit 38 ft/.test(rowOf(a.B, "secondStory").v) && /checked on site/.test(rowOf(a.B, "secondStory").v));
t.ok("the ADU row has the count, the state floor and the impact-fee cap", /2 ADUs/.test(rowOf(a.B, "adu").v) && /impact fees at half/.test(rowOf(a.B, "adu").v), rowOf(a.B, "adu").v);
t.ok("units per lot is a fact from the code", /6 units per lot/.test(rowOf(a.B, "units").v));
t.ok("parking cites the 2025 state caps", /ESSB 5184/.test(rowOf(a.B, "parking").v));
t.ok("energy credits are worked out for the options", /Addition ≈ 1,500 sf: 8\.0 credits/.test(rowOf(a.B, "energy").v) && /new house ≈ 4,500 sf: 8\.0 credits/.test(rowOf(a.B, "energy").v) && /detached ADU ≈ 1,000 sf: 5\.0 credits/.test(rowOf(a.B, "energy").v), rowOf(a.B, "energy").v);
t.ok("exactly 1,500 sf of addition is marked verify", rowOf(a.B, "energy").s === "verify");
t.ok("the plat is a fact with the covenants note", /East Crescent Lane, lot 30/.test(rowOf(a.B, "plat").v) && /title report/.test(rowOf(a.B, "plat").v));
t.ok("frontage row names the street", /Front on 160Th Avenue Northeast|Front on 160th Avenue Northeast/.test(rowOf(a.B, "frontage").v) && /≈ 80 ft of street frontage/.test(rowOf(a.B, "frontage").v), rowOf(a.B, "frontage").v);
t.ok("cost drivers come from this study and carry no dollar figure", /sloping ground/.test(rowOf(a.B, "cost").v) && /pre-1978/.test(rowOf(a.B, "cost").v) && !/\$/.test(rowOf(a.B, "cost").v));

/* ---- Remodel ---- */
t.ok("asbestos applies whatever the year", /whatever the year/.test(rowOf(a.B, "asbestos").v) && rowOf(a.B, "asbestos").s === "fact");
t.ok("lead applies to a 1967 house", /Built 1967, before 1978/.test(rowOf(a.B, "lead").v));
var newer = fx.state(); newer.yearBuilt = "1995"; newer.years = [{ y: 1995, src: "x" }];
var Fb = Sum.facts(newer, a.v, a.rs, a.ctx, { brand: fx.BRAND }, a.M), Bb = Sum.blocks(Fb);
t.ok("lead does not apply by age to a 1995 house, asbestos still does", /after 1977/.test(rowOf(Bb, "lead").v) && /whatever the year/.test(rowOf(Bb, "asbestos").v));
var noYear = fx.state(); noYear.yearBuilt = ""; noYear.years = [];
var Bc = Sum.blocks(Sum.facts(noYear, a.v, a.rs, a.ctx, { brand: fx.BRAND }, a.M));
t.ok("with no year on record the lead rule is planned for", /plan as if/.test(rowOf(Bc, "lead").v) && rowOf(Bc, "lead").s === "verify" && rowOf(Bc, "year").s === "missing");
t.ok("house size lists living, first floor, basement and stories", /1,840 sf finished living · 1st floor 1,220 sf · basement 1,220 sf \(620 finished\) · 1 story/.test(rowOf(a.B, "house").v), rowOf(a.B, "house").v);
t.ok("bedrooms and baths from the index", /3 bedrooms · 1\.75 baths/.test(rowOf(a.B, "rooms").v));
t.ok("garage and deck from the record", /attached garage 550 sf · deck 180 sf/.test(rowOf(a.B, "garage").v));
t.ok("the facts row points at the permit page instead of repeating a source list", rowOf(a.B, "permitHistory").v === "See page 5." && rowOf(a.B, "permitHistory").s === "fact");
t.ok("kitchen and bath permits are answered and marked verify", /cabinets, counters, tile/.test(rowOf(a.B, "kitchenBath").v) && rowOf(a.B, "kitchenBath").s === "verify");

/* ---- Landscaping ---- */
t.ok("lot breakdown never turns unmeasured paving into 0", /driveway not measured/.test(rowOf(a.B, "breakdown").v) && /Not measured is not zero/.test(rowOf(a.B, "breakdown").v) && rowOf(a.B, "breakdown").s === "partial", rowOf(a.B, "breakdown").v);
t.ok("slope row is labeled lidar approx. and has the fall", /lidar approx/.test(rowOf(a.B, "slope").k) && /≈ 19 ft of fall toward the east/.test(rowOf(a.B, "slope").v));
t.ok("critical areas says which layers and that the city's were not read", /None mapped on this parcel in the King County Sensitive Areas/.test(rowOf(a.B, "critical").v) && /City of Redmond keeps its own/.test(rowOf(a.B, "critical").v) && rowOf(a.B, "critical").s === "partial");
t.ok("flood and soils say 'not read' when the service gave nothing", rowOf(a.B, "flood").s === "missing" && rowOf(a.B, "soils").s === "missing");
var withSvc = fx.state(); withSvc.flood = { ok: true, zones: ["X"], sfha: false }; withSvc.soils = { ok: true, name: "Alderwood gravelly sandy loam, 8 to 15 percent slopes", hsg: "B", drainage: "Moderately well drained" };
var Bd = Sum.blocks(Sum.facts(withSvc, a.v, a.rs, a.ctx, { brand: fx.BRAND }, a.M));
t.ok("a FEMA zone is shown when read", /FEMA flood zone X — outside the special flood hazard area/.test(rowOf(Bd, "flood").v) && rowOf(Bd, "flood").s === "fact");
t.ok("a soil map unit is shown as an estimate", /Alderwood gravelly sandy loam.*hydrologic group B.*moderately well drained/.test(rowOf(Bd, "soils").v) && rowOf(Bd, "soils").s === "est");
t.ok("the drainage trigger carries verify and the option's size", /2,000 sf/.test(rowOf(a.B, "drainage").v) && /addition option adds ≈ 750 sf of roof/.test(rowOf(a.B, "drainage").v) && rowOf(a.B, "drainage").s === "verify");
t.ok("fence and tree rules that are not coded say verify", rowOf(a.B, "fence").s === "verify" && rowOf(a.B, "trees").s === "verify" && /not coded/.test(rowOf(a.B, "fence").v));

/* ---- Roofing ---- */
t.ok("roof area comes from the roof outline with the pitch assumed", /≈ 1,770 sf at an assumed 6:12 pitch, about 17\.7 squares/.test(rowOf(a.B, "roofArea").v) && /4:12 ≈ 1,670 sf/.test(rowOf(a.B, "roofArea").v) && /8:12 ≈ 1,900 sf/.test(rowOf(a.B, "roofArea").v), rowOf(a.B, "roofArea").v);
var nh = study({ noHouse: true });
t.ok("with no roof outline the roof area is not worked out from living area", rowOf(nh.B, "roofArea").s === "missing" && /not worked out from living area/.test(rowOf(nh.B, "roofArea").v) && !/1,840/.test(rowOf(nh.B, "roofArea").v));
t.ok("the layers rule is a fact and the re-roof permit rule is verify outside Seattle", rowOf(a.B, "roofLayers").s === "fact" && rowOf(a.B, "reroofRule").s === "verify");
t.ok("solar is stated as not estimated", /Not estimated/.test(rowOf(a.B, "solar").v) && rowOf(a.B, "solar").s === "missing");

/* ---- missing is never 0 ---- */
var zero = /(^|[^0-9,.])0 sf/;
t.ok("no row prints a bare 0 sf", allRows(a.B).every(function (r) { return !zero.test(r.v); }) && allRows(nh.B).every(function (r) { return !zero.test(r.v); }), allRows(nh.B).filter(function (r) { return zero.test(r.v); }));
t.ok("no house outline: coverage reads not in public data", /not in public data/.test(rowOf(nh.B, "coverage").v) && rowOf(nh.B, "coverage").s === "missing", rowOf(nh.B, "coverage").v);
var blankState = { input: "1 Nowhere Rd", matched: "1 NOWHERE RD, SOMEWHERE, WA, 98000", county: "King County", city: "", stateAbbr: "WA", juris: "kc", jurisLabel: "Unincorporated King County", hazards: [], hazardNotes: [], permits: [], landscape: { rows: [] } };
var Fe = Sum.facts(blankState, { lot: null, zone: "", stories: "", type: "addition" }, null, null, { brand: fx.BRAND }, null), Be = Sum.blocks(Fe);
t.ok("a study with almost nothing read still fills every row", allRows(Be).length === allRows(a.B).length && allRows(Be).every(function (r) { return r.v && !zero.test(r.v); }));
t.ok("with nothing read most rows are missing or verify, none a fact about size", ["far", "coverage", "impervious", "setbacks", "house", "roofArea"].every(function (k) { return /^(missing|verify)$/.test(rowOf(Be, k).s); }), ["far", "coverage", "impervious", "setbacks", "house", "roofArea"].map(function (k) { return rowOf(Be, k).s; }));
t.ok("unincorporated land is named, with the mailing city", /Unincorporated King County/.test(rowOf(Be, "juris").v) && /mailing address says Somewhere/.test(rowOf(Be, "juris").v));

/* ---- Snohomish house size is shown, labeled with its source ---- */
var sn = fx.state(); sn.county = "Snohomish County"; sn.city = ""; sn.juris = "sno"; sn.jurisLabel = "Unincorporated Snohomish County"; sn.existing = null; sn.existingSrc = ""; sn.countyFinSrc = "Snohomish County Improvement Records, FinSize column (house-size index built 2026-11-01)";
var ctxSn = fx.context(sn, fx.view(sn), null, null); ctxSn.effective.countyFinSize = 1620;
var Fs = Sum.facts(sn, fx.view(sn), null, ctxSn, { brand: fx.BRAND }, a.M), Bs = Sum.blocks(Fs);
t.ok("the county FinSize is shown as the county's figure", Fs.living && Fs.living.sf === 1620 && Fs.living.est === true && /FinSize/.test(Fs.living.label));
t.ok("it is labeled with its source and what it leaves out", /≈ 1,620 sf county FinSize \(basement and attic finished area are separate columns and are not added\)/.test(rowOf(Bs, "house").v) && Bs.notes.some(function (n) { return /Snohomish County Improvement Records, FinSize/.test(n.label); }), rowOf(Bs, "house").v);

/* ---- the question checklist ---- */
var ans = Sum.answers(a.F, a.B);
t.ok("52 planning questions are tracked", ans.length === 52 && ans[0].n === 1 && ans[51].n === 52);
t.ok("every question is answered on a sheet or sent to the site visit", ans.every(function (q) { return q.ok; }), ans.filter(function (q) { return !q.ok; }));
t.ok("each answer says where it is", ans.every(function (q) { return q.where; }), ans.filter(function (q) { return !q.where; }));
t.ok("questions public data cannot answer go to the one on-site row", ans.filter(function (q) { return q.status === "visit"; }).map(function (q) { return q.n; }).join() === "10,11,23,26,32,35,38,51", ans.filter(function (q) { return q.status === "visit"; }).map(function (q) { return q.n; }).join());
t.ok("the on-site row lists what is confirmed there", /sewer or septic/.test(a.B.visit.text) && /easements/.test(a.B.visit.text) && /construction cost/.test(a.B.visit.text) && /^Pacific Pro Group LLC confirms on site/.test(a.B.visit.text));
var ansE = Sum.answers(Fe, Be);
t.ok("a thin study still maps every question", ansE.every(function (q) { return q.ok; }));

/* ---- the sheet ---- */
t.ok("the facts sheet is page F-1 with four blocks", /data-sheet="F-1"/.test(a.html) && /<h3>Building<\/h3>/.test(a.html) && /<h3>Remodel<\/h3>/.test(a.html) && /<h3>Landscaping<\/h3>/.test(a.html) && /<h3>Roofing<\/h3>/.test(a.html));
t.ok("phone and site are plain text, with no link", /\(206\) 446-5656/.test(a.html) && /pacificprogroup\.com/.test(a.html) && !/<a\b/i.test(a.html) && !/href="/i.test(a.html));
t.ok("an empty registration number is hidden", !/contractor reg/.test(a.html));
t.ok("a registration number shows when set", /WA contractor reg\. PACIFPG123AB/.test(Sum.factsSheet(Object.assign({}, a.F, { brand: Object.assign({}, fx.BRAND, { license: "PACIFPG123AB" }) }))));
t.ok("orange and estimate states are marked for the stylesheet", /class="bh-s-missing"/.test(a.html) && /class="bh-s-est"/.test(a.html) && /class="bh-s-verify"/.test(a.html));
t.ok("the printed facts sheet has no footnote list and no source links", !/<ol class="bh-facts-notes">/.test(a.html) && !/<sup class="bh-fn">/.test(a.html) && !/https?:\/\//.test(a.html));
t.ok("the facts sheet is page 2 of 6 and does not say PPG", /Page 2 of 6/.test(a.html) && /data-page="2"/.test(a.html) && /data-total="6"/.test(a.html) && !/\bPPG\b/.test(a.html));
t.ok("no owner name on the sheet", a.html.indexOf("CANARY") < 0);
t.ok("no top-of-wall or bottom-of-wall wording", !/\bTOW\b|\bBOW\b/.test(a.html));
var evil = fx.state(); evil.matched = '5514 <img src=x onerror=alert(1)> AVE, REDMOND, WA, 98052';
var evilHtml = Sum.factsSheet(Sum.facts(evil, a.v, a.rs, a.ctx, { brand: fx.BRAND }, a.M));
t.ok("record text is escaped", /&lt;img src=x onerror=alert\(1\)&gt;/.test(evilHtml) && !/<img src=x/.test(evilHtml));
t.ok("contact links refuse anything that is not a phone, an email or a web address", Sum.telHref("javascript:alert(1)") === "" && Sum.mailHref("a@b.co\"><script>") === "" && Sum.siteHref("pacificprogroup.com") === "https://pacificprogroup.com");

/* ---- next step tied to the result ---- */
var ns = Sum.nextStep(a.F);
t.ok("the next step quotes this lot's numbers", /buildable area inside the setbacks/.test(ns.lead) && /1,510 sf of floor-area room/.test(ns.lead) && ns.steps.length === 3, ns.lead);
t.ok("with nothing coded the next step says to check the limits", /not all coded/.test(Sum.nextStep(Fe).lead));

/* ---- unincorporated Snohomish County, a rural zone: part of the rules coded, the house size a county figure ---- */
var sn = studyOf(function (s) {
  s.county = "Snohomish County"; s.city = ""; s.juris = "sno"; s.cityKey = ""; s.jurisLabel = "Unincorporated Snohomish County";
  s.parcel = "00373300100100"; s.zone = "R-5"; s.zoneSrc = "Snohomish County zoning map"; s.lotKind = "outline"; s.lotSrc = "County parcel outline";
  s.existing = null; s.existingSrc = ""; s.firstFloor = null; s.garageFloor = null; s.basementTotal = null; s.basementFinished = null; s.deck = null; s.baths = null;
  s.countyFin = { sf: 1850, source: "Snohomish County Improvement Records workbook, read through this site's house-size index (FinSize column)" }; s.countyFinSrc = s.countyFin.source;
  s.yearBuilt = "1978"; s.yearSrc = "Snohomish County Improvement Records workbook (YrBuilt)"; s.years = [{ y: 1978, src: s.yearSrc }];
});
t.ok("a zone name that repeats the zone code is printed once", rowOf(sn.B, "zone").v.indexOf("R-5 · R-5") < 0 && /^R-5/.test(rowOf(sn.B, "zone").v), rowOf(sn.B, "zone").v);
t.ok("a zone with no floor-area ratio says so as a fact, not in orange", /^No floor-area ratio in this zone/.test(rowOf(sn.B, "far").v) && rowOf(sn.B, "far").s === "fact", [rowOf(sn.B, "far").s, rowOf(sn.B, "far").v]);
var aduSn = rowOf(sn.B, "adu").v;
t.ok("an ADU rule that is not coded reads as a sentence and names whom to ask", /^ADU rules not coded for this zone — verify with unincorporated Snohomish County\./.test(aduSn) && rowOf(sn.B, "adu").s === "verify", aduSn);
t.ok("and it does not say 'not coded' twice or open with a bare (verify)", (aduSn.match(/not coded/g) || []).length === 1 && !/^\s*\(verify\)/.test(aduSn), aduSn);
t.ok("the county's house size is carried as a labeled county figure, not as living area", !!sn.F.living && sn.F.living.finSize === true && sn.F.living.est === true && sn.F.living.sf === 1850 && sn.F.eff.living == null, sn.F.living);
t.ok("the house-size row says what the county figure leaves out", /≈ 1,850 sf county FinSize \(basement and attic finished area are separate columns and are not added\)/.test(rowOf(sn.B, "house").v), rowOf(sn.B, "house") && rowOf(sn.B, "house").v);
t.ok("with the street setback not coded the setbacks row says no buildable area is drawn", /not coded, so no buildable area is drawn/.test(rowOf(sn.B, "setbacks").v) && sn.F.envArea == null, rowOf(sn.B, "setbacks").v);
var addSn = rowOf(sn.B, "addition");
t.ok("an addition whose size fits but whose place was not checked says so, in orange", /^The size fits the limits as read/.test(addSn.v) && /where it can sit on the lot is not checked/.test(addSn.v) && addSn.s === "verify", [addSn.s, addSn.v]);
t.ok("with a buildable area drawn the row says it fits, as an estimate", /^Fits the limits as read/.test(rowOf(a.B, "addition").v) && rowOf(a.B, "addition").s === "est", rowOf(a.B, "addition").v);
t.ok("the place named for verify notes is the county", sn.F.place === "unincorporated Snohomish County", sn.F.place);
t.ok("nothing in the Snohomish sheet is a bare zero", !/(^|[^0-9,.])0 sf/.test(sn.html.replace(/<[^>]+>/g, " ")));
t.done();
