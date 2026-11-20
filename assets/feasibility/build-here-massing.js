/* Black-and-white massing view for the feasibility study.
   Parcel outline, setback envelope, and building footprints come from the study's own geometry.
   Story count, when the county record has one, is drawn at 10 ft a story and labeled approximate:
   the record does not include an eave height. With no story count the model uses 10 ft and says so.
   Photorealistic map tiles are not requested. google3dTilesKey stays empty, so nothing is spent. */
(function (root) {
  "use strict";
  var STORY_FT = 10;
  var active = null;

  function num(v) { return typeof v === "number" && isFinite(v) ? v : null; }

  function heightFor(role, stories) {
    if (role === "house" && stories) {
      return { ft: stories * STORY_FT, label: "Approximate height: " + stories + " " + (stories === 1 ? "story" : "stories") + " on the county record, drawn at 10 ft a story. The record has no eave height." };
    }
    var what = role === "garage" ? "garage" : role === "house" ? "house" : "accessory building";
    return { ft: STORY_FT, label: "Approximate height: 10 ft for the " + what + ". No eave height is on the county record." };
  }

  /* s: study state. g: lot geometry in feet (ring, er, edges), or null. */
  function spec(s, g) {
    var geo = s && s.landscape && s.landscape.geo;
    var stories = num(s && s.stories);
    var buildings = [];
    var notes = [];
    if (geo && geo.buildings) {
      geo.buildings.forEach(function (b) {
        if (!b || !b.ring || b.ring.length < 3 || b.role === "neighbor") return;
        var h = heightFor(b.role || "other", stories);
        buildings.push({ ring: b.ring, role: b.role || "other", heightFt: h.ft, label: h.label });
        if (notes.indexOf(h.label) < 0) notes.push(h.label);
        buildings[buildings.length - 1].eaveFt = h.ft;
        buildings[buildings.length - 1].roofMode = "conceptual";
      });
    }
    var src = geo && geo.src && geo.src.buildings ? geo.src.buildings : "";
    if (!buildings.length) notes.push("No building footprint was in the public layers for this lot, so no house mass is drawn.");
    else notes.unshift("Footprint: " + (src || "the mapped building outline on this lot") + ".");
    var dem = geo && (geo.demFine || geo.dem);
    if (!dem || !dem.vals) notes.push("Ground is flat in this view: the elevation grid was not available.");
    else notes.push("Ground uses the elevation samples already read for the slope table.");
    if (buildings.some(function (b) { return b.roofMode === "conceptual"; })) notes.push("Roof: conceptual constant-pitch gable over the footprint. Pitch is not measured.");
    return {
      lot: g && g.ring ? g.ring : (geo && geo.lot && geo.lot[0]) || null,
      envelope: g && g.er && g.er.rings ? g.er.rings : null,
      edges: g && g.edges ? g.edges : [],
      buildings: buildings,
      frame: geo && geo.frame ? geo.frame : null,
      dem: dem && dem.vals ? dem : null,
      caption: notes.join(" ")
    };
  }

  function ringShape(THREE, ring) {
    var shape = new THREE.Shape();
    var n = ring.length;
    var last = ring[n - 1], first = ring[0];
    var end = last && first && last[0] === first[0] && last[1] === first[1] ? n - 1 : n;
    for (var i = 0; i < end; i++) {
      if (i === 0) shape.moveTo(ring[i][0], ring[i][1]);
      else shape.lineTo(ring[i][0], ring[i][1]);
    }
    return shape;
  }

  function extrude(THREE, ring, height, material) {
    var geo = new THREE.ExtrudeGeometry(ringShape(THREE, ring), { depth: height, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 0);
    material.polygonOffset = true;
    material.polygonOffsetFactor = 1;
    material.polygonOffsetUnits = 1;
    var mesh = new THREE.Mesh(geo, material);
    var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 15), new THREE.LineBasicMaterial({ color: 0x222222 }));
    edges.renderOrder = 2;
    mesh.add(edges);
    return mesh;
  }

  function ground(THREE, dem) {
    var nx = dem.nx, ny = dem.ny, step = dem.step;
    var min = Infinity;
    dem.vals.forEach(function (v) { if (typeof v === "number" && v < min) min = v; });
    if (!isFinite(min)) min = 0;
    var geo = new THREE.PlaneGeometry((nx - 1) * step, (ny - 1) * step, nx - 1, ny - 1);
    var pos = geo.attributes.position;
    for (var j = 0; j < ny; j++) {
      /* PlaneGeometry row 0 rotates to north. The grid's first row is the south edge, so the index is flipped. */
      var iy = ny - 1 - j;
      for (var i = 0; i < nx; i++) {
        var v = dem.vals[j * nx + i];
        var elev = typeof v === "number" ? v - min : 0;
        pos.setZ(iy * nx + i, elev);
      }
    }
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xe8e8e8, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(dem.x0 + (nx - 1) * step / 2, 0, -(dem.y0 + (ny - 1) * step / 2));
    return mesh;
  }

  /* Height of the elevation grid above its lowest sample, in feet, at a plan point. */
  function demSampler(dem) {
    if (!dem || !dem.vals || !dem.step) return function () { return 0; };
    var min = Infinity;
    dem.vals.forEach(function (v) { if (typeof v === "number" && v < min) min = v; });
    if (!isFinite(min)) min = 0;
    var fn = function (x, y) {
      var fx = (x - dem.x0) / dem.step, fy = (y - dem.y0) / dem.step;
      var i = Math.max(0, Math.min(dem.nx - 2, Math.floor(fx)));
      var j = Math.max(0, Math.min(dem.ny - 2, Math.floor(fy)));
      var tx = Math.max(0, Math.min(1, fx - i)), ty = Math.max(0, Math.min(1, fy - j));
      var a = dem.vals[j * dem.nx + i], b = dem.vals[j * dem.nx + i + 1];
      var c = dem.vals[(j + 1) * dem.nx + i], d = dem.vals[(j + 1) * dem.nx + i + 1];
      var nums = [a, b, c, d].filter(function (u) { return typeof u === "number" && isFinite(u); });
      if (nums.length < 4) return (nums.length ? nums[0] : min) - min;
      return (a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty) - min;
    };
    fn.min = min;
    return fn;
  }
  function subdivideRing(ring, maxSeg) {
    var out = [];
    for (var i = 0; i < ring.length; i++) {
      var a = ring[i], b = ring[(i + 1) % ring.length];
      if (!a || !b) continue;
      out.push(a);
      if (i === ring.length - 1 && ring[0] && a[0] === ring[0][0] && a[1] === ring[0][1]) break;
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var steps = Math.max(1, Math.ceil(len / (maxSeg || 3)));
      for (var s = 1; s < steps; s++) out.push([a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps]);
    }
    if (out.length) out.push(out[0].slice());
    return out;
  }

  function loopLine(THREE, ring, lift, dashed) {
    var pts = subdivideRing(ring, 3).map(function (p) {
      var y = typeof lift === "function" ? lift(p[0], p[1]) : lift;
      return new THREE.Vector3(p[0], y + 0.35, -p[1]);
    });
    if (pts.length && (pts[0].x !== pts[pts.length - 1].x || pts[0].z !== pts[pts.length - 1].z)) pts.push(pts[0].clone());
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var mat = dashed ? new THREE.LineDashedMaterial({ color: 0x111111, dashSize: 4, gapSize: 2 }) : new THREE.LineBasicMaterial({ color: 0x111111 });
    var line = new THREE.Line(geo, mat);
    if (dashed && line.computeLineDistances) line.computeLineDistances();
    return line;
  }

  function insideRing(x, y, ring) {
    var n = ring.length, c = false;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var yi = ring[i][1], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (ring[j][0] - ring[i][0]) * (y - yi) / ((yj - yi) || 1e-9) + ring[i][0]) c = !c;
    }
    return c;
  }
  function roofHeightAt(x, y, b) {
    var eave = b.eaveFt || b.heightFt || 10;
    var planes = (b.roofPlanes || []).filter(function (p) { return p.heightFt != null && p.cx != null; });
    if (planes.length) {
      var best = eave, bestD = Infinity;
      planes.forEach(function (p) {
        var az = (p.azimuth || 0) * Math.PI / 180;
        var dx = x - p.cx, dy = y - p.cy;
        var along = dx * Math.sin(az) + dy * Math.cos(az);
        var h = p.heightFt - along * Math.tan((p.pitch || 0) * Math.PI / 180);
        var dist = dx * dx + dy * dy;
        if (dist < bestD) { bestD = dist; best = h; }
      });
      return Math.max(6, best);
    }
    var cx = 0, cy = 0, n = 0, ang = 0, bestLen = 0;
    b.ring.forEach(function (p) { cx += p[0]; cy += p[1]; n++; });
    cx /= n || 1; cy /= n || 1;
    for (var i = 0; i < b.ring.length - 1; i++) {
      var len = Math.hypot(b.ring[i + 1][0] - b.ring[i][0], b.ring[i + 1][1] - b.ring[i][1]);
      if (len > bestLen) { bestLen = len; ang = Math.atan2(b.ring[i + 1][1] - b.ring[i][1], b.ring[i + 1][0] - b.ring[i][0]); }
    }
    var px = Math.cos(ang + Math.PI / 2), py = Math.sin(ang + Math.PI / 2);
    var lo = Infinity, hi = -Infinity;
    b.ring.forEach(function (p) { var t = (p[0] - cx) * px + (p[1] - cy) * py; lo = Math.min(lo, t); hi = Math.max(hi, t); });
    var t = (x - cx) * px + (y - cy) * py, half = Math.max(4, (hi - lo) / 2), mid = (hi + lo) / 2;
    return eave + Math.max(0, half - Math.abs(t - mid)) * Math.tan(26.5 * Math.PI / 180);
  }
  function roofMesh(THREE, b, floorY) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    b.ring.forEach(function (p) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });
    var nx = Math.max(2, Math.ceil((maxX - minX) / 2.5)), ny = Math.max(2, Math.ceil((maxY - minY) / 2.5));
    var grid = [];
    for (var j = 0; j <= ny; j++) {
      grid[j] = [];
      for (var i = 0; i <= nx; i++) {
        var x = minX + (maxX - minX) * i / nx, y = minY + (maxY - minY) * j / ny;
        grid[j][i] = insideRing(x, y, b.ring) ? [x, floorY + roofHeightAt(x, y, b), -y] : null;
      }
    }
    var pos = [], idx = [], id = [], next = 0;
    function vid(i, j) { var k = j + "," + i; if (id[k] == null) { id[k] = next++; pos.push(grid[j][i][0], grid[j][i][1], grid[j][i][2]); } return id[k]; }
    for (var j2 = 0; j2 < ny; j2++) for (var i2 = 0; i2 < nx; i2++) {
      var q = [grid[j2][i2], grid[j2][i2 + 1], grid[j2 + 1][i2], grid[j2 + 1][i2 + 1]];
      if (q.some(function (p) { return !p; })) continue;
      var a = vid(i2, j2), b2 = vid(i2 + 1, j2), c = vid(i2, j2 + 1), d = vid(i2 + 1, j2 + 1);
      idx.push(a, b2, d, a, d, c);
    }
    if (!idx.length) return null;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x5c5c5c, side: THREE.DoubleSide }));
    mesh.castShadow = true;
    mesh.name = "roof";
    return mesh;
  }

  function mount(container, model) {
    dispose();
    var THREE = root.THREE;
    if (!THREE || !container || !model || !model.lot) return null;
    var canvas = document.createElement("canvas");
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    } catch (e) {
      return null;
    }
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 1);
    container.innerHTML = "";
    container.appendChild(canvas);
    var scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8e8e8e, 0.9));
    var sun = new THREE.DirectionalLight(0xffffff, 0.55);
    sun.position.set(60, 120, 30);
    scene.add(sun);
    var at = demSampler(model.dem);
    if (model.dem) scene.add(ground(THREE, model.dem));
    var lift = function (x, y) { return at(x, y) + 0.45; };
    scene.add(loopLine(THREE, model.lot, lift, false));
    (model.envelope || []).forEach(function (ring) { if (ring && ring.length > 2) scene.add(loopLine(THREE, ring, lift, true)); });
    var wall = { house: 0xf4f4f4, garage: 0xcfcfcf, other: 0xe4e4e4 };
    var roofs = [], walls = [], roomMeshes = [];
    model.buildings.forEach(function (b) {
      var lo = Infinity, hi = -Infinity, sum = 0, n = 0;
      b.ring.forEach(function (p) { var z = at(p[0], p[1]); lo = Math.min(lo, z); hi = Math.max(hi, z); sum += z; n++; });
      if (!n) { lo = 0; hi = 0; sum = 0; n = 1; }
      var floorY = sum / n;
      var skirt = Math.max(0.6, floorY - lo + 1.2);
      var plinth = extrude(THREE, b.ring, skirt, new THREE.MeshLambertMaterial({ color: 0x8a8a8a }));
      plinth.position.y = lo - 1.2;
      scene.add(plinth);
      var mesh = extrude(THREE, b.ring, b.eaveFt || b.heightFt || 10, new THREE.MeshLambertMaterial({ color: wall[b.role] || 0xdedede }));
      mesh.position.y = floorY;
      scene.add(mesh);
      walls.push(mesh);
      var roof = roofMesh(THREE, b, floorY);
      if (roof) { roof.position.y = 0; scene.add(roof); roofs.push(roof); }
    });
    if (model.interior && model.interior.levels) {
      model.interior.levels.forEach(function (lv, li) {
        lv.rooms.forEach(function (r) {
          var geo = new THREE.BoxGeometry(Math.max(0.4, r.w * 0.9), r.stairs ? 8 : 0.2, Math.max(0.4, r.d * 0.9));
          var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: r.addition ? 0xd8d8d8 : 0xfbfbfb }));
          mesh.position.set(r.x + r.w / 2, (li * 10) + 0.3, -(r.y + r.d / 2));
          mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x222222 })));
          mesh.userData.room = r;
          mesh.userData.level = lv.name;
          mesh.visible = false;
          scene.add(mesh);
          roomMeshes.push(mesh);
        });
      });
    }
    /* Frame the parcel and the buildings. The elevation grid is larger than the lot and would push the camera too far back. */
    var box = new THREE.Box3();
    function grow(ring, y) {
      (ring || []).forEach(function (p) {
        if (p && typeof p[0] === "number") box.expandByPoint(new THREE.Vector3(p[0], y || 0, -p[1]));
      });
    }
    var peak = 0;
    if (model.dem && model.dem.vals) {
      var lo = Infinity;
      model.dem.vals.forEach(function (v) { if (typeof v === "number" && v < lo) lo = v; });
      model.dem.vals.forEach(function (v) { if (typeof v === "number") peak = Math.max(peak, v - lo); });
    }
    grow(model.lot, peak);
    (model.buildings || []).forEach(function (b) { grow(b.ring, (b.heightFt || 10) + peak); });
    if (box.isEmpty()) box.setFromObject(scene);
    var center = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());
    var radius = Math.max(8, 0.5 * Math.hypot(size.x, size.y, size.z));
    var camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, Math.max(400, radius * 30));
    var target = center.clone();
    var fit = radius / Math.sin((38 * Math.PI / 180) / 2);
    var sph = { r: fit / 0.72, theta: 0.65, phi: 1.02 };
    function place() {
      camera.position.set(
        target.x + sph.r * Math.sin(sph.phi) * Math.sin(sph.theta),
        target.y + sph.r * Math.cos(sph.phi),
        target.z + sph.r * Math.sin(sph.phi) * Math.cos(sph.theta)
      );
      camera.lookAt(target);
    }
    function sizeCanvas() {
      var w = Math.max(320, container.clientWidth || 640);
      var h = Math.max(240, Math.round(w * 9 / 16));
      renderer.setSize(w, h, false);
      canvas.style.width = "100%";
      canvas.style.height = h + "px";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    function draw() { renderer.render(scene, camera); }
    sizeCanvas();
    place();
    draw();
    var pointers = {};
    function ids() { return Object.keys(pointers); }
    canvas.addEventListener("pointerdown", function (e) {
      canvas.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener("pointerup", function (e) { delete pointers[e.pointerId]; });
    canvas.addEventListener("pointercancel", function (e) { delete pointers[e.pointerId]; });
    canvas.addEventListener("pointermove", function (e) {
      var prev = pointers[e.pointerId];
      if (!prev) return;
      var list = ids();
      if (list.length < 2) {
        sph.theta -= (e.clientX - prev.x) * 0.01;
        sph.phi = Math.max(0.25, Math.min(1.35, sph.phi + (e.clientY - prev.y) * 0.008));
      } else {
        var other = pointers[list.filter(function (id) { return id !== String(e.pointerId); })[0]];
        if (other) {
          var before = Math.hypot(prev.x - other.x, prev.y - other.y);
          var after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
          if (before > 0) sph.r = Math.max(fit * 0.35, Math.min(fit * 2.4, sph.r * (before / after)));
        }
      }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      place();
      draw();
    });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      sph.r = Math.max(fit * 0.35, Math.min(fit * 2.4, sph.r * (e.deltaY > 0 ? 1.08 : 0.92)));
      place();
      draw();
    }, { passive: false });
    function snapshot() {
      var saved = { pos: camera.position.clone(), aspect: camera.aspect, w: canvas.width, h: canvas.height };
      renderer.setSize(1100, 620, false);
      camera.aspect = 1100 / 620;
      camera.updateProjectionMatrix();
      var dist = fit / 0.72;
      camera.position.set(center.x + dist * 0.55, center.y + dist * 0.5, center.z + dist * 0.66);
      camera.lookAt(center);
      draw();
      var url = "";
      try { url = canvas.toDataURL("image/png"); } catch (err) { url = ""; }
      renderer.setSize(saved.w, saved.h, false);
      camera.aspect = saved.aspect;
      camera.position.copy(saved.pos);
      camera.updateProjectionMatrix();
      draw();
      return url;
    }
    var mode = "existing", floor = "All", roofOn = true;
    function applyVis() {
      roofs.forEach(function (r) { r.visible = roofOn && mode !== "google"; });
      walls.forEach(function (m) { m.visible = mode !== "interior"; });
      roomMeshes.forEach(function (m) { m.visible = mode === "interior" && (floor === "All" || m.userData.level === floor); });
    }
    var ray = new THREE.Raycaster();
    canvas.addEventListener("click", function (e) {
      if (mode !== "interior") return;
      var rec = canvas.getBoundingClientRect();
      var ndc = new THREE.Vector2(((e.clientX - rec.left) / rec.width) * 2 - 1, -((e.clientY - rec.top) / rec.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hit = ray.intersectObjects(roomMeshes, true)[0];
      var obj = hit && hit.object;
      while (obj && !obj.userData.room) obj = obj.parent;
      if (obj && obj.userData.room && model.onRoom) model.onRoom(obj.userData.room);
    });
    canvas.tabIndex = 0;
    canvas.addEventListener("keydown", function (e) {
      var k = e.key;
      if (k === "ArrowLeft") sph.theta -= 0.12;
      else if (k === "ArrowRight") sph.theta += 0.12;
      else if (k === "ArrowUp") sph.phi = Math.max(0.25, sph.phi - 0.08);
      else if (k === "ArrowDown") sph.phi = Math.min(1.35, sph.phi + 0.08);
      else if (k === "+" || k === "=") sph.r = Math.max(fit * 0.35, sph.r * 0.92);
      else if (k === "-" || k === "_") sph.r = Math.min(fit * 2.4, sph.r * 1.08);
      else return;
      e.preventDefault();
      place();
      draw();
    });
    active = { renderer: renderer, dispose: function () { renderer.dispose(); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); } };
    return {
      snapshot: snapshot,
      caption: model.caption,
      setRoof: function (on) { roofOn = !!on; applyVis(); draw(); },
      setFloor: function (name) { floor = name || "All"; applyVis(); draw(); },
      setMode: function (next) { mode = next || "existing"; applyVis(); draw(); },
      canvas: canvas
    };
  }

  function dispose() {
    if (active) { try { active.dispose(); } catch (e) {} active = null; }
  }

  /* A configured key must not place a tile request. This build does not call a tile service. */
  function photorealActive(cfg) {
    var key = cfg && String(cfg.google3dTilesKey || "").trim();
    return !!key && false;
  }

  var api = { spec: spec, mount: mount, dispose: dispose, photorealActive: photorealActive, STORY_FT: STORY_FT };
  root.BuildHereMassing = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
