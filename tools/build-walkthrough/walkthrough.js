import {
  FH,
  FURNITURE,
  FIRST_ROOMS,
  GH,
  GROUND_ROOMS,
  MAIN_W,
  OPENINGS,
  PLAN_D,
  PLAN_W,
  STAGES,
  buildPieces,
  endState,
  labelPoints,
  modelCounts,
} from "./plan-data.js";

const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = reducedQuery.matches;

const counts = modelCounts();
const viewport = document.getElementById("viewport");
const canvas = document.getElementById("c");
const statusChip = document.getElementById("statusChip");
const fallback = document.getElementById("fallback");

const ui = {
  badge: document.getElementById("stageBadge"),
  eyebrow: document.getElementById("stageEyebrow"),
  title: document.getElementById("stageTitle"),
  blurb: document.getElementById("stageBlurb"),
  focus: document.getElementById("focusCue"),
  context: document.getElementById("contextCue"),
  checks: document.getElementById("checkList"),
  scrub: document.getElementById("stageScrubber"),
  mobileLabel: document.getElementById("mobileStageLabel"),
  rail: document.getElementById("stageRail"),
  prevM: document.getElementById("previousMobile"),
  nextM: document.getElementById("nextMobile"),
  prevD: document.getElementById("previousDesktop"),
  nextD: document.getElementById("nextDesktop"),
  allStages: document.getElementById("allStagesButton"),
  statWalls: document.getElementById("statWalls"),
  statOpenings: document.getElementById("statOpenings"),
  statRooms: document.getElementById("statRooms"),
  statFloors: document.getElementById("statFloors"),
};

ui.statWalls.textContent = `${counts.walls} walls`;
ui.statOpenings.textContent = `${counts.openings} doors & windows`;
ui.statRooms.textContent = `${counts.rooms} rooms`;
ui.statFloors.textContent = `${counts.floors} floors`;

let stageIndex = 0;
let floorFilter = "whole";
let viewMode = "3d";
let showNames = true;
let userMoved = false;
let playToken = 0;
let choreo = null;
const state = endState(0);
const target = { ...state };

const pose = { theta: 2.55, phi: 0.96, radius: 28, tx: 8, ty: 0.4, tz: 6 };
const goal = { ...pose };

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasWebGL() {
  try {
    const test = document.createElement("canvas");
    return !!(test.getContext("webgl2") || test.getContext("webgl"));
  } catch {
    return false;
  }
}

function postEmbedHeight() {
  if (!window.parent || window.parent === window) return;
  const app = document.querySelector(".app");
  if (!app) return;
  const height = Math.ceil(app.getBoundingClientRect().height);
  if (!Number.isFinite(height) || height < 320) return;
  try {
    window.parent.postMessage({ type: "build-walkthrough:resize", height }, "*");
  } catch {
    /* ignore */
  }
}

function padNumber(n) {
  return String(n).padStart(2, "0");
}

function currentStatus() {
  if (choreo === "walls") return "Ground floor: raising the walls";
  if (choreo === "stack") return "First floor: stacking on";
  return STAGES[stageIndex].status;
}

