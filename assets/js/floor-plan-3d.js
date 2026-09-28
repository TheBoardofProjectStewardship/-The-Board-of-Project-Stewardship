/* Floor plan to 3D walkthrough - Board of Project Stewardship.
   Illustrative planning sketch only. Everything runs in the browser; nothing is uploaded. */
const RENDER_LIB = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const STORE_KEY = 'board-floorplan-3d-v1';
const WALL_H = 9, WALL_T = 0.5, DOOR_H = 6.8, SILL = 3, HEAD = 7, CUT_H = 4, EYE = 5.3;
const SVGNS = 'http://www.w3.org/2000/svg';

const CATALOG = {
  sofa: { label: 'Sofa', w: 7, d: 3, h: 2.8, color: '#6b7a8f' },
  bed: { label: 'Bed (queen)', w: 5, d: 6.7, h: 2, color: '#c9b79c' },
  table: { label: 'Dining table', w: 6, d: 3.5, h: 2.5, color: '#8b5a2b' },
  counter: { label: 'Kitchen counter', w: 8, d: 2, h: 3, color: '#d6d3cd' },
  island: { label: 'Kitchen island', w: 6, d: 3, h: 3, color: '#b8b2a7' },
  fridge: { label: 'Refrigerator', w: 3, d: 2.5, h: 6, color: '#e5e7eb' },
  tub: { label: 'Tub', w: 5, d: 2.5, h: 1.8, color: '#f1f5f9' },
  vanity: { label: 'Vanity', w: 4, d: 1.8, h: 2.8, color: '#9ca3af' },
  toilet: { label: 'Toilet', w: 1.6, d: 2.4, h: 2.5, color: '#f8fafc' },
  desk: { label: 'Desk', w: 5, d: 2.5, h: 2.5, color: '#7c5c3b' },
  wardrobe: { label: 'Wardrobe', w: 6, d: 2, h: 7, color: '#a8a29e' },
  rug: { label: 'Area rug', w: 8, d: 5, h: 0.05, color: '#3f6d52' },
};

