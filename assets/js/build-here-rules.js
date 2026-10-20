/* What can I build here? Rule tables. Every number below was read from the
   official code page linked in its source field. Last checked October 2026.
   A rule with value null means we could not confirm it and the page tells the
   visitor to verify with the jurisdiction. */
(function (root) {
  "use strict";
  var CHECKED = "Oct 2026";

  var SRC = {
    smc2344: { label: "SMC ch. 23.44 (Neighborhood Residential)", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc2344pdf: { label: "Seattle OPCD: ch. 23.44 and 23.42.022 as amended by Ord. 127211 and 127219 (eff. June 30, 2025)", url: "https://www.seattle.gov/documents/departments/opcd/seattleplan/oneseattleplanchapter23.44-amended.pdf" },
    smc23010: { label: "SMC 23.44.010 lot coverage", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc23011: { label: "SMC 23.44.011 floor area (FAR)", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc23012: { label: "SMC 23.44.012 height", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc23014: { label: "SMC 23.44.014 yards", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc23017: { label: "SMC 23.44.017 density", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc42022: { label: "SMC 23.42.022 accessory dwelling units", url: "https://www.seattle.gov/documents/departments/opcd/seattleplan/oneseattleplanchapter23.44-amended.pdf" },
    kc21a: { label: "King County Code Title 21A (zoning), current code file", url: "https://aqua.kingcounty.gov/council/clerk/code/24-30_Title_21A.pdf" },
    kc09h: { label: "KCC 21A.09H.030 urban residential density and dimensions", url: "https://aqua.kingcounty.gov/council/clerk/code/24-30_Title_21A.pdf" },
    kc09t: { label: "KCC 21A.09T.030 rural area density and dimensions", url: "https://aqua.kingcounty.gov/council/clerk/code/24-30_Title_21A.pdf" },
    kc08: { label: "KCC 21A.08.030.B.7 accessory dwelling units", url: "https://aqua.kingcounty.gov/council/clerk/code/24-30_Title_21A.pdf" },
    ecdc2030: { label: "ECDC 16.20.030 site development standards", url: "https://edmonds.municipal.codes/ECDC/16.20.030" },
    ecdc2020: { label: "ECDC 16.20.020 unit density", url: "https://edmonds.municipal.codes/ECDC/16.20.020" },
    ecdc2060: { label: "ECDC 16.20.060 accessory dwelling units", url: "https://edmonds.municipal.codes/ECDC/16.20.060" },
    scc23030: { label: "SCC 30.23.030 rural and other zones bulk matrix", url: "https://snohomish.county.codes/SCC/30.23.030" },
    scc23032: { label: "SCC 30.23.032 urban residential bulk matrix", url: "https://snohomish.county.codes/SCC/30.23.032" },
    scc23040: { label: "SCC 30.23.040 bulk matrix reference notes", url: "https://snohomish.county.codes/SCC/30.23.040" },
    scc28010: { label: "SCC 30.28.010 accessory dwelling units", url: "https://snohomish.county.codes/SCC/30.28.010" },
    scc50103: { label: "SCC 30.50.103 work exempt from permit", url: "https://snohomish.county.codes/SCC/30.50.103" },
    pscaa: { label: "Puget Sound Clean Air Agency: asbestos survey before renovation or demolition", url: "https://pscleanair.gov/185/Asbestos" },
    wsec: { label: "WA State Building Code Council: energy code (residential)", url: "https://sbcc.wa.gov/state-codes-regulations-guidelines/state-building-code/energy-code" },
    hb1337: { label: "RCW 36.70A.680 and .681 (ADU rules from HB 1337)", url: "https://app.leg.wa.gov/RCW/default.aspx?cite=36.70A.681" }
  };

  function verify(label, src, note) { return { label: label, value: null, src: src, note: note || "" }; }
  function rule(label, value, src, note, num) { return { label: label, value: value, src: src, note: note || "", num: num }; }

  /* ---- Seattle NR1, NR2, NR3 ---- */
  function seattleNR(v) {
    var lot = v.lot, units = v.units || 1;
    var far = 0.6; // Table A for 23.44.011, density less dense than 1 unit per 4,000 sf
    var perUnit = lot / units;
    if (perUnit <= 1600) far = 1.2; else if (perUnit <= 2200) far = 1.0; else if (perUnit <= 4000) far = 0.8;
    var cap = Math.round(far * lot);
    if (lot < 5000 && cap < 2500) cap = 2500;
    var cov = lot >= 5000 ? 0.35 * lot : Math.min(1000 + 0.15 * lot, 0.5 * lot);
    return {
      key: "seattle-nr",
      title: "City of Seattle, Neighborhood Residential (" + v.zone + ")",
      floorCap: cap,
      floorCapLabel: "FAR " + far + " x " + fmt(lot) + " sf lot" + (lot < 5000 ? " (lots under 5,000 sf get at least 2,500 sf)" : ""),
      coverage: Math.round(cov),
      setbacks: { front: 15, rear: 15, side: 5, rearAlley: 0 },
      rules: [
        rule("Maximum floor area (FAR)", fmt(cap) + " sf", SRC.smc23011, "FAR " + far + " in NR1, NR2 and NR3 for " + (units === 1 ? "one unit" : units + " units") + " on this lot. Underground stories and story portions no more than 4 ft above grade are exempt. ADU floor area is exempt from FAR in NR zones (23.42.022.C.3).", cap),
        rule("Maximum lot coverage", fmt(Math.round(cov)) + " sf (" + (lot >= 5000 ? "35%" : "1,000 sf + 15%") + ")", SRC.smc23010, "Applies with one principal unit and no detached ADU. With two or more principal units or detached ADUs the limit is 50%.", Math.round(cov)),
        rule("Maximum height", "32 ft, plus 5 ft for a pitched roof at 4:12 or steeper", SRC.smc23012),
        rule("Front yard", "15 ft (10 ft with three or more units)", SRC.smc23014),
        rule("Rear yard", "15 ft (10 ft with three or more units; none when the lot abuts an alley)", SRC.smc23014),
        rule("Side yards", "5 ft", SRC.smc23014),
        rule("Dwelling units per lot", "Up to 4, or 6 within a quarter mile walk of a major transit stop", SRC.smc23017, "Counts principal and accessory units. Interim rules effective June 30, 2025; confirm the permanent version at SDCI."),
        rule("ADUs", "Up to 2 per lot, attached or detached, each up to 1,000 sf gross floor area", SRC.smc42022, "Detached ADU height follows the principal house limit. Keep 5 ft eave to eave from the house. No parking required."),
        verify("Permit-exempt accessory structures", SRC.smc2344, "Seattle exemption thresholds live in the building code, not the zoning chapter. Verify with SDCI.")
      ],
      sources: [SRC.smc2344pdf, SRC.smc2344]
    };
  }

  /* ---- King County unincorporated, urban R-1 to R-8 ---- */
  var KC_URBAN = { "R-1": { street: 20, interior: 5, h: 35, imp: 0.08, impNote: "8%, or 30% under condition 12" }, "R-4": { street: 10, interior: 5, h: 35, imp: 0.55 }, "R-6": { street: 10, interior: 5, h: 35, imp: 0.70 }, "R-8": { street: 10, interior: 5, h: 35, imp: 0.75 } };
  function kcUrban(v) {
    var z = KC_URBAN[v.zone];
    var imp = Math.round(z.imp * v.lot);
    return {
      key: "kc-urban", title: "Unincorporated King County, urban " + v.zone,
      floorCap: null, floorCapLabel: "No floor area ratio for houses in this table. Impervious surface and setbacks limit size.",
      coverage: null, impervious: imp,
      setbacks: { front: z.street, rear: z.interior, side: z.interior },
      rules: [
        rule("Maximum floor area (FAR)", "None set for detached houses in the table", SRC.kc09h),
        rule("Maximum impervious surface", (z.impNote || Math.round(z.imp * 100) + "%") + " = about " + fmt(imp) + " sf", SRC.kc09h, "Roof, driveway, patios and walks all count.", imp),
        rule("Base height", z.h + " ft (up to 45 ft under listed conditions)", SRC.kc09h),
        rule("Street setback", z.street + " ft (20 ft for a garage or carport facing the street)", SRC.kc09h),
        rule("Interior setbacks", z.interior + " ft", SRC.kc09h),
        rule("ADUs", "Up to 2 per lot in the urban area. Each up to 1,000 sf heated plus 1,000 sf unheated; heated area can grow to 1,500 sf if unheated area is given up", SRC.kc08, "Detached ADU basements do not count. No extra parking. A notice on title is required."),
        verify("Permit-exempt accessory structures", SRC.kc21a, "Verify the current exemption size with King County Permitting.")
      ],
      sources: [SRC.kc09h, SRC.kc08],
      caveat: "North Highline, Skyway-West Hill and other subareas use their own tables (KCC 21A.09, 21A.09D, 21A.09L). The numbers above are the general urban table."
    };
  }
  var KC_RURAL = { "RA-2.5": { interior: 5 }, "RA-5": { interior: 10 }, "RA-10": { interior: 10 }, "RA-20": { interior: 10 } };
  function kcRural(v) {
    var z = KC_RURAL[v.zone];
    return {
      key: "kc-rural", title: "Unincorporated King County, rural " + v.zone,
      floorCap: null, floorCapLabel: "No floor area ratio. Impervious limits and septic and well capacity usually control.",
      coverage: null,
      setbacks: { front: 30, rear: z.interior, side: z.interior },
      rules: [
        rule("Base height", "40 ft", SRC.kc09t),
        rule("Street setback", "30 ft", SRC.kc09t),
        rule("Interior setbacks", z.interior + " ft", SRC.kc09t),
        verify("Maximum impervious surface", SRC.kc09t, "The rural table lists several percentages that depend on lot size and development conditions 12 and 17. Verify the one that fits this lot."),
        rule("ADUs", "1 per lot in the rural area; detached only under listed conditions", SRC.kc08),
        verify("Permit-exempt accessory structures", SRC.kc21a)
      ],
      sources: [SRC.kc09t, SRC.kc08]
    };
  }

  /* ---- Edmonds LDR-S, LDR-M, LDR-L ---- */
  var EDM = { "LDR-S": { street: 20, side: 5, rear: 15, adu: 1000, daduRear: "10 ft (7.5 ft if 15 ft tall or less)" }, "LDR-M": { street: 25, side: 7.5, rear: 15, adu: 1200, daduRear: "20 ft (10 ft if 15 ft tall or less)" }, "LDR-L": { street: 25, side: 10, rear: 25, adu: 1200, daduRear: "25 ft" } };
  function edmonds(v) {
    var z = EDM[v.zone];
    var cov = Math.round(0.35 * v.lot);
    return {
      key: "edmonds", title: "City of Edmonds, " + v.zone,
      floorCap: null, floorCapLabel: "The LDR table sets no floor area ratio. Lot coverage, height and setbacks limit size.",
      coverage: cov,
      setbacks: { front: z.street, rear: z.rear, side: z.side, rearAlley: 5 },
      rules: [
        rule("Maximum floor area (FAR)", "None in the LDR site standards table", SRC.ecdc2030),
        rule("Maximum lot coverage", "35% = " + fmt(cov) + " sf", SRC.ecdc2030, "", cov),
        rule("Maximum height", "25 ft", SRC.ecdc2030),
        rule("Street setback", z.street + " ft", SRC.ecdc2030, "A street-facing garage sits 5 ft behind the main facade."),
        rule("Side setback", z.side + " ft", SRC.ecdc2030),
        rule("Rear setback", z.rear + " ft (5 ft from an alley)", SRC.ecdc2030),
        rule("Dwelling units per lot", "2, or 4 near a major transit stop or with one affordable unit", SRC.ecdc2020),
        rule("ADUs", "Up to 2 with a detached house, each up to " + fmt(z.adu) + " sf; detached ADU height 24 ft; detached ADU rear setback " + z.daduRear, SRC.ecdc2060, "First ADU needs no added parking; a second needs one space unless within half a mile of a major transit stop."),
        verify("Permit-exempt accessory structures", SRC.ecdc2030, "Verify with Edmonds Development Services.")
      ],
      sources: [SRC.ecdc2030, SRC.ecdc2020, SRC.ecdc2060]
    };
  }

  /* ---- Snohomish County unincorporated ---- */
  var SNO_RURAL = { "R-5": { h: 45 }, "RC": { h: 35 }, "RD": { h: 45 }, "RRT-10": { h: 45 }, "SA-1": { h: 35 }, "RU": { h: 35 }, "R-20,000": { h: 25 }, "R-12,500": { h: 30 }, "WFB": { h: 30 } };
  function snoRural(v) {
    var z = SNO_RURAL[v.zone];
    var cov = Math.round(0.35 * v.lot);
    return {
      key: "sno-table1", title: "Unincorporated Snohomish County, " + v.zone,
      floorCap: null, floorCapLabel: "The bulk matrix sets no floor area ratio. Lot coverage, height and setbacks limit size.",
      coverage: cov,
      setbacks: { front: null, rear: 5, side: 5 },
      rules: [
        rule("Maximum lot coverage", "35% = " + fmt(cov) + " sf", SRC.scc23030, "", cov),
        rule("Maximum height", z.h + " ft", SRC.scc23030),
        rule("Setback from residential, multifamily and rural zones", "5 ft", SRC.scc23030, "Buildings over 20 ft tall may need more; see the reference notes.", null),
        verify("Setback from a street right of way", SRC.scc23040, "The street setback depends on road class and the reference notes. Verify with PDS."),
        rule("Setback from resource lands", "50 ft from agricultural land, 100 ft from forest land", SRC.scc23030),
        verify("ADUs", SRC.scc28010, "Snohomish County updated its ADU rules in 2025 (Ord. 25-014). Verify unit count and size for this lot."),
        rule("Permit-exempt accessory structures", "One-story detached, unconditioned: up to 200 sf inside an urban growth area, up to 400 sf outside", SRC.scc50103, "Must still meet setbacks. Plumbing needs a permit.")
      ],
      sources: [SRC.scc23030, SRC.scc23040, SRC.scc50103]
    };
  }
  function snoUrbanVerify(v) {
    return {
      key: "sno-urban", title: "Unincorporated Snohomish County, " + v.zone,
      floorCap: null, floorCapLabel: "Verify with Snohomish County PDS.",
      coverage: null, setbacks: { front: null, rear: null, side: null },
      rules: [
        verify("Lot coverage, height and setbacks", SRC.scc23032, "Urban residential zones use the SCC 30.23.032 matrix. We could not confirm its current values for this release, so we do not show numbers."),
        verify("ADUs", SRC.scc28010),
        rule("Permit-exempt accessory structures", "One-story detached, unconditioned: up to 200 sf inside an urban growth area, up to 400 sf outside", SRC.scc50103)
      ],
      sources: [SRC.scc23032, SRC.scc28010, SRC.scc50103]
    };
  }

  function pick(v) {
    var z = String(v.zone || "").toUpperCase().replace(/\s+/g, "");
    if (v.juris === "seattle") {
      if (/^NR[123]?$/.test(z)) return seattleNR({ lot: v.lot, units: v.units, zone: z === "NR" ? "NR" : z });
      return null;
    }
    if (v.juris === "edmonds") { if (EDM[z]) return edmonds({ lot: v.lot, zone: z }); return null; }
    if (v.juris === "kc") {
      z = z.replace(/^(RA|R)-?(\d)/, "$1-$2");
      if (KC_URBAN[z]) return kcUrban({ lot: v.lot, zone: z });
      if (KC_RURAL[z]) return kcRural({ lot: v.lot, zone: z });
      return null;
    }
    if (v.juris === "sno") {
      var zz = z.replace(/^R-?(20|12)[,]?(000|500)$/, function (m, a, b) { return "R-" + a + "," + b; });
      if (SNO_RURAL[zz]) return snoRural({ lot: v.lot, zone: zz });
      if (/^R-?(7|8|9)[,]?\d00$|^T$|^LDMR$|^MR$/.test(z)) return snoUrbanVerify({ zone: z });
      return null;
    }
    return null;
  }

  function fmt(n) { return (Math.round(n)).toLocaleString("en-US"); }

  var api = { pick: pick, SRC: SRC, CHECKED: CHECKED, fmt: fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BuildHereRules = api;
})(this);
