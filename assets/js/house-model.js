/* House model engine: interactive line-drawing models of Pacific Pro Group projects.
   One shared renderer, camera, layer stages and controls. Each project is either a data
   config (walls, openings, rooms, roof, fixtures in plan feet) read by buildFromConfig,
   or a registered builder with its own camera profile (Magnolia).
   Use one model per page: the active project profile is page-wide. */
(function (factory) {
  var existing = typeof globalThis !== "undefined" && globalThis.HouseModel;
  var api = existing && existing.version === "3.0.0" ? existing : factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof globalThis !== "undefined") globalThis.HouseModel = api;
  if (typeof document !== "undefined") {
    var start = function () { api.mount(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(function () {
// ---------------------------------------------------------------------------------------
// Projects and the data-driven builder
// ---------------------------------------------------------------------------------------
var PROJECTS = {};
var PROFILE = null;
function register(id, def) {
  PROJECTS[id] = def && typeof def.build === "function" ? def : profileFor(def);
  // Optional per-project render settings (antialias, full device pixel ratio); other projects keep the defaults.
  if (def && def.render && !PROJECTS[id].render) PROJECTS[id].render = def.render;
  return PROJECTS[id];
}

const C_WALL = [0.941,0.925,0.886], C_FLOOR = [0.955,0.95,0.935], C_INK = [0.12,0.13,0.13];
const C_DETAIL = [0.42,0.44,0.43], C_ROOF = [0.17,0.175,0.18], C_FASCIA = [0.184,0.184,0.188];
const C_GLASS = [0.34,0.42,0.47], C_FURN = [0.93,0.932,0.922], C_LAWN = [0.86,0.895,0.815];
const C_PAVE = [0.90,0.90,0.885], C_DOOR = [0.80,0.80,0.79], C_TILE = [0.92,0.925,0.93];
// Named finish colors a config may ask for (walls, door leaves, beams): warm wood and dark metal.
const C_NAMED = { wood: [0.66,0.47,0.30], metal: [0.20,0.21,0.22] };
const colorOf = (name, fallback) => C_NAMED[name] || fallback;

/** Ear-clipping triangulation of a simple polygon [[x,z],...]. */
function triangulate(poly) {
  const pts = poly.slice();
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) pts.reverse();
  const idx = pts.map((_, i) => i), out = [];
  const crossZ = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inTri = (p, a, b, c) => crossZ(a, b, p) >= 0 && crossZ(b, c, p) >= 0 && crossZ(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 5000) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      if (crossZ(a, b, c) <= 1e-9) continue;
      let ok = true;
      for (const j of idx) { if (j === ia || j === ib || j === ic) continue; if (inTri(pts[j], a, b, c)) { ok = false; break; } }
      if (!ok) continue;
      out.push([a, b, c]); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push(idx.map(i => pts[i]));
  return out;
}

function buildFromConfig(cfg) {
  const groups = [], labels = [], rooms = [];
  const group = id => { const g = { id, solid: [], lines: [] }; groups.push(g); return g; };
  // Two-level configs (cfg.levels) keep the main floor in its own groups so the upper floor can lift away.
  const LV = cfg.levels || null;
  const site = group('site');
  const low = LV ? { slab: group('lowerfloor'), walls: group('lower'), finish: group('lowerFinish'), fix: group('lowerFix') } : null;
  const slab = group('upperfloor'), walls = group('upper'), finish = group('finish');
  const fix = group('fixtures'), roof = group('roof');
  const F = cfg.floor || 0;
  const up = { slab, walls, finish, fix };
  // Three-level configs (lower, main, upper): the lower and main floors share the lower groups, the top level lifts away.
  const TOP = LV ? LV.length - 1 : 1, L3 = !!(LV && LV.length === 3);
  const G = o => (low && (o.lvl || 0) < TOP ? low : up);
  const floorOf = lvl => L3 ? ['lower', 'main', 'upper'][lvl || 0] : (lvl ? 'upper' : 'main');
  const baseOf = o => o.base != null ? o.base : (LV ? LV[o.lvl || 0].y : F);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  function tri(g, a, b, c, color, role = 0, baseY = Math.min(a[1], b[1], c[1])) {
    const n = cross(sub(b, a), sub(c, a)); const d = Math.hypot(...n) || 1;
    for (const p of [a, b, c]) g.solid.push(...p, ...n.map(v => v / d), ...color, role, baseY);
  }
  function line(g, a, b, color = C_INK, role = 0, baseY = Math.min(a[1], b[1])) { g.lines.push(...a, ...color, role, baseY, ...b, ...color, role, baseY); }
  function face(g, pts, color, role = 0, edge = true, baseY = Math.min(...pts.map(p => p[1]))) {
    for (let i = 1; i < pts.length - 1; i++) tri(g, pts[0], pts[i], pts[i + 1], color, role, baseY);
    if (edge) for (let i = 0; i < pts.length; i++) line(g, pts[i], pts[(i + 1) % pts.length], C_INK, role, baseY);
  }
  /** Vertical prism over a plan polygon, from y0 to y1. */
  function prism(g, poly, y0, y1, color, role = 0, edge = true, edgeColor = C_INK, cutBase = y0) {
    if (y1 <= y0 || poly.length < 3) return;
    for (const t of triangulate(poly)) { tri(g, [t[0][0], y1, t[0][1]], [t[2][0], y1, t[2][1]], [t[1][0], y1, t[1][1]], color, role, cutBase); }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      face(g, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], color, role, false, cutBase);
      if (edge) { line(g, [a[0], y1, a[1]], [b[0], y1, b[1]], edgeColor, role, cutBase); line(g, [a[0], y0, a[1]], [b[0], y0, b[1]], edgeColor, role, cutBase); line(g, [a[0], y0, a[1]], [a[0], y1, a[1]], edgeColor, role, cutBase); }
    }
  }
  const rect = r => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
  /** Thin plan strip along a segment a->b, t wide. */
  function strip(a, b, t) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * t / 2, nz = dx / L * t / 2;
    return [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]];
  }
  const H = cfg.assume || {};
  const SILL0 = H.sill ?? 3, HEAD0 = H.head ?? 7, DOOR0 = H.door ?? 6.67, GDOOR0 = H.garageDoor ?? 10, BAYSILL = H.baySill ?? 2;

  // Site: lawn plate under everything, pads (patio, porch, drive) as thin slabs.
  const B = cfg.bounds;
  prism(site, rect([B.min[0], B.min[2], B.max[0], B.max[2]]), -0.3, 0, C_LAWN, 7, false);
  for (const p of cfg.pads || []) prism(site, p.poly, 0, p.y1 != null ? p.y1 : p.kind === 'drive' ? 0.05 : F, C_PAVE, 7, true, C_DETAIL);
  // Floor decks of a two-level house: slab on grade, the garage slab, the upper floor framing.
  for (const d of cfg.decks || []) prism(L3 && d.lvl === 1 ? low.walls : L3 && d.lvl === 2 ? up.walls : G(d).slab, d.poly, d.y0, d.y1, C_FLOOR, 7, !!d.edge, C_DETAIL);
  // Sloped ground (cfg.terrain): triangles [[x, y, z] x 3] around the footprint, and skirt quads at the lot edge.
  for (const t of cfg.terrain || []) tri(site, t[0], t[1], t[2], C_LAWN, 7, 0);
  for (const q of cfg.terrainSkirt || []) face(site, q, C_LAWN, 7, false, 0);
  // Slab and room floors.
  for (const r of cfg.rooms) {
    if (!r.poly) continue;
    const wet = /bath|shower|^[tw]c$|laundry|water heater|powder/i.test(r.name);
    if (!LV) { prism(slab, r.poly, 0, F, wet ? C_TILE : C_FLOOR, 7, false); continue; }
    if (wet && r.ch) { const b = baseOf(r); prism(G(r).slab, r.poly, b, b + 0.02, C_TILE, 7, false); }
  }
  // Walls: every traced wall piece, from the slab edge up to its room's ceiling height.
  for (const w of cfg.walls) {
    const b = baseOf(w), y0 = w.y0 != null ? w.y0 : (LV && w.lvl ? b : 0);
    prism(G(w).walls, w.q, y0, b + w.h, colorOf(w.color, C_WALL), 5, true);
  }
  // Openings: sills, headers, glass and door panels fill the traced gaps.
  for (const o of cfg.openings) {
    const F = baseOf(o), walls = G(o).walls, finish = G(o).finish, slab = G(o).slab;
    const W0 = LV && o.lvl ? F : 0;
    const SILL = o.sill ?? SILL0, HEAD = o.head ?? HEAD0, DOOR = o.door ?? DOOR0, GDOOR = o.door ?? GDOOR0;
    const h = F + (o.h || 9);
    const segs = [];
    if (o.poly) for (let i = 0; i < o.poly.length - 1; i++) segs.push([o.poly[i], o.poly[i + 1]]);
    else segs.push(o.axis === 'x' ? [[o.a, o.at], [o.b, o.at]] : [[o.at, o.a], [o.at, o.b]]);
    const t = o.t || 0.5;
    for (const [a, b] of segs) {
      const s = strip(a, b, t), g = strip(a, b, 0.08);
      const mid = (y0, y1, col, grp, edge = true) => prism(grp, s, y0, y1, col, 5, edge);
      if (o.kind === 'W' || o.kind === 'bay') {
        const sill = F + (o.kind === 'bay' ? BAYSILL : SILL), head = F + HEAD;
        mid(W0, sill, C_WALL, walls);
        mid(head, o.kind === 'bay' ? F + 9 : h, C_WALL, walls);
        prism(finish, g, sill, head, C_GLASS, 0, true, C_FASCIA);
      } else if (o.kind === 'D' || o.kind === 'D2' || o.kind === 'DG') {
        if (F > W0 + 0.01) mid(W0, F, C_WALL, walls);
        // A door set below the main floor (garage) keeps its gap in the plan cut, like the main floor doors.
        if (o.cutBase != null) prism(walls, s, F + DOOR, h, C_WALL, 5, true, C_INK, o.cutBase);
        else mid(F + DOOR, h, C_WALL, walls);
        if (o.kind === 'DG') prism(finish, g, F, F + DOOR, C_GLASS, 0, true, C_FASCIA);
        else if (o.leaf) prism(finish, g, F, F + DOOR, colorOf(o.color, C_DOOR), 0, true, C_FASCIA); // exterior door leaf (o.leaf)
      } else if (o.kind === 'G') {
        if (F > W0 + 0.01) mid(W0, F, C_WALL, walls);
        mid(F + GDOOR, h, C_WALL, walls);
        prism(finish, g, F, F + GDOOR, C_DOOR, 0, true);
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let y = F + 2; y < F + GDOOR - 0.5; y += 2) {
          const off = 0.06, dx = (b[1] - a[1]) / L * off, dz = -(b[0] - a[0]) / L * off;
          line(finish, [a[0] + dx, y, a[1] + dz], [b[0] + dx, y, b[1] + dz], C_DETAIL, 0, F);
          line(finish, [a[0] - dx, y, a[1] - dz], [b[0] - dx, y, b[1] - dz], C_DETAIL, 0, F);
        }
      }
    }
    if (o.kind === 'bay' && o.poly) {
      prism(slab, o.poly, 0, F, C_FLOOR, 7, false);
      prism(roof, o.poly.map(p => [p[0], p[1]]), F + 9, F + 9.8, C_ROOF, 0, true, C_FASCIA);
      // A bay in a taller room: close the main wall line above the bay roof up to the room's wall height.
      if (o.closeAbove && h > F + 9.8) prism(walls, strip(o.poly[0], o.poly[o.poly.length - 1], t), F + 9.8, h, C_WALL, 5, true);
    }
  }
  // Fixtures and furniture from the plan symbols.
  for (const f of cfg.fixtures || []) {
    const r = f.r, F = baseOf(f), fix = G(f).fix;
    if (f.kind === 'stair') {
      // Straight run: n risers from this floor up to the next, climbing toward f.up.
      const n = f.n || 16, rise = (f.rise || 9) / n, neg = f.up === '-z' || f.up === '-x', alongZ = /z/.test(f.up || 'z');
      const a0 = alongZ ? r[1] : r[0], a1 = alongZ ? r[3] : r[2], run = (a1 - a0) / (n - 1);
      for (let i = 0; i < n - 1; i++) {
        const s0 = neg ? a1 - (i + 1) * run : a0 + i * run, s1 = s0 + run;
        prism(fix, rect(alongZ ? [r[0], s0, r[2], s1] : [s0, r[1], s1, r[3]]), F, F + (i + 1) * rise, C_FURN, 1, true, C_DETAIL);
      }
      continue;
    }
    // Door leaves drawn as thin panels along plan segments (closet doors, bi-folds), as drawn open on the plan.
    if (f.kind === 'panel') { for (const [a, b] of f.segs || []) prism(fix, strip(a, b, f.t || 0.12), F, F + f.h, C_FURN, 0, true, C_DETAIL); continue; }
    prism(fix, rect(r), F, F + f.h, C_FURN, 0, true, C_DETAIL);
    if (f.kind === 'bed') prism(fix, rect([r[0], r[1], r[2], r[1] + Math.min(1.6, (r[3] - r[1]) * 0.25)]), F + f.h, F + f.h + 0.4, C_FURN, 0, true, C_DETAIL);
    if (f.kind === 'tub') { const i = 0.35; for (const [a, b] of [[[r[0]+i, r[1]+i], [r[2]-i, r[1]+i]], [[r[2]-i, r[1]+i], [r[2]-i, r[3]-i]], [[r[2]-i, r[3]-i], [r[0]+i, r[3]-i]], [[r[0]+i, r[3]-i], [r[0]+i, r[1]+i]]]) line(fix, [a[0], F + f.h + 0.02, a[1]], [b[0], F + f.h + 0.02, b[1]], C_DETAIL, 0, F); }
  }
  // Dashed outlines drawn on the plan (parking bays).
  for (const d of cfg.dashed || []) {
    const pts = rect(d);
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s < L; s += 2) { const e = Math.min(L, s + 1.1); line(slab, [a[0] + (b[0] - a[0]) * s / L, F + 0.03, a[1] + (b[1] - a[1]) * s / L], [a[0] + (b[0] - a[0]) * e / L, F + 0.03, a[1] + (b[1] - a[1]) * e / L], C_DETAIL, 7, 0); }
    }
  }
  // Roof: one cap per ceiling-height zone (the plan has no roof drawing; see assumptions).
  const RT = H.roofThickness ?? 1.0, RA = H.roofAbove ?? 0.25;
  if (cfg.gableRoof) gableRoofs(cfg.gableRoof);
  else if (cfg.fieldRoof) fieldRoofs(cfg.fieldRoof);
  else if (cfg.pitchedRoof) hipRoofs(cfg.pitchedRoof);
  else for (const c of cfg.roof || []) {
    prism(roof, c.poly, F + c.y + RA, F + c.y + RA + (c.t ?? RT), C_ROOF, 0, true, C_FASCIA);
    // A planted (green) roof: a thin lawn layer inside the parapet edge.
    for (const g of c.green || []) prism(roof, g, F + c.y + RA + (c.t ?? RT), F + c.y + RA + (c.t ?? RT) + 0.08, C_LAWN, 0, false);
  }
  // Exposed beam ends under the roof overhangs (cfg.beams): drawn with the roof so they lift away with it.
  for (const b of cfg.beams || []) prism(roof, b.poly, b.y0, b.y1, colorOf(b.color, C_WALL), 0, true, C_FASCIA);
  /** Hipped roof per wing over a plan rectangle. Overlapping wings at one pitch meet in true valleys.
      Eaves overhang the walls, with a fascia band, a soffit and standing seams down each plane. */
  function hipRoofs(spec) {
    const k = (spec.pitch ?? 6) / 12, o0 = spec.overhang ?? 1.5, FH = spec.fascia ?? 0.7, SP = spec.seam ?? 1.5;
    const C_SEAM = [0.30, 0.31, 0.32], C_SOFFIT = [0.86, 0.85, 0.82];
    for (const w of spec.wings) {
      const o = w.overhang ?? o0, y = F + w.plate;
      const [x0, z0, x1, z1] = [w.r[0] - o, w.r[1] - o, w.r[2] + o, w.r[3] + o];
      const ye = y - o * k, alongX = (x1 - x0) >= (z1 - z0), h = (alongX ? z1 - z0 : x1 - x0) / 2, yr = ye + h * k;
      const A = [x0, ye, z0], B2 = [x1, ye, z0], C = [x1, ye, z1], D = [x0, ye, z1];
      let faces;
      if (alongX) {
        const zm = (z0 + z1) / 2, R1 = [x0 + h, yr, zm], R2 = [x1 - h, yr, zm];
        faces = [[A, B2, R2, R1], [B2, C, R2], [C, D, R1, R2], [D, A, R1]];
      } else {
        const xm = (x0 + x1) / 2, R1 = [xm, yr, z0 + h], R2 = [xm, yr, z1 - h];
        faces = [[A, B2, R1], [B2, C, R2, R1], [C, D, R2], [D, A, R1, R2]];
      }
      for (const f of faces) {
        face(roof, f, C_ROOF, 0, true, ye);
        // Standing seams run down the slope, perpendicular to the face's eave edge.
        const e0 = f[0], e1 = f[1], ex = Math.abs(e1[0] - e0[0]) > Math.abs(e1[2] - e0[2]);
        const lo = Math.min(ex ? e0[0] : e0[2], ex ? e1[0] : e1[2]), hi = Math.max(ex ? e0[0] : e0[2], ex ? e1[0] : e1[2]);
        for (let c = lo + SP; c < hi - 0.2; c += SP) {
          const hits = [];
          for (let i = 0; i < f.length; i++) {
            const p = f[i], q = f[(i + 1) % f.length], pa = ex ? p[0] : p[2], qa = ex ? q[0] : q[2];
            if ((pa - c) * (qa - c) > 0 || pa === qa) continue;
            const s = (c - pa) / (qa - pa); hits.push(p.map((v, j) => v + (q[j] - v) * s));
          }
          if (hits.length >= 2) { const a = hits[0], b = hits[hits.length - 1]; line(roof, [a[0], a[1] + 0.03, a[2]], [b[0], b[1] + 0.03, b[2]], C_SEAM, 0, ye); }
        }
        // Fascia band below the eave edge.
        face(roof, [[e0[0], ye, e0[2]], [e1[0], ye, e1[2]], [e1[0], ye - FH, e1[2]], [e0[0], ye - FH, e0[2]]], C_FASCIA, 0, true, ye - FH);
      }
      // Soffit: the underside ring between the wall line and the eave.
      const ys = ye - FH, r = w.r;
      for (const q of [[x0, z0, x1, r[1]], [x0, r[3], x1, z1], [x0, r[1], r[0], r[3]], [r[2], r[1], x1, r[3]]])
        face(roof, [[q[0], ys, q[1]], [q[2], ys, q[1]], [q[2], ys, q[3]], [q[0], ys, q[3]]], C_SOFFIT, 0, false, ys);
    }
    // Posts under roofs with no walls below (covered patio, entry porch).
    for (const p of spec.posts || []) prism(roof, rect([p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3]), F, F + p[2], C_WALL, 0, true);
  }
  /** Hipped roof over the union of plan rectangles, one zone per plate height. For a footprint made of
      axis-aligned rectangles the hip roof at one pitch is the chessboard (L-infinity) distance to the eave line,
      so wings, L and T junctions get true hips and valleys with no seams between pieces. Lower zones tuck under
      higher ones. Courses are drawn as level lines; a fascia band runs round the eave and a soffit under it. */
  function fieldRoofs(spec) {
    const C_SEAM = [0.30, 0.31, 0.32], C_SOFFIT = [0.86, 0.85, 0.82];
    const FH = spec.fascia ?? 0.6, SP = spec.seam ?? 1.5, S = spec.step ?? 0.5;
    for (const zn of spec.zones) {
      const o = zn.overhang ?? spec.overhang ?? 1.5, k = (zn.pitch ?? spec.pitch ?? 4) / 12, ye = F + zn.plate - o * k;
      const R = zn.rects.map(r => [r[0] - o, r[1] - o, r[2] + o, r[3] + o]), Wl = zn.rects;
      const inR = (x, z, L) => L.some(r => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
      const uniq = a => { a.sort((p, q) => p - q); const out = []; for (const v of a) if (!out.length || v - out[out.length - 1] > 0.05) out.push(v); return out; };
      // zn.clip: plan rects (taller walls) where this roof stops; zn.cap: run beyond which the slope eases to zn.deck (in 12), so wings of
      // different widths share one ridge height instead of stepping.
      const CLIP = zn.clip || [], cap = zn.cap, kd = (zn.deck ?? 0.5) / 12;
      const ex = uniq(R.flatMap(r => [r[0], r[2], ...(cap != null ? [r[0] + cap, r[2] - cap] : [])]).concat(CLIP.flatMap(r => [r[0], r[2]])));
      const ez = uniq(R.flatMap(r => [r[1], r[3], ...(cap != null ? [r[1] + cap, r[3] - cap] : [])]).concat(CLIP.flatMap(r => [r[1], r[3]])));
      // Exterior as rectangles: coarse cells outside the union, plus a far border.
      const BIG = 1e4, cx = [-BIG, ...ex, BIG], cz = [-BIG, ...ez, BIG], out = [];
      for (let i = 0; i < cx.length - 1; i++) for (let j = 0; j < cz.length - 1; j++) {
        const mx = (cx[i] + cx[i + 1]) / 2, mz = (cz[j] + cz[j + 1]) / 2;
        if (!inR(mx, mz, R) && !inR(mx, mz, CLIP)) out.push([cx[i], cz[j], cx[i + 1], cz[j + 1]]); // a clip wall is no eave: the roof rises into it
      }
      const dist = (x, z) => { let d = Infinity; for (const q of out) { const dx = Math.max(q[0] - x, 0, x - q[2]), dz = Math.max(q[1] - z, 0, z - q[3]); const m = Math.max(dx, dz); if (m < d) d = m; } return d; };
      const hy = (x, z) => { const d = dist(x, z); return cap != null && d > cap ? ye + k * cap + kd * (d - cap) : ye + k * d; };
      const fill = (e) => { const a = [...e]; for (let v = Math.ceil(e[0] / S) * S; v < e[e.length - 1]; v += S) a.push(v); return uniq(a); };
      const xs = fill(ex), zs = fill(ez);
      const Hm = xs.map(x => zs.map(z => hy(x, z)));
      const inside = xs.map((x, i) => zs.map((z, j) => i < xs.length - 1 && j < zs.length - 1 && inR((x + xs[i + 1]) / 2, (z + zs[j + 1]) / 2, R)));
      const isIn = (i, j) => i >= 0 && j >= 0 && i < xs.length - 1 && j < zs.length - 1 && inside[i][j];
      const up = (a, b, c) => { const n = cross(sub(b, a), sub(c, a)); return n[1] >= 0 ? [a, b, c] : [a, c, b]; };
      // Each triangle faces +x, -x, +z or -z (the slope of a chessboard-distance roof is always axis aligned).
      const cls = t => { const [p, q, r] = t, u = sub(q, p), v = sub(r, p), n = cross(u, v); return Math.abs(n[0]) > Math.abs(n[2]) ? (n[0] * n[1] > 0 ? 0 : 1) : (n[2] * n[1] > 0 ? 2 : 3); };
      const seams = (t, c) => { // standing seams run down the slope: cut the triangle with planes across it every SP
        const ax = c < 2 ? 2 : 0, vs = t.map(p => p[ax]), lo = Math.min(...vs), hi = Math.max(...vs);
        for (let L = Math.ceil((lo - 0.37) / SP) * SP + 0.37; L < hi; L += SP) { // offset keeps cuts off the grid lines
          const pts = [];
          for (let e = 0; e < 3; e++) { const p = t[e], q = t[(e + 1) % 3]; if ((p[ax] - L) * (q[ax] - L) < 0) { const s2 = (L - p[ax]) / (q[ax] - p[ax]); pts.push(p.map((w, m) => w + (q[m] - w) * s2 + (m === 1 ? 0.03 : 0))); } }
          if (pts.length === 2) line(roof, pts[0], pts[1], C_SEAM, 0, ye);
        }
      };
      const CL = xs.map(() => zs.map(() => null));
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
        if (!inside[i][j]) continue;
        if (CLIP.length && inR((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2, CLIP)) continue;
        const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
        const a = [x0, Hm[i][j], z0], b = [x1, Hm[i + 1][j], z0], c = [x1, Hm[i + 1][j + 1], z1], d = [x0, Hm[i][j + 1], z1];
        const hc = hy((x0 + x1) / 2, (z0 + z1) / 2);
        const tris = Math.abs((a[1] + c[1]) / 2 - hc) <= Math.abs((b[1] + d[1]) / 2 - hc) ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        const cc = tris.map(cls), split = tris[0][2] === c;
        // which triangle touches edges [top z0, right x1, bottom z1, left x0]
        CL[i][j] = split ? [cc[0], cc[0], cc[1], cc[1]] : [cc[0], cc[1], cc[1], cc[0]];
        tris.forEach((t, n) => { const u = up(...t); tri(roof, u[0], u[1], u[2], C_ROOF, 0, ye); seams(t, cc[n]); });
        if (cc[0] !== cc[1]) { const [p, q] = split ? [a, c] : [b, d]; line(roof, [p[0], p[1] + 0.04, p[2]], [q[0], q[1] + 0.04, q[2]], C_INK, 0, ye); }
        // Fascia on eave edges, soffit under the overhang.
        const edges = [[i, j - 1, a, b], [i + 1, j, b, c], [i, j + 1, c, d], [i - 1, j, d, a]];
        for (const [ni, nj, p, q] of edges) if (!isIn(ni, nj)) {
          face(roof, [[p[0], ye, p[2]], [q[0], ye, q[2]], [q[0], ye - FH, q[2]], [p[0], ye - FH, p[2]]], C_FASCIA, 0, false, ye - FH);
          line(roof, [p[0], ye, p[2]], [q[0], ye, q[2]], C_INK, 0, ye - FH); line(roof, [p[0], ye - FH, p[2]], [q[0], ye - FH, q[2]], C_INK, 0, ye - FH);
        }
        if (!inR((x0 + x1) / 2, (z0 + z1) / 2, Wl)) face(roof, [[x0, ye - FH, z0], [x0, ye - FH, z1], [x1, ye - FH, z1], [x1, ye - FH, z0]], C_SOFFIT, 0, false, ye - FH);
      }
      // Hips, ridges and valleys: cell edges where the facing changes.
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
        if (!CL[i][j]) continue;
        if (CL[i + 1] && CL[i + 1][j] && CL[i][j][1] !== CL[i + 1][j][3]) line(roof, [xs[i + 1], Hm[i + 1][j] + 0.04, zs[j]], [xs[i + 1], Hm[i + 1][j + 1] + 0.04, zs[j + 1]], C_INK, 0, ye);
        if (CL[i][j + 1] && CL[i][j][2] !== CL[i][j + 1][0]) line(roof, [xs[i], Hm[i][j + 1] + 0.04, zs[j + 1]], [xs[i + 1], Hm[i + 1][j + 1] + 0.04, zs[j + 1]], C_INK, 0, ye);
      }
    }
    // Clerestory walls where a raised zone stands above a lower roof (drawn full height; the lower roof hides the rest).
    for (const c of spec.cheeks || []) {
      const [a, b] = c.seg, y0 = F + c.y0, y1 = F + c.y1;
      face(roof, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], C_WALL, 5, true, y0);
    }
    for (const p of spec.posts || []) prism(roof, rect([p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3]), F, F + p[2], C_WALL, 0, true);
  }
  /** Gable roofs from a roof plan: two planes per gable, rake and eave overhangs, fascia, soffit, shingle courses and
      the gable-end wall. Gables at different pitches overlap; the depth test draws their true valleys.
      g.ridge is the ridge direction ('x' or 'z'); g.ends says which ends get a gable wall; g.rake their overhang. */
  function gableRoofs(spec) {
    const o0 = spec.overhang ?? 1.5, FH = spec.fascia ?? 0.6, CS = spec.course ?? 1.25;
    const C_SEAM = [0.30, 0.31, 0.32], C_SOFFIT = [0.86, 0.85, 0.82];
    for (const g of spec.gables || []) {
      const k = g.pitch / 12, o = g.overhang ?? o0, alongZ = g.ridge === 'z';
      const [x0, z0, x1, z1] = g.r;
      const u0 = alongZ ? x0 : z0, u1 = alongZ ? x1 : z1, v0 = alongZ ? z0 : x0, v1 = alongZ ? z1 : x1;
      const P = (u, y, v) => alongZ ? [u, y, v] : [v, y, u];
      const um = (u0 + u1) / 2, yr = g.plate + (um - u0) * k, ye = g.plate - o * k;
      const rk = g.rake || [o, o], va = v0 - rk[0], vb = v1 + rk[1];
      // g.rakeTop: a flared rake, wider at the ridge than at the eave (rake overhang read at the ridge).
      const rt = g.rakeTop || rk, ta = v0 - rt[0], tb = v1 + rt[1];
      const vat = t => va + (ta - va) * t, vbt = t => vb + (tb - vb) * t;
      const planes = [[P(u0 - o, ye, va), P(um, yr, ta), P(um, yr, tb), P(u0 - o, ye, vb)], [P(u1 + o, ye, vb), P(um, yr, tb), P(um, yr, ta), P(u1 + o, ye, va)]];
      planes.forEach((f, side) => {
        face(roof, f, C_ROOF, 0, true, ye);
        const ue = side ? u1 + o : u0 - o, run = um - ue;
        for (let t = CS; t < Math.abs(run) - 0.2; t += CS) {
          const u = ue + Math.sign(run) * t, y = ye + t * k + 0.03, f = t / Math.abs(run);
          line(roof, P(u, y, vat(f)), P(u, y, vbt(f)), C_SEAM, 0, ye);
        }
        face(roof, [P(ue, ye, va), P(ue, ye, vb), P(ue, ye - FH, vb), P(ue, ye - FH, va)], C_FASCIA, 0, true, ye - FH);
        const uw = side ? u1 : u0;
        face(roof, [P(ue, ye - FH, va), P(uw, ye - FH, va), P(uw, ye - FH, vb), P(ue, ye - FH, vb)], C_SOFFIT, 0, false, ye - FH);
      });
      // Rake boards and gable-end walls.
      [[va, v0, 0, ta], [vb, v1, 1, tb]].forEach(([vr, vw, i, vt]) => {
        if (rk[i] > 0) {
          for (const ue of [u0 - o, u1 + o]) face(roof, [P(ue, ye, vr), P(um, yr, vt), P(um, yr - FH, vt), P(ue, ye - FH, vr)], C_FASCIA, 0, true, ye - FH);
        }
        if (g.ends && g.ends[i]) {
          const b = g.endBase ?? g.plate;
          face(roof, [P(u0, b, vw), P(u1, b, vw), P(u1, g.plate, vw), P(um, yr, vw), P(u0, g.plate, vw)].filter((p, j, a) => j === 0 || Math.abs(p[1] - a[j - 1][1]) > 1e-6 || p[0] !== a[j - 1][0] || p[2] !== a[j - 1][2]), C_WALL, 5, true, b);
        }
      });
    }
    // Free roof planes read off a roof plan (hips, valleys and mixed pitches): triangles or convex quads from the config,
    // with c = 'fascia', 'soffit' or 'wall' (gable-end wall above the plate); lines are plane edges, or shingle courses when flagged.
    for (const f of spec.faces || []) {
      const col = f.c === 'fascia' ? C_FASCIA : f.c === 'soffit' ? C_SOFFIT : f.c === 'wall' ? C_WALL : C_ROOF;
      face(roof, f.p, col, f.c === 'wall' ? 5 : 0, false, Math.min(...f.p.map(p => p[1])));
    }
    for (const l of spec.lines || []) line(roof, l[0], l[1], l[2] ? C_SEAM : C_INK, 0, Math.min(l[0][1], l[1][1]));
    // Shed roofs sloping away from a wall (porch roof).
    for (const sh of spec.sheds || []) {
      const k = sh.pitch / 12, o = sh.overhang ?? o0, [x0, z0, x1, z1] = sh.r, sd = sh.sides || [o, o];
      const hi = sh.high || 'z0', alongX = hi[0] === 'z', far = hi[1] === '0' ? 1 : -1;
      const P = (u, y, v) => alongX ? [u, y, v] : [v, y, u];
      const ua = (alongX ? x0 : z0) - sd[0], ub = (alongX ? x1 : z1) + sd[1];
      const vh = hi[1] === '0' ? (alongX ? z0 : x0) : (alongX ? z1 : x1), vl = (hi[1] === '0' ? (alongX ? z1 : x1) : (alongX ? z0 : x0)) + far * o;
      const yl = sh.top - Math.abs(vl - vh) * k;
      face(roof, [P(ua, sh.top, vh), P(ub, sh.top, vh), P(ub, yl, vl), P(ua, yl, vl)], C_ROOF, 0, true, yl);
      for (let t = CS; t < Math.abs(vl - vh) - 0.2; t += CS) { const v = vl - far * t, y = yl + t * k + 0.03; line(roof, P(ua, y, v), P(ub, y, v), C_SEAM, 0, yl); }
      face(roof, [P(ua, yl, vl), P(ub, yl, vl), P(ub, yl - FH, vl), P(ua, yl - FH, vl)], C_FASCIA, 0, true, yl - FH);
      for (const u of [ua, ub]) face(roof, [P(u, sh.top, vh), P(u, yl, vl), P(u, yl - FH, vl), P(u, sh.top - FH, vh)], C_FASCIA, 0, true, yl - FH);
      face(roof, [P(ua, yl - FH, vl), P(ub, yl - FH, vl), P(ub, sh.top - FH, vh), P(ua, sh.top - FH, vh)], C_SOFFIT, 0, false, yl - FH);
    }
    for (const p of spec.posts || []) prism(roof, rect([p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3]), p[3] ?? F, p[2], C_WALL, 0, true);
    // Glass set in a gable wall (the attic window in the dormer).
    for (const q of spec.glass || []) {
      const s = q.axis === 'x' ? strip([q.a, q.at], [q.b, q.at], 0.08) : strip([q.at, q.a], [q.at, q.b], 0.08);
      prism(roof, s, q.y0, q.y1, C_GLASS, 0, true, C_FASCIA);
    }
  }
  // Labels and tap targets: printed room names and areas.
  const LY = F + 0.15;
  for (const r of cfg.rooms) {
    const text = r.text || (r.name + ' ' + (Math.round(r.area * 100) / 100) + ' SF');
    const minor = r.minor ?? ((r.area ?? 100) < 60);
    const floors = LV ? [floorOf(r.lvl)] : ['upper', 'main'];
    const ly = LV ? baseOf(r) + 0.15 : LY;
    for (const floor of floors) {
      labels.push({ text, position: [r.label[0], ly, r.label[1]], minor, floor });
      if (r.box) rooms.push({ text, floor, minor, center: [(r.box[0] + r.box[2]) / 2, ly, (r.box[1] + r.box[3]) / 2], box: r.box });
    }
  }
  for (const d of cfg.dims || []) for (const floor of (LV ? [floorOf(d.lvl)] : ['upper', 'main'])) labels.push({ text: d.text, position: [d.at[0], LV ? LV[d.lvl || 0].y + 0.15 : LY, d.at[1]], minor: true, floor });
  return { groups: groups.map(g => ({ id: g.id, solid: new Float32Array(g.solid), lines: new Float32Array(g.lines) })), labels, rooms,
    bounds: cfg.bounds, notes: cfg.source || '' };
}