/* ---------- sample plans (feet) ---------- */
function build(walls, openings, items, labels) {
  let n = 0;
  const ws = walls.map(([x1, y1, x2, y2]) => ({ id: 'w' + (++n), x1, y1, x2, y2 }));
  const os = openings.map(([wi, t, width, type]) => ({ id: 'o' + (++n), wallId: ws[wi].id, t, width, type }));
  const is = items.map(([kind, x, y, rot]) => ({ id: 'i' + (++n), kind, x, y, rot: rot || 0 }));
  const ls = (labels || []).map(([text, x, y]) => ({ id: 'l' + (++n), text, x, y }));
  return { walls: ws, openings: os, items: is, labels: ls };
}
const SAMPLES = {
  cottage: {
    name: 'Two-bedroom cottage',
    make: () => build(
      [[0, 0, 32, 0], [32, 0, 32, 24], [32, 24, 0, 24], [0, 24, 0, 0], [20, 0, 20, 24], [20, 12, 32, 12], [0, 14, 8, 14], [8, 14, 8, 24]],
      [[0, 10 / 32, 3, 'door'], [0, 4 / 32, 4, 'window'], [0, 26 / 32, 4, 'window'], [1, 0.25, 4, 'window'], [1, 0.75, 4, 'window'],
       [2, 0.56, 5, 'window'], [3, 0.75, 4, 'window'], [3, 0.2, 2, 'window'], [4, 9 / 24, 2.67, 'door'], [4, 15 / 24, 2.67, 'door'], [7, 0.3, 2.5, 'door']],
      [['rug', 9, 5.5, 0], ['sofa', 9, 3.2, 0], ['table', 5, 10, 90], ['counter', 14, 22.9, 0], ['island', 14, 18.8, 0], ['fridge', 18.6, 22.6, 0],
       ['bed', 26, 4.2, 0], ['wardrobe', 26, 10.9, 0], ['bed', 26, 19.8, 180], ['desk', 22.8, 14, 90], ['tub', 4, 22.6, 0], ['vanity', 1.1, 17.5, 90], ['toilet', 6.6, 15.4, 180]],
      [['Living', 9, 8], ['Kitchen', 14, 16], ['Bath', 4, 19.5], ['Bedroom', 26, 7.5], ['Bedroom', 26, 16]]),
  },
  greatroom: {
    name: 'Open kitchen + great room',
    make: () => build(
      [[0, 0, 30, 0], [30, 0, 30, 20], [30, 20, 0, 20], [0, 20, 0, 0], [22, 12, 30, 12], [22, 12, 22, 14]],
      [[0, 0.2, 5, 'window'], [0, 0.55, 8, 'window'], [0, 0.85, 3, 'door'], [1, 0.3, 4, 'window'], [2, 0.5, 6, 'window'], [3, 0.5, 6, 'door'], [4, 0.3, 3, 'door']],
      [['counter', 26, 19, 0], ['counter', 29, 16, 90], ['island', 16, 14, 0], ['fridge', 21.5, 18.7, 0], ['table', 7, 15, 0], ['sofa', 9, 4, 0], ['rug', 9, 7, 0]],
      [['Great room', 8, 9], ['Kitchen', 16, 17], ['Pantry', 26, 6]]),
  },
  adu: {
    name: 'Backyard ADU',
    make: () => build(
      [[0, 0, 20, 0], [20, 0, 20, 24], [20, 24, 0, 24], [0, 24, 0, 0], [0, 14, 20, 14], [12, 14, 12, 24]],
      [[0, 0.3, 3, 'door'], [0, 0.72, 5, 'window'], [1, 0.3, 4, 'window'], [3, 0.7, 4, 'window'], [4, 0.3, 2.67, 'door'], [4, 0.8, 2.5, 'door'], [2, 0.3, 2, 'window'], [2, 0.75, 4, 'window']],
      [['counter', 10, 13, 0], ['fridge', 16.5, 12.7, 0], ['sofa', 5, 3.5, 0], ['table', 15, 6, 0], ['bed', 5.5, 20, 180], ['tub', 17.5, 22.6, 0], ['vanity', 13, 16.5, 90], ['toilet', 18.6, 15.6, 180]],
      [['Living + kitchen', 9, 8], ['Bedroom', 5, 16.5], ['Bath', 16, 19]]),
  },
};

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));
const len = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
const snapTo = (v, s) => Math.round(v / s) * s;
function fmtFt(v) {
  let ft = Math.floor(v + 1e-6), inch = Math.round((v - ft) * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return `${ft}\u2032-${inch}\u2033`;
}
function wallFrame(w) {
  const L = len(w) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
  return { L, ux, uy, nx: -uy, ny: ux };
}
function projectOnWall(w, x, y) {
  const f = wallFrame(w);
  const s = Math.max(0, Math.min(f.L, (x - w.x1) * f.ux + (y - w.y1) * f.uy));
  const px = w.x1 + f.ux * s, py = w.y1 + f.uy * s;
  return { s, t: s / f.L, d: Math.hypot(x - px, y - py) };
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function itemSize(it) {
  const c = CATALOG[it.kind] || CATALOG.sofa;
  const r = ((it.rot % 180) + 180) % 180;
  return r === 90 ? { w: c.d, d: c.w, h: c.h } : { w: c.w, d: c.d, h: c.h };
}
function bounds(plan) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const w of plan.walls) { x0 = Math.min(x0, w.x1, w.x2); x1 = Math.max(x1, w.x1, w.x2); y0 = Math.min(y0, w.y1, w.y2); y1 = Math.max(y1, w.y1, w.y2); }
  for (const it of plan.items) { const s = itemSize(it); x0 = Math.min(x0, it.x - s.w / 2); x1 = Math.max(x1, it.x + s.w / 2); y0 = Math.min(y0, it.y - s.d / 2); y1 = Math.max(y1, it.y + s.d / 2); }
  if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 24, y1: 20 };
  return { x0, y0, x1, y1 };
}
function wallBounds(plan) {
  if (!plan.walls.length) return bounds(plan);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const w of plan.walls) { x0 = Math.min(x0, w.x1, w.x2); x1 = Math.max(x1, w.x1, w.x2); y0 = Math.min(y0, w.y1, w.y2); y1 = Math.max(y1, w.y1, w.y2); }
  return { x0, y0, x1, y1 };
}
/* Solid wall pieces around door and window openings (shared by 3D, fallback drawing, and walk collision). */
function wallPieces(plan, H) {
  const out = [];
  for (const w of plan.walls) {
    const f = wallFrame(w); const L = f.L; if (L < 0.05) continue;
    const ops = plan.openings.filter((o) => o.wallId === w.id)
      .map((o) => ({ o, a: o.t * L - o.width / 2, b: o.t * L + o.width / 2 })).sort((p, q) => p.a - q.a);
    let cur = 0;
    const seg = (s, e, z0, z1, kind) => { if (e - s > 0.01 && z1 - z0 > 0.01) out.push({ w, f, s, e, z0, z1, kind: kind || 'wall', L }); };
    for (const p of ops) {
      const a = Math.max(cur, p.a), b = Math.min(L, p.b);
      if (b <= a) continue;
      seg(cur, a, 0, H);
      if (p.o.type === 'door') seg(a, b, Math.min(DOOR_H, H), H);
      else { seg(a, b, 0, Math.min(SILL, H)); seg(a, b, Math.min(SILL, H), Math.min(HEAD, H), 'glass'); seg(a, b, Math.min(HEAD, H), H); }
      cur = b;
    }
    seg(cur, L, 0, H);
  }
  return out;
}

/* ---------- state ---------- */
let plan = null;
let history = [];
let selected = null; // {type:'item'|'wall'|'opening'|'label', id}
let tool = 'select';
let view = { x: -4, y: -4, w: 40, h: 32 };
let underlay = { url: null, opacity: 0.45, width: 32 };
const opts = { cutaway: true, roof: false, walk: false };
let idSeq = 1000;
const nid = (p) => p + (++idSeq);

function status(msg) { const el = $('fp-status'); if (el) el.textContent = msg; }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)); } catch (e) { /* private mode */ } }
function pushHistory() { history.push(JSON.stringify(plan)); if (history.length > 60) history.shift(); }
function undo() { if (!history.length) return status('Nothing to undo.'); plan = JSON.parse(history.pop()); selected = null; changed(false); status('Undone.'); }
function changed(fit) { if (fit) fitView(); save(); render2D(); scene3D.rebuild(); updateSelectionUI(); }
function valid(p) { return p && Array.isArray(p.walls) && Array.isArray(p.openings) && Array.isArray(p.items); }
function loadSample(key) {
  const s = SAMPLES[key] || SAMPLES.cottage; pushHistory();
  plan = s.make(); plan.labels = plan.labels || []; selected = null; changed(true);
  status(`Loaded sample: ${s.name}. Drag furniture, add walls, doors, and windows, then look around in 3D.`);
}

