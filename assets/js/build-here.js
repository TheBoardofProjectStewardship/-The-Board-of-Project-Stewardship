/* What can I build here? Address lookup, report builder and red flags.
   Runs fully in the browser against free public GIS services. */
(function () {
  "use strict";
  var R = window.BuildHereRules;
  var fmt = R.fmt;
  var TIMEOUT = 20000;

  /* Page configuration. Every value that ties these files to one site lives here, so the same
     files can run embedded on another site. Set window.BuildHereConfig before the scripts load
     and name only the keys that differ, for example:
       window.BuildHereConfig = {
         dataBase: "https://example.com/wp-content/uploads/build-here/data/",
         massingUrl: "/lot-massing-sketch/",
         siteBase: "https://example.com/",
         brand: "Example Builders",
         links: { permits: "/permits/", bids: "", additions: "", customHomes: "", howWeRank: "" },
         showRankingsCta: false,
         parcelDiscovery: false,
         geocodeUrl: "/wp-json/example/v1/geocode",
         services: { esriGeocoder: false, worldImagery: true, googleMap: true, openStreetMap: true, msFootprints: true }
       };
     The defaults below are this site's values, so nothing changes here. An empty link is left out.
     services: each outside service the page calls beyond the county, city, state and federal map servers
     can be turned off. What it feeds is then marked unavailable, never guessed.
     geocodeUrl: a same-origin address that takes POST {"address": "..."} and returns the US Census geocoder's
     JSON. Without it the Census is called with a script tag (JSONP), because the Census sends no CORS header. */
  var CFG = (function () {
    var d = {
      dataBase: "/assets/data/",
      massingUrl: "/build-here-3d.html",
      siteBase: "https://boardofprojectstewardship.com/",
      brand: "Board of Project Stewardship",
      permitHubLabel: "The Board permit hub",
      links: { permits: "./permits.html", bids: "./bid-comparison.html", additions: "./additions.html", customHomes: "./custom-homes.html", howWeRank: "./how-we-rank.html" },
      showRankingsCta: true,
      cta: null,          // { heading, text, buttons: [{ label, url, ghost }] } replaces the rankings call to action
      contactLine: "",    // one plain line for the foot of the saved study, such as a name, phone and web address
      leadEmail: "editorial@boardofprojectstewardship.com",
      leadSource: "",     // "Sent from ..." in the lead message; the page address when empty
      allowSample: false, // ?sample=1 draws a labeled sample study; off except on a local test server
      geocodeUrl: "",
      services: { esriGeocoder: true, worldImagery: true, googleMap: true, openStreetMap: true, msFootprints: true }
    };
    var o = window.BuildHereConfig || {}, k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k) && k !== "links" && k !== "services") d[k] = o[k];
    if (o.links) for (k in o.links) if (Object.prototype.hasOwnProperty.call(o.links, k)) d.links[k] = o.links[k];
    if (o.services) for (k in o.services) if (Object.prototype.hasOwnProperty.call(o.services, k)) d.services[k] = o.services[k];
    return d;
  })();
  /* Where the tool's markup lives. On this site that is the page. An embed passes root, a shadow root that
     keeps the host theme's styles and the tool's styles apart, and ids are then looked up inside it. */
  /* A link from configuration: a relative path or an http(s) address. Any other scheme is dropped. */
  function linkUrl(u) { u = String(u == null ? "" : u).trim(); return /^[a-z][a-z0-9+.-]*:/i.test(u) && !/^https?:\/\//i.test(u) ? "" : u; }
  (function () { for (var k in CFG.links) if (Object.prototype.hasOwnProperty.call(CFG.links, k)) CFG.links[k] = linkUrl(CFG.links[k]); CFG.massingUrl = linkUrl(CFG.massingUrl); })();
  var ROOT = CFG.root && CFG.root.getElementById ? CFG.root : document;
  var $ = function (id) { return ROOT.getElementById(id); };
  var SEED_KEY = CFG.seedKey || "bh3dSeed";

  var EP = {
    census: "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress",
    kcParcel: "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query",
    kcZoning: "https://gismaps.kingcounty.gov/arcgis/rest/services/Planning/KingCo_Zoning/MapServer/1/query",
    kenGis: "https://gwa.kenmorewa.gov/arcgis/rest/services/",
    kcSensitive: "https://gismaps.kingcounty.gov/arcgis/rest/services/Environment/KingCo_SensitiveAreas/MapServer/",
    kcAerial: "https://gismaps.kingcounty.gov/arcgis/rest/services/BaseMaps/KingCo_Aerial_2025/MapServer/export",
    seaZoning: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0/query",
    seaParcel: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/ADUniverse_parcels/FeatureServer/0/query",
    seaEca: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Environmentally_Critical_Areas_ECA/FeatureServer/",
    seaPermits: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Residential_Building_Permits_Issued_and_Final/FeatureServer/0/query",
    snoParcel: "https://gis.snoco.org/sas/rest/services/SAS_Services/SAS_Parcels/MapServer/0/query",
    snoSales: "https://services6.arcgis.com/z6WYi9VRHfgwgtyW/arcgis/rest/services/Recent_Property_Sales/FeatureServer/0/query",
    snoHost: "https://gis.snoco.org/host/rest/services/Hosted/",
    snoSlope: "https://gis.snoco.org/sas/rest/services/SAS_Services/SAS_Steep_Slopes/MapServer/0/query",
    snoAerial: "https://gis.snoco.org/sas/rest/services/SAS_Services/SAS_Imagery_2024/MapServer/export",
    worldImagery: "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export",
    edmZoning: "https://maps.edmondswa.gov/gis/rest/services/DevServices/Zoning/MapServer/5/query",
    esriGeo: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
    snoCities: "https://gis.snoco.org/sas/rest/services/SAS_Services/SAS_Cities/MapServer/0/query"
  };

  var LINKS = {
    seaPortal: "https://services.seattle.gov/portal/",
    seaSdci: "https://www.seattle.gov/sdci/permits",
    kcPortal: "https://aca-prod.accela.com/KINGCO/Default.aspx",
    mbp: "https://permitsearch.mybuildingpermit.com/",
    snoPds: "https://snohomishcountywa.gov/2908/Residential",
    edmDev: "https://www.edmondswa.gov/government/departments/development_services"
  };

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* Only http and https links are ever written into an href. A value from a map service is data. */
  function safeUrl(u) { u = String(u == null ? "" : u).trim(); return /^https?:\/\//i.test(u) ? u : ""; }
  function qs(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); }).join("&"); }
  function getJSON(url, params) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, TIMEOUT);
    var q = qs(params);
    // Long geometry queries go by POST: ArcGIS Online answers 404 to long GET URLs.
    var req = q.length > 1800 ? fetch(url, { method: "POST", body: q, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ctl.signal }) : fetch(url + "?" + q, { signal: ctl.signal });
    return req.finally(function () { clearTimeout(t); }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) { if (j && j.error) throw new Error(j.error.message || "service error"); return j; });
  }
  function jsonp(url, params) {
    return new Promise(function (resolve, reject) {
      var name = "bhcb" + Math.random().toString(36).slice(2);
      var s = document.createElement("script");
      var done = false;
      var timer = setTimeout(function () { finish(); reject(new Error("timeout")); }, TIMEOUT);
      function finish() { done = true; clearTimeout(timer); try { delete window[name]; } catch (e) { window[name] = undefined; } s.remove(); }
      window[name] = function (data) { if (done) return; finish(); resolve(data); };
      params.format = "jsonp"; params.callback = name;
      s.src = url + "?" + qs(params);
      s.onerror = function () { if (!done) { finish(); reject(new Error("network")); } };
      document.head.appendChild(s);
    });
  }
  function ptQuery(lon, lat, extra) {
    return Object.assign({ f: "json", geometry: lon + "," + lat, geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects", returnGeometry: false, outFields: "*" }, extra || {});
  }
  function polyQuery(rings, extra) {
    var n = rings.reduce(function (a, r) { return a + r.length; }, 0);
    var geom, type;
    if (n > 150) { var b = bbox(rings); geom = b.join(","); type = "esriGeometryEnvelope"; }
    else { geom = JSON.stringify({ rings: rings, spatialReference: { wkid: 4326 } }); type = "esriGeometryPolygon"; }
    return Object.assign({ f: "json", geometry: geom, geometryType: type, inSR: 4326, spatialRel: "esriSpatialRelIntersects", returnGeometry: false }, extra || {});
  }
  function bbox(rings) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    rings.forEach(function (r) { r.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); }); });
    return b;
  }
  /* Local planar frame in feet around a reference latitude. */
  function toFeet(rings, lat0, lon0) {
    var k = Math.PI / 180, R = 20925646; // earth radius in feet
    return rings.map(function (r) { return r.map(function (p) { return [(p[0] - lon0) * k * R * Math.cos(lat0 * k), (p[1] - lat0) * k * R]; }); });
  }
  function ringArea(r) { var a = 0; for (var i = 0, j = r.length - 1; i < r.length; j = i++) a += r[i][0] * r[j][1] - r[j][0] * r[i][1]; return a / 2; }
  function polyAreaSqft(rings) {
    var b = bbox(rings), lat0 = (b[1] + b[3]) / 2, lon0 = (b[0] + b[2]) / 2;
    var total = 0; // signed areas: ArcGIS outer rings and holes wind opposite ways
    toFeet(rings, lat0, lon0).forEach(function (r) { total += ringArea(r); });
    return Math.abs(total);
  }
  function merc(lon, lat) { var k = Math.PI / 180, R = 6378137; return [R * lon * k, R * Math.log(Math.tan(Math.PI / 4 + lat * k / 2))]; }
  function inRing(pt, ring) {
    var x = pt[0], y = pt[1], ins = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  function distToRings(pt, rings) {
    var best = Infinity;
    rings.forEach(function (r) { for (var i = 0; i < r.length - 1; i++) best = Math.min(best, segDist(pt, r[i], r[i + 1])); });
    return best;
  }
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1);
    t = Math.max(0, Math.min(1, t));
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }

  /* ---------- data model ---------- */
  var state = null;
  function blank() {
    return { input: "", matched: "", lon: null, lat: null, county: "", city: "", juris: "other", jurisLabel: "", parcel: "", assessorUrl: "", lot: null, lotSrc: "", zone: "", zoneSrc: "", existing: null, existingSrc: "", existingAsOf: "", existingFile: "", footprint: null, footprintSrc: "", footprintKind: "", firstFloor: null, firstFloorSrc: "", garageFloor: null, garageFloorSrc: "", yearBuilt: "", yearSrc: "", rings: null, hazards: [], hazardNotes: [], nearNotices: [], frontDir: "", permits: [], permitSearch: "none", permitNote: "", permitLinks: [], imagery: null, sources: [], manual: [], prepared: "", factAttempts: [], gen: 0 };
  }
  function log(s, ok, name, note, how) { var x = { name: name, ok: ok, note: note || "" }; if (how) x.how = how; s.sources.push(x); }
  /* Year built can come from several records, and they answer in any order. Each one is kept. The oldest
     is the year shown, because the question the study asks of it is whether old materials may be in the
     house. Seattle's record names the newest building on the lot, so a 2015 backyard cottage used to
     hide a 1925 house and its asbestos and lead-paint flag. */
  function noteYear(s, y, src) {
    var n = Math.round(Number(y));
    if (!isFinite(n) || n < 1800 || n > new Date().getFullYear() + 1) return false;
    s.years = s.years || [];
    if (!s.years.some(function (r) { return r.y === n && r.src === src; })) s.years.push({ y: n, src: src });
    s.years.sort(function (a, b) { return a.y - b.y || (a.src < b.src ? -1 : a.src > b.src ? 1 : 0); });
    s.yearBuilt = String(s.years[0].y); s.yearSrc = s.years[0].src;
    return true;
  }

  /* ---------- lookup pipeline ---------- */
  function titleCase(t) { return String(t || "").toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }).replace(/^Seatac$/, "SeaTac"); }
  function setJuris(s) {
    var key = R.cityKey(s.city);
    s.cityKey = "";
    if (s.stateAbbr && s.stateAbbr !== "WA") { s.juris = "outside"; s.jurisLabel = (s.city ? s.city + ", " : "") + (s.county ? s.county + ", " : "") + (s.stateName || s.stateAbbr); s.cityKey = ""; return; }
    if (/^King/.test(s.county)) s.juris = s.city === "Seattle" ? "seattle" : s.city === "Kenmore" ? "kenmore" : (s.city ? "other" : "kc");
    else if (/^Snohomish/.test(s.county)) s.juris = s.city === "Edmonds" ? "edmonds" : (s.city ? "other" : "sno");
    else s.juris = "outside";
    if (s.juris === "other" && R.CITY[key]) { s.juris = "city"; s.cityKey = key; s.city = R.CITY[key].name; }
    s.jurisLabel = s.city ? "City of " + s.city + ", " + s.county : (s.county ? "Unincorporated " + s.county : "Unknown");
  }
  function censusGeocode(address) {
    var direct = function () { return jsonp(EP.census, { address: address, benchmark: "Public_AR_Current", vintage: "Current_Current", layers: "States,Counties,Incorporated Places" }); };
    if (!CFG.geocodeUrl) return direct();
    // A same-origin relay asks the Census for JSON on the server. No script from another origin runs in the
    // page, so a strict script-src policy can stay on. POST keeps the address out of server access logs.
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, TIMEOUT);
    return fetch(CFG.geocodeUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: address }), credentials: "omit", signal: ctl.signal })
      .finally(function () { clearTimeout(t); })
      .then(function (r) {
        if (r.status === 400) throw new Error("census nomatch"); // the relay will not forward text that is not an address
        if (r.status === 429) throw new Error("too many lookups from this connection, wait a minute");
        if (!r.ok) throw new Error("relay HTTP " + r.status);
        return r.json();
      })
      .catch(function (e) {
        // A relay that is closed to visitors or down is not the visitor's problem: ask the Census from the browser.
        if (/^(census nomatch|too many)/.test(e.message) || CFG.geocodeFallback === false) throw e;
        return direct();
      });
  }
  function geocode(s, address) {
    return censusGeocode(address)
      .then(function (j) {
        var m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
        if (!m) throw new Error("census nomatch");
        log(s, true, "US Census geocoder");
        s.matched = m.matchedAddress; s.lon = m.coordinates.x; s.lat = m.coordinates.y;
        var g = m.geographies || {};
        s.county = ((g.Counties || [])[0] || {}).NAME || "";
        var st = (g.States || [])[0] || {}; s.stateAbbr = st.STUSAB || ""; s.stateName = st.NAME || "";
        s.city = (((g["Incorporated Places"] || [])[0] || {}).NAME || "").replace(/ city$| town$/i, "");
      })
      .catch(function (first) {
        var noMatch = first && first.message === "census nomatch";
        if (CFG.services.esriGeocoder === false) {
          log(s, false, "US Census geocoder", noMatch ? "No match for that address." : "The service did not answer: " + (first && first.message));
          throw new Error(noMatch ? "nomatch" : (first && /^too many/.test(first.message) ? first.message : "the address service did not answer"));
        }
        // Second try: the Esri World geocoder. It gives the county but only the postal city, so the city comes from the county parcel or city layer next.
        return getJSON(EP.esriGeo, { SingleLine: address, f: "json", outFields: "Subregion,Region,RegionAbbr,Addr_type", maxLocations: 1, countryCode: "USA" }).then(function (j) {
          var c = (j.candidates || [])[0];
          var kind = c && c.attributes ? String(c.attributes.Addr_type || "") : "";
          // A street-name, postal or city centroid is not this address. Only an address-level match goes on.
          if (!c || c.score < 85 || !/^(PointAddress|Subaddress|StreetAddress)$/.test(kind)) { log(s, false, "Address geocoders (US Census, Esri World)", "No street-address match for that address."); throw new Error("nomatch"); }
          log(s, true, "Esri World geocoder (the US Census geocoder had no match)");
          s.matched = c.address; s.lon = c.location.x; s.lat = c.location.y;
          s.county = c.attributes.Subregion || ""; s.city = ""; s.cityFromParcel = true;
          s.stateName = c.attributes.Region || ""; s.stateAbbr = /^Washington$/.test(s.stateName) ? "WA" : (c.attributes.RegionAbbr || "");
        });
      });
  }
  /* The county records say which city a parcel is in: the King County parcel
     layer has CTYNAME, and Snohomish County publishes city limits. */
  function cityCheck(s) {
    if (/^King/.test(s.county) && s.kcCity !== undefined) {
      var k = s.kcCity ? titleCase(s.kcCity) : "";
      if (k !== s.city && (k || s.cityFromParcel || s.parcel)) s.city = k;
      setJuris(s); return Promise.resolve();
    }
    if (/^Snohomish/.test(s.county) && s.lon != null) {
      return getJSON(EP.snoCities, ptQuery(s.lon, s.lat, { outFields: "NAME" })).then(function (j) {
        var f = (j.features || [])[0];
        s.city = f ? titleCase(f.attributes.NAME) : "";
        log(s, true, "Snohomish County city limits (SAS_Cities)");
        setJuris(s);
      }).catch(function (e) { log(s, false, "Snohomish County city limits", e.message); setJuris(s); });
    }
    setJuris(s); return Promise.resolve();
  }
  var lookupGen = 0;
  function lookup(address) {
    var gen = ++lookupGen;
    var s = blank(); s.input = address; s.gen = gen;
    function live() { return gen === lookupGen; }
    if (live()) setStatus("Looking up the address...");
    try { sessionStorage.removeItem(SEED_KEY); } catch (e) {} // a failed lookup must not leave the last lot behind
    var slow = setTimeout(function () { if (live()) setStatus("Still reading public map layers" + (s.matched ? " for " + s.matched : "") + ". A layer that stays slow is dropped after about 30 seconds and its rows are marked unavailable."); }, 10000);
    return geocode(s, address)
      .then(function () {
        setJuris(s);
        if (s.gen === lookupGen) setStatus("Found " + s.matched + ". Reading parcel records...");
        if (s.juris === "outside") return s;
        if (/^King/.test(s.county)) return kingParcel(s);
        if (/^Snohomish/.test(s.county)) return snoParcel(s);
        return s;
      })
      .then(function () { return cityCheck(s); })
      .then(function () { return Promise.all([zoning(s), hazards(s), permits(s), extras(s), neighbors(s), landscape(s), kingLivingSqft(s), snoBuildingFacts(s)]); })
      .then(function () { clearTimeout(slow); if (s.gen !== lookupGen) return null; recordFactGaps(s); buildImagery(s); return s; })
      .catch(function (e) {
        clearTimeout(slow);
        if (s.gen !== lookupGen) return null;
        if (e && e.message === "nomatch") return s;
        log(s, false, "Lookup", "Stopped early: " + (e && e.message));
        if (!s.matched) s.lookupError = (e && e.message) || "no answer"; // a service that is down is not "no such address"
        return s;
      });
  }

  /* Site coverage and landscape split (assets/js/build-here-landscape.js). */
  function landscape(s) {
    var L = window.BuildHereLandscape;
    function emptyLandscape(note) {
      return { rows: [], notes: note ? [note] : [], sources: [], slope: { ok: false, note: note || "unavailable" }, flags: [], warn: "" };
    }
    if (!L) {
      s.landscape = emptyLandscape("The landscape calculator script did not load. Refresh the page and try again.");
      log(s, false, "Site coverage and slope", "build-here-landscape.js missing");
      return Promise.resolve();
    }
    if (s.lon == null) {
      s.landscape = emptyLandscape("No geocoded point, so house / driveway / landscape / slope could not be measured.");
      return Promise.resolve();
    }
    if (!s.gen || s.gen === lookupGen) setStatus("Measuring house, driveway, landscape and slope...");
    return L.analyze(s).then(function (r) {
      s.landscape = r || emptyLandscape("Landscape analyze returned no result.");
      (r && r.sources || []).forEach(function (x) { log(s, x.ok, x.name, x.note, x.how); });
      // analyze() already writes rings / parcel / lot onto s when a public outline is found (state parcel layer or ArcGIS discovery).
      if (r && r.rings && !s.rings) s.rings = r.rings;
      if (r && r.lot && r.lot.sf && !s.lot) { s.lot = r.lot.sf; s.lotSrc = r.lot.src; }
      (r && r.rows || []).forEach(function (row) {
        if (row.key === "house" && row.sf != null && !s.footprint) {
          s.footprint = Math.round(row.sf);
          s.footprintSrc = row.src || "Mapped building footprint";
          s.footprintKind = "roof";
        }
      });
      applyLandscapeSqft(s);
    }).catch(function (e) {
      log(s, false, "Site coverage and slope", e.message);
      s.landscape = emptyLandscape(e.message || "Landscape measurement failed.");
    });
  }

  /* Autofill finished living SF / stories from King County Assessor residential building extract (sharded under /assets/data/kc-resbldg). */
  function kingLivingSqft(s) {
    if (!s.parcel || s.existing) return Promise.resolve();
    if (!/^King/.test(s.county || "") || (s.stateAbbr && s.stateAbbr !== "WA")) return Promise.resolve();
    var pin = String(s.parcel).replace(/\D/g, "");
    if (pin.length !== 10) return Promise.resolve();
    var shard = pin.slice(0, 2), file = "kc-resbldg/" + shard + ".json";
    // A data file that is not there must not stop the study or print a parser message. The folder may not be
    // uploaded yet, a refresh may be half done, or another host may refuse or never answer the request. The
    // house size is then left out, and the reason is given in plain words on the Data sources page and under
    // the box where the visitor can type the figure. When the file is there, it is read exactly as before.
    var WHY = { missing: "was not found", unreadable: "could not be read", error: "could not be loaded" };
    function noFile(why, detail) {
      s.existingFile = why;
      s.factAttempts = s.factAttempts || [];
      s.factAttempts.push({ field: "Finished living area", name: "King County Assessor residential building extract", ok: false, note: "The data file for this parcel (" + file + ") " + WHY[why] + (detail ? " (" + detail + ")" : "") + ". Living area, year built and stories were not filled in from it." });
      log(s, false, "King County living area", "the data file " + WHY[why]);
      return null;
    }
    // The same time limit as every map layer, so a data host that never answers cannot hold the study.
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, TIMEOUT);
    return fetch(CFG.dataBase + file, { credentials: "omit", signal: ctl.signal }).then(function (r) {
      if (!r.ok) return r.status === 404 || r.status === 410 ? noFile("missing") : noFile("error", "HTTP " + r.status);
      // Some hosts answer a missing file with a web page and status 200. The body is read as text first, so
      // a page is told apart from a data file here, and not by a parser message shown to the visitor.
      return r.text().then(function (text) {
        var j = null;
        try { j = JSON.parse(text); } catch (e) { j = null; }
        return j && typeof j === "object" && j.b && typeof j.b === "object" && !Array.isArray(j.b) ? j : noFile("unreadable");
      });
    }).then(function (j) { clearTimeout(timer); return j; }, function (e) {
      clearTimeout(timer);
      return noFile("error", e && e.name === "AbortError" ? "it took longer than " + Math.round(TIMEOUT / 1000) + " seconds" : "");
    }).then(function (j) {
      if (!j) return;
      var rec = j.b[pin];
      if (!rec || !rec[0]) {
        s.factAttempts = s.factAttempts || [];
        s.factAttempts.push({ field: "Finished living area", name: "King County Assessor residential building extract", ok: false, note: "PIN " + pin + " is not in the residential building extract." });
        log(s, false, "King County living area", "PIN " + pin + " not in residential building extract");
        return;
      }
      // The extract has one row per residential building. The index adds the rows of a parcel together
      // (a house and a backyard cottage, say). rec[5] is the number of rows; older index files do not carry it.
      var nB = Number(rec[5]) > 0 ? Number(rec[5]) : 0, many = nB > 1;
      // srcDate is the date on the county file. asOf is the day the index was built from it.
      var fileDay = j.srcDate || j.asOf || "", dayLabel = j.srcDate ? ", county file dated " + j.srcDate : (j.asOf ? ", downloaded " + j.asOf : "");
      s.existing = Math.round(rec[0]);
      s.existingAsOf = fileDay;
      s.existingBuildings = nB;
      s.existingSrc = "King County Assessor residential building extract (SqFtTotLiving" + (many ? ", the sum of " + nB + " building records on this parcel" : "") + ")" + dayLabel;
      s.existingNote = many ? "This parcel has " + nB + " residential building records. The figure is their sum, not one house." : (nB ? "" : "When a parcel has more than one residential building record, this figure is their sum.");
      var age = fileDay ? Math.round((Date.now() - Date.parse(fileDay)) / 86400000) : NaN;
      if (isFinite(age) && age > 120) s.existingNote += (s.existingNote ? " " : "") + "The county file used here is " + age + " days old. A remodel or a new building since then is not in it.";
      if (rec[1]) noteYear(s, rec[1], "King County Assessor residential building extract (YrBuilt" + (many ? ", the earliest of " + nB + " buildings" : "") + ")");
      if (rec[2] && !s.stories) { s.stories = rec[2]; s.storiesSrc = "King County Assessor residential building extract (Stories" + (many ? ", the tallest of " + nB + " buildings" : "") + ")"; }
      if (rec[3]) { s.firstFloor = Math.round(rec[3]); s.firstFloorSrc = "King County Assessor first-floor SF (SqFt1stFloor" + (many ? ", the sum of " + nB + " buildings" : "") + "). Not a roof outline and not living area."; }
      if (rec[4]) { s.garageFloor = Math.round(rec[4]); s.garageFloorSrc = "King County Assessor garage square feet (floor area" + (many ? ", the sum of " + nB + " buildings" : "") + "). Not a detached building footprint."; }
      log(s, true, "King County living area (SqFtTotLiving)", s.existing + " sf");
    }).catch(function (e) { log(s, false, "King County living area", e.message); });
  }

  /* After landscape split, copy mapped footprint / hardscape into form fields when still blank. */
  function applyLandscapeSqft(s) {
    var r = s.landscape;
    if (!r || !r.rows) return;
    var by = {};
    r.rows.forEach(function (row) { by[row.key] = row; });
    if (!s.footprint && by.house && by.house.sf != null) {
      s.footprint = Math.round(by.house.sf);
      s.footprintSrc = by.house.src || "Mapped building footprint";
      s.footprintKind = "roof";
    }
    if (s.imperv == null && by.drive && by.drive.sf != null && by.hard && by.hard.sf != null) {
      var hard = by.drive.sf + by.hard.sf;
      ["house", "garage", "otherbld"].forEach(function (k) { if (by[k] && by[k].sf != null) hard += by[k].sf; });
      s.imperv = Math.round(hard);
      s.impervSrc = "Classified buildings plus driveway and hardscape. Planning estimate, not a survey.";
    }
  }

  function houseAndStreet(matched) {

    var first = String(matched).split(",")[0].trim().toUpperCase();
    var m = first.match(/^(\d+)\s+(.*)$/);
    return m ? { num: m[1], street: m[2], full: first } : { num: "", street: first, full: first };
  }
  function zipOf(matched) { var m = String(matched).match(/(\d{5})\s*$/); return m ? m[1] : ""; }

  /* ---------- choosing the parcel ----------
     A map service returns candidates in no useful order, so the first feature is
     never taken as the answer. Candidates are ranked by distance to the geocoded
     point, an address match beats a location match, and anything short of a clean
     address match is recorded in s.parcelWarn and shown on the first screen. */
  var NEAR_FT = 82; // 25 m
  function parcelDistFt(s, rings) {
    var ft = toFeet(rings, s.lat, s.lon), inside = false;
    ft.forEach(function (r) { if (inRing([0, 0], r)) inside = !inside; });
    return inside ? 0 : distToRings([0, 0], ft);
  }
  function rankParcels(s, feats) {
    return (feats || []).filter(function (f) { return f.geometry && f.geometry.rings && f.geometry.rings.length; })
      .map(function (f) { return { f: f, d: parcelDistFt(s, f.geometry.rings) }; })
      .sort(function (a, b) { return a.d - b.d; });
  }
  /* Parcels whose outline comes within NEAR_FT of the geocoded point, nearest first.
     An envelope query works on every ArcGIS layer; the true distance is measured here. */
  function nearParcels(s, url, fields) {
    var k = Math.PI / 180, dLat = NEAR_FT / (k * 20925646), dLon = dLat / Math.cos(s.lat * k);
    return getJSON(url, { f: "json", geometry: [s.lon - dLon, s.lat - dLat, s.lon + dLon, s.lat + dLat].join(","), geometryType: "esriGeometryEnvelope", inSR: 4326, spatialRel: "esriSpatialRelIntersects", outFields: fields, returnGeometry: true, outSR: 4326 })
      .then(function (j) { return rankParcels(s, j.features).filter(function (c) { return c.d <= NEAR_FT; }); });
  }
  function byLocation(s, url, fields) {
    return nearParcels(s, url, fields).then(function (near) {
      return near.length ? { pick: near[0], how: near[0].d === 0 ? "point" : "nearest", others: near.length - 1 } : null;
    });
  }
  function noteParcelMatch(s, hit, recordAddr) {
    var rec = recordAddr ? " The county record for that lot reads " + recordAddr + "." : "";
    var check = " Check the parcel number before you rely on any number in this study.";
    s.parcelMatch = hit.how;
    s.parcelWarn = "";
    if (hit.how === "nearest") s.parcelWarn = "The county address search did not find this address, so the lot nearest the geocoded point was used (" + Math.round(hit.pick.d) + " ft away" + (hit.others ? ", with " + hit.others + " other lot" + (hit.others > 1 ? "s" : "") + " within " + NEAR_FT + " ft" : "") + ")." + rec + check;
    else if (hit.how === "point") s.parcelWarn = "The county address search did not find this address. The lot under the geocoded point was used." + rec + check;
    else if (hit.others) s.parcelWarn = hit.others + " other parcel record" + (hit.others > 1 ? "s carry" : " carries") + " this street address (unit lots or condominium records). The one nearest the geocoded point was used." + check;
    else if (hit.pick.d > 660) s.parcelWarn = "The county parcel with this address is about " + Math.round(hit.pick.d) + " ft from the geocoded point. Check the parcel number and the aerial.";
  }

  function kingParcel(s) {
    var hs = houseAndStreet(s.matched), zip = zipOf(s.matched);
    var where = "ADDR_FULL LIKE '" + hs.full.replace(/[%_]/g, "").replace(/'/g, "''") + "%'" + (zip ? " AND ZIP5='" + zip + "'" : "");
    var fields = "PIN,ADDR_FULL,CTYNAME,LOTSQFT,KCA_ZONING,PREUSE_DESC";
    return getJSON(EP.kcParcel, { f: "json", where: where, outFields: fields, returnGeometry: true, outSR: 4326 })
      .then(function (j) {
        var byAddr = rankParcels(s, j.features);
        if (!byAddr.length) return byLocation(s, EP.kcParcel, fields);
        // LIKE also returns "123 MAIN ST UNIT B". The exact address wins, then the lot nearest the point.
        var exact = byAddr.filter(function (c) { return String(c.f.attributes.ADDR_FULL || "").trim().toUpperCase() === hs.full; });
        var pool = exact.length ? exact : byAddr;
        return { pick: pool[0], how: "address", others: pool.length - 1 };
      })
      .then(function (hit) {
        if (!hit) { log(s, false, "King County parcels", "No parcel matched."); return; }
        var f = hit.pick.f, a = f.attributes;
        noteParcelMatch(s, hit, String(a.ADDR_FULL || "").trim());
        s.parcel = a.PIN; s.rings = f.geometry && f.geometry.rings;
        s.assessorUrl = "https://blue.kingcounty.com/Assessor/eRealProperty/Detail.aspx?ParcelNbr=" + a.PIN;
        // lotKind tells the coverage table whether the lot area is a record figure or was measured off mapped lines.
        if (a.LOTSQFT) { s.lot = a.LOTSQFT; s.lotSrc = "King County Assessor (LOTSQFT)"; s.lotKind = "record"; }
        else if (s.rings) { s.lot = Math.round(polyAreaSqft(s.rings)); s.lotSrc = "Computed from the county parcel outline (the assessor lot size was blank)"; s.lotKind = "outline"; }
        s.zone = (a.KCA_ZONING || "").trim(); s.zoneSrc = "King County Assessor zoning field";
        s.presentUse = (a.PREUSE_DESC || "").trim();
        s.kcCity = (a.CTYNAME || "").trim();
        log(s, true, "King County parcels (KingCo_PropertyInfo)", hit.how === "address" ? "matched by street address" : "matched by location, not by address");
      })
      .catch(function (e) { log(s, false, "King County parcels", e.message); });
  }

  function snoParcel(s) {
    var hs = houseAndStreet(s.matched), zip = zipOf(s.matched);
    var fields = "PARCEL_ID,Site_House_Number,Site_Address,Site_City,Acres_Gross,Property_Account_Summary";
    var words = hs.street.split(/\s+/).map(function (w) { return w.replace(/[^A-Z0-9]/g, ""); }).filter(function (w) { return /\d/.test(w) || w.length > 3; });
    function hasWord(addr, w) { return new RegExp("(^|[^A-Z0-9])" + w + "([^A-Z0-9]|$)").test(addr); }
    // No house number means no address search: a blank number matches every vacant lot in the ZIP.
    var byNumber = hs.num ? getJSON(EP.snoParcel, { f: "json", where: "Site_House_Number='" + hs.num + "'" + (zip ? " AND Site_Zip LIKE '" + zip + "%'" : ""), outFields: fields, returnGeometry: true, outSR: 4326 }) : Promise.resolve({ features: [] });
    return byNumber
      .then(function (j) {
        // The same house number in the same ZIP is not the same address. Every distinctive word of the
        // street name (a number, or a word longer than three letters) has to be on the county record too.
        // "123 SUNSET BLVD" must not match "123 MAIN BLVD" on the strength of BLVD.
        var byAddr = !words.length ? [] : rankParcels(s, j.features).filter(function (c) {
          var addr = String(c.f.attributes.Site_Address || "").toUpperCase().replace(/'/g, "");
          return words.every(function (w) { return hasWord(addr, w); });
        });
        if (!byAddr.length) return byLocation(s, EP.snoParcel, fields);
        return { pick: byAddr[0], how: "address", others: byAddr.length - 1 };
      })
      .then(function (hit) {
        if (!hit) { log(s, false, "Snohomish County parcels", "No parcel matched."); return; }
        var f = hit.pick.f, a = f.attributes;
        noteParcelMatch(s, hit, String(a.Site_Address || "").trim());
        s.parcel = a.PARCEL_ID; s.rings = f.geometry.rings;
        s.assessorUrl = safeUrl(a.Property_Account_Summary);
        s.lot = Math.round(polyAreaSqft(s.rings)); s.lotSrc = "Computed from the county parcel outline (mapped lines, not a survey)"; s.lotKind = "outline";
        // The parcel record carries an acreage. It was requested and never shown. It is the check on the outline.
        var acres = Number(a.Acres_Gross);
        if (isFinite(acres) && acres > 0) {
          var recSf = Math.round(acres * 43560), gap = Math.abs(recSf - s.lot);
          s.lotRecordSf = recSf;
          s.lotSrc += ". The parcel record lists " + acres + " acres gross, about " + fmt(recSf) + " sf";
          if (gap > Math.max(300, 0.05 * s.lot)) s.lotSrc += ". The two differ by about " + Math.round(gap / s.lot * 100) + "%, so check the lot size before you rely on the caps";
        }
        log(s, true, "Snohomish County parcels (SAS_Parcels)", hit.how === "address" ? "matched by street address" : "matched by location, not by address");
        // The roof footprint is not summed here. The site coverage module reads the same
        // county roof layer, clips each outline to this lot, and keeps the house, a detached
        // garage and other buildings as separate rows. A sum of every roof that touches the
        // lot counted a neighbor's roof in full and counted detached buildings twice.
      })
      .catch(function (e) { log(s, false, "Snohomish County parcels", e.message); });
  }

  /* County-use hold. The Improvement Records item terms cover data from which a
     list of individuals may be compiled, and a PIN joins to owner names on the
     public parcel layer. This flag stays false. The page does not fetch shards.
     FinSize is not finished living area: basement, lower level, and attic
     finished columns are separate and are not added. */
  var SNO_IMPR_ENABLED = false;
  function snoBuildingFacts(s) {
    if (!/^Snohomish/.test(s.county || "") || (s.stateAbbr && s.stateAbbr !== "WA")) return Promise.resolve();
    s.factAttempts = s.factAttempts || [];
    s.factAttempts.push({ field: "Finished living area", name: "Snohomish County parcels (SAS_Parcels)", ok: false, note: "Read the public parcel layer. It has no finished living area, story count, or garage floor-area field." });
    s.factAttempts.push({ field: "Finished living area", name: "Snohomish County appraisal characteristics", ok: false, note: "SAS_Appraisal_Characteristics publishes condition, grade, and land type, not living area." });
    s.factAttempts.push({ field: "Finished living area", name: "Assessor account page", ok: false, note: s.assessorUrl ? "The county link is kept below. An unsigned request does not return building facts, and this tool does not sign in." : "No assessor account link was on the parcel." });
    s.factAttempts.push({ field: "Finished living area", name: "Listing sites", ok: false, note: "Redfin and Zillow are not queried. No supported public endpoint was verified." });
    s.factAttempts.push({
      field: "FinSize",
      name: "Snohomish County Improvement Records",
      ok: false,
      note: SNO_IMPR_ENABLED
        ? "The enable flag is on, and this page still does not load the workbook. Written county or counsel clearance is a separate step. FinSize is not used as finished living area."
        : "Not enabled. This page does not read the county improvement records, so finished living area is not filled in for Snohomish County. Enter it from the assessor record."
    });
    return Promise.resolve().then(function () {
    if (!s.parcel) {
      s.factAttempts.push({ field: "Year built", name: "Snohomish County recent sales (SnocoGIS)", ok: false, note: "No parcel id, so the sales layer was not queried." });
      return;
    }
    var id = String(s.parcel).replace(/'/g, "");
    return getJSON(EP.snoSales, { f: "json", where: "PARCEL_ID='" + id + "'", outFields: "YEAR_BUILT,YEAR_SOLD,IMPRV_TYPE", returnGeometry: false, resultRecordCount: 5 }).then(function (j) {
      var feats = (j.features || []).slice().sort(function (a, b) { return (b.attributes.YEAR_SOLD || 0) - (a.attributes.YEAR_SOLD || 0); });
      if (!feats.length) {
        s.factAttempts.push({ field: "Year built", name: "Snohomish County recent sales (SnocoGIS)", ok: false, note: "No sale row for this parcel, so year built is not filled from sales.", url: "https://services6.arcgis.com/z6WYi9VRHfgwgtyW/arcgis/rest/services/Recent_Property_Sales/FeatureServer/0" });
        return;
      }
      var y = feats[0].attributes.YEAR_BUILT;
      var saleUrl = "https://services6.arcgis.com/z6WYi9VRHfgwgtyW/arcgis/rest/services/Recent_Property_Sales/FeatureServer/0";
      var saleSrc = "Snohomish County recent property sales, YEAR_BUILT on the " + (feats[0].attributes.YEAR_SOLD || "recorded") + " sale. Not the current building card.";
      if (y && noteYear(s, y, saleSrc)) s.factAttempts.push({ field: "Year built", name: "Snohomish County recent sales (SnocoGIS)", ok: true, note: saleSrc, url: saleUrl });
      else s.factAttempts.push({ field: "Year built", name: "Snohomish County recent sales (SnocoGIS)", ok: false, note: y ? "A sale row exists and its YEAR_BUILT (" + y + ") is not a usable year." : "A sale row exists and YEAR_BUILT was blank.", url: saleUrl });
      log(s, true, "Snohomish County recent property sales", feats.length + " sale row" + (feats.length > 1 ? "s" : ""));
    }).catch(function (e) {
      s.factAttempts.push({ field: "Year built", name: "Snohomish County recent sales (SnocoGIS)", ok: false, note: e.message });
      log(s, false, "Snohomish County recent property sales", e.message);
    });
    });
  }
  function recordFactGaps(s) {
    s.factAttempts = s.factAttempts || [];
    var king = /^King/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA");
    var sno = /^Snohomish/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA");
    if (king && s.existing) s.factAttempts.push({ field: "Finished living area", name: "King County Assessor residential building extract", ok: true, note: s.existingSrc || "SqFtTotLiving" });
    if (!king && !sno) {
      s.factAttempts.push({ field: "Finished living area", name: "Local assessor extract", ok: false, note: "Finished living area is read automatically from the King County residential building extract. This place is outside that extract, and no other living-area service is wired." });
      s.factAttempts.push({ field: "Finished living area", name: "Listing sites", ok: false, note: "Redfin and Zillow are not queried. No supported public endpoint was verified." });
    }
  }

  /* Neighboring parcel outlines, used only to tell which lot lines face a street
     (no parcel on the other side) and which are shared with a neighbor. */
  function neighbors(s) {
    if (!s.rings) return Promise.resolve();
    var waNbr = !s.stateAbbr || s.stateAbbr === "WA";
    var url = (waNbr && /^King/.test(s.county || "")) ? EP.kcParcel : (waNbr && /^Snohomish/.test(s.county || "")) ? EP.snoParcel : null;
    if (!url) return Promise.resolve();
    var b = bbox(s.rings), pad = 0.0003;
    return getJSON(url, { f: "json", geometry: [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad].join(","), geometryType: "esriGeometryEnvelope", inSR: 4326, spatialRel: "esriSpatialRelIntersects", outFields: url === EP.kcParcel ? "PIN" : "PARCEL_ID", returnGeometry: true, outSR: 4326 })
      .then(function (j) { s.neighborRings = []; (j.features || []).forEach(function (f) { if (f.geometry && f.geometry.rings) f.geometry.rings.forEach(function (r) { s.neighborRings.push(r); }); }); })
      .catch(function () { s.neighborRings = null; });
  }

  function zoning(s) {
    if (s.lon == null) return Promise.resolve();
    if (s.juris === "seattle") {
      return getJSON(EP.seaZoning, ptQuery(s.lon, s.lat, { outFields: "ZONING,ZONELUT" })).then(function (j) {
        var f = (j.features || [])[0];
        if (f) {
          s.cityZone = String(f.attributes.ZONELUT || f.attributes.ZONING || "").trim();
          log(s, true, "Seattle zoning (Current_Land_Use_Zoning_Detail)");
          // The city's own zoning layer is the authority inside Seattle. The assessor field can lag a rezone,
          // so it is kept only as a note when the two differ.
          if (s.cityZone) {
            if (s.zone && s.zone !== s.cityZone) s.assessorZone = s.zone;
            s.zone = s.cityZone; s.zoneSrc = "City of Seattle zoning map";
          }
        }
      }).catch(function (e) { log(s, false, "Seattle zoning", e.message); });
    }
    if (s.juris === "edmonds") {
      return getJSON(EP.edmZoning, ptQuery(s.lon, s.lat, { outFields: "ZONING" })).then(function (j) {
        var f = (j.features || [])[0];
        if (f) { s.zone = f.attributes.ZONING; s.zoneSrc = "City of Edmonds zoning map"; log(s, true, "Edmonds zoning (DevServices/Zoning)"); }
      }).catch(function (e) { log(s, false, "Edmonds zoning", e.message + ". Enter the zone by hand."); });
    }
    if (s.juris === "kenmore") {
      // No Kenmore zoning layer is read. The zone is the county assessor's field, which can lag a city rezone.
      if (s.zone) s.zoneSrc = "King County Assessor zoning field (check it against the City of Kenmore zoning map)";
      return Promise.resolve();
    }
    if (s.juris === "kc") {
      return getJSON(EP.kcZoning, ptQuery(s.lon, s.lat, { outFields: "CURRZONE" })).then(function (j) {
        var f = (j.features || [])[0];
        if (f && f.attributes.CURRZONE) { s.zone = f.attributes.CURRZONE.trim(); s.zoneSrc = "King County zoning map"; }
        log(s, true, "King County zoning (KingCo_Zoning)");
      }).catch(function (e) { log(s, false, "King County zoning", e.message); });
    }
    if (s.juris === "city") {
      var g = R.CITY[s.cityKey].gis;
      if (!g) {
        if (!s.zone) s.manualZone = true;
        else s.zoneSrc = "King County Assessor zoning field (check it against the " + s.city + " zoning map)";
        return Promise.resolve();
      }
      return getJSON(g.url + "/query", ptQuery(s.lon, s.lat, { outFields: g.field })).then(function (j) {
        var f = (j.features || [])[0], z = f && String(f.attributes[g.field] || "").trim();
        if (z) { s.zone = z; s.zoneSrc = g.name; s.zoneDraft = !!g.draft; }
        log(s, true, g.name);
      }).catch(function (e) { log(s, false, g.name, e.message + ". Enter the zone by hand."); });
    }
    if (s.juris === "sno") {
      var zq = function (svc) { return getJSON(EP.snoHost + svc + "/FeatureServer/0/query", ptQuery(s.lon, s.lat, { outFields: "abbrev,label" })); };
      // PLANNING__zoning is the county's live layer; Current_Zoning_2025 was found empty in Oct 2026 and stays as a fallback.
      return zq("PLANNING__zoning").then(function (j) { return (j.features || []).length ? j : zq("Current_Zoning_2025"); }).then(function (j) {
        var f = (j.features || [])[0];
        if (f) { s.zone = (f.attributes.abbrev || f.attributes.label || "").trim(); s.zoneSrc = "Snohomish County zoning map"; }
        log(s, true, "Snohomish County zoning (PLANNING__zoning)");
      }).catch(function (e) { log(s, false, "Snohomish County zoning", e.message); });
    }
    return Promise.resolve();
  }

  function countHit(url, rings, label, list, s, srcName, where) {
    return getJSON(url, polyQuery(rings, where ? { returnCountOnly: true, where: where } : { returnCountOnly: true })).then(function (j) {
      if (j.count > 0) list.push(label);
    }).catch(function () { s.hazardNotes.push(label + ": layer did not answer (" + srcName + ")"); });
  }
  function hazards(s) {
    var rings = s.rings || (s.lon != null ? [[[s.lon - 0.0001, s.lat - 0.0001], [s.lon + 0.0001, s.lat - 0.0001], [s.lon + 0.0001, s.lat + 0.0001], [s.lon - 0.0001, s.lat + 0.0001], [s.lon - 0.0001, s.lat - 0.0001]]] : null);
    if (!rings) return Promise.resolve();
    var h = s.hazards, jobs = [];
    if (s.juris === "seattle") {
      [[9, "Steep slope (Seattle ECA)"], [7, "Potential slide area (Seattle ECA)"], [1, "Known slide area (Seattle ECA)"], [5, "Liquefaction-prone area (Seattle ECA)"], [10, "Wetland (Seattle ECA)"], [8, "Riparian corridor (Seattle ECA)"], [0, "Flood-prone area (Seattle ECA)"], [6, "Peat settlement-prone area (Seattle ECA)"], [4, "Historical landfill (Seattle ECA)"]].forEach(function (L) {
        jobs.push(countHit(EP.seaEca + L[0] + "/query", rings, L[1], h, s, "Seattle ECA"));
      });
      s.hazardSource = "City of Seattle Environmentally Critical Areas map layers";
    } else if (/^King/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA")) {
      [[1, "Potential landslide hazard (King County 2016)"], [3, "Landslide hazard (King County 1990 map, incorporated areas)"], [4, "Potential steep slope hazard (King County 2016)"], [8, "Seismic hazard (King County 1990 map)"], [7, "Erosion hazard (King County 1990 map)"], [22, "Wetland (National Wetland Inventory 2024)"], [15, "Channel migration hazard area"]].forEach(function (L) {
        jobs.push(countHit(EP.kcSensitive + L[0] + "/query", rings, L[1], h, s, "King County Sensitive Areas"));
      });
      if (s.rings) jobs.push(getJSON(EP.kcSensitive + "12/query", polyQuery(s.rings, { distance: 15, units: "esriSRUnit_Meter", outFields: "PIN,LANDSLIDE,EROSION,STEEPSLOPE,RECORDING_,PERMIT_NO", returnGeometry: false })).then(function (j) {
        (j.features || []).forEach(function (f) {
          var a = f.attributes, what = [a.LANDSLIDE ? "landslide" : "", a.STEEPSLOPE ? "steep slope" : "", a.EROSION ? "erosion" : ""].filter(Boolean).join(", ");
          var txt = (what ? what + "; " : "") + (a.RECORDING_ ? "recording " + a.RECORDING_ : "") + (a.PERMIT_NO ? ", permit " + a.PERMIT_NO : "");
          if (String(a.PIN) === String(s.parcel)) h.push("Sensitive area notice on title for this parcel (" + txt + ")");
          else s.nearNotices.push(what || "sensitive area"); // the kind of notice only: not the neighbor's parcel, recording or permit number
        });
      }).catch(function () { s.hazardNotes.push("Sensitive area notices: layer did not answer"); }));
      s.hazardSource = "King County Sensitive Areas map service";
      if (s.juris === "kenmore" && s.rings) {
        s.hazardSource += " and City of Kenmore critical area and shoreline maps";
        jobs.push(getJSON(EP.kenGis + "Shoreline_Designations/FeatureServer/0/query", polyQuery(s.rings, { outFields: "env_des_LF,Env_Des" })).then(function (j) {
          var f = (j.features || [])[0];
          if (f) { s.shoreline = (f.attributes.env_des_LF || f.attributes.Env_Des || "").trim(); h.push("Kenmore shoreline jurisdiction (" + s.shoreline + " environment, Shoreline Master Program)"); }
        }).catch(function () { s.hazardNotes.push("Kenmore shoreline map did not answer"); }));
        [[3, "Landslide hazard (City of Kenmore critical areas map)", "Class"], [1, "Erosion hazard (City of Kenmore critical areas map)"], [4, "Seismic hazard (City of Kenmore critical areas map)"], [0, "Stream (City of Kenmore critical areas map)"], [5, "Wetland (City of Kenmore critical areas map)"]].forEach(function (L) {
          jobs.push(getJSON(EP.kenGis + "Critical_Areas/FeatureServer/" + L[0] + "/query", polyQuery(s.rings, { outFields: "*" })).then(function (j) {
            var fs = j.features || []; if (!fs.length) return;
            var cls = L[2] ? fs.map(function (f) { return f.attributes[L[2]]; }).filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; }) : [];
            h.push(L[1] + (cls.length ? ": " + cls.join(", ") : ""));
          }).catch(function () { s.hazardNotes.push(L[1] + ": layer did not answer"); }));
        });
        if (s.parcel) jobs.push(getJSON(EP.kenGis + "Impervious_Surface_by_Parcel_2024/FeatureServer/0/query", { f: "json", where: "PIN='" + String(s.parcel).replace(/'/g, "") + "'", outFields: "SUM_impervious_area_update,impervious_percent", returnGeometry: false }).then(function (j) {
          var f = (j.features || [])[0];
          if (f && f.attributes.SUM_impervious_area_update) { s.imperv = Math.round(f.attributes.SUM_impervious_area_update); s.impervSrc = "City of Kenmore impervious surface by parcel (the city's 2024 layer)"; log(s, true, "City of Kenmore impervious surface by parcel"); }
        }).catch(function () {}));
      }
    } else if (/^Snohomish/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA")) {
      jobs.push(countHit(EP.snoSlope, rings, "Steep slope 33% or more (county map)", h, s, "SAS_Steep_Slopes"));
      [["TOPOGRAPHY__LANDSLIDE__county_lha_model", "Landslide hazard area (county model)"], ["ENVIRONMENTAL__wetlands", "Mapped wetland"], ["ENVIRONMENTAL__fema_flood", "FEMA special flood hazard area (100-year floodplain)", 1, "sfha_tf='T'"]].forEach(function (L) {
        jobs.push(countHit(EP.snoHost + L[0] + "/FeatureServer/" + (L[2] || 0) + "/query", rings, L[1], h, s, L[0], L[3]));
      });
      s.hazardSource = "Snohomish County hosted environmental layers";
    }
    if (!jobs.length) return Promise.resolve(); // no hazard layer is read for this place, so none is listed as read
    return Promise.all(jobs).then(function () { log(s, s.hazardNotes.length === 0, s.hazardSource || "Hazard layers", s.hazardNotes.join("; ")); });
  }

  function permits(s) {
    if (s.juris === "seattle") {
      s.permitLinks = [{ label: "Seattle Services Portal (search by address for permits and records)", url: LINKS.seaPortal }, { label: "SDCI permits and records help", url: LINKS.seaSdci }];
      if (!s.rings) return Promise.resolve();
      return getJSON(EP.seaPermits, polyQuery(s.rings, { outFields: "PRMT_NR,STGLSTTITL,APTYPE,ISS_DATE,FINAL_DATE,VALUE,ADDRESS" })).then(function (j) {
        s.permits = (j.features || []).sort(function (x, y) { return (y.attributes.ISS_DATE || 0) - (x.attributes.ISS_DATE || 0); }).map(function (f) { var a = f.attributes; return { id: a.PRMT_NR, type: a.APTYPE, desc: a.STGLSTTITL, issued: a.ISS_DATE ? new Date(a.ISS_DATE).toISOString().slice(0, 10) : "", final: a.FINAL_DATE ? new Date(a.FINAL_DATE).toISOString().slice(0, 10) : "" }; });
        s.permitSearch = "ok";
        log(s, true, "Seattle issued and finaled residential permits");
      }).catch(function (e) { s.permitSearch = "failed"; log(s, false, "Seattle residential permits", e.message); });
    }
    if (s.juris === "kenmore") { s.permitLinks = [{ label: "MyBuildingPermit permit search (Kenmore records)", url: LINKS.mbp }, { label: "King County permit records before Kenmore incorporated (1998)", url: LINKS.kcPortal }]; return Promise.resolve(); }
    if (s.juris === "kc") { s.permitLinks = [{ label: "King County Permitting portal (search by parcel number)", url: LINKS.kcPortal }]; return Promise.resolve(); }
    if (s.juris === "edmonds") { s.permitLinks = [{ label: "MyBuildingPermit permit search (Edmonds records)", url: LINKS.mbp }, { label: "Edmonds Development Services", url: LINKS.edmDev }]; return Promise.resolve(); }
    if (s.juris === "city") {
      var c = R.CITY[s.cityKey];
      s.permitLinks = [{ label: "City of " + c.name + " (permits, planning and records requests)", url: c.home }, { label: c.code.label, url: c.code.url }, { label: "MyBuildingPermit permit search (many King and Snohomish cities)", url: LINKS.mbp }];
      if (/^King/.test(s.county)) s.permitLinks.push({ label: "King County permit records from before the area became a city", url: LINKS.kcPortal });
      return Promise.resolve();
    }
    if (s.juris === "sno") {
      s.permitLinks = [{ label: "Snohomish County PDS residential permits", url: LINKS.snoPds }];
      if (!s.rings) return Promise.resolve();
      return getJSON(EP.snoHost + "PLANNING__active_permits/FeatureServer/0/query", polyQuery(s.rings, { outFields: "*" })).then(function (j) {
        s.permits = (j.features || []).map(function (f) { var a = f.attributes;
          // A row id is not a permit number, and a project name is often a person's name.
          return { id: a.permit_number || a.PERMIT_NUMBER || a.permit_no || "Number not in the layer", type: a.permit_type || a.type || "", desc: a.description || a.status || "", issued: "", final: "" };
        });
        s.permitSearch = "ok";
        log(s, true, "Snohomish County active permits layer");
      }).catch(function (e) { s.permitSearch = "failed"; log(s, false, "Snohomish County active permits", e.message); });
    }
    return Promise.resolve();
  }

  function extras(s) {
    if (s.juris === "seattle" && s.parcel) {
      return getJSON(EP.seaParcel, { f: "json", where: "PIN='" + String(s.parcel).replace(/[^0-9A-Za-z]/g, "") + "'", outFields: "YEAR_BUILT", returnGeometry: false }).then(function (j) {
        var f = (j.features || [])[0];
        if (f && f.attributes.YEAR_BUILT) noteYear(s, f.attributes.YEAR_BUILT, "City of Seattle ADUniverse parcels (newest building on the lot)");
        log(s, true, "Seattle ADUniverse parcels (year built)");
      }).catch(function (e) { log(s, false, "Seattle ADUniverse parcels", e.message); });
    }
    return Promise.resolve();
  }

  function buildImagery(s) {
    if (!s.rings) return;
    var b = bbox(s.rings), a = merc(b[0], b[1]), c = merc(b[2], b[3]);
    var w = c[0] - a[0], h = c[1] - a[1], pad = Math.max(w, h) * 0.6 + 15;
    var cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2, half = Math.max(w, h) / 2 + pad;
    var W = 800, H = 600, hw = half * 4 / 3, hh = half;
    var box = [cx - hw, cy - hh, cx + hw, cy + hh];
    var wa = !s.stateAbbr || s.stateAbbr === "WA";
    var snoImg = wa && /^Snohomish/.test(s.county || "");
    var kingImg = wa && /^King/.test(s.county || "");
    if (!snoImg && !kingImg && CFG.services.worldImagery === false) return; // no photo: the stage shows the parcel diagram
    var base = snoImg ? EP.snoAerial : kingImg ? EP.kcAerial : EP.worldImagery;
    var credit = snoImg ? "Imagery: Snohomish County Assessor, 2024 orthophoto (gis.snoco.org)" : kingImg ? "Imagery: King County GIS, 2025 aerial (gismaps.kingcounty.gov)" : "Imagery: Esri World Imagery";
    var q = "?" + qs({ bbox: box.join(","), bboxSR: 3857, imageSR: 3857, size: W + "," + H, format: "jpg", f: "image" });
    var url = base + q;
    // If the county photo does not load, the same box is asked of Esri World Imagery once. After that the parcel diagram is shown.
    var alt = base !== EP.worldImagery && CFG.services.worldImagery !== false ? { url: EP.worldImagery + q, credit: "Imagery: Esri World Imagery (the county aerial photo did not load)" } : null;
    var path = s.rings.map(function (r) {
      return r.map(function (p, i) { var m = merc(p[0], p[1]); return (i ? "L" : "M") + ((m[0] - box[0]) / (box[2] - box[0]) * W).toFixed(1) + " " + ((box[3] - m[1]) / (box[3] - box[1]) * H).toFixed(1); }).join(" ") + " Z";
    }).join(" ");
    s.imagery = { url: url, path: path, W: W, H: H, credit: credit, alt: alt };
  }
  /* A photo that failed used to leave a grey box with the parcel outline floating on it. Both copies of the
     photo (first screen and Existing lot page) report the failure; the first report is the one acted on. */
  function aerialFailed(s, src) {
    if (s !== state || !s.imagery || s.imagery.url !== src) return;
    if (s.imagery.alt) s.imagery = { url: s.imagery.alt.url, path: s.imagery.path, W: s.imagery.W, H: s.imagery.H, credit: s.imagery.alt.credit, alt: null };
    else { s.imagery = null; s.imageryNote = "The aerial photo did not load, so the parcel diagram is shown in its place."; }
    render();
  }

  /* ---------- site plan diagram ---------- */
  function minRect(pts) {
    // Smallest-area bounding rectangle by testing each hull edge direction.
    var best = null;
    for (var i = 0; i < pts.length - 1; i++) {
      var dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dy);
      if (L < 1) continue;
      var ux = dx / L, uy = dy / L, mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
      pts.forEach(function (p) { var u = p[0] * ux + p[1] * uy, v = -p[0] * uy + p[1] * ux; mn[0] = Math.min(mn[0], u); mx[0] = Math.max(mx[0], u); mn[1] = Math.min(mn[1], v); mx[1] = Math.max(mx[1], v); });
      var area = (mx[0] - mn[0]) * (mx[1] - mn[1]);
      if (!best || area < best.area) best = { area: area, ux: ux, uy: uy, mn: mn, mx: mx };
    }
    return best;
  }
  /* Site plan: the real parcel ring, inset edge by edge (front, side, rear setbacks).
     The envelope is every point inside the parcel that is at least the required
     distance from each lot line, sampled on a grid and drawn as merged rows. */
  function segDistXY(px, py, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? ((px - a[0]) * dx + (py - a[1]) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var x = a[0] + t * dx - px, y = a[1] + t * dy - py;
    return Math.sqrt(x * x + y * y);
  }
  function inRingXY(px, py, ring) {
    var c = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i], b = ring[j];
      if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function classifyEdges(ring, st, dir, nb) {
    var n = ring.length - 1, area = 0, i;
    for (i = 0; i < n; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    var sgn = area > 0 ? 1 : -1; // counter-clockwise rings have the outside on the right
    var edges = [];
    for (i = 0; i < n; i++) {
      var a = ring[i], b = ring[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
      edges.push({ a: a, b: b, len: L, nx: sgn * dy / L, ny: -sgn * dx / L, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, d: segDistXY(st[0], st[1], a, b) });
    }
    // An edge is "open" when the ground just outside it is in no other parcel: a street, or sometimes water.
    if (nb && nb.length) edges.forEach(function (e) {
      var px = e.mx + e.nx * 6, py = e.my + e.ny * 6;
      e.open = !nb.some(function (r) { return inRingXY(px, py, r); });
    });
    var openEdges = edges.filter(function (e) { return e.open; });
    var D = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] }[dir];
    if (!D && openEdges.length && openEdges.length < edges.length) {
      var nearOpen = openEdges.reduce(function (m, e) { return e.d < m.d ? e : m; }, openEdges[0]);
      edges.forEach(function (e) { e.kind = "side"; });
      // Walk both ways from the nearest open edge while edges stay open (curved frontage is many short edges).
      var idx = edges.indexOf(nearOpen), n2 = edges.length, k;
      nearOpen.kind = "front";
      for (k = 1; k < n2 && edges[(idx + k) % n2].open; k++) edges[(idx + k) % n2].kind = "front";
      for (k = 1; k < n2 && edges[(idx - k + n2) % n2].open; k++) edges[(idx - k + n2) % n2].kind = "front";
      // A corner lot has street on two sides. The frontage that turns the corner (more than 60 degrees off the
      // line nearest the address point) is a street side, not a second front. Before this, both street lines
      // were fronts, their averaged direction pointed at the corner, and both remaining lines became rears,
      // so a corner lot lost its side setback and was drawn front, front, rear, rear.
      var corner = false;
      edges.forEach(function (e) { if (e.kind === "front" && e !== nearOpen && e.nx * nearOpen.nx + e.ny * nearOpen.ny < 0.5) { e.kind = "street"; corner = true; } });
      var sx = 0, sy = 0, sl = 0;
      edges.forEach(function (e) { if (e.kind === "front") { sx += e.nx * e.len; sy += e.ny * e.len; sl += e.len; } });
      var L2 = Math.hypot(sx, sy) || 1; D = null;
      var done = finishEdges(edges, nearOpen, { nx: sx / L2, ny: sy / L2 });
      done.corner = corner;
      return done;
    }
    var near = D ? edges.reduce(function (m, e) { var sc = (e.nx * D[0] + e.ny * D[1]) * Math.sqrt(e.len), sm = (m.nx * D[0] + m.ny * D[1]) * Math.sqrt(m.len); return sc > sm ? e : m; }, edges[0])
      : edges.reduce(function (m, e) { return e.d < m.d ? e : m; }, edges[0]);
    if (D) edges.forEach(function (e) { e.d = e === near ? 0 : (e.nx * near.nx + e.ny * near.ny > 0.7 ? 0 : 999); });
    edges.forEach(function (e) { e.kind = "side"; if (e.nx * near.nx + e.ny * near.ny > 0.7 && e.d < near.d + 25) e.kind = "front"; });
    return finishEdges(edges, near, near);
  }
  function finishEdges(edges, near, fn) {
    var fx = 0, fy = 0, fl = 0;
    edges.forEach(function (e) { if (e.kind === "front") { fx += e.mx * e.len; fy += e.my * e.len; fl += e.len; } });
    fx /= fl; fy /= fl;
    var rear = edges.filter(function (e) { return e.kind === "side" && e.nx * fn.nx + e.ny * fn.ny < -0.6; });
    if (!rear.length) { // no lot line faces away from the street, so use the one farthest from it
      var far = null;
      edges.forEach(function (e) { if (e.kind === "side" && e.nx * fn.nx + e.ny * fn.ny < 0 && (!far || Math.hypot(e.mx - fx, e.my - fy) > Math.hypot(far.mx - fx, far.my - fy))) far = e; });
      if (far) rear = [far];
    }
    rear.forEach(function (e) { e.kind = "rear"; });
    return { edges: edges, near: near, fx: fx, fy: fy };
  }
  function envelopeRows(ring, edges, dist) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    ring.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
    var cell = Math.max(0.5, Math.sqrt((b[2] - b[0]) * (b[3] - b[1]) / 120000));
    var rows = [], count = 0;
    for (var y = b[1] + cell / 2; y < b[3]; y += cell) {
      var run = null;
      for (var x = b[0] + cell / 2; x < b[2] + cell; x += cell) {
        var ok = x < b[2] && inRingXY(x, y, ring);
        for (var k = 0; ok && k < edges.length; k++) if (segDistXY(x, y, edges[k].a, edges[k].b) < dist(edges[k])) ok = false;
        if (ok) { count++; if (!run) run = [x - cell / 2, y - cell / 2]; }
        else if (run) { rows.push([run[0], run[1], x - cell / 2 - run[0], cell]); run = null; }
      }
    }
    return { rows: rows, area: count * cell * cell };
  }
  function todayStamp() {
    var d = new Date();
    var m = String(d.getMonth() + 1), day = String(d.getDate());
    return d.getFullYear() + "-" + (m.length < 2 ? "0" + m : m) + "-" + (day.length < 2 ? "0" + day : day);
  }
  function rowBy(s, key) {
    var rows = (s.landscape && s.landscape.rows) || [];
    for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i];
    return null;
  }
  function studyContext(s, v, rs) {
    var M = window.BuildHereMeasures;
    if (!M) return null;
    var prepared = s.prepared || todayStamp();
    s.prepared = prepared;
    var kindSel = ($("bh-footprint-kind") && $("bh-footprint-kind").value) || s.footprintKind || "roof";
    var g = rowBy(s, "garage"), d = rowBy(s, "drive"), h = rowBy(s, "hard"), o = rowBy(s, "otherbld");
    var edit = {};
    if (v.existing != null && (s.existing == null || Number(v.existing) !== Number(s.existing))) edit.living = v.existing;
    if (kindSel === "firstFloor") {
      if (v.footprint != null) edit.firstFloor = v.footprint;
    } else if (kindSel === "footprint") {
      if (v.footprint != null) edit.survey = v.footprint;
    } else if (v.footprint != null && (s.footprint == null || Number(v.footprint) !== Number(s.footprint))) {
      edit.roof = v.footprint;
    }
    // A zone-specific ADU standard and the statewide floor are different things.
    // Only the first lets the ADU card read Ready.
    var aduRule = "", aduStateNote = "";
    if (rs && rs.rules) rs.rules.forEach(function (r) {
      if (!/ADU|accessory dwelling/i.test(r.label) || !r.value) return;
      if (/state law/i.test(r.label)) aduStateNote = r.value; else aduRule = r.value;
    });
    // rs can exist for a zone whose numbers are not coded (state-law floor and links only).
    var coded = !!(rs && rs.coded !== false);
    var cautions = [];
    if (s.hazards && s.hazards.length) cautions.push("a mapped critical area or hazard");
    var steep = s.landscape && s.landscape.slope;
    if (steep && steep.ok && steep.pct40 >= 10) cautions.push("ground that reads 40% or steeper on about " + steep.pct40 + "% of the lot");
    var weakMatch = s.parcelMatch === "nearest" || s.parcelMatch === "point" || !!(s.landscape && s.landscape.matchedBy === "location");
    var matchCaution = weakMatch ? "This lot was matched by location, not by its address record. Confirm the parcel number first." : "";
    var siteCaution = cautions.length ? "This lot has " + cautions.join(" and ") + ", so the usable area can be smaller and extra review applies. Read the red flags before you rely on this card." : "";
    var zoneTyped = !!v.zone && v.zone !== (s.zone || "");
    var zoneCaution = s.zoneDraft && !zoneTyped ? "The zone comes from a draft city layer, not the adopted zoning map. Confirm the zone with the city before you rely on this card." : "";
    var seed = seed3D(s, v, rs);
    var solved = M.resolveStudy({
      lot: v.lot,
      date: prepared,
      zoningCoded: coded,
      hasFloorCap: !coded ? null : (rs.floorCap != null ? true : (rs.farNone ? false : null)),
      floorCap: coded && rs.floorCap != null ? rs.floorCap : null,
      coverageCap: coded && rs.coverage != null ? rs.coverage : null,
      imperviousCap: coded && rs.impervious != null ? rs.impervious : null,
      imperv: v.imperv,
      envArea: seed.env && seed.env.area != null ? seed.env.area : null,
      aduRule: coded ? aduRule : "",
      aduStateNote: aduStateNote,
      siteCaution: siteCaution,
      matchCaution: matchCaution,
      zoneCaution: zoneCaution,
      edit: edit,
      manual: s.manual || [],
      auto: {
        living: s.existing != null ? { sf: s.existing, source: s.existingSrc || "Assessor record", url: s.assessorUrl || "", retrieved: s.existingAsOf || prepared, method: "assessor extract", confidence: "Medium", note: s.existingNote || "" } : null,
        roof: s.footprint != null ? { sf: s.footprint, source: s.footprintSrc || "Mapped building outline", retrieved: prepared, method: "roof outline", confidence: /OpenStreetMap|Microsoft/i.test(s.footprintSrc || "") ? "Low" : "Medium", note: "Mapped outline. Not a survey, not living area, and not gross floor area." } : null,
        firstFloor: s.firstFloor != null ? { sf: s.firstFloor, source: s.firstFloorSrc || "Assessor first floor", url: s.assessorUrl || "", retrieved: s.existingAsOf || prepared, method: "assessor extract", note: "First-floor area. Not a roof outline." } : null,
        attachedGarage: s.garageFloor != null ? { sf: s.garageFloor, source: s.garageFloorSrc || "Assessor garage area", url: s.assessorUrl || "", retrieved: s.existingAsOf || prepared, method: "assessor extract", note: "Floor area on the building record. Not a detached footprint, and not added to coverage." } : null,
        detachedGarageFloor: s.detGarageFloor != null ? { sf: s.detGarageFloor, source: s.detGarageFloorSrc || "Assessor detached garage area", url: s.assessorUrl || "", retrieved: s.existingAsOf || prepared, method: "assessor extract", note: "Detached garage floor area on the improvement record. Not a mapped footprint, and not added to coverage." } : null,
        detached: M.sfOrUnknown(g) != null ? { sf: M.sfOrUnknown(g), source: (g && g.src) || "Mapped outline", retrieved: prepared, method: "building outline", confidence: "Low", measuredZero: !!(g && g.measuredZero), note: "Detached outline. Not attached garage floor area." } : null,
        other: M.sfOrUnknown(o) != null ? { sf: M.sfOrUnknown(o), source: (o && o.src) || "Mapped outline", retrieved: prepared, method: "building outline", confidence: "Low", note: "Other mapped building. Counted in coverage, not in living area." } : null,
        // The ledger repeats the coverage table's own confidence. A centerline at an assumed width, or a
        // volunteer-mapped parking area, was listed here as a Medium "paved-surface layer".
        drive: M.sfOrUnknown(d) != null ? { sf: M.sfOrUnknown(d), source: (d && d.src) || "", retrieved: prepared, method: d.est ? "centerline estimate" : (/OpenStreetMap/.test(d.src || "") ? "volunteer map" : "paved-surface layer"), confidence: (d.measuredZero || /^Low/.test(d.conf || "")) ? "Low" : "Medium", measuredZero: !!(d && d.measuredZero) } : null,
        hard: M.sfOrUnknown(h) != null ? { sf: M.sfOrUnknown(h), source: (h && h.src) || "", retrieved: prepared, method: "paved-surface layer", confidence: "Medium", measuredZero: !!(h && h.measuredZero) } : null
      }
    });
    if (s.landscape && s.landscape.rows && solved.bundle.open) {
      // The coverage table is redrawn from the same figures as the cards. The open-area row was given the new
      // square feet and kept its old share of the lot, and the lot row kept the record figure after a typed lot size.
      var lotTyped = v.lot != null && (s.lot == null || Number(v.lot) !== Number(s.lot));
      var share = function (sf) { return sf != null && v.lot > 0 ? Math.round(sf / v.lot * 1000) / 10 : null; };
      s.landscape.rows.forEach(function (row) {
        if (!row.orig) row.orig = { sf: row.sf, src: row.src, conf: row.conf, pct: row.pct };
        var o = row.orig;
        if (row.key === "land") {
          row.sf = solved.bundle.open.sf;
          row.label = solved.bundle.open.label;
          row.verifiedLandscape = solved.bundle.open.verifiedLandscape;
          row.src = solved.bundle.open.note;
          row.conf = solved.bundle.open.sf == null ? "Unavailable" : (solved.bundle.open.verifiedLandscape ? "Medium" : "Low");
          row.pct = share(row.sf);
        } else if (row.key === "lot") {
          if (lotTyped) { row.sf = v.lot; row.pct = 100; row.conf = "Your entry"; row.src = "Typed on this page." + (o.sf != null ? " The public record figure was " + fmt(o.sf) + " sf." : ""); }
          else { row.sf = o.sf; row.pct = o.pct; row.conf = o.conf; row.src = o.src; }
        } else row.pct = lotTyped ? share(row.sf) : o.pct;
      });
    }
    return { bundle: solved.bundle, cards: solved.cards, prepared: prepared, effective: solved.effective, seed: seed };
  }
  function measureValue(m) {
    if (m.sfLow != null && m.sfHigh != null) return fmt(Math.round(m.sfLow)) + " to " + fmt(Math.round(m.sfHigh)) + " sf (range)";
    if (m.sf == null) return "Not measured";
    return fmt(Math.round(m.sf)) + " sf";
  }
  var METHOD_LABEL = { aerial: "Aerial estimate, typed by you (range, not a survey)", photo: "Unscaled photo, typed by you (range, not a survey)", assessor: "Assessor card, typed by you", "assessor extract": "Assessor extract", listing: "Listing page, typed by you", survey: "Survey, typed by you", permit: "Permit plan, typed by you", tape: "Tape measure, typed by you", edited: "Edited in this session", "roof outline": "Mapped roof or building outline (not a survey)", "paved-surface layer": "Paved-surface layer", "centerline estimate": "Driveway centerline at an assumed 10 ft width (estimate, not a measurement)", "volunteer map": "OpenStreetMap, volunteer mapped (estimate)", "building outline": "Mapped building outline (not a survey)" };
  function methodLabel(m) { return METHOD_LABEL[m] || m || ""; }
  function ledgerHtml(bundle) {
    if (!bundle) return "";
    var rows = bundle.measures.map(function (m) {
      var who = m.automatic ? "" : "User-entered. ";
      return "<tr><th scope=\"row\">" + esc(m.label) + "</th><td data-label=\"Amount\">" + measureValue(m) + "</td><td data-label=\"Confidence\">" + esc(m.confidence || "") + "</td><td data-label=\"Source\">" + esc(who + methodLabel(m.method)) + (m.retrieved ? " · " + esc(m.retrieved) : "") + (m.source ? "<br><span class=\"bh-muted\">" + esc(m.source) + "</span>" : "") + (safeUrl(m.url) ? "<br><a href=\"" + esc(safeUrl(m.url)) + "\" target=\"_blank\" rel=\"noopener\">Source page</a>" : "") + (m.note ? "<br><span class=\"bh-muted\">" + esc(m.note) + "</span>" : "") + "</td></tr>";
    }).join("");
    var open = bundle.open || {};
    var openRow = "<tr><th scope=\"row\">" + esc(open.label || "Open area") + "</th><td data-label=\"Amount\">" + (open.sf == null ? '<span class="bh-tbd">Not measured</span>' : fmt(Math.round(open.sf)) + " sf") + "</td><td data-label=\"Confidence\">" + (open.verifiedLandscape ? "Medium" : "Low") + "</td><td data-label=\"Source\">" + esc(open.note || "") + "</td></tr>";
    var extra = "";
    (bundle.notes || []).forEach(function (t) { extra += '<p class="bh-muted">' + esc(t) + "</p>"; });
    (bundle.conflicts || []).forEach(function (c) { extra += '<p class="bh-verify">' + esc(c.note) + "</p>"; });
    (bundle.stale || []).forEach(function (c) { extra += '<p class="bh-verify">' + esc(c.note) + "</p>"; });
    (bundle.errors || []).forEach(function (t) { extra += '<p class="bh-verify">' + esc(t) + "</p>"; });
    return '<h3>Measurements and where they came from</h3><p class="bh-muted">Each number keeps its source, the date it was read, the method, and a confidence. A roof outline is not living area. Unknown driveway, garage, and hardscape stay blank.</p><table class="bh-table bh-measures"><thead><tr><th scope="col">Measure</th><th scope="col">Amount</th><th scope="col">Confidence</th><th scope="col">Source</th></tr></thead><tbody>' + rows + openRow + "</tbody></table>" + extra;
  }
  /* The call to action at the end of the study. Buttons are hidden on paper, so the same links are
     also written out as text for the printed copy. */
  function ctaHtml(heading, text, buttons) {
    var live = (buttons || []).filter(function (b) { return b && b.label && linkUrl(b.url); });
    var abs = function (u) { try { return new URL(u, CFG.siteBase || location.href).href; } catch (e) { return u; } };
    return '<div class="bh-cta"><h3>' + esc(heading) + "</h3>" + (text ? "<p>" + esc(text) + "</p>" : "") +
      (live.length ? "<p>" + live.map(function (b) { return '<a class="bh-btn' + (b.ghost ? " bh-btn-ghost" : "") + '" href="' + esc(b.url) + '">' + esc(b.label) + "</a>"; }).join(" ") + "</p>" +
        '<p class="bh-print-only">' + live.map(function (b) { return esc(b.label) + ": " + esc(abs(b.url)); }).join(" · ") + "</p>" : "") + "</div>";
  }
  var STUDY_LIMITS = "Planning estimate only. This is not a legal, zoning, or permit determination. Where zoning is not coded, the study does not say a project is allowed. Unknown driveway, garage, and hardscape are left blank rather than filled with zero. A roof outline is not living area or gross floor area. Open area left after a roof outline is not landscaping when paving is unknown. Listing sites are not fetched. A number you type from a listing, survey, or permit plan is labeled as your entry.";

  /* The largest ring of the parcel outline. A parcel record can carry several rings (separate parts, or a
     hole). The diagram and the envelope are drawn from one ring, and it used to be whichever came first. */
  function mainRingIndex(rings) {
    var bi = 0, ba = -1;
    rings.forEach(function (r, i) { var a = Math.abs(ringArea(r)); if (a > ba) { ba = a; bi = i; } });
    return bi;
  }
  /* The second street side of a corner lot is drawn at the front setback. That is the cautious choice. */
  function setbackFor(e, sb) { return e.kind === "front" || e.kind === "street" ? sb.front : e.kind === "rear" ? sb.rear : sb.side; }
  /* One reading of the lot lines and one envelope raster per redraw. The site plan, the option cards
     and the 3D seed all take it from here, so they cannot disagree and the raster does not run three times. */
  function lotGeometry(s, sb) {
    if (!s.rings || !s.rings.length) return null;
    sb = sb || {};
    var key = [sb.front, sb.side, sb.rear, s.frontDir || "", s.neighborRings ? s.neighborRings.length : "none"].join("|");
    if (s.geo && s.geo.key === key && s.geo.src === s.rings) return s.geo;
    var b = bbox(s.rings), lat0 = (b[1] + b[3]) / 2, lon0 = (b[0] + b[2]) / 2;
    var ring = toFeet([s.rings[mainRingIndex(s.rings)]], lat0, lon0)[0];
    if (ring.length < 4) return null;
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push(ring[0]);
    var st = toFeet([[[s.lon, s.lat]]], lat0, lon0)[0][0];
    var ce = classifyEdges(ring, st, s.frontDir, s.neighborRings ? toFeet(s.neighborRings, lat0, lon0) : null);
    var known = [sb.front, sb.rear, sb.side].every(function (x) { return typeof x === "number"; });
    var er = known ? envelopeRows(ring, ce.edges, function (e) { return setbackFor(e, sb); }) : null;
    s.geo = { key: key, src: s.rings, ring: ring, ce: ce, er: er, known: known, parts: s.rings.length, corner: !!ce.corner };
    return s.geo;
  }
  function seed3D(s, v, rs) {
    var sb = rs && rs.setbacks || {}, seed = { address: s.matched || s.input || "", zone: v.zone || "", juris: s.jurisLabel || "", lot: v.lot || null, footprint: v.footprint || null, stories: v.stories || 1, type: v.type || "", coverage: rs && rs.coverage || null, setbacks: { front: sb.front, side: sb.side, rear: sb.rear }, height: null, ring: null, env: null, lat: s.lat, lon: s.lon };
    if (rs && rs.rules) rs.rules.some(function (r) { if (/height/i.test(r.label) && !/ADU|accessory/i.test(r.label)) { var m = String(r.value || "").match(/(\d+(?:\.\d+)?)\s*ft/); if (m) { seed.height = +m[1]; return true; } } return false; });
    var g = lotGeometry(s, sb);
    if (g) {
      seed.ring = g.ring.map(function (p) { return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; });
      if (g.er) {
        seed.env = { rows: g.er.rows.map(function (r) { return r.map(function (n) { return Math.round(n * 10) / 10; }); }), area: Math.round(g.er.area) };
        seed.front = { x: g.ce.fx, y: g.ce.fy };
      }
    }
    return seed;
  }
  function sitePlanSVG(s, rs) {
    if (!s.rings) return '<p class="bh-muted">No parcel outline was available, so no diagram can be drawn.</p>';
    var sb = rs && rs.setbacks || {};
    var g = lotGeometry(s, sb);
    if (!g) return "";
    var ring = g.ring, ce = g.ce;
    var F = sb.front, Rr = sb.rear, S = sb.side;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ring.forEach(function (p) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });
    var pad = 46, W = 560, H = 420;
    var sw = maxX - minX || 1, sh = maxY - minY || 1, sc = Math.min((W - 2 * pad) / sw, (H - 2 * pad) / sh);
    var ox = (W - sw * sc) / 2, oy = (H - sh * sc) / 2;
    var X = function (x) { return ox + (x - minX) * sc; };
    var Y = function (y) { return H - oy - (y - minY) * sc; };
    var f1 = function (n) { return n.toFixed(1); };
    var poly = ring.map(function (p, i) { return (i ? "L" : "M") + f1(X(p[0])) + " " + f1(Y(p[1])); }).join(" ") + " Z";
    var lines = ce.edges.map(function (e) {
      var stroke = e.kind === "front" || e.kind === "street" ? "#b45309" : e.kind === "rear" ? "#1d4ed8" : "#1f2933";
      return '<line x1="' + f1(X(e.a[0])) + '" y1="' + f1(Y(e.a[1])) + '" x2="' + f1(X(e.b[0])) + '" y2="' + f1(Y(e.b[1])) + '" class="bh-edge bh-edge-' + e.kind + '" stroke="' + stroke + '" stroke-width="3"' + (e.kind === "street" ? ' stroke-dasharray="7 5"' : "") + "/>";
    }).join("");
    var env = "", envArea = null, envC = null, ecx = 0, ecy = 0;
    if (g.er) {
      var er = g.er;
      envArea = er.area;
      var ca = 0; er.rows.forEach(function (r) { var a = r[2] * r[3]; ca += a; ecx += (r[0] + r[2] / 2) * a; ecy += (r[1] + r[3] / 2) * a; });
      if (ca) { ecx /= ca; ecy /= ca; envC = [ecx, ecy]; }
      if (er.rows.length) {
        var d = er.rows.map(function (r) { return "M" + f1(X(r[0])) + " " + f1(Y(r[1] + r[3])) + "h" + f1(r[2] * sc + 0.4) + "v" + f1(r[3] * sc + 0.4) + "h" + f1(-(r[2] * sc + 0.4)) + "z"; }).join("");
        env = '<path d="' + d + '" class="bh-env" fill="rgba(22,101,52,0.28)" stroke="none"/>';
      }
    }
    var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
    // Street label: just outside the front lot line, kept inside the drawing.
    var lx = clamp(X(ce.fx + ce.near.nx * 14), 70, W - 70), ly = clamp(Y(ce.fy + ce.near.ny * 14), 16, H - 30);
    var label = function (v) { return typeof v === "number" ? v + " ft" : "verify"; };
    var cx = 0, cy = 0, cn = 0;
    ring.slice(0, -1).forEach(function (p) { cx += p[0]; cy += p[1]; cn++; });
    // Envelope label at the envelope's own centroid; nudge it clear of the street label.
    var elx = clamp(envC ? X(envC[0]) : X(cx / cn), 80, W - 80), ely = clamp(envC ? Y(envC[1]) : Y(cy / cn), 20, H - 34);
    var tw = function (t) { return t.length * 6.2; };
    var streetTxt = "Street side, front " + label(F);
    for (var tries = 0; tries < 8 && Math.abs(ely - ly) < 16 && Math.abs(elx - lx) < (tw(streetTxt) + 160) / 2; tries++) ely = clamp(ely + (ely >= ly ? 18 : -18), 20, H - 34);
    if (Math.abs(ely - ly) < 16 && Math.abs(elx - lx) < (tw(streetTxt) + 160) / 2) ely = ly > H / 2 ? ly - 22 : ly + 22;
    var envText = envArea != null ? (envArea > 0 ? "Envelope about " + fmt(Math.round(envArea / 10) * 10) + " sf" : "No envelope left after setbacks") : "Setbacks not verified";
    return '<svg viewBox="0 0 ' + W + " " + H + '" class="bh-siteplan" role="img" aria-label="Diagrammatic site plan: parcel outline, front, side and rear setbacks, and the remaining buildable envelope. ' + esc(envText) + '.">' +
      '<path d="' + poly + '" class="bh-lot" fill="#f3f1ea" stroke="#1f2933" stroke-width="2"/>' + env + lines +
      '<text x="' + f1(lx) + '" y="' + f1(ly) + '" class="bh-front" fill="#14532d" text-anchor="middle" aria-hidden="true">Street side, front ' + label(F) + '</text>' +
      '<text x="' + f1(elx) + '" y="' + f1(ely) + '" class="bh-envlabel" fill="#14532d" text-anchor="middle" aria-hidden="true">' + esc(envText) + '</text>' +
      '<g class="bh-north" aria-hidden="true" transform="translate(' + (W - 24) + ',30)"><path d="M0 -14 L6 4 L0 0 L-6 4 Z" fill="#1f2933"/><text y="18" text-anchor="middle" fill="#1f2933">N</text></g>' +
      '<text x="12" y="' + (H - 10) + '" class="bh-note" text-anchor="start" aria-hidden="true"><tspan class="bh-k-front">Front ' + label(F) + '</tspan>  <tspan class="bh-k-side">Side ' + label(S) + '</tspan>  <tspan class="bh-k-rear">Rear ' + label(Rr) + '</tspan>  Scale approximate</text>' +
      "</svg>";
  }
  /* The same figures as text. In the drawing they are 11 px at full width and about 7 px on a phone,
     and they are hidden from screen readers. */
  function sitePlanKey(s, rs) {
    var sb = rs && rs.setbacks || {}, g = lotGeometry(s, sb);
    if (!g) return "";
    var label = function (v) { return typeof v === "number" ? v + " ft" : "verify with the jurisdiction"; };
    var items = ['<li><span class="bh-key bh-key-front"></span>Front, the street side: ' + label(sb.front) + "</li>"];
    if (g.corner) items.push('<li><span class="bh-key bh-key-street"></span>Second street side of this corner lot: drawn at the front setback, ' + label(sb.front) + "</li>");
    items.push('<li><span class="bh-key bh-key-side"></span>Side: ' + label(sb.side) + "</li>");
    items.push('<li><span class="bh-key bh-key-rear"></span>Rear: ' + label(sb.rear) + "</li>");
    items.push('<li><span class="bh-key bh-key-env"></span>' + (g.er ? (g.er.area > 0 ? "Envelope inside the setbacks: about " + fmt(Math.round(g.er.area / 10) * 10) + " sf" : "No area is left inside the setbacks as drawn") : "Envelope not drawn. The setbacks are not all coded.") + "</li>");
    return '<ul class="bh-plan-key">' + items.join("") + "</ul>";
  }

  /* ---------- report ---------- */
  /* A typed area is digits, with optional thousands commas, an optional decimal part and an optional
     "sf" or "sq ft". Nothing else is guessed at. parseFloat read "-5000" as a negative lot (and negative
     caps), "0.25 acres" as a quarter of a square foot, "5000-6000" as 5000 and "12 000" as 12. */
  function parseArea(text) {
    var t = String(text == null ? "" : text).trim();
    if (!t) return { value: null, error: "" };
    var m = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(?:sf|sq\.?\s*ft\.?|square\s+feet)?$/i.exec(t);
    if (!m) return { value: null, error: "Enter square feet as a plain number, such as 7200. This box was not used." };
    return { value: parseFloat((m[1] + (m[2] || "")).replace(/,/g, "")), error: "" };
  }
  function fieldError(id, msg) {
    var el = $(id);
    if (!el) return;
    var err = $(id + "-err");
    if (!msg) { el.removeAttribute("aria-invalid"); if (err) err.textContent = ""; return; }
    if (!err) {
      err = document.createElement("p");
      err.id = id + "-err"; err.className = "bh-help bh-field-error"; err.setAttribute("role", "alert");
      el.parentNode.insertBefore(err, el.nextSibling);
      var d = el.getAttribute("aria-describedby");
      el.setAttribute("aria-describedby", (d ? d + " " : "") + err.id);
    }
    el.setAttribute("aria-invalid", "true");
    err.textContent = msg;
  }
  function num(id, zeroMsg) {
    var el = $(id);
    if (!el) return null;
    var r = parseArea(el.value);
    if (!r.error && r.value === 0 && zeroMsg) r = { value: null, error: zeroMsg };
    fieldError(id, r.error);
    return r.value;
  }

  function fillForm(s) {
    $("bh-lot").value = s.lot || "";
    $("bh-zone").value = s.zone || "";
    $("bh-existing").value = s.existing || "";
    $("bh-footprint").value = s.footprint || "";
    $("bh-lot-src").textContent = s.lot ? "From: " + s.lotSrc : "Not found in public data. Enter it from your survey or the assessor page.";
    $("bh-zone-src").textContent = s.zone ? "From: " + s.zoneSrc : "Not found. Enter the zone from the city or county zoning map.";
    $("bh-existing-src").textContent = s.existing
      ? ("From: " + (s.existingSrc || "public assessor record") + ". Edit if you know a better number.")
      : ((/^King/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA"))
        ? (s.existingFile ? "The King County building data file for this parcel could not be loaded, so this box was not filled in. Enter the finished living area from the assessor page."
          : "No finished living area found in the Assessor residential building extract for this PIN. Enter it from the assessor page.")
        : "Enter the existing finished floor area from the assessor record if you have it.");
    $("bh-footprint-src").textContent = s.footprint ? "From: " + String(s.footprintSrc || "").replace(/\.\s*$/, "") + ". A roof outline is not living area. Edit the number and the type if you know better." : "Optional. Roof outline or surveyed footprint for the coverage check. First-floor area is a different box.";
    if ($("bh-footprint-kind")) {
      var kind = s.footprintKind || "roof";
      if ([].slice.call($("bh-footprint-kind").options).some(function (o) { return o.value === kind; })) $("bh-footprint-kind").value = kind;
    }
    ["bh-lot", "bh-existing", "bh-footprint", "bh-imperv"].forEach(function (id) { fieldError(id, ""); });
    renderManualList();
    if ($("bh-imperv")) {
      $("bh-imperv").value = s.imperv != null ? s.imperv : "";
      $("bh-imperv-src").textContent = s.imperv != null ? "From: " + String(s.impervSrc || "a public layer").replace(/\.\s*$/, "") + ". Edit if you know better." : "Leave blank when paving is unknown. Do not type 0.";
    }
    if ($("bh-stories")) {
      // Reset first. A record with no matching choice (4 stories, say) used to leave the
      // previous address's value in the box, and the study then credited it to the assessor.
      var stNum = Number(s.stories);
      $("bh-stories").value = "1";
      s.storiesFilled = ""; s.storiesNote = "";
      if (isFinite(stNum) && stNum > 0) {
        s.storiesFilled = String(Math.min(3, Math.max(1, Math.round(stNum))));
        $("bh-stories").value = s.storiesFilled;
        if (Number(s.storiesFilled) !== stNum) s.storiesNote = "the record shows " + stNum + ", and the nearest choice is selected";
      }
    }
    if ($("bh-front")) $("bh-front").value = "";
    if ($("bh-units")) $("bh-units").value = "1";
    if ($("bh-type")) $("bh-type").value = "addition";
    ["bh-man-sf", "bh-man-low", "bh-man-high", "bh-man-source", "bh-man-url", "bh-man-date"].forEach(function (id) { if ($(id)) $(id).value = ""; });
    if ($("bh-man-note")) $("bh-man-note").textContent = "";
    if ($("bh-man-conf")) $("bh-man-conf").value = "Medium";
    if ($("bh-man-method")) $("bh-man-method").value = "assessor";
    $("bh-confirm").hidden = false;
  }

  function render() {
    var s = state;
    var v = { lot: num("bh-lot", "A lot size of 0 was not used. Enter the lot size in square feet."), zone: $("bh-zone").value.trim(), existing: num("bh-existing"), footprint: num("bh-footprint"), imperv: num("bh-imperv", "A 0 here was not used. Impervious surface includes the roof. Leave the box blank when paving is unknown."), front: $("bh-front").value, units: parseInt($("bh-units").value, 10) || 1, stories: parseInt($("bh-stories").value, 10) || 1, type: $("bh-type").value };
    var rs = v.lot && ["seattle", "kc", "sno", "edmonds", "kenmore", "city"].indexOf(s.juris) >= 0 ? R.pick({ juris: s.juris, city: s.cityKey, zone: v.zone, lot: v.lot, units: v.units, house: v.existing }) : null;
    s.frontDir = v.front || "";
    // Lot size and zone drive every cap in the study. When they are typed on this page
    // they are labeled as the visitor's entry, next to the public record figure.
    var lotEdited = v.lot != null && (s.lot == null || Number(v.lot) !== Number(s.lot));
    var zoneEdited = !!v.zone && v.zone !== (s.zone || "");
    var out = [];
    // "Orleans Parish" and "Anchorage Municipality" are county names as they stand. Only a bare name gets the word added.
    var place = s.city ? s.city.toUpperCase() : (s.county ? (/(County|Parish|Borough|Census Area|Municipality)$/i.test(s.county) ? s.county : s.county + " County").toUpperCase() : "PLACE NOT MATCHED");
    var page = function (title, body, cls) { return '<section class="bh-page ' + (cls || "") + '"><div class="bh-page-body">' + body + '</div><footer class="bh-page-foot"><span>' + esc(place) + ' | ' + esc(s.stateAbbr || "US") + '</span><strong>' + esc(title) + '</strong><span class="bh-brand">' + esc(CFG.brand) + '</span></footer></section>'; };

    var ctx = studyContext(s, v, rs);
    var prepared = (ctx && ctx.prepared) || todayStamp();
    var mapHtml = "";
    if (s.imagery) {
      var mw = isFinite(Number(s.imagery.W)) ? String(Number(s.imagery.W)) : "0";
      var mh = isFinite(Number(s.imagery.H)) ? String(Number(s.imagery.H)) : "0";
      mapHtml = '<figure class="bh-aerial"><div class="bh-aerial-frame"><img src="' + esc(s.imagery.url) + '" alt="Aerial photo of this parcel with the parcel outline drawn on top" width="' + esc(mw) + '" height="' + esc(mh) + '"><svg viewBox="0 0 ' + esc(mw) + " " + esc(mh) + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path d="' + esc(s.imagery.path) + '" class="bh-outline" fill="rgba(255,255,255,0.08)" stroke="#ffffff" stroke-width="2"/></svg></div></figure>';
    } else if (s.rings) {
      mapHtml = sitePlanSVG(s, rs);
    }
    var stageInner = window.BuildHereStage
      ? window.BuildHereStage.renderStage({
          address: s.matched || s.input,
          date: prepared,
          placeLine: (s.jurisLabel || "") + (s.parcel ? " · Parcel " + s.parcel : "") + (v.zone ? " · Zone " + v.zone + (zoneEdited ? " (your entry)" : "") : ""),
          edited: lotEdited || zoneEdited ? "These cards use a " + (lotEdited && zoneEdited ? "lot size and zone" : lotEdited ? "lot size" : "zone") + " typed on this page, not the public record. The summary shows both." : "",
          mapHtml: mapHtml,
          warn: s.parcelWarn || (s.landscape && s.landscape.warn) || "",
          cards: ctx ? ctx.cards : []
        })
      : '<p class="bh-verify">The options view did not load. Refresh the page.</p>';
    out.push(page("What you can build", stageInner, "bh-stage-page"));

    // Project summary
    var rows = [
      ["Parcel number", s.parcel ? esc(s.parcel) + (s.assessorUrl ? ' · <a href="' + esc(s.assessorUrl) + '" target="_blank" rel="noopener">assessor record</a>' : "") + (s.parcelMatch === "nearest" || s.parcelMatch === "point" ? ' <span class="bh-verify">Matched by location, not by address. Verify.</span>' : (s.parcelMatch === "address" ? ' <span class="bh-muted">· matched by street address</span>' : "")) : "Not found"],
      ["Site address", esc(s.matched || s.input)],
      ["Jurisdiction", esc(s.jurisLabel)],
      ["Lot area", v.lot ? fmt(v.lot) + " sf" + (lotEdited ? " (your entry" + (s.lot != null ? "; the public record figure was " + fmt(s.lot) + " sf" : "") + ")" : ' <span class="bh-muted">· ' + esc(s.lotSrc || "public record") + "</span>") : "Enter by hand"],
      ["Zone", v.zone ? esc(v.zone) + (zoneEdited ? " (your entry" + (s.zone ? "; the public record shows " + esc(s.zone) : "") + ")" : (s.zoneSrc ? ' <span class="bh-muted">· ' + esc(s.zoneSrc) + "</span>" : "")) + (!zoneEdited && s.assessorZone ? ' <span class="bh-muted">(the county assessor field shows ' + esc(s.assessorZone) + ")</span>" : "") : "Enter by hand"],
      ["Existing finished area", v.existing ? fmt(v.existing) + " sf" + ((s.existing != null && Number(v.existing) !== Number(s.existing)) || !s.existingSrc ? " (your entry" + (s.existing != null && Number(v.existing) !== Number(s.existing) ? "; recorded figure was " + fmt(s.existing) + " sf" : "") + ")" : ' <span class="bh-muted">· ' + esc(s.existingSrc) + "</span>") : "Not entered"],
      ["Building footprint", (function () {
        if (v.footprint == null) return "Not entered";
        var kindShown = ($("bh-footprint-kind") && $("bh-footprint-kind").value) || s.footprintKind || "roof";
        var edited = s.footprint != null && Number(v.footprint) !== Number(s.footprint);
        var yours = edited || !s.footprintSrc || kindShown === "footprint";
        var kindPhrase = kindShown === "firstFloor" ? "first-floor area, not roof coverage" : (kindShown === "footprint" ? "surveyed footprint" : "roof outline, not living area");
        var note = " (" + kindPhrase;
        if (yours) {
          note += ", your entry";
          if (edited) note += "; recorded figure was " + fmt(s.footprint) + " sf";
        }
        note += ")";
        return fmt(v.footprint) + " sf" + note;
      })()],
      ["Year built", (function () {
        if (!s.yearBuilt) return "Not found in the public records this page reads. See the assessor page.";
        var others = (s.years || []).filter(function (r) { return String(r.y) !== String(s.yearBuilt); });
        return esc(s.yearBuilt) + " (" + esc(s.yearSrc) + ")" + (others.length ? ' <span class="bh-verify">Another record shows ' + others.map(function (r) { return esc(r.y) + " (" + esc(r.src) + ")"; }).join("; ") + ". The older year is the one used for the asbestos and lead-paint flag.</span>" : "");
      })()],
      ["Stories (existing)", String(v.stories) + (s.storiesSrc && String(v.stories) === s.storiesFilled ? ' <span class="bh-muted">· ' + esc(s.storiesSrc) + (s.storiesNote ? "; " + esc(s.storiesNote) : "") + "</span>" : (s.storiesSrc ? " (your entry; " + esc(s.storiesSrc) + " shows " + esc(s.stories) + ")" : " (entered on this page or left at the default; not from a record)"))],
      ["Project type", esc($("bh-type").selectedOptions[0].text)]
    ];
    if (s.detGarageFloor) rows.push(["Detached garage floor area", fmt(s.detGarageFloor) + " sf" + (s.detGarageFloorSrc ? ' <span class="bh-muted">· ' + esc(s.detGarageFloorSrc) + "</span>" : "")]);
    var slEarly = s.landscape && s.landscape.slope;
    rows.push(["Lot slope (USGS 3DEP)", slEarly && slEarly.ok ? ("avg " + slEarly.mean + "% · median " + slEarly.median + "% · " + slEarly.pct40 + "% of lot at 40%+" + (slEarly.fallCompass && slEarly.fallCompass !== "flat" ? " · estimated fall toward the " + esc(slEarly.fallCompass) : "")) : '<span class="bh-tbd">Not measured</span>']);
    var ledger = ledgerHtml(ctx && ctx.bundle);
    // "No mapped hazard" is only true of the layers read and the area checked. Inside a city other than
    // Seattle and Kenmore only county layers are read, and with no parcel outline only the address point is checked.
    var hazWhere = s.rings ? "this parcel" : "the address point (no parcel outline was found, so only that point was checked)";
    var hazCity = s.juris === "city" ? "Only county layers were read. The City of " + esc(s.city) + " keeps its own critical-area maps, and those were not checked." : "";
    var haz;
    if (s.hazards.length) haz = "<ul>" + s.hazards.map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") + "</ul>" + (hazCity ? '<p class="bh-muted">' + hazCity + "</p>" : "");
    else if (s.hazardSource && s.hazardNotes.length) haz = "<p>The layers that answered show no mapped hazard on " + hazWhere + " (" + esc(s.hazardSource) + "). " + (hazCity ? hazCity + " " : "") + "Some layers did not answer and were not checked, so this is not a full map check.</p>";
    else if (s.hazardSource) haz = "<p>No mapped hazard layer touched " + hazWhere + " in the " + esc(s.hazardSource) + ". " + (hazCity ? hazCity + " " : "") + "Maps are not field studies; a site visit can still find steep ground, wet soils or streams.</p>";
    else haz = "<p>Hazard maps were not checked for this jurisdiction. Ask the city or county.</p>";
    if (s.hazardNotes.length) haz += '<p class="bh-muted">' + esc(s.hazardNotes.join("; ")) + "</p>";
    out.push(page("Project summary", ledger + '<div class="bh-cols"><div><h3>Site data</h3><table class="bh-table">' + rows.map(function (r) { return "<tr><th scope=\"row\">" + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join("") + '</table></div><div><h3>Special site features</h3>' + haz +
      '<h3>Soils and geotechnical</h3><p>No soils report is on file with this snapshot. Slopes, fill or a mapped hazard often lead the jurisdiction to ask for a geotechnical report on bearing soil and drainage.</p>' +
      '<h3>Drainage and civil</h3><p>Larger additions and new houses usually trigger stormwater review. The size thresholds come from the local stormwater code; ask the jurisdiction which applies before design. The slope table is a bare-earth sample from USGS 3DEP: average and median slope, steep-cell share, elevation range, and an estimated lot-average fall direction. Contour and aspect pictures are not shown. The sample does not size pipes, ditches, or a stormwater facility.</p>' +
      '<h3>Construction cost</h3><p>Not estimated here. Get a written bid from a licensed contractor for your own numbers.</p>' +
      '<h3>Codes that will apply</h3><p>' + (s.stateAbbr === "WA"
        ? 'Local zoning (cited below), the Washington State Residential Code and the <a href="' + R.SRC.wsec.url + '" target="_blank" rel="noopener">Washington State Energy Code</a>. Energy credits depend on project size and type; your designer confirms them.'
        : 'Local zoning and the state residential or building code apply. We have not coded zone setbacks, coverage or FAR for this place. Confirm those with the city or county before design. Lot area, landscape split and slope below come from public GIS where a layer answers.') + '</p></div></div>'));

    // Code review
    var cr;
    if (!rs) {
      var why = s.juris === "other" ? "We could not match " + esc(s.jurisLabel) + " to a city in our list. Verify the rules with the city." : (s.juris === "city" && !v.lot ? "Enter the lot size under Edit the facts to see the rules and the math for " + esc(s.jurisLabel) + "." : (s.juris === "outside"
        ? "Zoning setbacks, coverage and FAR are not coded for this place. Verify those with the city or county. Parcel outline, lot area, house and slope notes below come from public parcel and elevation layers where they answer. This is not a permit determination."
        : "We do not have verified rules coded for zone " + esc(v.zone || "(blank)") + " here. Verify with the jurisdiction."));
      cr = '<p class="bh-verify">' + why + "</p>" + (CFG.links.permits ? '<p><a href="' + esc(CFG.links.permits) + '">' + esc(CFG.permitHubLabel) + "</a> lists city and county permit offices.</p>" : "");
    } else {
      cr = '<h3>' + esc(rs.title) + '</h3><table class="bh-table bh-rules"><thead><tr><th scope="col">Standard</th><th scope="col">What the code says</th><th scope="col">Source (checked ' + R.CHECKED + ')</th></tr></thead><tbody>' +
        rs.rules.map(function (r) { return "<tr><th scope=\"row\">" + esc(r.label) + "</th><td data-label=\"What the code says\">" + (r.value == null ? '<span class="bh-verify">Verify with the jurisdiction.</span> ' : esc(r.value) + " ") + (r.note ? '<span class="bh-muted">' + esc(r.note) + "</span>" : "") + '</td><td data-label=\"Source\"><a href="' + esc(r.src.url) + '" target="_blank" rel="noopener">' + esc(r.src.label) + "</a></td></tr>"; }).join("") + "</tbody></table>" + (rs.caveat ? '<p class="bh-muted">' + esc(rs.caveat) + "</p>" : "");
    }
    out.push(page("Code review", cr));

    // Capacity
    var cap = "";
    if (rs) {
      var lines = [];
      if (rs.floorCap) {
        var usedLiving = ctx && ctx.effective ? ctx.effective.floorUsed : v.existing;
        var basisLabel = ctx && ctx.effective && ctx.effective.floorBasis === "gfa" ? "gross floor area you entered" : "assessor finished living area, a stand-in for code-counted floor area";
        var room = usedLiving != null ? rs.floorCap - usedLiving : null;
        var farRatio = (v.lot && v.lot > 0) ? (rs.floorCap / v.lot) : null;
        var usedFar = (v.lot && v.lot > 0 && usedLiving != null) ? (usedLiving / v.lot) : null;
        lines.push(["Floor area cap (FAR)", fmt(rs.floorCap) + " sf (" + esc(rs.floorCapLabel) + ")"]);
        if (farRatio != null) lines.push(["FAR ratio", farRatio.toFixed(2) + " x lot (" + fmt(rs.floorCap) + " / " + fmt(v.lot) + ")" + (usedFar != null ? "; used about " + usedFar.toFixed(2) + " today" : "")]);
        if (room != null) lines.push(["Floor area on record (" + basisLabel + ")", fmt(usedLiving) + " sf"], ["Estimated room left under the cap", room > 0 ? "<strong>About " + fmt(room) + " sf</strong> (" + fmt(rs.floorCap) + " cap minus " + fmt(usedLiving) + " on record)" : "None. The house is at or over the cap as entered."]);
        else lines.push(["Estimated room left under the cap", "Enter the existing finished area under Edit the facts to see the room left."]);
        lines.push(["Before you rely on this", "A floor-area cap counts gross floor area the way the code defines it. Exterior walls, garages and unfinished space can add to the count, and below-grade floor area may be exempt, so the real room can be lower or higher than this estimate. A measured plan settles it. A gross floor area typed under Add a source-backed number replaces the assessor figure here." + (rs.key === "seattle-nr" ? " Since January 2026, ADU floor area counts toward FAR in Seattle NR zones." : "")]);
      } else { lines.push(["Floor area / FAR", esc(rs.floorCapLabel)]); }
      if (rs.coverage) {
        lines.push(["Lot coverage cap", fmt(rs.coverage) + " sf"]);
        var covBase = ctx && ctx.effective ? ctx.effective.buildings : null;
        if (covBase != null) { var left = rs.coverage - covBase; lines.push(["Footprint room left", left > 0 ? "About " + fmt(left) + " sf of new footprint, counting the house outline and any detached footprints" : "None at the ground floor as entered. Building up may still work."]); }
      }
      if (rs.impervious) {
        lines.push(["Impervious surface cap", fmt(rs.impervious) + " sf (all hard surfaces)" + (rs.imperviousMax ? "; up to " + fmt(rs.imperviousMax) + " sf with approved low impact development" : "")]);
        var impBad = !!(ctx && ctx.effective && ctx.effective.impervRejected);
        var usedImp = impBad ? null : (v.imperv != null ? v.imperv : (ctx && ctx.effective ? ctx.effective.impervious : null));
        if (impBad) lines.push(["Impervious room left", '<span class="bh-verify">Not calculated.</span> The impervious figure typed (' + fmt(v.imperv) + " sf) is smaller than the building coverage on this study (" + fmt(ctx.effective.buildings) + " sf). Roofs are impervious. Correct the figure under Edit the facts, or leave it blank."]);
        else if (usedImp != null) { var il = rs.impervious - usedImp; var impHow = v.imperv == null ? "building coverage plus typed or mapped paving" : (s.imperv != null && Number(v.imperv) === Number(s.imperv) && s.impervSrc ? s.impervSrc : "your entry"); lines.push(["Existing impervious (" + esc(impHow) + ")", fmt(usedImp) + " sf"], ["Impervious room left", il > 0 ? "<strong>About " + fmt(il) + " sf</strong> at the base limit" + (rs.imperviousMax ? ", about " + fmt(rs.imperviousMax - usedImp) + " sf at the maximum" : "") : "None at the base limit as entered" + (rs.imperviousMax && rs.imperviousMax > usedImp ? "; about " + fmt(rs.imperviousMax - usedImp) + " sf at the maximum with low impact development" : "") + "."]); }
        else lines.push(["Impervious room left", '<span class="bh-tbd">Not measured.</span> Enter paving under Edit the facts, or add a source-backed driveway and hardscape. Unknown paving is not filled with zero.']);
      }
      if (!rs.floorCap && (ctx && ctx.effective ? ctx.effective.living : v.existing) == null) lines.push(["Existing house size", '<span class="bh-tbd">Not measured.</span> ' + (rs.farNone ? "This zone has no floor-area ratio. " : "No floor-area limit is coded for this zone here. ") + "Enter finished living area under Edit the facts if you have it."]);
      if (rs.sideNote) lines.push(["Side setback split", esc(rs.sideNote)]);
      if (rs.setbackNote) lines.push(["Homes and setbacks", esc(rs.setbackNote)]);
      var typeNote = {
        addition: "An addition keeps the existing foundation and grandfathered conditions where they comply. It must fit the room left under the caps above.",
        adu: "An ADU or detached ADU is often the largest gain on a lot that is near its house size cap, because ADU area is governed by its own size limit.",
        teardown: "A teardown resets the lot to current setbacks, height and caps. Size the new house to the full cap, not the room left over.",
        shop: "A shop can attach to the house (it then follows the house setbacks and adds to its footprint) or stand alone as an accessory building. Either way it counts toward impervious surface, and a vehicle door facing the street needs the driveway length the zone requires.",
        remodel: "An interior remodel inside the existing walls usually does not change floor area, coverage or setbacks. Permits still apply to structural, plumbing, electrical and mechanical work."
      }[v.type];
      lines.push(["For your project type", typeNote]);
      cap = '<table class="bh-table">' + lines.map(function (l) { return "<tr><th scope=\"row\">" + l[0] + "</th><td>" + l[1] + "</td></tr>"; }).join("") + "</table>";
    } else cap = '<p class="bh-verify">' + (v.lot ? "The size limits for this zone are not coded yet. Verify with the jurisdiction." : "Enter the lot size under Edit the facts to see the size limits.") + '</p>';
    out.push(page("Zoning review", "<h3>How much could you add?</h3>" + cap + redFlags(s, v, rs, ctx && ctx.effective ? ctx.effective.floorUsed : null)));

    // Lot imagery and site plan
    var outlineCredit = (/^Snohomish/.test(s.county) && (!s.stateAbbr || s.stateAbbr === "WA")) ? "Snohomish County Assessor parcels"
      : (/^King/.test(s.county) && (!s.stateAbbr || s.stateAbbr === "WA")) ? "King County GIS parcels"
      : (s.landscape && s.landscape.parcelSrc) ? s.landscape.parcelSrc
      : "public parcel outline";
    var img;
    if (s.imagery) {
      var iw = isFinite(Number(s.imagery.W)) ? String(Number(s.imagery.W)) : "0";
      var ih = isFinite(Number(s.imagery.H)) ? String(Number(s.imagery.H)) : "0";
      img = '<figure class="bh-aerial"><div class="bh-aerial-frame"><img src="' + esc(s.imagery.url) + '" alt="Aerial photo of the parcel with the parcel outline drawn on top" width="' + esc(iw) + '" height="' + esc(ih) + '"><svg viewBox="0 0 ' + esc(iw) + " " + esc(ih) + '" aria-hidden="true"><path d="' + esc(s.imagery.path) + '" class="bh-outline" fill="rgba(255,255,255,0.08)" stroke="#ffffff" stroke-width="2"/></svg></div><figcaption>' + esc(s.imagery.credit) + ". Parcel outline: " + esc(outlineCredit) + ". Outlines are approximate and are not a survey. The photo uses a web map projection, so it is not to scale.</figcaption></figure>";
    } else if (s.rings) img = '<p class="bh-muted">' + esc(s.imageryNote || "No aerial photo was returned for this lookup.") + " The site plan uses the parcel outline.</p>";
    else img = '<p class="bh-muted">No parcel outline was found, so no aerial view is shown.</p>';
    out.push(page("Existing lot", '<div class="bh-cols"><div>' + img + '</div><div><h3>Site plan diagram</h3>' + sitePlanSVG(s, rs) + sitePlanKey(s, rs) + '<p class="bh-muted">Diagrammatic only. ' + (s.rings ? "Drawn from the parcel outline." : "No parcel outline was available.") + (s.geo && s.geo.parts > 1 ? " The parcel record has " + s.geo.parts + " outline rings (separate parts, or a hole). The diagram and the envelope use the largest one." : "") + (s.geo && s.geo.corner ? " This is a corner lot. The second street side is drawn at the front setback, which is the cautious choice. Many codes allow a smaller street-side setback." : "") + ' The shaded envelope is every point at least the required setback from each lot line. ' + (s.frontDir ? "The street side was set by hand under Edit the facts." : (s.neighborRings ? "The street side is the lot line with no parcel beyond it nearest the address point; check it against the aerial and set it under Edit the facts if it is wrong." : "Which line is the front, side or rear is our guess from the address point; set the street side under Edit the facts if it is wrong.")) + ' A licensed surveyor sets the real lines.</p></div></div>'));

    // The lot on a live map. Nothing goes to Google until the visitor asks for the map, and the pin is the
    // geocoded point this study used. (Sending the address text let Google choose its own spot, so the map
    // could show a different place than the parcel, and it sent the address without the visitor asking.)
    (function () {
      var lat = (s.lat != null && isFinite(s.lat)) ? Number(s.lat) : null;
      var lon = (s.lon != null && isFinite(s.lon)) ? Number(s.lon) : null;
      if (lat == null || lon == null || CFG.services.googleMap === false) return;
      var pin = lat.toFixed(6) + "," + lon.toFixed(6);
      var embedSrc = "https://maps.google.com/maps?q=" + pin + "&z=19&t=k&output=embed";
      var earthHref = "https://earth.google.com/web/@" + pin + ",80a,120d,35y,0h,0t,0r";
      var gmapsHref = "https://www.google.com/maps/search/?api=1&query=" + pin;
      var body = '<h3>See this lot on the map</h3><p class="bh-muted">The pin is the geocoded point this study used for the parcel and the measurements. The map comes from Google and loads only when you ask for it. Google then receives that point.</p>';
      body += '<div class="bh-map-frame" data-bh-map="' + esc(embedSrc) + '"><button type="button" class="bh-btn bh-map-load">Show the satellite map (loads Google Maps)</button></div>';
      body += '<p><a class="bh-btn" href="' + esc(earthHref) + '" target="_blank" rel="noopener">Open in Google Earth (3D)</a> ';
      body += '<a class="bh-btn bh-btn-ghost" href="' + esc(gmapsHref) + '" target="_blank" rel="noopener">Open in Google Maps</a></p>';
      out.push(page("Lot on the map", body, "bh-noprint"));
    })();

    // Site coverage and landscape stay in every study.
    var seed3d = (ctx && ctx.seed) || seed3D(s, v, rs);
    // Session storage: the address, coordinates and lot outline are gone when the tab closes. Local storage
    // kept them on a shared computer indefinitely. The old key is cleared for visitors who already have one.
    // With no massing page configured (an embed that leaves the sketch out), nothing is stored at all.
    try { if (CFG.massingUrl) sessionStorage.setItem(SEED_KEY, JSON.stringify(seed3d)); localStorage.removeItem("bh3dSeed"); } catch (e) {}

    // Hard rule: keep site coverage and landscape in every study.
    var landBody = '<h3>House, garage, driveway, landscape and slope</h3><p class="bh-muted">Same address and parcel as the rest of this study. Lot broken into house / garage / driveway-paving / landscape SF with slope from public survey layers (USGS 3DEP, county parcel, building footprints). Planning estimate only - not a survey.</p>';
    if (window.BuildHereLandscape && s.landscape) landBody += window.BuildHereLandscape.renderHTML(s.landscape, s);
    else if (window.BuildHereLandscape) landBody += window.BuildHereLandscape.renderHTML({ rows: [], notes: ["Landscape data was not attached to this run."], sources: [], slope: { ok: false, note: "not measured" } }, s);
    else landBody += '<p class="bh-verify" role="alert">The landscape calculator script did not load. Refresh and generate again.</p>';
    out.push(page("Site coverage and landscape", landBody));

    var sb = seed3d.setbacks || {};
    var sbLine = ["front " + (typeof sb.front === "number" ? sb.front + " ft" : "verify"), "side " + (typeof sb.side === "number" ? sb.side + " ft" : "verify"), "rear " + (typeof sb.rear === "number" ? sb.rear + " ft" : "verify")].join(", ");
    var massRows = [
      ["Address", esc(seed3d.address || s.matched || s.input || "")],
      ["Zone", esc(seed3d.zone || "-")],
      ["Lot area", seed3d.lot ? fmt(seed3d.lot) + " sf" : "-"],
      ["Setbacks used", esc(sbLine)],
      ["Height limit", seed3d.height ? seed3d.height + " ft" : "Verify with the jurisdiction"],
      ["Coverage cap", seed3d.coverage ? fmt(seed3d.coverage) + " sf" : "Verify with the jurisdiction"],
      ["Buildable envelope", seed3d.env ? (seed3d.env.area > 0 ? "About " + fmt(seed3d.env.area) + " sf inside setbacks (diagrammatic)" : "No area is left inside the setbacks as drawn. Check the street side under Edit the facts.") : (seed3d.ring ? "Lot outline loaded. The setbacks are not all coded, so no envelope area is drawn." : "No parcel outline in this run")]
    ];
    out.push(page("Massing", '<h3>Massing and envelope</h3><p>These caps and setbacks match the option cards at the top of this study. The massing sketch draws boxes for this lot. It is a diagram, not a permit drawing.</p><table class="bh-table">' + massRows.map(function (r) { return "<tr><th scope=\"row\">" + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join("") + '</table>' + (CFG.massingUrl ? '<p class="bh-noprint"><a class="bh-btn" href="' + esc(CFG.massingUrl) + '">Open the massing sketch for this lot</a></p>' : "")));

    // Plans and permits
    var pm = "<h3>House plans and permit history</h3>";
    if (s.permits.length) pm += '<table class="bh-table bh-permits"><thead><tr><th scope="col">Permit</th><th scope="col">Type</th><th scope="col">Description</th><th scope="col">Issued</th><th scope="col">Finaled</th></tr></thead><tbody>' + s.permits.slice(0, 12).map(function (p) { return "<tr><td data-label=\"Permit\">" + esc(p.id) + "</td><td data-label=\"Type\">" + esc(p.type) + "</td><td data-label=\"Description\">" + esc(p.desc) + "</td><td data-label=\"Issued\">" + esc(p.issued) + "</td><td data-label=\"Finaled\">" + esc(p.final) + "</td></tr>"; }).join("") + "</tbody></table>";
    else if (s.permitSearch === "ok") pm += "<p>No permit records were found for this parcel in the layer read (" + (s.juris === "seattle" ? "Seattle issued and finaled residential permits" : "Snohomish County active permits only") + "). That does not mean none exist; older records are often only on microfilm.</p>";
    else if (s.permitSearch === "failed") pm += "<p>The public permit layer did not answer, so permit history was not searched." + (s.permitLinks.length ? " Use the links below." : "") + "</p>";
    else pm += "<p>Permit history was not searched. No public permit layer is read for this jurisdiction." + (s.permitLinks.length ? " Use the links below or ask the permit office." : " Ask the local permit office.") + "</p>";
    pm += "<p><strong>Plan sets:</strong> We did not find published plan drawings for this address, and we do not draw or guess them. Approved plans are public records you can request from the permit office.</p>";
    if (s.permitLinks.length) pm += "<ul>" + s.permitLinks.map(function (l) { return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + "</a></li>"; }).join("") + "</ul>";
    out.push(page("Records", pm));

    // Next steps
    out.push(page("Next steps", '<ol class="bh-steps"><li><strong>Confirm the facts.</strong> Pull the assessor record, a title report and any recorded easements.</li><li><strong>Survey.</strong> A boundary and topographic survey fixes lot lines, grades and trees.</li><li><strong>Pre-application meeting.</strong> Ask the jurisdiction about the zone, critical areas, drainage and utilities.</li><li><strong>Consultants as needed.</strong> Structural engineer, geotechnical engineer for slopes or poor soils, civil engineer for drainage, arborist for protected trees, septic designer off sewer.</li><li><strong>Design and permit set.</strong> Plans, energy code forms and engineering go to the permit office.</li><li><strong>Bid and build.</strong> Compare bids on the same scope.' + (CFG.links.bids ? ' <a href="' + esc(CFG.links.bids) + '">How to compare bids</a>.' : "") + "</li></ol>" +
      (CFG.cta && CFG.cta.heading ? ctaHtml(CFG.cta.heading, CFG.cta.text || "", CFG.cta.buttons)
        : CFG.showRankingsCta ? ctaHtml("Talk to a local design-build pro", "See the firms the Board ranks for this kind of work, and how we rank them.", [
          { label: "Additions rankings", url: CFG.links.additions }, { label: "Custom home rankings", url: CFG.links.customHomes },
          { label: "How we rank", url: CFG.links.howWeRank, ghost: true }, { label: "Permit resources", url: CFG.links.permits, ghost: true }]) : "")));

    // Data sources
    var attempts = (s.factAttempts || []).map(function (x) { return "<li>" + esc(x.field) + ": " + (x.ok ? "Read: " : "Not filled from: ") + esc(x.name) + (x.note ? " · " + esc(x.note) : "") + (x.url ? ' · <a href="' + esc(x.url) + '" target="_blank" rel="noopener">layer</a>' : "") + "</li>"; }).join("");
    out.push(page("Data sources", "<h3>Limitations and confidence</h3><p class=\"bh-disclaimer\">" + esc(STUDY_LIMITS) + "</p><h3>What we tried for living area and year built</h3>" + (attempts ? "<ul>" + attempts + "</ul>" : "<p>No extra building-fact lookup was required for this run.</p>") + "<h3>What we read for this report</h3><ul>" + s.sources.map(function (x) { return "<li>" + (x.how ? esc(x.how) : (x.ok ? "Read live: " : "No data from: ")) + esc(x.name) + (x.note ? " · " + esc(x.note) : "") + "</li>"; }).join("") + "</ul><h3>Rule sources</h3><ul>" + (rs ? rs.sources : []).map(function (x) { return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + "</a> (checked " + R.CHECKED + ")</li>"; }).join("") + "</ul>" + '<p class="bh-disclaimer"><strong>Planning estimate only.</strong> This is not a legal or zoning determination. Codes change; confirm with the jurisdiction and a licensed professional.</p>'));

    s.exportSources = (s.sources || []).concat((s.factAttempts || []).map(function (x) { return { name: x.field + ": " + x.name, ok: !!x.ok, how: x.ok ? "Read: " : "Not filled from: ", note: x.note || "", url: x.url || "" }; })).concat((rs && rs.sources ? rs.sources : []).map(function (x) { return { name: x.label, ok: true, note: "Zoning rule, checked " + R.CHECKED, url: x.url }; })).concat((s.manual || []).map(function (m) { return { name: "User-entered " + (m.label || m.kind), ok: true, note: (m.method || "") + (m.retrieved ? " " + m.retrieved : "") + (m.source ? " " + m.source : ""), url: m.url || "" }; }));
    var confirm = $("bh-confirm");
    var wrap = $("bh-report-wrap");
    if (confirm && wrap && confirm.parentNode === $("bh-report")) wrap.parentNode.insertBefore(confirm, wrap.nextSibling);
    $("bh-report").innerHTML = out.join("");
    [].forEach.call($("bh-report").querySelectorAll(".bh-aerial-frame img"), function (img) {
      img.addEventListener("error", function () { aerialFailed(s, img.getAttribute("src")); });
    });
    $("bh-report-wrap").hidden = false;
    var stagePage = $("bh-report").querySelector(".bh-stage-page");
    if (stagePage && confirm && stagePage.parentNode) stagePage.parentNode.insertBefore(confirm, stagePage.nextSibling);
    if ($("bh-lead-address")) $("bh-lead-address").value = s.matched || s.input;
  }

  function redFlags(s, v, rs, livingUsed) {
    var f = [];
    if (s.hazards.length) f.push("Mapped critical area or hazard on or touching the parcel: " + s.hazards.map(esc).join(", ") + ". Expect a critical area review and possibly a geotechnical report.");
    if (v.type === "teardown") {
      f.push("A teardown needs a demolition permit, and utilities must be capped first.");
      if (!s.stateAbbr || s.stateAbbr === "WA") f.push('An asbestos survey by a certified inspector is required before demolition in the Puget Sound region (<a href="' + R.SRC.pscaa.url + '" target="_blank" rel="noopener">Puget Sound Clean Air Agency</a>). Older houses can also have lead paint.');
      else f.push("Check local asbestos and lead-paint rules before demolition. Older houses commonly need testing.");
      f.push("A new house loses any grandfathered setbacks or size the old one had.");
    }
    if (s.hazards.some(function (h) { return /1990/.test(h); }) && !s.hazards.some(function (h) { return /2016|City of Kenmore critical/.test(h); })) f.push("The older 1990 county maps flag this parcel but the 2016 landslide and steep slope maps do not. The city may still ask for a geotechnical report to settle it; budget for one.");
    if (s.nearNotices && s.nearNotices.length) {
      var kinds = s.nearNotices.join(", ").split(", ").filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      f.push("A sensitive area notice is recorded on title for " + (s.nearNotices.length === 1 ? "a neighboring parcel" : s.nearNotices.length + " neighboring parcels") + " within about 50 ft of this lot (" + esc(kinds.join(", ")) + "). That points to slope or erosion conditions next door, so expect the city to ask about this lot too.");
    }
    if (s.juris === "kenmore") f.push(s.shoreline ? "The parcel is inside Kenmore shoreline jurisdiction (" + esc(s.shoreline) + "). Work here follows the Shoreline Master Program (KMC Title 16): shoreline buffers and setbacks, vegetation rules, and possibly a shoreline exemption or permit before the building permit." : "We did not find this parcel in Kenmore's shoreline map. If any part of the lot is within 200 ft of Lake Washington or the Sammamish River, the Shoreline Master Program still applies (RCW 90.58), so verify with the city.");
    if (s.juris === "kenmore" && s.hazards.some(function (h) { return /City of Kenmore critical/.test(h); })) f.push("Kenmore's own critical areas map shows a hazard on this parcel. Under KMC 18.55 expect a geotechnical report. Landslide hazard areas carry a buffer of at least the slope height or 50 ft, which a qualified study can reduce to 25 ft (KMC 18.55 Article XVIII). Erosion areas need sediment control and seasonal limits on clearing.");
    if (v.type === "shop") f.push("A shop near a slope or lot line may need retaining walls or engineered footings. Drainage from the new roof and driveway must be managed on site.");
    if (v.type === "addition" || v.type === "shop") f.push("An addition ties into old framing and foundations. Expect surprises in houses built before modern codes, and budget for engineering.");
    if (v.type === "addition" || v.type === "teardown" || v.type === "shop") f.push("Basements or deep footings close to a lot line can need shoring and neighbor coordination. Ask your engineer early.");
    if (s.yearBuilt && +s.yearBuilt < 1980) f.push("Built " + esc(s.yearBuilt) + ": plan for possible asbestos and lead paint testing before any demolition or remodel work.");
    var livingNow = livingUsed != null ? livingUsed : v.existing;
    if (rs && rs.floorCap && livingNow != null && livingNow >= rs.floorCap) f.push("The existing house is at or over the floor area cap as entered. Adding counted floor area may not be allowed. Below-grade space or a different unit count can change the cap, so ask the city.");
    if (!f.length) f.push("No red flags from the data we could read. That is not a clean bill; a site visit matters.");
    return "<h3>Red flags to check</h3><ul class=\"bh-flags\">" + f.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
  }

  /* ---------- lead form ---------- */
  function copyText(text, done, failed) {
    var legacy = function () {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.top = "0"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand("copy");
        ta.remove();
        if (ok) done(); else failed();
      } catch (err) { failed(); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, legacy); else legacy();
  }
  function lead(e) {
    e.preventDefault();
    var f = e.target;
    if (f.company_website && f.company_website.value) return;
    var facts = [];
    if (state) {
      if (state.parcel) facts.push("Parcel: " + state.parcel);
      if (state.jurisLabel) facts.push("Jurisdiction: " + state.jurisLabel);
      var lotv = num("bh-lot"), zv = $("bh-zone").value.trim(), exv = num("bh-existing");
      if (lotv) facts.push("Lot: " + Math.round(lotv) + " sf");
      if (zv) facts.push("Zone: " + zv);
      if (exv) facts.push("Existing house: " + Math.round(exv) + " sf");
    }
    var body = ["Build-here report request", "Name: " + f.name.value, "Email: " + f.email.value, "Phone: " + f.phone.value, "Address: " + f.address.value, "Project type: " + $("bh-type").selectedOptions[0].text, "Notes: " + f.note.value, "", facts.length ? "From the report (public records, unverified):\n" + facts.join("\n") : "", "", "Sent from " + (CFG.leadSource || (location.host + location.pathname))].join("\n");
    var subject = "Build-here question: " + (f.address.value || "no address");
    var st = $("bh-lead-status"), to = String(CFG.leadEmail || "").trim();
    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(to)) { st.textContent = "No contact address is set for this form, so nothing was opened."; return; }
    window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    st.innerHTML = "Your email app should open with the message filled in. Nothing is sent until you press send there. No email app? <button type=\"button\" class=\"bh-linkbtn\" id=\"bh-lead-copy\">Copy the message</button> and send it to <a href=\"mailto:" + esc(to) + "\">" + esc(to) + "</a>.";
    $("bh-lead-copy").addEventListener("click", function () {
      copyText(subject + "\n\n" + body, function () { $("bh-lead-copy").textContent = "Copied"; }, function () {
        // No clipboard here (an in-app browser, or a page not on https). The button used to do nothing.
        var ta = $("bh-lead-text") || document.createElement("textarea");
        ta.id = "bh-lead-text"; ta.className = "bh-input"; ta.rows = 8; ta.readOnly = true; ta.value = subject + "\n\n" + body;
        ta.setAttribute("aria-label", "Message to copy");
        st.appendChild(ta); ta.focus(); ta.select();
        $("bh-lead-copy").textContent = "Copying did not work here. Select the text below and copy it";
      });
    });
  }

  function setStatus(t) { $("bh-status").textContent = t; }

  function exportStatus(t) { var el = $("bh-export-status") || $("bh-status"); if (el) el.textContent = t; }
  function downloadStudy() {
    var Ex = window.BuildHereExport;
    var report = $("bh-report");
    if (!Ex || !report || !state) { exportStatus("The study file could not be made. Reload the page and look the address up again."); return; }
    var file = Ex.buildStudyFile({
      address: state.matched || state.input || "Address not matched",
      date: state.prepared || todayStamp(),
      bodyHtml: report.innerHTML,
      sources: state.exportSources || state.sources || [],
      limitations: STUDY_LIMITS,
      baseHref: CFG.siteBase,
      brand: CFG.brand,
      contact: CFG.contactLine
    });
    var a = document.createElement("a"), url = URL.createObjectURL(new Blob([file], { type: "text/html" }));
    var slug = String(state.matched || state.input || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    a.href = url;
    a.download = "feasibility-study" + (slug ? "-" + slug : "") + ".html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // In-app browsers and some phones drop a file made in the page without a word. The visitor is told what to expect and what to do.
    exportStatus("Saved " + a.download + " to your downloads. If no file appeared, this browser blocked it: press Print and choose Save as PDF.");
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function renderManualList() {
    var list = $("bh-manual-list");
    if (!list || !state) return;
    var items = state.manual || [];
    list.innerHTML = items.length ? items.map(function (m, i) {
      var amount = (m.sfLow != null && m.sfHigh != null) ? (m.sfLow + " to " + m.sfHigh + " sf") : ((m.sf != null ? m.sf + " sf" : "no amount"));
      return "<li>" + esc(m.label || m.kind) + ": " + esc(amount) + " · " + esc(m.method || "manual") + (m.retrieved ? " · " + esc(m.retrieved) : "") + (m.source ? " · " + esc(m.source) : "") + " <button type=\"button\" class=\"bh-linkbtn\" data-man-del=\"" + i + "\">Remove</button></li>";
    }).join("") : "<li>No extra source-backed numbers yet.</li>";
  }
  function addManual(e) {
    e.preventDefault();
    if (!state || !window.BuildHereMeasures) return;
    var raw = {
      kind: $("bh-man-kind").value,
      sf: $("bh-man-sf").value,
      sfLow: $("bh-man-low").value,
      sfHigh: $("bh-man-high").value,
      source: $("bh-man-source").value.trim(),
      url: $("bh-man-url").value.trim(),
      retrieved: $("bh-man-date").value,
      method: $("bh-man-method").value,
      confidence: $("bh-man-conf").value,
      automatic: false
    };
    var cleaned = window.BuildHereMeasures.cleanMeasure(raw);
    var note = $("bh-man-note");
    if (!cleaned.ok) { if (note) note.textContent = cleaned.error; return; }
    if (!cleaned.measure.source) { if (note) note.textContent = "Name the source, such as the assessor card or the survey sheet."; return; }
    state.manual = state.manual || [];
    state.manual.push(cleaned.measure);
    if (note) note.textContent = "Added. The study shows this beside any automatic number.";
    $("bh-man-sf").value = "";
    $("bh-man-low").value = "";
    $("bh-man-high").value = "";
    renderManualList();
    render();
  }
  function sampleState() {
    var s = blank();
    s.input = "Sample lot";
    s.matched = "Sample lot (not a property record)";
    s.juris = "outside";
    s.jurisLabel = "Example County (sample)";
    s.county = "Example County";
    s.stateAbbr = "WA";
    s.city = "Example";
    s.lot = 12088;
    s.lotSrc = "Illustrative lot area for this sample. Not a client file.";
    s.footprint = 3278;
    s.footprintSrc = "Illustrative roof outline for this sample. Not living area.";
    s.footprintKind = "roof";
    s.prepared = "2026-11-09";
    s.lon = -90.0091;
    s.lat = 40.0006;
    s.rings = [[[-90.01, 40], [-90.01, 40.0012], [-90.0082, 40.0012], [-90.0082, 40], [-90.01, 40]]];
    s.landscape = {
      rows: [
        { key: "lot", label: "Lot area", sf: 12088, conf: "Low", src: "Sample only." },
        { key: "house", label: "House footprint (on this lot)", sf: 3278, conf: "Low", src: "Sample roof outline. Includes eaves. Not living area." },
        { key: "garage", label: "Detached garage / accessory building", sf: null, conf: "Unavailable", src: "Not measured. Left blank." },
        { key: "drive", label: "Driveway and parking", sf: null, conf: "Unavailable", src: "Not measured. Not entered as 0." },
        { key: "hard", label: "Walkways, patios, decks and other hardscape", sf: null, conf: "Unavailable", src: "Not measured. Not entered as 0." },
        { key: "land", label: "Unclassified open area (not verified landscaping)", sf: 8810, verifiedLandscape: false, conf: "Low", src: "Lot area minus the roof outline only. Not landscaping." }
      ],
      notes: ["Sample layout. These numbers are not a property record."],
      sources: [],
      slope: { ok: false, note: "not measured in the sample" },
      flags: []
    };
    s.sources = [{ name: "Sample fixture", ok: true, note: "No live lookup. Not a client address." }];
    return s;
  }
  /* Printing. The study is copied into #bh-print-host, a direct child of <body>, and
     body.bh-printing hides every other child of <body> for that print only. The same
     path serves the tool page, the homepage embed and any other host page, and it
     covers both the Print button and the browser's own Print command (beforeprint).
     When no study is on the page nothing is touched and the page prints as usual. */
  var printJob = null;
  function cleanupPrint() {
    if (!printJob) return;
    document.body.classList.remove("bh-printing");
    if (printJob.host.parentNode) printJob.host.parentNode.removeChild(printJob.host);
    if (printJob.page.parentNode) printJob.page.parentNode.removeChild(printJob.page);
    printJob = null;
  }
  function preparePrint(fromButton) {
    // window.print() from the button fires beforeprint right after the button built the copy.
    if (printJob && printJob.fresh && !fromButton) { printJob.fresh = false; return; }
    cleanupPrint();
    var report = $("bh-report"), wrap = $("bh-report-wrap");
    if (!report || !wrap || wrap.hidden || !report.children.length) return;
    var host = document.createElement("div"), box = host;
    host.id = "bh-print-host";
    if (ROOT !== document && CFG.printCss && host.attachShadow) {
      // The page's stylesheets do not reach into a shadow root and the tool's do not reach out of one,
      // so the copy gets a shadow root of its own with the tool's stylesheet inside it.
      var shadow = host.attachShadow({ mode: "open" }), sheet = document.createElement("style");
      sheet.textContent = CFG.printCss;
      box = document.createElement("div");
      shadow.appendChild(sheet); shadow.appendChild(box);
      if (CFG.hostStyle) host.setAttribute("style", CFG.hostStyle); // the embed's color and size variables
    }
    box.className = "bh-report bh-print-copy" + (CFG.rootClass ? " " + CFG.rootClass : ""); // rootClass: the embed's wrapper class
    box.innerHTML = report.innerHTML;
    [].forEach.call(box.querySelectorAll(".bh-noprint,script,iframe,video,button"), function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    [].forEach.call(box.querySelectorAll("[id]"), function (el) { el.removeAttribute("id"); });
    var page = document.createElement("style");
    // These rules are also in build-here.css. They are repeated here so an embed that keeps the stylesheet
    // inside a shadow root needs nothing in the page's own styles for printing to work.
    page.textContent = "@page{size:auto;margin:0.6in}#bh-print-host{display:none}@media print{body.bh-printing{background:#fff!important}body.bh-printing>*:not(#bh-print-host){display:none!important}body.bh-printing>#bh-print-host{display:block!important}}";
    document.head.appendChild(page);
    document.body.appendChild(host);
    document.body.classList.add("bh-printing");
    printJob = { host: host, page: page, fresh: !!fromButton };
  }
  function printReport() { preparePrint(true); window.print(); }

  function init() {
    if (!$("bh-form")) return;
    $("bh-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var a = $("bh-address").value.trim();
      if (!a) { setStatus("Enter a street address with city and ZIP."); return; }
      $("bh-go").disabled = true;
      $("bh-report-wrap").hidden = true;
      lookup(a).then(function (s) {
        $("bh-go").disabled = false;
        if (!s) return;
        state = s;
        if (!s.matched) { setStatus(s.lookupError ? "The address lookup did not finish (" + s.lookupError + "). The address was not rejected. Wait a minute and try again." : "We could not match that address. Check the spelling and include the city and ZIP."); return; }
        try {
        fillForm(s);
        setStatus(s.juris === "other" ? "Found it in " + s.jurisLabel + ". We could not match that city to our list; verify the rules with the city. You can still read the parcel data below."
          : s.juris === "outside" ? "Found " + s.matched + ". Zoning numbers are not coded for this place yet. Verify setbacks, coverage and FAR with the jurisdiction. Parcel, landscape, and slope still run where a public layer answers. Missing paving stays blank."
          : s.manualZone ? "Found " + s.matched + " in " + s.jurisLabel + ". " + s.city + " does not publish a zoning map we can read, so enter the zone from the city map below."
          : s.parcelWarn ? "Found " + s.matched + ". " + s.parcelWarn
          : "Found " + s.matched + ". Options for this lot are first. Edit a fact under the study if a number is wrong.");
        render();
        if ($("bh-step3")) $("bh-step3").focus();
        } catch (err) {
          // Without this the status line said "Found" and nothing appeared.
          setStatus("Found " + s.matched + ", and the study could not be drawn. Reload the page and try again.");
          if (window.console && console.error) console.error(err);
        }
      });
    });
    $("bh-confirm-form").addEventListener("submit", function (e) { e.preventDefault(); if (state) { render(); if ($("bh-step3")) $("bh-step3").focus(); } });
    $("bh-print").addEventListener("click", printReport);
    window.addEventListener("beforeprint", function () { preparePrint(false); });
    window.addEventListener("afterprint", cleanupPrint);
    if ($("bh-download")) $("bh-download").addEventListener("click", downloadStudy);
    if ($("bh-manual-form")) $("bh-manual-form").addEventListener("submit", addManual);
    if ($("bh-manual-list")) $("bh-manual-list").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-man-del]") : null;
      if (!btn || !state || !state.manual) return;
      state.manual.splice(parseInt(btn.getAttribute("data-man-del"), 10), 1);
      renderManualList();
      render();
      // The Remove button that had focus is gone with its row. Say what happened and put focus on a control that exists.
      if ($("bh-man-note")) $("bh-man-note").textContent = "Removed. The study no longer uses that number.";
      if ($("bh-man-kind")) $("bh-man-kind").focus();
    });
    if ($("bh-lead")) $("bh-lead").addEventListener("submit", lead);
    $("bh-report").addEventListener("click", function (e) {
      // A link to a section of the tool (Edit the facts) is followed here, so it also works when the tool is
      // mounted where the browser cannot resolve the fragment by id.
      var jump = e.target.closest ? e.target.closest('a[href^="#bh-"]') : null, dest = jump ? $(jump.getAttribute("href").slice(1)) : null;
      if (dest) {
        e.preventDefault();
        dest.scrollIntoView({ block: "start" });
        var head = dest.querySelector("h2,h3");
        if (head) { head.setAttribute("tabindex", "-1"); head.focus({ preventScroll: true }); }
        return;
      }
      var btn = e.target.closest ? e.target.closest(".bh-map-load") : null;
      var frame = btn ? btn.parentNode : null, src = frame ? frame.getAttribute("data-bh-map") || "" : "";
      if (!btn || !/^https:\/\/maps\.google\.com\/maps\?q=-?[0-9.]+,-?[0-9.]+&/.test(src)) return;
      var f = document.createElement("iframe");
      f.title = "Google Maps satellite view of the geocoded point";
      f.setAttribute("referrerpolicy", "no-referrer");
      f.setAttribute("allowfullscreen", "");
      f.src = src;
      frame.innerHTML = "";
      frame.appendChild(f);
    });
    var params = new URLSearchParams(location.search);
    if (params.get("sample") === "1" && (CFG.allowSample || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))) {
      state = sampleState();
      fillForm(state);
      render();
      setStatus("Sample layout only. These numbers are not a property record.");
      return;
    }
    var p = params.get("bh_address") || params.get("address");
    if (p) {
      // Analytics, browser history and copied links all carry the page URL, so the address does not stay in it.
      try {
        params.delete("bh_address"); params.delete("address");
        var rest = params.toString();
        history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
      } catch (e) {}
      $("bh-address").value = p; $("bh-go").click();
    }
  }
  // An embed builds the markup first and then calls init() itself (autoInit: false).
  if (CFG.autoInit !== false) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); }
  window.BuildHere = { polyAreaSqft: polyAreaSqft, minRect: minRect, classifyEdges: classifyEdges, envelopeRows: envelopeRows, init: init };
})();
