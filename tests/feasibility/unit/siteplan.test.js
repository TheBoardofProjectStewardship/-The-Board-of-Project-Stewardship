/* Unit tests for assets/js/build-here-siteplan.js.   node tests/unit/siteplan.test.js */
"use strict";
var t = require("./_t.js");
var fx = require("./_fixture.js");
var G = fx.G;
var SP = require("../../../assets/feasibility/build-here-siteplan.js");
globalThis.BuildHereSitePlan = SP;
var Sum = require("../../../assets/feasibility/build-here-summary.js");

function lines(s, sb, o) {
  o = o || {};
  var g = s.landscape.geo;
  return SP.lotLines({ rings: s.rings, lon: s.lon, lat: s.lat, frontDir: o.frontDir || "", neighbors: s.neighborRings, setbacks: sb, streets: o.noStreets ? [] : g.streets, addrStreet: o.addrStreet === undefined ? "160TH AVE NE" : o.addrStreet, frame: g.frame });
}
function kinds(L) { var k = {}; L.lines.forEach(function (ln) { var key = ln.kind + (ln.alley ? "+alley" : ""); k[key] = (k[key] || 0) + 1; }); return k; }
function west(L) { return L.lines.filter(function (ln) { return ln.nx < -0.9; })[0]; }
function east(L) { return L.lines.filter(function (ln) { return ln.nx > 0.9; })[0]; }
function south(L) { return L.lines.filter(function (ln) { return ln.ny < -0.9; })[0]; }
var SB = { front: 10, side: 3, rear: 5, streetSide: 10, rearAlley: 2, buildingSep: 5 };

/* ---- street names ---- */
t.ok("a street name reduces to its distinctive part", SP.streetCore("160TH AVE NE") === "160TH" && SP.streetCore("160th Avenue Northeast") === "160TH" && SP.streetCore("NE 55th St") === "55TH");
t.ok("a named street keeps its words", SP.streetCore("Lake Washington Blvd NE") === "LAKE WASHINGTON");

/* ---- interior lot ---- */
var s = fx.state(), L = lines(s, SB);
t.ok("an interior lot reads front, two sides, rear", kinds(L).front === 1 && kinds(L).side === 2 && kinds(L).rear === 1, kinds(L));
t.ok("the front is the line on the street", west(L).kind === "front" && east(L).kind === "rear");
t.ok("no corner, no alley, no street behind", !L.corner && !L.ce.alley && !L.ce.through);
t.ok("the front street is named from the map", L.ce.frontStreet === "160th Avenue Northeast" && L.ce.byName === true, L.ce.frontStreet);
t.ok("frontage is the length of the front line", t.near(L.ce.frontage, fx.H, 0.2), L.ce.frontage);
t.ok("the lot's own outline is not read as a neighbor", L.parcels.length === s.neighborRings.length - 1, L.parcels.length);
t.ok("lot line lengths are to a tenth of a foot", t.near(west(L).len, 79.56, 0.06) && t.near(south(L).len, 120.69, 0.06), [west(L).len, south(L).len]);
var envWant = (fx.W - 15) * (fx.H - 6);
t.ok("the envelope is the lot less the setbacks", L.env && t.near(L.env.area, envWant, envWant * 0.02), L.env && [L.env.area, envWant]);
t.ok("the envelope is traced as an outline", L.env.rings.length === 1 && t.near(G.area(L.env.rings), envWant, envWant * 0.03), L.env.rings.length);
t.ok("no envelope when a setback is not coded", lines(s, { front: 10, side: 3 }).env === null);

