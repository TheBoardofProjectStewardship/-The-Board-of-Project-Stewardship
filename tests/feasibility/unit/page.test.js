/* Unit tests for the helpers assets/js/build-here.js exports (window.BuildHere).   node tests/unit/page.test.js
   The page script is loaded with stand-ins for the browser. Nothing is drawn and nothing is fetched. */
"use strict";
var fs = require("fs");
var path = require("path");
var t = require("./_t.js");
var fx = require("./_fixture.js");
var G = fx.G;
var SRC = path.join(__dirname, "../../../assets/feasibility/");

globalThis.window = globalThis;
globalThis.BuildHereMeasures = require(SRC + "build-here-measures.js");
globalThis.BuildHereLandscape = require(SRC + "build-here-landscape.js");
globalThis.BuildHereSitePlan = require(SRC + "build-here-siteplan.js");
globalThis.BuildHereSummary = require(SRC + "build-here-summary.js");
globalThis.BuildHereStage = require(SRC + "build-here-stage.js");
globalThis.BuildHereExport = require(SRC + "build-here-export.js");

var store = {};
globalThis.location = { search: "?utm_source=google&utm_medium=cpc&gclid=TESTCLICK&bh_address=5514+160th+Ave+NE&email=jane%40example.org", hostname: "example.org", pathname: "/build/", hash: "", href: "https://example.org/build/", origin: "https://example.org" };
globalThis.sessionStorage = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } };
globalThis.document = { readyState: "complete", addEventListener: function () {}, getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; } };

/* Loads the page script afresh with a configuration, the way an embed does (autoInit: false). */
function load(cfg) {
  var file = require.resolve(SRC + "build-here.js");
  delete require.cache[file];
  delete globalThis.BuildHere;
  globalThis.BuildHereConfig = Object.assign({ autoInit: false }, cfg || {});
  require(file);
  return globalThis.BuildHere;
}
var BH = load({ brand: "Pacific Pro Group", legalName: "Pacific Pro Group LLC", tagline: "Design-Build", phone: "(206) 446-5656", email: "admin@pacificprogroup.com", site: "pacificprogroup.com", logoUrl: "http://insecure.example/logo.png" });

t.ok("the page script loads without a browser and exports its helpers", !!BH && typeof BH.ctaUrl === "function" && typeof BH.track === "function" && typeof BH.sampleState === "function");

/* ---- links a button may carry ---- */
t.ok("a Call button may dial", BH.ctaUrl("tel:+12064465656") === "tel:+12064465656" && BH.ctaUrl("tel:206-446-5656") === "tel:206-446-5656");
t.ok("an Email button may open a message", BH.ctaUrl("mailto:admin@pacificprogroup.com") === "mailto:admin@pacificprogroup.com");
t.ok("an email link may carry a plain subject", BH.ctaUrl("mailto:admin@pacificprogroup.com?subject=Lot%20question") === "mailto:admin@pacificprogroup.com?subject=Lot%20question");
t.ok("an email link with extra recipients or a body is dropped", BH.ctaUrl("mailto:a@example.org?bcc=b@example.org") === "" && BH.ctaUrl("mailto:a@example.org?subject=x&body=y") === "" && BH.ctaUrl("mailto:a@example.org,b@example.org") === "");
t.ok("a phone link that is not a number is dropped", BH.ctaUrl("tel:call-me") === "" && BH.ctaUrl("tel:") === "" && BH.ctaUrl("tel:+1 206 446 5656; ext=<script>") === "");
t.ok("a script or data address is dropped", BH.ctaUrl("javascript:alert(1)") === "" && BH.ctaUrl(" JavaScript:alert(1)") === "" && BH.ctaUrl("data:text/html,<p>x</p>") === "" && BH.ctaUrl("vbscript:x") === "");
t.ok("web addresses, site paths and in-page links are kept", BH.ctaUrl("https://pacificprogroup.com/contact/") === "https://pacificprogroup.com/contact/" && BH.ctaUrl("/contact/") === "/contact/" && BH.ctaUrl("#bh-lead-card") === "#bh-lead-card");
t.ok("an ordinary link never dials or mails", BH.linkUrl("tel:+12064465656") === "" && BH.linkUrl("mailto:a@example.org") === "" && BH.linkUrl("./permits.html") === "./permits.html" && BH.linkUrl(null) === "");

/* ---- the firm ---- */
var b = BH.brandInfo();
t.ok("the firm's details come from the settings", b.name === "Pacific Pro Group LLC" && b.tagline === "Design-Build" && b.phone === "(206) 446-5656" && b.email === "admin@pacificprogroup.com" && b.site === "pacificprogroup.com");
t.ok("an empty registration number stays empty", b.license === "");
t.ok("a logo that is not on https is not drawn", b.logoUrl === "");
t.ok("an https logo is kept", load({ logoUrl: "https://pacificprogroup.com/wp-content/uploads/logo.svg" }).brandInfo().logoUrl === "https://pacificprogroup.com/wp-content/uploads/logo.svg");
t.ok("a logo path on this site becomes a full address", load({ logoUrl: "/wp-content/uploads/logo.svg" }).brandInfo().logoUrl === "https://example.org/wp-content/uploads/logo.svg");
t.ok("a protocol-relative or script logo is not drawn", load({ logoUrl: "//evil.example/x.png" }).brandInfo().logoUrl === "" && load({ logoUrl: "javascript:alert(1)" }).brandInfo().logoUrl === "");
t.ok("with no company name the short name is used", load({ brand: "Pacific Pro Group" }).brandInfo().name === "Pacific Pro Group");
BH = load({ brand: "Pacific Pro Group", legalName: "Pacific Pro Group LLC", phone: "(206) 446-5656", email: "admin@pacificprogroup.com", site: "pacificprogroup.com" });