/** Camera and stage profile for a one-level house config. */
function profileFor(cfg) {
  if (cfg.levels) return profileTwoLevel(cfg);
  const F = cfg.floor || 0, B = cfg.bounds, top = B.max[1];
  const plate = F + Math.max(...cfg.walls.map(w => w.h));
  const cl = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
  const mx = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, p) => { const t = cl((p - a) / (b - a)); return t * t * (3 - 2 * t); };
  const wallCut = p => p < 0.47 ? 100
    : p < 0.67 ? mx(plate + 0.5, F + 4.5, sm(0.48, 0.62, p))
    : p < 0.85 ? mx(F + 4.5, F + 1.1, sm(0.68, 0.80, p))
    : mx(F + 1.1, F + 0.02, sm(0.86, 0.93, p));
  const state = (visible, cut = 100, opacity = 1) => ({ visible, cut, opacity });
  const shadow = (cfg.roof || []).slice().sort((a, b) => area(b.poly) - area(a.poly)).slice(0, 3).map(c => {
    const xs = c.poly.map(p => p[0]), zs = c.poly.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    return [(x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2];
  });
  function area(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); }
  while (shadow.length < 3) shadow.push(shadow[0] || [0, 0, 0, 0]);
  const deg = Math.PI / 180, hd = cfg.heading || {};
  return {
    id: cfg.slug,
    config: cfg,
    build: () => buildFromConfig(cfg),
    groupState(id, p) {
      const roofFade = 1 - sm(0.30, 0.37, p);
      const cut = wallCut(p);
      switch (id) {
        case 'site': case 'upperfloor': return state(true);
        case 'upper': case 'finish': return state(true, cut);
        case 'fixtures': return state(p >= 0.30 && p < 0.88, cut, 1 - sm(0.84, 0.88, p));
        case 'roof': return state(roofFade > 0.02, 100, roofFade);
        default: return state(true);
      }
    },
    visibleHeight(p, bounds) {
      const full = bounds.max[1];
      if (p < 0.30) return full;
      if (p < 0.50) return mx(full, plate + 0.6, sm(0.30, 0.46, p));
      if (p < 0.70) return mx(plate + 0.6, F + 4.6, sm(0.48, 0.62, p));
      return mx(F + 4.6, F + 1.4, sm(0.68, 0.9, p));
    },
    bounds: B,
    tight: cfg.planBounds,
    frontAngle: cfg.frontAngle || 64,
    heading: { axon: (hd.axon ?? -36) * deg, front: (hd.front ?? 0) * deg, plan: (hd.plan ?? 0) * deg },
    floorY: { main: F + 0.15, upper: F + 0.15 },
    pickY: { main: F, upper: F },
    shadow,
    stages: cfg.stages,
    flyAngle: cfg.flyAngle || { house: 0.70, front: 0.70, roof: 0.66, upper: 0.56, plan: 0.48, foundation: 0.52 },
    sheetLabel: cfg.sheetLabel || ('Static drawing of ' + cfg.title + '.')
  };
}