function updateStageUi() {
  const stage = STAGES[stageIndex];
  const number = padNumber(stageIndex + 1);
  ui.badge.textContent = `${number} / 17 · ${stage.short}`;
  ui.eyebrow.textContent = `Stage ${number} of 17`;
  ui.title.textContent = stage.short;
  ui.blurb.textContent = stage.blurb;
  ui.focus.textContent = stage.focus;
  ui.context.textContent = stage.context;
  ui.mobileLabel.textContent = `${stage.short} · ${number}/17`;
  ui.scrub.value = String(stageIndex);
  ui.scrub.setAttribute("aria-valuetext", `Stage ${stageIndex + 1} of 17: ${stage.short}`);
  ui.checks.replaceChildren();
  stage.checks.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ui.checks.appendChild(li);
  });
  ui.rail.querySelectorAll("button").forEach((button, index) => {
    const active = index === stageIndex;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  ui.prevM.disabled = stageIndex === 0;
  ui.prevD.disabled = stageIndex === 0;
  ui.nextM.disabled = stageIndex === STAGES.length - 1;
  ui.nextD.disabled = stageIndex === STAGES.length - 1;
  document.body.classList.toggle("show-stamp", stageIndex === 2);
  statusChip.textContent = currentStatus();
  postEmbedHeight();
}

function setPressed(selector, value) {
  document.querySelectorAll(selector).forEach((button) => {
    const on = button.dataset.value === value;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
  });
}

function updateToggles() {
  setPressed("[data-floor]", floorFilter);
  document.getElementById("btnNames").setAttribute("aria-pressed", String(showNames));
  document.getElementById("btnNames").classList.toggle("active", showNames);
  document.getElementById("btn3d").classList.toggle("active", viewMode === "3d");
  document.getElementById("btnTop").classList.toggle("active", viewMode === "top");
  const groundSvg = document.getElementById("svg-ground");
  const firstSvg = document.getElementById("svg-first");
  if (groundSvg) groundSvg.style.display = floorFilter === "first" ? "none" : "";
  if (firstSvg) firstSvg.style.display = floorFilter === "ground" ? "none" : "";
}

STAGES.forEach((stage, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `${padNumber(index + 1)} ${stage.short}`;
  button.setAttribute("role", "tab");
  button.addEventListener("click", () => setStage(index));
  ui.rail.appendChild(button);
});

function setStage(index, fromScrubber = false) {
  stageIndex = clamp(index, 0, STAGES.length - 1);
  const end = endState(stageIndex);
  if (!reducedMotion && stageIndex === 5 && state.riseG < 0.2 && state.spread > 0.65) {
    choreo = "walls";
    Object.assign(target, end, { spread: 1, riseF: 0, riseG: 1 });
  } else {
    choreo = null;
    Object.assign(target, end);
  }
  if (!fromScrubber) ui.scrub.value = String(stageIndex);
  updateStageUi();
  updateToggles();
}

function wireChrome() {
  ui.scrub.addEventListener("input", () => {
    playToken += 1;
    document.getElementById("btnReplay").setAttribute("aria-pressed", "false");
    setStage(Number(ui.scrub.value), true);
  });
  ui.prevM.addEventListener("click", () => setStage(stageIndex - 1));
  ui.nextM.addEventListener("click", () => setStage(stageIndex + 1));
  ui.prevD.addEventListener("click", () => setStage(stageIndex - 1));
  ui.nextD.addEventListener("click", () => setStage(stageIndex + 1));
  ui.allStages.addEventListener("click", () => {
    const open = ui.rail.classList.toggle("open");
    ui.allStages.setAttribute("aria-expanded", String(open));
    ui.allStages.textContent = open ? "All stages ▴" : "All stages ▾";
    postEmbedHeight();
  });
  document.querySelectorAll("[data-floor]").forEach((button) => {
    button.addEventListener("click", () => {
      floorFilter = button.dataset.value;
      userMoved = false;
      updateToggles();
    });
  });
  document.getElementById("btnNames").addEventListener("click", () => {
    showNames = !showNames;
    updateToggles();
  });
  document.getElementById("btn3d").addEventListener("click", () => {
    viewMode = "3d";
    userMoved = false;
    updateToggles();
  });
  document.getElementById("btnTop").addEventListener("click", () => {
    viewMode = "top";
    userMoved = false;
    updateToggles();
  });
  document.getElementById("btnReset").addEventListener("click", () => {
    viewMode = "3d";
    floorFilter = "whole";
    userMoved = false;
    updateToggles();
  });
  document.getElementById("btnReplay").addEventListener("click", () => replay());
  window.addEventListener("keydown", (event) => {
    const tag = event.target instanceof HTMLElement ? event.target.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key === "ArrowRight") setStage(stageIndex + 1);
    if (event.key === "ArrowLeft") setStage(stageIndex - 1);
  });
  reducedQuery.addEventListener?.("change", (event) => {
    reducedMotion = event.matches;
  });
  window.addEventListener("resize", postEmbedHeight, { passive: true });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(postEmbedHeight).observe(document.querySelector(".app"));
}

async function replay() {
  const token = ++playToken;
  const button = document.getElementById("btnReplay");
  button.setAttribute("aria-pressed", "true");
  floorFilter = "whole";
  viewMode = "3d";
  userMoved = false;
  updateToggles();
  for (let i = 0; i < STAGES.length; i += 1) {
    if (token !== playToken) return;
    setStage(i);
    const wait = reducedMotion ? 240 : i === 5 ? 3400 : 1150;
    await sleep(wait);
  }
  if (token === playToken) button.setAttribute("aria-pressed", "false");
}

wireChrome();
updateStageUi();
updateToggles();

const THREE = await import("three").catch(() => null);

if (!THREE || !hasWebGL()) {
  document.body.classList.add("no-webgl");
  window.__buildWalkthrough = {
    setStage,
    hold() {},
    get stage() {
      return stageIndex;
    },
    ready: true,
    webgl: false,
  };
  postEmbedHeight();
} else {
  start(THREE);
}