/* ---- street names ---- */
function parts(sv) { var p = BH.streetParts(sv); return p.type + "|" + p.dirs.join(","); }
t.ok("street type and direction are read in one spelling", parts("4TH AVENUE WEST") === "AVE|W" && parts("4th Ave W") === "AVE|W");
t.ok("a leading direction is read too", parts("NE 55th St") === "ST|NE" && parts("Northeast 55th Street") === "ST|NE");
t.ok("the city after the comma is not read as part of the street", parts("160th Ave NE, Redmond, WA 98052") === "AVE|NE" && parts("12 Lake St, North Bend") === "ST|");
t.ok("a street with no type or direction gives neither", parts("Broadway") === "|" && parts("") === "|" && parts(null) === "|");

/* ---- the lot outline as a query shape ---- */
var lot = fx.state().rings;
var q = BH.polyQuery(lot, { returnCountOnly: true });
t.ok("a plain lot is asked about by its outline", q.geometryType === "esriGeometryPolygon" && q.returnCountOnly === true && q.inSR === 4326 && JSON.parse(q.geometry).rings[0].length === 5);
function circle(n, rDeg) { var r = []; for (var i = 0; i <= n; i++) { var a = 2 * Math.PI * (i % n) / n; r.push([-122.1273 + rDeg * Math.cos(a) * 1.48, 47.6573 + rDeg * Math.sin(a)]); } return [r]; }
var flag = {}, qc = BH.polyQuery(circle(480, 0.0002), {}, flag), nc = qc.geometryType === "esriGeometryPolygon" ? JSON.parse(qc.geometry).rings[0].length : 0;
t.ok("a long curved outline is thinned and still asked about as an outline", qc.geometryType === "esriGeometryPolygon" && nc <= 300 && nc >= 12 && !flag.box, [qc.geometryType, nc]);
var thin = JSON.parse(qc.geometry).rings, aFull = BH.polyAreaSqft(circle(480, 0.0002)), aThin = BH.polyAreaSqft(thin);
t.ok("thinning keeps the shape (area within 2%)", Math.abs(aThin - aFull) / aFull < 0.02, [Math.round(aFull), Math.round(aThin)]);
function zigzag(n) { var r = []; for (var i = 0; i < n; i++) r.push([-122.13 + i * 0.00002, 47.65 + (i % 2 ? 0.001 : 0)]); r.push([-122.13 + n * 0.00002, 47.64], [-122.13, 47.64], r[0].slice()); return [r]; }
var flag2 = {}, qz = BH.polyQuery(zigzag(900), { returnCountOnly: true }, flag2);
t.ok("an outline that cannot be thinned is asked about as a box, and the caller is told", qz.geometryType === "esriGeometryEnvelope" && flag2.box === true && qz.geometry.split(",").length === 4, qz.geometryType);
t.ok("lot area from the outline", t.near(BH.polyAreaSqft(lot), fx.W * fx.H, 12), BH.polyAreaSqft(lot));

/* ---- events: what may leave the page ---- */
var sent = [];
globalThis.gtag = function () { sent.push(Array.prototype.slice.call(arguments)); };
BH.track("bh_report_ready", { county: "King County", jurisdiction: "City of Redmond, King County", zone_code: "NR", rules_coded: true,
  address: "5514 160th Ave NE", parcel: "2155000300", pin: "2155000300", lat: 47.6573, lon: -122.1273, name: "Jane Doe", email: "jane@example.org", phone: "206 555 0100", note: "call me" });
var ev = sent[0] || [];
t.ok("an event goes to the Google tag the site already loads", ev[0] === "event" && ev[1] === "bh_report_ready");
t.ok("only the listed fields travel", Object.keys(ev[2] || {}).sort().join() === "county,jurisdiction,rules_coded,zone_code", Object.keys(ev[2] || {}));
t.ok("no address, parcel number, coordinate, name, email or phone is in the event", !/5514|2155000300|47\.65|122\.12|Jane|example\.org|555/.test(JSON.stringify(ev)));
t.ok("a yes/no stays a yes/no", ev[2].rules_coded === true);
BH.track("bh_cta_click", { cta: new Array(200).join("x"), placement: null });
t.ok("a long value is cut to 80 characters and an empty one is left out", sent[1][2].cta.length === 80 && !("placement" in sent[1][2]));
delete globalThis.gtag;
var layer = [];
globalThis.dataLayer = layer;
BH.track("bh_lookup_submit", {});
t.ok("with no gtag function the event is queued on the existing dataLayer, in gtag's own form", layer.length === 1 && layer[0][0] === "event" && layer[0][1] === "bh_lookup_submit" && Object.prototype.toString.call(layer[0]) === "[object Arguments]");
delete globalThis.dataLayer;
var threw = false;
try { BH.track("bh_lookup_submit", { county: "King County" }); } catch (e) { threw = true; }
t.ok("with no Google tag on the page nothing happens and nothing breaks", !threw && typeof globalThis.dataLayer === "undefined" && typeof globalThis.gtag === "undefined");

