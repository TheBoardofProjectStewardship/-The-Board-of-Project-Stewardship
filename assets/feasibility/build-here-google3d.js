/* Optional Google layer for the feasibility study. Nothing here runs unless
   BuildHereConfig.googleMapsKey is a non-empty string. No key is shipped.
   List prices used for the $50 cap (first paid tier, USD per event, Nov 2026 price list):
     Immersive Maps, SKU for Map3DElement. Billable event is one successful
     map load. 5,000 free per month, then $7 / 1,000 = $0.007. This is not
     the Map Tiles API. Map3DElement does not reserve a per-tile charge.
     Solar API Building Insights (one findClosest) $10 / 1,000 = $0.010
     Elevation API (one request)                $5 / 1,000 = $0.005
     Map Tiles API Photorealistic 3D Tiles applies only to a direct tiles
     request (Cesium or the Map Tiles API). This page does not make one.
     If it did, one root tileset request covers up to a 3-hour session
     at $6 / 1,000 = $0.006. It is not billed per tile and not at $1.00.
   A cached address makes none of these calls again. */
(function (root) {
  "use strict";
  var CAP = 50;
  var STORY_FT = 10;
  var PRICE = { mapLoad: 0.007, solar: 0.01, elevation: 0.005, tilesRoot: 0.006 };
  var M_TO_FT = 3.280839895;

  function store() {
    try { return root.localStorage; } catch (e) { return null; }
  }
  function monthKey() { return new Date().toISOString().slice(0, 7); }
  function ledger() {
    var ls = store(), month = monthKey(), empty = { month: month, usd: 0 };
    if (!ls) return empty;
    try {
      var o = JSON.parse(ls.getItem("bhGoogleSpend") || "null");
      if (!o || o.month !== month || typeof o.usd !== "number") return empty;
      return o;
    } catch (e) { return empty; }
  }
  function saveLedger(o) {
    var ls = store();
    if (!ls) return;
    try { ls.setItem("bhGoogleSpend", JSON.stringify(o)); } catch (e) {}
  }
  function spent() { return ledger().usd; }
  function canSpend(usd) { return spent() + usd <= CAP + 1e-9; }
  function charge(usd) {
    var o = ledger();
    o.usd = Math.round((o.usd + usd) * 1000) / 1000;
    saveLedger(o);
    return o.usd;
  }
  function cacheGet(kind, lat, lon) {
    var ls = store();
    if (!ls) return null;
    try { return JSON.parse(ls.getItem("bhG|" + kind + "|" + lat.toFixed(5) + "|" + lon.toFixed(5)) || "null"); }
    catch (e) { return null; }
  }
  function cacheSet(kind, lat, lon, value) {
    var ls = store();
    if (!ls) return;
    try { ls.setItem("bhG|" + kind + "|" + lat.toFixed(5) + "|" + lon.toFixed(5), JSON.stringify(value)); } catch (e) {}
  }

  /* Calls a fresh model would make. Cached hits are zeros. */
  function callsFor(opts) {
    opts = opts || {};
    var map = opts.hasKey && !opts.mapCached ? 1 : 0;
    var solar = opts.hasKey && !opts.solarCached ? 1 : 0;
    var elevation = opts.hasKey && opts.needsElevation && !opts.elevationCached ? 1 : 0;
    /* A direct Map Tiles / Cesium root request, only when that path is actually used. */
    var tilesRoot = opts.directTilesRoot && !opts.tilesCached ? 1 : 0;
    var usd = map * PRICE.mapLoad + solar * PRICE.solar + elevation * PRICE.elevation + tilesRoot * PRICE.tilesRoot;
    return { map: map, solar: solar, elevation: elevation, tilesRoot: tilesRoot, usd: Math.round(usd * 1000) / 1000 };
  }

  function keyOf(cfg) { return cfg && String(cfg.googleMapsKey || "").trim(); }

  var inFlightUsd = 0;
  function reserve(usd) {
    if (spent() + inFlightUsd + usd > CAP + 1e-9) return false;
    inFlightUsd = Math.round((inFlightUsd + usd) * 1000) / 1000;
    return true;
  }
  function release(usd, commit) {
    inFlightUsd = Math.max(0, Math.round((inFlightUsd - usd) * 1000) / 1000);
    if (commit) charge(usd);
  }
  function groundFt(spec, s) {
    var dem = spec && spec.dem;
    var house = spec && spec.buildings && spec.buildings.filter(function (b) { return b.role === "house"; })[0];
    var G = root.BuildHereGeom;
    if (dem && dem.vals && dem.step && house && house.ring && G && G.bilinear && G.centroid) {
      var c = G.centroid(house.ring);
      var atHouse = G.bilinear(dem, c[0], c[1]);
      if (typeof atHouse === "number" && isFinite(atHouse)) return atHouse;
    }
    if (dem && dem.vals && dem.vals.length) {
      var sum = 0, n = 0;
      dem.vals.forEach(function (v) { if (typeof v === "number" && isFinite(v)) { sum += v; n++; } });
      if (n) return sum / n;
    }
    if (s && typeof s.googleGroundFt === "number" && isFinite(s.googleGroundFt)) return s.googleGroundFt;
    if (s && s.landscape && s.landscape.slope && typeof s.landscape.slope.elevMin === "number") {
      var hi = typeof s.landscape.slope.elevMax === "number" ? s.landscape.slope.elevMax : s.landscape.slope.elevMin;
      return (s.landscape.slope.elevMin + hi) / 2;
    }
    return null;
  }

  function applySolar(spec, solar, s) {
    var segs = solar && solar.solarPotential && solar.solarPotential.roofSegmentStats;
    if (!segs || !segs.length) return spec;
    var ground = groundFt(spec, s);
    var pitches = [];
    var heights = [];
    segs.forEach(function (seg) {
      if (typeof seg.pitchDegrees === "number") pitches.push(Math.round(seg.pitchDegrees * 10) / 10);
      if (ground != null && typeof seg.planeHeightAtCenterMeters === "number") {
        var above = seg.planeHeightAtCenterMeters * M_TO_FT - ground;
        if (above >= 8 && above <= 75) heights.push(above);
      }
    });
    var pitched = pitches.filter(function (p) { return p >= 5; }).length;
    var flat = pitches.length - pitched;
    var note = "Roof: " + segs.length + " plane" + (segs.length === 1 ? "" : "s") + " from Google Solar API buildingInsights (" + pitched + " pitched, " + flat + " under 5 degrees).";
    spec.caption = (spec.caption || "").replace(/ Approximate height:.*?The record has no eave height\./g, "").replace(/ Height \d+ ft \(\d+ stor(?:y|ies)\) from Google Solar API buildingInsights\./g, "").replace(/ Roof: \d+ plane[\s\S]*$/, "").replace(/\s+$/, "");
    if (heights.length) {
      var ridge = Math.round(Math.max.apply(null, heights));
      var eave = Math.max(8, Math.min(ridge - 2, Math.round(Math.min.apply(null, heights) - 2)));
      var countyStories = s && typeof s.stories === "number" && s.stories > 0 ? s.stories : null;
      var stories = countyStories || Math.max(1, Math.round(eave / STORY_FT));
      var fr = spec.frame && root.BuildHereGeom && root.BuildHereGeom.frame ? root.BuildHereGeom.frame(spec.frame.lat0, spec.frame.lon0) : null;
      var planes = segs.map(function (seg) {
        var hAbove = ground != null && typeof seg.planeHeightAtCenterMeters === "number" ? seg.planeHeightAtCenterMeters * M_TO_FT - ground : null;
        var cFt = fr && seg.center && typeof seg.center.longitude === "number" ? fr.fwd([seg.center.longitude, seg.center.latitude]) : null;
        var bb = fr && seg.boundingBox && seg.boundingBox.sw && seg.boundingBox.ne ? { sw: fr.fwd([seg.boundingBox.sw.longitude, seg.boundingBox.sw.latitude]), ne: fr.fwd([seg.boundingBox.ne.longitude, seg.boundingBox.ne.latitude]) } : null;
        return { pitch: typeof seg.pitchDegrees === "number" ? seg.pitchDegrees : 0, azimuth: typeof seg.azimuthDegrees === "number" ? seg.azimuthDegrees : 0, heightFt: hAbove != null && hAbove >= 8 && hAbove <= 75 ? hAbove : ridge, cx: cFt ? cFt[0] : null, cy: cFt ? cFt[1] : null, bbox: bb };
      });
      var heightLine = "Height " + ridge + " ft (" + stories + " " + (stories === 1 ? "story" : "stories") + ") from Google Solar API buildingInsights.";
      spec.buildings.forEach(function (b) {
        if (b.role === "house") {
          b.heightFt = ridge;
          b.eaveFt = eave;
          b.stories = stories;
          b.roofMode = "solar";
          b.roofPlanes = planes;
          b.label = heightLine + " The wall is drawn from the roof planes above the ground at the house, not the 10 ft approximate default. " + (countyStories ? "Story count stays the county record." : "Story count is the eave divided by 10 ft.") + " Not a surveyed eave.";
        }
      });
      spec.solarHeightFt = ridge;
      spec.solarStories = stories;
      if (s) { s.solarHeightFt = ridge; s.solarStories = stories; }
      if (spec.caption.indexOf(heightLine) < 0) spec.caption = (spec.caption ? spec.caption + " " : "") + heightLine;
      note += " The wall uses that height.";
    } else {
      spec.buildings.forEach(function (b) {
        if (b.role !== "house") return;
        b.roofPlanes = segs.map(function (seg) {
          return { pitch: typeof seg.pitchDegrees === "number" ? seg.pitchDegrees : 0, azimuth: typeof seg.azimuthDegrees === "number" ? seg.azimuthDegrees : 0, heightFt: b.heightFt };
        });
      });
      note += " The plane height is above sea level and no ground elevation was available to subtract, so the wall height stays the labeled approximate figure. Pitch and azimuth still tilt the roof planes.";
    }
    spec.roof = { segments: segs.length, pitches: pitches, note: note };
    spec.caption = (spec.caption ? spec.caption + " " : "") + note;
    return spec;
  }

  function fetchJson(url) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 8000) : null;
    return fetch(url, { credentials: "omit", signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function solar(lat, lon, key) {
    var hit = cacheGet("solar", lat, lon);
    if (hit) return Promise.resolve({ data: hit, cached: true });
    if (!reserve(PRICE.solar)) return Promise.resolve({ data: null, blocked: true });
    var url = "https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=" + lat + "&location.longitude=" + lon + "&requiredQuality=LOW&key=" + encodeURIComponent(key);
    return fetchJson(url).then(function (data) {
      var ok = data && data.solarPotential && data.solarPotential.roofSegmentStats;
      release(PRICE.solar, !!ok);
      if (ok) cacheSet("solar", lat, lon, data);
      return { data: ok ? data : null, cached: false, failed: !ok };
    }).catch(function () { release(PRICE.solar, false); return { data: null, cached: false, failed: true }; });
  }

  function elevation(points, key, lat, lon) {
    var hit = cacheGet("elev", lat, lon);
    if (hit && typeof hit.elevation === "number") return Promise.resolve({ data: hit, cached: true });
    if (!reserve(PRICE.elevation)) return Promise.resolve({ data: null, blocked: true });
    return loadMaps(key).then(function () {
      var maps = root.google && root.google.maps;
      if (maps && maps.importLibrary) return maps.importLibrary("elevation");
      return null;
    }).then(function (lib) {
      var Svc = (lib && lib.ElevationService) || (root.google && root.google.maps && root.google.maps.ElevationService);
      if (!Svc) { release(PRICE.elevation, false); return { data: null, failed: true }; }
      var svc = new Svc();
      return new Promise(function (resolve) {
        svc.getElevationForLocations({ locations: points.map(function (p) { return { lat: p[1], lng: p[0] }; }) }, function (results, status) {
          var ok = status === "OK" && results && results[0] && typeof results[0].elevation === "number";
          release(PRICE.elevation, ok);
          if (!ok) { resolve({ data: null, failed: true }); return; }
          var data = { elevation: results[0].elevation, status: "OK" };
          cacheSet("elev", lat, lon, data);
          resolve({ data: data, cached: false });
        });
      });
    }).catch(function () { release(PRICE.elevation, false); return { data: null, failed: true }; });
  }

  function pathAttr(ring) {
    return (ring || []).map(function (p) { return p[1] + "," + p[0] + ",0"; }).join(" ");
  }

  function showMap(s, key) {
    if (cacheGet("map", s.lat, s.lon)) return Promise.resolve({ cached: true });
    if (!reserve(PRICE.mapLoad)) return Promise.resolve({ blocked: true });
    var host = document.getElementById("bh-3d-google");
    if (!host) { release(PRICE.mapLoad, false); return Promise.resolve({ skipped: true }); }
    return loadMaps(key).then(function () {
      return root.google.maps.importLibrary("maps3d");
    }).then(function (lib) {
      host.hidden = false;
      host.innerHTML = "";
      var map = new lib.Map3DElement({
        mode: "SATELLITE",
        center: { lat: s.lat, lng: s.lon, altitude: 40 },
        tilt: 67,
        range: 140,
        heading: 20,
        defaultUIHidden: true,
        gestureHandling: "GREEDY"
      });
      host.appendChild(map);
      release(PRICE.mapLoad, true);
      cacheSet("map", s.lat, s.lon, { at: Date.now() });
      if (lib.Polygon3DElement && s.rings && s.rings[0]) {
        var poly = new lib.Polygon3DElement();
        poly.path = s.rings[0].map(function (p) { return { lat: p[1], lng: p[0], altitude: 0 }; });
        poly.strokeColor = "#111111";
        poly.fillColor = "#ffffff";
        poly.fillOpacity = 0.12;
        poly.altitudeMode = "CLAMP_TO_GROUND";
        map.appendChild(poly);
      }
      return { shown: true, path: pathAttr(s.rings && s.rings[0]) };
    }).catch(function () { release(PRICE.mapLoad, false); return { failed: true }; });
  }

  function loadMaps(key) {
    if (root.google && root.google.maps && root.google.maps.importLibrary) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&v=weekly&libraries=maps3d";
      el.async = true;
      el.onload = function () { resolve(); };
      el.onerror = function () { reject(new Error("maps")); };
      document.head.appendChild(el);
    });
  }

  /* Fills roof height from Solar when a key is set, and asks Elevation only when this study has no grid.
     Returns the same spec. Never throws. */
  function enhance(spec, s, cfg) {
    var key = keyOf(cfg);
    spec.google = { key: !!key, calls: callsFor({ hasKey: false }) };
    if (!key || !s || s.lat == null || s.lon == null) return Promise.resolve(spec);
    var needsElev = !(spec.dem && spec.dem.vals);
    spec.google.calls = callsFor({
      hasKey: true,
      mapCached: !!cacheGet("map", s.lat, s.lon),
      solarCached: !!cacheGet("solar", s.lat, s.lon),
      needsElevation: needsElev,
      elevationCached: !!cacheGet("elev", s.lat, s.lon)
    });
    return solar(s.lat, s.lon, key).then(function (res) {
      if (res && res.data) applySolar(spec, res.data, s);
      spec.google.solar = res && res.cached ? "cached" : res && res.data ? "read" : res && res.blocked ? "cap" : "unavailable";
      if (!needsElev) return null;
      var pts = [[s.lon, s.lat]];
      return elevation(pts, key, s.lat, s.lon);
    }).then(function (elev) {
      if (elev && elev.data && typeof elev.data.elevation === "number") {
        s.googleGroundFt = elev.data.elevation * M_TO_FT;
        spec.caption += " Ground elevation " + Math.round(s.googleGroundFt) + " ft from the Google Maps Elevation service, because the slope grid was missing.";
        if (spec.google && (spec.google.solar === "read" || spec.google.solar === "cached")) applySolar(spec, cacheGet("solar", s.lat, s.lon), s);
      }
      return showMap(s, key);
    }).then(function (map) {
      spec.google.map = map && map.shown ? "shown" : map && map.cached ? "cached" : map && map.blocked ? "cap" : "off";
      return spec;
    }).catch(function () { return spec; });
  }

  var api = { CAP: CAP, PRICE: PRICE, STORY_FT: STORY_FT, callsFor: callsFor, canSpend: canSpend, spent: spent, charge: charge, enhance: enhance, applySolar: applySolar, cacheGet: cacheGet };
  root.BuildHereGoogle3D = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