/* ---- corner lot: the address street is the front even when the point is nearer the side street ---- */
var sc = fx.state({ corner: true, pointSouth: true }), Lc = lines(sc, SB);
t.ok("on a corner lot the address street is the front", west(Lc).kind === "front", west(Lc).kind);
t.ok("the other street line is a street side", south(Lc).kind === "street" && Lc.corner === true, south(Lc).kind);
t.ok("a corner lot keeps a rear and a side", kinds(Lc).rear === 1 && kinds(Lc).side === 1, kinds(Lc));
var Lc2 = lines(sc, SB, { noStreets: true, addrStreet: "" });
t.ok("without street names the open line nearest the address point is the front", south(Lc2).kind === "front" && west(Lc2).kind === "street", [south(Lc2).kind, west(Lc2).kind]);
t.ok("the street-side setback is used on the street side", SP.setbackFor({ kind: "street" }, SB) === 10 && SP.setbackFor({ kind: "street" }, { front: 20, side: 5, rear: 20, streetSide: 15 }) === 15);
t.ok("with no street-side figure the front setback is used", SP.setbackFor({ kind: "street" }, { front: 20, side: 5, rear: 20 }) === 20);
var envC = (fx.W - 10 - 5) * (fx.H - 10 - 3);
t.ok("a corner lot's envelope uses the street-side setback", t.near(Lc.env.area, envC, envC * 0.02), [Lc.env.area, envC]);

/* ---- alley ---- */
var sa = fx.state({ rearGap: 16 }), La = lines(sa, SB, { noStreets: false });
t.ok("a 16 ft open strip with a parcel across it is an alley", east(La).alley === true && east(La).kind === "rear", [east(La).kind, east(La).alley, east(La).gap]);
t.ok("an alley line is never the front", west(La).kind === "front" && !La.corner);
t.ok("the alley setback applies on the alley", SP.setbackFor(east(La), SB) === 2 && SP.setbackFor(east(La), { front: 10, side: 3, rear: 5 }) === 5);
var envA = (fx.W - 10 - 2) * (fx.H - 6);
t.ok("the envelope reaches to the alley setback", t.near(La.env.area, envA, envA * 0.02), [La.env.area, envA]);
var sa2 = fx.state({ rearGap: 16, alley: true });
t.ok("a mapped alley is read as an alley", east(lines(sa2, SB)).alley === true);
/* ---- a street behind the lot ---- */
var st = fx.state({ rearGap: 60 }), Lt = lines(st, SB);
t.ok("a 60 ft open strip behind the lot is a street, not an alley", !east(Lt).alley && east(Lt).kind === "rear" && Lt.ce.through === true, [east(Lt).kind, east(Lt).alley]);
/* ---- the visitor names the street side ---- */
var Ld = lines(s, SB, { frontDir: "S" });
t.ok("a typed street side wins", south(Ld).kind === "front", south(Ld).kind);
t.ok("the mapped street line is then a street side", west(Ld).kind === "street");
/* ---- no neighbor parcels: the mapped street stands in ---- */
var sn = fx.state({ noNeighbors: true }), Ln = lines(sn, SB);
t.ok("with no neighbor parcels the mapped street marks the front", west(Ln).kind === "front" && Ln.ce.openSrc === "streets", [west(Ln).kind, Ln.ce.openSrc]);

/* ---- the model ---- */
function modelOf(st2, rs, o) {
  o = o || {};
  return SP.model({ rings: st2.rings, lon: st2.lon, lat: st2.lat, frontDir: "", neighbors: st2.neighborRings, setbacks: rs ? rs.setbacks : {}, setbackVerify: rs && rs.setbackVerify, addrStreet: "160TH AVE NE", geo: o.noGeo ? null : st2.landscape.geo, slope: st2.landscape.slope, imagery: st2.imagery, hazardShapes: o.hazards || [] });
}
var v = fx.view(s), rs = fx.rules(s, v), M = modelOf(s, rs);
t.ok("the model is built", M.ok && M.house && M.buildings.length === 1 && M.nearBuildings.length === 1);
t.ok("Redmond NR setbacks are drawn and carry the verify tag", M.sbKnown && M.sbVerify && M.sb.front === 10 && M.sb.side === 3 && M.sb.rear === 5);
t.ok("four corner elevations", M.spots.length === 4, M.spots.length);
t.ok("corner elevations come from the samples", M.spots.every(function (p) { return p.el >= 159.5 && p.el <= 179.5; }), M.spots.map(function (p) { return p.el; }));
t.ok("contours are drawn at a readable interval", M.contours && M.contours.sets.length >= 4 && M.contours.sets.length <= 26 && M.contours.interval >= 1, M.contours && [M.contours.interval, M.contours.sets.length]);
t.ok("the house's distance to each line is read", M.houseDist && t.near(M.houseDist.front, 18.3, 0.4) && t.near(M.houseDist.rear, 68.3, 0.4) && t.near(M.houseDist.side, 15.3, 0.4), M.houseDist);
t.ok("no outline means no drawing, with the reason", SP.model({ rings: null }).ok === false && /No parcel outline/.test(SP.model({ rings: null }).why));

