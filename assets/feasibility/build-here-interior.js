/* Conceptual interior layout for the feasibility study.
   Rooms are a deterministic partition of the mapped footprint. Every dimension is approximate.
   Nothing here is a measured room, a permit drawing, or an existing-condition number. */
(function (root) {
  "use strict";
  var NOTE = "Conceptual / Optimized Interior Layout — verify on site";

  function shoelace(ring) {
    var a = 0, n = ring.length;
    for (var i = 0, j = n - 1; i < n; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    return a / 2;
  }
  function bbox(ring) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ring.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function inside(x, y, ring) {
    var n = ring.length, c = false;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var yi = ring[i][1], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (ring[j][0] - ring[i][0]) * (y - yi) / ((yj - yi) || 1e-9) + ring[i][0]) c = !c;
    }
    return c;
  }
  /* Largest occupied rectangle on a coarse grid, then one more in what is left. */
  function decompose(ring) {
    var b = bbox(ring), w = b.x1 - b.x0, d = b.y1 - b.y0;
    if (!(w > 6) || !(d > 6)) return [];
    if (Math.abs(shoelace(ring)) >= w * d * 0.82) return [{ x: b.x0, y: b.y0, w: w, d: d }];
    var step = 2, cols = Math.max(2, Math.round(w / step)), rows = Math.max(2, Math.round(d / step));
    var occ = new Array(cols * rows);
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
      occ[j * cols + i] = inside(b.x0 + (i + 0.5) * (w / cols), b.y0 + (j + 0.5) * (d / rows), ring) ? 1 : 0;
    }
    function largest(grid) {
      var height = new Array(cols).fill(0), best = null;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) height[c] = grid[r * cols + c] ? height[c] + 1 : 0;
        var stack = [], h = height.concat([0]);
        for (var i2 = 0; i2 < h.length; i2++) {
          var last = i2;
          while (stack.length && h[stack[stack.length - 1]] > h[i2]) {
            var top = stack.pop();
            var left = stack.length ? stack[stack.length - 1] + 1 : 0;
            var area = h[top] * (i2 - left);
            if (!best || area > best.area) best = { area: area, c0: left, c1: i2, r1: r + 1, rh: h[top] };
          }
          stack.push(i2);
        }
      }
      if (!best || best.area < 4) return null;
      return { i0: best.c0, i1: best.c1, j0: best.r1 - best.rh, j1: best.r1 };
    }
    function take(rect) {
      var out = { x: b.x0 + rect.i0 * (w / cols), y: b.y0 + rect.j0 * (d / rows), w: (rect.i1 - rect.i0) * (w / cols), d: (rect.j1 - rect.j0) * (d / rows) };
      for (var j = rect.j0; j < rect.j1; j++) for (var i = rect.i0; i < rect.i1; i++) occ[j * cols + i] = 0;
      return out;
    }
    var first = largest(occ);
    if (!first) return [{ x: b.x0, y: b.y0, w: w, d: d }];
    var rects = [take(first)];
    var second = largest(occ);
    if (second && second.i1 - second.i0 >= 3 && second.j1 - second.j0 >= 3) rects.push(take(second));
    return rects.filter(function (r) { return r.w >= 8 && r.d >= 8; });
  }

  function room(name, purpose, x, y, w, d, extra) {
    var o = { name: name, purpose: purpose, x: x, y: y, w: Math.abs(w), d: Math.abs(d), conceptual: true };
    if (w < 0) o.x = x + w;
    if (d < 0) o.y = y + d;
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  /* Split one axis-aligned rectangle into conceptual rooms. Street is the side the front normal points toward. */
  function roomsFor(rect, front, levelName, upper) {
    var nx = front && typeof front.nx === "number" ? front.nx : 0;
    var ny = front && typeof front.ny === "number" ? front.ny : -1;
    var alongX = Math.abs(nx) > Math.abs(ny);
    var streetHigh = alongX ? nx > 0 : ny > 0;
    var depth = alongX ? rect.w : rect.d;
    var width = alongX ? rect.d : rect.w;
    var x0 = rect.x, y0 = rect.y;
    function box(u0, u1, v0, v1) {
      var du = u1 - u0, dv = v1 - v0;
      if (alongX) {
        var x = streetHigh ? x0 + rect.w - u1 : x0 + u0;
        return { x: x, y: y0 + v0, w: du, d: dv };
      }
      var y = streetHigh ? y0 + rect.d - u1 : y0 + u0;
      return { x: x0 + v0, y: y, w: dv, d: du };
    }
    var rooms = [];
    var stairW = upper || depth > 22 ? 3.5 : 0;
    var frontDepth = Math.max(12, Math.min(depth * 0.46, depth - 14));
    if (upper) frontDepth = Math.max(10, depth * 0.42);
    var live = box(0, frontDepth, 0, width);
    if (!upper) {
      var third = width / 3;
      var a = box(0, frontDepth, 0, third);
      var b = box(0, frontDepth, third, third * 2);
      var c = box(0, frontDepth, third * 2, width);
      rooms.push(room("Living", "Conceptual living area along the street side.", a.x, a.y, a.w, a.d));
      rooms.push(room("Dining", "Conceptual dining, approximate.", b.x, b.y, b.w, b.d));
      rooms.push(room("Kitchen", "Conceptual kitchen, approximate. Verify clearances.", c.x, c.y, c.w, c.d));
    } else {
      rooms.push(room("Hall", "Conceptual upper hall.", live.x, live.y, live.w, live.d));
    }
    var back0 = frontDepth;
    var back1 = depth;
    var stair = null;
    if (stairW && depth - frontDepth > 8 && width > 12) {
      stair = box(back0, Math.min(back0 + 11, back1), 0, Math.min(stairW + 0.5, width * 0.22));
      rooms.push(room("Stairs", upper ? "Conceptual stair, up. Aligns with the level below." : "Conceptual stair to the upper level.", stair.x, stair.y, stair.w, stair.d, { stairs: true }));
    }
    var side0 = stair ? Math.min(stairW + 0.5, width * 0.22) : 0;
    var remainW = width - side0;
    var remainD = back1 - back0;
    if (remainW < 7 || remainD < 7) return rooms;
    if (!upper && remainW >= 16) {
      var suiteW = Math.min(remainW * 0.62, remainW - 7);
      var suite = box(back0, back1, side0, side0 + suiteW);
      var bath = box(back0, Math.min(back0 + 8, back1), side0 + suiteW, width);
      rooms.push(room("Primary suite", "Conceptual primary bedroom. Not a measured room.", suite.x, suite.y, suite.w, suite.d));
      rooms.push(room("Bath", "Conceptual bath, about 5 ft by 8 ft where the footprint allows.", bath.x, bath.y, bath.w, bath.d));
    } else {
      var nBed = Math.max(1, Math.min(3, Math.floor((remainW * remainD) / 110)));
      var slice = remainW / (nBed + 0.35);
      for (var i = 0; i < nBed; i++) {
        var r = box(back0, back1, side0 + i * slice, side0 + (i + 1) * slice);
        rooms.push(room(upper ? "Bedroom" : (i === 0 ? "Bedroom" : "Bedroom " + (i + 1)), "Conceptual bedroom. IRC minimums are a guide only; verify on site.", r.x, r.y, r.w, r.d));
      }
      var bath2 = box(back0, Math.min(back0 + 8, back1), side0 + nBed * slice, width);
      if (bath2.w > 4 && bath2.d > 4 || bath2.d > 4 && bath2.w > 4) rooms.push(room("Bath", "Conceptual bath.", bath2.x, bath2.y, bath2.w, bath2.d));
    }
    return rooms.filter(function (r) { return r.w >= 3 && r.d >= 3; });
  }

  function plan(ring, opts) {
    opts = opts || {};
    var stories = opts.stories && opts.stories >= 2 ? Math.round(opts.stories) : (opts.showUpper ? 2 : 1);
    var front = opts.front || { nx: 0, ny: -1 };
    var rects = ring && ring.length >= 3 ? decompose(ring) : [];
    var levels = [];
    function collect(name) {
      var rooms = [];
      rects.forEach(function (rect) { rooms = rooms.concat(roomsFor(rect, front, name, name !== "Main")); });
      return rooms;
    }
    if (rects.length) levels.push({ name: "Main", rooms: collect("Main") });
    if (stories >= 2 && rects.length) levels.push({ name: "Upper", rooms: collect("Upper") });
    (opts.garageRings || []).forEach(function (g) {
      if (!g || g.length < 3) return;
      var b = bbox(g);
      if (!levels.length) levels.push({ name: "Main", rooms: [] });
      levels[0].rooms.push(room("Garage", "Mapped garage outline, shown as a conceptual garage. Not a measured interior.", b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, { garage: true }));
    });
    if (opts.addition && opts.addition.ring && opts.addition.ring.length >= 3) {
      var ab = bbox(opts.addition.ring);
      if (!levels.length) levels.push({ name: "Main", rooms: [] });
      levels[0].rooms.push(room("Addition", "Conceptual addition footprint from the option that fits. Not an existing room.", ab.x0, ab.y0, ab.x1 - ab.x0, ab.y1 - ab.y0, { addition: true }));
    }
    var area = 0;
    levels.forEach(function (lv) { lv.rooms.forEach(function (r) { if (!r.stairs) area += r.w * r.d; }); });
    return { levels: levels, stories: stories, note: NOTE, areaSqft: Math.round(area), conceptual: true };
  }

  function feetLabel(ft) {
    var n = Math.max(0, Math.round(ft * 2) / 2);
    var whole = Math.floor(n), inch = Math.round((n - whole) * 12);
    if (inch === 12) { whole += 1; inch = 0; }
    return whole + "'-" + inch + '"';
  }

  function svgLevel(level, bounds) {
    var pad = 28, W = 460, H = 300;
    var bw = Math.max(1, bounds.x1 - bounds.x0), bd = Math.max(1, bounds.y1 - bounds.y0);
    var sc = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bd);
    var X = function (x) { return pad + (x - bounds.x0) * sc; };
    var Y = function (y) { return H - pad - (y - bounds.y0) * sc; };
    var body = level.rooms.map(function (r) {
      var x = X(r.x), y = Y(r.y + r.d), w = r.w * sc, h = r.d * sc;
      var hatch = r.addition ? '<path d="M' + x.toFixed(1) + " " + (y + h).toFixed(1) + "l" + Math.min(w, h).toFixed(1) + " " + (-Math.min(w, h)).toFixed(1) + '" stroke="#888" stroke-width="0.6"/>' : "";
      var label = r.name + (r.stairs ? "" : "  ≈ " + feetLabel(r.w) + " × " + feetLabel(r.d));
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + (r.addition ? "#f4f4f4" : "#fff") + '" stroke="#111" stroke-width="' + (r.garage ? "1.2" : "1.6") + '"/>' + hatch +
        '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2).toFixed(1) + '" text-anchor="middle" fill="#111" font-size="9" font-family="Helvetica,Arial,sans-serif">' + label.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text>";
    }).join("");
    return '<figure class="bh-floor"><figcaption>' + level.name.toUpperCase() + ' LEVEL</figcaption><svg viewBox="0 0 ' + W + " " + H + '" class="bh-floor-svg" role="img" aria-label="' + level.name + ' level conceptual plan">' + body + "</svg></figure>";
  }

  function svg(layout) {
    if (!layout || !layout.levels || !layout.levels.length) return '<p class="bh-muted">No mapped house outline was available, so no conceptual floor plan is drawn.</p>';
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    layout.levels.forEach(function (lv) { lv.rooms.forEach(function (r) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.d); }); });
    var bounds = { x0: x0, y0: y0, x1: x1, y1: y1 };
    var figs = layout.levels.map(function (lv) { return svgLevel(lv, bounds); }).join("");
    var rows = "";
    layout.levels.forEach(function (lv) {
      var a = 0;
      lv.rooms.forEach(function (r) { if (!r.stairs) a += r.w * r.d; });
      rows += "<tr><th scope=\"row\">" + lv.name + " (conceptual)</th><td>approx. " + Math.round(a).toLocaleString("en-US") + " sf</td></tr>";
    });
    return '<div class="bh-floors">' + figs + '</div><p class="bh-verify"><strong>CONCEPTUAL — VERIFY ON SITE.</strong> ' + layout.note + " Room sizes are a partition of the mapped footprint, not a survey of existing rooms.</p>" +
      '<h3>Area data</h3><table class="bh-table"><tbody>' + rows + "</tbody></table>";
  }

  var api = { plan: plan, svg: svg, NOTE: NOTE, feetLabel: feetLabel };
  root.BuildHereInterior = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
