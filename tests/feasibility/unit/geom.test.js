/* Unit tests for assets/js/build-here-geom.js.   node tests/unit/geom.test.js */
"use strict";
var t = require("./_t.js");
var G = require("../../../assets/feasibility/build-here-geom.js");

/* ---- projection ---- */
var fr = G.frame(47.6, -122.1);
var one = fr.fwd([-122.1 + 0.001, 47.6 + 0.001]);
// WGS84 at 47.6 N: one thousandth of a degree is 246.6 ft east-west and 364.8 ft north-south.
t.ok("east-west scale uses the prime-vertical radius", t.near(one[0], 246.63, 0.15), one[0]);
t.ok("north-south scale uses the meridional radius", t.near(one[1], 364.79, 0.15), one[1]);
var back = fr.inv(one[0], one[1]);
t.ok("inverse returns the same point", t.near(back[0], -122.099, 1e-9) && t.near(back[1], 47.601, 1e-9));
var sphere = 0.001 * (Math.PI / 180) * 20925646 * Math.cos(47.6 * Math.PI / 180);
t.ok("the sphere the old code used was 0.18% short east-west", t.near((one[0] - sphere) / sphere, 0.00183, 0.0002), (one[0] - sphere) / sphere);

/* ---- rings ---- */
var sq = [[0, 0], [100, 0], [100, 60], [0, 60], [0, 0]];
t.ok("counter-clockwise area is positive", G.ringArea(sq) === 6000);
t.ok("clockwise area is negative", G.ringArea(sq.slice().reverse()) === -6000);
t.ok("area with a hole subtracts it", G.area([sq, [[10, 10], [10, 20], [20, 20], [20, 10], [10, 10]]]) === 5900);
t.ok("inside and outside", G.inRing(50, 30, sq) && !G.inRing(150, 30, sq));
t.ok("distance to an edge", t.near(G.distToRing(50, 10, sq), 10, 1e-9));
var L = [[0, 0], [40, 0], [40, 10], [10, 10], [10, 40], [0, 40], [0, 0]];
var lp = G.labelPoint(L);
t.ok("label point of an L shape is inside it", G.inRing(lp.x, lp.y, L) && lp.r > 3, lp);
var cen = G.centroid(sq);
t.ok("centroid of a rectangle", t.near(cen[0], 50, 1e-9) && t.near(cen[1], 30, 1e-9));

/* ---- simplify and merge ---- */
var wig = [[0, 0], [10, 0.2], [20, -0.1], [30, 0.1], [40, 0], [40, 30], [0, 30], [0, 0]];
var simp = G.simplify(wig, 0.5, true);
t.ok("simplify drops the wiggle and keeps the corners", simp.length === 5 && simp[0][0] === simp[4][0] && simp[0][1] === simp[4][1], simp);
function edgesOf(ring, kinds) {
  var out = [];
  for (var i = 0; i < ring.length - 1; i++) {
    var a = ring[i], b = ring[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy);
    out.push({ a: a, b: b, kind: kinds ? kinds[i] : "side", nx: dy / len, ny: -dx / len });
  }
  return out;
}
// A rectangle whose south side carries two extra vertices where neighbor lines meet it.
var lot = [[0, 0], [40, 0], [80, 0], [120, 0], [120, 80], [0, 80], [0, 0]];
var merged = G.mergeCollinear(edgesOf(lot), 3);
t.ok("three collinear edges become one side", merged.length === 4, merged.length);
var south = merged.filter(function (e) { return Math.abs(e.ny + 1) < 1e-9; })[0];
t.ok("the merged side keeps its full length and its outward normal", south && t.near(south.len, 120, 1e-9) && south.count === 3, south);
var mixed = G.mergeCollinear(edgesOf(lot, ["front", "front", "street", "side", "rear", "side"]), 3);
t.ok("edges of different kinds are not merged", mixed.length === 5, mixed.length);