/* ---------- 2D plan editor ---------- */
const svg = $('fp-plan');
function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function fitView() {
  const b = bounds(plan), pad = 4;
  const box = svg.getBoundingClientRect(); const aspect = box.width > 10 && box.height > 10 ? box.width / box.height : 1.3;
  let w = Math.max(20, b.x1 - b.x0 + pad * 2), h = Math.max(16, b.y1 - b.y0 + pad * 2);
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  view = { x: (b.x0 + b.x1) / 2 - w / 2, y: (b.y0 + b.y1) / 2 - h / 2, w, h };
}
function toPlan(evt) {
  const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
  const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m.inverse()); return { x: p.x, y: p.y };
}
let preview = null; // wall being drawn
function render2D() {
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  svg.innerHTML = '';
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'fp-grid1', width: 1, height: 1, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M1 0H0V1', fill: 'none', stroke: 'rgba(255,255,255,0.05)', 'stroke-width': 0.04 }, pat);
  const pat5 = el('pattern', { id: 'fp-grid5', width: 5, height: 5, patternUnits: 'userSpaceOnUse' }, defs);
  el('rect', { width: 5, height: 5, fill: 'url(#fp-grid1)' }, pat5);
  el('path', { d: 'M5 0H0V5', fill: 'none', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': 0.06 }, pat5);
  if (underlay.url) {
    el('image', { href: underlay.url, x: 0, y: 0, width: underlay.width, opacity: underlay.opacity, preserveAspectRatio: 'xMinYMin meet' }, svg);
  }
  el('rect', { x: view.x - 50, y: view.y - 50, width: view.w + 100, height: view.h + 100, fill: 'url(#fp-grid5)', 'pointer-events': 'none' }, svg);
  const gItems = el('g', {}, svg), gWalls = el('g', {}, svg), gOps = el('g', {}, svg), gText = el('g', { 'pointer-events': 'none' }, svg);
  for (const it of plan.items) {
    const c = CATALOG[it.kind] || CATALOG.sofa; const sel = selected && selected.id === it.id;
    const g = el('g', { transform: `translate(${it.x} ${it.y}) rotate(${it.rot})`, 'data-type': 'item', 'data-id': it.id, class: 'fp-hit' }, gItems);
    el('rect', { x: -c.w / 2, y: -c.d / 2, width: c.w, height: c.d, rx: 0.2, fill: c.color, 'fill-opacity': it.kind === 'rug' ? 0.35 : 0.55, stroke: sel ? '#4ade80' : 'rgba(255,255,255,0.55)', 'stroke-width': sel ? 0.18 : 0.06 }, g);
    const t = el('text', { x: 0, y: 0.25, 'font-size': 0.7, fill: '#e2e8f0', 'text-anchor': 'middle', 'pointer-events': 'none', transform: `rotate(${-it.rot})` }, g);
    t.textContent = c.label.replace(/ \(.*\)/, '');
  }
  for (const w of plan.walls) {
    const sel = selected && selected.id === w.id;
    el('line', { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, stroke: sel ? '#4ade80' : '#e7e2d8', 'stroke-width': WALL_T, 'stroke-linecap': 'square' }, gWalls);
    el('line', { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, stroke: 'transparent', 'stroke-width': 1.4, 'data-type': 'wall', 'data-id': w.id, class: 'fp-hit' }, gWalls);
    const f = wallFrame(w);
    if (f.L >= 3) {
      const mx = (w.x1 + w.x2) / 2 + f.nx * 0.9, my = (w.y1 + w.y2) / 2 + f.ny * 0.9;
      let ang = Math.atan2(f.uy, f.ux) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
      const t = el('text', { x: mx, y: my, 'font-size': 0.6, fill: '#94a3b8', 'text-anchor': 'middle', 'dominant-baseline': 'middle', transform: `rotate(${ang} ${mx} ${my})` }, gText);
      t.textContent = fmtFt(f.L);
    }
  }
  for (const o of plan.openings) {
    const w = plan.walls.find((q) => q.id === o.wallId); if (!w) continue;
    const f = wallFrame(w); const sel = selected && selected.id === o.id;
    const cx = w.x1 + f.ux * o.t * f.L, cy = w.y1 + f.uy * o.t * f.L;
    const ax = cx - f.ux * o.width / 2, ay = cy - f.uy * o.width / 2, bx = cx + f.ux * o.width / 2, by = cy + f.uy * o.width / 2;
    const g = el('g', { 'data-type': 'opening', 'data-id': o.id, class: 'fp-hit' }, gOps);
    el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: '#111814', 'stroke-width': WALL_T + 0.08 }, g);
    const col = sel ? '#4ade80' : (o.type === 'door' ? '#fbbf24' : '#7dd3fc');
    if (o.type === 'door') {
      const px = ax + f.nx * o.width, py = ay + f.ny * o.width;
      const cross = f.nx * f.uy - f.ny * f.ux;
      el('line', { x1: ax, y1: ay, x2: px, y2: py, stroke: col, 'stroke-width': 0.1 }, g);
      el('path', { d: `M${px} ${py} A${o.width} ${o.width} 0 0 ${cross > 0 ? 1 : 0} ${bx} ${by}`, fill: 'none', stroke: col, 'stroke-width': 0.06, 'stroke-dasharray': '0.3 0.2' }, g);
    } else {
      for (const k of [-0.12, 0.12]) el('line', { x1: ax + f.nx * k, y1: ay + f.ny * k, x2: bx + f.nx * k, y2: by + f.ny * k, stroke: col, 'stroke-width': 0.08 }, g);
    }
    el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: 'transparent', 'stroke-width': 1.6 }, g);
  }
  for (const l of plan.labels || []) {
    const sel = selected && selected.id === l.id;
    const t = el('text', { x: l.x, y: l.y, 'font-size': 0.9, 'font-weight': 700, fill: sel ? '#4ade80' : 'rgba(226,232,240,0.8)', 'text-anchor': 'middle', 'letter-spacing': 0.05, 'data-type': 'label', 'data-id': l.id, class: 'fp-hit', 'pointer-events': 'all' }, svg);
    t.textContent = l.text.toUpperCase();
  }
  if (preview) {
    el('line', { x1: preview.x1, y1: preview.y1, x2: preview.x2, y2: preview.y2, stroke: '#4ade80', 'stroke-width': WALL_T, 'stroke-opacity': 0.7, 'stroke-linecap': 'square' }, svg);
    const t = el('text', { x: (preview.x1 + preview.x2) / 2, y: (preview.y1 + preview.y2) / 2 - 0.8, 'font-size': 0.8, fill: '#4ade80', 'text-anchor': 'middle' }, svg);
    t.textContent = fmtFt(len(preview));
  }
}
function snapPoint(p) {
  let best = null, bd = 0.8;
  for (const w of plan.walls) for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = { x, y }; } }
  return best || { x: snapTo(p.x, 0.5), y: snapTo(p.y, 0.5) };
}
function nearestWall(p, maxD) {
  let best = null, bd = maxD;
  for (const w of plan.walls) { const pr = projectOnWall(w, p.x, p.y); if (pr.d < bd) { bd = pr.d; best = { w, pr }; } }
  return best;
}
function clampOpening(o, w) {
  const L = len(w); const m = (o.width / 2 + 0.25) / L;
  o.t = Math.max(m, Math.min(1 - m, o.t));
}
let drag = null;
svg.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  const p = toPlan(e); const hit = e.target.closest('.fp-hit');
  if (tool === 'select') {
    if (!hit) { selected = null; render2D(); updateSelectionUI(); return; }
    selected = { type: hit.dataset.type, id: hit.dataset.id };
    if (selected.type === 'item' || selected.type === 'opening' || selected.type === 'label') {
      const obj = findSel(); drag = { start: p, orig: clone(obj), moved: false, snapshot: JSON.stringify(plan) };
      svg.setPointerCapture(e.pointerId);
    }
    render2D(); updateSelectionUI(); return;
  }
  if (tool === 'wall') { const s = snapPoint(p); preview = { x1: s.x, y1: s.y, x2: s.x, y2: s.y }; svg.setPointerCapture(e.pointerId); render2D(); return; }
  if (tool === 'door' || tool === 'window') {
    const nw = nearestWall(p, 1.5); const width = tool === 'door' ? 3 : 4;
    if (!nw) return status('Tap on or near a wall to add a ' + tool + '.');
    if (len(nw.w) < width + 0.5) return status('That wall is too short for a ' + tool + '.');
    pushHistory(); const o = { id: nid('o'), wallId: nw.w.id, t: nw.pr.t, width, type: tool }; clampOpening(o, nw.w);
    plan.openings.push(o); selected = { type: 'opening', id: o.id }; changed(false); status(`Added a ${tool}. Use Select to slide it along the wall.`); return;
  }
  if (tool === 'item') {
    pushHistory(); const kind = $('fp-kind').value;
    const it = { id: nid('i'), kind, x: snapTo(p.x, 0.25), y: snapTo(p.y, 0.25), rot: 0 };
    plan.items.push(it); selected = { type: 'item', id: it.id }; changed(false); status(`Placed ${CATALOG[kind].label}. Press R or Rotate to turn it.`); return;
  }
  if (tool === 'label') {
    const text = (window.prompt('Room label', 'Room') || '').trim().slice(0, 28); if (!text) return;
    pushHistory(); const l = { id: nid('l'), text, x: snapTo(p.x, 0.5), y: snapTo(p.y, 0.5) };
    plan.labels.push(l); selected = { type: 'label', id: l.id }; changed(false);
  }
});
svg.addEventListener('pointermove', (e) => {
  const p = toPlan(e);
  if (preview) {
    let s = snapPoint(p); const dx = s.x - preview.x1, dy = s.y - preview.y1;
    const ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    if (ang < 8 || ang > 172) s = { x: s.x, y: preview.y1 }; else if (Math.abs(ang - 90) < 8) s = { x: preview.x1, y: s.y };
    preview.x2 = s.x; preview.y2 = s.y; render2D(); return;
  }
  if (drag) {
    const obj = findSel(); if (!obj) return;
    const dx = p.x - drag.start.x, dy = p.y - drag.start.y; if (Math.hypot(dx, dy) > 0.1) drag.moved = true;
    if (selected.type === 'opening') {
      const w = plan.walls.find((q) => q.id === obj.wallId); if (!w) return;
      obj.t = projectOnWall(w, p.x, p.y).t; clampOpening(obj, w);
    } else { obj.x = snapTo(drag.orig.x + dx, 0.25); obj.y = snapTo(drag.orig.y + dy, 0.25); }
    render2D();
  }
});
function endPointer() {
  if (preview) {
    const w = preview; preview = null;
    if (len(w) >= 1) { pushHistory(); plan.walls.push({ id: nid('w'), x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }); changed(false); status(`Wall added: ${fmtFt(len(w))}. Keep drawing, or switch to Door or Window.`); }
    else render2D();
    return;
  }
  if (drag) { if (drag.moved) { history.push(drag.snapshot); if (history.length > 60) history.shift(); changed(false); } drag = null; }
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
function findSel() {
  if (!selected) return null;
  const list = { item: plan.items, wall: plan.walls, opening: plan.openings, label: plan.labels }[selected.type] || [];
  return list.find((x) => x.id === selected.id) || null;
}
function deleteSelected() {
  const obj = findSel(); if (!obj) return status('Select something first.');
  pushHistory();
  if (selected.type === 'item') plan.items = plan.items.filter((x) => x !== obj);
  if (selected.type === 'label') plan.labels = plan.labels.filter((x) => x !== obj);
  if (selected.type === 'opening') plan.openings = plan.openings.filter((x) => x !== obj);
  if (selected.type === 'wall') { plan.walls = plan.walls.filter((x) => x !== obj); plan.openings = plan.openings.filter((o) => o.wallId !== obj.id); }
  selected = null; changed(false); status('Deleted.');
}
function rotateSelected() {
  const obj = findSel();
  if (!obj || selected.type !== 'item') return status('Select a furniture piece to rotate it.');
  pushHistory(); obj.rot = (obj.rot + 90) % 360; changed(false);
}
function updateSelectionUI() {
  const obj = findSel(); const info = $('fp-selinfo'); if (!info) return;
  if (!obj) { info.textContent = 'Nothing selected'; return; }
  if (selected.type === 'item') info.textContent = `${CATALOG[obj.kind].label} \u00b7 ${fmtFt(itemSize(obj).w)} \u00d7 ${fmtFt(itemSize(obj).d)}`;
  else if (selected.type === 'wall') info.textContent = `Wall \u00b7 ${fmtFt(len(obj))}`;
  else if (selected.type === 'opening') info.textContent = `${obj.type === 'door' ? 'Door' : 'Window'} \u00b7 ${fmtFt(obj.width)} wide`;
  else info.textContent = `Label \u00b7 ${obj.text}`;
}
function setTool(t) {
  tool = t;
  document.querySelectorAll('[data-fp-tool]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.fpTool === t ? 'true' : 'false'));
  svg.style.cursor = t === 'select' ? 'default' : 'crosshair';
  const hints = { select: 'Select: tap to pick, drag to move furniture, doors, windows, or labels.', wall: 'Wall: press and drag to draw. Ends snap to nearby corners.', door: 'Door: tap a wall to add a 3-foot door.', window: 'Window: tap a wall to add a 4-foot window.', item: 'Furniture: choose a piece, then tap the plan to place it.', label: 'Label: tap the plan to name a room.' };
  status(hints[t] || '');
}

/* ---------- 3D view ---------- */
const scene3D = { rebuild() {}, snapshot() {}, setWalk() {}, ready: false };
const holder = $('fp-3d');
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}
function showFallback(reason) {
  const fb = $('fp-fallback'); const cv = $('fp-canvas');
  if (cv) cv.style.display = 'none';
  document.querySelectorAll('.fp-needs-3d').forEach((b) => { b.disabled = true; });
  const pad = $('fp-walkpad'); if (pad) pad.hidden = true;
  fb.hidden = false; $('fp-fallback-note').textContent = reason;
  scene3D.rebuild = drawIso; drawIso();
}
/* Simple axonometric drawing for devices without WebGL. */
function drawIso() {
  const box = $('fp-iso'); box.innerHTML = '';
  const H = opts.cutaway ? CUT_H : WALL_H; const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const P = (x, y, z) => [(x - y) * c, (x + y) * s - z];
  const faces = [];
  const b = wallBounds(plan);
  faces.push({ depth: -1e9, pts: [P(b.x0, b.y0, 0), P(b.x1, b.y0, 0), P(b.x1, b.y1, 0), P(b.x0, b.y1, 0)], fill: '#8a6d4c', stroke: 'none' });
  for (const it of plan.items) {
    const sz = itemSize(it); const x0 = it.x - sz.w / 2, x1 = it.x + sz.w / 2, y0 = it.y - sz.d / 2, y1 = it.y + sz.d / 2; const col = (CATALOG[it.kind] || CATALOG.sofa).color;
    faces.push({ depth: x1 + y1 - 0.5, pts: [P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, sz.h), P(x0, y1, sz.h)], fill: col, stroke: 'rgba(0,0,0,0.35)' });
    faces.push({ depth: x1 + y1 - 0.5, pts: [P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, sz.h), P(x1, y0, sz.h)], fill: col, stroke: 'rgba(0,0,0,0.35)', shade: 0.8 });
    faces.push({ depth: x1 + y1 - 0.4, pts: [P(x0, y0, sz.h), P(x1, y0, sz.h), P(x1, y1, sz.h), P(x0, y1, sz.h)], fill: col, stroke: 'rgba(0,0,0,0.35)' });
  }
  for (const pc of wallPieces(plan, H)) {
    const ax = pc.w.x1 + pc.f.ux * pc.s, ay = pc.w.y1 + pc.f.uy * pc.s, bx = pc.w.x1 + pc.f.ux * pc.e, by = pc.w.y1 + pc.f.uy * pc.e;
    const glass = pc.kind === 'glass';
    faces.push({ depth: Math.max(ax + ay, bx + by), pts: [P(ax, ay, pc.z0), P(bx, by, pc.z0), P(bx, by, pc.z1), P(ax, ay, pc.z1)], fill: glass ? 'rgba(125,211,252,0.35)' : '#e7e2d8', stroke: 'rgba(0,0,0,0.45)', shade: Math.abs(pc.f.ux) > Math.abs(pc.f.uy) ? 1 : 0.82 });
  }
  faces.sort((p, q) => p.depth - q.depth);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of faces) for (const [x, y] of f.pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const iso = el('svg', { viewBox: `${minX - 2} ${minY - 2} ${maxX - minX + 4} ${maxY - minY + 4}`, width: '100%', height: '100%', role: 'img', 'aria-label': 'Simplified drawing of the plan with raised walls and furniture' }, box);
  for (const f of faces) {
    const poly = el('polygon', { points: f.pts.map((p) => p.join(',')).join(' '), fill: f.fill, stroke: f.stroke, 'stroke-width': 0.05 }, iso);
    if (f.shade && f.shade < 1) poly.style.filter = "brightness(0.85)";
  }
}

