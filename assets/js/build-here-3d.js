/* Design it in 3D: a small massing sketcher seeded from the Build Here report
   (localStorage "bh3dSeed"), plus a hand-off to Pascal Editor (MIT, pascalorg/editor). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
let seed = null;
try { seed = JSON.parse(localStorage.getItem('bh3dSeed') || 'null'); } catch (e) {}
const demo = !seed || !seed.ring;
if (demo) {
  seed = Object.assign({ address: '', zone: '', lot: 5000, coverage: null, height: null, setbacks: {}, stories: 1 }, seed || {});
  const w = 50, d = (seed.lot || 5000) / 50;
  seed.ring = [[0, 0], [w, 0], [w, d], [0, d], [0, 0]];
}
const KIND = { house: { c: 0xe8dcc8, w: 40, d: 30 }, addition: { c: 0x93c5fd, w: 16, d: 14 }, adu: { c: 0xfcd34d, w: 24, d: 26 }, shop: { c: 0xc4b5fd, w: 24, d: 24 }, deck: { c: 0xa16207, w: 16, d: 12, flat: true } };
const FLOOR = 10;

$('b3-info').textContent = demo
  ? 'No lot loaded yet. Run an address on What can I build here? and use "Open the 3D editor" in the report. Showing a sample ' + fmt(seed.lot) + ' sf lot.'
  : 'Loaded: ' + seed.address + (seed.zone ? ' · zone ' + seed.zone : '') + (seed.lot ? ' · lot ' + fmt(seed.lot) + ' sf' : '') + '.';

// Center the lot
let cx = 0, cy = 0; const pts = seed.ring.slice(0, -1);
pts.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
const P = (x, y) => new THREE.Vector3(x - cx, 0, -(y - cy));
let span = 0; pts.forEach((p) => { span = Math.max(span, Math.hypot(p[0] - cx, p[1] - cy)); });

const host = $('b3-canvas');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1220);
const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
camera.position.set(span * 1.3, span * 1.2, span * 1.5);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(span, span * 2, span * 0.6); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -span * 2, right: span * 2, top: span * 2, bottom: -span * 2 }); sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 8, span * 8), new THREE.MeshLambertMaterial({ color: 0x1f2937 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0] - cx, p[1] - cy)));
const lot = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: 0x3f6212 }));
lot.rotation.x = -Math.PI / 2; lot.receiveShadow = true; scene.add(lot);
scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(seed.ring.map((p) => P(p[0], p[1]).setY(0.1))), new THREE.LineBasicMaterial({ color: 0xffffff })));

// Setback envelope (merged grid rows) and height plane
const envCells = [];
if (seed.env && seed.env.rows) {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, depthWrite: false });
  seed.env.rows.forEach((r) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r[2], r[3]), m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.copy(P(r[0] + r[2] / 2, r[1] + r[3] / 2)).setY(0.05); g.add(mesh);
    envCells.push(r);
  });
  scene.add(g);
  if (seed.height) {
    const hp = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    hp.rotation.x = -Math.PI / 2; hp.position.y = seed.height; scene.add(hp);
  }
}
if (seed.front) {
  const a = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 0).subVectors(P(seed.front.x, seed.front.y), P(cx, cy)).normalize(), P(seed.front.x, seed.front.y).setY(1), 12, 0xfacc15);
  scene.add(a);
}

// Boxes
const boxes = []; let sel = null;
function makeBox(kind, x, z, w, d, floors, rot) {
  const k = KIND[kind];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: k.c, roughness: 0.8 }));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData = { kind, w: w || k.w, d: d || k.d, floors: k.flat ? 0 : (floors || 1), rot: rot || 0 };
  mesh.position.set(x || 0, 0, z || 0);
  scene.add(mesh); boxes.push(mesh); applyBox(mesh); return mesh;
}
function applyBox(b) {
  const u = b.userData, h = u.floors ? u.floors * FLOOR : 1.5;
  b.scale.set(u.w, h, u.d); b.position.y = h / 2; b.rotation.y = -u.rot * Math.PI / 180;
  b.material.emissive = new THREE.Color(b === sel ? 0x334155 : 0x000000);
}
function select(b) {
  sel = b; boxes.forEach(applyBox);
  $('b3-sel').hidden = !b; if (!b) return;
  $('b3-sel-name').textContent = $('b3-kind').querySelector('option[value="' + b.userData.kind + '"]').textContent;
  $('b3-w').value = b.userData.w; $('b3-d').value = b.userData.d; $('b3-f').value = b.userData.floors; $('b3-r').value = b.userData.rot;
  $('b3-f').disabled = !!KIND[b.userData.kind].flat;
}
['w', 'd', 'f', 'r'].forEach((k) => $('b3-' + k).addEventListener('input', () => {
  if (!sel) return; const v = parseFloat($('b3-' + k).value); if (isNaN(v)) return;
  const key = { w: 'w', d: 'd', f: 'floors', r: 'rot' }[k];
  sel.userData[key] = k === 'f' ? Math.max(1, Math.min(4, Math.round(v))) : k === 'r' ? v : Math.max(4, v);
  applyBox(sel); check();
}));
$('b3-add').onclick = () => { select(makeBox($('b3-kind').value, 0, 0)); check(); };
$('b3-del').onclick = () => { if (!sel) return; scene.remove(sel); boxes.splice(boxes.indexOf(sel), 1); select(null); check(); };

// Seed: existing house from the footprint
if (seed.footprint) { const s = Math.sqrt(seed.footprint); makeBox('house', 0, 0, Math.round(s * 1.25), Math.round(s / 1.25), seed.stories || 1); }

// Drag on ground
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let drag = null; const off = new THREE.Vector3();
function setMouse(e) { const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera); }
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return; setMouse(e);
  const hit = ray.intersectObjects(boxes)[0];
  if (hit) { drag = hit.object; select(drag); controls.enabled = false; const p = new THREE.Vector3(); ray.ray.intersectPlane(plane, p); off.subVectors(drag.position, p); renderer.domElement.setPointerCapture(e.pointerId); }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag) return; setMouse(e); const p = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, p)) { drag.position.x = Math.round((p.x + off.x) * 2) / 2; drag.position.z = Math.round((p.z + off.z) * 2) / 2; check(); }
});
renderer.domElement.addEventListener('pointerup', () => { drag = null; controls.enabled = true; });

// Checks: footprint vs coverage cap, height vs limit, corners inside the envelope
function corners(b) {
  const u = b.userData, a = u.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), X = b.position.x + cx, Y = -b.position.z + cy;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [X + (i * u.w / 2) * c - (j * u.d / 2) * s, Y + (i * u.w / 2) * s + (j * u.d / 2) * c]);
}
const inEnv = (x, y) => envCells.some((r) => x >= r[0] - 0.01 && x <= r[0] + r[2] + 0.01 && y >= r[1] - 0.01 && y <= r[1] + r[3] + 0.01);
function check() {
  const roofed = boxes.filter((b) => !KIND[b.userData.kind].flat);
  const foot = roofed.reduce((t, b) => t + b.userData.w * b.userData.d, 0);
  const floor = roofed.reduce((t, b) => t + b.userData.w * b.userData.d * b.userData.floors, 0);
  const tall = roofed.reduce((t, b) => Math.max(t, b.userData.floors * FLOOR), 0);
  const ok = (good, txt) => '<span class="' + (good ? 'b3-ok' : 'b3-bad') + '">' + txt + '</span>';
  const rows = [['Boxes', String(boxes.length)], ['Footprint (roofed)', fmt(foot) + ' sf' + (seed.coverage ? ' of ' + fmt(seed.coverage) + ' sf cap · ' + ok(foot <= seed.coverage, foot <= seed.coverage ? 'within' : 'over by ' + fmt(foot - seed.coverage) + ' sf') : '')], ['Floor area (10 ft floors)', fmt(floor) + ' sf'], ['Tallest box', tall + ' ft' + (seed.height ? ' vs ' + seed.height + ' ft limit · ' + ok(tall <= seed.height, tall <= seed.height ? 'within' : 'over') : '')]];
  if (envCells.length) {
    const out = boxes.filter((b) => corners(b).some((p) => !inEnv(p[0], p[1])));
    rows.push(['Inside setbacks', out.length ? ok(false, out.length + ' box' + (out.length > 1 ? 'es reach' : ' reaches') + ' past the envelope (accessory buildings can have their own setbacks)') : ok(true, 'all boxes inside the envelope')]);
  } else rows.push(['Inside setbacks', 'Setbacks not verified for this lot']);
  $('b3-check').innerHTML = rows.map((r) => '<tr><th scope="row">' + r[0] + '</th><td>' + r[1] + '</td></tr>').join('');
}
check();

function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

// Exports
function dl(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }
$('b3-json').onclick = () => dl('bops-3d-sketch.json', URL.createObjectURL(new Blob([JSON.stringify({ seed, boxes: boxes.map((b) => Object.assign({ x: b.position.x + cx, y: -b.position.z + cy }, b.userData)) }, null, 2)], { type: 'application/json' })));
$('b3-png').onclick = () => dl('bops-3d-sketch.png', renderer.domElement.toDataURL('image/png'));

// Pascal Editor hand-off
function brief() {
  const sb = seed.setbacks || {}, n = (x) => typeof x === 'number' ? x + ' ft' : 'verify';
  const bx = boxes.map((b) => '- ' + b.userData.kind + ': ' + b.userData.w + ' x ' + b.userData.d + ' ft, ' + b.userData.floors + ' floor(s)').join('\n');
  return 'Model a residential lot' + (seed.address ? ' at ' + seed.address : '') + '. Lot outline in feet (x east, y north): ' + JSON.stringify(seed.ring) + '.' +
    (seed.lot ? ' Lot area ' + fmt(seed.lot) + ' sf.' : '') + (seed.zone ? ' Zone ' + seed.zone + '.' : '') +
    ' Setbacks: front ' + n(sb.front) + ', side ' + n(sb.side) + ', rear ' + n(sb.rear) + '.' + (seed.height ? ' Height limit ' + seed.height + ' ft.' : '') +
    (seed.coverage ? ' Lot coverage cap ' + fmt(seed.coverage) + ' sf.' : '') +
    (bx ? '\nPlace these buildings inside the setbacks, with walls, a slab, a roof, doors and windows:\n' + bx : '\nPlace a single-family house inside the setbacks with walls, a slab, a roof, doors and windows.');
}
const tab = (m) => { $('b3-mass').hidden = m !== 'mass'; $('b3-pascal').hidden = m === 'mass'; $('b3-tab-mass').classList.toggle('b3-off', m !== 'mass'); $('b3-tab-pascal').classList.toggle('b3-off', m === 'mass'); $('b3-tab-mass').setAttribute('aria-selected', m === 'mass'); $('b3-tab-pascal').setAttribute('aria-selected', m !== 'mass'); if (m !== 'mass') $('b3-prompt').value = brief(); else resize(); };
$('b3-tab-mass').onclick = () => tab('mass'); $('b3-tab-pascal').onclick = () => tab('pascal');
$('b3-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('b3-prompt').value); $('b3-copy').textContent = 'Copied'; };
$('b3-embed').onclick = () => { $('b3-frame-wrap').innerHTML = '<iframe src="https://editor.pascal.app/" title="Pascal Editor" allow="clipboard-read; clipboard-write; fullscreen; xr-spatial-tracking" loading="lazy"></iframe>' + (navigator.gpu ? '' : '<p class="bh-help">This browser does not report WebGPU, so Pascal may run slowly or not at all. Try current Chrome or Edge on a desktop.</p>'); };
