/* The two-page summary at the front of the study, and the facts both pages are drawn from.
   Page 1 (SP-1) is the site plan sheet in build-here-siteplan.js. Page 2 (F-1) is the facts sheet here:
   Building, Remodel, Landscaping and Roofing. The full report follows them and is not shortened.

   Rules this file keeps:
   - Every row is a fact about this property or a labeled estimate. No row is a link with nothing beside it.
   - A value that is not in public data reads "not in public data - verify" in orange. It is never 0.
   - A total that lacks a part reads "≥ N sf", and the room left under a cap then reads "≤ N sf".
   - Roof area comes only from a mapped roof or footprint outline, never from living area.
   - A code value that was not confirmed carries "verify". Sources are numbered footnotes.
   - No owner name is read or shown.
   Runs in the browser (window.BuildHereSummary) and in Node (module.exports). */
(function (root) {
  "use strict";
  function isNum(x) { return typeof x === "number" && isFinite(x); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US"); }
  function r10(n) { return Math.round(n / 10) * 10; }
  function title(t) { return String(t || "").toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); }
  function cap1(t) { t = String(t || ""); return t.charAt(0).toUpperCase() + t.slice(1); }
  function httpUrl(u) { u = String(u == null ? "" : u).trim(); return /^https?:\/\//i.test(u) ? u : ""; }
  var MISSING = "not in public data, verify";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dateText(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? MONTHS[+m[2] - 1] + " " + (+m[3]) + ", " + m[1] : String(iso || ""); }
  function zoneNameOf(rs) { return rs && rs.title ? String(rs.title).replace(/^[^,]*,\s*/, "").replace(/\s*\([^)]*\)\s*$/, "") : ""; }
  function shortSrc(t) {
    t = String(t || "");
    return /OpenStreetMap/.test(t) ? "OpenStreetMap" : /Microsoft/.test(t) ? "Microsoft map" : /Snohomish County roof/.test(t) ? "county" : /Seattle building outlines/.test(t) ? "city outline" : /impervious/i.test(t) ? "city 2015 mapping" : /King County building/.test(t) ? "county outline" : "";
  }

  /* ---------- the facts ---------- */
  /* s: the study state. v: the figures on the page (lot, zone, existing, stories, type). rs: BuildHereRules.pick()
     or null. ctx: the study context (effective figures, options, cards). cfg: { brand: { name, tagline, phone,
     email, site, services, license, logoUrl } }. M: the site plan model, when a lot outline was found. */
  function facts(s, v, rs, ctx, cfg, M) {
    s = s || {}; v = v || {}; cfg = cfg || {};
    var R = root.BuildHereRules, eff = (ctx && ctx.effective) || {}, land = s.landscape || {}, F = {};
    var site = rs && rs.site ? rs.site : (R && R.siteRules ? R.siteRules({ juris: s.juris, city: s.cityKey }, rs) : {});
    var wa = !s.stateAbbr || s.stateAbbr === "WA", king = wa && /^King/.test(s.county || ""), sno = wa && /^Snohomish/.test(s.county || "");
    F.brand = cfg.brand || {};
    F.address = s.matched || s.input || ""; F.parcel = s.parcel ? String(s.parcel) : ""; F.assessorUrl = httpUrl(s.assessorUrl);
    F.parcelMatch = s.parcelMatch || (land.matchedBy === "location" ? "nearest" : "");
    var sv = land.survey;
    F.plat = sv && sv.plat ? { name: title(sv.plat), lot: sv.lot || "", block: sv.block || "" } : null;
    F.jurisLabel = s.jurisLabel || ""; F.juris = s.juris || ""; F.city = s.city || ""; F.county = s.county || ""; F.stateAbbr = s.stateAbbr || "";
    F.king = king; F.sno = sno;
    F.place = site.place && site.place !== "this jurisdiction" ? site.place : (s.city ? "the City of " + s.city : s.county ? "unincorporated " + s.county : "the jurisdiction");
    F.placeShort = s.city || String(s.county || "").replace(/ County$/, "");
    F.incorporated = !!s.city;
    var parts = String(s.matched || "").split(","), mail = parts.length >= 3 ? title(parts[1].trim()) : "";
    F.mailCity = mail && mail.toLowerCase() !== String(s.city || "").toLowerCase() ? mail : "";
    F.jurisSrc = king ? "King County parcel record (city name field)" : sno ? "Snohomish County city limits layer" : "US Census geocoder";
    F.zone = v.zone || ""; F.zoneTyped = !!v.zone && v.zone !== (s.zone || ""); F.zoneSrc = F.zoneTyped ? "Typed on this page" : (s.zoneSrc || "");
    F.zoneName = F.zoneTyped && !rs ? "" : zoneNameOf(rs); F.overlay = rs && rs.overlay ? rs.overlay : ""; F.zoneDraft = !!s.zoneDraft && !F.zoneTyped;
    F.coded = !!(rs && rs.coded !== false && !rs.assumed && rs.residential !== false && !rs.unrecognized); F.rs = rs || null; F.site = site;
    F.wa = wa; F.residential = !rs || (rs.residential !== false && !rs.unrecognized); F.nonres = !!(rs && rs.residential === false); F.unrecognized = !!(rs && rs.unrecognized); F.blank = !!(rs && rs.blank);
    var lotTyped = isNum(v.lot) && (s.lot == null || Number(v.lot) !== Number(s.lot));
    F.lot = { sf: isNum(v.lot) ? v.lot : null, kind: !isNum(v.lot) ? null : lotTyped ? "typed" : s.lotKind === "record" ? "record" : "outline", gisSf: !lotTyped && s.lotKind === "record" && land.lot && isNum(land.lot.outlineSf) ? land.lot.outlineSf : null, src: lotTyped ? "Typed on this page" : (s.lotSrc || "") };
    var livTyped = isNum(v.existing) && (s.existing == null || Number(v.existing) !== Number(s.existing));
    if (isNum(eff.living)) F.living = { sf: eff.living, label: F.nonres ? (livTyped ? "Existing floor area (your entry)" : "Existing floor area (assessor)") : (livTyped ? "Existing finished living (your entry)" : "Existing finished living (assessor)"), est: false, src: livTyped ? "Typed on this page" : (s.existingSrc || "Assessor record") };
    else if (isNum(eff.countyFinSize)) F.living = { sf: eff.countyFinSize, label: (F.nonres ? "Building size (county record)" : "House size (county record)"), est: true, finSize: true, src: s.countyFinSrc || "County improvement records, finished-size column" };
    else F.living = null;
    F.firstFloor = isNum(s.firstFloor) ? s.firstFloor : null; F.basementTotal = isNum(s.basementTotal) ? s.basementTotal : null; F.basementFinished = isNum(s.basementFinished) ? s.basementFinished : null;
    F.garageAtt = isNum(s.garageFloor) ? s.garageFloor : null; F.garageBsmt = isNum(s.basementGarage) ? s.basementGarage : null; F.garageDet = isNum(s.detGarageFloor) ? s.detGarageFloor : null;
    F.garageNone = !!s.garageNone; F.basementNone = !!s.basementNone; F.deck = isNum(s.deck) ? s.deck : null; F.beds = isNum(s.beds) ? s.beds : null; F.baths = isNum(s.baths) ? s.baths : null; F.yearRenov = s.yrRenov ? String(s.yrRenov) : "";
    F.recordSrc = s.existingSrc || s.countyFinSrc || "";
    F.yearBuilt = s.yearBuilt ? String(s.yearBuilt) : ""; F.yearSrc = s.yearSrc || ""; F.years = s.years || [];
    var stN = parseFloat(v.stories);
    F.storiesNum = isFinite(stN) && stN > 0 ? stN : null; F.stories = F.storiesNum ? String(F.storiesNum) : ""; F.storiesSrc = s.storiesSrc || "";
    F.height = rs && rs.height ? { ft: isNum(rs.height.ft) ? rs.height.ft : null, text: rs.height.text || "", verify: !!rs.heightVerify } : {};
    F.sb = rs && rs.setbacks ? rs.setbacks : {}; F.sbVerify = !!(rs && rs.setbackVerify); F.sbSrc = rs && rs.setbackSrc ? rs.setbackSrc.label : (rs && rs.sources && rs.sources[0] ? rs.sources[0].label : "");
    var lot = F.lot.sf, pc = function (cap) { return isNum(cap) && isNum(lot) && lot > 0 ? Math.round(cap / lot * 100) : null; };
    F.caps = rs ? { coverage: isNum(rs.coverage) ? rs.coverage : null, coveragePct: pc(rs.coverage), impervious: isNum(rs.impervious) ? rs.impervious : null, imperviousPct: pc(rs.impervious), imperviousMax: isNum(rs.imperviousMax) ? rs.imperviousMax : null, floorCap: isNum(rs.floorCap) ? rs.floorCap : null, floorCapLabel: rs.floorCapLabel || "", farNone: !!rs.farNone, covNone: !!rs.covNone, impNone: !!rs.impNone } : {};
    F.gfaVerify = !!(rs && rs.accounting && rs.accounting.verify); F.accounting = rs && rs.accounting ? rs.accounting : null;
    F.codeSrc = rs && rs.sources && rs.sources[0] ? rs.sources[0].label + ", checked " + (R ? R.CHECKED : "") : "";
    F.eff = eff; F.options = (ctx && ctx.options) || []; F.cards = (ctx && ctx.cards) || [];
    F.slope = land.slope || null; F.steep = land.steep || null; F.rows = land.rows || [];
    if (F.nonres) F.rows.forEach(function (r) { if (r && /House footprint/i.test(r.label || "")) r.label = String(r.label).replace(/House footprint/gi, "Building footprint"); });
    F.assumed = !!(rs && rs.assumed);
    F.srcShort = { buildings: shortSrc(land.geo && land.geo.src && land.geo.src.buildings || s.footprintSrc) };
    F.footprintSrc = s.footprintSrc || "";
    F.drainage = site.drainage || null;
    if (F.drainage && F.drainage.v) F.drainage = { v: F.drainage.v, short: /2,000 sf/.test(F.drainage.v) ? "2,000 sf new + replaced hard surface (verify)" : /750 sf/.test(F.drainage.v) ? "2026 code not coded (was 750 sf), verify" : "", checked: F.drainage.checked, src: F.drainage.src, note: F.drainage.note };
    F.prepared = (ctx && ctx.prepared) || s.prepared || ""; F.preparedText = dateText(F.prepared);
    F.energy = function (kind, sf) {
      if (!R || !R.energyCredits || !wa || !isNum(sf) || sf <= 0 || kind === "remodel" || kind === "shop") return null;
      return R.energyCredits(kind === "addition" || kind === "secondStory" ? "addition" : "new", sf, F.prepared);
    };
    F.hazards = s.hazards || []; F.hazardNotes = s.hazardNotes || []; F.hazardSource = s.hazardSource || ""; F.hazardScope = s.hazardScope || (s.rings ? "parcel" : "point"); F.nearNotices = s.nearNotices || []; F.shoreline = s.shoreline || "";
    F.permits = s.permits || []; F.permitSearch = s.permitSearch || "none";
    F.soils = s.soils || null; F.flood = s.flood || null;
    F.imageryCredit = s.imagery && s.imagery.credit ? s.imagery.credit : "";
    F.type = v.type || "addition"; F.isSample = !!s.isSample; F.listingFacts = s.listingFacts || null;
    // From the drawing: frontage, corner, alley, envelope, what was mapped.
    F.hasLot = !!(M && M.ok);
    F.frontage = M && M.ok && M.ce && isNum(M.ce.frontage) ? M.ce.frontage : null; F.corner = !!(M && M.ok && M.corner); F.alley = !!(M && M.ok && M.ce && M.ce.alley); F.through = !!(M && M.ok && M.ce && M.ce.through);
    F.frontStreet = M && M.ok && M.ce && M.ce.frontStreet ? M.ce.frontStreet : ""; F.frontByName = !!(M && M.ok && M.ce && M.ce.byName);
    F.envArea = M && M.ok && M.env ? M.env.area : null; F.sbKnown = !!(M && M.ok && M.sbKnown);
    F.sidewalk = M && M.ok && M.hasGeo ? M.sidewalks.length > 0 : null; F.treesMapped = M && M.ok && M.hasGeo ? M.trees.length : null; F.osmRead = !!(land.osmUsed || (M && M.ok && M.streets && M.streets.length));
    F.houseDist = M && M.ok ? M.houseDist : null;
    var srcs = [king ? "King County GIS & Assessor" : sno ? "Snohomish County GIS & Assessor" : "public parcel layers"];
    if (F.slope && F.slope.ok) srcs.push("USGS 3DEP");
    if (F.osmRead) srcs.push("OpenStreetMap");
    F.sourceLine = srcs.join(", ");
    return F;
  }

  /* ---------- the four blocks ---------- */
  function capLine(F, cap, pct, none, used, usedPartial, room, usedWhat, missingWhat) {
    var place = F.place;
    if (!isNum(cap)) return { v: none ? "No cap of this kind in this zone." : (F.coded ? "not coded for this zone, verify with " + place : "zone not coded, verify with " + place), s: none ? "fact" : "verify" };
    var t = "Cap " + fmt(cap) + " sf" + (isNum(pct) ? " (" + pct + "% of the lot)" : "");
    if (!isNum(used)) return { v: t + " · existing: " + usedWhat + " " + MISSING, s: "missing" };
    t += " · existing " + (usedPartial ? "≥ " : "≈ ") + fmt(used) + " sf" + (usedPartial && missingWhat ? " (" + missingWhat + " not measured)" : "");
    if (isNum(room)) t += room > 0 ? " · room left " + (usedPartial ? "≤ " : "≈ ") + fmt(room) + " sf" : " · at or over the cap as read";
    return { v: t, s: usedPartial ? "partial" : "est" };
  }
  function optOf(F, kind) { for (var i = 0; i < F.options.length; i++) if (F.options[i].id === kind || F.options[i].kind === kind) return F.options[i]; return null; }
  function optText(o) {
    if (!o) return null;
    // A size that fits the caps with no setback envelope to place it in is a size only, and stays in orange.
    if (o.feasible === true) return { v: (o.placement === "unchecked" ? "The size fits the limits as read: " : "Fits the limits as read: ") + (isNum(o.gfaSf) && o.gfaSf > 0 ? "≈ " + fmt(o.gfaSf) + " sf" : "no new floor area") + (o.levels > 1 ? " on " + o.levels + " levels" : "") + (isNum(o.footprintSf) && o.footprintSf > 0 ? " (" + fmt(o.footprintSf) + " sf footprint)" : "") + "." + (o.notes && o.notes.length ? " " + o.notes.join(" ") : ""), s: o.placement === "unchecked" ? "verify" : "est" };
    if (o.feasible === false) return { v: "Does not fit the limits as read. " + (o.why || ""), s: "partial" };
    return { v: o.why || "The limits for this zone are not coded, so this is not judged, verify.", s: "verify" };
  }
  function datumRow(d, place, what) {
    if (d && d.v) return { v: d.v + (d.checked ? "" : " (verify)"), s: d.checked ? "fact" : "verify", src: d.src ? d.src.label + (d.checked ? ", checked " + d.checked : "") : "" };
    return { v: (d && d.note ? d.note : what + " for " + place + " is not coded.") + " Verify with " + place + ".", s: "verify", src: "" };
  }
  /* Returns { building, remodel, landscaping, roofing: [{ key, k, v, s, fn: [n] }], visit: { items, text }, notes: [{ n, label, url }] } */
  function blocks(F) {
    var notes = [], noteIdx = {}, out = { building: [], remodel: [], landscaping: [], roofing: [] }, eff = F.eff || {}, caps = F.caps || {}, place = F.place, rs = F.rs, site = F.site || {};
    function note(label, url) {
      label = String(label || "").replace(/\s+/g, " ").trim();
      if (!label) return null;
      if (!noteIdx[label]) { notes.push({ n: notes.length + 1, label: label, url: httpUrl(url) }); noteIdx[label] = notes.length; }
      return noteIdx[label];
    }
    function add(block, key, k, v, s, srcs) {
      var fn = [];
      (srcs || []).forEach(function (x) { var n = x && typeof x === "object" ? note(x.label, x.url) : note(x); if (n && fn.indexOf(n) < 0) fn.push(n); });
      out[block].push({ key: key, k: k, v: v, s: s || "fact", fn: fn });
    }
    var codeSrc = rs && rs.sources && rs.sources[0] ? { label: rs.sources[0].label + ", checked " + (root.BuildHereRules ? root.BuildHereRules.CHECKED : ""), url: rs.sources[0].url } : null;
    var notCoded = (F.coded ? "not coded for this zone" : "zone not coded") + ", verify with " + place;

    /* ---- Building ---- */
    var B = "building";
    add(B, "zone", "Zone", F.zone ? F.zone + (F.zoneName && String(F.zoneName).toUpperCase() !== String(F.zone).toUpperCase() ? " · " + F.zoneName : "") + (F.overlay ? " · overlay " + F.overlay + " (its added rules are not coded, verify)" : "") + (F.zoneTyped ? " (your entry)" : "") + (F.zoneDraft ? ", read from a draft city zoning layer, confirm with the city" : "") : "not found in public data, enter the zone from the zoning map", !F.zone ? "missing" : (F.zoneDraft || F.overlay) ? "verify" : "fact", [F.zoneSrc]);
    var chapter = (rs && rs.sources || []).filter(function (s) { return s && s.url && /23\.\d+|ECDC\/16/.test(s.url); })[0];
    if (F.nonres && chapter) add(B, "chapter", "Code chapter", chapter.label || "Zoning code", "fact", [chapter]);
    add(B, "juris", "Jurisdiction", (F.incorporated ? "Inside the City of " + F.city + (F.county ? ", " + F.county : "") : F.county ? "Unincorporated " + F.county + " (urban growth area not checked)" : "not matched") + (F.mailCity ? ". The mailing address says " + F.mailCity + "; permits follow the jurisdiction, not the mailing city" : ""), F.county ? "fact" : "missing", [F.jurisSrc]);
    var H = F.height || {};
    var heightLine = H.text || notCoded;
    if (isNum(H.ft)) {
      var bare = H.ft + " ft", extra = String(H.text || "").replace(/\s+/g, " ").trim();
      heightLine = !extra || extra === bare || extra.indexOf(bare) === 0 ? (extra || bare) : bare + " · " + extra;
      if (H.verify && heightLine.indexOf("(verify)") < 0) heightLine += " (verify)";
    }
    add(B, "height", "Height limit", heightLine, isNum(H.ft) ? (H.verify ? "verify" : "fact") : (H.text ? "fact" : "verify"), [codeSrc]);
    var fPartial = !!(eff.floorMissing && eff.floorMissing.length), fl;
    if (caps.farNone) fl = { v: "No floor-area ratio in this zone. Height, lot coverage and setbacks set the size.", s: "fact" };
    else { fl = capLine(F, caps.floorCap, null, false, eff.floorUsed, fPartial, eff.roomFar, "living area", (eff.floorMissing || []).join(", ")); if (isNum(caps.floorCap) && caps.floorCapLabel) fl.v = fl.v.replace(/^Cap [\d,]+ sf/, "Cap " + fmt(caps.floorCap) + " sf (" + caps.floorCapLabel + ")"); }
    var acct = F.accounting && F.accounting.note && isNum(caps.floorCap) ? String(F.accounting.note).split(/\.\s+/) : [];
    add(B, "far", "Floor area limit", fl.v + (acct.length ? ". " + acct[acct.length - 1].replace(/\.$/, "") + "." : ""), F.gfaVerify && fl.s !== "missing" && !caps.farNone ? "verify" : fl.s, [codeSrc, F.living ? F.living.src : ""]);
    var cv = capLine(F, caps.coverage, caps.coveragePct, caps.covNone, eff.buildings, false, eff.roomCov, "building outline", "");
    add(B, "coverage", "Lot coverage", cv.v, cv.s, [codeSrc, F.footprintSrc]);
    var impUsed = isNum(eff.impervious) ? eff.impervious : (isNum(eff.impKnown) ? eff.impKnown : null), impPartial = !isNum(eff.impervious);
    var im = capLine(F, caps.impervious, caps.imperviousPct, caps.impNone, impUsed, impPartial, isNum(eff.roomImp) ? eff.roomImp : (isNum(caps.impervious) && isNum(impUsed) ? caps.impervious - impUsed : null), "hard surface", (eff.impMissing || []).join(", "));
    add(B, "impervious", "Impervious surface", im.v, im.s, [codeSrc]);
    var sb = F.sb, sbBits = [];
    if (isNum(sb.front)) sbBits.push("front " + sb.front);
    if (isNum(sb.streetSide) && F.corner) sbBits.push("street side " + sb.streetSide);
    if (isNum(sb.side)) sbBits.push("side " + sb.side + (isNum(sb.sideCombined) ? " (" + sb.sideCombined + " both)" : ""));
    if (isNum(sb.rear)) sbBits.push("rear " + sb.rear + (F.alley && isNum(sb.rearAlley) ? " (" + sb.rearAlley + " on the alley)" : ""));
    add(B, "setbacks", "Setbacks and buildable area", sbBits.length ? cap1(sbBits.join(" · ")) + " ft" + (F.sbVerify ? " (verify)" : "") + (isNum(F.envArea) ? " · ≈ " + fmt(r10(F.envArea)) + " sf inside the setbacks" : F.hasLot && !F.sbKnown ? " · the rest are not coded, so no buildable area is drawn" : "") : "Setbacks " + notCoded, sbBits.length ? (F.sbVerify || !F.sbKnown ? "verify" : "est") : "verify", [F.sbSrc || codeSrc]);
    var oa = optOf(F, "addition"), ta = optText(oa);
    add(B, "addition", oa && oa.kind === "secondStory" ? "Addition (upward)" : "Addition", ta ? ta.v : "Not judged: the option study did not run.", ta ? ta.s : "verify", [codeSrc]);
    var room = eff.roomFar;
    if (F.residential) add(B, "secondStory", "Second story", (isNum(H.ft) ? "Height limit " + H.ft + " ft" + (H.verify ? " (verify)" : "") : "Height limit " + notCoded) + "; " + (F.stories ? F.stories + (F.storiesNum === 1 ? " story" : " stories") + (F.storiesSrc ? " on record" : " as entered") : "stories are not on record") + "; " + (caps.farNone ? "no floor-area cap applies" : isNum(room) ? (room > 0 ? "floor-area room " + (fPartial ? "≤ " : "≈ ") + fmt(room) + " sf" : "no floor-area room left as read") : "floor-area room not known") + ". Whether the framing and foundation can carry another level is checked on site.", "est", [codeSrc]);
    var adu = rs && rs.adu ? rs.adu : null, od = optOf(F, "adu"), td = optText(od);
    if (!F.nonres) {
      var aduHas = !!(adu && adu.text);
      var aduBody = aduHas ? String(adu.text).replace(/[.\s]+$/, "") : "";
      var aduLead = aduHas ? aduBody + (adu.status === "state" ? " (state-law floor; the local size limit is not applied, verify)" : adu.status === "verify" ? " (verify)" : "") + ". " : "ADU rules " + notCoded + ". ";
      var aduFit = td && !(!aduHas && /not coded/i.test(td.v)) ? td.v : ""; // do not say "not coded" twice
      add(B, "adu", "ADU / detached ADU", aduLead + aduFit + (adu && adu.status !== "verify" ? " State law caps an ADU's impact fees at half of a house's." : ""), adu && adu.status === "coded" && !adu.partial ? (td ? td.s : "fact") : "verify", [adu && adu.src ? adu.src : codeSrc, site.aduState && site.aduState.src ? site.aduState.src : null]);
    }
    var on = optOf(F, "teardown"), tn = optText(on);
    if (!F.nonres) add(B, "newHouse", "New house (teardown)", tn ? tn.v + " A new house loses any grandfathered setbacks or size." : "Not judged.", tn ? tn.s : "verify", [codeSrc]);
    var units = null;
    (rs && rs.rules || []).forEach(function (r) { if (!units && /^Units per lot|^Middle housing/i.test(r.label) && r.value) units = r; });
    add(B, "units", "Units per lot", units ? units.value + (units.note ? " " + String(units.note).replace(/\s*Ask the city.*$/, "") : "") : "Unit count " + notCoded, units ? "fact" : "verify", [units && units.src ? units.src : codeSrc]);
    if (F.wa) {
      var pk = datumRow(site.parking, place, "The parking table");
      if (site.parking && site.parking.v && /ESSB 5184/.test(site.parking.v)) pk.v = "State law (ESSB 5184, 2025) caps what a city over 30,000 people may require: 1 space per house, half a space per multifamily unit, none for a home under 1,200 sf. The local parking table is not applied. Confirm it with " + place + ".";
      add(B, "parking", "Parking", pk.v, site.parking && site.parking.v && /ESSB 5184/.test(site.parking.v) ? "verify" : pk.s, [pk.src]);
    }
    var en = [], enSrc = null, enState = "fact";
    [["addition", oa], ["new house", on], ["detached ADU", od]].forEach(function (p) {
      if (!p[1] || !isNum(p[1].gfaSf) || p[1].gfaSf <= 0) return;
      var e = F.energy(p[0] === "addition" ? "addition" : "teardown", p[1].gfaSf);
      if (!e || !e.text) return;
      if (e.credits == null) { if (!en.length) en.push(e.text); enState = "verify"; }
      else en.push(p[0] + " ≈ " + fmt(p[1].gfaSf) + " sf: " + (e.credits === 0 ? "exempt" : e.credits.toFixed(1) + " credits") + (p[0] !== "addition" && e.credits === 5 ? " (8.0 with 300 sf or more of window area)" : "") + (e.state !== "fact" ? " (verify)" : ""));
      if (e.state !== "fact") enState = "verify";
      enSrc = e.src;
    });
    if (F.wa) add(B, "energy", "Energy code credits", en.length ? (enState === "verify" && en.length === 1 && !/credits|exempt/.test(en[0]) ? String(en[0]).replace(/[.\s]+$/, "") : "2021 energy code (WSEC-R; the 2024 code starts May 3, 2027). " + cap1(en.join("; "))) + "." : "No option size to rate.", en.length ? enState : "verify", [enSrc]);
    var permitCity = rs && rs.city && typeof rs.city.name === "string" && rs.city.name && rs.city.name !== "undefined" ? rs.city.name : "";
    add(B, "permits", "Permit path", "Building permit and plan review by " + place + (F.nonres ? " for work on this building" : F.residential ? " for an addition, ADU or new house" : "") + ", plus trade permits (electrical, plumbing, mechanical). Review time for the scope is confirmed with the permit office.", "fact", [permitCity ? { label: "City of " + permitCity + " permits and planning", url: rs.city.home } : null]);
    var fr = [];
    if (F.frontStreet) fr.push("Front on " + title(F.frontStreet) + (F.frontByName ? "" : " (nearest street; confirm)"));
    if (isNum(F.frontage)) fr.push("≈ " + Math.round(F.frontage) + " ft of street frontage");
    if (F.corner) fr.push("corner lot");
    if (F.alley) fr.push("alley on one line");
    if (F.through) fr.push("street behind the lot as well");
    if (isNum(F.frontage) && F.frontage < 25) fr.push("narrow frontage: fire access can call for sprinklers or a wider driveway");
    add(B, "frontage", "Frontage and access", fr.length ? fr.join(" · ") + ". From mapped parcel lines, not a survey." : (F.hasLot ? "Front line not identified from the parcel lines, verify." : "No parcel outline, so frontage was not read."), fr.length ? "est" : "missing", ["County parcel outline", F.osmRead ? "OpenStreetMap (street names, alleys)" : ""]);
    add(B, "plat", "Plat and covenants", F.plat ? F.plat.name + (F.plat.lot ? ", lot " + F.plat.lot : "") + (F.plat.block ? ", block " + F.plat.block : "") + " (county record). Recorded covenants can limit what is built; they are on the title report." : "No plat name on the public parcel record read. Recorded covenants and easements are on the title report.", F.plat ? "fact" : "missing", [F.plat ? "King County parcel record (plat name)" : ""]);
    var cost = [];
    if (F.slope && F.slope.ok && (F.slope.pct25 >= 10 || F.slope.mean >= 15)) cost.push("sloping ground (avg " + F.slope.mean + "%)");
    if (F.hazards.length) cost.push("a mapped critical area");
    if (F.yearBuilt && +F.yearBuilt < 1978) cost.push("a pre-1978 house (lead-safe work, asbestos survey)");
    if (isNum(F.frontage) && F.frontage < 25) cost.push("narrow access");
    if (isNum(eff.roomFar) && eff.roomFar <= 0) cost.push("no floor-area room left");
    add(B, "cost", "What drives cost here", (cost.length ? "From this study: " + cost.join(", ") + "." : "No cost driver stands out in the public data read.") + " Dollar figures come with a written estimate.", "est", []);

    /* ---- Remodel ---- */
    var Rm = "remodel";
    var others = (F.years || []).filter(function (y) { return String(y.y) !== String(F.yearBuilt); });
    add(Rm, "year", "Year built", F.yearBuilt ? F.yearBuilt + (others.length ? " (another record shows " + others.map(function (y) { return y.y; }).join(", ") + "; the older year is used for the lead and asbestos rows)" : "") + (F.yearRenov ? " · renovated " + F.yearRenov + " on the assessor record" : "") : MISSING, F.yearBuilt ? "fact" : "missing", [F.yearSrc]);
    var hs = [];
    if (F.living) hs.push((F.living.est ? "≈ " : "") + fmt(F.living.sf) + " sf " + (F.living.finSize ? "county record (basement, lower-level and attic finished area are recorded separately and are not added)" : "finished living"));
    if (isNum(F.firstFloor)) hs.push("1st floor " + fmt(F.firstFloor) + " sf");
    if (isNum(F.basementTotal) && F.basementTotal > 0) hs.push("basement " + fmt(F.basementTotal) + " sf" + (isNum(F.basementFinished) ? " (" + fmt(F.basementFinished) + " finished)" : ""));
    else if (F.basementNone) hs.push("no basement on the record");
    if (F.stories) hs.push(F.stories + (F.storiesNum === 1 ? " story" : " stories"));
    add(Rm, "house", F.nonres ? "Building size" : "House size", hs.length ? hs.join(" · ") : (F.nonres ? "Floor area " : "Living area ") + MISSING, F.living ? (F.living.est ? "est" : "fact") : "missing", [F.living ? F.living.src : ""]);
    add(Rm, "rooms", "Bedrooms / baths", isNum(F.beds) || isNum(F.baths) ? (isNum(F.beds) ? F.beds + " bedroom" + (F.beds === 1 ? "" : "s") : "bedrooms not on record") + " · " + (isNum(F.baths) ? F.baths + " bath" + (F.baths === 1 ? "" : "s") + " (full 1, three-quarter 0.75, half 0.5)" : "baths not on record") : MISSING, isNum(F.beds) || isNum(F.baths) ? "fact" : "missing", [F.recordSrc]);
    var gd = [];
    if (isNum(F.garageAtt) && F.garageAtt > 0) gd.push("attached garage " + fmt(F.garageAtt) + " sf");
    if (isNum(F.garageBsmt) && F.garageBsmt > 0) gd.push("basement garage " + fmt(F.garageBsmt) + " sf");
    if (!F.nonres && isNum(F.garageDet) && F.garageDet > 0) gd.push("detached garage " + fmt(F.garageDet) + " sf");
    if (!F.nonres && !gd.length && F.garageNone) gd.push("no garage on the record");
    if (!F.nonres && isNum(F.deck) && F.deck > 0) gd.push("deck " + fmt(F.deck) + " sf");
    if (!F.nonres) add(Rm, "garage", "Garage and deck", gd.length ? gd.join(" · ") : MISSING, gd.length ? "fact" : "missing", [F.recordSrc]);
    var as = datumRow(site.asbestos, place, "The asbestos rule");
    add(Rm, "asbestos", "Asbestos", (F.stateAbbr && F.stateAbbr !== "WA") ? "Check the local air agency's asbestos rule before any demolition or renovation." : as.v, (F.stateAbbr && F.stateAbbr !== "WA") ? "verify" : as.s, [as.src]);
    var ld = datumRow(site.lead, place, "The lead rule"), yb = +F.yearBuilt;
    add(Rm, "lead", "Lead paint", F.yearBuilt ? (yb < 1978 ? "Built " + F.yearBuilt + ", before 1978: " + String(ld.v).replace(/^In a home built before 1978, p/, "p") : "Built " + F.yearBuilt + ", after 1977: the federal lead-safe renovation rule does not apply by age.") : "Year built is not on record, so plan as if the pre-1978 lead-safe rule applies. " + ld.v, F.yearBuilt ? "fact" : "verify", [ld.src]);
    var pr = F.permits, pv;
    if (pr.length) {
      var latest = pr[0];
      pv = pr.length + " permit record" + (pr.length === 1 ? "" : "s") + " on this parcel in the layer read. Latest: " + [latest.type, latest.issued ? "issued " + latest.issued : "", latest.final ? "finaled " + latest.final : ""].filter(Boolean).join(", ") + ". The full list is on the Records page.";
    } else if (F.permitSearch === "ok") pv = "No permit record on this parcel in the layer read (" + (F.juris === "seattle" ? "Seattle issued and finaled residential permits" : "Snohomish County active permits") + "). Older work is often only on microfilm.";
    else if (F.permitSearch === "failed") pv = "The permit layer did not answer, so permit history was not read.";
    else pv = "Permit history is not available online in a form this study reads for " + place + ". Pacific Pro Group pulls it for the site visit.";
    add(Rm, "permitHistory", "Permit history", "See page 5.", "fact", []);
    add(Rm, "kitchenBath", "Kitchen or bath remodel", F.nonres ? "Finish work is confirmed with " + place + ". Moving plumbing, wiring, gas, ducts, or walls needs a permit." : "No building permit for finish work (cabinets, counters, tile, flooring, paint) under the residential code's exempt-work list. Moving plumbing, wiring, gas or ducts needs trade permits; moving walls needs a building permit (verify with " + place + ").", "verify", F.nonres ? [] : [{ label: "International Residential Code R105.2 (work exempt from permit), as adopted in Washington; cities amend it", url: "" }]);
    add(Rm, "remodelOption", "If an addition does not fit", "A kitchen, bath or basement remodel inside the existing walls adds no lot coverage, floor area or setback question, so it stays open when the lot limits block an addition.", "fact", []);

    /* ---- Landscaping ---- */
    var L = "landscaping", by = {};
    (F.rows || []).forEach(function (r) { by[r.key] = r; });
    var lotSf = F.lot.sf, share = function (sf) { return isNum(sf) && isNum(lotSf) && lotSf > 0 ? " (" + Math.round(sf / lotSf * 100) + "%)" : ""; };
    var lb = [];
    lb.push(isNum(eff.buildings) ? "buildings ≈ " + fmt(eff.buildings) + " sf" + share(eff.buildings) : "buildings " + MISSING);
    lb.push(isNum(eff.drive) ? "driveway ≈ " + fmt(eff.drive) + " sf" + share(eff.drive) : "driveway not measured");
    lb.push(isNum(eff.hard) ? "walks and patios ≈ " + fmt(eff.hard) + " sf" + share(eff.hard) : "walks, patios and decks not measured");
    var land = by.land;
    if (land && isNum(land.sf)) lb.push((land.verifiedLandscape ? "landscape ≈ " : "open area (yard plus any unmapped paving) ≈ ") + fmt(land.sf) + " sf" + share(land.sf));
    add(L, "breakdown", "Lot breakdown", lb.join(" · ") + ". Not measured is not zero.", isNum(eff.buildings) ? (isNum(eff.drive) && isNum(eff.hard) ? "est" : "partial") : "missing", [F.footprintSrc, by.drive && by.drive.sf != null ? by.drive.src : ""]);
    var sl = F.slope;
    var fallFt = sl && sl.ok ? Math.max(0, Math.round(sl.elevMax - sl.elevMin)) : 0;
    var across = sl && sl.ok ? (sl.overallPct != null ? sl.overallPct : sl.fallPct) : null;
    add(L, "slope", "Slope (lidar approx.)", sl && sl.ok ? "About " + fallFt + " ft of fall" + (across != null ? ", about " + across + "% across the lot" : "") + (sl.fallCompass && sl.fallCompass !== "flat" ? " toward the " + sl.fallCompass : "") + ". Local cells average " + sl.mean + "% (median " + sl.median + "%), which is steeper where a wall or a building edge is in the sample. " + sl.pct15 + "% of the cells are 15% or steeper, " + sl.pct25 + "% are 25% or steeper, and " + sl.pct40 + "% are 40% or steeper. Ground " + fmt(sl.elevMin) + " to " + fmt(sl.elevMax) + " ft." : "Not measured: the elevation service did not answer.", sl && sl.ok ? "est" : "missing", [sl && sl.ok ? "USGS 3DEP elevation (bare-earth lidar samples)" : ""]);
    var where = F.hazardScope === "parcel" ? "this parcel" : F.hazardScope === "box" ? "a box around this parcel (its outline is too long to send)" : "the address point only (no parcel outline was found)", hz;
    var cityGap = F.juris === "city" && F.city ? " Only county layers were read; the City of " + F.city + " keeps its own critical-area maps." : "";
    if (F.hazards.length) hz = { v: F.hazards.join("; ") + "." + cityGap + " Expect a critical-area review.", s: "fact" };
    else if (F.hazardSource) hz = { v: "None mapped on " + where + " in the " + F.hazardSource + (F.hazardNotes.length ? ", among the layers that answered (" + F.hazardNotes.length + " did not)" : "") + "." + cityGap + " A map is not a field study.", s: F.hazardNotes.length || cityGap || F.hazardScope !== "parcel" ? "partial" : "fact" };
    else hz = { v: "Critical-area maps were not read for this place, verify with " + place + ".", s: "missing" };
    if (F.nearNotices.length) hz.v += " A sensitive-area notice is recorded on a neighboring parcel.";
    if (F.steep && F.steep.mapped) hz.v += " Seattle maps a 40% steep slope area on about " + fmt(F.steep.sf) + " sf of the lot.";
    add(L, "critical", "Critical areas", hz.v, hz.s, [F.hazardSource]);
    var fl2 = F.flood;
    add(L, "flood", "Flood zone (FEMA)", fl2 && fl2.ok ? (fl2.zones.length ? "FEMA flood zone " + fl2.zones.join(", ") + (fl2.sfha ? ", a special flood hazard area (the 100-year floodplain) touches the lot" : ", outside the special flood hazard area") + "." : "No FEMA flood zone polygon at this location in the layer read.") : "Not read" + (fl2 && fl2.note ? " (" + fl2.note + ")" : "") + ", check the FEMA flood map.", fl2 && fl2.ok ? "fact" : "missing", [fl2 && fl2.ok ? "FEMA National Flood Hazard Layer" : ""]);
    var so = F.soils;
    add(L, "soils", "Soils (NRCS)", so && so.ok ? so.name + (so.hsg ? " · hydrologic group " + so.hsg : "") + (so.drainage ? " · " + String(so.drainage).toLowerCase() : "") + ". A soil map unit, not a soils report: a geotechnical engineer confirms bearing and drainage." : "Not read" + (so && so.note ? " (" + so.note + ")" : "") + ". A geotechnical report covers soils where the city asks for one.", so && so.ok ? "est" : "missing", [so && so.ok ? "USDA NRCS Soil Survey (SSURGO) via Soil Data Access" : ""]);
    var tr = datumRow(site.trees, place, "The tree protection rule");
    add(L, "trees", "Trees", (F.treesMapped == null ? "No public tree layer was read." : F.treesMapped > 0 ? F.treesMapped + " tree" + (F.treesMapped === 1 ? "" : "s") + " mapped on or near the lot (OpenStreetMap, rarely complete)." : "None mapped here in OpenStreetMap, which is rarely complete.") + " " + tr.v + " An arborist or survey locates and sizes trees.", "verify", [F.treesMapped != null ? "OpenStreetMap (mapped trees)" : "", tr.src]);
    var dr = datumRow(site.drainage, place, "The stormwater threshold"), addH = oa && isNum(oa.footprintSf) && oa.footprintSf > 0 ? oa.footprintSf : null, newH = on && isNum(on.footprintSf) ? on.footprintSf : null;
    add(L, "drainage", "Drainage trigger", dr.v + (addH || newH ? " For scale: " + (addH ? "the addition option adds ≈ " + fmt(addH) + " sf of roof" : "the addition option adds no new roof") + (newH ? ", a new house ≈ " + fmt(newH) + " sf" : "") + ", before new paving." : ""), dr.s, [dr.src]);
    var fe = datumRow(site.fence, place, "The fence height limit");
    add(L, "fence", "Fences and yard rules", fe.v + (rs && isNum(rs.openSpacePct) ? " Open space: " + rs.openSpacePct + "% of the lot." : ""), fe.s, [fe.src]);
    if (F.wa) add(L, "shoreline", "Shoreline", F.shoreline ? "Inside shoreline jurisdiction (" + F.shoreline + " environment). The Shoreline Master Program adds buffers and a shoreline review." : "Not read from a shoreline map. Land within 200 ft of a lake, large stream, or the sound follows the Shoreline Master Program. Confirm it with " + place + ".", F.shoreline ? "fact" : "verify", [F.shoreline ? "Shoreline designations" : { label: "RCW 90.58 Shoreline Management Act", url: "https://app.leg.wa.gov/RCW/default.aspx?cite=90.58" }]);
    var walkPlace = place && place !== "the jurisdiction" ? place : "the local planning department";
    add(L, "sidewalk", "Sidewalk on the frontage", F.sidewalk == null ? "Not read." : F.sidewalk ? "A sidewalk is mapped along the street in OpenStreetMap." : (F.nonres ? "None mapped along the street in OpenStreetMap, which is rarely complete. Frontage improvements are confirmed with " + walkPlace + "." : "None mapped along the street in OpenStreetMap, which is rarely complete. " + cap1(walkPlace) + " can ask for curb, gutter and sidewalk with a new house."), F.sidewalk == null ? "missing" : "est", [F.sidewalk != null ? "OpenStreetMap (sidewalks)" : ""]);

    /* ---- Roofing ---- */
    var Rf = "roofing", roof = isNum(eff.roof) ? eff.roof : null;
    if (roof != null) {
      var at = function (rise) { return roof * Math.sqrt(1 + (rise / 12) * (rise / 12)); }, a6 = at(6);
      add(Rf, "roofArea", "Roof area (estimate)", "≈ " + fmt(r10(a6)) + " sf at an assumed 6:12 pitch, about " + (Math.round(a6 / 10) / 10).toFixed(1) + " squares. At 4:12 ≈ " + fmt(r10(at(4))) + " sf; at 8:12 ≈ " + fmt(r10(at(8))) + " sf. Pitch assumed, not measured. From the mapped roof outline (≈ " + fmt(roof) + " sf, eaves included).", "est", [F.footprintSrc]);
    } else add(Rf, "roofArea", "Roof area (estimate)", "Roof outline " + MISSING + ". Roof area is not worked out from living area.", "missing", []);
    var reroof = null;
    F.permits.forEach(function (p) { if (!reroof && /roof/i.test(String(p.type || "") + " " + String(p.desc || ""))) reroof = p; });
    add(Rf, "roofAge", "Roof age", (F.yearBuilt ? (F.nonres ? "Building built " : "House built ") + F.yearBuilt + ". " : "Year built " + MISSING + ". ") + (reroof ? "A roofing permit is on record" + (reroof.issued ? ", issued " + reroof.issued : "") + "." : F.permits.length || F.permitSearch === "ok" ? "No roofing permit is in the permit records read." : "Re-roof permits are not in the records this study reads, so the roof's age is not known."), reroof ? "fact" : "missing", [F.yearSrc]);
    var rr = datumRow(site.reroof, place, "The re-roof permit rule");
    add(Rf, "reroofRule", "Re-roof permit", rr.v, rr.s, [rr.src]);
    var ly = datumRow(site.reroofLayers, place, "The roof recover rule");
    add(Rf, "roofLayers", "Roofing over old layers", ly.v, ly.s, [ly.src]);
    add(Rf, "roofHeight", "Height limit for roof changes", isNum(H.ft) ? H.ft + " ft" + (H.verify ? " (verify)" : "") + ". Raising the roof or adding a dormer counts against it." : "Height limit " + notCoded, isNum(H.ft) ? (H.verify ? "verify" : "fact") : "verify", [codeSrc]);
    add(Rf, "solar", "Solar", "Not estimated: no solar service is read in this study, and roof pitch and facing are not measured.", "missing", []);

    /* ---- what public data cannot answer ---- */
    var items = F.nonres
      ? ["water, power, sewer and gas service and capacity", "easements and covenants (title report)", "electrical service", "permit review time for this scope", "frontage improvements the city may ask for", "landmark or historic status", "unpermitted work", "construction cost"]
      : ["sewer or septic, and whether the side sewer or septic can take more bedrooms or an ADU", "water, power and gas service and capacity", "easements and covenants (title report)", "whether the framing and foundation can carry a second story", "electrical panel and heating", "permit review time for this scope", "frontage improvements the city may ask for", "landmark or historic status", "unpermitted work", "staging the job so you can stay in the house", "construction cost"];
    var b = F.brand || {};
    out.visit = { items: items, text: (b.name ? b.name + " confirms on site: " : "Confirmed on site: ") + items.join(" · ") + "." };
    out.notes = notes;
    return out;
  }

  /* ---------- the homeowner question checklist (the success test) ---------- */
  /* Each planning question maps to a row of this summary, to a table on the site plan sheet, or to the one
     "confirmed on site" row. answers() says where each is answered and how firmly. */
  var QUESTIONS = [
    [1, "Can I build an addition?", ["addition"]], [2, "Can I build an ADU or DADU? How big?", ["adu"]], [3, "Can I add a second story?", ["secondStory"], "structure"],
    [4, "How big can I go?", ["far"]], [5, "How tall?", ["height"]], [6, "What are my setbacks?", ["setbacks"]], [7, "How much lot coverage and impervious surface is left?", ["coverage", "impervious"]],
    [8, "What permits do I need, and how long does it take?", ["permits"], "time"], [9, "What drives cost? Rough cost?", ["cost"], "cost"], [10, "Sewer or septic?", [], "sewer"], [11, "Water, power and gas?", [], "utilities"],
    [12, "Slope?", ["slope"]], [13, "Trees and tree rules?", ["trees"]], [14, "Critical areas?", ["critical"]], [15, "Drainage and stormwater?", ["drainage"]], [16, "Soils and geotech?", ["soils"]],
    [17, "Roof replacement rules, roof area, roof age?", ["roofArea", "roofAge", "reroofRule"]], [18, "Solar potential?", ["solar"]], [19, "Fence height and landscaping rules?", ["fence"]], [20, "Parking, driveway, curb cut?", ["parking"]],
    [21, "HOA or covenants?", ["plat"], "title"], [22, "Energy code?", ["energy"]], [23, "Historic district or landmark?", [], "historic"], [24, "Shoreline jurisdiction?", ["shoreline"]], [25, "Flood zone?", ["flood"]],
    [26, "Easements or utilities on the lot?", [], "title"], [27, "Existing house facts?", ["year", "house", "rooms"]], [28, "Asbestos and lead?", ["asbestos", "lead"]], [29, "Past permits and unpermitted work?", ["permitHistory"], "unpermitted"],
    [30, "Can I add units (middle housing)?", ["units"]], [31, "Kitchen or bath remodel: is a permit needed?", ["kitchenBath"]], [32, "Who does what next?", [], "next"],
    [33, "City limits or unincorporated?", ["juris"]], [34, "Fire access or flag lot?", ["frontage"]], [35, "Can the septic or side sewer handle more?", [], "sewer"], [36, "Impact fees for an ADU?", ["adu"]],
    [37, "Frontage improvements?", ["sidewalk"], "frontage"], [38, "Panel upgrade or heat pump?", [], "panel"], [39, "Other hazard overlays?", ["critical"]], [40, "Live at home, or remodel instead?", ["remodelOption"], "staging"],
    [41, "Which lot line is the front? Corner or alley lot?", ["frontage"]], [42, "How far is the house from each lot line today?", ["setbacks"], "", "SP-1 setbacks table"], [43, "How much of the lot is open yard?", ["breakdown"]],
    [44, "Which way does the ground fall, and how much?", ["slope"]], [45, "Do the garage and basement count against the floor-area cap?", ["far"]], [46, "How many roofing squares?", ["roofArea"]],
    [47, "Can I roof over the old layers?", ["roofLayers"]], [48, "Where did each number come from?", [], "", "numbered footnotes"], [49, "What is not known from public data?", [], "", "orange rows and the on-site row"],
    [50, "Is the zone from a draft map or under an overlay?", ["zone"]], [51, "What gets checked first at a site visit?", [], "next"], [52, "How do I reach the builder?", [], "", "contact strip"]
  ];
  function answers(F, B) {
    B = B || blocks(F);
    var all = {};
    ["building", "remodel", "landscaping", "roofing"].forEach(function (blk) { B[blk].forEach(function (r) { all[r.key] = { block: blk, row: r }; }); });
    return QUESTIONS.map(function (q) {
      var hit = null, states = [];
      q[2].forEach(function (key) { if (all[key]) { hit = hit || all[key]; states.push(all[key].row.s); } });
      var worst = states.indexOf("missing") >= 0 ? "missing" : states.indexOf("verify") >= 0 ? "verify" : states.indexOf("partial") >= 0 ? "partial" : states.indexOf("est") >= 0 ? "estimate" : states.length ? "fact" : "";
      var visit = !!q[3], where = hit ? "F-1 " + title(hit.block) + ": " + hit.row.k : (q[4] || (visit ? "F-1 confirmed-on-site row" : ""));
      return { n: q[0], q: q[1], where: where, status: hit ? worst : (visit ? "visit" : q[4] ? "fact" : "unanswered"), visit: visit, ok: !!(hit || visit || q[4]) && (q[2].length === 0 || !!hit) };
    });
  }

  /* ---------- markup ---------- */
  var STATE_CLASS = { fact: "bh-s-fact", est: "bh-s-est", partial: "bh-s-partial", missing: "bh-s-missing", verify: "bh-s-verify" };
  function telHref(p) { var d = String(p || "").replace(/[^0-9+]/g, ""); return d.length >= 7 ? "tel:" + (d.charAt(0) === "+" ? d : (d.length === 10 ? "+1" + d : d)) : ""; }
  function mailHref(e) { return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(String(e || "")) ? "mailto:" + e : ""; }
  function siteHref(u) { u = String(u || "").trim(); if (!u) return ""; return /^https?:\/\//i.test(u) ? u : "https://" + u.replace(/^\/+/, ""); }
  /* Name, phone, email, web address and registration number, each as a link where it can be one. */
  function contactHtml(b, cls) {
    b = b || {};
    var bits = [];
    if (b.phone) bits.push(esc(b.phone));
    if (b.site) bits.push(esc(String(b.site).replace(/^https?:\/\//i, "").replace(/\/$/, "")));
    if (b.license) bits.push("WA contractor reg. " + esc(b.license));
    return '<p class="' + (cls || "bh-contact") + '"><img class="bh-foot-logo" src="/assets/feasibility/pacific-pro-group-logo.png" alt="Pacific Pro Group"> ' + (b.name ? "<strong>" + esc(b.name) + (b.tagline ? " · " + esc(b.tagline) : "") + "</strong>" + (bits.length ? " · " : "") : "") + bits.join(" · ") + "</p>";
  }
  function blockHtml(name, rows, notes) {
    notes = notes || [];
    return '<div class="bh-facts-block"><h3>' + esc(name) + '</h3><table class="bh-facts-table"><tbody>' + rows.map(function (r) {
      var link = "";
      if (r.key === "chapter") (r.fn || []).forEach(function (n) {
        var note = notes.filter(function (x) { return x.n === n; })[0];
        if (note && note.url) link = ' <a href="' + esc(note.url) + '">' + esc(note.label || r.v) + "</a>";
      });
      return '<tr><th scope="row">' + esc(r.k) + '</th><td class="' + (STATE_CLASS[r.s] || "bh-s-fact") + '">' + (link || esc(r.v)) + "</td></tr>";
    }).join("") + "</tbody></table></div>";
  }
  /* Page 2 of the summary. */
  function factsSheet(F, B, opts) {
    B = B || blocks(F);
    opts = opts || {};
    var b = F.brand || {};
    var pageLabel = opts.pageLabel || "Page 2 of 6";
    var pageNum = opts.pageNum || 2;
    var totalPages = opts.totalPages || 6;
    var sampleTxt = F.isSample ? " · SAMPLE LAYOUT, NOT A PROPERTY RECORD" : "";
    return '<section class="bh-page bh-facts" data-sheet="F-1" data-page="' + esc(pageNum) + '" data-total="' + esc(totalPages) + '"><header class="bh-facts-head"><div><h2>Property facts</h2><p>' + esc(F.address) + (F.parcel ? " · Parcel " + esc(F.parcel) : "") + (F.preparedText ? " · Prepared " + esc(F.preparedText) : "") + esc(sampleTxt) + '</p></div><div class="bh-facts-id" aria-hidden="true">F-1 · ' + esc(pageLabel) + '</div></header>' +
      '<p class="bh-facts-key"><span class="bh-s-est">≈ estimate from public data</span> · <span class="bh-s-partial">≥ a total that lacks a part</span> · <span class="bh-s-missing">marked verify: not in public data, or confirm</span></p>' +
      '<div class="bh-facts-cols"><div>' + blockHtml("Building", B.building, B.notes) + "</div><div>" + blockHtml("Remodel", B.remodel, B.notes) + blockHtml("Landscaping", B.landscaping, B.notes) + blockHtml("Roofing", B.roofing, B.notes) + "</div></div>" +
      '<p class="bh-facts-visit"><strong>' + esc(b.name ? b.name + " confirms on site" : "Confirmed on site") + ":</strong> " + esc(B.visit.items.join(" · ")) + ".</p>" +
      '<footer class="bh-facts-foot">' + contactHtml(b) + '<p class="bh-facts-disc">Planning estimate from public records; not a survey or permit determination. Verify with ' + esc(F.place) + " · <strong>" + esc(pageLabel) + "</strong></p></footer></section>";
  }
  /* The next step, tied to what this study found. It takes the place of the generic list when link-only blocks are hidden. */
  function nextStep(F) {
    var eff = F.eff || {}, bits = [];
    if (isNum(F.envArea) && F.envArea > 0) bits.push("about " + fmt(r10(F.envArea)) + " sf of buildable area inside the setbacks");
    if (isNum(eff.roomFar)) bits.push(eff.roomFar > 0 ? "about " + fmt(eff.roomFar) + " sf of floor-area room left" : "no floor-area room left as read");
    if (isNum(eff.roomCov) && eff.roomCov > 0) bits.push("about " + fmt(eff.roomCov) + " sf of lot-coverage room");
    var lead = bits.length ? "This lot shows " + bits.join(", ") + "." : "The zoning numbers for this lot are not all coded, so the limits need a check with " + F.place + ".";
    return { lead: lead, steps: ["A site visit confirms the lot lines against the house, the slope, the utilities and what the house can carry.", "A survey and a measured plan fix the numbers a permit needs.", "Design, permit and build follow from there, under one contract."] };
  }

  var api = { MISSING: MISSING, QUESTIONS: QUESTIONS, facts: facts, blocks: blocks, answers: answers, factsSheet: factsSheet, contactHtml: contactHtml, nextStep: nextStep, telHref: telHref, mailHref: mailHref, siteHref: siteHref, dateText: dateText };
  root.BuildHereSummary = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
