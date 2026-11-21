/* Slope wording and sheet clip for assets/feasibility/20261121a. */
"use strict";
var t = require("./_t.js");
globalThis.BuildHereGeom = require("../../../assets/feasibility/20261121a/build-here-geom.js");
var G = globalThis.BuildHereGeom;
var L = require("../../../assets/feasibility/20261121a/build-here-landscape.js");
var SP = require("../../../assets/feasibility/20261121a/build-here-siteplan.js");

var calls = [];
function res(body) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } }); }
var LAT = 47.65, LON = -122.39;
var fr = G.frame(LAT, LON);
function ll(x, y) { return fr.inv(x, y); }
function rect(x0, y0, x1, y1) { return [ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)]; }
globalThis.fetch = function (url, opt) {
  calls.push(String(url));
  var u = String(url);
  if (/getSamples/.test(u)) {
    var q = decodeURIComponent((opt.body.match(/geometry=([^&]*)/) || [])[1] || "{}");
    var pts = JSON.parse(q).points || [];
    return res({ samples: pts.map(function (p, i) {
      var xy = fr.fwd(p);
      // A plane that falls 8 ft over about 80 ft (10%), plus one steep spike so the cell average is not the fall.
      var z = 100 + xy[1] * 0.1;
      if (Math.abs(xy[0]) < 3 && Math.abs(xy[1]) < 3) z += 12;
      return { locationId: i, value: String(z / 3.28084), resolution: 1 };
    }) });
  }
  return res({ features: [], elements: [] });
};

(async function () {
  var lot = [rect(-40, -40, 40, 40)];
  var study = { rings: lot, lon: LON, lat: LAT, county: "King County", stateAbbr: "WA", juris: "other", lot: 6400 };
  var r = await L.analyze(study);
  t.ok("slope still measures", r.slope && r.slope.ok && typeof r.slope.overallPct === "number", r.slope && [r.slope.overallPct, r.slope.mean]);
  var html = L.renderHTML(r, study);
  t.ok("the fall line uses the across-the-lot percent, and the cell average is a separate row", html.indexOf(r.slope.overallPct + "% across the lot") >= 0 && /Local cell slope/.test(html));
  t.ok("the cell average is not labeled as the lot's average slope", !/Average slope across the lot/.test(html));

  // A wide lot with the street hard against the west side. The far edge has to stay in the plan frame.
  var W = 280, H = 50, X0 = -W / 2;
  var rings = [rect(X0, -H / 2, W / 2, H / 2)];
  var streets = [{ line: [[X0 - 8, -500], [X0 - 8, 500]], name: "Ruffner", kind: "street" }];
  var M = SP.model({
    rings: rings, lon: LON, lat: LAT, setbacks: { front: 7, rear: 7, side: 5, rearAlley: 0 }, residential: true,
    geo: { streets: streets, buildings: [], frame: { lat0: fr.lat0, lon0: fr.lon0 }, drives: [], driveLines: [], hard: [], sidewalks: [], trees: [] }
  });
  var svg = SP.svg(M, { F: { zone: "LR1 (M)", lot: { sf: 4000, kind: "record" }, slope: r.slope, address: "2317 W RUFFNER ST" } });
  var plan = svg.split('viewBox="0 0 1000 930"')[1] || "";
  var idx = plan.indexOf('stroke-dasharray="26 7 4 7"');
  var chunk = plan.slice(Math.max(0, idx - 5000), idx);
  var d = (chunk.match(/d="([^"]+)"/g) || []).pop() || "";
  var nums = d.match(/-?\d+\.?\d*/g).map(Number), xs = [];
  for (var i = 0; i < nums.length; i += 2) xs.push(nums[i]);
  t.ok("the lot line stays inside the plan frame", xs.length > 2 && Math.min.apply(null, xs) >= -1 && Math.max.apply(null, xs) <= 1001, xs);
  t.ok("the sheet names the fall across the lot, not a cell average beside it", /ft of fall/.test(svg) && !/avg 45/.test(svg) && !/· avg /.test(svg));
  t.done();
})();