/* ---- options ---- */
var ctx = fx.context(s, v, rs, M.env.area);
function opt(id) { return ctx.options.filter(function (o) { return o.id === id; })[0]; }
function inEnv(P) { return P.ring.every(function (p) { return G.inRing(p[0], p[1], M.env.rings[0]) || G.distToRing(p[0], p[1], M.env.rings[0]) < 1.2; }); }
var pa = SP.place(M, opt("addition"));
t.ok("the addition is placed", pa.ok === true && pa.kind === "addition", pa);
t.ok("the addition is the size of the option", t.near(pa.sf, opt("addition").footprintSf, 8), [pa.sf, opt("addition").footprintSf]);
t.ok("the addition sits inside the setbacks", inEnv(pa));
t.ok("the addition does not overlap the house", pa.ring.every(function (p) { return !G.inRing(p[0], p[1], fx.HOUSE); }));
t.ok("the addition touches the house (within a foot)", pa.ring.some(function (p) { return G.distToRing(p[0], p[1], fx.HOUSE) < 1.2; }));
t.ok("the addition goes behind the house first", pa.where === "behind the house" && pa.cx > -8, [pa.where, pa.cx]);
var pd = SP.place(M, opt("adu"));
t.ok("the detached ADU is placed in the yard", pd.ok === true && inEnv(pd), pd);
t.ok("the detached ADU is behind the house", pd.cx > 10, pd.cx);
t.ok("it keeps the zone's building separation", pd.sep === 5 && pd.sepCoded === true && pd.ring.every(function (p) { return G.distToRing(p[0], p[1], fx.HOUSE) >= 4.9; }));
var pn = SP.place(M, opt("teardown"));
t.ok("the new house is placed inside the setbacks", pn.ok === true && inEnv(pn), pn);
t.ok("the new house is toward the front", pn.cx < 5, pn.cx);
var ps = SP.place(M, opt("shop"));
t.ok("the shop is placed", ps.ok === true && ps.kind === "shop");
var pr = SP.place(M, opt("remodel"));
t.ok("a remodel highlights the existing house and adds nothing", pr.ok && pr.existing === true && pr.sf === null);
t.ok("an option that does not fit is never drawn", SP.place(M, { id: "addition", kind: "addition", feasible: false, why: "The lot is at its coverage cap.", footprintSf: 750 }).ok === false);
var Mno = modelOf(s, { setbacks: { front: 10 } });
t.ok("with setbacks not coded an option is not placed", SP.place(Mno, opt("addition")).ok === false && /not all coded/.test(SP.place(Mno, opt("addition")).why));
var sNoHouse = fx.state({ noHouse: true }), MnoH = modelOf(sNoHouse, rs);
t.ok("with no house outline an addition is not drawn", SP.place(MnoH, opt("addition")).ok === false && /not in public data/.test(SP.place(MnoH, opt("addition")).why));
t.ok("a second story is drawn over the house outline", SP.place(M, { id: "addition", kind: "secondStory", feasible: true, footprintSf: 0, gfaSf: 1200, levels: 1 }).over === true);
var big = SP.place(M, { id: "adu", kind: "adu", feasible: true, footprintSf: 9000, gfaSf: 9000, levels: 1 });
t.ok("a footprint larger than the yard is not drawn", big.ok === false, big.why);