/** Camera and stage profile for a two-level house config: the roof lifts, the upper floor cuts down and lifts away,
    then the main floor cuts down to the slab. */
function profileTwoLevel(cfg) {
  const L3 = cfg.levels.length === 3, LT = cfg.levels[cfg.levels.length - 1], LM = cfg.levels[L3 ? 1 : 0];
  const F = cfg.levels[0].y, M = LM.y, U = LT.y, B = cfg.bounds;
  const mainTop = M + (LM.ch || 9), upperTop = U + (LT.ch || 9);
  const cl = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
  const mx = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, p) => { const t = cl((p - a) / (b - a)); return t * t * (3 - 2 * t); };
  const upperCut = p => p < 0.47 ? 100 : mx(upperTop + 0.5, U + 4.5, sm(0.48, 0.60, p));
  // Three levels: the main floor plan cut holds through the main floor stage, then the cut drops to the lower floor plan.
  const lowerCut = L3 ? (p => p < 0.62 ? 100 : p < 0.80 ? mx(mainTop + 0.5, M + 4.5, sm(0.64, 0.72, p)) : mx(M + 4.5, F + 4.5, sm(0.84, 0.90, p)))
    : (p => p < 0.62 ? 100 : p < 0.85 ? mx(mainTop + 0.5, F + 4.5, sm(0.64, 0.76, p)) : mx(F + 4.5, F + 0.02, sm(0.86, 0.93, p)));
  const state = (visible, cut = 100, opacity = 1) => ({ visible, cut, opacity });
  const shadow = (cfg.shadow || []).slice(0, 3);
  while (shadow.length < 3) shadow.push(shadow[0] || [0, 0, 0, 0]);
  const deg = Math.PI / 180, hd = cfg.heading || {};
  return {
    id: cfg.slug,
    config: cfg,
    build: () => buildFromConfig(cfg),
    groupState(id, p) {
      const roofFade = 1 - sm(0.30, 0.37, p), upFade = 1 - sm(0.62, 0.67, p);
      switch (id) {
        case 'site': case 'lowerfloor': return state(true);
        case 'lower': case 'lowerFinish': return state(true, lowerCut(p));
        // Three levels: the lower floor keeps its fixtures (stair, beds, counters) on the last stage; the main floor ones are above the cut.
        case 'lowerFix': return L3 ? state(p >= 0.30, lowerCut(p)) : state(p >= 0.30 && p < 0.88, lowerCut(p), 1 - sm(0.84, 0.88, p));
        case 'upperfloor': return state(p < 0.67, 100, upFade);
        case 'upper': case 'finish': return state(p < 0.67, upperCut(p), upFade);
        case 'fixtures': return state(p >= 0.30 && p < 0.67, upperCut(p), upFade);
        case 'roof': return state(roofFade > 0.02, 100, roofFade);
        default: return state(true);
      }
    },
    visibleHeight(p, bounds) {
      const full = bounds.max[1];
      if (p < 0.30) return full;
      if (p < 0.50) return mx(full, upperTop + 0.6, sm(0.30, 0.46, p));
      if (p < 0.64) return mx(upperTop + 0.6, U + 4.6, sm(0.48, 0.60, p));
      if (L3) return mx(U + 4.6, M + 4.6, sm(0.64, 0.72, p)) - (M - F) * sm(0.84, 0.90, p);
      return mx(U + 4.6, F + 4.6, sm(0.64, 0.76, p)) - (p > 0.86 ? 3.0 * sm(0.86, 0.93, p) : 0);
    },
    bounds: B,
    tight: cfg.planBounds,
    frontAngle: cfg.frontAngle || 64,
    heading: { axon: (hd.axon ?? -36) * deg, front: (hd.front ?? 0) * deg, plan: (hd.plan ?? 0) * deg },
    floorY: L3 ? { lower: F + 0.15, main: M + 0.15, upper: U + 0.15 } : { main: F + 0.15, upper: U + 0.15 },
    pickY: L3 ? { lower: F, main: M, upper: U } : { main: F, upper: U },
    shadow,
    stages: cfg.stages,
    flyAngle: cfg.flyAngle || { house: 0.70, front: 0.70, roof: 0.66, upper: 0.56, plan: 0.48, foundation: 0.52 },
    sheetLabel: cfg.sheetLabel || ('Static drawing of ' + cfg.title + '.')
  };
}

