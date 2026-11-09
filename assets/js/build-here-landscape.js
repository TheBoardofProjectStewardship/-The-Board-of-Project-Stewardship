/* Site coverage and landscape calculator for the "What can I build here?" report.
   Splits a parcel into house, garage / accessory buildings, driveway and parking,
   other hardscape, and remaining landscape, and reads slope from USGS 3DEP lidar.
   Free public services only. Every number carries its source and a confidence;
   anything we cannot read is reported as unavailable, never guessed.
   Runs in the browser (window.BuildHereLandscape) and in Node 18+ (module.exports). */
(function (root) {
  "use strict";
  var TIMEOUT = 30000;
  var SEA = "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/";
  var EP = {
    seaBldg: SEA + "Building_Outlines_2023/FeatureServer/0/query",
    seaImp: SEA + "Impervious_Surface_2015/FeatureServer/0/query",
    seaSteep: SEA + "Environmentally_Critical_Areas_Steep_Slope/FeatureServer/9/query",
    snoRoof: "https://gis.snoco.org/host/rest/services/Hosted/BUILDINGS__roofprints/FeatureServer/0/query",
    kcParcel: "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query",
    dem: "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples",
    overpass: "https://overpass-api.de/api/interpreter",
    overpass2: "https://overpass.kumi.systems/api/interpreter",
    overpass3: "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    msbfp: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/MSBFP2/FeatureServer/0/query",
    agolSearch: "https://www.arcgis.com/sharing/rest/search"
  };
  /* Free, public, statewide (or metro-wide) parcel layers that answer browser queries.
     Checked Nov 2026. Anything not listed falls through to auto-discovery. */
  var STATE_PARCELS = {
    WA: [{ url: "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0", name: "Washington State current parcels (WA Geoservices)" }],
    OR: [{ url: "https://services2.arcgis.com/McQ0OlIABe29rJJy/arcgis/rest/services/Taxlots_(Public)/FeatureServer/3", name: "Oregon Metro RLIS taxlots (Portland metro only)" }],
    CO: [{ url: "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0", name: "Colorado Public Parcels (State of Colorado OIT)" }],
    FL: [{ url: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0", name: "Florida statewide cadastral (Florida GIO)" }],
    MA: [{ url: "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0", name: "Massachusetts property tax parcels (MassGIS)" }],
    NC: [{ url: "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1", name: "North Carolina parcels (NC OneMap)" }],
    CA: [{ url: "https://bz1uwWPKUInZBK94.svcs5.arcgis.com/bz1uwWPKUInZBK94/arcgis/rest/services/CA_Statewide_Parcels_Public_view/FeatureServer/0", name: "California statewide parcels (CAL FIRE public view)" }],
    OH: [{ url: "https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0", name: "Ohio statewide parcels (OGRIP)" }],
    WI: [{ url: "https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels_DB/FeatureServer/0", name: "Wisconsin statewide parcels (WI DOA)" }],
    VT: [{ url: "https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0", name: "Vermont standardized parcels (VCGI)" }],
    MT: [{ url: "https://services.arcgis.com/qnjIrwR8z5Izc0ij/arcgis/rest/services/Montana_Cadastral_Framework/FeatureServer/1", name: "Montana cadastral parcels (MT State Library)" }],
    MN: [{ url: "https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_mngeo/plan_parcels_open/FeatureServer/1", name: "Minnesota open parcels, compiled by MnGeo from opt-in counties (Minnesota Geospatial Commons)" },
      { url: "https://public.gis.olmstedcounty.gov/arcgis/rest/services/AGOL_Open_Data/Parcels/FeatureServer/0", name: "Olmsted County parcels (Olmsted County GIS)", county: "Olmsted" }],
    AK: [{ url: "https://services1.arcgis.com/7HDiw78fcUiM2BWn/arcgis/rest/services/AK_Parcels/FeatureServer/0", name: "Alaska statewide parcels" }]
  };
  var LINKS = {
    kcRecorder: "https://recordsearch.kingcounty.gov/LandmarkWeb",
    kcRecorderInfo: "https://kingcounty.gov/en/dept/executive-services/certificates-permits-licenses/records-licensing/recorders-office/records-search",
    snoRecorder: "https://www.snoco.org/RecordedDocuments/",
    dnrLidar: "https://lidarportal.dnr.wa.gov/",
    seaGis: "https://seattlecitygis.maps.arcgis.com/apps/webappviewer/index.html?id=f822b2c6498c4163b0cf908e2241e9c2"
  };

  /* ---------- helpers ---------- */
  function qs(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); }).join("&"); }
  function getJSON(url, params, post, tries) {
    tries = tries == null ? 2 : tries;
    return getOnce(url, params, post).catch(function (e) {
      if (tries <= 1) throw e;
      return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return getJSON(url, params, post, tries - 1); });
    });
  }
  function getOnce(url, params, post) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, TIMEOUT);
    var q = qs(params);
    var req = (post || q.length > 1800) ? fetch(url, { method: "POST", body: q, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ctl.signal }) : fetch(url + "?" + q, { signal: ctl.signal });
    return req.finally(function () { clearTimeout(t); }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) { if (j && j.error) throw new Error(j.error.message || "service error"); return j; });
  }
  function bbox(rings) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    rings.forEach(function (r) { r.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); }); });
    return b;
  }
  var K = Math.PI / 180, RF = 20925646; // earth radius, feet
  function frame(rings) {
    var b = bbox(rings), lat0 = (b[1] + b[3]) / 2, lon0 = (b[0] + b[2]) / 2, c = Math.cos(lat0 * K);
    return {
      lat0: lat0, lon0: lon0,
      fwd: function (p) { return [(p[0] - lon0) * K * RF * c, (p[1] - lat0) * K * RF]; },
      inv: function (x, y) { return [lon0 + x / (K * RF * c), lat0 + y / (K * RF)]; }
    };
  }
  function proj(rings, fr) { return rings.map(function (r) { return r.map(fr.fwd); }); }
  /* Even-odd test over all rings, so holes work. */
  function inPoly(x, y, rings) {
    var ins = false;
    for (var k = 0; k < rings.length; k++) {
      var r = rings[k];
      for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        var yi = r[i][1], yj = r[j][1];
        if (((yi > y) !== (yj > y)) && (x < (r[j][0] - r[i][0]) * (y - yi) / (yj - yi) + r[i][0])) ins = !ins;
      }
    }
    return ins;
  }
  function ringsArea(rings) {
    var t = 0;
    rings.forEach(function (r) { var a = 0; for (var i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; t += a / 2; });
    return Math.abs(t);
  }
  function segDist(px, py, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], t = ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1);
    t = Math.max(0, Math.min(1, t));
    var x = a[0] + t * dx - px, y = a[1] + t * dy - py;
    return Math.sqrt(x * x + y * y);
  }
  function nearLine(x, y, line, half) { for (var i = 0; i < line.length - 1; i++) if (segDist(x, y, line[i], line[i + 1]) <= half) return true; return false; }
  function envelope(rings, padFt) {
    var b = bbox(rings), d = padFt / (K * RF);
    return [b[0] - d / Math.cos(b[1] * K), b[1] - d, b[2] + d / Math.cos(b[1] * K), b[3] + d];
  }
  function envQuery(env, extra) {
    return Object.assign({ f: "json", geometry: env.join(","), geometryType: "esriGeometryEnvelope", inSR: 4326, spatialRel: "esriSpatialRelIntersects", returnGeometry: true, outSR: 4326 }, extra || {});
  }
  function pct(a, lot) { return lot ? Math.round(a / lot * 1000) / 10 : null; }
  function r10(v) { return Math.round(v / 10) * 10; }

  /* ---------- data readers ---------- */
  function seattleBuildings(env) {
    return getJSON(EP.seaBldg, envQuery(env, { outFields: "PIN,AREA,COMMENT_" })).then(function (j) {
      return (j.features || []).filter(function (f) { return f.geometry && f.geometry.rings; }).map(function (f) { return { rings: f.geometry.rings, note: (f.attributes.COMMENT_ || "").trim() }; });
    });
  }
  function snoBuildings(env) {
    return getJSON(EP.snoRoof, envQuery(env, { outFields: "*" })).then(function (j) {
      return (j.features || []).filter(function (f) { return f.geometry && f.geometry.rings; }).map(function (f) { return { rings: f.geometry.rings, note: "" }; });
    });
  }
  var IMP = { DRV: "drive", PRK: "drive", WLK: "hard", DEK: "hard", PUL: "hard", PLN: "hard", MSC: "hard", OTH: "hard", YRD: "hard", BLD: "bld", SDW: "hard", STR: "drive" };
  function seattleImpervious(env) {
    return getJSON(EP.seaImp, envQuery(env, { outFields: "IMPSURF_FEATYPE_CODE,IMPSURF_SURFTYPE_CODE" })).then(function (j) {
      return (j.features || []).filter(function (f) { return f.geometry && f.geometry.rings; }).map(function (f) {
        var code = f.attributes.IMPSURF_FEATYPE_CODE, surf = f.attributes.IMPSURF_SURFTYPE_CODE;
        return { rings: f.geometry.rings, code: code, cls: surf === "VEG" ? null : (IMP[code] || null) };
      }).filter(function (x) { return x.cls; });
    });
  }
  /* OpenStreetMap: buildings, driveway centerlines, parking areas. */
  function osm(env) {
    var b = [env[1], env[0], env[3], env[2]].join(",");
    var q = "[out:json][timeout:25];(way[building](" + b + ");way[highway=service](" + b + ");way[amenity=parking](" + b + ");way['area:highway'](" + b + "););out geom tags;";
    // Each try gets its own 20 s timeout. Busy (429/504) or slow: back off and move to the next mirror.
    var urls = [EP.overpass, EP.overpass3, EP.overpass2, EP.overpass];
    var waits = [0, 2000, 4000, 8000];
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var call = function (u) {
      var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 20000);
      return fetch(u, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ctl.signal })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .finally(function () { clearTimeout(tm); });
    };
    var i = 0;
    var attempt = function () {
      var k = i++;
      return wait(waits[k]).then(function () { return call(urls[k]); }).catch(function (e) {
        if (i >= urls.length) throw new Error("all Overpass servers busy or unreachable (" + (e.name === "AbortError" ? "timeout" : e.message) + ")");
        return attempt();
      });
    };
    return attempt()
      .then(function (j) {
        var out = { buildings: [], drives: [], parking: [] };
        (j.elements || []).forEach(function (e) {
          if (!e.geometry) return;
          var pts = e.geometry.map(function (g) { return [g.lon, g.lat]; }), tg = e.tags || {};
          if (tg.building) out.buildings.push({ rings: [pts], note: tg.building === "garage" || tg.building === "garages" ? "garage" : "" });
          else if (tg.amenity === "parking" || tg["area:highway"]) out.parking.push({ rings: [pts] });
          else if (tg.highway === "service" && (tg.service === "driveway" || !tg.service)) out.drives.push({ line: pts });
        });
        return out;
      });
  }
  function demSamples(points) {
    var chunks = [];
    for (var i = 0; i < points.length; i += 250) chunks.push(points.slice(i, i + 250));
    return Promise.all(chunks.map(function (c, ci) {
      return getJSON(EP.dem, { geometry: JSON.stringify({ points: c, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryMultipoint", returnFirstValueOnly: true, f: "json" }, true, 3)
        .then(function (j) {
          var vals = new Array(c.length).fill(null), res = null;
          (j.samples || []).forEach(function (sm) { var v = parseFloat(sm.value); if (isFinite(v) && v > -1000) vals[sm.locationId] = v * 3.28084; res = sm.resolution; });
          return { off: ci * 250, vals: vals, res: res };
        });
    })).then(function (parts) {
      var all = new Array(points.length).fill(null), res = null;
      parts.forEach(function (p) { p.vals.forEach(function (v, k) { all[p.off + k] = v; }); res = res || p.res; });
      return { vals: all, res: res };
    });
  }

  /* ---------- nationwide parcel lookup ---------- */
  /* Parcel at the address. Census points often sit in the street, so search 30 m around
     the point and prefer: a lot containing the point, then the nearest lot. Lots over
     2 acres are only used when nothing smaller is near (they are often road, rail or
     multi-lot records), and are flagged. */
  var BIG = 87120;
  /* Situs (property) address match. Owner / taxpayer / mailing fields are ignored because they
     hold the owner's mailing address, not the property's. Score 2 = number and street name,
     1 = number only, 0 = no match. */
  var NOT_SITUS = /owner|own_|tax|mail|payee|care|c_o|grantee|buyer|legal|plat|sub_|zip/i;
  function parseAddr(str) {
    var m = String(str || "").toUpperCase().match(/^\s*(\d+)[A-Z]?\s+(.*)$/);
    if (!m) return { num: "", street: "" };
    var words = m[2].split(",")[0].replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(function (w) { return w && !/^(N|S|E|W|NE|NW|SE|SW|NORTH|SOUTH|EAST|WEST|AVE|AVENUE|ST|STREET|RD|ROAD|DR|DRIVE|LN|LANE|BLVD|CT|COURT|PL|PLACE|WAY|TER|CIR|PKWY|HWY)$/.test(w); });
    return { num: m[1], street: words[0] || "" };
  }
  function numMatch(attrs, num, street) {
    if (!num) return 0;
    var keys = Object.keys(attrs).filter(function (k) { return !NOT_SITUS.test(k); });
    var numHit = keys.some(function (k) {
      var v = String(attrs[k] == null ? "" : attrs[k]).trim().toUpperCase();
      if (/^(anumber|addr_?hn|add_?num|addnum|house_?n(o|um|umber)?|hse_?num|hn|st_?num|street_?num|situs_?num|site_?num|addressnum|address_number)$/i.test(k)) return v === num;
      if (/addr|situs|site_?add|location|full_?add|prop_?add/i.test(k)) return v.indexOf(num + " ") === 0 || v === num;
      return false;
    });
    if (!numHit) return 0;
    if (!street) return 1;
    var re = new RegExp("(^|[^A-Z0-9])" + street + "([^A-Z0-9]|$)");
    var stHit = keys.some(function (k) { return /st_?name|street|addr|situs|site|location|road/i.test(k) && re.test(String(attrs[k] == null ? "" : attrs[k]).toUpperCase()); });
    return stHit ? 2 : 1;
  }
  function hasSitus(attrs) { return Object.keys(attrs).some(function (k) { return !NOT_SITUS.test(k) && /anumber|num|addr|house|situs|hn$/i.test(k); }); }
  var NUM_KEY = /^(anumber|addr_?hn|add_?num|addnum|house_?n(o|um|umber)?|hse_?num|st_?num|street_?num|situs_?num|site_?num|addressnum|address_number)$/i;
  function cand(f, lon, lat, num, street) {
    var fr = frame(f.geometry.rings), R = proj(f.geometry.rings, fr), p = fr.fwd([lon, lat]);
    var inside = inPoly(p[0], p[1], R), d = inside ? 0 : Math.min.apply(null, R.map(function (r) { var m = Infinity; for (var i = 1; i < r.length; i++) m = Math.min(m, segDist(p[0], p[1], r[i - 1], r[i])); return m; }));
    return { f: f, d: d, area: ringsArea(R), num: numMatch(f.attributes || {}, num, street) };
  }
  function finish(pick, cands, num) {
    pick.f.dist = pick.d; pick.f.big = pick.area > BIG; pick.f.numMatch = pick.num;
    pick.f.numChecked = !!num && cands.some(function (c) { return hasSitus(c.f.attributes || {}); });
    return pick.f;
  }
  /* 1) parcels within 60 m: number + street match wins; 2) if none, ask the layer for parcels with this
     house number within 250 m (geocoded points can sit a block off) and take a number + street match;
     3) number-only match within 30 m; 4) nearest lot within 30 m, flagged "matched by location only". */
  function pointHit(url, lon, lat, num, street) {
    var base = { f: "json", geometry: lon + "," + lat, geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects", units: "esriSRUnit_Meter", outFields: "*", returnGeometry: true, outSR: 4326 };
    var ok = function (x) { return x.geometry && x.geometry.rings && x.geometry.rings.length; };
    return getJSON(url + "/query", Object.assign({}, base, { distance: 60, resultRecordCount: 40 }), false, 1).then(function (j) {
      var cands = (j.features || []).filter(ok).map(function (f) { return cand(f, lon, lat, num, street); });
      if (!cands.length) return null;
      var sized = function (c) { return c.area <= BIG && c.area >= 500; };
      var full = cands.filter(function (c) { return c.num === 2 && sized(c); }).sort(function (a, b) { return a.d - b.d; });
      if (full.length) return finish(full[0], cands, num);
      var numKey = num && Object.keys(cands[0].f.attributes || {}).filter(function (k) { return NUM_KEY.test(k); })[0];
      var wide = numKey && /^\d+$/.test(num) ? getJSON(url + "/query", Object.assign({}, base, { distance: 250, where: numKey + "=" + num, resultRecordCount: 40 }), false, 1).catch(function () {
        return getJSON(url + "/query", Object.assign({}, base, { distance: 250, where: numKey + "='" + num + "'", resultRecordCount: 40 }), false, 1);
      }).catch(function () { return { features: [] }; }) : Promise.resolve({ features: [] });
      return wide.then(function (w) {
        var wf = (w.features || []).filter(ok).map(function (f) { return cand(f, lon, lat, num, street); }).filter(function (c) { return c.num === 2 && sized(c); }).sort(function (a, b) { return a.d - b.d; });
        if (wf.length) return finish(wf[0], cands, num);
        var close = cands.filter(function (c) { return c.d <= 100; });
        if (!close.length) return null;
        var pickN = close.filter(function (c) { return c.num === 1 && sized(c); }).sort(function (a, b) { return a.d - b.d; })[0];
        if (pickN) return finish(pickN, cands, num);
        close.forEach(function (c) { c.num = 0; });
        var small = close.filter(sized).sort(function (a, b) { return a.d - b.d; });
        return finish(small[0] || close.sort(function (a, b) { return a.d - b.d || a.area - b.area; })[0], cands, num);
      });
    });
  }
  function ringsAreaDeg(r) { var t = 0; r.forEach(function (q) { var a = 0; for (var i = 0, j = q.length - 1; i < q.length; j = i++) a += q[j][0] * q[i][1] - q[i][0] * q[j][1]; t += a; }); return Math.abs(t); }
  function parcelLayerOf(url) {
    if (/\/(Feature|Map)Server\/\d+\/?$/.test(url)) return Promise.resolve(url.replace(/\/$/, ""));
    return getJSON(url.replace(/\/$/, ""), { f: "json" }, false, 1).then(function (j) {
      var ls = (j.layers || []).filter(function (l) { return !l.geometryType || l.geometryType === "esriGeometryPolygon"; });
      var pick = ls.filter(function (l) { return /parcel|tax ?lot/i.test(l.name) && !/label|anno|point|centroid|metadata|boundar|extent|index/i.test(l.name); })[0];
      if (!pick) throw new Error("no polygon layer");
      return url.replace(/\/$/, "") + "/" + pick.id;
    });
  }
  /* Auto-discovery: search ArcGIS Online for a public parcel layer for the county,
     then keep the first one whose polygon contains the address point. */
  function discoverParcel(county, stateName, lon, lat, num, street) {
    var c = String(county || "").replace(/ (County|Parish|Borough|Census Area|Municipality)$/i, "");
    if (!c) return Promise.resolve(null);
    var q = '(parcels OR parcel OR taxlots) "' + c + '" (type:"Feature Service" OR type:"Map Service") access:public';
    return getJSON(EP.agolSearch, { f: "json", q: q, num: 20, sortField: "numviews", sortOrder: "desc" }, false, 1).then(function (j) {
      var re = new RegExp(c.replace(/[^A-Za-z ]/g, ""), "i");
      var items = (j.results || []).filter(function (r) {
        var t = (r.title || "") + " " + (r.snippet || "") + " " + (r.tags || []).join(" ");
        return r.url && /parcel|tax ?lot/i.test(r.title) && (re.test(t) || (stateName && new RegExp(stateName, "i").test(t))) && !/sale|centroid|point|easement|right.of.way|pipeline|subset|model|histor|change|mile|inventory|impact/i.test(r.title);
      }).slice(0, 5);
      var i = 0;
      function next() {
        if (i >= items.length) return null;
        var it = items[i++];
        return parcelLayerOf(it.url).then(function (u) { return pointHit(u, lon, lat, num, street).then(function (f) { return f && !f.big ? { f: f, name: it.title + " (published by " + it.owner + " on ArcGIS Online)", auto: true } : next(); }); })
          .catch(function () { return next(); });
      }
      return next();
    });
  }
  /* Twin Cities 7-county parcels, one layer per county (Metropolitan Council). */
  var METC = { Anoka: 0, Carver: 1, Dakota: 2, Hennepin: 3, Ramsey: 4, Scott: 5, Washington: 6 };
  function findParcel(s) {
    var cn = String(s.county || "").replace(/ County$/i, "");
    var pa = parseAddr(s.matched || s.input || ""), num = pa.num, street = pa.street;
    var list = (STATE_PARCELS[s.stateAbbr] || []).filter(function (L) { return !L.county || L.county === cn; });
    if (s.stateAbbr === "MN" && METC[cn] != null) list = [{ url: "https://arcgis.metc.state.mn.us/data1/rest/services/parcels/Parcels_2024/FeatureServer/" + METC[cn], name: "Metropolitan Council 7-county parcels, " + cn + " County (2024)" }].concat(list);
    var i = 0;
    function next() {
      if (i >= list.length) return discoverParcel(s.county, s.stateName, s.lon, s.lat, num, street);
      var L = list[i++];
      return pointHit(L.url, s.lon, s.lat, num, street).then(function (f) { return f ? { f: f, name: L.name, auto: false } : next(); }).catch(function () { return next(); });
    }
    return next();
  }
  function msBuildings(env) {
    return getJSON(EP.msbfp, envQuery(env, { outFields: "OBJECTID" })).then(function (j) {
      return (j.features || []).filter(function (f) { return f.geometry && f.geometry.rings; }).map(function (f) { return { rings: f.geometry.rings, note: "" }; });
    });
  }
  function circle(lon, lat, rFt) {
    var fr = frame([[[lon, lat]]]), r = [];
    for (var k = 0; k <= 24; k++) { var a = k / 24 * 2 * Math.PI; r.push(fr.inv(Math.cos(a) * rFt, Math.sin(a) * rFt)); }
    return [r];
  }

  /* Downhill direction of one gradient. gx is east, gy is north, and both point uphill.
     The result is an estimate from those two numbers, not a pipe or ditch design. */
  function fallFromGradient(gx, gy) {
    if (!isFinite(gx) || !isFinite(gy)) return null;
    var mag = Math.sqrt(gx * gx + gy * gy);
    if (mag < 0.001) return { pct: 0, deg: null, compass: "flat" };
    var up = Math.atan2(gx, gy) * 180 / Math.PI;
    var down = (up + 180) % 360;
    if (down < 0) down += 360;
    var names = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
    return { pct: Math.round(mag * 1000) / 10, deg: Math.round(down), compass: names[Math.round(down / 45) % 8] };
  }
  /* ---------- slope ---------- */
  function slope(rings, fr) {
    var R = proj(rings, fr), b = bbox(R);
    var w = b[2] - b[0], h = b[3] - b[1];
    var step = Math.max(3.3, Math.sqrt((w + 7) * (h + 7) / 900)); // 1 m lidar floor, <= ~900 samples
    var nx = Math.ceil(w / step) + 3, ny = Math.ceil(h / step) + 3, pts = [];
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) pts.push(fr.inv(b[0] + (i - 1) * step, b[1] + (j - 1) * step));
    return demSamples(pts).then(function (d) {
      var z = function (i, j) { return d.vals[j * nx + i]; };
      var slopes = [], elev = [], gxSum = 0, gySum = 0;
      for (var j = 1; j < ny - 1; j++) for (var i = 1; i < nx - 1; i++) {
        var x = b[0] + (i - 1) * step, y = b[1] + (j - 1) * step;
        if (!inPoly(x, y, R)) continue;
        var c = z(i, j), e = z(i + 1, j), wv = z(i - 1, j), n = z(i, j + 1), s = z(i, j - 1);
        if (c != null) elev.push(c);
        if ([e, wv, n, s].some(function (v) { return v == null; })) continue;
        var gx = (e - wv) / (2 * step), gy = (n - s) / (2 * step);
        gxSum += gx; gySum += gy;
        slopes.push(Math.sqrt(gx * gx + gy * gy) * 100);
      }
      if (slopes.length < 4) return { ok: false, note: "Too few lidar samples fell inside the lot (" + slopes.length + ")." };
      var sorted = slopes.slice().sort(function (a, c) { return a - c; });
      var mean = slopes.reduce(function (a, v) { return a + v; }, 0) / slopes.length;
      var frac = function (t) { return slopes.filter(function (v) { return v >= t; }).length / slopes.length; };
      var fall = fallFromGradient(gxSum / slopes.length, gySum / slopes.length);
      return {
        ok: true, step: Math.round(step * 10) / 10, samples: slopes.length, res: d.res,
        mean: Math.round(mean), median: Math.round(sorted[Math.floor(sorted.length / 2)]),
        p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]), max: Math.round(sorted[sorted.length - 1]),
        pct15: Math.round(frac(15) * 100), pct25: Math.round(frac(25) * 100), pct40: Math.round(frac(40) * 100),
        elevMin: Math.round(Math.min.apply(null, elev)), elevMax: Math.round(Math.max.apply(null, elev)),
        fallPct: fall ? fall.pct : null, fallDeg: fall ? fall.deg : null, fallCompass: fall ? fall.compass : ""
      };
    });
  }

  /* ---------- coverage raster ---------- */
  /* Sample the lot on a fine grid and give each sample one class by priority:
     building > driveway/parking > other hardscape > landscape. Overlapping or
     slightly misaligned layers can never double count this way. */
  function coverage(lotRings, fr, layers) {
    var L = proj(lotRings, fr), b = bbox(L);
    var area = ringsArea(L);
    var step = Math.max(1, Math.sqrt(area / 40000));
    var bld = layers.buildings.map(function (x, i) { return { id: i, R: proj(x.rings, fr), note: x.note, bb: null }; });
    bld.forEach(function (x) { x.bb = bbox(x.R); });
    var dr = layers.drive.map(function (x) { var R = proj(x.rings, fr); return { R: R, bb: bbox(R) }; });
    var hd = layers.hard.map(function (x) { var R = proj(x.rings, fr); return { R: R, bb: bbox(R) }; });
    var lines = (layers.driveLines || []).map(function (l) { return proj([l.line], fr)[0]; });
    var inBB = function (bb, x, y) { return x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3]; };
    var counts = { bld: {}, drive: 0, driveEst: 0, hard: 0, land: 0, total: 0 };
    for (var y = b[1] + step / 2; y < b[3]; y += step) for (var x = b[0] + step / 2; x < b[2]; x += step) {
      if (!inPoly(x, y, L)) continue;
      counts.total++;
      var hit = null;
      for (var i = 0; i < bld.length && hit == null; i++) if (inBB(bld[i].bb, x, y) && inPoly(x, y, bld[i].R)) hit = i;
      if (hit != null) { counts.bld[hit] = (counts.bld[hit] || 0) + 1; continue; }
      if (dr.some(function (p) { return inBB(p.bb, x, y) && inPoly(x, y, p.R); })) { counts.drive++; continue; }
      if (lines.some(function (l) { return nearLine(x, y, l, 5); })) { counts.driveEst++; continue; }
      if (hd.some(function (p) { return inBB(p.bb, x, y) && inPoly(x, y, p.R); })) { counts.hard++; continue; }
      counts.land++;
    }
    var cell = step * step, scale = area / (counts.total * cell || 1); // match the exact polygon area
    var sf = function (n) { return n * cell * scale; };
    var parts = Object.keys(counts.bld).map(function (k) { return { id: +k, sf: sf(counts.bld[k]), full: ringsArea(bld[k].R), note: bld[k].note }; })
      .filter(function (p) { return p.sf >= 20; }).sort(function (a, c) { return c.sf - a.sf; });
    return { area: area, step: step, parts: parts, drive: sf(counts.drive), driveEst: sf(counts.driveEst), hard: sf(counts.hard), land: sf(counts.land) };
  }

  /* ---------- main ---------- */
  function analyze(s) {
    var out = { ok: false, rows: [], slope: null, steep: null, survey: null, notes: [], sources: [], parcelSrc: "", mode: "lot" };
    function src(name, ok, note) { out.sources.push({ name: name, ok: ok, note: note || "" }); }
    if (!s || (!s.rings && s.lon == null)) { out.notes.push("No location was found, so the site coverage could not be measured."); return Promise.resolve(out); }
    var lotRings = s.rings, parcelName = s.rings ? "" : null, parcelAuto = false;
    var seattle = s.juris === "seattle", sno = /^Snohomish/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA"), king = /^King/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA");
    // 1. Parcel: the county record from the main lookup, else a statewide layer, else auto-discovery.
    function applyParcelHit(h) {
      if (!h) return;
      lotRings = h.f.geometry.rings; parcelName = h.name; parcelAuto = h.auto; out.parcelBig = !!h.f.big;
      out.matchedBy = h.f.numMatch === 2 ? "address" : h.f.numMatch === 1 ? "number" : "location";
      out.rings = lotRings;
      out.parcelAttrs = h.f.attributes || {};
      // Feed the main study the outline and any free assessor fields so the aerial and site plan share one lot.
      if (!s.rings) s.rings = lotRings;
      var a = out.parcelAttrs, pin = a.PIN || a.COUNTY_PIN || a.STATE_PIN || a.PARCEL_ID || a.PID || a.Parcel_ID || a.TAX_PIN || a.PARCELID || a.PARCELNUM || a.PARCEL_NUM || "";
      if (!s.parcel && pin) s.parcel = String(pin);
      var fin = a.FIN_SQ_FT || a.FINISHED_SQFT || a.BLDG_SQFT || a.LIVINGAREA || a.SQFT || null;
      if (!s.existing && fin && +fin > 0) { s.existing = Math.round(+fin); s.existingSrc = (h.name || "Public parcel record") + " finished area"; }
      var yb = a.YEAR_BUILT || a.YR_BUILT || a.YEARBUILT || a.YEAR_BUILT_ || null;
      if (!s.yearBuilt && yb && +yb > 1800) { s.yearBuilt = String(Math.round(+yb)); s.yearSrc = h.name || "Public parcel record"; }
      if (h.f.numMatch === 2) out.notes.push("Lot matched by the house number and street on the parcel record.");
      else if (h.f.numMatch === 1) out.notes.push("Lot matched by house number only (street name not confirmed on the parcel record). Please verify on the aerial.");
      else out.warn = "Lot matched by location only, please verify. No parcel within 60 m lists this house number" + (h.f.numChecked ? "" : " (this parcel layer has no address fields)") + ", so the nearest lot was used.";
      var where = h.f.numMatch === 2 ? "house number and street match the parcel record" : h.f.numMatch ? "house number matches the parcel record" : h.f.dist ? "nearest lot, " + Math.round(h.f.dist) + " ft from the geocoded point (the point fell in the street)" : "outline contains the address point";
      if (h.f.dist && !h.f.numMatch) out.notes.push("The geocoded point fell outside any lot, so the nearest lot (" + Math.round(h.f.dist) + " ft away) was used. Check the outline on the aerial.");
      if (h.f.big) out.notes.push("The only lot found is over 2 acres. It may be a road, rail or multi-lot record rather than this property; treat the numbers below with caution.");
      src(h.name, true, (h.auto ? "Auto-discovered county parcel layer; " : "Public parcel layer; ") + where);
    }
    var pJob = lotRings ? Promise.resolve() : findParcel(s).then(function (h) {
      if (h) applyParcelHit(h);
      else src("Parcel outline (statewide registry and ArcGIS Online discovery)", false, "No free public parcel layer answered for this address.");
    }).catch(function (e) { src("Parcel outline", false, e.message); });

    return pJob.then(function () {
      var area0 = lotRings ? null : circle(s.lon, s.lat, 60);
      if (!lotRings) { out.mode = "point"; out.notes.push("No parcel outline was found, so lot area and landscape are unavailable. The house footprint is the building at the address point, and slope is read within 60 ft of that point."); }
      else { out.rings = lotRings; if (!s.rings) s.rings = lotRings; }
      var shape = lotRings || area0;
      var fr = frame(shape), env = envelope(shape, 60);
      var layers = { buildings: [], drive: [], hard: [], driveLines: [] }, bSrc = "", dSrc = "", hSrc = "", gotB = false, gotD = false, msB = null, osmO = null;
      var jobs = [];
      if (seattle) jobs.push(seattleBuildings(env).then(function (b) { layers.buildings = b; gotB = true; bSrc = "City of Seattle building outlines (2023)"; src(bSrc, true, b.length + " outlines near the lot"); }).catch(function (e) { src("City of Seattle building outlines (2023)", false, e.message); }));
      else if (sno) jobs.push(snoBuildings(env).then(function (b) { if (b.length) { layers.buildings = b; gotB = true; bSrc = "Snohomish County roof outlines (include eaves)"; } src("Snohomish County roof outlines", true, b.length + " outlines near the lot"); }).catch(function (e) { src("Snohomish County roof outlines", false, e.message); }));
      if (!seattle) jobs.push(msBuildings(env).then(function (b) { msB = b; src("Microsoft US Building Footprints (Esri-hosted MSBFP2)", true, b.length + " footprints near the lot"); }).catch(function (e) { src("Microsoft US Building Footprints", false, e.message); }));
      if (seattle) jobs.push(seattleImpervious(env).then(function (imp) {
        imp.forEach(function (p) { if (p.cls === "drive") layers.drive.push(p); else if (p.cls === "hard") layers.hard.push(p); else if (p.cls === "bld") layers.bldFallback = (layers.bldFallback || []).concat([p]); });
        gotD = true; dSrc = "City of Seattle impervious surface (2015 aerial mapping)"; hSrc = dSrc;
        src(dSrc, true, imp.length + " mapped hard-surface polygons near the lot");
      }).catch(function (e) { src("City of Seattle impervious surface (2015)", false, e.message); }));
      else jobs.push(osm(env).then(function (o) { osmO = o; src("OpenStreetMap (Overpass API)", true, o.buildings.length + " buildings, " + o.drives.length + " service roads, " + o.parking.length + " parking areas near the lot"); })
        .catch(function (e) { src("OpenStreetMap (Overpass API)", false, e.message + ". Driveways are shown as Unavailable; try again in a minute"); }));
      jobs.push(slope(shape, fr).then(function (sl) { out.slope = sl; src("USGS 3DEP elevation (ImageServer getSamples)", sl.ok, sl.ok ? sl.samples + " slope cells at about " + sl.step + " ft spacing" : sl.note); })
        .catch(function (e) { out.slope = { ok: false, note: e.message }; src("USGS 3DEP elevation", false, e.message); }));
      if (seattle && lotRings) jobs.push(getJSON(EP.seaSteep, { f: "json", geometry: JSON.stringify({ rings: lotRings, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryPolygon", inSR: 4326, spatialRel: "esriSpatialRelIntersects", returnGeometry: true, outSR: 4326, outFields: "OBJECTID" }, true)
        .then(function (j) {
          var feats = (j.features || []).filter(function (f) { return f.geometry && f.geometry.rings; });
          var a = 0;
          if (feats.length) { var c = coverage(lotRings, fr, { buildings: feats.map(function (f) { return { rings: f.geometry.rings }; }), drive: [], hard: [] }); a = c.parts.reduce(function (t, p) { return t + p.sf; }, 0); }
          out.steep = { mapped: feats.length > 0, sf: Math.round(a) };
          src("Seattle ECA steep slope areas (40%+)", true, feats.length ? "Mapped on the lot" : "None mapped on the lot");
        }).catch(function (e) { out.steep = null; src("Seattle ECA steep slope areas", false, e.message); }));
      if (king && s.parcel) jobs.push(getJSON(EP.kcParcel, { f: "json", where: "PIN='" + String(s.parcel).replace(/'/g, "") + "'", outFields: "MAJOR,MINOR,PLAT_NAME", returnGeometry: false })
        .then(function (j) { var a = ((j.features || [])[0] || {}).attributes || {}; out.survey = { plat: (a.PLAT_NAME || "").trim(), major: a.MAJOR, minor: a.MINOR }; })
        .catch(function () { out.survey = { plat: "" }; }));

      return Promise.all(jobs).then(function () {
        // Building priority: local authority > OpenStreetMap (if it maps a building here) > Microsoft footprints.
        var touches = function (list) { return list.some(function (b) { var R = proj(b.rings, fr), S = proj(shape, fr); return R[0].some(function (p) { return inPoly(p[0], p[1], S); }) || S[0].some(function (p) { return inPoly(p[0], p[1], R); }); }); };
        if (!gotB && osmO && osmO.buildings.length && touches(osmO.buildings)) { layers.buildings = osmO.buildings; gotB = true; bSrc = "OpenStreetMap building outlines (volunteer mapped)"; }
        if (!gotB && msB) { layers.buildings = msB; gotB = true; bSrc = "Microsoft US Building Footprints (machine-traced from imagery, about 2019-2021)"; }
        if (!gotB && layers.bldFallback) { layers.buildings = layers.bldFallback; gotB = true; bSrc = "City of Seattle impervious surface, building class (2015)"; }
        if (osmO) {
          if (osmO.parking.length) layers.drive = layers.drive.concat(osmO.parking);
          if (osmO.drives.length) layers.driveLines = osmO.drives;
          gotD = true; dSrc = "OpenStreetMap driveways and parking";
        }
        return out.mode === "point" ? pointRows(s, out, layers, fr, gotB, bSrc) : lotRows(s, out, layers, lotRings, fr, gotB, gotD, bSrc, dSrc, hSrc, seattle, parcelName, parcelAuto);
      });
    }).then(function () { slopeFlags(out, seattle); out.ok = true; return out; })
      .catch(function (e) { out.notes.push("Site coverage stopped early: " + e.message); return out; });
  }

  function pointRows(s, out, layers, fr, gotB, bSrc) {
    var x0 = fr.fwd([s.lon, s.lat]), best = null;
    layers.buildings.forEach(function (b) {
      var R = proj(b.rings, fr), d = inPoly(x0[0], x0[1], R) ? 0 : Math.min.apply(null, R[0].map(function (p, i) { return i ? segDist(x0[0], x0[1], R[0][i - 1], p) : Infinity; }));
      if (d <= 50 && (!best || d < best.d)) best = { d: d, sf: ringsArea(R) };
    });
    out.rows = [
      { key: "lot", label: "Lot area", sf: null, conf: "Unavailable", src: "No free public parcel outline was found for this address. Enter it from the deed, plat or county assessor." },
      { key: "house", label: "House footprint (building at the address)", sf: best ? Math.round(best.sf) : null, pct: null, conf: !gotB ? "Unavailable" : best ? (best.d === 0 ? "Medium" : "Low") : "Unavailable", src: !gotB ? "No building footprint layer answered." : best ? bSrc + (best.d ? "; nearest building, " + Math.round(best.d) + " ft from the address point" : "; building under the address point") : "No mapped building within 50 ft of the address point." },
      { key: "garage", label: "Detached garage / accessory building", sf: null, conf: "Unavailable", src: "Needs the lot outline to tell which outbuildings belong to this property." },
      { key: "drive", label: "Driveway and parking", sf: null, conf: "Unavailable", src: "Needs the lot outline." },
      { key: "hard", label: "Walkways, patios, decks and other hardscape", sf: null, conf: "Unavailable", src: "Needs the lot outline." },
      { key: "land", label: "Unclassified open area (not verified landscaping)", sf: null, verifiedLandscape: false, conf: "Unavailable", src: "Needs the lot outline. Not filled in as landscaping." }
    ];
  }

  function lotRows(s, out, layers, lotRings, fr, gotB, gotD, bSrc, dSrc, hSrc, seattle, parcelName, parcelAuto) {
      var c = coverage(lotRings, fr, layers);
      var fromCounty = parcelName === "" && s.lot;
      var lot = fromCounty ? s.lot : Math.round(c.area);
      var lotSrc = fromCounty ? (s.lotSrc || "County assessor") : (parcelName ? "Computed from the " + parcelName + " outline" : "Computed from the county parcel outline");
      out.lot = { sf: lot, src: lotSrc, outlineSf: Math.round(c.area) };
      out.parcelSrc = parcelName || "";
      if (parcelName && !s.lot) { s.lot = lot; s.lotSrc = lotSrc + " (mapped outline, not a survey)"; }
      var house = null, acc = [];
      c.parts.forEach(function (p, i) { p.straddle = p.full > p.sf * 1.25 + 50; if (i === 0) house = p; else acc.push(p); });
      var lowB = /OpenStreetMap|Microsoft/.test(bSrc);
      var rows = [];
      rows.push({ key: "lot", label: "Lot area", sf: lot, pct: 100, conf: fromCounty ? "High" : (out.parcelBig ? "Low" : parcelAuto ? "Medium-low" : "Medium"), src: lotSrc + (Math.abs(c.area - lot) > lot * 0.03 ? ". The mapped outline measures " + Math.round(c.area).toLocaleString("en-US") + " sf." : "") });
      if (!gotB) rows.push({ key: "house", label: "House footprint", sf: null, conf: "Unavailable", src: "No building outline layer answered for this address." });
      else if (!house) rows.push({ key: "house", label: "House footprint", sf: null, conf: "Unavailable", src: bSrc + ": no building outline intersected this lot. That is not a measured house of 0 sf." });
      // Suspect footprint: a machine-traced outline that fills most of the lot, or one that mostly lies outside it.
      var suspect = house && lowB && (house.sf > c.area * 0.8 || house.full > house.sf * 2);
      if (suspect) out.notes.push("The mapped building outline " + (house.sf > c.area * 0.8 ? "covers over 80% of the lot" : "lies mostly outside this lot") + ", which is unusual for a house. It may be merged with neighboring buildings or the lot may be wrong. The house number below is clipped to the lot and marked low confidence; check it on the aerial.");
      if (!gotB) {}
      else if (house) rows.push({ key: "house", label: "House footprint (on this lot)", sf: Math.round(house.sf), pct: pct(house.sf, c.area), conf: suspect ? "Low (suspect outline)" : lowB ? "Medium-low" : "High", src: bSrc + (house.straddle ? ". The mapped building is " + Math.round(house.full).toLocaleString("en-US") + " sf in total and crosses the lot line, so only the part inside this lot is counted." : "") + (/roof/.test(bSrc) ? " Roof outlines include eaves, so this reads a little high." : "") });
      var gar = house ? acc.filter(function (p) { return /garage/i.test(p.note) || (p.sf >= 150 && p.sf <= 1000 && p.full <= house.full * 0.5 && !p.straddle); }) : [];
      var garageLabel;
      if (!gotB) garageLabel = { sf: null, conf: "Unavailable", src: "No building outline layer answered." };
      else if (gar.length) { var gs = gar.reduce(function (t, p) { return t + p.sf; }, 0); garageLabel = { sf: Math.round(gs), conf: gar.some(function (p) { return /garage/i.test(p.note); }) ? "Medium" : "Low (estimated)", src: "Separate building outline" + (gar.length > 1 ? "s" : "") + " on the lot sized like a garage or shed. Public outlines do not say what a building is used for; confirm with the assessor record." }; }
      else garageLabel = { sf: null, conf: "Unavailable", src: "No separate garage building is mapped on this lot. An attached, tuck-under or basement garage sits inside the house footprint and cannot be split out from public outlines. The assessor record lists garage square footage." };
      rows.push({ key: "garage", label: "Detached garage / accessory building", sf: garageLabel.sf, pct: garageLabel.sf != null ? pct(garageLabel.sf, c.area) : null, conf: garageLabel.conf, src: garageLabel.src });
      var otherAcc = acc.filter(function (p) { return gar.indexOf(p) < 0; }).reduce(function (t, p) { return t + p.sf; }, 0);
      if (otherAcc > 0) rows.push({ key: "otherbld", label: "Other buildings", sf: Math.round(otherAcc), pct: pct(otherAcc, c.area), conf: lowB ? "Medium-low" : "Medium", src: bSrc });
      if (!gotD) rows.push({ key: "drive", label: "Driveway and parking", sf: null, conf: "Unavailable", src: "No public driveway or paved-surface layer answered for this address. Left blank, not zero. A survey, a permit plan, or a typed source can fill it." });
      else {
        var est = c.driveEst > 0, mapped = c.drive > 0;
        if (!mapped && !est && !seattle) {
          rows.push({ key: "drive", label: "Driveway and parking", sf: null, conf: "Unavailable", src: dSrc + ". The layer answered and did not map a driveway. Absence is not a measurement of 0. Many residential driveways are missing from OpenStreetMap." });
        } else if (seattle && !mapped && !est) {
          rows.push({ key: "drive", label: "Driveway and parking", sf: 0, measuredZero: true, pct: 0, conf: "Low", src: dSrc + ". The 2015 impervious layer classified no driveway on this lot. Newer paving may exist. This zero is that classification, not a guess." });
        } else {
          rows.push({ key: "drive", label: "Driveway and parking", sf: r10(c.drive + c.driveEst), pct: pct(c.drive + c.driveEst, c.area), conf: seattle ? "Medium" : "Low (estimated)", src: dSrc + (est ? ". About " + r10(c.driveEst) + " sf is a mapped driveway centerline at an assumed 10 ft width." : "") + (seattle ? " Mapped from 2015 aerials; newer paving is not shown." : "") + " Only paving inside the lot lines counts." });
        }
      }
      if (seattle && gotD) rows.push({ key: "hard", label: "Walkways, patios, decks and other hardscape", sf: r10(c.hard), measuredZero: c.hard === 0, pct: pct(c.hard, c.area), conf: "Medium", src: hSrc + ". Mapped from 2015 aerials; newer work is not shown." });
      else rows.push({ key: "hard", label: "Walkways, patios, decks and other hardscape", sf: null, conf: "Unavailable", src: "No free public walkway or patio layer covers this address. Left blank, not zero." });
      var driveRow = rows.filter(function (row) { return row.key === "drive"; })[0];
      var hardRow = rows.filter(function (row) { return row.key === "hard"; })[0];
      var buildingsKnown = !!(gotB && house);
      var hardKnown = !!(driveRow && driveRow.sf != null && hardRow && hardRow.sf != null);
      var verifiedLand = buildingsKnown && hardKnown;
      var buildingSf = 0;
      if (house) buildingSf += house.sf;
      rows.forEach(function (row) { if ((row.key === "garage" || row.key === "otherbld") && row.sf != null) buildingSf += row.sf; });
      var landSf = null;
      if (buildingsKnown) landSf = r10(verifiedLand ? c.land : Math.max(0, c.area - buildingSf));
      rows.push({
        key: "land",
        label: verifiedLand ? "Remaining landscape (softscape)" : "Unclassified open area (not verified landscaping)",
        verifiedLandscape: verifiedLand,
        sf: landSf,
        pct: landSf != null ? pct(landSf, c.area) : null,
        conf: !buildingsKnown ? "Unavailable" : verifiedLand ? "Medium" : "Low",
        src: !buildingsKnown ? "Building coverage is not measured, so open area is not computed from a zero house." : verifiedLand ? "Lot area minus mapped buildings and classified hard surfaces. Planning estimate, not a survey." : "Lot area minus mapped building coverage only. Driveway, walks, patios, or eaves are not all known, so this number is not landscaping."
      });
      out.rows = rows;
      out.coverage = { step: Math.round(c.step * 10) / 10 };
  }

  /* Generic slope bands for places without a coded steep-slope critical-area layer. */
  function slopeFlags(out, seattle) {
    var sl = out.slope; out.flags = [];
    if (!sl || !sl.ok) return;
    if (sl.pct40 >= 10) out.flags.push("40%+ ground on about " + sl.pct40 + "% of the area. Most US jurisdictions treat 40% as a steep slope or landslide hazard area; expect a geotechnical report.");
    else if (sl.pct25 >= 10) out.flags.push("25%+ ground on about " + sl.pct25 + "% of the area. Many codes start steep slope review between 25% and 40%, and grading permits get stricter.");
    else if (sl.mean >= 10) out.flags.push("Moderate slope (average " + sl.mean + "%). Plan for retaining walls, drainage and possibly a grading permit.");
    else out.flags.push("Gentle ground (average " + sl.mean + "%). Slope is unlikely to drive the design.");
    if (!seattle) out.flags.push("These are generic slope bands, not a critical-area determination. Check the local critical areas or hillside ordinance.");
  }

  /* ---------- report page ---------- */
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function n(v) { return Number(v).toLocaleString("en-US"); }
  function renderHTML(r, s) {
    if (!r) return '<p class="bh-muted">Site coverage was not measured.</p>';
    var h = "<h3>What is house, garage, driveway and landscape</h3>";
    if (r.warn) h += '<p class="bh-verify" role="alert"><strong>' + esc(r.warn) + "</strong></p>";
    if (r.rows.length) {
      h += '<table class="bh-table bh-land"><thead><tr><th scope="col">Area</th><th scope="col">Square feet</th><th scope="col">Share of lot</th><th scope="col">Confidence</th><th scope="col">Source</th></tr></thead><tbody>' + r.rows.map(function (x) {
        return "<tr><th scope=\"row\">" + esc(x.label) + "</th><td data-label=\"Square feet\">" + (x.sf == null ? '<span class="bh-tbd">Unavailable</span>' : n(x.sf) + " sf") + "</td><td data-label=\"Share of lot\">" + (x.pct == null ? "none" : x.pct + "%") + "</td><td data-label=\"Confidence\">" + esc(x.conf) + "</td><td data-label=\"Source\">" + esc(x.src) + "</td></tr>";
      }).join("") + "</tbody></table>";
    }
    var landRow = (r.rows || []).filter(function (x) { return x.key === "land" && x.verifiedLandscape === false && x.sf != null; })[0];
    if (landRow) h += '<p class="bh-verify">The open-area figure is not verified landscaping. Paving, patios, or eaves may be inside it.</p>';
    r.notes.forEach(function (t) { h += '<p class="bh-verify">' + esc(t) + "</p>"; });
    h += "<h3>Slope</h3>";
    var sl = r.slope;
    if (sl && sl.ok) {
      h += '<table class="bh-table"><tr><th scope="row">Average slope across the lot</th><td>' + sl.mean + "% (median " + sl.median + "%)</td></tr>" +
        '<tr><th scope="row">Steepest part</th><td>' + sl.p95 + "% (95th percentile); single steepest cell " + sl.max + "%, often a wall, rockery or building edge</td></tr>" +
        '<tr><th scope="row">Share of lot at 15%+ / 25%+ / 40%+</th><td>' + sl.pct15 + "% / " + sl.pct25 + "% / " + sl.pct40 + "%</td></tr>" +
        '<tr><th scope="row">Ground elevation range</th><td>' + n(sl.elevMin) + " to " + n(sl.elevMax) + " ft (" + (sl.elevMax - sl.elevMin) + " ft of fall)</td></tr>" +
        '<tr><th scope="row">Estimated surface fall</th><td>' + (sl.fallCompass && sl.fallCompass !== "flat" ? "Toward the " + esc(sl.fallCompass) + (sl.fallDeg != null ? " (about " + sl.fallDeg + " degrees clockwise from north)" : "") + ", average gradient about " + sl.fallPct + "%." : "The sample grid is nearly flat, so no single downhill direction stands out.") + " This is the average bare-earth fall of the same 3DEP samples. On a lot that rises and then falls, the directions can cancel. It is not a flow path, ditch, or pipe.</td></tr>" +
        '<tr><th scope="row">Source</th><td>USGS 3DEP bare-earth lidar, ' + (sl.res ? sl.res + " m" : "best available") + " resolution, sampled every " + sl.step + " ft. Confidence: medium. Lidar is bare earth, so slopes at retaining walls and building edges read steep. A topographic survey sets the real grades. This table does not save a surface, and contour and aspect pictures are not shown. It does not size drainage.</td></tr></table>";
    } else {
      var slopeHint = (s && s.stateAbbr === "WA")
        ? ' The <a href="' + LINKS.dnrLidar + '" target="_blank" rel="noopener">WA DNR lidar portal</a> has the same ground data to view by hand.'
        : ' The USGS 3DEP viewer or the local county GIS site has the same ground data to view by hand.';
      h += '<p class="bh-verify">Slope is unavailable: ' + esc(sl && sl.note || "the elevation service did not answer") + '.' + slopeHint + '</p>';
    }
    (r.flags || []).forEach(function (t) { h += '<p class="bh-muted">' + esc(t) + "</p>"; });
    if (r.steep) h += '<p>' + (r.steep.mapped ? '<strong>Seattle ECA steep slope (40%+) is mapped on about ' + n(r.steep.sf) + " sf of this lot.</strong> Work there needs SDCI steep slope review and usually a geotechnical report." : "No Seattle ECA steep slope area (40%+) is mapped on this lot.") + "</p>";
    else if (sl && sl.ok && sl.pct40 > 0) h += "<p>About " + sl.pct40 + "% of the lot reads 40% or steeper from lidar. Ask the jurisdiction whether a steep slope critical area applies.</p>";
    h += "<h3>Survey and plat</h3>";
    var sv = r.survey;
    if (r.parcelSrc) h += "<p>Lot outline from " + esc(r.parcelSrc) + ". Mapped parcel lines are approximate and are not a survey.</p>";
    if (sv && sv.plat) h += "<p>Recorded plat on the county record: <strong>" + esc(sv.plat) + "</strong>" + (sv.major ? " (plat number " + esc(sv.major) + ")" : "") + '. Search the plat and any recorded surveys by that name in the <a href="' + LINKS.kcRecorder + '" target="_blank" rel="noopener">King County Recorder (Landmark Web)</a>. We did not find a published survey drawing, and we do not draw one.</p>';
    else if (/^Snohomish/.test(s && s.county || "")) h += '<p>Search recorded plats and surveys in <a href="' + LINKS.snoRecorder + '" target="_blank" rel="noopener">Snohomish County recorded documents</a>. We did not find a published survey drawing, and we do not draw one.</p>';
    else if (/^King/.test(s && s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA")) h += '<p>No plat name was on the public parcel record. Recorded surveys can be searched at the <a href="' + LINKS.kcRecorder + '" target="_blank" rel="noopener">King County Recorder</a>.</p>';
    else h += "<p>Recorded plats and surveys are kept by the county recorder (sometimes called the register of deeds or clerk) for " + esc(s && s.county || "this county") + ". We did not find a published survey drawing, and we do not draw one.</p>";
    h += '<p class="bh-muted">Measured by sampling the county parcel outline every ' + (r.coverage ? r.coverage.step : 1) + " ft and assigning each point to one class (building, then driveway, then hardscape, then landscape). Planning estimate only; a site survey is the authority.</p>";
    return h;
  }

  var api = { analyze: analyze, renderHTML: renderHTML, fallFromGradient: fallFromGradient, _coverage: coverage, _frame: frame };
  // Always expose on the browser global. A stray CommonJS `module` shim must not
  // steal the export or Generate shows "landscape calculator script did not load".
  root.BuildHereLandscape = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
