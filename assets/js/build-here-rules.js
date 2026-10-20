/* What can I build here? Rule tables. Every number below was read from the
   official code page linked in its source field. Last checked October 2026.
   A rule with value null means we could not confirm it and the page tells the
   visitor to verify with the jurisdiction. */
(function (root) {
  "use strict";
  var CHECKED = "Oct 2026";

  var SRC = {
    smc2344: { label: "SMC ch. 23.44 (Neighborhood Residential)", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc2344pdf: { label: "Seattle Ord. 127376 (CB 120993), new ch. 23.44 and amended 23.42.022, signed Dec. 22, 2025, in effect January 2026", url: "https://clerk.seattle.gov/~archives/Ordinances/Ord_127376.pdf" },
    sdciNR: { label: "SDCI Neighborhood Residential zoning summary (January 2026)", url: "https://www.seattle.gov/documents/Departments/SDCI/Codes/NeighborhoodResidentialSummary.pdf" },
    smc23080: { label: "SMC 23.44.080 lot coverage", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE_23.44.080LOCO" },
    smc23050: { label: "SMC 23.44.050 floor area (FAR)", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc23070: { label: "SMC 23.44.070 structure height", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc23090: { label: "SMC 23.44.090 setbacks", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc23060: { label: "SMC 23.44.060 maximum density", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc42022: { label: "SMC 23.42.022 accessory dwelling units (as amended by Ord. 127376)", url: "https://clerk.seattle.gov/~archives/Ordinances/Ord_127376.pdf" },
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
    kmc21030: { label: "KMC 18.21.030 Table B, R-1, R-4 and R-6 development standards", url: "https://www.codepublishing.com/WA/Kenmore/html/Kenmore18/Kenmore1821.html" },
    kmcCrit: { label: "Kenmore critical areas code, KMC 18.55 (geologically hazardous areas)", url: "https://www.codepublishing.com/WA/Kenmore/html/Kenmore18/Kenmore1855.html" },
    kmcSmp: { label: "Kenmore Shoreline Master Program, KMC Title 16", url: "https://www.codepublishing.com/WA/Kenmore/html/Kenmore16/Kenmore16.html" },
    kenPermits: { label: "City of Kenmore permits (MyBuildingPermit)", url: "https://www.kenmorewa.gov/government/departments/development-services/permit-center" },
    pscaa: { label: "Puget Sound Clean Air Agency: asbestos survey before renovation or demolition", url: "https://pscleanair.gov/185/Asbestos" },
    wsec: { label: "WA State Building Code Council: energy code (residential)", url: "https://sbcc.wa.gov/state-codes-regulations-guidelines/state-building-code/energy-code" },
    hb1337: { label: "RCW 36.70A.680 and .681 (ADU rules from HB 1337)", url: "https://app.leg.wa.gov/RCW/default.aspx?cite=36.70A.681" }
  };

  function verify(label, src, note) { return { label: label, value: null, src: src, note: note || "" }; }
  function rule(label, value, src, note, num) { return { label: label, value: value, src: src, note: note || "", num: num }; }

  /* ---- Seattle NR1, NR2, NR3 (new ch. 23.44, Ord. 127376, in effect January 2026) ---- */
  function seattleNR(v) {
    var lot = v.lot, units = v.units || 1;
    var far = 0.6; // Table A for 23.44.050: less dense than 1 unit per 4,000 sf
    var perUnit = lot / units;
    if (perUnit <= 1600) far = 1.6; else if (perUnit <= 2200) far = 1.0; else if (perUnit <= 4000) far = 0.8;
    var cap = Math.round(far * lot);
    if (lot < 5000 && cap < 2500) cap = 2500;
    var cov = Math.round(0.5 * lot); // 23.44.080.A
    return {
      key: "seattle-nr",
      title: "City of Seattle, Neighborhood Residential (" + v.zone + ")",
      floorCap: cap,
      floorCapLabel: "FAR " + far + " x " + fmt(lot) + " sf lot" + (lot < 5000 ? " (lots under 5,000 sf get at least 2,500 sf)" : ""),
      coverage: cov,
      setbacks: { front: 15, rear: 15, side: 5, rearAlley: 0 },
      rules: [
        rule("Maximum floor area (FAR)", fmt(cap) + " sf", SRC.smc23050, "FAR " + far + " for " + (units === 1 ? "one unit" : units + " units") + " on this lot (Table A for 23.44.050). Higher FAR applies at higher density: 0.8 or 1.0 from 1 unit per 4,000 sf, 1.0 or 1.2 from 1 per 2,200 sf, 1.6 from 1 per 1,600 sf. Underground stories and story portions no more than 4 ft above grade are exempt. ADU floor area now counts toward FAR; the old NR exemption was repealed.", cap),
        rule("Maximum lot coverage", "50% = " + fmt(cov) + " sf", SRC.smc23080, "Riparian corridors, wetlands and buffers, shoreline setback areas and steep slope non-disturbance areas are taken out of the lot area first. Decks 36 in. or less above grade and the first 36 in. of eaves do not count.", cov),
        rule("Maximum height", "32 ft, plus 5 ft for a pitched roof at 4:12 or steeper", SRC.smc23070, "42 ft in some cases, such as retaining a Tier 1 or Tier 2 tree, or three or more principal units with a 20 ft front setback."),
        rule("Front setback", "15 ft with one or two units (10 ft with three or more)", SRC.smc23090),
        rule("Rear setback", "15 ft with one or two principal units (10 ft with three or more; none when it abuts an alley)", SRC.smc23090, "ADU rear setback is 5 ft."),
        rule("Side setbacks", "5 ft average, 3 ft minimum", SRC.smc23090, "3 ft on lots under 5,000 sf in frequent transit service areas."),
        rule("Dwelling units per lot", "The greater of 1 per 1,250 sf of lot area or 4 units; 6 near a major transit stop or with two affordable units", SRC.sdciNR, "Counts principal and accessory units. Reduced on lots with critical areas."),
        rule("ADUs", "Up to 2 per lot, attached, detached or stacked; 1,000 sf gross floor area (1,200 sf with three or more bedrooms)", SRC.smc42022, "Detached ADU height follows the principal house limit. No parking required for ADUs."),
        verify("Permit-exempt accessory structures", SRC.smc2344, "Seattle exemption thresholds live in the building code, not the zoning chapter. Verify with SDCI.")
      ],
      sources: [SRC.smc2344pdf, SRC.sdciNR, SRC.smc2344]
    };
  }

  /* ---- King County unincorporated, urban R-1 to R-8 ---- */
  var KC_URBAN = { "R-1": { street: 20, interior: 5, h: 35, imp: 0.08, impNote: "30% allowed under condition 12" }, "R-4": { street: 10, interior: 5, h: 35, imp: 0.55 }, "R-6": { street: 10, interior: 5, h: 35, imp: 0.70 }, "R-8": { street: 10, interior: 5, h: 35, imp: 0.75 } };
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
        rule("Maximum impervious surface", Math.round(z.imp * 100) + "% = about " + fmt(imp) + " sf" + (z.impNote ? " (" + z.impNote + ")" : ""), SRC.kc09h, "Roof, driveway, patios and walks all count.", imp),
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

  /* ---- City of Kenmore R-4 and R-6 (KMC 18.21.030 Table B) ---- */
  var KEN = { "R-1": { imp: 0.30, impMax: 0.30, h: 35, street: 20, side: 5, rear: 5 }, "R-4": { imp: 0.45, impMax: 0.55, h: 35, street: 15, side: 7.5, rear: 20 }, "R-6": { imp: 0.60, impMax: 0.70, h: 35, street: 15, side: 7.5, rear: 20 } };
  function kenmore(v) {
    // Table B note 7: an R-1 lot under 15,000 sf uses the R-4 standards.
    if (v.zone === "R-1" && v.lot && v.lot < 15000) return kenmore({ lot: v.lot, zone: "R-4", from: "R-1" });
    var z = KEN[v.zone];
    if (!z || !v.lot) return null;
    var imp = Math.round(z.imp * v.lot), impMax = Math.round(z.impMax * v.lot);
    return {
      key: "kenmore", title: "City of Kenmore, " + (v.from ? v.from + " (R-4 standards apply on lots under 15,000 sf, Table B note 7)" : v.zone),
      floorCap: null, floorCapLabel: "Table B sets no floor area ratio. Setbacks, height and impervious surface limit size.",
      coverage: null, impervious: imp, imperviousMax: impMax,
      setbacks: { front: z.street, rear: z.rear, side: z.side },
      sideNote: v.zone === "R-1" ? "" : "5 ft minimum each side, 15 ft combined. The diagram splits it 7.5 ft and 7.5 ft; you can shift it, say 5 ft and 10 ft.",
      rules: [
        rule("Street setback", z.street + " ft", SRC.kmc21030, v.zone === "R-1" ? "" : "Note 8: 10 ft if the development provides alleys or is townhouses."),
        rule("Garage driveway apron", "At least 20 linear ft of driveway between a garage, carport or fenced parking area and the street line", SRC.kmc21030, "Note 9, measured along the driveway centerline. A shop with a vehicle door facing the street should plan for this."),
        rule("Side setbacks", v.zone === "R-1" ? "5 ft" : "5 ft minimum each side, 15 ft combined", SRC.kmc21030, v.zone === "R-1" ? "" : "Note 11."),
        rule("Rear setback", z.rear + " ft", SRC.kmc21030),
        rule("Maximum height", "35 ft", SRC.kmc21030),
        rule("Impervious surface", Math.round(z.imp * 100) + "% base = " + fmt(imp) + " sf; " + Math.round(z.impMax * 100) + "% maximum = " + fmt(impMax) + " sf", SRC.kmc21030, "Note 14: applies to each lot. The higher number needs approved low impact development measures. Roofs, driveways, patios and walks all count.", imp),
        rule("Density", v.zone === "R-1" ? "1 unit per acre" : v.zone === "R-4" ? "4 units per acre base, 6 maximum with incentives" : "6 units per acre base, 9 maximum with incentives", SRC.kmc21030),
        rule("ADUs (state law)", "Cities inside the urban growth area must allow two ADUs per lot", SRC.hb1337, "RCW 36.70A.681, from HB 1337. Kenmore's own ADU size and design limits are in a KMC chapter we did not verify; ask Kenmore Development Services."),
        verify("Accessory building size limits", SRC.kmc21030, "Kenmore accessory building rules are in other KMC chapters we did not verify for this release. Verify with Kenmore Development Services."),
        verify("Critical areas buffers and setbacks", SRC.kmcCrit, "If the site is in or near a landslide or erosion hazard area, Kenmore's critical areas code can add buffers, building setbacks and a geotechnical report. Verify with the city.")
      ],
      sources: [SRC.kmc21030, SRC.kmcCrit, SRC.kmcSmp]
    };
  }

  function pick(v) {
    var z = String(v.zone || "").toUpperCase().replace(/\s+/g, "");
    if (v.juris === "seattle") {
      if (/^NR[123]?$/.test(z)) return seattleNR({ lot: v.lot, units: v.units, zone: z === "NR" ? "NR" : z });
      return null;
    }
    if (v.juris === "kenmore") { z = z.replace(/^R-?(\d)$/, "R-$1"); if (KEN[z]) return kenmore({ lot: v.lot, zone: z }); return null; }
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
