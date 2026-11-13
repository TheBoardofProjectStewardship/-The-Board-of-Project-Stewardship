// Test stand-in for three.js. It has the API surface the massing sketch uses and draws nothing.
// The real library is loaded from a CDN that this test machine cannot reach.
export class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } setY(y) { this.y = y; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
  normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; this.x /= l; this.y /= l; this.z /= l; return this; } }
export class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
export class Color { constructor(h) { this.hex = h; } }
class Obj { constructor() { this.position = new Vector3(); this.rotation = { x: 0, y: 0, z: 0 }; this.scale = new Vector3(1, 1, 1); this.children = []; this.userData = {}; }
  add(o) { this.children.push(o); return this; } remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); return this; } }
export class Scene extends Obj {}
export class Group extends Obj {}
export class Mesh extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class Line extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class ArrowHelper extends Obj {}
export class PerspectiveCamera extends Obj { constructor(f, a) { super(); this.aspect = a; } updateProjectionMatrix() {} }
export class HemisphereLight extends Obj {}
export class DirectionalLight extends Obj { constructor() { super(); this.shadow = { camera: {}, mapSize: new Vector2() }; } }
class Geo { constructor(...a) { this.args = a; } setFromPoints(p) { this.points = p; return this; } }
export class PlaneGeometry extends Geo {}
export class ShapeGeometry extends Geo {}
export class BoxGeometry extends Geo {}
export class BufferGeometry extends Geo {}
export class Shape { constructor(p) { this.points = p; } }
class Mat { constructor(o) { Object.assign(this, o || {}); } }
export class MeshLambertMaterial extends Mat {}
export class MeshBasicMaterial extends Mat {}
export class MeshStandardMaterial extends Mat {}
export class LineBasicMaterial extends Mat {}
export class Plane { constructor(n, c) { this.normal = n; this.constant = c; } }
export class Raycaster { constructor() { this.ray = { intersectPlane() { return null; } }; } setFromCamera() {} intersectObjects() { return []; } }
export const DoubleSide = 2;
export class WebGLRenderer {
  constructor() {
    if (window.__noWebGL) throw new Error("Error creating WebGL context.");
    this.domElement = document.createElement("canvas"); this.shadowMap = {}; window.__renders = 0;
  }
  setPixelRatio() {} setSize(w, h) { this.domElement.width = w; this.domElement.height = h; }
  render() { window.__renders++; }
  setAnimationLoop(fn) { const tick = () => { fn(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
}