const PAPER = [0.969, 0.965, 0.949];
const MAX_PIXELS = 1600000;
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, p) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function stageAt(progress) {
  const p = clamp(progress);
  return p < 0.16 ? 0 : p < 0.32 ? 1 : p < 0.48 ? 2 : p < 0.66 ? 3 : p < 0.84 ? 4 : 5;
}

function groupState(id, progress) { return PROFILE.groupState(id, clamp(progress)); }
function visibleHeight(p, bounds) { return PROFILE.visibleHeight(p, bounds); }

/**
 * v9 zoom dive: zooming in (orbit.zoom below ~0.7) reveals the interior progressively.
 * On the roofed stages the roof lifts and the walls cut down to the main-level plan cut;
 * the camera stays where the visitor put it, only the cutaway changes.
 */
function diveAmount(orbit) {
  if (!orbit || !Number.isFinite(orbit.zoom)) return 0;
  return 1 - smooth(0.36, 0.72, orbit.zoom);
}
function interiorProgress(p, dive) {
  if (dive <= 0 || p >= 0.48) return p;
  return mix(p, 0.575, dive);
}

/**
 * Orthographic camera: exact plan first; readable cutaways; garage-left finish.
 * An explicit basis avoids lookAt's singularity when looking straight down.
 * The frustum fits ALL eight visible bounding-box corners at every aspect ratio.
 */
function scrollPose(progress) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const H = PROFILE.heading;
  const axon = 52 * Math.PI / 180;
  const front = (PROFILE.frontAngle || 76) * Math.PI / 180;
  const plan = 0.05;
  const toFront = smooth(0.10, 0.28, p);
  const toPlan = smooth(0.40, 0.62, p);
  return {
    angle: mix(mix(axon, front, toFront), plan, toPlan),
    heading: mix(mix(H.axon, H.front, toFront), H.plan, toPlan),
  };
}

function cameraFor(progress, width, height, bounds = PROFILE.bounds, orbit) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const aspect = Math.max(1, width) / Math.max(1, height);
  const pose = scrollPose(p);
  let angle = pose.angle;
  let heading = pose.heading;
  let zoom = 1;
  if (orbit && Number.isFinite(orbit.lockAngle)) {
    angle = orbit.lockAngle;
    if (Number.isFinite(orbit.lockHeading)) heading = orbit.lockHeading;
  }
  if (orbit) {
    heading += Number.isFinite(orbit.yaw) ? orbit.yaw : 0;
    angle += Number.isFinite(orbit.pitch) ? orbit.pitch : 0;
    // Stay above a true top-down view and below a ground-level flip.
    const minAngle = 0.02;
    const maxAngle = 78 * Math.PI / 180;
    if (angle < minAngle) angle = minAngle;
    if (angle > maxAngle) angle = maxAngle;
    zoom = Number.isFinite(orbit.zoom) ? orbit.zoom : 1;
    const zMin = orbit && Array.isArray(orbit.focus) ? 0.05 : 0.3;
    if (zoom < zMin) zoom = zMin;
    if (zoom > 2.4) zoom = 2.4;
  }
  const back = [Math.sin(angle) * Math.sin(heading), Math.cos(angle), Math.sin(angle) * Math.cos(heading)];
  const right = [Math.cos(heading), 0, -Math.sin(heading)];
  const up = [-Math.cos(angle) * Math.sin(heading), Math.sin(angle), -Math.cos(angle) * Math.cos(heading)];
  // Plan stages frame the house itself, not the whole lot, so rooms read at true scale.
  const tight = smooth(0.46, 0.62, p);
  const T = PROFILE.tight;
  if (tight > 0) bounds = { min: [mix(bounds.min[0], T.min[0], tight), bounds.min[1], mix(bounds.min[2], T.min[1], tight)],
                            max: [mix(bounds.max[0], T.max[0], tight), bounds.max[1], mix(bounds.max[2], T.max[1], tight)] };
  const top = visibleHeight(p, bounds);
  const target = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + top) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  let left = Infinity, rightEdge = -Infinity, bottom = Infinity, upper = -Infinity;
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], top]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const delta = [x - target[0], y - target[1], z - target[2]];
        const px = dot(delta, right), py = dot(delta, up);
        left = Math.min(left, px); rightEdge = Math.max(rightEdge, px);
        bottom = Math.min(bottom, py); upper = Math.max(upper, py);
      }
    }
  }
  const centerX = (left + rightEdge) / 2, centerY = (bottom + upper) / 2;
  for (let i = 0; i < 3; i++) target[i] += right[i] * centerX + up[i] * centerY;
  if (orbit && Array.isArray(orbit.focus)) { // optional pan (preview/screenshot tools)
    const dlt = orbit.focus.map((v, i) => v - target[i]);
    const ox = dot(dlt, right), oy = dot(dlt, up);
    for (let i = 0; i < 3; i++) target[i] += right[i] * ox + up[i] * oy;
  }
  const halfHeight = Math.max((upper - bottom) / 2, (rightEdge - left) / (2 * aspect)) * 1.075 * zoom;
  const halfWidth = halfHeight * aspect;
  const eye = target.map((v, i) => v + back[i] * 200);
  return { eye, target, right, up, back, halfWidth, halfHeight, near: 0.1, far: 400, angle, heading };
}

/** Column-major view/projection matrix, shared with the static preview tools. */
function computeMVP(camera) {
  const { right: r, up: u, back: b, eye, halfWidth: w, halfHeight: h, near, far } = camera;
  const dz = -2 / (far - near);
  return new Float32Array([
    r[0] / w, u[0] / h, b[0] * dz, 0,
    r[1] / w, u[1] / h, b[1] * dz, 0,
    r[2] / w, u[2] / h, b[2] * dz, 0,
    -dot(r, eye) / w, -dot(u, eye) / h,
    -dot(b, eye) * dz - (far + near) / (far - near), 1,
  ]);
}

