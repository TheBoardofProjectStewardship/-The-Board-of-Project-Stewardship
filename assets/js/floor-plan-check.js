/* Dimension check for the floor-plan tool.
   Runs in the browser. Compares a length written on the plan with the same
   length at the scale the visitor chose, then sanity-checks ceiling height
   and closed room sizes. Nothing is uploaded. */

export const SCALE_ABS_FT = 0.25;
export const SCALE_REL = 0.03;
export const CEILING_MIN = 7;
export const CEILING_MAX = 12;

const EPS = 0.08;

export function fmtFeet(v) {
  let ft = Math.floor(v + 1e-6);
  let inch = Math.round((v - ft) * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  if (ft < 0) return '0\u2032-0\u2033';
  return `${ft}\u2032-${inch}\u2033`;
}

/** Parse a length such as 12'-0", 12′6″, 12-6, 12.5, or 9 ft. Returns feet, or null. */
export function parseFeet(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  let s = String(input ?? '').trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/feet|foot/g, "'").replace(/\bft\b/g, "'");
  s = s.replace(/[\u2032\u2018\u2019]/g, "'").replace(/[\u2033\u201c\u201d]/g, '"');
  s = s.replace(/\s+/g, '');
  let m = s.match(/^(\d+(?:\.\d+)?)'(?:-?(\d+(?:\.\d+)?)(?:"?)?)?$/);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 12 : 0);
  m = s.match(/^(\d+)[-–](\d+(?:\.\d+)?)"?$/);
  if (m) return Number(m[1]) + Number(m[2]) / 12;
  m = s.match(/^(\d+(?:\.\d+)?)"$/);
  if (m) return Number(m[1]) / 12;
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  return null;
}

export function scaleMismatch(labeled, measured) {
  if (labeled == null || measured == null || !(labeled > 0) || !(measured > 0)) return false;
  const diff = Math.abs(labeled - measured);
  return diff > SCALE_ABS_FT && diff / labeled > SCALE_REL;
}

function roundKey(v) {
  return Math.round(v / 0.05) * 0.05;
}

function covers(a0, a1, b0, b1) {
  return a0 <= b0 + EPS && a1 >= b1 - EPS;
}

function axisWalls(walls) {
  const h = [];
  const v = [];
  let diagonal = 0;
  for (const w of walls || []) {
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    if (Math.hypot(dx, dy) < 0.4) continue;
    if (Math.abs(dy) <= 0.2) {
      h.push({ y: roundKey((w.y1 + w.y2) / 2), x0: roundKey(Math.min(w.x1, w.x2)), x1: roundKey(Math.max(w.x1, w.x2)) });
    } else if (Math.abs(dx) <= 0.2) {
      v.push({ x: roundKey((w.x1 + w.x2) / 2), y0: roundKey(Math.min(w.y1, w.y2)), y1: roundKey(Math.max(w.y1, w.y2)) });
    } else diagonal += 1;
  }
  return { h, v, diagonal };
}

function roomWarning(spanX, spanY, area) {
  const short = Math.min(spanX, spanY);
  const long = Math.max(spanX, spanY);
  const closet = short >= 2 && short <= 6 && long <= 10 && area >= 6 && area <= 60;
  const hall = short >= 3 && short <= 6 && long >= 6 && long <= 40;
  const room = short >= 6 && short <= 28 && long <= 36 && area >= 36 && area <= 900;
  if (closet || hall || room) return null;
  const size = `${fmtFeet(spanX)} by ${fmtFeet(spanY)}`;
  const sq = Math.round(area);
  if (area > 900 || long > 36) {
    return `One space is about ${size} (about ${sq} square feet), larger than a typical residential room. The scale may be off, or interior walls are still missing.`;
  }
  if (short < 3) {
    return `One space is about ${size}, narrower than a typical residential room or hall.`;
  }
  return `One space is about ${size} (about ${sq} square feet), outside a typical residential room size.`;
}

/** Closed rectilinear rooms from axis-aligned walls. Doors stay on the wall line, so they do not merge rooms. */
export function findRooms(walls) {
  const { h, v, diagonal } = axisWalls(walls);
  if (h.length < 2 || v.length < 2) return { rooms: [], diagonal };
  const xsSet = new Set();
  const ysSet = new Set();
  for (const s of v) { xsSet.add(s.x); ysSet.add(s.y0); ysSet.add(s.y1); }
  for (const s of h) { ysSet.add(s.y); xsSet.add(s.x0); xsSet.add(s.x1); }
  let xs = [...xsSet].sort((a, b) => a - b);
  let ys = [...ysSet].sort((a, b) => a - b);
  if (xs.length < 2 || ys.length < 2) return { rooms: [], diagonal };
  const pad = 1;
  xs = [xs[0] - pad, ...xs, xs[xs.length - 1] + pad];
  ys = [ys[0] - pad, ...ys, ys[ys.length - 1] + pad];
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  const outside = Array.from({ length: nx }, () => Array(ny).fill(false));
  const seen = Array.from({ length: nx }, () => Array(ny).fill(false));

  function blockedRight(i, j) {
    const x = xs[i + 1];
    const y0 = ys[j];
    const y1 = ys[j + 1];
    return v.some((s) => Math.abs(s.x - x) <= EPS && covers(s.y0, s.y1, y0, y1));
  }
  function blockedUp(i, j) {
    const y = ys[j + 1];
    const x0 = xs[i];
    const x1 = xs[i + 1];
    return h.some((s) => Math.abs(s.y - y) <= EPS && covers(s.x0, s.x1, x0, x1));
  }

  const q = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) q.push([i, j]);
    }
  }
  while (q.length) {
    const [i, j] = q.pop();
    if (i < 0 || j < 0 || i >= nx || j >= ny || seen[i][j]) continue;
    seen[i][j] = true;
    outside[i][j] = true;
    if (i + 1 < nx && !blockedRight(i, j)) q.push([i + 1, j]);
    if (i - 1 >= 0 && !blockedRight(i - 1, j)) q.push([i - 1, j]);
    if (j + 1 < ny && !blockedUp(i, j)) q.push([i, j + 1]);
    if (j - 1 >= 0 && !blockedUp(i, j - 1)) q.push([i, j - 1]);
  }

  const rooms = [];
  const vis = Array.from({ length: nx }, () => Array(ny).fill(false));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (outside[i][j] || vis[i][j]) continue;
      const cells = [];
      const qq = [[i, j]];
      vis[i][j] = true;
      while (qq.length) {
        const [ci, cj] = qq.pop();
        cells.push([ci, cj]);
        const neigh = [];
        if (ci + 1 < nx && !blockedRight(ci, cj)) neigh.push([ci + 1, cj]);
        if (ci - 1 >= 0 && !blockedRight(ci - 1, cj)) neigh.push([ci - 1, cj]);
        if (cj + 1 < ny && !blockedUp(ci, cj)) neigh.push([ci, cj + 1]);
        if (cj - 1 >= 0 && !blockedUp(ci, cj - 1)) neigh.push([ci, cj - 1]);
        for (const [ni, nj] of neigh) {
          if (!outside[ni][nj] && !vis[ni][nj]) { vis[ni][nj] = true; qq.push([ni, nj]); }
        }
      }
      let area = 0;
      let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
      for (const [ci, cj] of cells) {
        const x0 = xs[ci]; const x1 = xs[ci + 1]; const y0 = ys[cj]; const y1 = ys[cj + 1];
        area += (x1 - x0) * (y1 - y0);
        minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
        minY = Math.min(minY, y0); maxY = Math.max(maxY, y1);
      }
      if (area < 4) continue;
      const spanX = maxX - minX;
      const spanY = maxY - minY;
      rooms.push({ spanX, spanY, area, warning: roomWarning(spanX, spanY, area) });
    }
  }
  return { rooms, diagonal };
}

