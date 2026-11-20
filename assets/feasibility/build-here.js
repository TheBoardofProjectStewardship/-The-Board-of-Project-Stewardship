/* What can I build here? Address lookup, report builder and red flags.
   Runs fully in the browser against free public GIS services. */
(function () {
  "use strict";
  var R = window.BuildHereRules;
  var G = window.BuildHereGeom, SP = window.BuildHereSitePlan, SUM = window.BuildHereSummary;
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
         services: { esriGeocoder: false, worldImagery: true, googleMap: true, openStreetMap: true, msFootprints: true },
         phone: "(555) 010-0100", email: "office@example.com", site: "example.com", license: "",
         leadUrl: "/wp-json/example/v1/lead", hideLinkOnly: false
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
      allowSample: false, listingFactsUrl: "", // ?sample=1 draws a labeled sample study; off except on a local test server
      googleMapsKey: "", // empty: free massing only. No key is shipped and no Google request is made.
      google3dTilesKey: "", // unused. Map3DElement is an Immersive Maps load. This page does not call the Map Tiles API.
      geocodeUrl: "",
      // The firm named in the title block of the sheets and in the contact rows. Each is left off when empty.
      legalName: "",       // the firm's full name for the title block; the brand name when empty
      tagline: "", phone: "", email: "", site: "", servicesLine: "", license: "", logoUrl: "",
      bookUrl: "",         // where "Book a site visit" goes. Empty: the lead form on this page.
      leadUrl: "",         // a same-origin address that takes the lead form as JSON and emails it (the plugin's REST route)
      leadHeader: "",      // a request header that route expects, so another site's form cannot post to it
      sheets: true,        // the two-page summary (site plan sheet, facts sheet) and the option sheets
      hideLinkOnly: false, // true leaves out the blocks that give a link and no fact about this lot. Off: nothing is cut.
      kcBuildingsUrl: "", kcBuildingsName: "", // a King County building-outline layer, when the site names one
      kcAerialUrl: "", kcAerialCredit: "",     // a newer King County aerial service than the one built in
      services: { esriGeocoder: true, worldImagery: true, googleMap: true, openStreetMap: true, msFootprints: true, snoHouseSize: true, soils: true, flood: true }
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
  /* A call-to-action button may also dial or open an email, when the target is written strictly as one.
     linkUrl() dropped every tel: and mailto: target, so a site's "Call" and "Email" buttons never appeared. */
  function ctaUrl(u) {
    u = String(u == null ? "" : u).trim();
    if (/^tel:\+?[0-9][0-9().\- ]{5,22}$/i.test(u)) return u;
    if (/^mailto:[^\s@<>"'?&]+@[^\s@<>"'?&]+\.[^\s@<>"'?&]+(\?subject=[A-Za-z0-9%+._,\- ]{0,120})?$/i.test(u)) return u;
    return linkUrl(u);
  }
  /* The firm's details for the title block and contact rows. A logo is an https address or a path on this site. */
  function brandInfo() {
    var logo = String(CFG.logoUrl || "").trim();
    if (logo && !/^https:\/\//i.test(logo)) { try { logo = /^\/[^\/]/.test(logo) ? new URL(logo, location.href).href : ""; } catch (e) { logo = ""; } }
    return { name: CFG.legalName || CFG.brand || "", tagline: CFG.tagline || "", phone: CFG.phone || "", email: CFG.email || "", site: CFG.site || "", services: CFG.servicesLine || "", license: CFG.license || "", logoUrl: logo };
  }
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
    // The county names its aerial service by year. A site can point at a newer one (kcAerialUrl) without a new build.
    kcAerial: /^https:\/\/[^\s"'<>]+\/MapServer\/export$/i.test(String(CFG.kcAerialUrl || "")) ? String(CFG.kcAerialUrl) : "https://gismaps.kingcounty.gov/arcgis/rest/services/BaseMaps/KingCo_Aerial_2025/MapServer/export",
    fema: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query",
    sda: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest",
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
    /* County assessor and permit layers checked Nov 2026. Queries name the fields they read.
       Owner, taxpayer, and applicant name fields exist on some of these layers and are never requested. */
    pierceParcel: "https://services2.arcgis.com/1UvBaQ5y1ubjUPmd/arcgis/rest/services/Tax_Parcels/FeatureServer/0/query",
    pierceBldg: "https://services2.arcgis.com/1UvBaQ5y1ubjUPmd/arcgis/rest/services/PCB_Buildings/FeatureServer/0/query",
    pierceZone: "https://services2.arcgis.com/1UvBaQ5y1ubjUPmd/arcgis/rest/services/Zoning/FeatureServer/0/query",
    piercePermits: "https://services2.arcgis.com/1UvBaQ5y1ubjUPmd/arcgis/rest/services/Permits_Pierce_County/FeatureServer/0/query",
    kitsapParcel: "https://services6.arcgis.com/qt3UCV9x5kB4CwRA/arcgis/rest/services/ParcelDetails/FeatureServer/0/query",
    kitsapBldg: "https://services6.arcgis.com/qt3UCV9x5kB4CwRA/arcgis/rest/services/Building_Information/FeatureServer/0/query",
    kitsapZone: "https://services6.arcgis.com/qt3UCV9x5kB4CwRA/arcgis/rest/services/Zoning_Designations/FeatureServer/0/query",
    kitsapPermits: "https://services6.arcgis.com/qt3UCV9x5kB4CwRA/arcgis/rest/services/Permits/FeatureServer/0/query",
    skagitParcel: "https://gis.skagitcountywa.gov/arcgis/rest/services/OpenData/AssessorDataParcels/FeatureServer/0/query",
    waParcel: "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0/query",
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
  /* A lot outline as a query shape. A long outline is thinned first, about a foot at a time. Only an outline
     still over 600 points is asked about as a box, and flag.box then tells the caller, because a box reaches
     past the lot. The limit was 150 points, so a curved or many-cornered lot was always asked about as a box
     and its neighbors' hazards were reported as its own. */
  function polyQuery(rings, extra, flag) {
    var count = function (rs) { return rs.reduce(function (a, r) { return a + r.length; }, 0); };
    var use = rings, n = count(rings);
    if (n > 300 && G) {
      for (var tol = 0.000003, t = 0; t < 6 && n > 300; t++, tol *= 2) {
        use = rings.map(function (r) { return G.simplify(r, tol, true); });
        n = count(use);
      }
    }
    var geom, type;
    if (n > 600) { var b = bbox(rings); geom = b.join(","); type = "esriGeometryEnvelope"; if (flag) flag.box = true; }
    else { geom = JSON.stringify({ rings: use, spatialReference: { wkid: 4326 } }); type = "esriGeometryPolygon"; }
    return Object.assign({ f: "json", geometry: geom, geometryType: type, inSR: 4326, spatialRel: "esriSpatialRelIntersects", returnGeometry: false }, extra || {});
  }
  function bbox(rings) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    rings.forEach(function (r) { r.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); }); });
    return b;
  }
  /* Local planar frame in feet around a reference latitude. */
  function toFeet(rings, lat0, lon0) {
    // One projection for the whole study: the shared geometry module's, when it is loaded.
    if (G && G.frame) return G.project(rings, G.frame(lat0, lon0));
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
  /* A point well inside the lot (lon, lat), and the lot drawn in a few feet from its lines. A query made with
     either does not pick up what belongs to the lot next door, which shares the lot line. */
  function innerPoint(rings) {
    if (!G || !rings || !rings.length) return null;
    var fr = G.frameOf(rings), q = G.labelPoint(G.project(rings, fr));
    return fr.inv(q.x, q.y);
  }
  function shrunk(rings, ft) {
    if (!G || !rings || !rings.length) return rings;
    var fr = G.frameOf(rings), R2 = G.project(rings, fr), c = G.labelPoint(R2), k = 1 - ft / Math.max(8, Math.sqrt(G.area(R2)) / 2);
    return R2.map(function (r) { return r.map(function (q) { return fr.inv(c.x + (q[0] - c.x) * k, c.y + (q[1] - c.y) * k); }); });
  }

  /* ---------- analytics ---------- */
  /* Events go to the Google tag the site already loads (Site Kit). Nothing is configured here and no tag is
     added. An event carries a county, a jurisdiction, a zone code or a button name. It never carries the
     address, the parcel number, a coordinate, a name, an email or a phone number. */
  var EVENT_KEYS = { county: 1, jurisdiction: 1, zone_code: 1, rules_coded: 1, reason: 1, cta: 1, placement: 1, method: 1, project_type: 1, sheet: 1, drawn: 1 };
  function track(name, params) {
    try {
      var p = {}, k;
      for (k in (params || {})) if (Object.prototype.hasOwnProperty.call(params, k) && EVENT_KEYS[k] && params[k] != null) p[k] = typeof params[k] === "boolean" ? params[k] : String(params[k]).slice(0, 80);
      if (typeof window.gtag === "function") window.gtag("event", name, p);
      else if (window.dataLayer && typeof window.dataLayer.push === "function") (function () { window.dataLayer.push(arguments); })("event", name, p);
    } catch (e) {}
  }
  /* Where the visitor came from, read once from the page address and kept for the lead message only. */
  var ATTR = (function () {
    var out = {}, keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid"];
    try {
      var saved = JSON.parse(sessionStorage.getItem("bhAttr") || "{}"), q = new URLSearchParams(location.search), any = false;
      keys.forEach(function (k) { var v = q.get(k); if (v) { out[k] = String(v).slice(0, 120); any = true; } });
      if (any) sessionStorage.setItem("bhAttr", JSON.stringify(out));
      else keys.forEach(function (k) { if (saved[k]) out[k] = String(saved[k]).slice(0, 120); });
    } catch (e) {}
    return out;
  })();

  /* ---------- data model ---------- */
  var state = null;
  function blank() {
    return { input: "", matched: "", lon: null, lat: null, county: "", city: "", juris: "other", jurisLabel: "", parcel: "", assessorUrl: "", lot: null, lotSrc: "", zone: "", zoneSrc: "", existing: null, existingSrc: "", existingAsOf: "", existingFile: "", footprint: null, footprintSrc: "", footprintKind: "", firstFloor: null, firstFloorSrc: "", garageFloor: null, garageFloorSrc: "", yearBuilt: "", yearSrc: "", rings: null, hazards: [], hazardNotes: [], nearNotices: [], frontDir: "", permits: [], permitSearch: "none", permitNote: "", permitLinks: [], imagery: null, sources: [], manual: [], prepared: "", factAttempts: [], hazardScope: "", hazardShapes: [], hazardHits: [], neighborParcels: null, soils: null, flood: null, basementTotal: null, basementFinished: null, basementGarage: null, upperFloor: null, halfFloor: null, deck: null, beds: null, baths: null, yrRenov: "", garageNone: false, basementNone: false, countyFin: null, snoHouse: null, listingFacts: null, isSample: false, seq: 0, editSeq: {}, formWas: null, gen: 0 };
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
    else if (s.county && (!s.stateAbbr || s.stateAbbr === "WA")) s.juris = "county";
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
        return parcelForCounty(s);
      })
      .then(function () { return cityCheck(s); })
      // The lot outline comes first. When the county lookup gave none, a statewide layer is asked before
      // anything else, so that the hazard and permit layers are asked about the lot. They used to be asked
      // about a small box at the address point while the outline was still on its way, and the study then
      // said the parcel had been checked.
      .then(function () { return outlineFirst(s); })
      .then(function () { return Promise.all([zoning(s), hazards(s), permits(s), extras(s), neighbors(s), landscape(s), kingLivingSqft(s), snoBuildingFacts(s), snoHouseSize(s), countyAssessor(s), soils(s), flood(s), listingFacts(s)]); })
      .then(function () {
        clearTimeout(slow);
        if (s.gen !== lookupGen) return null;
        // A city's own impervious figure is the one used. It and the mapped estimate arrive in either order.
        if (s.impervCity) { s.imperv = s.impervCity.sf; s.impervSrc = s.impervCity.src; }
        recordFactGaps(s); buildImagery(s);
        return s;
      })
      .catch(function (e) {
        clearTimeout(slow);
        if (s.gen !== lookupGen) return null;
        if (e && e.message === "nomatch") return s;
        log(s, false, "Lookup", "Stopped early: " + (e && e.message));
        if (!s.matched) s.lookupError = (e && e.message) || "no answer"; // a service that is down is not "no such address"
        return s;
      });
  }

  function outlineFirst(s) {
    var L = window.BuildHereLandscape;
    if (s.rings || s.lon == null || !L || !L.resolveParcel) return Promise.resolve();
    if (s.gen === lookupGen) setStatus("Found " + s.matched + ". Looking for the lot outline...");
    return L.resolveParcel(s).then(function () {}, function () {});
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
      var EXTRACT = "King County Assessor residential building extract", sumOf = many ? ", the sum of " + nB + " buildings" : "";
      s.existing = Math.round(rec[0]);
      s.existingAsOf = fileDay;
      s.existingBuildings = nB;
      s.existingSrc = EXTRACT + " (SqFtTotLiving" + (many ? ", the sum of " + nB + " building records on this parcel" : "") + ")" + dayLabel;
      s.existingNote = many ? "This parcel has " + nB + " residential building records. The figure is their sum, not one house." : (nB ? "" : "When a parcel has more than one residential building record, this figure is their sum.");
      var age = fileDay ? Math.round((Date.now() - Date.parse(fileDay)) / 86400000) : NaN;
      if (isFinite(age) && age > 120) s.existingNote += (s.existingNote ? " " : "") + "The county file used here is " + age + " days old. A remodel or a new building since then is not in it.";
      if (rec[1]) noteYear(s, rec[1], EXTRACT + " (YrBuilt" + (many ? ", the earliest of " + nB + " buildings" : "") + ")");
      if (rec[2] && !s.stories) { s.stories = rec[2]; s.storiesSrc = EXTRACT + " (Stories" + (many ? ", the tallest of " + nB + " buildings" : "") + ")"; }
      if (rec[3]) { s.firstFloor = Math.round(rec[3]); s.firstFloorSrc = "King County Assessor first-floor SF (SqFt1stFloor" + sumOf + "). Not a roof outline and not living area."; }
      // Index version 3 keeps the attached garage and the basement garage apart, and tells a blank from a
      // zero: null is a blank in the county file, 0 is the county saying there is none. Older index files added
      // the two garage columns together and wrote 0 for a blank, so from them a 0 is read as "not known".
      var v3 = Number(j.v) >= 3, pos = function (x) { return typeof x === "number" && isFinite(x) && x > 0 ? Math.round(x) : null; };
      if (pos(rec[4])) {
        s.garageFloor = pos(rec[4]);
        s.garageFloorSrc = v3 ? "King County Assessor attached garage square feet (SqFtGarageAttached" + sumOf + "). Floor area, not a detached building footprint."
          : "King County Assessor garage square feet (the attached and basement garage columns added together in this index file" + sumOf + "). Floor area, not a detached building footprint.";
      }
      if (v3) {
        if (pos(rec[6])) { s.basementGarage = pos(rec[6]); s.basementGarageSrc = "King County Assessor basement garage square feet (SqFtGarageBasement" + sumOf + ")"; }
        if (pos(rec[7])) { s.basementTotal = pos(rec[7]); s.basementSrc = "King County Assessor basement square feet (SqFtTotBasement" + sumOf + ")"; }
        if (pos(rec[7]) && typeof rec[8] === "number" && rec[8] >= 0) s.basementFinished = Math.min(Math.round(rec[8]), pos(rec[7]));
        if (pos(rec[9])) s.upperFloor = pos(rec[9]);
        if (pos(rec[10])) s.halfFloor = pos(rec[10]);
        if (pos(rec[11])) s.deck = pos(rec[11]);
        if (pos(rec[12])) s.beds = pos(rec[12]);
        if (typeof rec[13] === "number" && rec[13] > 0) s.baths = Math.round(rec[13] * 100) / 100;
        if (pos(rec[14]) && rec[14] > 1800) s.yrRenov = String(pos(rec[14]));
        s.garageNone = rec[4] === 0 && rec[6] === 0;
        s.basementNone = rec[7] === 0;
      }
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

  var ST_TYPE = { AVENUE: "AVE", AVE: "AVE", AV: "AVE", STREET: "ST", ST: "ST", ROAD: "RD", RD: "RD", DRIVE: "DR", DR: "DR", PLACE: "PL", PL: "PL", COURT: "CT", CT: "CT", LANE: "LN", LN: "LN", BOULEVARD: "BLVD", BLVD: "BLVD", WAY: "WAY", WY: "WAY", CIRCLE: "CIR", CIR: "CIR", TERRACE: "TER", TER: "TER", PARKWAY: "PKWY", PKWY: "PKWY", HIGHWAY: "HWY", HWY: "HWY", LOOP: "LOOP", TRAIL: "TRL", TRL: "TRL" };
  var ST_DIR = { N: "N", NORTH: "N", S: "S", SOUTH: "S", E: "E", EAST: "E", W: "W", WEST: "W", NE: "NE", NORTHEAST: "NE", NW: "NW", NORTHWEST: "NW", SE: "SE", SOUTHEAST: "SE", SW: "SW", SOUTHWEST: "SW" };
  /* The street type and the directions in a street name, in one spelling: "4TH AVENUE WEST" gives AVE and W. */
  function streetParts(street) {
    var t = String(street || "").toUpperCase().split(",")[0].replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean), type = "", dirs = [];
    t.forEach(function (w) { if (ST_DIR[w]) dirs.push(ST_DIR[w]); else if (ST_TYPE[w]) type = ST_TYPE[w]; });
    return { type: type, dirs: dirs.sort() };
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

  /* A county name from the geocoder picks the public parcel layer. King and Snohomish keep their
     existing readers. Pierce, Kitsap, and Skagit use the assessor layers checked above. Any other
     Washington county tries the statewide parcel layer, which has an outline and a parcel number
     and does not carry house size or year built. */
  function parcelForCounty(s) {
    if (/^King/.test(s.county || "")) return kingParcel(s);
    if (/^Snohomish/.test(s.county || "")) return snoParcel(s);
    if (/^Pierce/.test(s.county || "")) return pierceParcel(s);
    if (/^Kitsap/.test(s.county || "")) return kitsapParcel(s);
    if (/^Skagit/.test(s.county || "")) return skagitParcel(s);
    if (!s.stateAbbr || s.stateAbbr === "WA") return waParcel(s);
    return Promise.resolve();
  }
  function sqlLit(v) { return String(v == null ? "" : v).replace(/'/g, "''").replace(/[%_]/g, "").slice(0, 80); }
  function countyYear(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 1800 || n > new Date().getFullYear() + 1) return null;
    return Math.round(n);
  }
  function countySf(v) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0 || n > 500000) return null;
    return Math.round(n);
  }
  function countyDate(v) {
    if (v == null || v === "") return "";
    if (typeof v === "number" && isFinite(v) && v > 1e11) {
      try { return new Date(v).toISOString().slice(0, 10); } catch (e) { return ""; }
    }
    var s = String(v), m = s.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
    var d = Date.parse(s);
    if (isFinite(d) && d > 0) {
      try { return new Date(d).toISOString().slice(0, 10); } catch (e2) { return ""; }
    }
    return "";
  }
  function rememberCounty(s, field, value, source) {
    if (value == null || value === "") return;
    s.countyFacts = s.countyFacts || [];
    s.countyFacts.push({ field: field, value: String(value), source: source });
  }
  /* Address search, then the lot nearest the geocoded point. `read` copies attributes onto the study.
     It must not read owner, taxpayer, or contact name fields. */
  function matchParcel(s, url, fields, addressField, read, layerName) {
    var hs = houseAndStreet(s.matched || "");
    var streetWord = (hs.street || "").split(/\s+/).filter(function (w) { return w && !ST_TYPE[w] && !ST_DIR[w] && (/\d/.test(w) || w.length >= 3); })[0] || "";
    var like = hs.num ? (addressField + " LIKE '%" + sqlLit(hs.num) + (streetWord ? "%" + sqlLit(streetWord) : "") + "%'") : "";
    var asked = like ? getJSON(url, { f: "json", where: like, outFields: fields, returnGeometry: true, outSR: 4326, resultRecordCount: 25 }) : Promise.resolve({ features: [] });
    return asked.then(function (j) {
      var ranked = rankParcels(s, j.features || []);
      if (ranked.length) return { pick: ranked[0], how: "address", others: Math.max(0, ranked.length - 1) };
      return byLocation(s, url, fields);
    }).then(function (hit) {
      if (!hit) { log(s, false, layerName, "No parcel matched."); return; }
      var a = hit.pick.f.attributes || {};
      noteParcelMatch(s, hit, String(a[addressField] || "").trim());
      read(hit.pick.f, a, hit);
      s.parcelLayer = { url: url, idField: s.parcelIdField || "" };
      log(s, true, layerName, hit.how === "address" ? "matched by street address" : "matched by location, not by address");
    }).catch(function (e) { log(s, false, layerName, e.message); });
  }
  function pierceParcel(s) {
    return matchParcel(s, EP.pierceParcel, "TaxParcelNumber,Site_Address,Land_Acres,Landuse_Description", "Site_Address", function (f, a) {
      s.parcel = String(a.TaxParcelNumber || "");
      s.parcelIdField = "TaxParcelNumber";
      s.rings = f.geometry && f.geometry.rings;
      var acres = Number(a.Land_Acres);
      if (isFinite(acres) && acres > 0) {
        s.lot = Math.round(acres * 43560);
        s.lotSrc = "County record (Pierce County assessor, Land_Acres)";
        s.lotKind = "record";
        rememberCounty(s, "Lot area", fmt(s.lot) + " sf", s.lotSrc);
      } else if (s.rings) {
        s.lot = Math.round(polyAreaSqft(s.rings));
        s.lotSrc = "County record (Pierce County parcel outline; the acreage field was blank)";
        s.lotKind = "outline";
      }
      if (a.Landuse_Description) rememberCounty(s, "Land use", String(a.Landuse_Description).slice(0, 80), "County record (Pierce County assessor, Landuse_Description). Not a zoning code.");
    }, "Pierce County tax parcels");
  }
  function kitsapParcel(s) {
    return matchParcel(s, EP.kitsapParcel, "PARCEL_ID,APN,RP_ACCT_ID,SITE_ADDR,YEAR_BUILT,ZONE_CODE,LIS_ACRES,POLY_ACRES", "SITE_ADDR", function (f, a) {
      s.parcel = String(a.PARCEL_ID || a.APN || "");
      s.parcelIdField = "PARCEL_ID";
      s.kitsapAcct = a.RP_ACCT_ID != null ? String(a.RP_ACCT_ID) : "";
      s.rings = f.geometry && f.geometry.rings;
      var acres = Number(a.LIS_ACRES || a.POLY_ACRES);
      if (isFinite(acres) && acres > 0) {
        s.lot = Math.round(acres * 43560);
        s.lotSrc = "County record (Kitsap County assessor, " + (a.LIS_ACRES ? "LIS_ACRES" : "POLY_ACRES") + ")";
        s.lotKind = "record";
        rememberCounty(s, "Lot area", fmt(s.lot) + " sf", s.lotSrc);
      } else if (s.rings) {
        s.lot = Math.round(polyAreaSqft(s.rings));
        s.lotSrc = "County record (Kitsap County parcel outline; the acreage field was blank)";
        s.lotKind = "outline";
      }
      var y = countyYear(a.YEAR_BUILT);
      if (y && noteYear(s, y, "County record (Kitsap County assessor, YEAR_BUILT)")) rememberCounty(s, "Year built", String(y), "County record (Kitsap County assessor, YEAR_BUILT)");
      if (a.ZONE_CODE && !s.zone) {
        s.zone = String(a.ZONE_CODE).trim();
        s.zoneSrc = "County record (Kitsap County assessor, ZONE_CODE)";
        rememberCounty(s, "Zone", s.zone, s.zoneSrc);
      }
    }, "Kitsap County assessor parcels");
  }
  function skagitParcel(s) {
    var hs = houseAndStreet(s.matched || "");
    var word = (hs.street || "").split(/\s+/).filter(function (w) { return w && !ST_TYPE[w] && !ST_DIR[w] && (/\d/.test(w) || w.length >= 3); })[0] || "";
    var where = hs.num ? "SitusStNo='" + sqlLit(hs.num) + "'" + (word ? " AND SitusStName LIKE '%" + sqlLit(word) + "%'" : "") : "";
    var fields = "PARCELID,SitusStNo,SitusStName,SitusCSZ,Acres,YearBuilt,LivingArea,LandUse,GarageSqFt,NoOfBedrooms,FinishedBasement";
    var asked = where ? getJSON(EP.skagitParcel, { f: "json", where: where, outFields: fields, returnGeometry: true, outSR: 4326, resultRecordCount: 25 }) : Promise.resolve({ features: [] });
    return asked.then(function (j) {
      var ranked = rankParcels(s, j.features || []);
      if (ranked.length) return { pick: ranked[0], how: "address", others: Math.max(0, ranked.length - 1) };
      return byLocation(s, EP.skagitParcel, fields);
    }).then(function (hit) {
      if (!hit) { log(s, false, "Skagit County assessor parcels", "No parcel matched."); return; }
      var f = hit.pick.f, a = f.attributes || {};
      noteParcelMatch(s, hit, [a.SitusStNo, a.SitusStName].filter(Boolean).join(" "));
      s.parcelLayer = { url: EP.skagitParcel, idField: "PARCELID" };
      s.parcel = String(a.PARCELID || "");
      s.parcelIdField = "PARCELID";
      s.rings = f.geometry && f.geometry.rings;
      var acres = Number(a.Acres);
      if (isFinite(acres) && acres > 0) {
        s.lot = Math.round(acres * 43560);
        s.lotSrc = "County record (Skagit County assessor, Acres)";
        s.lotKind = "record";
        rememberCounty(s, "Lot area", fmt(s.lot) + " sf", s.lotSrc);
      } else if (s.rings) {
        s.lot = Math.round(polyAreaSqft(s.rings));
        s.lotSrc = "County record (Skagit County parcel outline; the acreage field was blank)";
        s.lotKind = "outline";
      }
      var y = countyYear(a.YearBuilt);
      if (y && noteYear(s, y, "County record (Skagit County assessor, YearBuilt)")) rememberCounty(s, "Year built", String(y), "County record (Skagit County assessor, YearBuilt)");
      var live = countySf(a.LivingArea);
      if (live && !s.existing) {
        s.existing = live;
        s.existingSrc = "County record (Skagit County assessor, LivingArea)";
        rememberCounty(s, "Finished living area", fmt(live) + " sf", s.existingSrc);
      }
      if (a.LandUse) rememberCounty(s, "Land use", String(a.LandUse).slice(0, 80), "County record (Skagit County assessor, LandUse). Not a zoning code.");
      var gar = countySf(a.GarageSqFt);
      if (gar && !s.garageFloor) { s.garageFloor = gar; s.garageFloorSrc = "County record (Skagit County assessor, GarageSqFt)"; rememberCounty(s, "Garage", fmt(gar) + " sf", s.garageFloorSrc); }
      if (a.NoOfBedrooms != null && countySf(a.NoOfBedrooms) && s.beds == null) { s.beds = countySf(a.NoOfBedrooms); rememberCounty(s, "Bedrooms", String(s.beds), "County record (Skagit County assessor, NoOfBedrooms)"); }
      log(s, true, "Skagit County assessor parcels", hit.how === "address" ? "matched by street address" : "matched by location, not by address");
    }).catch(function (e) { log(s, false, "Skagit County assessor parcels", e.message); });
  }
  function waParcel(s) {
    var county = String(s.county || "").replace(/\s+County$/i, "");
    if (!county) return Promise.resolve();
    var hs = houseAndStreet(s.matched || "");
    var where = "COUNTY_NM LIKE '" + sqlLit(county) + "%'" + (hs.num ? " AND SITUS_ADDRESS LIKE '%" + sqlLit(hs.num) + "%'" : "");
    return getJSON(EP.waParcel, { f: "json", where: where, outFields: "PARCEL_ID_NR,SITUS_ADDRESS,SITUS_CITY_NM,COUNTY_NM", returnGeometry: true, outSR: 4326, resultRecordCount: 25 }).then(function (j) {
      var ranked = rankParcels(s, j.features || []);
      var hit = ranked.length ? { pick: ranked[0], how: "address", others: Math.max(0, ranked.length - 1) } : null;
      if (!hit) return byLocation(s, EP.waParcel, "PARCEL_ID_NR,SITUS_ADDRESS,SITUS_CITY_NM,COUNTY_NM");
      return hit;
    }).then(function (hit) {
      if (!hit) { log(s, false, "Washington statewide parcels", "No parcel matched."); s.countyRecordNote = "Parcel, house size, year built, zoning, and permit history are not available online for " + s.county + "."; return; }
      var f = hit.pick.f, a = f.attributes || {};
      noteParcelMatch(s, hit, String(a.SITUS_ADDRESS || "").trim());
      s.parcel = String(a.PARCEL_ID_NR || "");
      s.rings = f.geometry && f.geometry.rings;
      if (s.rings && !s.lot) {
        s.lot = Math.round(polyAreaSqft(s.rings));
        s.lotSrc = "County record (Washington statewide parcel outline for " + s.county + "; the layer has no assessor lot-area field)";
        s.lotKind = "outline";
      }
      s.countyRecordNote = "The statewide parcel layer has an outline and a parcel number for " + s.county + ". House size, year built, zoning, and permit history are not available online from a county assessor layer for this county.";
      log(s, true, "Washington statewide parcels", s.county);
    }).catch(function (e) {
      s.countyRecordNote = "County records are not available online for " + (s.county || "this county") + ".";
      log(s, false, "Washington statewide parcels", e.message);
    });
  }
  /* Building facts and permits that are not already read by the King and Snohomish paths. */
  function countyAssessor(s) {
    if (/^Pierce/.test(s.county || "") && s.parcel) return pierceBuildings(s).then(function () { return piercePermits(s); });
    if (/^Kitsap/.test(s.county || "") && s.kitsapAcct) return kitsapBuildings(s).then(function () { return kitsapPermits(s); });
    if (/^Skagit/.test(s.county || "")) {
      s.permitSearch = s.permitSearch || "none";
      s.permitNote = "Skagit County's public permit layer does not publish permit numbers. Ask the Skagit County permit counter.";
      return Promise.resolve();
    }
    if (s.juris === "county" && !/^Pierce|^Kitsap|^Skagit|^King|^Snohomish/.test(s.county || "")) {
      s.permitSearch = "none";
      if (!s.countyRecordNote) s.countyRecordNote = "House size, year built, zoning, and permit history are not available online for " + (s.county || "this county") + ".";
    }
    return Promise.resolve();
  }
  function pierceBuildings(s) {
    var id = sqlLit(s.parcel);
    return getJSON(EP.pierceBldg, { f: "json", where: "TaxParcelNumber='" + id + "'", outFields: "TaxParcelNumber,Year_Built,Built_As_Square_Feet,Built_As_Description,Stories,Bedrooms,Bathrooms,Year_Remodeled", returnGeometry: false, resultRecordCount: 12 }).then(function (j) {
      var rows = (j.features || []).map(function (f) { return f.attributes || {}; }).filter(function (a) { return countySf(a.Built_As_Square_Feet) || countyYear(a.Year_Built); });
      if (!rows.length) { rememberCounty(s, "Building size", "not in the county building layer", "County record (Pierce County buildings). No row with a size or a year."); return; }
      rows.sort(function (a, b) { return (countySf(b.Built_As_Square_Feet) || 0) - (countySf(a.Built_As_Square_Feet) || 0); });
      var top = rows[0], sf = countySf(top.Built_As_Square_Feet), y = countyYear(top.Year_Built);
      var src = "County record (Pierce County buildings, Built_As_Square_Feet). This is the size the county recorded for the building, not confirmed finished living area, so it is not used in the floor-area math.";
      if (sf) rememberCounty(s, "Largest building", fmt(sf) + " sf" + (rows.length > 1 ? " (" + rows.length + " buildings on the parcel; they are not added)" : "") + (top.Built_As_Description ? ", " + String(top.Built_As_Description).slice(0, 40) : ""), src);
      if (y && noteYear(s, y, "County record (Pierce County buildings, Year_Built)")) rememberCounty(s, "Year built", String(y), "County record (Pierce County buildings, Year_Built)");
      if (countySf(top.Stories)) rememberCounty(s, "Stories", String(countySf(top.Stories)), "County record (Pierce County buildings, Stories)");
      log(s, true, "Pierce County buildings", rows.length + " row" + (rows.length > 1 ? "s" : ""));
    }).catch(function (e) { log(s, false, "Pierce County buildings", e.message); });
  }
  function piercePermits(s) {
    var id = sqlLit(s.parcel);
    return getJSON(EP.piercePermits, { f: "json", where: "parcelNumber='" + id + "'", outFields: "applicationNumber,applicationType,applicationStatus,issuedDate,finalDate", returnGeometry: false, resultRecordCount: 24 }).then(function (j) {
      s.permits = (j.features || []).map(function (f) {
        var a = f.attributes || {};
        return { id: a.applicationNumber || "Number not in the layer", type: a.applicationType || "", desc: a.applicationStatus || "", issued: countyDate(a.issuedDate), final: countyDate(a.finalDate) };
      });
      s.permitSearch = "ok";
      log(s, true, "Pierce County permits", s.permits.length + " record" + (s.permits.length === 1 ? "" : "s"));
    }).catch(function (e) { s.permitSearch = "failed"; log(s, false, "Pierce County permits", e.message); });
  }
  function kitsapBuildings(s) {
    var id = sqlLit(s.kitsapAcct);
    return getJSON(EP.kitsapBldg, { f: "json", where: "RP_ACCT_ID='" + id + "'", outFields: "RP_ACCT_ID,YEAR_BUILT,STORIES,FLR_FIN_SF,FLR_TOT_SF,BEDROOMS,FULL_BATHS,HALF_BATHS,DET_GAR_SF,BLDG_TYP", returnGeometry: false, resultRecordCount: 12 }).then(function (j) {
      var rows = (j.features || []).map(function (f) { return f.attributes || {}; });
      if (!rows.length) { rememberCounty(s, "Finished floor area", "not in the county building layer", "County record (Kitsap County Building_Information). No row for this account."); return; }
      rows.sort(function (a, b) { return (countySf(b.FLR_FIN_SF) || 0) - (countySf(a.FLR_FIN_SF) || 0); });
      var top = rows[0], fin = countySf(top.FLR_FIN_SF), y = countyYear(top.YEAR_BUILT);
      if (fin && !s.existing) {
        s.existing = fin;
        s.existingSrc = "County record (Kitsap County assessor, FLR_FIN_SF" + (rows.length > 1 ? "; largest of " + rows.length + " improvement rows, not added" : "") + ")";
        rememberCounty(s, "Finished floor area", fmt(fin) + " sf", s.existingSrc);
      }
      if (y && noteYear(s, y, "County record (Kitsap County assessor, YEAR_BUILT)")) rememberCounty(s, "Year built", String(y), "County record (Kitsap County assessor building layer, YEAR_BUILT)");
      var gar = countySf(top.DET_GAR_SF);
      if (gar && !s.detGarageFloor) { s.detGarageFloor = gar; rememberCounty(s, "Detached garage", fmt(gar) + " sf", "County record (Kitsap County assessor, DET_GAR_SF)"); }
      log(s, true, "Kitsap County buildings", rows.length + " row" + (rows.length > 1 ? "s" : ""));
    }).catch(function (e) { log(s, false, "Kitsap County buildings", e.message); });
  }
  function kitsapPermits(s) {
    var id = sqlLit(s.kitsapAcct);
    return getJSON(EP.kitsapPermits, { f: "json", where: "RP_ACCT_ID='" + id + "'", outFields: "PERMIT_NO,TYPE_CODE,STATUS,ISSUED_DATE,STATUS_DATE", returnGeometry: false, resultRecordCount: 24 }).then(function (j) {
      s.permits = (j.features || []).map(function (f) {
        var a = f.attributes || {};
        return { id: a.PERMIT_NO || "Number not in the layer", type: a.TYPE_CODE || "", desc: a.STATUS || "", issued: countyDate(a.ISSUED_DATE), final: countyDate(a.STATUS_DATE) };
      });
      s.permitSearch = "ok";
      log(s, true, "Kitsap County permits", s.permits.length + " record" + (s.permits.length === 1 ? "" : "s"));
    }).catch(function (e) { s.permitSearch = "failed"; log(s, false, "Kitsap County permits", e.message); });
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
    // The distinctive words of the street name: every word that is not a street type or a direction (those are
    // compared below), with a number or three letters or more. Words of up to three letters used to be dropped,
    // so OAK, ELM, BAY and FIR streets never matched by address and fell back to the lot under the point.
    var names = hs.street.split(/\s+/).map(function (w) { return w.replace(/[^A-Z0-9]/g, ""); }).filter(function (w) { return w && !ST_TYPE[w] && !ST_DIR[w]; });
    var words = names.filter(function (w) { return /\d/.test(w) || w.length >= 3; });
    if (!words.length) words = names; // "AVENUE D": the letter is the whole name
    function hasWord(addr, w) { return new RegExp("(^|[^A-Z0-9])" + w + "([^A-Z0-9]|$)").test(addr); }
    // "123 4TH AVE W" and "123 4TH ST SE" share a house number, a ZIP and their one distinctive word. The street
    // type and the direction have to agree too, wherever both addresses give one.
    var want = streetParts(hs.street);
    function partsAgree(addr) {
      var got = streetParts(String(addr).replace(/^\s*\d+[A-Z]?\s+/, ""));
      if (want.type && got.type && want.type !== got.type) return false;
      if (want.dirs.length && got.dirs.length && want.dirs.join(" ") !== got.dirs.join(" ")) return false;
      return true;
    }
    // No house number means no address search: a blank number matches every vacant lot in the ZIP.
    var byNumber = hs.num ? getJSON(EP.snoParcel, { f: "json", where: "Site_House_Number='" + hs.num + "'" + (zip ? " AND Site_Zip LIKE '" + zip + "%'" : ""), outFields: fields, returnGeometry: true, outSR: 4326 }) : Promise.resolve({ features: [] });
    return byNumber
      .then(function (j) {
        // The same house number in the same ZIP is not the same address. Every distinctive word of the
        // street name has to be on the county record too, and the street type and direction have to agree.
        // "123 SUNSET BLVD" must not match "123 MAIN BLVD" on the strength of BLVD.
        var byAddr = !words.length ? [] : rankParcels(s, j.features).filter(function (c) {
          var addr = String(c.f.attributes.Site_Address || "").toUpperCase().replace(/'/g, "");
          return words.every(function (w) { return hasWord(addr, w); }) && partsAgree(addr);
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

  function snoBuildingFacts(s) {
    if (!/^Snohomish/.test(s.county || "") || (s.stateAbbr && s.stateAbbr !== "WA")) return Promise.resolve();
    s.factAttempts = s.factAttempts || [];
    if (CFG.hideLinkOnly) s.factAttempts.push({ field: "Finished living area", name: "Snohomish County public map layers", ok: false, note: "The parcel and appraisal layers carry no finished living area, story count or garage area. House size is read from the county improvement records." });
    else {
      s.factAttempts.push({ field: "Finished living area", name: "Snohomish County parcels (SAS_Parcels)", ok: false, note: "Read the public parcel layer. It has no finished living area, story count, or garage floor-area field." });
      s.factAttempts.push({ field: "Finished living area", name: "Snohomish County appraisal characteristics", ok: false, note: "SAS_Appraisal_Characteristics publishes condition, grade, and land type, not living area." });
      s.factAttempts.push({ field: "Finished living area", name: "Assessor account page", ok: false, note: s.assessorUrl ? "The county link is kept below. An unsigned request does not return building facts, and this tool does not sign in." : "No assessor account link was on the parcel." });
      s.factAttempts.push({ field: "Finished living area", name: "Listing sites", ok: false, note: "Redfin and Zillow are not queried. No supported public endpoint was verified." });
    }
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
  /* Snohomish County house size. The page reads the house-size index that scripts/build_index.py builds from
     the county's Improvement Records workbook (approved by the owner, Nov 17, 2026). The index holds, for each
     parcel number, the FinSize column, the year built, the bedroom count and the stories of the dwelling
     record. It holds no owner, taxpayer or mailing field, and none is read here. FinSize is shown as the
     county's figure with its source. It is not used as finished living area in the floor-area math: basement,
     lower-level and attic finished area are separate county columns that the index does not add. */
  function snoHouseSize(s) {
    var Ms = window.BuildHereMeasures;
    if (!/^Snohomish/.test(s.county || "") || (s.stateAbbr && s.stateAbbr !== "WA")) return Promise.resolve();
    s.factAttempts = s.factAttempts || [];
    var NAME = "Snohomish County Improvement Records (house-size index)";
    function miss(note) { s.factAttempts.push({ field: "House size", name: NAME, ok: false, note: note }); return null; }
    if (CFG.services.snoHouseSize === false) { miss("Turned off for this site. Enter the living area from the assessor record."); return Promise.resolve(); }
    var pin = String(s.parcel || "").replace(/[^0-9A-Za-z]/g, "");
    if (pin.length < 8 || !Ms || !Ms.readHouseSize) { miss(pin ? "The parcel number is not in the form the index uses." : "No parcel number, so the index was not read."); return Promise.resolve(); }
    var file = "house-size/snoh/" + pin.slice(0, 4) + ".json";
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, TIMEOUT);
    return fetch(CFG.dataBase + file, { credentials: "omit", signal: ctl.signal }).then(function (r) {
      if (!r.ok) return miss("data unavailable. The house-size file for this parcel (" + file + ") " + (r.status === 404 || r.status === 410 ? "was not found" : "could not be loaded (HTTP " + r.status + ")") + ". House size was not filled in from it.");
      // Some hosts answer a missing file with a web page and status 200, so the body is checked before it is used.
      return r.text().then(function (text) { var j = null; try { j = JSON.parse(text); } catch (e) { j = null; } return j && typeof j === "object" && !Array.isArray(j) ? j : miss("data unavailable. The house-size file for this parcel (" + file + ") could not be read."); });
    }).then(function (j) { clearTimeout(timer); return j; }, function (e) {
      clearTimeout(timer);
      return miss("data unavailable. The house-size file for this parcel could not be loaded" + (e && e.name === "AbortError" ? " (it took longer than " + Math.round(TIMEOUT / 1000) + " seconds)" : "") + ".");
    }).then(function (j) {
      if (!j) { log(s, false, NAME, "the data file was not read"); return; }
      var h = Ms.readHouseSize(j[pin] || j[String(s.parcel)]);
      if (!h || (h.fin == null && h.year == null && h.beds == null && h.stories == null)) { miss("data unavailable. Parcel " + pin + " is not in the published house-size index, or its record is blank. No house size is shown."); log(s, false, NAME, "parcel not in the index"); return; }
      var SRC = "Snohomish County Improvement Records workbook, read through this site's house-size index";
      s.snoHouse = h;
      if (h.fin != null) {
        s.countyFin = { sf: Math.round(h.fin), source: SRC + " (FinSize column" + (h.kind && h.kind !== "res" ? ", record type " + h.kind : "") + ")", note: Ms.houseSizeNote ? Ms.houseSizeNote() : "" };
        s.countyFinSrc = s.countyFin.source;
      }
      if (h.year != null) noteYear(s, h.year, SRC + " (YrBuilt)");
      // scripts/build_index.py stores whole numbers, so a 1.5-story house reads as 1 in these files.
      if (h.stories != null && !s.stories) { s.stories = h.stories; s.storiesSrc = SRC + " (Stories" + (h.stories === Math.round(h.stories) ? "; these files may drop a half story" : "") + ")"; }
      if (h.beds != null && s.beds == null) s.beds = h.beds;
      s.factAttempts.push({ field: "House size", name: NAME, ok: true, note: (h.fin != null ? "FinSize " + fmt(Math.round(h.fin)) + " sf. " : "FinSize is blank on the record. ") + "Shown as the county's figure. Basement, lower-level and attic finished area are separate columns and are not added, so it is not used as finished living area in the floor-area math." });
      log(s, true, NAME, h.fin != null ? Math.round(h.fin) + " sf (FinSize)" : "record read, FinSize blank");
    }).catch(function (e) { log(s, false, NAME, e.message); });
  }
  function recordFactGaps(s) {
    s.factAttempts = s.factAttempts || [];
    var king = /^King/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA");
    var sno = /^Snohomish/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA");
    if (king && s.existing) s.factAttempts.push({ field: "Finished living area", name: "King County Assessor residential building extract", ok: true, note: s.existingSrc || "SqFtTotLiving" });
    if (/^Snohomish/.test(s.county || "") && s.countyFin) s.factAttempts.push({ field: "House size", name: "Snohomish County Improvement Records", ok: true, note: "County record. " + (s.countyFin.source || "FinSize") });
    if (!king && !sno && !s.existing) {
      s.factAttempts.push({ field: "Finished living area", name: "County assessor", ok: false, note: s.countyRecordNote || ("Finished living area is not available online for " + (s.county || "this county") + ". Nothing was filled in.") });
      if (!CFG.hideLinkOnly) s.factAttempts.push({ field: "Finished living area", name: "Listing sites", ok: false, note: "Redfin and Zillow are not queried. No supported public endpoint was verified." });
    }
  }

  /* Neighboring parcel outlines. They tell which lot lines face a street (no parcel on the other side), which
     face an alley (a parcel a few feet across), and they are drawn in grey around the lot on the site plan.
     Only the parcel number is asked for with each outline, and only to leave this lot's own outline out. */
  function neighbors(s) {
    if (!s.rings) return Promise.resolve();
    var waNbr = !s.stateAbbr || s.stateAbbr === "WA";
    var url = (waNbr && /^King/.test(s.county || "")) ? EP.kcParcel : (waNbr && /^Snohomish/.test(s.county || "")) ? EP.snoParcel : (s.parcelLayer && s.parcelLayer.url) || null;
    if (!url) return Promise.resolve();
    var b = bbox(s.rings), pad = 0.0003;
    var idField = url === EP.kcParcel ? "PIN" : url === EP.snoParcel ? "PARCEL_ID" : (s.parcelLayer && s.parcelLayer.idField) || "OBJECTID";
    return getJSON(url, { f: "json", geometry: [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad].join(","), geometryType: "esriGeometryEnvelope", inSR: 4326, spatialRel: "esriSpatialRelIntersects", outFields: idField, returnGeometry: true, outSR: 4326 })
      .then(function (j) {
        var own = String(s.parcel || ""), key = idField;
        s.neighborRings = []; s.neighborParcels = [];
        (j.features || []).forEach(function (f) {
          if (!f.geometry || !f.geometry.rings) return;
          if (own && String((f.attributes || {})[key] || "") === own) return; // the query box also returns this lot
          s.neighborParcels.push(f.geometry.rings);
          f.geometry.rings.forEach(function (r) { s.neighborRings.push(r); });
        });
      })
      .catch(function () { s.neighborRings = null; s.neighborParcels = null; });
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
    if (/^Pierce/.test(s.county || "")) {
      return getJSON(EP.pierceZone, ptQuery(s.lon, s.lat, { outFields: "ZONING,JURISDICT" })).then(function (j) {
        var f = (j.features || [])[0];
        if (f && f.attributes.ZONING) {
          s.zone = String(f.attributes.ZONING).trim();
          s.zoneSrc = "County record (Pierce County zoning map" + (f.attributes.JURISDICT ? ", " + String(f.attributes.JURISDICT).slice(0, 40) : "") + ")";
          rememberCounty(s, "Zone", s.zone, s.zoneSrc);
        }
        log(s, true, "Pierce County zoning");
      }).catch(function (e) { log(s, false, "Pierce County zoning", e.message); });
    }
    if (/^Kitsap/.test(s.county || "")) {
      return getJSON(EP.kitsapZone, ptQuery(s.lon, s.lat, { outFields: "ZONEBREV,ZONE_DESCRIPTION" })).then(function (j) {
        var f = (j.features || [])[0];
        if (f && (f.attributes.ZONEBREV || f.attributes.ZONE_DESCRIPTION)) {
          s.zone = String(f.attributes.ZONEBREV || f.attributes.ZONE_DESCRIPTION).trim();
          s.zoneSrc = "County record (Kitsap County zoning map)";
          rememberCounty(s, "Zone", s.zone, s.zoneSrc);
        }
        log(s, true, "Kitsap County zoning");
      }).catch(function (e) { log(s, false, "Kitsap County zoning", e.message); });
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
    var flag = {};
    return getJSON(url, polyQuery(rings, where ? { returnCountOnly: true, where: where } : { returnCountOnly: true }, flag)).then(function (j) {
      if (flag.box) s.hazardBox = true;
      if (j.count > 0) { list.push(label); s.hazardHits.push({ url: url, label: label, where: where || "" }); }
    }).catch(function () { s.hazardNotes.push(label + ": layer did not answer (" + srcName + ")"); });
  }
  /* The outline of each mapped hazard that touches the lot, for the site plan. Only layers that reported a hit
     are asked, and only when a real lot outline was used. A layer that does not answer costs the drawing its
     hatch and nothing else: the hazard stays on the list. */
  function hazardShapes(s) {
    if (!s.rings || !s.hazardHits.length || CFG.sheets === false) return Promise.resolve();
    return Promise.all(s.hazardHits.slice(0, 6).map(function (h) {
      var extra = { returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.000005, geometryPrecision: 6, resultRecordCount: 30 };
      if (h.where) extra.where = h.where;
      return getJSON(h.url, polyQuery(s.rings, extra)).then(function (j) {
        var rings = [];
        (j.features || []).forEach(function (f) { if (f.geometry && f.geometry.rings) f.geometry.rings.forEach(function (r) { if (r.length >= 4 && rings.length < 80) rings.push(r); }); });
        if (rings.length) s.hazardShapes.push({ label: h.label, rings: rings });
      }).catch(function () {});
    }));
  }
  function hazards(s) {
    var rings = s.rings || (s.lon != null ? [[[s.lon - 0.0001, s.lat - 0.0001], [s.lon + 0.0001, s.lat - 0.0001], [s.lon + 0.0001, s.lat + 0.0001], [s.lon - 0.0001, s.lat + 0.0001], [s.lon - 0.0001, s.lat - 0.0001]]] : null);
    if (!rings) return Promise.resolve();
    // What was asked about: the lot, or only the address point. The study says which.
    s.hazardScope = s.rings ? "parcel" : "point";
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
          if (f && f.attributes.SUM_impervious_area_update) { s.imperv = Math.round(f.attributes.SUM_impervious_area_update); s.impervSrc = "City of Kenmore impervious surface by parcel (the city's 2024 layer)"; s.impervCity = { sf: s.imperv, src: s.impervSrc }; log(s, true, "City of Kenmore impervious surface by parcel"); }
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
    return Promise.all(jobs).then(function () {
      if (s.hazardBox) s.hazardScope = "box";
      log(s, s.hazardNotes.length === 0, s.hazardSource || "Hazard layers", s.hazardNotes.join("; "));
      return hazardShapes(s);
    });
  }

  function permits(s) {
    if (s.juris === "seattle") {
      s.permitLinks = [{ label: "Seattle Services Portal (search by address for permits and records)", url: LINKS.seaPortal }, { label: "SDCI permits and records help", url: LINKS.seaSdci }];
      if (!s.rings) return Promise.resolve();
      return getJSON(EP.seaPermits, polyQuery(shrunk(s.rings, 3), { outFields: "PRMT_NR,STGLSTTITL,APTYPE,ISS_DATE,FINAL_DATE" })).then(function (j) {
        s.permits = (j.features || []).sort(function (x, y) { return (y.attributes.ISS_DATE || 0) - (x.attributes.ISS_DATE || 0); }).map(function (f) { var a = f.attributes; return { id: a.PRMT_NR, type: a.APTYPE, desc: a.STGLSTTITL, issued: a.ISS_DATE ? new Date(a.ISS_DATE).toISOString().slice(0, 10) : "", final: a.FINAL_DATE ? new Date(a.FINAL_DATE).toISOString().slice(0, 10) : "" }; });
        s.permitSearch = "ok";
        log(s, true, "Seattle issued and finaled residential permits");
      }).catch(function (e) { s.permitSearch = "failed"; log(s, false, "Seattle residential permits", e.message); });
    }
    if (s.juris === "kenmore") { s.permitLinks = [{ label: "MyBuildingPermit permit search (Kenmore records)", url: LINKS.mbp }, { label: "King County permit records before Kenmore incorporated (1998)", url: LINKS.kcPortal }]; return Promise.resolve(); }
    if (s.juris === "kc") { s.permitLinks = [{ label: "King County Permitting portal (search by parcel number)", url: LINKS.kcPortal }]; return Promise.resolve(); }
    if (s.juris === "edmonds") {
      s.permitNote = "City of Edmonds permits are not in the county layer. Ask the City of Edmonds Development Services permit counter. The county active-permit layer is still read below when it answers.";
      if (!s.rings) { s.permitSearch = "none"; return Promise.resolve(); }
      return getJSON(EP.snoHost + "PLANNING__active_permits/FeatureServer/0/query", polyQuery(shrunk(s.rings, 3), { outFields: "permit_number,PERMIT_NUMBER,permit_no,permit_type,PERMIT_TYPE,type,status,STATUS,permit_status" })).then(function (j) {
        s.permits = (j.features || []).map(function (f) { var a = f.attributes || {};
          return { id: a.permit_number || a.PERMIT_NUMBER || a.permit_no || "Number not in the layer", type: a.permit_type || a.PERMIT_TYPE || a.type || "", desc: a.status || a.STATUS || a.permit_status || "", issued: "", final: "" };
        });
        s.permitSearch = "ok";
        log(s, true, "Snohomish County active permits layer");
      }).catch(function (e) { s.permitSearch = "failed"; log(s, false, "Snohomish County active permits", e.message); });
    }
    if (s.juris === "city") {
      var c = R.CITY[s.cityKey];
      s.permitLinks = [{ label: "City of " + c.name + " (permits, planning and records requests)", url: c.home }, { label: c.code.label, url: c.code.url }, { label: "MyBuildingPermit permit search (many King and Snohomish cities)", url: LINKS.mbp }];
      if (/^King/.test(s.county)) s.permitLinks.push({ label: "King County permit records from before the area became a city", url: LINKS.kcPortal });
      return Promise.resolve();
    }
    if (s.juris === "sno") {
      s.permitLinks = [{ label: "Snohomish County PDS residential permits", url: LINKS.snoPds }];
      if (!s.rings) return Promise.resolve();
      // The lot is drawn in 3 ft from its lines for this question, so a permit on the lot next door, which shares
      // the lot line, is not listed here.
      return getJSON(EP.snoHost + "PLANNING__active_permits/FeatureServer/0/query", polyQuery(shrunk(s.rings, 3), { outFields: "*" })).then(function (j) {
        s.permits = (j.features || []).map(function (f) { var a = f.attributes;
          // The permit number, its type and its status are kept. A row id is not a permit number. The layer's
          // description and project name are free text that often carries a person's name, so neither is read.
          return { id: a.permit_number || a.PERMIT_NUMBER || a.permit_no || "Number not in the layer", type: a.permit_type || a.PERMIT_TYPE || a.type || "", desc: a.status || a.STATUS || a.permit_status || "", issued: "", final: "" };
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

  /* Soil map unit at the lot, from the USDA NRCS Soil Survey through Soil Data Access. One request, and only
     the location goes with it. A soil map unit is mapped at about 1:24,000, so it is shown as an estimate and
     never as a soils report. */
  function soils(s) {
    if (s.lon == null || CFG.services.soils === false) return Promise.resolve();
    var NAME = "USDA NRCS Soil Survey (Soil Data Access)";
    var pt = s.rings ? innerPoint(s.rings) : null, lon = Number(pt ? pt[0] : s.lon), lat = Number(pt ? pt[1] : s.lat);
    if (!isFinite(lon) || !isFinite(lat)) return Promise.resolve();
    var q = "SELECT TOP 1 mu.muname, c.hydgrp, c.drainagecl, c.comppct_r FROM mapunit mu INNER JOIN component c ON c.mukey = mu.mukey WHERE mu.mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(" + lon.toFixed(6) + " " + lat.toFixed(6) + ")')) ORDER BY c.comppct_r DESC";
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, TIMEOUT);
    return fetch(EP.sda, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs({ format: "JSON", query: q }), credentials: "omit", signal: ctl.signal })
      .finally(function () { clearTimeout(t); })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        var row = j && j.Table && j.Table[0];
        if (!row || !row[0]) { s.soils = { ok: false, note: "no soil map unit at this location" }; log(s, true, NAME, "no map unit at this location"); return; }
        s.soils = { ok: true, name: String(row[0]).slice(0, 120), hsg: row[1] ? String(row[1]).slice(0, 8) : "", drainage: row[2] ? String(row[2]).slice(0, 60) : "" };
        log(s, true, NAME, s.soils.name);
      })
      .catch(function (e) { s.soils = { ok: false, note: "data unavailable: the USDA soil service did not answer" }; log(s, false, NAME, e && e.name === "AbortError" ? "timeout" : (e && e.message)); });
  }
  /* FEMA flood zone at the lot, from the National Flood Hazard Layer. */
  function flood(s) {
    if (s.lon == null || CFG.services.flood === false) return Promise.resolve();
    var NAME = "FEMA National Flood Hazard Layer", fields = { outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF" };
    return getJSON(EP.fema, s.rings ? polyQuery(s.rings, fields) : ptQuery(s.lon, s.lat, fields)).then(function (j) {
      var zones = [], sfha = false;
      (j.features || []).forEach(function (f) {
        var a = f.attributes || {}, z = String(a.FLD_ZONE || "").trim(), sub = String(a.ZONE_SUBTY || "").trim().toLowerCase();
        var label = z + (sub ? " (" + sub + ")" : "");
        if (z && zones.indexOf(label) < 0) zones.push(label.slice(0, 70));
        if (String(a.SFHA_TF || "").toUpperCase() === "T") sfha = true;
      });
      s.flood = { ok: true, zones: zones.slice(0, 4), sfha: sfha };
      log(s, true, NAME, zones.length ? zones.join(", ") : "no flood zone polygon here");
    }).catch(function (e) { s.flood = { ok: false, note: "data unavailable: the FEMA map service did not answer" }; log(s, false, NAME, e.message); });
  }

  function listingFacts(s) {
    var url = safeUrl(CFG.listingFactsUrl);
    if (!url) {
      s.listingFacts = { status: "off", results: [] };
      return Promise.resolve();
    }
    var NAME = "Listing facts service";
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 12000);
    var payload = {
      address: s.matched || s.input || "",
      parcel: s.parcel ? String(s.parcel) : "",
      lat: s.lat,
      lon: s.lon
    };
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      signal: ctl.signal,
      body: JSON.stringify(payload)
    })
      .finally(function () { clearTimeout(t); })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j || !Array.isArray(j.results)) throw new Error("invalid listing contract");
        var maxYear = new Date().getFullYear() + 1;
        var clean = [];
        j.results.forEach(function (item) {
          if (!item || typeof item !== "object") return;
          var prov = String(item.provider == null ? "" : item.provider).trim().slice(0, 40);
          if (!prov) return;
          var sqft = typeof item.livingSqft === "number" && isFinite(item.livingSqft) && item.livingSqft > 0 ? Math.round(item.livingSqft) : null;
          var beds = typeof item.beds === "number" && isFinite(item.beds) && item.beds >= 0 ? Math.round(item.beds * 10) / 10 : null;
          var baths = typeof item.baths === "number" && isFinite(item.baths) && item.baths >= 0 ? Math.round(item.baths * 100) / 100 : null;
          var yb = typeof item.yearBuilt === "number" && isFinite(item.yearBuilt) && item.yearBuilt > 1800 && item.yearBuilt <= maxYear ? Math.round(item.yearBuilt) : null;
          var imgs = Array.isArray(item.floorPlanImages) ? item.floorPlanImages.map(safeUrl).filter(Boolean).slice(0, 4) : [];
          var fetchedAt = typeof item.fetchedAt === "string" ? item.fetchedAt.trim().slice(0, 40) : "";
          if (sqft != null || beds != null || baths != null || yb != null || imgs.length) {
            clean.push({
              provider: prov,
              livingSqft: sqft,
              beds: beds,
              baths: baths,
              yearBuilt: yb,
              floorPlanImages: imgs,
              fetchedAt: fetchedAt
            });
          }
        });
        s.listingFacts = { status: "ok", results: clean };
        log(s, true, NAME, clean.length + " provider record" + (clean.length === 1 ? "" : "s"));
      })
      .catch(function (e) {
        s.listingFacts = { status: "failed", results: [] };
        log(s, false, NAME, e && e.name === "AbortError" ? "timeout" : (e && e.message) || "request failed");
      });
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
    var credit = snoImg ? "Imagery: Snohomish County Assessor, 2024 orthophoto (gis.snoco.org)" : kingImg ? (CFG.kcAerialUrl && EP.kcAerial === CFG.kcAerialUrl ? String(CFG.kcAerialCredit || "Imagery: King County GIS aerial (gismaps.kingcounty.gov)") : "Imagery: King County GIS, 2025 aerial (gismaps.kingcounty.gov)") : "Imagery: Esri World Imagery";
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

  /* ---------- lot lines and envelope ---------- */
  /* Which lot line is the front, a street side, a side, the rear or on an alley, and the setback envelope,
     are worked out in build-here-siteplan.js and build-here-geom.js, where they are tested. These keep the
     names this page and its callers use. */
  function minRect(pts) { return G.minRect(pts); }
  function classifyEdges(ring, st, dir, nb, hint) { return SP.classifyEdges(ring, st, dir, nb, hint); }
  function envelopeRows(ring, edges, dist) { var m = G.envelopeMask(ring, edges, dist); return { rows: m.rows, area: m.area }; }
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
    // A figure typed in a box is an edit. Each edit carries the order it was typed in, so a number added later
    // under "Add a source-backed number" wins over an earlier edit, and an edit made after that wins back.
    var seq = s.editSeq || {}, edit = {};
    if (v.existing != null && (s.existing == null || Number(v.existing) !== Number(s.existing))) edit.living = { sf: v.existing, seq: seq.living || 0 };
    if (kindSel === "firstFloor") {
      if (v.footprint != null) edit.firstFloor = { sf: v.footprint, seq: seq.footprint || 0 };
    } else if (kindSel === "footprint") {
      if (v.footprint != null) edit.survey = { sf: v.footprint, seq: seq.footprint || 0 };
    } else if (v.footprint != null && (s.footprint == null || Number(v.footprint) !== Number(s.footprint))) {
      edit.roof = { sf: v.footprint, seq: seq.footprint || 0 };
    }
    // A zone-specific ADU standard and the statewide floor are different things. Only the first lets the
    // ADU card read Ready. Both come from the rule set's own ADU record. They used to be picked out of the
    // rule table by matching the word "ADU" in a row label, which missed rows that named a cottage or a DADU.
    var adu = rs && rs.adu ? rs.adu : null;
    var aduRule = adu && adu.status === "coded" ? adu.text : "", aduStateNote = adu && adu.status === "state" ? adu.text : "";
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
    var caps = {
      hasFloorCap: !coded ? null : (rs.floorCap != null ? true : (rs.farNone ? false : null)),
      floorCap: coded && rs.floorCap != null ? rs.floorCap : null,
      coverageCap: coded && rs.coverage != null ? rs.coverage : null,
      imperviousCap: coded && rs.impervious != null ? rs.impervious : null,
      envArea: seed.env && seed.env.area != null ? seed.env.area : null
    };
    var asOf = s.existingAsOf || prepared, card = s.assessorUrl || "";
    // A floor area of 0 from a record is "none on record", which the page says in words. Only a positive
    // figure is handed to the math, so a blank is never read as a zero.
    var pos = function (x) { return typeof x === "number" && isFinite(x) && x > 0; };
    var solved = M.resolveStudy({
      lot: v.lot,
      date: prepared,
      zoningCoded: coded,
      hasFloorCap: caps.hasFloorCap,
      floorCap: caps.floorCap,
      coverageCap: caps.coverageCap,
      imperviousCap: caps.imperviousCap,
      imperv: v.imperv,
      envArea: caps.envArea,
      aduRule: coded ? aduRule : "",
      aduStateNote: aduStateNote,
      siteCaution: siteCaution,
      matchCaution: matchCaution,
      zoneCaution: zoneCaution,
      accounting: rs && rs.accounting ? rs.accounting : null,
      garageNone: !!s.garageNone,
      basementNone: !!s.basementNone,
      edit: edit,
      manual: s.manual || [],
      auto: {
        living: s.existing != null ? { sf: s.existing, source: s.existingSrc || "Assessor record", url: card, retrieved: asOf, method: "assessor extract", confidence: "Medium", note: s.existingNote || "" } : null,
        roof: s.footprint != null ? { sf: s.footprint, source: s.footprintSrc || "Mapped building outline", retrieved: prepared, method: "roof outline", confidence: /OpenStreetMap|Microsoft/i.test(s.footprintSrc || "") ? "Low" : "Medium", note: "Mapped outline. Not a survey, not living area, and not gross floor area." } : null,
        firstFloor: s.firstFloor != null ? { sf: s.firstFloor, source: s.firstFloorSrc || "Assessor first floor", url: card, retrieved: asOf, method: "assessor extract", note: "First-floor area. Not a roof outline." } : null,
        attachedGarage: pos(s.garageFloor) ? { sf: s.garageFloor, source: s.garageFloorSrc || "Assessor garage area", url: card, retrieved: asOf, method: "assessor extract", note: "Floor area on the building record. Not a detached footprint, and not added to coverage." } : null,
        basementGarage: pos(s.basementGarage) ? { sf: s.basementGarage, source: s.basementGarageSrc || "Assessor basement garage area", url: card, retrieved: asOf, method: "assessor extract", note: "Garage floor area inside the basement. Part of the basement total, and not added to coverage." } : null,
        basementTotal: pos(s.basementTotal) ? { sf: s.basementTotal, source: s.basementSrc || "Assessor basement area", url: card, retrieved: asOf, method: "assessor extract", note: "Total basement floor area, finished and unfinished." } : null,
        basementFinished: pos(s.basementTotal) && s.basementFinished != null ? { sf: s.basementFinished, measuredZero: s.basementFinished === 0, source: "King County Assessor finished basement square feet (SqFtFinBasement)", url: card, retrieved: asOf, method: "assessor extract", note: "Finished basement area. It is part of the finished living area figure." } : null,
        deck: pos(s.deck) ? { sf: s.deck, source: "King County Assessor deck square feet (SqFtDeck)", url: card, retrieved: asOf, method: "assessor extract", note: "Deck area on the building record. Not added to coverage; a deck counts as hard surface where the code says so." } : null,
        countyFinSize: s.countyFin && pos(s.countyFin.sf) ? { sf: s.countyFin.sf, source: s.countyFin.source, retrieved: prepared, method: "assessor extract", confidence: "Low", note: s.countyFin.note || "" } : null,
        detachedGarageFloor: s.detGarageFloor != null ? { sf: s.detGarageFloor, source: s.detGarageFloorSrc || "Assessor detached garage area", url: card, retrieved: asOf, method: "assessor extract", note: "Detached garage floor area on the improvement record. Not a mapped footprint, and not added to coverage." } : null,
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
        var o2 = row.orig;
        if (row.key === "land") {
          row.sf = solved.bundle.open.sf;
          row.label = solved.bundle.open.label;
          row.verifiedLandscape = solved.bundle.open.verifiedLandscape;
          row.src = solved.bundle.open.note;
          row.conf = solved.bundle.open.sf == null ? "Unavailable" : (solved.bundle.open.verifiedLandscape ? "Medium" : "Low");
          row.pct = share(row.sf);
        } else if (row.key === "lot") {
          if (lotTyped) { row.sf = v.lot; row.pct = 100; row.conf = "Your entry"; row.src = "Typed on this page." + (o2.sf != null ? " The public record figure was " + fmt(o2.sf) + " sf." : ""); }
          else { row.sf = o2.sf; row.pct = o2.pct; row.conf = o2.conf; row.src = o2.src; }
        } else row.pct = lotTyped ? share(row.sf) : o2.pct;
      });
    }
    // One concept per project type, sized from the same figures as the cards: what the site plan sheets draw.
    var options = M.options ? M.options({
      effective: solved.effective, zoningCoded: coded, hasFloorCap: caps.hasFloorCap, floorCap: caps.floorCap, coverageCap: caps.coverageCap,
      imperviousCap: caps.imperviousCap, envArea: caps.envArea, stories: v.stories, firstFloor: s.firstFloor, heightFt: rs && rs.height ? rs.height.ft : null, adu: adu
    }) : [];
    return { bundle: solved.bundle, cards: solved.cards, prepared: prepared, effective: solved.effective, seed: seed, options: options };
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
      return '<tr><th scope="row">' + esc(m.label) + '</th><td data-label="Amount">' + measureValue(m) + "</td></tr>";
    }).join("");
    var open = bundle.open || {};
    var openRow = '<tr><th scope="row">' + esc(open.label || "Open area") + '</th><td data-label="Amount">' + (open.sf == null ? '<span class="bh-tbd">Not available</span>' : fmt(Math.round(open.sf)) + " sf (approx.)") + "</td></tr>";
    return '<h3>Measurements</h3><table class="bh-table bh-measures"><thead><tr><th scope="col">Measure</th><th scope="col">Amount</th></tr></thead><tbody>' + rows + openRow + "</tbody></table>";
  }
  /* The call to action at the end of the study. Buttons are hidden on paper, so the same links are
     also written out as text for the printed copy. */
  function ctaHtml(heading, text, buttons) {
    var live = (buttons || []).filter(function (b) { return b && b.label && ctaUrl(b.url); });
    // On paper a phone link reads as the number and an email link as the address.
    var shown = function (u) {
      if (/^(tel|mailto):/i.test(u)) return u.replace(/^(tel|mailto):/i, "").replace(/\?.*$/, "");
      try { return new URL(u, CFG.siteBase || location.href).href; } catch (e) { return u; }
    };
    return '<div class="bh-cta"><h3>' + esc(heading) + "</h3>" + (text ? "<p>" + esc(text) + "</p>" : "") +
      (live.length ? "<p>" + live.map(function (b) { return '<a class="bh-btn' + (b.ghost ? " bh-btn-ghost" : "") + '" href="' + esc(ctaUrl(b.url)) + '" data-bh-cta="' + esc(b.cta || "link") + '" data-bh-place="report">' + esc(b.label) + "</a>"; }).join(" ") + "</p>" +
        '<p class="bh-print-only">' + live.filter(function (b) { return ctaUrl(b.url).charAt(0) !== "#"; }).map(function (b) {
          // On paper: the label, then the number, address or page it leads to, unless the label already says it.
          var val = shown(ctaUrl(b.url)), digits = val.replace(/\D/g, "").slice(-10);
          var said = b.label.indexOf(val) >= 0 || (/^tel:/i.test(ctaUrl(b.url)) && digits.length >= 7 && b.label.replace(/\D/g, "").indexOf(digits) >= 0);
          return esc(b.label) + (said ? "" : ": " + esc(val));
        }).join(" · ") + "</p>" : "") + "</div>";
  }
  /* The firm's own buttons: call, email, and book a visit. Made from the phone, email and booking page in
     the configuration, so a site that sets only those still has a way to be reached from every study. */
  function contactButtons() {
    var b = [], tel = SUM ? SUM.telHref(CFG.phone) : "", mail = SUM ? SUM.mailHref(CFG.email) : "";
    if (tel) b.push({ label: "Call " + CFG.phone, url: tel, cta: "call" });
    if (mail) b.push({ label: "Email " + CFG.email, url: mail, cta: "email", ghost: true });
    if (CFG.bookUrl && linkUrl(CFG.bookUrl)) b.push({ label: "Book a site visit", url: CFG.bookUrl, cta: "book", ghost: true });
    else if ($("bh-lead")) b.push({ label: "Ask about this lot", url: "#bh-lead-card", cta: "book", ghost: true });
    return b;
  }
  function firmCta(heading, text) {
    if (CFG.cta && CFG.cta.heading) return ctaHtml(CFG.cta.heading, CFG.cta.text || "", CFG.cta.buttons);
    var b = contactButtons();
    return b.length && (CFG.phone || CFG.email) ? ctaHtml(heading, text, b) : "";
  }
  var STUDY_LIMITS = "Planning estimate from public records; not a survey or permit determination. Where zoning is not coded, the study does not say a project is allowed. Unknown driveway, garage, and hardscape are left blank rather than filled with zero. A roof outline is not living area or gross floor area. Open area left after a roof outline is not landscaping when paving is unknown. Listing data is printed only when a connected listing data service returns it.";

  /* The largest ring of the parcel outline. A parcel record can carry several rings (separate parts, or a
     hole). The diagram and the envelope are drawn from one ring, and it used to be whichever came first. */
  function mainRingIndex(rings) {
    var bi = 0, ba = -1;
    rings.forEach(function (r, i) { var a = Math.abs(ringArea(r)); if (a > ba) { ba = a; bi = i; } });
    return bi;
  }
  /* A second street side uses the zone's street-side setback when one is coded, else the front setback.
     A line on an alley uses the alley figure when one is coded. */
  function setbackFor(e, sb) { return SP.setbackFor(e, sb); }
  /* One reading of the lot lines and one envelope per redraw. The site plan sheets, the option cards and
     the massing seed all take it from here, so they cannot disagree and the raster does not run three times. */
  function lotGeometry(s, sb) {
    if (!s.rings || !s.rings.length || !SP || !G) return null;
    sb = sb || {};
    var geo = s.landscape && s.landscape.geo ? s.landscape.geo : null;
    var key = [sb.front, sb.side, sb.rear, sb.streetSide, sb.rearAlley, sb.sideAlley, s.frontDir || "", s.neighborRings ? s.neighborRings.length : "none", geo && geo.streets ? geo.streets.length : "nogeo"].join("|");
    if (s.geo && s.geo.key === key && s.geo.src === s.rings) return s.geo;
    var L = SP.lotLines({
      rings: s.rings, lon: s.lon, lat: s.lat, frontDir: s.frontDir, neighbors: s.neighborRings, setbacks: sb,
      streets: geo ? geo.streets : null, addrStreet: houseAndStreet(s.matched || s.input || "").street, frame: geo ? geo.frame : null
    });
    if (!L) return null;
    L.key = key; L.src = s.rings;
    s.geo = L;
    return L;
  }
  function seed3D(s, v, rs) {
    var sb = rs && rs.setbacks || {}, seed = { address: s.matched || s.input || "", zone: v.zone || "", juris: s.jurisLabel || "", lot: v.lot || null, footprint: v.footprint || null, stories: v.stories || 1, type: v.type || "", coverage: rs && rs.coverage || null, setbacks: { front: sb.front, side: sb.side, rear: sb.rear, streetSide: sb.streetSide, rearAlley: sb.rearAlley }, height: null, ring: null, env: null, lat: s.lat, lon: s.lon };
    // The height limit as a number comes from the rule set. It used to be read back out of the rule table's text.
    if (rs && rs.height && typeof rs.height.ft === "number") seed.height = rs.height.ft;
    seed.setbackVerify = !!(rs && rs.setbackVerify);
    seed.heightVerify = !!(rs && rs.height && rs.height.verify);
    var g = lotGeometry(s, sb);
    if (g) {
      seed.ring = g.ring.map(function (q) { return [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]; });
      seed.corner = !!g.corner;
      seed.alley = !!(g.ce && g.ce.alley);
      if (g.er) {
        seed.env = { rows: g.er.rows.map(function (r) { return r.map(function (n) { return Math.round(n * 10) / 10; }); }), area: Math.round(g.er.area / 10) * 10 };
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
    var ring = g.ring, ce = g.ce, linesMerged = g.lines && g.lines.length ? g.lines : ce.edges;
    var sv = !!(rs && rs.setbackVerify);
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ring.forEach(function (pt) { minX = Math.min(minX, pt[0]); minY = Math.min(minY, pt[1]); maxX = Math.max(maxX, pt[0]); maxY = Math.max(maxY, pt[1]); });
    var padL = 52, padR = 52, padT = 46, padB = 52, W = 520, H = 400;
    var sw = maxX - minX || 1, sh = maxY - minY || 1;
    var sc = Math.min((W - padL - padR) / sw, (H - padT - padB) / sh);
    var ox = padL + (W - padL - padR - sw * sc) / 2;
    var oy = padT + (H - padT - padB - sh * sc) / 2;
    var X = function (x) { return ox + (x - minX) * sc; };
    var Y = function (y) { return H - oy - (y - minY) * sc; };
    var f1 = function (n) { return n.toFixed(1); };
    var pathOf = function (ringFt) { return (ringFt || []).map(function (pt, i) { return (i ? "L" : "M") + f1(X(pt[0])) + " " + f1(Y(pt[1])); }).join(" ") + " Z"; };
    var poly = pathOf(ring);
    var edgeStyle = { front: { w: 2.6, dash: "12 4" }, street: { w: 2.2, dash: "9 4" }, rear: { w: 1.8, dash: "9 3 2 3" }, side: { w: 1.6, dash: "2.2 2.6" }, alley: { w: 1.8, dash: "6 2 2 2" } };
    var lotEdges = ce.edges.map(function (e) {
      var st = e.alley ? edgeStyle.alley : (edgeStyle[e.kind] || edgeStyle.side);
      return '<line x1="' + f1(X(e.a[0])) + '" y1="' + f1(Y(e.a[1])) + '" x2="' + f1(X(e.b[0])) + '" y2="' + f1(Y(e.b[1])) + '" class="bh-edge bh-edge-' + e.kind + '" stroke="#111" stroke-width="' + st.w + '" stroke-dasharray="' + st.dash + '"/>';
    }).join("");
    var env = "", envArea = null;
    if (g.er && g.er.rings && g.er.rings.length) {
      envArea = g.er.area;
      var hatch = (G && G.hatch) ? G.hatch(g.er.rings, Math.max(4, 7 / sc), 45).slice(0, 400) : [];
      var hatchD = hatch.map(function (q) { return "M" + f1(X(q[0])) + " " + f1(Y(q[1])) + "L" + f1(X(q[2])) + " " + f1(Y(q[3])); }).join("");
      var envD = g.er.rings.map(pathOf).join("");
      env = '<path d="' + envD + '" fill="#f3f3f3" stroke="none"/>' + (hatchD ? '<path d="' + hatchD + '" fill="none" stroke="#b5b5b5" stroke-width="0.6"/>' : "") + '<path d="' + envD + '" class="bh-env" fill="none" stroke="#111" stroke-width="1.15" stroke-dasharray="6 3"/>';
    }
    var geo = s.landscape && s.landscape.geo, bld = "", drive = "";
    if (geo && geo.driveLines) geo.driveLines.forEach(function (d) {
      var line = d.line || [];
      if (line.length < 2) return;
      drive += '<polyline points="' + line.map(function (pt) { return f1(X(pt[0])) + "," + f1(Y(pt[1])); }).join(" ") + '" fill="none" stroke="#777" stroke-width="5" stroke-linecap="butt"/>';
    });
    if (geo && geo.buildings) geo.buildings.forEach(function (b) {
      if (!b.ring || b.role === "neighbor") return;
      var name = b.role === "house" ? "(E) HOUSE" : b.role === "garage" ? "(E) GARAGE" : "(E) BLDG";
      bld += '<path d="' + pathOf(b.ring) + '" fill="#ffffff" stroke="#111" stroke-width="' + (b.role === "house" ? "1.8" : "1.2") + '"/>';
      var c = G && G.centroid ? G.centroid(b.ring) : null;
      if (c) bld += '<text x="' + f1(X(c[0])) + '" y="' + f1(Y(c[1])) + '" text-anchor="middle" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke" font-size="10" font-weight="700">' + name + "</text>";
    });
    var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
    var dims = "";
    (linesMerged || []).forEach(function (ln) {
      var L = ln.len || ln.path || 0;
      if (L * sc < 36) return;
      var ang = Math.atan2(-(ln.b[1] - ln.a[1]), ln.b[0] - ln.a[0]) * 180 / Math.PI;
      while (ang >= 90) ang -= 180; while (ang < -90) ang += 180;
      var mx = clamp(X(ln.mx) + (ln.nx || 0) * 13, 24, W - 24), my = clamp(Y(ln.my) - (ln.ny || 0) * 13, 14, H - 28);
      dims += '<text x="' + f1(mx) + '" y="' + f1(my) + '" text-anchor="middle" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke" font-size="9" font-weight="700" transform="rotate(' + ang.toFixed(1) + " " + f1(mx) + " " + f1(my) + ')">' + (Math.round(L * 10) / 10).toFixed(1) + "'</text>";
    });
    var streetName = (houseAndStreet(s.matched || s.input || "").street || "STREET").toUpperCase();
    var slx = clamp(X(ce.fx) + ce.fnx * 26, 70, W - 70), sly = clamp(Y(ce.fy) - ce.fny * 26, 16, H - 24);
    var streetLbl = '<text x="' + f1(slx) + '" y="' + f1(sly) + '" text-anchor="middle" fill="#444" stroke="#fff" stroke-width="3" paint-order="stroke" font-size="9" font-weight="700" letter-spacing="1.2">' + esc(streetName) + "</text>";
    var unit = 20;
    if (2 * unit * sc > 120) unit = 10; else if (2 * unit * sc < 50) unit = 50;
    var uPx = unit * sc;
    var scaleBar = '<g class="bh-scale" transform="translate(12,' + (H - 20) + ')"><rect x="-4" y="-13" width="' + f1(2 * uPx + 18) + '" height="24" fill="#fff"/><rect x="0" y="0" width="' + f1(uPx) + '" height="4" fill="#111"/><rect x="' + f1(uPx) + '" y="0" width="' + f1(uPx) + '" height="4" fill="#fff" stroke="#111" stroke-width="0.6"/><text x="0" y="-2" font-size="8" fill="#111">0</text><text x="' + f1(2 * uPx) + '" y="-2" text-anchor="end" font-size="8" fill="#111">' + (2 * unit) + " ft</text></g>";
    var north = '<g class="bh-north" transform="translate(' + (W - 24) + ',26)"><circle cx="0" cy="0" r="12" fill="#fff" stroke="#111" stroke-width="1"/><path d="M0 -16 L4.5 5 L0 1 L-4.5 5 Z" fill="#111"/><text y="22" text-anchor="middle" fill="#111" font-size="9" font-weight="700">N</text></g>';
    var envRound = envArea != null ? Math.round(envArea / 10) * 10 : null;
    var envText = envRound != null ? (envRound > 0 ? "Buildable area ≈ " + fmt(envRound) + " sf" + (sv ? " (verify)" : "") : "No area inside setbacks") : "Setbacks: verify";
    return '<svg viewBox="0 0 ' + W + " " + H + '" class="bh-siteplan bh-lot-svg" role="img" aria-label="Site diagram. ' + esc(envText) + '."><rect width="' + W + '" height="' + H + '" fill="#fff"/><path d="' + poly + '" class="bh-lot" fill="#fff" stroke="#bbb" stroke-width="0.6"/>' + env + lotEdges + drive + bld + streetLbl + dims + north + scaleBar + "</svg>";
  }
  function sitePlanKey(s, rs) {
    var sb = rs && rs.setbacks || {}, g = lotGeometry(s, sb);
    if (!g) return "";
    var sv = !!(rs && rs.setbackVerify);
    var label = function (v) { return typeof v === "number" ? v + " ft" + (sv ? " (verify)" : "") : "verify"; };
    var sw = function (dash, width) { return '<svg class="bh-key-svg" width="28" height="10" viewBox="0 0 28 10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="#111" stroke-width="' + width + '" stroke-dasharray="' + dash + '"/></svg>'; };
    var items = ['<li>' + sw("12 3.5", "2.4") + "<span>Front " + label(sb.front) + "</span></li>"];
    if (g.corner) items.push('<li>' + sw("9 3", "2") + "<span>Street side " + label(typeof sb.streetSide === "number" ? sb.streetSide : sb.front) + "</span></li>");
    items.push('<li>' + sw("2.2 2.4", "1.6") + "<span>Side " + label(sb.side) + "</span></li>");
    items.push('<li>' + sw("8 2.5 2 2.5", "1.7") + "<span>Rear " + label(sb.rear) + "</span></li>");
    if (g.ce && g.ce.alley) items.push('<li>' + sw("6 2 2 2", "1.6") + "<span>Alley" + (typeof sb.rearAlley === "number" ? " " + sb.rearAlley + " ft" : "") + "</span></li>");
    var envTxt = g.er ? (g.er.area > 0 ? "Buildable area ≈ " + fmt(Math.round(g.er.area / 10) * 10) + " sf" : "No envelope inside setbacks") : "Envelope not drawn";
    items.push('<li><svg class="bh-key-svg" width="28" height="10" viewBox="0 0 28 10" aria-hidden="true"><rect x="1" y="1" width="26" height="8" fill="#f3f3f3" stroke="#111" stroke-dasharray="4 2"/><path d="M3 8 L10 1 M11 8 L18 1" stroke="#aaa" stroke-width="0.6"/></svg><span>' + envTxt + "</span></li>");
    return '<ul class="bh-plan-key">' + items.join("") + "</ul>";
  }

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
      // Reset first. A record with no matching choice used to leave the previous address's value in the box,
      // and the study then credited it to the assessor. With no record the box reads Unknown where the page
      // offers that choice: it used to read 1, which the study then printed as a fact.
      var stNum = Number(s.stories), stOpts = [].slice.call($("bh-stories").options).map(function (o) { return o.value; });
      $("bh-stories").value = stOpts.indexOf("") >= 0 ? "" : "1";
      s.storiesFilled = ""; s.storiesNote = "";
      if (isFinite(stNum) && stNum > 0) {
        var stBest = null;
        stOpts.forEach(function (o) { var n = parseFloat(o); if (isFinite(n) && (stBest == null || Math.abs(n - stNum) < Math.abs(stBest - stNum))) stBest = n; });
        if (stBest != null) {
          s.storiesFilled = String(stBest);
          $("bh-stories").value = s.storiesFilled;
          if (stBest !== stNum) s.storiesNote = "the record shows " + stNum + ", and the nearest choice is selected";
        }
      }
    }
    s.formWas = null;
    if ($("bh-front")) $("bh-front").value = "";
    if ($("bh-units")) $("bh-units").value = "1";
    if ($("bh-type")) $("bh-type").value = "addition";
    ["bh-man-sf", "bh-man-low", "bh-man-high", "bh-man-source", "bh-man-url", "bh-man-date"].forEach(function (id) { if ($(id)) $(id).value = ""; });
    if ($("bh-man-note")) $("bh-man-note").textContent = "";
    if ($("bh-man-conf")) $("bh-man-conf").value = "Medium";
    if ($("bh-man-method")) $("bh-man-method").value = "assessor";
    $("bh-confirm").hidden = false;
  }

  /* Renumber whatever pages render() actually built. `pages` is an array of section HTML.
     The permit sentence ("See page 5.") is rewritten to the details page's real number.
     SP-1's title block says "Page N of M" as plain text inside the SVG, so the same pass fixes it. */
  function stampStudyPages(pages) {
    var total = pages.length, permitAt = 0;
    pages.forEach(function (html, i) { if (String(html).indexOf("bh-details-page") >= 0) permitAt = i + 1; });
    return pages.map(function (html, i) {
      var n = i + 1;
      var out = String(html)
        .replace(/data-page="\d+"/g, 'data-page="' + n + '"')
        .replace(/data-total="\d+"/g, 'data-total="' + total + '"')
        .replace(/Page \d+ of \d+/g, "Page " + n + " of " + total);
      if (permitAt) out = out.replace(/See page \d+\./g, "See page " + permitAt + ".");
      return out;
    });
  }

  function render() {
    var s = state;
    var stRaw = $("bh-stories") ? parseFloat($("bh-stories").value) : NaN, kindNow = ($("bh-footprint-kind") && $("bh-footprint-kind").value) || "";
    var v = { lot: num("bh-lot", "A lot size of 0 was not used. Enter the lot size in square feet."), zone: $("bh-zone").value.trim(), existing: num("bh-existing"), footprint: num("bh-footprint"), imperv: num("bh-imperv", "A 0 here was not used. Impervious surface includes the roof. Leave the box blank when paving is unknown."), front: $("bh-front").value, units: parseInt($("bh-units").value, 10) || 1, stories: isFinite(stRaw) && stRaw > 0 ? stRaw : null, type: $("bh-type").value };
    var rs = ["seattle", "kc", "sno", "edmonds", "kenmore", "city"].indexOf(s.juris) >= 0 ? R.pick({ juris: s.juris, city: s.cityKey, zone: v.zone, lot: v.lot, units: v.units, house: v.existing }) : null;
    if (s.formWas) {
      if (v.existing !== s.formWas.existing) s.editSeq.living = ++s.seq;
      if (v.footprint !== s.formWas.footprint || kindNow !== s.formWas.kind) s.editSeq.footprint = ++s.seq;
    }
    s.formWas = { existing: v.existing, footprint: v.footprint, kind: kindNow };
    s.frontDir = v.front || "";
    var lotEdited = v.lot != null && (s.lot == null || Number(v.lot) !== Number(s.lot));
    var zoneEdited = !!v.zone && v.zone !== (s.zone || "");
    var place = s.city ? s.city.toUpperCase() : (s.county ? (/(County|Parish|Borough|Census Area|Municipality)$/i.test(s.county) ? s.county : s.county + " County").toUpperCase() : "PLACE NOT MATCHED");
    var sampleBadge = s.isSample ? " · SAMPLE LAYOUT — NOT A PROPERTY RECORD" : "";
    var TOTAL_PAGES = 6;
    var contactBrand = [CFG.brand || "Pacific Pro Group", CFG.phone || "(206) 446-5656", CFG.site || "pacificprogroup.com", CFG.license ? "WA Reg. # " + CFG.license : ""].filter(Boolean).join(" · ");
    var footLogo = '<img class="bh-foot-logo" src="/assets/feasibility/pacific-pro-group-logo.png" alt="Pacific Pro Group">';
    var foot = function (title, pageNum) {
      var pLabel = "Page " + pageNum + " of " + TOTAL_PAGES;
      return '<footer class="bh-page-foot"><span class="bh-foot-left"><span class="bh-foot-place">' + esc(place) + " | " + esc(s.stateAbbr || "US") + '</span><strong>' + esc(title) + "</strong><span class=\"bh-foot-pg\"> · " + esc(pLabel) + (s.isSample ? " · SAMPLE" : "") + '</span></span><span class="bh-brand">' + footLogo + "<span>" + esc(contactBrand) + "</span></span></footer>";
    };
    var page = function (title, body, cls, pageNum) {
      return '<section class="bh-page bh-study-page ' + (cls || "") + '" data-page="' + pageNum + '" data-total="' + TOTAL_PAGES + '"><div class="bh-page-body">' + body + "</div>" + foot(title, pageNum) + "</section>";
    };

    var ctx = studyContext(s, v, rs);
    var prepared = (ctx && ctx.prepared) || todayStamp();
    var sbNow = rs && rs.setbacks || {}, landGeo = s.landscape && s.landscape.geo ? s.landscape.geo : null;
    var M = SP && SUM && CFG.sheets !== false ? SP.model({
      rings: s.rings, lon: s.lon, lat: s.lat, frontDir: s.frontDir, neighbors: s.neighborRings, setbacks: sbNow, setbackVerify: !!(rs && rs.setbackVerify),
      addrStreet: houseAndStreet(s.matched || s.input || "").street, geo: landGeo, slope: s.landscape && s.landscape.slope, hazardShapes: s.hazardShapes, imagery: s.imagery, lines: lotGeometry(s, sbNow)
    }) : null;
    var F = SUM ? SUM.facts(s, v, rs, ctx, { brand: brandInfo() }, M) : null, FB = F ? SUM.blocks(F) : null;
    var options = (ctx && ctx.options) || [], optBy = {}, placedBy = {};
    options.forEach(function (o) { optBy[o.id] = o; });
    if (M && M.ok) options.forEach(function (o) { placedBy[o.id] = SP.place(M, o); });
    var fb = function (key) { var hit = null; if (FB) ["building", "remodel", "landscaping", "roofing"].forEach(function (b) { FB[b].forEach(function (x) { if (x.key === key) hit = x; }); }); return hit; };
    var fbHtml = function (key) { var r = fb(key); return r ? "<p" + (r.s === "missing" || r.s === "verify" ? ' class="bh-verify"' : "") + ">" + esc(String(r.v || "").replace(/\bPPG\b/g, "Pacific Pro Group")) + "</p>" : ""; };
    var placeName = F ? F.place : "the jurisdiction";
    var asOfDate = (F && F.preparedText) || prepared;

    var seed3d = (ctx && ctx.seed) || seed3D(s, v, rs);
    try { if (CFG.massingUrl) sessionStorage.setItem(SEED_KEY, JSON.stringify(seed3d)); localStorage.removeItem("bh3dSeed"); } catch (e) {}

    var out = [];

    /* Cover is physical page 1. stampStudyPages renumbers every sheet after this, including SP-1. */
    var coverQr = String(CFG.coverQrUrl || "").trim();
    var coverBody = '<div class="bh-cover-wrap"><div class="bh-cover-top"><img class="bh-cover-logo" src="/assets/feasibility/pacific-pro-group-logo.png" alt="Pacific Pro Group">' +
      '<p class="bh-cover-kicker">SINGLE-FAMILY RESIDENCE <span aria-hidden="true">|</span> <strong>FEASIBILITY STUDY</strong></p><div class="bh-cover-bar" aria-hidden="true"></div></div>' +
      '<div class="bh-cover-art"><img src="/assets/feasibility/feasibility-cover.jpg" alt="Pen-and-ink drawing of a house on its lot"></div>' +
      '<div class="bh-cover-meta"><div><p class="bh-cover-label">Subject property</p><p class="bh-cover-address">' + esc(s.matched || s.input || "Address not matched") + "</p>" +
      '<p class="bh-cover-date">Prepared ' + esc(asOfDate) + (s.isSample ? " · Sample layout — not a property record" : "") + "</p></div>" +
      '<div class="bh-cover-firm-col"><p class="bh-cover-firm">Pacific Pro Group LLC, Design-Build General Contractor, WA Reg. # PACIFPG765OF</p>' +
      "<p>Edmonds: 144 Railroad Ave #307, Edmonds, WA 98020, (206) 446-5656</p>" +
      "<p>Seattle: 110 Lakeside Ave Ste 110F, Seattle, WA 98122, (425) 570-9340</p>" +
      "<p>pacificprogroup.com</p></div>" +
      (coverQr ? '<img class="bh-cover-qr" src="' + esc(coverQr) + '" alt="">' : "") +
      "</div></div>";
    out.push(page("Cover", coverBody, "bh-cover", 1));

    /* ---------- EXISTING LOT (diagram + area + slope on one sheet) ---------- */
    var rLand = s.landscape || { rows: [], notes: [], slope: { ok: false, note: "not measured" }, flags: [] };
    var p1Left = "<h3>Site diagram</h3>" + '<div class="bh-lot-diagram">' + sitePlanSVG(s, rs) + sitePlanKey(s, rs) + "</div>" +
      '<p class="bh-muted">Line diagram from the county parcel and mapped footprints. Sheet SP-1 is the scaled site plan. Not a survey.</p>';
    var p1Right = "";
    if (s.isSample) p1Right += '<p class="bh-verify bh-alert-box"><strong>Sample layout only — these numbers are not a property record.</strong></p>';
    if (s.parcelWarn || rLand.warn) p1Right += '<p class="bh-verify bh-alert-box" role="alert"><strong>' + esc(s.parcelWarn || rLand.warn) + "</strong></p>";
    p1Right += "<h3>House, garage, driveway and open area</h3>";
    if (rLand.rows && rLand.rows.length) {
      p1Right += '<table class="bh-table bh-land"><thead><tr><th scope="col">Area</th><th scope="col">Square feet</th><th scope="col">Share</th></tr></thead><tbody>' + rLand.rows.map(function (x) {
        var sfTxt = x.sf == null ? '<span class="bh-tbd">Not available</span>' : (x.key === "lot" && s.lotKind === "record" ? fmt(x.sf) + " sf" : "approx. " + fmt(x.sf) + " sf");
        var pctTxt = x.pct == null ? "Not measured" : x.pct + "%";
        return '<tr><th scope="row">' + esc(x.label) + '</th><td data-label="Square feet">' + sfTxt + '</td><td data-label="Share">' + esc(pctTxt) + "</td></tr>";
      }).join("") + "</tbody></table>";
    } else p1Right += '<p class="bh-muted">Site coverage was not measured.</p>';
    var landRow = (rLand.rows || []).filter(function (x) { return x.key === "land" && x.verifiedLandscape === false && x.sf != null; })[0];
    if (landRow) p1Right += '<p class="bh-verify">Open area is not verified landscaping. Paving, patios, or eaves may be inside it.</p>';
    (rLand.notes || []).forEach(function (t) { p1Right += '<p class="bh-verify">' + esc(t) + "</p>"; });
    p1Right += '<p class="bh-muted">Measured by sampling the parcel outline every ' + ((rLand.coverage && rLand.coverage.step) || 1) + " ft. Planning estimate only.</p>";
    var sl = rLand.slope;
    p1Right += "<h3>Slope (approx.)</h3>";
    if (sl && sl.ok) {
      p1Right += '<table class="bh-table">' +
        '<tr><th scope="row">Average slope</th><td>approx. ' + sl.mean + "% (median " + sl.median + "%)</td></tr>" +
        '<tr><th scope="row">Steepest part</th><td>approx. ' + sl.p95 + "% (95th); peak cell " + sl.max + "%</td></tr>" +
        '<tr><th scope="row">Lot at 15% / 25% / 40%+</th><td>' + sl.pct15 + "% / " + sl.pct25 + "% / " + sl.pct40 + "%</td></tr>" +
        '<tr><th scope="row">Elevation range</th><td>approx. ' + fmt(sl.elevMin) + " to " + fmt(sl.elevMax) + " ft</td></tr>" +
        '<tr><th scope="row">Surface fall</th><td>' + (sl.fallCompass && sl.fallCompass !== "flat" ? "Toward the " + esc(sl.fallCompass) + ", approx. " + sl.fallPct + "%." : "Nearly flat.") + " Not a survey.</td></tr></table>";
    } else p1Right += '<p class="bh-verify">Slope: data unavailable (' + esc(sl && sl.note || "the elevation service did not answer") + ").</p>";
    out.push(page("Existing lot", '<div class="bh-cols bh-existing-lot-cols"><div>' + p1Left + "</div><div>" + p1Right + "</div></div>", "bh-existing-lot-page", out.length + 1));

    /* ---------- PAGE 2: F-1 PROPERTY FACTS ---------- */
    if (F && SUM) {
      var factsHtml = SUM.factsSheet(F, FB, { pageLabel: "Page " + (out.length + 1) + " of " + TOTAL_PAGES, pageNum: out.length + 1, totalPages: TOTAL_PAGES });
      factsHtml = factsHtml.replace(/<footer class="bh-facts-foot">[\s\S]*?<\/footer>/i, foot("Property facts", out.length + 1));
      out.push(factsHtml);
    }

    /* ---------- PAGE 3: SP-1 PRELIMINARY SITE PLAN ---------- */
    if (M && F && SP) {
      var optMain = optBy[v.type] || null;
      out.push(SP.sheet(M, {
        F: F,
        opt: optMain,
        placed: optMain && M.ok ? placedBy[optMain.id] : undefined,
        sheet: "SP-1",
        noSources: true,
        noInset: true,
        compact: true,
        pageLabel: "Page 3 of " + TOTAL_PAGES,
        pageNum: 3,
        totalPages: TOTAL_PAGES
      }).html.replace("</section>", foot("Preliminary site plan", 3) + "</section>"));
    }

    /* ---------- PAGE 4: WHAT YOU CAN BUILD (2-column compact layout) ---------- */
    var rowsP4 = [
      ["Parcel number", s.parcel ? esc(s.parcel) + (s.parcelMatch === "nearest" || s.parcelMatch === "point" ? ' <span class="bh-verify">Matched by location, not by address. Verify.</span>' : (s.parcelMatch === "address" ? " · matched by street address" : "")) : "not available"],
      ["Site address", esc(s.matched || s.input || "not available")],
      ["Jurisdiction", esc(s.jurisLabel || "not available")],
      ["Lot area", v.lot ? fmt(v.lot) + " sf" + (lotEdited && s.lot != null ? " (your entry; county record " + fmt(s.lot) + " sf)" : (lotEdited ? " (your entry)" : (s.lotRecordSf && Math.abs(s.lotRecordSf - v.lot) > 300 ? " (approx. outline; parcel record lists " + fmt(s.lotRecordSf) + " sf)" : ""))) : "not available"]
    ];
    if (F && F.plat) {
      rowsP4.push(["Plat and lot", esc(F.plat.name) + (F.plat.lot ? ", lot " + esc(F.plat.lot) : "") + (F.plat.block ? ", block " + esc(F.plat.block) : "")]);
    }

    var secRow = fb("secondStory");
    var optRows = [
      { label: (optBy.addition && (optBy.addition.kind === "secondStory" || optBy.addition.footprintSf === 0)) ? "Addition (upward)" : "Addition", opt: optBy.addition },
      { label: "Second story", secondStory: true, row: secRow },
      { label: "ADU / detached ADU", opt: optBy.adu },
      { label: "Garage or shop", opt: optBy.shop },
      { label: "New house (teardown)", opt: optBy.teardown },
      { label: "Interior remodel", opt: optBy.remodel }
    ].map(function (item) {
      var fitTxt = "Verify", sizeTxt = "not available";
      if (item.secondStory) {
        // Integrator fix (Grok Bot): no sizing heuristic here. The second-story row prints the study's own
        // height / stories / floor-area-room line from BuildHereSummary.blocks and is always "Verify".
        fitTxt = "Verify";
        sizeTxt = item.row ? item.row.v : "Confirm height limit and framing on site";
      } else if (item.opt) {
        var o = item.opt;
        if (o.feasible === true) {
          fitTxt = o.placement === "unchecked" ? "Size fits (verify setbacks)" : "Fits";
          sizeTxt = (o.gfaSf > 0 ? "approx. " + fmt(o.gfaSf) + " sf" + (o.levels > 1 ? " (" + o.levels + " levels)" : "") + (o.footprintSf > 0 ? ", " + fmt(o.footprintSf) + " sf footprint" : "") : "Within existing footprint (0 sf added)") + (o.notes && o.notes.length ? ". " + o.notes.join(" ") : "");
        } else if (o.feasible === false) {
          fitTxt = "Does not fit";
          sizeTxt = o.why || "Exceeds lot limits as read.";
        } else {
          fitTxt = "Verify";
          sizeTxt = (o.gfaSf > 0 ? "Concept approx. " + fmt(o.gfaSf) + " sf. " : "") + (o.why || "Verify limits with the jurisdiction.");
        }
      }
      sizeTxt = String(sizeTxt || "").replace(/\bPPG\b/g, "Pacific Pro Group");
      return '<tr><th scope="row">' + esc(item.label) + '</th><td data-label="Fit"><strong>' + esc(fitTxt) + '</strong></td><td data-label="Size and notes">' + esc(sizeTxt) + "</td></tr>";
    }).join("");
    var optionsTableHtml = '<h3>Project options comparison</h3><table class="bh-table bh-options-table"><thead><tr><th scope="col">Project</th><th scope="col">Fit</th><th scope="col">Size that fits &amp; notes</th></tr></thead><tbody>' + optRows + "</tbody></table>";

    var hazWhere = s.hazardScope === "parcel" ? "this parcel" : s.hazardScope === "box" ? "a box around this parcel" : "the address point";
    var hazCity = s.juris === "city" ? "Only county layers were read. The City of " + esc(s.city) + " keeps its own critical-area maps, and those were not checked." : "";
    var haz;
    if (s.hazards.length) haz = "<ul>" + s.hazards.map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") + "</ul>" + (hazCity ? '<p class="bh-muted">' + hazCity + "</p>" : "");
    else if (s.hazardSource && s.hazardNotes.length) haz = "<p>The layers that answered show no mapped hazard on " + hazWhere + ". " + (hazCity ? hazCity + " " : "") + "Some layers did not answer and were not checked, so this is not a full map check.</p>";
    else if (s.hazardSource) haz = "<p>No mapped hazard layer touched " + hazWhere + ". " + (hazCity ? hazCity + " " : "") + "Maps are not field studies; a site visit can still find steep ground, wet soils or streams.</p>";
    else haz = "<p>Hazard maps were not checked for this jurisdiction. Ask the city or county.</p>";
    if (s.hazardNotes.length) haz += '<p class="bh-muted">' + esc(s.hazardNotes.join("; ")) + "</p>";

    var bdl = ctx && ctx.bundle;
    var mRows = bdl ? bdl.measures.map(function (m) {
      return '<tr><th scope="row">' + esc(m.label) + '</th><td data-label="Amount">' + measureValue(m) + "</td></tr>";
    }).join("") : "";
    var openObj = (bdl && bdl.open) || {};
    var openRowHtml = '<tr><th scope="row">' + esc(openObj.label || "Open area") + '</th><td data-label="Amount">' + (openObj.sf == null ? '<span class="bh-tbd">Not available</span>' : "approx. " + fmt(Math.round(openObj.sf)) + " sf") + "</td></tr>";
    var measureNotes = "";
    if (bdl) {
      (bdl.notes || []).forEach(function (t) { measureNotes += '<p class="bh-muted">' + esc(t) + "</p>"; });
      (bdl.conflicts || []).forEach(function (c) { measureNotes += '<p class="bh-verify">' + esc(c.note) + "</p>"; });
      (bdl.stale || []).forEach(function (c) { measureNotes += '<p class="bh-verify">' + esc(c.note) + "</p>"; });
      (bdl.errors || []).forEach(function (t) { measureNotes += '<p class="bh-verify">' + esc(t) + "</p>"; });
    }
    var compactLedger = '<h3>Measurements</h3><table class="bh-table bh-measures"><thead><tr><th scope="col">Measure</th><th scope="col">Amount</th></tr></thead><tbody>' + mRows + openRowHtml + "</tbody></table>" + measureNotes;

    out.push(page("Project summary", '<div class="bh-cols bh-summary-cols"><div><h3>Site data</h3><table class="bh-table">' + rowsP4.map(function (r) { return '<tr><th scope="row">' + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join("") + "</table>" + compactLedger + '</div><div>' + optionsTableHtml + '<h3>Special site features</h3>' + haz + '<h3>Soils and geotechnical</h3>' + fbHtml("soils") + '<h3>Drainage and civil</h3>' + fbHtml("drainage") + "</div></div>", "bh-what-you-can-build-page", out.length + 1));

    /* ---------- PAGE 5: PROJECT DETAILS, LISTING DATA, CODES & PERMIT HISTORY ---------- */
    var rowsP5 = [
      ["Zone", v.zone ? esc(v.zone) + (zoneEdited ? " (your entry" + (s.zone ? "; county/city map " + esc(s.zone) : "") + ")" : "") + (!zoneEdited && s.assessorZone ? " (" + esc(s.assessorZone) + " on county assessor)" : "") : "not available"],
      ["Existing finished area", v.existing ? fmt(v.existing) + " sf" + ((s.existing != null && Number(v.existing) !== Number(s.existing)) ? " (your entry; " + fmt(s.existing) + " sf (county))" : (s.existingSrc ? " (county)" : " (your entry)")) : "not available"],
      ["Building footprint", (function () {
        if (v.footprint == null) return "not available";
        var kindShown = ($("bh-footprint-kind") && $("bh-footprint-kind").value) || s.footprintKind || "roof";
        var edited = s.footprint != null && Number(v.footprint) !== Number(s.footprint);
        var kindPhrase = kindShown === "firstFloor" ? "first-floor area, not roof coverage" : (kindShown === "footprint" ? "surveyed footprint" : "approx. roof outline, not living area");
        return fmt(v.footprint) + " sf (" + kindPhrase + (edited ? ", your entry; mapped figure " + fmt(s.footprint) + " sf" : "") + ")";
      })()],
      ["Year built", (function () {
        if (!s.yearBuilt) return "not available";
        var others = (s.years || []).filter(function (r) { return String(r.y) !== String(s.yearBuilt); });
        return esc(s.yearBuilt) + (others.length ? ' <span class="bh-verify">(another record shows ' + others.map(function (r) { return esc(r.y); }).join(", ") + "; the older year governs lead and asbestos rules)</span>" : "");
      })()],
      ["Stories (existing)", v.stories == null ? '<span class="bh-tbd">not available</span>' : esc(String(v.stories)) + (s.storiesSrc && String(v.stories) !== s.storiesFilled ? " (your entry; record shows " + esc(s.stories) + ")" : "")],
      ["Project type", esc($("bh-type") && $("bh-type").selectedOptions && $("bh-type").selectedOptions[0] ? $("bh-type").selectedOptions[0].text : v.type)]
    ];
    if (s.beds != null || s.baths != null) rowsP5.push(["Bedrooms and baths", (s.beds != null ? esc(s.beds) + " bedroom" + (Number(s.beds) === 1 ? "" : "s") : "bedrooms not available") + ", " + (s.baths != null ? esc(s.baths) + " bath" + (Number(s.baths) === 1 ? "" : "s") : "baths not available")]);
    if (s.firstFloor) rowsP5.push(["First-floor area", fmt(s.firstFloor) + " sf (county)"]);
    if (s.upperFloor || s.halfFloor) rowsP5.push(["Upper floors", [s.upperFloor ? fmt(s.upperFloor) + " sf above first floor" : "", s.halfFloor ? fmt(s.halfFloor) + " sf half story" : ""].filter(Boolean).join(" · ")]);
    if (s.basementTotal) rowsP5.push(["Basement", fmt(s.basementTotal) + " sf" + (s.basementFinished != null ? " (" + fmt(s.basementFinished) + " sf finished)" : "")]);
    else if (s.basementNone) rowsP5.push(["Basement", "None on record"]);
    if (s.garageFloor) rowsP5.push(["Attached garage", fmt(s.garageFloor) + " sf"]);
    if (s.basementGarage) rowsP5.push(["Basement garage", fmt(s.basementGarage) + " sf"]);
    if (s.detGarageFloor) rowsP5.push(["Detached garage floor area", fmt(s.detGarageFloor) + " sf"]);
    if (!s.garageFloor && !s.basementGarage && !s.detGarageFloor && s.garageNone) rowsP5.push(["Garage", "None on record"]);
    if (s.deck) rowsP5.push(["Deck", fmt(s.deck) + " sf"]);
    if (s.yrRenov) rowsP5.push(["Year renovated", esc(s.yrRenov)]);
    if (s.countyFin) rowsP5.push(["House size (county FinSize)", "approx. " + fmt(s.countyFin.sf) + " sf (county FinSize — basement, lower-level and attic finished area are separate columns and are not added; not used as total living area in FAR math)"]);
    if (s.flood) rowsP5.push(["Flood zone (FEMA)", s.flood.ok ? (s.flood.zones.length ? esc(s.flood.zones.join(", ")) + (s.flood.sfha ? ' <span class="bh-verify">Special flood hazard area touches the lot.</span>' : " · outside the special flood hazard area") : "No flood zone polygon at this location") : '<span class="bh-tbd">data unavailable</span>']);
    else rowsP5.push(["Flood zone (FEMA)", '<span class="bh-tbd">data unavailable</span>']);
    if (s.soils) rowsP5.push(["Soil map unit (NRCS)", s.soils.ok ? esc(s.soils.name) + (s.soils.hsg ? " · hydrologic group " + esc(s.soils.hsg) : "") + (s.soils.drainage ? " · " + esc(String(s.soils.drainage).toLowerCase()) : "") + " (approx. map unit, not a soils report)" : '<span class="bh-tbd">data unavailable</span>']);
    else rowsP5.push(["Soil map unit (NRCS)", '<span class="bh-tbd">data unavailable</span>']);

    var countyRows = (s.countyFacts || []).map(function (r) {
      return '<tr><th scope="row">' + esc(r.field) + '</th><td>' + esc(r.value) + ' <span class="bh-muted">(' + esc(r.source) + ")</span></td></tr>";
    }).join("");
    var countyHtml = '<h3>County record</h3>' + (countyRows
      ? '<table class="bh-table">' + countyRows + "</table>"
      : "<p>" + esc(s.countyRecordNote || "Figures in this study that name a county assessor, a county map, or the house-size index are county records. A blank is not available online. Nothing on this page is estimated to fill a gap.") + "</p>");
    var lf = s.listingFacts;
    var listingHtml = countyHtml;
    if (lf && lf.status && lf.status !== "off" && lf.status === "ok" && lf.results && lf.results.length) {
      listingHtml += "<h3>Existing plans and listing size</h3>";
      var countyTag = s.existing != null ? " (vs " + fmt(s.existing) + " sf (county))" : (s.countyFin && s.countyFin.sf != null ? " (vs approx. " + fmt(s.countyFin.sf) + " sf (county FinSize))" : "");
      listingHtml += '<table class="bh-table"><thead><tr><th scope="col">Provider</th><th scope="col">Living area</th><th scope="col">Beds / baths</th><th scope="col">Year built</th><th scope="col">Floor plans</th></tr></thead><tbody>' +
        lf.results.map(function (r) {
          var sq = r.livingSqft != null ? fmt(r.livingSqft) + " sf (" + esc(r.provider) + ")" + esc(countyTag) : "not available";
          var bb = (r.beds != null || r.baths != null) ? (r.beds != null ? esc(r.beds) + " bed" : "—") + " / " + (r.baths != null ? esc(r.baths) + " bath" : "—") : "not available";
          var yb = r.yearBuilt != null ? esc(r.yearBuilt) : "not available";
          var fp = r.floorPlanImages && r.floorPlanImages.length
            ? r.floorPlanImages.map(function (u, idx) { return '<img class="bh-floorplan-img" src="' + esc(u) + '" alt="Floor plan ' + (idx + 1) + " from " + esc(r.provider) + '">'; }).join(" ")
            : "None in listing record";
          return '<tr><th scope="row">' + esc(r.provider) + "</th><td>" + sq + "</td><td>" + bb + "</td><td>" + yb + "</td><td>" + fp + "</td></tr>";
        }).join("") + "</tbody></table>";
    }

    var officeName = s.juris === "seattle" ? "Seattle Department of Construction and Inspections (SDCI) permit counter"
      : s.juris === "edmonds" ? "City of Edmonds Development Services permit counter"
      : s.juris === "kenmore" ? "City of Kenmore Development Services permit counter"
      : s.juris === "kc" ? "King County Department of Local Services, Permitting Division"
      : s.juris === "sno" ? "Snohomish County Planning and Development Services (PDS) permit counter"
      : s.city ? "City of " + s.city + " permit counter"
      : (s.county ? s.county + " permit office" : "local permit office");
    var layerLabel = s.juris === "seattle" ? "Seattle issued and finaled residential permits layer" : "Snohomish County active permits layer";
    var pmHtml = "<h3>Permit history and plan sets</h3>";
    if (s.permits && s.permits.length) {
      pmHtml += '<table class="bh-table bh-permits"><thead><tr><th scope="col">Permit</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Issued</th><th scope="col">Finaled</th></tr></thead><tbody>' +
        s.permits.slice(0, 12).map(function (p) {
          return '<tr><td data-label="Permit">' + esc(p.id) + '</td><td data-label="Type">' + esc(p.type) + '</td><td data-label="Status">' + esc(p.desc) + '</td><td data-label="Issued">' + esc(p.issued || "—") + '</td><td data-label="Finaled">' + esc(p.final || "—") + "</td></tr>";
        }).join("") + "</tbody></table>";
      pmHtml += '<p class="bh-muted">Older permits and archived plan sets may be on microfilm — ask the ' + esc(officeName) + " for the complete address file.</p>";
    } else if (s.permitSearch === "ok") {
      pmHtml += "<p>No permits found in " + esc(layerLabel) + " on " + esc(asOfDate) + ". Older records and approved plan sets are often stored on microfilm — ask the " + esc(officeName) + " for the address history and any plan sets.</p>";
    } else if (s.permitSearch === "failed") {
      pmHtml += "<p>No permits could be read from " + esc(layerLabel) + " on " + esc(asOfDate) + " (data unavailable — the service did not answer). Ask the " + esc(officeName) + " for the address history and any plan sets.</p>";
    } else {
      var cityLabel = s.city ? "the City of " + s.city : (s.county || placeName);
      pmHtml += "<p>" + esc(s.permitNote || ("Permit records for " + cityLabel + " are not searchable online by this study — ask the " + officeName + " for the address history and any plan sets.")) + (s.city && /^King/.test(s.county || "") ? " For work permitted before city incorporation, also check King County Department of Local Services, Permitting Division archives." : "") + "</p>";
    }
    if (s.permitNote && s.permits && s.permits.length) pmHtml += '<p class="bh-muted">' + esc(s.permitNote) + "</p>";

    var p5 = '<div class="bh-cols"><div><h3>Building and environmental profile</h3><table class="bh-table">' +
      rowsP5.map(function (r) { return '<tr><th scope="row">' + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join("") +
      "</table></div><div>" + listingHtml + '<h3>Construction cost</h3><p>Not estimated here. Get a written bid from a licensed contractor for your own numbers.</p>' +
      '<h3>Codes that will apply</h3>' + fbHtml("energy") + '<p>' + (s.stateAbbr === "WA"
        ? "Local zoning, the Washington State Residential Code and the Washington State Energy Code. Energy credits depend on project size and type; your designer confirms them."
        : "Local zoning and the state residential or building code apply. Confirm setbacks, coverage and FAR with the city or county before design.") + "</p>" +
      pmHtml + "</div></div>";
    out.push(page("What you can build (continued)", p5, "bh-details-page", out.length + 1));
    if (s.permits && s.permits.length > 12) {
      for (var pi = 12; pi < s.permits.length; pi += 12) {
        var more = s.permits.slice(pi, pi + 12).map(function (p) {
          return '<tr><td data-label="Permit">' + esc(p.id) + '</td><td data-label="Type">' + esc(p.type) + '</td><td data-label="Status">' + esc(p.desc) + '</td><td data-label="Issued">' + esc(p.issued || "—") + '</td><td data-label="Finaled">' + esc(p.final || "—") + "</td></tr>";
        }).join("");
        out.push(page("Permit history (continued)", '<h3>Permit history, continued</h3><table class="bh-table bh-permits"><thead><tr><th scope="col">Permit</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Issued</th><th scope="col">Finaled</th></tr></thead><tbody>' + more + "</tbody></table>", "bh-details-page", out.length + 1));
      }
    }

    /* ---------- PAGE 6: SITE COVERAGE, LANDSCAPE AND MASSING ---------- */
    var coverNotes = "";
    (rLand.flags || []).forEach(function (t) { coverNotes += "<p>" + esc(t) + "</p>"; });
    if (rLand.steep) {
      coverNotes += "<p>" + (rLand.steep.mapped ? "<strong>Seattle ECA steep slope (40%+) is mapped on approx. " + fmt(rLand.steep.sf) + " sf of this lot.</strong> Work there needs SDCI steep slope review and usually a geotechnical report." : "No Seattle ECA steep slope area (40%+) is mapped on this lot.") + "</p>";
    } else if (sl && sl.ok && sl.pct40 > 0) {
      coverNotes += "<p>Approx. " + sl.pct40 + "% of the lot reads 40% or steeper from bare-earth elevation samples. Ask the jurisdiction whether a steep slope critical area applies.</p>";
    } else if (sl && sl.ok) {
      coverNotes += "<p>No steep-slope band (40%+) was flagged on this lot. Confirm grades with a site survey.</p>";
    }
    var p6Left = (coverNotes ? "<h3>Site coverage and landscape</h3>" + coverNotes : "") + "<h3>Survey and plat</h3>";
    var sv = rLand.survey;
    var platBits = sv && sv.plat ? (sv.lot ? ", lot " + esc(sv.lot) : "") + (sv.block ? ", block " + esc(sv.block) : "") + (sv.major ? " (plat number " + esc(sv.major) + ")" : "") : "";
    if (sv && sv.plat) {
      p6Left += "<p>Recorded plat on the county record: <strong>" + esc(sv.plat) + "</strong>" + platBits + ". Search the plat and any recorded surveys by that name at the King County Recorder's Office. We did not find a published survey drawing, and we do not draw one.</p>";
    } else if (/^Snohomish/.test(s.county || "")) {
      p6Left += "<p>Search recorded plats and surveys in Snohomish County Auditor recorded documents. We did not find a published survey drawing, and we do not draw one.</p>";
    } else if (/^King/.test(s.county || "") && (!s.stateAbbr || s.stateAbbr === "WA")) {
      p6Left += "<p>No plat name was on the public parcel record. Recorded surveys can be requested from the King County Recorder's Office.</p>";
    } else {
      p6Left += "<p>Recorded plats and surveys are kept by the county recorder for " + esc(s.county || "this county") + ". We did not find a published survey drawing, and we do not draw one.</p>";
    }
    var sb = seed3d.setbacks || {};
    var sbMark = seed3d.setbackVerify ? " (verify)" : "";
    var sbBits = ["front " + (typeof sb.front === "number" ? sb.front + " ft" : "verify") + sbMark, "side " + (typeof sb.side === "number" ? sb.side + " ft" : "verify") + sbMark, "rear " + (typeof sb.rear === "number" ? sb.rear + " ft" : "verify") + sbMark];
    if (seed3d.corner) sbBits.push("street side " + (typeof sb.streetSide === "number" ? sb.streetSide + " ft" : "front figure") + sbMark);
    if (seed3d.alley && typeof sb.rearAlley === "number") sbBits.push("alley " + sb.rearAlley + " ft" + sbMark);
    var sbLine = sbBits.join(", ");
    var massRows = [
      ["Address", esc(seed3d.address || s.matched || s.input || "not available")],
      ["Zone", esc(seed3d.zone || "not available")],
      ["Lot area", seed3d.lot ? fmt(seed3d.lot) + " sf" : "not available"],
      ["Setbacks used", esc(sbLine)],
      ["Height limit", seed3d.height ? seed3d.height + " ft" + (seed3d.heightVerify ? " (verify)" : "") : "Verify with the jurisdiction"],
      ["Coverage cap", seed3d.coverage ? fmt(seed3d.coverage) + " sf" : "Verify with the jurisdiction"],
      ["Buildable envelope", seed3d.env ? (seed3d.env.area > 0 ? "Approx. " + fmt(seed3d.env.area) + " sf inside setbacks (diagrammatic)" : "No area is left inside the setbacks as drawn. Check the street side under Edit the facts.") : (seed3d.ring ? "Lot outline loaded. The setbacks are not all coded, so no envelope area is drawn." : "No parcel outline in this run")]
    ];
    var p6Right = '<h3>Massing and envelope</h3><p>These caps and setbacks match the site plan and property facts in this study. It is a diagram, not a permit drawing.</p><table class="bh-table">' +
      massRows.map(function (r) { return '<tr><th scope="row">' + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join("") + "</table>";

    out.push(page("Site coverage and massing", '<div class="bh-cols"><div>' + p6Left + "</div><div>" + p6Right + "</div></div>", "bh-massing-page", out.length + 1));
    var interiorPlan = null;
    if (window.BuildHereInterior && landGeo && landGeo.buildings) {
      var houseB = null, garageRings = [];
      landGeo.buildings.forEach(function (b) { if (b.role === "house" && !houseB) houseB = b; else if (b.role === "garage" && b.ring) garageRings.push(b.ring); });
      var addPlaced = placedBy.addition && placedBy.addition.ok && placedBy.addition.ring && !placedBy.addition.over && !placedBy.addition.existing ? { ring: placedBy.addition.ring } : null;
      var showUpper = (v.stories && v.stories >= 2) || !!(optBy.addition && optBy.addition.feasible && optBy.addition.footprintSf === 0) || v.type === "secondStory";
      if (houseB && houseB.ring) interiorPlan = BuildHereInterior.plan(houseB.ring, { stories: v.stories, showUpper: showUpper, front: s.geo && s.geo.ce ? { nx: s.geo.ce.fnx, ny: s.geo.ce.fny } : null, garageRings: garageRings, addition: addPlaced });
    }
    if (interiorPlan && interiorPlan.levels && interiorPlan.levels.length) {
      out.push(page("Conceptual interior", "<h3>Conceptual interior</h3>" + BuildHereInterior.svg(interiorPlan), "bh-interior-page", out.length + 1));
    }
    var massSpec = window.BuildHereMassing ? BuildHereMassing.spec(s, s.geo) : null;
    if (massSpec && interiorPlan) massSpec.interior = interiorPlan;
    if (massSpec) massSpec.onRoom = function (room) {
      var box = $("bh-3d-room");
      if (box) box.textContent = room.name + ": " + room.purpose + " Approx. " + Math.round(room.w) + " ft by " + Math.round(room.d) + " ft. Conceptual — verify on site.";
    };
    if (massSpec) {
      out.push(page("House and property", '<h3>House and property</h3><p id="bh-3d-print-note">' + esc(massSpec.caption) + '</p><img id="bh-3d-shot" class="bh-3d-shot" alt="Isometric massing of the parcel and the buildings whose footprints are on record">', "bh-massing-shot", out.length + 1));
    }

    /* Page numbers are written as if all six sheets exist. A missing drawing (no parcel outline, so no
       SP-1) or a missing facts sheet drops a page. Stamp the pages that were actually built, including the
       site-plan title block, which is baked into the SVG before this pass. */
    out = stampStudyPages(out);

    s.sheetDrawn = !!(M && M.ok);
    s.exportSources = [];
    var confirm = $("bh-confirm");
    var wrap = $("bh-report-wrap");
    if (confirm && wrap && confirm.parentNode === $("bh-report")) wrap.parentNode.insertBefore(confirm, wrap.nextSibling);
    $("bh-report").innerHTML = out.join("");
    $("bh-report-wrap").hidden = false;
    if (confirm && wrap && wrap.parentNode && confirm.previousElementSibling !== wrap) {
      wrap.parentNode.insertBefore(confirm, wrap.nextSibling);
    }
    if ($("bh-lead-address") && !$("bh-lead-address").value) $("bh-lead-address").value = s.matched || s.input;
    if ($("bh-cta-bar")) $("bh-cta-bar").hidden = false;
    if ($("bh-lead-card")) $("bh-lead-card").hidden = false;
    showMassing(s, massSpec);
    watchSheet(s);
  }
  function legendItems(s, spec) {
    var geo = s.landscape && s.landscape.geo;
    var src = geo && geo.src && geo.src.buildings ? geo.src.buildings : "no building outline layer answered for this lot";
    var height = spec.buildings && spec.buildings[0] ? spec.buildings[0].label : "No building mass is drawn.";
    var items = [
      "Parcel: " + (s.lotSrc || "the parcel outline on this study") + ".",
      "Footprint: " + src + ".",
      "Height: " + height,
      spec.dem ? "Ground: the elevation samples already read for this lot." : "Ground: no elevation grid was available, so the lot is flat in the free model."
    ];
    if (spec.roof && spec.roof.note) items.push(spec.roof.note);
    if (!String(CFG.googleMapsKey || "").trim()) items.push("Photorealistic layer: off. No Google Maps key is set. The free massing model is the view, and nothing is sent to Google.");
    else {
      var g = spec.google || {};
      items.push("Photorealistic layer: Google 3D Maps (" + (g.map || "not requested") + "). Solar buildingInsights: " + (g.solar || "not requested") + ".");
    }
    return items;
  }
  function showMassing(s, spec) {
    var panel = $("bh-3d-panel"), view = $("bh-3d"), note = $("bh-3d-note"), legend = $("bh-3d-legend");
    var finish = function (ready) {
      if (panel && ready) panel.hidden = false;
      if (note && ready) note.textContent = ready.caption || "";
      if (legend && ready) legend.innerHTML = legendItems(s, ready).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
      var mounted = (view && ready && window.BuildHereMassing) ? BuildHereMassing.mount(view, ready) : null;
      var img = $("bh-3d-shot"), printNote = $("bh-3d-print-note");
      if (printNote && ready) printNote.textContent = ready.caption || "";
      if (mounted && img) {
        var url = mounted.snapshot();
        if (url) img.src = url;
      }
      var roofOn = true;
      var roofBtn = $("bh-3d-roof");
      if (roofBtn) roofBtn.onclick = function () { roofOn = !roofOn; if (mounted && mounted.setRoof) mounted.setRoof(roofOn); };
      [].forEach.call(document.querySelectorAll("#bh-3d-panel [data-floor]"), function (btn) {
        btn.onclick = function () { if (mounted && mounted.setFloor) mounted.setFloor(btn.getAttribute("data-floor")); };
      });
      [].forEach.call(document.querySelectorAll("#bh-3d-panel [data-mode]"), function (btn) {
        btn.onclick = function () {
          var mode = btn.getAttribute("data-mode");
          if (mounted && mounted.setMode) mounted.setMode(mode);
          var gHost = $("bh-3d-google"), viewEl = $("bh-3d");
          if (gHost) gHost.hidden = mode !== "google";
          if (viewEl) viewEl.hidden = mode === "google";
        };
      });
      s.massingCaption = ready && ready.caption || "";
      syncPrint();
    };
    if (!spec) { syncPrint(); return; }
    var G3 = window.BuildHereGoogle3D;
    if (G3 && String(CFG.googleMapsKey || "").trim()) G3.enhance(spec, s, CFG).then(finish, function () { finish(spec); });
    else finish(spec);
  }
  /* bh_siteplan_view: once per lookup, when half of the site plan drawing is on screen. The drawing is
     watched, not its page: on a phone the page also holds the tables as text and is several screens tall. */
  function watchSheet(s) {
    var el = $("bh-report").querySelector(".bh-sheet-svg");
    if (!el || s.sheetSeen) return;
    var fire = function () { if (s.sheetSeen) return; s.sheetSeen = true; track("bh_siteplan_view", { sheet: "SP-1", drawn: !!s.sheetDrawn }); };
    if (!window.IntersectionObserver) { fire(); return; }
    var io = new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fire(); } }, { threshold: 0.5 });
    io.observe(el);
  }

  function redFlags(s, v, rs, livingUsed) {
    var f = [];
    if (s.hazards.length) f.push("Mapped critical area or hazard on or touching the parcel: " + s.hazards.join(", ") + ". Expect a critical area review and possibly a geotechnical report.");
    if (v.type === "teardown") {
      f.push("A teardown needs a demolition permit, and utilities must be capped first.");
      f.push("A new house loses any grandfathered setbacks or size the old one had.");
    }
    if (s.hazards.some(function (h) { return /1990/.test(h); }) && !s.hazards.some(function (h) { return /2016|City of Kenmore critical/.test(h); })) f.push("The older 1990 county maps flag this parcel but the 2016 landslide and steep slope maps do not. The city may still ask for a geotechnical report to settle it; budget for one.");
    if (s.nearNotices && s.nearNotices.length) {
      var kinds = s.nearNotices.join(", ").split(", ").filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      f.push("A sensitive area notice is recorded on title for " + (s.nearNotices.length === 1 ? "a neighboring parcel" : s.nearNotices.length + " neighboring parcels") + " within about 50 ft of this lot (" + kinds.join(", ") + "). That points to slope or erosion conditions next door, so expect the city to ask about this lot too.");
    }
    if (s.juris === "kenmore") f.push(s.shoreline ? "The parcel is inside Kenmore shoreline jurisdiction (" + s.shoreline + "). Work here follows the Shoreline Master Program: shoreline buffers and setbacks, vegetation rules, and possibly a shoreline exemption or permit before the building permit." : "We did not find this parcel in Kenmore's shoreline map. If any part of the lot is within 200 ft of Lake Washington or the Sammamish River, the Shoreline Master Program still applies, so verify with the city.");
    if (s.juris === "kenmore" && s.hazards.some(function (h) { return /City of Kenmore critical/.test(h); })) f.push("Kenmore's own critical areas map shows a hazard on this parcel. Expect a geotechnical report. Landslide hazard areas carry a buffer of at least the slope height or 50 ft, which a qualified study can reduce to 25 ft. Erosion areas need sediment control and seasonal limits on clearing.");
    if (v.type === "shop") f.push("A shop near a slope or lot line may need retaining walls or engineered footings. Drainage from the new roof and driveway must be managed on site.");
    var yb = s.yearBuilt ? +s.yearBuilt : null, sl = s.landscape && s.landscape.slope;
    var slopey = !!(sl && sl.ok && (sl.mean >= 15 || sl.pct25 >= 10));
    var tight = slopey || (rs && rs.setbacks && typeof rs.setbacks.side === "number" && rs.setbacks.side <= 5) || (v.lot != null && v.lot < 7500);
    if ((v.type === "addition" || v.type === "shop") && (yb == null || yb < 1995)) f.push("An addition ties into old framing and foundations. " + (yb == null ? "The year built is not on record, so plan" : "This house was built in " + s.yearBuilt + ", so plan") + " for surprises behind the walls, and budget for engineering.");
    if ((v.type === "addition" || v.type === "teardown" || v.type === "shop") && tight) f.push("Basements or deep footings close to a lot line can need shoring and neighbor coordination" + (slopey ? ", and this lot slopes (about " + sl.mean + "% on average)" : "") + ". Ask your engineer early.");
    var puget = (!s.stateAbbr || s.stateAbbr === "WA") && /^(King|Snohomish|Pierce|Kitsap)/.test(s.county || "");
    var site = rs && rs.site ? rs.site : (R.siteRules ? R.siteRules({ juris: s.juris, city: s.cityKey }, rs) : null);
    if (v.type === "teardown" || v.type === "addition" || v.type === "remodel" || v.type === "adu") {
      if (puget && site && site.asbestos && site.asbestos.v) f.push(site.asbestos.v.replace(/\.$/, "") + ".");
      else f.push("Check the local air agency's asbestos rule before any demolition or renovation. Many require a survey first, whatever the age of the house.");
      if (yb == null) f.push("The year built is not on record. Plan as if the house was built before 1978: paid renovation work in such a home must follow lead-safe work practices.");
      else if (yb < 1978) f.push("Built " + s.yearBuilt + ", before 1978: paid renovation work must follow lead-safe work practices.");
    }
    var livingNow = livingUsed != null ? livingUsed : v.existing;
    if (rs && rs.floorCap && livingNow != null && livingNow >= rs.floorCap) f.push("The existing house is at or over the floor area cap as entered. Adding counted floor area may not be allowed. Below-grade space or a different unit count can change the cap, so ask the city.");
    if (!f.length) f.push("No red flags from the data we could read. That is not a clean bill; a site visit matters.");
    return f;
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
  /* The lead form. With a leadUrl the message goes to this site's own server, which emails it to the firm.
     Without one, or when that fails, the visitor's own email app is opened with the message filled in.
     An email address or a phone number is required, so there is a way to reply. */
  function lead(e) {
    e.preventDefault();
    var f = e.target, st = $("bh-lead-status");
    if (f.company_website && f.company_website.value) return;
    var val = function (n) { return f[n] && f[n].value != null ? String(f[n].value).trim() : ""; };
    var pick = function (n) { var el = f[n]; return el && el.value && el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0].text : ""; };
    var name = val("name"), email = val("email"), phone = val("phone"), address = val("address"), note = val("note");
    // The project asked about is a field of this form. It used to be read from the Project type box under
    // Edit the facts, which most visitors never open, so nearly every message said "Addition".
    var interest = f.interest ? pick("interest") : ($("bh-type") && $("bh-type").selectedOptions[0] ? $("bh-type").selectedOptions[0].text : ""), interestKey = f.interest ? val("interest") : ($("bh-type") ? $("bh-type").value : "");
    var timeline = pick("timeline");
    var emailOk = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email), phoneOk = phone.replace(/\D/g, "").length >= 7;
    if (!emailOk && !phoneOk) {
      st.textContent = email ? "That email address does not look complete. Enter an email address or a phone number so we can reply." : "Enter an email address or a phone number so we can reply.";
      var first = f.email || f.phone;
      if (first && first.focus) first.focus();
      return;
    }
    var facts = [], factsObj = {};
    if (state) {
      var lotv = num("bh-lot"), zv = $("bh-zone").value.trim(), exv = num("bh-existing");
      if (state.parcel) { facts.push("Parcel: " + state.parcel); factsObj.parcel = String(state.parcel); }
      if (state.jurisLabel) { facts.push("Jurisdiction: " + state.jurisLabel); factsObj.jurisdiction = state.jurisLabel; }
      if (lotv) { facts.push("Lot: " + Math.round(lotv) + " sf"); factsObj.lot = Math.round(lotv); }
      if (zv) { facts.push("Zone: " + zv); factsObj.zone = zv; }
      if (exv) { facts.push("Existing house: " + Math.round(exv) + " sf"); factsObj.existing = Math.round(exv); }
    }
    var came = Object.keys(ATTR).map(function (k) { return k + "=" + ATTR[k]; }).join(" ");
    var body = ["Build-here report request", "Name: " + name, "Email: " + email, "Phone: " + phone, "Address: " + address, "Project: " + interest, timeline ? "Timeline: " + timeline : "", "Notes: " + note, "", facts.length ? "From the report (public records, unverified):\n" + facts.join("\n") : "", "", "Sent from " + (CFG.leadSource || (location.host + location.pathname)), came ? "Came from: " + came : ""].filter(function (x, i, a) { return x !== "" || (i > 0 && a[i - 1] !== ""); }).join("\n");
    var subject = "Build-here question: " + (address || "no address");
    var where = { county: state ? state.county : "", jurisdiction: state ? state.jurisLabel : "", project_type: interestKey };
    var byMail = function (lead0) {
      var to = String(CFG.leadEmail || CFG.email || "").trim();
      if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(to)) { st.textContent = lead0 + "No contact address is set for this form, so nothing was opened." + (CFG.phone ? " Call " + CFG.phone + "." : ""); return; }
      window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      st.textContent = "";
      st.appendChild(document.createTextNode(lead0 + "Your email app should open with the message filled in. Nothing is sent until you press send there. No email app? "));
      var copy = document.createElement("button");
      copy.type = "button"; copy.className = "bh-linkbtn"; copy.id = "bh-lead-copy"; copy.textContent = "Copy the message";
      st.appendChild(copy);
      st.appendChild(document.createTextNode(" and send it to " + to + "."));
      copy.addEventListener("click", function () {
        copyText(subject + "\n\n" + body, function () { copy.textContent = "Copied"; }, function () {
          // No clipboard here (an in-app browser, or a page not on https). The button used to do nothing.
          var ta = $("bh-lead-text") || document.createElement("textarea");
          ta.id = "bh-lead-text"; ta.className = "bh-input"; ta.rows = 8; ta.readOnly = true; ta.value = subject + "\n\n" + body;
          ta.setAttribute("aria-label", "Message to copy");
          st.appendChild(ta); ta.focus(); ta.select();
          copy.textContent = "Copying did not work here. Select the text below and copy it";
        });
      });
      // Opening the visitor's email app is not a sent message, so it is counted as a button press, not as a lead.
      track("bh_cta_click", { cta: "email_app", placement: "form" });
    };
    if (!CFG.leadUrl) { byMail(""); return; }
    var btn = f.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    st.textContent = "Sending...";
    var headers = { "Content-Type": "application/json" };
    if (CFG.leadHeader) headers[CFG.leadHeader] = "1";
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, TIMEOUT);
    fetch(CFG.leadUrl, { method: "POST", headers: headers, credentials: "omit", signal: ctl.signal, body: JSON.stringify({ name: name, email: email, phone: phone, address: address, interest: interest, timeline: timeline, note: note, company_website: "", facts: factsObj, page: location.pathname, attribution: ATTR }) })
      .finally(function () { clearTimeout(timer); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { sent: r.ok && !!j && j.ok === true, status: r.status, j: j || {} }; }); })
      .then(function (r) {
        if (btn) btn.disabled = false;
        if (r.sent) {
          st.textContent = "Sent. " + (CFG.brand || "We") + " will reply " + (emailOk ? "by email" : "by phone") + ".";
          ["name", "email", "phone", "note"].forEach(function (n) { if (f[n]) f[n].value = ""; });
          track("generate_lead", { method: "form", project_type: where.project_type, county: where.county, jurisdiction: where.jurisdiction });
          return;
        }
        if (r.status === 429) { st.textContent = "Too many messages have come from this connection. Wait a few minutes and try again" + (CFG.phone ? ", or call " + CFG.phone : "") + "."; return; }
        if (r.status === 400 && r.j && typeof r.j.message === "string") { st.textContent = r.j.message; return; }
        byMail("The message could not be sent from this page. ");
      })
      .catch(function () { if (btn) btn.disabled = false; byMail("The message could not be sent from this page. "); });
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
      sources: [],
      noSources: true,
      limitations: STUDY_LIMITS,
      baseHref: CFG.siteBase,
      brand: CFG.brand,
      contact: CFG.contactLine || [CFG.brand, CFG.phone, CFG.site, CFG.license ? "WA contractor reg. " + CFG.license : ""].filter(Boolean).join(" · "),
      hideLinkOnly: true
    });
    track("bh_study_export", { method: "download" });
    var a = document.createElement("a"), url = URL.createObjectURL(new Blob([file], { type: "text/html" }));
    var slug = String(state.matched || state.input || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    a.href = url;
    a.download = "feasibility-study" + (slug ? "-" + slug : "") + ".html";
    document.body.appendChild(a);
    a.click();
    a.remove();
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
    cleaned.measure.seq = ++state.seq; // a number added after an edit wins over the edit, and the other way round
    state.manual.push(cleaned.measure);
    if (note) note.textContent = "Added. The study shows this beside any automatic number.";
    $("bh-man-sf").value = "";
    $("bh-man-low").value = "";
    $("bh-man-high").value = "";
    renderManualList();
    render();
  }
  /* Sample studies, drawn with no lookup: ?sample=1 is a lot in a place with no zoning coded, ?sample=2 is a
     lot in Redmond's NR zone with a house, a street, neighbors and sloping ground, so the site plan sheet and
     the option sheets have something to draw. Both are made-up lots, labeled as samples on every page. */
  function sampleState(kind) {
    var coded = kind === "2", s = blank();
    var lat0 = coded ? 47.6573 : 40.0006, lon0 = coded ? -122.1273 : -90.0091, W = coded ? 120.7 : 92, H = coded ? 79.5 : 131.4;
    var fr = G.frame(lat0, lon0), x0 = -W / 2, x1 = W / 2, y0 = -H / 2, y1 = H / 2;
    var ll = function (x, y) { return fr.inv(x, y); };
    var rectLL = function (a, b, c, d) { return [ll(a, b), ll(c, b), ll(c, d), ll(a, d), ll(a, b)]; };
    var rectFt = function (a, b, c, d) { return [[a, b], [c, b], [c, d], [a, d], [a, b]]; };
    var house = coded ? rectFt(-42, -22, -8, 24.5) : rectFt(-31, -40, 31, 12.9), houseSf = Math.round(G.area([house]));
    var pt = ll(coded ? -30 : 0, coded ? 0 : -20);
    s.input = "Sample lot"; s.isSample = true;
    s.matched = coded ? "Sample lot, Redmond NR zone (not a property record)" : "Sample lot (not a property record)";
    s.juris = coded ? "city" : "outside";
    s.cityKey = coded ? R.cityKey("Redmond") : "";
    s.jurisLabel = coded ? "City of Redmond, King County (sample)" : "Example County (sample)";
    s.county = coded ? "King County" : "Example County";
    s.stateAbbr = "WA";
    s.city = coded ? "Redmond" : "Example";
    s.zone = coded ? "NR" : "";
    s.zoneSrc = coded ? "Sample zone. Not a zoning map reading." : "";
    s.lot = coded ? 9600 : 12088;
    s.lotSrc = "Illustrative lot area for this sample. Not a client file.";
    s.lotKind = "record";
    s.footprint = houseSf;
    s.footprintSrc = "Illustrative roof outline for this sample. Not living area.";
    s.footprintKind = "roof";
    if (coded) {
      s.existing = 1840; s.existingSrc = "Illustrative living area for this sample."; s.firstFloor = 1220; s.garageFloor = 550; s.garageFloorSrc = "Illustrative garage area for this sample.";
      s.basementTotal = 1220; s.basementFinished = 620; s.basementSrc = "Illustrative basement area for this sample."; s.stories = 1; s.storiesSrc = "Illustrative record for this sample";
      noteYear(s, 1967, "Illustrative year for this sample");
    }
    s.prepared = "2026-11-17";
    s.lon = pt[0]; s.lat = pt[1];
    s.rings = [rectLL(x0, y0, x1, y1)];
    // Neighbors on three sides and across the street, which is on the west for the coded sample and the south for the other.
    s.neighborRings = coded
      ? [rectLL(x0, y1, x1, y1 + 80), rectLL(x0, y0 - 80, x1, y0), rectLL(x1, y0, x1 + 120, y1), rectLL(x0 - 180, y0, x0 - 60, y1)]
      : [rectLL(x0 - 92, y0, x0, y1), rectLL(x1, y0, x1 + 92, y1), rectLL(x0, y1, x1, y1 + 130), rectLL(x0, y0 - 190, x1, y0 - 60)];
    s.hazardScope = "parcel";
    var street = coded ? { line: [[x0 - 30, -400], [x0 - 30, 400]], name: "Sample Avenue Northeast", kind: "street" } : { line: [[-400, y0 - 30], [400, y0 - 30]], name: "Sample Street", kind: "street" };
    var gx0 = x0 - 40, gy0 = y0 - 40, step = 10, nx = Math.ceil((W + 80) / step) + 1, ny = Math.ceil((H + 80) / step) + 1, vals = [];
    // Ground that falls away from the street, with a little cross fall so the contours are not ruled lines.
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var gx = gx0 + i * step, gy = gy0 + j * step, along = coded ? (gx - x0) / W : (gy - y0) / H, across = coded ? (gy - y0) / H : (gx - x0) / W;
      vals.push((coded ? 179 : 412) - (coded ? 19 : 7) * along - 2.5 * across + 1.2 * Math.sin(along * 5) * Math.cos(across * 4));
    }
    var nbHouse = coded ? rectFt(-40, y1 + 12, 0, y1 + 50) : rectFt(x1 + 14, -30, x1 + 60, 20);
    var geo = {
      frame: { lat0: fr.lat0, lon0: fr.lon0 }, lot: [rectFt(x0, y0, x1, y1)], point: fr.fwd(pt),
      buildings: [{ ring: house, rings: [house], sf: houseSf, sfOnLot: houseSf, role: "house", straddle: false, note: "" }, { ring: nbHouse, rings: [nbHouse], sf: Math.round(G.area([nbHouse])), sfOnLot: null, role: "neighbor", straddle: false, note: "" }],
      drives: [], driveLines: [], hard: [], streets: [street], sidewalks: [], trees: [],
      dem: { x0: gx0, y0: gy0, step: step, nx: nx, ny: ny, vals: vals, res: 1 }, demFine: null,
      src: { buildings: "Sample outline", paving: "", streets: "Sample street" }
    };
    s.landscape = {
      rows: [
        { key: "lot", label: "Lot area", sf: s.lot, pct: 100, conf: "Low", src: "Sample only." },
        { key: "house", label: "House footprint (on this lot)", sf: houseSf, conf: "Low", src: "Sample roof outline. Includes eaves. Not living area." },
        { key: "garage", label: "Detached garage / accessory building", sf: null, conf: "Unavailable", src: "Not measured. Left blank." },
        { key: "drive", label: "Driveway and parking", sf: null, conf: "Unavailable", src: "Not measured. Not entered as 0." },
        { key: "hard", label: "Walkways, patios, decks and other hardscape", sf: null, conf: "Unavailable", src: "Not measured. Not entered as 0." },
        { key: "land", label: "Unclassified open area (not verified landscaping)", sf: s.lot - houseSf, verifiedLandscape: false, conf: "Low", src: "Lot area minus the roof outline only. Not landscaping." }
      ],
      notes: ["Sample layout. These numbers are not a property record."],
      sources: [],
      slope: coded ? { ok: true, step: 4, samples: 600, res: 1, mean: 16, median: 16, p95: 18, max: 20, pct15: 80, pct25: 0, pct40: 0, elevMin: 158, elevMax: 179, fallPct: 15.9, fallDeg: 97, fallCompass: "east" } : { ok: false, note: "not measured in the sample" },
      flags: [],
      lot: { sf: s.lot, outlineSf: Math.round(W * H) },
      geo: geo
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
  /* The print copy is made each time the study is drawn, and it stays until the next lookup. A browser that
     lays the page out before it tells the page a print is coming still prints the study. The copy is hidden
     on screen. Every page is letter, landscape: the two summary sheets are drawn for it. */
  function syncPrint() {
    cleanupPrint();
    var report = $("bh-report"), wrap = $("bh-report-wrap");
    if (!report || !wrap || wrap.hidden || !report.children.length) return;
    var host = document.createElement("div"), box = host;
    host.id = "bh-print-host";
    if (ROOT !== document && CFG.printCss && host.attachShadow) {
      var shadow = host.attachShadow({ mode: "open" }), sheet = document.createElement("style");
      sheet.textContent = CFG.printCss;
      box = document.createElement("div");
      shadow.appendChild(sheet); shadow.appendChild(box);
      if (CFG.hostStyle) host.setAttribute("style", CFG.hostStyle);
    }
    box.className = "bh-report bh-print-copy" + (CFG.rootClass ? " " + CFG.rootClass : "");
    box.innerHTML = report.innerHTML;
    [].forEach.call(box.querySelectorAll(".bh-noprint,.bh-screen-only,script,iframe,video,button"), function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    [].forEach.call(box.querySelectorAll("a[href]"), function (a) {
      var span = document.createElement("span");
      span.textContent = a.textContent;
      if (a.className) span.className = a.className;
      if (a.parentNode) a.parentNode.replaceChild(span, a);
    });
    [].forEach.call(box.querySelectorAll("[id]"), function (el) { el.removeAttribute("id"); });
    var page = document.createElement("style");
    page.textContent = "@page{size:letter landscape;margin:0.35in}#bh-print-host{display:none}@media print{body.bh-printing{background:#fff!important}body.bh-printing>*:not(#bh-print-host){display:none!important}body.bh-printing>#bh-print-host{display:block!important}.bh-print-copy .bh-page{break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid;margin:0!important;box-shadow:none!important;zoom:var(--bh-fit,1)}.bh-print-copy .bh-page:last-child{break-after:auto!important;page-break-after:auto!important}.bh-print-copy .bh-page-body{padding:.12in 0 .18in!important}.bh-print-copy .bh-page-foot{padding:.08in 0 0!important}}";
    document.head.appendChild(page);
    document.body.appendChild(host);
    document.body.classList.add("bh-printing");
    printJob = { host: host, page: page, box: box };
    fitFacts();
    try { if (document.fonts && document.fonts.ready && document.fonts.ready.then) { var job = printJob; document.fonts.ready.then(function () { if (printJob === job) fitFacts(); }); } } catch (e) {}
  }
  /* The facts sheet has to hold one landscape page, and its rows are sentences, so its height changes from one
     study to the next. The copy that prints is measured the way paper lays it out: the tool's own stylesheet
     with its print rules switched on, in a box as wide as the printable page (letter landscape less the 0.35 in
     margins). When it is taller than the page it is scaled down, in steps, until it fits. It is never scaled
     up, and never below 85%, where the text would be too small to read; past that it runs onto a second page as
     it always did. The scale is the CSS custom property --bh-fit, read by a print rule (zoom). It is set on the
     copy that prints and on the sheet in the study, so the saved file carries it too. */
  var PAPER_W_IN = 10.3, PAPER_H_IN = 7.8, FIT_MIN = 0.85;
  function paperCss() {
    if (CFG.printCss) return String(CFG.printCss);
    // A page that links the stylesheet: read the rules back from every sheet this page is allowed to read.
    var out = "";
    try {
      [].forEach.call(document.styleSheets, function (sheet) {
        var rules = null;
        try { rules = sheet.cssRules; } catch (e) { rules = null; } // a sheet from another origin cannot be read
        if (!rules) return;
        for (var i = 0; i < rules.length; i++) out += rules[i].cssText + "\n";
      });
    } catch (e) { out = ""; }
    return /\.(bh-facts|bh-study-page|bh-page)\b/.test(out) ? out : "";
  }
  function fitFacts() {
    if (!printJob || !printJob.host || !document.body) return 1;
    var root = printJob.host.shadowRoot || printJob.host;
    var copies = root.querySelectorAll(".bh-page");
    var report = $("bh-report"), lives = report ? report.querySelectorAll(".bh-page") : [];
    if (!copies.length) return 1;
    var minFit = 1, probe = null;
    try {
      var css = paperCss();
      probe = document.createElement("div");
      if (css && probe.attachShadow) {
        probe.setAttribute("style", (CFG.hostStyle ? CFG.hostStyle + ";" : "") + "position:fixed!important;left:-30000px!important;top:0!important;width:" + PAPER_W_IN + "in!important;height:auto!important;display:block!important;visibility:hidden!important;pointer-events:none!important");
        probe.setAttribute("aria-hidden", "true");
        var shadow = probe.attachShadow({ mode: "open" }), sheet = document.createElement("style"), box = document.createElement("div");
        sheet.textContent = css.replace(/@media\s+print\b/g, "@media all");
        box.className = printJob.box ? printJob.box.className : "bh-report bh-print-copy";
        shadow.appendChild(sheet);
        shadow.appendChild(box);
        document.body.appendChild(probe);
        var target = PAPER_H_IN * 96 * 0.96, floorFit = 0.72;
        for (var i = 0; i < copies.length; i++) {
          var copy = copies[i], live = lives[i] || null;
          if (!copy.classList || copy.classList.contains("bh-sheet")) continue;
          box.innerHTML = "";
          var f = copy.cloneNode(true);
          f.style.removeProperty("--bh-fit");
          box.appendChild(f);
          var fit = 1, h = box.getBoundingClientRect().height, tries = 0;
          while (h > target && fit > floorFit && tries++ < 8) {
            fit = Math.max(floorFit, Math.floor(fit * Math.sqrt(target / h) * 990) / 1000);
            f.style.setProperty("--bh-fit", String(fit));
            h = box.getBoundingClientRect().height;
          }
          if (fit < minFit) minFit = fit;
          [copy, live].forEach(function (el) {
            if (!el || !el.style) return;
            if (fit < 1) el.style.setProperty("--bh-fit", String(fit));
            else el.style.removeProperty("--bh-fit");
          });
        }
      }
    } catch (e) { minFit = 1; }
    if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
    return minFit;
  }
  function preparePrint() { if (!printJob) syncPrint(); else fitFacts(); }
  function printReport() { preparePrint(); track("bh_study_export", { method: "print" }); window.print(); }

  function init() {
    if (!$("bh-form")) return;
    $("bh-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var a = $("bh-address").value.trim();
      if (!a) { setStatus("Enter a street address with city and ZIP."); return; }
      $("bh-go").disabled = true;
      $("bh-report-wrap").hidden = true;
      cleanupPrint();
      track("bh_lookup_submit", {});
      lookup(a).then(function (s) {
        $("bh-go").disabled = false;
        if (!s) return;
        state = s;
        if (!s.matched) track("bh_lookup_error", { reason: s.lookupError ? "service" : "no_match" });
        if (!s.matched) { setStatus(s.lookupError ? "The address lookup did not finish (" + s.lookupError + "). The address was not rejected. Wait a minute and try again." : "We could not match that address. Check the spelling and include the city and ZIP."); return; }
        try {
          fillForm(s);
          setStatus(s.juris === "other" ? "Found it in " + s.jurisLabel + ". We could not match that city to our list; verify the rules with the city. You can still read the parcel data below."
            : s.juris === "outside" ? "Found " + s.matched + ". Zoning numbers are not coded for this place yet. Verify setbacks, coverage and FAR with the jurisdiction. Parcel, landscape, and slope still run where a public layer answers. Missing paving stays blank."
            : s.manualZone ? "Found " + s.matched + " in " + s.jurisLabel + ". " + s.city + " does not publish a zoning map we can read, so enter the zone from the city map below."
            : s.parcelWarn ? "Found " + s.matched + ". " + s.parcelWarn
            : "Found " + s.matched + ". The feasibility study is below. Edit a fact under the study if a number is wrong.");
          render();
          track("bh_report_ready", { county: s.county, jurisdiction: s.jurisLabel, zone_code: $("bh-zone").value.trim(), rules_coded: ["seattle", "kc", "sno", "edmonds", "kenmore", "city"].indexOf(s.juris) >= 0 && !!s.zone });
          if ($("bh-step3")) $("bh-step3").focus();
        } catch (err) {
          setStatus("Found " + s.matched + ", and the study could not be drawn. Reload the page and try again.");
          track("bh_lookup_error", { reason: "draw" });
          if (window.console && console.error) console.error(err);
        }
      });
    });
    $("bh-confirm-form").addEventListener("submit", function (e) { e.preventDefault(); if (state) { render(); if ($("bh-step3")) $("bh-step3").focus(); } });
    $("bh-print").addEventListener("click", printReport);
    window.addEventListener("beforeprint", function () { preparePrint(); });
    ROOT.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-bh-cta]") : null;
      if (!el) return;
      track("bh_cta_click", { cta: el.getAttribute("data-bh-cta"), placement: el.getAttribute("data-bh-place") || "page" });
      var plan = el.getAttribute("data-bh-plan"), sel = $("bh-lead-interest");
      if (plan && sel && [].slice.call(sel.options).some(function (o) { return o.value === plan; })) sel.value = plan;
    });
    if ($("bh-download")) $("bh-download").addEventListener("click", downloadStudy);
    if ($("bh-manual-form")) $("bh-manual-form").addEventListener("submit", addManual);
    if ($("bh-manual-list")) $("bh-manual-list").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-man-del]") : null;
      if (!btn || !state || !state.manual) return;
      state.manual.splice(parseInt(btn.getAttribute("data-man-del"), 10), 1);
      renderManualList();
      render();
      if ($("bh-man-note")) $("bh-man-note").textContent = "Removed. The study no longer uses that number.";
      if ($("bh-man-kind")) $("bh-man-kind").focus();
    });
    if ($("bh-lead")) $("bh-lead").addEventListener("submit", lead);
    $("bh-report").addEventListener("click", function (e) {
      var jump = e.target.closest ? e.target.closest('a[href^="#bh-"]') : null, dest = jump ? $(jump.getAttribute("href").slice(1)) : null;
      if (dest) {
        e.preventDefault();
        dest.scrollIntoView({ block: "start" });
        var head = dest.querySelector("h2,h3");
        if (head) { head.setAttribute("tabindex", "-1"); head.focus({ preventScroll: true }); }
      }
    });
    var params = new URLSearchParams(location.search);
    if (/^[12]$/.test(params.get("sample") || "") && G && (CFG.allowSample || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))) {
      state = sampleState(params.get("sample"));
      fillForm(state);
      render();
      setStatus("Sample layout only. These numbers are not a property record.");
      return;
    }
    var p = params.get("bh_address") || params.get("address");
    if (p) {
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
  window.BuildHere = { polyAreaSqft: polyAreaSqft, minRect: minRect, classifyEdges: classifyEdges, envelopeRows: envelopeRows, init: init, setbackFor: setbackFor, lotGeometry: lotGeometry, ctaUrl: ctaUrl, linkUrl: linkUrl, streetParts: streetParts, track: track, sampleState: sampleState, polyQuery: polyQuery, brandInfo: brandInfo, stampStudyPages: stampStudyPages };
})();