/* Every event the page fires, read from the source: its name and its fields. */
var page = fs.readFileSync(SRC + "build-here.js", "utf8");
var calls = [], re = /\btrack\("([a-z_]+)",\s*\{([^}]*)\}/g, m;
while ((m = re.exec(page))) calls.push({ name: m[1], keys: (m[2].match(/(^|,)\s*([a-z_]+)\s*:/g) || []).map(function (k) { return k.replace(/[^a-z_]/g, ""); }) });
var names = calls.map(function (c) { return c.name; }).filter(function (n, i, a) { return a.indexOf(n) === i; }).sort();
t.ok("the events are the documented seven", names.join() === "bh_cta_click,bh_lookup_error,bh_lookup_submit,bh_report_ready,bh_siteplan_view,bh_study_export,generate_lead", names);
var ALLOWED = ["county", "jurisdiction", "zone_code", "rules_coded", "reason", "cta", "placement", "method", "project_type", "sheet", "drawn"];
var stray = [];
calls.forEach(function (c) { c.keys.forEach(function (k) { if (ALLOWED.indexOf(k) < 0) stray.push(c.name + "." + k); }); });
t.ok("no event is given a field outside the list", stray.length === 0, stray);
var leads = calls.filter(function (c) { return c.name === "generate_lead"; });
t.ok("generate_lead is fired in one place only: after this site has sent the message", leads.length === 1 && /method:\s*"form"/.test(page.slice(page.indexOf('track("generate_lead"'), page.indexOf('track("generate_lead"') + 80)), leads.length);
t.ok("the page adds no tag of its own: no gtag config, no tag manager, no Ads conversion", !/gtag\(\s*["']config["']/.test(page) && !/googletagmanager/i.test(page) && !/send_to/.test(page) && !/AW-\d/.test(page));
t.ok("where the visitor came from is kept for the lead message only, without the address", store.bhAttr === JSON.stringify({ utm_source: "google", utm_medium: "cpc", gclid: "TESTCLICK" }), store.bhAttr);

/* ---- the sample study (shown only on a local test server, or when a site allows it) ---- */
var s2 = BH.sampleState("2"), s1 = BH.sampleState("1");
t.ok("sample 2 is a Redmond NR lot with an outline, a house and ground", s2.zone === "NR" && s2.cityKey === "redmond" && s2.rings && s2.rings[0].length === 5 && !!(s2.landscape && s2.landscape.geo && s2.landscape.geo.buildings.length));
t.ok("sample 1 is a lot with no coded zone", s1.zone === "" && s1.juris === "outside" && !!s1.rings);
t.ok("a sample says it is a sample, never a property record", /Sample lot/.test(s2.matched) && /not a property record/.test(s2.matched) && /not a property record/.test(s1.matched));
t.ok("a sample carries no parcel number and no name", !s2.parcel && !s1.parcel && !/owner|taxpayer/i.test(JSON.stringify(s2)));

/* ---- one reading of the lot lines per redraw ---- */
var st = fx.state(), SB = { front: 10, side: 3, rear: 5, streetSide: 10, rearAlley: 2 };
var L1 = BH.lotGeometry(st, SB), L2 = BH.lotGeometry(st, SB);
t.ok("lot lines and the envelope are worked out once and reused", !!L1 && L1 === L2 && !!L1.env);
var envWant = (fx.W - 15) * (fx.H - 6);
t.ok("the envelope is the lot less the setbacks", t.near(L1.env.area, envWant, envWant * 0.02), [L1.env.area, envWant]);
var L3 = BH.lotGeometry(st, { front: 20, side: 5, rear: 20 });
t.ok("a change of setbacks reads the lot again", L3 !== L1 && L3.env.area < L1.env.area);
t.ok("with no outline there is no geometry", BH.lotGeometry({ rings: null }, SB) === null);
t.ok("the setback of a line follows its kind", BH.setbackFor({ kind: "front" }, SB) === 10 && BH.setbackFor({ kind: "rear", alley: true }, SB) === 2 && BH.setbackFor({ kind: "street" }, SB) === 10 && BH.setbackFor({ kind: "side" }, SB) === 3);
var mr = BH.minRect(G.project(st.rings, G.frame(st.lat, st.lon))[0]);
t.ok("the smallest rectangle around the lot has the lot's sides", !!mr && t.near(Math.max(mr.w, mr.d), fx.W, 0.5) && t.near(Math.min(mr.w, mr.d), fx.H, 0.5), mr && [mr.w, mr.d]);

t.done();
