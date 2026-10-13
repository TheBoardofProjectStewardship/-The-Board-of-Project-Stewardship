/**
 * Scroll massing of the supplied house plan.
 *
 * The footprint follows the main-floor and upper-floor sheets: a two-story
 * house about 42 ft wide, a 22 by 19 ft garage, the breezeway between them,
 * and the rooms named on those sheets. The exterior follows the front
 * elevation and the axonometric: a front gable with board-and-batten, lap
 * siding, a dormer, a porch, a balcony, and a garage gable. Sizes are the
 * about-dimensions from those drawings, not a stamped survey.
 *
 * casa-serra publishes no license, so none of its code or assets are used.
 * The cut-from-above idea follows that project's public starter prompt.
 * This file is an original line-drawing massing, not a copy of the sheets.
 */
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") api.mount();
})(function () {
  "use strict";

  var PAPER = [0.973, 0.969, 0.961];
  var INK = [0.16, 0.16, 0.17];
  var SIDE = [0.9, 0.89, 0.87];
  var PAD = [0.82, 0.81, 0.78];
  var FLOOR_C = [0.94, 0.93, 0.91];
  var ROOF_C = [0.75, 0.74, 0.71];
  var ROOF_INK = [0.45, 0.44, 0.42];
  var GLASS_C = [0.72, 0.8, 0.84];
  var WOOD = [0.55, 0.5, 0.44];
  var SHADOW = [0.62, 0.61, 0.58];

  var STAGES = [
    { id: "plan", line: "The main floor, cut flat and seen from above.", until: 0.16 },
    { id: "walls", line: "The main-floor walls rise off the drawing.", until: 0.36 },
    { id: "upper", line: "The upper floor stacks on.", until: 0.56 },
    { id: "shell", line: "Roofs, siding, and windows come in.", until: 0.78 },
    { id: "massing", line: "The finished house, in the massing view.", until: 2 }
  ];

  /* Plan orientation matches the sheet: garage on the left, street at high Z
     (top of the plan), patio toward low Z. The front elevation looks back
     at that street face, so its left and right swap. */
  var ROOMS = [
    { name: "Garage", x: 11, z: 22 },
    { name: "Mech", x: 36, z: 26.5 },
    { name: "Stair", x: 36.5, z: 15 },
    { name: "Kitchen", x: 49, z: 25.5 },
    { name: "Dining", x: 49, z: 14 },
    { name: "Living", x: 64, z: 16 },
    { name: "Powder", x: 59, z: 28.2, minor: true },
    { name: "Mud", x: 59, z: 23.5, minor: true },
    { name: "Entry", x: 67, z: 27.5 },
    { name: "Office", x: 64, z: 5 },
    { name: "Storage", x: 49, z: 4.5, minor: true },
    { name: "Patio", x: 52, z: -4.5 }
  ];

  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function hypot3(x, y, z) { return Math.hypot(x, y, z) || 1; }

  function stageAt(p) {
    var i;
    for (i = 0; i < STAGES.length; i++) if (p < STAGES[i].until) return STAGES[i];
    return STAGES[STAGES.length - 1];
  }

  function sceneState(p) {
    return {
      p: p,
      wallH: lerp(0.45, 9, smooth((p - 0.04) / 0.2)),
      upper: smooth((p - 0.36) / 0.16),
      shell: smooth((p - 0.56) / 0.14),
      studs: p >= 0.16 && p < 0.4
    };
  }

  function frameFov(distance, aspect) {
    var v = 2 * Math.atan(30 / distance);
    var h = 2 * Math.atan(44 / distance);
    var vFromH = 2 * Math.atan(Math.tan(h / 2) / Math.max(0.35, aspect));
    return Math.max(v, vFromH) * 180 / Math.PI;
  }

  function cameraFor(p, aspect) {
    var keys = [
      { p: 0, eye: [36, 340, 14], look: [36, 0, 14], fov: 8 },
      { p: 0.12, eye: [36, 340, 14], look: [36, 0, 14], fov: 8 },
      { p: 0.26, eye: [-12, 28, 78], look: [40, 4, 16], fov: 36 },
      { p: 0.48, eye: [-18, 34, 82], look: [44, 10, 15], fov: 32 },
      { p: 0.7, eye: [-24, 42, 88], look: [44, 11, 14], fov: 30 },
      { p: 0.92, eye: [-28, 46, 94], look: [42, 10, 14], fov: 28 },
      { p: 1, eye: [-24, 44, 90], look: [42, 10, 14], fov: 28 }
    ];
    var i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].p) i++;
    var a = keys[i];
    var b = keys[i + 1];
    var t = smooth((p - a.p) / ((b.p - a.p) || 1));
    var eye = lerp3(a.eye, b.eye, t);
    var look = lerp3(a.look, b.look, t);
    var fov = lerp(a.fov, b.fov, t);
    if (p < 0.12) {
      eye = [36, 340, 14];
      look = [36, 0, 14];
      fov = frameFov(340, aspect || 1.6);
    } else if (aspect && aspect < 1.15) {
      fov = fov * Math.min(1.45, 1.15 / aspect);
    }
    var dx = look[0] - eye[0];
    var dy = look[1] - eye[1];
    var dz = look[2] - eye[2];
    var steep = clamp01((-dy / hypot3(dx, dy, dz) - 0.42) / 0.4);
    var overhead = p < 0.12 ? 1 : clamp01((0.17 - p) / 0.05);
    var up = [0, 1 - overhead, -overhead];
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
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  function hot(role, focus) {
    if (!focus) return 0;
    if (role === focus) return 1;
    if (focus === "foundation" && (role === "foundation" || role === "bearing")) return 1;
    if (focus === "structure" && (role === "structure" || role === "upperfloor" || role === "balcony")) return 1;
    if (focus === "framing" && (role === "stud" || role === "plate")) return 1;
    if (focus === "stairs" && role === "stair") return 1;
    if (focus === "header" && role === "header") return 1;
    if (focus === "porch" && role === "porch") return 1;
    if (focus === "balcony" && role === "balcony") return 1;
    if (focus === "roof" && role === "roof") return 1;
    return 0;
  }

  function makeBuf() { return { n: 0, data: new Float32Array(16 * 8192) }; }

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
    var ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2];
    var bx = d[0] - a[0], by = d[1] - a[1], bz = d[2] - a[2];
    var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    var p0 = a, p1 = b, p2 = c, p3 = d;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
      p1 = d; p3 = b; nx = -nx; ny = -ny; nz = -nz;
    }
    var len = hypot3(nx, ny, nz);
    nx /= len; ny /= len; nz /= len;
    pushTri(buf, p0, p1, p2, nx, ny, nz, ink, mat, h, alpha);
    pushTri(buf, p0, p2, p3, nx, ny, nz, ink, mat, h, alpha);
  }

  function line(buf, a, b) {
    var i = buf.n;
    if (i + 6 > buf.data.length) {
      var next = new Float32Array(buf.data.length * 2);
      next.set(buf.data);
      buf.data = next;
    }
    var d = buf.data;
    d[i] = a[0]; d[i + 1] = a[1]; d[i + 2] = a[2];
    d[i + 3] = b[0]; d[i + 4] = b[1]; d[i + 5] = b[2];
    buf.n = i + 6;
  }

  function addBox(solid, lines, x0, y0, z0, x1, y1, z1, ink, mat, h, alpha, skipBottom, capInk) {
    if (x1 < x0) { var tx = x0; x0 = x1; x1 = tx; }
    if (y1 < y0) { var ty = y0; y0 = y1; y1 = ty; }
    if (z1 < z0) { var tz = z0; z0 = z1; z1 = tz; }
    if (x1 - x0 < 0.02 || y1 - y0 < 0.02 || z1 - z0 < 0.02) return;
    var topInk = capInk || ink;
    addFace(solid, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], topInk, mat, h, alpha);
    if (!skipBottom) addFace(solid, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], ink, mat, h, alpha);
    addFace(solid, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], ink, mat, h, alpha);
    addFace(solid, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], ink, mat, h, alpha);
    addFace(solid, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], ink, mat, h, alpha);
    addFace(solid, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], ink, mat, h, alpha);
    if (!lines || alpha < 0.9) return;
    var yb = y0 + 0.02;
    var yt = y1 + 0.03;
    line(lines, [x0, yt, z0], [x1, yt, z0]);
    line(lines, [x1, yt, z0], [x1, yt, z1]);
    line(lines, [x1, yt, z1], [x0, yt, z1]);
    line(lines, [x0, yt, z1], [x0, yt, z0]);
    line(lines, [x0, yb, z0], [x0, yt, z0]);
    line(lines, [x1, yb, z0], [x1, yt, z0]);
    line(lines, [x1, yb, z1], [x1, yt, z1]);
    line(lines, [x0, yb, z1], [x0, yt, z1]);
  }

  function inHole(at, holes) {
    var i;
    for (i = 0; i < holes.length; i++) if (Math.abs(at - holes[i].at) < holes[i].w * 0.5) return true;
    return false;
  }

  function wallStrip(solid, lines, axis, fixed, a0, a1, y0, y1, thick, holes, role, focus, studs, outSign) {
    var top = y1;
    if (top - y0 < 0.08) return;
    var h = hot(role, focus);
    var hs = hot("header", focus);
    var sorted = holes.slice().sort(function (a, b) { return a.at - b.at; });
    var cursor = a0;
    function solidBox(a, b, yb, yt, hh, cap) {
      if (b - a < 0.04 || yt - yb < 0.04) return;
      if (axis === "x") addBox(solid, lines, a, yb, fixed - thick / 2, b, yt, fixed + thick / 2, SIDE, SIDE, hh, 1, true, cap || INK);
      else addBox(solid, lines, fixed - thick / 2, yb, a, fixed + thick / 2, yt, b, SIDE, SIDE, hh, 1, true, cap || INK);
    }
    var i;
    for (i = 0; i < sorted.length; i++) {
      var hole = sorted[i];
      var lo = hole.at - hole.w / 2;
      var hi = hole.at + hole.w / 2;
      solidBox(cursor, Math.max(cursor, lo), y0, top, h);
      if (hole.sill > y0) solidBox(lo, hi, y0, Math.min(top, hole.sill), h);
      var beamTop = Math.min(top, hole.head + 0.55);
      if (top > hole.head && beamTop > hole.head) {
        solidBox(lo - 0.25, hi + 0.25, hole.head, beamTop, hs, hs ? INK : WOOD);
        if (top > beamTop) solidBox(lo, hi, beamTop, top, h);
      }
      cursor = Math.max(cursor, hi);
    }
    solidBox(cursor, a1, y0, top, h);
    if (!studs) return;
    var studHot = hot("stud", focus);
    var outward = outSign || 1;
    var face = fixed + outward * (thick / 2 + 0.04);
    var outer = face + outward * 0.22;
    var s0 = Math.min(face, outer);
    var s1 = Math.max(face, outer);
    var at;
    for (at = a0 + 1.1; at < a1 - 0.5; at += 1.8) {
      if (inHole(at, sorted)) continue;
      var studTop = top - 0.2;
      if (studTop < y0 + 1) continue;
      if (axis === "x") addBox(solid, lines, at, y0 + 0.2, s0, at + 0.16, studTop, s1, INK, WOOD, studHot, 1, true, INK);
      else addBox(solid, lines, s0, y0 + 0.2, at, s1, studTop, at + 0.16, INK, WOOD, studHot, 1, true, INK);
    }
  }

  function addGlass(buf, axis, fixed, hole) {
    var y0 = hole.sill + 0.08;
    var y1 = hole.head - 0.08;
    if (y1 - y0 < 0.2) return;
    var a = hole.at - hole.w / 2 + 0.1;
    var b = hole.at + hole.w / 2 - 0.1;
    if (axis === "x") addBox(buf, null, a, y0, fixed - 0.05, b, y1, fixed + 0.05, PAPER, GLASS_C, 0, 0.4, true, PAPER);
    else addBox(buf, null, fixed - 0.05, y0, a, fixed + 0.05, y1, b, PAPER, GLASS_C, 0, 0.4, true, PAPER);
  }

  function addTri(buf, a, b, c, hint, ink, mat, h) {
    var ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2];
    var bx = c[0] - a[0], by = c[1] - a[1], bz = c[2] - a[2];
    var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
      var swap = b; b = c; c = swap; nx = -nx; ny = -ny; nz = -nz;
    }
    var len = hypot3(nx, ny, nz);
    nx /= len; ny /= len; nz /= len;
    pushTri(buf, a, b, c, nx, ny, nz, ink, mat, h, 1);
  }

  /* Ridge runs left-right. The right end is a gable; hipRun pulls the
     ridge back from the left end so that end is a hip. */
  function addMainRoof(solid, lines, x0, x1, z0, z1, eave, ridgeY, hipRun, focus) {
    var h = hot("roof", focus);
    var mid = (z0 + z1) / 2;
    var ridgeX0 = x0 + hipRun;
    addFace(solid, [x0, eave, z1], [x1, eave, z1], [x1, ridgeY, mid], [ridgeX0, ridgeY, mid], [0, 0.65, 1], ROOF_INK, ROOF_C, h, 1);
    addFace(solid, [x1, eave, z0], [x0, eave, z0], [ridgeX0, ridgeY, mid], [x1, ridgeY, mid], [0, 0.65, -1], ROOF_INK, ROOF_C, h, 1);
    addTri(solid, [x0, eave, z0], [x0, eave, z1], [ridgeX0, ridgeY, mid], [-1, 0.4, 0], ROOF_INK, ROOF_C, h);
    addTri(solid, [x1, eave, z1], [x1, eave, z0], [x1, ridgeY, mid], [1, 0, 0], SIDE, SIDE, h);
    line(lines, [ridgeX0, ridgeY + 0.05, mid], [x1, ridgeY + 0.05, mid]);
    line(lines, [x0, eave + 0.04, z1], [x1, eave + 0.04, z1]);
    line(lines, [x0, eave + 0.04, z0], [x1, eave + 0.04, z0]);
    line(lines, [x0, eave + 0.04, z0], [ridgeX0, ridgeY + 0.05, mid]);
    line(lines, [x0, eave + 0.04, z1], [ridgeX0, ridgeY + 0.05, mid]);
    line(lines, [x1, eave + 0.04, z0], [x1, ridgeY + 0.05, mid]);
    line(lines, [x1, eave + 0.04, z1], [x1, ridgeY + 0.05, mid]);
    var z;
    var half = (z1 - z0) / 2;
    for (z = z0 + 1.3; z < z1 - 0.6; z += 1.35) {
      var yTop = ridgeY - (ridgeY - eave) * (Math.abs(z - mid) / half);
      if (yTop < eave + 0.5) continue;
      line(lines, [x1 + 0.08, eave + 0.2, z], [x1 + 0.08, yTop - 0.08, z]);
    }
  }

  function addGarageRoof(solid, lines, x0, x1, z0, z1, eave, ridgeY, focus) {
    var h = hot("roof", focus);
    var mid = (z0 + z1) / 2;
    addFace(solid, [x0, eave, z1], [x1, eave, z1], [x1, ridgeY, mid], [x0, ridgeY, mid], [0, 0.7, 1], ROOF_INK, ROOF_C, h, 1);
    addFace(solid, [x1, eave, z0], [x0, eave, z0], [x0, ridgeY, mid], [x1, ridgeY, mid], [0, 0.7, -1], ROOF_INK, ROOF_C, h, 1);
    addTri(solid, [x0, eave, z0], [x0, eave, z1], [x0, ridgeY, mid], [-1, 0, 0], SIDE, SIDE, h);
    addTri(solid, [x1, eave, z1], [x1, eave, z0], [x1, ridgeY, mid], [1, 0, 0], SIDE, SIDE, h);
    line(lines, [x0, ridgeY + 0.05, mid], [x1, ridgeY + 0.05, mid]);
    line(lines, [x0, eave + 0.04, z1], [x1, eave + 0.04, z1]);
    line(lines, [x0, eave + 0.04, z0], [x1, eave + 0.04, z0]);
    line(lines, [x0, eave + 0.04, z0], [x0, ridgeY + 0.05, mid]);
    line(lines, [x0, eave + 0.04, z1], [x0, ridgeY + 0.05, mid]);
  }

  function addRail(solid, lines, x0, x1, z, y, focus, role) {
    var h = hot(role, focus);
    addBox(solid, lines, x0, y + 2.6, z - 0.08, x1, y + 2.85, z + 0.08, INK, INK, h, 1, true, INK);
    var x;
    for (x = x0; x <= x1 + 0.1; x += 4) {
      addBox(solid, lines, x, y, z - 0.08, x + 0.14, y + 2.7, z + 0.08, INK, INK, h, 1, true, INK);
    }
  }

  function buildGeometry(p, focus) {
    var state = sceneState(p);
    var solid = makeBuf();
    var glass = makeBuf();
    var lines = makeBuf();
    var yTop = state.wallH;
    var showStuds = state.studs || focus === "framing";
    var HX0 = 30;
    var HX1 = 72;
    var HZ0 = 0;
    var HZ1 = 32;
    var houseFront = [
      { at: 47, w: 4.2, sill: 2.3, head: 6.6 },
      { at: 58, w: 3.2, sill: 0, head: 7.1 },
      { at: 67, w: 3.4, sill: 2.4, head: 6.5 }
    ];
    var houseBack = [
      { at: 40, w: 3.6, sill: 2.5, head: 6.4 },
      { at: 64, w: 4.4, sill: 2.4, head: 6.6 }
    ];
    var houseLeft = [
      { at: 24, w: 3, sill: 0, head: 7 },
      { at: 27.5, w: 2.4, sill: 3.2, head: 5.6 }
    ];
    var houseRight = [
      { at: 6, w: 3.2, sill: 2.6, head: 6.2 },
      { at: 16, w: 3.6, sill: 2.2, head: 6.6 }
    ];
    var garageDoor = [{ at: 11, w: 16, sill: 0, head: 7 }];
    var gTop = Math.min(yTop, 9);

    addBox(solid, lines, -2, -0.45, -12, 76, 0.02, 42, PAD, PAD, hot("foundation", focus), 1, true, PAD);
    addBox(solid, null, HX0 + 0.5, 0.06, HZ0 + 0.5, HX1 - 0.5, 0.1, HZ1 - 0.5, PAPER, FLOOR_C, 0, 1, true, PAPER);
    addBox(solid, null, 0.5, 0.06, 13.5, 21.5, 0.1, 31.5, PAPER, FLOOR_C, 0, 1, true, PAPER);
    addBox(solid, null, 40, 0.07, -9.2, 64, 0.12, -0.15, PAPER, [0.84, 0.86, 0.8], 0, 1, true, PAPER);
    addBox(solid, null, 23.2, 0.08, 18, 28.8, 0.32, 28, [0.62, 0.66, 0.58], [0.7, 0.74, 0.66], 0, 1, true, [0.55, 0.58, 0.5]);

    wallStrip(solid, lines, "x", 31.68, HX0, HX1, 0, yTop, 0.64, houseFront, "bearing", focus, showStuds, 1);
    wallStrip(solid, lines, "x", 0.32, HX0, HX1, 0, yTop, 0.64, houseBack, "bearing", focus, showStuds, -1);
    wallStrip(solid, lines, "z", 30.32, 0.64, 31.36, 0, yTop, 0.64, houseLeft, "bearing", focus, showStuds, -1);
    wallStrip(solid, lines, "z", 71.68, 0.64, 31.36, 0, yTop, 0.64, houseRight, "bearing", focus, showStuds, 1);

    wallStrip(solid, lines, "z", 42, 0.7, 31.3, 0, yTop, 0.36, [{ at: 14, w: 2.8, sill: 0, head: 7 }, { at: 24, w: 2.6, sill: 0, head: 7 }], "partition", focus, false, 1);
    wallStrip(solid, lines, "x", 20, 42.2, 71.3, 0, yTop, 0.36, [{ at: 49, w: 2.8, sill: 0, head: 7 }, { at: 64, w: 2.8, sill: 0, head: 7 }], "partition", focus, false, 1);
    wallStrip(solid, lines, "z", 56, 20.2, 31.3, 0, yTop, 0.32, [{ at: 26, w: 2.6, sill: 0, head: 7 }], "partition", focus, false, 1);
    wallStrip(solid, lines, "z", 62, 22, 31.3, 0, yTop, 0.32, [{ at: 27.5, w: 2.4, sill: 0, head: 7 }], "partition", focus, false, 1);
    wallStrip(solid, lines, "x", 10, 30.6, 71.3, 0, yTop, 0.32, [{ at: 46, w: 2.6, sill: 0, head: 7 }, { at: 64, w: 2.6, sill: 0, head: 7 }], "partition", focus, false, 1);
    wallStrip(solid, lines, "z", 56, 0.6, 9.7, 0, yTop, 0.32, [{ at: 5, w: 2.4, sill: 0, head: 7 }], "partition", focus, false, 1);

    var goal = state.upper > 0.02 ? 9 + 9 * state.upper : Math.min(yTop, 9);
    var steps = 16;
    var rise = goal / steps;
    var s;
    for (s = 0; s < steps; s++) {
      var yb = s * rise;
      if (yb >= goal - 0.04) break;
      if (state.upper < 0.02 && yb >= yTop - 0.04) break;
      var yt = Math.min(goal, yb + rise);
      if (state.upper < 0.02) yt = Math.min(yt, yTop);
      if (yt - yb < 0.05) continue;
      addBox(solid, lines, 33.5, yb, 10.4 + s * 0.55, 39.4, yt, 10.9 + s * 0.55, INK, WOOD, hot("stair", focus), 1, true, INK);
    }
    addBox(solid, lines, 45.2, 0.12, 22.2, 52.4, Math.min(3.1, yTop), 26.2, INK, WOOD, 0, 1, true, INK);
    addBox(solid, lines, 66.2, 0.12, 17.2, 69.4, Math.min(4.2, yTop), 19.6, INK, INK, 0, 1, true, INK);

    if (yTop < 5) {
      addBox(solid, lines, 2.2, 0.12, 18, 9.2, 0.22, 28, INK, INK, 0, 1, true, INK);
      addBox(solid, lines, 12.8, 0.12, 18, 19.8, 0.22, 28, INK, INK, 0, 1, true, INK);
    }

    wallStrip(solid, lines, "x", 31.68, 0, 22, 0, gTop, 0.6, garageDoor, "bearing", focus, showStuds, 1);
    wallStrip(solid, lines, "x", 13.32, 0, 22, 0, gTop, 0.6, [], "bearing", focus, false, -1);
    wallStrip(solid, lines, "z", 0.32, 13.6, 31.4, 0, gTop, 0.6, [{ at: 22, w: 2.6, sill: 3.1, head: 5.4 }], "bearing", focus, showStuds, -1);
    wallStrip(solid, lines, "z", 21.68, 13.6, 31.4, 0, gTop, 0.6, [{ at: 22, w: 3, sill: 0, head: 7 }], "bearing", focus, false, 1);

    if (state.upper > 0.02) {
      var uy1 = 9 + 9 * state.upper;
      addBox(solid, lines, 30.4, 9.02, 0.4, 71.6, 9.18, 10.2, PAPER, FLOOR_C, hot("upperfloor", focus), 1, true, PAPER);
      addBox(solid, lines, 30.4, 9.02, 10.2, 32.6, 9.18, 20.2, PAPER, FLOOR_C, hot("upperfloor", focus), 1, true, PAPER);
      addBox(solid, lines, 40.2, 9.02, 10.2, 71.6, 9.18, 31.6, PAPER, FLOOR_C, hot("upperfloor", focus), 1, true, PAPER);
      addBox(solid, lines, 30.4, 9.02, 20.2, 71.6, 9.18, 31.6, PAPER, FLOOR_C, hot("upperfloor", focus), 1, true, PAPER);
      var uFront = [
        { at: 46, w: 3.6, sill: 11.5, head: 15.4 },
        { at: 60, w: 4.2, sill: 11.4, head: 15.6 }
      ];
      var uBack = [{ at: 58, w: 4, sill: 11.5, head: 15.3 }];
      var uRight = [{ at: 8, w: 3.2, sill: 11.6, head: 15.2 }, { at: 22, w: 3.4, sill: 11.5, head: 15.4 }];
      wallStrip(solid, lines, "x", 31.68, HX0, HX1, 9, uy1, 0.64, uFront, "structure", focus, false, 1);
      wallStrip(solid, lines, "x", 0.32, HX0, HX1, 9, uy1, 0.64, uBack, "structure", focus, false, -1);
      wallStrip(solid, lines, "z", 30.32, 0.64, 31.36, 9, uy1, 0.64, [], "structure", focus, false, -1);
      wallStrip(solid, lines, "z", 71.68, 0.64, 31.36, 9, uy1, 0.64, uRight, "structure", focus, false, 1);
      wallStrip(solid, lines, "x", 16, 42, 71.2, 9, uy1, 0.32, [{ at: 52, w: 2.6, sill: 9, head: 16 }], "partition", focus, false, 1);
      wallStrip(solid, lines, "z", 58, 16.2, 31.2, 9, uy1, 0.32, [{ at: 24, w: 2.6, sill: 9, head: 16 }], "partition", focus, false, 1);
      wallStrip(solid, lines, "z", 48, 0.6, 15.6, 9, uy1, 0.32, [{ at: 8, w: 2.4, sill: 9, head: 16 }], "partition", focus, false, 1);
      wallStrip(solid, lines, "x", 8, 48.2, 71.2, 9, uy1, 0.28, [], "partition", focus, false, 1);
      addBox(solid, lines, 44, 9.06, 32.15, 66, 9.24, 37.4, SIDE, FLOOR_C, hot("balcony", focus), 1, true, FLOOR_C);
      if (uy1 > 11.5) {
        addRail(solid, lines, 44.2, 65.8, 37.1, 9.24, focus, "balcony");
        addRail(solid, lines, 44.2, 44.35, 32.3, 9.24, focus, "balcony");
        addRail(solid, lines, 65.6, 65.75, 32.3, 9.24, focus, "balcony");
      }
      if (state.shell > 0.25 && uy1 > 14) {
        addGlass(glass, "x", 31.68, uFront[0]);
        addGlass(glass, "x", 31.68, uFront[1]);
        addGlass(glass, "x", 0.32, uBack[0]);
        addGlass(glass, "z", 71.68, uRight[0]);
      }
    }

    if (state.shell > 0.04) {
      addMainRoof(solid, lines, 29.2, 73.2, -1.1, 33.4, 18, 25.4, 8, focus);
      addGarageRoof(solid, lines, -0.6, 22.6, 12.6, 32.8, 9.15, 13.4, focus);
      addBox(solid, lines, 22.2, 8.7, 18.2, 29.8, 9.05, 28.2, ROOF_INK, ROOF_C, hot("roof", focus), 1, true, ROOF_C);
      addBox(solid, lines, 52, 20.6, 24.5, 60.5, 23.6, 31.2, SIDE, SIDE, hot("roof", focus), 1, true, SIDE);
      addGarageRoof(solid, lines, 51.6, 60.9, 24.2, 31.6, 23.4, 25.8, focus);
      addBox(solid, lines, 42, 0.14, 32.2, 68, 0.4, 38.2, SIDE, FLOOR_C, hot("porch", focus), 1, true, FLOOR_C);
      addBox(solid, lines, 42, 8.15, 32.15, 68, 8.5, 38.4, ROOF_INK, ROOF_C, hot("porch", focus), 1, true, ROOF_C);
      addBox(solid, lines, 43.1, 0.4, 37.3, 43.45, 8.2, 37.65, INK, INK, hot("porch", focus), 1, true, INK);
      addBox(solid, lines, 66.4, 0.4, 37.3, 66.75, 8.2, 37.65, INK, INK, hot("porch", focus), 1, true, INK);
      addRail(solid, lines, 43.4, 66.3, 37.9, 0.4, focus, "porch");
      if (state.shell > 0.3) {
        addGlass(glass, "x", 31.68, houseFront[0]);
        addGlass(glass, "x", 31.68, houseFront[2]);
        addGlass(glass, "x", 0.32, houseBack[0]);
        addGlass(glass, "x", 0.32, houseBack[1]);
        addGlass(glass, "z", 71.68, houseRight[0]);
        addGlass(glass, "z", 71.68, houseRight[1]);
        addGlass(glass, "z", 0.32, { at: 22, w: 2.6, sill: 3.1, head: 5.4 });
        addBox(solid, null, 3.2, 0.2, 31.15, 18.8, 6.85, 31.55, [0.78, 0.78, 0.76], [0.82, 0.82, 0.8], hot("header", focus) * 0.15, 1, true);
      }
      var yy;
      for (yy = 1.15; yy < 8.3; yy += 0.85) {
        line(lines, [30.15, yy, 32.08], [71.85, yy, 32.08]);
        line(lines, [72.08, yy, 0.3], [72.08, yy, 31.7]);
        line(lines, [0.05, yy, 13.5], [0.05, yy, 31.6]);
      }
      for (yy = 10.2; yy < 17.2; yy += 0.85) {
        line(lines, [30.15, yy, 32.08], [71.85, yy, 32.08]);
        line(lines, [72.08, yy, 0.3], [72.08, yy, 31.7]);
      }
    }

    if (state.shell > 0.2) {
      addBox(glass, null, 2, 0.025, -6, 80, 0.045, 46, SHADOW, SHADOW, 0, 0.22, true, SHADOW);
    }

    return { solid: solid, glass: glass, lines: lines, state: state };
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
    "  vec3 lit=vMat*(0.72+0.28*ndl);",
    "  vec3 col=mix(vInk,lit,uMat);",
    "  col=mix(col,uPaper,uDim*(1.0-vHot)*0.55);",
    "  col=mix(col,vec3(0.12,0.28,0.72),clamp(vHot,0.0,1.0)*0.88);",
    "  gl_FragColor=vec4(col,vAlpha);",
    "}"
  ].join("\n");

  var LVS = "attribute vec3 aPos; uniform mat4 uMvp; void main(){ gl_Position=uMvp*vec4(aPos,1.0); }";
  var LFS = "precision mediump float; uniform vec3 uColor; void main(){ gl_FragColor=vec4(uColor,1.0); }";

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
    var lineEl = root.querySelector(".scroll-house-line");
    var bar = root.querySelector(".sh-progress > span");
    var labels = root.querySelector(".sh-labels");
    var stageNodes = root.querySelectorAll(".sh-stages li");
    if (!canvas || !sheet || !track || !sticky) return;
    var gl = canvas.getContext("webgl", { alpha: false, antialias: true, depth: true, stencil: false, powerPreference: "low-power" });
    if (!gl) return;

    function shader(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
      return sh;
    }
    function program(vsSrc, fsSrc) {
      var vs = shader(gl.VERTEX_SHADER, vsSrc);
      var fs = shader(gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      var prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
      return prog;
    }
    var prog = program(VS, FS);
    var lineProg = program(LVS, LFS);
    if (!prog || !lineProg) return;
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
    var lpos = gl.getAttribLocation(lineProg, "aPos");
    var lmvp = gl.getUniformLocation(lineProg, "uMvp");
    var lcolor = gl.getUniformLocation(lineProg, "uColor");
    var solidGl = gl.createBuffer();
    var glassGl = gl.createBuffer();
    var lineGl = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(PAPER[0], PAPER[1], PAPER[2], 1);

    var labelNodes = [];
    if (labels) {
      var items = ROOMS.concat([{ name: "42 ft", x: 51, z: 35.2, dim: true }, { name: "22 ft", x: 11, z: 35.2, dim: true }]);
      var li;
      for (li = 0; li < items.length; li++) {
        var node = document.createElement("span");
        node.className = "sh-label" + (items[li].dim ? " is-dim" : "");
        node.textContent = items[li].name;
        labels.appendChild(node);
        labelNodes.push({ node: node, x: items[li].x, z: items[li].z, minor: !!items[li].minor });
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
      for (i = 0; i < learnSets.length; i++) learnSets[i].hidden = learnSets[i].getAttribute("data-stage") !== stageId;
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

    function bindAttribs() {
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
    }

    function drawBuffer(buffer, glBuf, alphaPass) {
      if (!buffer.n) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buffer.data.subarray(0, buffer.n), gl.DYNAMIC_DRAW);
      bindAttribs();
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
      var mvp = mul(perspective(cam.fov, cssW / Math.max(1, cssH), 0.08, 600), lookAt(cam.eye, cam.look, cam.up));
      if (p < 0.13) {
        mvp[1] = -mvp[1];
        mvp[5] = -mvp[5];
        mvp[9] = -mvp[9];
        mvp[13] = -mvp[13];
      }
      gl.viewport(0, 0, bw, bh);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.mvp, false, mvp);
      gl.uniform1f(loc.matAmt, built.state.shell);
      gl.uniform1f(loc.dim, focusId ? 1 : 0);
      gl.uniform3f(loc.light, -0.45, 0.75, -0.4);
      gl.uniform3f(loc.paper, PAPER[0], PAPER[1], PAPER[2]);
      drawBuffer(built.solid, solidGl, false);
      drawBuffer(built.glass, glassGl, true);
      if (built.lines.n) {
        gl.useProgram(lineProg);
        gl.uniformMatrix4fv(lmvp, false, mvp);
        gl.uniform3f(lcolor, 0.15, 0.15, 0.16);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineGl);
        gl.bufferData(gl.ARRAY_BUFFER, built.lines.data.subarray(0, built.lines.n), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(lpos);
        gl.vertexAttribPointer(lpos, 3, gl.FLOAT, false, 12, 0);
        gl.drawArrays(gl.LINES, 0, built.lines.n / 3);
      }
      var showLabels = cam.steep > 0.72;
      root.classList.toggle("is-plan", showLabels);
      var n;
      for (n = 0; n < labelNodes.length; n++) {
        var item = labelNodes[n];
        var pt = showLabels && !(item.minor && cssW < 720) ? projectPoint(mvp, item.x, 0.5, item.z, cssW, cssH) : null;
        if (!pt || pt[0] < 4 || pt[1] < 4 || pt[0] > cssW - 4 || pt[1] > cssH - 4) item.node.style.display = "none";
        else {
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
        if (lineEl) lineEl.textContent = stage.line;
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
    PAPER: PAPER
  };
});
