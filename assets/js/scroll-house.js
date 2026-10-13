/**
 * Scroll-built Pacific Northwest house for the Board homepage.
 *
 * Samnang Aing's casa-serra (github.com/Sam1983Aing/casa-serra) has no
 * license file, and GitHub reports no license. None of its code, rooms,
 * textures, or assets are reused. The cut through the walls, the long lens
 * from straight above, and the walk in from the front door follow the
 * technique described in that project's public starter prompt. This is a
 * different house: one story, then a second story, drawn with a small
 * original WebGL shader instead of a scene library.
 */
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") api.mount();
})(function () {
  "use strict";

  var PAPER = [0.937, 0.922, 0.886];
  var INK = [0.11, 0.1, 0.09];
  var SIDE = [0.62, 0.56, 0.48];
  var PAD = [0.71, 0.66, 0.58];
  var OAK = [0.58, 0.42, 0.26];
  var CEDAR = [0.48, 0.28, 0.16];
  var PLASTER = [0.83, 0.78, 0.7];
  var ROOF_C = [0.24, 0.27, 0.3];
  var GLASS_C = [0.62, 0.76, 0.8];
  var DOOR_C = [0.13, 0.28, 0.2];
  var HEADER_C = [0.36, 0.22, 0.12];
  var STUD_C = [0.74, 0.6, 0.4];
  var GREEN = [0.29, 0.4, 0.26];
  var TREE = [0.16, 0.32, 0.2];
  var HL = [0.114, 0.306, 0.847];

  var STAGES = [
    { id: "plan", line: "A flat plan, cut through the walls and seen from above.", until: 0.16 },
    { id: "frame", line: "The cut rises, and the walls grow off the sheet.", until: 0.4 },
    { id: "build", line: "Down to the front door: floor, roof, windows, and a door.", until: 0.68 },
    { id: "addition", line: "A second story rises, and the roof lifts with it.", until: 2 }
  ];

  var ROOMS = [
    { name: "Living", x: 10, z: 7.4 },
    { name: "Kitchen", x: 27.2, z: 7.4 },
    { name: "Bed", x: 10, z: 20.4 },
    { name: "Bath", x: 23.6, z: 20.4 },
    { name: "Stair", x: 32, z: 20.6 }
  ];

  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp3(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  function hypot3(x, y, z) { return Math.hypot(x, y, z) || 1; }

  function stageAt(p) {
    var i;
    for (i = 0; i < STAGES.length; i++) if (p < STAGES[i].until) return STAGES[i];
    return STAGES[STAGES.length - 1];
  }

  function sceneState(p) {
    var wallH = lerp(4, 8.9, smooth((p - 0.05) / 0.24));
    var lift = smooth((p - 0.66) / 0.22);
    var eave = 9 + 8 * lift;
    var ridge = eave + 7.4;
    return {
      p: p,
      wallH: wallH,
      lift: lift,
      eave: eave,
      ridge: ridge,
      mat: smooth((p - 0.36) / 0.18),
      studs: p >= 0.12 && p < 0.44,
      roof: p >= 0.38,
      upper: lift > 0.02,
      trees: p >= 0.32
    };
  }

  function frameFov(distance, aspect) {
    var v = 2 * Math.atan(16.5 / distance);
    var h = 2 * Math.atan(24 / distance);
    var vFromH = 2 * Math.atan(Math.tan(h / 2) / Math.max(0.35, aspect));
    return Math.max(v, vFromH) * 180 / Math.PI;
  }

  function cameraFor(p, aspect) {
    var keys = [
      { p: 0, eye: [18, 240, 13], look: [18, 0, 13], fov: 8 },
      { p: 0.17, eye: [18, 240, 13], look: [18, 0, 13], fov: 8 },
      { p: 0.26, eye: [52, 20, -22], look: [18, 4, 12], fov: 32 },
      { p: 0.42, eye: [50, 12, -24], look: [18, 5, 11], fov: 30 },
      { p: 0.55, eye: [48, 9.2, -22], look: [18, 5.2, 12], fov: 30 },
      { p: 0.66, eye: [16, 5.6, -9], look: [15, 5.2, 11], fov: 42 },
      { p: 0.78, eye: [50, 18, -26], look: [18, 9, 12], fov: 30 },
      { p: 0.9, eye: [56, 28, -32], look: [18, 12, 13], fov: 28 },
      { p: 1, eye: [50, 22, -26], look: [18, 11, 13], fov: 28 }
    ];
    var i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].p) i++;
    var a = keys[i];
    var b = keys[i + 1];
    var t = smooth((p - a.p) / ((b.p - a.p) || 1));
    var eye = lerp3(a.eye, b.eye, t);
    var look = lerp3(a.look, b.look, t);
    var fov = lerp(a.fov, b.fov, t);
    if (p < 0.17) {
      eye = [18, 240, 13];
      look = [18, 0, 13];
      fov = frameFov(240, aspect || 1.6);
    }
    var dx = look[0] - eye[0];
    var dy = look[1] - eye[1];
    var dz = look[2] - eye[2];
    var steep = clamp01((-dy / hypot3(dx, dy, dz) - 0.42) / 0.4);
    var up = [0, 1 - steep, steep];
    var ul = hypot3(up[0], up[1], up[2]);
    up[0] /= ul; up[1] /= ul; up[2] /= ul;
    return { eye: eye, look: look, fov: fov, up: up, steep: steep };
  }

  function lookAt(eye, target, up) {
    var zx = eye[0] - target[0];
    var zy = eye[1] - target[1];
    var zz = eye[2] - target[2];
    var zl = hypot3(zx, zy, zz);
    zx /= zl; zy /= zl; zz /= zl;
    var xx = up[1] * zz - up[2] * zy;
    var xy = up[2] * zx - up[0] * zz;
    var xz = up[0] * zy - up[1] * zx;
    var xl = hypot3(xx, xy, xz);
    xx /= xl; xy /= xl; xz /= xl;
    var yx = zy * xz - zz * xy;
    var yy = zz * xx - zx * xz;
    var yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
      1
    ]);
  }

  function perspective(fov, aspect, near, far) {
    var f = 1 / Math.tan(fov * Math.PI / 360);
    var nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function mul(a, b) {
    var o = new Float32Array(16);
    var c;
    var r;
    for (c = 0; c < 4; c++) {
      for (r = 0; r < 4; r++) {
        o[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  function hot(role, focus) {
    if (!focus) return 0;
    if (role === focus) return 1;
    if (focus === "foundation" && (role === "foundation" || role === "bearing")) return 1;
    if (focus === "structure" && (role === "structure" || role === "upperfloor")) return 1;
    if (focus === "framing" && (role === "stud" || role === "plate")) return 1;
    if (focus === "stairs" && role === "stair") return 1;
    if (focus === "header" && role === "header") return 1;
    return 0;
  }

  function makeBuf() {
    return { n: 0, data: new Float32Array(16 * 4096) };
  }

  function pushVert(buf, x, y, z, nx, ny, nz, ink, mat, h, alpha) {
    var i = buf.n;
    if (i + 14 > buf.data.length) {
      var next = new Float32Array(buf.data.length * 2);
      next.set(buf.data);
      buf.data = next;
    }
    var d = buf.data;
    d[i] = x; d[i + 1] = y; d[i + 2] = z;
    d[i + 3] = nx; d[i + 4] = ny; d[i + 5] = nz;
    d[i + 6] = ink[0]; d[i + 7] = ink[1]; d[i + 8] = ink[2];
    d[i + 9] = mat[0]; d[i + 10] = mat[1]; d[i + 11] = mat[2];
    d[i + 12] = h; d[i + 13] = alpha;
    buf.n = i + 14;
  }

  function pushTri(buf, a, b, c, nx, ny, nz, ink, mat, h, alpha) {
    pushVert(buf, a[0], a[1], a[2], nx, ny, nz, ink, mat, h, alpha);
    pushVert(buf, b[0], b[1], b[2], nx, ny, nz, ink, mat, h, alpha);
    pushVert(buf, c[0], c[1], c[2], nx, ny, nz, ink, mat, h, alpha);
  }

  function addFace(buf, a, b, c, d, hint, ink, mat, h, alpha) {
    var ax = b[0] - a[0];
    var ay = b[1] - a[1];
    var az = b[2] - a[2];
    var bx = d[0] - a[0];
    var by = d[1] - a[1];
    var bz = d[2] - a[2];
    var nx = ay * bz - az * by;
    var ny = az * bx - ax * bz;
    var nz = ax * by - ay * bx;
    var p0 = a;
    var p1 = b;
    var p2 = c;
    var p3 = d;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
      p1 = d;
      p3 = b;
      nx = -nx; ny = -ny; nz = -nz;
    }
    var len = hypot3(nx, ny, nz);
    nx /= len; ny /= len; nz /= len;
    pushTri(buf, p0, p1, p2, nx, ny, nz, ink, mat, h, alpha);
    pushTri(buf, p0, p2, p3, nx, ny, nz, ink, mat, h, alpha);
  }

  function addBox(buf, x0, y0, z0, x1, y1, z1, ink, mat, h, alpha, skipBottom, capInk) {
    if (x1 < x0) { var tx = x0; x0 = x1; x1 = tx; }
    if (y1 < y0) { var ty = y0; y0 = y1; y1 = ty; }
    if (z1 < z0) { var tz = z0; z0 = z1; z1 = tz; }
    if (x1 - x0 < 0.02 || y1 - y0 < 0.02 || z1 - z0 < 0.02) return;
    addFace(buf, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], capInk || ink, mat, h, alpha);
    if (!skipBottom) addFace(buf, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], ink, mat, h, alpha);
    addFace(buf, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], ink, mat, h, alpha);
    addFace(buf, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], ink, mat, h, alpha);
    addFace(buf, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], ink, mat, h, alpha);
    addFace(buf, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], ink, mat, h, alpha);
  }

  function inHole(at, holes) {
    var i;
    for (i = 0; i < holes.length; i++) {
      if (Math.abs(at - holes[i].at) < holes[i].w * 0.5) return true;
    }
    return false;
  }

  function wallStrip(buf, axis, fixed, a0, a1, y0, y1, thick, holes, role, inkSide, mat, focus, studs, outSign) {
    var top = y1;
    if (top - y0 < 0.08) return;
    var h = hot(role, focus);
    var hs = hot("header", focus);
    var cursor = a0;
    var sorted = holes.slice().sort(function (a, b) { return a.at - b.at; });
    function solid(a, b, yb, yt, roleName, ink, m, hh) {
      if (b - a < 0.04 || yt - yb < 0.04) return;
      var cap = roleName === "header" ? HEADER_C : INK;
      if (axis === "x") addBox(buf, a, yb, fixed - thick / 2, b, yt, fixed + thick / 2, ink, m, hh, 1, true, cap);
      else addBox(buf, fixed - thick / 2, yb, a, fixed + thick / 2, yt, b, ink, m, hh, 1, true, cap);
    }
    var i;
    for (i = 0; i < sorted.length; i++) {
      var hole = sorted[i];
      var lo = hole.at - hole.w / 2;
      var hi = hole.at + hole.w / 2;
      solid(cursor, Math.max(cursor, lo), y0, top, role, inkSide, mat, h);
      var sill = Math.min(top, hole.sill);
      if (sill > y0) solid(lo, hi, y0, sill, role, inkSide, mat, h);
      var beamTop = Math.min(top, hole.head + 0.62);
      if (beamTop > hole.head && top > hole.head) {
        solid(lo - 0.2, hi + 0.2, hole.head, beamTop, "header", HEADER_C, HEADER_C, hs || h * 0.15);
        if (top > beamTop) solid(lo, hi, beamTop, top, role, inkSide, mat, h);
      }
      if (hole.sill < 0.2 && focus !== "header" && beamTop > 2) {
        /* door leaf fades in with materials; drawn by the caller via role door */
      }
      cursor = Math.max(cursor, hi);
    }
    solid(cursor, a1, y0, top, role, inkSide, mat, h);
    if (!studs) return;
    var studHot = hot("stud", focus);
    var plateHot = hot("plate", focus);
    solid(a0, a1, y0, Math.min(top, y0 + 0.22), "plate", STUD_C, STUD_C, plateHot);
    if (top - y0 > 1.2) solid(a0, a1, top - 0.2, top, "plate", STUD_C, STUD_C, plateHot);
    var at;
    var outward = outSign || 1;
    var face = fixed + outward * (thick / 2 + 0.02);
    var outer = face + outward * 0.38;
    var s0 = Math.min(face, outer);
    var s1 = Math.max(face, outer);
    for (at = a0 + 0.9; at < a1 - 0.4; at += 1.65) {
      if (inHole(at, sorted)) continue;
      var studTop = Math.max(y0 + 0.3, top - 0.22);
      if (studTop - (y0 + 0.22) < 0.4) continue;
      if (axis === "x") addBox(buf, at, y0 + 0.22, s0, at + 0.28, studTop, s1, INK, STUD_C, studHot, 1, true, INK);
      else addBox(buf, s0, y0 + 0.22, at, s1, studTop, at + 0.28, INK, STUD_C, studHot, 1, true, INK);
    }
  }

  function addGlass(buf, axis, fixed, hole, thick, focus) {
    var h = 0;
    var ink = PAPER;
    var y0 = hole.sill + 0.06;
    var y1 = hole.head - 0.06;
    if (y1 - y0 < 0.2) return;
    var a = hole.at - hole.w / 2 + 0.08;
    var b = hole.at + hole.w / 2 - 0.08;
    if (axis === "x") addBox(buf, a, y0, fixed - 0.04, b, y1, fixed + 0.04, ink, GLASS_C, h, 0.38, true);
    else addBox(buf, fixed - 0.04, y0, a, fixed + 0.04, y1, b, ink, GLASS_C, h, 0.38, true);
    if (thick) { /* thickness kept for call symmetry */ }
    if (focus) { /* glass is never the highlighted part */ }
  }

  function addStairs(buf, yBase, rise, focus, limit) {
    var h = hot("stair", focus);
    var n = 12;
    var i;
    var run = 7.2 / n;
    var step = rise / n;
    for (i = 0; i < n; i++) {
      var yb = yBase + i * step;
      if (yb >= limit - 0.02) continue;
      var yt = Math.min(limit, yBase + (i + 1) * step);
      if (yt - yb < 0.04) continue;
      var z0 = 16.5 + i * run;
      addBox(buf, 29.1, yb, z0, 35.1, yt, z0 + run * 0.92, INK, OAK, h, 1, true, INK);
    }
  }

  function addRoof(buf, eave, ridge, focus) {
    var h = hot("roof", focus);
    var x0 = -1.15;
    var x1 = 37.15;
    var zMid = 13;
    var ink = [0.16, 0.17, 0.18];
    addFace(buf,
      [x0, eave, -1.15], [x1, eave, -1.15], [x1, ridge, zMid], [x0, ridge, zMid],
      [0, zMid + 1.15, ridge - eave], ink, ROOF_C, h, 1);
    addFace(buf,
      [x1, eave, 27.15], [x0, eave, 27.15], [x0, ridge, zMid], [x1, ridge, zMid],
      [0, 27.15 - zMid, ridge - eave], ink, ROOF_C, h, 1);
    addFace(buf,
      [x0, eave, -1.15], [x0, ridge, zMid], [x0, eave, 27.15], [x0, eave - 0.02, 27.15],
      [-1, 0, 0], ink, ROOF_C, h, 1);
    addFace(buf,
      [x1, ridge, zMid], [x1, eave, -1.15], [x1, eave, 27.15], [x1, eave - 0.02, -1.15],
      [1, 0, 0], ink, ROOF_C, h, 1);
  }

  function cone(buf, x, z, radius, height) {
    var seg = 7;
    var i;
    for (i = 0; i < seg; i++) {
      var a0 = (i / seg) * Math.PI * 2;
      var a1 = ((i + 1) / seg) * Math.PI * 2;
      addFace(buf,
        [x, height, z],
        [x + Math.cos(a1) * radius, 0, z + Math.sin(a1) * radius],
        [x + Math.cos(a0) * radius, 0, z + Math.sin(a0) * radius],
        [x + Math.cos(a0) * radius, 0, z + Math.sin(a0) * radius],
        [Math.cos((a0 + a1) / 2), 0.4, Math.sin((a0 + a1) / 2)],
        TREE, TREE, 0, 1);
    }
  }

  function buildGeometry(p, focus) {
    var state = sceneState(p);
    var solid = makeBuf();
    var glass = makeBuf();
    var showStuds = state.studs || focus === "framing";
    var southHoles = [
      { at: 6.2, w: 4.2, sill: 2.55, head: 7.05 },
      { at: 14.2, w: 3.05, sill: 0, head: 7.2 },
      { at: 27.4, w: 5, sill: 2.55, head: 7.05 }
    ];
    var northHoles = [
      { at: 10, w: 4, sill: 2.7, head: 6.9 },
      { at: 24, w: 3.1, sill: 3.3, head: 6.6 }
    ];
    var westHoles = [{ at: 18.2, w: 3.4, sill: 2.7, head: 6.9 }];
    var eastHoles = [
      { at: 8, w: 3.6, sill: 2.55, head: 7.05 },
      { at: 20.6, w: 3.3, sill: 1.4, head: 7.2 }
    ];
    var crossHoles = [
      { at: 10, w: 2.7, sill: 0, head: 7 },
      { at: 31.4, w: 2.7, sill: 0, head: 7 }
    ];
    var splitHoles = [{ at: 7.2, w: 2.7, sill: 0, head: 7 }];

    addBox(solid, -2.2, -0.55, -3.2, 38.2, 0.015, 28.2, PAD, [0.45, 0.42, 0.38], hot("foundation", focus), 1, true, PAD);
    addBox(solid, -8, -0.62, -10, 46, -0.04, 38, PAPER, GREEN, 0, 1, true, PAPER);
    addBox(solid, 0.08, 0.03, 0.08, 35.92, 0.07, 25.92, PAPER, OAK, 0, 1, true, PAPER);
    addBox(solid, 10, 0.07, -3.2, 18.6, 0.22, 0.02, SIDE, [0.5, 0.48, 0.44], 0, 1, true, SIDE);

    var yTop = state.wallH;
    wallStrip(solid, "x", 0.36, 0, 36, 0, yTop, 0.72, southHoles, "bearing", SIDE, CEDAR, focus, showStuds, -1);
    wallStrip(solid, "x", 25.64, 0, 36, 0, yTop, 0.72, northHoles, "bearing", SIDE, CEDAR, focus, showStuds, 1);
    wallStrip(solid, "z", 0.36, 0.72, 25.28, 0, yTop, 0.72, westHoles, "bearing", SIDE, CEDAR, focus, showStuds, -1);
    wallStrip(solid, "z", 35.64, 0.72, 25.28, 0, yTop, 0.72, eastHoles, "bearing", SIDE, CEDAR, focus, showStuds, 1);
    wallStrip(solid, "z", 20, 0.75, 25.25, 0, yTop, 0.42, splitHoles, "partition", SIDE, PLASTER, focus, false, 1);
    wallStrip(solid, "x", 15, 0.75, 35.25, 0, yTop, 0.42, crossHoles, "partition", SIDE, PLASTER, focus, false, 1);

    if (state.mat > 0.35 && yTop > 6.5) {
      addBox(solid, 13.05, 0.02, 0.15, 13.42, 7.05, 3.05, DOOR_C, DOOR_C, 0, 1, true);
    }
    if (state.mat > 0.2 && yTop > 4) {
      var g;
      var lists = [
        ["x", 0.36, southHoles],
        ["x", 25.64, northHoles],
        ["z", 0.36, westHoles],
        ["z", 35.64, eastHoles]
      ];
      for (g = 0; g < lists.length; g++) {
        var li;
        for (li = 0; li < lists[g][2].length; li++) {
          if (lists[g][2][li].sill < 0.2) continue;
          addGlass(glass, lists[g][0], lists[g][1], lists[g][2][li]);
        }
      }
    }

    if (state.wallH < 5.2) {
      var ti;
      for (ti = 0; ti < 12; ti++) {
        var tz = 16.5 + ti * (7.2 / 12);
        addBox(solid, 29.15, 0.08, tz, 35.05, 0.12, tz + 0.28, INK, OAK, hot("stair", focus), 1, true, INK);
      }
    } else {
      addStairs(solid, 0, 9, focus, state.wallH);
    }

    if (state.roof) {
      addRoof(solid, state.eave, state.ridge, focus);
      if (state.upper) {
        var uy0 = 9;
        var uy1 = state.eave;
        var uSouth = [{ at: 16, w: 4.4, sill: 11.2, head: 15.4 }];
        var uNorth = [{ at: 12, w: 3.6, sill: 11.3, head: 15.2 }];
        var uWest = [{ at: 20, w: 3.2, sill: 11.4, head: 15.1 }];
        var uEast = [
          { at: 10, w: 3.2, sill: 11.3, head: 15.2 },
          { at: 20.6, w: 3.3, sill: 11.1, head: 15.6 }
        ];
        wallStrip(solid, "x", 0.36, 0, 36, uy0, uy1, 0.72, uSouth, "structure", SIDE, CEDAR, focus, false);
        wallStrip(solid, "x", 25.64, 0, 36, uy0, uy1, 0.72, uNorth, "structure", SIDE, CEDAR, focus, false);
        wallStrip(solid, "z", 0.36, 0.72, 25.28, uy0, uy1, 0.72, uWest, "structure", SIDE, CEDAR, focus, false);
        wallStrip(solid, "z", 35.64, 0.72, 25.28, uy0, uy1, 0.72, uEast, "structure", SIDE, CEDAR, focus, false);
        addBox(solid, 0.8, 9.02, 0.8, 35.2, 9.16, 15.7, PAPER, OAK, hot("upperfloor", focus), 1, true);
        addBox(solid, 0.8, 9.02, 15.7, 28.4, 9.16, 25.2, PAPER, OAK, hot("upperfloor", focus), 1, true);
        if (state.mat > 0.45 && uy1 > 14) {
          addGlass(glass, "x", 0.36, uSouth[0]);
          addGlass(glass, "x", 25.64, uNorth[0]);
          addGlass(glass, "z", 0.36, uWest[0]);
          addGlass(glass, "z", 35.64, uEast[0]);
          addGlass(glass, "z", 35.64, uEast[1]);
        }
        addStairs(solid, 9, Math.max(0.4, (state.eave - 9) * 0.92), focus, state.eave);
        addBox(solid, -0.45, 8.72, -0.55, 36.45, 9.18, 26.55, [0.93, 0.9, 0.84], [0.9, 0.86, 0.78], hot("structure", focus), 1, true, [0.93, 0.9, 0.84]);
      }
    }

    if (state.trees) {
      cone(solid, -5.5, 8, 2.3, 11);
      cone(solid, 42.2, 18, 2.6, 13);
      cone(solid, 40, 4, 1.7, 8);
    }

    return { solid: solid, glass: glass, state: state };
  }

  var VS = [
    "attribute vec3 aPos;",
    "attribute vec3 aNrm;",
    "attribute vec3 aInk;",
    "attribute vec3 aMat;",
    "attribute float aHot;",
    "attribute float aAlpha;",
    "uniform mat4 uMvp;",
    "varying vec3 vPos;",
    "varying vec3 vN;",
    "varying vec3 vInk;",
    "varying vec3 vMat;",
    "varying float vHot;",
    "varying float vAlpha;",
    "void main(){",
    "  vPos=aPos; vN=aNrm; vInk=aInk; vMat=aMat; vHot=aHot; vAlpha=aAlpha;",
    "  gl_Position=uMvp*vec4(aPos,1.0);",
    "}"
  ].join("\n");

  var FS = [
    "precision mediump float;",
    "uniform float uMat;",
    "uniform float uDim;",
    "uniform vec3 uLight;",
    "uniform vec3 uPaper;",
    "varying vec3 vPos;",
    "varying vec3 vN;",
    "varying vec3 vInk;",
    "varying vec3 vMat;",
    "varying float vHot;",
    "varying float vAlpha;",
    "void main(){",
    "  vec3 n=normalize(vN);",
    "  float ndl=abs(dot(n,normalize(uLight)));",
    "  float ao=mix(0.76,1.0,smoothstep(0.0,2.6,vPos.y));",
    "  vec3 lit=vMat*(0.38+0.62*ndl)*ao;",
    "  vec3 col=mix(vInk,lit,uMat);",
    "  col=mix(col,uPaper,uDim*(1.0-vHot)*0.7);",
    "  col=mix(col,vec3(0.114,0.306,0.847),clamp(vHot,0.0,1.0)*0.92);",
    "  gl_FragColor=vec4(col,vAlpha);",
    "}"
  ].join("\n");

  function projectPoint(mvp, x, y, z, w, h) {
    var clipX = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
    var clipY = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
    var clipW = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
    if (clipW <= 0.05) return null;
    return [(clipX / clipW * 0.5 + 0.5) * w, (1 - (clipY / clipW * 0.5 + 0.5)) * h];
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
    var labels = root.querySelector(".sh-labels");
    var stageNodes = root.querySelectorAll(".sh-stages li");
    if (!canvas || !sheet || !track || !sticky) return;
    var gl = canvas.getContext("webgl", { alpha: false, antialias: true, depth: true, stencil: false, powerPreference: "low-power" });
    if (!gl) gl = canvas.getContext("experimental-webgl", { alpha: false, antialias: true, depth: true });
    if (!gl) return;

    function shader(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
      return sh;
    }
    var vs = shader(gl.VERTEX_SHADER, VS);
    var fs = shader(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    var loc = {
      pos: gl.getAttribLocation(prog, "aPos"),
      nrm: gl.getAttribLocation(prog, "aNrm"),
      ink: gl.getAttribLocation(prog, "aInk"),
      mat: gl.getAttribLocation(prog, "aMat"),
      hot: gl.getAttribLocation(prog, "aHot"),
      alpha: gl.getAttribLocation(prog, "aAlpha"),
      mvp: gl.getUniformLocation(prog, "uMvp"),
      matAmt: gl.getUniformLocation(prog, "uMat"),
      dim: gl.getUniformLocation(prog, "uDim"),
      light: gl.getUniformLocation(prog, "uLight"),
      paper: gl.getUniformLocation(prog, "uPaper")
    };
    var solidGl = gl.createBuffer();
    var glassGl = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(PAPER[0], PAPER[1], PAPER[2], 1);

    var labelNodes = [];
    if (labels) {
      var li;
      var items = ROOMS.concat([
        { name: "36 ft", x: 18, z: -1.7, dim: true },
        { name: "26 ft", x: -1.6, z: 13, dim: true }
      ]);
      for (li = 0; li < items.length; li++) {
        var node = document.createElement("span");
        node.className = "sh-label" + (items[li].dim ? " is-dim" : "");
        node.textContent = items[li].name;
        labels.appendChild(node);
        labelNodes.push({ node: node, x: items[li].x, z: items[li].z });
      }
    }

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
      if (!focusId) return true;
      for (s = 0; s < learnSets.length; s++) {
        if (learnSets[s].getAttribute("data-stage") !== stageId) continue;
        var buttons = learnSets[s].querySelectorAll(".sh-call");
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

    function drawBuffer(buffer, glBuf, alphaPass) {
      if (!buffer.n) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buffer.data.subarray(0, buffer.n), gl.DYNAMIC_DRAW);
      var stride = 56;
      gl.enableVertexAttribArray(loc.pos);
      gl.enableVertexAttribArray(loc.nrm);
      gl.enableVertexAttribArray(loc.ink);
      gl.enableVertexAttribArray(loc.mat);
      gl.enableVertexAttribArray(loc.hot);
      gl.enableVertexAttribArray(loc.alpha);
      gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(loc.nrm, 3, gl.FLOAT, false, stride, 12);
      gl.vertexAttribPointer(loc.ink, 3, gl.FLOAT, false, stride, 24);
      gl.vertexAttribPointer(loc.mat, 3, gl.FLOAT, false, stride, 36);
      gl.vertexAttribPointer(loc.hot, 1, gl.FLOAT, false, stride, 48);
      gl.vertexAttribPointer(loc.alpha, 1, gl.FLOAT, false, stride, 52);
      if (alphaPass) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
      }
      gl.drawArrays(gl.TRIANGLES, 0, buffer.n / 14);
      if (alphaPass) {
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
    }

    function draw() {
      scheduled = false;
      if (!running) return;
      var rect = sheet.getBoundingClientRect();
      var cssW = Math.max(1, rect.width);
      var cssH = Math.max(1, rect.height);
      var dpr = Math.min(window.devicePixelRatio || 1, cssW < 700 ? 1.5 : 2);
      var bw = Math.max(1, Math.round(cssW * dpr));
      var bh = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      var p = progress();
      var stage = stageAt(p);
      var cam = cameraFor(p, cssW / cssH);
      var built = buildGeometry(p, focusId);
      var view = lookAt(cam.eye, cam.look, cam.up);
      var proj = perspective(cam.fov, cssW / Math.max(1, cssH), 0.08, 500);
      var mvp = mul(proj, view);
      gl.viewport(0, 0, bw, bh);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.mvp, false, mvp);
      gl.uniform1f(loc.matAmt, built.state.mat);
      gl.uniform1f(loc.dim, focusId ? 1 : 0);
      gl.uniform3f(loc.light, -0.35, 0.82, -0.45);
      gl.uniform3f(loc.paper, PAPER[0], PAPER[1], PAPER[2]);
      drawBuffer(built.solid, solidGl, false);
      drawBuffer(built.glass, glassGl, true);
      var showLabels = cam.steep > 0.72;
      root.classList.toggle("is-plan", showLabels);
      var n;
      for (n = 0; n < labelNodes.length; n++) {
        var item = labelNodes[n];
        var pt = showLabels ? projectPoint(mvp, item.x, 0.4, item.z, cssW, cssH) : null;
        if (!pt || pt[0] < 8 || pt[1] < 8 || pt[0] > cssW - 8 || pt[1] > cssH - 8) {
          item.node.style.display = "none";
        } else {
          item.node.style.display = "block";
          item.node.style.left = pt[0].toFixed(1) + "px";
          item.node.style.top = pt[1].toFixed(1) + "px";
        }
      }
      if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
      root.classList.toggle("is-scrolled", p > 0.04);
      root.classList.toggle("is-late", p > 0.8);
      root.classList.add("is-drawn");
      if (stage.id !== current) {
        current = stage.id;
        if (line) line.textContent = stage.line;
        for (n = 0; n < stageNodes.length; n++) {
          var on = stageNodes[n].getAttribute("data-stage") === stage.id;
          stageNodes[n].classList.toggle("is-on", on);
          if (on) stageNodes[n].setAttribute("aria-current", "step");
          else stageNodes[n].removeAttribute("aria-current");
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
    if (window.ResizeObserver) new ResizeObserver(requestDraw).observe(sheet);
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        running = entries.some(function (entry) { return entry.isIntersecting; });
        if (running) requestDraw();
      }).observe(track);
    }
    requestDraw();
  }

  return {
    mount: mount,
    stageAt: stageAt,
    sceneState: sceneState,
    cameraFor: cameraFor,
    buildGeometry: buildGeometry,
    projectPoint: projectPoint,
    lookAt: lookAt,
    perspective: perspective,
    mul: mul,
    STAGES: STAGES,
    PAPER: PAPER,
    HL: HL
  };
});
