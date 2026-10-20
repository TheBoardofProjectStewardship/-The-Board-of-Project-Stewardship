/* What can I build here? Address lookup, report builder and budget math.
   Runs fully in the browser against free public GIS services. */
(function () {
  "use strict";
  var R = window.BuildHereRules;
  var fmt = R.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var TIMEOUT = 20000;

  var EP = {
    census: "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress",
    kcParcel: "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query",
    kcZoning: "https://gismaps.kingcounty.gov/arcgis/rest/services/Planning/KingCo_Zoning/MapServer/1/query",
    kcSensitive: "https://gismaps.kingcounty.gov/arcgis/rest/services/Environment/KingCo_SensitiveAreas/MapServer/",
    kcAerial: "https://gismaps.kingcounty.gov/arcgis/rest/services/BaseMaps/KingCo_Aerial_2025/MapServer/export",
    seaZoning: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0/query",
    seaParcel: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/ADUniverse_parcels/FeatureServer/0/query",
    seaEca: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Environmentally_Critical_Areas_ECA/FeatureServer/",
    seaPermits: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Residential_Building_Permits_Issued_and_Final/FeatureServer/0/query",
    snoParcel: "https://gis.snoco.org/sas/rest/services/SAS_Services/SAS_Parcels/MapServer/0/query",
    snoHost: "https://gis.snoco.org/host/rest/services/Hosted/",
    snoSlope: "https://gis.snoco.org/sas/rest/services/SAS_Services/SAS_Steep_Slopes/MapServer/0/query",
    snoAerial: "https://gis.snoco.org/sas/rest/services/SAS_Services/SAS_Imagery_2024/MapServer/export",
    edmZoning: "https://maps.edmondswa.gov/gis/rest/services/DevServices/Zoning/MapServer/5/query"
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
  function qs(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); }).join("&"); }
  function getJSON(url, params) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, TIMEOUT);
    return fetch(url + "?" + qs(params), { signal: ctl.signal }).finally(function () { clearTimeout(t); }).then(function (r) {
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
    return { input: "", matched: "", lon: null, lat: null, county: "", city: "", juris: "other", jurisLabel: "", parcel: "", assessorUrl: "", lot: null, lotSrc: "", zone: "", zoneSrc: "", existing: null, existingSrc: "", footprint: null, footprintSrc: "", yearBuilt: "", yearSrc: "", rings: null, hazards: [], hazardNotes: [], nearNotices: [], frontDir: "", permits: [], permitNote: "", permitLinks: [], imagery: null, sources: [], manual: [] };
  }
  function log(s, ok, name, note) { s.sources.push({ name: name, ok: ok, note: note || "" }); }

  /* ---------- lookup pipeline ---------- */
  function lookup(address) {
    var s = blank(); s.input = address;
    setStatus("Looking up the address with the US Census geocoder...");
    return jsonp(EP.census, { address: address, benchmark: "Public_AR_Current", vintage: "Current_Current", layers: "Counties,Incorporated Places" })
      .then(function (j) {
        var m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
        if (!m) { log(s, false, "US Census geocoder", "No match for that address."); throw new Error("nomatch"); }
        log(s, true, "US Census geocoder");
        s.matched = m.matchedAddress; s.lon = m.coordinates.x; s.lat = m.coordinates.y;
        var g = m.geographies || {};
        s.county = ((g.Counties || [])[0] || {}).NAME || "";
        s.city = (((g["Incorporated Places"] || [])[0] || {}).NAME || "").replace(/ city$| town$/i, "");
        if (/^King/.test(s.county)) s.juris = s.city === "Seattle" ? "seattle" : s.city === "Kenmore" ? "kenmore" : (s.city ? "other" : "kc");
        else if (/^Snohomish/.test(s.county)) s.juris = s.city === "Edmonds" ? "edmonds" : (s.city ? "other" : "sno");
        else s.juris = "outside";
        s.jurisLabel = s.city ? "City of " + s.city + ", " + s.county : (s.county ? "Unincorporated " + s.county : "Unknown");
        setStatus("Found " + s.matched + ". Reading parcel records...");
        if (/^King/.test(s.county)) return kingParcel(s);
        if (/^Snohomish/.test(s.county)) return snoParcel(s);
        return s;
      })
      .then(function () { return Promise.all([zoning(s), hazards(s), permits(s), extras(s)]); })
      .then(function () { buildImagery(s); return s; })
      .catch(function (e) {
        if (e && e.message === "nomatch") return s;
        log(s, false, "Lookup", "Stopped early: " + (e && e.message));
        return s;
      });
  }

  function houseAndStreet(matched) {
    var first = String(matched).split(",")[0].trim().toUpperCase();
    var m = first.match(/^(\d+)\s+(.*)$/);
    return m ? { num: m[1], street: m[2], full: first } : { num: "", street: first, full: first };
  }
  function zipOf(matched) { var m = String(matched).match(/(\d{5})\s*$/); return m ? m[1] : ""; }

  function kingParcel(s) {
    var hs = houseAndStreet(s.matched), zip = zipOf(s.matched);
    var where = "ADDR_FULL LIKE '" + hs.full.replace(/[%_]/g, "").replace(/'/g, "''") + "%'" + (zip ? " AND ZIP5='" + zip + "'" : "");
    var fields = "PIN,ADDR_FULL,CTYNAME,LOTSQFT,KCA_ZONING,PREUSE_DESC";
    return getJSON(EP.kcParcel, { f: "json", where: where, outFields: fields, returnGeometry: true, outSR: 4326 })
      .then(function (j) {
        if (j.features && j.features.length) return j;
        return getJSON(EP.kcParcel, ptQuery(s.lon, s.lat, { outFields: fields, returnGeometry: true, outSR: 4326, distance: 25, units: "esriSRUnit_Meter" }));
      })
      .then(function (j) {
        var f = (j.features || [])[0];
        if (!f) { log(s, false, "King County parcels", "No parcel matched."); return; }
        var a = f.attributes;
        s.parcel = a.PIN; s.rings = f.geometry && f.geometry.rings;
        s.assessorUrl = "https://blue.kingcounty.com/Assessor/eRealProperty/Detail.aspx?ParcelNbr=" + a.PIN;
        s.lot = a.LOTSQFT || (s.rings ? Math.round(polyAreaSqft(s.rings)) : null); s.lotSrc = "King County Assessor (LOTSQFT)";
        s.zone = (a.KCA_ZONING || "").trim(); s.zoneSrc = "King County Assessor zoning field";
        s.presentUse = (a.PREUSE_DESC || "").trim();
        log(s, true, "King County parcels (KingCo_PropertyInfo)");
      })
      .catch(function (e) { log(s, false, "King County parcels", e.message); });
  }

  function snoParcel(s) {
    var hs = houseAndStreet(s.matched), zip = zipOf(s.matched);
    var where = "Site_House_Number='" + hs.num + "'" + (zip ? " AND Site_Zip LIKE '" + zip + "%'" : "");
    var fields = "PARCEL_ID,Site_House_Number,Site_Address,Site_City,Acres_Gross,Property_Account_Summary";
    return getJSON(EP.snoParcel, { f: "json", where: where, outFields: fields, returnGeometry: true, outSR: 4326 })
      .then(function (j) {
        var feats = (j.features || []).filter(function (f) { return f.geometry && f.geometry.rings; });
        var words = hs.street.split(/\s+/).filter(function (w) { return /\d/.test(w) || w.length > 3; });
        var scored = feats.map(function (f) {
          var addr = String(f.attributes.Site_Address || "").toUpperCase();
          var hit = words.filter(function (w) { return addr.indexOf(w) >= 0; }).length;
          var inside = f.geometry.rings.some(function (r) { return inRing([s.lon, s.lat], r); });
          return { f: f, score: hit * 10 + (inside ? 5 : 0) - distToRings([s.lon, s.lat], f.geometry.rings) * 1000 };
        }).sort(function (a, b) { return b.score - a.score; });
        if (scored.length) return scored[0].f;
        return getJSON(EP.snoParcel, ptQuery(s.lon, s.lat, { outFields: fields, returnGeometry: true, outSR: 4326 })).then(function (k) { return (k.features || [])[0]; });
      })
      .then(function (f) {
        if (!f) { log(s, false, "Snohomish County parcels", "No parcel matched."); return; }
        var a = f.attributes;
        s.parcel = a.PARCEL_ID; s.rings = f.geometry.rings;
        s.assessorUrl = a.Property_Account_Summary || "";
        s.lot = Math.round(polyAreaSqft(s.rings)); s.lotSrc = "Computed from the county parcel outline";
        log(s, true, "Snohomish County parcels (SAS_Parcels)");
        return getJSON(EP.snoHost + "BUILDINGS__roofprints/FeatureServer/0/query", polyQuery(s.rings, { outFields: "*", returnGeometry: true, outSR: 4326 }))
          .then(function (j) {
            var total = 0;
            (j.features || []).forEach(function (b) {
              if (!b.geometry || !b.geometry.rings) return;
              var c = b.geometry.rings[0][0];
              if (s.rings.some(function (r) { return b.geometry.rings[0].some(function (pt) { return inRing(pt, r); }); })) total += polyAreaSqft(b.geometry.rings);
            });
            if (total > 0) { s.footprint = Math.round(total); s.footprintSrc = "Snohomish County mapped roof outlines (not floor area)"; }
            log(s, true, "Snohomish County roof outlines");
          }).catch(function (e) { log(s, false, "Snohomish County roof outlines", e.message); });
      })
      .catch(function (e) { log(s, false, "Snohomish County parcels", e.message); });
  }

  function zoning(s) {
    if (s.lon == null) return Promise.resolve();
    if (s.juris === "seattle") {
      return getJSON(EP.seaZoning, ptQuery(s.lon, s.lat, { outFields: "ZONING,ZONELUT" })).then(function (j) {
        var f = (j.features || [])[0];
        if (f) { s.cityZone = f.attributes.ZONELUT || f.attributes.ZONING; log(s, true, "Seattle zoning (Current_Land_Use_Zoning_Detail)"); if (!s.zone) { s.zone = s.cityZone; s.zoneSrc = "City of Seattle zoning map"; } }
      }).catch(function (e) { log(s, false, "Seattle zoning", e.message); });
    }
    if (s.juris === "edmonds") {
      return getJSON(EP.edmZoning, ptQuery(s.lon, s.lat, { outFields: "ZONING" })).then(function (j) {
        var f = (j.features || [])[0];
        if (f) { s.zone = f.attributes.ZONING; s.zoneSrc = "City of Edmonds zoning map"; log(s, true, "Edmonds zoning (DevServices/Zoning)"); }
      }).catch(function (e) { log(s, false, "Edmonds zoning", e.message + ". Enter the zone by hand."); });
    }
    if (s.juris === "kc") {
      return getJSON(EP.kcZoning, ptQuery(s.lon, s.lat, { outFields: "CURRZONE" })).then(function (j) {
        var f = (j.features || [])[0];
        if (f && f.attributes.CURRZONE) { s.zone = f.attributes.CURRZONE.trim(); s.zoneSrc = "King County zoning map"; }
        log(s, true, "King County zoning (KingCo_Zoning)");
      }).catch(function (e) { log(s, false, "King County zoning", e.message); });
    }
    if (s.juris === "sno") {
      return getJSON(EP.snoHost + "Current_Zoning_2025/FeatureServer/0/query", ptQuery(s.lon, s.lat, { outFields: "abbrev,label" })).then(function (j) {
        var f = (j.features || [])[0];
        if (f) { s.zone = (f.attributes.abbrev || f.attributes.label || "").trim(); s.zoneSrc = "Snohomish County zoning map"; }
        log(s, true, "Snohomish County zoning (Current_Zoning_2025)");
      }).catch(function (e) { log(s, false, "Snohomish County zoning", e.message); });
    }
    return Promise.resolve();
  }

  function countHit(url, rings, label, list, s, srcName) {
    return getJSON(url, polyQuery(rings, { returnCountOnly: true })).then(function (j) {
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
    } else if (/^King/.test(s.county)) {
      [[1, "Potential landslide hazard (King County 2016)"], [3, "Landslide hazard (King County 1990 map, incorporated areas)"], [4, "Potential steep slope hazard (King County 2016)"], [8, "Seismic hazard (King County 1990 map)"], [7, "Erosion hazard (King County 1990 map)"], [22, "Wetland (National Wetland Inventory 2024)"], [15, "Channel migration hazard area"]].forEach(function (L) {
        jobs.push(countHit(EP.kcSensitive + L[0] + "/query", rings, L[1], h, s, "King County Sensitive Areas"));
      });
      if (s.rings) jobs.push(getJSON(EP.kcSensitive + "12/query", polyQuery(s.rings, { distance: 15, units: "esriSRUnit_Meter", outFields: "PIN,LANDSLIDE,EROSION,STEEPSLOPE,RECORDING_,PERMIT_NO", returnGeometry: false })).then(function (j) {
        (j.features || []).forEach(function (f) {
          var a = f.attributes, what = [a.LANDSLIDE ? "landslide" : "", a.STEEPSLOPE ? "steep slope" : "", a.EROSION ? "erosion" : ""].filter(Boolean).join(", ");
          var txt = (what ? what + "; " : "") + (a.RECORDING_ ? "recording " + a.RECORDING_ : "") + (a.PERMIT_NO ? ", permit " + a.PERMIT_NO : "");
          if (String(a.PIN) === String(s.parcel)) h.push("Sensitive area notice on title for this parcel (" + txt + ")");
          else s.nearNotices.push("parcel " + a.PIN + " (" + txt + ")");
        });
      }).catch(function () { s.hazardNotes.push("Sensitive area notices: layer did not answer"); }));
      s.hazardSource = "King County Sensitive Areas map service";
    } else if (/^Snohomish/.test(s.county)) {
      jobs.push(countHit(EP.snoSlope, rings, "Steep slope 33% or more (county map)", h, s, "SAS_Steep_Slopes"));
      [["TOPOGRAPHY__LANDSLIDE__county_lha_model", "Landslide hazard area (county model)"], ["ENVIRONMENTAL__wetlands", "Mapped wetland"], ["ENVIRONMENTAL__fema_flood", "FEMA flood hazard area"]].forEach(function (L) {
        jobs.push(countHit(EP.snoHost + L[0] + "/FeatureServer/0/query", rings, L[1], h, s, L[0]));
      });
      s.hazardSource = "Snohomish County hosted environmental layers";
    }
    return Promise.all(jobs).then(function () { log(s, s.hazardNotes.length === 0, s.hazardSource || "Hazard layers", s.hazardNotes.join("; ")); });
  }

  function permits(s) {
    if (s.juris === "seattle") {
      s.permitLinks = [{ label: "Seattle Services Portal (search by address for permits and records)", url: LINKS.seaPortal }, { label: "SDCI permits and records help", url: LINKS.seaSdci }];
      if (!s.rings) return Promise.resolve();
      return getJSON(EP.seaPermits, polyQuery(s.rings, { outFields: "PRMT_NR,STGLSTTITL,APTYPE,ISS_DATE,FINAL_DATE,VALUE,ADDRESS" })).then(function (j) {
        s.permits = (j.features || []).sort(function (x, y) { return (y.attributes.ISS_DATE || 0) - (x.attributes.ISS_DATE || 0); }).map(function (f) { var a = f.attributes; return { id: a.PRMT_NR, type: a.APTYPE, desc: a.STGLSTTITL, issued: a.ISS_DATE ? new Date(a.ISS_DATE).toISOString().slice(0, 10) : "", final: a.FINAL_DATE ? new Date(a.FINAL_DATE).toISOString().slice(0, 10) : "" }; });
        log(s, true, "Seattle issued and finaled residential permits");
      }).catch(function (e) { log(s, false, "Seattle residential permits", e.message); });
    }
    if (s.juris === "kenmore") { s.permitLinks = [{ label: "MyBuildingPermit permit search (Kenmore records)", url: LINKS.mbp }, { label: "King County permit records before Kenmore incorporated (1998)", url: LINKS.kcPortal }]; return Promise.resolve(); }
    if (s.juris === "kc") { s.permitLinks = [{ label: "King County Permitting portal (search by parcel number)", url: LINKS.kcPortal }]; return Promise.resolve(); }
    if (s.juris === "edmonds") { s.permitLinks = [{ label: "MyBuildingPermit permit search (Edmonds records)", url: LINKS.mbp }, { label: "Edmonds Development Services", url: LINKS.edmDev }]; return Promise.resolve(); }
    if (s.juris === "sno") {
      s.permitLinks = [{ label: "Snohomish County PDS residential permits", url: LINKS.snoPds }];
      if (!s.rings) return Promise.resolve();
      return getJSON(EP.snoHost + "PLANNING__active_permits/FeatureServer/0/query", polyQuery(s.rings, { outFields: "*" })).then(function (j) {
        s.permits = (j.features || []).map(function (f) { var a = f.attributes; return { id: a.permit_number || a.PERMIT_NUMBER || a.permit_no || a.objectid, type: a.permit_type || a.type || "", desc: a.description || a.project_name || a.status || "", issued: "", final: "" }; });
        log(s, true, "Snohomish County active permits layer");
      }).catch(function (e) { log(s, false, "Snohomish County active permits", e.message); });
    }
    return Promise.resolve();
  }

  function extras(s) {
    if (s.juris === "seattle" && s.parcel) {
      return getJSON(EP.seaParcel, { f: "json", where: "PIN='" + s.parcel + "'", outFields: "YEAR_BUILT", returnGeometry: false }).then(function (j) {
        var f = (j.features || [])[0];
        if (f && f.attributes.YEAR_BUILT) { s.yearBuilt = f.attributes.YEAR_BUILT; s.yearSrc = "City of Seattle ADUniverse parcels (newest building)"; }
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
    var base = /^Snohomish/.test(s.county) ? EP.snoAerial : EP.kcAerial;
    var credit = /^Snohomish/.test(s.county) ? "Imagery: Snohomish County Assessor, 2024 orthophoto (gis.snoco.org)" : "Imagery: King County GIS, 2025 aerial (gismaps.kingcounty.gov)";
    var url = base + "?" + qs({ bbox: box.join(","), bboxSR: 3857, imageSR: 3857, size: W + "," + H, format: "jpg", f: "image" });
    var path = s.rings.map(function (r) {
      return r.map(function (p, i) { var m = merc(p[0], p[1]); return (i ? "L" : "M") + ((m[0] - box[0]) / (box[2] - box[0]) * W).toFixed(1) + " " + ((box[3] - m[1]) / (box[3] - box[1]) * H).toFixed(1); }).join(" ") + " Z";
    }).join(" ");
    s.imagery = { url: url, path: path, W: W, H: H, credit: credit };
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
  function segDist(px, py, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? ((px - a[0]) * dx + (py - a[1]) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var x = a[0] + t * dx - px, y = a[1] + t * dy - py;
    return Math.sqrt(x * x + y * y);
  }
  function inRing(px, py, ring) {
    var c = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i], b = ring[j];
      if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function classifyEdges(ring, st, dir) {
    var n = ring.length - 1, area = 0, i;
    for (i = 0; i < n; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    var sgn = area > 0 ? 1 : -1; // counter-clockwise rings have the outside on the right
    var edges = [];
    for (i = 0; i < n; i++) {
      var a = ring[i], b = ring[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
      edges.push({ a: a, b: b, len: L, nx: sgn * dy / L, ny: -sgn * dx / L, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, d: segDist(st[0], st[1], a, b) });
    }
    var D = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] }[dir];
    var near = D ? edges.reduce(function (m, e) { var sc = (e.nx * D[0] + e.ny * D[1]) * Math.sqrt(e.len), sm = (m.nx * D[0] + m.ny * D[1]) * Math.sqrt(m.len); return sc > sm ? e : m; }, edges[0])
      : edges.reduce(function (m, e) { return e.d < m.d ? e : m; }, edges[0]);
    if (D) edges.forEach(function (e) { e.d = e === near ? 0 : (e.nx * near.nx + e.ny * near.ny > 0.7 ? 0 : 999); });
    edges.forEach(function (e) { e.kind = "side"; if (e.nx * near.nx + e.ny * near.ny > 0.7 && e.d < near.d + 25) e.kind = "front"; });
    var fx = 0, fy = 0, fl = 0;
    edges.forEach(function (e) { if (e.kind === "front") { fx += e.mx * e.len; fy += e.my * e.len; fl += e.len; } });
    fx /= fl; fy /= fl;
    var rear = edges.filter(function (e) { return e.kind === "side" && e.nx * near.nx + e.ny * near.ny < -0.6; });
    if (!rear.length) { // no lot line faces away from the street, so use the one farthest from it
      var far = null;
      edges.forEach(function (e) { if (e.kind === "side" && e.nx * near.nx + e.ny * near.ny < 0 && (!far || Math.hypot(e.mx - fx, e.my - fy) > Math.hypot(far.mx - fx, far.my - fy))) far = e; });
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
        var ok = x < b[2] && inRing(x, y, ring);
        for (var k = 0; ok && k < edges.length; k++) if (segDist(x, y, edges[k].a, edges[k].b) < dist(edges[k])) ok = false;
        if (ok) { count++; if (!run) run = [x - cell / 2, y - cell / 2]; }
        else if (run) { rows.push([run[0], run[1], x - cell / 2 - run[0], cell]); run = null; }
      }
    }
    return { rows: rows, area: count * cell * cell };
  }
  function sitePlanSVG(s, rs) {
    if (!s.rings) return '<p class="bh-muted">No parcel outline was available, so no diagram can be drawn.</p>';
    var b = bbox(s.rings), lat0 = (b[1] + b[3]) / 2, lon0 = (b[0] + b[2]) / 2;
    var ring = toFeet([s.rings[0]], lat0, lon0)[0];
    if (ring.length < 4) return "";
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push(ring[0]);
    var st = toFeet([[[s.lon, s.lat]]], lat0, lon0)[0][0];
    var sb = rs && rs.setbacks || {};
    var F = sb.front, Rr = sb.rear, S = sb.side;
    var known = [F, Rr, S].every(function (x) { return typeof x === "number"; });
    var ce = classifyEdges(ring, st, s.frontDir);
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
      return '<line x1="' + f1(X(e.a[0])) + '" y1="' + f1(Y(e.a[1])) + '" x2="' + f1(X(e.b[0])) + '" y2="' + f1(Y(e.b[1])) + '" class="bh-edge bh-edge-' + e.kind + '"/>';
    }).join("");
    var env = "", envArea = null;
    if (known) {
      var er = envelopeRows(ring, ce.edges, function (e) { return e.kind === "front" ? F : e.kind === "rear" ? Rr : S; });
      envArea = er.area;
      if (er.rows.length) {
        var d = er.rows.map(function (r) { return "M" + f1(X(r[0])) + " " + f1(Y(r[1] + r[3])) + "h" + f1(r[2] * sc + 0.4) + "v" + f1(r[3] * sc + 0.4) + "h" + f1(-(r[2] * sc + 0.4)) + "z"; }).join("");
        env = '<path d="' + d + '" class="bh-env"/>';
      }
    }
    var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
    // Street label: just outside the front lot line, kept inside the drawing.
    var lx = clamp(X(ce.fx + ce.near.nx * 14), 70, W - 70), ly = clamp(Y(ce.fy + ce.near.ny * 14), 16, H - 30);
    var label = function (v) { return typeof v === "number" ? v + " ft" : "verify"; };
    var cx = 0, cy = 0, cn = 0;
    ring.slice(0, -1).forEach(function (p) { cx += p[0]; cy += p[1]; cn++; });
    var envText = envArea != null ? (envArea > 0 ? "Envelope about " + fmt(Math.round(envArea / 10) * 10) + " sf" : "No envelope left after setbacks") : "Setbacks not verified";
    return '<svg viewBox="0 0 ' + W + " " + H + '" class="bh-siteplan" role="img" aria-label="Diagrammatic site plan: parcel outline, front, side and rear setbacks, and the remaining buildable envelope. ' + esc(envText) + '.">' +
      '<path d="' + poly + '" class="bh-lot"/>' + env + lines +
      '<text x="' + f1(lx) + '" y="' + f1(ly) + '" class="bh-front" text-anchor="middle">Street side, front ' + label(F) + '</text>' +
      '<text x="' + f1(clamp(X(cx / cn), 80, W - 80)) + '" y="' + f1(clamp(Y(cy / cn), 20, H - 34)) + '" class="bh-envlabel" text-anchor="middle">' + esc(envText) + '</text>' +
      '<g class="bh-north" transform="translate(' + (W - 24) + ',30)"><path d="M0 -14 L6 4 L0 0 L-6 4 Z"/><text y="18" text-anchor="middle">N</text></g>' +
      '<text x="12" y="' + (H - 10) + '" class="bh-note" text-anchor="start"><tspan class="bh-k-front">Front ' + label(F) + '</tspan>  <tspan class="bh-k-side">Side ' + label(S) + '</tspan>  <tspan class="bh-k-rear">Rear ' + label(Rr) + '</tspan>  Scale approximate</text>' +
      "</svg>";
  }

  /* ---------- report ---------- */
  function num(id) { var v = parseFloat(String($(id).value).replace(/,/g, "")); return isFinite(v) ? v : null; }

  function fillForm(s) {
    $("bh-lot").value = s.lot || "";
    $("bh-zone").value = s.zone || "";
    $("bh-existing").value = s.existing || "";
    $("bh-footprint").value = s.footprint || "";
    $("bh-lot-src").textContent = s.lot ? "From: " + s.lotSrc : "Not found in public data. Enter it from your survey or the assessor page.";
    $("bh-zone-src").textContent = s.zone ? "From: " + s.zoneSrc : "Not found. Enter the zone from the city or county zoning map.";
    $("bh-existing-src").textContent = s.juris === "sno" || /^King/.test(s.county) ? "The assessor's living area is not published through a browser-callable service. Read it on the assessor page and enter it here." : "Enter the existing finished floor area.";
    $("bh-footprint-src").textContent = s.footprint ? "From: " + s.footprintSrc + ". Edit if you know the real footprint." : "Optional. The ground-floor footprint of all buildings, for the coverage check.";
    $("bh-confirm").hidden = false;
  }

  function render() {
    var s = state;
    var v = { lot: num("bh-lot"), zone: $("bh-zone").value.trim(), existing: num("bh-existing"), footprint: num("bh-footprint"), imperv: num("bh-imperv"), front: $("bh-front").value, stories: parseInt($("bh-stories").value, 10) || 1, type: $("bh-type").value };
    var rs = v.lot && ["seattle", "kc", "sno", "edmonds", "kenmore"].indexOf(s.juris) >= 0 ? R.pick({ juris: s.juris, zone: v.zone, lot: v.lot, units: 1 }) : null;
    s.frontDir = v.front || "";
    var out = [];
    var place = s.city ? s.city.toUpperCase() : (s.county || "").replace(" County", "").toUpperCase() + " COUNTY";
    var page = function (title, body, cls) { return '<section class="bh-page ' + (cls || "") + '"><div class="bh-page-body">' + body + '</div><footer class="bh-page-foot"><span>' + esc(place) + ' | WA</span><strong>' + esc(title) + '</strong><span class="bh-brand">Board of Project Stewardship</span></footer></section>'; };

    // Cover
    out.push(page("Feasibility snapshot", '<div class="bh-cover"><p class="bh-kicker">Single-family lot · first-pass feasibility</p><h2>' + esc(s.matched || s.input) + '</h2><p class="bh-cover-sub">' + esc(s.jurisLabel) + (s.parcel ? " · Parcel " + esc(s.parcel) : "") + '</p><p class="bh-cover-date">Prepared ' + new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + ' from public records. Rules last checked ' + R.CHECKED + '.</p><p class="bh-disclaimer"><strong>Planning estimate only.</strong> This is not a legal, zoning or permit determination. Confirm every number with the jurisdiction and a licensed professional before you design, buy or build.</p></div>', "bh-cover-page"));

    // Project summary
    var rows = [
      ["Parcel number", s.parcel ? esc(s.parcel) + (s.assessorUrl ? ' · <a href="' + esc(s.assessorUrl) + '" target="_blank" rel="noopener">assessor record</a>' : "") : "Not found"],
      ["Site address", esc(s.matched || s.input)],
      ["Jurisdiction", esc(s.jurisLabel)],
      ["Lot area", v.lot ? fmt(v.lot) + " sf" : "Enter by hand"],
      ["Zone", v.zone ? esc(v.zone) + (s.cityZone && s.cityZone !== v.zone ? " (city map shows " + esc(s.cityZone) + ")" : "") : "Enter by hand"],
      ["Existing finished area", v.existing ? fmt(v.existing) + " sf (your entry)" : "Not entered"],
      ["Building footprint", v.footprint ? fmt(v.footprint) + " sf" : "Not entered"],
      ["Year built", s.yearBuilt ? esc(s.yearBuilt) + " (" + esc(s.yearSrc) + ")" : "Not in a browser-callable record. See the assessor page."],
      ["Stories (existing)", String(v.stories)],
      ["Project type", esc($("bh-type").selectedOptions[0].text)]
    ];
    var haz = s.hazards.length ? "<ul>" + s.hazards.map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") + "</ul>" : (s.hazardSource ? "<p>No mapped hazard layer touched this parcel in the " + esc(s.hazardSource) + ". Maps are not field studies; a site visit can still find steep ground, wet soils or streams.</p>" : "<p>Hazard maps were not checked for this jurisdiction. Ask the city.</p>");
    if (s.hazardNotes.length) haz += '<p class="bh-muted">' + esc(s.hazardNotes.join("; ")) + "</p>";
    out.push(page("Project summary", '<div class="bh-cols"><div><h3>Site data</h3><table class="bh-table">' + rows.map(function (r) { return "<tr><th scope=\"row\">" + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join("") + '</table></div><div><h3>Special site features</h3>' + haz +
      '<h3>Soils and geotechnical</h3><p>No soils report is on file with this snapshot. Slopes, fill or a mapped hazard often lead the jurisdiction to ask for a geotechnical report on bearing soil and drainage.</p>' +
      '<h3>Drainage and civil</h3><p>Larger additions and new houses usually trigger stormwater review. The size thresholds come from the local stormwater code; ask the jurisdiction which applies before design.</p>' +
      '<h3>Construction cost</h3><p>Not estimated here. Use the budget calculator below with your own numbers or a contractor\'s bid.</p>' +
      '<h3>Codes that will apply</h3><p>Local zoning (cited below), the Washington State Residential Code and the <a href="' + R.SRC.wsec.url + '" target="_blank" rel="noopener">Washington State Energy Code</a>. Energy credits depend on project size and type; your designer confirms them.</p></div></div>'));

    // Code review
    var cr;
    if (!rs) {
      var why = s.juris === "other" ? "This tool covers the Cities of Seattle, Kenmore and Edmonds, and unincorporated King and Snohomish counties. For " + esc(s.jurisLabel) + ", check with your city." : (s.juris === "outside" ? "This address is outside King and Snohomish counties." : "We do not have verified rules coded for zone " + esc(v.zone || "(blank)") + " here. Verify with the jurisdiction.");
      cr = '<p class="bh-verify">' + why + '</p><p><a href="./permits.html">The Board permit hub</a> lists city and county permit offices.</p>';
    } else {
      cr = '<h3>' + esc(rs.title) + '</h3><table class="bh-table bh-rules"><thead><tr><th scope="col">Standard</th><th scope="col">What the code says</th><th scope="col">Source (checked ' + R.CHECKED + ')</th></tr></thead><tbody>' +
        rs.rules.map(function (r) { return "<tr><th scope=\"row\">" + esc(r.label) + "</th><td>" + (r.value == null ? '<span class="bh-verify">Verify with the jurisdiction.</span> ' : esc(r.value) + " ") + (r.note ? '<span class="bh-muted">' + esc(r.note) + "</span>" : "") + '</td><td><a href="' + esc(r.src.url) + '" target="_blank" rel="noopener">' + esc(r.src.label) + "</a></td></tr>"; }).join("") + "</tbody></table>" + (rs.caveat ? '<p class="bh-muted">' + esc(rs.caveat) + "</p>" : "");
    }
    out.push(page("Code review", cr));

    // Capacity
    var cap = "";
    if (rs) {
      var lines = [];
      if (rs.floorCap) {
        var room = v.existing != null ? rs.floorCap - v.existing : null;
        lines.push(["Floor area cap", fmt(rs.floorCap) + " sf (" + esc(rs.floorCapLabel) + ")"]);
        if (room != null) lines.push(["Existing counted area (your entry)", fmt(v.existing) + " sf"], ["Room left under the cap", room > 0 ? "<strong>About " + fmt(room) + " sf</strong> (" + fmt(rs.floorCap) + " cap minus " + fmt(v.existing) + " existing)" : "None. The house is at or over the cap as entered."]);
        else lines.push(["Room left under the cap", "Enter the existing finished area in step 2 to see the room left."]);
        lines.push(["Before you rely on this", "Below-grade floor area may be exempt, so the counted existing area can be lower than the finished area." + (rs.key === "seattle-nr" ? " Since January 2026, ADU floor area counts toward FAR in Seattle NR zones." : "")]);
      } else { lines.push(["Floor area", esc(rs.floorCapLabel)]); }
      if (rs.coverage) {
        lines.push(["Lot coverage cap", fmt(rs.coverage) + " sf"]);
        if (v.footprint) { var left = rs.coverage - v.footprint; lines.push(["Footprint room left", left > 0 ? "About " + fmt(left) + " sf of new footprint" : "None at the ground floor as entered. Building up may still work."]); }
      }
      if (rs.impervious) {
        lines.push(["Impervious surface cap", fmt(rs.impervious) + " sf (all hard surfaces)" + (rs.imperviousMax ? "; up to " + fmt(rs.imperviousMax) + " sf with approved low impact development" : "")]);
        if (v.imperv != null) { var il = rs.impervious - v.imperv; lines.push(["Existing impervious (your entry)", fmt(v.imperv) + " sf"], ["Impervious room left", il > 0 ? "<strong>About " + fmt(il) + " sf</strong> at the base limit" + (rs.imperviousMax ? ", about " + fmt(rs.imperviousMax - v.imperv) + " sf at the maximum" : "") : "None at the base limit as entered" + (rs.imperviousMax && rs.imperviousMax > v.imperv ? "; about " + fmt(rs.imperviousMax - v.imperv) + " sf at the maximum with low impact development" : "") + "."]); }
        else lines.push(["Impervious room left", '<span class="bh-tbd">TBD.</span> Enter the existing impervious surface in step 2. It is not in the public records we can read.']);
      }
      if (!rs.floorCap && v.existing == null) lines.push(["Existing house size", '<span class="bh-tbd">TBD.</span> Enter the finished area from the assessor record in step 2.']);
      if (rs.sideNote) lines.push(["Side setback split", esc(rs.sideNote)]);
      var typeNote = {
        addition: "An addition keeps the existing foundation and grandfathered conditions where they comply. It must fit the room left under the caps above.",
        adu: "An ADU or detached ADU is often the largest gain on a lot that is near its house size cap, because ADU area is governed by its own size limit.",
        teardown: "A teardown resets the lot to current setbacks, height and caps. Size the new house to the full cap, not the room left over.",
        shop: "A shop can attach to the house (it then follows the house setbacks and adds to its footprint) or stand alone as an accessory building. Either way it counts toward impervious surface, and a vehicle door facing the street needs the driveway length the zone requires.",
        remodel: "An interior remodel inside the existing walls usually does not change floor area, coverage or setbacks. Permits still apply to structural, plumbing, electrical and mechanical work."
      }[v.type];
      lines.push(["For your project type", typeNote]);
      cap = '<table class="bh-table">' + lines.map(function (l) { return "<tr><th scope=\"row\">" + l[0] + "</th><td>" + l[1] + "</td></tr>"; }).join("") + "</table>";
    } else cap = '<p class="bh-verify">No capacity math without verified rules. Verify with the jurisdiction.</p>';
    out.push(page("Zoning review", "<h3>How much could you add?</h3>" + cap + redFlags(s, v, rs)));

    // Lot imagery and site plan
    var img = s.imagery ? '<figure class="bh-aerial"><div class="bh-aerial-frame"><img src="' + esc(s.imagery.url) + '" alt="Aerial photo of the parcel with the county parcel outline drawn on top" width="' + s.imagery.W + '" height="' + s.imagery.H + '" crossorigin="anonymous"><svg viewBox="0 0 ' + s.imagery.W + " " + s.imagery.H + '" aria-hidden="true"><path d="' + s.imagery.path + '" class="bh-outline"/></svg></div><figcaption>' + esc(s.imagery.credit) + ". Parcel outline: " + (/^Snohomish/.test(s.county) ? "Snohomish County Assessor parcels" : "King County GIS parcels") + ". Outlines are approximate and are not a survey. The photo uses a web map projection, so it is not to scale.</figcaption></figure>" : '<p class="bh-muted">No parcel outline was found, so no aerial view is shown.</p>';
    out.push(page("Existing lot", '<div class="bh-cols"><div>' + img + '</div><div><h3>Site plan diagram</h3>' + sitePlanSVG(s, rs) + '<p class="bh-muted">Diagrammatic only. Drawn from the county parcel outline. The shaded envelope is every point at least the required setback from each lot line. ' + (s.frontDir ? "The street side was set by hand in step 2." : "Which line is the front, side or rear is our guess from the address point; set the street side in step 2 if it is wrong.") + ' A licensed surveyor sets the real lines.</p></div></div>'));

    // Plans and permits
    var pm = "<h3>House plans and permit history</h3>";
    if (s.permits.length) pm += '<table class="bh-table"><thead><tr><th scope="col">Permit</th><th scope="col">Type</th><th scope="col">Description</th><th scope="col">Issued</th><th scope="col">Finaled</th></tr></thead><tbody>' + s.permits.slice(0, 12).map(function (p) { return "<tr><td>" + esc(p.id) + "</td><td>" + esc(p.type) + "</td><td>" + esc(p.desc) + "</td><td>" + esc(p.issued) + "</td><td>" + esc(p.final) + "</td></tr>"; }).join("") + "</tbody></table>";
    else pm += "<p>No permit records were found for this parcel in the public permit layers we can read from the browser" + (s.juris === "seattle" ? " (Seattle issued and finaled residential permits)" : s.juris === "sno" ? " (Snohomish County active permits)" : "") + ". That does not mean none exist; older records are often only on microfilm.</p>";
    pm += "<p><strong>Plan sets:</strong> We did not find published plan drawings for this address, and we do not draw or guess them. Approved plans are public records you can request from the permit office.</p>";
    if (s.permitLinks.length) pm += "<ul>" + s.permitLinks.map(function (l) { return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + "</a></li>"; }).join("") + "</ul>";
    out.push(page("Records", pm));

    // Next steps
    out.push(page("Next steps", '<ol class="bh-steps"><li><strong>Confirm the facts.</strong> Pull the assessor record, a title report and any recorded easements.</li><li><strong>Survey.</strong> A boundary and topographic survey fixes lot lines, grades and trees.</li><li><strong>Pre-application meeting.</strong> Ask the jurisdiction about the zone, critical areas, drainage and utilities.</li><li><strong>Consultants as needed.</strong> Structural engineer, geotechnical engineer for slopes or poor soils, civil engineer for drainage, arborist for protected trees, septic designer off sewer.</li><li><strong>Design and permit set.</strong> Plans, energy code forms and engineering go to the permit office.</li><li><strong>Bid and build.</strong> Compare bids on the same scope. <a href="./bid-comparison.html">How to compare bids</a>.</li></ol>' +
      '<div class="bh-cta"><h3>Talk to a local design-build pro</h3><p>See the firms the Board ranks for this kind of work, and how we rank them.</p><p><a class="bh-btn" href="./additions.html">Additions rankings</a> <a class="bh-btn" href="./custom-homes.html">Custom home rankings</a> <a class="bh-btn bh-btn-ghost" href="./how-we-rank.html">How we rank</a> <a class="bh-btn bh-btn-ghost" href="./permits.html">Permit resources</a></p></div>'));

    // Data sources
    out.push(page("Data sources", "<h3>What we read for this report</h3><ul>" + s.sources.map(function (x) { return "<li>" + (x.ok ? "Read live: " : "Did not answer: ") + esc(x.name) + (x.note ? " · " + esc(x.note) : "") + "</li>"; }).join("") + "</ul><h3>Rule sources</h3><ul>" + (rs ? rs.sources : []).map(function (x) { return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + "</a> (checked " + R.CHECKED + ")</li>"; }).join("") + "</ul>" + '<p class="bh-disclaimer"><strong>Planning estimate only.</strong> This is not a legal or zoning determination. Codes change; confirm with the jurisdiction and a licensed professional.</p>'));

    $("bh-report").innerHTML = out.join("");
    $("bh-report-wrap").hidden = false;
    $("bh-lead-address").value = s.matched || s.input;
  }

  function redFlags(s, v, rs) {
    var f = [];
    if (s.hazards.length) f.push("Mapped critical area or hazard on or touching the parcel: " + s.hazards.join(", ") + ". Expect a critical area review and possibly a geotechnical report.");
    if (v.type === "teardown") {
      f.push("A teardown needs a demolition permit, and utilities must be capped first.");
      f.push('An asbestos survey by a certified inspector is required before demolition in the Puget Sound region (<a href="' + R.SRC.pscaa.url + '" target="_blank" rel="noopener">Puget Sound Clean Air Agency</a>). Older houses can also have lead paint.');
      f.push("A new house loses any grandfathered setbacks or size the old one had.");
    }
    if (s.hazards.some(function (h) { return /1990/.test(h); }) && !s.hazards.some(function (h) { return /2016/.test(h); })) f.push("The older 1990 county maps flag this parcel but the 2016 landslide and steep slope maps do not. The city may still ask for a geotechnical report to settle it; budget for one.");
    if (s.nearNotices && s.nearNotices.length) f.push("A sensitive area notice is recorded on title for a neighboring parcel: " + esc(s.nearNotices.join("; ")) + ". That points to slope or erosion conditions next door, so expect the city to ask about this lot too.");
    if (s.juris === "kenmore") f.push("If any part of the lot is within 200 ft of Lake Washington or the Sammamish River, Kenmore's Shoreline Master Program applies (RCW 90.58), with its own setbacks and permits. The county shoreline layer we read covers unincorporated areas only, so verify with the city.");
    if (v.type === "shop") f.push("A shop near a slope or lot line may need retaining walls or engineered footings. Drainage from the new roof and driveway must be managed on site.");
    if (v.type === "addition" || v.type === "shop") f.push("An addition ties into old framing and foundations. Expect surprises in houses built before modern codes, and budget for engineering.");
    if (v.type === "addition" || v.type === "teardown" || v.type === "shop") f.push("Basements or deep footings close to a lot line can need shoring and neighbor coordination. Ask your engineer early.");
    if (s.yearBuilt && +s.yearBuilt < 1980) f.push("Built " + esc(s.yearBuilt) + ": plan for possible asbestos and lead paint testing before any demolition or remodel work.");
    if (rs && rs.floorCap && v.existing != null && v.existing >= rs.floorCap) f.push("The existing house is at or over the floor area cap as entered. Adding counted floor area may not be allowed. Below-grade space or a different unit count can change the cap, so ask the city.");
    if (!f.length) f.push("No red flags from the data we could read. That is not a clean bill; a site visit matters.");
    return "<h3>Red flags to check</h3><ul class=\"bh-flags\">" + f.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
  }

  /* ---------- budget calculator ---------- */
  function calc() {
    var g = function (id) { var x = parseFloat($(id).value); return isFinite(x) ? x : 0; };
    var price = g("fc-price"), cps = g("fc-cps"), sf = g("fc-sf"), arv = g("fc-arv"), months = g("fc-months"), rate = g("fc-rate") / 100, ltv = g("fc-ltv") / 100, sell = g("fc-sell") / 100, soft = g("fc-soft") / 100;
    var build = cps * sf, softC = build * soft, basis = price + build + softC;
    var loan = basis * ltv;
    var interest = loan * rate * months / 12; // simple interest on the full balance, a conservative shortcut
    var selling = arv * sell;
    var total = basis + interest + selling;
    var profit = arv - total;
    var cash = basis - loan + interest;
    var m = function (x) { return (x < 0 ? "-$" : "$") + fmt(Math.abs(x)); };
    $("fc-out").innerHTML = '<table class="bh-table"><tr><th scope="row">Construction (' + fmt(sf) + " sf x $" + fmt(cps) + ")</th><td>" + m(build) + '</td></tr><tr><th scope="row">Soft costs (' + (soft * 100).toFixed(0) + '%)</th><td>' + m(softC) + '</td></tr><tr><th scope="row">Loan amount</th><td>' + m(loan) + '</td></tr><tr><th scope="row">Interest over ' + months + ' months</th><td>' + m(interest) + '</td></tr><tr><th scope="row">Selling costs</th><td>' + m(selling) + '</td></tr><tr><th scope="row">All-in cost</th><td>' + m(total) + '</td></tr><tr class="bh-total"><th scope="row">Profit before tax</th><td>' + m(profit) + '</td></tr><tr><th scope="row">Margin on resale value</th><td>' + (arv ? (profit / arv * 100).toFixed(1) + "%" : "n/a") + '</td></tr><tr><th scope="row">Cash in (down payment plus interest)</th><td>' + m(cash) + "</td></tr></table>";
  }

  /* ---------- lead form ---------- */
  function lead(e) {
    e.preventDefault();
    var f = e.target;
    if (f.company_website && f.company_website.value) return;
    var body = ["Build-here report request", "Name: " + f.name.value, "Email: " + f.email.value, "Phone: " + f.phone.value, "Address: " + f.address.value, "Project type: " + $("bh-type").value, "Notes: " + f.note.value, "", "Sent from boardofprojectstewardship.com/build-here.html"].join("\n");
    window.location.href = "mailto:editorial@boardofprojectstewardship.com?subject=" + encodeURIComponent("Build-here question: " + f.address.value) + "&body=" + encodeURIComponent(body);
    $("bh-lead-status").textContent = "Your email app should open with the message filled in. Nothing is sent until you press send there.";
  }

  function setStatus(t) { $("bh-status").textContent = t; }

  function init() {
    $("bh-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var a = $("bh-address").value.trim();
      if (!a) { setStatus("Enter a street address with city and ZIP."); return; }
      $("bh-go").disabled = true;
      $("bh-report-wrap").hidden = true;
      lookup(a).then(function (s) {
        state = s; $("bh-go").disabled = false;
        if (!s.matched) { setStatus("We could not match that address. Check the spelling and include the city and ZIP."); return; }
        fillForm(s);
        setStatus(s.juris === "other" ? "Found it in " + s.jurisLabel + ". This tool does not cover that city yet; check with your city. You can still read the parcel data below." : "Found " + s.matched + ". Check the values below, then build the report.");
        render();
      });
    });
    $("bh-confirm-form").addEventListener("submit", function (e) { e.preventDefault(); if (state) { render(); $("bh-report").focus(); } });
    $("bh-print").addEventListener("click", function () { window.print(); });
    ["fc-price", "fc-cps", "fc-sf", "fc-arv", "fc-months", "fc-rate", "fc-ltv", "fc-sell", "fc-soft"].forEach(function (id) { $(id).addEventListener("input", calc); });
    $("bh-lead").addEventListener("submit", lead);
    calc();
    var p = new URLSearchParams(location.search).get("address");
    if (p) { $("bh-address").value = p; $("bh-go").click(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.BuildHere = { polyAreaSqft: polyAreaSqft, minRect: minRect, classifyEdges: classifyEdges, envelopeRows: envelopeRows };
})();
