/* Plan to 3D Walkthrough. Runs in the browser only. Nothing is uploaded. */
(function () {
  "use strict";

  const STORE_KEY = "board-plan-walk-v1";
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
  const PDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
  const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
  const THICK = 0.42;
  const DOOR_H = 6.75;
  const SILL = 2.7;
  const HEAD = 7.15;
  const EYE = 5.15;
  const RADIUS = 0.36;

  const $ = (id) => document.getElementById(id);
  const planCanvas = $("pw-plan");
  const glCanvas = $("pw-gl");
  const ctx = planCanvas.getContext("2d");

  let seq = 20;
  let project = null;
  let images = new Map();
  let imageEls = new Map();
  let tool = "select";
  let selection = null;
  let drawing = [];
  let stairPts = [];
  let scalePts = [];
  let cam = { x: 20, y: 14, k: 14 };
  let undoStack = [];
  let redoStack = [];
  let viewMode = "plan";
  let pdfDoc = null;
  let pdfPage = 1;
  let drag = null;
  const pointers = new Map();
  const keys = new Set();
  const joy = { x: 0, y: 0, on: false };
  const player = { x: 10, y: 4, level: 0, yaw: 0, pitch: 0 };
  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let dirLight = null;
  let house = null;
  let roofGroup = null;
  let traceGroups = [];
  let wallGroups = [];
  let labelGroups = [];
  let geos = [];
  let labelTextures = [];
  let mats = null;
  let anim = null;
  let frameState = null;
  let orbit = { theta: -0.7, phi: 1.02, dist: 55, tx: 20, ty: 6, tz: 14 };
  let userOrbit = false;
  let builtOnce = false;
  let reducedMotion = false;

  function nid(prefix) {
    seq += 1;
    return prefix + seq;
  }
  function activeIndex() {
    return Math.max(0, Math.min(project.storeys.length - 1, project.active || 0));
  }
  function active() {
    return project.storeys[activeIndex()];
  }
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  function status(msg) {
    const el = $("pw-status");
    if (el) el.textContent = msg;
  }
  function typingTarget(node) {
    if (!node) return false;
    const tag = node.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
  }

  function sampleProject() {
    const shell = (id) => ({ id: id, pts: [[0, 0], [40, 0], [40, 28], [0, 28]], closed: true });
    return {
      v: 1,
      name: "Cedar Lane House",
      active: 0,
      storeys: [
        {
          id: "main",
          name: "Main",
          wallH: 9,
          walls: [
            shell("m-shell"),
            { id: "m-entry", pts: [[14, 0], [14, 16]], closed: false },
            { id: "m-cross", pts: [[0, 16], [40, 16]], closed: false },
            { id: "m-din", pts: [[28, 16], [28, 28]], closed: false },
            { id: "m-pw1", pts: [[9, 11], [14, 11]], closed: false },
            { id: "m-pw2", pts: [[9, 11], [9, 16]], closed: false }
          ],
          openings: [
            { id: "m-d1", wallId: "m-shell", seg: 0, t: 0.2, width: 3, kind: "door" },
            { id: "m-w1", wallId: "m-shell", seg: 0, t: 0.68, width: 6, kind: "window" },
            { id: "m-w2", wallId: "m-shell", seg: 1, t: 0.28, width: 4, kind: "window" },
            { id: "m-w3", wallId: "m-shell", seg: 1, t: 0.78, width: 4, kind: "window" },
            { id: "m-w4", wallId: "m-shell", seg: 2, t: 0.65, width: 6, kind: "window" },
            { id: "m-w5", wallId: "m-shell", seg: 3, t: 0.75, width: 3, kind: "window" },
            { id: "m-d2", wallId: "m-entry", seg: 0, t: 0.34, width: 3, kind: "door" },
            { id: "m-d3", wallId: "m-cross", seg: 0, t: 0.5, width: 6, kind: "door" },
            { id: "m-d4", wallId: "m-din", seg: 0, t: 0.5, width: 3, kind: "door" },
            { id: "m-d5", wallId: "m-pw2", seg: 0, t: 0.45, width: 2.4, kind: "door" }
          ],
          rooms: [
            { id: "m-r1", name: "Entry", x: 10, y: 4 },
            { id: "m-r2", name: "Living", x: 27, y: 8 },
            { id: "m-r3", name: "Kitchen", x: 14, y: 22 },
            { id: "m-r4", name: "Dining", x: 34, y: 22 },
            { id: "m-r5", name: "Powder", x: 11.5, y: 13.5 }
          ],
          stairs: [{ id: "m-st", x1: 4.5, y1: 2, x2: 4.5, y2: 14, width: 3.2 }],
          underlay: null
        },
        {
          id: "upper",
          name: "Upper",
          wallH: 8,
          walls: [
            shell("u-shell"),
            { id: "u-hall", pts: [[14, 0], [14, 16]], closed: false },
            { id: "u-cross", pts: [[0, 16], [40, 16]], closed: false },
            { id: "u-bath", pts: [[26, 16], [26, 28]], closed: false }
          ],
          openings: [
            { id: "u-w1", wallId: "u-shell", seg: 0, t: 0.7, width: 5, kind: "window" },
            { id: "u-w2", wallId: "u-shell", seg: 1, t: 0.32, width: 4, kind: "window" },
            { id: "u-w3", wallId: "u-shell", seg: 2, t: 0.55, width: 5, kind: "window" },
            { id: "u-w4", wallId: "u-shell", seg: 2, t: 0.12, width: 3, kind: "window" },
            { id: "u-d1", wallId: "u-hall", seg: 0, t: 0.5, width: 2.7, kind: "door" },
            { id: "u-d2", wallId: "u-cross", seg: 0, t: 0.2, width: 3, kind: "door" },
            { id: "u-d3", wallId: "u-bath", seg: 0, t: 0.55, width: 2.5, kind: "door" }
          ],
          rooms: [
            { id: "u-r1", name: "Hall", x: 7, y: 8 },
            { id: "u-r2", name: "Bedroom", x: 27, y: 8 },
            { id: "u-r3", name: "Primary", x: 12, y: 22 },
            { id: "u-r4", name: "Bath", x: 33, y: 22 }
          ],
          stairs: [],
          underlay: null
        }
      ]
    };
  }

  function blankProject() {
    return {
      v: 1,
      name: "Untitled plan",
      active: 0,
      storeys: [{
        id: nid("s"),
        name: "Main",
        wallH: 9,
        walls: [],
        openings: [],
        rooms: [],
        stairs: [],
        underlay: null
      }]
    };
  }

  function bumpSeq() {
    let n = 20;
    const take = (id) => {
      const m = /(\d+)$/.exec(id || "");
      if (m) n = Math.max(n, Number(m[1]));
    };
    project.storeys.forEach((s) => {
      take(s.id);
      s.walls.forEach((w) => take(w.id));
      s.openings.forEach((o) => take(o.id));
      s.rooms.forEach((r) => take(r.id));
      s.stairs.forEach((st) => take(st.id));
      if (s.underlay) take(s.underlay.imageId);
    });
    seq = n;
  }

  function segments(wall) {
    const pts = wall.pts || [];
    const out = [];
    const n = wall.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      out.push([a[0], a[1], b[0], b[1]]);
    }
    return out;
  }

  function projectPoint(x, y, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy) || 1e-6;
    let s = ((x - x1) * dx + (y - y1) * dy) / L;
    s = Math.max(0, Math.min(L, s));
    const px = x1 + (dx / L) * s;
    const py = y1 + (dy / L) * s;
    return { s: s, L: L, d: Math.hypot(x - px, y - py), x: px, y: py, t: s / L };
  }

  function boundsOf(storey) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    };
    (storey.walls || []).forEach((w) => w.pts.forEach((p) => add(p[0], p[1])));
    (storey.rooms || []).forEach((r) => add(r.x, r.y));
    (storey.stairs || []).forEach((s) => { add(s.x1, s.y1); add(s.x2, s.y2); });
    if (storey.underlay) {
      const u = storey.underlay;
      add(u.x, u.y);
      add(u.x + u.wFt, u.y + u.hFt);
    }
    if (!isFinite(x0)) return { x0: -2, y0: -2, x1: 30, y1: 22 };
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  function floorY(index) {
    let y = 0;
    for (let i = 0; i < index; i++) y += Number(project.storeys[i].wallH) || 9;
    return y;
  }

  function stairT(st, x, y) {
    const dx = st.x2 - st.x1;
    const dy = st.y2 - st.y1;
    const L2 = dx * dx + dy * dy || 1e-6;
    const t = ((x - st.x1) * dx + (y - st.y1) * dy) / L2;
    const L = Math.sqrt(L2);
    const px = st.x1 + dx * t;
    const py = st.y1 + dy * t;
    if (t < -0.02 || t > 1.02 || Math.hypot(x - px, y - py) > (st.width || 3) / 2) return null;
    return Math.max(0, Math.min(1, t));
  }

  function stairQuad(st) {
    const dx = st.x2 - st.x1;
    const dy = st.y2 - st.y1;
    const L = Math.hypot(dx, dy) || 1;
    const px = (-dy / L) * (st.width || 3) / 2;
    const py = (dx / L) * (st.width || 3) / 2;
    return [
      [st.x1 + px, st.y1 + py],
      [st.x2 + px, st.y2 + py],
      [st.x2 - px, st.y2 - py],
      [st.x1 - px, st.y1 - py]
    ];
  }

  function pushHist() {
    undoStack.push(JSON.stringify(project));
    if (undoStack.length > 60) undoStack.shift();
    redoStack = [];
    if (location.hash.indexOf("#p=") === 0) history.replaceState(null, "", location.pathname + location.search);
  }

  function loadProject(next, announce) {
    project = next;
    project.storeys.forEach((s) => {
      s.walls = s.walls || [];
      s.openings = s.openings || [];
      s.rooms = s.rooms || [];
      s.stairs = s.stairs || [];
      s.wallH = Math.max(7.5, Math.min(16, Number(s.wallH) || 9));
    });
    bumpSeq();
    selection = null;
    drawing = [];
    stairPts = [];
    scalePts = [];
    undoStack = [];
    redoStack = [];
    const name = $("pw-name");
    if (name) name.value = project.name || "Untitled plan";
    syncChrome();
    fit();
    render2D();
    if (renderer) rebuild3D();
    if (announce) status(announce);
    scheduleSave();
  }

  function syncChrome() {
    const s = active();
    const h = $("pw-wall-h");
    if (h) h.value = String(s.wallH);
    const op = $("pw-opacity");
    if (op) op.value = s.underlay ? String(s.underlay.opacity || 0.55) : "0.55";
    const tabs = $("pw-storeys");
    if (tabs) {
      tabs.innerHTML = "";
      project.storeys.forEach((st, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pw-btn";
        b.setAttribute("aria-pressed", i === activeIndex() ? "true" : "false");
        b.textContent = st.name || ("Storey " + (i + 1));
        b.addEventListener("click", () => {
          pushHist();
          project.active = i;
          selection = null;
          drawing = [];
          syncChrome();
          fit();
          render2D();
          status(st.name + " is the storey on the board.");
        });
        tabs.appendChild(b);
      });
    }
    const note = $("pw-scale-note");
    if (note) note.hidden = !(s.underlay && !s.underlay.scaled);
    const level = $("pw-level-view");
    if (level) {
      const prev = level.value || "all";
      level.innerHTML = '<option value="all">All storeys</option>';
      project.storeys.forEach((st, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = st.name || ("Storey " + (i + 1));
        level.appendChild(o);
      });
      level.value = [...level.options].some((o) => o.value === prev) ? prev : "all";
    }
    document.querySelectorAll("#pw [data-tool]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-tool") === tool ? "true" : "false");
    });
    const finish = $("pw-finish");
    if (finish) finish.disabled = drawing.length < 2 && stairPts.length < 1;
    const step = viewMode === "walk" || viewMode === "orbit" ? "walk" : (tool === "scale" ? "scale" : (s.underlay ? "trace" : "upload"));
    document.querySelectorAll("#pw .pw-steps li").forEach((li) => {
      if (li.getAttribute("data-step") === step) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    const roomWrap = $("pw-room-wrap");
    const widthWrap = $("pw-width-wrap");
    if (roomWrap) roomWrap.hidden = !(tool === "room" || (selection && selection.kind === "room"));
    if (widthWrap) widthWrap.hidden = !(selection && (selection.kind === "opening" || selection.kind === "stair"));
    if (selection && selection.kind === "room") {
      const room = active().rooms.find((r) => r.id === selection.id);
      if (room && $("pw-room")) $("pw-room").value = room.name;
    }
    if (selection && selection.kind === "opening") {
      const op = active().openings.find((o) => o.id === selection.id);
      if (op && $("pw-width")) $("pw-width").value = String(Math.round(op.width * 10) / 10);
    }
    if (selection && selection.kind === "stair") {
      const st = active().stairs.find((o) => o.id === selection.id);
      if (st && $("pw-width")) $("pw-width").value = String(Math.round(st.width * 10) / 10);
    }
  }

  function fit() {
    const b = boundsOf(active());
    const pad = 3;
    const w = planCanvas.clientWidth || 320;
    const h = planCanvas.clientHeight || 320;
    const bw = Math.max(8, b.x1 - b.x0 + pad * 2);
    const bh = Math.max(8, b.y1 - b.y0 + pad * 2);
    cam.k = Math.max(4, Math.min(w / bw, h / bh));
    cam.x = (b.x0 + b.x1) / 2;
    cam.y = (b.y0 + b.y1) / 2;
  }

  function worldToScreen(x, y) {
    const w = planCanvas.clientWidth;
    const h = planCanvas.clientHeight;
    return { x: (x - cam.x) * cam.k + w / 2, y: h / 2 - (y - cam.y) * cam.k };
  }
  function screenToWorld(sx, sy) {
    const w = planCanvas.clientWidth;
    const h = planCanvas.clientHeight;
    return { x: (sx - w / 2) / cam.k + cam.x, y: (h / 2 - sy) / cam.k + cam.y };
  }
  function eventWorld(e) {
    const r = planCanvas.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (planCanvas.clientWidth / r.width);
    const sy = (e.clientY - r.top) * (planCanvas.clientHeight / r.height);
    return screenToWorld(sx, sy);
  }
  function clientOf(x, y) {
    const s = worldToScreen(x, y);
    const r = planCanvas.getBoundingClientRect();
    return { x: r.left + s.x * (r.width / planCanvas.clientWidth), y: r.top + s.y * (r.height / planCanvas.clientHeight) };
  }

  function resizePlan() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, planCanvas.clientWidth);
    const h = Math.max(1, planCanvas.clientHeight);
    if (planCanvas.width !== Math.round(w * dpr) || planCanvas.height !== Math.round(h * dpr)) {
      planCanvas.width = Math.round(w * dpr);
      planCanvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function fmtFt(v) {
    let ft = Math.floor(v + 1e-6);
    let inch = Math.round((v - ft) * 12);
    if (inch === 12) { ft += 1; inch = 0; }
    return inch ? ft + "'-" + inch + '"' : ft + "'";
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function render2D() {
    if (!project || viewMode !== "plan") return;
    resizePlan();
    const w = planCanvas.clientWidth;
    const h = planCanvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f4f0e8";
    ctx.fillRect(0, 0, w, h);
    const storey = active();
    if (storey.underlay && images.has(storey.underlay.imageId)) {
      const img = imageEl(storey.underlay.imageId);
      const u = storey.underlay;
      if (img && img.complete && img.naturalWidth) {
        const p = worldToScreen(u.x, u.y);
        const q = worldToScreen(u.x + u.wFt, u.y + u.hFt);
        ctx.save();
        ctx.globalAlpha = u.opacity == null ? 0.55 : u.opacity;
        ctx.drawImage(img, q.x < p.x ? q.x : p.x, q.y < p.y ? q.y : p.y, Math.abs(q.x - p.x), Math.abs(q.y - p.y));
        ctx.restore();
      }
    } else {
      drawGrid();
    }
    storey.stairs.forEach((st) => drawStair(st, selection && selection.kind === "stair" && selection.id === st.id));
    storey.walls.forEach((wall) => drawWall(storey, wall, selection && selection.kind === "wall" && selection.id === wall.id));
    if (drawing.length) drawChain(drawing, true);
    if (stairPts.length) drawChain(stairPts, true);
    storey.rooms.forEach((room) => drawTag(room.x, room.y, room.name, selection && selection.kind === "room" && selection.id === room.id));
    scalePts.forEach((p, i) => {
      const s = worldToScreen(p.x, p.y);
      ctx.fillStyle = "#0891b2";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.font = "700 12px Inter, sans-serif";
      ctx.fillText(i === 0 ? "A" : "B", s.x + 8, s.y - 8);
    });
    if (scalePts.length === 2) {
      const a = worldToScreen(scalePts[0].x, scalePts[0].y);
      const b = worldToScreen(scalePts[1].x, scalePts[1].y);
      ctx.strokeStyle = "#0891b2";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawGrid() {
    const b = boundsOf(active());
    const x0 = Math.floor(b.x0 - 4);
    const x1 = Math.ceil(b.x1 + 4);
    const y0 = Math.floor(b.y0 - 4);
    const y1 = Math.ceil(b.y1 + 4);
    ctx.lineWidth = 1;
    for (let x = x0; x <= x1; x++) {
      ctx.strokeStyle = x % 5 === 0 ? "#d9d3c7" : "#e7e2d8";
      const a = worldToScreen(x, y0);
      const c = worldToScreen(x, y1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
    for (let y = y0; y <= y1; y++) {
      ctx.strokeStyle = y % 5 === 0 ? "#d9d3c7" : "#e7e2d8";
      const a = worldToScreen(x0, y);
      const c = worldToScreen(x1, y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
  }

  function drawTag(x, y, text, on) {
    const s = worldToScreen(x, y);
    ctx.font = "700 13px Inter, sans-serif";
    const pad = 8;
    const tw = ctx.measureText(text).width;
    const bw = tw + pad * 2;
    const bh = 22;
    ctx.fillStyle = on ? "#155e75" : "#0f172a";
    roundRect(ctx, s.x - bw / 2, s.y - bh / 2, bw, bh, 6);
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, s.x, s.y + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawStair(st, on) {
    const quad = stairQuad(st);
    ctx.beginPath();
    quad.forEach((p, i) => {
      const s = worldToScreen(p[0], p[1]);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.fillStyle = on ? "rgba(8,145,178,0.25)" : "rgba(15,23,42,0.08)";
    ctx.fill();
    ctx.strokeStyle = on ? "#0891b2" : "#334155";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const a = worldToScreen(st.x1, st.y1);
    const b = worldToScreen(st.x2, st.y2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 11px Inter, sans-serif";
    ctx.fillText("UP", (a.x + b.x) / 2 + 6, (a.y + b.y) / 2);
  }

  function drawWall(storey, wall, on) {
    const segs = segments(wall);
    segs.forEach((seg, si) => {
      const ops = storey.openings.filter((o) => o.wallId === wall.id && o.seg === si)
        .map((o) => ({ o: o, a: o.t * projectPoint(0, 0, seg[0], seg[1], seg[2], seg[3]).L - o.width / 2, b: o.t * Math.hypot(seg[2] - seg[0], seg[3] - seg[1]) + o.width / 2 }))
        .sort((p, q) => p.a - q.a);
      const L = Math.hypot(seg[2] - seg[0], seg[3] - seg[1]);
      let cur = 0;
      const stroke = (s0, s1, color, width) => {
        if (s1 - s0 < 0.02) return;
        const p0 = at(seg, s0 / L);
        const p1 = at(seg, s1 / L);
        const a = worldToScreen(p0[0], p0[1]);
        const b = worldToScreen(p1[0], p1[1]);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "square";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      };
      ops.forEach((op) => {
        const a = Math.max(cur, op.a);
        const b = Math.min(L, op.b);
        stroke(cur, a, on ? "#166534" : "#1f2937", on ? 5 : 3.5);
        if (op.o.kind === "window") stroke(a, b, "#0891b2", 4);
        else stroke(a, b, "rgba(8,145,178,0.0)", 1);
        cur = Math.max(cur, b);
        if (selection && selection.kind === "opening" && selection.id === op.o.id) {
          const p = at(seg, op.o.t);
          const s = worldToScreen(p[0], p[1]);
          ctx.fillStyle = "#0891b2";
          ctx.beginPath();
          ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      stroke(cur, L, on ? "#166534" : "#1f2937", on ? 5 : 3.5);
      if (L * cam.k > 48) {
        const mid = at(seg, 0.5);
        const s = worldToScreen(mid[0], mid[1]);
        ctx.fillStyle = "#475569";
        ctx.font = "600 11px Inter, sans-serif";
        ctx.fillText(fmtFt(L), s.x + 4, s.y - 4);
      }
    });
    wall.pts.forEach((p, i) => {
      const s = worldToScreen(p[0], p[1]);
      const hot = selection && selection.kind === "vertex" && selection.wallId === wall.id && selection.index === i;
      ctx.fillStyle = hot ? "#0891b2" : "#111827";
      ctx.beginPath();
      ctx.arc(s.x, s.y, hot ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function at(seg, t) {
    return [seg[0] + (seg[2] - seg[0]) * t, seg[1] + (seg[3] - seg[1]) * t];
  }

  function drawChain(pts, preview) {
    if (!pts.length) return;
    ctx.strokeStyle = "#0891b2";
    ctx.lineWidth = 2.5;
    ctx.setLineDash(preview ? [7, 5] : []);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const s = worldToScreen(p[0], p[1]);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach((p) => {
      const s = worldToScreen(p[0], p[1]);
      ctx.fillStyle = "#0891b2";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function imageEl(id) {
    if (!id || !images.has(id)) return null;
    if (imageEls.has(id)) return imageEls.get(id);
    const img = new Image();
    img.onload = () => render2D();
    img.src = images.get(id);
    imageEls.set(id, img);
    return img;
  }

  function nearest(x, y) {
    const thresh = Math.max(0.45, 16 / cam.k);
    const storey = active();
    let best = null;
    const consider = (d, item) => {
      if (d < thresh && (!best || d < best.d)) best = { d: d, item: item };
    };
    storey.walls.forEach((wall) => {
      wall.pts.forEach((p, i) => consider(Math.hypot(x - p[0], y - p[1]), { kind: "vertex", wallId: wall.id, index: i }));
    });
    storey.openings.forEach((o) => {
      const wall = storey.walls.find((w) => w.id === o.wallId);
      if (!wall) return;
      const seg = segments(wall)[o.seg];
      if (!seg) return;
      const p = at(seg, o.t);
      consider(Math.hypot(x - p[0], y - p[1]), { kind: "opening", id: o.id });
    });
    storey.rooms.forEach((r) => consider(Math.hypot(x - r.x, y - r.y), { kind: "room", id: r.id }));
    storey.stairs.forEach((st) => {
      consider(Math.hypot(x - st.x1, y - st.y1), { kind: "stair-end", id: st.id, end: 1 });
      consider(Math.hypot(x - st.x2, y - st.y2), { kind: "stair-end", id: st.id, end: 2 });
      const t = stairT(st, x, y);
      if (t != null) consider(0.2, { kind: "stair", id: st.id });
    });
    if (best) return best.item;
    let wallBest = null;
    storey.walls.forEach((wall) => {
      segments(wall).forEach((seg) => {
        const pr = projectPoint(x, y, seg[0], seg[1], seg[2], seg[3]);
        if (pr.d < thresh && (!wallBest || pr.d < wallBest.d)) wallBest = { d: pr.d, item: { kind: "wall", id: wall.id } };
      });
    });
    return wallBest ? wallBest.item : null;
  }

  function snapDraw(x, y) {
    const thresh = Math.max(0.4, 14 / cam.k);
    if (drawing.length >= 3) {
      const a = drawing[0];
      if (Math.hypot(x - a[0], y - a[1]) < thresh) return { x: a[0], y: a[1], close: true };
    }
    let best = null;
    let bestD = thresh;
    const look = (px, py) => {
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) { bestD = d; best = { x: px, y: py, close: false }; }
    };
    active().walls.forEach((w) => w.pts.forEach((p) => look(p[0], p[1])));
    drawing.forEach((p, i) => { if (i !== drawing.length - 1) look(p[0], p[1]); });
    if (best) return best;
    if (drawing.length) {
      const a = drawing[drawing.length - 1];
      const ang = Math.atan2(y - a[1], x - a[0]);
      const step = Math.PI / 4;
      const snapped = Math.round(ang / step) * step;
      if (Math.abs(ang - snapped) < (10 * Math.PI) / 180) {
        const dist = Math.hypot(x - a[0], y - a[1]);
        return { x: a[0] + Math.cos(snapped) * dist, y: a[1] + Math.sin(snapped) * dist, close: false };
      }
    }
    return { x: x, y: y, close: false };
  }

  function commitWall(closed) {
    if (drawing.length < 2) {
      drawing = [];
      syncChrome();
      render2D();
      return;
    }
    pushHist();
    active().walls.push({ id: nid("w"), pts: drawing.map((p) => [p[0], p[1]]), closed: !!closed });
    drawing = [];
    syncChrome();
    render2D();
    scheduleSave();
    status(closed ? "Closed wall added." : "Wall added. Keep tracing, or place doors and windows.");
    if (renderer && viewMode !== "plan") rebuild3D();
  }

  function placeOpening(kind, x, y) {
    const storey = active();
    let best = null;
    storey.walls.forEach((wall) => {
      segments(wall).forEach((seg, si) => {
        const pr = projectPoint(x, y, seg[0], seg[1], seg[2], seg[3]);
        const limit = Math.max(0.7, 18 / cam.k);
        if (pr.d < limit && (!best || pr.d < best.d)) best = { d: pr.d, wall: wall, seg: si, t: pr.t, L: pr.L };
      });
    });
    if (!best) {
      status("Tap a wall to place the " + kind + ".");
      return;
    }
    const width = kind === "door" ? 3 : 4;
    if (width > best.L - 0.2) {
      status("That wall is shorter than the opening.");
      return;
    }
    pushHist();
    const t = Math.max(width / 2 / best.L, Math.min(1 - width / 2 / best.L, best.t));
    storey.openings.push({ id: nid("o"), wallId: best.wall.id, seg: best.seg, t: t, width: width, kind: kind });
    selection = { kind: "opening", id: storey.openings[storey.openings.length - 1].id };
    syncChrome();
    render2D();
    scheduleSave();
    status(kind === "door" ? "Door placed. Drag it along the wall, or change the width." : "Window placed. Drag it along the wall, or change the width.");
  }

  function applyScale() {
    const storey = active();
    const ul = storey.underlay;
    if (!ul || scalePts.length < 2) return;
    const feet = Number($("pw-feet").value) || 0;
    const inches = Number($("pw-inches").value) || 0;
    const length = feet + inches / 12;
    if (length < 0.5) {
      status("Enter the real length. Feet and inches both count.");
      return;
    }
    const uv = (p) => ({
      u: (p.x - ul.x) / ul.wFt,
      v: (ul.y + ul.hFt - p.y) / ul.hFt
    });
    const a = uv(scalePts[0]);
    const b = uv(scalePts[1]);
    const px = Math.hypot((b.u - a.u) * ul.naturalW, (b.v - a.v) * ul.naturalH);
    if (px < 8) {
      status("Those two points are too close. Pick the ends of a longer dimension.");
      return;
    }
    const ftPerPx = length / px;
    const newW = ul.naturalW * ftPerPx;
    const newH = ul.naturalH * ftPerPx;
    const s = newW / ul.wFt;
    pushHist();
    const sc = (x, y) => [ul.x + (x - ul.x) * s, ul.y + (y - ul.y) * s];
    storey.walls.forEach((w) => { w.pts = w.pts.map((p) => sc(p[0], p[1])); });
    storey.rooms.forEach((r) => { const p = sc(r.x, r.y); r.x = p[0]; r.y = p[1]; });
    storey.stairs.forEach((st) => {
      const p1 = sc(st.x1, st.y1);
      const p2 = sc(st.x2, st.y2);
      st.x1 = p1[0]; st.y1 = p1[1]; st.x2 = p2[0]; st.y2 = p2[1];
      st.width *= s;
    });
    storey.openings.forEach((o) => { o.width *= s; });
    ul.wFt = newW;
    ul.hFt = newH;
    ul.scaled = true;
    scalePts = [];
    $("pw-scalebox").hidden = true;
    syncChrome();
    fit();
    render2D();
    scheduleSave();
    status("Scale set. Lengths on this storey now use that dimension. It is still an illustration, not a survey.");
  }

  function hitChange(item, x, y) {
    const storey = active();
    if (!item) return;
    if (item.kind === "vertex") {
      const wall = storey.walls.find((w) => w.id === item.wallId);
      if (!wall) return;
      const snap = snapDraw(x, y);
      wall.pts[item.index] = [snap.x, snap.y];
    } else if (item.kind === "opening") {
      const op = storey.openings.find((o) => o.id === item.id);
      const wall = op && storey.walls.find((w) => w.id === op.wallId);
      const seg = wall && segments(wall)[op.seg];
      if (!seg) return;
      const pr = projectPoint(x, y, seg[0], seg[1], seg[2], seg[3]);
      const half = (op.width / 2) / pr.L;
      op.t = Math.max(half, Math.min(1 - half, pr.t));
    } else if (item.kind === "room") {
      const room = storey.rooms.find((r) => r.id === item.id);
      if (room) { room.x = x; room.y = y; }
    } else if (item.kind === "stair" || item.kind === "stair-end") {
      const st = storey.stairs.find((s) => s.id === item.id);
      if (!st || !drag) return;
      if (item.kind === "stair-end") {
        if (item.end === 1) { st.x1 = x; st.y1 = y; }
        else { st.x2 = x; st.y2 = y; }
      } else {
        st.x1 += x - drag.lx; st.y1 += y - drag.ly;
        st.x2 += x - drag.lx; st.y2 += y - drag.ly;
        drag.lx = x; drag.ly = y;
      }
    }
  }

  function onPointerDown(e) {
    if (viewMode !== "plan") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    planCanvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const wpt = eventWorld(e);
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      wx: wpt.x,
      wy: wpt.y,
      lx: wpt.x,
      ly: wpt.y,
      moved: false,
      pushed: false,
      item: tool === "select" ? nearest(wpt.x, wpt.y) : null
    };
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const arr = [...pointers.values()];
      const dist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      if (drag && drag.pinch) {
        const factor = dist / drag.pinch;
        zoomAtCenter(factor);
        drag.pinch = dist;
      } else if (drag) drag.pinch = dist;
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    const wpt = eventWorld(e);
    if (tool === "select" && drag.item && drag.item.kind !== "wall") {
      if (!drag.pushed) { pushHist(); drag.pushed = true; }
      hitChange(drag.item, wpt.x, wpt.y);
      render2D();
      return;
    }
    if (tool === "select" && drag.moved && !drag.item) {
      cam.x -= dx / cam.k;
      cam.y += dy / cam.k;
      drag.x = e.clientX;
      drag.y = e.clientY;
      render2D();
      return;
    }
    if (tool === "wall" && drawing.length) {
      const snap = snapDraw(wpt.x, wpt.y);
      render2D();
      drawChain(drawing.concat([[snap.x, snap.y]]), true);
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (!drag || e.pointerId !== drag.id) return;
    const wpt = eventWorld(e);
    const moved = drag.moved;
    const item = drag.item;
    drag = null;
    if (moved) {
      scheduleSave();
      if (renderer) rebuild3D();
      return;
    }
    if (tool === "wall") addDrawPoint(wpt.x, wpt.y);
    else if (tool === "select") {
      selection = item;
      syncChrome();
      render2D();
      if (!item) status("Nothing selected. Choose a tool, or tap a wall, door, window, room, or stair.");
    } else if (tool === "door" || tool === "window") placeOpening(tool, wpt.x, wpt.y);
    else if (tool === "room") placeRoom(wpt.x, wpt.y);
    else if (tool === "stair") addStairPoint(wpt.x, wpt.y);
    else if (tool === "scale") addScalePoint(wpt.x, wpt.y);
  }

  function addDrawPoint(x, y) {
    const snap = snapDraw(x, y);
    if (snap.close) {
      commitWall(true);
      return;
    }
    if (drawing.length && Math.hypot(snap.x - drawing[drawing.length - 1][0], snap.y - drawing[drawing.length - 1][1]) < 0.15) return;
    drawing.push([snap.x, snap.y]);
    syncChrome();
    render2D();
    status("Point added. Snap is on for corners and for square angles. Finish the wall when the run is done.");
  }

  function addStairPoint(x, y) {
    const snap = snapDraw(x, y);
    stairPts.push([snap.x, snap.y]);
    if (stairPts.length >= 2) {
      pushHist();
      active().stairs.push({
        id: nid("st"),
        x1: stairPts[0][0], y1: stairPts[0][1],
        x2: stairPts[1][0], y2: stairPts[1][1],
        width: 3.2
      });
      stairPts = [];
      scheduleSave();
      status("Stair run added on this storey. It climbs to the storey above. Walk mode follows it.");
    } else status("Tap the top of the stair run.");
    syncChrome();
    render2D();
  }

  function placeRoom(x, y) {
    const name = ($("pw-room") && $("pw-room").value.trim()) || "Room";
    pushHist();
    const room = { id: nid("r"), name: name.slice(0, 32), x: x, y: y };
    active().rooms.push(room);
    selection = { kind: "room", id: room.id };
    syncChrome();
    render2D();
    scheduleSave();
    status("Room label placed. Drag it, or edit the name.");
  }

  function addScalePoint(x, y) {
    const ul = active().underlay;
    if (!ul) {
      status("Upload a plan page for this storey before setting scale.");
      return;
    }
    if (x < ul.x || x > ul.x + ul.wFt || y < ul.y || y > ul.y + ul.hFt) {
      status("Tap two points on the plan image, along a dimension you know.");
      return;
    }
    scalePts.push({ x: x, y: y });
    if (scalePts.length > 2) scalePts = [scalePts[scalePts.length - 1]];
    if (scalePts.length === 2) {
      $("pw-scalebox").hidden = false;
      status("Enter that dimension in feet and inches, then apply scale.");
    } else status("First point set. Tap the other end of the known dimension.");
    render2D();
  }

  function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    cam.k = Math.max(2, Math.min(90, cam.k * factor));
    const after = screenToWorld(sx, sy);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
    render2D();
  }
  function zoomAtCenter(factor) {
    zoomAt(planCanvas.clientWidth / 2, planCanvas.clientHeight / 2, factor);
  }

  function removeSelection() {
    if (!selection) {
      status("Select something to delete.");
      return;
    }
    pushHist();
    const s = active();
    if (selection.kind === "wall" || selection.kind === "vertex") {
      const id = selection.wallId || selection.id;
      s.openings = s.openings.filter((o) => o.wallId !== id);
      s.walls = s.walls.filter((w) => w.id !== id);
    } else if (selection.kind === "opening") s.openings = s.openings.filter((o) => o.id !== selection.id);
    else if (selection.kind === "room") s.rooms = s.rooms.filter((r) => r.id !== selection.id);
    else if (selection.kind === "stair" || selection.kind === "stair-end") s.stairs = s.stairs.filter((st) => st.id !== selection.id);
    selection = null;
    syncChrome();
    render2D();
    scheduleSave();
    if (renderer) rebuild3D();
    status("Deleted.");
  }

  function undo() {
    if (!undoStack.length) return status("Nothing to undo.");
    redoStack.push(JSON.stringify(project));
    project = JSON.parse(undoStack.pop());
    selection = null;
    drawing = [];
    syncChrome();
    fit();
    render2D();
    if (renderer) rebuild3D();
    scheduleSave();
    status("Undone.");
  }
  function redo() {
    if (!redoStack.length) return status("Nothing to redo.");
    undoStack.push(JSON.stringify(project));
    project = JSON.parse(redoStack.pop());
    selection = null;
    syncChrome();
    fit();
    render2D();
    if (renderer) rebuild3D();
    scheduleSave();
    status("Redone.");
  }

  function setTool(next) {
    tool = next;
    drawing = next === "wall" ? drawing : [];
    if (next !== "stair") stairPts = [];
    if (next !== "scale") {
      scalePts = [];
      const box = $("pw-scalebox");
      if (box) box.hidden = true;
    }
    syncChrome();
    render2D();
    const hints = {
      select: "Drag a corner, door, window, label, or stair. Drag empty board to pan.",
      wall: "Tap to add wall points. They snap to corners and to square angles.",
      door: "Tap a wall to place a door.",
      window: "Tap a wall to place a window.",
      room: "Tap inside a room to drop its name.",
      stair: "Tap the bottom of the stair, then the top. It leads to the next storey.",
      scale: "Tap two points on a known dimension, then type its length."
    };
    status(hints[next] || "");
  }

  async function onFile(file) {
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    const type = (file.type || "").toLowerCase();
    try {
      if (type === "application/pdf" || name.endsWith(".pdf")) await loadPdf(file);
      else await loadImageFile(file);
    } catch (err) {
      status(err && err.message ? err.message : "That file could not be read.");
    }
  }

  async function loadImageFile(file) {
    const name = (file.name || "").toLowerCase();
    const type = (file.type || "").toLowerCase();
    const heic = name.endsWith(".heic") || name.endsWith(".heif") || type.indexOf("heic") >= 0 || type.indexOf("heif") >= 0;
    let source = null;
    try {
      source = await createImageBitmap(file);
    } catch (err) {
      if (heic) throw new Error("This browser cannot read HEIC photos. Export a JPG or PNG from the phone and upload that.");
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      try { await img.decode(); source = img; }
      catch (e2) { URL.revokeObjectURL(url); throw new Error("That image could not be read. Use a JPG, PNG, or PDF."); }
      URL.revokeObjectURL(url);
    }
    const canvas = downscale(source, 1600);
    if (source.close) source.close();
    const id = nid("img");
    images.set(id, canvas.toDataURL("image/jpeg", 0.72));
    imageEls.delete(id);
    pushHist();
    const wFt = 36;
    const hFt = 36 * (canvas.height / canvas.width);
    active().underlay = {
      imageId: id,
      wFt: wFt,
      hFt: hFt,
      x: -wFt / 2,
      y: -hFt / 2,
      opacity: 0.55,
      naturalW: canvas.width,
      naturalH: canvas.height,
      scaled: false
    };
    pdfDoc = null;
    const review = $("pw-review");
    if (review) review.hidden = true;
    setTool("scale");
    syncChrome();
    fit();
    render2D();
    scheduleSave();
    status("Image is on this storey. Set scale on a known dimension before you rely on lengths.");
  }

  function downscale(source, max) {
    const w = source.width;
    const h = source.height;
    const s = Math.min(1, max / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * s));
    canvas.height = Math.max(1, Math.round(h * s));
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function loadPdf(file) {
    status("Reading the PDF in this browser…");
    const pdfjs = await import(PDF_URL);
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    const data = new Uint8Array(await file.arrayBuffer());
    pdfDoc = await pdfjs.getDocument({ data: data }).promise;
    pdfPage = 1;
    await showPdfPage(1);
    await buildThumbs();
    $("pw-review").hidden = false;
  }

  async function renderPdfCanvas(num, maxSide) {
    const page = await pdfDoc.getPage(num);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxSide / base.width, maxSide / base.height);
    const vp = page.getViewport({ scale: scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(vp.width));
    canvas.height = Math.max(1, Math.round(vp.height));
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    return canvas;
  }

  async function showPdfPage(num) {
    pdfPage = num;
    const canvas = await renderPdfCanvas(num, 1600);
    const id = nid("img");
    images.set(id, canvas.toDataURL("image/jpeg", 0.72));
    imageEls.delete(id);
    pushHist();
    const wFt = 36;
    const hFt = 36 * (canvas.height / canvas.width);
    active().underlay = {
      imageId: id, wFt: wFt, hFt: hFt, x: -wFt / 2, y: -hFt / 2,
      opacity: 0.55, naturalW: canvas.width, naturalH: canvas.height, scaled: false
    };
    setTool("scale");
    syncChrome();
    fit();
    render2D();
    const label = $("pw-page-label");
    if (label) label.textContent = "Page " + num + " of " + pdfDoc.numPages;
    document.querySelectorAll("#pw-thumbs button").forEach((btn) => {
      btn.setAttribute("aria-pressed", Number(btn.getAttribute("data-page")) === num ? "true" : "false");
    });
    scheduleSave();
    status("PDF page " + num + " of " + pdfDoc.numPages + " is on this storey. Set scale on a known dimension before you rely on lengths.");
  }

  async function buildThumbs() {
    const box = $("pw-thumbs");
    box.innerHTML = "";
    const n = Math.min(pdfDoc.numPages, 8);
    for (let i = 1; i <= n; i++) {
      const canvas = await renderPdfCanvas(i, 240);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-page", String(i));
      btn.setAttribute("aria-label", "Use page " + i);
      btn.setAttribute("aria-pressed", i === pdfPage ? "true" : "false");
      const img = document.createElement("img");
      img.alt = "";
      img.src = canvas.toDataURL("image/jpeg", 0.7);
      btn.appendChild(img);
      btn.addEventListener("click", () => showPdfPage(i));
      box.appendChild(btn);
    }
    if (pdfDoc.numPages > 8) status("Showing the first 8 pages. Use next and previous to reach later pages.");
  }

  function exportPayload() {
    const copy = clone(project);
    copy.storeys.forEach((s) => {
      if (s.underlay && s.underlay.imageId && images.has(s.underlay.imageId)) {
        s.underlay.src = images.get(s.underlay.imageId);
      }
    });
    return { format: "board-plan-walkthrough", version: 1, project: copy };
  }

  function adoptImages(next) {
    next.storeys.forEach((s) => {
      if (s.underlay && s.underlay.src) {
        const id = s.underlay.imageId || nid("img");
        images.set(id, s.underlay.src);
        imageEls.delete(id);
        s.underlay.imageId = id;
        delete s.underlay.src;
      }
    });
  }

  function validProject(p) {
    return p && Array.isArray(p.storeys) && p.storeys.length > 0 && p.storeys.every((s) => Array.isArray(s.walls));
  }

  function download(filename, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function exportFile() {
    const json = JSON.stringify(exportPayload());
    download((project.name || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".json", new Blob([json], { type: "application/json" }));
    status("Project file downloaded. It stays on this device unless you share it.");
  }

  function importText(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { status("That file is not a project file."); return; }
    const next = data.project || data;
    if (!validProject(next)) { status("That file is not a plan project."); return; }
    adoptImages(next);
    loadProject(next, "Project opened.");
  }

  async function shareLink() {
    const slim = clone(project);
    slim.storeys.forEach((s) => { if (s.underlay) delete s.underlay; });
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(slim));
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      let bin = "";
      buf.forEach((b) => { bin += String.fromCharCode(b); });
      const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      const url = location.origin + location.pathname + "#p=" + b64;
      if (url.length > 7000) {
        status("This plan is too large for a link. Download the project file instead. Plan images are not included in links.");
        return;
      }
      history.replaceState(null, "", "#p=" + b64);
      try { await navigator.clipboard.writeText(url); status("Link copied. It restores the walls, not the plan image."); }
      catch (e) { status(url); }
    } catch (err) {
      status("A share link could not be built in this browser. Download the project file instead.");
    }
  }

  async function readShare() {
    const hash = location.hash || "";
    if (hash.indexOf("#p=") !== 0) return false;
    try {
      let b64 = hash.slice(3).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      const text = await new Response(stream).text();
      const next = JSON.parse(text);
      if (!validProject(next)) return false;
      loadProject(next, "Opened a shared plan. The drawing is here. Plan images are not included in links.");
      return true;
    } catch (e) {
      return false;
    }
  }

  let saveTimer = 0;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }
  function saveNow() {
    try {
      const imgs = {};
      project.storeys.forEach((s) => {
        if (s.underlay && s.underlay.imageId && images.has(s.underlay.imageId)) imgs[s.underlay.imageId] = images.get(s.underlay.imageId);
      });
      localStorage.setItem(STORE_KEY, JSON.stringify({ project: project, images: imgs }));
    } catch (e) {
      try {
        const slim = clone(project);
        slim.storeys.forEach((s) => { if (s.underlay) s.underlay = null; });
        localStorage.setItem(STORE_KEY, JSON.stringify({ project: slim, images: {} }));
        status("Saved the walls in this browser. The plan image was too large to keep.");
      } catch (e2) { /* private mode */ }
    }
  }
  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!validProject(data.project)) return false;
      Object.keys(data.images || {}).forEach((id) => images.set(id, data.images[id]));
      loadProject(data.project, null);
      return true;
    } catch (e) { return false; }
  }

  function shot() {
    let canvas = viewMode === "plan" ? planCanvas : glCanvas;
    if (viewMode !== "plan" && renderer) renderer.render(scene, camera);
    canvas.toBlob((blob) => {
      if (!blob) { status("A snapshot could not be made."); return; }
      download("plan-walkthrough.png", blob);
      status("Snapshot downloaded.");
    }, "image/png");
  }

  function showPlan() {
    viewMode = "plan";
    $("pw-view3d").hidden = true;
    $("pw-joy").hidden = true;
    $("pw-walkhint").hidden = true;
    if (renderer) renderer.setAnimationLoop(null);
    if (document.pointerLockElement) document.exitPointerLock();
    $("pw-plan-mode").setAttribute("aria-pressed", "true");
    $("pw-orbit-mode").setAttribute("aria-pressed", "false");
    $("pw-walk-mode").setAttribute("aria-pressed", "false");
    syncChrome();
    render2D();
  }

  async function open3D(mode, play) {
    viewMode = mode;
    $("pw-view3d").hidden = false;
    $("pw-plan-mode").setAttribute("aria-pressed", "false");
    $("pw-orbit-mode").setAttribute("aria-pressed", mode === "orbit" ? "true" : "false");
    $("pw-walk-mode").setAttribute("aria-pressed", mode === "walk" ? "true" : "false");
    $("pw-joy").hidden = mode !== "walk";
    $("pw-walkhint").hidden = mode !== "walk";
    $("pw-3d-error").hidden = true;
    if (!builtOnce) $("pw-3d-loading").hidden = false;
    syncChrome();
    try {
      if (!THREE) THREE = await import(THREE_URL);
      if (!renderer) init3D();
      if (mode === "walk") {
        anim = null;
        beginWalk();
      } else camera.fov = 48;
      rebuild3D();
      resize3D();
      if (play && !reducedMotion) {
        userOrbit = false;
        anim = { t0: performance.now(), dur: 2200 * project.storeys.length + 1600 };
        status("Watching the build. Walls rise storey by storey, then the roof drops on.");
      } else if (!anim) {
        status(mode === "walk"
          ? "Walking. On a keyboard use WASD. On a phone use the joystick and drag the view to look. You stay out of the walls."
          : "Drag to orbit. Lift the roof, or switch storeys. Walk when you want to step inside.");
      }
      renderer.setAnimationLoop(loop);
      builtOnce = true;
      $("pw-3d-loading").hidden = true;
    } catch (err) {
      $("pw-3d-loading").hidden = true;
      $("pw-3d-error").hidden = false;
      $("pw-3d-error").textContent = "The 3D view did not start in this browser. The plan board still works.";
      status("The 3D view did not start. You can keep tracing on the plan board.");
    }
  }

  function beginWalk() {
    const room = active().rooms[0];
    const b = boundsOf(project.storeys[0]);
    player.x = room ? room.x : (b.x0 + b.x1) / 2;
    player.y = room ? room.y : (b.y0 + b.y1) / 2;
    player.level = 0;
    player.yaw = 0;
    player.pitch = 0;
    const level = $("pw-level-view");
    if (level) level.value = "all";
    const roof = $("pw-roof");
    if (roof) roof.value = "0";
    camera.fov = 72;
  }

  function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe6e1d6);
    camera = new THREE.PerspectiveCamera(48, 1, 0.08, 500);
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.add(new THREE.HemisphereLight(0xfffaf3, 0xcfc6b8, 0.9));
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    dirLight = new THREE.DirectionalLight(0xfff4e5, 0.72);
    dirLight.position.set(28, 46, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 160;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.bias = -0.00035;
    scene.add(dirLight);
    scene.add(dirLight.target);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(90, 40),
      new THREE.MeshStandardMaterial({ color: 0xd7d0c4, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    scene.add(ground);
    house = new THREE.Group();
    scene.add(house);
    mats = {
      wall: new THREE.MeshStandardMaterial({ color: 0xf7f4ef, roughness: 0.92, metalness: 0 }),
      floor: new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78, metalness: 0.04, side: THREE.DoubleSide }),
      glass: new THREE.MeshStandardMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0, emissive: 0x155e75, emissiveIntensity: 0.35, side: THREE.DoubleSide }),
      trace: new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 1, roughness: 0.35 }),
      step: new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.9 })
    };
    bind3DInput();
  }

  function disposeBuilt() {
    geos.forEach((g) => g.dispose());
    geos = [];
    labelTextures.forEach((t) => t.dispose());
    labelTextures = [];
    if (house) house.clear();
  }

  function addSeg(parent, x1, z1, x2, z2, y, height, thick, mat, pivot) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.04 || height < 0.04) return;
    const geo = new THREE.BoxGeometry(len, height, thick);
    if (pivot === "start") geo.translate(len / 2, height / 2, 0);
    else geo.translate(0, height / 2, 0);
    const mesh = new THREE.Mesh(geo, mat);
    if (pivot === "start") mesh.position.set(x1, y, z1);
    else mesh.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.castShadow = mat !== mats.glass && mat !== mats.trace;
    mesh.receiveShadow = true;
    parent.add(mesh);
    geos.push(geo);
  }

  function subOf(seg, s0, s1) {
    const L = Math.hypot(seg[2] - seg[0], seg[3] - seg[1]) || 1;
    return [at(seg, s0 / L), at(seg, s1 / L)];
  }

  function rebuild3D() {
    if (!renderer) return;
    disposeBuilt();
    traceGroups = [];
    wallGroups = [];
    labelGroups = [];
    roofGroup = new THREE.Group();
    house.add(roofGroup);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    project.storeys.forEach((storey, i) => {
      const base = floorY(i);
      const wallH = storey.wallH;
      const trace = new THREE.Group();
      const walls = new THREE.Group();
      walls.position.y = base;
      const labels = new THREE.Group();
      house.add(trace); house.add(walls); house.add(labels);
      traceGroups.push(trace); wallGroups.push(walls); labelGroups.push(labels);
      const b = boundsOf(storey);
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
      const shape = new THREE.Shape();
      shape.moveTo(b.x0, b.y0);
      shape.lineTo(b.x1, b.y0);
      shape.lineTo(b.x1, b.y1);
      shape.lineTo(b.x0, b.y1);
      shape.closePath();
      const holes = storey.stairs.slice();
      if (i > 0) holes.push.apply(holes, project.storeys[i - 1].stairs);
      holes.forEach((st) => {
        const q = stairQuad(st);
        const hole = new THREE.Path();
        hole.moveTo(q[0][0], q[0][1]);
        hole.lineTo(q[1][0], q[1][1]);
        hole.lineTo(q[2][0], q[2][1]);
        hole.lineTo(q[3][0], q[3][1]);
        hole.closePath();
        shape.holes.push(hole);
      });
      const floorGeo = new THREE.ShapeGeometry(shape);
      floorGeo.rotateX(Math.PI / 2);
      const floor = new THREE.Mesh(floorGeo, mats.floor);
      floor.position.y = 0.02;
      floor.receiveShadow = true;
      walls.add(floor);
      geos.push(floorGeo);
      storey.walls.forEach((wall) => {
        segments(wall).forEach((seg, si) => {
          const L = Math.hypot(seg[2] - seg[0], seg[3] - seg[1]);
          addSeg(trace, seg[0], seg[1], seg[2], seg[3], base + 0.12, 0.08, 0.08, mats.trace, "start");
          const ops = storey.openings.filter((o) => o.wallId === wall.id && o.seg === si)
            .map((o) => ({ o: o, a: o.t * L - o.width / 2, b: o.t * L + o.width / 2 }))
            .filter((o) => o.b > o.a)
            .sort((p, q) => p.a - q.a);
          let cur = 0;
          const solid = (s0, s1, y, h) => {
            if (s1 - s0 < 0.05 || h < 0.05) return;
            const p0 = subOf(seg, s0, s1)[0];
            const p1 = subOf(seg, s0, s1)[1];
            addSeg(walls, p0[0], p0[1], p1[0], p1[1], y, h, THICK, mats.wall, "bottom");
          };
          ops.forEach((op) => {
            const a = Math.max(cur, op.a);
            const b = Math.min(L, op.b);
            solid(cur, a, 0, wallH);
            if (b > a) {
              if (op.o.kind === "door") solid(a, b, Math.min(DOOR_H, wallH), Math.max(0, wallH - DOOR_H));
              else {
                solid(a, b, 0, Math.min(SILL, wallH));
                const g0 = subOf(seg, a, b);
                addSeg(walls, g0[0][0], g0[0][1], g0[1][0], g0[1][1], Math.min(SILL, wallH), Math.max(0.2, Math.min(HEAD, wallH) - SILL), 0.08, mats.glass, "bottom");
                solid(a, b, Math.min(HEAD, wallH), Math.max(0, wallH - HEAD));
              }
            }
            cur = Math.max(cur, b);
          });
          solid(cur, L, 0, wallH);
        });
      });
      storey.stairs.forEach((st) => {
        const rise = (i + 1 < project.storeys.length ? floorY(i + 1) : base + wallH) - base;
        const n = Math.max(6, Math.round(rise / 0.65));
        for (let k = 0; k < n; k++) {
          const t0 = k / n;
          const t1 = (k + 1) / n;
          const xA = st.x1 + (st.x2 - st.x1) * t0;
          const yA = st.y1 + (st.y2 - st.y1) * t0;
          const xB = st.x1 + (st.x2 - st.x1) * t1;
          const yB = st.y1 + (st.y2 - st.y1) * t1;
          addSeg(walls, xA, yA, xB, yB, 0, rise * t1, st.width, mats.step, "bottom");
        }
      });
      storey.rooms.forEach((room) => {
        const tex = labelTexture(room.name);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        const wtag = Math.max(3.2, room.name.length * 0.72);
        const geo = new THREE.PlaneGeometry(wtag, 1.15);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(room.x, base + 0.08, room.y);
        labels.add(mesh);
        geos.push(geo);
        labelTextures.push(tex);
      });
    });
    if (isFinite(x0)) {
      addRoof(x0 - 1, x1 + 1, y0 - 1, y1 + 1, floorY(project.storeys.length - 1) + project.storeys[project.storeys.length - 1].wallH);
      orbit.tx = (x0 + x1) / 2;
      orbit.tz = (y0 + y1) / 2;
      orbit.ty = floorY(project.storeys.length - 1) * 0.35 + 4;
      if (!userOrbit) orbit.dist = Math.max(x1 - x0, y1 - y0, 18) * 1.45;
      dirLight.target.position.set(orbit.tx, 4, orbit.tz);
      dirLight.position.set(orbit.tx + 18, 40, orbit.tz + 10);
    }
    frameState = fullFrame();
    applyFrame(frameState);
  }

  function labelTexture(text) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#0f172a";
    roundRect(g, 8, 24, 496, 80, 18);
    g.fill();
    g.fillStyle = "#f8fafc";
    g.font = "700 54px Inter, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function addRoof(x0, x1, z0, z1, eave) {
    const mid = (z0 + z1) / 2;
    const peak = eave + Math.min(7, Math.max(4, (z1 - z0) * 0.22));
    const verts = new Float32Array([
      x0, eave, z0, x1, eave, z0, x1, eave, z1, x0, eave, z1, x0, peak, mid, x1, peak, mid
    ]);
    const idx = [0, 5, 1, 0, 4, 5, 3, 2, 5, 3, 5, 4, 0, 3, 4, 1, 5, 2];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mats.roof);
    mesh.castShadow = true;
    roofGroup.add(mesh);
    geos.push(geo);
  }

  function fullFrame() {
    return {
      storeys: project.storeys.map(() => ({ traceP: 1, wallP: 1 })),
      roofP: 1,
      done: true
    };
  }

  function smooth(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
  }

  function frameAt(now) {
    if (!anim) return fullFrame();
    const u = Math.min(1, (now - anim.t0) / anim.dur);
    const n = project.storeys.length;
    const roofSlot = 0.18;
    const body = 1 - roofSlot;
    const slice = body / Math.max(1, n);
    const storeys = [];
    for (let i = 0; i < n; i++) {
      const a = i * slice;
      const b = a + slice * 0.42;
      const c = a + slice;
      storeys.push({
        traceP: smooth((u - a) / (b - a)),
        wallP: smooth((u - b) / (c - b))
      });
    }
    return { storeys: storeys, roofP: smooth((u - body) / roofSlot), done: u >= 1, u: u };
  }

  function applyFrame(frame) {
    const filter = ($("pw-level-view") && $("pw-level-view").value) || "all";
    const top = project.storeys.length - 1;
    frame.storeys.forEach((st, i) => {
      const show = viewMode === "walk" || filter === "all" || filter === String(i);
      if (traceGroups[i]) {
        traceGroups[i].visible = show && st.traceP > 0.02 && st.wallP < 0.5;
        traceGroups[i].children.forEach((m) => { m.scale.x = Math.max(0.001, st.traceP); });
      }
      if (wallGroups[i]) {
        wallGroups[i].visible = show && st.wallP > 0.01;
        wallGroups[i].scale.y = Math.max(0.001, st.wallP);
      }
      if (labelGroups[i]) labelGroups[i].visible = show && st.wallP > 0.82;
    });
    const showRoof = viewMode === "walk" || filter === "all" || filter === String(top);
    const lift = Number($("pw-roof") && $("pw-roof").value) || 0;
    roofGroup.visible = showRoof && frame.roofP > 0.02;
    roofGroup.position.y = (1 - frame.roofP) * 14 + (viewMode === "walk" ? 0 : lift * 12);
  }

  function blocked(x, y, level) {
    const storey = project.storeys[level];
    if (!storey) return false;
    const limit = RADIUS + THICK / 2;
    for (let wi = 0; wi < storey.walls.length; wi++) {
      const wall = storey.walls[wi];
      const segs = segments(wall);
      for (let si = 0; si < segs.length; si++) {
        const seg = segs[si];
        const pr = projectPoint(x, y, seg[0], seg[1], seg[2], seg[3]);
        if (pr.d > limit) continue;
        const doors = storey.openings.filter((o) => o.wallId === wall.id && o.seg === si && o.kind === "door");
        const open = doors.some((o) => {
          const a = o.t * pr.L - o.width / 2 - RADIUS;
          const b = o.t * pr.L + o.width / 2 + RADIUS;
          return pr.s >= a && pr.s <= b;
        });
        if (!open) return true;
      }
    }
    return false;
  }

  function vertical(x, y, level) {
    const base = floorY(level);
    if (level > 0) {
      const below = project.storeys[level - 1];
      for (let i = 0; i < below.stairs.length; i++) {
        const t = stairT(below.stairs[i], x, y);
        if (t != null && t < 0.82) {
          const lower = floorY(level - 1);
          return { y: lower + t * (base - lower), level: t < 0.05 ? level - 1 : level };
        }
      }
    }
    if (level + 1 < project.storeys.length) {
      const stairs = project.storeys[level].stairs;
      for (let i = 0; i < stairs.length; i++) {
        const t = stairT(stairs[i], x, y);
        if (t != null && t > 0.02) {
          const upper = floorY(level + 1);
          return { y: base + t * (upper - base), level: t > 0.97 ? level + 1 : level };
        }
      }
    }
    return { y: base, level: level };
  }

  function movePlayer(dt) {
    let mx = 0;
    let my = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) my += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) my -= 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
    mx += joy.x;
    my += joy.y;
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    const speed = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 9 : 5.2) * dt * (mag > 1 ? 1 : mag);
    if (speed <= 0) return;
    const yaw = player.yaw;
    const dx = Math.sin(yaw) * my * speed + Math.cos(yaw) * mx * speed;
    const dy = Math.cos(yaw) * my * speed - Math.sin(yaw) * mx * speed;
    let nx = player.x + dx;
    let ny = player.y + dy;
    if (blocked(nx, ny, player.level)) {
      if (!blocked(nx, player.y, player.level)) ny = player.y;
      else if (!blocked(player.x, ny, player.level)) nx = player.x;
      else return;
    }
    player.x = nx;
    player.y = ny;
    const v = vertical(player.x, player.y, player.level);
    player.level = v.level;
    player.floor = v.y;
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - (loop.last || now)) / 1000);
    loop.last = now;
    frameState = frameAt(now);
    if (anim && frameState.done) {
      anim = null;
      frameState = fullFrame();
      status("Build finished. Drag to orbit, lift the roof, or switch to Walk.");
    }
    if (anim && !userOrbit && viewMode === "orbit") orbit.theta += dt * 0.22;
    applyFrame(frameState);
    if (viewMode === "walk") {
      movePlayer(dt);
      const under = player.floor == null ? floorY(player.level) : player.floor;
      camera.position.set(player.x, under + EYE, player.y);
      const cp = Math.cos(player.pitch);
      camera.lookAt(
        player.x + Math.sin(player.yaw) * cp,
        under + EYE + Math.sin(player.pitch),
        player.y + Math.cos(player.yaw) * cp
      );
    } else {
      const sp = Math.sin(orbit.phi);
      camera.position.set(
        orbit.tx + orbit.dist * sp * Math.cos(orbit.theta),
        orbit.ty + orbit.dist * Math.cos(orbit.phi),
        orbit.tz + orbit.dist * sp * Math.sin(orbit.theta)
      );
      camera.lookAt(orbit.tx, orbit.ty, orbit.tz);
    }
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  function resize3D() {
    if (!renderer) return;
    const w = glCanvas.clientWidth || glCanvas.parentElement.clientWidth;
    const h = glCanvas.clientHeight || glCanvas.parentElement.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function bind3DInput() {
    let look = null;
    glCanvas.addEventListener("pointerdown", (e) => {
      if (e.target !== glCanvas) return;
      if (viewMode === "walk") {
        glCanvas.requestPointerLock && glCanvas.requestPointerLock();
      }
      look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      glCanvas.setPointerCapture(e.pointerId);
      userOrbit = true;
    });
    glCanvas.addEventListener("pointermove", (e) => {
      if (!look || e.pointerId !== look.id) return;
      const dx = e.clientX - look.x;
      const dy = e.clientY - look.y;
      look.x = e.clientX;
      look.y = e.clientY;
      if (document.pointerLockElement === glCanvas) return;
      if (viewMode === "walk") {
        player.yaw -= dx * 0.005;
        player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch - dy * 0.004));
      } else {
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.max(0.25, Math.min(1.35, orbit.phi - dy * 0.004));
      }
    });
    glCanvas.addEventListener("pointerup", () => { look = null; });
    glCanvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      orbit.dist = Math.max(8, Math.min(140, orbit.dist * Math.exp(e.deltaY * 0.001)));
    }, { passive: false });
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== glCanvas || viewMode !== "walk") return;
      player.yaw -= e.movementX * 0.0022;
      player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch - e.movementY * 0.002));
    });
    const joyEl = $("pw-joy");
    const knob = $("pw-joy-knob");
    function joySet(clientX, clientY) {
      const r = joyEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let x = (clientX - cx) / (r.width / 2);
      let y = (clientY - cy) / (r.height / 2);
      const m = Math.hypot(x, y) || 1;
      if (m > 1) { x /= m; y /= m; }
      joy.x = x;
      joy.y = -y;
      joy.on = true;
      knob.style.transform = "translate(calc(-50% + " + (x * 26) + "px), calc(-50% + " + (y * 26) + "px))";
    }
    function joyReset() {
      joy.x = 0; joy.y = 0; joy.on = false;
      knob.style.transform = "translate(-50%, -50%)";
    }
    joyEl.addEventListener("pointerdown", (e) => {
      joyEl.setPointerCapture(e.pointerId);
      joySet(e.clientX, e.clientY);
      e.stopPropagation();
    });
    joyEl.addEventListener("pointermove", (e) => {
      if (!joy.on) return;
      joySet(e.clientX, e.clientY);
    });
    joyEl.addEventListener("pointerup", joyReset);
    joyEl.addEventListener("pointercancel", joyReset);
  }

  function bind() {
    document.querySelectorAll("#pw [data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => setTool(btn.getAttribute("data-tool")));
    });
    $("pw-undo").addEventListener("click", undo);
    $("pw-redo").addEventListener("click", redo);
    $("pw-delete").addEventListener("click", removeSelection);
    $("pw-finish").addEventListener("click", () => {
      if (tool === "stair") return;
      commitWall(false);
    });
    $("pw-fit").addEventListener("click", () => { fit(); render2D(); });
    $("pw-zin").addEventListener("click", () => zoomAtCenter(1.2));
    $("pw-zout").addEventListener("click", () => zoomAtCenter(1 / 1.2));
    $("pw-sample").addEventListener("click", () => {
      images = new Map();
      imageEls = new Map();
      pdfDoc = null;
      $("pw-review").hidden = true;
      loadProject(sampleProject(), "Cedar Lane House is ready. Two storeys. Open Watch it build, or trace your own plan.");
      showPlan();
    });
    $("pw-blank").addEventListener("click", () => {
      if (!window.confirm("Clear this plan from the page? The sample home can be loaded again.")) return;
      pdfDoc = null;
      $("pw-review").hidden = true;
      loadProject(blankProject(), "Blank board. Upload a plan, or draw walls on the grid.");
      showPlan();
    });
    $("pw-add-storey").addEventListener("click", () => {
      if (project.storeys.length >= 4) return status("Four storeys is the limit in this sketch.");
      pushHist();
      const n = project.storeys.length + 1;
      project.storeys.push({
        id: nid("s"), name: n === 2 ? "Upper" : "Storey " + n, wallH: 8,
        walls: [], openings: [], rooms: [], stairs: [], underlay: null
      });
      project.active = project.storeys.length - 1;
      syncChrome();
      fit();
      render2D();
      scheduleSave();
      status("Storey added. Upload its plan page, or copy the walls from below.");
    });
    $("pw-copy-below").addEventListener("click", () => {
      const i = activeIndex();
      if (i === 0) return status("Copy works from the second storey upward.");
      pushHist();
      const src = project.storeys[i - 1];
      active().walls = src.walls.map((w) => ({ id: nid("w"), pts: w.pts.map((p) => p.slice()), closed: !!w.closed }));
      syncChrome();
      render2D();
      scheduleSave();
      status("Walls copied from the storey below. Doors and windows were not copied.");
    });
    $("pw-del-storey").addEventListener("click", () => {
      if (project.storeys.length < 2) return status("Keep at least one storey.");
      pushHist();
      project.storeys.splice(activeIndex(), 1);
      project.active = Math.max(0, activeIndex() - 1);
      selection = null;
      syncChrome();
      fit();
      render2D();
      scheduleSave();
      if (renderer) rebuild3D();
      status("Storey removed.");
    });
    $("pw-wall-h").addEventListener("change", () => {
      pushHist();
      active().wallH = Math.max(7.5, Math.min(16, Number($("pw-wall-h").value) || 9));
      scheduleSave();
      if (renderer) rebuild3D();
      status("Wall height on this storey is " + active().wallH + " ft in the model.");
    });
    $("pw-opacity").addEventListener("input", () => {
      const ul = active().underlay;
      if (!ul) return;
      ul.opacity = Number($("pw-opacity").value);
      render2D();
    });
    $("pw-file").addEventListener("change", () => {
      const file = $("pw-file").files && $("pw-file").files[0];
      $("pw-file").value = "";
      onFile(file);
    });
    $("pw-page-prev").addEventListener("click", () => { if (pdfDoc && pdfPage > 1) showPdfPage(pdfPage - 1); });
    $("pw-page-next").addEventListener("click", () => { if (pdfDoc && pdfPage < pdfDoc.numPages) showPdfPage(pdfPage + 1); });
    $("pw-scale-apply").addEventListener("click", applyScale);
    $("pw-scale-cancel").addEventListener("click", () => {
      scalePts = [];
      $("pw-scalebox").hidden = true;
      render2D();
      status("Scale cancelled.");
    });
    $("pw-name").addEventListener("change", () => {
      project.name = ($("pw-name").value || "Untitled plan").slice(0, 60);
      scheduleSave();
    });
    $("pw-room").addEventListener("input", () => {
      if (selection && selection.kind === "room") {
        const room = active().rooms.find((r) => r.id === selection.id);
        if (room) { room.name = $("pw-room").value.slice(0, 32) || "Room"; render2D(); scheduleSave(); }
      }
    });
    $("pw-width").addEventListener("change", () => {
      const width = Math.max(1.5, Math.min(16, Number($("pw-width").value) || 3));
      if (selection && selection.kind === "opening") {
        const op = active().openings.find((o) => o.id === selection.id);
        if (op) { pushHist(); op.width = width; render2D(); scheduleSave(); if (renderer) rebuild3D(); }
      }
      if (selection && selection.kind === "stair") {
        const st = active().stairs.find((s) => s.id === selection.id);
        if (st) { pushHist(); st.width = width; render2D(); scheduleSave(); if (renderer) rebuild3D(); }
      }
    });
    $("pw-plan-mode").addEventListener("click", showPlan);
    $("pw-orbit-mode").addEventListener("click", () => open3D("orbit", false));
    $("pw-walk-mode").addEventListener("click", () => open3D("walk", false));
    $("pw-build").addEventListener("click", () => open3D("orbit", true));
    $("pw-roof").addEventListener("input", () => { if (frameState) applyFrame(frameState); });
    $("pw-level-view").addEventListener("change", () => { if (frameState) applyFrame(frameState); });
    $("pw-export").addEventListener("click", exportFile);
    $("pw-import").addEventListener("change", () => {
      const file = $("pw-import").files && $("pw-import").files[0];
      $("pw-import").value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importText(String(reader.result || ""));
      reader.readAsText(file);
    });
    $("pw-shot").addEventListener("click", shot);
    $("pw-share").addEventListener("click", shareLink);
    planCanvas.addEventListener("pointerdown", onPointerDown);
    planCanvas.addEventListener("pointermove", onPointerMove);
    planCanvas.addEventListener("pointerup", onPointerUp);
    planCanvas.addEventListener("pointercancel", onPointerUp);
    planCanvas.addEventListener("dblclick", () => { if (tool === "wall") commitWall(false); });
    planCanvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = planCanvas.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.001));
    }, { passive: false });
    planCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
    const stage = $("pw-stage");
    stage.addEventListener("dragover", (e) => { e.preventDefault(); });
    stage.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      onFile(file);
    });
    window.addEventListener("keydown", (e) => {
      if (typingTarget(e.target)) {
        if (e.key === "Enter" && e.target.id === "pw-room") e.target.blur();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (e.key === "Escape") {
        drawing = [];
        stairPts = [];
        if (document.pointerLockElement) document.exitPointerLock();
        render2D();
        return;
      }
      if (e.key === "Enter" && tool === "wall") { commitWall(false); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelection(); return; }
      if (viewMode === "walk") keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => keys.delete(e.code));
    window.addEventListener("resize", () => { render2D(); resize3D(); });
    if (window.ResizeObserver) new ResizeObserver(() => { render2D(); resize3D(); }).observe(planCanvas.parentElement);
  }

  reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  bind();
  const booted = (async () => {
    const shared = await readShare();
    if (!shared && !loadSaved()) loadProject(sampleProject(), null);
    status("Cedar Lane House is ready. Two storeys. Open Watch it build, or upload a plan and trace it. Illustration only, not for construction.");
    if (project.name !== "Cedar Lane House") {
      status(project.name + " was restored in this browser. Load the sample home any time.");
    }
    render2D();
    requestAnimationFrame(() => { fit(); render2D(); });
  })();

  window.__PW = {
    ready: true,
    booted: booted,
    project: () => project,
    status: () => $("pw-status").textContent,
    clientOf: clientOf,
    worldToScreen: worldToScreen,
    player: () => ({ x: player.x, y: player.y, level: player.level, yaw: player.yaw, floor: player.floor }),
    orbit: () => ({ theta: orbit.theta, phi: orbit.phi, dist: orbit.dist }),
    mode: () => viewMode,
    serialize: () => JSON.stringify(exportPayload()),
    animating: () => !!anim
  };
})();
