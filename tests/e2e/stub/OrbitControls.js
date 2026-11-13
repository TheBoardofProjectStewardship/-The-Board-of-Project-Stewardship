// Test stand-in for three's OrbitControls. It never moves the camera, so it never fires "change".
export class OrbitControls { constructor(camera, dom) { this.enabled = true; this.listeners = {}; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); } update() { return false; } }
