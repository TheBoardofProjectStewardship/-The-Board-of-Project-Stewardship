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
      });
    }
    var src = geo && geo.src && geo.src.buildings ? geo.src.buildings : "";
    if (!buildings.length) notes.push("No building footprint was in the public layers for this lot, so no house mass is drawn.");
    else notes.unshift("Footprint: " + (src || "the mapped building outline on this lot") + ".");
    var dem = geo && (geo.demFine || geo.dem);
    if (!dem || !dem.vals) notes.push("Ground is flat in this view: the elevation grid was not available.");
    else notes.push("Ground uses the elevation samples already read for the slope table.");
    return {
      lot: g && g.ring ? g.ring : (geo && geo.lot && geo.lot[0]) || null,
      envelope: g && g.er && g.er.rings ? g.er.rings : null,
      edges: g && g.edges ? g.edges : [],
      buildings: buildings,
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
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var v = dem.vals[j * nx + i];
      var elev = typeof v === "number" ? v - min : 0;
      pos.setZ(j * nx + i, elev);
    }
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xd5d5d5, side: THREE.DoubleSide }));
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
    return function (x, y) {
      var i = Math.round((x - dem.x0) / dem.step);
      var j = Math.round((y - dem.y0) / dem.step);
      if (i < 0 || j < 0 || i >= dem.nx || j >= dem.ny) return 0;
      var v = dem.vals[j * dem.nx + i];
      return (typeof v === "number" ? v : min) - min;
    };
  }

  function loopLine(THREE, ring, lift, dashed) {
    var pts = ring.map(function (p) {
      var y = typeof lift === "function" ? lift(p[0], p[1]) : lift;
      return new THREE.Vector3(p[0], y, -p[1]);
    });
    if (pts.length && (pts[0].x !== pts[pts.length - 1].x || pts[0].z !== pts[pts.length - 1].z)) pts.push(pts[0].clone());
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var mat = dashed ? new THREE.LineDashedMaterial({ color: 0x111111, dashSize: 4, gapSize: 2 }) : new THREE.LineBasicMaterial({ color: 0x111111 });
    var line = new THREE.Line(geo, mat);
    if (dashed && line.computeLineDistances) line.computeLineDistances();
    return line;
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
    renderer.setClearColor(0xf3f3f3, 1);
    container.innerHTML = "";
    container.appendChild(canvas);
    var scene = new THREE.Scene();
    var at = demSampler(model.dem);
    if (model.dem) scene.add(ground(THREE, model.dem));
    var lift = function (x, y) { return at(x, y) + 0.8; };
    scene.add(loopLine(THREE, model.lot, lift, false));
    (model.envelope || []).forEach(function (ring) { if (ring && ring.length > 2) scene.add(loopLine(THREE, ring, lift, true)); });
    (model.edges || []).forEach(function (e) {
      if (!e || !e.a || !e.b) return;
      scene.add(loopLine(THREE, [e.a, e.b], lift, true));
    });
    var wall = { house: 0xc4c4c4, garage: 0x8e8e8e, other: 0xa3a3a3 };
    model.buildings.forEach(function (b) {
      var mat = new THREE.MeshBasicMaterial({ color: wall[b.role] || 0xaaaaaa });
      var mesh = extrude(THREE, b.ring, b.heightFt, mat);
      var c = [0, 0], n = 0;
      b.ring.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; n++; });
      if (n) { c[0] /= n; c[1] /= n; mesh.position.y = at(c[0], c[1]); }
      scene.add(mesh);
      (b.roofPlanes || []).forEach(function (plane) {
        var c = [0, 0], n = 0;
        b.ring.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; n++; });
        if (!n) return;
        c[0] /= n; c[1] /= n;
        var geo = new THREE.PlaneGeometry(Math.max(8, b.heightFt), Math.max(8, b.heightFt));
        geo.rotateX(-Math.PI / 2 - (plane.pitch || 0) * Math.PI / 180);
        var roof = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: true }));
        roof.position.set(c[0], (plane.heightFt || b.heightFt) + at(c[0], c[1]), -c[1]);
        roof.rotation.y = (plane.azimuth || 0) * Math.PI / 180;
        scene.add(roof);
      });
    });
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
    var radius = Math.max(size.x, size.y, size.z, 40);
    var camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, radius * 20);
    var target = center.clone();
    var sph = { r: radius * 1.7, theta: 0.7, phi: 1.05 };
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
          if (before > 0) sph.r = Math.max(radius * 0.4, Math.min(radius * 6, sph.r * (before / after)));
        }
      }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      place();
      draw();
    });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      sph.r = Math.max(radius * 0.4, Math.min(radius * 6, sph.r * (e.deltaY > 0 ? 1.08 : 0.92)));
      place();
      draw();
    }, { passive: false });
    function snapshot() {
      var saved = { pos: camera.position.clone(), aspect: camera.aspect, w: canvas.width, h: canvas.height };
      renderer.setSize(1100, 620, false);
      camera.aspect = 1100 / 620;
      camera.updateProjectionMatrix();
      var iso = radius * 1.35;
      camera.position.set(center.x + iso, center.y + iso * 0.85, center.z + iso);
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
    active = { renderer: renderer, dispose: function () { renderer.dispose(); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); } };
    return { snapshot: snapshot, caption: model.caption };
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
