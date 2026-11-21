/* Shared geometry for the Build Here study. One projection for every drawing and
   measurement, plus the ring, raster and contour helpers the site plan needs.
   No DOM and no network. Runs in the browser (window.BuildHereGeom) and in Node. */
(function (root) {
  "use strict";
  var K = Math.PI / 180;
  var A_FT = 6378137 / 0.3048;   // WGS84 semi-major axis in feet
  var E2 = 0.00669437999014;     // WGS84 first eccentricity squared

  /* Local planar frame in feet around one point. East-west uses the prime-vertical radius and
     north-south the meridional radius, so a lot line is not short by 0.18% one way and long by
     0.12% the other, as it was on a sphere of the equatorial radius. */
  function frame(lat0, lon0) {
    var s = Math.sin(lat0 * K), w = 1 - E2 * s * s;
    var kx = K * (A_FT / Math.sqrt(w)) * Math.cos(lat0 * K);
    var ky = K * (A_FT * (1 - E2) / Math.pow(w, 1.5));
    return {
      lat0: lat0, lon0: lon0, kx: kx, ky: ky,
      fwd: function (p) { return [(p[0] - lon0) * kx, (p[1] - lat0) * ky]; },
      inv: function (x, y) { return [lon0 + x / kx, lat0 + y / ky]; }
    };
  }
  function bbox(rings) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    rings.forEach(function (r) { r.forEach(function (p) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }); });
    return b;
  }
  function frameOf(rings) { var b = bbox(rings); return frame((b[1] + b[3]) / 2, (b[0] + b[2]) / 2); }
  function project(rings, fr) { return rings.map(function (r) { return r.map(fr.fwd); }); }
  function hyp(x, y) { return Math.sqrt(x * x + y * y); }

  /* Signed area: counter-clockwise rings are positive. */
  function ringArea(r) {
    var a = 0;
    for (var i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
    return a / 2;
  }
  function area(rings) { var t = 0; rings.forEach(function (r) { t += ringArea(r); }); return Math.abs(t); }
  function closeRing(r) {
    var o = r.slice();
    if (o.length && (o[0][0] !== o[o.length - 1][0] || o[0][1] !== o[o.length - 1][1])) o.push(o[0]);
    return o;
  }
  function inRing(x, y, ring) {
    var c = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i], b = ring[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  /* Even-odd over all rings, so holes work. */
  function inRings(x, y, rings) { var c = false; for (var k = 0; k < rings.length; k++) if (inRing(x, y, rings[k])) c = !c; return c; }
  function segDist(px, py, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? ((px - a[0]) * dx + (py - a[1]) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return hyp(a[0] + t * dx - px, a[1] + t * dy - py);
  }
  function distToRing(x, y, ring) {
    var best = Infinity;
    for (var i = 0; i < ring.length - 1; i++) { var d = segDist(x, y, ring[i], ring[i + 1]); if (d < best) best = d; }
    return best;
  }
  function distToRings(x, y, rings) { var best = Infinity; rings.forEach(function (r) { var d = distToRing(x, y, r); if (d < best) best = d; }); return best; }
  function centroid(ring) {
    var a = 0, cx = 0, cy = 0;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (Math.abs(a) < 1e-9) { var b = bbox([ring]); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }
    return [cx / (3 * a), cy / (3 * a)];
  }
  function lineLength(line) { var t = 0; for (var i = 1; i < line.length; i++) t += hyp(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); return t; }
  /* The point a fraction t (0 to 1) along a polyline, with the direction of the segment it sits on. */
  function pointAlong(line, t) {
    var total = lineLength(line), want = total * t, run = 0;
    for (var i = 1; i < line.length; i++) {
      var dx = line[i][0] - line[i - 1][0], dy = line[i][1] - line[i - 1][1], L = hyp(dx, dy);
      if (run + L >= want && L > 0) { var f = (want - run) / L; return { x: line[i - 1][0] + dx * f, y: line[i - 1][1] + dy * f, dx: dx / L, dy: dy / L }; }
      run += L;
    }
    var n = line.length;
    return n ? { x: line[n - 1][0], y: line[n - 1][1], dx: 1, dy: 0 } : null;
  }

  /* ---------- simplification ---------- */
  function dp(pts, tol) {
    var n = pts.length, i;
    if (n < 3) return pts.slice();
    var keep = new Array(n), stack = [[0, n - 1]];
    keep[0] = keep[n - 1] = true;
    while (stack.length) {
      var seg = stack.pop(), a = seg[0], b = seg[1], best = -1, bd = tol;
      for (i = a + 1; i < b; i++) { var d = segDist(pts[i][0], pts[i][1], pts[a], pts[b]); if (d > bd) { bd = d; best = i; } }
      if (best > 0) { keep[best] = true; stack.push([a, best]); stack.push([best, b]); }
    }
    var out = [];
    for (i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }
  /* Douglas-Peucker. A closed ring is split at the vertex farthest from its first, so the first is not special. */
  function simplify(pts, tol, closed) {
    if (!closed) return dp(pts, tol);
    var r = pts.slice();
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
    if (r.length < 4) return closeRing(r);
    var k = 0, far = -1;
    for (var i = 1; i < r.length; i++) { var d = hyp(r[i][0] - r[0][0], r[i][1] - r[0][1]); if (d > far) { far = d; k = i; } }
    var a = dp(r.slice(0, k + 1), tol), b = dp(r.slice(k).concat([r[0]]), tol);
    return a.concat(b.slice(1));
  }
  /* County lot lines carry a vertex wherever a neighbor's line meets them. Consecutive edges of one
     kind that run the same way (within degTol of the first edge of the run) become one edge, so a lot
     side gets one length and one setback label. edges: [{a, b, kind, nx, ny, ...}] in ring order. */
  function mergeCollinear(edges, degTol) {
    var n = edges.length, cosTol = Math.cos((degTol == null ? 3 : degTol) * K);
    if (!n) return [];
    function dir(e) { var dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], L = hyp(dx, dy) || 1; return [dx / L, dy / L]; }
    function same(e1, e2) {
      if (e1.kind !== e2.kind || !!e1.alley !== !!e2.alley) return false;
      var d1 = dir(e1), d2 = dir(e2);
      return d1[0] * d2[0] + d1[1] * d2[1] >= cosTol;
    }
    var start = 0, i;
    for (i = 0; i < n; i++) if (!same(edges[(i + n - 1) % n], edges[i])) { start = i; break; }
    var out = [], run = null;
    for (i = 0; i < n; i++) {
      var e = edges[(start + i) % n];
      if (run && same(run.first, e)) { run.parts.push(e); continue; }
      run = { first: e, parts: [e] };
      out.push(run);
    }
    return out.map(function (g) {
      var a = g.first.a, b = g.parts[g.parts.length - 1].b, nx = 0, ny = 0, path = 0, o = {};
      for (var k in g.first) if (Object.prototype.hasOwnProperty.call(g.first, k)) o[k] = g.first[k];
      g.parts.forEach(function (p) { var L = hyp(p.b[0] - p.a[0], p.b[1] - p.a[1]); path += L; nx += (p.nx || 0) * L; ny += (p.ny || 0) * L; });
      var nl = hyp(nx, ny) || 1;
      o.a = a; o.b = b; o.len = hyp(b[0] - a[0], b[1] - a[1]); o.path = path; o.nx = nx / nl; o.ny = ny / nl;
      o.mx = (a[0] + b[0]) / 2; o.my = (a[1] + b[1]) / 2; o.count = g.parts.length; o.curved = path > o.len * 1.01;
      return o;
    });
  }

  /* ---------- raster envelope ---------- */
  /* Every point of the ring that is at least dist(edge) from each edge, sampled on a square grid.
     The mask is what the area is counted from and what the outline is traced from. */
  function envelopeMask(ring, edges, dist, cell) {
    var b = bbox([ring]);
    cell = cell || Math.max(0.5, Math.sqrt((b[2] - b[0]) * (b[3] - b[1]) / 120000));
    var nx = Math.max(1, Math.ceil((b[2] - b[0]) / cell)), ny = Math.max(1, Math.ceil((b[3] - b[1]) / cell));
    var mask = new Array(nx * ny), count = 0, d = edges.map(dist), rows = [];
    for (var j = 0; j < ny; j++) {
      var y = b[1] + (j + 0.5) * cell, run = -1;
      for (var i = 0; i <= nx; i++) {
        var ok = false;
        if (i < nx) {
          var x = b[0] + (i + 0.5) * cell;
          ok = inRing(x, y, ring);
          for (var k = 0; ok && k < edges.length; k++) if (segDist(x, y, edges[k].a, edges[k].b) < d[k]) ok = false;
          mask[j * nx + i] = ok ? 1 : 0;
        }
        if (ok) { count++; if (run < 0) run = i; }
        else if (run >= 0) { rows.push([b[0] + run * cell, b[1] + j * cell, (i - run) * cell, cell]); run = -1; }
      }
    }
    return { mask: mask, nx: nx, ny: ny, x0: b[0], y0: b[1], cell: cell, count: count, area: count * cell * cell, rows: rows };
  }
  function maskAt(m, x, y) {
    var i = Math.floor((x - m.x0) / m.cell), j = Math.floor((y - m.y0) / m.cell);
    return i >= 0 && j >= 0 && i < m.nx && j < m.ny && !!m.mask[j * m.nx + i];
  }
  /* Outline of the true cells of a mask as closed rings: outer rings counter-clockwise, holes clockwise.
     Cells that touch only at a corner stay separate. The staircase of a slanted side is straightened. */
  function traceMask(m, tol) {
    var nx = m.nx, ny = m.ny, mask = m.mask, W = nx + 1, starts = {}, edges = [], i, j;
    function at(a, b) { return a >= 0 && b >= 0 && a < nx && b < ny && mask[b * nx + a] ? 1 : 0; }
    function add(ax, ay, bx, by) { var k = ay * W + ax; (starts[k] = starts[k] || []).push(edges.length); edges.push([ax, ay, bx, by, false]); }
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      if (!at(i, j)) continue;
      if (!at(i, j - 1)) add(i, j, i + 1, j);
      if (!at(i + 1, j)) add(i + 1, j, i + 1, j + 1);
      if (!at(i, j + 1)) add(i + 1, j + 1, i, j + 1);
      if (!at(i - 1, j)) add(i, j + 1, i, j);
    }
    var rings = [];
    for (var e = 0; e < edges.length; e++) {
      if (edges[e][4]) continue;
      var loop = [], cur = e;
      while (cur != null) {
        var ed = edges[cur]; ed[4] = true;
        var dx = ed[2] - ed[0], dy = ed[3] - ed[1], last = loop.length > 1 ? loop[loop.length - 1] : null, prev = loop.length > 1 ? loop[loop.length - 2] : null;
        // Drop the middle vertex of a straight run of grid steps.
        if (last && prev && (last[0] - prev[0]) * dy === (last[1] - prev[1]) * dx && last[0] === ed[0] && last[1] === ed[1]) loop.pop();
        loop.push([ed[0], ed[1]]);
        var list = starts[ed[3] * W + ed[2]] || [], next = null, bestTurn = -Infinity;
        for (var q = 0; q < list.length; q++) {
          var c = edges[list[q]]; if (c[4]) continue;
          var turn = dx * (c[3] - c[1]) - dy * (c[2] - c[0]);
          if (turn > bestTurn) { bestTurn = turn; next = list[q]; }
        }
        cur = next;
      }
      if (loop.length < 4) continue;
      var ring = loop.map(function (p) { return [m.x0 + p[0] * m.cell, m.y0 + p[1] * m.cell]; });
      ring = simplify(closeRing(ring), tol == null ? m.cell * 0.75 : tol, true);
      if (ring.length >= 4) rings.push(ring);
    }
    return rings;
  }

  /* ---------- elevation grid ---------- */
  /* grid: { x0, y0, step, nx, ny, vals } with vals[j * nx + i] in feet, null where there is no sample. */
  function smoothGrid(g) {
    var out = new Array(g.vals.length), wts = [1, 2, 1];
    for (var j = 0; j < g.ny; j++) for (var i = 0; i < g.nx; i++) {
      var c = g.vals[j * g.nx + i];
      if (c == null) { out[j * g.nx + i] = null; continue; }
      var s = 0, w = 0;
      for (var b = -1; b <= 1; b++) for (var a = -1; a <= 1; a++) {
        var ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
        var v = g.vals[jj * g.nx + ii];
        if (v == null) continue;
        var k = wts[a + 1] * wts[b + 1]; s += v * k; w += k;
      }
      out[j * g.nx + i] = s / w;
    }
    return { x0: g.x0, y0: g.y0, step: g.step, nx: g.nx, ny: g.ny, vals: out, res: g.res };
  }
  function gridRange(g) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < g.vals.length; i++) { var v = g.vals[i]; if (v == null) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
    return lo <= hi ? [lo, hi] : null;
  }
  function bilinear(g, x, y) {
    if (!g) return null;
    var fx = (x - g.x0) / g.step, fy = (y - g.y0) / g.step;
    var i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0) i = 0; if (j < 0) j = 0; if (i > g.nx - 2) i = g.nx - 2; if (j > g.ny - 2) j = g.ny - 2;
    if (i < 0 || j < 0) return null;
    var tx = Math.max(0, Math.min(1, fx - i)), ty = Math.max(0, Math.min(1, fy - j));
    var a = g.vals[j * g.nx + i], b = g.vals[j * g.nx + i + 1], c = g.vals[(j + 1) * g.nx + i], d = g.vals[(j + 1) * g.nx + i + 1];
    if (a == null || b == null || c == null || d == null) {
      var near = [a, b, c, d].filter(function (v) { return v != null; });
      return near.length ? near[0] : null;
    }
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }
  /* Join loose segments that share an end point into polylines. */
  function chain(segs) {
    function key(p) { return Math.round(p[0] * 50) + "," + Math.round(p[1] * 50); }
    var ends = {}, used = new Array(segs.length), i, lines = [];
    for (i = 0; i < segs.length; i++) {
      var ka = key(segs[i][0]), kb = key(segs[i][1]);
      (ends[ka] = ends[ka] || []).push(i); (ends[kb] = ends[kb] || []).push(i);
    }
    function extend(line, atEnd) {
      for (;;) {
        var p = atEnd ? line[line.length - 1] : line[0], list = ends[key(p)] || [], found = -1;
        for (var q = 0; q < list.length; q++) if (!used[list[q]]) { found = list[q]; break; }
        if (found < 0) return;
        used[found] = true;
        var s = segs[found], other = key(s[0]) === key(p) ? s[1] : s[0];
        if (atEnd) line.push(other); else line.unshift(other);
      }
    }
    for (i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      var line = [segs[i][0], segs[i][1]];
      extend(line, true); extend(line, false);
      lines.push(line);
    }
    return lines;
  }
  /* Marching squares. A saddle cell is settled by the mean of its four corners. Cells with a missing
     corner are skipped, so a gap in the samples is a gap in the line and never a guessed value. */
  function contours(g, levels) {
    var out = [];
    function lerp(pa, va, pb, vb, L) { var t = vb === va ? 0.5 : (L - va) / (vb - va); return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]; }
    levels.forEach(function (L) {
      var segs = [];
      for (var j = 0; j < g.ny - 1; j++) for (var i = 0; i < g.nx - 1; i++) {
        var bl = g.vals[j * g.nx + i], br = g.vals[j * g.nx + i + 1], tl = g.vals[(j + 1) * g.nx + i], tr = g.vals[(j + 1) * g.nx + i + 1];
        if (bl == null || br == null || tl == null || tr == null) continue;
        var idx = (bl >= L ? 1 : 0) | (br >= L ? 2 : 0) | (tr >= L ? 4 : 0) | (tl >= L ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        var x = g.x0 + i * g.step, y = g.y0 + j * g.step, s = g.step;
        var pbl = [x, y], pbr = [x + s, y], ptl = [x, y + s], ptr = [x + s, y + s];
        var B = function () { return lerp(pbl, bl, pbr, br, L); }, R = function () { return lerp(pbr, br, ptr, tr, L); };
        var T = function () { return lerp(ptl, tl, ptr, tr, L); }, Lf = function () { return lerp(pbl, bl, ptl, tl, L); };
        var mid = (bl + br + tl + tr) / 4 >= L;
        switch (idx) {
          case 1: case 14: segs.push([Lf(), B()]); break;
          case 2: case 13: segs.push([B(), R()]); break;
          case 3: case 12: segs.push([Lf(), R()]); break;
          case 4: case 11: segs.push([R(), T()]); break;
          case 6: case 9: segs.push([B(), T()]); break;
          case 7: case 8: segs.push([Lf(), T()]); break;
          case 5: if (mid) { segs.push([B(), R()]); segs.push([Lf(), T()]); } else { segs.push([Lf(), B()]); segs.push([R(), T()]); } break;
          case 10: if (mid) { segs.push([Lf(), B()]); segs.push([R(), T()]); } else { segs.push([B(), R()]); segs.push([Lf(), T()]); } break;
        }
      }
      if (segs.length) out.push({ level: L, lines: chain(segs) });
    });
    return out;
  }
  /* One pass of corner cutting, which rounds the kinks a coarse grid leaves in a contour. */
  function chaikin(line) {
    if (line.length < 3) return line.slice();
    var closed = line[0][0] === line[line.length - 1][0] && line[0][1] === line[line.length - 1][1], out = [];
    if (!closed) out.push(line[0]);
    for (var i = 0; i < line.length - 1; i++) {
      var a = line[i], b = line[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (closed) out.push(out[0]); else out.push(line[line.length - 1]);
    return out;
  }

  /* ---------- hatching, rectangles, label points ---------- */
  /* Parallel lines clipped to a polygon (even-odd), as plain segments. The drawing uses these in place of
     an SVG pattern: a pattern is referenced by id, and the print copy and the saved file drop ids.
     lim = [x0, y0, x1, y1] keeps the work to what is in view when the polygon is far larger. */
  function hatch(rings, spacing, angleDeg, lim) {
    var a = (angleDeg == null ? 45 : angleDeg) * K, c = Math.cos(a), s = Math.sin(a), out = [];
    var rot = function (p) { return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; };
    var R = rings.map(function (r) { return r.map(rot); });
    var b = bbox(R), lo = b[1], hi = b[3];
    if (lim) {
      var cs = [[lim[0], lim[1]], [lim[2], lim[1]], [lim[2], lim[3]], [lim[0], lim[3]]].map(rot);
      lo = Math.max(lo, Math.min(cs[0][1], cs[1][1], cs[2][1], cs[3][1])); hi = Math.min(hi, Math.max(cs[0][1], cs[1][1], cs[2][1], cs[3][1]));
    }
    var n = 0;
    for (var w = Math.ceil(lo / spacing) * spacing; w <= hi && n < 3000; w += spacing, n++) {
      var xs = [];
      for (var k = 0; k < R.length; k++) {
        var r = R[k];
        for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
          var y1 = r[j][1], y2 = r[i][1];
          if ((y1 > w) !== (y2 > w)) xs.push(r[j][0] + (w - y1) / (y2 - y1) * (r[i][0] - r[j][0]));
        }
      }
      xs.sort(function (p, q) { return p - q; });
      for (var m = 0; m + 1 < xs.length; m += 2) {
        var x1 = xs[m] * c - w * s, yy1 = xs[m] * s + w * c, x2 = xs[m + 1] * c - w * s, yy2 = xs[m + 1] * s + w * c;
        if (lim && ((x1 < lim[0] && x2 < lim[0]) || (x1 > lim[2] && x2 > lim[2]) || (yy1 < lim[1] && yy2 < lim[1]) || (yy1 > lim[3] && yy2 > lim[3]))) continue;
        out.push([x1, yy1, x2, yy2]);
      }
    }
    return out;
  }
  /* Smallest-area rectangle around a ring, by testing each edge direction. w runs along (ux, uy). */
  function minRect(ring) {
    var best = null;
    for (var i = 0; i < ring.length - 1; i++) {
      var dx = ring[i + 1][0] - ring[i][0], dy = ring[i + 1][1] - ring[i][1], L = hyp(dx, dy);
      if (L < 1) continue;
      var ux = dx / L, uy = dy / L, mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
      for (var k = 0; k < ring.length; k++) {
        var u = ring[k][0] * ux + ring[k][1] * uy, v = -ring[k][0] * uy + ring[k][1] * ux;
        if (u < mn[0]) mn[0] = u; if (u > mx[0]) mx[0] = u; if (v < mn[1]) mn[1] = v; if (v > mx[1]) mx[1] = v;
      }
      var ar = (mx[0] - mn[0]) * (mx[1] - mn[1]);
      if (!best || ar < best.area) best = { area: ar, ux: ux, uy: uy, mn: mn, mx: mx };
    }
    if (!best) return null;
    var cu = (best.mn[0] + best.mx[0]) / 2, cv = (best.mn[1] + best.mx[1]) / 2;
    best.w = best.mx[0] - best.mn[0]; best.d = best.mx[1] - best.mn[1];
    best.cx = cu * best.ux - cv * best.uy; best.cy = cu * best.uy + cv * best.ux;
    return best;
  }
  /* A rectangle of w by d centered on (cx, cy), with w along the unit vector (ux, uy). Closed ring. */
  function rectRing(cx, cy, w, d, ux, uy) {
    var vx = -uy, vy = ux, hw = w / 2, hd = d / 2;
    var p = function (a, b) { return [cx + a * ux + b * vx, cy + a * uy + b * vy]; };
    return [p(-hw, -hd), p(hw, -hd), p(hw, hd), p(-hw, hd), p(-hw, -hd)];
  }
  /* The inside point farthest from the outline. A centroid can fall outside an L-shaped house. */
  function labelPoint(rings, n) {
    if (rings.length && typeof rings[0][0] === "number") rings = [rings];
    var b = bbox(rings), best = null;
    n = n || 22;
    var sx = (b[2] - b[0]) / n, sy = (b[3] - b[1]) / n;
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
      var x = b[0] + (i + 0.5) * sx, y = b[1] + (j + 0.5) * sy;
      if (!inRings(x, y, rings)) continue;
      var d = distToRings(x, y, rings);
      if (!best || d > best.r) best = { x: x, y: y, r: d };
    }
    return best || { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, r: 0 };
  }
  /* 16.42 ft as 16'-5". */
  function feetInches(ft) {
    var whole = Math.floor(ft), inch = Math.round((ft - whole) * 12);
    if (inch === 12) { whole++; inch = 0; }
    return whole + "'-" + inch + "\"";
  }

  var api = {
    frame: frame, frameOf: frameOf, project: project, bbox: bbox, ringArea: ringArea, area: area, closeRing: closeRing,
    inRing: inRing, inRings: inRings, segDist: segDist, distToRing: distToRing, distToRings: distToRings, centroid: centroid,
    lineLength: lineLength, pointAlong: pointAlong, simplify: simplify, mergeCollinear: mergeCollinear,
    envelopeMask: envelopeMask, maskAt: maskAt, traceMask: traceMask, smoothGrid: smoothGrid, gridRange: gridRange,
    bilinear: bilinear, chain: chain, contours: contours, chaikin: chaikin, hatch: hatch, minRect: minRect, rectRing: rectRing,
    labelPoint: labelPoint, feetInches: feetInches
  };
  root.BuildHereGeom = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
