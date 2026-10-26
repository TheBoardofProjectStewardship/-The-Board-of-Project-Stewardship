/* Rear addition, drawn in the browser. 1 unit = 1 foot.
   Illustration of one wood-frame shell. Not a survey or a permit drawing.
   Paper, cream walls, black roof and frames, ink edges, and the orthographic
   view match the homepage house drawing. */
const RENDER_LIB = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export const STAGE_COUNT = 8;

export function stageIndex(progress, count = STAGE_COUNT) {
  const n = Math.max(1, count | 0);
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  if (p >= 1) return n - 1;
  return Math.min(n - 1, Math.floor(p * n));
}

export function progressFromScroll(rectTop, trackHeight, viewport) {
  const total = Math.max(1, trackHeight - viewport);
  const scrolled = Math.min(Math.max(-rectTop, 0), total);
  return scrolled / total;
}

const $ = (id) => document.getElementById(id);

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smooth(t) { return t * t * (3 - 2 * t); }

function boot() {
  const canvas = $('aa-canvas');
  const view = $('aa-view');
  const track = $('aa-track');
  const status = $('aa-status');
  const bar = $('aa-progress-bar');
  const kicker = $('aa-kicker');
  const title = $('aa-title');
  const copy = $('aa-copy');
  const articles = [...document.querySelectorAll('#aa-sequence article')];
  const buttons = [...document.querySelectorAll('[data-stage-jump]')];
  if (!canvas || !view || !track || !articles.length) return;

  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reduceQuery.matches;
  let chosen = reduced ? STAGE_COUNT - 1 : 0;
  let progress = reduced ? 1 : 0;

  function syncReduceClass() {
    reduced = reduceQuery.matches;
    document.documentElement.classList.toggle('aa-reduce', reduced);
    if (reduced) progress = chosen >= STAGE_COUNT - 1 ? 1 : (chosen + 0.92) / STAGE_COUNT;
  }
  syncReduceClass();
  if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', () => { syncReduceClass(); paint(); });
  else if (reduceQuery.addListener) reduceQuery.addListener(() => { syncReduceClass(); paint(); });

  function showStage(index) {
    const article = articles[index] || articles[0];
    if (kicker) kicker.textContent = article.dataset.kicker || '';
    if (title) title.textContent = article.dataset.title || '';
    const paragraph = article.querySelector('p');
    if (copy && paragraph) copy.textContent = paragraph.textContent;
    articles.forEach((item, i) => item.classList.toggle('is-current', i === index));
    buttons.forEach((btn) => {
      const on = Number(btn.dataset.stageJump) === index;
      if (on) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
    if (bar) bar.style.width = `${(index / (STAGE_COUNT - 1)) * 100}%`;
  }

  function stageProgress(stage) {
    if (stage <= 0) return 0.04;
    return Math.min(1, (stage + 0.92) / STAGE_COUNT);
  }

  function jumpTo(index) {
    const stage = clamp(index, 0, STAGE_COUNT - 1);
    chosen = stage;
    if (reduced || track.offsetHeight <= window.innerHeight + 8) {
      progress = stageProgress(stage);
      paint();
      return;
    }
    const total = Math.max(1, track.offsetHeight - window.innerHeight);
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + stageProgress(stage) * total, behavior: 'auto' });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => jumpTo(Number(btn.dataset.stageJump)));
  });

  let renderScene = () => {};
  let paint = () => {
    const index = reduced ? chosen : stageIndex(progress);
    showStage(index);
  };

  function readScroll() {
    if (reduced) return;
    progress = progressFromScroll(track.getBoundingClientRect().top, track.offsetHeight, window.innerHeight);
    paint();
  }

  let scheduled = false;
  function onScroll() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; readScroll(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  const hash = (location.hash || '').replace('#', '');
  const hashed = articles.findIndex((item) => item.id === hash);
  if (hashed >= 0) chosen = hashed;

  import(RENDER_LIB).then((THREE) => {
    startScene(THREE);
  }).catch(() => {
    view.classList.add('is-fallback');
    if (status) {
      status.hidden = false;
      status.textContent = 'The 3D model did not start. The drawing and the stage notes below still explain the sequence.';
    }
    paint();
  });

  function startScene(THREE) {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, alpha: false, powerPreference: 'low-power' });
    } catch (err) {
      view.classList.add('is-fallback');
      if (status) {
        status.hidden = false;
        status.textContent = 'The 3D model did not start. The drawing and the stage notes below still explain the sequence.';
      }
      paint();
      return;
    }
    const small = Math.min(window.innerWidth, window.innerHeight) < 760;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5));
    renderer.setClearColor(0xf7f6f2, 1);
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f6f2);
    const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
    scene.add(new THREE.AmbientLight(0xf4f6fb, 0.74));
    const sun = new THREE.DirectionalLight(0xfff6ee, 0.22);
    sun.position.set(-0.45, 0.82, 0.36);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xf7f8fb, 0xe7e4da, 0.12));

    const geos = new Map();
    const mats = new Map();
    function geo(w, h, d) {
      const key = `${w}|${h}|${d}`;
      if (!geos.has(key)) geos.set(key, new THREE.BoxGeometry(w, h, d));
      return geos.get(key);
    }
    const INK = 0x1f2121;
    const DETAIL = 0x6b706e;
    const inkMat = new THREE.LineBasicMaterial({ color: INK });
    function solid(hex) {
      const key = String(hex);
      if (!mats.has(key)) {
        mats.set(key, new THREE.MeshLambertMaterial({
          color: hex, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        }));
      }
      return mats.get(key);
    }
    function glass(hex, opacity) {
      const key = `g${hex}|${opacity}`;
      if (!mats.has(key)) {
        mats.set(key, new THREE.MeshLambertMaterial({
          color: hex, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        }));
      }
      return mats.get(key);
    }
    function edgeGeometry(geometry) {
      const key = `e${geometry.uuid}`;
      if (!geos.has(key)) geos.set(key, new THREE.EdgesGeometry(geometry, 12));
      return geos.get(key);
    }
    function addInk(mesh, material) {
      mesh.add(new THREE.LineSegments(edgeGeometry(mesh.geometry), material || inkMat));
    }
    function strokeSet(parent, pairs, color, material) {
      const data = [];
      for (const [a, b] of pairs) data.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
      const line = new THREE.LineSegments(geometry, material || new THREE.LineBasicMaterial({ color }));
      parent.add(line);
      return line;
    }

    const parts = [];
    function addBox(parent, w, h, d, x, y, z, material, edge) {
      const mesh = new THREE.Mesh(geo(w, h, d), material);
      mesh.position.set(x, y, z);
      if (edge) addInk(mesh, edge === true ? inkMat : edge);
      parent.add(mesh);
      return mesh;
    }
    function addRise(parent, w, h, d, x, base, z, material, stage, delay, span) {
      const mesh = addBox(parent, w, h, d, x, base + h / 2, z, material, true);
      parts.push({ mesh, stage, delay: delay || 0, span: span || 0.62, mode: 'rise', base, h });
      return mesh;
    }
    function addFade(parent, mesh, material, stage, delay, span, maxOpacity) {
      material = material.clone();
      material.transparent = true;
      material.opacity = 0;
      material.needsUpdate = true;
      mesh.material = material;
      let lineMat = null;
      if (mesh.isMesh) {
        lineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 });
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 12), lineMat));
      }
      parent.add(mesh);
      parts.push({
        mesh, stage, delay: delay || 0, span: span || 0.4, mode: 'fade', material, lineMat, maxOpacity: maxOpacity ?? 1,
      });
      return mesh;
    }

    const PAPER = 0xf7f6f2;
    const WALL = 0xf0ece2;
    const FLOOR = 0xf4f2ee;
    const WOOD = 0xe6dcc8;
    const HEADER = 0xd7c4a8;
    const CONCRETE = 0xc8cbc8;
    const TIE = 0x8e9494;
    const SHEATH = 0xd9c4a8;
    const ROOF = 0x2b2d2e;
    const SHINGLE = ROOF;
    const FLASH = 0x5c5f62;
    const SEAM = 0x4d4f51;
    const SIDING = WALL;
    const FRAME = 0x2f2f30;
    const TRIM = FRAME;
    const DOOR = FRAME;
    const GLASS = 0x576b78;
    const EXIST = WALL;
    const EXIST_ROOF = ROOF;
    const LAWN = 0xdbe4d0;
    const SOIL = 0xc3c9b6;
    const COVER = 0xe4e2d6;

    /* Yard with a hole where the addition is dug. */
    const yard = new THREE.Group();
    scene.add(yard);
    const yardMat = solid(LAWN);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(18, 40),
      new THREE.MeshBasicMaterial({ color: 0xcfcabf, transparent: true, opacity: 0.38, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(-2, 0.03, -6);
    shadow.scale.set(1.15, 1, 0.85);
    yard.add(shadow);
    const slabs = [
      [-24.6, 0, -2, 30.8, 0.08, 76],
      [24.6, 0, -2, 30.8, 0.08, 76],
      [0, 0, -20.2, 18.4, 0.08, 39.6],
      [0, 0, 24.6, 18.4, 0.08, 22.8],
    ];
    for (const [x, y, z, w, h, d] of slabs) addBox(yard, w, h, d, x, y, z, yardMat);
    addBox(yard, 18.4, 0.08, 13.6, 0, -2.5, 6.4, solid(SOIL));
    addFade(
      yard,
      new THREE.Mesh(geo(15.2, 0.04, 11.2), glass(COVER, 0.95)),
      glass(COVER, 0.95),
      1, 0.55, 0.35, 0.95,
    ).position.set(0, -2.35, 6.5);

    /* Flat plan, then the existing house. */
    const plan = new THREE.Group();
    scene.add(plan);
    const planMats = [];
    function planMat(hex, opacity) {
      const material = new THREE.MeshLambertMaterial({ color: hex, transparent: true, opacity });
      planMats.push(material);
      return material;
    }
    const planInk = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 1 });
    planMats.push(planInk);
    addBox(plan, 46, 0.03, 44, 0, 0.05, -5, planMat(PAPER, 1), planInk);
    addBox(plan, 34.8, 0.02, 24.8, 0, 0.08, -12, planMat(INK, 1));
    addBox(plan, 33.2, 0.025, 23.2, 0, 0.1, -12, planMat(0xf4f1e8, 1));
    addBox(plan, 17.2, 0.02, 13.2, 0, 0.08, 6.2, planMat(INK, 1));
    addBox(plan, 15.2, 0.025, 11.2, 0, 0.1, 6.2, planMat(PAPER, 1));
    function labelTexture(text) {
      const board = document.createElement('canvas');
      board.width = 512;
      board.height = 128;
      const ctx = board.getContext('2d');
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = '#1c1916';
      ctx.font = '600 56px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 64);
      const tex = new THREE.CanvasTexture(board);
      tex.needsUpdate = true;
      return tex;
    }
    function addLabel(text, x, z, w) {
      const material = new THREE.MeshBasicMaterial({ map: labelTexture(text), transparent: true, depthWrite: false });
      planMats.push(material);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.28), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.12, z);
      plan.add(mesh);
    }
    addLabel('Existing house', 0, -12, 18);
    addLabel('Rear addition', 0, 6.2, 12);

    const house = new THREE.Group();
    scene.add(house);
    const hx0 = -17, hx1 = 17, hz0 = -24, hz1 = 0;
    addBox(house, 34, 2.4, 24, 0, -0.3, -12, solid(CONCRETE), true);
    addBox(house, 33.2, 0.12, 23.2, 0, 1.14, -12, solid(FLOOR), true);
    addBox(house, 34.2, 13.6, 0.45, 0, 8, hz0, solid(EXIST), true);
    addBox(house, 34.2, 13.6, 0.45, 0, 8, hz1, solid(EXIST), true);
    addBox(house, 0.45, 13.6, 24, hx0, 8, -12, solid(EXIST), true);
    addBox(house, 0.45, 13.6, 24, hx1, 8, -12, solid(EXIST), true);
    /* Windows on the side walls and on the rear wall outside the addition. */
    const winMat = glass(GLASS, 0.9);
    const frameMat = solid(FRAME);
    function houseWindow(x, y, z, w, h, d, axis) {
      addBox(house, axis === 'x' ? 0.16 : w, h, axis === 'x' ? w : 0.16, x, y, z, winMat);
      addBox(house, axis === 'x' ? 0.22 : w + 0.28, 0.14, axis === 'x' ? w + 0.28 : 0.22, x, y + h / 2, z, frameMat, true);
      addBox(house, axis === 'x' ? 0.22 : w + 0.28, 0.14, axis === 'x' ? w + 0.28 : 0.22, x, y - h / 2, z, frameMat, true);
      addBox(house, axis === 'x' ? 0.22 : w + 0.28, 0.1, axis === 'x' ? w + 0.28 : 0.22, x, y, z, frameMat, true);
      addBox(house, axis === 'x' ? 0.18 : 0.1, h, axis === 'x' ? 0.1 : 0.18, x, y, z, frameMat);
    }
    houseWindow(-10.5, 8.2, 0.36, 3.2, 4.2, 0.2, 'z');
    houseWindow(10.5, 8.2, 0.36, 3.2, 4.2, 0.2, 'z');
    houseWindow(-6, 8.4, -24.36, 4.2, 5.2, 0.2, 'z');
    houseWindow(7, 8.4, -24.36, 4.2, 5.2, 0.2, 'z');
    houseWindow(-17.36, 8.2, -8, 3.2, 4.2, 0.2, 'x');
    houseWindow(-17.36, 8.2, -16, 3.2, 4.2, 0.2, 'x');
    houseWindow(17.36, 8.2, -8, 3.2, 4.2, 0.2, 'x');
    houseWindow(17.36, 8.2, -16, 3.2, 4.2, 0.2, 'x');
    const roofMat = new THREE.MeshLambertMaterial({
      color: EXIST_ROOF, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    const roofGeo = new THREE.BufferGeometry();
    const eave = 15;
    const ridge = 21.2;
    const zMid = -12;
    const rv = [];
    const tri = (a, b, c) => { rv.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); };
    const xL = -18.2, xR = 18.2, zF = -25.2, zB = 1.15;
    tri([xL, eave, zF], [xR, eave, zF], [xR, ridge, zMid]);
    tri([xL, eave, zF], [xR, ridge, zMid], [xL, ridge, zMid]);
    tri([xL, eave, zB], [xL, ridge, zMid], [xR, ridge, zMid]);
    tri([xL, eave, zB], [xR, ridge, zMid], [xR, eave, zB]);
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
    roofGeo.computeVertexNormals();
    const existRoof = new THREE.Mesh(roofGeo, roofMat);
    existRoof.add(new THREE.LineSegments(new THREE.EdgesGeometry(roofGeo, 8), inkMat));
    house.add(existRoof);
    function existRoofY(z) {
      if (z <= zMid) return eave + (ridge - eave) * ((z - zF) / (zMid - zF));
      return ridge + (eave - ridge) * ((z - zMid) / (zB - zMid));
    }
    const seamPairs = [];
    for (let x = xL + 1.333; x < xR - 0.2; x += 1.333) {
      seamPairs.push([[x, existRoofY(zF) + 0.06, zF], [x, existRoofY(zMid) + 0.06, zMid]]);
      seamPairs.push([[x, existRoofY(zMid) + 0.06, zMid], [x, existRoofY(zB) + 0.06, zB]]);
    }
    strokeSet(house, seamPairs, SEAM);
    function wallStrokes(axis, fixed, from, to, y0, y1, holes) {
      const pairs = [];
      for (let u = from + 0.75; u < to - 0.15; u += 0.75) {
        const cuts = holes.filter((hole) => u > hole.u0 && u < hole.u1).sort((a, b) => a.y0 - b.y0);
        let y = y0;
        for (const hole of cuts) {
          if (hole.y0 > y + 0.05) {
            pairs.push(axis === 'z' ? [[u, y, fixed], [u, hole.y0, fixed]] : [[fixed, y, u], [fixed, hole.y0, u]]);
          }
          y = Math.max(y, hole.y1);
        }
        if (y1 > y + 0.05) pairs.push(axis === 'z' ? [[u, y, fixed], [u, y1, fixed]] : [[fixed, y, u], [fixed, y1, u]]);
      }
      strokeSet(house, pairs, DETAIL);
    }
    const winHoles = (centers, half) => centers.map((u) => ({ u0: u - half, u1: u + half, y0: 6.05, y1: 10.4 }));
    wallStrokes('z', -24.32, -16.6, 16.6, 1.35, 14.6, [
      { u0: -8.2, u1: -3.8, y0: 5.7, y1: 11.1 },
      { u0: 4.8, u1: 9.2, y0: 5.7, y1: 11.1 },
    ]);
    wallStrokes('z', 0.32, -16.6, -8.4, 1.35, 14.6, winHoles([-10.5], 1.7));
    wallStrokes('z', 0.32, 8.4, 16.6, 1.35, 14.6, winHoles([10.5], 1.7));
    wallStrokes('x', -17.4, -23.4, -0.6, 1.35, 14.6, [...winHoles([-16], 1.7), ...winHoles([-8], 1.7)]);
    wallStrokes('x', 17.4, -23.4, -0.6, 1.35, 14.6, [...winHoles([-16], 1.7), ...winHoles([-8], 1.7)]);

    /* Addition shell. Stages: 1 footing, 2 floor, 3 walls, 4 sheathing, 5 roof, 6 openings, 7 siding. */
    const shell = new THREE.Group();
    scene.add(shell);
    const ax0 = -8, ax1 = 8, az0 = 0.35, az1 = 12;
    const wallT = 0.32;

    /* Footing ring and the tie into the existing foundation. */
    const footH = 0.72;
    const footBase = -2.28;
    const footW = 1.25;
    addRise(shell, 16 + footW, footH, footW, 0, footBase, az0 + footW / 2 - 0.2, solid(TIE), 1, 0.05, 0.4);
    addRise(shell, 16 + footW, footH, footW, 0, footBase, az1, solid(CONCRETE), 1, 0.12, 0.45);
    addRise(shell, footW, footH, 12, ax0, footBase, 6.2, solid(CONCRETE), 1, 0.18, 0.45);
    addRise(shell, footW, footH, 12, ax1, footBase, 6.2, solid(CONCRETE), 1, 0.18, 0.45);
    const stemBase = footBase + footH;
    const stemTop = 0.42;
    const stemH = stemTop - stemBase;
    addRise(shell, 16.3, stemH, 0.5, 0, stemBase, az0 + 0.15, solid(CONCRETE), 1, 0.38, 0.4);
    addRise(shell, 16.3, stemH, 0.5, 0, stemBase, az1 - 0.15, solid(CONCRETE), 1, 0.42, 0.4);
    addRise(shell, 0.5, stemH, 11.2, ax0 + 0.15, stemBase, 6.3, solid(CONCRETE), 1, 0.46, 0.4);
    addRise(shell, 0.5, stemH, 11.2, ax1 - 0.15, stemBase, 6.3, solid(CONCRETE), 1, 0.46, 0.4);

    /* Floor: capillary break, mudsill, joists, subfloor. Joists run left to right. */
    addRise(shell, 16.2, 0.06, 0.5, 0, stemTop, az1 - 0.15, solid(FRAME), 2, 0.0, 0.25);
    addRise(shell, 0.5, 0.06, 11.2, ax0 + 0.15, stemTop, 6.3, solid(FRAME), 2, 0.0, 0.25);
    addRise(shell, 0.5, 0.06, 11.2, ax1 - 0.15, stemTop, 6.3, solid(FRAME), 2, 0.0, 0.25);
    const sill = stemTop + 0.06;
    addRise(shell, 16.2, 0.18, 0.5, 0, sill, az0 + 0.2, solid(WOOD), 2, 0.12, 0.3);
    addRise(shell, 16.2, 0.18, 0.5, 0, sill, az1 - 0.15, solid(WOOD), 2, 0.12, 0.3);
    addRise(shell, 0.5, 0.18, 11.2, ax0 + 0.15, sill, 6.3, solid(WOOD), 2, 0.12, 0.3);
    addRise(shell, 0.5, 0.18, 11.2, ax1 - 0.15, sill, 6.3, solid(WOOD), 2, 0.12, 0.3);
    const joistBase = sill + 0.18;
    const joistH = 0.78;
    for (let z = 1.5; z <= 11.2; z += 1.333) {
      addRise(shell, 15.4, joistH, 0.14, 0, joistBase, z, solid(WOOD), 2, 0.28, 0.4);
    }
    addRise(shell, 15.6, 0.1, 10.6, -0.15, joistBase + joistH, 6.1, solid(FLOOR), 2, 0.62, 0.32);

    /* Walls. Rear wall is level. Side walls follow the shed roof. */
    const floorY = joistBase + joistH + 0.1;
    const rearTop = 9.15;
    function roofY(z) {
      const t = clamp((z - 0.4) / 12.15, 0, 1);
      return 13.45 + (9.35 - 13.45) * t;
    }
    function addStudRun(x, z0, z1, along, stage) {
      const step = 1.333;
      for (let t = z0; t <= z1 + 0.01; t += step) {
        const top = along === 'z' ? roofY(t) - 0.28 : rearTop;
        const h = Math.max(0.4, top - floorY - 0.16);
        if (along === 'z') addRise(shell, wallT, h, 0.14, x, floorY + 0.16, t, solid(WOOD), stage, 0.08, 0.5);
        else addRise(shell, 0.14, h, wallT, t, floorY + 0.16, x, solid(WOOD), stage, 0.08, 0.5);
      }
    }
    /* Rear wall studs, skipping the door and the window. */
    function rearStuds() {
      const openings = [[-6.4, -3.2], [-1.6, 1.6]];
      for (let x = ax0 + 0.3; x <= ax1 - 0.3; x += 1.333) {
        if (openings.some(([a, b]) => x > a - 0.15 && x < b + 0.15)) continue;
        const h = rearTop - floorY - 0.34;
        addRise(shell, 0.14, h, wallT, x, floorY + 0.16, az1, solid(WOOD), 3, 0.08, 0.5);
      }
      for (const [a, b, head] of [[-6.4, -3.2, 7.55], [-1.6, 1.6, 8.15]]) {
        addRise(shell, b - a + 0.5, 0.7, wallT, (a + b) / 2, head, az1, solid(HEADER), 3, 0.42, 0.35);
      }
    }
    addRise(shell, 15.4, 0.16, wallT, 0, floorY, az1, solid(WOOD), 3, 0.0, 0.3);
    addRise(shell, wallT, 0.16, 11.4, ax0, floorY, 6.3, solid(WOOD), 3, 0.0, 0.3);
    addRise(shell, wallT, 0.16, 11.4, ax1, floorY, 6.3, solid(WOOD), 3, 0.0, 0.3);
    addStudRun(ax0, 0.9, 11.3, 'z', 3);
    addStudRun(ax1, 0.9, 8.2, 'z', 3);
    rearStuds();
    addRise(shell, 15.4, 0.16, wallT, 0, rearTop - 0.16, az1, solid(WOOD), 3, 0.55, 0.3);

    /* Sheathing, weather barrier, and furring. The near corner stays open. */
    const sheathMat = solid(SHEATH);
    addRise(shell, 0.16, 7.3, 8.2, ax0 - 0.26, floorY + 0.2, 4.5, sheathMat, 4, 0.0, 0.4);
    addRise(shell, 0.16, 6.2, 7.4, ax1 + 0.26, floorY + 0.2, 4.1, sheathMat, 4, 0.05, 0.4);
    addRise(shell, 12.6, 7.5, 0.16, -1.6, floorY + 0.15, az1 + 0.26, sheathMat, 4, 0.05, 0.4);
    const wrbMat = glass(0x3d7ea6, 0.42);
    addFade(shell, new THREE.Mesh(geo(0.04, 7.4, 8.3), wrbMat), wrbMat, 4, 0.42, 0.35, 0.42)
      .position.set(ax0 - 0.4, floorY + 3.9, 4.5);
    const wrbRear = glass(0x3d7ea6, 0.42);
    addFade(shell, new THREE.Mesh(geo(12.7, 7.6, 0.04), wrbRear), wrbRear, 4, 0.42, 0.35, 0.42)
      .position.set(-1.6, floorY + 4.0, az1 + 0.4);
    for (let z = 1.2; z <= 7.6; z += 1.6) {
      addRise(shell, 0.12, 6.6, 0.12, ax0 - 0.52, floorY + 0.4, z, solid(WOOD), 4, 0.7, 0.25);
    }
    for (let x = -7.2; x <= 3.6; x += 1.6) {
      addRise(shell, 0.12, 6.8, 0.12, x, floorY + 0.35, az1 + 0.52, solid(WOOD), 4, 0.7, 0.25);
    }

    /* Roof: rafters, sheathing, underlayment, shingles, apron flashing, kick-outs. */
    const rafterMat = new THREE.MeshLambertMaterial({ color: WOOD, transparent: true, opacity: 0 });
    const roofZ0 = 0.4, roofZ1 = 12.55, roofHigh = 13.45, roofLow = 9.35;
    const run = roofZ1 - roofZ0;
    const rafterLen = Math.hypot(run, roofHigh - roofLow);
    const rafterAngle = Math.atan2(roofHigh - roofLow, run);
    for (let x = -7.2; x <= 7.2; x += 1.6) {
      const mesh = new THREE.Mesh(geo(0.14, 0.4, rafterLen), rafterMat);
      mesh.position.set(x, (roofHigh + roofLow) / 2, (roofZ0 + roofZ1) / 2);
      mesh.rotation.x = rafterAngle;
      addFade(shell, mesh, rafterMat, 5, 0.0, 0.32, 1);
    }
    const shedMat = new THREE.MeshLambertMaterial({ color: SHEATH, transparent: true, opacity: 0, side: THREE.DoubleSide });
    function shedMesh(colorMaterial, thick) {
      const verts = [];
      const y0 = roofHigh, y1 = roofLow;
      const push = (a, b, c) => { verts.push(...a, ...b, ...c); };
      push([ax0 - 0.45, y0, roofZ0], [ax1 + 0.45, y0, roofZ0], [ax1 + 0.45, y1, roofZ1]);
      push([ax0 - 0.45, y0, roofZ0], [ax1 + 0.45, y1, roofZ1], [ax0 - 0.45, y1, roofZ1]);
      push([ax0 - 0.45, y0 - thick, roofZ0], [ax0 - 0.45, y1 - thick, roofZ1], [ax1 + 0.45, y1 - thick, roofZ1]);
      push([ax0 - 0.45, y0 - thick, roofZ0], [ax1 + 0.45, y1 - thick, roofZ1], [ax1 + 0.45, y0 - thick, roofZ0]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geometry.computeVertexNormals();
      return new THREE.Mesh(geometry, colorMaterial);
    }
    addFade(shell, shedMesh(shedMat, 0.12), shedMat, 5, 0.28, 0.28, 1);
    const underMat = new THREE.MeshLambertMaterial({ color: 0x3a3c3d, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const under = shedMesh(underMat, 0.05);
    under.position.y += 0.08;
    addFade(shell, under, underMat, 5, 0.48, 0.2, 1);
    const shingleMat = new THREE.MeshLambertMaterial({ color: SHINGLE, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const shingles = shedMesh(shingleMat, 0.08);
    shingles.position.y += 0.16;
    addFade(shell, shingles, shingleMat, 5, 0.64, 0.28, 1);
    const shedSeams = [];
    for (let x = ax0 + 0.9; x < ax1 - 0.2; x += 1.333) {
      shedSeams.push([
        [x, roofY(roofZ0) + 0.28, roofZ0],
        [x, roofY(roofZ1) + 0.28, roofZ1],
      ]);
    }
    const shedSeamGeo = new THREE.BufferGeometry();
    const shedSeamData = [];
    for (const [a, b] of shedSeams) shedSeamData.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    shedSeamGeo.setAttribute('position', new THREE.Float32BufferAttribute(shedSeamData, 3));
    const shedSeamMat = new THREE.LineBasicMaterial({ color: SEAM, transparent: true, opacity: 0 });
    const shedSeamLines = new THREE.LineSegments(shedSeamGeo, shedSeamMat);
    shell.add(shedSeamLines);
    parts.push({
      mesh: shedSeamLines, stage: 5, delay: 0.72, span: 0.24, mode: 'fade', material: shedSeamMat, maxOpacity: 1,
    });
    addFade(
      shell,
      new THREE.Mesh(geo(16.8, 0.7, 0.08), new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 })),
      new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 }),
      5, 0.5, 0.3, 1,
    ).position.set(0, 13.7, 0.42);
    for (const x of [-8.35, 8.35]) {
      const kick = new THREE.Mesh(
        geo(0.85, 0.28, 0.7),
        new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 }),
      );
      kick.position.set(x, 13.15, 0.55);
      kick.rotation.y = x < 0 ? 0.7 : -0.7;
      addFade(shell, kick, kick.material, 5, 0.72, 0.22, 1);
    }

    /* Door, window, sill pans, jambs, head flashing. */
    function dressOpening(x, z, w, sill, head, face, axis) {
      const frame = solid(FRAME);
      const pan = new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 });
      const outward = face === 'rear' ? 1 : -1;
      if (axis === 'z') {
        addFade(shell, new THREE.Mesh(geo(w + 0.5, 0.08, 0.55), pan), pan, 6, 0.0, 0.22, 1)
          .position.set(x, sill - 0.02, z + outward * 0.42);
        addFade(shell, new THREE.Mesh(geo(w - 0.15, head - sill - 0.15, 0.12), glass(GLASS, 0.9)), glass(GLASS, 0.9), 6, 0.22, 0.3, 0.92)
          .position.set(x, (sill + head) / 2, z + outward * 0.34);
        addRise(shell, w + 0.25, 0.14, 0.2, x, head - 0.1, z + outward * 0.32, frame, 6, 0.28, 0.25);
        addRise(shell, w + 0.25, 0.14, 0.2, x, sill + 0.02, z + outward * 0.32, frame, 6, 0.28, 0.25);
        addRise(shell, 0.14, head - sill, 0.2, x - w / 2, sill, z + outward * 0.32, frame, 6, 0.28, 0.25);
        addRise(shell, 0.14, head - sill, 0.2, x + w / 2, sill, z + outward * 0.32, frame, 6, 0.28, 0.25);
        const jamb = new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 });
        addFade(shell, new THREE.Mesh(geo(0.16, head - sill + 0.2, 0.08), jamb), jamb, 6, 0.5, 0.25, 1)
          .position.set(x - w / 2 - 0.12, (sill + head) / 2, z + outward * 0.5);
        addFade(shell, new THREE.Mesh(geo(0.16, head - sill + 0.2, 0.08), jamb), jamb, 6, 0.5, 0.25, 1)
          .position.set(x + w / 2 + 0.12, (sill + head) / 2, z + outward * 0.5);
        const headFl = new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 });
        addFade(shell, new THREE.Mesh(geo(w + 0.9, 0.12, 0.28), headFl), headFl, 6, 0.7, 0.25, 1)
          .position.set(x, head + 0.12, z + outward * 0.5);
      }
    }
    dressOpening(-4.8, az1, 3.1, floorY + 2.6, floorY + 6.5, 'rear', 'z');
    /* Door */
    addFade(
      shell,
      new THREE.Mesh(geo(3.3, 0.08, 0.6), new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 })),
      new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 }),
      6, 0.0, 0.22, 1,
    ).position.set(0, floorY + 0.04, az1 + 0.42);
    addFade(
      shell,
      new THREE.Mesh(geo(2.7, 6.6, 0.12), solid(DOOR)),
      solid(DOOR),
      6, 0.24, 0.3, 1,
    ).position.set(0, floorY + 3.4, az1 + 0.34);
    const doorJamb = new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 });
    addFade(shell, new THREE.Mesh(geo(0.16, 6.9, 0.08), doorJamb), doorJamb, 6, 0.5, 0.25, 1).position.set(-1.55, floorY + 3.45, az1 + 0.5);
    addFade(shell, new THREE.Mesh(geo(0.16, 6.9, 0.08), doorJamb), doorJamb, 6, 0.5, 0.25, 1).position.set(1.55, floorY + 3.45, az1 + 0.5);
    addFade(
      shell,
      new THREE.Mesh(geo(3.8, 0.14, 0.32), new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 })),
      new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 }),
      6, 0.7, 0.25, 1,
    ).position.set(0, floorY + 6.95, az1 + 0.5);

    /* Side window on the far wall, same flashing order. */
    const sideSill = floorY + 2.7;
    const sideHead = floorY + 6.2;
    addFade(
      shell,
      new THREE.Mesh(geo(0.55, 0.08, 3.5), new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 })),
      new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 }),
      6, 0.02, 0.22, 1,
    ).position.set(ax0 - 0.55, sideSill, 5.2);
    addFade(
      shell,
      new THREE.Mesh(geo(0.12, sideHead - sideSill - 0.2, 2.8), glass(GLASS, 0.9)),
      glass(GLASS, 0.9),
      6, 0.24, 0.28, 0.92,
    ).position.set(ax0 - 0.48, (sideSill + sideHead) / 2, 5.2);
    addRise(shell, 0.18, 0.14, 3.2, ax0 - 0.48, sideHead - 0.1, 5.2, solid(FRAME), 6, 0.3, 0.24);
    addRise(shell, 0.18, 0.14, 3.2, ax0 - 0.48, sideSill + 0.02, 5.2, solid(FRAME), 6, 0.3, 0.24);
    const sideJamb = new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 });
    addFade(shell, new THREE.Mesh(geo(0.08, sideHead - sideSill, 0.16), sideJamb), sideJamb, 6, 0.52, 0.24, 1)
      .position.set(ax0 - 0.62, (sideSill + sideHead) / 2, 3.55);
    addFade(shell, new THREE.Mesh(geo(0.08, sideHead - sideSill, 0.16), sideJamb), sideJamb, 6, 0.52, 0.24, 1)
      .position.set(ax0 - 0.62, (sideSill + sideHead) / 2, 6.85);
    addFade(
      shell,
      new THREE.Mesh(geo(0.28, 0.12, 3.8), new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 })),
      new THREE.MeshLambertMaterial({ color: FLASH, transparent: true, opacity: 0 }),
      6, 0.72, 0.22, 1,
    ).position.set(ax0 - 0.66, sideHead + 0.12, 5.2);

    /* Cream vertical siding and black trim. Stop above grade. Leave the near corner open. */
    const rearSkinH = rearTop - floorY - 0.7;
    const rearSkin = addRise(shell, 12.4, rearSkinH, 0.1, -1.7, floorY + 0.4, az1 + 0.7, solid(SIDING), 7, 0.04, 0.45);
    const sideSkinH = rearTop - floorY - 0.85;
    const sideSkin = addRise(shell, 0.1, sideSkinH, 7.2, ax0 - 0.72, floorY + 0.4, 4.2, solid(SIDING), 7, 0.08, 0.45);
    function boardLines(mesh, width, height, along, gaps) {
      const pairs = [];
      const halfW = width / 2;
      const halfH = height / 2;
      for (let u = -halfW + 0.75; u < halfW - 0.15; u += 0.75) {
        const gap = gaps.find((item) => u > item.a && u < item.b);
        const push = (a, b) => {
          if (b <= a + 0.05) return;
          pairs.push(along === 'x' ? [[u, a, 0.07], [u, b, 0.07]] : [[-0.07, a, u], [-0.07, b, u]]);
        };
        if (!gap) push(-halfH, halfH);
        else { push(-halfH, gap.sill); push(gap.head, halfH); }
      }
      if (pairs.length) strokeSet(mesh, pairs, DETAIL);
    }
    const rearMid = floorY + 0.4 + rearSkinH / 2;
    const rearLocal = (y) => y - rearMid;
    boardLines(rearSkin, 12.4, rearSkinH, 'x', [
      { a: -4.65, b: -1.55, sill: rearLocal(floorY + 2.55), head: rearLocal(floorY + 6.55) },
      { a: 0.05, b: 3.35, sill: rearLocal(floorY + 0.2), head: rearLocal(floorY + 6.9) },
    ]);
    const sideMid = floorY + 0.4 + sideSkinH / 2;
    const sideLocal = (y) => y - sideMid;
    boardLines(sideSkin, 7.2, sideSkinH, 'z', [
      { a: -0.4, b: 2.4, sill: sideLocal(sideSill), head: sideLocal(sideHead) },
    ]);
    addRise(shell, 0.18, rearTop - floorY - 0.3, 0.18, -7.7, floorY + 0.4, az1 + 0.78, solid(TRIM), 7, 0.62, 0.3);
    addRise(shell, 3.5, 0.16, 0.16, -4.8, floorY + 6.7, az1 + 0.78, solid(TRIM), 7, 0.7, 0.25);
    addRise(shell, 3.5, 0.16, 0.16, -4.8, floorY + 2.45, az1 + 0.78, solid(TRIM), 7, 0.7, 0.25);
    addRise(shell, 0.16, 4.3, 0.16, -6.45, floorY + 4.5, az1 + 0.78, solid(TRIM), 7, 0.7, 0.25);
    addRise(shell, 0.16, 4.3, 0.16, -3.15, floorY + 4.5, az1 + 0.78, solid(TRIM), 7, 0.7, 0.25);
    addRise(shell, 3.4, 0.2, 0.18, 0, floorY + 6.85, az1 + 0.8, solid(TRIM), 7, 0.75, 0.22);

    function amountFor(part, stageFloat) {
      if (stageFloat >= part.stage + 1) return 1;
      if (stageFloat < part.stage) return 0;
      const local = stageFloat - part.stage;
      return smooth(clamp((local - part.delay) / part.span, 0, 1));
    }

    let viewAspect = 1;
    function frameCamera(t, aspect) {
      const angle = 0.02 + ((52 * Math.PI) / 180 - 0.02) * t;
      const heading = ((-36 * Math.PI) / 180) * t;
      const back = new THREE.Vector3(
        Math.sin(angle) * Math.sin(heading),
        Math.cos(angle),
        Math.sin(angle) * Math.cos(heading),
      );
      const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
      const up = new THREE.Vector3(
        -Math.cos(angle) * Math.sin(heading),
        Math.sin(angle),
        -Math.cos(angle) * Math.cos(heading),
      );
      const min = new THREE.Vector3(-24, -3.1, -28);
      const max = new THREE.Vector3(24, -0.05 + 23 * t, 18);
      const target = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
      let left = Infinity;
      let rightEdge = -Infinity;
      let bottom = Infinity;
      let upper = -Infinity;
      for (const x of [min.x, max.x]) {
        for (const y of [min.y, max.y]) {
          for (const z of [min.z, max.z]) {
            const delta = new THREE.Vector3(x, y, z).sub(target);
            const px = delta.dot(right);
            const py = delta.dot(up);
            left = Math.min(left, px);
            rightEdge = Math.max(rightEdge, px);
            bottom = Math.min(bottom, py);
            upper = Math.max(upper, py);
          }
        }
      }
      target.addScaledVector(right, (left + rightEdge) / 2);
      target.addScaledVector(up, (bottom + upper) / 2);
      const safeAspect = Math.max(aspect, 0.2);
      const halfHeight = Math.max((upper - bottom) / 2, (rightEdge - left) / (2 * safeAspect)) * 1.08;
      const halfWidth = halfHeight * safeAspect;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.near = 0.1;
      camera.far = 500;
      camera.position.copy(target).addScaledVector(back, 180);
      camera.up.copy(up);
      camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, back));
      camera.updateProjectionMatrix();
    }

    function apply(p) {
      const stageFloat = clamp(p, 0, 1) * STAGE_COUNT;
      const houseU = clamp(stageFloat / 0.92, 0, 1);
      const hs = houseU < 0.05 ? 0.001 : smooth(houseU);
      house.scale.y = hs;
      house.visible = houseU > 0.05;
      const planOpacity = 1 - smooth(clamp((houseU - 0.2) / 0.8, 0, 1));
      for (const material of planMats) material.opacity = planOpacity;
      plan.visible = planOpacity > 0.03;
      for (const part of parts) {
        const t = amountFor(part, stageFloat);
        if (part.mode === 'rise') {
          const s = Math.max(0.001, t);
          part.mesh.scale.y = s;
          part.mesh.position.y = part.base + (part.h * s) / 2;
          part.mesh.visible = t > 0.04;
        } else {
          part.mesh.visible = t > 0.04;
          part.material.opacity = (part.maxOpacity ?? 1) * t;
          part.material.depthWrite = part.material.opacity > 0.9;
          if (part.lineMat) part.lineMat.opacity = t;
        }
      }
      frameCamera(smooth(clamp(p, 0, 1)), viewAspect);
      const index = reduced ? chosen : stageIndex(p);
      showStage(index);
      renderer.render(scene, camera);
    }

    function resize() {
      const w = view.clientWidth;
      const h = view.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      viewAspect = w / h;
      apply(progress);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(view);

    let onscreen = true;
    const visibility = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
      if (onscreen) resize();
    }, { threshold: 0.01 });
    visibility.observe(view);

    renderScene = () => { if (onscreen) resize(); };
    paint = () => {
      const p = progress;
      if (onscreen) apply(p);
      else showStage(reduced ? chosen : stageIndex(p));
    };
    if (status) status.hidden = true;
    resize();
    readScroll();
    if (reduced || hashed >= 0) jumpTo(chosen);
  }

  paint();
  readScroll();
}

if (typeof document !== 'undefined') boot();