async function init3D() {
  if (!hasWebGL()) return showFallback('This device or browser has 3D graphics turned off, so you are seeing a simplified drawing. The plan editor still works fully.');
  let THREE;
  try { THREE = await import(RENDER_LIB); } catch (e) { return showFallback('The 3D viewer could not load right now, so you are seeing a simplified drawing. The plan editor still works fully.'); }
  const canvas = $('fp-canvas');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); } catch (e) { return showFallback('The 3D viewer could not start on this device, so you are seeing a simplified drawing.'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0f1512');
  scene.fog = new THREE.Fog('#0f1512', 120, 260);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.2, 600);
  scene.add(new THREE.HemisphereLight('#eef6ff', '#2b2418', 0.9));
  const sun = new THREE.DirectionalLight('#fff3dd', 1.6); sun.position.set(-30, 60, -20); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
  scene.add(sun); scene.add(sun.target);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshStandardMaterial({ color: '#1d2a22', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  const group = new THREE.Group(); scene.add(group);
  const mats = {
    wall: new THREE.MeshStandardMaterial({ color: '#e7e2d8', roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fd3ff', transparent: true, opacity: 0.32, roughness: 0.1 }),
    floor: new THREE.MeshStandardMaterial({ color: '#a8845b', roughness: 0.8 }),
    roof: new THREE.MeshStandardMaterial({ color: '#3b4a44', roughness: 0.7, side: THREE.DoubleSide }),
    edge: new THREE.LineBasicMaterial({ color: '#1f2937', transparent: true, opacity: 0.45 }),
  };
  const itemMats = {};
  let center = { x: 0, z: 0 }, radius = 50, pieces = [];
  const orbit = { theta: -0.75, phi: 0.95, r: 50 };
  const walk = { x: 0, z: 0, yaw: 0, pitch: 0 };
  let dirty = true;

  function boxMesh(w, h, d, mat, edges) {
    const g = new THREE.BoxGeometry(w, h, d); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), mats.edge));
    return m;
  }
  function clearGroup() {
    while (group.children.length) {
      const c = group.children.pop();
      c.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
  }
  function roofMesh(b, H) {
    const o = 1, pitch = 0.5; const alongX = (b.x1 - b.x0) >= (b.y1 - b.y0);
    const a0 = (alongX ? b.x0 : b.y0) - o, a1 = (alongX ? b.x1 : b.y1) + o;
    const c0 = alongX ? b.y0 : b.x0, c1 = alongX ? b.y1 : b.x1, cm = (c0 + c1) / 2;
    const ridge = H + (cm - c0) * pitch, eave = H - o * pitch;
    const V = (a, y, c) => (alongX ? [a, y, c] : [c, y, a]);
    const tri = [];
    const quad = (p, q, r, s) => tri.push(p, q, r, p, r, s);
    quad(V(a0, eave, c0 - o), V(a1, eave, c0 - o), V(a1, ridge, cm), V(a0, ridge, cm));
    quad(V(a0, eave, c1 + o), V(a0, ridge, cm), V(a1, ridge, cm), V(a1, eave, c1 + o));
    const g0 = alongX ? b.x0 : b.y0, g1 = alongX ? b.x1 : b.y1;
    tri.push(V(g0, H, c0), V(g0, H, c1), V(g0, ridge, cm));
    tri.push(V(g1, H, c0), V(g1, ridge, cm), V(g1, H, c1));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mats.roof); m.castShadow = true; return m;
  }
  function rebuild() {
    clearGroup();
    const H = (opts.roof || opts.walk) ? WALL_H : (opts.cutaway ? CUT_H : WALL_H);
    const b = wallBounds(plan); center = { x: (b.x0 + b.x1) / 2, z: (b.y0 + b.y1) / 2 };
    radius = Math.max(18, Math.hypot(b.x1 - b.x0, b.y1 - b.y0));
    if (plan.walls.length) {
      const floor = boxMesh(b.x1 - b.x0 + WALL_T, 0.2, b.y1 - b.y0 + WALL_T, mats.floor, false);
      floor.position.set(center.x, 0.1, center.z); floor.castShadow = false; group.add(floor);
    }
    pieces = wallPieces(plan, H);
    for (const pc of pieces) {
      const s = pc.s <= 0.001 ? -WALL_T / 2 : pc.s, e = pc.e >= pc.L - 0.001 ? pc.L + WALL_T / 2 : pc.e;
      const glass = pc.kind === 'glass';
      const m = boxMesh(e - s, pc.z1 - pc.z0, glass ? 0.08 : WALL_T, glass ? mats.glass : mats.wall, !glass);
      const mid = (s + e) / 2;
      m.position.set(pc.w.x1 + pc.f.ux * mid, 0.2 + (pc.z0 + pc.z1) / 2, pc.w.y1 + pc.f.uy * mid);
      m.rotation.y = -Math.atan2(pc.f.uy, pc.f.ux);
      if (glass) m.castShadow = false;
      group.add(m);
    }
    for (const it of plan.items) {
      const c = CATALOG[it.kind] || CATALOG.sofa;
      itemMats[it.kind] = itemMats[it.kind] || new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.85 });
      const m = boxMesh(c.w, c.h, c.d, itemMats[it.kind], it.kind !== 'rug');
      m.position.set(it.x, 0.2 + c.h / 2, it.y); m.rotation.y = -it.rot * Math.PI / 180; group.add(m);
    }
    if (opts.roof && plan.walls.length) group.add(roofMesh(b, WALL_H + 0.2));
    sun.target.position.set(center.x, 0, center.z); sun.position.set(center.x - 30, 60, center.z - 20);
    orbit.r = Math.min(Math.max(orbit.r, radius * 0.5), radius * 3);
    dirty = true;
  }
  function blocked(x, z) {
    for (const pc of pieces) {
      if (pc.z0 > 5.5) continue;
      const ax = pc.w.x1 + pc.f.ux * pc.s, ay = pc.w.y1 + pc.f.uy * pc.s, bx = pc.w.x1 + pc.f.ux * pc.e, by = pc.w.y1 + pc.f.uy * pc.e;
      if (segDist(x, z, ax, ay, bx, by) < 0.75) return true;
    }
    return false;
  }
  function startWalk() {
    const door = plan.openings.find((o) => o.type === 'door');
    const w = door && plan.walls.find((q) => q.id === door.wallId);
    if (w) {
      const f = wallFrame(w); const cx = w.x1 + f.ux * door.t * f.L, cy = w.y1 + f.uy * door.t * f.L;
      let nx = f.nx, ny = f.ny; if ((center.x - cx) * nx + (center.z - cy) * ny < 0) { nx = -nx; ny = -ny; }
      walk.x = cx + nx * 2; walk.z = cy + ny * 2; walk.yaw = Math.atan2(nx, ny);
    } else { walk.x = center.x; walk.z = center.z; walk.yaw = 0; }
    walk.pitch = 0;
  }
  function placeCamera() {
    if (opts.walk) {
      camera.fov = 70; camera.position.set(walk.x, 0.2 + EYE, walk.z);
      camera.lookAt(walk.x + Math.sin(walk.yaw) * Math.cos(walk.pitch), 0.2 + EYE + Math.sin(walk.pitch), walk.z + Math.cos(walk.yaw) * Math.cos(walk.pitch));
    } else {
      camera.fov = 50;
      const r = orbit.r * Math.max(1, 1.25 / (camera.aspect || 1)); camera.position.set(center.x + r * Math.sin(orbit.phi) * Math.sin(orbit.theta), r * Math.cos(orbit.phi), center.z + r * Math.sin(orbit.phi) * Math.cos(orbit.theta));
      camera.lookAt(center.x, 2, center.z);
    }
    camera.updateProjectionMatrix();
  }
  function resize() {
    const w = holder.clientWidth, h = holder.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
  }
  new ResizeObserver(resize).observe(holder); resize();

  // pointer: orbit / look, pinch zoom
  const pts = new Map(); let pinch = 0;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); const dx = e.clientX - prev.x, dy = e.clientY - prev.y; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch && !opts.walk) orbit.r = Math.min(radius * 3, Math.max(radius * 0.4, orbit.r * pinch / d));
      pinch = d; dirty = true; return;
    }
    if (opts.walk) { walk.yaw -= dx * 0.005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - dy * 0.004)); }
    else { orbit.theta -= dx * 0.008; orbit.phi = Math.max(0.12, Math.min(1.45, orbit.phi - dy * 0.006)); }
    dirty = true;
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { if (opts.walk) return; e.preventDefault(); orbit.r = Math.min(radius * 3, Math.max(radius * 0.4, orbit.r * (1 + Math.sign(e.deltaY) * 0.1))); dirty = true; }, { passive: false });

  // walking: keys + on-screen pad
  const move = { f: 0, t: 0 }; const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (!opts.walk || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  document.querySelectorAll('[data-walk]').forEach((btn) => {
    const [axis, val] = btn.dataset.walk.split(':'); const on = (e) => { e.preventDefault(); move[axis] = +val; }; const off = () => { move[axis] = 0; };
    btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off); btn.addEventListener('pointerleave', off); btn.addEventListener('pointercancel', off);
  });
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (opts.walk) {
      const f = move.f + (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const t = move.t + (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
      if (t) { walk.yaw += t * dt * 1.6; dirty = true; }
      if (f) {
        const sp = f * dt * 6; const nx = walk.x + Math.sin(walk.yaw) * sp, nz = walk.z + Math.cos(walk.yaw) * sp;
        if (!blocked(nx, nz)) { walk.x = nx; walk.z = nz; } else if (!blocked(nx, walk.z)) walk.x = nx; else if (!blocked(walk.x, nz)) walk.z = nz;
        dirty = true;
      }
    }
    if (dirty) { placeCamera(); renderer.render(scene, camera); dirty = false; }
    requestAnimationFrame(tick);
  }
  scene3D.rebuild = rebuild;
  scene3D.setWalk = (on) => { opts.walk = on; rebuild(); if (on) startWalk(); $('fp-walkpad').hidden = !on; dirty = true; };
  scene3D.snapshot = () => { placeCamera(); renderer.render(scene, camera); return canvas.toDataURL('image/png'); };
  scene3D.ready = true;
  rebuild(); requestAnimationFrame(tick);
  $('fp-3d-loading').hidden = true;
}