function ceilingItem(feet) {
  if (feet == null || !(feet > 0)) {
    return { level: 'note', code: 'ceiling', text: 'Enter a ceiling height to check it against a typical residential range of 7\u2032-0\u2033 to 12\u2032-0\u2033.' };
  }
  if (feet < CEILING_MIN || feet > CEILING_MAX) {
    return { level: 'warn', code: 'ceiling', text: `Ceiling height ${fmtFeet(feet)} is outside a typical residential range of 7\u2032-0\u2033 to 12\u2032-0\u2033.` };
  }
  return { level: 'pass', code: 'ceiling', text: `Ceiling height ${fmtFeet(feet)} is inside a typical residential range.` };
}

/**
 * @param {{ labeledText?: string, measuredText?: string, ceilingFeet?: number, walls?: Array }} input
 * status is "passed", "warnings", or "incomplete".
 * mismatch is true when the labeled length and the measured length disagree.
 */
export function assessPlan(input) {
  const labeled = parseFeet(input.labeledText);
  const measured = parseFeet(input.measuredText);
  const items = [];
  let mismatch = false;
  if (labeled == null || measured == null) {
    items.push({ level: 'note', code: 'scale-missing', text: 'Enter a dimension written on the plan and the same length at this scale.' });
  } else if (scaleMismatch(labeled, measured)) {
    mismatch = true;
    items.push({
      level: 'warn',
      code: 'scale-mismatch',
      text: `A wall labeled ${fmtFeet(labeled)} measures ${fmtFeet(measured)} at the chosen scale. Correct the scale or the reference before building the 3D model.`,
    });
  } else {
    items.push({ level: 'pass', code: 'scale-ok', text: `Scale matches. ${fmtFeet(labeled)} on the plan agrees with ${fmtFeet(measured)} at this scale.` });
  }
  items.push(ceilingItem(input.ceilingFeet));
  const found = findRooms(input.walls || []);
  if (!input.walls || !input.walls.length) {
    items.push({ level: 'note', code: 'rooms-none', text: 'Draw walls to check room sizes. No rooms to measure yet.' });
  } else if (!found.rooms.length) {
    items.push({
      level: 'note',
      code: 'rooms-open',
      text: found.diagonal
        ? 'No closed rooms yet. Angled walls are left out of the room-size check.'
        : 'No closed rooms yet. Close the walls to check room sizes.',
    });
  } else {
    const bad = found.rooms.filter((r) => r.warning);
    for (const r of bad.slice(0, 4)) items.push({ level: 'warn', code: 'room-size', text: r.warning });
    if (bad.length > 4) {
      items.push({ level: 'warn', code: 'room-size', text: `${bad.length - 4} more spaces are outside a typical residential room size.` });
    }
    const ok = found.rooms.length - bad.length;
    if (ok > 0) {
      items.push({ level: 'pass', code: 'rooms-ok', text: `${ok} room${ok === 1 ? '' : 's'} fall inside a plausible residential size range.` });
    }
    if (found.diagonal) {
      items.push({ level: 'note', code: 'rooms-angled', text: 'Angled walls are left out of the room-size check.' });
    }
  }
  const warnings = items.some((i) => i.level === 'warn');
  const missing = items.some((i) => i.code === 'scale-missing');
  const status = warnings ? 'warnings' : (missing ? 'incomplete' : 'passed');
  return { items, status, mismatch, rooms: found.rooms, labeled, measured };
}
