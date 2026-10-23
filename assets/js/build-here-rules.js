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


  /* ---- Cities inside King and Snohomish counties ----
     One entry per incorporated city. "zones" holds only the residential zones
     whose numbers we read on the city's own code page; every other zone gets
     the state-law floor (HB 1110 and HB 1337) plus links to the city code. */
  var EC = "https://ecode360.com/", MC = ".municipal.codes";
  function C(name, county, tier, home, code, codeLabel, extra) {
    var o = { name: name, county: county, tier: tier, home: home, code: { label: codeLabel || (name + " Municipal Code"), url: code }, checked: CHECKED };
    for (var k in extra || {}) o[k] = extra[k];
    return o;
  }
  var CITY = {
    algona: C("Algona", "King", 3, "https://www.algonawa.gov", "https://algona" + MC),
    auburn: C("Auburn", "King", 1, "https://www.auburnwa.gov", "https://auburn" + MC),
    beauxarts: C("Beaux Arts Village", "King", 3, "https://www.beauxarts-wa.gov", EC + "BE4791"),
    bellevue: C("Bellevue", "King", 1, "https://bellevuewa.gov/city-government/departments/development", "https://bellevue" + MC + "/LUC", "Bellevue Land Use Code"),
    blackdiamond: C("Black Diamond", "King", 3, "https://www.blackdiamondwa.gov", "https://library.municode.com/wa/black_diamond"),
    bothell: C("Bothell", "King and Snohomish", 2, "https://www.bothellwa.gov", "https://bothell" + MC + "/BMC/12", "Bothell Municipal Code Title 12", { gis: { url: "https://gisweb.bothellwa.gov/hosting1/rest/services/Public/COBMap_Planning_Development_Services/MapServer/30", field: "ZONING", name: "City of Bothell zoning map" } }),
    burien: C("Burien", "King", 2, "https://www.burienwa.gov", "https://www.codepublishing.com/WA/Burien/"),
    carnation: C("Carnation", "King", 0, "https://www.carnationwa.gov", "https://library.municode.com/wa/carnation"),
    clydehill: C("Clyde Hill", "King", 3, "https://www.clydehill.org", EC + "CL4389"),
    covington: C("Covington", "King", 3, "https://www.covingtonwa.gov", "https://covington" + MC),
    desmoines: C("Des Moines", "King", 2, "https://www.desmoineswa.gov", EC + "DE4408"),
    duvall: C("Duvall", "King", 0, "https://www.duvallwa.gov", "https://library.municode.com/wa/duvall"),
    enumclaw: C("Enumclaw", "King", 0, "https://www.enumclawwa.gov", EC + "EN4429"),
    federalway: C("Federal Way", "King", 1, "https://www.federalwaywa.gov", "https://www.codepublishing.com/WA/FederalWay/", "Federal Way Revised Code"),
    huntspoint: C("Hunts Point", "King", 3, "https://huntspoint-wa.gov", EC + "HU4811"),
    issaquah: C("Issaquah", "King", 2, "https://www.issaquahwa.gov", "https://issaquah" + MC),
    kent: C("Kent", "King", 1, "https://www.kentwa.gov", "https://www.codepublishing.com/WA/Kent/", "Kent City Code"),
    kirkland: C("Kirkland", "King", 1, "https://www.kirklandwa.gov", "https://kirkland" + MC + "/KZC", "Kirkland Zoning Code"),
    lakeforestpark: C("Lake Forest Park", "King", 3, "https://www.cityoflfp.gov", EC + "LA4507"),
    maplevalley: C("Maple Valley", "King", 2, "https://www.maplevalleywa.gov", EC + "MA4525"),
    medina: C("Medina", "King", 3, "https://www.medina-wa.gov", "https://library.municode.com/wa/medina"),
    mercerisland: C("Mercer Island", "King", 2, "https://www.mercerisland.gov", "https://library.municode.com/wa/mercer_island/codes/city_code", "Mercer Island City Code Title 19"),
    milton: C("Milton", "King and Pierce", 3, "https://www.miltonwa.gov", EC + "MI4540"),
    newcastle: C("Newcastle", "King", 3, "https://newcastlewa.gov", EC + "NE4556"),
    normandypark: C("Normandy Park", "King", 3, "https://www.normandyparkwa.gov", "https://www.codepublishing.com/WA/NormandyPark/"),
    northbend: C("North Bend", "King", 0, "https://www.northbendwa.gov", EC + "NO4565"),
    pacific: C("Pacific", "King and Pierce", 3, "https://www.pacificwa.gov", EC + "PA4576"),
    redmond: C("Redmond", "King", 2, "https://www.redmond.gov", "https://redmond" + MC + "/RZC", "Redmond Zoning Code"),
    renton: C("Renton", "King", 1, "https://www.rentonwa.gov", "https://www.codepublishing.com/WA/Renton/", "Renton Municipal Code"),
    sammamish: C("Sammamish", "King", 2, "https://www.sammamish.us", "https://sammamish" + MC),
    seatac: C("SeaTac", "King", 2, "https://www.seatacwa.gov", EC + "SE4633"),
    shoreline: C("Shoreline", "King", 2, "https://www.shorelinewa.gov", EC + "SH4640"),
    skykomish: C("Skykomish", "King", 0, "https://skykomishwa.gov", EC + "SK4829"),
    snoqualmie: C("Snoqualmie", "King", 0, "https://www.snoqualmiewa.gov", EC + "SN4645"),
    tukwila: C("Tukwila", "King", 3, "https://www.tukwilawa.gov", EC + "47305965", "Tukwila Municipal Code Title 18"),
    woodinville: C("Woodinville", "King", 3, "https://www.woodinvillewa.gov", "https://www.codepublishing.com/WA/Woodinville/", "Woodinville Municipal Code", { gis: { url: "https://services8.arcgis.com/OQPRCxZXJewOd2xW/arcgis/rest/services/ZoningDataView/FeatureServer/0", field: "ZONING", name: "City of Woodinville zoning map" } }),
    yarrowpoint: C("Yarrow Point", "King", 3, "https://yarrowpointwa.gov", EC + "YA4848"),
    arlington: C("Arlington", "Snohomish", 3, "https://www.arlingtonwa.gov", "https://library.municode.com/wa/arlington", null, { gis: { url: "https://services3.arcgis.com/nPsPH23NWoWmXQgb/arcgis/rest/services/Official_Zoning/FeatureServer/0", field: "LAYER", name: "City of Arlington zoning map" } }),
    brier: C("Brier", "Snohomish", 3, "https://www.brierwa.gov", EC + "BR4364"),
    darrington: C("Darrington", "Snohomish", 0, "https://townofdarrington.com", "https://townofdarrington.com/Departments/municipal-code/", "Darrington Municipal Code"),
    everett: C("Everett", "Snohomish", 1, "https://www.everettwa.gov", "https://everett" + MC + "/EMC/19", "Everett Municipal Code Title 19", { gis: { url: "https://gismaps.everettwa.gov/manarcgis/rest/services/Planning/Planning_and_Zoning_Assessor_Access/MapServer/59", field: "Zone", name: "City of Everett zoning map" } }),
    goldbar: C("Gold Bar", "Snohomish", 0, "https://cityofgoldbar.us", "https://cityofgoldbar.us/city-government/municipal-code/"),
    granitefalls: C("Granite Falls", "Snohomish", 0, "https://www.ci.granite-falls.wa.us", EC + "GR4467", null, { gis: { url: "https://services6.arcgis.com/jKx0TrmHfSkeebdK/arcgis/rest/services/Zoning/FeatureServer/0", field: "ZoningCode", name: "City of Granite Falls zoning map" } }),
    index: C("Index", "Snohomish", 0, "https://www.indexwa.gov", EC + "IN4812"),
    lakestevens: C("Lake Stevens", "Snohomish", 2, "https://www.lakestevenswa.gov", EC + "LA4738", null, { gis: { url: "https://services.arcgis.com/gr7sYYW0YAciUIIG/arcgis/rest/services/Zoning_August_2021/FeatureServer/0", field: "Zoning", name: "City of Lake Stevens zoning map (August 2021 layer)" } }),
    lynnwood: C("Lynnwood", "Snohomish", 2, "https://www.lynnwoodwa.gov", "https://lynnwood" + MC + "/LMC", "Lynnwood Municipal Code", { gis: { url: "https://services2.arcgis.com/W2b0jYHWnOivta60/arcgis/rest/services/Future_Zones_Draft_4_25/FeatureServer/0", field: "Future_Zon", name: "City of Lynnwood zoning map (2025 zone update layer)" } }),
    marysville: C("Marysville", "Snohomish", 2, "https://www.marysvillewa.gov", EC + "MA4529", null, { gis: { url: "https://services2.arcgis.com/ZASkNq1SMoPvFBOv/arcgis/rest/services/Zoning_AGOL1/FeatureServer/3", field: "Zoning_Abbreviation", name: "City of Marysville zoning map" } }),
    millcreek: C("Mill Creek", "Snohomish", 3, "https://millcreekwa.gov", EC + "MI4537"),
    monroe: C("Monroe", "Snohomish", 0, "https://www.monroewa.gov", "https://monroe" + MC, null, { gis: { url: "https://gis.monroewa.gov/citygis/rest/services/Zoning_Map_MIL1/MapServer/8", field: "Zone", name: "City of Monroe zoning map" } }),
    mountlaketerrace: C("Mountlake Terrace", "Snohomish", 3, "https://www.cityofmlt.com", EC + "MO4549", null, { gis: { url: "https://services.arcgis.com/efPDmjgxOd3NdvZV/arcgis/rest/services/Zoning_Master_July2026_Sara_Legend/FeatureServer/0", field: "Zoning", name: "City of Mountlake Terrace zoning map (July 2026)" } }),
    mukilteo: C("Mukilteo", "Snohomish", 3, "https://www.mukilteowa.gov", EC + "MU4552", null, { gis: { url: "https://services2.arcgis.com/csauTsCJzwR6Erxa/arcgis/rest/services/Current_Zoning_for_Mukilteo/FeatureServer/0", field: "Zoning_Abbrev", name: "City of Mukilteo current zoning map" } }),
    snohomish: C("Snohomish", "Snohomish", 0, "https://www.snohomishwa.gov", "https://snohomish" + MC, null, { gis: { url: "https://services9.arcgis.com/hUiJ0kKwHN6Cf0DY/arcgis/rest/services/Zoning/FeatureServer/3", field: "Label", name: "City of Snohomish zoning map" } }),
    stanwood: C("Stanwood", "Snohomish", 0, "https://www.stanwoodwa.org", "https://stanwood" + MC, null, { gis: { url: "https://services1.arcgis.com/D6kuB4ZPsSI0QrTo/arcgis/rest/services/Zoning_2024/FeatureServer/1", field: "Zoning", name: "City of Stanwood zoning map (2024)", nodist: true } }),
    sultan: C("Sultan", "Snohomish", 0, "https://www.sultanwa.gov", EC + "SU4661", null, { gis: { url: "https://services8.arcgis.com/bdC8g7hf3OZLaPBm/arcgis/rest/services/City_of_Sultan_Zoning_Map__2025__WFL1/FeatureServer/0", field: "Zoning_2024", name: "City of Sultan zoning map (2025)" } }),
    woodway: C("Woodway", "Snohomish", 3, "https://www.townofwoodway.com", EC + "WO4846", null, { gis: { url: "https://services7.arcgis.com/VvsBv7Vn1kZ2wCCG/arcgis/rest/services/ToW_Zoning/FeatureServer/0", field: "ZONE_LABEL", name: "Town of Woodway zoning map" } })
  };

  SRC.hb1110 = { label: "RCW 36.70A.635 (middle housing from HB 1110)", url: "https://app.leg.wa.gov/RCW/default.aspx?cite=36.70A.635" };
  SRC.smaRcw = { label: "RCW 90.58 Shoreline Management Act", url: "https://app.leg.wa.gov/RCW/default.aspx?cite=90.58" };
  function S(label, url) { return { label: label, url: url }; }
  var CS = {
    lynnwood: S("LMC 8.30.0320 RN zone development standards", "https://lynnwood.municipal.codes/LMC/8.30.0320"),
    bothell: S("BMC 12.14.030 residential densities and dimensions", "https://bothell.municipal.codes/BMC/12.14.030"),
    shoreline: S("SMC 20.50.020 Table 20.50.020(1) residential dimensions", EC + "49767813"),
    mlt: S("MTMC 19.30.030 residential development standards", EC + "48222451"),
    millcreek: S("MCMC 17.04 neighborhood residential standards", EC + "50645678"),
    everett: S("EMC 19.06.020 and 19.22.020 residential standards", "https://everett.municipal.codes/EMC/19.06.020"),
    mukilteo: S("MMC 17.20.030 and 17.20.040 bulk regulations", EC + "47466898"),
    lfp722: S("LFPMC 18.22 RS-7.2 zone", EC + "49978959"),
    lfp96: S("LFPMC 18.21 RS-9.6 zone", EC + "49978934"),
    woodinville: S("WMC 21.32 residential development standards", "https://www.codepublishing.com/WA/Woodinville/html/Woodinville21/Woodinville2132.html"),
    kirkland: S("KZC 15.30 RS, RSX and RSA standards", "https://kirkland.municipal.codes/KZC/15.30"),
    redmond: S("RZC 21.08.200 Neighborhood Residential", "https://redmond.municipal.codes/RZC/21.08.200"),
    redmondSb: S("RZC 21.16.200 setbacks", "https://redmond.municipal.codes/RZC/21.16.200"),
    bellevue: S("LUC 20.20.538 middle housing standards", "https://bellevue.municipal.codes/LUC/20.20.538"),
    bellevueChart: S("LUC 20.20.010 dimensional chart", "https://bellevue.municipal.codes/LUC/20.20.010"),
    renton: S("RMC 4-2-110A residential development standards", "https://www.codepublishing.com/WA/Renton/html/Renton04/Renton0402/Renton0402110.html"),
    sammamish: S("SMC 21.04.030 residential densities and dimensions", "https://sammamish.municipal.codes/SMC/21.04.030"),
    issaquah: S("IMC 18.404.090 single family dimensional standards", "https://issaquah.municipal.codes/IMC/18.404.090")
  };

  /* Zone tables. f/r/s = front, rear, side setback in feet; cov and imp are
     fractions of lot area; far(units) is a floor area ratio; h is height text.
     A missing value means "verify with the city". */
  var CZ = {
    lynnwood: { src: CS.lynnwood, zones: {
      RN: { label: "Residential Neighborhood (RN)", f: 10, r: 5, s: 5, h: "35 ft", far: function (u) { return [0.6, 0.8, 1.0, 1.2][Math.min(Math.max(u, 1), 4) - 1]; }, farTxt: "FAR 0.6 for one unit, 0.8 for two, 1.0 for three, 1.2 for four", units: "3 units per lot; 4 with one affordable unit (80% AMI owned, 60% AMI rented) or within 1/4 mile of a major transit stop", lot: "6,000 sf, 50 ft wide", note: "Street setback 10 ft, interior lot lines 5 ft, 10 ft between buildings. Cottage housing lot coverage 50%." } } },
    bothell: { src: CS.bothell, zones: {
      "R-L1": { label: "Residential Low (R-L1)", f: 15, r: 15, s: 5, h: "35 ft", imp: 0.55, units: "Middle housing: 4 units per lot, 6 near major transit or with affordable units", lot: "6,000 sf", note: "Front 20 ft to a garage door. Rear 0 ft on an alley, 3 ft to an alley-loaded garage." },
      "R-L2": { label: "Residential Low (R-L2)", f: 15, r: 15, s: 5, h: "35 ft", imp: 0.6, units: "Middle housing: 4 units per lot, 6 near major transit or with affordable units", lot: "3,600 sf", note: "Front 20 ft to a garage door. Rear 0 ft on an alley, 3 ft to an alley-loaded garage." } },
      alias: { "RL1": "R-L1", "RL2": "R-L2" } },
    shoreline: { src: CS.shoreline, zones: {
      NR3: { label: "Neighborhood Residential 3 (NR3)", f: 10, r: 10, s: 5, h: "23 ft (28 ft with a pitched roof)", imp: 0.5, units: "3 units per lot or 1 per 2,400 sf", lot: "7,200 sf", note: "Garage door 20 ft from the street (10 ft on an alley). Hardscape 50% of the lot." },
      NR2: { label: "Neighborhood Residential 2 (NR2)", f: 10, r: 10, s: 5, h: "30 ft (35 ft with a pitched roof)", imp: 0.5, imp2: 0.6, units: "4 units per lot or 1 per 1,250 sf", lot: "5,000 sf", note: "Garage door 20 ft from the street (10 ft on an alley). Hardscape 50%, or 60% with two or more units." },
      NR1: { label: "Neighborhood Residential 1 (NR1)", r: 5, s: 5, h: "35 ft (40 ft with a pitched roof)", imp: 0.5, imp2: 0.75, units: "At least 1 unit per 2,500 sf, no maximum", note: "Front and side setbacks are set in the table footnotes. Hardscape 50%, or 75% with two or more units." } } },
    mountlaketerrace: { src: CS.mlt, zones: {
      "R-1": { label: "Residential (R-1)", f: 15, r: 15, s: 5, h: "35 ft at the front (3 stories)", cov: 0.45, far: function (u) { return u > 1 ? 0.6 : 0.5; }, farTxt: "FAR 0.5 for one unit, 0.6 for two or more", units: "1 unit per 2,400 sf", note: "Two ADUs allowed on any lot." },
      "R-2": { label: "Residential (R-2)", f: 15, r: 15, h: "35 ft at the front (3 stories)", cov: 0.5, far: function (u) { return [0.5, 0.6, 0.8, 1.0][Math.min(Math.max(u, 1), 4) - 1]; }, farTxt: "FAR 0.5 for one unit, 0.6 for two, 0.8 for three, 1.0 for four or more", units: "1 unit per 1,200 sf", lot: "4,800 sf", note: "Front and rear 15 ft for one or two units, 10 ft for three or more. Two ADUs allowed on any lot." } },
      alias: { "R1": "R-1", "R2": "R-2" } },
    millcreek: { src: CS.millcreek, zones: {
      NR: { label: "Neighborhood Residential", f: 15, r: 20, s: 5, h: "35 ft", cov: 0.35, lot: "7,200 sf", note: "Front 20 ft to a garage. Rear 20 ft or 20% of lot depth, at least 10 ft. Townhouse coverage 55%." } },
      alias: { "RS": "NR", "R7200": "NR" } },
    everett: { src: CS.everett, zones: {
      NR: { label: "Neighborhood Residential (NR)", f: 10, r: 5, s: 5, h: "35 ft", cov: 0.5, units: "Middle housing under the state Tier 1 rule", lot: "5,000 sf", note: "Coverage rises 5% for two units, 10% for three or more. No rear setback on an alley. Street side 5 ft. Detached ADU height 18 ft, 24 ft on an alley." },
      "NR-C": { label: "Neighborhood Residential Corridor (NR-C)", f: 20, r: 20, s: 5, h: "35 ft", cov: 0.35, lot: "9,000 sf", note: "Street side 10 ft." } },
      alias: { "NRC": "NR-C" } },
    mukilteo: { src: CS.mukilteo, zones: {
      "RD12.5": { label: "RD 12.5", f: 25, r: 25, s: 5, h: "30 ft", cov: 0.3, lot: "12,500 sf" },
      "RD12.5(S)": { label: "RD 12.5(S)", f: 20, r: 5, s: 5, h: "35 ft", cov: 0.35, lot: "12,500 sf" },
      "RD9.6(S)": { label: "RD 9.6(S)", f: 20, r: 5, s: 5, h: "35 ft", cov: 0.35, lot: "9,600 sf" },
      "RD9.6": { label: "RD 9.6", f: 25, r: 20, s: 5, h: "30 ft", cov: 0.35, lot: "9,600 sf" },
      "RD8.4": { label: "RD 8.4", f: 20, r: 5, s: 5, h: "35 ft", cov: 0.35, lot: "8,400 sf" },
      "RD7.5": { label: "RD 7.5", f: 20, r: 20, s: 5, h: "30 ft", cov: 0.35, lot: "7,500 sf", note: "Rear 15 ft on a corner lot." },
      "RD7.2": { label: "RD 7.2", f: 20, r: 5, s: 5, h: "35 ft", cov: 0.35, lot: "7,200 sf" } },
      common: { units: "Each lot may have one duplex, or one house plus up to two ADUs" } },
    lakeforestpark: { zones: {
      "RS-7.2": { src: CS.lfp722, label: "RS-7.2", f: 20, r: 15, s: 5, h: "30 ft", cov: 0.35, imp: 0.45, lot: "7,200 sf, 60 ft wide", sideTxt: "15 ft combined, 5 ft minimum" },
      "RS-9.6": { src: CS.lfp96, label: "RS-9.6", f: 20, r: 15, s: 5, h: "30 ft", cov: 0.3, imp: 0.45, lot: "9,600 sf, 70 ft wide", sideTxt: "15 ft combined, 5 ft minimum" } },
      alias: { "RS7200": "RS-7.2", "RS72": "RS-7.2", "RS9600": "RS-9.6", "RS96": "RS-9.6" },
      common: { units: "Middle housing of two units per lot" } },
    woodinville: { src: CS.woodinville, zones: (function () { var o = {}; ["R-1", "R-4", "R-6", "R-8"].forEach(function (z) { o[z] = { label: z, f: 10, s: z === "R-1" ? 10 : 5, h: "35 ft", note: "Street setback 10 ft, 20 ft to a garage. Lot coverage depends on lot size; see WMC 21.32." + (z === "R-1" ? " R-1 interior setback is 5 ft on lots under 15,000 sf." : "") }; }); return o; })(),
      alias: { "R1": "R-1", "R4": "R-4", "R6": "R-6", "R8": "R-8" } },
    kirkland: { src: CS.kirkland, zones: (function () { var o = {}; ["5.0", "6.3", "7.2", "8.5", "12.5", "35"].forEach(function (n) { o["RS" + n] = { label: "RS " + n, f: 20, r: 10, s: 5, h: "25 ft above average building elevation", cov: 0.5, sideTxt: "5 ft minimum, 15 ft combined", farSmall: true }; o["RSX" + n] = { label: "RSX " + n, f: 20, r: 10, s: 5, h: "30 ft above average building elevation", cov: 0.5, sideTxt: "5 ft minimum, 15 ft combined", farSmall: true }; }); return o; })() },
    redmond: { src: CS.redmond, zones: {
      NR: { label: "Neighborhood Residential (NR)", h: "38 ft", cov: 0.5, imp: 0.7, gfa: true, units: "6 units per lot, 8 with one affordable unit", lot: "3,000 sf average, 20 ft of frontage", note: "Open space 20% of the lot. Coverage 60% on lots of 18,000 sf or less with three or more units. Setbacks are in RZC 21.16.200." } } },
    bellevue: { src: CS.bellevue, zones: (function () {
      var o = {}, ord = ["LL-1", "LL-2", "SR-1", "SR-2", "SR-3", "SR-4", "LDR-1", "LDR-2", "LDR-3", "MDR-1", "MDR-2"];
      ord.forEach(function (z, i) {
        o[z] = { label: z, f: z === "LL-1" ? 25 : z === "LL-2" ? 20 : 10, r: i <= 3 ? 15 : 10, s: 5, h: "32 ft flat roof, 35 ft pitched", cov: i <= 4 ? 0.4 : 0.45, imp: i <= 4 ? 0.5 : i <= 6 ? 0.6 : 0.65, units: "Middle housing: 4 units per lot, 6 near major transit or with affordable units; up to 2 ADUs", mh: true };
      });
      return o; })() },
    renton: { src: CS.renton, zones: {
      "R-4": { label: "R-4", f: 30, r: 25, s: 7.5, sideTxt: "20 ft combined, 7.5 ft minimum", h: "3 stories, 32 ft wall plate", cov: 0.35, imp: 0.5, lot: "9,000 sf" },
      "R-6": { label: "R-6", f: 25, r: 25, s: 5, sideTxt: "15 ft combined, 5 ft minimum", h: "2 stories, 24 ft wall plate", cov: 0.4, imp: 0.55, lot: "7,000 sf" },
      "R-8": { label: "R-8", f: 20, s: 5, h: "2 stories, 24 ft wall plate", cov: 0.5, imp: 0.65, lot: "5,000 sf", note: "Front 15 ft on an alley-loaded lot." } },
      alias: { "R4": "R-4", "R6": "R-6", "R8": "R-8" }, common: { units: "Middle housing under the state Tier 1 rule; see RMC 4-2-110F" } },
    sammamish: { src: CS.sammamish, zones: {
      "R-4": { label: "R-4", h: "35 ft", imp: 0.4, farPct: 0.5, sizeSb: true },
      "R-6": { label: "R-6", h: "35 ft", imp: 0.5, farPct: 0.5, sizeSb: true },
      "R-8": { label: "R-8", f: 10, r: 20, s: 5, h: "35 ft", imp: 0.75 } },
      alias: { "R4": "R-4", "R6": "R-6", "R8": "R-8" }, common: { note2: "Detached ADU height 24 ft, side and rear setbacks 5 ft." } },
    issaquah: { src: CS.issaquah, zones: {
      "SF-E": { label: "Single Family Estate (SF-E)", f: 30, r: 30, s: 15, h: "30 ft", imp: 0.3, lot: "35,000 sf" },
      "SF-S": { label: "Single Family Suburban (SF-S)", f: 20, r: 10, s: 8, h: "30 ft", imp: 0.4, lot: "9,600 sf" },
      "SF-SL": { label: "Single Family Small Lot (SF-SL)", f: 10, r: 20, s: 6, h: "30 ft", imp: 0.5 },
      "SF-D": { label: "Single Family Duplex (SF-D)", f: 10, r: 10, s: 6, h: "25 ft or 2 stories", imp: 0.5, lot: "6,000 sf" } },
      alias: { "SFE": "SF-E", "SFS": "SF-S", "SFSL": "SF-SL", "SFD": "SF-D" }, common: { units: "Middle housing: 2 units per lot, 4 near major transit or with affordable units" } }
  };

  function canon(z) { return String(z || "").toUpperCase().replace(/[\s_\-]/g, ""); }
  function cityKey(name) { return String(name || "").toLowerCase().replace(/\bvillage\b|\bcity of\b|\btown of\b/g, "").replace(/[^a-z]/g, ""); }
  function findZone(key, zone) {
    var t = CZ[key]; if (!t || !zone) return null;
    var c = canon(zone), k;
    for (k in t.zones) if (canon(k) === c) return k;
    if (t.alias) for (k in t.alias) if (canon(k) === c) return t.alias[k];
    return null;
  }
  var TIER = {
    1: "Tier 1 city (75,000 people or more): at least 4 units per lot, 6 within 1/4 mile of a major transit stop or with two affordable units",
    2: "Tier 2 city (25,000 to 75,000 people): at least 2 units per lot, 4 within 1/4 mile of a major transit stop or with one affordable unit",
    3: "Tier 3 city (under 25,000 people, inside the urban growth area next to a large city): at least 2 units per lot"
  };
  function stateRows(c) {
    return [
      c.tier ? rule("Middle housing (state law)", TIER[c.tier], SRC.hb1110, "RCW 36.70A.635. The city's adopted code sets the details; read it before you count units.") : verify("Middle housing (state law)", SRC.hb1110, c.name + " is not on the state middle housing list (HB 1110 covers cities by size and location). Ask the city what its own code allows."),
      rule("ADUs (state law)", "Cities inside the urban growth area must allow two ADUs per lot", SRC.hb1337, "RCW 36.70A.680 and .681. Ask the city for its ADU size limits and any area outside the urban growth area.")
    ];
  }
  function tailRows(c) {
    return [
      verify("Critical areas", c.code, "Steep slopes, wetlands, streams and landslide areas add buffers and studies. The map check on the summary page is a start, not a decision."),
      verify("Shoreline", SRC.smaRcw, "Land within 200 ft of a lake, large stream or Puget Sound follows the city's Shoreline Master Program. Verify with the city.")
    ];
  }

  function cityRules(v) {
    var key = v.city, c = CITY[key];
    if (!c) return null;
    var t = CZ[key], zk = findZone(key, v.zone), lot = v.lot, units = v.units || 1;
    var cityLink = { label: "City of " + c.name + " permits and planning", url: c.home };
    if (!zk) {
      return {
        key: "city-" + key + "-base", title: "City of " + c.name + (v.zone ? ", zone " + v.zone : ""), city: c,
        floorCap: null, floorCapLabel: "We have not coded this zone's floor area, coverage or setback numbers yet. Read them in the city code, linked below.",
        coverage: null, impervious: null, setbacks: {},
        rules: [verify("Zone standards (height, setbacks, coverage)", c.code, "We did not verify " + c.name + "'s numbers for " + (v.zone ? "zone " + v.zone : "this zone") + ". Read the zone chapter in the city code or ask the permit counter.")].concat(stateRows(c), tailRows(c), [rule("Permit office", "City of " + c.name, cityLink, "Ask for a pre-application meeting before design.")]),
        sources: [c.code, SRC.hb1110, SRC.hb1337, cityLink],
        caveat: "First pass for " + c.name + ": state law floor plus links. Zone numbers are not coded for this zone yet."
      };
    }
    var Z = t.zones[zk], cm = t.common || {}, src = Z.src || t.src;
    var rows = [], cap = null, capLabel = "", cov = Z.cov ? Math.round(Z.cov * lot) : null;
    var impF = (Z.imp2 && units > 1) ? Z.imp2 : Z.imp, imp = impF ? Math.round(impF * lot) : null;
    if (Z.far) { var far = Z.far(units); cap = Math.round(far * lot); capLabel = "FAR " + far + " x " + fmt(lot) + " sf lot for " + (units === 1 ? "one unit" : units + " units"); rows.push(rule("Maximum floor area (FAR)", fmt(cap) + " sf", src, Z.farTxt, cap)); }
    else if (Z.gfa) { var u = Math.min(Math.max(units, 1), 8); cap = 4500 + 1500 * (u - 1); capLabel = "4,500 sf plus 1,500 sf per added unit, for " + u + (u === 1 ? " unit" : " units"); rows.push(rule("Maximum total floor area", fmt(cap) + " sf", src, "4,500 sf for one unit plus 1,500 sf for each added unit, 15,000 sf at eight units.", cap)); }
    else if (Z.farPct) { cap = Math.round(Z.farPct * lot); capLabel = "FAR 0.5 x " + fmt(lot) + " sf lot (single family)"; rows.push(rule("Maximum floor area (FAR)", fmt(cap) + " sf", src, "Floor area ratio 50% for a single family house.", cap)); }
    else if (Z.farSmall && lot < 7200) { cap = Math.round(0.5 * lot); capLabel = "FAR 50% x " + fmt(lot) + " sf lot (lots under 7,200 sf)"; rows.push(rule("Maximum floor area (FAR)", fmt(cap) + " sf", src, "50% on lots under 7,200 sf, 60% with pitched roofs. Larger lots use other FAR rules in the chapter.", cap)); }
    else rows.push(verify("Maximum floor area", src, Z.farSmall ? "FAR depends on lot size for lots of 7,200 sf or more. Read the chapter." : "We did not find a floor area ratio in this zone's table, or it depends on other factors."));
    rows.push(rule("Maximum height", Z.h, src));
    if (Z.sizeSb) {
      var big = key === "sammamish" && zk === "R-4";
      rows.push(rule("Setbacks by house size", "Under 2,500 sf: front 15, side 5, rear 15 (12 min). 2,500 to 4,000 sf: front " + (big ? 20 : 15) + ", side 10 average (8 min), rear " + (big ? 20 : 15) + ". Over 4,000 sf: front " + (big ? 25 : 20) + ", side " + (big ? 12 : 10) + ", rear " + (big ? 25 : 20) + ".", src, "Feet. The diagram uses the smallest house size row."));
      Z = Object.assign({}, Z, { f: 15, r: 15, s: 5 });
    } else {
      rows.push(Z.f != null ? rule("Front setback", Z.f + " ft", src) : verify("Front setback", src));
      rows.push(Z.s != null ? rule("Side setbacks", Z.sideTxt || (Z.s + " ft"), src) : verify("Side setbacks", key === "redmond" ? CS.redmondSb : src));
      rows.push(Z.r != null ? rule("Rear setback", Z.r + " ft", src) : verify("Rear setback", key === "redmond" ? CS.redmondSb : src));
    }
    rows.push(cov ? rule("Lot coverage", Math.round(Z.cov * 100) + "% = " + fmt(cov) + " sf", src, "", cov) : verify("Lot coverage", src));
    rows.push(imp ? rule(key === "bothell" ? "Hard surface" : "Impervious surface", Math.round(impF * 100) + "% = " + fmt(imp) + " sf", src, "Roofs, driveways, patios and walks count.", imp) : verify("Impervious surface", src));
    if (Z.lot) rows.push(rule("Minimum lot size", Z.lot, src));
    if (Z.units || cm.units) rows.push(rule("Units per lot", Z.units || cm.units, src));
    if (Z.note) rows.push(rule("Other limits", Z.note, src));
    if (cm.note2) rows.push(rule("Detached ADU", cm.note2, src));
    rows = rows.concat(stateRows(c), tailRows(c), [rule("Permit office", "City of " + c.name, cityLink, "Ask for a pre-application meeting before design.")]);
    return {
      key: "city-" + key, title: "City of " + c.name + ", " + Z.label, city: c,
      floorCap: cap, floorCapLabel: cap ? capLabel : "No floor area ratio coded for this zone. Setbacks, height and coverage limit size.",
      coverage: cov, impervious: imp, imperviousMax: null,
      setbacks: { front: Z.f, rear: Z.r, side: Z.s },
      sideNote: Z.sideTxt || "",
      rules: rows,
      sources: [src, c.code, SRC.hb1110, SRC.hb1337, cityLink],
      caveat: "Numbers read from the " + c.name + " code in " + CHECKED + ". Overlays, planned unit developments and plat conditions can change them."
    };
  }

  function pick(v) {
    if (v.juris === "city") return cityRules(v);
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

  var api = { pick: pick, SRC: SRC, CHECKED: CHECKED, fmt: fmt, CITY: CITY, cityKey: cityKey, findZone: findZone, zonesFor: function (k) { return CZ[k] ? Object.keys(CZ[k].zones) : []; } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BuildHereRules = api;
})(this);
