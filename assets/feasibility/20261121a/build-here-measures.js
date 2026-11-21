/* Property measurements for the feasibility study.
   Roof outline, living area, gross floor area, garage floor area, and
   detached footprints stay separate. Unknown paving is never stored as 0,
   and lot-minus-roof is not labeled landscaping unless hard surfaces are known.
   This file does not call listing sites. */
(function (root) {
  "use strict";

  var KINDS = {
    living: "Finished living area",
    countyFinSize: "County finished size (basement, lower-level and attic finished area recorded separately and not added)",
    gfa: "Gross floor area",
    roof: "Roof outline (includes eaves when the source is a roof layer)",
    footprint: "Surveyed building footprint",
    otherBuilding: "Other mapped building footprint",
    firstFloor: "First-floor area",
    attachedGarage: "Attached garage floor area",
    detachedGarage: "Detached garage or accessory footprint",
    detachedGarageFloor: "Detached garage floor area",
    basementGarage: "Basement garage floor area",
    basementTotal: "Total basement area",
    basementFinished: "Finished basement area",
    deck: "Deck area",
    driveway: "Driveway and parking",
    hardscape: "Walkways, patios, decks and other hardscape",
    patio: "Patio",
    eaves: "Eave overhang"
  };

  var ZERO_KINDS = { driveway: 1, hardscape: 1, patio: 1, attachedGarage: 1, detachedGarage: 1, eaves: 1 };

  function num(v) {
    if (v == null || v === "") return null;
    var n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }

  function cleanMeasure(raw) {
    if (!raw || !KINDS[raw.kind]) return { ok: false, error: "Choose a measurement type." };
    var method = raw.method || "";
    var estimate = method === "aerial" || method === "photo";
    var sf = num(raw.sf);
    var low = num(raw.sfLow);
    var high = num(raw.sfHigh);
    if (ZERO_KINDS[raw.kind] && sf === 0 && !raw.measuredZero) {
      return { ok: false, error: "Leave unknown " + KINDS[raw.kind].toLowerCase() + " blank. Do not enter 0." };
    }
    if (estimate) {
      if (!(low > 0) || !(high >= low)) {
        return { ok: false, error: "An aerial or unscaled photo needs a low and a high square foot range. It is not a scale drawing, so one precise number is not stored." };
      }
      sf = null;
    } else if (!(sf > 0) && !(raw.measuredZero && sf === 0)) {
      return { ok: false, error: "Enter square feet greater than zero, or leave the measurement off the study." };
    }
    if (raw.url && !/^https?:\/\//i.test(String(raw.url))) {
      return { ok: false, error: "Source page must start with http:// or https://." };
    }
    return {
      ok: true,
      measure: {
        kind: raw.kind,
        label: KINDS[raw.kind],
        sf: sf,
        sfLow: low,
        sfHigh: high,
        source: raw.source || "",
        url: raw.url || "",
        retrieved: raw.retrieved || "",
        method: method || (raw.automatic ? "public record" : "manual"),
        confidence: (function () {
          var conf = raw.confidence || "Medium";
          var lowMethod = estimate || method === "listing" || method === "tape";
          if (lowMethod) return "Low";
          if (!raw.automatic && conf === "High") return "Medium";
          return conf;
        })(),
        automatic: !!raw.automatic,
        seq: raw.seq != null ? raw.seq : null,
        measuredZero: !!raw.measuredZero,
        note: raw.note || ""
      }
    };
  }

  /* Physical fields from one active Snohomish dwelling row.
     [FinSize, YrBuilt, Stories, AttGarSF, DetGarSF, dwellingRowCount, rowUpdated]
     FinSize is not proven to be total finished living area. BsmtFin, LowerFin,
     and AtticFinSF are separate columns and are not in this array. */
  function finSizeNote(nDwell) {
    var note = "This is the county's finished-size figure on one active dwelling record. Basement, lower-level and attic finished area are recorded separately and are not added. No official data dictionary was found, so this number is not total finished living area and the option cards do not use it as floor-area living area.";
    if (nDwell > 1) note += " This parcel has " + nDwell + " active dwelling records. The figure is the largest of them, not a sum.";
    return note;
  }
  function countyFinSizeRecord(rec) {
    var row = readSnoImprovement(rec);
    if (!row || row.fin == null) return null;
    return {
      sf: row.fin,
      nDwell: row.nDwell,
      source: "Snohomish County Improvement Records, finished-size column. Not enabled on the public page while the county-use hold is open.",
      method: "assessor extract",
      confidence: "Low",
      retrieved: row.updated || "",
      automatic: true,
      note: finSizeNote(row.nDwell)
    };
  }
  function readSnoImprovement(rec) {
    if (!rec || !rec.length) return null;
    function pos(v) {
      var n = Number(v);
      return isFinite(n) && n > 0 ? n : null;
    }
    var year = pos(rec[1]);
    return {
      fin: pos(rec[0]),
      year: year && year > 1800 ? Math.round(year) : null,
      stories: pos(rec[2]),
      attGar: pos(rec[3]),
      detGar: pos(rec[4]),
      nDwell: Number(rec[5]) > 0 ? Number(rec[5]) : 0,
      updated: rec[6] ? String(rec[6]) : ""
    };
  }

  /* One Snohomish record of the house-size index (scripts/build_index.py):
     [FinSize, YrBuilt, NumBedRms, Stories, kind]. A blank in the county file is null here, never 0.
     The index and the held sno-bldg folder are built from the same county workbook. */
  function readHouseSize(rec) {
    if (!rec || !rec.length) return null;
    function pos(v) { var n = Number(v); return v != null && v !== "" && isFinite(n) && n > 0 ? n : null; }
    var year = pos(rec[1]);
    return { fin: pos(rec[0]), year: year && year > 1800 ? Math.round(year) : null, beds: pos(rec[2]), stories: pos(rec[3]), kind: rec[4] ? String(rec[4]) : "" };
  }
  function houseSizeNote() {
    return "This is the county's finished-size figure on the dwelling record for this parcel. Basement, lower-level and attic finished area are recorded separately and are not added. No official data dictionary was found, so this number is shown as the county's figure and is not used as total finished living area in the floor-area math.";
  }

  function sfOrUnknown(row) {
    if (!row || row.sf == null || !isFinite(Number(row.sf))) return null;
    if (Number(row.sf) === 0 && !row.measuredZero) return null;
    return Number(row.sf);
  }

  function openArea(lot, parts) {
    parts = parts || {};
    if (lot == null || !isFinite(Number(lot))) {
      return { sf: null, verifiedLandscape: false, label: "Open area", note: "Lot area is not on record, so open area cannot be computed." };
    }
    var buildings = parts.buildings;
    if (buildings == null || !isFinite(Number(buildings))) {
      return { sf: null, verifiedLandscape: false, label: "Open area", note: "Building coverage is not measured, so open area is not computed." };
    }
    var lotN = Number(lot);
    var b = Number(buildings);
    var driveKnown = parts.drive != null && isFinite(Number(parts.drive));
    var hardKnown = parts.hard != null && isFinite(Number(parts.hard));
    // Buildings larger than the lot is a data error (a wrong lot size or a merged outline), not negative ground.
    var over = lotN - b < 0 ? " The mapped buildings measure larger than the lot area on record, so one of the two figures is wrong. Check both." : "";
    if (!driveKnown || !hardKnown) {
      return {
        sf: Math.max(0, Math.round(lotN - b)),
        verifiedLandscape: false,
        label: "Unclassified open area",
        note: "This is lot area minus mapped building coverage only. Driveway, walks, patios, or eaves are not all known, so this number is not landscaping." + over
      };
    }
    var sf = lotN - b - Number(parts.drive) - Number(parts.hard);
    return {
      sf: Math.max(0, Math.round(sf)),
      verifiedLandscape: true,
      label: "Remaining landscape (softscape)",
      note: "Lot area minus mapped buildings and classified hard surfaces. Still a planning estimate, not a survey." + (sf < 0 ? " The parts add up to more than the lot area on record, so one of the figures is wrong. Check them." : "")
    };
  }

  function parseDay(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }

  function conflictsAndStale(list) {
    var by = {};
    list.forEach(function (m) { (by[m.kind] = by[m.kind] || []).push(m); });
    var conflicts = [];
    var stale = [];
    Object.keys(by).forEach(function (k) {
      var rows = by[k];
      var valued = rows.filter(function (m) { return m.sf != null; });
      for (var i = 0; i < valued.length; i++) {
        for (var j = i + 1; j < valued.length; j++) {
          var a = valued[i], b = valued[j];
          var diff = Math.abs(a.sf - b.sf);
          if (diff >= 50 || diff / Math.max(a.sf, b.sf, 1) >= 0.05) {
            conflicts.push({
              kind: k,
              label: KINDS[k],
              a: a,
              b: b,
              note: KINDS[k] + " disagrees: " + Math.round(a.sf) + " sf (" + (a.source || a.method) + (a.retrieved ? ", read " + a.retrieved : "") + ") and " + Math.round(b.sf) + " sf (" + (b.source || b.method) + (b.retrieved ? ", read " + b.retrieved : "") + "). Both stay on the study."
            });
          }
        }
      }
      var ranges = rows.filter(function (m) { return m.sf == null && m.sfLow != null && m.sfHigh != null; });
      valued.forEach(function (p) {
        ranges.forEach(function (r) {
          if (p.sf < r.sfLow || p.sf > r.sfHigh) {
            conflicts.push({
              kind: k,
              label: KINDS[k],
              a: p,
              b: r,
              note: KINDS[k] + " disagrees: " + Math.round(p.sf) + " sf (" + (p.source || p.method) + ") is outside the estimate " + Math.round(r.sfLow) + " to " + Math.round(r.sfHigh) + " sf (" + (r.source || r.method) + "). Both stay on the study."
            });
          }
        });
      });
      var days = rows.map(function (m) { return parseDay(m.retrieved); }).filter(function (d) { return d != null; });
      if (days.length >= 2) {
        var min = Math.min.apply(null, days), max = Math.max.apply(null, days);
        if ((max - min) / 86400000 >= 540) {
          stale.push({
            kind: k,
            label: KINDS[k],
            note: KINDS[k] + " has readings more than 18 months apart. The older figure may be stale. Both dates stay visible."
          });
        }
      }
    });
    return { conflicts: conflicts, stale: stale };
  }

  function assemble(input) {
    input = input || {};
    var list = [];
    var errors = [];
    function add(raw) {
      if (!raw) return;
      var c = cleanMeasure(raw);
      if (c.ok) list.push(c.measure);
      else errors.push(c.error);
    }
    (input.records || []).forEach(add);
    (input.manual || []).forEach(function (m) { add(Object.assign({}, m, { automatic: false })); });
    var notes = [];
    var has = function (kind) { return list.some(function (m) { return m.kind === kind && (m.sf != null || m.sfLow != null); }); };
    if (has("living") && (has("roof") || has("footprint"))) {
      notes.push("Finished living area and the roof or building footprint are different measurements. They are not added together, and a roof outline is not living area or gross floor area.");
    }
    if (has("gfa") && (has("roof") || has("footprint"))) {
      notes.push("Gross floor area and the roof outline are different measurements. They are not added together.");
    }
    if (has("firstFloor") && has("roof")) {
      notes.push("First-floor area is not the roof outline. Eaves and porches can make the roof larger. They are not added.");
    }
    if (has("attachedGarage") && has("detachedGarage")) {
      notes.push("Attached garage floor area and a detached garage footprint are different measurements. They are not added together.");
    }
    var flags = conflictsAndStale(list);
    var open = input.skipOpen ? { sf: null, verifiedLandscape: false, label: "Open area", note: "" } : openArea(input.lot, {
      buildings: input.coverageSf,
      drive: input.driveSf,
      hard: input.hardSf
    });
    if (!input.skipOpen && open.sf != null && !open.verifiedLandscape) notes.push(open.note);
    return { measures: list, errors: errors, conflicts: flags.conflicts, stale: flags.stale, notes: notes, open: open };
  }

  function withEdit(records, kind, sf, date, seq) {
    var next = (records || []).slice();
    var value = num(sf);
    if (value == null) return next;
    var prior = next.filter(function (m) { return m.kind === kind && m.sf != null; });
    if (!prior.length || prior.some(function (m) { return m.sf !== value; })) {
      if (!prior.some(function (m) { return m.sf === value && m.method === "edited"; })) {
        next.push({
          kind: kind,
          sf: value,
          source: prior.length ? "Edited in this session" : "Entered in this session",
          retrieved: date || "",
          method: "edited",
          confidence: "Medium",
          seq: seq != null ? seq : null,
          automatic: false
        });
      }
    }
    return next;
  }

  function scenarios(ctx) {
    ctx = ctx || {};
    var lot = ctx.lot != null;
    var living = ctx.living != null;
    var roof = ctx.roof != null;
    var any = lot || living || roof;
    var z = !!ctx.zoningCoded;
    // Floor-area ratio has three states. hasFloorCap === true: a cap is coded.
    // hasFloorCap === false: the coded table itself sets none. Anything else:
    // not known here. Unknown is never worded as "none".
    var farNone = z && ctx.hasFloorCap === false;
    var farUnknown = z && ctx.hasFloorCap !== false && ctx.floorCap == null && ctx.roomFar == null;
    var basis = ctx.floorBasis === "gfa" ? "the gross floor area you entered" : "assessor finished living area, which stands in for code-counted floor area";
    var envBit = ctx.envArea > 0 ? " The setback envelope is about " + Math.round(ctx.envArea) + " sf." : (ctx.envArea === 0 ? " No area is left inside the setbacks as drawn." : "");
    function card(id, title, state, line, metric) {
      return { id: id, title: title, state: state, line: line, metric: metric };
    }
    function covPhrase() {
      if (ctx.roomCov != null && ctx.roomCov > 0) return " Coverage room left is about " + Math.round(ctx.roomCov) + " sf.";
      if (ctx.roomCov != null) return " No coverage room is left under the coded cap, so new floor area would have to go up, not out.";
      if (ctx.fullCov != null) return " The coverage cap is about " + Math.round(ctx.fullCov) + " sf.";
      return "";
    }
    var TYPICAL = "Typical residential assumptions, confirm with your local planning department. These are not the local code.";
    var NONRES = "This lot is not a house lot. The building is not labeled as a house, and an addition is not drawn. Confirm the use with your local planning department.";
    var addition;
    var UNKNOWN = "This zone is not recognized. Confirm the standards with your local planning department.";
    var BLANK = "No zone was found for this lot, confirm with your local planning department.";
    if (ctx.nonres) addition = card("addition", "Addition", "partial", NONRES, "Not a house lot");
    else if (ctx.blank) addition = card("addition", "Addition", "partial", BLANK, "Confirm locally");
    else if (ctx.unrecognized) addition = card("addition", "Addition", "partial", UNKNOWN, "Confirm locally");
    else if (ctx.assumed) addition = card("addition", "Addition", "partial", TYPICAL + " The concept is about 1,500 sf inside the assumed setbacks.", "Concept only");
    else if (!any) addition = card("addition", "Addition", "nodata", "No lot or house measurement is on record yet, so an addition cannot be sized.", "Needs a lot size or a house measurement");
    else if (ctx.roomFar != null && ctx.roomFar <= 0) addition = card("addition", "Addition", "partial", "Floor area on record is already at or over the coded floor cap as entered. Adding counted floor area may not fit. Below-grade area can change the count." + covPhrase() + envBit, "No floor room left");
    else if (ctx.roomFar != null) addition = card("addition", "Addition", "ready", "Floor area left under the coded cap is about " + Math.round(ctx.roomFar) + " sf, counted from " + basis + "." + covPhrase() + envBit + " Planning figure only. This does not say a permit will be issued.", "About " + Math.round(ctx.roomFar) + " sf floor room");
    else if (!z) addition = card("addition", "Addition", "partial", "An addition is not sized for this zone.", "Not sized");
    else if (farUnknown) addition = card("addition", "Addition", "partial", "A floor-area limit may apply in this zone and is not coded here, so floor room is not calculated." + covPhrase() + envBit + " Coverage alone does not say an addition fits.", "Floor-area limit not coded");
    else if (farNone) {
      if (ctx.roomCov != null && ctx.roomCov > 0) addition = card("addition", "Addition", "ready", "This zone has no floor-area ratio. Coverage room left is about " + Math.round(ctx.roomCov) + " sf." + envBit + " This does not say a permit will be issued.", Math.round(ctx.roomCov) + " sf coverage room");
      else if (ctx.roomCov != null) addition = card("addition", "Addition", "partial", "This zone has no floor-area ratio. No coverage room is left under the coded cap." + envBit, "No coverage room left");
      else if (ctx.fullCov != null) addition = card("addition", "Addition", "partial", "This zone has no floor-area ratio. The coverage cap is about " + Math.round(ctx.fullCov) + " sf, and the building footprint is missing, so room left is not calculated.", Math.round(ctx.fullCov) + " sf coverage cap");
      else if (ctx.hasImpervious && ctx.roomImp != null && ctx.roomImp > 0) addition = card("addition", "Addition", "partial", "This zone has no floor-area ratio and no lot coverage cap in the coded table. About " + Math.round(ctx.roomImp) + " sf of impervious room is left, and setbacks and height shape the rest." + envBit, "About " + Math.round(ctx.roomImp) + " sf impervious room");
      else addition = card("addition", "Addition", "partial", "This zone has no floor-area ratio in the coded table, and no coverage room was calculated. Setbacks, height and impervious surface limit an addition." + envBit, "No floor-area ratio");
    } else if (!living) addition = card("addition", "Addition", "partial", "A floor-area cap is coded, and finished living area is missing, so floor room is not calculated." + covPhrase() + envBit, ctx.roomCov != null ? Math.round(ctx.roomCov) + " sf coverage room" : "Needs finished living area");
    else addition = card("addition", "Addition", "partial", "The coded rules do not produce a floor-area room figure for this lot." + covPhrase(), "Verify with the jurisdiction");

    var adu;
    if (ctx.nonres) adu = card("adu", "ADU", "partial", NONRES, "Not a house lot");
    else if (ctx.blank) adu = card("adu", "ADU", "partial", BLANK, "Confirm locally");
    else if (ctx.unrecognized) adu = card("adu", "ADU", "partial", UNKNOWN, "Confirm locally");
    else if (ctx.assumed) adu = card("adu", "ADU", "partial", TYPICAL, "Concept only");
    else if (!any && !z) adu = card("adu", "ADU", "nodata", "No lot facts and no coded ADU rule are on record.", "Needs a lot and a zoning rule");
    else if (z && ctx.aduRule && ctx.roomCov != null && ctx.roomCov <= 0) adu = card("adu", "ADU", "partial", "The coded ADU standard for this zone is on the card. No lot coverage room is left for a detached ADU. An ADU inside the existing house, such as a basement or garage conversion, adds no coverage." + envBit, ctx.aduRule);
    else if (z && ctx.aduRule) adu = card("adu", "ADU", "ready", "The coded ADU standard for this zone is on the card. Count, size, and parking still have to be confirmed with the jurisdiction. This does not say an ADU permit will be issued." + covPhrase() + envBit, ctx.aduRule);
    else if (ctx.aduStateNote) adu = card("adu", "ADU", "partial", "State law sets a floor: a city inside an urban growth area must allow two ADUs on lots in zones that allow single-family homes. This zone's own ADU count, size, setbacks and parking are not coded here, and the floor does not reach every zone or lot. This card does not say an ADU fits this lot.", "State-law floor only. Local ADU standard not coded");
    else if (!z) adu = card("adu", "ADU", "partial", "An ADU is not sized for this zone.", "Not sized");
    else adu = card("adu", "ADU", "partial", "Zoning math is coded for this place, and a specific ADU size was not found in the rule set.", "Verify the ADU standard");

    var shop;
    var impNone = ctx.hasImpervious ? "" : " No impervious cap is coded for this zone here. One may still apply.";
    if (ctx.nonres) shop = card("shop", "Garage or shop", "partial", NONRES, "Not a house lot");
    else if (ctx.blank) shop = card("shop", "Garage or shop", "partial", BLANK, "Confirm locally");
    else if (ctx.unrecognized) shop = card("shop", "Garage or shop", "partial", UNKNOWN, "Confirm locally");
    else if (ctx.assumed) shop = card("shop", "Garage or shop", "partial", TYPICAL, "Concept only");
    else if (!any) shop = card("shop", "Garage or shop", "nodata", "No lot or coverage fact is on record, so a garage or shop cannot be sized.", "Needs a lot measurement");
    else if (ctx.roomCov != null && ctx.roomCov <= 0) shop = card("shop", "Garage or shop", "partial", "No coverage room is left under the coded cap." + impNone + envBit, "No coverage room left");
    else if (ctx.hasImpervious && ctx.roomImp != null && ctx.roomImp <= 0) shop = card("shop", "Garage or shop", "partial", "No impervious room is left under the coded cap." + covPhrase(), "No impervious room left");
    else if (ctx.roomCov != null && ctx.roomCov > 0 && ctx.hasImpervious && ctx.roomImp != null && ctx.roomImp > 0) shop = card("shop", "Garage or shop", "ready", "About " + Math.round(ctx.roomCov) + " sf of coverage room and about " + Math.round(ctx.roomImp) + " sf of impervious room are left under the coded caps. A street-facing vehicle door can also need a driveway length. This does not say a permit will be issued.", Math.round(ctx.roomCov) + " sf coverage room");
    else if (ctx.roomCov != null && ctx.roomCov > 0 && !ctx.hasImpervious) shop = card("shop", "Garage or shop", "ready", "Coverage room left is about " + Math.round(ctx.roomCov) + " sf." + impNone + envBit + " This does not say a permit will be issued.", Math.round(ctx.roomCov) + " sf coverage room");
    else if (ctx.roomCov != null && ctx.roomCov > 0 && ctx.hasImpervious && ctx.roomImp == null) shop = card("shop", "Garage or shop", "partial", "Coverage room is about " + Math.round(ctx.roomCov) + " sf. Impervious room is unknown because driveway or other paving was not measured. It is not filled in as zero.", Math.round(ctx.roomCov) + " sf coverage room");
    else if (!z) shop = card("shop", "Garage or shop", "partial", "A garage or shop is not sized for this zone.", "Not sized");
    else if (ctx.fullCov == null && ctx.hasImpervious && ctx.roomImp != null) shop = card("shop", "Garage or shop", "ready", "No lot coverage cap is coded for this zone here. About " + Math.round(ctx.roomImp) + " sf of impervious room is left under the coded cap, and a new roof, driveway or apron all count against it." + envBit + " This does not say a permit will be issued.", "About " + Math.round(ctx.roomImp) + " sf impervious room");
    else if (ctx.fullCov == null && ctx.hasImpervious) shop = card("shop", "Garage or shop", "partial", (roof ? "A roof outline is on record. " : "") + "This zone has no coverage cap in the coded rules. Impervious room is unknown because driveway or other paving was not measured. It is not filled in as zero.", "Paving not measured");
    else if (ctx.fullCov != null) shop = card("shop", "Garage or shop", "partial", "A coverage cap of about " + Math.round(ctx.fullCov) + " sf is coded. Enter a building footprint to see coverage room. Paving stays blank until a source measures it.", "Needs a footprint");
    else shop = card("shop", "Garage or shop", "partial", "No coverage or impervious cap is coded for this zone here, so a shop size is not calculated. Setbacks and height still apply.", "Limits not coded for this zone");

    var teardown;
    if (ctx.nonres) teardown = card("teardown", "Teardown and new house", "partial", NONRES, "Not a house lot");
    else if (ctx.blank) teardown = card("teardown", "Teardown and new house", "partial", BLANK, "Confirm locally");
    else if (ctx.unrecognized) teardown = card("teardown", "Teardown and new house", "partial", UNKNOWN, "Confirm locally");
    else if (ctx.assumed) teardown = card("teardown", "Teardown and new house", "partial", TYPICAL, "Concept only");
    else if (!lot && !z) teardown = card("teardown", "Teardown and new house", "nodata", "No lot size and no coded cap are on record, so a new house cannot be sized.", "Needs a lot and a zoning rule");
    else if (ctx.floorCap != null && ctx.floorCap > 0) teardown = card("teardown", "Teardown and new house", "ready", "A new house is sized to the full coded floor cap, about " + Math.round(ctx.floorCap) + " sf, not to leftover room under the current house." + covPhrase() + envBit + " Demolition rules are separate. This does not say a permit will be issued.", Math.round(ctx.floorCap) + " sf full floor cap");
    else if (ctx.floorCap != null && ctx.floorCap <= 0) teardown = card("teardown", "Teardown and new house", "partial", "The coded floor cap is not a positive area, so a new house is not sized from it." + covPhrase(), "No positive floor cap");
    else if (!z) teardown = card("teardown", "Teardown and new house", "partial", "A new house is not sized for this zone.", "Not sized");
    else if (farUnknown) teardown = card("teardown", "Teardown and new house", "partial", "A floor-area limit may apply in this zone and is not coded here." + (ctx.fullCov != null && ctx.fullCov > 0 ? " The coded coverage cap is about " + Math.round(ctx.fullCov) + " sf." : "") + envBit + " A new house is not sized from coverage alone.", ctx.fullCov != null && ctx.fullCov > 0 ? Math.round(ctx.fullCov) + " sf coverage cap, floor-area limit not coded" : "Floor-area limit not coded");
    else if (ctx.fullCov != null && ctx.fullCov > 0) teardown = card("teardown", "Teardown and new house", "ready", "The coded table sets no floor-area ratio. A new house is limited by the coverage cap of about " + Math.round(ctx.fullCov) + " sf, with height and setbacks." + envBit + " This does not say a permit will be issued.", Math.round(ctx.fullCov) + " sf coverage cap");
    else teardown = card("teardown", "Teardown and new house", "partial", farNone ? "The coded table sets no floor-area ratio and no lot coverage cap for this zone. Impervious surface, height and setbacks set the size of a new house, so no single cap is shown." + envBit : "No floor cap or coverage cap comes out of the coded rules for this lot.", "Verify the cap");

    var remodel;
    if (!living && !roof) remodel = card("remodel", "Remodel", "nodata", "No existing house size is on record, so a remodel scope cannot be checked.", "Needs living area or a footprint");
    else if (living && roof) remodel = card("remodel", "Remodel", "ready", "Interior work that stays inside the existing walls usually does not change the " + Math.round(ctx.living) + " sf living area or the " + Math.round(ctx.roof) + " sf roof outline. Those two numbers are not added. Structural, plumbing, electrical, and mechanical permits can still apply. This does not say a permit will be issued.", Math.round(ctx.living) + " sf living area");
    else if (living) remodel = card("remodel", "Remodel", "partial", "Finished living area is " + Math.round(ctx.living) + " sf. A roof outline was not measured, so coverage change cannot be checked.", Math.round(ctx.living) + " sf living area");
    else remodel = card("remodel", "Remodel", "partial", farNone ? "A roof outline is on record. This zone has no floor-area ratio, so living area is not required to check a floor cap. Finished living area was not in the sources read for this lot." : "A roof outline is on record and finished living area is not, so an interior remodel cannot be checked against a floor-area cap.", farNone ? "No floor-area ratio" : "Needs finished living area");

    var finBit = "";
    if (ctx.countyFinSize != null) {
      finBit = " The county finished-size figure is about " + Math.round(ctx.countyFinSize) + " sf. It is not used as finished living area. Basement, lower-level and attic finished area are recorded separately and are not added.";
      if (ctx.countyFinRows > 1) finBit += " More than one active dwelling row exists. The figure is the largest row, not a sum.";
    }
    // A card that reads Ready is a figure from a coded rule and a measurement on
    // this lot. A mapped hazard, steep ground or a location-only parcel match
    // means that figure can be wrong, so the card drops to Partial and says why.
    var siteCaution = ctx.siteCaution || "";
    var matchCaution = ctx.matchCaution || "";
    return [addition, adu, shop, teardown, remodel].map(function (c) {
      if (finBit) c.line += finBit;
      if (c.state === "ready") {
        var why = [];
        if (matchCaution) why.push(matchCaution);
        if (siteCaution && c.id !== "remodel") why.push(siteCaution);
        if (ctx.zoneCaution && c.id !== "remodel") why.push(ctx.zoneCaution);
        if (ctx.envArea === 0 && c.id !== "remodel") why.push("With no area inside the setbacks, new building may not fit. Check the street side and the setbacks under Edit the facts.");
        if (c.id === "shop" && farUnknown) why.push("A floor-area limit may also apply in this zone and is not coded here.");
        if (why.length) { c.state = "partial"; c.line += " " + why.join(" "); }
      }
      return c;
    });
  }

  /* The figure the math reads for one kind. A typed figure beats an automatic one. Between typed figures
     the one entered last wins, by its sequence number: an edit in the form made after a typed source, or
     the other way round. Without sequence numbers it is the last in the list, as before. */
  function pickRow(list, kind, usersOnly) {
    var rows = list.filter(function (m) { return m.kind === kind && m.sf != null && (!usersOnly || !m.automatic); });
    if (!rows.length) return null;
    var user = rows.filter(function (m) { return !m.automatic; });
    if (!user.length) return rows[0];
    var best = user[user.length - 1], bestSeq = best.seq != null ? best.seq : -1;
    user.forEach(function (m) { if (m.seq != null && m.seq > bestSeq) { best = m; bestSeq = m.seq; } });
    return best;
  }
  function pickPoint(list, kind, usersOnly) {
    var row = pickRow(list, kind, usersOnly);
    return row ? row.sf : null;
  }

  /* Concept sizes for the option sheets, from the same room figures the cards print.
     feasible: true (a coded cap was checked and it fits), false (a coded cap is used up), or
     null (not known: a rule or a measurement is missing, and the sheet says which).
     o: { effective, zoningCoded, hasFloorCap, floorCap, coverageCap, imperviousCap, envArea,
          stories, firstFloor, heightFt, adu, defaults } */
  function options(o) {
    o = o || {};
    var e = o.effective || {}, d = o.defaults || {}, z = !!o.zoningCoded;
    var roomFar = e.roomFar != null ? e.roomFar : null, roomCov = e.roomCov != null ? e.roomCov : null, roomImp = e.roomImp != null ? e.roomImp : null;
    var farUnknown = z && o.hasFloorCap !== false && o.floorCap == null;
    var farRoomUnknown = o.floorCap != null && roomFar == null;
    function opt(id, title) { return { id: id, kind: id, title: title, feasible: null, why: "", footprintSf: null, levels: null, gfaSf: null, notes: [] }; }
    function minOf() { var m = null; for (var i = 0; i < arguments.length; i++) { var v = arguments[i]; if (v != null && isFinite(v) && (m == null || v < m)) m = v; } return m; }
    function r10(v) { return Math.round(v / 10) * 10; }
    var out = [];

    // Addition: about 1,500 sf on two levels unless a cap says less. With no ground room it goes up.
    var TYPICAL = "Typical residential assumptions, confirm with your local planning department. These are not the local code.";
    var NONRES = "This lot is not a house lot. The building is not labeled as a house, and an addition is not drawn. Confirm the use with your local planning department.";
    var a = opt("addition", "Addition"), wantGfa = d.additionGfa || 1500, lv = d.additionLevels || 2;
    var UNKNOWN = "This zone is not recognized. Confirm the standards with your local planning department.";
    var BLANK = "No zone was found for this lot, confirm with your local planning department.";
    if (o.nonres) a.why = NONRES;
    else if (o.blank) a.why = BLANK;
    else if (o.unrecognized) a.why = UNKNOWN;
    else if (o.assumed) {
      a.footprintSf = Math.round(wantGfa / lv); a.levels = lv; a.gfaSf = r10(wantGfa); a.feasible = null;
      a.why = TYPICAL;
      a.notes.push("Concept only. The setbacks and the height are assumptions, not the local code.");
    }
    else if (!z) a.why = "An addition is not sized for this zone.";
    else if (roomFar != null && roomFar <= 0) { a.feasible = false; a.why = "The floor area on record is at or over the floor cap."; }
    else {
      var gfa = minOf(wantGfa, roomFar), fp = gfa / lv;
      if (roomCov != null && roomCov < fp) {
        if (roomCov >= (d.minFootprint || 120)) { fp = roomCov; gfa = Math.min(gfa, fp * lv); a.notes.push("Sized to the lot coverage room left."); }
        else {
          var st = o.stories != null && isFinite(Number(o.stories)) ? Number(o.stories) : null;
          if (st != null && st < 2 && (o.heightFt == null || o.heightFt >= 22)) {
            var base = o.firstFloor != null ? o.firstFloor : (e.roof != null ? e.roof * 0.85 : null);
            var up = minOf(base, roomFar, wantGfa);
            if (up != null && up >= 300) {
              a.kind = "secondStory"; a.title = "Second-story addition"; a.feasible = farUnknown || farRoomUnknown ? null : true;
              a.footprintSf = 0; a.levels = 1; a.gfaSf = r10(up);
              a.why = "No lot coverage room is left at the ground, so the concept goes up over the existing house. Pacific Pro Group checks the framing and foundation on site.";
            }
          }
          if (a.kind !== "secondStory") { a.feasible = false; a.why = "No lot coverage room is left for a ground-floor addition" + (st != null && st >= 2 ? ", and the record shows " + st + " stories already." : "."); }
        }
      }
      if (a.kind !== "secondStory" && a.feasible !== false) {
        a.footprintSf = Math.round(fp); a.levels = lv; a.gfaSf = r10(gfa);
        if (roomFar != null && roomFar < wantGfa) a.notes.push("Sized to the floor room left under the cap.");
        if (farUnknown) { a.feasible = null; a.why = "A floor-area limit may apply in this zone and is not coded, so this size is a concept only."; }
        else if (farRoomUnknown) { a.feasible = null; a.why = "The existing floor area is not on record, so the floor room left is not known."; }
        else a.feasible = true;
      }
    }
    out.push(a);

    // Detached ADU: the coded size limit, or the 1,000 sf state law guarantees where the city's is not coded.
    var u = opt("adu", "Detached ADU"), adu = o.adu || {};
    var maxSf = adu.maxSf != null ? adu.maxSf : (adu.status === "state" ? 1000 : null);
    if (o.nonres) u.why = NONRES;
    else if (o.blank) u.why = BLANK;
    else if (o.unrecognized) u.why = UNKNOWN;
    else if (o.assumed) u.why = TYPICAL;
    else if (!z) u.why = "An ADU is not sized for this zone.";
    else if (maxSf == null) u.why = "The ADU standard for this zone is not coded.";
    else if (roomFar != null && roomFar <= 0) { u.feasible = false; u.why = "The floor area on record is at or over the floor cap. Some codes raise the cap when a home is added: set Homes on the lot under Edit the facts."; }
    else {
      var ug = minOf(maxSf, d.aduGfa || 1000), tall = adu.heightFt == null || adu.heightFt >= 18;
      if (roomFar != null && roomFar < ug) { ug = roomFar; u.notes.push("Held to the floor room left. ADU floor area is counted toward the cap here, which is the cautious reading."); }
      if (roomCov == null || roomCov >= ug) { u.footprintSf = Math.round(ug); u.levels = 1; }
      else if (roomCov >= ug / 2 && tall) { u.footprintSf = Math.round(ug / 2); u.levels = 2; u.notes.push("Two levels, to fit the lot coverage room left."); }
      else if (roomCov >= 220) { u.footprintSf = Math.floor(roomCov / 10) * 10; u.levels = tall ? 2 : 1; ug = Math.min(ug, u.footprintSf * u.levels); u.notes.push("Sized to the lot coverage room left."); }
      else { u.feasible = false; u.why = "No lot coverage room is left for a detached ADU. An ADU inside the house, such as a basement or garage conversion, adds no coverage."; }
      if (u.feasible !== false) {
        u.gfaSf = r10(ug);
        if (adu.status === "coded" && !adu.partial && !farUnknown) u.feasible = true;
        else { u.feasible = null; u.why = adu.status === "coded" && !adu.partial ? "A floor-area limit may apply in this zone and is not coded." : "The city's own ADU size limit is not coded. The concept uses the 1,000 sf that state law guarantees inside urban growth areas."; }
      }
    }
    out.push(u);

    // Garage or shop: a two-car footprint unless coverage or impervious room says less.
    var s = opt("shop", "Garage or shop");
    if (o.nonres) s.why = NONRES;
    else if (o.blank) s.why = BLANK;
    else if (o.unrecognized) s.why = UNKNOWN;
    else if (o.assumed) s.why = TYPICAL;
    else if (!z) s.why = "A garage or shop is not sized for this zone.";
    else if (roomCov != null && roomCov <= 0) { s.feasible = false; s.why = "No lot coverage room is left under the cap."; }
    else if (o.imperviousCap != null && roomImp != null && roomImp <= 0) { s.feasible = false; s.why = "No impervious surface room is left under the cap."; }
    else {
      var sf = minOf(d.shopSf || 576, roomCov, o.imperviousCap != null ? roomImp : null);
      if (sf != null && sf >= 120) {
        s.footprintSf = Math.round(sf); s.levels = 1; s.gfaSf = s.footprintSf;
        s.feasible = roomCov != null || (o.imperviousCap != null && roomImp != null) ? true : null;
        if (s.feasible == null) s.why = o.imperviousCap != null ? "Impervious room is not known because paving was not measured, so this size is a concept only." : "No coverage or impervious cap is coded for this zone, so this size is a concept only.";
        if (sf < (d.shopSf || 576)) s.notes.push("Sized to the room left under the caps.");
      } else { s.feasible = false; s.why = "Less than 120 sf of room is left under the caps."; }
    }
    out.push(s);

    // New house: the full floor cap on two levels, inside the coverage cap and the envelope.
    var t = opt("teardown", "New house"), lv2 = d.houseLevels || 2;
    if (o.nonres) t.why = NONRES;
    else if (o.blank) t.why = BLANK;
    else if (o.unrecognized) t.why = UNKNOWN;
    else if (o.assumed) t.why = TYPICAL;
    else if (!z) t.why = "A new house is not sized for this zone.";
    else if (o.floorCap == null && o.coverageCap == null && !(o.envArea > 0)) t.why = "No floor cap, coverage cap or setback envelope is known for this lot, so a new house is not sized.";
    else {
      var fpt = minOf(o.coverageCap, o.floorCap != null ? o.floorCap / lv2 : null, o.envArea > 0 ? o.envArea * 0.85 : null, d.houseFootprintMax || 3000);
      t.footprintSf = Math.round(fpt); t.levels = lv2; t.gfaSf = r10(minOf(o.floorCap, fpt * lv2));
      if (farUnknown) { t.feasible = null; t.why = "A floor-area limit may apply in this zone and is not coded, so this size is a concept only."; }
      else t.feasible = true;
      if (o.floorCap != null && t.gfaSf >= o.floorCap - 5) t.notes.push("At the floor cap.");
    }
    out.push(t);

    var m = opt("remodel", "Interior remodel");
    m.footprintSf = 0; m.feasible = e.living != null || e.roof != null ? true : null;
    m.why = "Work inside the existing walls adds no lot coverage, floor area or setback question. Kitchens, baths and basements are the usual scope.";
    out.push(m);

    // How big something may be and where it can sit are two questions. The caps answer the first. The setback
    // envelope answers the second, and it is not always known: the zone's setbacks may not all be coded, or there
    // may be no lot outline. A size that fits the caps is then said to be unplaced, never just "fits".
    var envKnown = o.envArea != null && isFinite(o.envArea);
    out.forEach(function (x) {
      if (x.kind === "remodel" || x.kind === "secondStory" || x.feasible === false || !(x.footprintSf > 0)) return;
      if (!envKnown) { x.placement = "unchecked"; x.notes.push(UNPLACED); }
      else if (!(o.envArea > 0)) { x.placement = "none"; x.feasible = false; x.why = "No area is left inside the setbacks as drawn from the lot outline, so a new footprint does not fit as read."; }
    });
    return out;
  }

  var UNPLACED = "The setbacks are not all coded here, or the lot outline is not known, so where it can sit on the lot is not checked.";
  function resolveStudy(input) {
    input = input || {};
    var auto = input.auto || {};
    var records = [];
    function pushAuto(kind, rec) {
      if (!rec || rec.sf == null || !isFinite(Number(rec.sf))) return;
      records.push({
        kind: kind, sf: Number(rec.sf), source: rec.source || "", url: rec.url || "",
        retrieved: rec.retrieved || "", method: rec.method || "public record",
        confidence: rec.confidence || "Medium", automatic: true, measuredZero: !!rec.measuredZero, note: rec.note || ""
      });
    }
    pushAuto("living", auto.living);
    pushAuto("roof", auto.roof);
    pushAuto("firstFloor", auto.firstFloor);
    pushAuto("attachedGarage", auto.attachedGarage);
    pushAuto("detachedGarage", auto.detached);
    pushAuto("detachedGarageFloor", auto.detachedGarageFloor);
    pushAuto("otherBuilding", auto.other);
    pushAuto("driveway", auto.drive);
    pushAuto("hardscape", auto.hard);
    pushAuto("countyFinSize", auto.countyFinSize);
    pushAuto("basementGarage", auto.basementGarage);
    pushAuto("basementTotal", auto.basementTotal);
    pushAuto("basementFinished", auto.basementFinished);
    pushAuto("deck", auto.deck);
    var edit = input.edit || {};
    // An edit is a number, or { sf, seq } when the page knows the order the visitor typed things in.
    function editSf(x) { return x != null && typeof x === "object" ? x.sf : x; }
    function editSeq(x) { return x != null && typeof x === "object" && x.seq != null ? x.seq : null; }
    if (edit.living != null) records = withEdit(records, "living", editSf(edit.living), input.date, editSeq(edit.living));
    if (edit.roof != null) records = withEdit(records, "roof", editSf(edit.roof), input.date, editSeq(edit.roof));
    if (edit.survey != null) records = withEdit(records, "footprint", editSf(edit.survey), input.date, editSeq(edit.survey));
    if (edit.firstFloor != null) records = withEdit(records, "firstFloor", editSf(edit.firstFloor), input.date, editSeq(edit.firstFloor));
    var bundle = assemble({ lot: input.lot, records: records, manual: input.manual || [], skipOpen: true });
    var list = bundle.measures;
    var roof = pickPoint(list, "roof");
    var survey = pickPoint(list, "footprint");
    var detached = pickPoint(list, "detachedGarage");
    var other = pickPoint(list, "otherBuilding");
    // Coverage needs the main building. An outbuilding alone is not the lot's
    // coverage, and a missing house footprint is not a house of 0 sf.
    var buildings = survey != null ? survey : roof;
    if (buildings != null) {
      if (detached != null) buildings += detached;
      if (other != null) buildings += other;
    } else if (detached != null || other != null) {
      bundle.notes.push("An outbuilding footprint is on record and the main house footprint is not. Building coverage is left uncalculated. The house is not treated as zero.");
    }
    // Hardscape is walks, patios, decks and the rest together. A typed patio is one part of it:
    // it does not stand in for the whole, and it does not replace a mapped hardscape figure.
    var userHs = pickPoint(list, "hardscape", true), userPatio = pickPoint(list, "patio", true), autoHs = pickPoint(list, "hardscape");
    var hard = null;
    if (userHs != null) {
      hard = userHs + (userPatio != null ? userPatio : 0);
      if (userPatio != null) bundle.notes.push("Other hardscape (" + Math.round(userHs) + " sf) and the patio (" + Math.round(userPatio) + " sf) were both typed and are added together. If the hardscape figure already includes the patio, remove the patio entry.");
    } else if (userPatio != null && autoHs != null) {
      hard = autoHs;
      bundle.notes.push("The mapped hardscape figure (" + Math.round(autoHs) + " sf) already covers patios, so the typed patio of " + Math.round(userPatio) + " sf is listed and not added to it.");
    } else if (userPatio != null) {
      bundle.notes.push("A patio of " + Math.round(userPatio) + " sf is listed. A patio alone is not all the hardscape, so walkways, decks and other paving stay unknown and the paving total is left uncalculated. Add them as Other hardscape to complete it.");
    } else hard = autoHs;
    var drive = pickPoint(list, "driveway");
    var living = pickPoint(list, "living");
    // Two figures of one kind can sit on the study. Say which one the math reads.
    function usedNote(kind, used) {
      var rows = list.filter(function (m) { return m.kind === kind && m.sf != null; });
      if (rows.length < 2 || used == null) return;
      var typed = rows.filter(function (m) { return !m.automatic; });
      var pick = pickRow(list, kind) || rows[0];
      bundle.notes.push(KINDS[kind].split(" (")[0] + " has " + rows.length + " figures on this study. The math uses " + Math.round(used) + " sf (" + (pick.source || pick.method) + (pick.automatic ? "" : (typed.length > 1 ? ", the entry added last" : ", your entry")) + ").");
    }
    usedNote("living", living);
    usedNote("roof", survey == null ? roof : null);
    usedNote("footprint", survey);
    usedNote("driveway", drive);
    usedNote("hardscape", userHs != null ? userHs : null);
    usedNote("detachedGarage", detached);
    // A floor-area cap is written in gross floor area. When the visitor typed one
    // with a source, it is the better figure for floor room than assessor living area.
    // A floor-area cap is written in gross floor area. When the visitor typed one with a source, it is
    // the better figure for floor room than assessor living area. Otherwise the count starts from
    // assessor living area and adds what the zone's own accounting says to add (input.accounting):
    // garage, unfinished basement, outbuildings. Where the zone's accounting is not known, living area
    // stands alone, as before, and the study says it is a stand-in.
    var acct = input.accounting || {};
    var attGar = pickPoint(list, "attachedGarage"), bsmtGar = pickPoint(list, "basementGarage"), detFloor = pickPoint(list, "detachedGarageFloor");
    var bTot = pickPoint(list, "basementTotal"), bFin = pickPoint(list, "basementFinished"), deck = pickPoint(list, "deck");
    var gfa = pickPoint(list, "gfa", true);
    var floorUsed = null, floorBasis = "", floorParts = [], floorMissing = [];
    if (gfa != null) {
      floorUsed = gfa; floorBasis = "gfa";
      floorParts.push({ key: "gfa", label: "Gross floor area you entered", sf: gfa, counted: true });
    } else if (living != null) {
      floorUsed = living; floorBasis = "living";
      floorParts.push({ key: "living", label: "Finished living area", sf: living, counted: true });
      var garParts = [["attachedGarage", "Attached garage", attGar], ["basementGarage", "Basement garage", bsmtGar], ["detachedGarageFloor", "Detached garage (floor area on record)", detFloor]].filter(function (g) { return g[2] != null; });
      if (acct.farIncludesGarage === true) {
        garParts.forEach(function (g) { floorParts.push({ key: g[0], label: g[1], sf: g[2], counted: true }); floorUsed += g[2]; });
        if (!garParts.length && !input.garageNone) floorMissing.push("garage");
        floorBasis = "counted";
      } else garParts.forEach(function (g) { floorParts.push({ key: g[0], label: g[1], sf: g[2], counted: acct.farIncludesGarage === false ? false : null }); });
      if (acct.farIncludesBasement === true) {
        if (bTot != null && bFin != null) {
          var unfin = bTot - bFin - (bsmtGar != null ? bsmtGar : 0);
          if (unfin > 0) { floorParts.push({ key: "basementUnfinished", label: "Unfinished basement", sf: unfin, counted: true }); floorUsed += unfin; }
        } else if (!input.basementNone) floorMissing.push("unfinished basement");
        floorBasis = "counted";
      }
      if (acct.farIncludesAccessory === true) {
        var accSf = (detFloor == null && detached != null ? detached : 0) + (other != null ? other : 0);
        if (accSf > 0) { floorParts.push({ key: "accessory", label: "Detached outbuildings (mapped footprint, estimate)", sf: accSf, counted: true, est: true }); floorUsed += accSf; }
        floorBasis = "counted";
      }
      if (floorBasis === "counted" && floorUsed !== living) bundle.notes.push("Floor room counts " + floorParts.filter(function (x) { return x.counted === true && x.key !== "living"; }).map(function (x) { return x.label.toLowerCase() + " (" + Math.round(x.sf) + " sf)"; }).join(", ") + " on top of the " + Math.round(living) + " sf of finished living area, because this zone's cap is written for all floor area." + (acct.verify ? " That reading of the code is marked verify." : ""));
      if (floorMissing.length) bundle.notes.push("This zone's floor cap also counts " + floorMissing.join(" and ") + ", which is not on record here. The floor area used is therefore a minimum, and the real room left can be smaller.");
    }
    if (gfa != null && living != null) bundle.notes.push("Gross floor area of " + Math.round(gfa) + " sf was typed with a source, so floor room uses it in place of the " + Math.round(living) + " sf assessor living area. Both stay visible.");
    var countyFin = pickPoint(list, "countyFinSize");
    if (living != null && countyFin != null && Math.round(living) !== Math.round(countyFin)) {
      bundle.notes.push("The county finished-size figure is " + Math.round(countyFin) + " sf and another finished-area figure on this study is " + Math.round(living) + " sf. Both stay visible. The county figure is not substituted for finished living area.");
    }
    var open = openArea(input.lot, { buildings: buildings, drive: drive, hard: hard });
    bundle.open = open;
    if (open.sf != null && !open.verifiedLandscape) bundle.notes.push(open.note);
    var floorCap = input.floorCap != null ? input.floorCap : null;
    var fullCov = input.coverageCap != null ? input.coverageCap : null;
    var roomFar = floorCap != null && floorUsed != null ? floorCap - floorUsed : null;
    var roomCov = fullCov != null && buildings != null ? fullCov - buildings : null;
    var hasImpervious = input.imperviousCap != null;
    var impParts = buildings != null && drive != null && hard != null ? buildings + drive + hard : null;
    var impTyped = input.imperv != null ? Number(input.imperv) : null, impRejected = false;
    if (impTyped != null && buildings != null && impTyped < buildings) {
      impRejected = true;
      bundle.notes.push("The impervious figure typed (" + Math.round(impTyped) + " sf) is smaller than the building coverage on this study (" + Math.round(buildings) + " sf). Roofs are impervious, so that figure is not used and impervious room is left uncalculated.");
      impTyped = null;
    }
    var impBase = impRejected ? null : (impTyped != null ? impTyped : impParts);
    // What is known of the hard surface when a part is missing: a floor under the real total, printed as "at least".
    var impKnown = null, impMissing = [];
    if (buildings != null) {
      impKnown = buildings + (drive != null ? drive : 0) + (hard != null ? hard : 0);
      if (drive == null) impMissing.push("driveway and parking");
      if (hard == null) impMissing.push("walks, patios and decks");
    }
    var roomImp = hasImpervious && impBase != null ? input.imperviousCap - impBase : null;
    var cards = scenarios({
      lot: input.lot, living: living, roof: roof, zoningCoded: !!input.zoningCoded,
      hasFloorCap: input.hasFloorCap === true ? true : (input.hasFloorCap === false ? false : null),
      floorCap: floorCap, fullCov: fullCov, floorBasis: floorBasis,
      roomFar: roomFar, roomCov: roomCov, roomImp: roomImp, hasImpervious: hasImpervious,
      envArea: input.envArea != null ? input.envArea : null, aduRule: input.aduRule || "",
      aduStateNote: input.aduStateNote || "", siteCaution: input.siteCaution || "", matchCaution: input.matchCaution || "", zoneCaution: input.zoneCaution || "",
      assumed: !!input.assumed, nonres: !!input.nonres, unrecognized: !!input.unrecognized, blank: !!input.blank,
      countyFinSize: countyFin, countyFinRows: (auto.countyFinSize && auto.countyFinSize.nDwell) || 0
    });
    return {
      bundle: bundle, cards: cards,
      effective: {
        living: living, roof: roof, survey: survey, buildings: buildings, detached: detached, other: other, drive: drive, hard: hard,
        impervious: impBase, impervRejected: impRejected, impKnown: impKnown, impMissing: impMissing,
        floorUsed: floorUsed, floorBasis: floorBasis, floorParts: floorParts, floorMissing: floorMissing,
        attachedGarage: attGar, basementGarage: bsmtGar, detachedGarageFloor: detFloor, basementTotal: bTot, basementFinished: bFin, deck: deck,
        countyFinSize: pickPoint(list, "countyFinSize"),
        roomFar: roomFar, roomCov: roomCov, roomImp: roomImp
      }
    };
  }

  var api = {
    KINDS: KINDS,
    cleanMeasure: cleanMeasure,
    sfOrUnknown: sfOrUnknown,
    openArea: openArea,
    assemble: assemble,
    withEdit: withEdit,
    scenarios: scenarios,
    resolveStudy: resolveStudy,
    pickPoint: pickPoint,
    pickRow: pickRow,
    options: options,
    readHouseSize: readHouseSize,
    houseSizeNote: houseSizeNote,
    readSnoImprovement: readSnoImprovement,
    countyFinSizeRecord: countyFinSizeRecord,
    finSizeNote: finSizeNote
  };
  root.BuildHereMeasures = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
