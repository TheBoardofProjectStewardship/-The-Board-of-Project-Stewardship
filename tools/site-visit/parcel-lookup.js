/* BOPS parcel lookup — free, keyless public county GIS (King + Snohomish, WA).
 * Works in browsers (all endpoints return Access-Control-Allow-Origin) and Node 18+ (global fetch).
 * Every value comes from a live response; anything not returned is null ("unknown"). */
(function (root) {
  const KC = 'https://gismaps.kingcounty.gov/arcgis/rest/services';
  const SNO_SAS = 'https://gis.snoco.org/sas/rest/services/SAS_Services';
  const SNO_H = 'https://gis.snoco.org/host/rest/services/Hosted';
  const SEA_ZONE = 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0';
  const GEOCODER = KC + '/Address/FourCounty_locator/GeocodeServer/findAddressCandidates'; // King, Snohomish, Pierce, Kitsap
  const TIMEOUT = 8000;

  async function getJSON(url, ms = TIMEOUT) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); if (j.error) throw new Error(j.error.message || 'ArcGIS error'); return j;
    } finally { clearTimeout(t); }
  }
  const pt = (x, y) => new URLSearchParams({ geometry: x + ',' + y, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'false', f: 'json' }).toString();
  async function hit(layer, x, y) { // -> {attrs|null, url} ; throws on network failure
    const url = layer + '/query?' + pt(x, y); const j = await getJSON(url);
    return { attrs: j.features && j.features[0] ? j.features[0].attributes : null, url };
  }
  const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);

  async function geocode(address) {
    const url = GEOCODER + '?' + new URLSearchParams({ SingleLine: address, outSR: '4326', maxLocations: '1', f: 'json' });
    const j = await getJSON(url); const c = j.candidates && j.candidates[0];
    if (!c || c.score < 80) return null;
    return { x: c.location.x, y: c.location.y, matched: c.address, score: c.score, url };
  }

  async function lookupParcel(address) {
    const out = { address, matchedAddress: null, county: null, pin: null, lotSqft: null, lotAcres: null,
      zoning: null, zoningSource: null, bldgSqft: null, yearBuilt: null, landVal: null, imprVal: null, totalVal: null,
      city: null, parcelAddress: null, links: {},
      flags: { flood: null, wetland: null, steepSlope: null, landslide: null }, // true/false/null(unknown)
      sources: [], errors: [] };
    let g; try { g = await geocode(address); } catch (e) { out.errors.push('geocode: ' + e.message); return out; }
    if (!g) { out.errors.push('geocode: no confident match'); return out; }
    out.matchedAddress = g.matched; out.sources.push(g.url);
    const { x, y } = g;
    const safe = async (label, layer) => { try { const r = await hit(layer, x, y); out.sources.push(r.url); return r.attrs; }
      catch (e) { out.errors.push(label + ': ' + e.message); return undefined; } }; // undefined = failed, null = no feature
    const flag = v => v === undefined ? null : !!v;

    // Try King first; fall back to Snohomish.
    const kc = await safe('KC parcel', KC + '/Property/KingCo_PropertyInfo/MapServer/2');
    if (kc) {
      out.county = 'King'; out.pin = kc.PIN; out.lotSqft = num(kc.LOTSQFT); out.lotAcres = num(kc.KCA_ACRES);
      out.landVal = num(kc.APPRLNDVAL); out.imprVal = num(kc.APPR_IMPR);
      out.totalVal = (out.landVal != null && out.imprVal != null) ? out.landVal + out.imprVal : null;
      out.city = kc.CTYNAME || null; out.parcelAddress = kc.ADDR_FULL || null;
      if (kc.KCA_ZONING && kc.KCA_ZONING.trim()) { out.zoning = kc.KCA_ZONING.trim(); out.zoningSource = 'King County Assessor (KCA_ZONING)'; }
      out.links.assessor = 'https://blue.kingcounty.com/Assessor/eRealProperty/Detail.aspx?ParcelNbr=' + kc.PIN;
      const [sea, uninc, ls, ss, wet, fl] = await Promise.all([
        (kc.CTYNAME || '').toLowerCase() === 'seattle' ? safe('Seattle zoning', SEA_ZONE) : Promise.resolve(null),
        safe('KC zoning', KC + '/Planning/KingCo_Zoning/MapServer/1'),
        safe('KC landslide', KC + '/Environment/KingCo_SensitiveAreas/MapServer/1'),
        safe('KC steep slope', KC + '/Environment/KingCo_SensitiveAreas/MapServer/4'),
        safe('KC wetland NWI', KC + '/Environment/KingCo_SensitiveAreas/MapServer/22'),
        safe('KC FEMA 100yr', KC + '/Hydro/KingCo_flood_info/MapServer/13')]);
      if (sea) { out.zoning = sea.ZONING; out.zoningSource = 'City of Seattle zoning (' + (sea.ZONING_DESC || '') + ')'; }
      else if (uninc && uninc.CURRZONE) { out.zoning = uninc.CURRZONE; out.zoningSource = 'King County zoning (unincorporated)'; }
      out.flags = { flood: flag(fl), wetland: flag(wet), steepSlope: flag(ss), landslide: flag(ls) };
      return out;
    }
    const sn = await safe('Snohomish parcel', SNO_SAS + '/SAS_Parcel_Query/MapServer/0');
    if (sn) {
      out.county = 'Snohomish'; out.pin = sn.PARCEL_ID; out.lotAcres = num(sn.Acres_Gross);
      out.lotSqft = out.lotAcres != null ? Math.round(out.lotAcres * 43560) : null; // derived from Acres_Gross (2 decimals)
      out.lotSqftDerived = true; out.totalVal = num(sn.Total_Value_Regular);
      out.city = sn.Site_City || null; out.parcelAddress = sn.Site_Address || null;
      out.links.assessor = sn.Property_Account_Summary || null; out.links.parcelMapPdf = sn.PDF_Parcel_Map || null;
      const [z, ss, wet, fl, ls] = await Promise.all([
        safe('Snohomish zoning', SNO_H + '/PLANNING__zoning/FeatureServer/0'),
        safe('Snohomish steep slope', SNO_SAS + '/SAS_Steep_Slopes/MapServer/0'),
        safe('Snohomish wetlands', SNO_H + '/ENVIRONMENTAL__wetlands/FeatureServer/0'),
        safe('Snohomish FEMA flood', SNO_H + '/ENVIRONMENTAL__fema_flood/FeatureServer/1'),
        safe('WA DNR landslides', SNO_H + '/ENVIRONMENTAL__WADNR_Landslides/FeatureServer/0')]);
      if (z && z.abbrev && z.abbrev !== 'CITY') { out.zoning = z.abbrev; out.zoningSource = 'Snohomish County zoning (unincorporated): ' + (z.label || ''); }
      else if (z) { out.zoningSource = 'Inside city limits — city zoning not available from county layer'; }
      out.flags = { flood: fl === undefined ? null : !!(fl && fl.sfha === 'yes'), wetland: flag(wet), steepSlope: flag(ss), landslide: flag(ls) };
      if (fl && fl.fld_zone) out.floodZone = fl.fld_zone.trim();
      return out;
    }
    out.errors.push('No parcel found in King or Snohomish layers');
    return out;
  }
  const api = { lookupParcel, geocode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BOPSParcel = api;
})(typeof window !== 'undefined' ? window : globalThis);