function start(THREE) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    document.body.classList.add("no-webgl");
    window.__buildWalkthrough = { setStage, ready: true, webgl: false };
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xf3efe6, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3efe6);
  scene.add(new THREE.HemisphereLight(0xfff8ef, 0xe4dece, 1.15));
  const sun = new THREE.DirectionalLight(0xfff4e4, 1.85);
  sun.position.set(-16, 24, -12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdde6ef, 0.38);
  fill.position.set(10, 8, 16);
  scene.add(fill);

  const materials = {
    sheet: new THREE.MeshStandardMaterial({ color: 0xfbf8f3, roughness: 1 }),
    sheetEdge: new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 1 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.84 }),
    wallFront: new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.84, transparent: true, opacity: 1 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x6f675c, roughness: 0.7 }),
    slab: new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.96 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x3e524a, roughness: 0.72 }),
    gable: new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.9, side: THREE.DoubleSide }),
    ink: new THREE.MeshBasicMaterial({ color: 0x2c2b28 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xc5d5dc,
      roughness: 0.08,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
    frame: new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.55 }),
    door: new THREE.MeshStandardMaterial({ color: 0x6d4b32, roughness: 0.62 }),
    garageDoor: new THREE.MeshStandardMaterial({ color: 0xe4e0d8, roughness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xc6a36b, roughness: 0.55, transparent: true, opacity: 0 }),
    tile: new THREE.MeshStandardMaterial({ color: 0xd5ddd8, roughness: 0.38, transparent: true, opacity: 0 }),
    cab: new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.55 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x2c3330, roughness: 0.35 }),
    insul: new THREE.MeshStandardMaterial({ color: 0xf0b7ae, roughness: 1 }),
    drywall: new THREE.MeshStandardMaterial({ color: 0xf7f6f2, roughness: 0.92 }),
    pipeC: new THREE.MeshStandardMaterial({ color: 0x2d6fbe, roughness: 0.4, transparent: true, opacity: 0 }),
    pipeH: new THREE.MeshStandardMaterial({ color: 0xd24a4a, roughness: 0.4, transparent: true, opacity: 0 }),
    pipeW: new THREE.MeshStandardMaterial({ color: 0xd5d5d2, roughness: 0.5, transparent: true, opacity: 0 }),
    elec: new THREE.MeshStandardMaterial({ color: 0xe0a03a, roughness: 0.45, emissive: 0x6a4510, emissiveIntensity: 0.18, transparent: true, opacity: 0 }),
    hvac: new THREE.MeshStandardMaterial({ color: 0x6ec8c4, roughness: 0.4, transparent: true, opacity: 0 }),
    punch: new THREE.MeshStandardMaterial({ color: 0xe24b4b, emissive: 0x8a2020, emissiveIntensity: 0.35 }),
    lot: new THREE.MeshStandardMaterial({ color: 0xe3eadc, roughness: 1 }),
    drive: new THREE.MeshStandardMaterial({ color: 0xd5d2cb, roughness: 0.95 }),
    line: new THREE.LineBasicMaterial({ color: 0x3a3936 }),
  };

  const groundGroup = new THREE.Group();
  const firstGroup = new THREE.Group();
  const wallsG = new THREE.Group();
  const wallsF = new THREE.Group();
  const namesG = new THREE.Group();
  const namesF = new THREE.Group();
  const openG = new THREE.Group();
  const openF = new THREE.Group();
  const roofRoot = new THREE.Group();
  const mepP = new THREE.Group();
  const mepE = new THREE.Group();
  const mepH = new THREE.Group();
  const insulG = new THREE.Group();
  const dryG = new THREE.Group();
  const finishG = new THREE.Group();
  const cabG = new THREE.Group();
  const punchG = new THREE.Group();
  const lotGroup = new THREE.Group();
  const stampGroup = new THREE.Group();
  const dimsGroup = new THREE.Group();
  scene.add(lotGroup, groundGroup, firstGroup);

  function sheet(parent, w, d) {
    const margin = 1.3;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w + margin * 2, d + margin * 2), materials.sheet);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(w / 2, 0, d / 2);
    plane.receiveShadow = true;
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(w + margin * 2 + 0.14, d + margin * 2 + 0.14), materials.sheetEdge);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(w / 2, -0.012, d / 2);
    edge.receiveShadow = true;
    parent.add(edge, plane);
  }

  function padColor(room) {
    if (room.pad === "wet") return 0xe7eef0;
    if (room.pad === "kitchen") return 0xf3f0e7;
    if (room.pad === "garage") return 0xe6e4df;
    if (room.pad === "patio") return 0xe5efe6;
    if (room.pad === "stair") return 0xf1efe9;
    return 0xf7f4ee;
  }

  function addPads(parent, rooms) {
    rooms.forEach((room) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.05, room.w - 0.04), 0.01, Math.max(0.05, room.d - 0.04)),
        new THREE.MeshStandardMaterial({ color: padColor(room), roughness: 1 })
      );
      mesh.position.set(room.x + room.w / 2, 0.008, room.z + room.d / 2);
      mesh.receiveShadow = true;
      parent.add(mesh);
    });
  }

  function place(mesh, piece) {
    const mid = (piece.lo + piece.hi) / 2;
    if (piece.axis === "h") mesh.position.set(mid, 0, piece.fixed);
    else {
      mesh.position.set(piece.fixed, 0, mid);
      mesh.rotation.y = Math.PI / 2;
    }
  }

  function addBox(parent, piece, len, height, thick, material, y0, cast = false) {
    const geo = new THREE.BoxGeometry(len, height, thick);
    geo.translate(0, y0 + height / 2, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    place(mesh, piece);
    parent.add(mesh);
    return mesh;
  }

  function buildWalls(parent, pieces, rooms, wallH, mat, matFront) {
    pieces.forEach((piece) => {
      const len = piece.hi - piece.lo;
      const thick = piece.exterior ? 0.18 : 0.1;
      const front = piece.axis === "h" && Math.abs(piece.fixed) < 0.02 && piece.hi <= 10.95;
      const material = front ? matFront : mat;
      const spans =
        piece.kind === "solid"
          ? [[0, wallH]]
          : piece.kind === "window"
            ? [[0, 0.86], [2.16, wallH]]
            : piece.kind === "garage"
              ? [[2.3, wallH]]
              : [[2.16, wallH]];
      spans.forEach(([y0, y1]) => {
        if (y1 - y0 < 0.05) return;
        addBox(parent, piece, len, y1 - y0, thick, material, y0, true);
        if (y1 > wallH - 0.08) addBox(parent, piece, len, 0.05, thick + 0.03, materials.plate, y1 - 0.05, true);
      });
    });
  }

  function buildLiners(insulParent, dryParent, pieces, rooms, wallH) {
    pieces.forEach((piece) => {
      if (piece.kind !== "solid") return;
      const len = piece.hi - piece.lo;
      if (len < 0.35) return;
      const room = rooms.find((item) => piece.rooms.includes(item.id));
      if (!room) return;
      const shift = new THREE.Vector3();
      if (piece.axis === "h") shift.z = room.z + room.d / 2 > piece.fixed ? 0.11 : -0.11;
      else shift.x = room.x + room.w / 2 > piece.fixed ? 0.11 : -0.11;
      const make = (parent, material, scaleIn) => {
        const geo = new THREE.BoxGeometry(Math.max(0.08, len - 0.06), Math.max(0.2, wallH - 0.34), 0.04);
        geo.translate(0, 0.22 + Math.max(0.2, wallH - 0.34) / 2, 0);
        const mesh = new THREE.Mesh(geo, material);
        place(mesh, piece);
        mesh.position.x += shift.x * scaleIn;
        mesh.position.z += shift.z * scaleIn;
        parent.add(mesh);
      };
      if (piece.exterior) make(insulParent, materials.insul, 1);
      make(dryParent, materials.drywall, piece.exterior ? 1.35 : 0.7);
    });
  }

  function buildInk(parent, pieces) {
    pieces.forEach((piece) => {
      const len = piece.hi - piece.lo;
      if (piece.kind === "solid") {
        addBox(parent, piece, len, 0.02, piece.exterior ? 0.15 : 0.08, materials.ink, 0.012);
        return;
      }
      if (piece.kind === "window" || piece.kind === "slider") {
        addBox(parent, piece, len, 0.012, 0.035, materials.ink, 0.02);
      }
    });
  }

  function buildSwings(parent, pieces) {
    pieces.forEach((piece) => {
      if (!piece.op || piece.kind !== "door") return;
      const radius = piece.hi - piece.lo;
      const hingeLo = piece.op.hinge !== "hi";
      const side = piece.op.side || 1;
      const hx = piece.axis === "h" ? (hingeLo ? piece.lo : piece.hi) : piece.fixed;
      const hz = piece.axis === "h" ? piece.fixed : hingeLo ? piece.lo : piece.hi;
      const pts = [];
      for (let i = 0; i <= 12; i += 1) {
        const a = (i / 12) * (Math.PI / 2);
        if (piece.axis === "h") {
          const along = hingeLo ? 1 : -1;
          pts.push(new THREE.Vector3(hx + along * Math.cos(a) * radius, 0.035, hz + side * Math.sin(a) * radius));
        } else {
          const along = hingeLo ? 1 : -1;
          pts.push(new THREE.Vector3(hx + side * Math.sin(a) * radius, 0.035, hz + along * Math.cos(a) * radius));
        }
      }
      parent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), materials.line));
      parent.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(hx, 0.035, hz), pts[pts.length - 1]]),
          materials.line
        )
      );
    });
  }

  function addOutline(parent, x, z, w, d) {
    const y = 0.03;
    const t = 0.028;
    const h = 0.016;
    const bars = [
      [x + w / 2, z, w, t],
      [x + w / 2, z + d, w, t],
      [x, z + d / 2, t, d],
      [x + w, z + d / 2, t, d],
    ];
    bars.forEach(([cx, cz, bw, bd]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), materials.ink);
      mesh.position.set(cx, y, cz);
      parent.add(mesh);
    });
  }

  function addFurniture(parent, floor) {
    FURNITURE.filter((item) => item.floor === floor).forEach((item) => {
      if (item.type === "stair") {
        for (let z = item.z; z <= item.z + item.d; z += item.step) {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.012, 0.02), materials.ink);
          mesh.position.set(item.x + item.w / 2, 0.032, z);
          parent.add(mesh);
        }
        return;
      }
      if (item.type === "toilet" || item.type === "sink") {
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(item.type === "toilet" ? 0.18 : 0.14, 18), materials.ink);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(item.x, 0.032, item.z);
        parent.add(mesh);
        return;
      }
      if (item.w && item.d) addOutline(parent, item.x, item.z, item.w, item.d);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function makeLabel(text, maxWidth) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const font = '700 44px "Segoe UI", system-ui, sans-serif';
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    c.width = tw + 56;
    c.height = 72;
    ctx.font = font;
    ctx.fillStyle = "rgba(255,252,248,0.96)";
    roundRect(ctx, 2, 2, c.width - 4, 68, 34);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(40,36,30,0.1)";
    ctx.stroke();
    ctx.fillStyle = "#1c1b19";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, 38);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const h = 0.46;
    const aspect = c.width / c.height;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(h * aspect, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    const width = h * aspect;
    if (maxWidth && width > maxWidth) mesh.scale.setScalar(maxWidth / width);
    return mesh;
  }

  function addLabels(parent, rooms) {
    labelPoints(rooms).forEach((label) => {
      const mesh = makeLabel(label.name, Math.max(1.15, label.w * 0.92));
      mesh.position.set(label.x, 0.05, label.z);
      parent.add(mesh);
    });
  }

  function makeCaption(text) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    c.width = 1024;
    c.height = 128;
    ctx.fillStyle = "#6f6a62";
    ctx.font = '600 64px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "18px";
    ctx.fillText(text, 512, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 0.45),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  function makeStamp() {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    c.width = 640;
    c.height = 280;
    ctx.strokeStyle = "#1e4d3a";
    ctx.lineWidth = 10;
    roundRect(ctx, 16, 16, 608, 248, 28);
    ctx.stroke();
    ctx.fillStyle = "#1e4d3a";
    ctx.textAlign = "center";
    ctx.font = '800 72px "Segoe UI", system-ui, sans-serif';
    ctx.fillText("EDUCATIONAL", 320, 110);
    ctx.font = '650 40px "Segoe UI", system-ui, sans-serif';
    ctx.fillText("NOT FOR CONSTRUCTION", 320, 185);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -0.08;
    mesh.position.set(13.4, 0.06, 9.55);
    return mesh;
  }

  function addOpenings(parent, pieces, wallH) {
    pieces.forEach((piece) => {
      if (piece.kind === "solid" || piece.kind === "void" || piece.kind === "cased") return;
      const len = piece.hi - piece.lo;
      const mid = (piece.lo + piece.hi) / 2;
      const group = new THREE.Group();
      if (piece.axis === "h") group.position.set(mid, 0, piece.fixed);
      else {
        group.position.set(piece.fixed, 0, mid);
        group.rotation.y = Math.PI / 2;
      }
      if (piece.kind === "window") {
        const y = 1.51;
        const h = 1.2;
        const glass = new THREE.Mesh(new THREE.BoxGeometry(len - 0.08, h, 0.03), materials.glass);
        glass.position.y = y;
        const frameT = 0.06;
        const top = new THREE.Mesh(new THREE.BoxGeometry(len, frameT, 0.08), materials.frame);
        top.position.y = y + h / 2;
        const bot = top.clone();
        bot.position.y = y - h / 2;
        const left = new THREE.Mesh(new THREE.BoxGeometry(frameT, h, 0.08), materials.frame);
        left.position.set(-len / 2, y, 0);
        const right = left.clone();
        right.position.x = len / 2;
        [glass, top, bot, left, right].forEach((mesh) => {
          mesh.castShadow = true;
          group.add(mesh);
        });
      } else if (piece.kind === "garage") {
        const door = new THREE.Mesh(new THREE.BoxGeometry(len - 0.08, 2.15, 0.06), materials.garageDoor);
        door.position.y = 1.08;
        door.castShadow = true;
        group.add(door);
        for (let i = 1; i < 4; i += 1) {
          const groove = new THREE.Mesh(new THREE.BoxGeometry(len - 0.16, 0.015, 0.02), materials.ink);
          groove.position.set(0, 0.4 + i * 0.45, 0.04);
          group.add(groove);
        }
      } else if (piece.kind === "slider") {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(len - 0.1, 2.05, 0.04), materials.glass);
        glass.position.y = 1.08;
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.08), materials.frame);
        stile.position.y = 1.08;
        group.add(glass, stile);
      } else {
        const door = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, len - 0.08), 2.05, 0.05), materials.door);
        door.position.y = 1.04;
        door.castShadow = true;
        group.add(door);
      }
      parent.add(group);
    });
  }

  function gable(parent, cx, cz, span, length, eaveY, pitch, ridgeAlong) {
    const overhang = 0.28;
    const half = span / 2;
    const rise = half * pitch;
    const run = half + overhang;
    const fullRise = run * pitch;
    const slopeLen = Math.hypot(run, fullRise);
    const angle = Math.atan2(fullRise, run);
    const midY = eaveY + rise - fullRise / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-half, 0);
    shape.lineTo(half, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const fill = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    fill.translate(0, eaveY, -0.04);
    [-1, 1].forEach((side) => {
      const alongX = ridgeAlong === "x";
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? length + overhang * 2 : slopeLen, 0.12, alongX ? slopeLen : length + overhang * 2),
        materials.roof
      );
      if (alongX) {
        mesh.position.set(cx, midY, cz + side * (run / 2));
        mesh.rotation.x = side * angle;
      } else {
        mesh.position.set(cx + side * (run / 2), midY, cz);
        mesh.rotation.z = side * -angle;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      const end = new THREE.Mesh(fill, materials.gable);
      if (alongX) {
        end.rotation.y = Math.PI / 2;
        end.position.set(cx + side * (length / 2), 0, cz);
      } else {
        end.position.set(cx, 0, cz + side * (length / 2));
        if (side > 0) end.rotation.y = Math.PI;
      }
      end.castShadow = true;
      parent.add(end);
    });
  }

  function pipe(parent, a, b, radius, material) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const dir = end.clone().sub(start);
    const len = dir.length();
    if (len < 0.05) return;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    parent.add(mesh);
  }

  sheet(groundGroup, PLAN_W, PLAN_D);
  sheet(firstGroup, MAIN_W, PLAN_D);
  addPads(groundGroup, GROUND_ROOMS);
  addPads(firstGroup, FIRST_ROOMS);

  const groundPieces = buildPieces(GROUND_ROOMS, OPENINGS.filter((op) => op.floor === 0)).pieces;
  const firstPieces = buildPieces(FIRST_ROOMS, OPENINGS.filter((op) => op.floor === 1)).pieces;
  buildWalls(wallsG, groundPieces, GROUND_ROOMS, GH, materials.wall, materials.wallFront);
  buildWalls(wallsF, firstPieces, FIRST_ROOMS, FH, materials.wall, materials.wallFront);
  buildLiners(insulG, dryG, groundPieces, GROUND_ROOMS, GH);
  const insulF = new THREE.Group();
  const dryF = new THREE.Group();
  buildLiners(insulF, dryF, firstPieces, FIRST_ROOMS, FH);
  buildInk(groundGroup, groundPieces);
  buildInk(firstGroup, firstPieces);
  buildSwings(groundGroup, groundPieces);
  buildSwings(firstGroup, firstPieces);
  addFurniture(groundGroup, 0);
  addFurniture(firstGroup, 1);
  addLabels(namesG, GROUND_ROOMS);
  addLabels(namesF, FIRST_ROOMS);
  addOpenings(openG, groundPieces, GH);
  addOpenings(openF, firstPieces, FH);

  [[16.4, 6.8], [16.4, 10.4], [16.4, 8.6]].forEach(([x, z]) => {
    const geo = new THREE.BoxGeometry(0.14, GH, 0.14);
    geo.translate(0, GH / 2, 0);
    const post = new THREE.Mesh(geo, materials.wall);
    post.position.set(x, 0, z);
    post.castShadow = true;
    wallsG.add(post);
  });

  const slabGeo = new THREE.BoxGeometry(PLAN_W + 0.5, 0.46, PLAN_D + 0.5);
  slabGeo.translate(0, -0.23, 0);
  const slab = new THREE.Mesh(slabGeo, materials.slab);
  slab.position.set(PLAN_W / 2, 0, PLAN_D / 2);
  slab.receiveShadow = true;
  slab.castShadow = true;
  groundGroup.add(slab);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(MAIN_W, 0.16, PLAN_D), materials.slab);
  deck.position.set(MAIN_W / 2, -0.08, PLAN_D / 2);
  deck.castShadow = true;
  deck.receiveShadow = true;
  firstGroup.add(deck);

  gable(roofRoot, MAIN_W / 2, PLAN_D / 2, MAIN_W, PLAN_D, GH + FH, 0.42, "z");
  gable(roofRoot, 13.6, 3.4, 5.6, 6.8, GH, 0.38, "z");
  const patioRoof = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.1, 3.75), materials.roof);
  patioRoof.position.set(13.75, GH - 0.02, 8.6);
  patioRoof.castShadow = true;
  roofRoot.add(patioRoof);

  pipe(mepP, [1.1, 0.15, 9.4], [1.1, 2.35, 9.4], 0.06, materials.pipeC);
  pipe(mepP, [1.35, 0.15, 9.4], [1.35, 2.35, 9.4], 0.05, materials.pipeH);
  pipe(mepP, [1.1, 0.35, 9.4], [5.2, 0.35, 9.4], 0.05, materials.pipeC);
  pipe(mepP, [4.7, 0.15, 1.1], [4.7, 2.2, 1.1], 0.05, materials.pipeC);
  pipe(mepP, [9.6, 0.12, 0.7], [9.6, 2.2, 0.7], 0.07, materials.pipeW);
  pipe(mepP, [9.6, 0.4, 0.7], [12.2, 0.4, 0.7], 0.06, materials.pipeW);
  pipe(mepE, [0.4, 2.45, 1.2], [10.2, 2.45, 1.2], 0.035, materials.elec);
  pipe(mepE, [2.2, 2.45, 1.2], [2.2, 1.3, 1.2], 0.03, materials.elec);
  pipe(mepE, [5.2, 2.45, 8.2], [5.2, 1.2, 8.2], 0.03, materials.elec);
  pipe(mepE, [0.6, GH + 2.2, 8.4], [10.2, GH + 2.2, 8.4], 0.035, materials.elec);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.28, 0.55), materials.hvac);
  trunk.position.set(4.2, 2.35, 6.5);
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.7), materials.hvac);
  riser.position.set(9.2, 0.7, 4.2);
  mepH.add(trunk, riser);
  pipe(mepH, [4.2, 2.35, 6.5], [4.2, GH + 2.15, 6.5], 0.12, materials.hvac);

  FURNITURE.filter((item) => item.floor === 0 && (item.type === "counter" || item.type === "island")).forEach((item) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.9, item.d), materials.cab);
    base.position.set(item.x + item.w / 2, 0.45, item.z + item.d / 2);
    base.castShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.04, 0.04, item.d + 0.04), materials.counter);
    top.position.set(item.x + item.w / 2, 0.92, item.z + item.d / 2);
    cabG.add(base, top);
  });
  const vanity = FURNITURE.find((item) => item.type === "vanity");
  if (vanity) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(vanity.w, 0.8, vanity.d), materials.cab);
    base.position.set(vanity.x + vanity.w / 2, 0.4, vanity.z + vanity.d / 2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(vanity.w + 0.04, 0.04, vanity.d + 0.04), materials.counter);
    top.position.set(vanity.x + vanity.w / 2, 0.82, vanity.z + vanity.d / 2);
    const holder = new THREE.Group();
    holder.add(base, top);
    firstGroup.add(holder);
    holder.name = "vanity";
    firstGroup.userData.vanity = holder;
  }

  const woodRooms = ["entry", "kitchenA", "kitchenB", "family", "hall", "bed2", "bed3", "primary"];
  const tileRooms = ["powder", "laundry", "bath", "nook"];
  [...GROUND_ROOMS, ...FIRST_ROOMS].forEach((room) => {
    const wood = woodRooms.includes(room.id);
    const tile = tileRooms.includes(room.id);
    if (!wood && !tile) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(room.w - 0.12, 0.02, room.d - 0.12),
      wood ? materials.wood : materials.tile
    );
    mesh.position.set(room.x + room.w / 2, 0.02, room.z + room.d / 2);
    mesh.receiveShadow = true;
    (room.x + room.w > 10.9 || FIRST_ROOMS.includes(room) ? (FIRST_ROOMS.includes(room) ? finishG : finishG) : finishG);
    if (FIRST_ROOMS.includes(room)) {
      const host = new THREE.Group();
      host.add(mesh);
      firstGroup.add(host);
      host.userData.finish = true;
    } else {
      mesh.userData.finish = true;
      finishG.add(mesh);
    }
  });

  [[1.8, 1.6, 1.4], [8.6, 1.5, 8.7], [13.6, 1.3, 0.55], [2.4, GH + 1.5, 8.6]].forEach(([x, y, z]) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), materials.punch);
    mesh.position.set(x, y, z);
    punchG.add(mesh);
  });

  const lot = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), materials.lot);
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(8.2, -0.48, 5.2);
  lot.receiveShadow = true;
  const drive = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.04, 4.5), materials.drive);
  drive.position.set(13.6, -0.44, -2.2);
  lotGroup.add(lot, drive);

  const groundCaption = makeCaption("GROUND FLOOR");
  groundCaption.position.set(PLAN_W / 2, 0.04, -0.72);
  const firstCaption = makeCaption("FIRST FLOOR");
  firstCaption.position.set(MAIN_W / 2, 0.04, -0.72);
  namesG.add(groundCaption);
  namesF.add(firstCaption);
  stampGroup.add(makeStamp());

  const dimMat = materials.ink;
  const dimX = new THREE.Mesh(new THREE.BoxGeometry(PLAN_W, 0.012, 0.02), dimMat);
  dimX.position.set(PLAN_W / 2, 0.04, -1.05);
  const dimZ = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, PLAN_D), dimMat);
  dimZ.position.set(-1.05, 0.04, PLAN_D / 2);
  const dimLabel = makeCaption("16.4 m  ·  10.4 m");
  dimLabel.position.set(PLAN_W / 2, 0.05, -1.35);
  dimsGroup.add(dimX, dimZ, dimLabel);

  groundGroup.add(wallsG, namesG, openG, roofRoot, mepP, mepE, mepH, insulG, dryG, finishG, cabG, punchG, stampGroup, dimsGroup);
  firstGroup.add(wallsF, namesF, openF, insulF, dryF);
  scene.add(groundGroup, firstGroup);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.12, 180);

  function narrow() {
    return viewport.clientWidth < 680;
  }

  function spreadOffset(spread) {
    const slide = narrow() ? 0 : (PLAN_W + 1.8) * spread;
    const liftZ = narrow() ? (PLAN_D + 1.55) * spread : 0;
    return { x: slide, y: GH * (1 - spread), z: liftZ };
  }

  function desiredCenter() {
    const off = spreadOffset(state.spread);
    const g = new THREE.Vector3(PLAN_W / 2, 0.6, PLAN_D / 2);
    let f = new THREE.Vector3(MAIN_W / 2 + off.x, off.y + 0.8, PLAN_D / 2 + off.z);
    if (floorFilter === "first" && state.spread < 0.45) f = new THREE.Vector3(MAIN_W / 2, 1.1, PLAN_D / 2);
    if (choreo === "walls") return new THREE.Vector3(8.2, 1.1, PLAN_D / 2);
    if (floorFilter === "ground") return g;
    if (floorFilter === "first") return f;
    if (state.spread < 0.4) return new THREE.Vector3(8.2, 3.4, 5.2);
    return g.clone().lerp(f, 0.5);
  }

  function authored() {
    const stacked = state.spread < 0.4 && floorFilter === "whole";
    const phone = narrow();
    if (choreo === "walls") return { theta: phone ? 2.25 : 2.15, phi: 1.12, radius: phone ? 16 : 14.5 };
    if (viewMode === "top") return { theta: 0.2, phi: 0.18, radius: phone ? 32 : stacked ? 22 : 30 };
    if (floorFilter === "first") return { theta: 2.4, phi: 0.98, radius: phone ? 18 : 16 };
    if (floorFilter === "ground") return { theta: 2.5, phi: 1.0, radius: phone ? 20 : 18 };
    if (stacked) return { theta: phone ? 2.28 : 2.18, phi: phone ? 1.08 : 1.12, radius: phone ? 22 : 19.5 };
    return { theta: phone ? 2.62 : 2.48, phi: phone ? 1.02 : 0.9, radius: phone ? 32 : 27 };
  }

  function applyScene() {
    const off = spreadOffset(state.spread);
    firstGroup.position.set(off.x, off.y, off.z);
    if (floorFilter === "first" && state.spread < 0.45) firstGroup.position.y = 0.04;
    wallsG.scale.y = clamp(state.riseG, 0.001, 1);
    wallsF.scale.y = clamp(state.riseF, 0.001, 1);
    wallsG.visible = state.riseG > 0.025;
    wallsF.visible = state.riseF > 0.025;
    slab.scale.y = clamp(state.slab, 0.001, 1);
    slab.visible = state.slab > 0.03;
    const lift = Math.max(0, state.roof - 1) * 1.15;
    roofRoot.position.y = lift;
    roofRoot.visible = state.roof > 0.08 && floorFilter === "whole" && state.riseG > 0.8;
    openG.visible = state.openings > 0.45 && state.riseG > 0.75;
    openF.visible = state.openings > 0.45 && state.riseF > 0.75;
    namesG.visible = showNames;
    namesF.visible = showNames;
    mepP.visible = state.mepP > 0.08;
    mepE.visible = state.mepE > 0.08;
    mepH.visible = state.mepH > 0.08;
    materials.pipeC.opacity = state.mepP;
    materials.pipeH.opacity = state.mepP;
    materials.pipeW.opacity = state.mepP;
    materials.elec.opacity = state.mepE;
    materials.hvac.opacity = state.mepH;
    [materials.pipeC, materials.pipeH, materials.pipeW, materials.elec, materials.hvac].forEach((mat) => {
      mat.transparent = mat.opacity < 0.96;
    });
    insulG.visible = state.insulation > 0.35 && state.drywall < 0.55;
    insulF.visible = insulG.visible && state.riseF > 0.5;
    dryG.visible = state.drywall > 0.4;
    dryF.visible = state.drywall > 0.4 && state.riseF > 0.5;
    cabG.visible = state.cabinets > 0.4;
    if (firstGroup.userData.vanity) firstGroup.userData.vanity.visible = state.cabinets > 0.4;
    finishG.visible = state.finishes > 0.18;
    firstGroup.traverse((obj) => {
      if (obj.userData?.finish) obj.visible = state.finishes > 0.18;
    });
    materials.wood.opacity = state.finishes;
    materials.tile.opacity = state.tile > 0 ? Math.max(state.tile, state.finishes * 0.8) : state.finishes;
    materials.wood.transparent = materials.wood.opacity < 0.97;
    materials.tile.transparent = materials.tile.opacity < 0.97;
    punchG.visible = state.punch > 0.4;
    lotGroup.visible = state.lot > 0.15;
    stampGroup.visible = state.stamp > 0.35;
    dimsGroup.visible = state.dims > 0.35;
    const cut = state.cutaway > 0.55;
    materials.wallFront.transparent = cut;
    materials.wallFront.opacity = cut ? 0.14 : 1;
    materials.wallFront.depthWrite = !cut;
    groundGroup.visible = floorFilter !== "first";
    firstGroup.visible = floorFilter !== "ground";
    const sided = state.siding > 0.5;
    materials.wall.color.set(sided ? 0xf7f4ef : 0xefe6d8);
    materials.wallFront.color.copy(materials.wall.color);
    statusChip.textContent = currentStatus();
  }

  function resize() {
    const width = Math.max(1, viewport.clientWidth);
    const height = Math.max(1, viewport.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.75 : 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const shadow = width < 700 ? 1024 : 2048;
    if (sun.shadow.mapSize.x !== shadow) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map = null;
    }
    postEmbedHeight();
  }

  const pointers = new Map();
  let pinchDist = 0;
  canvas.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, button: event.button });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 2) pinchDist = distance();
  });
  function distance() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
  canvas.addEventListener("pointermove", (event) => {
    const prev = pointers.get(event.pointerId);
    if (!prev) return;
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, button: prev.button });
    if (pointers.size >= 2) {
      const dist = distance();
      if (pinchDist > 0 && dist > 0) goal.radius = clamp(goal.radius * (pinchDist / dist), 8, 52);
      pinchDist = dist;
      userMoved = true;
      return;
    }
    if (prev.button === 2 || event.shiftKey) {
      const scale = goal.radius * 0.0015;
      const sin = Math.sin(pose.theta);
      const cos = Math.cos(pose.theta);
      goal.tx -= (dx * cos + dy * sin) * scale;
      goal.tz -= (-dx * sin + dy * cos) * scale;
      userMoved = true;
      return;
    }
    goal.theta -= dx * 0.007;
    goal.phi = clamp(goal.phi + dy * 0.005, 0.12, 1.38);
    userMoved = true;
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDist = 0;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      goal.radius = clamp(goal.radius * Math.exp(event.deltaY * 0.0014), 8, 52);
      userMoved = true;
    },
    { passive: false }
  );
  canvas.addEventListener("dblclick", () => {
    goal.radius = clamp(goal.radius * 0.72, 8, 52);
    userMoved = true;
  });

  new ResizeObserver(resize).observe(viewport);
  resize();

  const clockKeys = Object.keys(state);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (choreo === "walls" && state.riseG > 0.9) {
      choreo = "stack";
      Object.assign(target, endState(5));
    }
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 1.35);
    clockKeys.forEach((key) => {
      state[key] += (target[key] - state[key]) * k;
    });
    applyScene();
    const center = desiredCenter();
    if (!userMoved) {
      const shot = authored();
      goal.theta = shot.theta;
      goal.phi = shot.phi;
      goal.radius = shot.radius;
      goal.tx = center.x;
      goal.ty = center.y;
      goal.tz = center.z;
    }
    const ck = reducedMotion ? 1 : 1 - Math.exp(-dt * 3.4);
    Object.keys(pose).forEach((key) => {
      pose[key] += (goal[key] - pose[key]) * ck;
    });
    const sinPhi = Math.sin(pose.phi);
    camera.position.set(
      pose.tx + pose.radius * sinPhi * Math.sin(pose.theta),
      pose.ty + pose.radius * Math.cos(pose.phi),
      pose.tz + pose.radius * sinPhi * Math.cos(pose.theta)
    );
    camera.lookAt(pose.tx, pose.ty, pose.tz);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__buildWalkthrough = {
    setStage,
    replay,
    hold(partial, choreoName = null) {
      choreo = choreoName;
      Object.assign(state, partial);
      Object.assign(target, partial);
      statusChip.textContent = currentStatus();
    },
    get stage() {
      return stageIndex;
    },
    get riseG() {
      return state.riseG;
    },
    get riseF() {
      return state.riseF;
    },
    get spread() {
      return state.spread;
    },
    get roof() {
      return state.roof;
    },
    ready: true,
    webgl: true,
    counts,
  };
  postEmbedHeight();
}
