/* Preliminary site plan sheets (SP-1 and the option sheets) for the "What can I build here?" study.
   One SVG per sheet: the title block, a plan drawn to scale from the public outlines the study already
   read, and the Site data / Setbacks / Lot coverage / Impervious / Gross floor area tables beside it.

   Rules this file keeps:
   - A value that is not in public data is never drawn and never printed as 0. Its table row reads
     "not in public data - verify" in orange, and a total that lacks a part prints as "≥ N sf".
   - Every estimate is labeled: "≈", "lidar approx.", "roof outline, not living area".
   - Ground elevations are lidar readings, written "EL 175' ±". They are never called the top or the
     bottom of a wall: that takes a survey.
   - Nothing is referenced by id (no pattern, clipPath or marker). The print copy and the saved file
     strip ids, so hatching is plain line segments and clipping is a nested <svg> viewport.
   - No owner name is read, kept or drawn.
   Runs in the browser (window.BuildHereSitePlan) and in Node (module.exports). Needs build-here-geom.js. */
(function (root) {
  "use strict";
  function GEO() { return root.BuildHereGeom; }
  function isNum(x) { return typeof x === "number" && isFinite(x); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US"); }
  function r1(n) { return String(Math.round(n * 10) / 10); }
  function ft1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function hyp(x, y) { return Math.sqrt(x * x + y * y); }

  /* Sheet: letter, landscape. The stylesheet prints the drawing 10.16 in wide (inside 0.35 in margins), so
     one inch on paper is UPI drawing units, and the plan can be held to a standard scale (1 in = 20 ft, and
     so on). Keep PRINT_W_IN in step with the .bh-sheet-svg print rule. */
  var SHEET_W = 1650, SHEET_H = 1250, PRINT_W_IN = 10.16, UPI = SHEET_W / PRINT_W_IN;
  var PLAN = { x: 40, y: 116, w: 1000, h: 930 };
  var COL = { x: 1066, y: 116, w: 544, h: 930 };
  var TB = { x: 40, y: 1066, w: 1570, h: 144 };
  var SCALES = [8, 10, 16, 20, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400, 500, 600, 800, 1000];
  var INK = "#2f3a3a", MUTE = "#5b6460", RULE = "#8b8878", GREEN = "#2f6b45", GREEN_FILL = "#dfe9df", TAN = "#b3a58a", EARTH = "#7a6a4f";
  var ORANGE = "#b8650a", PAPER = "#fbfaf6", GREY = "#ecece8", GREY_LINE = "#a9ada8", ROAD = "#e6e5df", HAZ = "#b3261e";
  var FONT = "Montserrat, 'Helvetica Neue', Helvetica, Arial, sans-serif";
  var MISSING = "not in public data — verify";

  /* ---------- A. lot lines: which is the front, a street side, a side, the rear, an alley ---------- */
  var NOT_NAME = /^(N|S|E|W|NE|NW|SE|SW|NORTH|SOUTH|EAST|WEST|NORTHEAST|NORTHWEST|SOUTHEAST|SOUTHWEST|AVE|AVENUE|ST|STREET|RD|ROAD|DR|DRIVE|LN|LANE|BLVD|BOULEVARD|CT|COURT|PL|PLACE|WAY|TER|TERRACE|CIR|CIRCLE|PKWY|PARKWAY|HWY|HIGHWAY|TRL|TRAIL)$/;
  /* "160TH AVE NE" and "160th Avenue Northeast" are the same street: both reduce to "160TH". */
  function streetCore(name) {
    return String(name || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(function (w) { return w && !NOT_NAME.test(w); }).join(" ");
  }
  /* The setback a lot line gets. A second street side uses the street-side setback when the zone codes
     one, else the front setback, which is the cautious reading. A line on an alley uses the alley figure
     when the zone codes one. */
  function setbackFor(e, sb) {
    sb = sb || {};
    if (e.kind === "front") return sb.front;
    if (e.kind === "street") return isNum(sb.streetSide) ? sb.streetSide : sb.front;
    if (e.kind === "rear") return e.alley && isNum(sb.rearAlley) ? sb.rearAlley : sb.rear;
    return e.alley && isNum(sb.sideAlley) ? sb.sideAlley : sb.side;
  }
  /* The mapped street that runs along a lot line, on its outer side, within 70 ft. */
  function nearestStreet(e, streets) {
    var best = null;
    streets.forEach(function (s) {
      var ln = s.line || [];
      for (var i = 0; i < ln.length - 1; i++) {
        var a = ln[i], b = ln[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        var t = L2 ? ((e.mx - a[0]) * dx + (e.my - a[1]) * dy) / L2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var ox = a[0] + t * dx - e.mx, oy = a[1] + t * dy - e.my, d = hyp(ox, oy);
        if (d > 70 || ox * e.nx + oy * e.ny < 1) continue;   // too far, or behind the line
        var par = Math.abs((dx * (e.b[0] - e.a[0]) + dy * (e.b[1] - e.a[1])) / ((Math.sqrt(L2) || 1) * (e.len || 1)));
        if (par < 0.5) continue;                              // the street ends on this line; it does not run along it
        if (!best || d < best.dist) best = { name: s.name || "", kind: s.kind || "street", dist: d };
      }
    });
    return best;
  }
  /* How wide the open ground outside a line is, in feet: the distance to the parcel across it, read at
     three points. Null when no parcel is across within maxFt. */
  function gapAcross(e, nb, maxFt) {
    var G = GEO(), hits = [];
    [0.25, 0.5, 0.75].forEach(function (t) {
      var px = e.a[0] + (e.b[0] - e.a[0]) * t, py = e.a[1] + (e.b[1] - e.a[1]) * t;
      for (var d = 8; d <= maxFt; d += 2) {
        var x = px + e.nx * d, y = py + e.ny * d, hit = false;
        for (var k = 0; k < nb.length && !hit; k++) hit = G.inRing(x, y, nb[k]);
        if (hit) { hits.push(d); break; }
      }
    });
    if (hits.length < 2) return null;
    return Math.max.apply(null, hits);
  }
  function finishEdges(edges, near, fn) {
    var fx = 0, fy = 0, fl = 0;
    edges.forEach(function (e) { if (e.kind === "front") { fx += e.mx * e.len; fy += e.my * e.len; fl += e.len; } });
    fx /= fl || 1; fy /= fl || 1;
    var rear = edges.filter(function (e) { return e.kind === "side" && e.nx * fn.nx + e.ny * fn.ny < -0.6; });
    if (!rear.length) { // no lot line faces away from the street, so use the one farthest from it
      var far = null;
      edges.forEach(function (e) { if (e.kind === "side" && e.nx * fn.nx + e.ny * fn.ny < 0 && (!far || hyp(e.mx - fx, e.my - fy) > hyp(far.mx - fx, far.my - fy))) far = e; });
      if (far) rear = [far];
    }
    rear.forEach(function (e) { e.kind = "rear"; });
    return { edges: edges, near: near, fx: fx, fy: fy, fnx: fn.nx, fny: fn.ny, frontage: fl };
  }
  /* ring: closed, in feet. st: the address point. dir: "N" "E" "S" "W" when the visitor named the street
     side. nb: the neighboring parcel rings. hint: { streets: [{ line, name, kind }], addrCore }.
     Each edge comes back with kind "front" | "street" | "side" | "rear", and alley: true on an alley. */
  function classifyEdges(ring, st, dir, nb, hint) {
    var G = GEO(), n = ring.length - 1, i, sgn = G.ringArea(ring) > 0 ? 1 : -1; // counter-clockwise rings have the outside on the right
    var edges = [];
    hint = hint || {};
    for (i = 0; i < n; i++) {
      var a = ring[i], b = ring[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = hyp(dx, dy) || 1;
      edges.push({ a: a, b: b, len: L, nx: sgn * dy / L, ny: -sgn * dx / L, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, d: G.segDist(st[0], st[1], a, b) });
    }
    var streets = hint.streets || [], openSrc = "";
    if (streets.length) edges.forEach(function (e) {
      var ns = nearestStreet(e, streets);
      if (ns) { e.streetName = ns.name; e.streetKind = ns.kind; e.streetDist = ns.dist; e.streetCore = streetCore(ns.name); }
    });
    // An edge is "open" when the ground just outside it is in no other parcel: a street, an alley, or sometimes water.
    if (nb && nb.length) {
      edges.forEach(function (e) {
        var px = e.mx + e.nx * 6, py = e.my + e.ny * 6, hit = false;
        for (var k = 0; k < nb.length && !hit; k++) hit = G.inRing(px, py, nb[k]);
        e.open = !hit;
      });
      openSrc = "parcels";
    } else if (streets.length) {
      // No neighboring parcels were read. A mapped street running along a line within 55 ft stands in.
      var any = 0;
      edges.forEach(function (e) { e.open = e.streetDist != null && e.streetDist <= 55; if (e.open) any++; });
      if (!any || any === edges.length) edges.forEach(function (e) { delete e.open; });
      else openSrc = "streets";
    }
    // An alley: a mapped alley runs along the line, or the open strip is 26 ft wide or less with a parcel
    // across it and no mapped street in it. An alley line is a side or a rear, never the front.
    edges.forEach(function (e) {
      if (!e.open) return;
      if (e.streetKind === "alley" && e.streetDist <= 30) { e.alley = true; return; }
      if ((e.streetKind === "street" && e.streetDist <= 45) || !nb || !nb.length || e.len < 6) return;
      var gap = gapAcross(e, nb, 34);
      if (gap != null) { e.gap = gap; if (gap <= 26) e.alley = true; }
    });
    edges.forEach(function (e, k) { // a short jog in an alley line reads as the line beside it
      if (!e.open || e.alley || e.len >= 6) return;
      var p = edges[(k + n - 1) % n], q = edges[(k + 1) % n];
      if ((p.alley && p.len >= 6) || (q.alley && q.len >= 6)) e.alley = true;
    });
    var isSt = function (e) { return !!e.open && !e.alley; };
    var openStreet = edges.filter(isSt);
    var D = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] }[dir];
    var res, byName = false;
    if (!D && openStreet.length && openStreet.length < edges.length) {
      // The front is the street the address is on, when the map names it. Else the open line nearest the address point.
      var pool = openStreet;
      if (hint.addrCore) {
        var named = openStreet.filter(function (e) { return e.streetCore && e.streetCore === hint.addrCore; });
        if (named.length) { pool = named; byName = true; }
      }
      var nearOpen = pool.reduce(function (m, e) { return e.d < m.d ? e : m; }, pool[0]);
      edges.forEach(function (e) { e.kind = "side"; });
      // Walk both ways from that line while the lines stay on a street (curved frontage is many short lines).
      var idx = edges.indexOf(nearOpen), k;
      nearOpen.kind = "front";
      for (k = 1; k < n && isSt(edges[(idx + k) % n]); k++) edges[(idx + k) % n].kind = "front";
      for (k = 1; k < n && isSt(edges[(idx - k + n) % n]); k++) edges[(idx - k + n) % n].kind = "front";
      // A corner lot has street on two sides. Frontage on a different named street, or frontage that turns
      // more than 60 degrees where the map gives no names, is a street side and not a second front.
      var corner = false;
      edges.forEach(function (e) {
        if (e.kind !== "front" || e === nearOpen) return;
        var bothNamed = !!(e.streetCore && nearOpen.streetCore);
        var turned = e.nx * nearOpen.nx + e.ny * nearOpen.ny < 0.5;
        if (bothNamed ? e.streetCore !== nearOpen.streetCore : turned) { e.kind = "street"; corner = true; }
      });
      var sx = 0, sy = 0;
      edges.forEach(function (e) { if (e.kind === "front") { sx += e.nx * e.len; sy += e.ny * e.len; } });
      var L2 = hyp(sx, sy) || 1, fn = { nx: sx / L2, ny: sy / L2 };
      // A street line that is not joined to the front and runs to its side is a street side as well.
      edges.forEach(function (e) { if (e.kind === "side" && isSt(e) && e.nx * fn.nx + e.ny * fn.ny >= -0.6) { e.kind = "street"; corner = true; } });
      res = finishEdges(edges, nearOpen, fn);
      res.corner = corner;
    } else {
      var near = D ? edges.reduce(function (m, e) { var sc = (e.nx * D[0] + e.ny * D[1]) * Math.sqrt(e.len), sm = (m.nx * D[0] + m.ny * D[1]) * Math.sqrt(m.len); return sc > sm ? e : m; }, edges[0])
        : edges.reduce(function (m, e) { return e.d < m.d ? e : m; }, edges[0]);
      if (D) edges.forEach(function (e) { e.d = e === near ? 0 : (e.nx * near.nx + e.ny * near.ny > 0.7 ? 0 : 999); });
      edges.forEach(function (e) { e.kind = "side"; if (e.nx * near.nx + e.ny * near.ny > 0.7 && e.d < near.d + 25) e.kind = "front"; });
      res = finishEdges(edges, near, near);
      res.corner = false;
      if (D) edges.forEach(function (e) { if (e.kind === "side" && isSt(e)) { e.kind = "street"; res.corner = true; } });
    }
    res.byName = byName;
    res.openSrc = openSrc;
    res.alley = edges.some(function (e) { return !!e.alley; });
    res.through = edges.some(function (e) { return e.kind === "rear" && isSt(e); }); // a street behind the lot as well
    var names = {};
    edges.forEach(function (e) { if (e.kind === "front" && e.streetName) names[e.streetName] = (names[e.streetName] || 0) + e.len; });
    res.frontStreet = Object.keys(names).sort(function (p, q) { return names[q] - names[p]; })[0] || "";
    return res;
  }
  /* One reading of the lot lines and one envelope per set of inputs. The site plan, the option cards and
     the massing seed all take it from here, so they cannot disagree.
     o: { rings (lon/lat), lon, lat, frontDir, neighbors (lon/lat rings), setbacks, streets (feet, same
     frame), addrStreet, frame: { lat0, lon0 } } */
  function lotLines(o) {
    var G = GEO();
    if (!G || !o || !o.rings || !o.rings.length) return null;
    var fr = o.frame && isNum(o.frame.lat0) ? G.frame(o.frame.lat0, o.frame.lon0) : G.frameOf(o.rings);
    var all = G.project(o.rings, fr), mi = 0, ma = -1;
    // The largest ring. A parcel record can carry several (separate parts, or a hole).
    all.forEach(function (r, i) { var a = Math.abs(G.ringArea(r)); if (a > ma) { ma = a; mi = i; } });
    var ring = G.closeRing(all[mi]);
    if (ring.length < 4) return null;
    var st = o.lon != null && o.lat != null ? fr.fwd([o.lon, o.lat]) : G.centroid(ring);
    var c0 = G.centroid(ring);
    // The neighbor query also returns this lot. Its own outline must not be read as the parcel "across" a line.
    var nb = o.neighbors && o.neighbors.length ? G.project(o.neighbors, fr).filter(function (r) {
      if (r.length < 4) return false;
      var a = Math.abs(G.ringArea(r));
      return !(Math.abs(a - ma) <= ma * 0.03 && G.inRing(c0[0], c0[1], r));
    }) : null;
    var ce = classifyEdges(ring, st, o.frontDir, nb, { streets: o.streets || [], addrCore: streetCore(o.addrStreet) });
    var sb = o.setbacks || {}, known = [sb.front, sb.rear, sb.side].every(isNum), env = null;
    if (known) {
      var m = G.envelopeMask(ring, ce.edges, function (e) { return setbackFor(e, sb); });
      var sx = 0, sy = 0, cnt = 0;
      for (var j = 0; j < m.ny; j++) for (var i = 0; i < m.nx; i++) if (m.mask[j * m.nx + i]) { sx += m.x0 + (i + 0.5) * m.cell; sy += m.y0 + (j + 0.5) * m.cell; cnt++; }
      env = { mask: m, rows: m.rows, area: m.area, rings: m.count ? G.traceMask(m, m.cell * 0.8) : [], cx: cnt ? sx / cnt : c0[0], cy: cnt ? sy / cnt : c0[1] };
    }
    return { fr: fr, frame: { lat0: fr.lat0, lon0: fr.lon0 }, ring: ring, rings: all, parcels: nb || [], ce: ce, edges: ce.edges, lines: G.mergeCollinear(ce.edges, 6), env: env, er: env, known: known, parts: all.length, corner: !!ce.corner, st: st };
  }

  /* ---------- B. the model: everything the drawing needs, in feet ---------- */
  function contourSet(dem) {
    var G = GEO();
    if (!dem || !dem.vals || dem.nx < 3 || dem.ny < 3) return null;
    var have = 0;
    for (var q = 0; q < dem.vals.length; q++) if (dem.vals[q] != null) have++;
    if (have < dem.vals.length * 0.6) return null;
    var g = G.smoothGrid(dem), rg = G.gridRange(g);
    if (!rg) return null;
    // The interval is no finer than the lidar behind it, and wide enough that the lines can be read.
    var relief = rg[1] - rg[0], res = isNum(dem.res) ? dem.res : null;
    var minInt = res == null ? 2 : res <= 1.6 ? 1 : res <= 3.5 ? 2 : 5;
    var cands = [1, 2, 5, 10, 20, 50], interval = cands[cands.length - 1];
    for (var i = 0; i < cands.length; i++) if (cands[i] >= minInt && relief / cands[i] <= 24) { interval = cands[i]; break; }
    var every = interval === 1 ? 5 : interval === 2 ? 10 : interval === 5 ? 25 : interval * 5, levels = [];
    for (var L = Math.ceil(rg[0] / interval) * interval; L <= rg[1]; L += interval) levels.push(L);
    var sets = G.contours(g, levels).map(function (c) {
      return { level: c.level, index: Math.round(c.level) % every === 0, lines: c.lines.map(function (ln) { return G.chaikin(G.chaikin(ln)); }) };
    });
    return { interval: interval, every: every, min: rg[0], max: rg[1], relief: relief, res: res, sets: sets, grid: g };
  }
  /* How far the mapped house outline sits from each kind of lot line. From outlines, so an estimate. */
  function houseDistances(house, edges) {
    var G = GEO(), out = {}, pts = [], r = house.ring;
    for (var i = 0; i < r.length - 1; i++) {
      var n = Math.max(1, Math.ceil(hyp(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]) / 2));
      for (var k = 0; k < n; k++) pts.push([r[i][0] + (r[i + 1][0] - r[i][0]) * k / n, r[i][1] + (r[i + 1][1] - r[i][1]) * k / n]);
    }
    edges.forEach(function (e) {
      var key = e.kind + (e.alley ? "Alley" : ""), best = Infinity;
      for (var p = 0; p < pts.length; p++) { var d = G.segDist(pts[p][0], pts[p][1], e.a, e.b); if (d < best) best = d; }
      if (out[key] == null || best < out[key]) out[key] = best;
      if (e.alley && (out[e.kind] == null || best < out[e.kind])) out[e.kind] = best;
    });
    return out;
  }
  /* o: { rings, lon, lat, frontDir, neighbors, setbacks, setbackVerify, addrStreet, geo (from the coverage
     module), slope, hazardShapes: [{ label, rings }], imagery, lines (a lotLines() result to reuse) } */
  function model(o) {
    var G = GEO(), M = { ok: false, why: "", notes: [] };
    if (!G) { M.why = "The drawing script did not load, so the site plan is not drawn."; return M; }
    if (!o || !o.rings || !o.rings.length) { M.why = "No parcel outline was found in public data, so the site plan is not drawn."; return M; }
    var geo = o.geo || null;
    var L = o.lines || lotLines({ rings: o.rings, lon: o.lon, lat: o.lat, frontDir: o.frontDir, neighbors: o.neighbors, setbacks: o.setbacks, streets: geo ? geo.streets : null, addrStreet: o.addrStreet, frame: geo ? geo.frame : null });
    if (!L) { M.why = "The parcel outline could not be drawn."; return M; }
    M.ok = true; M.fr = L.fr; M.lot = L.rings; M.ring = L.ring; M.edges = L.edges; M.lines = L.lines; M.ce = L.ce; M.env = L.env;
    M.sb = o.setbacks || {}; M.sbKnown = L.known; M.sbVerify = !!o.setbackVerify; M.parts = L.parts; M.corner = L.corner;
    M.bbox = G.bbox(L.rings); M.area = G.area(L.rings); M.parcels = L.parcels || [];
    M.buildings = []; M.nearBuildings = []; M.house = null;
    (geo && geo.buildings || []).forEach(function (b) {
      if (b.role === "neighbor") M.nearBuildings.push(b);
      else { M.buildings.push(b); if (b.role === "house") M.house = b; }
    });
    M.hasGeo = !!geo;
    M.drives = geo ? geo.drives || [] : []; M.driveLines = geo ? geo.driveLines || [] : []; M.hard = geo ? geo.hard || [] : [];
    M.streets = geo ? geo.streets || [] : []; M.sidewalks = geo ? geo.sidewalks || [] : []; M.trees = geo ? geo.trees || [] : [];
    M.src = geo && geo.src ? geo.src : {};
    M.addrStreet = o.addrStreet || "";
    M.contours = contourSet(geo && geo.dem);
    // Spot elevations at the lot corners, from the finer samples inside the lot when they are there.
    M.spots = [];
    var eg = geo && (geo.demFine || geo.dem);
    if (eg && eg.vals) {
      var corners = G.simplify(L.ring, 4, true).slice(0, -1);
      while (corners.length > 8) corners = corners.filter(function (c, i) { return i % 2 === 0; });
      corners.forEach(function (c) { var v = G.bilinear(eg, c[0], c[1]); if (isNum(v)) M.spots.push({ x: c[0], y: c[1], el: v }); });
    }
    M.hazards = (o.hazardShapes || []).filter(function (h) { return h && h.rings && h.rings.length; }).map(function (h) { return { label: h.label || "", rings: G.project(h.rings, L.fr) }; });
    M.imagery = o.imagery || null;
    M.slope = o.slope && o.slope.ok ? o.slope : null;
    M.houseDist = M.house ? houseDistances(M.house, L.edges) : null;
    return M;
  }

  /* ---------- C. placing an option on the lot ---------- */
  function rectFits(mask, cx, cy, w, d, ux, uy, avoid, sep) {
    var G = GEO(), vx = -uy, vy = ux, nu = Math.max(2, Math.ceil(w / 3)), nv = Math.max(2, Math.ceil(d / 3));
    for (var j = 0; j <= nv; j++) for (var i = 0; i <= nu; i++) {
      var a = -w / 2 + w * i / nu, b = -d / 2 + d * j / nv, x = cx + a * ux + b * vx, y = cy + a * uy + b * vy;
      if (!G.maskAt(mask, x, y)) return false;
      for (var k = 0; k < avoid.length; k++) {
        if (G.inRings(x, y, avoid[k].rings)) return false;
        var gap = avoid[k].hazard ? 0 : sep; // a mapped hazard is kept off; a building is kept off with room between
        if (gap > 0 && (i === 0 || j === 0 || i === nu || j === nv) && G.distToRings(x, y, avoid[k].rings) < gap) return false;
      }
    }
    return true;
  }
  function placed(kind, c, opt, extra) {
    var G = GEO(), sf = Math.round(c.w * c.d), o = { ok: true, kind: kind, ring: G.rectRing(c.cx, c.cy, c.w, c.d, c.ux, c.uy), w: c.w, d: c.d, cx: c.cx, cy: c.cy, ux: c.ux, uy: c.uy, sf: sf, wantSf: opt.footprintSf, partial: sf < opt.footprintSf * 0.97, note: "" };
    o.rings = [o.ring];
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }
  /* Mapped hazard areas, as ground a concept is kept off when there is anywhere else for it to go. */
  function hazardGround(M) { return (M.hazards || []).map(function (h) { return { rings: h.rings, hazard: true }; }); }
  var ON_HAZARD = " It sits on a mapped critical area, the only place it fits as drawn. A critical-area review can move it or rule it out.";
  function placeAddition(M, opt) {
    var G = GEO(), h = M.house, env = M.env;
    if (!h) return { ok: false, why: "The house outline is not in public data, so the addition is not drawn." };
    if (!env) return { ok: false, why: "Setbacks are not all coded for this zone, so the addition is not placed." };
    var mr = G.minRect(G.closeRing(h.ring));
    if (!mr) return { ok: false, why: "The house outline is too small to draw an addition against." };
    var ux = mr.ux, uy = mr.uy, vx = -uy, vy = ux, fnx = M.ce.fnx, fny = M.ce.fny;
    var sides = [
      { ox: vx, oy: vy, len: mr.w, mx: mr.cx + vx * mr.d / 2, my: mr.cy + vy * mr.d / 2, ax: ux, ay: uy },
      { ox: -vx, oy: -vy, len: mr.w, mx: mr.cx - vx * mr.d / 2, my: mr.cy - vy * mr.d / 2, ax: ux, ay: uy },
      { ox: ux, oy: uy, len: mr.d, mx: mr.cx + ux * mr.w / 2, my: mr.cy + uy * mr.w / 2, ax: vx, ay: vy },
      { ox: -ux, oy: -uy, len: mr.d, mx: mr.cx - ux * mr.w / 2, my: mr.cy - uy * mr.w / 2, ax: vx, ay: vy }
    ];
    // The rear of the house first, then its sides, the street side last.
    sides.forEach(function (s) { s.score = -(s.ox * fnx + s.oy * fny); });
    sides.sort(function (a, b) { return b.score - a.score; });
    var others = M.buildings.filter(function (b) { return b !== h; }), hz = hazardGround(M), fracs = [1, 0.8, 0.6, 0.4];
    // First with mapped hazard ground kept clear, then, if nothing fits, without that.
    for (var pass = 0; pass < (hz.length ? 2 : 1); pass++) for (var f = 0; f < fracs.length; f++) {
      var avoid = pass === 0 ? others.concat(hz) : others, onHz = pass === 1;
      var A = opt.footprintSf * fracs[f];
      for (var si = 0; si < sides.length; si++) {
        var s = sides[si], w0 = Math.min(s.len, Math.max(12, Math.sqrt(A * 1.5))), widths = [w0, s.len, Math.max(10, w0 * 0.75)];
        for (var wi = 0; wi < widths.length; wi++) {
          var w = widths[wi], d = A / w;
          if (d < 8 || w < 8) continue;                       // a sliver is not an addition
          var slides = [0, (s.len - w) / 2, -(s.len - w) / 2];
          for (var k = 0; k < slides.length; k++) {
            var cx = s.mx + s.ax * slides[k] + s.ox * (d / 2 + 0.75), cy = s.my + s.ay * slides[k] + s.oy * (d / 2 + 0.75);
            if (rectFits(env.mask, cx, cy, w, d, s.ax, s.ay, avoid, 0)) {
              return placed("addition", { cx: cx, cy: cy, w: w, d: d, ux: s.ax, uy: s.ay }, opt, {
                where: s.score > 0.5 ? "behind the house" : s.score < -0.5 ? "on the street side of the house" : "beside the house",
                note: (fracs[f] < 1 ? "About " + fmt(w * d) + " sf of the " + fmt(opt.footprintSf) + " sf footprint fits against the mapped house inside the setbacks. The rest would go up, or elsewhere on the lot." : "") + (onHz ? ON_HAZARD : ""), onHazard: onHz
              });
            }
          }
        }
      }
    }
    return { ok: false, why: "No side of the mapped house outline has room inside the setbacks for an addition footprint of this size." };
  }
  /* A detached building (a backyard cottage or a shop): as far from the street as it fits, toward a rear corner. */
  function placeDetached(M, opt, kind) {
    var G = GEO(), env = M.env;
    if (!env) return { ok: false, why: "Setbacks are not all coded for this zone, so the building is not placed." };
    if (!env.area) return { ok: false, why: "No area is left inside the setbacks as drawn." };
    var fnx = M.ce.fnx, fny = M.ce.fny, rear = null;
    M.lines.forEach(function (ln) { if (ln.kind === "rear" && (!rear || ln.len > rear.len)) rear = ln; });
    var ux = -fny, uy = fnx;
    if (rear && rear.len > 1) { ux = (rear.b[0] - rear.a[0]) / rear.len; uy = (rear.b[1] - rear.a[1]) / rear.len; }
    // The distance kept from other buildings: the zone's own figure when it is coded. Otherwise 6 ft,
    // which is a drawing allowance and is labeled as one, not a code distance.
    var sepCoded = isNum(M.sb.buildingSep), sep = sepCoded ? M.sb.buildingSep : 6;
    var m = env.mask, step = Math.max(1.5, Math.min(4, Math.sqrt(env.area) / 30)), fracs = [1, 0.8, 0.64], aspects = [1.5, 1.2, 1, 2], hz = hazardGround(M);
    for (var pass = 0; pass < (hz.length ? 2 : 1); pass++) for (var f = 0; f < fracs.length; f++) {
      var A = opt.footprintSf * fracs[f], best = null, avoid = pass === 0 ? M.buildings.concat(hz) : M.buildings;
      for (var ai = 0; ai < aspects.length && !best; ai++) {
        var w = Math.sqrt(A * aspects[ai]), d = A / w;
        for (var y = m.y0 + step / 2; y < m.y0 + m.ny * m.cell; y += step) for (var x = m.x0 + step / 2; x < m.x0 + m.nx * m.cell; x += step) {
          if (!G.maskAt(m, x, y)) continue;
          var sc = -(x * fnx + y * fny) + 0.15 * Math.abs((x - env.cx) * ux + (y - env.cy) * uy);
          if (best && sc <= best.sc) continue;
          if (rectFits(m, x, y, w, d, ux, uy, avoid, sep)) best = { cx: x, cy: y, w: w, d: d, ux: ux, uy: uy, sc: sc };
        }
      }
      if (best) return placed(kind, best, opt, {
        sep: sep, sepCoded: sepCoded,
        note: (fracs[f] < 1 ? "About " + fmt(best.w * best.d) + " sf of the " + fmt(opt.footprintSf) + " sf footprint fits in the yard inside the setbacks. " : "") +
          (sepCoded ? "Kept " + sep + " ft from the mapped buildings, the zone's building separation." : "Kept 6 ft from the mapped buildings for the sketch. That is a drawing allowance, not a code distance.") + (pass === 1 ? ON_HAZARD : ""),
        onHazard: pass === 1
      });
    }
    return { ok: false, why: "A footprint of this size does not fit in the yard inside the setbacks, clear of the mapped buildings." };
  }
  /* A new house after a teardown: in the envelope, as near the front setback as it fits. */
  function placeHouse(M, opt) {
    var G = GEO(), env = M.env;
    if (!env) return { ok: false, why: "Setbacks are not all coded for this zone, so the new house is not placed." };
    if (!env.area) return { ok: false, why: "No area is left inside the setbacks as drawn." };
    var fnx = M.ce.fnx, fny = M.ce.fny, ux = -fny, uy = fnx, front = null;
    M.lines.forEach(function (ln) { if (ln.kind === "front" && (!front || ln.len > front.len)) front = ln; });
    if (front && front.len > 1) { ux = (front.b[0] - front.a[0]) / front.len; uy = (front.b[1] - front.a[1]) / front.len; }
    var m = env.mask, step = Math.max(1.5, Math.min(4, Math.sqrt(env.area) / 30)), fracs = [1, 0.85, 0.7, 0.55], aspects = [1.4, 1.1, 0.9, 1.8, 0.7], hz = hazardGround(M);
    for (var pass = 0; pass < (hz.length ? 2 : 1); pass++) for (var f = 0; f < fracs.length; f++) {
      var A = Math.min(opt.footprintSf, env.area * 0.95) * fracs[f], best = null, avoid = pass === 0 ? hz : [];
      for (var ai = 0; ai < aspects.length && !best; ai++) {
        var w = Math.sqrt(A * aspects[ai]), d = A / w;
        for (var y = m.y0 + step / 2; y < m.y0 + m.ny * m.cell; y += step) for (var x = m.x0 + step / 2; x < m.x0 + m.nx * m.cell; x += step) {
          if (!G.maskAt(m, x, y)) continue;
          var sc = (x * fnx + y * fny) - 0.2 * Math.abs((x - env.cx) * ux + (y - env.cy) * uy);
          if (best && sc <= best.sc) continue;
          if (rectFits(m, x, y, w, d, ux, uy, avoid, 0)) best = { cx: x, cy: y, w: w, d: d, ux: ux, uy: uy, sc: sc };
        }
      }
      if (best) {
        var got = best.w * best.d;
        return placed("teardown", best, opt, { note: (got < opt.footprintSf * 0.97 ? "A rectangle of about " + fmt(got) + " sf fits inside the setbacks" + (pass === 0 && hz.length ? " and clear of the mapped critical area" : "") + ". The " + fmt(opt.footprintSf) + " sf footprint would take a shape that follows the lot." : "") + (pass === 1 ? ON_HAZARD : ""), onHazard: pass === 1 });
      }
    }
    return { ok: false, why: "A house footprint of this size does not fit inside the setbacks as drawn." };
  }
  /* opt: one entry of BuildHereMeasures.options(). Returns { ok, ring, rings, sf, note } or { ok: false, why }.
     An option that is not feasible is never drawn. */
  function place(M, opt) {
    if (!M || !M.ok) return { ok: false, why: (M && M.why) || "No parcel outline." };
    if (!opt) return null;
    if (opt.feasible === false) return { ok: false, why: opt.why || "This option does not fit the limits on this lot as read." };
    if (opt.kind === "remodel") return M.house ? { ok: true, kind: "remodel", ring: M.house.ring, rings: M.house.rings || [M.house.ring], sf: null, existing: true, note: "" } : { ok: false, why: "The house outline is not in public data, so it is not highlighted." };
    if (opt.kind === "secondStory") return M.house ? { ok: true, kind: "secondStory", ring: M.house.ring, rings: M.house.rings || [M.house.ring], sf: M.house.sfOnLot != null ? M.house.sfOnLot : M.house.sf, over: true, note: "Drawn over the mapped roof outline, which includes the eaves. The floor it sits on is smaller." } : { ok: false, why: "The house outline is not in public data, so the second story is not drawn." };
    if (!isNum(opt.footprintSf) || opt.footprintSf <= 0) return { ok: false, why: opt.why || "No footprint size could be set for this option." };
    if (opt.kind === "addition") return placeAddition(M, opt);
    if (opt.kind === "adu") return placeDetached(M, opt, "adu");
    if (opt.kind === "shop") return placeDetached(M, opt, "shop");
    if (opt.kind === "teardown") return placeHouse(M, opt);
    return { ok: false, why: "This option is not drawn." };
  }
  var OPT_NAME = { addition: "ADDITION", secondStory: "SECOND STORY", adu: "DETACHED ADU", shop: "GARAGE / SHOP", teardown: "NEW HOUSE", remodel: "INTERIOR REMODEL" };
  var OPT_ROW = { addition: "addition", secondStory: "second story", adu: "detached ADU", shop: "garage / shop", teardown: "new house", remodel: "interior remodel" };
  function optLabel(opt, P) {
    if (!opt) return { head: "", sub: "" };
    var name = OPT_NAME[opt.kind] || String(opt.title || "").toUpperCase();
    if (opt.kind === "remodel") return { head: "(E) HOUSE", sub: "interior remodel, no new footprint" };
    if (opt.kind === "secondStory") return { head: "(N) SECOND STORY", sub: "over the (E) house" + (isNum(opt.gfaSf) ? " · ≈ " + fmt(opt.gfaSf) + " sf" : "") };
    var sf = P && P.ok && isNum(P.sf) ? P.sf : opt.footprintSf;
    return { head: "(N) " + name, sub: "≈ " + fmt(sf) + " sf" + (opt.levels > 1 ? " × " + opt.levels + " levels" : "") };
  }

  /* ---------- D. the tables beside the plan ---------- */
  /* Row: { k, v, s } with s one of fact | est | partial | missing | verify, and b: true for a total. */
  function row(k, v, s, b) { return { k: k, v: v, s: s || "fact", b: !!b }; }
  function miss(k, text) { return row(k, text || MISSING, "missing"); }
  function pctOf(a, lot) { return isNum(a) && isNum(lot) && lot > 0 ? Math.round(a / lot * 100) + "%" : ""; }
  function vs(total, cap, partial) {
    if (!isNum(cap)) return { t: "", s: "verify" };
    if (total <= cap) return { t: partial ? " · under cap so far" : " ✓ under cap", s: partial ? "partial" : "fact" };
    return { t: " ✗ over cap by " + fmt(total - cap) + " sf", s: "missing" };
  }
  function ftText(v, verify) { return isNum(v) ? v + " ft" + (verify ? " (verify)" : "") : null; }
  /* F: the facts object from BuildHereSummary.facts(). opt: the option on this sheet, or null. P: place(M, opt). */
  function tables(M, opt, P, F) {
    F = F || {};
    var out = [], eff = F.eff || {}, caps = F.caps || {}, lot = F.lot && isNum(F.lot.sf) ? F.lot.sf : null, place = F.place || "the jurisdiction";
    var t, r;
    /* Site data */
    r = [];
    r.push(F.parcel ? row("Parcel / plat", F.parcel + (F.plat && F.plat.name ? " · " + F.plat.name + (F.plat.lot ? ", lot " + F.plat.lot : "") : "")) : miss("Parcel / plat"));
    r.push(F.jurisLabel ? row("Jurisdiction", F.jurisLabel) : miss("Jurisdiction"));
    if (lot != null) {
      var ac = " (" + (Math.round(lot / 43560 * 100) / 100).toFixed(2) + " ac)";
      if (F.lot.kind === "record") r.push(row("Lot area (assessor)", fmt(lot) + " sf" + ac + (isNum(F.lot.gisSf) ? " · GIS ≈ " + fmt(F.lot.gisSf) + " sf" : "")));
      else if (F.lot.kind === "typed") r.push(row("Lot area (your entry)", fmt(lot) + " sf" + ac));
      else r.push(row("Lot area (GIS outline)", "≈ " + fmt(lot) + " sf" + ac + ", not a survey", "est"));
    } else r.push(miss("Lot area"));
    r.push(F.zone ? row("Zone", F.zone + (F.zoneName && String(F.zoneName).toUpperCase() !== String(F.zone).toUpperCase() ? " · " + F.zoneName : "") + (F.overlay ? " · overlay " + F.overlay : ""), F.zoneTyped ? "est" : "fact") : miss("Zone", "not found — enter it from the zoning map"));
    if (F.living && isNum(F.living.sf)) {
      var bits = [];
      if (isNum(F.firstFloor)) bits.push("1st fl " + fmt(F.firstFloor));
      if (isNum(F.basementFinished) && F.basementFinished > 0) bits.push("bsmt fin. " + fmt(F.basementFinished));
      else if (isNum(F.basementTotal) && F.basementTotal > 0) bits.push("bsmt " + fmt(F.basementTotal));
      r.push(row(F.living.label || "Existing finished living", (F.living.est ? "≈ " : "") + fmt(F.living.sf) + " sf" + (bits.length ? " (" + bits.join(" + ") + ")" : ""), F.living.est ? "est" : "fact"));
    } else r.push(miss("Existing finished living"));
    var gar = [];
    if (isNum(F.garageAtt) && F.garageAtt > 0) gar.push(fmt(F.garageAtt) + " sf attached");
    if (isNum(F.garageBsmt) && F.garageBsmt > 0) gar.push(fmt(F.garageBsmt) + " sf in basement");
    if (isNum(F.garageDet) && F.garageDet > 0) gar.push(fmt(F.garageDet) + " sf detached");
    r.push(gar.length ? row("Garage (assessor)", gar.join(" · ")) : F.garageNone ? row("Garage (assessor)", "none on the record") : miss("Garage"));
    var ys = [F.yearBuilt ? "built " + F.yearBuilt : "", F.stories ? F.stories + (F.stories === "1" ? " story" : " stories") + (isNum(F.basementTotal) && F.basementTotal > 0 ? " + basement" : "") : ""].filter(Boolean);
    r.push(ys.length ? row("Year built / stories", ys.join(" · ")) : miss("Year built / stories"));
    var sl = F.slope;
    if (sl && sl.ok) r.push(row("Lot fall (lidar approx.)", "≈ " + Math.max(0, Math.round(sl.elevMax - sl.elevMin)) + " ft" + (sl.fallCompass && sl.fallCompass !== "flat" ? ", falls toward the " + sl.fallCompass : "") + " · avg " + sl.mean + "%", "est"));
    else r.push(miss("Lot fall", "not measured (elevation service did not answer)"));
    out.push({ id: "site", title: "SITE DATA", rows: r });

    /* Setbacks */
    var sb = F.sb || {}, sv = !!F.sbVerify, hd = M && M.houseDist, coded = F.coded !== false;
    var ex = function (key) { return hd && isNum(hd[key]) ? " · (E) house ≈ " + Math.round(hd[key]) + " ft" : ""; };
    var sbRow = function (label, val, key) {
      var tx = ftText(val, sv);
      return tx ? row(label, tx + ex(key), sv ? "verify" : "fact") : row(label, coded ? "not coded — verify with " + place : "zone not coded — verify with " + place, "verify");
    };
    r = [sbRow("Front (street)", sb.front, "front")];
    if ((M && M.corner) || ((!M || !M.ok) && isNum(sb.streetSide))) r.push(isNum(sb.streetSide) ? sbRow("Street side (corner lot)", sb.streetSide, "street") : row("Street side (corner lot)", isNum(sb.front) ? "front setback used: " + sb.front + " ft (verify)" + ex("street") : "not coded — verify with " + place, "verify"));
    r.push(sbRow("Side (interior)" + (isNum(sb.sideCombined) ? ", " + sb.sideCombined + " ft both sides" : ""), sb.side, "side"));
    r.push(sbRow("Rear", sb.rear, "rear"));
    if (M && M.ce && M.ce.alley && (isNum(sb.rearAlley) || isNum(sb.sideAlley))) r.push(row("On the alley", (isNum(sb.rearAlley) ? "rear " + sb.rearAlley + " ft" : "") + (isNum(sb.rearAlley) && isNum(sb.sideAlley) ? " · " : "") + (isNum(sb.sideAlley) ? "side " + sb.sideAlley + " ft" : "") + (sv ? " (verify)" : ""), sv ? "verify" : "fact"));
    var H = F.height || {};
    r.push(isNum(H.ft) ? row("Max height", H.ft + " ft" + (H.verify ? " (verify)" : ""), H.verify ? "verify" : "fact") : row("Max height", H.text ? H.text : "not coded — verify with " + place, H.text ? "fact" : "verify"));
    if (isNum(sb.buildingSep)) r.push(row("Between buildings", sb.buildingSep + " ft" + (sv ? " (verify)" : ""), sv ? "verify" : "fact"));
    out.push({ id: "setbacks", title: "SETBACKS" + (F.zone ? " (" + F.zone + (sv ? " — VERIFY" : "") + ")" : ""), rows: r });

    /* Lot coverage */
    var bld = isNum(eff.buildings) ? eff.buildings : null, acc = (isNum(eff.detached) ? eff.detached : 0) + (isNum(eff.other) ? eff.other : 0);
    var hasAcc = isNum(eff.detached) || isNum(eff.other), fp = opt && isNum(opt.footprintSf) && opt.kind !== "remodel" && opt.kind !== "secondStory" ? (P && P.ok && isNum(P.sf) && P.partial ? P.sf : opt.footprintSf) : null;
    r = [];
    if (isNum(eff.survey)) r.push(row("(E) house footprint (your entry)", fmt(eff.survey) + " sf"));
    else if (isNum(eff.roof)) r.push(row("(E) house roof outline" + (F.srcShort && F.srcShort.buildings ? " (" + F.srcShort.buildings + ")" : ""), "≈ " + fmt(eff.roof) + " sf", "est"));
    else r.push(miss("(E) house outline"));
    r.push(hasAcc ? row("(E) garage / accessory outline", "≈ " + fmt(acc) + " sf", "est") : miss("(E) shed / accessory", "not mapped"));
    r.push(bld != null ? row("TOTAL EXISTING", "≈ " + fmt(bld) + " sf" + (pctOf(bld, lot) ? " · " + pctOf(bld, lot) : ""), "est", true) : miss("TOTAL EXISTING"));
    if (opt) {
      if (fp == null) r.push(row("(N) " + (OPT_ROW[opt.kind] || "option"), "no new footprint"));
      else {
        r.push(row("(N) " + (OPT_ROW[opt.kind] || "option") + " footprint", fmt(fp) + " sf"));
        var covT = opt.kind === "teardown" ? fp : (bld != null ? bld + fp : null);
        if (covT != null) { var c1 = vs(covT, caps.coverage, false); r.push(row("TOTAL WITH OPTION", (opt.kind === "teardown" ? "" : "≈ ") + fmt(covT) + " sf" + (pctOf(covT, lot) ? " · " + pctOf(covT, lot) : "") + c1.t, c1.s === "missing" ? "missing" : "est", true)); }
        else r.push(miss("TOTAL WITH OPTION", "≥ " + fmt(fp) + " sf (existing outline not in public data)"));
      }
    }
    out.push({ id: "coverage", title: "LOT COVERAGE" + (isNum(caps.coverage) ? " (" + (isNum(caps.coveragePct) ? caps.coveragePct + "% = " : "cap ") + fmt(caps.coverage) + " sf)" : caps.covNone ? " (no cap in this zone)" : " (cap not coded — verify)"), rows: r });

    /* Impervious */
    r = [];
    r.push(bld != null ? row("(E) roofs", "≈ " + fmt(bld) + " sf", "est") : miss("(E) roofs"));
    var pav = [], pavMiss = [];
    if (isNum(eff.drive)) pav.push("driveway ≈ " + fmt(eff.drive)); else pavMiss.push("driveway");
    if (isNum(eff.hard)) pav.push("walks, patio ≈ " + fmt(eff.hard)); else pavMiss.push("walks, patio, decks");
    if (!pav.length) r.push(miss("(E) driveway, walks, patio, decks", "not measured — not zero"));
    else r.push(row("(E) paving", pav.join(" · ") + " sf" + (pavMiss.length ? "; " + pavMiss.join(", ") + " not measured" : ""), pavMiss.length ? "partial" : "est"));
    var impT = isNum(eff.impervious) ? eff.impervious : null, impK = isNum(eff.impKnown) ? eff.impKnown : bld, impPartial = impT == null;
    if (impT != null) r.push(row("TOTAL EXISTING", "≈ " + fmt(impT) + " sf" + (pctOf(impT, lot) ? " · " + pctOf(impT, lot) : ""), "est", true));
    else if (impK != null) r.push(row("TOTAL EXISTING", "≥ " + fmt(impK) + " sf (" + (pav.length ? "paving partly mapped" : "roofs only") + ")", "partial", true));
    else r.push(miss("TOTAL EXISTING"));
    if (opt && fp != null) {
      var base = opt.kind === "teardown" ? (impT != null ? impT - (bld || 0) : (impK != null ? impK - (bld || 0) : null)) : (impT != null ? impT : impK);
      if (base != null) {
        var tot = base + fp, c2 = vs(tot, caps.impervious, impPartial);
        r.push(row("WITH OPTION (new roof only)", (impPartial ? "≥ " : "≈ ") + fmt(tot) + " sf" + (pctOf(tot, lot) ? " · " + pctOf(tot, lot) : "") + c2.t, c2.s === "missing" ? "missing" : impPartial ? "partial" : "est", true));
      }
    }
    var dr = F.drainage;
    r.push(dr && dr.v ? row("Civil / drainage trigger", dr.short || dr.v, dr.checked ? "fact" : "verify") : row("Civil / drainage trigger", "not coded — verify with " + place, "verify"));
    out.push({ id: "impervious", title: "IMPERVIOUS" + (isNum(caps.impervious) ? " (" + (isNum(caps.imperviousPct) ? caps.imperviousPct + "% = " : "cap ") + fmt(caps.impervious) + " sf)" : caps.impNone ? " (no cap in this zone)" : " (cap not coded — verify)"), rows: r });

    /* Gross floor area */
    r = [];
    (eff.floorParts || []).forEach(function (p) { if (isNum(p.sf)) r.push(row("(E) " + String(p.label || p.key).toLowerCase() + (p.counted === false ? " (not counted)" : ""), fmt(p.sf) + " sf")); });
    (eff.floorMissing || []).forEach(function (m) { r.push(miss("(E) " + m)); });
    var used = isNum(eff.floorUsed) ? eff.floorUsed : null, fPartial = !!(eff.floorMissing && eff.floorMissing.length);
    if (used == null && F.living && F.living.finSize && isNum(F.living.sf)) r.push(row("(E) house size (county FinSize)", "≈ " + fmt(F.living.sf) + " sf · not total living area", "est"));
    r.push(used != null ? row("TOTAL EXISTING", (fPartial ? "≥ " : "") + fmt(used) + " sf", fPartial ? "partial" : "fact", true) : miss("TOTAL EXISTING", "living area " + MISSING));
    if (opt && isNum(opt.gfaSf) && opt.gfaSf > 0) {
      r.push(row("(N) " + (OPT_ROW[opt.kind] || "option"), fmt(opt.gfaSf) + " sf" + (opt.levels > 1 && isNum(opt.footprintSf) ? " (" + fmt(opt.footprintSf) + " × " + opt.levels + " levels)" : "")));
      var gT = opt.kind === "teardown" ? opt.gfaSf : (used != null ? used + opt.gfaSf : null);
      if (gT != null) { var c3 = vs(gT, caps.floorCap, fPartial && opt.kind !== "teardown"); r.push(row("TOTAL WITH OPTION", (fPartial && opt.kind !== "teardown" ? "≥ " : "") + fmt(gT) + " sf" + (isNum(caps.floorCap) ? c3.t.replace("under cap", "under " + fmt(caps.floorCap)) : ""), c3.s === "missing" ? "missing" : fPartial && opt.kind !== "teardown" ? "partial" : "fact", true)); }
    }
    // The sheet carries the credit count. The facts sheet carries the reason and the code section.
    if (opt && F.energy) {
      var en = F.energy(opt.kind, opt.gfaSf);
      if (en && en.text) r.push(row("Energy credits (" + (en.edition || "WSEC-R") + ")", en.credits == null ? "credit table not coded — verify" : (en.credits === 0 ? "exempt" : en.credits.toFixed(1) + " credits") + (en.state === "fact" ? "" : " (verify)"), en.credits != null && en.state === "fact" ? "fact" : "verify"));
    }
    out.push({ id: "gfa", title: "GROSS FLOOR AREA" + (isNum(caps.floorCap) ? " (cap " + fmt(caps.floorCap) + " sf" + (F.gfaVerify ? " — VERIFY" : "") + ")" : caps.farNone ? " (no FAR limit in this zone)" : " (cap not coded — verify)"), rows: r });
    return out;
  }
  var STATE_CLASS = { fact: "bh-s-fact", est: "bh-s-est", partial: "bh-s-partial", missing: "bh-s-missing", verify: "bh-s-verify" };
  /* The same tables as HTML: the text in the drawing is a few points high on a phone and is not read aloud. */
  function tablesHtml(tb) {
    return (tb || []).map(function (t) {
      return '<table class="bh-table bh-sheet-table"><caption>' + esc(t.title) + "</caption><tbody>" + t.rows.map(function (r) {
        return "<tr" + (r.b ? ' class="bh-total"' : "") + '><th scope="row">' + esc(r.k) + '</th><td class="' + (STATE_CLASS[r.s] || "bh-s-fact") + '">' + esc(r.v) + "</td></tr>";
      }).join("") + "</tbody></table>";
    }).join("");
  }

  /* ---------- E. drawing ---------- */
  /* Text cannot be measured here, so widths are estimates. tw() is on the wide side and is used to keep
     labels apart. twMin() is on the narrow side: text is squeezed to a width only when even that estimate
     does not fit, because textLength also stretches text that was going to fit. */
  function tw(text, size, ls) { return String(text).length * (size * 0.58 + (ls || 0)); }
  function twMin(text, size, ls) { return String(text).length * (size * 0.5 + (ls || 0)); }
  function T(x, y, text, o) {
    o = o || {};
    return '<text x="' + r1(x) + '" y="' + r1(y) + '"' + (o.size ? ' font-size="' + o.size + '"' : "") + ' fill="' + (o.fill || INK) + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : "") + (o.weight ? ' font-weight="' + o.weight + '"' : "") + (o.ls ? ' letter-spacing="' + o.ls + '"' : "") +
      (o.italic ? ' font-style="italic"' : "") + (o.fit ? ' textLength="' + r1(o.fit) + '" lengthAdjust="spacingAndGlyphs"' : "") +
      (o.rot ? ' transform="rotate(' + r1(o.rot) + " " + r1(x) + " " + r1(y) + ')"' : "") +
      (o.halo ? ' stroke="#ffffff" stroke-width="' + (o.haloW || 4) + '" stroke-linejoin="round" paint-order="stroke"' : "") + ">" + esc(text) + "</text>";
  }
  function clip(text, n) { text = String(text == null ? "" : text); return text.length > n ? text.slice(0, Math.max(1, n - 1)).replace(/[\s·,;(]+$/, "") + "…" : text; }
  /* Greedy label placement: a label goes at the first candidate spot that is inside the frame and clear of
     what is already placed. A low-priority label with no free spot is left off. */
  function Boxes(w, h) { this.w = w; this.h = h; this.list = []; }
  Boxes.prototype.box = function (x, y, w, h, rot) {
    var a = (rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), W = w * c + h * s, H = w * s + h * c;
    return [x - W / 2, y - H / 2, x + W / 2, y + H / 2];
  };
  Boxes.prototype.free = function (b) {
    if (b[0] < 3 || b[1] < 3 || b[2] > this.w - 3 || b[3] > this.h - 3) return false;
    for (var i = 0; i < this.list.length; i++) { var o = this.list[i]; if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return false; }
    return true;
  };
  Boxes.prototype.add = function (b) { this.list.push(b); return b; };
  Boxes.prototype.put = function (cands, w, h, force) {
    for (var i = 0; i < cands.length; i++) { var b = this.box(cands[i].x, cands[i].y, w, h, cands[i].rot); if (this.free(b)) { this.add(b); return cands[i]; } }
    if (force && cands.length) { this.add(this.box(cands[0].x, cands[0].y, w, h, cands[0].rot)); return cands[0]; }
    return null;
  };
  /* Text along a line, turned so it is never upside down. A vertical line reads from the bottom up. */
  function readable(deg) { while (deg >= 90) deg -= 180; while (deg < -90) deg += 180; return deg; }

  /* The plan itself, in the plan frame's own units (0..PLAN.w by 0..PLAN.h). Returns the markup and what it used. */
  function planMarkup(M, o) {
    var G = GEO(), W = PLAN.w, Hh = PLAN.h, out = [], B = new Boxes(W, Hh), P = o.placed, opt = o.opt;
    var b = M.bbox, lw = b[2] - b[0], lh = b[3] - b[1], margin = Math.max(22, Math.min(60, 0.18 * Math.max(lw, lh)));
    var sc = SCALES[SCALES.length - 1];
    for (var si = 0; si < SCALES.length; si++) if ((lw + 2 * margin) * UPI / SCALES[si] <= W && (lh + 2 * margin) * UPI / SCALES[si] <= Hh) { sc = SCALES[si]; break; }
    var k = UPI / sc, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, lcx = cx, lcy = cy;
    // The lot is centered, then slid toward a mapped street (or alley) that would otherwise fall off the
    // edge of the frame, as far as the spare room on that axis allows. The scale does not change for it.
    var needs = { E: 0, W: 0, N: 0, S: 0 };
    M.edges.forEach(function (e) {
      if (e.streetDist == null || !(e.kind === "front" || e.kind === "street" || e.alley)) return;
      var ext = e.streetDist + (e.alley ? 10 : 16);
      if (Math.abs(e.nx) >= Math.abs(e.ny)) { if (e.nx > 0) needs.E = Math.max(needs.E, ext); else needs.W = Math.max(needs.W, ext); }
      else if (e.ny > 0) needs.N = Math.max(needs.N, ext); else needs.S = Math.max(needs.S, ext);
    });
    var slide = function (pos, neg, slack) {
      var room = Math.max(0, slack - 10);
      if (pos > slack && neg <= slack) return Math.min(pos - slack, room);
      if (neg > slack && pos <= slack) return -Math.min(neg - slack, room);
      return 0;
    };
    cx += slide(needs.E, needs.W, (W / k - lw) / 2);
    cy += slide(needs.N, needs.S, (Hh / k - lh) / 2);
    var X = function (x) { return W / 2 + (x - cx) * k; }, Y = function (y) { return Hh / 2 - (y - cy) * k; };
    var view = [cx - W / 2 / k, cy - Hh / 2 / k, cx + W / 2 / k, cy + Hh / 2 / k];
    var pathOf = function (rings, open) { return rings.map(function (r) { return r.map(function (p, i) { return (i ? "L" : "M") + r1(X(p[0])) + " " + r1(Y(p[1])); }).join("") + (open ? "" : "Z"); }).join(""); };
    var seg = function (x1, y1, x2, y2, stroke, w, dash) { return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" stroke="' + stroke + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : "") + "/>"; };
    var inView = function (x, y, pad) { pad = pad || 0; return x >= view[0] + pad && x <= view[2] - pad && y >= view[1] + pad && y <= view[3] - pad; };
    var used = { scale: sc, k: k, contours: false, hazards: false, trees: 0, option: false, envelope: false, streets: false, sidewalk: false, paving: false, neighbors: false, inset: false };

    out.push('<rect x="0" y="0" width="' + W + '" height="' + Hh + '" fill="' + PAPER + '"/>');
    // Reserved corners: north arrow (top right), scale bar and source line (bottom left).
    B.add([W - 96, 8, W - 8, 118]);
    B.add([8, Hh - 62, 520, Hh - 6]);

    /* neighboring parcels */
    if (M.parcels.length) { out.push('<path d="' + pathOf(M.parcels) + '" fill="none" stroke="' + GREY_LINE + '" stroke-width="1" stroke-dasharray="10 4 2 4"/>'); used.neighbors = true; }
    /* streets: a band along each mapped centerline. The width is a drawing width, not the right of way. */
    var streetLabels = [];
    if (M.streets.length) {
      M.streets.forEach(function (s) {
        var d = pathOf([s.line], true), wFt = s.kind === "alley" ? 12 : 24;
        out.push('<path d="' + d + '" fill="none" stroke="' + ROAD + '" stroke-width="' + r1(wFt * k) + '" stroke-linejoin="round"/>');
        out.push('<path d="' + d + '" fill="none" stroke="#c9c9c2" stroke-width="1" stroke-dasharray="14 8"/>');
      });
      used.streets = true;
      var seen = {};
      M.streets.forEach(function (s) {
        var name = s.kind === "alley" ? "ALLEY" : String(s.name || "").toUpperCase();
        if (!name || seen[name]) return;
        // Label where the street passes nearest the lot. Other spots along it are kept in case that one is taken.
        var spotsA = [];
        for (var i = 0; i < s.line.length - 1; i++) {
          var segL = hyp(s.line[i + 1][0] - s.line[i][0], s.line[i + 1][1] - s.line[i][1]), nS = Math.max(4, Math.ceil(segL / 25));
          for (var q = 0; q <= nS; q++) {
            var px = s.line[i][0] + (s.line[i + 1][0] - s.line[i][0]) * q / nS, py = s.line[i][1] + (s.line[i + 1][1] - s.line[i][1]) * q / nS;
            if (inView(px, py, 12 / k)) spotsA.push({ d: hyp(px - cx, py - cy), x: px, y: py, rot: readable(Math.atan2(-(s.line[i + 1][1] - s.line[i][1]), s.line[i + 1][0] - s.line[i][0]) * 180 / Math.PI) });
          }
        }
        if (spotsA.length) { seen[name] = true; spotsA.sort(function (a, b2) { return a.d - b2.d; }); streetLabels.push({ name: name, spots: spotsA.slice(0, 40), alley: s.kind === "alley" }); }
      });
    } else if (M.ce && M.edges.some(function (e) { return e.kind === "front"; })) {
      // No mapped street geometry: a band along the front lot line, named from the address.
      var fe = M.edges.filter(function (e) { return e.kind === "front"; }), pts = [];
      fe.forEach(function (e) { pts.push([e.a[0] + e.nx * 20, e.a[1] + e.ny * 20], [e.b[0] + e.nx * 20, e.b[1] + e.ny * 20]); });
      var ext = function (p, q, by) { var L = hyp(q[0] - p[0], q[1] - p[1]) || 1; return [p[0] + (p[0] - q[0]) / L * by, p[1] + (p[1] - q[1]) / L * by]; };
      if (pts.length >= 2) {
        pts.unshift(ext(pts[0], pts[1], 400)); pts.push(ext(pts[pts.length - 1], pts[pts.length - 2], 400));
        out.push('<path d="' + pathOf([pts], true) + '" fill="none" stroke="' + ROAD + '" stroke-width="' + r1(24 * k) + '" stroke-linejoin="round"/>');
        var mid = fe.reduce(function (m, e) { return e.len > m.len ? e : m; }, fe[0]);
        if (M.addrStreet) streetLabels.push({ name: String(M.addrStreet).toUpperCase(), spots: [{ x: mid.mx + mid.nx * 20, y: mid.my + mid.ny * 20, rot: readable(Math.atan2(-(mid.b[1] - mid.a[1]), mid.b[0] - mid.a[0]) * 180 / Math.PI) }] });
        used.streets = true;
      }
    }
    if (M.sidewalks.length) { M.sidewalks.forEach(function (s) { out.push('<path d="' + pathOf([s.line], true) + '" fill="none" stroke="#cfcfc8" stroke-width="' + r1(Math.max(2, 5 * k)) + '" stroke-dasharray="2 3"/>'); }); used.sidewalk = true; }
    /* neighbors' buildings */
    M.nearBuildings.forEach(function (nbld) { out.push('<path d="' + pathOf(nbld.rings || [nbld.ring]) + '" fill="' + GREY + '" fill-rule="evenodd" stroke="#b9bcb6" stroke-width="1"/>'); used.neighbors = true; });
    /* the lot */
    out.push('<path d="' + pathOf(M.lot) + '" fill="#fffefb" fill-rule="evenodd" stroke="none"/>');
    /* contours, drawn across the lot and the ground around it */
    var contourLabels = [];
    if (M.contours && M.contours.sets.length) {
      M.contours.sets.forEach(function (c) {
        var d = pathOf(c.lines, true);
        out.push('<path d="' + d + '" fill="none" stroke="' + TAN + '" stroke-width="' + (c.index ? 1.5 : 0.9) + '"' + (c.index ? "" : ' stroke-dasharray="5 4"') + ' stroke-linejoin="round"/>');
        if (c.index) {
          var longest = c.lines.reduce(function (m, ln) { return ln.length > m.length ? ln : m; }, c.lines[0]);
          var pa = G.pointAlong(longest, 0.5);
          if (pa && inView(pa.x, pa.y, 20 / k)) contourLabels.push({ x: pa.x, y: pa.y, rot: readable(Math.atan2(-pa.dy, pa.dx) * 180 / Math.PI), text: Math.round(c.level) + "'" });
        }
      });
      used.contours = true;
    }
    /* mapped hazard areas: red hatch, clipped to what is in view */
    M.hazards.forEach(function (hz) {
      var lines = G.hatch(hz.rings, 9 / k, 135, view);
      out.push('<path d="' + pathOf(hz.rings) + '" fill="' + HAZ + '" fill-opacity="0.06" fill-rule="evenodd" stroke="' + HAZ + '" stroke-width="1" stroke-dasharray="4 3"/>');
      out.push('<path d="' + lines.slice(0, 600).map(function (s) { return "M" + r1(X(s[0])) + " " + r1(Y(s[1])) + "L" + r1(X(s[2])) + " " + r1(Y(s[3])); }).join("") + '" fill="none" stroke="' + HAZ + '" stroke-width="0.7" stroke-opacity="0.7"/>');
      used.hazards = true;
    });
    /* buildable envelope */
    if (M.env && M.env.rings.length) {
      out.push('<path d="' + pathOf(M.env.rings) + '" fill="' + GREEN_FILL + '" fill-opacity="0.7" fill-rule="evenodd" stroke="' + GREEN + '" stroke-width="1.6" stroke-dasharray="9 5" stroke-linejoin="round"/>');
      used.envelope = true;
    }
    /* paving */
    M.drives.concat(M.hard).forEach(function (d) { out.push('<path d="' + pathOf([d.ring]) + '" fill="#e2e0d9" stroke="#bdbbb2" stroke-width="0.8"/>'); used.paving = true; });
    M.driveLines.forEach(function (d) { out.push('<path d="' + pathOf([d.line], true) + '" fill="none" stroke="#e2e0d9" stroke-width="' + r1((d.widthFt || 10) * k) + '" stroke-linecap="butt" stroke-linejoin="round"/>'); used.paving = true; });
    /* existing buildings on the lot */
    var teardown = opt && opt.kind === "teardown" && P && P.ok;
    M.buildings.forEach(function (bd) {
      out.push('<path d="' + pathOf(bd.rings || [bd.ring]) + '" fill="#ffffff" fill-rule="evenodd" stroke="' + INK + '" stroke-width="' + (teardown ? 1.4 : 2.6) + '"' + (teardown ? ' stroke-dasharray="7 5"' : "") + ' stroke-linejoin="miter"/>');
    });
    /* mapped trees */
    M.trees.forEach(function (t) {
      if (!inView(t.x, t.y)) return;
      out.push('<circle cx="' + r1(X(t.x)) + '" cy="' + r1(Y(t.y)) + '" r="' + r1(Math.max(5, 7 * k)) + '" fill="none" stroke="' + GREEN + '" stroke-width="1" stroke-dasharray="3 2"/><circle cx="' + r1(X(t.x)) + '" cy="' + r1(Y(t.y)) + '" r="1.6" fill="' + GREEN + '"/>');
      used.trees++;
    });
    /* the option */
    if (P && P.ok && P.rings) {
      var hl = G.hatch(P.rings, (P.existing ? 12 : 7) / k, 45, view);
      out.push('<path d="' + pathOf(P.rings) + '" fill="#ffffff" fill-opacity="' + (P.existing || P.over ? 0.35 : 0.9) + '" fill-rule="evenodd" stroke="none"/>');
      out.push('<path d="' + hl.slice(0, 900).map(function (s) { return "M" + r1(X(s[0])) + " " + r1(Y(s[1])) + "L" + r1(X(s[2])) + " " + r1(Y(s[3])); }).join("") + '" fill="none" stroke="' + INK + '" stroke-width="' + (P.existing ? 0.6 : 0.9) + '"/>');
      out.push('<path d="' + pathOf(P.rings) + '" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="miter"/>');
      used.option = true;
    }
    /* lot line */
    out.push('<path d="' + pathOf(M.lot) + '" fill="none" stroke="' + INK + '" stroke-width="2.8" stroke-dasharray="26 7 4 7" stroke-linejoin="miter"/>');

    /* aerial inset: the corner where it hides the least of the lot */
    var inset = null;
    if (o.imagery && o.imagery.url) {
      var iw = 262, ih = 216, corners = [[W - iw - 10, Hh - ih - 10], [10, 10], [W - iw - 10, 124], [10, Hh - ih - 70]];
      var lb = [X(b[0]), Y(b[3]), X(b[2]), Y(b[1])], bestC = null;
      corners.forEach(function (c) {
        var ox = Math.max(0, Math.min(c[0] + iw, lb[2]) - Math.max(c[0], lb[0])), oy = Math.max(0, Math.min(c[1] + ih, lb[3]) - Math.max(c[1], lb[1])), ov = ox * oy / (iw * ih);
        if (!bestC || ov < bestC.ov - 0.001) bestC = { ov: ov, x: c[0], y: c[1] };
      });
      if (bestC && bestC.ov <= 0.3) { inset = { x: bestC.x, y: bestC.y, w: iw, h: ih }; B.add([inset.x - 4, inset.y - 4, inset.x + iw + 4, inset.y + ih + 4]); }
    }

    /* orange notes: what is not in public data for this lot. Their corner is kept clear of labels. */
    var notes = [];
    if (!M.hasGeo) notes.push("BUILDINGS / PAVING: outlines were not read for this lot — verify on site.");
    else {
      if (!M.buildings.length) notes.push("HOUSE OUTLINE: not in public data. Nothing is drawn for it.");
      if (!M.drives.length && !M.driveLines.length && !M.hard.length) notes.push("DRIVEWAY / WALKS / PATIO: not in public data — verify on site.");
      else if (M.driveLines.length && !M.drives.length) notes.push("DRIVEWAY: mapped centerline at an assumed 10 ft width (approx.).");
    }
    if (!M.trees.length) notes.push("TREES: no public tree layer read for this lot. Survey or arborist.");
    if (!M.sbKnown) notes.push("SETBACKS: not all coded for this zone, so no envelope is drawn — verify with " + (o.place || "the jurisdiction") + ".");
    if (!M.contours) notes.push("CONTOURS: unavailable (the elevation service did not answer).");
    if (P && !P.ok && opt) notes.push(String(OPT_NAME[opt.kind] || "OPTION") + " NOT DRAWN: " + P.why);
    if (P && P.ok && P.note) {
      // The size note and the hazard note are separate lines, so a long size note cannot push the hazard note off the sheet.
      var sizeNote = String(P.note).replace(ON_HAZARD, "").trim();
      if (sizeNote) notes.push(sizeNote);
    }
    if (M.ce && M.ce.through) notes.push("A street also runs behind this lot. The jurisdiction may apply a front setback there — verify.");
    if (M.parts > 1) notes.push("The parcel record has " + M.parts + " outline rings. Lot lines and the envelope use the largest.");
    if (P && P.ok && P.onHazard) notes.unshift("CONCEPT ON A MAPPED CRITICAL AREA: the only place it fits as drawn. A critical-area review can move it or rule it out.");
    notes = notes.slice(0, 6);
    var nOut = [], nx0 = 14, ny0 = Hh - 76 - notes.length * 15;
    if (inset && inset.x < 300 && inset.y > Hh / 2) ny0 = inset.y - 10 - notes.length * 15;
    notes.forEach(function (n, i) { nOut.push(T(nx0, ny0 + i * 15, clip(n, 118), { size: 11, fill: ORANGE, halo: true, haloW: 3 })); });
    if (notes.length) B.add([8, ny0 - 14, 8 + Math.min(W - 16, Math.max.apply(null, notes.map(function (n) { return tw(clip(n, 118), 11) * 0.92; }))), ny0 + (notes.length - 1) * 15 + 6]);

    /* option label: a white tag, always placed */
    var tags = [];
    if (P && P.ok && opt) {
      var ol = optLabel(opt, P), lp = G.labelPoint(P.rings), tw1 = Math.max(tw(ol.head, 14), tw(ol.sub, 11.5)) + 18;
      var spot = B.put([{ x: X(lp.x), y: Y(lp.y) }, { x: X(lp.x), y: Y(lp.y) - 44 }, { x: X(lp.x), y: Y(lp.y) + 44 }], tw1, 42, true);
      tags.push('<rect x="' + r1(spot.x - tw1 / 2) + '" y="' + r1(spot.y - 21) + '" width="' + r1(tw1) + '" height="42" fill="#ffffff" stroke="' + INK + '" stroke-width="1"/>' +
        T(spot.x, spot.y - 3, ol.head, { size: 14, weight: 700, anchor: "middle" }) + T(spot.x, spot.y + 13, ol.sub, { size: 11.5, anchor: "middle" }));
    }
    /* existing building labels */
    M.buildings.forEach(function (bd) {
      var lp2 = G.labelPoint(bd.rings || [bd.ring]), name = bd.role === "house" ? "(E) HOUSE" : bd.role === "garage" ? "(E) GARAGE" : "(E) BLDG";
      if (teardown) name = bd.role === "house" ? "(E) HOUSE, REMOVED" : "(E) BLDG";
      var sfv = bd.sfOnLot != null ? bd.sfOnLot : bd.sf, line2 = isNum(sfv) ? "roof outline ≈ " + fmt(sfv) + " sf" : "";
      var room = lp2.r * k * 2, wName = tw(name, 13.5);
      if (room < wName * 0.7) return;
      var two = line2 && room > tw(line2, 11) * 0.8 && room > 40;
      var sp = B.put([{ x: X(lp2.x), y: Y(lp2.y) }], Math.max(wName, two ? tw(line2, 11) : 0), two ? 32 : 16, false);
      if (!sp) return;
      tags.push(T(sp.x, sp.y + (two ? -3 : 5), name, { size: 13.5, weight: 700, anchor: "middle", halo: true }) + (two ? T(sp.x, sp.y + 12, line2, { size: 11, anchor: "middle", halo: true, fill: MUTE }) : ""));
    });

    // What is drawn inside the lot is in the way of every label placed from here on.
    var solid = M.buildings.map(function (bd) { return bd.rings || [bd.ring]; });
    if (P && P.ok && P.rings) solid.push(P.rings);
    solid.forEach(function (rings) { var q = G.bbox(rings); B.add([X(q[0]) - 2, Y(q[3]) - 2, X(q[2]) + 2, Y(q[1]) + 2]); });

    /* lot line lengths, outside each line */
    var dims = [];
    M.lines.forEach(function (ln) {
      var L = ln.path || ln.len;
      if (L * k < 44) return;
      var ang = readable(Math.atan2(-(ln.b[1] - ln.a[1]), ln.b[0] - ln.a[0]) * 180 / Math.PI), text = ft1(L) + "'" + (ln.curved ? " (along the curve)" : "");
      var wT = tw(text, 13.5), c = [];
      [0.5, 0.32, 0.68].forEach(function (t) { c.push({ x: X(ln.a[0] + (ln.b[0] - ln.a[0]) * t) + ln.nx * 16, y: Y(ln.a[1] + (ln.b[1] - ln.a[1]) * t) - ln.ny * 16, rot: ang }); });
      var sp = B.put(c, wT, 16, false);
      if (sp) dims.push(T(sp.x, sp.y + 5, text, { size: 13.5, weight: 700, anchor: "middle", rot: sp.rot, halo: true }));
    });
    /* setback ticks and labels: the longest line of each kind, and the two longest sides */
    var sbOut = [];
    if (M.sbKnown) {
      var KN = { front: "FRONT", street: "STREET SIDE", side: "SIDE", rear: "REAR" }, pick = { front: 1, street: 1, side: 2, rear: 1 }, got = {};
      M.lines.slice().sort(function (p, q) { return q.len - p.len; }).forEach(function (ln) {
        var sbv = setbackFor(ln, M.sb);
        if (!isNum(sbv) || sbv <= 0 || (got[ln.kind] || 0) >= pick[ln.kind] || ln.len * k < 60) return;
        got[ln.kind] = (got[ln.kind] || 0) + 1;
        var t0 = ln.kind === "side" ? 0.3 : 0.62, mx = ln.a[0] + (ln.b[0] - ln.a[0]) * t0, my = ln.a[1] + (ln.b[1] - ln.a[1]) * t0;
        var ix = mx - ln.nx * sbv, iy = my - ln.ny * sbv, ux = (ln.b[0] - ln.a[0]) / (ln.len || 1), uy = (ln.b[1] - ln.a[1]) / (ln.len || 1), tk = 5 / k;
        sbOut.push(seg(X(mx), Y(my), X(ix), Y(iy), GREEN, 1.2) + seg(X(mx - ux * tk), Y(my - uy * tk), X(mx + ux * tk), Y(my + uy * tk), GREEN, 1.2) + seg(X(ix - ux * tk), Y(iy - uy * tk), X(ix + ux * tk), Y(iy + uy * tk), GREEN, 1.2));
        var text = (sbv % 1 ? ft1(sbv) : String(sbv)) + "' " + KN[ln.kind] + (ln.alley ? " (ALLEY)" : "") + " SETBACK" + (M.sbVerify ? " (verify)" : "");
        var ang = readable(Math.atan2(-(ln.b[1] - ln.a[1]), ln.b[0] - ln.a[0]) * 180 / Math.PI), wT = tw(text, 11.5, 0.3), c = [];
        [0.5, 0.3, 0.7, 0.4, 0.6].forEach(function (t) {
          var px = ln.a[0] + (ln.b[0] - ln.a[0]) * t - ln.nx * (sbv + 9 / k), py = ln.a[1] + (ln.b[1] - ln.a[1]) * t - ln.ny * (sbv + 9 / k);
          c.push({ x: X(px), y: Y(py), rot: ang });
        });
        var sp = B.put(c, Math.min(wT, ln.len * k), 14, false);
        if (sp) sbOut.push(T(sp.x, sp.y + 4, text, { size: 11.5, anchor: "middle", rot: sp.rot, fill: GREEN, halo: true, haloW: 3, ls: 0.3 }));
      });
    }
    /* spot elevations at the lot corners: lidar readings, never wall heights */
    var spotOut = [];
    M.spots.forEach(function (s) {
      var px = X(s.x), py = Y(s.y), text = "EL " + Math.round(s.el) + "' ±", wT = tw(text, 11.5);
      var ox = s.x >= lcx ? 1 : -1, oy = s.y >= lcy ? -1 : 1;
      spotOut.push('<path d="M' + r1(px) + " " + r1(py - 5) + "L" + r1(px + 5) + " " + r1(py) + "L" + r1(px) + " " + r1(py + 5) + "L" + r1(px - 5) + " " + r1(py) + 'Z" fill="' + EARTH + '"/>');
      var sp = B.put([{ x: px + ox * (wT / 2 + 9), y: py + oy * 13 }, { x: px - ox * (wT / 2 + 9), y: py + oy * 13 }, { x: px + ox * (wT / 2 + 9), y: py - oy * 13 }], wT, 14, false);
      if (sp) spotOut.push(T(sp.x, sp.y + 4, text, { size: 11.5, anchor: "middle", fill: EARTH, halo: true, haloW: 3 }));
    });
    /* street names */
    var stOut = [];
    streetLabels.forEach(function (s) {
      var size = s.alley ? 12 : 17, ls = s.alley ? 2 : 3, wT = tw(s.name, size, ls);
      var sp = B.put(s.spots.map(function (q) { return { x: X(q.x), y: Y(q.y), rot: q.rot }; }), wT, size + 2, false);
      if (sp) stOut.push(T(sp.x, sp.y + size * 0.36, s.name, { size: size, weight: 600, anchor: "middle", rot: sp.rot, fill: "#6f7672", ls: ls, halo: true, haloW: 3 }));
    });
    /* envelope caption */
    var envOut = "";
    if (M.env && M.env.area > 0) {
      var et = "BUILDABLE AREA ≈ " + fmt(Math.round(M.env.area / 10) * 10) + " SF (inside setbacks)", wE = tw(et, 12, 0.3), cands = [];
      var eb = G.bbox(M.env.rings), inEnv = function (px, py) { return G.maskAt(M.env.mask, cx + (px - W / 2) / k, cy - (py - Hh / 2) / k); };
      // A lattice over the envelope, nearest its middle first. The caption has to sit inside the envelope end to end.
      for (var gj = 1; gj <= 7; gj++) for (var gi = 1; gi <= 5; gi++) {
        var ex = X(eb[0] + (eb[2] - eb[0]) * gi / 6), ey = Y(eb[1] + (eb[3] - eb[1]) * gj / 8);
        if (inEnv(ex, ey) && inEnv(ex - wE / 2, ey) && inEnv(ex + wE / 2, ey)) cands.push({ x: ex, y: ey, d: hyp(ex - X(M.env.cx), ey - Y(M.env.cy)) });
      }
      cands.sort(function (p, q) { return p.d - q.d; });
      var spE = B.put(cands, wE, 15, false);
      if (spE) envOut = T(spE.x, spE.y + 4, et, { size: 12, weight: 700, anchor: "middle", fill: GREEN, halo: true, haloW: 3, ls: 0.3 });
    }
    var ctOut = [];
    contourLabels.slice(0, 8).forEach(function (c) {
      var wT = tw(c.text, 10.5), sp = B.put([{ x: X(c.x), y: Y(c.y), rot: c.rot }], wT, 12, false);
      if (sp) ctOut.push(T(sp.x, sp.y + 3.5, c.text, { size: 10.5, anchor: "middle", rot: sp.rot, fill: EARTH, halo: true, haloW: 3 }));
    });
    out.push(stOut.join(""), sbOut.join(""), ctOut.join(""), envOut, spotOut.join(""), dims.join(""), tags.join(""));

    out.push(nOut.join(""));

    /* aerial inset */
    if (inset) {
      var im = o.imagery, vw = isNum(+im.W) ? +im.W : 800, vh = isNum(+im.H) ? +im.H : 600;
      out.push('<rect x="' + (inset.x - 4) + '" y="' + (inset.y - 4) + '" width="' + (inset.w + 8) + '" height="' + (inset.h + 8) + '" fill="#ffffff" stroke="' + GREY_LINE + '" stroke-width="1"/>' +
        '<image href="' + esc(im.url) + '" x="' + inset.x + '" y="' + inset.y + '" width="' + inset.w + '" height="' + (inset.h - 16) + '" preserveAspectRatio="xMidYMid slice"/>' +
        '<svg x="' + inset.x + '" y="' + inset.y + '" width="' + inset.w + '" height="' + (inset.h - 16) + '" viewBox="0 0 ' + vw + " " + vh + '" preserveAspectRatio="xMidYMid slice"><path d="' + esc(im.path) + '" fill="none" stroke="#ffd60a" stroke-width="5"/></svg>' +
        T(inset.x + 2, inset.y + inset.h - 3, (function () {
          // The longest caption that fits under the photo: the credit and what the yellow line is, else the credit alone.
          var credit = String(im.credit || "Aerial photo").replace(/^Imagery:\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").toUpperCase(), room = inset.w - 4;
          var tries = [credit + " · parcel outline in yellow", credit + " · lot in yellow", credit];
          for (var ci = 0; ci < tries.length; ci++) if (tw(tries[ci], 7.5) <= room) return tries[ci];
          return clip(credit, Math.max(12, Math.floor(room / 4.4)));
        })(), { size: 7.5, fill: MUTE }));
      used.inset = true;
    }
    /* north arrow, and the way the ground falls */
    var nxp = W - 52, nyp = 52;
    out.push('<circle cx="' + nxp + '" cy="' + nyp + '" r="22" fill="#ffffff" stroke="' + INK + '" stroke-width="1.2"/><path d="M' + nxp + " " + (nyp - 30) + "L" + (nxp + 8) + " " + (nyp + 12) + "L" + nxp + " " + (nyp + 5) + "L" + (nxp - 8) + " " + (nyp + 12) + 'Z" fill="' + INK + '"/>' + T(nxp, nyp + 44, "N", { size: 13, weight: 700, anchor: "middle" }));
    if (M.slope && isNum(M.slope.fallDeg) && M.slope.fallCompass && M.slope.fallCompass !== "flat") {
      var fx = W - 52, fy = 150, fall = Math.max(0, Math.round(M.slope.elevMax - M.slope.elevMin));
      if (B.free([fx - 46, fy - 22, fx + 46, fy + 34])) {
        B.add([fx - 46, fy - 22, fx + 46, fy + 34]);
        out.push('<g transform="rotate(' + r1(M.slope.fallDeg) + " " + fx + " " + fy + ')"><path d="M' + fx + " " + (fy + 14) + "L" + fx + " " + (fy - 8) + '" stroke="' + EARTH + '" stroke-width="2" fill="none"/><path d="M' + fx + " " + (fy - 17) + "L" + (fx + 6) + " " + (fy - 6) + "L" + (fx - 6) + " " + (fy - 6) + 'Z" fill="' + EARTH + '"/></g>' +
          T(fx, fy + 30, "GROUND FALLS ≈ " + fall + "' ±", { size: 9.5, anchor: "middle", fill: EARTH, halo: true, haloW: 3 }));
      }
    }
    /* scale bar */
    var unit = sc <= 10 ? 5 : sc <= 20 ? 10 : sc <= 40 ? 20 : sc <= 80 ? 40 : sc <= 200 ? 100 : sc <= 500 ? 200 : 500;
    var sx0 = 18, sy0 = Hh - 30, u = unit * k, bar = "";
    [[0, 0.5, INK], [0.5, 1, "#ffffff"], [1, 2, INK]].forEach(function (s) { bar += '<rect x="' + r1(sx0 + s[0] * u) + '" y="' + sy0 + '" width="' + r1((s[1] - s[0]) * u) + '" height="7" fill="' + s[2] + '" stroke="' + INK + '" stroke-width="1"/>'; });
    [0, 0.5, 1, 2].forEach(function (m) { bar += T(sx0 + m * u, sy0 - 5, (m * unit) + "'", { size: 10.5, anchor: "middle" }); });
    bar += T(sx0 + 2 * u + 16, sy0 + 7, "GRAPHIC SCALE (feet) · 1 in = " + sc + " ft on a letter sheet printed at 100%", { size: 10.5, fill: MUTE }) +
      T(sx0, sy0 + 23, "Drawn from the county parcel outline, not a survey. The scale bar governs.", { size: 10.5, fill: MUTE });
    out.push(bar);
    out.push('<rect x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (Hh - 1) + '" fill="none" stroke="#d8d7cf" stroke-width="1"/>');
    return { svg: out.join(""), used: used };
  }

  /* The tables in the right column. Row height is set from the room there is. */
  function drawTables(tb, legend) {
    var x = COL.x, w = COL.w, out = [], nRows = 0, nT = tb.length + (legend.length ? 1 : 0);
    tb.forEach(function (t) { nRows += t.rows.length; });
    nRows += legend.length;
    var titleH = 30, rowH = Math.max(14.5, Math.min(21, (COL.h - nT * titleH - 6) / Math.max(1, nRows))), size = Math.min(14.5, rowH * 0.74), y = COL.y + 12;
    var COLOR = { fact: INK, est: INK, partial: INK, missing: ORANGE, verify: ORANGE };
    tb.forEach(function (t) {
      out.push(T(x, y, clip(t.title, 60), { size: 13.5, weight: 700, ls: 1.6, fit: twMin(clip(t.title, 60), 13.5, 1.6) > w ? w : 0 }) + '<rect x="' + x + '" y="' + r1(y + 6) + '" width="' + w + '" height="1.4" fill="' + RULE + '"/>');
      y += titleH - 6;
      t.rows.forEach(function (r) {
        var lw = tw(r.k, size), vw = tw(r.v, size), room = w - Math.min(lw, w * 0.55) - 14, k = clip(r.k, Math.floor(w * 0.56 / (size * 0.56)));
        var v = vw > room * 1.5 ? clip(r.v, Math.floor(room * 1.5 / (size * 0.56))) : r.v;
        out.push(T(x, y, k, { size: size, weight: r.b ? 700 : 400, fit: twMin(k, size) > w * 0.56 ? w * 0.56 : 0 }) +
          T(x + w, y, v, { size: size, weight: r.b ? 700 : 400, anchor: "end", fill: COLOR[r.s] || INK, fit: twMin(v, size) > room ? room : 0 }));
        y += rowH;
      });
      y += 6;
    });
    if (legend.length) {
      out.push(T(x, y, "LEGEND", { size: 13.5, weight: 700, ls: 1.6 }) + '<rect x="' + x + '" y="' + r1(y + 6) + '" width="' + w + '" height="1.4" fill="' + RULE + '"/>');
      y += titleH - 6;
      legend.forEach(function (l) { out.push('<g transform="translate(' + x + " " + r1(y - 9) + ')">' + l.sym + "</g>" + T(x + 54, y, l.text, { size: size })); y += rowH; });
    }
    return out.join("");
  }
  function legendFor(used) {
    var L = [];
    L.push({ sym: '<line x1="0" y1="5" x2="40" y2="5" stroke="' + INK + '" stroke-width="2.6" stroke-dasharray="14 4 3 4"/>', text: "Property line (county GIS outline, not a survey)" });
    if (used.envelope) L.push({ sym: '<rect x="0" y="-1" width="40" height="12" fill="' + GREEN_FILL + '" stroke="' + GREEN + '" stroke-width="1.2" stroke-dasharray="5 3"/>', text: "Setback line / buildable area" });
    L.push({ sym: '<rect x="0" y="-1" width="40" height="12" fill="#ffffff" stroke="' + INK + '" stroke-width="2"/>', text: "(E) existing building (mapped roof outline)" });
    if (used.option) L.push({ sym: '<rect x="0" y="-1" width="40" height="12" fill="#ffffff" stroke="' + INK + '" stroke-width="2"/><path d="M4 11L16 -1M14 11L26 -1M24 11L36 -1" stroke="' + INK + '" stroke-width="0.9"/>', text: "(N) concept footprint, not a design" });
    if (used.contours) L.push({ sym: '<line x1="0" y1="5" x2="40" y2="5" stroke="' + TAN + '" stroke-width="1.2" stroke-dasharray="5 4"/>', text: used.contourText });
    if (used.neighbors) L.push({ sym: '<rect x="0" y="-1" width="40" height="12" fill="' + GREY + '" stroke="#b9bcb6" stroke-width="1"/>', text: "Neighboring parcel / building" });
    if (used.paving) L.push({ sym: '<rect x="0" y="-1" width="40" height="12" fill="#e2e0d9" stroke="#bdbbb2" stroke-width="0.8"/>', text: "Mapped driveway / paving (approx.)" });
    if (used.hazards) L.push({ sym: '<rect x="0" y="-1" width="40" height="12" fill="' + HAZ + '" fill-opacity="0.08" stroke="' + HAZ + '" stroke-width="1" stroke-dasharray="4 3"/>', text: "Mapped critical area (see the facts sheet)" });
    if (used.trees) L.push({ sym: '<circle cx="20" cy="5" r="6" fill="none" stroke="' + GREEN + '" stroke-width="1" stroke-dasharray="3 2"/>', text: "Mapped tree (OpenStreetMap; crown not to scale)" });
    L.push({ sym: '<text x="0" y="9" font-size="12" fill="' + ORANGE + '">abc</text>', text: "Orange = not in public data, or verify" });
    return L;
  }
  /* The whole sheet. o: { F, opt, placed, tables, sheet, title, kicker } */
  function svg(M, o) {
    o = o || {};
    var F = o.F || {}, brand = F.brand || {}, opt = o.opt || null, P = o.placed || null, tb = o.tables || tables(M, opt, P, F), out = [];
    var plan = M && M.ok ? planMarkup(M, { opt: opt, placed: P, imagery: M.imagery, place: F.place }) : null;
    var used = plan ? plan.used : {};
    if (plan && M.contours) used.contourText = M.contours.interval + " ft contour, USGS 3DEP lidar (approx.)";
    var envText = M && M.ok && M.env ? (M.env.area > 0 ? "buildable area about " + fmt(Math.round(M.env.area / 10) * 10) + " sf inside the setbacks" : "no area left inside the setbacks as drawn") : "setbacks not all coded, so no envelope is drawn";
    var aria = "Preliminary site plan" + (F.address ? " for " + F.address : "") + ". " + (M && M.ok ? "Lot " + (F.lot && isNum(F.lot.sf) ? fmt(F.lot.sf) + " sf" : "area not on record") + ", " + envText + "." : (M && M.why) || "") + (opt ? " Option shown: " + (opt.title || opt.kind) + (P && !P.ok ? ", not drawn: " + P.why : "") + "." : "") + " The same figures are in the tables that follow.";
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + SHEET_W + " " + SHEET_H + '" class="bh-sheet-svg" role="img" aria-label="' + esc(aria) + '" font-family="' + esc(FONT) + '">');
    out.push('<rect x="0" y="0" width="' + SHEET_W + '" height="' + SHEET_H + '" fill="#ffffff"/>');
    /* header */
    // The line under the title names the concept only when it is on the drawing. A concept that could not be
    // placed still has its figures in the tables, and the line says so.
    var optName = opt ? String(opt.title || opt.kind).toUpperCase() : "";
    var kicker = o.kicker || ("EXISTING CONDITIONS" + (opt ? (P && P.ok ? " + " + optName + " CONCEPT" : " · " + optName + " FIGURES ONLY, NOT DRAWN") : ""));
    var sub = [kicker, String(F.address || "").toUpperCase(), F.parcel ? "PARCEL " + F.parcel : ""].filter(Boolean).join(" · ");
    out.push(T(40, 60, o.title || "PRELIMINARY SITE PLAN", { size: 30, weight: 700, ls: 4 }));
    out.push(T(40, 90, clip(sub, 120), { size: 14.5, fill: MUTE, ls: 1.6, fit: twMin(clip(sub, 120), 14.5, 1.6) > 1400 ? 1400 : 0 }));
    out.push('<rect x="40" y="100" width="' + PLAN.w + '" height="4" fill="' + RULE + '"/>');
    out.push(T(COL.x + COL.w, 60, o.sheet || "SP-1", { size: 30, weight: 700, anchor: "end", ls: 1 }));
    /* plan */
    if (plan) out.push('<svg x="' + PLAN.x + '" y="' + PLAN.y + '" width="' + PLAN.w + '" height="' + PLAN.h + '" viewBox="0 0 ' + PLAN.w + " " + PLAN.h + '">' + plan.svg + "</svg>");
    else out.push('<rect x="' + PLAN.x + '" y="' + PLAN.y + '" width="' + PLAN.w + '" height="' + PLAN.h + '" fill="' + PAPER + '" stroke="#d8d7cf"/>' +
      T(PLAN.x + PLAN.w / 2, PLAN.y + PLAN.h / 2 - 12, clip((M && M.why) || "No parcel outline was found, so the site plan is not drawn.", 110), { size: 17, fill: ORANGE, anchor: "middle" }) +
      T(PLAN.x + PLAN.w / 2, PLAN.y + PLAN.h / 2 + 16, "The tables on the right hold what public records do show." + (brand.phone ? " " + (brand.name || "We") + " can confirm the lot on site: " + brand.phone + "." : ""), { size: 13.5, fill: MUTE, anchor: "middle" }));
    /* tables and legend */
    out.push(drawTables(tb, legendFor(used)));
    /* title block */
    var ty = TB.y, name = String(brand.name || "").toUpperCase();
    out.push('<rect x="' + TB.x + '" y="' + ty + '" width="' + TB.w + '" height="' + TB.h + '" fill="none" stroke="' + INK + '" stroke-width="1.4"/><line x1="' + (TB.x + 250) + '" y1="' + ty + '" x2="' + (TB.x + 250) + '" y2="' + (ty + TB.h) + '" stroke="' + INK + '" stroke-width="1"/><line x1="' + (TB.x + 1120) + '" y1="' + ty + '" x2="' + (TB.x + 1120) + '" y2="' + (ty + TB.h) + '" stroke="' + INK + '" stroke-width="1"/>');
    if (brand.logoUrl) out.push('<image href="' + esc(brand.logoUrl) + '" x="' + (TB.x + 16) + '" y="' + (ty + 14) + '" width="218" height="' + (TB.h - 28) + '" preserveAspectRatio="xMidYMid meet"/>');
    else {
      var words = name.split(/\s+/).filter(Boolean), first = words[0] || "", rest = words.slice(1).join(" ");
      out.push(T(TB.x + 125, ty + (rest ? 70 : 84), first, { size: first.length > 9 ? 26 : 36, weight: 600, anchor: "middle", ls: 6 }) + (rest ? T(TB.x + 125, ty + 100, rest, { size: 12.5, anchor: "middle", ls: 4, fill: MUTE }) : ""));
    }
    var bx = TB.x + 270, line2 = [brand.phone, brand.email, brand.site].filter(Boolean).join("  ·  "), line3 = [brand.services, brand.license ? "WA contractor reg. " + brand.license : ""].filter(Boolean).join("  ·  ");
    out.push(T(bx, ty + 34, clip(name + (brand.tagline ? "  ·  " + String(brand.tagline).toUpperCase() : ""), 70), { size: 15.5, weight: 700, ls: 2.4 }));
    if (line2) out.push(T(bx, ty + 60, clip(line2, 86), { size: 15, ls: 1 }));
    if (line3) out.push(T(bx, ty + 84, clip(line3, 118), { size: 11.5, fill: MUTE, fit: twMin(clip(line3, 118), 11.5) > 830 ? 830 : 0 }));
    var disc1 = "Planning estimate from public records" + (F.sourceLine ? " (" + F.sourceLine + ")" : "") + ".";
    var disc2 = "Not a survey or a permit drawing. Verify with " + (F.place || "the jurisdiction") + ".";
    out.push(T(bx, ty + 108, clip(disc1, 130), { size: 11, fill: ORANGE, fit: twMin(clip(disc1, 130), 11) > 830 ? 830 : 0 }) + T(bx, ty + 124, clip(disc2, 130), { size: 11, fill: ORANGE }));
    var px = TB.x + 1140, addr = String(F.address || "").toUpperCase();
    out.push(T(px, ty + 26, "PROJECT", { size: 10.5, fill: MUTE, ls: 1.2 }) + T(px, ty + 46, clip(addr, 48), { size: 14, weight: 700, fit: twMin(clip(addr, 48), 14) > 410 ? 410 : 0 }) +
      T(px, ty + 70, "PREPARED", { size: 10.5, fill: MUTE, ls: 1.2 }) + T(px, ty + 89, clip((F.preparedText || F.prepared || "") + " · auto-generated study", 56), { size: 13 }) +
      T(px, ty + 126, "SHEET", { size: 10.5, fill: MUTE, ls: 1.2 }) + T(px + 56, ty + 128, o.sheet || "SP-1", { size: 24, weight: 700 }) +
      T(px + 150, ty + 126, clip([String(F.placeShort || "").toUpperCase(), F.stateAbbr || "", "SITE PLAN"].filter(Boolean).join(" | "), 34), { size: 11.5, ls: 2, fill: MUTE }));
    out.push("</svg>");
    return out.join("");
  }
  /* A small picture of the lot and one option, for the option cards. No text: the card carries the words. */
  function thumb(M, P) {
    var G = GEO();
    if (!M || !M.ok) return "";
    var W = 220, H = 150, b = M.bbox, pad = 10, k = Math.min((W - 2 * pad) / ((b[2] - b[0]) || 1), (H - 2 * pad) / ((b[3] - b[1]) || 1)), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    var X = function (x) { return W / 2 + (x - cx) * k; }, Y = function (y) { return H / 2 - (y - cy) * k; };
    var pathOf = function (rings) { return rings.map(function (r) { return r.map(function (p, i) { return (i ? "L" : "M") + r1(X(p[0])) + " " + r1(Y(p[1])); }).join("") + "Z"; }).join(""); };
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" class="bh-thumb" aria-hidden="true" focusable="false"><rect width="' + W + '" height="' + H + '" fill="' + PAPER + '"/>' +
      '<path d="' + pathOf(M.lot) + '" fill="#fffefb" fill-rule="evenodd" stroke="' + INK + '" stroke-width="1.6" stroke-dasharray="9 3 2 3"/>';
    if (M.env && M.env.rings.length) s += '<path d="' + pathOf(M.env.rings) + '" fill="' + GREEN_FILL + '" fill-opacity="0.7" fill-rule="evenodd" stroke="' + GREEN + '" stroke-width="0.9" stroke-dasharray="4 3"/>';
    var gone = P && P.ok && P.kind === "teardown";
    M.buildings.forEach(function (bd) { s += '<path d="' + pathOf(bd.rings || [bd.ring]) + '" fill="#ffffff" fill-rule="evenodd" stroke="' + INK + '" stroke-width="' + (gone ? 0.8 : 1.5) + '"' + (gone ? ' stroke-dasharray="3 3"' : "") + "/>"; });
    if (P && P.ok && P.rings) {
      var hl = G.hatch(P.rings, 4.5 / k, 45);
      s += '<path d="' + hl.slice(0, 300).map(function (q) { return "M" + r1(X(q[0])) + " " + r1(Y(q[1])) + "L" + r1(X(q[2])) + " " + r1(Y(q[3])); }).join("") + '" fill="none" stroke="' + INK + '" stroke-width="0.7"/><path d="' + pathOf(P.rings) + '" fill="none" stroke="' + INK + '" stroke-width="1.8"/>';
    }
    return s + "</svg>";
  }
  /* One sheet as a report page: the drawing, then the same tables as HTML for small screens and screen readers. */
  function sheet(M, o) {
    o = o || {};
    var P = o.opt ? (o.placed ? o.placed : place(M, o.opt)) : null, tb = tables(M, o.opt || null, P, o.F || {});
    return {
      placed: P, tables: tb,
      html: '<section class="bh-page bh-sheet" data-sheet="' + esc(o.sheet || "SP-1") + '">' + svg(M, { F: o.F, opt: o.opt, placed: P, tables: tb, sheet: o.sheet, title: o.title, kicker: o.kicker }) +
        '<div class="bh-screen-only bh-sheet-twin"><h3>' + esc((o.sheet || "SP-1") + " figures as text") + "</h3>" + (P && !P.ok && o.opt ? '<p class="bh-verify">' + esc((o.opt.title || "This option") + " is not drawn: " + P.why) + "</p>" : "") + (P && P.ok && P.note ? '<p class="bh-muted">' + esc(P.note) + "</p>" : "") + tablesHtml(tb) + "</div></section>"
    };
  }

  var api = {
    SHEET: { w: SHEET_W, h: SHEET_H, printWidthIn: PRINT_W_IN }, MISSING: MISSING,
    streetCore: streetCore, setbackFor: setbackFor, classifyEdges: classifyEdges, lotLines: lotLines, model: model, place: place,
    tables: tables, tablesHtml: tablesHtml, svg: svg, thumb: thumb, sheet: sheet, optLabel: optLabel, _contourSet: contourSet
  };
  root.BuildHereSitePlan = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
