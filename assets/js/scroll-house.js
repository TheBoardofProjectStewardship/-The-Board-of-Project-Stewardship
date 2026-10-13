/**
 * Original scroll-built Pacific Northwest house for the Board homepage.
 *
 * casa-serra (github.com/Sam1983Aing/casa-serra) ships with no license file.
 * None of its code, rooms, or assets are copied. This file draws its own
 * plan, walls, roof, and second story on a canvas.
 */
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") api.mount();
})(function () {
  "use strict";

  var INK = [28, 25, 22];
  var CEDAR = [184, 142, 106];
  var CEDAR_DARK = [112, 78, 52];
  var FLOOR = [214, 186, 150];
  var ROOF = [48, 56, 64];
  var ROOF_LIT = [72, 82, 90];
  var GLASS = [168, 206, 214];
  var DOOR = [27, 68, 56];
  var TRIM = [236, 230, 218];
  var FOUND = [110, 106, 100];
  var TREE = [27, 74, 52];
  var TREE_DARK = [16, 48, 34];
  var PAPER = [244, 239, 228];

  var STAGES = [
    { id: "plan", name: "Plan", line: "Flat lines for a one-story house.", until: 0.14 },
    { id: "frame", name: "Frame", line: "Walls rise off the drawing.", until: 0.42 },
    { id: "build", name: "Build", line: "Floor, roof, windows, and a door.", until: 0.7 },
    { id: "addition", name: "Your addition", line: "A second story rises on top.", until: 1.01 }
  ];

  function smooth(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  function values(p) {
    return {
      walls: smooth((p - 0.05) / 0.18),
      tilt: smooth((p - 0.08) / 0.2),
      finish: smooth((p - 0.4) / 0.24),
      addition: smooth((p - 0.66) / 0.22)
    };
  }

  function stageAt(p) {
    var i;
    for (i = 0; i < STAGES.length; i++) {
      if (p < STAGES[i].until) return STAGES[i];
    }
    return STAGES[STAGES.length - 1];
  }

  function mix(a, b, t) {
    return [
      (a[0] + (b[0] - a[0]) * t) | 0,
      (a[1] + (b[1] - a[1]) * t) | 0,
      (a[2] + (b[2] - a[2]) * t) | 0
    ];
  }

  function rgba(c, a) {
    var alpha = a < 0 ? 0 : a > 1 ? 1 : a;
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.round(alpha * 1000) / 1000 + ")";
  }

  function project(x, y, z, tilt) {
    var sx0 = x;
    var sy0 = -y;
    var sx1 = x - y * 0.66;
    var sy1 = -y * 0.5 - z * 1.12;
    return {
      x: sx0 + (sx1 - sx0) * tilt,
      y: sy0 + (sy1 - sy0) * tilt
    };
  }

  function cameraFor(w, h, tilt) {
    var fit = [
      [-10, -8, 0], [44, -8, 0], [44, 32, 0], [-10, 32, 0],
      [-10, -8, 24], [44, -8, 24], [18, 13, 26], [-9, 6, 14], [43, 20, 14]
    ];
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    var i;
    var p;
    for (i = 0; i < fit.length; i++) {
      p = project(fit[i][0], fit[i][1], fit[i][2], tilt);
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    var bw = Math.max(1, maxX - minX);
    var bh = Math.max(1, maxY - minY);
    var scale = Math.min((w * 0.86) / bw, (h * 0.82) / bh);
    return {
      scale: scale,
      ox: w / 2 - ((minX + maxX) / 2) * scale,
      oy: h / 2 - ((minY + maxY) / 2) * scale + h * 0.02,
      tilt: tilt
    };
  }

  function wall(x1, y1, x2, y2, openings, exterior) {
    return {
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      openings: openings || [],
      exterior: !!exterior
    };
  }

  function wallLen(w) {
    return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  }

  function at(w, t) {
    var dx = w.x2 - w.x1;
    var dy = w.y2 - w.y1;
    var len = Math.hypot(dx, dy) || 1;
    var u = t / len;
    return [w.x1 + dx * u, w.y1 + dy * u];
  }

  function pieces(length, openings) {
    var items = (openings || []).slice().sort(function (a, b) { return a.t - b.t; });
    var out = [];
    var cursor = 0;
    var i;
    var op;
    var t0;
    var t1;
    for (i = 0; i < items.length; i++) {
      op = items[i];
      t0 = Math.max(0, op.t);
      t1 = Math.min(length, op.t + op.w);
      if (t1 <= t0) continue;
      if (t0 > cursor + 0.04) out.push({ t0: cursor, t1: t0, kind: "wall" });
      out.push({ t0: t0, t1: t1, kind: op.kind });
      cursor = t1;
    }
    if (cursor < length - 0.04) out.push({ t0: cursor, t1: length, kind: "wall" });
    return out;
  }

  function shadeOf(w) {
    var dx = w.x2 - w.x1;
    var dy = w.y2 - w.y1;
    var len = Math.hypot(dx, dy) || 1;
    var nx = dy / len;
    var ny = -dx / len;
    var lx = 0.2;
    var ly = -1;
    var ll = Math.hypot(lx, ly);
    var dot = (nx * lx + ny * ly) / ll;
    return 0.58 + 0.42 * Math.max(0, dot);
  }

  var STORY = [
    wall(0, 0, 36, 0, [
      { t: 3.2, w: 5.6, kind: "window" },
      { t: 13.6, w: 3.8, kind: "entry" },
      { t: 23.4, w: 7.2, kind: "window" }
    ], true),
    wall(36, 0, 36, 26, [
      { t: 3, w: 5, kind: "window" },
      { t: 16.5, w: 5, kind: "window" }
    ], true),
    wall(36, 26, 0, 26, [
      { t: 6, w: 6, kind: "window" },
      { t: 20, w: 5, kind: "window" }
    ], true),
    wall(0, 26, 0, 0, [
      { t: 4, w: 5, kind: "window" },
      { t: 15, w: 5.2, kind: "window" }
    ], true),
    wall(20, 0, 20, 26, [
      { t: 5.2, w: 3, kind: "door" },
      { t: 17.2, w: 3, kind: "door" }
    ], false),
    wall(0, 15, 36, 15, [
      { t: 7.5, w: 3, kind: "door" },
      { t: 23.2, w: 3, kind: "door" }
    ], false)
  ];

  var UPPER = [
    wall(0.6, 0.6, 35.4, 0.6, [
      { t: 3.4, w: 5.4, kind: "window" },
      { t: 13.2, w: 7.4, kind: "window" },
      { t: 24.6, w: 5.6, kind: "window" }
    ], true),
    wall(35.4, 0.6, 35.4, 25.4, [
      { t: 3.2, w: 4.8, kind: "window" },
      { t: 14.5, w: 4.8, kind: "window" }
    ], true),
    wall(35.4, 25.4, 0.6, 25.4, [
      { t: 8, w: 6, kind: "window" }
    ], true),
    wall(0.6, 25.4, 0.6, 0.6, [
      { t: 4, w: 4.8, kind: "window" },
      { t: 14, w: 4.8, kind: "window" }
    ], true)
  ];

  var ROOMS = [
    { name: "Living", x: 10, y: 7.4 },
    { name: "Kitchen", x: 28, y: 7.4 },
    { name: "Bed", x: 10, y: 20.6 },
    { name: "Bath", x: 24.2, y: 20.6 },
    { name: "Stair", x: 32, y: 16.4 }
  ];

  var HL = [29, 78, 216];

  function sceneOps(w, h, progress, focus) {
    var p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    focus = focus || "";
    var v = values(p);
    var cam = cameraFor(w, h, v.tilt);
    var ops = [];
    var planAlpha = 1 - smooth(Math.max(v.tilt, v.walls * 0.85) / 0.62);
    var eaveZ = 9 + 8 * v.addition;
    var ridgeZ = eaveZ + 4.7;
    var cedar = mix(INK, CEDAR, v.finish);
    var cedarDeep = mix(INK, CEDAR_DARK, v.finish);
    var inkStroke = rgba(INK, 0.92);

    function toScreen(x, y, z) {
      var q = project(x, y, z, cam.tilt);
      return { x: cam.ox + q.x * cam.scale, y: cam.oy + q.y * cam.scale };
    }

    function pushPoly(pts, fill, stroke, lw, alpha) {
      if (!pts || pts.length < 3) return;
      if ((alpha == null ? 1 : alpha) < 0.02 && !stroke) return;
      ops.push({
        type: "poly",
        pts: pts,
        fill: fill || null,
        stroke: stroke || null,
        lw: lw || 1,
        alpha: alpha == null ? 1 : alpha
      });
    }

    function pushLine(pts, stroke, lw, alpha) {
      if (!pts || pts.length < 2 || (alpha != null && alpha < 0.02)) return;
      ops.push({
        type: "line",
        pts: pts,
        stroke: stroke,
        lw: lw || 1,
        alpha: alpha == null ? 1 : alpha
      });
    }

    function quad(a, b, c, d, fill, stroke, lw, alpha) {
      pushPoly([
        toScreen(a[0], a[1], a[2]),
        toScreen(b[0], b[1], b[2]),
        toScreen(c[0], c[1], c[2]),
        toScreen(d[0], d[1], d[2])
      ], fill, stroke, lw, alpha);
    }

    function emitWalls(list, z0, z1) {
      var ordered = list.slice().sort(function (a, b) {
        var dy = (b.y1 + b.y2) - (a.y1 + a.y2);
        if (Math.abs(dy) > 1) return dy;
        return (b.x1 + b.x2) - (a.x1 + a.x2);
      });
      var i;
      for (i = 0; i < ordered.length; i++) emitWall(ordered[i], z0, z1);
    }

    function emitWall(wll, z0, z1) {
      if (z1 - z0 < 0.08) return;
      var len = wallLen(wll);
      var parts = pieces(len, wll.openings);
      var shade = shadeOf(wll);
      var face = mix(cedar, [255, 255, 255], 0);
      face = [
        Math.min(255, face[0] * shade) | 0,
        Math.min(255, face[1] * shade) | 0,
        Math.min(255, face[2] * shade) | 0
      ];
      var fill = v.finish > 0.02
        ? rgba(face, v.finish * (wll.exterior ? 1 : 0.92))
        : rgba([90, 78, 64], wll.exterior ? 0.14 : 0.08);
      var stroke = rgba(mix(INK, cedarDeep, v.finish), 0.95);
      var lw = Math.max(1, cam.scale * 0.045);
      var thick = Math.max(2.4, cam.scale * (wll.exterior ? 0.42 : 0.26));
      var j;
      var part;
      var p0;
      var p1;
      var sill;
      var head;
      for (j = 0; j < parts.length; j++) {
        part = parts[j];
        p0 = at(wll, part.t0);
        p1 = at(wll, part.t1);
        if (planAlpha > 0.03) {
          if (part.kind === "wall") {
            pushLine(
              [toScreen(p0[0], p0[1], 0.02), toScreen(p1[0], p1[1], 0.02)],
              inkStroke,
              thick,
              planAlpha
            );
          } else if (part.kind === "window") {
            pushLine(
              [toScreen(p0[0], p0[1], 0.02), toScreen(p1[0], p1[1], 0.02)],
              rgba(INK, 0.85),
              Math.max(1, cam.scale * 0.08),
              planAlpha
            );
          }
        }
        if (part.kind === "wall") {
          quad(
            [p0[0], p0[1], z0],
            [p1[0], p1[1], z0],
            [p1[0], p1[1], z1],
            [p0[0], p0[1], z1],
            fill,
            stroke,
            lw,
            1
          );
          emitStuds(p0, p1, z0, z1, stroke);
          if (wll.exterior && v.finish > 0.4) emitSiding(p0, p1, z0, z1, shade);
        } else if (part.kind === "window") {
          sill = z0 + 3.05;
          head = z0 + Math.min(7.05, (z1 - z0) * 0.78);
          if (z1 > z0 + 0.4) {
            quad(
              [p0[0], p0[1], z0],
              [p1[0], p1[1], z0],
              [p1[0], p1[1], Math.min(sill, z1)],
              [p0[0], p0[1], Math.min(sill, z1)],
              fill,
              stroke,
              lw,
              1
            );
          }
          if (z1 > head) {
            quad(
              [p0[0], p0[1], head],
              [p1[0], p1[1], head],
              [p1[0], p1[1], z1],
              [p0[0], p0[1], z1],
              fill,
              stroke,
              lw,
              1
            );
          }
          if (v.finish > 0.08 && z1 > sill + 0.4) {
            emitGlass(p0, p1, sill, Math.min(head, z1), lw);
          }
        } else if (part.kind === "entry" || part.kind === "door") {
          head = z0 + Math.min(7.35, z1 - z0);
          if (z1 > head) {
            quad(
              [p0[0], p0[1], head],
              [p1[0], p1[1], head],
              [p1[0], p1[1], z1],
              [p0[0], p0[1], z1],
              fill,
              stroke,
              lw,
              1
            );
          }
          if (part.kind === "entry" && v.finish > 0.12 && z1 > z0 + 2) {
            emitDoor(p0, p1, z0, Math.min(head, z1), lw);
          }
        }
      }
      if (wll.exterior && v.finish > 0.45 && z1 - z0 > 2) {
        var b0 = at(wll, 0);
        var b1 = at(wll, len);
        quad(
          [b0[0], b0[1], z0],
          [b1[0], b1[1], z0],
          [b1[0], b1[1], z0 + 0.55],
          [b0[0], b0[1], z0 + 0.55],
          rgba(FOUND, v.finish),
          null,
          0,
          1
        );
      }
    }

    function emitStuds(p0, p1, z0, z1, stroke) {
      var studA = (1 - v.finish) * smooth((z1 - z0) / 3);
      var col = stroke;
      if (focus === "framing") {
        studA = Math.max(studA, 0.95);
        col = rgba(HL, 0.95);
      }
      if (studA < 0.05) return;
      var dx = p1[0] - p0[0];
      var dy = p1[1] - p0[1];
      var len = Math.hypot(dx, dy);
      var n = Math.max(1, Math.round(len / (focus === "framing" ? 3.2 : 4)));
      var s;
      var u;
      var x;
      var y;
      for (s = 1; s < n; s++) {
        u = s / n;
        x = p0[0] + dx * u;
        y = p0[1] + dy * u;
        pushLine(
          [toScreen(x, y, z0), toScreen(x, y, z1)],
          col,
          Math.max(1.15, cam.scale * (focus === "framing" ? 0.07 : 0.05)),
          studA
        );
      }
    }

    function emitSiding(p0, p1, z0, z1, shade) {
      var alpha = smooth((v.finish - 0.35) / 0.5) * 0.55;
      if (alpha < 0.04) return;
      var col = rgba([
        Math.min(255, CEDAR_DARK[0] * shade) | 0,
        Math.min(255, CEDAR_DARK[1] * shade) | 0,
        Math.min(255, CEDAR_DARK[2] * shade) | 0
      ], alpha);
      var z = z0 + 0.9;
      while (z < z1 - 0.3) {
        pushLine(
          [toScreen(p0[0], p0[1], z), toScreen(p1[0], p1[1], z)],
          col,
          Math.max(0.6, cam.scale * 0.025),
          1
        );
        z += 0.72;
      }
    }

    function emitGlass(p0, p1, z0, z1, lw) {
      var inset = 0.12;
      quad(
        [p0[0], p0[1], z0 + inset],
        [p1[0], p1[1], z0 + inset],
        [p1[0], p1[1], z1 - inset],
        [p0[0], p0[1], z1 - inset],
        rgba(GLASS, 0.28 + v.finish * 0.6),
        rgba(mix(INK, TRIM, v.finish), 0.9),
        Math.max(1, lw),
        1
      );
      var midX = (p0[0] + p1[0]) / 2;
      var midY = (p0[1] + p1[1]) / 2;
      var midZ = (z0 + z1) / 2;
      pushLine(
        [toScreen(p0[0], p0[1], midZ), toScreen(p1[0], p1[1], midZ)],
        rgba(mix(INK, TRIM, v.finish), 0.55),
        Math.max(0.6, cam.scale * 0.02),
        v.finish
      );
      pushLine(
        [toScreen(midX, midY, z0), toScreen(midX, midY, z1)],
        rgba(mix(INK, TRIM, v.finish), 0.55),
        Math.max(0.6, cam.scale * 0.02),
        v.finish
      );
    }

    function emitDoor(p0, p1, z0, z1, lw) {
      quad(
        [p0[0], p0[1], z0],
        [p1[0], p1[1], z0],
        [p1[0], p1[1], z1],
        [p0[0], p0[1], z1],
        rgba(mix(INK, DOOR, v.finish), 0.25 + v.finish * 0.75),
        rgba(mix(INK, [12, 36, 28], v.finish), 0.95),
        Math.max(1, lw),
        1
      );
      if (v.finish > 0.35) {
        var lite0 = z0 + (z1 - z0) * 0.62;
        var lite1 = z0 + (z1 - z0) * 0.9;
        var dx = p1[0] - p0[0];
        var dy = p1[1] - p0[1];
        quad(
          [p0[0] + dx * 0.22, p0[1] + dy * 0.22, lite0],
          [p0[0] + dx * 0.78, p0[1] + dy * 0.78, lite0],
          [p0[0] + dx * 0.78, p0[1] + dy * 0.78, lite1],
          [p0[0] + dx * 0.22, p0[1] + dy * 0.22, lite1],
          rgba(GLASS, 0.75),
          rgba(TRIM, 0.8),
          Math.max(0.7, cam.scale * 0.02),
          1
        );
      }
    }

    function emitRoof() {
      if (v.finish < 0.04) return;
      var a = v.finish;
      var front = rgba(ROOF_LIT, a);
      var back = rgba(ROOF, a);
      var edge = rgba([24, 28, 32], a);
      quad([-1.2, -1.25, eaveZ], [37.2, -1.25, eaveZ], [37.2, 13, ridgeZ], [-1.2, 13, ridgeZ], front, edge, 1, 1);
      quad([-1.2, 13, ridgeZ], [37.2, 13, ridgeZ], [37.2, 27.25, eaveZ], [-1.2, 27.25, eaveZ], back, edge, 1, 1);
      pushPoly([
        toScreen(36, 0, eaveZ),
        toScreen(36, 26, eaveZ),
        toScreen(36, 13, ridgeZ)
      ], rgba(mix(CEDAR, CEDAR_DARK, 0.35), a), rgba(cedarDeep, a), Math.max(1, cam.scale * 0.04), 1);
      pushPoly([
        toScreen(0, 0, eaveZ),
        toScreen(0, 13, ridgeZ),
        toScreen(0, 26, eaveZ)
      ], rgba(mix(CEDAR, [90, 64, 42], 0.4), a * 0.95), rgba(cedarDeep, a), Math.max(1, cam.scale * 0.04), 1);
      pushLine(
        [toScreen(-1.2, 13, ridgeZ), toScreen(37.2, 13, ridgeZ)],
        rgba([20, 24, 28], a),
        Math.max(1.2, cam.scale * 0.06),
        1
      );
      quad([-1.2, -1.25, eaveZ - 0.45], [37.2, -1.25, eaveZ - 0.45], [37.2, -1.25, eaveZ], [-1.2, -1.25, eaveZ], rgba(TRIM, a * 0.9), null, 0, 1);
    }

    function emitPorch() {
      if (v.finish < 0.05) return;
      var a = v.finish;
      quad([11, -5.2, 0.32], [24, -5.2, 0.32], [24, 0.05, 0.32], [11, 0.05, 0.32], rgba(mix(PAPER, [196, 184, 166], a), a), rgba(INK, a * 0.5), 1, 1);
      quad([10.6, -5.7, 8.15], [24.4, -5.7, 8.15], [24.4, 0.15, 8.35], [10.6, 0.15, 8.35], rgba(ROOF, a), rgba([24, 28, 32], a), 1, 1);
      quad([11.15, -5.15, 0.32], [11.55, -5.15, 0.32], [11.55, -5.15, 8.15], [11.15, -5.15, 8.15], rgba(mix(INK, TRIM, v.finish), a), null, 0, 1);
      quad([23.45, -5.15, 0.32], [23.85, -5.15, 0.32], [23.85, -5.15, 8.15], [23.45, -5.15, 8.15], rgba(mix(INK, TRIM, v.finish), a), null, 0, 1);
    }

    function emitTree(x, y) {
      var alpha = v.finish;
      if (alpha < 0.03) return;
      quad([x - 0.28, y, 0], [x + 0.28, y, 0], [x + 0.28, y, 2.3], [x - 0.28, y, 2.3], rgba([92, 64, 40], alpha), null, 0, 1);
      pushPoly([
        toScreen(x, y, 11.4),
        toScreen(x - 2.3, y + 0.2, 1.5),
        toScreen(x + 2.15, y - 0.15, 1.5)
      ], rgba(TREE_DARK, alpha), null, 0, 1);
      pushPoly([
        toScreen(x, y, 9.3),
        toScreen(x - 1.7, y, 3.5),
        toScreen(x + 1.6, y, 3.5)
      ], rgba(TREE, alpha), null, 0, 1);
      pushPoly([
        toScreen(x, y, 7.2),
        toScreen(x - 1.15, y, 4.8),
        toScreen(x + 1.05, y, 4.8)
      ], rgba([46, 110, 74], alpha), null, 0, 1);
    }

    function emitPlanExtras() {
      var i;
      var y;
      var size;
      if (planAlpha < 0.04) return;
      if (v.walls > 0.35 && v.finish < 0.8) {
        for (i = 1; i < 8; i++) {
          y = (26 / 8) * i;
          pushLine(
            [toScreen(0.4, y, 0.08), toScreen(35.6, y, 0.08)],
            rgba(INK, 0.45),
            1,
            planAlpha * (1 - v.finish) * 0.8
          );
        }
      }
      pushLine(
        [toScreen(14, 0.05, 0.06), toScreen(14, 3.7, 0.06)],
        inkStroke,
        Math.max(1, cam.scale * 0.045),
        planAlpha
      );
      var arc = [];
      for (i = 0; i <= 10; i++) {
        var a = (Math.PI / 2) * (i / 10);
        arc.push(toScreen(14 + Math.cos(a) * 3.7, Math.sin(a) * 3.7, 0.06));
      }
      pushLine(arc, rgba(INK, 0.7), 1, planAlpha);
      for (i = 0; i < 6; i++) {
        y = 18 + i * 1.05;
        pushLine([toScreen(29.1, y, 0.05), toScreen(34.6, y, 0.05)], rgba(INK, 0.75), 1, planAlpha);
      }
      size = Math.max(11, Math.min(18, cam.scale * 0.4));
      for (i = 0; i < ROOMS.length; i++) {
        var s = toScreen(ROOMS[i].x, ROOMS[i].y, 0.2);
        ops.push({
          type: "text",
          x: s.x,
          y: s.y,
          text: ROOMS[i].name,
          size: size,
          fill: rgba(INK, 0.9),
          align: "center",
          weight: "600",
          alpha: planAlpha
        });
      }
      var treeMark = toScreen(-6.5, 8, 0);
      ops.push({
        type: "circle",
        x: treeMark.x,
        y: treeMark.y,
        r: Math.max(6, cam.scale * 1.15),
        stroke: rgba(INK, 0.8),
        lw: 1.25,
        alpha: planAlpha
      });
    }

    var groundA = smooth((v.tilt - 0.05) / 0.45) * 0.55 + v.finish * 0.25;
    if (groundA > 0.03) {
      var c = toScreen(18, 12, 0);
      ops.push({
        type: "ellipse",
        x: c.x,
        y: c.y + cam.scale * 0.6,
        rx: cam.scale * 18,
        ry: cam.scale * (4.2 + v.tilt * 2.4),
        fill: rgba(INK, 0.13 * Math.max(v.tilt, v.finish)),
        alpha: 1
      });
      quad(
        [-3, -7, 0],
        [39, -7, 0],
        [39, 29, 0],
        [-3, 29, 0],
        rgba(mix(PAPER, [214, 206, 190], Math.max(v.tilt, v.finish)), Math.min(0.95, groundA)),
        null,
        0,
        1
      );
    }

    quad(
      [0, 0, 0.06],
      [36, 0, 0.06],
      [36, 26, 0.06],
      [0, 26, 0.06],
      rgba(mix(PAPER, FLOOR, v.finish), 0.2 + v.finish * 0.8),
      null,
      0,
      1
    );
    if (v.finish > 0.25) {
      var plank;
      for (plank = 1; plank < 6; plank++) {
        var px = (36 / 6) * plank;
        pushLine(
          [toScreen(px, 0.3, 0.08), toScreen(px, 25.7, 0.08)],
          rgba(CEDAR_DARK, 0.28 * v.finish),
          1,
          1
        );
      }
    }

    emitTree(42.5, 20);
    emitPlanExtras();

    if (v.walls > 0.02) emitWalls(STORY, 0, 9 * v.walls);
    if (v.addition > 0.02) {
      quad(
        [0.6, 0.6, 9],
        [35.4, 0.6, 9],
        [35.4, 25.4, 9],
        [0.6, 25.4, 9],
        rgba(FLOOR, 0.35 + v.addition * 0.6),
        rgba(cedarDeep, v.addition),
        1,
        1
      );
      emitWalls(UPPER, 9, 9 + 8 * v.addition);
    }
    emitRoof();
    emitPorch();
    emitTree(-6.5, 8);

    if (planAlpha > 0.2) {
      var nBase = toScreen(40.5, 23.5, 0);
      pushLine(
        [nBase, { x: nBase.x, y: nBase.y - Math.max(16, cam.scale * 1.4) }],
        rgba(INK, 0.8),
        1.25,
        planAlpha
      );
      ops.push({
        type: "text",
        x: nBase.x,
        y: nBase.y - Math.max(24, cam.scale * 1.9),
        text: "N",
        size: Math.max(11, cam.scale * 0.34),
        fill: rgba(INK, 0.85),
        align: "center",
        weight: "700",
        alpha: planAlpha
      });
    }

    ops.push({
      type: "text",
      x: w - 16,
      y: h - 28,
      text: "CONCEPT SKETCH",
      size: 11,
      fill: rgba(INK, 0.62),
      align: "right",
      weight: "700",
      alpha: 1
    });
    ops.push({
      type: "text",
      x: w - 16,
      y: h - 14,
      text: "Not a bid or stamped plan",
      size: 10,
      fill: rgba(INK, 0.5),
      align: "right",
      weight: "500",
      alpha: 1
    });

    emitFocus();
    return ops;

    function emitFocus() {
      if (!focus) return;
      var stroke = rgba(HL, 0.96);
      var wash = rgba(HL, 0.2);
      var lw = Math.max(2.4, cam.scale * 0.11);
      var wallTop = 9 * Math.max(v.walls, focus === "foundation" ? 0 : 0.2);

      function markLine(x1, y1, x2, y2, z, width) {
        pushLine([toScreen(x1, y1, z), toScreen(x2, y2, z)], stroke, width || lw, 1);
      }

      function markWall(x1, y1, x2, y2, z0, z1) {
        if (z1 - z0 < 0.2) {
          markLine(x1, y1, x2, y2, 0.25, lw);
          return;
        }
        quad(
          [x1, y1, z0],
          [x2, y2, z0],
          [x2, y2, z1],
          [x1, y1, z1],
          wash,
          stroke,
          Math.max(1.4, cam.scale * 0.05),
          1
        );
      }

      if (focus === "foundation") {
        markLine(-0.8, -0.8, 36.8, -0.8, 0.2, lw);
        markLine(36.8, -0.8, 36.8, 26.8, 0.2, lw);
        markLine(36.8, 26.8, -0.8, 26.8, 0.2, lw);
        markLine(-0.8, 26.8, -0.8, -0.8, 0.2, lw);
        quad([-1.5, -1.6, 0.02], [37.5, -1.6, 0.02], [37.5, 27.6, 0.02], [-1.5, 27.6, 0.02], rgba(HL, 0.08), null, 0, 1);
      } else if (focus === "bearing") {
        markWall(0, 0, 36, 0, 0, wallTop);
        markWall(36, 0, 36, 26, 0, wallTop);
        markWall(36, 26, 0, 26, 0, wallTop);
        markWall(0, 26, 0, 0, 0, wallTop);
      } else if (focus === "partition") {
        markWall(20, 0, 20, 26, 0, wallTop);
        markWall(0, 15, 36, 15, 0, wallTop);
      } else if (focus === "framing") {
        markLine(0, 0, 36, 0, 0.15, Math.max(2, cam.scale * 0.08));
        markLine(0, 0, 36, 0, wallTop, Math.max(2, cam.scale * 0.08));
        markLine(0, 26, 36, 26, 0.15, Math.max(2, cam.scale * 0.08));
        markLine(0, 26, 36, 26, wallTop, Math.max(2, cam.scale * 0.08));
      } else if (focus === "header") {
        var openings = [
          [3.2, 8.8, 0],
          [13.6, 17.4, 0],
          [23.4, 30.6, 0],
          [3, 8, 1],
          [16.5, 21.5, 1]
        ];
        var n;
        var beamZ = Math.min(7.15, Math.max(2.4, wallTop - 0.2));
        for (n = 0; n < openings.length; n++) {
          var op = openings[n];
          if (op[2] === 0) {
            quad(
              [op[0] - 0.45, 0, beamZ - 0.9],
              [op[1] + 0.45, 0, beamZ - 0.9],
              [op[1] + 0.45, 0, beamZ],
              [op[0] - 0.45, 0, beamZ],
              rgba(HL, 0.55),
              stroke,
              1.4,
              1
            );
          } else {
            quad(
              [36, op[0] - 0.45, beamZ - 0.9],
              [36, op[1] + 0.45, beamZ - 0.9],
              [36, op[1] + 0.45, beamZ],
              [36, op[0] - 0.45, beamZ],
              rgba(HL, 0.55),
              stroke,
              1.4,
              1
            );
          }
        }
      } else if (focus === "roof") {
        var r;
        for (r = 0; r <= 8; r++) {
          var rx = -1.2 + (38.4 * r) / 8;
          pushLine([toScreen(rx, -1.25, eaveZ), toScreen(rx, 13, ridgeZ)], stroke, Math.max(1.3, cam.scale * 0.045), 1);
          pushLine([toScreen(rx, 13, ridgeZ), toScreen(rx, 27.25, eaveZ)], rgba(HL, 0.75), Math.max(1.1, cam.scale * 0.04), 1);
        }
        pushLine([toScreen(-1.2, 13, ridgeZ), toScreen(37.2, 13, ridgeZ)], stroke, Math.max(2.5, cam.scale * 0.09), 1);
      } else if (focus === "footings") {
        var pads = [[0, 0], [36, 0], [36, 26], [0, 26], [18, 0], [18, 26], [0, 13], [36, 13]];
        var pi;
        for (pi = 0; pi < pads.length; pi++) {
          var fx = pads[pi][0];
          var fy = pads[pi][1];
          quad(
            [fx - 1.35, fy - 1.35, 0.04],
            [fx + 1.35, fy - 1.35, 0.04],
            [fx + 1.35, fy + 1.35, 0.04],
            [fx - 1.35, fy + 1.35, 0.04],
            rgba(HL, 0.38),
            stroke,
            1.5,
            1
          );
        }
      } else if (focus === "structure") {
        var up = 9 + 8 * Math.max(v.addition, 0.15);
        markWall(0.6, 0.6, 35.4, 0.6, 9, up);
        markWall(35.4, 0.6, 35.4, 25.4, 9, up);
        markLine(0.6, 0.6, 35.4, 0.6, 9, lw);
        markLine(0.6, 25.4, 35.4, 25.4, up, lw);
      } else if (focus === "stairs") {
        quad([28.2, 15.2, 0.3], [35.6, 15.2, 0.3], [35.6, 25.6, 0.3], [28.2, 25.6, 0.3], wash, stroke, 1.6, 1);
        var step;
        for (step = 0; step < 6; step++) {
          var sy = 18 + step * 1.05;
          pushLine([toScreen(29.1, sy, 0.4), toScreen(34.6, sy, 0.4)], stroke, Math.max(1.2, cam.scale * 0.04), 1);
        }
        pushLine([toScreen(32, 21, 0.5), toScreen(32, 21, 9 + 8 * v.addition)], stroke, Math.max(2, cam.scale * 0.07), 1);
        var label = toScreen(32, 16.2, 9.4 + 4 * v.addition);
        ops.push({
          type: "text",
          x: label.x,
          y: label.y,
          text: "Stair",
          size: Math.max(12, cam.scale * 0.36),
          fill: stroke,
          align: "center",
          weight: "700",
          alpha: 1
        });
      }
    }
  }

  function paint(ctx, op) {
    ctx.globalAlpha = op.alpha == null ? 1 : op.alpha;
    if (op.type === "poly" || op.type === "line") {
      if (!op.pts.length) return;
      ctx.beginPath();
      ctx.moveTo(op.pts[0].x, op.pts[0].y);
      var i;
      for (i = 1; i < op.pts.length; i++) ctx.lineTo(op.pts[i].x, op.pts[i].y);
      if (op.type === "poly") ctx.closePath();
      if (op.fill) {
        ctx.fillStyle = op.fill;
        ctx.fill();
      }
      if (op.stroke) {
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = op.lw || 1;
        ctx.stroke();
      }
    } else if (op.type === "text") {
      ctx.fillStyle = op.fill;
      ctx.font = (op.weight || "600") + " " + op.size + "px Inter, system-ui, sans-serif";
      ctx.textAlign = op.align || "center";
      ctx.textBaseline = "middle";
      ctx.fillText(op.text, op.x, op.y);
    } else if (op.type === "circle") {
      ctx.beginPath();
      ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
      if (op.fill) {
        ctx.fillStyle = op.fill;
        ctx.fill();
      }
      if (op.stroke) {
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = op.lw || 1;
        ctx.stroke();
      }
    } else if (op.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(op.x, op.y, op.rx, op.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = op.fill;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function esc(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function num(n) {
    return Math.round(n * 10) / 10;
  }

  function opsToSVG(ops, w, h) {
    var parts = [];
    var i;
    var op;
    var pts;
    parts.push(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h +
      '" role="img" aria-label="Illustrative Pacific Northwest house with a second-story addition. Not a bid or stamped plan.">'
    );
    parts.push('<rect width="' + w + '" height="' + h + '" fill="#f4efe4"/>');
    for (i = 0; i < ops.length; i++) {
      op = ops[i];
      if (op.alpha != null && op.alpha < 0.03) continue;
      if (op.type === "poly" || op.type === "line") {
        pts = op.pts.map(function (pt) { return num(pt.x) + "," + num(pt.y); }).join(" ");
        if (op.type === "poly") {
          parts.push(
            '<polygon points="' + pts + '" fill="' + (op.fill || "none") + '" stroke="' +
            (op.stroke || "none") + '" stroke-width="' + num(op.lw || 1) +
            '" stroke-linejoin="round"' + (op.alpha < 1 ? ' opacity="' + num(op.alpha) + '"' : "") + "/>"
          );
        } else {
          parts.push(
            '<polyline points="' + pts + '" fill="none" stroke="' + op.stroke + '" stroke-width="' +
            num(op.lw || 1) + '" stroke-linecap="round" stroke-linejoin="round"' +
            (op.alpha < 1 ? ' opacity="' + num(op.alpha) + '"' : "") + "/>"
          );
        }
      } else if (op.type === "text") {
        parts.push(
          '<text x="' + num(op.x) + '" y="' + num(op.y) + '" text-anchor="' +
          (op.align === "right" ? "end" : op.align === "left" ? "start" : "middle") +
          '" dominant-baseline="middle" font-family="Inter, system-ui, sans-serif" font-size="' +
          num(op.size) + '" font-weight="' + (op.weight || "600") + '" fill="' + op.fill + '"' +
          (op.alpha < 1 ? ' opacity="' + num(op.alpha) + '"' : "") + ">" + esc(op.text) + "</text>"
        );
      } else if (op.type === "circle") {
        parts.push(
          '<circle cx="' + num(op.x) + '" cy="' + num(op.y) + '" r="' + num(op.r) + '" fill="' +
          (op.fill || "none") + '" stroke="' + (op.stroke || "none") + '" stroke-width="' +
          num(op.lw || 1) + '"' + (op.alpha < 1 ? ' opacity="' + num(op.alpha) + '"' : "") + "/>"
        );
      } else if (op.type === "ellipse") {
        parts.push(
          '<ellipse cx="' + num(op.x) + '" cy="' + num(op.y) + '" rx="' + num(op.rx) + '" ry="' +
          num(op.ry) + '" fill="' + op.fill + '"/>'
        );
      }
    }
    parts.push("</svg>");
    return parts.join("");
  }

  function mount() {
    var root = document.getElementById("scroll-house");
    if (!root || root.getAttribute("data-ready") === "1") return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      root.classList.add("is-still");
      return;
    }
    var canvas = root.querySelector(".scroll-house-canvas");
    var sheet = root.querySelector(".scroll-house-sheet");
    var track = root.querySelector(".scroll-house-track");
    var sticky = root.querySelector(".scroll-house-sticky");
    var line = root.querySelector(".scroll-house-line");
    var bar = root.querySelector(".sh-progress > span");
    var stageNodes = root.querySelectorAll(".sh-stages li");
    if (!canvas || !sheet || !track || !sticky) return;
    var ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    root.setAttribute("data-ready", "1");

    var current = "";
    var focusId = "";
    var scheduled = false;
    var running = true;
    var learnSets = root.querySelectorAll(".sh-learn-set");
    var learnNotes = root.querySelectorAll(".sh-note");
    var learnPrompt = root.querySelector(".sh-learn-prompt");
    var callButtons = root.querySelectorAll(".sh-call");

    function applyFocus(id) {
      focusId = id || "";
      var i;
      for (i = 0; i < callButtons.length; i++) {
        var on = callButtons[i].getAttribute("data-callout") === focusId && focusId !== "";
        callButtons[i].setAttribute("aria-pressed", on ? "true" : "false");
        callButtons[i].classList.toggle("is-on", on);
      }
      for (i = 0; i < learnNotes.length; i++) {
        learnNotes[i].classList.toggle("is-open", learnNotes[i].getAttribute("data-callout") === focusId && focusId !== "");
      }
      if (learnPrompt) learnPrompt.classList.toggle("is-hidden", focusId !== "");
    }

    function focusBelongs(stageId) {
      var s;
      var b;
      var buttons;
      if (!focusId) return true;
      for (s = 0; s < learnSets.length; s++) {
        if (learnSets[s].getAttribute("data-stage") !== stageId) continue;
        buttons = learnSets[s].querySelectorAll(".sh-call");
        for (b = 0; b < buttons.length; b++) {
          if (buttons[b].getAttribute("data-callout") === focusId) return true;
        }
      }
      return false;
    }

    function showStageSet(stageId) {
      var i;
      for (i = 0; i < learnSets.length; i++) {
        learnSets[i].hidden = learnSets[i].getAttribute("data-stage") !== stageId;
      }
      if (!focusBelongs(stageId)) applyFocus("");
    }

    function progress() {
      var top = 0;
      var raw = window.getComputedStyle(sticky).top;
      if (raw && raw !== "auto") top = parseFloat(raw) || 0;
      var rect = track.getBoundingClientRect();
      var travel = track.offsetHeight - sticky.offsetHeight;
      if (travel <= 1) return 0;
      var scrolled = top - rect.top;
      if (scrolled <= 0) return 0;
      if (scrolled >= travel) return 1;
      return scrolled / travel;
    }

    function resize() {
      var rect = sheet.getBoundingClientRect();
      var cssW = Math.max(1, rect.width);
      var cssH = Math.max(1, rect.height);
      var dpr = Math.min(window.devicePixelRatio || 1, cssW < 700 ? 1.5 : 2);
      var bw = Math.round(cssW * dpr);
      var bh = Math.round(cssH * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: cssW, h: cssH };
    }

    function draw() {
      scheduled = false;
      if (!running) return;
      var size = resize();
      var p = progress();
      var stage = stageAt(p);
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      var ops = sceneOps(size.w, size.h, p, focusId);
      var i;
      for (i = 0; i < ops.length; i++) paint(ctx, ops[i]);
      if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
      root.classList.toggle("is-scrolled", p > 0.04);
      root.classList.toggle("is-late", p > 0.8);
      root.classList.add("is-drawn");
      if (stage.id !== current) {
        current = stage.id;
        if (line) line.textContent = stage.line;
        for (i = 0; i < stageNodes.length; i++) {
          var on = stageNodes[i].getAttribute("data-stage") === stage.id;
          stageNodes[i].classList.toggle("is-on", on);
          if (on) stageNodes[i].setAttribute("aria-current", "step");
          else stageNodes[i].removeAttribute("aria-current");
        }
        showStageSet(stage.id);
      }
    }

    function requestDraw() {
      if (scheduled || !running) return;
      scheduled = true;
      window.requestAnimationFrame(draw);
    }

    root.addEventListener("click", function (event) {
      var btn = event.target && event.target.closest ? event.target.closest(".sh-call") : null;
      if (!btn || !root.contains(btn)) return;
      var id = btn.getAttribute("data-callout");
      applyFocus(focusId === id ? "" : id);
      requestDraw();
    });

    window.addEventListener("scroll", requestDraw, { passive: true });
    window.addEventListener("resize", requestDraw, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) requestDraw();
    });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(requestDraw);
      ro.observe(sheet);
    }
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        running = entries.some(function (entry) { return entry.isIntersecting; });
        if (running) requestDraw();
      });
      io.observe(track);
    }
    requestDraw();
  }

  return {
    mount: mount,
    sceneOps: sceneOps,
    stageAt: stageAt,
    values: values,
    opsToSVG: opsToSVG,
    STAGES: STAGES
  };
});
