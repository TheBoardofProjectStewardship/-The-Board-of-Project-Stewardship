/* Optional Google layer for the feasibility study. Nothing here runs unless
   BuildHereConfig.googleMapsKey is a non-empty string. No key is shipped.
   List prices used for the $50 cap (first paid tier, USD per event, Nov 2026 price list):
     Immersive Maps (one 3D map load)           $7 / 1000 = $0.007
     Solar API Building Insights (one findClosest) $10 / 1000 = $0.010
     Elevation API (one request)                $5 / 1000 = $0.005
     Photorealistic 3D Tiles are fetched by the map as the camera moves and are
     not visible to this page, so each new map session also reserves $1.00
     (about 167 tiles at $6 / 1000) before the map is created.
   A cached address makes none of these calls again. */
(function (root) {
  "use strict";
  var CAP = 50;
  var PRICE = { mapLoad: 0.007, solar: 0.01, elevation: 0.005, mapReserve: 1 };
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
    if (!opts.hasKey) return { map: 0, solar: 0, elevation: 0, usd: 0 };
    var map = opts.mapCached ? 0 : 1;
    var solar = opts.solarCached ? 0 : 1;
    var elevation = opts.needsElevation && !opts.elevationCached ? 1 : 0;
    var usd = (map ? PRICE.mapLoad + PRICE.mapReserve : 0) + solar * PRICE.solar + elevation * PRICE.elevation;
    return { map: map, solar: solar, elevation: elevation, usd: Math.round(usd * 1000) / 1000 };
  }

  function keyOf(cfg) { return cfg && String(cfg.googleMapsKey || "").trim(); }

  function groundFt(spec, s) {
    var dem = spec && spec.dem;
    if (dem && dem.vals) {
      var min = Infinity;
      dem.vals.forEach(function (v) { if (typeof v === "number" && v < min) min = v; });
      if (isFinite(min)) return min;
    }
    if (s && s.landscape && s.landscape.slope && typeof s.landscape.slope.elevMin === "number") return s.landscape.slope.elevMin;
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
        if (above > 6 && above < 80) heights.push(above);
      }
    });
    var pitched = pitches.filter(function (p) { return p >= 5; }).length;
    var flat = pitches.length - pitched;
    var note = "Roof: " + segs.length + " plane" + (segs.length === 1 ? "" : "s") + " from Google Solar API buildingInsights (" + pitched + " pitched, " + flat + " under 5 degrees).";
    if (heights.length) {
      var ridge = Math.round(Math.max.apply(null, heights));
      var planes = segs.map(function (seg) {
        return { pitch: typeof seg.pitchDegrees === "number" ? seg.pitchDegrees : 0, azimuth: typeof seg.azimuthDegrees === "number" ? seg.azimuthDegrees : 0, heightFt: ridge };
      });
      spec.buildings.forEach(function (b) {
        if (b.role === "house") {
          b.heightFt = ridge;
          b.roofPlanes = planes;
          b.label = "Height " + ridge + " ft: Google Solar API roof-plane height above sea level, minus the ground elevation already on this lot. Not a surveyed eave.";
        }
      });
      note += " House height uses that difference.";
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
    return fetch(url, { credentials: "omit" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function solar(lat, lon, key) {
    var hit = cacheGet("solar", lat, lon);
    if (hit) return Promise.resolve({ data: hit, cached: true });
    if (!canSpend(PRICE.solar)) return Promise.resolve({ data: null, blocked: true });
    var url = "https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=" + lat + "&location.longitude=" + lon + "&requiredQuality=LOW&key=" + encodeURIComponent(key);
    return fetchJson(url).then(function (data) {
      charge(PRICE.solar);
      cacheSet("solar", lat, lon, data);
      return { data: data, cached: false };
    }).catch(function () { return { data: null, cached: false, failed: true }; });
  }

  function elevation(points, key, lat, lon) {
    var hit = cacheGet("elev", lat, lon);
    if (hit) return Promise.resolve({ data: hit, cached: true });
    if (!canSpend(PRICE.elevation)) return Promise.resolve({ data: null, blocked: true });
    var loc = points.map(function (p) { return p[1] + "," + p[0]; }).join("|");
    var url = "https://maps.googleapis.com/maps/api/elevation/json?locations=" + encodeURIComponent(loc) + "&key=" + encodeURIComponent(key);
    return fetchJson(url).then(function (data) {
      charge(PRICE.elevation);
      cacheSet("elev", lat, lon, data);
      return { data: data, cached: false };
    }).catch(function () { return { data: null, failed: true }; });
  }

  function pathAttr(ring) {
    return (ring || []).map(function (p) { return p[1] + "," + p[0] + ",0"; }).join(" ");
  }

  function showMap(s, key) {
    if (cacheGet("map", s.lat, s.lon)) return Promise.resolve({ cached: true });
    var reserve = PRICE.mapLoad + PRICE.mapReserve;
    if (!canSpend(reserve)) return Promise.resolve({ blocked: true });
    var host = document.getElementById("bh-3d-google");
    if (!host) return Promise.resolve({ skipped: true });
    charge(reserve);
    cacheSet("map", s.lat, s.lon, { at: Date.now() });
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
      if (lib.FlattenerElement && s.rings && s.rings[0]) {
        var flat = new lib.FlattenerElement();
        flat.path = s.rings[0].map(function (p) { return { lat: p[1], lng: p[0], altitude: 0 }; });
        map.appendChild(flat);
      }
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
    }).catch(function () { return { failed: true }; });
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
      if (elev && elev.data && elev.data.results && elev.data.results[0] && typeof elev.data.results[0].elevation === "number") {
        s.googleGroundFt = elev.data.results[0].elevation * M_TO_FT;
        spec.caption += " Ground elevation " + Math.round(s.googleGroundFt) + " ft from the Google Elevation API, because the slope grid was missing.";
        if (spec.google && spec.google.solar === "read" || (spec.google && spec.google.solar === "cached")) applySolar(spec, cacheGet("solar", s.lat, s.lon), s);
      }
      return showMap(s, key);
    }).then(function (map) {
      spec.google.map = map && map.shown ? "shown" : map && map.cached ? "cached" : map && map.blocked ? "cap" : "off";
      return spec;
    }).catch(function () { return spec; });
  }

  function keyOf(cfg) { return cfg && String(cfg.googleMapsKey || "").trim(); }

  var api = { CAP: CAP, PRICE: PRICE, callsFor: callsFor, canSpend: canSpend, spent: spent, charge: charge, enhance: enhance, cacheGet: cacheGet };
  root.BuildHereGoogle3D = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