/* ---- envelope mask and trace ---- */
var E = edgesOf([[0, 0], [120, 0], [120, 80], [0, 80], [0, 0]], ["front", "side", "rear", "side"]);
var sb = { front: 10, side: 5, rear: 5 };
var m = G.envelopeMask([[0, 0], [120, 0], [120, 80], [0, 80], [0, 0]], E, function (e) { return sb[e.kind]; });
t.ok("envelope area is the inset rectangle", t.near(m.area, 110 * 65, 110 * 65 * 0.02), m.area);
var rowsArea = m.rows.reduce(function (a, r) { return a + r[2] * r[3]; }, 0);
t.ok("the merged rows cover the same area as the mask", t.near(rowsArea, m.area, 1e-6));
var traced = G.traceMask(m);
t.ok("the mask traces to one ring", traced.length === 1, traced.length);
t.ok("the traced ring is a rectangle of the same area", traced[0].length === 5 && t.near(Math.abs(G.ringArea(traced[0])), m.area, m.area * 0.01), traced[0]);
var tb = G.bbox(traced);
t.ok("the traced ring sits 10 ft off the front and 5 ft off the others", t.near(tb[1], 10, 1) && t.near(tb[0], 5, 1) && t.near(tb[2], 115, 1) && t.near(tb[3], 75, 1), tb);
t.ok("mask lookup agrees with the outline", G.maskAt(m, 60, 40) && !G.maskAt(m, 60, 5) && !G.maskAt(m, 2, 40));
// Two cells that touch at a corner are two rings, not a figure eight.
var two = G.traceMask({ mask: [1, 0, 0, 1], nx: 2, ny: 2, x0: 0, y0: 0, cell: 1 }, 0);
t.ok("cells touching at a corner stay separate", two.length === 2 && two[0].length === 5 && two[1].length === 5, two);
// A ring-shaped mask gives an outer ring and a hole with opposite winding.
var donut = [1, 1, 1, 1, 0, 1, 1, 1, 1];
var dr = G.traceMask({ mask: donut, nx: 3, ny: 3, x0: 0, y0: 0, cell: 1 }, 0);
t.ok("a hole is traced with the opposite winding", dr.length === 2 && G.ringArea(dr[0]) * G.ringArea(dr[1]) < 0, dr.map(G.ringArea));

/* ---- contours ---- */
// A plane rising 1 ft per 10 ft to the east: the 5 ft contour is the line x = 50.
var g = { x0: 0, y0: 0, step: 10, nx: 11, ny: 6, vals: [] };
for (var j = 0; j < g.ny; j++) for (var i = 0; i < g.nx; i++) g.vals.push(i);
var cs = G.contours(g, [5, 20]);
t.ok("only levels that cross the grid are returned", cs.length === 1 && cs[0].level === 5);
t.ok("the contour is one chained line", cs[0].lines.length === 1 && cs[0].lines[0].length === g.ny, cs[0].lines.map(function (l) { return l.length; }));
t.ok("the contour sits at x = 50", cs[0].lines[0].every(function (p) { return t.near(p[0], 50, 1e-9); }));
// A missing corner leaves a gap and never a made-up value.
var gap = { x0: 0, y0: 0, step: 10, nx: 3, ny: 2, vals: [0, 10, null, 0, 10, 20] };
var gc = G.contours(gap, [15]);
t.ok("a cell with a missing sample draws nothing", gc.length === 0, gc);
// A saddle: opposite high corners. Both resolutions give two segments and never a crossing.
var sad = G.contours({ x0: 0, y0: 0, step: 10, nx: 2, ny: 2, vals: [10, 0, 0, 10] }, [5]);
t.ok("a saddle cell gives two separate segments", sad.length === 1 && sad[0].lines.length === 2, sad);
t.ok("bilinear reads the plane", t.near(G.bilinear(g, 25, 12), 2.5, 1e-9));
t.ok("bilinear returns null without a grid", G.bilinear(null, 0, 0) === null);
var sm = G.smoothGrid({ x0: 0, y0: 0, step: 1, nx: 3, ny: 1, vals: [0, null, 4] });
t.ok("smoothing keeps a missing sample missing", sm.vals[1] === null && sm.vals[0] === 0);
t.ok("grid range ignores missing samples", G.gridRange(gap)[0] === 0 && G.gridRange(gap)[1] === 20);

/* ---- hatch, rectangles ---- */
var h = G.hatch([[[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]], 4, 0);
t.ok("horizontal hatch lines span the square", h.length >= 4 && h.every(function (s) { return t.near(Math.abs(s[2] - s[0]), 20, 1e-6) && t.near(s[1], s[3], 1e-9); }), h.length);
var h45 = G.hatch([[[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]], 4, 45);
t.ok("45 degree hatch stays inside the square", h45.length > 4 && h45.every(function (s) { return s[0] > -1e-6 && s[0] < 20.000001 && s[2] > -1e-6 && s[2] < 20.000001; }));
var big = G.hatch([[[0, 0], [5000, 0], [5000, 5000], [0, 5000], [0, 0]]], 4, 45, [0, 0, 100, 100]);
t.ok("a view limit keeps a huge polygon cheap", big.length > 10 && big.length < 120, big.length);
var mr = G.minRect([[0, 0], [30, 0], [30, 20], [0, 20], [0, 0]]);
t.ok("minimum rectangle of a rectangle", t.near(mr.area, 600, 1e-6) && t.near(mr.cx, 15, 1e-6) && t.near(mr.cy, 10, 1e-6), mr);
var rr = G.rectRing(15, 10, 30, 20, 1, 0);
t.ok("rectRing builds the same rectangle back", t.near(Math.abs(G.ringArea(rr)), 600, 1e-6) && rr.length === 5);
t.ok("feet and inches", G.feetInches(16.42) === "16'-5\"" && G.feetInches(9.99) === "10'-0\"");
var pa = G.pointAlong([[0, 0], [10, 0], [10, 10]], 0.75);
t.ok("point along a polyline", t.near(pa.x, 10, 1e-9) && t.near(pa.y, 5, 1e-9) && pa.dy === 1);

t.done();