/* ---- tables ---- */
var F = Sum.facts(s, v, rs, ctx, { brand: fx.BRAND }, M);
var tb = SP.tables(M, opt("addition"), pa, F);
function tab(id) { return tb.filter(function (x) { return x.id === id; })[0]; }
function rowOf(id, re) { return tab(id).rows.filter(function (r) { return re.test(r.k); })[0]; }
t.ok("five tables", tb.length === 5 && tb.map(function (x) { return x.id; }).join() === "site,setbacks,coverage,impervious,gfa");
t.ok("lot area shows the assessor figure and the GIS figure", /9,600 sf \(0\.22 ac\) · GIS ≈ 9,602 sf/.test(rowOf("site", /Lot area/).v), rowOf("site", /Lot area/).v);
t.ok("the plat name and lot are in Site data", /2155000300 · East Crescent Lane, lot 30/.test(rowOf("site", /Parcel/).v), rowOf("site", /Parcel/).v);
t.ok("setback rows carry verify for Redmond NR", /10 ft \(verify\)/.test(rowOf("setbacks", /^Front/).v) && rowOf("setbacks", /^Front/).s === "verify");
t.ok("the existing house's distance is shown as an estimate", /\(E\) house ≈ 18 ft/.test(rowOf("setbacks", /^Front/).v), rowOf("setbacks", /^Front/).v);
t.ok("the setbacks title says verify", /SETBACKS \(NR — VERIFY\)/.test(tab("setbacks").title), tab("setbacks").title);
t.ok("coverage title shows the cap", /LOT COVERAGE \(50% = 4,800 sf\)/.test(tab("coverage").title), tab("coverage").title);
t.ok("an unmapped accessory building is orange text, not 0", rowOf("coverage", /accessory/).s === "missing" && rowOf("coverage", /accessory/).v === "not mapped");
t.ok("coverage with the option is checked against the cap", /2,331 sf · 24% ✓ under cap/.test(rowOf("coverage", /TOTAL WITH OPTION/).v), rowOf("coverage", /TOTAL WITH OPTION/).v);
t.ok("unmeasured paving is 'not measured — not zero'", rowOf("impervious", /driveway/).v === "not measured — not zero" && rowOf("impervious", /driveway/).s === "missing");
t.ok("a total that lacks paving prints with ≥", /^≥ 1,581 sf \(roofs only\)$/.test(rowOf("impervious", /TOTAL EXISTING/).v), rowOf("impervious", /TOTAL EXISTING/).v);
t.ok("the option total keeps the ≥", /^≥ 2,331 sf/.test(rowOf("impervious", /WITH OPTION/).v), rowOf("impervious", /WITH OPTION/).v);
t.ok("floor area lists what is counted", !!rowOf("gfa", /finished living/) && !!rowOf("gfa", /garage/), tab("gfa").rows.map(function (r) { return r.k; }));
t.ok("floor area with the option is checked against the cap", /✓ under 4,500/.test(rowOf("gfa", /TOTAL WITH OPTION/).v), rowOf("gfa", /TOTAL WITH OPTION/).v);
t.ok("energy credits are on the sheet", /credits/.test(rowOf("gfa", /Energy credits/).v), rowOf("gfa", /Energy/).v);
var all = JSON.stringify(tb);
t.ok("no table prints a bare 0 sf", !/(^|[^0-9,.])0 sf/.test(all), (all.match(/.{20}[^0-9,.]0 sf.{10}/) || [""])[0]);
var Fn = Sum.facts(sNoHouse, fx.view(sNoHouse), rs, fx.context(sNoHouse, fx.view(sNoHouse), rs, M.env.area), { brand: fx.BRAND }, MnoH), tbn = SP.tables(MnoH, null, null, Fn);
t.ok("no house outline: coverage is 'not in public data', never 0", tbn[2].rows.every(function (r) { return !/(^|[^0-9,.])0 sf/.test(r.v); }) && tbn[2].rows.some(function (r) { return r.s === "missing" && /not in public data/.test(r.v); }), tbn[2].rows);
var html = SP.tablesHtml(tb);
t.ok("the tables also come as HTML", /<caption>SITE DATA<\/caption>/.test(html) && /class="bh-s-missing"/.test(html) && /class="bh-total"/.test(html));