/* ---------- wire up controls ---------- */
function wire() {
  const kindSel = $('fp-kind');
  for (const k in CATALOG) { const o = document.createElement('option'); o.value = k; o.textContent = CATALOG[k].label; kindSel.appendChild(o); }
  kindSel.addEventListener('change', () => setTool('item'));
  document.querySelectorAll('[data-fp-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.fpTool)));
  $('fp-sample').addEventListener('change', (e) => loadSample(e.target.value));
  $('fp-undo').addEventListener('click', undo);
  $('fp-delete').addEventListener('click', deleteSelected);
  $('fp-rotate').addEventListener('click', rotateSelected);
  $('fp-fit').addEventListener('click', () => { fitView(); render2D(); });
  $('fp-clear').addEventListener('click', () => { if (!window.confirm('Clear the plan and start from a blank grid?')) return; pushHistory(); plan = { walls: [], openings: [], items: [], labels: [] }; selected = null; changed(false); setTool('wall'); });
  const toggle = (id, key, after) => $(id).addEventListener('click', (e) => {
    opts[key] = !opts[key]; e.currentTarget.setAttribute('aria-pressed', String(opts[key])); if (after) after(); scene3D.rebuild();
  });
  toggle('fp-cutaway', 'cutaway');
  toggle('fp-roof', 'roof');
  $('fp-walk').addEventListener('click', (e) => {
    const on = !opts.walk; e.currentTarget.setAttribute('aria-pressed', String(on)); scene3D.setWalk(on);
    status(on ? 'Walk: drag to look around. Use the arrow pad, arrow keys, or W A S D to move. Walls stop you; doors let you through.' : 'Orbit: drag to spin the model, pinch or scroll to zoom.');
  });
  $('fp-snap').addEventListener('click', () => {
    const url = scene3D.snapshot(); if (!url) return status('Snapshots need the 3D view.');
    const a = document.createElement('a'); a.href = url; a.download = 'floor-plan-3d.png'; document.body.appendChild(a); a.click(); a.remove();
  });
  $('fp-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'floor-plan-sketch.json'; document.body.appendChild(a); a.click(); a.remove();
  });
  $('fp-import').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const p = JSON.parse(await f.text()); if (!valid(p)) throw new Error('bad'); pushHistory(); plan = p; plan.labels = plan.labels || []; selected = null; changed(true); status('Sketch loaded.'); }
    catch (err) { status('That file is not a saved sketch from this page.'); }
    e.target.value = '';
  });
  $('fp-underlay').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (underlay.url) URL.revokeObjectURL(underlay.url);
    underlay.url = URL.createObjectURL(f); render2D(); status('Tracing image added under the grid (it stays on your device). Set its width in feet, then trace walls over it.');
  });
  $('fp-underlay-op').addEventListener('input', (e) => { underlay.opacity = +e.target.value; render2D(); });
  $('fp-underlay-w').addEventListener('change', (e) => { const v = +e.target.value; if (v > 4 && v < 400) { underlay.width = v; render2D(); } });
  $('fp-underlay-clear').addEventListener('click', () => { if (underlay.url) URL.revokeObjectURL(underlay.url); underlay.url = null; render2D(); });
  window.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (opts.walk && /^(w|a|s|d|arrow)/i.test(e.key)) return;
    if (!svg.matches(':hover') && document.activeElement !== svg && !selected) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { if (selected) { e.preventDefault(); deleteSelected(); } }
    else if (e.key === 'r' || e.key === 'R') rotateSelected();
    else if (e.key === 'Escape') { selected = null; preview = null; render2D(); updateSelectionUI(); }
  });
  new ResizeObserver(() => render2D()).observe(svg);
}

function start() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { stored = null; }
  plan = valid(stored) ? stored : SAMPLES.cottage.make();
  plan.labels = plan.labels || [];
  wire(); fitView(); render2D(); setTool('select');
  status(valid(stored) ? 'Welcome back. Your last sketch was restored from this browser.' : 'Sample loaded. Drag furniture on the plan, or pick a tool to draw walls, doors, and windows.');
  init3D();
}
start();