function projectPoint(m, position, width, height) {
  const [x, y, z] = position;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return {
    x: (0.5 + (m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5) * width,
    y: (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5) * height,
    depth: (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  };
}

const SOLID_VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute float aRole;
attribute float aBaseY;
uniform mat4 uMvp;
uniform mediump float uCut;
varying mediump vec3 vNormal;
varying mediump vec3 vColor;
varying mediump float vRole;
varying mediump float vBaseY;
varying mediump float vY;
void main() {
  vec3 p = aPosition;
  p.y = min(p.y, uCut);
  gl_Position = uMvp * vec4(p, 1.0);
  vY = p.y;
  vNormal = aNormal;
  vColor = aColor;
  vRole = aRole;
  vBaseY = aBaseY;
}`;

const SOLID_FRAGMENT = `
precision mediump float;
uniform float uFocus;
uniform float uLift;
uniform float uOpacity;
uniform mediump float uCut;
varying mediump vec3 vNormal;
varying mediump vec3 vColor;
varying mediump float vRole;
varying mediump float vBaseY;
varying mediump float vY;
void main() {
  if (vBaseY > uCut + 0.001) discard;
  vec3 normal = normalize(vNormal);
  if (!gl_FrontFacing) normal = -normal;
  // Soft sun from the upper left plus sky fill: faces read as planes, not flat cutouts.
  float sun = max(dot(normal, normalize(vec3(-0.45, 0.82, 0.36))), 0.0);
  float sky = 0.5 + 0.5 * normal.y;
  float light = 0.74 + 0.18 * sun + 0.08 * sky;
  vec3 color = vColor * light * mix(vec3(0.97, 0.98, 1.02), vec3(1.02, 1.0, 0.97), sun);
  // Gentle contact darkening for the first foot above an element's base.
  color *= 0.93 + 0.07 * clamp((vY - vBaseY) / 1.2, 0.0, 1.0);
  // Poche: where the level cut slices a wall, its cap reads solid ink, plan-drawing style.
  bool wallRole = abs(vRole - 5.0) < 0.1 || abs(vRole - 6.0) < 0.1 || abs(vRole - 8.0) < 0.1;
  if (wallRole && uCut < 90.0 && vY > uCut - 0.02 && normal.y > 0.7) color = vec3(0.16, 0.16, 0.17);
  float mark = uLift;
  if (uFocus > 0.5 && abs(vRole - uFocus) < 0.1) mark = 1.0;
  if (mark > 0.0) color = mix(color, vec3(0.12, 0.28, 0.72), 0.50 * mark);
  gl_FragColor = vec4(color, uOpacity);
}`;

const LINE_VERTEX = `
attribute vec3 aPosition;
attribute vec3 aColor;
attribute float aRole;
attribute float aBaseY;
uniform mat4 uMvp;
uniform mediump float uCut;
varying mediump vec3 vColor;
varying mediump float vRole;
varying mediump float vBaseY;
void main() {
  vec3 p = aPosition;
  p.y = min(p.y, uCut);
  gl_Position = uMvp * vec4(p, 1.0);
  vColor = aColor;
  vRole = aRole;
  vBaseY = aBaseY;
}`;

const LINE_FRAGMENT = `
precision mediump float;
uniform float uFocus;
uniform float uLift;
uniform float uOpacity;
uniform mediump float uCut;
varying mediump vec3 vColor;
varying mediump float vRole;
varying mediump float vBaseY;
void main() {
  if (vBaseY > uCut + 0.001) discard;
  vec3 color = vColor;
  float mark = uLift;
  if (uFocus > 0.5 && abs(vRole - uFocus) < 0.1) mark = 1.0;
  if (mark > 0.0) color = mix(color, vec3(0.08, 0.20, 0.55), mark);
  gl_FragColor = vec4(color, uOpacity);
}`;

const SHADOW_VERTEX = `
attribute vec3 aPosition;
uniform mat4 uMvp;
varying mediump vec2 vGround;
void main() {
  vGround = aPosition.xz;
  gl_Position = uMvp * vec4(aPosition, 1.0);
}`;

const SHADOW_FRAGMENT = `
precision mediump float;
uniform vec3 uPaper;
uniform float uStrength;
uniform vec4 uRects[3];
varying mediump vec2 vGround;
float rectangle(vec2 p, vec2 center, vec2 halfSize) {
  vec2 q = abs(p - center) - halfSize;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
void main() {
  float a = rectangle(vGround, uRects[0].xy, uRects[0].zw);
  float b = rectangle(vGround, uRects[1].xy, uRects[1].zw);
  float c = rectangle(vGround, uRects[2].xy, uRects[2].zw);
  float d = max(min(min(a, b), c), 0.0);
  float shadow = exp(-d * d / 13.0) * uStrength;
  gl_FragColor = vec4(uPaper * (1.0 - shadow), 1.0);
}`;

function labelsFor(model, progress, mvp, width, height, dive = 0, pixelsPerFoot = 0, largeTargets = false) {
  const upper = progress >= 0.50 && progress <= 0.66;
  const main = progress >= 0.68 && progress <= 0.84;
  // Three-level models label the lower floor on the last stage.
  const lower = progress >= 0.88 && model.labels.some(l => l.floor === 'lower');
  let opacity = upper
    ? smooth(0.50, 0.54, progress) * (1 - smooth(0.62, 0.66, progress))
    : main ? smooth(0.68, 0.72, progress) * (1 - smooth(0.80, 0.84, progress)) : lower ? smooth(0.88, 0.92, progress) : 0;
  // v9: on every stage, zooming in brings the room names up, then the fixtures.
  opacity = Math.max(opacity, smooth(0.2, 0.6, dive));
  if (opacity < 0.015) return [];
  const floor = progress < 0.67 ? 'upper' : lower ? 'lower' : 'main';
  const slab = progress >= 0.84;
  const labels = [];
  // Major rooms take priority when the phone view cannot fit every annotation.
  const narrow = width < 640;
  const fontPx = 11;
  // Use the renderer's camera-right measurement. A world-X measurement collapses
  // when that axis points into the view, hiding detail during an otherwise steady orbit.
  const ppf = Math.max(0, Number.isFinite(pixelsPerFoot) ? pixelsPerFoot : 0);
  const minorAt = narrow ? 12 : 8.5;
  const fixAt = narrow ? 14 : 15;
  const tierAlpha = (label) => label.tier === 2 ? (slab ? 0 : smooth(fixAt, fixAt + 5, ppf))
    : label.minor ? smooth(minorAt, minorAt + 1.5, ppf) : 1;
  const candidates = model.labels.filter(label => label.floor === floor && tierAlpha(label) > 0.02);
  candidates.sort((a, b) => {
    const rank = (label) => (label.tier === 2 ? 4 : 0) + Number(!!label.minor) + (narrow && /\bft\b/i.test(label.text) ? 1 : 0);
    return rank(a) - rank(b);
  });
  const limit = narrow ? (ppf < 13 ? 4 : 16) : candidates.length;
  const close = ppf >= 14;
  for (const label of candidates) {
    if (labels.length >= limit) break;
    const projected = projectPoint(mvp, label.position, width, height);
    const px = label.tier === 2 ? 10 : fontPx;
    // Reserve the entire button, including padding, border and the 44px touch
    // target. Text-only boxes let adjacent labels overlap on compact plans.
    const char = px * 0.82;
    const half = label.text.length * char * 0.5 + 10 + (label.tier === 2 ? 4 : 0);
    const vy = (largeTargets ? 44 : label.tier === 2 ? 24 : 30) * 0.5 + 3;
    const box = { left: projected.x - half - 2, right: projected.x + half + 2, top: projected.y - vy, bottom: projected.y + vy };
    if (box.left < 3 || box.right > width - 3 || box.top < 3 || box.bottom > height - 3) continue;
    if (labels.some(l => box.left < l.box.right && box.right > l.box.left && box.top < l.box.bottom && box.bottom > l.box.top)) continue;
    labels.push({ text: label.text, x: projected.x, y: projected.y, minor: !!label.minor, tier: label.tier || (label.minor ? 1 : 0),
      close, world: label.position, opacity: opacity * tierAlpha(label), box });
  }
  return labels.map(({ box, ...label }) => label);
}

function createRenderer(canvas, options) {
  options = options || {};
  const labelPointer = typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(pointer: coarse)') : null;
  const RS = (PROFILE && PROFILE.render) || {};
  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: !!RS.antialias, depth: true, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: !!options.preserveDrawingBuffer, powerPreference: 'low-power',
  });
  if (!gl) throw new Error('The drawing context is unavailable.');
  const buffers = [], programs = [];
  let disposed = false;
  const stats = { drawCalls: 0, triangles: 0, lineSegments: 0, bufferBytes: 0, renderCount: 0, pixelRatio: 1 };

  function makeProgram(vertexSource, fragmentSource, attributes, uniforms) {
    const shaders = [];
    let program = null;
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('A drawing shader could not be allocated.');
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('A drawing shader could not be compiled.');
      }
      program = gl.createProgram();
      if (!program) throw new Error('The drawing program could not be allocated.');
      for (const shader of shaders) gl.attachShader(program, shader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The drawing program could not be linked.');
      programs.push(program);
      return {
        program,
        attributes: Object.fromEntries(attributes.map(name => [name, gl.getAttribLocation(program, name)])),
        uniforms: Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(program, name)])),
      };
    } catch (error) {
      if (program && !programs.includes(program)) gl.deleteProgram(program);
      throw error;
    } finally {
      for (const shader of shaders) gl.deleteShader(shader);
    }
  }

  function upload(data, stride) {
    if (!data || data.length === 0) return null;
    if (!(data instanceof Float32Array) || data.length % stride !== 0) throw new Error('The drawing mesh is invalid.');
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('The drawing mesh could not be allocated.');
    buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    stats.bufferBytes += data.byteLength;
    return { buffer, count: data.length / stride };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    for (const program of programs) gl.deleteProgram(program);
    buffers.length = programs.length = 0;
  }

  function meshBounds(group) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const [data, stride] of [[group.solid, 11], [group.lines, 8]]) {
      for (let i = 0; i < data.length; i += stride) {
        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], data[i + axis]);
          max[axis] = Math.max(max[axis], data[i + axis]);
        }
      }
    }
    return { min, max };
  }

  let model, meshes, solidProgram, lineProgram, shadowProgram, shadow;
  try {
    model = options.model || PROFILE.build();
    solidProgram = makeProgram(SOLID_VERTEX, SOLID_FRAGMENT,
      ['aPosition', 'aNormal', 'aColor', 'aRole', 'aBaseY'], ['uMvp', 'uCut', 'uFocus', 'uLift', 'uOpacity']);
    lineProgram = makeProgram(LINE_VERTEX, LINE_FRAGMENT,
      ['aPosition', 'aColor', 'aRole', 'aBaseY'], ['uMvp', 'uCut', 'uFocus', 'uLift', 'uOpacity']);
    shadowProgram = makeProgram(SHADOW_VERTEX, SHADOW_FRAGMENT,
      ['aPosition'], ['uMvp', 'uPaper', 'uStrength', 'uRects']);
    meshes = model.groups.map(group => ({ id: group.id, bounds: meshBounds(group), solid: upload(group.solid, 11), lines: upload(group.lines, 8) }));
    // A single procedural contact-shadow surface; no shadow map or texture fetch.
    const B = model.bounds || PROFILE.bounds;
    const [x0, z0, x1, z1] = [B.min[0] - 20, B.min[2] - 20, B.max[0] + 20, B.max[2] + 20];
    shadow = upload(new Float32Array([
      x0, -0.46, z0, x1, -0.46, z0, x1, -0.46, z1,
      x0, -0.46, z0, x1, -0.46, z1, x0, -0.46, z1,
    ]), 3);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('The drawing buffers could not be initialized.');
  } catch (error) {
    dispose();
    throw error;
  }

  const maximumSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
  const viewportLimit = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  gl.clearColor(...PAPER, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE); // Thin roof and gable faces are intentionally two-sided.
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.lineWidth(1); // Portable on iOS and desktop; no unsupported thick GL lines.

  const enabledAttributes = new Set();
  function use(program) {
    for (const location of enabledAttributes) gl.disableVertexAttribArray(location);
    enabledAttributes.clear();
    gl.useProgram(program.program);
  }

  function attribute(program, name, size, stride, offset) {
    const location = program.attributes[name];
    if (location < 0) return;
    gl.enableVertexAttribArray(location);
    enabledAttributes.add(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
  }

  function setOpacity(opacity) {
    if (opacity < 0.999) { gl.enable(gl.BLEND); gl.depthMask(false); }
    else { gl.disable(gl.BLEND); gl.depthMask(true); }
  }

  function render(progress, focusId, width, height, orbit, groupView) {
    if (disposed) throw new Error('The drawing has been disposed.');
    if (gl.isContextLost()) return null;
    const p = clamp(Number.isFinite(progress) ? progress : 0);
    const cssW = Math.max(1, Number.isFinite(width) ? width : canvas.clientWidth);
    const cssH = Math.max(1, Number.isFinite(height) ? height : canvas.clientHeight);
    const displayDpr = Math.max(1, globalThis.devicePixelRatio || 1);
    const dpr = Math.min(displayDpr, RS.fullPixelRatio ? 3 : cssW < 600 ? 1.35 : 2,
      Math.sqrt(MAX_PIXELS / (cssW * cssH)),
      maximumSize / cssW, maximumSize / cssH,
      viewportLimit[0] / cssW, viewportLimit[1] / cssH);
    const bufferWidth = Math.max(1, Math.floor(cssW * dpr));
    const bufferHeight = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
      gl.viewport(0, 0, bufferWidth, bufferHeight);
    }
    stats.pixelRatio = dpr;
    stats.drawCalls = stats.triangles = stats.lineSegments = 0;
    stats.renderCount++;
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const camera = cameraFor(p, cssW, cssH, model.bounds || PROFILE.bounds, orbit);
    const mvp = computeMVP(camera);
    function focusFor(id, groupId) {
      let role = 0, lift = 0;
      if (id === 'stairs') role = 1;
      else if (id === 'header') role = 2;
      else if (id === 'porch') role = 3;
      else if (id === 'balcony' || id === 'deck') role = 4;
      else if (id === 'adu') role = 8;
      else if (id === 'garage' && (groupId === 'garage' || groupId === 'garageRoof')) lift = 1;
      else if (id === 'bearing' || id === 'framing') role = 5;
      else if (id === 'partition') role = 6;
      else if (id === 'foundation' || id === 'footings') role = 7;
      else if (id === 'roof' && (groupId === 'roof' || groupId === 'garageRoof' || groupId === 'porchRoof')) lift = 1;
      else if (id === 'structure' && (groupId === 'upper' || groupId === 'upperfloor')) lift = 1;
      return { role, lift };
    }
    const dive = diveAmount(orbit);
    const states = groupView
      ? meshes.map(mesh => {
          const g = groupView[mesh.id] || { visible: false, cut: 0, opacity: 0 };
          return {
            visible: !!g.visible,
            cut: Number.isFinite(g.cut) ? g.cut : 100,
            opacity: Number.isFinite(g.opacity) ? g.opacity : 1,
          };
        })
      : meshes.map(mesh => groupState(mesh.id, interiorProgress(p, dive)));
    // Fine interior detail (handles, joints, faucets, trim) only when zoomed in enough to read:
    // measured as screen pixels per foot, so phones and small windows skip it until zoomed.
    const zt = camera.target, zr = camera.right;
    const za = projectPoint(mvp, zt, cssW, cssH), zb = projectPoint(mvp, [zt[0] + zr[0] * 10, zt[1] + zr[1] * 10, zt[2] + zr[2] * 10], cssW, cssH);
    const pxPerFoot = Math.hypot(zb.x - za.x, zb.y - za.y) / 10;
    stats.pxPerFoot = pxPerFoot;
    // v9: fade fine detail in as the camera closes in, instead of popping it on.
    const fineIn = smooth(9, 13, pxPerFoot);
    for (let i = 0; i < meshes.length; i++) {
      if (!/Fine$/.test(meshes[i].id)) continue;
      if (fineIn < 0.02) states[i] = { visible: false, cut: 0, opacity: 0 };
      else states[i] = { visible: states[i].visible, cut: states[i].cut, opacity: states[i].opacity * fineIn };
    }

    use(shadowProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, shadow.buffer);
    attribute(shadowProgram, 'aPosition', 3, 3, 0);
    gl.uniformMatrix4fv(shadowProgram.uniforms.uMvp, false, mvp);
    gl.uniform3fv(shadowProgram.uniforms.uPaper, PAPER);
    gl.uniform4fv(shadowProgram.uniforms.uRects, new Float32Array(PROFILE.shadow.flat()));
    gl.uniform1f(shadowProgram.uniforms.uStrength, mix(0.14, 0.04, smooth(0.28, 0.78, p)));
    // The contact shadow sits under the lawn plate: no depth write, so a low-precision depth buffer (phones) cannot let it
    // z-fight the lawn and leave only dotted lawn edges.
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, shadow.count);
    gl.depthMask(true);
    stats.drawCalls++;
    stats.triangles += 2;

    const opaque = [], translucent = [];
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i], state = states[i];
      if ((!mesh.solid && !mesh.lines) || !state.visible || state.opacity < 0.001) continue;
      if (state.opacity >= 0.999) opaque.push(i);
      else {
        const b = mesh.bounds;
        const center = [
          (b.min[0] + b.max[0]) / 2,
          (Math.min(b.min[1], state.cut) + Math.min(b.max[1], state.cut)) / 2,
          (b.min[2] + b.max[2]) / 2,
        ];
        // Along camera.back, a smaller value is farther from the viewer.
        translucent.push({ index: i, depth: dot(center, camera.back) });
      }
    }
    translucent.sort((a, b) => a.depth - b.depth || a.index - b.index);

    let drawingProgram = null;
    function drawMesh(index, edges) {
      const mesh = meshes[index], state = states[index];
      const data = edges ? mesh.lines : mesh.solid;
      if (!data) return;
      const program = edges ? lineProgram : solidProgram;
      if (drawingProgram !== program) {
        use(program);
        drawingProgram = program;
        gl.uniformMatrix4fv(program.uniforms.uMvp, false, mvp);
        if (edges) gl.disable(gl.POLYGON_OFFSET_FILL);
        else { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1); }
      }
      const mark = focusFor(focusId, mesh.id);
      gl.uniform1f(program.uniforms.uFocus, mark.role);
      gl.uniform1f(program.uniforms.uLift, mark.lift);
      gl.uniform1f(program.uniforms.uCut, state.cut);
      gl.uniform1f(program.uniforms.uOpacity, state.opacity);
      setOpacity(state.opacity);
      gl.bindBuffer(gl.ARRAY_BUFFER, data.buffer);
      const stride = edges ? 8 : 11;
      attribute(program, 'aPosition', 3, stride, 0);
      if (!edges) attribute(program, 'aNormal', 3, stride, 3);
      attribute(program, 'aColor', 3, stride, edges ? 3 : 6);
      attribute(program, 'aRole', 1, stride, edges ? 6 : 9);
      attribute(program, 'aBaseY', 1, stride, edges ? 7 : 10);
      gl.drawArrays(edges ? gl.LINES : gl.TRIANGLES, 0, data.count);
      stats.drawCalls++;
      if (edges) stats.lineSegments += data.count / 2;
      else stats.triangles += data.count / 3;
    }
    // Populate depth with all opaque surfaces before drawing their visible edges.
    for (const index of opaque) drawMesh(index, false);
    for (const index of opaque) drawMesh(index, true);
    // Fading surfaces blend over the completed opaque image. Keep each group's
    // edges with its surfaces so nearer translucent groups also tint far edges.
    // Group-level sorting avoids a per-frame triangle sort for this teaching model.
    for (const item of translucent) { drawMesh(item.index, false); drawMesh(item.index, true); }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return { labels: labelsFor(model, p, mvp, cssW, cssH, dive, pxPerFoot, !!(labelPointer && labelPointer.matches)), stageIndex: stageAt(p), camera, pxPerFoot, dive };
  }

  return { render, dispose, stats, model };
}

  var STAGES = [];
  var FLY_ANGLE = {};
  var mountedRoots = new WeakMap();


  /** Pick the project for a model root: data-ppgm-project names a registered project,
   *  or an inline <script type="application/json" class="ppgm-config"> carries the house data. */
  function useProject(root) {
    var id = root.getAttribute("data-ppgm-project") || "magnolia";
    var node = root.querySelector("script.ppgm-config");
    if (node && !PROJECTS[id]) {
      try { register(id, JSON.parse(node.textContent)); } catch (e) { return false; }
    }
    var reg = globalThis.HouseModelProjects || {};
    if (!PROJECTS[id] && reg[id]) register(id, reg[id]);
    if (!PROJECTS[id]) return false;
    usePROFILE(id);
    return true;
  }
  function usePROFILE(id) {
    PROFILE = PROJECTS[id];
    STAGES = PROFILE.stages;
    FLY_ANGLE = PROFILE.flyAngle;
    return PROFILE;
  }

  /** Mount once; return a controller for page-builder navigation and cleanup. */
  function mount(target) {
    if (typeof document === "undefined") return null;
    var root = typeof target === "string" ? document.querySelector(target)
      : target || document.querySelector(".ppgm-house[data-ppgm-project]") || document.getElementById("ppgm-house");
    if (!root) return null;
    if (mountedRoots.has(root)) return mountedRoots.get(root);
    if (!useProject(root)) return null;
    if (root.getAttribute("data-ppgm-ready") === "1") return null;
    var track = root.querySelector(".ppgm-house-track");
    var sticky = root.querySelector(".ppgm-house-sticky");
    var sheet = root.querySelector(".ppgm-house-sheet");
    var canvas = root.querySelector(".ppgm-house-canvas");
    var labelsEl = root.querySelector(".ppgm-labels");
    var lineEl = root.querySelector("#ppgm-house-line");
    var bar = root.querySelector(".ppgm-progress span");
    var range = root.querySelector(".ppgm-scrub");
    var stageNodes = root.querySelectorAll(".ppgm-stages button");
    var learnSets = root.querySelectorAll(".ppgm-learn-set");
    var learnNotes = root.querySelectorAll(".ppgm-note");
    var learnPrompt = root.querySelector(".ppgm-learn-prompt");
    var callButtons = root.querySelectorAll(".ppgm-call");
    var exploreBar = root.querySelector(".ppgm-explore");
    var exploreToggle = root.querySelector(".ppgm-explore-toggle");
    var exploreReset = root.querySelector(".ppgm-explore-reset");
    var zoomIn = root.querySelector("[data-ppgm-zoom='in']");
    var zoomOut = root.querySelector("[data-ppgm-zoom='out']");
    var roomNodes = root.querySelectorAll(".ppgm-rooms");
    var roomSelect = root.querySelector(".ppgm-room-select");
    var viewButtons = root.querySelectorAll("[data-ppgm-view]");
    var stageReadout = root.querySelector(".ppgm-stage-current");
    var stageCount = root.querySelector(".ppgm-stage-count");
    var fallbackMessage = root.querySelector(".ppgm-fallback-message");
    if (!track || !sticky || !sheet || !canvas || !labelsEl) return null;
    root.setAttribute("data-ppgm-ready", "1");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    var coarse = window.matchMedia("(hover: none), (pointer: coarse)");
    var removers = [];
    var labelNodes = new Map();
    var pointers = new Map();
    var engine = null;
    var focusId = "";
    var current = "";
    var rendered = 0;
    var lastTime = 0;
    var raf = 0;
    var running = false;
    var dirty = true;
    var lost = false;
    var disposed = false;
    var explore = false;
    var dragging = false;
    var sheetW = 1, sheetH = 1, sheetLeft = 0, sheetTop = 0;
    // View state: `view` is what is drawn, `goal` is where the camera is heading.
    // Every input edits `goal`; each frame `view` eases toward it, so all moves are smooth.
    var view = { yaw: 0, pitch: 0, zoom: 1, focus: null };
    var goal = { yaw: 0, pitch: 0, zoom: 1, focus: null };
    var releaseFocus = false;
    var tau = 90;
    var ZOOM_MAX = 1.25;
    var gesture = null;
    var hintEl = null;
    var hintTimer = 0;
    var touchMode = "";
    var roomFloor = "";
    var selectedView = "";
    // Every model starts on its first stage: the full 3D exterior with the roof on, never the plan
    // or top view. The layer is driven by scroll, so a restored scroll position would open on a
    // later stage; load at the top instead (a #link target still scrolls where it points).
    var START_PROGRESS = 0;
    try { if (!location.hash && "scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
    var inViewport = true;
    var resizeObserver = null;
    var visibleObserver = null;
    var controller = null;

    function on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      removers.push(function () { target.removeEventListener(type, handler, options); });
    }

    function stageByProgress(p) {
      var i;
      for (i = 0; i < STAGES.length; i++) if (p < STAGES[i].end) return STAGES[i];
      return STAGES[STAGES.length - 1];
    }

    function stickyTop() {
      var raw = window.getComputedStyle(sticky).top;
      if (!raw || raw === "auto") return 0;
      return parseFloat(raw) || 0;
    }

    var manual = null;
    var fitted = false;

    function contentFits() {
      if (window.matchMedia("(max-height: 520px)").matches) return false;
      var rootFont = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      if (rootFont > 20) return false;
      var wasEnhanced = root.classList.contains("ppgm-is-enhanced");
      root.classList.remove("ppgm-is-enhanced");
      var natural = sticky.scrollHeight;
      if (wasEnhanced) root.classList.add("ppgm-is-enhanced");
      return natural <= window.innerHeight - 8;
    }

    function syncFlow() {
      if (reduced.matches || lost) {
        root.classList.remove("ppgm-is-enhanced");
        root.classList.add("ppgm-is-flow");
        return;
      }
      // Embedded in an iframe (embed/magnolia-house.html): no page scroll to
      // drive the peel, so stay in flow mode where stage buttons, the
      // scrubber and drag set the stage directly.
      var fits = root.hasAttribute("data-ppgm-embed") ? false : contentFits();
      root.classList.toggle("ppgm-is-enhanced", fits);
      root.classList.toggle("ppgm-is-flow", !fits);
      // Preserve the chosen stage if an embed changes size or leaves scroll mode.
      if (!fits && manual == null) manual = rendered;
    }

    function scrollProgress() {
      if (!root.classList.contains("ppgm-is-enhanced")) return manual == null ? START_PROGRESS : manual;
      var rect = track.getBoundingClientRect();
      var travel = track.offsetHeight - sticky.offsetHeight;
      if (travel <= 1) return manual == null ? START_PROGRESS : manual;
      var scrolled = stickyTop() - rect.top;
      if (scrolled <= 0) return 0;
      if (scrolled >= travel) return 1;
      return scrolled / travel;
    }

    function scrollToProgress(p) {
      if (disposed || lost) return;
      p = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
      if (!isDefault(goal) || !isDefault(view)) resetView(true);
      if (!root.classList.contains("ppgm-is-enhanced")) {
        manual = p;
        dirty = true;
        kick();
        return;
      }
      var rect = track.getBoundingClientRect();
      var travel = Math.max(1, track.offsetHeight - sticky.offsetHeight);
      var y = window.scrollY + rect.top - stickyTop() + travel * p;
      window.scrollTo({ top: y, behavior: "instant" });
      dirty = true;
      kick();
    }

    function applyFocus(id) {
      focusId = id || "";
      var i;
      for (i = 0; i < callButtons.length; i++) {
        var onNote = callButtons[i].getAttribute("data-ppgm-callout") === focusId && focusId !== "";
        callButtons[i].setAttribute("aria-pressed", onNote ? "true" : "false");
        callButtons[i].classList.toggle("ppgm-is-on", onNote);
      }
      for (i = 0; i < learnNotes.length; i++) {
        learnNotes[i].classList.toggle("ppgm-is-open", learnNotes[i].getAttribute("data-ppgm-callout") === focusId && focusId !== "");
      }
      if (learnPrompt) learnPrompt.classList.toggle("ppgm-is-hidden", focusId !== "");
      dirty = true;
    }

    function focusBelongs(stageId) {
      var s, b;
      if (!focusId) return true;
      for (s = 0; s < learnSets.length; s++) {
        if (learnSets[s].getAttribute("data-ppgm-stage") !== stageId) continue;
        var buttons = learnSets[s].querySelectorAll(".ppgm-call");
        for (b = 0; b < buttons.length; b++) {
          if (buttons[b].getAttribute("data-ppgm-callout") === focusId) return true;
        }
      }
      return false;
    }

    function showStageSet(stageId) {
      var i;
      for (i = 0; i < learnSets.length; i++) learnSets[i].hidden = learnSets[i].getAttribute("data-ppgm-stage") !== stageId;
      if (!focusBelongs(stageId)) applyFocus("");
    }

    function now() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }
    function stageId() { return current || stageByProgress(rendered).id; }
    function stageInfo() { return stageByProgress(rendered); }
    function floorKey() { return rendered < 0.67 ? "upper" : rendered >= 0.86 && PROFILE.floorY.lower != null ? "lower" : "main"; }
    function floorY() { return PROFILE.floorY[floorKey()]; }

    function isDefault(s) {
      return Math.abs(s.yaw) < 1e-4 && Math.abs(s.pitch) < 1e-4 && Math.abs(s.zoom - 1) < 1e-4 && !s.focus;
    }
    function orbitFrom(s) { return { yaw: s.yaw, pitch: s.pitch, zoom: s.zoom, focus: s.focus }; }
    function orbitArgs() {
      if (!explore && isDefault(view) && isDefault(goal)) return null;
      return orbitFrom(view);
    }
    function camFor(s) { return cameraFor(rendered, sheetW, sheetH, PROFILE.bounds, orbitFrom(s)); }
    // Slide a point along the view direction onto a floor plane: the picture does not change,
    // but turning the model then pivots on the floor point under the pointer.
    function toFloor(pt, cam, y) {
      var by = cam.back[1] > 0.05 ? cam.back[1] : 0.05;
      var t = (pt[1] - y) / by;
      return [pt[0] - cam.back[0] * t, pt[1] - cam.back[1] * t, pt[2] - cam.back[2] * t];
    }
    function clampFocus(f) {
      var B = PROFILE.bounds; return [Math.min(B.max[0] + 12, Math.max(B.min[0] - 12, f[0])), f[1], Math.min(B.max[2] + 8, Math.max(B.min[2] - 8, f[2]))];
    }
    function zoomMin() {
      var c = cameraFor(rendered, sheetW, sheetH, PROFILE.bounds, { yaw: goal.yaw, pitch: goal.pitch, zoom: 1, focus: goal.focus || [0, 0, 0] });
      // Closest view still shows about ten feet across the narrow side of the drawing.
      return Math.max(0.05, 5 / Math.max(1, Math.min(c.halfHeight, c.halfWidth)));
    }
    function defaultFocus() {
      var c = camFor({ yaw: goal.yaw, pitch: goal.pitch, zoom: 1, focus: null });
      return toFloor(c.target, c, floorY());
    }
    function ensureFocus() {
      if (!goal.focus) {
        var c = camFor(goal);
        goal.focus = toFloor(c.target, c, floorY());
      }
      if (!view.focus) {
        var v = camFor(view);
        view.focus = toFloor(v.target, v, floorY());
      }
    }
    function clampPitch(s) {
      var angle = scrollPose(rendered).angle + s.pitch;
      var minAngle = 0.02, maxAngle = 78 * Math.PI / 180;
      if (angle < minAngle) s.pitch += minAngle - angle;
      else if (angle > maxAngle) s.pitch -= angle - maxAngle;
    }
    function ndc(clientX, clientY) {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return { x: 0, y: 0 };
      // Scrolling the host page can move the canvas without resizing it.
      var rect = canvas.getBoundingClientRect();
      sheetLeft = rect.left; sheetTop = rect.top;
      sheetW = Math.max(1, rect.width); sheetH = Math.max(1, rect.height);
      return { x: (clientX - sheetLeft) / sheetW * 2 - 1, y: 1 - (clientY - sheetTop) / sheetH * 2 };
    }
    function screenToFloor(clientX, clientY, s, y) {
      var c = camFor(s), o = ndc(clientX, clientY), i, pt = [];
      for (i = 0; i < 3; i++) pt[i] = c.target[i] + c.right[i] * o.x * c.halfWidth + c.up[i] * o.y * c.halfHeight;
      return toFloor(pt, c, y);
    }
    function wake(speed) {
      if (disposed || lost) return;
      if (speed) tau = speed;
      dirty = true;
      updateTouch();
      kick();
    }

    /** Zoom toward a screen point: the spot under the cursor or fingers stays put. */
    function zoomAt(clientX, clientY, factor, speed) {
      ensureFocus();
      releaseFocus = false;
      var c = camFor(goal);
      var nz = Math.min(ZOOM_MAX, Math.max(zoomMin(), goal.zoom * factor));
      if (factor > 1 && nz >= 0.985 && goal.zoom < 0.985) { resetView(false, true); return; }
      var f = nz / goal.zoom, o = ndc(clientX, clientY), i, nt = [];
      var ox = o.x * c.halfWidth, oy = o.y * c.halfHeight;
      for (i = 0; i < 3; i++) nt[i] = c.target[i] + (c.right[i] * ox + c.up[i] * oy) * (1 - f);
      goal.focus = clampFocus(toFloor(nt, c, floorY()));
      goal.zoom = nz;
      wake(speed || 90);
    }
    function panBy(dx, dy) {
      ensureFocus();
      releaseFocus = false;
      var c = camFor(goal), sx = 2 * c.halfWidth / sheetW, sy = 2 * c.halfHeight / sheetH, i, nt = [];
      for (i = 0; i < 3; i++) nt[i] = c.target[i] - c.right[i] * dx * sx + c.up[i] * dy * sy;
      goal.focus = clampFocus(toFloor(nt, c, floorY()));
      wake(60);
    }
    function orbitBy(dx, dy) {
      selectedView = "";
      goal.yaw -= dx * 0.0075;
      goal.pitch -= dy * 0.0045;
      clampPitch(goal);
      wake(60);
    }
    /** Smooth fly-in: the camera dives to a point, settling into a three-quarter look. */
    function flyTo(point, zoomTarget, angle) {
      selectedView = "";
      ensureFocus();
      releaseFocus = false;
      goal.focus = clampFocus(point);
      goal.zoom = Math.min(ZOOM_MAX, Math.max(zoomMin(), zoomTarget));
      if (Number.isFinite(angle)) {
        goal.pitch = angle - scrollPose(rendered).angle;
        clampPitch(goal);
      }
      wake(190);
    }
    function roomFit(room) {
      var c1 = cameraFor(rendered, sheetW, sheetH, PROFILE.bounds, { yaw: goal.yaw, pitch: goal.pitch, zoom: 1, focus: room.center });
      var bw = room.box[2] - room.box[0], bd = room.box[3] - room.box[1];
      var need = Math.hypot(bw, bd) * 0.5 / Math.min(1, sheetW / sheetH) * 0.86;
      return Math.min(0.34, need / c1.halfHeight);
    }
    function flyToRoom(room) {
      var z = roomFit(room);
      // Already this close: keep diving instead of pulling back out to frame the room.
      if (goal.zoom <= z * 1.05) z = goal.zoom * 0.6;
      flyTo(room.center, z, FLY_ANGLE[stageId()]);
      announce("Showing " + room.text.replace(/ SF$/, " square feet") + ".");
    }
    function resetView(instant, keepAngle) {
      selectedView = "";
      if (roomSelect) roomSelect.value = "";
      releaseFocus = true;
      goal.zoom = 1;
      if (!keepAngle) { goal.yaw = 0; goal.pitch = 0; }
      goal.focus = (goal.focus || view.focus) ? defaultFocus() : null;
      if (!goal.focus) releaseFocus = false;
      if (instant) {
        view.yaw = goal.yaw; view.pitch = goal.pitch; view.zoom = 1;
        view.focus = goal.focus = null; releaseFocus = false;
      }
      wake(170);
    }
    function nudgeZoom(factor) { zoomAt(null, null, factor, 140); }

    function roomAt(clientX, clientY) {
      var model = engine && engine.model;
      if (!model || !model.rooms) return null;
      var key = floorKey();
      var pt = screenToFloor(clientX, clientY, view, PROFILE.pickY[key]);
      var best = null, bestArea = Infinity, near = null, nearD = 9, i, r;
      for (i = 0; i < model.rooms.length; i++) {
        r = model.rooms[i];
        if (r.floor !== key) continue;
        if (pt[0] >= r.box[0] && pt[0] <= r.box[2] && pt[2] >= r.box[1] && pt[2] <= r.box[3]) {
          var area = (r.box[2] - r.box[0]) * (r.box[3] - r.box[1]);
          if (area < bestArea) { bestArea = area; best = r; }
        }
        var d = Math.hypot(pt[0] - r.center[0], pt[2] - r.center[2]);
        if (d < nearD) { nearD = d; near = r; }
      }
      return best || near;
    }
    function roomNamed(text) {
      var model = engine && engine.model, i;
      if (!model || !model.rooms) return null;
      for (i = 0; i < model.rooms.length; i++) if (model.rooms[i].text === text && model.rooms[i].floor === floorKey()) return model.rooms[i];
      return null;
    }
    function updateRoomChoices() {
      if (!roomSelect || !engine) return;
      // Three-level models list the lower floor rooms on the last stage; two-level models have only the slab there.
      var floor = rendered >= 0.84 && PROFILE.floorY.lower == null ? "" : floorKey();
      if (floor !== roomFloor) {
        roomFloor = floor;
        roomSelect.replaceChildren();
        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = floor ? "Go to a room" : "Room views unavailable at foundation";
        roomSelect.appendChild(placeholder);
        engine.model.rooms.forEach(function (room) {
          if (room.floor !== floor) return;
          var option = document.createElement("option");
          option.value = room.text;
          option.textContent = room.text;
          roomSelect.appendChild(option);
        });
      }
      roomSelect.disabled = !floor;
    }

    function setCameraView(name) {
      if (disposed || lost || (name !== "plan" && name !== "perspective")) return;
      var p = scrollProgress();
      // A plan of a roofed stage first exposes the occupied main level.
      if (name === "plan" && p < 0.48) p = 0.56;
      scrollToProgress(p);
      rendered = p;
      setExplore(true);
      resetView(true);
      var pose = scrollPose(p);
      goal.yaw = (name === "plan" ? 0 : -36 * Math.PI / 180) - pose.heading;
      goal.pitch = (name === "plan" ? 0.02 : 52 * Math.PI / 180) - pose.angle;
      selectedView = name;
      announce(name === "plan" ? "Plan view." : "Perspective view.");
      wake(150);
    }
    function tapAt(clientX, clientY) {
      var room = roomAt(clientX, clientY);
      // Tap a room to fly into it; once inside, a tap dives further toward the tapped spot.
      if (room && goal.zoom > roomFit(room) * 1.05) flyToRoom(room);
      else zoomAt(clientX, clientY, 0.5, 190);
    }

    var live = document.createElement("p");
    live.className = "ppgm-explore-help";
    live.setAttribute("aria-live", "polite");
    root.appendChild(live);
    function announce(text) { live.textContent = text; }

    function showHint() {
      if (!hintEl) {
        hintEl = document.createElement("p");
        hintEl.className = "ppgm-gesture";
        hintEl.setAttribute("aria-hidden", "true");
        sheet.appendChild(hintEl);
      }
      hintEl.textContent = coarse.matches
        ? "Drag to turn \u00b7 Pinch to zoom \u00b7 Two fingers pan \u00b7 Tap a room to fly in"
        : "Drag to turn \u00b7 Scroll to zoom \u00b7 Right-drag to pan \u00b7 Click a room to explore \u00b7 Esc to finish";
      hintEl.classList.add("ppgm-is-shown");
      if (hintTimer) clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { if (hintEl) hintEl.classList.remove("ppgm-is-shown"); }, 3400);
    }

    function updateTouch() {
      // Explicit explore mode owns the whole gesture. Otherwise the page owns scrolling
      // and browser pinch zoom; changing touch-action mid-gesture cannot reclaim a swipe.
      var mode = !explore ? "pan-y pinch-zoom" : "none";
      if (mode !== touchMode) {
        touchMode = mode;
        canvas.style.touchAction = mode;
        sheet.style.touchAction = mode;
        if (labelsEl) labelsEl.style.touchAction = mode;
        root.classList.toggle("ppgm-is-captured", mode === "none");
      }
    }

    function toggleText() {
      if (!exploreToggle) return;
      exploreToggle.textContent = explore ? "Done exploring" : "Explore the " + stageInfo().noun;
    }

    function setExplore(on) {
      if (disposed || lost) return;
      on = !!on;
      if (on === explore) return;
      explore = on;
      root.classList.toggle("ppgm-is-explore", explore);
      toggleText();
      if (exploreReset) exploreReset.hidden = !explore;
      if (zoomIn) zoomIn.hidden = !explore;
      if (zoomOut) zoomOut.hidden = !explore;
      if (labelsEl) labelsEl.setAttribute("aria-hidden", explore ? "false" : "true");
      if (!explore) {
        dragging = false;
        gesture = null;
        pointers.forEach(function (_, id) { try { sheet.releasePointerCapture(id); } catch (e) { /* already released */ } });
        pointers.clear();
        root.classList.remove("ppgm-is-dragging");
        if (hintEl) hintEl.classList.remove("ppgm-is-shown");
        resetView(false);
      } else {
        showHint();
      }
      announce(explore ? "Exploring the " + stageInfo().noun + "." : "");
      wake();
    }

    function updateExploreChrome(stageChanged) {
      if (exploreBar) exploreBar.hidden = false;
      if (stageChanged) {
        toggleText();
      }
      for (var i = 0; i < viewButtons.length; i++) {
        viewButtons[i].setAttribute("aria-pressed", viewButtons[i].getAttribute("data-ppgm-view") === selectedView ? "true" : "false");
      }
      if (zoomIn) zoomIn.disabled = goal.zoom <= zoomMin() + 0.001;
      if (zoomOut) zoomOut.disabled = goal.zoom >= ZOOM_MAX - 0.001;
      updateRoomChoices();
    }

    function stepView(dt) {
      if (reduced.matches) {
        var changed = view.yaw !== goal.yaw || view.pitch !== goal.pitch || view.zoom !== goal.zoom ||
          JSON.stringify(view.focus) !== JSON.stringify(goal.focus);
        view.yaw = goal.yaw; view.pitch = goal.pitch; view.zoom = goal.zoom;
        view.focus = goal.focus ? goal.focus.slice() : null;
        if (releaseFocus) { view.focus = goal.focus = null; releaseFocus = false; changed = true; }
        return changed;
      }
      var k = 1 - Math.exp(-dt / tau);
      var moving = false, d, i;
      d = goal.yaw - view.yaw;
      if (Math.abs(d) > 1e-4) { view.yaw += d * k; moving = true; } else view.yaw = goal.yaw;
      d = goal.pitch - view.pitch;
      if (Math.abs(d) > 1e-4) { view.pitch += d * k; moving = true; } else view.pitch = goal.pitch;
      d = Math.log(goal.zoom) - Math.log(view.zoom);
      if (Math.abs(d) > 1e-4) { view.zoom = Math.exp(Math.log(view.zoom) + d * k); moving = true; } else view.zoom = goal.zoom;
      if (goal.focus) {
        if (!view.focus) view.focus = goal.focus.slice();
        var far = 0;
        for (i = 0; i < 3; i++) { d = goal.focus[i] - view.focus[i]; far = Math.max(far, Math.abs(d)); view.focus[i] += d * k; }
        if (far > 0.002) moving = true; else view.focus = goal.focus.slice();
      } else view.focus = null;
      if (!moving && releaseFocus) {
        view.focus = goal.focus = null;
        releaseFocus = false;
        updateTouch();
        return true;
      }
      return moving;
    }

    function renderLabels(labels) {
      var accepted = labels || [];
      var seen = new Set(), i, item, key, node;
      var interactive = explore;
      for (i = 0; i < accepted.length; i++) {
        item = accepted[i];
        key = item.text + "@" + item.world[0].toFixed(1) + "," + item.world[2].toFixed(1);
        seen.add(key);
        node = labelNodes.get(key);
        if (!node) {
          node = document.createElement("button");
          node.type = "button";
          node.className = "ppgm-label";
          node.textContent = item.text;
          node.setAttribute("data-key", key);
          node.setAttribute("data-text", item.text);
          node.setAttribute("data-tier", String(item.tier));
          node.setAttribute("data-x", String(item.world[0]));
          node.setAttribute("data-y", String(item.world[1]));
          node.setAttribute("data-z", String(item.world[2]));
          node.setAttribute("aria-label", (item.tier === 2 ? "Zoom to " : "Fly into ") + item.text.replace(/ SF$/, " square feet"));
          node.classList.toggle("ppgm-is-fix", item.tier === 2);
          node.classList.toggle("ppgm-is-dim", item.tier === 1 || /\bft\b/i.test(item.text));
          labelsEl.appendChild(node);
          labelNodes.set(key, node);
        }
        node.hidden = false;
        node.tabIndex = interactive ? 0 : -1;
        node.classList.toggle("ppgm-is-close", !!item.close && item.tier !== 2);
        node.style.transform = "translate(" + item.x.toFixed(1) + "px," + item.y.toFixed(1) + "px) translate(-50%,-50%)";
        node.style.opacity = String(Math.round(item.opacity * 100) / 100);
      }
      labelNodes.forEach(function (n, k) {
        if (seen.has(k)) return;
        // Do not strand keyboard focus on an invisible label after the camera moves.
        if (n === document.activeElement) canvas.focus({ preventScroll: true });
        n.tabIndex = -1;
        n.hidden = true;
      });
      root.classList.toggle("ppgm-has-labels", accepted.length > 0);
      root.classList.toggle("ppgm-is-plan", rendered >= 0.68 && rendered <= 0.84 && accepted.length > 0);
      root.classList.toggle("ppgm-is-upper-labels", rendered >= 0.50 && rendered < 0.67 && accepted.length > 0);
    }

    function paint(p) {
      if (!engine || lost) return;
      var rect = sheet.getBoundingClientRect();
      sheetW = Math.max(1, rect.width); sheetH = Math.max(1, rect.height);
      sheetLeft = rect.left; sheetTop = rect.top;
      var result = engine.render(p, focusId, sheetW, sheetH, orbitArgs());
      if (!result) { fail(); return; }
      sheet.removeAttribute("role");
      sheet.removeAttribute("aria-label");
      renderLabels(result.labels);
      root.classList.toggle("ppgm-is-dive", result.dive > 0.05);
      var narrowLabels = rect.width < 640;
      for (var r = 0; r < roomNodes.length; r++) {
        var which = roomNodes[r].getAttribute("data-ppgm-rooms");
        var showRooms = narrowLabels && ((which === "main" && p >= 0.68 && p <= 0.84) || (which === "upper" && p >= 0.50 && p < 0.67));
        roomNodes[r].hidden = !showRooms;
      }
      if (bar) bar.style.transform = "scaleX(" + p.toFixed(5) + ")";
      if (range) {
        if (document.activeElement !== range) range.value = String(Math.round(p * 1000));
        var rangeProgress = Number(range.value) / 1000;
        range.setAttribute("aria-valuetext", stageByProgress(rangeProgress).noun + ", " + Math.round(rangeProgress * 100) + " percent");
      }
      root.classList.toggle("ppgm-is-scrolled", p > 0.04);
      root.classList.toggle("ppgm-is-late", p > 0.8);
      root.classList.add("ppgm-is-drawn");
      if (!fitted) { fitted = true; syncFlow(); }
      var stage = stageByProgress(p);
      var changed = stage.id !== current;
      if (changed) {
        current = stage.id;
        if (lineEl) lineEl.textContent = stage.line;
        if (stageReadout) stageReadout.textContent = stage.id === "house" ? "Finished house" : stage.noun.charAt(0).toUpperCase() + stage.noun.slice(1);
        if (stageCount) stageCount.textContent = String(STAGES.indexOf(stage) + 1).padStart(2, "0") + " / " + String(STAGES.length).padStart(2, "0");
        var n;
        for (n = 0; n < stageNodes.length; n++) {
          var on = stageNodes[n].getAttribute("data-ppgm-stage") === stage.id;
          var item = stageNodes[n].parentElement;
          if (item) item.classList.toggle("ppgm-is-on", on);
          if (on) stageNodes[n].setAttribute("aria-current", "step");
          else stageNodes[n].removeAttribute("aria-current");
        }
        showStageSet(stage.id);
      }
      updateExploreChrome(changed);
    }

    function kick() {
      if (disposed || lost || !running || document.hidden || raf) return;
      raf = window.requestAnimationFrame(draw);
    }

    function draw(t) {
      raf = 0;
      if (disposed || lost || !running || !engine || document.hidden) return;
      var target = scrollProgress();
      var dt = lastTime ? Math.min(64, Math.max(1, t - lastTime)) : 16;
      lastTime = t;
      var diff = target - rendered;
      if (reduced.matches || Math.abs(diff) < 0.0004) rendered = target;
      else rendered += diff * (1 - Math.exp(-dt / 70));
      var moving = Math.abs(target - rendered) >= 0.0004;
      var animating = stepView(dt);
      if (moving || dirty || animating) {
        try {
          dirty = false;
          paint(rendered);
        } catch (error) {
          fail();
          return;
        }
      }
      if (!animating) tau = 90;
      if (moving || animating || dirty) kick();
      else lastTime = 0;
    }

    function destroyEngine() {
      if (!engine) return;
      try { engine.dispose(); } catch (e) { /* context may already be gone */ }
      engine = null;
    }

    function fail() {
      if (explore) setExplore(false);
      lost = true;
      stop();
      destroyEngine();
      root.classList.add("ppgm-is-fallback");
      root.classList.remove("ppgm-is-drawn", "ppgm-is-explore", "ppgm-is-captured", "ppgm-is-dragging");
      syncFlow();
      stageNodes.forEach(function (button) { button.disabled = true; });
      if (range) range.disabled = true;
      if (exploreBar) exploreBar.hidden = true;
      if (roomSelect) roomSelect.disabled = true;
      labelsEl.setAttribute("aria-hidden", "true");
      sheet.setAttribute("role", "img");
      sheet.setAttribute("aria-label", PROFILE.sheetLabel);
      if (fallbackMessage) fallbackMessage.hidden = false;
      announce("Interactive 3D is unavailable. A static house drawing and project notes are shown instead.");
    }

    function start() {
      if (disposed || lost || !inViewport || document.hidden) return;
      root.classList.remove("ppgm-is-still", "ppgm-is-fallback");
      if (fallbackMessage) fallbackMessage.hidden = true;
      if (!engine) {
        try { engine = createRenderer(canvas); }
        catch (e) { fail(); return; }
      }
      rendered = scrollProgress();
      stageNodes.forEach(function (button) { button.disabled = false; });
      if (range) range.disabled = false;
      if (exploreBar) exploreBar.hidden = false;
      dirty = true;
      running = true;
      kick();
    }

    function stop() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      lastTime = 0;
    }

    function destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      destroyEngine();
      removers.forEach(function (fn) { fn(); });
      pointers.clear();
      labelNodes.forEach(function (node) { node.remove(); });
      labelNodes.clear();
      live.remove();
      if (hintEl) hintEl.remove();
      mountedRoots.delete(root);
      root.removeAttribute("data-ppgm-ready");
      root.classList.remove("ppgm-is-drawn", "ppgm-is-enhanced", "ppgm-is-explore", "ppgm-is-captured", "ppgm-is-dragging");
      root.classList.add("ppgm-is-flow", "ppgm-is-fallback");
      canvas.style.removeProperty("touch-action");
      sheet.style.removeProperty("touch-action");
      labelsEl.style.removeProperty("touch-action");
      if (exploreBar) exploreBar.hidden = true;
      stageNodes.forEach(function (button) { button.disabled = true; });
      if (range) range.disabled = true;
    }

    on(root, "click", function (event) {
      var btn = event.target && event.target.closest ? event.target.closest(".ppgm-call") : null;
      if (btn && root.contains(btn)) {
        var id = btn.getAttribute("data-ppgm-callout");
        applyFocus(focusId === id ? "" : id);
        kick();
        return;
      }
      var stageButton = event.target && event.target.closest ? event.target.closest(".ppgm-stages button") : null;
      if (stageButton && root.contains(stageButton)) scrollToProgress(parseFloat(stageButton.getAttribute("data-ppgm-progress")) || 0);
    });
    on(root, "keydown", function (event) {
      var stageButton = event.target && event.target.closest ? event.target.closest(".ppgm-stages button") : null;
      if (!stageButton || !root.contains(stageButton)) return;
      var items = Array.prototype.slice.call(stageNodes);
      var index = items.indexOf(stageButton);
      var next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        next = items[Math.min(items.length - 1, index + 1)];
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        next = items[Math.max(0, index - 1)];
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        next = items[event.key === "Home" ? 0 : items.length - 1];
      }
      if (next) {
        next.focus();
        scrollToProgress(parseFloat(next.getAttribute("data-ppgm-progress")) || 0);
      }
    });
    if (range) {
      on(range, "input", function () {
        var p = Number(range.value) / 1000;
        range.setAttribute("aria-valuetext", stageByProgress(p).noun + ", " + Math.round(p * 100) + " percent");
        scrollToProgress(p);
      });
    }
    if (roomSelect) on(roomSelect, "change", function () {
      var room = roomNamed(roomSelect.value);
      if (!room) return;
      setExplore(true);
      flyToRoom(room);
    });
    viewButtons.forEach(function (button) {
      on(button, "click", function () { setCameraView(button.getAttribute("data-ppgm-view")); });
    });
    if (exploreToggle) {
      on(exploreToggle, "click", function () { setExplore(!explore); });
    }
    if (exploreReset) {
      on(exploreReset, "click", function () { resetView(false); announce("View reset."); });
    }
    if (zoomIn) on(zoomIn, "click", function () { nudgeZoom(1 / 1.6); });
    if (zoomOut) on(zoomOut, "click", function () { nudgeZoom(1.6); });
    on(root, "keydown", function (event) {
      if (event.key === "Escape" && explore) { event.preventDefault(); setExplore(false); if (canvas) canvas.focus({ preventScroll: true }); }
    });
    on(canvas, "keydown", function (event) {
      var handled = true, step = event.shiftKey;
      if (event.key === "ArrowLeft") step ? panBy(40, 0) : orbitBy(-18, 0);
      else if (event.key === "ArrowRight") step ? panBy(-40, 0) : orbitBy(18, 0);
      else if (event.key === "ArrowUp") step ? panBy(0, 40) : orbitBy(0, 18);
      else if (event.key === "ArrowDown") step ? panBy(0, -40) : orbitBy(0, -18);
      else if (event.key === "+" || event.key === "=") nudgeZoom(1 / 1.6);
      else if (event.key === "-" || event.key === "_") nudgeZoom(1.6);
      else if (event.key === "0" || event.key === "Home") resetView(false);
      else if ((event.key === "Enter" || event.key === " ") && !explore) { /* turns explore on below */ }
      else handled = false;
      if (!handled) return;
      event.preventDefault();
      if (!explore) setExplore(true);
    });
    on(canvas, "click", function (event) {
      if (explore) return;
      setExplore(true);
    });
    on(sheet, "contextmenu", function (event) { if (explore && !onChrome(event)) event.preventDefault(); });
    if (labelsEl) {
      on(labelsEl, "click", function (event) {
        var node = event.target && event.target.closest ? event.target.closest(".ppgm-label") : null;
        if (!node) return;
        if (!explore) setExplore(true);
        var text = node.getAttribute("data-text");
        var world = [parseFloat(node.getAttribute("data-x")), parseFloat(node.getAttribute("data-y")), parseFloat(node.getAttribute("data-z"))];
        var room = node.getAttribute("data-tier") === "2" ? null : roomNamed(text);
        if (room) flyToRoom(room);
        else { flyTo(world, Math.min(goal.zoom * 0.5, 0.14), FLY_ANGLE[stageId()]); announce("Zooming to " + text); }
      });
    }
    on(sheet, "wheel", function (event) {
      if (exploreBar && exploreBar.contains(event.target)) return;
      if (!explore) {
        if (!event.ctrlKey) return; // plain wheel keeps scrolling the page
        setExplore(true); // trackpad pinch over the drawing
      }
      var dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
      // Fully zoomed out at the scroll camera: let the wheel scroll the page again.
      if (dy > 0 && !event.ctrlKey && goal.zoom >= 0.985) return;
      event.preventDefault();
      dy = Math.max(-160, Math.min(160, dy));
      zoomAt(event.clientX, event.clientY, Math.exp(dy * (event.ctrlKey ? 0.012 : 0.0024)), 80);
    }, { passive: false });

    function midpoint() {
      var xs = 0, ys = 0, n = 0;
      pointers.forEach(function (pt) { xs += pt.x; ys += pt.y; n++; });
      return { x: xs / Math.max(1, n), y: ys / Math.max(1, n) };
    }
    function spread() {
      var pts = [];
      pointers.forEach(function (pt) { pts.push(pt); });
      return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    function capture(id) {
      try { sheet.setPointerCapture(id); } catch (e) { /* already released */ }
    }
    function onChrome(event) {
      var t = event.target;
      return !!(t && t.closest && (t.closest(".ppgm-explore") || t.closest(".ppgm-gesture")));
    }
    // Gestures are read on the whole sheet, so a drag or pinch that starts on a room label still works.
    on(sheet, "pointerdown", function (event) {
      if (disposed || lost || onChrome(event)) return;
      if (event.pointerType === "mouse" && event.button > 2) return;
      if (!explore && event.pointerType === "mouse" && event.button === 0) setExplore(true);
      if (!explore) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, label: !!(event.target && event.target.closest && event.target.closest(".ppgm-label")) });
      // Capture right away, except on a label: capturing there would retarget its click to the sheet.
      if (!pointers.get(event.pointerId).label) capture(event.pointerId);
      if (pointers.size >= 2) {
        gesture = { kind: "pinch", dist: spread(), mid: midpoint(), moved: true };
      } else {
        var pan = event.pointerType === "mouse" && (event.button === 1 || event.button === 2 || event.shiftKey);
        gesture = { kind: pan ? "pan" : "orbit", sx: event.clientX, sy: event.clientY, t: now(), moved: false };
      }
      if (event.pointerType === "mouse") event.preventDefault();
    });
    on(sheet, "pointermove", function (event) {
      var tracked = pointers.get(event.pointerId);
      if (!tracked || !explore || !gesture) return;
      var prev = { x: tracked.x, y: tracked.y };
      tracked.x = event.clientX; tracked.y = event.clientY;
      if (gesture.kind === "pinch") {
        if (pointers.size < 2) return;
        if (tracked.label) { tracked.label = false; capture(event.pointerId); }
        var dist = spread(), mid = midpoint();
        if (gesture.dist > 0 && dist > 0) zoomAt(mid.x, mid.y, gesture.dist / dist, 50);
        panBy(mid.x - gesture.mid.x, mid.y - gesture.mid.y);
        gesture.dist = dist; gesture.mid = mid;
        return;
      }
      if (!gesture.moved && Math.hypot(event.clientX - gesture.sx, event.clientY - gesture.sy) < 6) return;
      if (!gesture.moved) {
        gesture.moved = true;
        if (tracked.label) capture(event.pointerId);
        dragging = true;
        root.classList.add("ppgm-is-dragging");
      }
      if (gesture.kind === "pan") panBy(event.clientX - prev.x, event.clientY - prev.y);
      else orbitBy(event.clientX - prev.x, event.clientY - prev.y);
    });
    function releasePointer(event) {
      var had = pointers.has(event.pointerId);
      if (!had) return;
      // Moving capture to the sheet makes a label or the canvas lose its implicit touch capture;
      // only the sheet's own capture ending means the pointer is gone.
      if (event.type === "lostpointercapture" && event.target !== sheet) return;
      var g = gesture;
      var onLabel = pointers.get(event.pointerId).label;
      pointers.delete(event.pointerId);
      // A tap on a label is handled by the label's own click (keyboard and screen readers use it too).
      if (event.type === "pointerup" && !onLabel && g && g.kind === "orbit" && !g.moved && now() - g.t < 600 && pointers.size === 0) {
        tapAt(event.clientX, event.clientY);
      }
      if (pointers.size === 1 && g && g.kind === "pinch") {
        // One finger left after a pinch: carry on turning from where it is, without a jump.
        var rest = null;
        pointers.forEach(function (pt) { rest = pt; });
        gesture = { kind: "orbit", sx: rest.x, sy: rest.y, t: 0, moved: true };
      } else if (pointers.size === 0) {
        gesture = null;
        dragging = false;
        root.classList.remove("ppgm-is-dragging");
      }
    }
    on(sheet, "pointerup", releasePointer);
    on(sheet, "pointercancel", releasePointer);
    on(sheet, "lostpointercapture", releasePointer);
    on(window, "scroll", function () {
      if (root.classList.contains("ppgm-is-enhanced")) { dirty = true; kick(); }
    }, { passive: true });
    on(window, "resize", function () { fitted = false; dirty = true; kick(); }, { passive: true });
    on(window, "orientationchange", function () { fitted = false; dirty = true; kick(); }, { passive: true });
    on(document, "visibilitychange", function () {
      if (document.hidden) stop();
      else { dirty = true; start(); }
    });
    on(canvas, "webglcontextlost", function (event) {
      event.preventDefault();
      fail();
    });
    on(canvas, "webglcontextrestored", function () {
      if (disposed) return;
      lost = false;
      root.classList.remove("ppgm-is-fallback");
      destroyEngine();
      syncFlow();
      start();
    });
    function motionChanged() {
      manual = rendered;
      syncFlow();
      dirty = true;
      start();
    }
    if (reduced.addEventListener) on(reduced, "change", motionChanged);
    else if (reduced.addListener) {
      reduced.addListener(motionChanged);
      removers.push(function () { reduced.removeListener(motionChanged); });
    }
    on(window, "pagehide", function (event) {
      // A cached page keeps its DOM and listeners. Dispose only for a real unload.
      if (event.persisted) stop();
      else destroy();
    });
    on(window, "pageshow", function (event) {
      if (event.persisted) { fitted = false; dirty = true; start(); }
    });
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function () { fitted = false; dirty = true; kick(); });
      resizeObserver.observe(sheet);
      removers.push(function () { resizeObserver.disconnect(); });
    }
    if (window.IntersectionObserver) {
      visibleObserver = new IntersectionObserver(function (entries) {
        inViewport = entries.some(function (entry) { return entry.isIntersecting; });
        if (inViewport) { dirty = true; start(); }
        else stop();
      }, { rootMargin: "200px 0px" });
      visibleObserver.observe(root);
      removers.push(function () { visibleObserver.disconnect(); });
      var initialRect = root.getBoundingClientRect();
      inViewport = initialRect.bottom >= -200 && initialRect.top <= window.innerHeight + 200;
    }
    removers.push(function () { if (hintTimer) clearTimeout(hintTimer); });
    // The toggle's visible name changes ("Explore the roof" / "Done exploring"), so it carries no aria-pressed state.
    if (exploreToggle) exploreToggle.removeAttribute("aria-pressed");
    applyFocus("");
    labelsEl.setAttribute("aria-hidden", "true");
    if (exploreReset) exploreReset.hidden = true;
    if (zoomIn) zoomIn.hidden = true;
    if (zoomOut) zoomOut.hidden = true;
    if (roomSelect) roomSelect.value = "";
    if (fallbackMessage) fallbackMessage.hidden = true;
    toggleText();
    if (exploreBar) exploreBar.hidden = false;
    root.classList.remove("ppgm-is-fallback", "ppgm-is-still");
    roomFloor = "uninitialized";
    updateTouch();
    syncFlow();
    controller = {
      setProgress: scrollToProgress,
      selectStage: function (id) {
        var stage = STAGES.find(function (item) { return item.id === id; });
        if (!stage) return false;
        scrollToProgress(stage.progress);
        return true;
      },
      explore: setExplore,
      reset: function () { if (!disposed && !lost) resetView(reduced.matches); },
      setView: setCameraView,
      getState: function () {
        return { stage: stageByProgress(rendered).id, progress: rendered, exploring: explore,
          reducedMotion: reduced.matches, fallback: lost, disposed: disposed,
          view: { yaw: view.yaw, pitch: view.pitch, zoom: view.zoom, focus: view.focus && view.focus.slice() },
          stats: engine ? Object.assign({}, engine.stats) : null };
      },
      destroy: destroy
    };
    mountedRoots.set(root, controller);
    start();
    return controller;
  }

  function openViewer(canvas, project) {
    if (project) usePROFILE(project);
    var engine = createRenderer(canvas, { preserveDrawingBuffer: true });
    return {
      draw: function (spec) {
        spec = spec || {};
        var w = spec.width || canvas.clientWidth || 320;
        var h = spec.height || canvas.clientHeight || 180;
        return engine.render(spec.progress || 0, spec.focus || "", w, h, spec.orbit || null, spec.groups || null);
      },
      dispose: function () { engine.dispose(); }
    };
  }

  return {
    version: "3.0.0",
    mount: mount,
    register: register,
    buildFromConfig: buildFromConfig,
    profileFor: profileFor,
    useProfile: usePROFILE,
    buildModel: function () { return PROFILE.build(); },
    cameraFor: cameraFor,
    computeMVP: computeMVP,
    projectPoint: projectPoint,
    groupState: groupState,
    stageAt: stageAt,
    openViewer: openViewer,
    get STAGES() { return STAGES; },
    get profile() { return PROFILE; },
    util: { clamp: clamp, mix: mix, smooth: smooth },
    PAPER: PAPER
  };
});