/* ---- the sheet ---- */
var sh = SP.sheet(M, { F: F, opt: opt("addition"), sheet: "SP-1" }), svg = sh.html;
t.ok("the sheet is one landscape drawing", /viewBox="0 0 1650 1250"/.test(svg) && /class="bh-page bh-sheet"/.test(svg));
t.ok("title, sheet number and address are on it", /PRELIMINARY SITE PLAN/.test(svg) && />SP-1</.test(svg) && /5514 160TH AVE NE/.test(svg));
t.ok("the title block carries the company, phone, email and site", /PACIFIC PRO GROUP LLC/.test(svg) && /\(206\) 446-5656/.test(svg) && /admin@pacificprogroup\.com/.test(svg) && /pacificprogroup\.com/.test(svg));
t.ok("kitchen and bath remodels are in the service line", /Kitchen &amp; bath remodels/.test(svg));
t.ok("an empty registration number is left off", !/contractor reg/.test(svg));
t.ok("a registration number shows when it is set", /WA contractor reg\. PACIFPG123AB/.test(SP.svg(M, { F: Object.assign({}, F, { brand: Object.assign({}, fx.BRAND, { license: "PACIFPG123AB" }) }), sheet: "SP-1" })));
t.ok("a logo address is drawn as an image", /<image href="https:\/\/example\.org\/logo\.png"/.test(SP.svg(M, { F: Object.assign({}, F, { brand: Object.assign({}, fx.BRAND, { logoUrl: "https://example.org/logo.png" }) }) })));
t.ok("nothing is referenced by id", !/\sid="/.test(svg) && !/url\(#/.test(svg) && !/<pattern|<clipPath|<marker|<defs|<use /.test(svg));
t.ok("lidar grades are spot elevations with ±", /EL 179&#39; ±/.test(svg) && /EL 160&#39; ±/.test(svg), (svg.match(/EL \d+[^<]{0,12}/g) || []).slice(0, 4));
t.ok("no top-of-wall or bottom-of-wall label", !/\bTOW\b|\bBOW\b|top of wall|bottom of wall/i.test(svg));
t.ok("the existing house and the concept are labeled", /\(E\) HOUSE/.test(svg) && /\(N\) ADDITION/.test(svg) && /≈ 750 sf × 2 levels/.test(svg));
t.ok("lot lines are dimensioned", /79\.6&#39;/.test(svg) && /120\.7&#39;/.test(svg), (svg.match(/>\d+\.\d&#39;</g) || []));
t.ok("setbacks are labeled on the plan", /10&#39; FRONT SETBACK \(verify\)/.test(svg) && /5&#39; REAR SETBACK \(verify\)/.test(svg) && /3&#39; SIDE SETBACK \(verify\)/.test(svg));
t.ok("the street is named", /160TH AVENUE NORTHEAST/.test(svg));
t.ok("the plan is at a standard scale with a scale bar", /1 in = 30 ft/.test(svg) && /GRAPHIC SCALE/.test(svg) && /scale bar governs/.test(svg));
t.ok("orange notes say what is not in public data", /DRIVEWAY \/ WALKS \/ PATIO: not in public data/.test(svg) && /TREES: no public tree layer/.test(svg));
t.ok("the aerial inset is drawn", /<image href="https:\/\/example\.org\/aerial\.jpg"/.test(svg));
t.ok("the drawing has a text description", /role="img" aria-label="Preliminary site plan for 5514 160TH AVE NE/.test(svg));
t.ok("the same figures follow as text", /bh-screen-only bh-sheet-twin/.test(svg) && /<caption>LOT COVERAGE/.test(svg));
t.ok("the buildable area is captioned", /BUILDABLE AREA ≈ 7,7[0-9]0 SF/.test(svg), (svg.match(/BUILDABLE AREA[^<]*/) || [""])[0]);
t.ok("the fall of the ground is noted as approximate", /GROUND FALLS ≈ 19&#39; ±/.test(svg));
var svgHz = SP.svg(modelOf(s, rs, { hazards: [{ label: "Steep slope", rings: [fx.rectLL(20, -39, 60, 0)] }] }), { F: F });
t.ok("a mapped hazard area is hatched and in the legend", /Mapped critical area/.test(svgHz) && /stroke="#b3261e"/.test(svgHz));
/* A concept is kept off mapped hazard ground while there is anywhere else for it to go. */
function onGround(P, x0, y0, x1, y1) {
  // Samples the placed rectangle and says whether any point of it lies inside the box (a third of a foot in from its edge).
  var r = P.ring, hit = false;
  for (var a = 0; a <= 12; a++) for (var b = 0; b <= 12; b++) {
    var u = a / 12, w = b / 12;
    var px = (1 - u) * (1 - w) * r[0][0] + u * (1 - w) * r[1][0] + u * w * r[2][0] + (1 - u) * w * r[3][0];
    var py = (1 - u) * (1 - w) * r[0][1] + u * (1 - w) * r[1][1] + u * w * r[2][1] + (1 - u) * w * r[3][1];
    if (px > x0 + 0.34 && px < x1 - 0.34 && py > y0 + 0.34 && py < y1 - 0.34) hit = true;
  }
  return hit;
}
function withHazard(x0, y0, x1, y1) { return modelOf(s, rs, { hazards: [{ label: "Steep slope", rings: [fx.rectLL(x0, y0, x1, y1)] }] }); }
var Mbehind = withHazard(-8, -22, 20, 24.5), paH = SP.place(Mbehind, opt("addition"));
t.ok("with a hazard mapped right behind the house the addition goes somewhere else", paH.ok === true && !onGround(paH, -8, -22, 20, 24.5) && !paH.onHazard, [paH.where, paH.sf, paH.onHazard]);
t.ok("and it still sits inside the setbacks, against the house", inEnv(paH) && paH.ring.some(function (p) { return G.distToRing(p[0], p[1], fx.HOUSE) < 1.2; }));
var Mrear = withHazard(20, -40, 61, 40), pdH = SP.place(Mrear, opt("adu"));
t.ok("a detached ADU is kept off a hazard mapped across the back of the lot", pdH.ok === true && !onGround(pdH, 20, -40, 61, 40) && !pdH.onHazard && inEnv(pdH), [pdH.cx, pdH.cy, pdH.sf]);
var pnH = SP.place(withHazard(20, -39, 60, 0), opt("teardown"));
t.ok("a new house is kept off the mapped hazard", pnH.ok === true && !onGround(pnH, 20, -39, 60, 0) && !pnH.onHazard, [pnH.cx, pnH.cy, pnH.sf]);
var Mall = withHazard(-70, -50, 70, 50), paAll = SP.place(Mall, opt("addition")), pdAll = SP.place(Mall, opt("adu")), pnAll = SP.place(Mall, opt("teardown"));
t.ok("when the whole lot is mapped hazard the concept is still drawn, and says it sits on it", paAll.ok && pdAll.ok && pnAll.ok && paAll.onHazard === true && pdAll.onHazard === true && pnAll.onHazard === true);
t.ok("the note names the critical-area review", /mapped critical area/.test(paAll.note) && /critical-area review/.test(pdAll.note) && /critical-area review/.test(pnAll.note), paAll.note);
var svgAll = SP.svg(Mall, { F: F, opt: opt("addition"), placed: paAll, sheet: "SP-1" });
t.ok("the sheet carries the hazard note as a line of its own", /CONCEPT ON A MAPPED CRITICAL AREA/.test(svgAll), (svgAll.match(/CONCEPT ON[^<]*/) || [""])[0]);
t.ok("with no hazard mapped nothing is said about one", !/critical area/.test(pa.note || "") && !pa.onHazard && !/critical area/.test(pd.note || "") && !/critical area/.test(pn.note || ""));
var blank = SP.sheet(SP.model({ rings: null }), { F: F, sheet: "SP-1" }).html;
t.ok("with no parcel outline the sheet says so and still carries the tables", /No parcel outline was found/.test(blank) && /SITE DATA/.test(blank) && /PACIFIC PRO GROUP LLC/.test(blank));
var evil = SP.svg(M, { F: Object.assign({}, F, { address: '5514 <script>alert(1)</script> "x" AVE' }) });
t.ok("text from records is escaped", !/<script>/.test(evil) && /&lt;SCRIPT&gt;/.test(evil));
t.ok("no owner name is drawn", !/CANARY/.test(svg));
var noOpt = SP.sheet(M, { F: F, sheet: "SP-1" }).html;
t.ok("a sheet with no option shows existing conditions only", !/\(N\) /.test(noOpt.split("bh-sheet-twin")[0].replace(/\(N\) concept footprint/g, "")) && /EXISTING CONDITIONS/.test(noOpt));
var notDrawn = SP.sheet(MnoH, { F: Fn, opt: opt("addition"), sheet: "SP-2" }).html;
t.ok("an option that cannot be drawn is explained in orange", /ADDITION NOT DRAWN: The house outline is not in public data/.test(notDrawn) && /HOUSE OUTLINE: not in public data/.test(notDrawn));
t.ok("the line under the title names a concept only when it is drawn", /EXISTING CONDITIONS \+ ADDITION CONCEPT/.test(svg) && /EXISTING CONDITIONS · ADDITION FIGURES ONLY, NOT DRAWN/.test(notDrawn) && !/ADDITION CONCEPT ·/.test(notDrawn), (notDrawn.match(/EXISTING CONDITIONS[^<]{0,60}/) || [""])[0]);
var tbZ = SP.tables(M, null, null, Object.assign({}, F, { zone: "R-5", zoneName: "R-5" }));
t.ok("a zone name that only repeats the zone code is not printed twice", tbZ[0].rows.filter(function (r) { return r.k === "Zone"; })[0].v === "R-5", tbZ[0].rows.filter(function (r) { return r.k === "Zone"; })[0].v);
/* Snohomish County: the county's house size is a labeled figure, never the living-area total. */
var Fsno = Object.assign({}, F, { living: { sf: 1850, label: "House size (county FinSize)", est: true, finSize: true, src: "Snohomish County Improvement Records" }, eff: Object.assign({}, F.eff, { floorUsed: null, floorParts: [], floorMissing: [] }) });
var gfaSno = SP.tables(M, opt("addition"), pa, Fsno)[4].rows;
t.ok("the county's house size is shown in the floor-area table as its own labeled row", gfaSno.some(function (r) { return /county FinSize/.test(r.k) && /≈ 1,850 sf · not total living area/.test(r.v) && r.s === "est"; }), gfaSno.map(function (r) { return r.k + "=" + r.v; }));
t.ok("and the floor-area total stays 'not in public data', with no total with the option", gfaSno.some(function (r) { return r.k === "TOTAL EXISTING" && r.s === "missing"; }) && !gfaSno.some(function (r) { return r.k === "TOTAL WITH OPTION"; }));
var th = SP.thumb(M, pa);
t.ok("a thumbnail is a small picture with no text", /^<svg viewBox="0 0 220 150" class="bh-thumb" aria-hidden="true"/.test(th) && !/<text/.test(th) && !/\sid="/.test(th));
t.ok("no thumbnail without a lot outline", SP.thumb(SP.model({ rings: null }), null) === "");
var studySheet = SP.sheet(M, { F: F, opt: opt("addition"), sheet: "SP-1", noSources: true, noInset: true, compact: true, pageLabel: "Page 3 of 6", pageNum: 3, totalPages: 6 }).html;
t.ok("the study sheet is the one drawing, labeled Page 3 of 6, with no inset and no links", /class="bh-sheet-svg"/.test(studySheet) && /Page 3 of 6/.test(studySheet) && /data-page="3"/.test(studySheet) && /data-total="6"/.test(studySheet) && !/bh-sheet-twin/.test(studySheet) && !/<image /.test(studySheet) && !/<a\b/i.test(studySheet) && !/\bPPG\b/.test(studySheet));
t.done();
