/* What can I build here? Rule tables. Every number below was read from the
   official code page linked in its source field. Last checked October 2026.
   A rule with value null means we could not confirm it and the page tells the
   visitor to verify with the jurisdiction.

   Values added in November 2026 (Redmond NR setbacks, the state ADU and parking floors, energy
   credits, asbestos and re-roof rules) carry their own source and date in a datum(): see below.
   A datum with checked: null was not read against the code text and prints with "verify".
   A missing lot size never becomes a cap of 0 sf: the builders return null caps and say so. */
(function (root) {
  "use strict";
  var CHECKED = "Oct 2026";
  var CHECKED_NOV = "Nov 2026";

  var SRC = {
    smc2344: { label: "SMC ch. 23.44 (Neighborhood Residential)", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.44NERE" },
    smc2344pdf: { label: "Seattle Ord. 127376 (CB 120993), new ch. 23.44 and amended 23.42.022, signed Dec. 22, 2025, in effect January 2026", url: "https://clerk.seattle.gov/~archives/Ordinances/Ord_127376.pdf" },
    smc2345: { label: "SMC ch. 23.45 (Lowrise multifamily)", url: "https://library.municode.com/wa/seattle/codes/municipal_code?nodeId=TIT23LAUSCO_SUBTITLE_IIILAUSRE_CH23.45MU" },
    smc2345510: { label: "SMC 23.45.510 Table A (floor area), Ord. 127376, in effect January 2026", url: "https://clerk.seattle.gov/~archives/Ordinances/Ord_127376.pdf" },
    smc2345514: { label: "SMC 23.45.514 Table A (height), Ord. 127376, in effect January 2026", url: "https://clerk.seattle.gov/~archives/Ordinances/Ord_127376.pdf" },
    smc2345518: { label: "SMC 23.45.518 Table A (setbacks), Ord. 127376, in effect January 2026", url: "https://clerk.seattle.gov/~archives/Ordinances/Ord_127376.pdf" },
    smc2358: { label: "SMC ch. 23.58B and 23.58C (Mandatory Housing Affordability)", url: "https://library.municode.com/wa/seattle/codes/municipal_code" },
    ord127376lr: { label: "Seattle Ord. 127376, current lowrise text, in effect January 2026", url: "https://clerk.seattle.gov/~archives/Ordinances/Ord_127376.pdf" },
    ecdc1630: { label: "ECDC 16.30.030 site development standards (RM zones), Ord. 4414 and Ord. 4397 (2025)", url: "https://edmonds.municipal.codes/ECDC/16.30.030" },
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
    hb1337: { label: "RCW 36.70A.680 and .681 (ADU rules from HB 1337)", url: "https://app.leg.wa.gov/RCW/default.aspx?cite=36.70A.681" },
    rcw681: { label: "RCW 36.70A.681 (limits on local ADU rules)", url: "https://app.leg.wa.gov/RCW/default.aspx?cite=36.70A.681" },
    sb5184: { label: "ESSB 5184, Laws of 2025 ch. 204 (minimum parking requirements)", url: "https://app.leg.wa.gov/billsummary?BillNumber=5184&Year=2025&Initiative=false" },
    wsecR406: { label: "2021 Washington State Energy Code, Residential, R406.3 (WAC 51-11R-40620)", url: "https://lawfilesext.leg.wa.gov/Law/WAC/WAC%20%2051%20%20TITLE/WAC%20%2051%20-%2011R%20CHAPTER/WAC%20%2051%20-%2011R-40620.htm" },
    pscaa402: { label: "Puget Sound Clean Air Agency Regulation III, Section 4.02 (asbestos survey before renovation or demolition)", url: "https://pscleanair.gov/185/Asbestos" },
    epaRrp: { label: "EPA Renovation, Repair and Painting rule (homes built before 1978)", url: "https://www.epa.gov/lead/lead-renovation-repair-and-painting-program" },
    sdciReroof: { label: "Seattle SDCI: re-roof permit", url: "https://seattle.gov/construction-and-inspections/permits/permits-we-issue-(a-z)/re-roof-permit" },
    irc908: { label: "International Residential Code R908.3.1.1 (roof recover), as cited on the MyBuildingPermit re-roof tip sheet", url: "https://mybuildingpermit.com/sites/default/files/documentation/Re-Roof.pdf" },
    sdciStorm: { label: "Seattle Stormwater Code (2026 revisions, Ord. 127444)", url: "https://www.seattle.gov/construction-and-inspections/codes/codes-we-enforce-(a-z)/stormwater-code" },
    redmondZones: { label: "City of Redmond: Residential zones summary page", url: "https://www.redmond.gov/2107/Residential-zones" }
  };

  /* Two flags on a rule set drive the option cards.
     coded: false   The zone is recognized, and its numbers are not coded here
                    (state-law floor and links only). Cards treat it as not coded.
     farNone: true  The code table itself sets no floor area ratio.
     A null floorCap without farNone means "not known here", never "none". */
  function verify(label, src, note) { return { label: label, value: null, src: src, note: note || "" }; }
  function rule(label, value, src, note, num) { return { label: label, value: value, src: src, note: note || "", num: num }; }

  /* A value with its own source and the month it was read. checked: null means it was not read against
     the code text, and the study prints it with "verify". v: null means it is not coded at all. */
  function datum(v, src, checked, note) { return { v: v == null ? null : v, src: src || null, checked: checked || null, note: note || "" }; }
  /* The lot size drives every square-foot cap. Without one the cap is null, never 0 sf. */
  function hasLot(v) { return !!v && v.lot != null && isFinite(Number(v.lot)) && Number(v.lot) > 0; }
  function capOf(frac, v) { return hasLot(v) ? Math.round(frac * Number(v.lot)) : null; }
  function pctText(frac, cap) { return Math.round(frac * 100) + "%" + (cap != null ? " = " + fmt(cap) + " sf" : " of the lot (the lot size is not on record, so no square-foot figure is shown)"); }
  function heightOf(text) { var m = String(text || "").match(/(\d+(?:\.\d+)?)\s*ft/); return { ft: m ? +m[1] : null, text: text || "" }; }
  /* The floor state law sets for ADUs inside urban growth areas, read from RCW 36.70A.681 and the
     Department of Commerce summaries in November 2026. A city can allow more, not less. */
  var ADU_STATE = {
    maxCount: 2, sizeFloorSf: 1000, heightFloorFt: 24, impactFeePct: 50, src: SRC.rcw681, checked: CHECKED_NOV,
    text: "State law sets a floor inside urban growth areas: two ADUs per lot, each allowed at least 1,000 sf and 24 ft of height, a detached ADU on a lot line that abuts a public alley, conversion of an existing garage or other structure even where it breaks today's setbacks, no owner-occupancy rule except for short-term rentals, and impact fees of no more than half the principal unit's."
  };

  /* ---- Seattle NR1, NR2, NR3 (new ch. 23.44, Ord. 127376, in effect January 2026) ---- */
  function seattleNR(v) {
    var lot = hasLot(v) ? Number(v.lot) : null, units = v.units || 1;
    var far = null, cap = null;
    if (lot != null) {
      far = 0.6; // Table A for 23.44.050: less dense than 1 unit per 4,000 sf
      var perUnit = lot / units;
      if (perUnit <= 1600) far = 1.6; else if (perUnit <= 2200) far = 1.0; else if (perUnit <= 4000) far = 0.8;
      cap = Math.round(far * lot);
      if (lot < 5000 && cap < 2500) cap = 2500;
    }
    var cov = capOf(0.5, v); // 23.44.080.A
    // The form counts homes, and a home can be a principal unit or an ADU. The 10 ft front and rear
    // setbacks need three principal units, which this page cannot tell apart, so the diagram stays at 15 ft.
    var allow = lot != null ? Math.max(4, Math.floor(lot / 1250)) : null;
    var notes = [];
    if (units >= 3) notes.push("The diagram keeps the 15 ft front and rear setbacks. With three or more principal units the code allows 10 ft. This page counts homes and cannot tell a principal unit from an ADU.");
    if (allow != null && units > allow) notes.push(units + " homes is more than this lot's base allowance of " + allow + " (the greater of 4, or 1 per 1,250 sf of lot). It needs the major transit stop or affordable unit allowance.");
    return {
      setbackNote: notes.join(" "),
      key: "seattle-nr",
      title: "City of Seattle, Neighborhood Residential (" + v.zone + ")",
      floorCap: cap,
      floorCapLabel: cap != null ? "FAR " + far + " x " + fmt(lot) + " sf lot" + (lot < 5000 ? " (lots under 5,000 sf get at least 2,500 sf)" : "") : "FAR 0.6 to 1.6 of the lot, set by lot size and the number of homes. The lot size is not on record, so no square-foot cap is shown.",
      coverage: cov,
      setbacks: { front: 15, rear: 15, side: 5, rearAlley: 0 },
      height: { ft: 32, text: "32 ft, plus 5 ft for a pitched roof at 4:12 or steeper" },
      adu: { status: "coded", maxCount: 2, maxSf: 1000, rearSetback: 5, sideSetback: null, heightFt: null, text: "Up to 2 per lot, attached, detached or stacked; 1,000 sf gross floor area (1,200 sf with three or more bedrooms); detached ADU rear setback 5 ft", src: SRC.smc42022 },
      accounting: { farIncludesGarage: null, farIncludesBasement: false, farIncludesAccessory: null, verify: true, note: "Underground stories and story portions no more than 4 ft above grade are exempt from FAR, and ADU floor area counts. Whether a garage counts is not coded here." },
      rules: [
        cap == null ? rule("Maximum floor area (FAR)", "FAR 0.6 to 1.6 of the lot", SRC.smc23050, "The lot size is not on record, so the ratio for this lot and its square-foot cap are not shown. Underground stories and story portions no more than 4 ft above grade are exempt. ADU floor area counts toward FAR.") : rule("Maximum floor area (FAR)", fmt(cap) + " sf", SRC.smc23050, "FAR " + far + " for " + (units === 1 ? "one unit" : units + " units") + " on this lot (Table A for 23.44.050). Higher FAR applies at higher density: 0.8 or 1.0 from 1 unit per 4,000 sf, 1.0 or 1.2 from 1 per 2,200 sf, 1.6 from 1 per 1,600 sf. Underground stories and story portions no more than 4 ft above grade are exempt. ADU floor area now counts toward FAR; the old NR exemption was repealed.", cap),
        rule("Maximum lot coverage", pctText(0.5, cov), SRC.smc23080, "Riparian corridors, wetlands and buffers, shoreline setback areas and steep slope non-disturbance areas are taken out of the lot area first. Decks 36 in. or less above grade and the first 36 in. of eaves do not count.", cov),
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
    var imp = capOf(z.imp, v);
    return {
      key: "kc-urban", title: "Unincorporated King County, urban " + v.zone,
      floorCap: null, farNone: true, floorCapLabel: "No floor area ratio for houses in this table. Impervious surface and setbacks limit size.",
      coverage: null, impervious: imp,
      setbacks: { front: z.street, rear: z.interior, side: z.interior, garage: 20 },
      height: { ft: z.h, text: z.h + " ft (up to 45 ft under listed conditions)" },
      adu: { status: "coded", maxCount: 2, maxSf: 1000, rearSetback: null, sideSetback: null, heightFt: null, text: "Up to 2 per lot in the urban area, each up to 1,000 sf heated plus 1,000 sf unheated", src: SRC.kc08 },
      rules: [
        rule("Maximum floor area (FAR)", "None set for detached houses in the table", SRC.kc09h),
        rule("Maximum impervious surface", Math.round(z.imp * 100) + "%" + (imp != null ? " = about " + fmt(imp) + " sf" : " of the lot (the lot size is not on record)") + (z.impNote ? " (" + z.impNote + ")" : ""), SRC.kc09h, "Roof, driveway, patios and walks all count.", imp),
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
      floorCap: null, farNone: true, floorCapLabel: "No floor area ratio. Impervious limits and septic and well capacity usually control.",
      coverage: null,
      setbacks: { front: 30, rear: z.interior, side: z.interior },
      height: { ft: 40, text: "40 ft" },
      adu: { status: "coded", maxCount: 1, maxSf: null, rearSetback: null, sideSetback: null, heightFt: null, text: "1 per lot in the rural area; detached only under listed conditions", src: SRC.kc08 },
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
    var cov = capOf(0.35, v);
    return {
      key: "edmonds", title: "City of Edmonds, " + v.zone,
      floorCap: null, farNone: true, floorCapLabel: "The LDR table sets no floor area ratio. Lot coverage, height and setbacks limit size.",
      coverage: cov,
      setbacks: { front: z.street, rear: z.rear, side: z.side, rearAlley: 5 },
      height: { ft: 25, text: "25 ft" },
      adu: { status: "coded", maxCount: 2, maxSf: z.adu, rearSetback: parseFloat(z.daduRear), sideSetback: null, heightFt: 24, text: "Up to 2 with a detached house, each up to " + fmt(z.adu) + " sf; detached ADU height 24 ft; detached ADU rear setback " + z.daduRear, src: SRC.ecdc2060 },
      rules: [
        rule("Maximum floor area (FAR)", "None in the LDR site standards table", SRC.ecdc2030),
        rule("Maximum lot coverage", pctText(0.35, cov), SRC.ecdc2030, "", cov),
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
    var cov = capOf(0.35, v);
    return {
      key: "sno-table1", title: "Unincorporated Snohomish County, " + v.zone,
      floorCap: null, farNone: true, floorCapLabel: "The bulk matrix sets no floor area ratio. Lot coverage, height and setbacks limit size.",
      coverage: cov,
      setbacks: { front: null, rear: 5, side: 5 },
      height: { ft: z.h, text: z.h + " ft" },
      adu: { status: "verify", maxCount: null, maxSf: null, text: "", src: SRC.scc28010 },
      rules: [
        rule("Maximum lot coverage", pctText(0.35, cov), SRC.scc23030, "", cov),
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
      coded: false, floorCap: null, floorCapLabel: "Verify with Snohomish County PDS.",
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
    if (v.zone === "R-1" && hasLot(v) && v.lot < 15000) return kenmore({ lot: v.lot, zone: "R-4", from: "R-1" });
    var z = KEN[v.zone];
    if (!z) return null;
    var imp = capOf(z.imp, v), impMax = capOf(z.impMax, v);
    return {
      key: "kenmore", title: "City of Kenmore, " + (v.from ? v.from + " (R-4 standards apply on lots under 15,000 sf, Table B note 7)" : v.zone),
      floorCap: null, farNone: true, floorCapLabel: "Table B sets no floor area ratio. Setbacks, height and impervious surface limit size.",
      coverage: null, impervious: imp, imperviousMax: impMax,
      setbacks: v.zone === "R-1" ? { front: z.street, rear: z.rear, side: z.side, garage: 20 } : { front: z.street, rear: z.rear, side: z.side, sideMin: 5, sideCombined: 15, garage: 20 },
      height: { ft: 35, text: "35 ft" },
      adu: { status: "state", maxCount: ADU_STATE.maxCount, maxSf: null, text: ADU_STATE.text, src: ADU_STATE.src },
      sideNote: v.zone === "R-1" ? "" : "5 ft minimum each side, 15 ft combined. The diagram splits it 7.5 ft and 7.5 ft; you can shift it, say 5 ft and 10 ft.",
      rules: [
        rule("Street setback", z.street + " ft", SRC.kmc21030, v.zone === "R-1" ? "" : "Note 8: 10 ft if the development provides alleys or is townhouses."),
        rule("Garage driveway apron", "At least 20 linear ft of driveway between a garage, carport or fenced parking area and the street line", SRC.kmc21030, "Note 9, measured along the driveway centerline. A shop with a vehicle door facing the street should plan for this."),
        rule("Side setbacks", v.zone === "R-1" ? "5 ft" : "5 ft minimum each side, 15 ft combined", SRC.kmc21030, v.zone === "R-1" ? "" : "Note 11."),
        rule("Rear setback", z.rear + " ft", SRC.kmc21030),
        rule("Maximum height", "35 ft", SRC.kmc21030),
        rule("Impervious surface", Math.round(z.imp * 100) + "% base" + (imp != null ? " = " + fmt(imp) + " sf" : "") + "; " + Math.round(z.impMax * 100) + "% maximum" + (impMax != null ? " = " + fmt(impMax) + " sf" : "") + (imp == null ? " (the lot size is not on record)" : ""), SRC.kmc21030, "Note 14: applies to each lot. The higher number needs approved low impact development measures. Roofs, driveways, patios and walks all count.", imp),
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
    lakestevens: C("Lake Stevens", "Snohomish", 2, "https://www.lakestevenswa.gov", EC + "LA4738", null, { gis: { url: "https://services.arcgis.com/gr7sYYW0YAciUIIG/arcgis/rest/services/Zoning_August_2021/FeatureServer/0", field: "Zoning", name: "City of Lake Stevens zoning map (August 2021 layer; confirm the current zone with the city)" } }),
    lynnwood: C("Lynnwood", "Snohomish", 2, "https://www.lynnwoodwa.gov", "https://lynnwood" + MC + "/LMC", "Lynnwood Municipal Code", { gis: { url: "https://services2.arcgis.com/W2b0jYHWnOivta60/arcgis/rest/services/Future_Zones_Draft_4_25/FeatureServer/0", field: "Future_Zon", name: "City of Lynnwood draft future zones layer (the city's April 2025 draft, not the adopted zoning map)", draft: true } }),
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
    redmondCity: S("City of Redmond residential zones summary page, read Nov 2026 (the RZC 21.08 table itself was not opened)", "https://www.redmond.gov/2107/Residential-zones"),
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
      RN: { label: "Residential Neighborhood (RN)", f: 10, r: 5, s: 5, sep: 10, h: "35 ft", far: function (u) { return [0.6, 0.8, 1.0, 1.2][Math.min(Math.max(u, 1), 4) - 1]; }, farTxt: "FAR 0.6 for one unit, 0.8 for two, 1.0 for three, 1.2 for four", units: "3 units per lot; 4 with one affordable unit (80% AMI owned, 60% AMI rented) or within 1/4 mile of a major transit stop", lot: "6,000 sf, 50 ft wide", note: "Street setback 10 ft, interior lot lines 5 ft, 10 ft between buildings. Cottage housing lot coverage 50%." } } },
    bothell: { src: CS.bothell, zones: {
      "R-L1": { label: "Residential Low (R-L1)", f: 15, r: 15, s: 5, h: "35 ft", imp: 0.55, ra: 0, garage: 20, units: "Middle housing: 4 units per lot, 6 near major transit or with affordable units", lot: "6,000 sf", note: "Front 20 ft to a garage door. Rear 0 ft on an alley, 3 ft to an alley-loaded garage." },
      "R-L2": { label: "Residential Low (R-L2)", f: 15, r: 15, s: 5, h: "35 ft", imp: 0.6, ra: 0, garage: 20, units: "Middle housing: 4 units per lot, 6 near major transit or with affordable units", lot: "3,600 sf", note: "Front 20 ft to a garage door. Rear 0 ft on an alley, 3 ft to an alley-loaded garage." } },
      alias: { "RL1": "R-L1", "RL2": "R-L2" } },
    shoreline: { src: CS.shoreline, zones: {
      NR3: { label: "Neighborhood Residential 3 (NR3)", f: 10, r: 10, s: 5, h: "23 ft (28 ft with a pitched roof)", imp: 0.5, units: "3 units per lot or 1 per 2,400 sf", lot: "7,200 sf", note: "Garage door 20 ft from the street (10 ft on an alley). Hardscape 50% of the lot." },
      NR2: { label: "Neighborhood Residential 2 (NR2)", f: 10, r: 10, s: 5, h: "30 ft (35 ft with a pitched roof)", imp: 0.5, imp2: 0.6, units: "4 units per lot or 1 per 1,250 sf", lot: "5,000 sf", note: "Garage door 20 ft from the street (10 ft on an alley). Hardscape 50%, or 60% with two or more units." },
      NR1: { label: "Neighborhood Residential 1 (NR1)", r: 5, s: 5, h: "35 ft (40 ft with a pitched roof)", imp: 0.5, imp2: 0.75, units: "At least 1 unit per 2,500 sf, no maximum", note: "Front and side setbacks are set in the table footnotes. Hardscape 50%, or 75% with two or more units." } } },
    mountlaketerrace: { src: CS.mlt, zones: {
      "R-1": { label: "Residential (R-1)", f: 15, r: 15, s: 5, h: "35 ft at the front (3 stories)", cov: 0.45, far: function (u) { return u > 1 ? 0.6 : 0.5; }, farTxt: "FAR 0.5 for one unit, 0.6 for two or more", units: "1 unit per 2,400 sf", note: "Two ADUs allowed on any lot." },
      "R-2": { label: "Residential (R-2)", f: 15, r: 15, h: "35 ft at the front (3 stories)", cov: 0.5, far: function (u) { return [0.5, 0.6, 0.8, 1.0][Math.min(Math.max(u, 1), 4) - 1]; }, farTxt: "FAR 0.5 for one unit, 0.6 for two, 0.8 for three, 1.0 for four or more", units: "1 unit per 1,200 sf", lot: "4,800 sf", note: "Front and rear 15 ft for one or two units, 10 ft for three or more. Two ADUs allowed on any lot." } },
      alias: { "R1": "R-1", "R2": "R-2" }, common: { aduCount: 2 } },
    millcreek: { src: CS.millcreek, zones: {
      NR: { label: "Neighborhood Residential", f: 15, r: 20, s: 5, h: "35 ft", cov: 0.35, lot: "7,200 sf", note: "Front 20 ft to a garage. Rear 20 ft or 20% of lot depth, at least 10 ft. Townhouse coverage 55%." } },
      alias: { "RS": "NR", "R7200": "NR" } },
    everett: { src: CS.everett, zones: {
      NR: { label: "Neighborhood Residential (NR)", f: 10, r: 5, s: 5, ss: 5, ra: 0, adu: { heightFt: 18 }, h: "35 ft", cov: 0.5, units: "Middle housing under the state Tier 1 rule", lot: "5,000 sf", note: "Coverage rises 5% for two units, 10% for three or more. No rear setback on an alley. Street side 5 ft. Detached ADU height 18 ft, 24 ft on an alley." },
      "NR-C": { label: "Neighborhood Residential Corridor (NR-C)", f: 20, r: 20, s: 5, ss: 10, h: "35 ft", cov: 0.35, lot: "9,000 sf", note: "Street side 10 ft." } },
      alias: { "NRC": "NR-C" } },
    mukilteo: { src: CS.mukilteo, zones: {
      "RD12.5": { label: "RD 12.5", f: 25, r: 25, s: 5, h: "30 ft", cov: 0.3, lot: "12,500 sf" },
      "RD12.5(S)": { label: "RD 12.5(S)", f: 20, r: 5, s: 5, h: "35 ft", cov: 0.35, lot: "12,500 sf" },
      "RD9.6(S)": { label: "RD 9.6(S)", f: 20, r: 5, s: 5, h: "35 ft", cov: 0.35, lot: "9,600 sf" },
      "RD9.6": { label: "RD 9.6", f: 25, r: 20, s: 5, h: "30 ft", cov: 0.35, lot: "9,600 sf" },
      "RD8.4": { label: "RD 8.4", f: 20, r: 5, s: 5, h: "35 ft", cov: 0.35, lot: "8,400 sf" },
      "RD7.5": { label: "RD 7.5", f: 20, r: 20, s: 5, h: "30 ft", cov: 0.35, lot: "7,500 sf", note: "Rear 15 ft on a corner lot." },
      "RD7.2": { label: "RD 7.2", f: 20, r: 5, s: 5, h: "35 ft", cov: 0.35, lot: "7,200 sf" } },
      common: { units: "Each lot may have one duplex, or one house plus up to two ADUs", aduCount: 2 } },
    lakeforestpark: { zones: {
      "RS-7.2": { src: CS.lfp722, label: "RS-7.2", f: 20, r: 15, s: 5, h: "30 ft", cov: 0.35, imp: 0.45, lot: "7,200 sf, 60 ft wide", sideTxt: "15 ft combined, 5 ft minimum", sc: 15 },
      "RS-9.6": { src: CS.lfp96, label: "RS-9.6", f: 20, r: 15, s: 5, h: "30 ft", cov: 0.3, imp: 0.45, lot: "9,600 sf, 70 ft wide", sideTxt: "15 ft combined, 5 ft minimum", sc: 15 } },
      alias: { "RS7200": "RS-7.2", "RS72": "RS-7.2", "RS9600": "RS-9.6", "RS96": "RS-9.6" },
      common: { units: "Middle housing of two units per lot" } },
    woodinville: { src: CS.woodinville, zones: (function () { var o = {}; ["R-1", "R-4", "R-6", "R-8"].forEach(function (z) { o[z] = { label: z, f: 10, s: z === "R-1" ? 10 : 5, h: "35 ft", note: "Street setback 10 ft, 20 ft to a garage. Lot coverage depends on lot size; see WMC 21.32." + (z === "R-1" ? " R-1 interior setback is 5 ft on lots under 15,000 sf." : "") }; }); return o; })(),
      alias: { "R1": "R-1", "R4": "R-4", "R6": "R-6", "R8": "R-8" } },
    kirkland: { src: CS.kirkland, zones: (function () { var o = {}; ["5.0", "6.3", "7.2", "8.5", "12.5", "35"].forEach(function (n) { o["RS" + n] = { label: "RS " + n, f: 20, r: 10, s: 5, h: "25 ft above average building elevation", cov: 0.5, sideTxt: "5 ft minimum, 15 ft combined", sc: 15, farSmall: true }; o["RSX" + n] = { label: "RSX " + n, f: 20, r: 10, s: 5, h: "30 ft above average building elevation", cov: 0.5, sideTxt: "5 ft minimum, 15 ft combined", sc: 15, farSmall: true }; }); return o; })() },
    redmond: { src: CS.redmond, zones: {
      // Setbacks, building separation, height, coverage, impervious and open space below match the City of
      // Redmond's own zone summary page (redmond.gov/2107), read 17 Nov 2026, and Pacific Pro Group's study of 5514 160th
      // Ave NE. The RZC 21.08 table itself was not opened, so every one of them prints with "verify".
      NR: { label: "Neighborhood Residential (NR)", f: 10, r: 5, s: 3, ss: 10, ra: 2, sep: 5, verifyTag: true, sbSrc: CS.redmondCity, h: "38 ft", cov: 0.5, imp: 0.7, gfa: true, aduCount: 2,
        accounting: { farIncludesGarage: true, farIncludesBasement: true, farIncludesAccessory: true, verify: true, note: "Redmond caps the total floor area of all structures on the lot, and its 2025 draft text counts below-grade floor area. Garage, basement and outbuilding area are counted here; confirm against the adopted RZC 21.08 table." },
        units: "6 units per lot, 8 with one affordable unit; the City's summary page adds 2 ADUs per lot", lot: "3,000 sf average, 20 ft of frontage",
        note: "Open space 20% of the lot. Hardscaping 25%. Coverage 60% on lots of 18,000 sf or less with three or more units. Side interior setback is 0 ft for attached or zero-lot-line homes. Garage setback 3 ft (what it is measured from was not confirmed). 2 ft from an alley. 35 ft from Lake Sammamish. 5 ft between buildings." } } },
    bellevue: { src: CS.bellevue, zones: (function () {
      var o = {}, ord = ["LL-1", "LL-2", "SR-1", "SR-2", "SR-3", "SR-4", "LDR-1", "LDR-2", "LDR-3", "MDR-1", "MDR-2"];
      ord.forEach(function (z, i) {
        o[z] = { label: z, f: z === "LL-1" ? 25 : z === "LL-2" ? 20 : 10, r: i <= 3 ? 15 : 10, s: 5, h: "32 ft flat roof, 35 ft pitched", cov: i <= 4 ? 0.4 : 0.45, imp: i <= 4 ? 0.5 : i <= 6 ? 0.6 : 0.65, units: "Middle housing: 4 units per lot, 6 near major transit or with affordable units; up to 2 ADUs", mh: true, aduCount: 2 };
      });
      return o; })() },
    renton: { src: CS.renton, zones: {
      "R-4": { label: "R-4", f: 30, r: 25, s: 7.5, sideTxt: "20 ft combined, 7.5 ft minimum", sc: 20, h: "3 stories, 32 ft wall plate", cov: 0.35, imp: 0.5, lot: "9,000 sf" },
      "R-6": { label: "R-6", f: 25, r: 25, s: 5, sideTxt: "15 ft combined, 5 ft minimum", sc: 15, h: "2 stories, 24 ft wall plate", cov: 0.4, imp: 0.55, lot: "7,000 sf" },
      "R-8": { label: "R-8", f: 20, s: 5, h: "2 stories, 24 ft wall plate", cov: 0.5, imp: 0.65, lot: "5,000 sf", note: "Front 15 ft on an alley-loaded lot." } },
      alias: { "R4": "R-4", "R6": "R-6", "R8": "R-8" }, common: { units: "Middle housing under the state Tier 1 rule; see RMC 4-2-110F" } },
    sammamish: { src: CS.sammamish, zones: {
      "R-4": { label: "R-4", h: "35 ft", imp: 0.4, farPct: 0.5, sizeSb: true },
      "R-6": { label: "R-6", h: "35 ft", imp: 0.5, farPct: 0.5, sizeSb: true },
      "R-8": { label: "R-8", f: 10, r: 20, s: 5, h: "35 ft", imp: 0.75 } },
      alias: { "R4": "R-4", "R6": "R-6", "R8": "R-8" }, common: { note2: "Detached ADU height 24 ft, side and rear setbacks 5 ft.", adu: { heightFt: 24, rearSetback: 5, sideSetback: 5 } } },
    issaquah: { src: CS.issaquah, zones: {
      "SF-E": { label: "Single Family Estate (SF-E)", f: 30, r: 30, s: 15, h: "30 ft", imp: 0.3, lot: "35,000 sf" },
      "SF-S": { label: "Single Family Suburban (SF-S)", f: 20, r: 10, s: 8, h: "30 ft", imp: 0.4, lot: "9,600 sf" },
      "SF-SL": { label: "Single Family Small Lot (SF-SL)", f: 10, r: 20, s: 6, h: "30 ft", imp: 0.5 },
      "SF-D": { label: "Single Family Duplex (SF-D)", f: 10, r: 10, s: 6, h: "25 ft or 2 stories", imp: 0.5, lot: "6,000 sf" } },
      alias: { "SFE": "SF-E", "SFS": "SF-S", "SFSL": "SF-SL", "SFD": "SF-D" }, common: { units: "Middle housing: 2 units per lot, 4 near major transit or with affordable units" } }
  };

  function canon(z) { return String(z || "").toUpperCase().replace(/[\s_\-]/g, ""); }
  /* "Redmond city" (the Census place name), "City of Redmond" and "Redmond" are one key. */
  function cityKey(name) { return String(name || "").toLowerCase().replace(/\s+(city|town|village|cdp)\s*$/, "").replace(/\bvillage\b|\bcity of\b|\btown of\b/g, "").replace(/[^a-z]/g, ""); }
  /* County and city maps write property-specific conditions and special overlays as suffixes: R-6-P,
     RA-5-SO, R-4-P-SO, NR3-P. The base zone's table still applies, with conditions on top. */
  function stripOverlay(zone) {
    var z = String(zone || "").trim(), m = /^(.+?)((?:[-\s](?:P|SO|DPA))+)$/i.exec(z);
    if (!m) return { base: z, overlay: "" };
    return { base: m[1], overlay: m[2].replace(/^[-\s]+/, "").replace(/[-\s]+/g, "-").toUpperCase() };
  }
  function findZone(key, zone) {
    var t = CZ[key]; if (!t || !zone) return null;
    function look(z) {
      var c = canon(z), k;
      for (k in t.zones) if (canon(k) === c) return k;
      if (t.alias) for (k in t.alias) if (canon(k) === c) return t.alias[k];
      return null;
    }
    var hit = look(zone);
    if (!hit) { var so = stripOverlay(zone); if (so.overlay) hit = look(so.base); }
    return hit;
  }
  var TIER = {
    1: "Tier 1 city (75,000 people or more): at least 4 units per lot, 6 within 1/4 mile of a major transit stop or with two affordable units",
    2: "Tier 2 city (25,000 to 75,000 people): at least 2 units per lot, 4 within 1/4 mile of a major transit stop or with one affordable unit",
    3: "Tier 3 city (under 25,000 people, inside the urban growth area next to a large city): at least 2 units per lot"
  };
  function stateRows(c) {
    return [
      c.tier ? rule("Middle housing (state law)", TIER[c.tier], SRC.hb1110, "RCW 36.70A.635. The adopted code sets the details; read it before you count units.") : rule("Middle housing (state law)", "Confirm the local middle-housing standard", SRC.hb1110, "RCW 36.70A.635. Confirm how it applies with the local planning department."),
      rule("ADUs (state law)", "Cities inside the urban growth area must allow two ADUs per lot", SRC.hb1337, "RCW 36.70A.680 and .681. Ask the city for its ADU size limits and any area outside the urban growth area.")
    ];
  }
  function tailRows(c) {
    return [
      verify("Critical areas", c.code, "Steep slopes, wetlands, streams and landslide areas add buffers and studies. The map check on the summary page is a start, not a decision."),
      verify("Shoreline", SRC.smaRcw, "Land within 200 ft of a lake, large stream or Puget Sound follows the city's Shoreline Master Program. Verify with the city.")
    ];
  }

  /* The ADU facts a city table carries, as fields the option cards and the site plan can read.
     A table with no ADU numbers falls back to the state floor, and says that is what it is. */
  function aduOf(Z, cm, src) {
    var a = Z.adu || cm.adu || null, count = Z.aduCount || cm.aduCount || (a && a.maxCount) || null;
    if (!a && !count) return { status: "state", maxCount: ADU_STATE.maxCount, maxSf: null, heightFt: null, rearSetback: null, sideSetback: null, text: ADU_STATE.text, src: ADU_STATE.src };
    var bits = [];
    if (count) bits.push("up to " + count + " ADUs per lot");
    if (a && a.maxSf) bits.push("each up to " + fmt(a.maxSf) + " sf");
    if (a && a.heightFt) bits.push("detached ADU height " + a.heightFt + " ft");
    if (a && a.rearSetback != null) bits.push("detached ADU rear setback " + a.rearSetback + " ft");
    if (a && a.sideSetback != null) bits.push("detached ADU side setback " + a.sideSetback + " ft");
    var text = bits.join("; ");
    return {
      status: "coded", partial: !(a && a.maxSf), maxCount: count || ADU_STATE.maxCount, maxSf: a && a.maxSf ? a.maxSf : null,
      heightFt: a && a.heightFt ? a.heightFt : null, rearSetback: a && a.rearSetback != null ? a.rearSetback : null, sideSetback: a && a.sideSetback != null ? a.sideSetback : null,
      text: text.charAt(0).toUpperCase() + text.slice(1) + (a && a.maxSf ? "" : ". State law lets each ADU be at least 1,000 sf"), src: src
    };
  }

  function cityRules(v) {
    var key = v.city, c = CITY[key];
    if (!c) return null;
    var t = CZ[key], zk = findZone(key, v.zone), lotOk = hasLot(v), lot = lotOk ? Number(v.lot) : null, units = v.units || 1;
    var cityLink = { label: "City of " + c.name + " permits and planning", url: c.home };
    if (!zk) {
      var lookup = { label: "Zoning code", url: c.code && c.code.url ? c.code.url : c.home };
      var passed = { lot: v.lot, zone: v.zone, use: v.use, presentUse: v.presentUse, zoneClass: v.zoneClass, lookup: lookup, codeChapter: v.codeChapter, juris: v.juris, city: v.city };
      var cls = lotClass(passed);
      if (cls === "nonres") return nonResidential(passed);
      if (cls === "residential") return typicalResidential(passed);
      return unrecognized(passed);
    }
    var Z = t.zones[zk], cm = t.common || {}, src = Z.src || t.src, sbSrc = Z.sbSrc || src;
    // verifyTag: the numbers match an official summary, and the code table itself was not read.
    var tag = Z.verifyTag ? " (verify)" : "";
    var needLot = " The lot size is not on record, so no square-foot figure is shown.";
    var rows = [], cap = null, capLabel = "", cov = Z.cov && lotOk ? Math.round(Z.cov * lot) : null;
    var impF = (Z.imp2 && units > 1) ? Z.imp2 : Z.imp, imp = impF && lotOk ? Math.round(impF * lot) : null;
    if (Z.far) {
      var far = Z.far(units);
      if (lotOk) { cap = Math.round(far * lot); capLabel = "FAR " + far + " x " + fmt(lot) + " sf lot for " + (units === 1 ? "one unit" : units + " units"); rows.push(rule("Maximum floor area (FAR)", fmt(cap) + " sf", src, Z.farTxt, cap)); }
      else rows.push(rule("Maximum floor area (FAR)", "FAR " + far + " of the lot", src, Z.farTxt + "." + needLot));
    }
    else if (Z.gfa) { var u = Math.min(Math.max(units, 1), 8); cap = 4500 + 1500 * (u - 1); capLabel = "4,500 sf plus 1,500 sf per added unit, for " + u + (u === 1 ? " unit" : " units"); rows.push(rule("Maximum total floor area", fmt(cap) + " sf", src, "4,500 sf for one unit plus 1,500 sf for each added unit, 15,000 sf at eight units.", cap)); }
    else if (Z.farPct) {
      if (lotOk) { cap = Math.round(Z.farPct * lot); capLabel = "FAR 0.5 x " + fmt(lot) + " sf lot (single family)"; rows.push(rule("Maximum floor area (FAR)", fmt(cap) + " sf", src, "Floor area ratio 50% for a single family house.", cap)); }
      else rows.push(rule("Maximum floor area (FAR)", "50% of the lot", src, "Floor area ratio 50% for a single family house." + needLot));
    }
    else if (Z.farSmall && lotOk && lot < 7200) { cap = Math.round(0.5 * lot); capLabel = "FAR 50% x " + fmt(lot) + " sf lot (lots under 7,200 sf)"; rows.push(rule("Maximum floor area (FAR)", fmt(cap) + " sf", src, "50% on lots under 7,200 sf, 60% with pitched roofs. Larger lots use other FAR rules in the chapter.", cap)); }
    else if (Z.noFar) rows.push(rule("Maximum floor area (FAR)", "None in this zone's table", src));
    else rows.push(verify("Maximum floor area", src, Z.farSmall ? (lotOk ? "FAR depends on lot size for lots of 7,200 sf or more. Read the chapter." : "FAR is 50% on lots under 7,200 sf and depends on lot size above that. The lot size is not on record.") : "We did not find a floor area ratio in this zone's table, or it depends on other factors."));
    rows.push(rule("Maximum height", Z.h + tag, src));
    // A combined side setback ("5 ft minimum, 15 ft combined") is drawn as half the total on each side.
    // The minimum alone on both sides drew an envelope 5 ft wider than the code allows.
    var side = Z.sc ? Z.sc / 2 : Z.s;
    if (Z.sizeSb) {
      var big = key === "sammamish" && zk === "R-4";
      // Setbacks grow with the house. For an addition the row is the one for the house on record plus the
      // planned floor area (v.planned), held to the floor cap. For a new house, or when nothing is planned,
      // it is the row for the largest house this lot can hold. The smallest row used to be drawn for every lot.
      var house = v.house != null && isFinite(Number(v.house)) ? Number(v.house) : 0;
      var planned = v.planned != null && isFinite(Number(v.planned)) && house ? Number(v.planned) : null;
      var basis = planned != null ? Math.min(cap || Infinity, house + planned) : Math.max(cap || 0, house);
      var ri = !basis ? 2 : basis < 2500 ? 0 : basis <= 4000 ? 1 : 2;
      var SB = [{ f: 15, s: 5, r: 15 }, { f: big ? 20 : 15, s: 10, r: big ? 20 : 15 }, { f: big ? 25 : 20, s: big ? 12 : 10, r: big ? 25 : 20 }][ri];
      var rowName = ["under 2,500 sf", "2,500 to 4,000 sf", "over 4,000 sf"][ri];
      var whyRow = planned != null ? "the house on record plus about " + fmt(planned) + " sf of new floor area" + (cap && house + planned > cap ? ", held to the floor cap" : "")
        : "the largest house this lot's floor cap allows" + (house > (cap || 0) ? " or the house on record, whichever is larger" : "");
      rows.push(rule("Setbacks by house size", "Under 2,500 sf: front 15, side 5, rear 15 (12 min). 2,500 to 4,000 sf: front " + (big ? 20 : 15) + ", side 10 average (8 min), rear " + (big ? 20 : 15) + ". Over 4,000 sf: front " + (big ? 25 : 20) + ", side " + (big ? 12 : 10) + ", rear " + (big ? 25 : 20) + ".", src, "Feet. The diagram uses the row for a house " + rowName + ": " + whyRow + ". A smaller house gets the smaller setbacks in the row above it."));
      Z = Object.assign({}, Z, SB);
      side = SB.s;
    } else {
      rows.push(Z.f != null ? rule("Front setback", Z.f + " ft" + tag, sbSrc) : verify("Front setback", sbSrc));
      if (Z.ss != null) rows.push(rule("Street side setback (corner lot)", Z.ss + " ft" + tag, sbSrc));
      rows.push(Z.s != null ? rule("Side setbacks", (Z.sideTxt || (Z.s + " ft")) + tag, sbSrc, Z.sc ? "The diagram splits the combined " + Z.sc + " ft evenly, " + (Z.sc / 2) + " ft a side. The split can shift as long as each side keeps " + Z.s + " ft." : "") : verify("Side setbacks", sbSrc));
      rows.push(Z.r != null ? rule("Rear setback", Z.r + " ft" + (Z.ra != null ? " (" + Z.ra + " ft from an alley)" : "") + tag, sbSrc) : verify("Rear setback", sbSrc));
    }
    rows.push(Z.cov ? rule("Lot coverage", pctText(Z.cov, cov) + tag, src, "", cov != null ? cov : undefined) : (Z.covNone ? rule("Lot coverage", "No lot coverage limit in this zone's table", src) : verify("Lot coverage", src)));
    rows.push(impF ? rule(key === "bothell" ? "Hard surface" : "Impervious surface", pctText(impF, imp) + tag, src, "Roofs, driveways, patios and walks count.", imp != null ? imp : undefined) : (Z.impNone ? rule("Impervious surface", "No impervious surface limit in this zone's table", src) : verify("Impervious surface", src)));
    if (Z.lot) rows.push(rule("Minimum lot size", Z.lot, src));
    if (Z.units || cm.units) rows.push(rule("Units per lot", Z.units || cm.units, src));
    if (Z.note) rows.push(rule("Other limits", Z.note, src));
    if (cm.note2) rows.push(rule("Detached ADU", cm.note2, src));
    rows = rows.concat(stateRows(c), tailRows(c), [rule("Permit office", "City of " + c.name, cityLink, "Ask for a pre-application meeting before design.")]);
    var sb = { front: Z.f, rear: Z.r, side: side };
    if (Z.ss != null) sb.streetSide = Z.ss;
    if (Z.sc) { sb.sideMin = Z.s; sb.sideCombined = Z.sc; }
    if (Z.ra != null) sb.rearAlley = Z.ra;
    if (Z.sa != null) sb.sideAlley = Z.sa;
    if (Z.garage != null) sb.garage = Z.garage;
    if (Z.sep != null) sb.buildingSep = Z.sep;
    return {
      key: "city-" + key, title: "City of " + c.name + ", " + Z.label, city: c,
      floorCap: cap, floorCapLabel: cap ? capLabel : (Z.noFar ? "This zone's table sets no floor area ratio. Setbacks, height and coverage limit size." : "A floor area limit for this zone is not coded here, and one may apply. Read the zone chapter. Setbacks, height and coverage are listed above."),
      farNone: !!Z.noFar, covNone: !!Z.covNone, impNone: !!Z.impNone,
      coverage: cov, impervious: imp, imperviousMax: null,
      setbacks: sb, setbackVerify: !!Z.verifyTag, setbackSrc: sbSrc,
      sideNote: Z.sc ? Z.sideTxt + ". The diagram uses " + (Z.sc / 2) + " ft on each side." : (Z.sideTxt || ""),
      height: heightOf(Z.h), heightVerify: !!Z.verifyTag,
      adu: aduOf(Z, cm, src),
      accounting: Z.accounting || null,
      openSpacePct: Z.open || null,
      rules: rows,
      sources: (sbSrc !== src ? [src, sbSrc] : [src]).concat([c.code, SRC.hb1110, SRC.hb1337, cityLink]),
      caveat: "Numbers read from the " + c.name + " code in " + CHECKED + "." + (Z.verifyTag ? " Rows marked verify match the city's own summary page (" + CHECKED_NOV + "); the code table was not opened." : "") + " Overlays, planned unit developments and plat conditions can change them."
    };
  }

  /* Seattle LR1, LR2, LR3. Read November 2026 from the adopted code, not from a pending plan.
     Setbacks: SMC 23.45.518 Table A, as amended by Ord. 127219 (the ordinance the city's current
     zoning layer names for LR1 (M), effective 2025-06-27). The same three numbers apply in every
     LR zone. An (M), (M1), or (M2) suffix does not change this table.
     Height: SMC 23.45.514 Table A, Ord. 127219. LR1 is 32 ft for rowhouses, townhouses, and
     apartments with or without an MHA suffix. LR2 is 40 ft with a suffix and 32 ft without.
     LR3 outside an urban center, urban village, or station area overlay is 40 ft with a suffix
     and 32 ft without; inside those areas it is 50 ft with a suffix and 40 ft without. Cottage
     housing is 22 ft. This study does not decide whether a lot is inside a growth area, so LR3
     uses the lower (outside) height.
     Floor area: SMC 23.45.510 Table A, as amended by Ord. 127376 (signed Dec. 22, 2025, in effect
     January 2026; the same ordinance this file already uses for chapter 23.44). LR1 is 1.3 with an
     MHA suffix (1.5 for stacked dwelling units) and 1.0 without. LR2 is 1.4 with a suffix (1.6 for
     stacked dwelling units) and 1.1 without. LR3 outside urban centers and urban villages is 1.8
     with a suffix and 1.2 without (1.3 for stacked dwelling units). The higher inside ratio is not
     applied here. A house addition uses the base ratio, not the stacked-dwelling bonus.
     The SDCI lowrise summary (seattle.gov MultifamilyZoningSummary.pdf) matches these columns.
     No lot-coverage percentage is in these tables, so none is invented. */
  var LR_FAR = {
    LR1: { mha: 1.3, plain: 1.0 },
    LR2: { mha: 1.4, plain: 1.1 },
    LR3: { mha: 1.8, plain: 1.2 }
  };
  function mhaSuffix(zone, mhaField) {
    var named = String(mhaField || "").toUpperCase();
    if (named === "M" || named === "M1" || named === "M2") return named;
    var hit = String(zone || "").toUpperCase().match(/\(\s*(M1|M2|M)\s*\)/);
    return hit ? hit[1] : "";
  }
  function parseLr(zone, mhaField) {
    var raw = String(zone || "").toUpperCase().replace(/\s+/g, "");
    // Only a zone that starts as LR1, LR2, or LR3. A short token such as RC may sit before the suffix: LR3 RC (M).
    // MIO-65-LR3 is a major-institution overlay, not LR3.
    raw = raw.replace(/^(LR-?[123])[A-Z]{1,4}(?=\(|$)/, "$1");
    var hit = raw.match(/^LR-?([123])(?:\(|$)/);
    if (!hit) return null;
    return { base: "LR" + hit[1], mha: mhaSuffix(zone, mhaField) };
  }
  function lrHeight(base, mha) {
    if (base === "LR1") return 32;
    // Ord. 127376: LR2 and LR3 are 40 ft with an MHA suffix outside urban centers and villages, and 32 ft without the suffix.
    // Stacked dwelling units can be higher. A house addition uses 40 when the suffix is present and 32 when it is not.
    return mha ? 40 : 32;
  }
  function seattleLR(v, parsed) {
    var base = parsed.base, mha = parsed.mha, lot = hasLot(v) ? Number(v.lot) : null;
    var far = LR_FAR[base][mha ? "mha" : "plain"];
    var cap = lot != null ? Math.round(far * lot) : null;
    var ht = lrHeight(base, mha);
    var suffixNote = mha
      ? "The (" + mha + ") suffix is a Mandatory Housing Affordability suffix (SMC 23.58B and 23.58C). It sets the payment or performance amount. It does not change the setbacks. It uses the MHA column of the floor-area table."
      : "No MHA suffix is on this zone, so the table column without a suffix is used.";
    var heightNote = base === "LR3"
      ? (mha ? " 40 ft with an MHA suffix, outside an urban center or urban village. Stacked dwelling units can be higher." : " 32 ft without an MHA suffix. Stacked dwelling units can be higher.")
      : (base === "LR1" ? " LR1 height is 32 ft with or without the suffix." : (mha ? " The MHA suffix column is used." : " The column without an MHA suffix is used."));
    return {
      setbackNote: "",
      key: "seattle-lr",
      title: "Lowrise " + base.slice(2) + (mha ? " (" + mha + ")" : "") + ", SMC 23.45",
      floorCap: cap,
      floorCapLabel: cap != null ? "FAR " + far + " x " + fmt(lot) + " sf lot" : "FAR " + far + " of the lot. The lot size is not on record, so no square-foot cap is shown.",
      coverage: null,
      setbacks: { front: 7, rear: 7, side: 5, rearAlley: 0 },
      height: { ft: ht, text: ht + " ft" + (base === "LR3" ? (mha ? ". 40 ft with an MHA suffix, outside an urban center or urban village. Stacked dwelling units can be higher." : ". 32 ft without an MHA suffix. Stacked dwelling units can be higher.") : "") },
      adu: { status: "coded", maxCount: 2, maxSf: null, rearSetback: null, sideSetback: null, heightFt: null, text: "ADUs are allowed with single-family dwelling units, rowhouses, and townhouses. They do not count toward the density limit. The size limit is in SMC 23.45.545 and is not applied as a number here.", src: SRC.smc2345 },
      accounting: { farIncludesGarage: null, farIncludesBasement: null, farIncludesAccessory: null, verify: true, note: "Floor area follows SMC 23.45.510. Whether a garage or a basement counts is not taken from a second table here." },
      rules: [
        cap == null ? rule("Maximum floor area (FAR)", "FAR " + far + " of the lot", SRC.smc2345510, suffixNote + " Stacked dwelling units can use a higher ratio (LR1 1.5, LR2 1.6). A house addition uses the base ratio.") : rule("Maximum floor area (FAR)", fmt(cap) + " sf", SRC.smc2345510, "FAR " + far + " (SMC 23.45.510 Table A, Ord. 127376, " + (mha ? "MHA suffix column" : "no MHA suffix") + "). " + suffixNote + " A house addition uses the base ratio.", cap),
        rule("Maximum height", ht + " ft", SRC.smc2345514, "SMC 23.45.514 Table A, Ord. 127376." + heightNote),
        rule("Front setback", "7 ft average, 5 ft minimum", SRC.smc2345518, "SMC 23.45.518 Table A. The diagram uses the 7 ft average."),
        rule("Rear setback", "7 ft average, 5 ft minimum (none when it abuts an alley)", SRC.smc2345518, "The diagram uses 7 ft, or 0 ft on an alley."),
        rule("Side setbacks", "5 ft", SRC.smc2345518),
        rule("MHA suffix", mha ? "(" + mha + ") applies" : "none on this zone", SRC.smc2358, suffixNote)
      ],
      sources: [SRC.smc2345518, SRC.smc2345514, SRC.smc2345510, SRC.ord127376lr]
    };
  }

  /* Edmonds RM-1.5, RM-EW, RM-2.4, RM-3. ECDC 16.30.030(A), current text amended by
     Ord. 4414 (2025) and Ord. 4397 (2025), read November 2026 at edmonds.municipal.codes/ECDC/16.30.030.
     The table sets no floor area ratio. Note 1: a roof at 4:12 or steeper may extend 5 ft.
     Note 2: LDR-S setbacks may be used for a single-family house on a lot of 10,000 sf or less.
     That is optional, so the diagram keeps the RM setbacks, which always comply.
     Note 4 (RM-EW only): height on Edmonds Way may be 35 ft when the listed conditions are met.
     Green-building certification may add 5 ft (ECDC 16.30.050). Neither bonus is applied here. */
  var EDM_RM = {
    "RM-1.5": { side: 10, per: 1500 },
    "RM-EW": { side: 10, per: 1500, ew: true },
    "RM-2.4": { side: 10, per: 2400 },
    "RM-3": { side: 15, per: 3000 }
  };
  function edmondsRm(v) {
    var z = EDM_RM[v.zone];
    var cov = capOf(0.45, v);
    return {
      key: "edmonds-rm",
      title: v.zone + ", ECDC 16.30",
      floorCap: null, farNone: true, floorCapLabel: "The RM table sets no floor area ratio. Lot coverage, height, and setbacks limit size.",
      coverage: cov,
      setbacks: { front: 15, rear: 15, side: z.side },
      height: { ft: 25, text: "25 ft. A roof at 4:12 or steeper may extend 5 ft." + (z.ew ? " On Edmonds Way, 35 ft is allowed only when the listed conditions are met." : "") },
      adu: { status: "state", maxCount: ADU_STATE.maxCount, maxSf: null, heightFt: null, rearSetback: null, sideSetback: null, text: ADU_STATE.text, src: ADU_STATE.src },
      rules: [
        rule("Maximum floor area (FAR)", "None in the RM site standards table", SRC.ecdc1630),
        rule("Maximum lot coverage", pctText(0.45, cov), SRC.ecdc1630, "", cov),
        rule("Maximum height", "25 ft", SRC.ecdc1630, "Note 1: a roof at 4:12 or steeper may extend 5 ft above that." + (z.ew ? " Note 4: a building fronting Edmonds Way may be 35 ft when the listed conditions are met." : "") + " ECDC 16.30.050 may add 5 ft for a certified green building. Those bonuses are not applied here."),
        rule("Street setback", "15 ft", SRC.ecdc1630, "Note 2: a single-family house on a lot of 10,000 sf or less may use the LDR-S setbacks instead. The diagram keeps the RM setbacks."),
        rule("Side setback", z.side + " ft", SRC.ecdc1630),
        rule("Rear setback", "15 ft", SRC.ecdc1630, "A corner lot has no rear setback; the other lines that are not street lines are side setbacks (ECDC 16.30.040)."),
        rule("Lot area per dwelling", fmt(z.per) + " sf minimum", SRC.ecdc1630, "A sleeping unit in co-living housing counts as no more than one-quarter of a dwelling (note 3).")
      ],
      sources: [SRC.ecdc1630]
    };
  }

  /* A zone is a house zone only when the name or the city's class field says so.
     Anything else with a zone name is not given house setbacks or an addition.
     A blank zone outside Washington still uses the labeled typical assumptions. */
  function zoneCompact(zone) {
    return String(zone || "").toUpperCase().replace(/\s+/g, "").replace(/\((M1|M2|M)\)$/, "");
  }
  function classSaysNonres(desc) {
    var c = String(desc || "").toLowerCase();
    return /commercial|industrial|downtown|institution|seattle mixed|mixed use/.test(c);
  }
  function classSaysResidential(desc) {
    var c = String(desc || "").toLowerCase();
    if (classSaysNonres(c)) return false;
    return /residential|multi-family|multifamily|single family|lowrise/.test(c);
  }
  function nameSaysNonres(zone) {
    var z = zoneCompact(zone);
    if (!z) return false;
    return /^(MIO|SM|NC\d?P?|C[12]|IC|IB|IG|UI|ID|DMC|DMR|DOC|DH|CBD|CW|BD\d?|BC|BN|CG\d?|OS|P$|MU|NB|CB|PO|IL|IH|LI|HI|BP|OP|GC|HC|RC|TC|DC|I-\d|M-\d)/.test(z);
  }
  function nameSaysResidential(zone) {
    var z = zoneCompact(zone);
    if (!z || nameSaysNonres(zone)) return false;
    return /^(NR[123]?|LR[123]|RSL|SF[A-Z0-9-]*|RS[A-Z0-9-]*|RE[A-Z0-9-]*|UR[A-Z0-9-]*|LDR(-[A-Z0-9]+)?|RM(-[\d.]+|-EW)?|R-?\d+[A-Z]?|RA-?\d+)/.test(z);
  }
  function lotClass(v) {
    v = v || {};
    var present = String(v.presentUse || "");
    if (v.use === "nonres") return "nonres";
    if (/commercial|industrial|office|retail|warehouse|manufactur/i.test(present) && !/resid/i.test(present)) return "nonres";
    if (classSaysNonres(v.zoneClass) || nameSaysNonres(v.zone)) return "nonres";
    if (classSaysResidential(v.zoneClass) || nameSaysResidential(v.zone)) return "residential";
    if (String(v.zone || "").trim()) return "unknown";
    return "blank";
  }
  var TYPICAL = "Typical residential assumptions, confirm with your local planning department. These are not the local code.";
  var NONRES_NOTE = "This lot is not a house lot. The building is not labeled as a house, and an addition is not drawn. Confirm the use with your local planning department.";
  function typicalResidential(v) {
    v = v || {};
    var link = v.lookup && v.lookup.url ? v.lookup : null;
    return {
      key: "typical-residential",
      assumed: true,
      assumedLabel: TYPICAL,
      residential: true,
      coded: true,
      title: "Typical residential assumptions",
      floorCap: null,
      farNone: false,
      floorCapLabel: "No floor-area ratio is assumed.",
      coverage: null,
      setbacks: { front: 25, rear: 25, side: 10 },
      setbackVerify: true,
      height: { ft: 30, text: "30 ft" },
      heightVerify: true,
      adu: { status: "verify", maxCount: null, maxSf: null, heightFt: null, rearSetback: null, sideSetback: null, text: "", src: null },
      rules: [
        rule("Front setback", "25 ft", link, TYPICAL),
        rule("Side setback", "10 ft", link, TYPICAL),
        rule("Rear setback", "25 ft", link, TYPICAL),
        rule("Height", "30 ft", link, TYPICAL)
      ],
      sources: link ? [link] : [],
      caveat: TYPICAL
    };
  }
  function withChapter(rs, v) {
    var ch = v && v.codeChapter;
    if (ch && ch.url) {
      rs.sources = (rs.sources || []).concat([ch]);
      rs.rules = (rs.rules || []).concat([rule("Code chapter", ch.label || "Zoning code", ch)]);
    }
    return rs;
  }
  var ECDC16 = { label: "ECDC Title 16", url: "https://edmonds.municipal.codes/ECDC/16" };
  function nonResidential(v) {
    v = v || {};
    if (!v.codeChapter && v.juris === "edmonds") v.codeChapter = ECDC16;
    var link = v.lookup && v.lookup.url ? v.lookup : null;
    return withChapter({
      key: "nonresidential",
      assumed: false,
      residential: false,
      nonresLabel: NONRES_NOTE,
      coded: false,
      title: v.zone ? "Zone " + v.zone : "Not a house lot",
      floorCap: null,
      floorCapLabel: NONRES_NOTE,
      coverage: null,
      setbacks: {},
      height: { ft: null, text: "" },
      adu: { status: "verify", maxCount: null, maxSf: null, text: "", src: null },
      rules: [rule("Use", NONRES_NOTE, link, v.zone ? "Zone " + v.zone + "." : "")],
      sources: link ? [link] : [],
      caveat: NONRES_NOTE
    }, v);
  }
  var UNRECOGNIZED = "This zone is not recognized. Confirm the standards with your local planning department.";
  function unrecognized(v) {
    v = v || {};
    return {
      key: "unrecognized",
      assumed: false,
      residential: null,
      unrecognized: true,
      uncoded: true,
      coded: false,
      title: v.zone ? "Zone " + v.zone : "Zone not recognized",
      floorCap: null,
      floorCapLabel: UNRECOGNIZED,
      coverage: null,
      setbacks: {},
      height: { ft: null, text: "" },
      adu: { status: "verify", maxCount: null, maxSf: null, text: "", src: null },
      rules: [rule("Zone", UNRECOGNIZED, v.lookup)],
      sources: v.lookup && v.lookup.url ? [v.lookup] : [],
      caveat: UNRECOGNIZED
    };
  }
  function notCoded(v) {
    v = v || {};
    return withChapter({
      key: "not-coded",
      assumed: false,
      residential: false,
      uncoded: true,
      coded: false,
      title: v.zone ? "Zone " + v.zone : "Zone standards not applied",
      floorCap: null,
      floorCapLabel: "House setbacks and an addition are not drawn for this zone.",
      coverage: null,
      setbacks: {},
      height: { ft: null, text: "" },
      adu: { status: "verify", maxCount: null, maxSf: null, text: "", src: null },
      rules: [rule("Zone", "House setbacks and an addition are not drawn for this zone.", v.lookup)],
      sources: [],
      caveat: "House setbacks and an addition are not drawn for this zone."
    }, v);
  }
  function stateLawCity(v, c, cityLink) {
    c = c || {};
    var link = cityLink || (c.home ? { label: "Permits and planning", url: c.home } : null);
    return {
      key: "city-" + (v.city || "wa") + "-state",
      title: (v.zone ? "Zone " + v.zone + ". " : "") + "State-law floor",
      city: c.name ? c : null,
      coded: false,
      residential: true,
      assumed: false,
      floorCap: null,
      floorCapLabel: "No floor-area figure is applied.",
      coverage: null,
      impervious: null,
      setbacks: {},
      height: { ft: null, text: "" },
      adu: { status: "state", maxCount: ADU_STATE.maxCount, maxSf: null, heightFt: null, rearSetback: null, sideSetback: null, text: ADU_STATE.text, src: ADU_STATE.src },
      rules: stateRows(c.name ? c : { name: "", tier: 0, code: link }).concat(c.name ? tailRows(c) : []),
      sources: [c.code || link, SRC.hb1110, SRC.hb1337, link].filter(function (x) { return x && x.url; }),
      caveat: "The zone's own setback and height numbers are not applied. The rows below are the state-law floor. Confirm the zone standards with your local planning department."
    };
  }

  function pickBase(v) {
    if (v.juris === "city") return cityRules(v);
    var z = String(v.zone || "").toUpperCase().replace(/\s+/g, "");
    if (v.juris === "seattle") {
      var lr = parseLr(v.zone, v.mha);
      if (lr) return seattleLR(v, lr);
      var nr = z.replace(/\(\s*(M1|M2|M)\s*\)/g, "");
      if (/^NR[123]?$/.test(nr)) return seattleNR({ lot: v.lot, units: v.units, zone: nr === "NR" ? "NR" : nr });
      return null;
    }
    if (v.juris === "kenmore") { z = z.replace(/^R-?(\d)$/, "R-$1"); if (KEN[z]) return kenmore({ lot: v.lot, zone: z }); return null; }
    if (v.juris === "edmonds") {
      var ez = String(v.zone || "").toUpperCase().replace(/\s+/g, "").replace(/^RM(\d)/, "RM-$1");
      if (EDM[ez]) return edmonds({ lot: v.lot, zone: ez });
      if (EDM_RM[ez]) return edmondsRm({ lot: v.lot, zone: ez });
      return null;
    }
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

  /* Rules that hang on the place and not on the zone: asbestos and lead, re-roofing, drainage, parking,
     fences, trees. Each is a datum. One with v: null is not coded and the study says so; one with
     checked: null was not read against the code text and prints with "verify". */
  function siteRules(v, rs) {
    var c = rs && rs.city;
    var wa = v.stateAbbr ? v.stateAbbr === "WA" : v.juris !== "outside";
    var place = c ? "the City of " + c.name : v.juris === "seattle" ? "the City of Seattle" : v.juris === "kenmore" ? "the City of Kenmore" : v.juris === "edmonds" ? "the City of Edmonds" : v.juris === "kc" ? "unincorporated King County" : v.juris === "sno" ? "unincorporated Snohomish County" : "the local planning department";
    var code = c ? c.code : null, city = v.juris === "city" || v.juris === "seattle" || v.juris === "kenmore" || v.juris === "edmonds";
    return {
      place: place,
      asbestos: datum("An asbestos survey is required before any renovation or demolition, whatever the year the house was built.", SRC.pscaa402, CHECKED_NOV),
      lead: datum("In a home built before 1978, paid renovation work must follow lead-safe work practices.", SRC.epaRrp, CHECKED_NOV),
      reroof: v.juris === "seattle"
        ? datum("No permit for re-roofing a one- or two-family home or townhouse when the work does not change the building envelope beyond adding or replacing insulation. Replacing sheathing or framing needs a permit.", SRC.sdciReroof, CHECKED_NOV)
        : datum(null, code, null, "The re-roof permit rule for " + place + " is not coded."),
      reroofLayers: datum("A new roof may not be laid over a roof that already has two or more layers. That roof is torn off first.", SRC.irc908, CHECKED_NOV),
      drainage: v.juris === "seattle"
        ? datum("Seattle adopted a revised Stormwater Code in 2026 (Ord. 127444). The earlier code started drainage review at 750 sf of new plus replaced hard surface. The 2026 thresholds are not coded here.", SRC.sdciStorm, null)
        : (v.city === "redmond" ? datum("City of Redmond stormwater review threshold: verify (commonly triggered near 2,000 sf of new plus replaced hard surface; confirm with the City of Redmond).", code, null)
          : datum(null, code, null, "The stormwater threshold for " + place + " is not coded.")),
      wa: wa,
      parking: !wa ? null : (city
        ? datum("State law (ESSB 5184, 2025) caps what a city of more than 30,000 people may require: one space per single-family home, half a space per multifamily unit, and none for a home under 1,200 sf. Cities of 50,000 or more had 18 months from July 27, 2025 to comply, and cities of 30,000 to 50,000 have three years. The local parking table is not applied here.", SRC.sb5184, CHECKED_NOV)
        : datum(null, code, null, "The local parking table is not applied.")),
      fence: datum(null, code, null, "Fence height limits for " + place + " are not coded."),
      trees: datum(null, code, null, "Tree protection rules for " + place + " are not coded."),
      aduState: ADU_STATE
    };
  }

  /* Energy credits under WSEC-R R406.3 for an addition or a new house of a given conditioned floor area.
     The 2021 edition is in force until the 2024 codes take effect on May 3, 2027 (read Nov 2026).
     date: the day the study is prepared, YYYY-MM-DD. */
  var WSEC = { edition: "2021 WSEC-R", until: "2027-05-03", src: SRC.wsecR406, checked: CHECKED_NOV };
  function energyCredits(kind, sf, date) {
    var d = String(date || "");
    if (d && d >= WSEC.until) return { credits: null, state: "verify", edition: "2024 WSEC-R", why: "", text: "The 2024 energy code applies to permits applied for on or after May 3, 2027. Its credit table is not coded here.", src: WSEC.src, until: WSEC.until };
    var n = Number(sf);
    if (sf == null || !isFinite(n) || n <= 0) return { credits: null, state: "missing", edition: WSEC.edition, why: "", text: "", src: WSEC.src, until: WSEC.until };
    var c, why, state = "fact";
    if (kind === "addition") {
      if (n < 150) { c = 0; why = "additions under 150 sf are exempt"; }
      else if (n <= 500) { c = 2.0; why = "additions of 150 to 500 sf"; }
      else if (n < 1500) { c = 5.0; why = "an addition over 500 sf and under 1,500 sf counts as a small dwelling unit"; }
      else if (n <= 5000) { c = 8.0; why = "an addition of 1,500 sf or more counts as a medium dwelling unit"; if (n === 1500) state = "verify"; }
      else { c = 9.0; why = "over 5,000 sf"; }
    } else {
      if (n < 1500) { c = 5.0; why = "small dwelling unit, under 1,500 sf with under 300 sf of window area; otherwise 8.0"; }
      else if (n <= 5000) { c = 8.0; why = "medium dwelling unit"; }
      else { c = 9.0; why = "large dwelling unit, over 5,000 sf"; }
    }
    return { credits: c, state: state, edition: WSEC.edition, why: why, text: (c === 0 ? "Exempt" : c.toFixed(1) + " credits") + " (" + why + ")", src: WSEC.src, until: WSEC.until };
  }

  function pick(v) {
    v = v || {};
    var rs = pickBase(v), so = stripOverlay(v.zone);
    if (!rs && so.overlay && v.juris !== "city") {
      var v2 = {}, k;
      for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) v2[k] = v[k];
      v2.zone = so.base;
      rs = pickBase(v2);
    }
    if (!rs) {
      var cls = lotClass(v);
      var wa = v.stateAbbr ? v.stateAbbr === "WA" : v.juris !== "outside";
      if (cls === "nonres") rs = nonResidential(v);
      else if (cls === "residential") rs = typicalResidential(v);
      else if (cls === "blank" && !wa) rs = typicalResidential(v);
      else if (cls === "blank" && wa && v.juris === "city" && CITY[v.city]) rs = stateLawCity(v, CITY[v.city]);
      else if (cls === "unknown" || cls === "blank") rs = unrecognized(v);
      else rs = unrecognized(v);
    }
    if (so.overlay && rs.coded !== false) {
      rs.overlay = so.overlay;
      rs.overlayNote = "The zoning map shows " + String(v.zone).trim() + ". The " + so.overlay + " suffix marks " + (/SO/.test(so.overlay) ? "a special district overlay" : "property-specific development conditions") + " that sit on top of the base zone. The numbers here are the base zone's. Ask the jurisdiction what the suffix adds.";
    }
    if (!rs.height) rs.height = { ft: null, text: "" };
    if (!rs.adu) rs.adu = { status: "verify", maxCount: null, maxSf: null, heightFt: null, rearSetback: null, sideSetback: null, text: "", src: null };
    if (!rs.accounting) rs.accounting = { farIncludesGarage: null, farIncludesBasement: null, farIncludesAccessory: null, verify: true, note: "" };
    rs.site = siteRules(v, rs);
    return rs;
  }

  /* A missing number prints as a dash. Math.round(null) is 0, and "0 sf" for an unknown area is a wrong fact. */
  function fmt(n) { return n == null || n === "" || !isFinite(Number(n)) ? "\u2014" : Math.round(Number(n)).toLocaleString("en-US"); }

  var api = { pick: pick, SRC: SRC, CHECKED: CHECKED, CHECKED_NOV: CHECKED_NOV, fmt: fmt, CITY: CITY, cityKey: cityKey, findZone: findZone, zonesFor: function (k) { return CZ[k] ? Object.keys(CZ[k].zones) : []; },
    datum: datum, stripOverlay: stripOverlay, energyCredits: energyCredits, siteRules: siteRules, heightOf: heightOf, ADU_STATE: ADU_STATE, WSEC: WSEC,
    lotClass: lotClass, parseLr: parseLr, TYPICAL: TYPICAL, NONRES_NOTE: NONRES_NOTE };
  root.BuildHereRules = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
