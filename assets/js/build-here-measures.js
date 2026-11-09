/* Property measurements for the feasibility study.
   Roof outline, living area, gross floor area, garage floor area, and
   detached footprints stay separate. Unknown paving is never stored as 0,
   and lot-minus-roof is not labeled landscaping unless hard surfaces are known.
   This file does not call listing sites. */
(function (root) {
  "use strict";

  var KINDS = {
    living: "Finished living area",
    countyFinSize: "FinSize (county finished size; basement and lower-level finished area recorded separately and not added)",
    gfa: "Gross floor area",
    roof: "Roof outline (includes eaves when the source is a roof layer)",
    footprint: "Surveyed building footprint",
    otherBuilding: "Other mapped building footprint",
    firstFloor: "First-floor area",
    attachedGarage: "Attached garage floor area",
    detachedGarage: "Detached garage or accessory footprint",
    detachedGarageFloor: "Detached garage floor area",
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
    var note = "FinSize is the county finished-size column on one active dwelling row. Basement finished area, lower-level finished area, and attic finished area are separate columns and are not added. No official data dictionary was found, so this number is not total finished living area and the option cards do not use it as floor-area living area.";
    if (nDwell > 1) note += " This parcel has " + nDwell + " active dwelling rows. The figure is the largest FinSize, not a sum of the rows.";
    return note;
  }
  function countyFinSizeRecord(rec) {
    var row = readSnoImprovement(rec);
    if (!row || row.fin == null) return null;
    return {
      sf: row.fin,
      nDwell: row.nDwell,
      source: "Snohomish County Improvement Records, FinSize column. Not enabled on the public page while the county-use hold is open.",
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
    if (!driveKnown || !hardKnown) {
      return {
        sf: Math.round(lotN - b),
        verifiedLandscape: false,
        label: "Unclassified open area",
        note: "This is lot area minus mapped building coverage only. Driveway, walks, patios, or eaves are not all known, so this number is not landscaping."
      };
    }
    var sf = lotN - b - Number(parts.drive) - Number(parts.hard);
    return {
      sf: Math.round(sf),
      verifiedLandscape: true,
      label: "Remaining landscape (softscape)",
      note: "Lot area minus mapped buildings and classified hard surfaces. Still a planning estimate, not a survey."
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

  function withEdit(records, kind, sf, date) {
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
    var envBit = ctx.envArea != null ? " The setback envelope is about " + Math.round(ctx.envArea) + " sf." : "";
    function card(id, title, state, line, metric) {
      return { id: id, title: title, state: state, line: line, metric: metric };
    }
    function covPhrase() {
      if (ctx.roomCov != null && ctx.roomCov > 0) return " Coverage room left is about " + Math.round(ctx.roomCov) + " sf.";
      if (ctx.roomCov != null) return " No coverage room is left under the coded cap.";
      if (ctx.fullCov != null) return " The coverage cap is about " + Math.round(ctx.fullCov) + " sf.";
      return "";
    }
    var addition;
    if (!any) addition = card("addition", "Addition", "nodata", "No lot or house measurement is on record yet, so an addition cannot be sized.", "Needs a lot size or a house measurement");
    else if (ctx.roomFar != null && ctx.roomFar <= 0) addition = card("addition", "Addition", "partial", "Finished living area is already at or over the coded floor cap as entered. Adding counted floor area may not fit. Below-grade area can change the count." + covPhrase() + envBit, "No floor room left");
    else if (ctx.roomFar != null) addition = card("addition", "Addition", "ready", "Counted floor area left under the coded cap is about " + Math.round(ctx.roomFar) + " sf." + covPhrase() + envBit + " Planning figure only. This does not say a permit will be issued.", Math.round(ctx.roomFar) + " sf floor room");
    else if (!z) addition = card("addition", "Addition", "partial", "Floor-area and setback math are not coded for this place. This card does not say an addition is allowed.", "Zoning not coded");
    else if (ctx.hasFloorCap === false) {
      if (ctx.roomCov != null && ctx.roomCov > 0) addition = card("addition", "Addition", "ready", "This zone has no floor-area ratio. Coverage room left is about " + Math.round(ctx.roomCov) + " sf." + envBit + " This does not say a permit will be issued.", Math.round(ctx.roomCov) + " sf coverage room");
      else if (ctx.roomCov != null) addition = card("addition", "Addition", "partial", "This zone has no floor-area ratio. No coverage room is left under the coded cap." + envBit, "No coverage room left");
      else if (ctx.fullCov != null) addition = card("addition", "Addition", "partial", "This zone has no floor-area ratio. The coverage cap is about " + Math.round(ctx.fullCov) + " sf, and the building footprint is missing, so room left is not calculated.", Math.round(ctx.fullCov) + " sf coverage cap");
      else addition = card("addition", "Addition", "partial", "This zone has no floor-area ratio in the coded rules, and a coverage room was not calculated.", "No floor-area ratio");
    } else if (!living) addition = card("addition", "Addition", "partial", "A floor-area cap is coded, and finished living area is missing, so floor room is not calculated." + covPhrase() + envBit, ctx.roomCov != null ? Math.round(ctx.roomCov) + " sf coverage room" : "Needs finished living area");
    else addition = card("addition", "Addition", "partial", "The coded rules do not produce a floor-area room figure for this lot." + covPhrase(), "Verify with the jurisdiction");

    var adu;
    if (!any && !z) adu = card("adu", "ADU", "nodata", "No lot facts and no coded ADU rule are on record.", "Needs a lot and a zoning rule");
    else if (z && ctx.aduRule) adu = card("adu", "ADU", "ready", "The coded ADU note for this zone is on the card. Count, size, and parking still have to be confirmed with the jurisdiction. This does not say an ADU permit will be issued." + covPhrase() + envBit, ctx.aduRule);
    else if (!z) adu = card("adu", "ADU", "partial", "ADU size and count are not coded for this place. State and local rules both matter, and this study does not decide them.", "Zoning not coded");
    else adu = card("adu", "ADU", "partial", "Zoning math is coded for this place, and a specific ADU size was not found in the rule set.", "Verify the ADU standard");

    var shop;
    if (!any) shop = card("shop", "Garage or shop", "nodata", "No lot or coverage fact is on record, so a garage or shop cannot be sized.", "Needs a lot measurement");
    else if (ctx.roomCov != null && ctx.roomCov <= 0) shop = card("shop", "Garage or shop", "partial", "No coverage room is left under the coded cap." + (ctx.hasImpervious ? "" : " This zone has no separate impervious cap in the coded rules.") + envBit, "No coverage room left");
    else if (ctx.hasImpervious && ctx.roomImp != null && ctx.roomImp <= 0) shop = card("shop", "Garage or shop", "partial", "No impervious room is left under the coded cap." + covPhrase(), "No impervious room left");
    else if (ctx.roomCov != null && ctx.roomCov > 0 && ctx.hasImpervious && ctx.roomImp != null && ctx.roomImp > 0) shop = card("shop", "Garage or shop", "ready", "About " + Math.round(ctx.roomCov) + " sf of coverage room and about " + Math.round(ctx.roomImp) + " sf of impervious room are left under the coded caps. A street-facing vehicle door can also need a driveway length. This does not say a permit will be issued.", Math.round(ctx.roomCov) + " sf coverage room");
    else if (ctx.roomCov != null && ctx.roomCov > 0 && !ctx.hasImpervious) shop = card("shop", "Garage or shop", "ready", "This zone has no separate impervious cap in the coded rules. Coverage room left is about " + Math.round(ctx.roomCov) + " sf." + envBit + " This does not say a permit will be issued.", Math.round(ctx.roomCov) + " sf coverage room");
    else if (ctx.roomCov != null && ctx.roomCov > 0 && ctx.hasImpervious && ctx.roomImp == null) shop = card("shop", "Garage or shop", "partial", "Coverage room is about " + Math.round(ctx.roomCov) + " sf. Impervious room is unknown because driveway or other paving was not measured. It is not filled in as zero.", Math.round(ctx.roomCov) + " sf coverage room");
    else if (!z) shop = card("shop", "Garage or shop", "partial", "Coverage and impervious caps are not coded here, so a shop size is not calculated.", "Zoning not coded");
    else if (ctx.roof != null && ctx.fullCov == null && ctx.hasImpervious && ctx.roomImp == null) shop = card("shop", "Garage or shop", "partial", "A roof outline is on record. This zone has no coverage cap in the coded rules. Impervious room is unknown because driveway or other paving was not measured. It is not filled in as zero.", "Paving not measured");
    else shop = card("shop", "Garage or shop", "partial", "Enter a building footprint to see coverage room. Paving stays blank until a source measures it.", "Needs a footprint");

    var teardown;
    if (!lot && !z) teardown = card("teardown", "Teardown and new house", "nodata", "No lot size and no coded cap are on record, so a new house cannot be sized.", "Needs a lot and a zoning rule");
    else if (ctx.floorCap != null && ctx.floorCap > 0) teardown = card("teardown", "Teardown and new house", "ready", "A new house is sized to the full coded floor cap, about " + Math.round(ctx.floorCap) + " sf, not to leftover room under the current house." + covPhrase() + envBit + " Demolition rules are separate. This does not say a permit will be issued.", Math.round(ctx.floorCap) + " sf full floor cap");
    else if (ctx.floorCap != null && ctx.floorCap <= 0) teardown = card("teardown", "Teardown and new house", "partial", "The coded floor cap is not a positive area, so a new house is not sized from it." + covPhrase(), "No positive floor cap");
    else if (!z) teardown = card("teardown", "Teardown and new house", "partial", "A rebuild would follow current setbacks and caps. Those numbers are not coded for this place.", "Zoning not coded");
    else if (ctx.fullCov != null && ctx.fullCov > 0) teardown = card("teardown", "Teardown and new house", "ready", "No floor-area ratio is coded. A new house is limited by the coverage cap of about " + Math.round(ctx.fullCov) + " sf." + envBit + " This does not say a permit will be issued.", Math.round(ctx.fullCov) + " sf coverage cap");
    else teardown = card("teardown", "Teardown and new house", "partial", "The zone is recognized. No positive floor cap or coverage cap was produced from the coded rules.", "Verify the cap");

    var remodel;
    if (!living && !roof) remodel = card("remodel", "Remodel", "nodata", "No existing house size is on record, so a remodel scope cannot be checked.", "Needs living area or a footprint");
    else if (living && roof) remodel = card("remodel", "Remodel", "ready", "Interior work that stays inside the existing walls usually does not change the " + Math.round(ctx.living) + " sf living area or the " + Math.round(ctx.roof) + " sf roof outline. Those two numbers are not added. Structural, plumbing, electrical, and mechanical permits can still apply. This does not say a permit will be issued.", Math.round(ctx.living) + " sf living area");
    else if (living) remodel = card("remodel", "Remodel", "partial", "Finished living area is " + Math.round(ctx.living) + " sf. A roof outline was not measured, so coverage change cannot be checked.", Math.round(ctx.living) + " sf living area");
    else remodel = card("remodel", "Remodel", ctx.hasFloorCap === false ? "partial" : "partial", ctx.hasFloorCap === false ? "A roof outline is on record. This zone has no floor-area ratio, so living area is not required to check a floor cap. Finished living area was not in the sources read for this lot." : "A roof outline is on record and finished living area is not, so an interior remodel cannot be checked against a floor-area cap.", ctx.hasFloorCap === false ? "No floor-area ratio" : "Needs finished living area");

    var finBit = "";
    if (ctx.countyFinSize != null) {
      finBit = " County FinSize on the ledger is about " + Math.round(ctx.countyFinSize) + " sf. It is not used as finished living area. Basement and lower-level finished area are separate columns and are not added.";
      if (ctx.countyFinRows > 1) finBit += " More than one active dwelling row exists. The figure is the largest row, not a sum.";
    }
    return [addition, adu, shop, teardown, remodel].map(function (c) {
      if (finBit) c.line += finBit;
      return c;
    });
  }

  function pickPoint(list, kind, usersOnly) {
    var rows = list.filter(function (m) { return m.kind === kind && m.sf != null && (!usersOnly || !m.automatic); });
    if (!rows.length) return null;
    var user = rows.filter(function (m) { return !m.automatic; });
    if (user.length) return user[user.length - 1].sf;
    return rows[0].sf;
  }

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
    var edit = input.edit || {};
    if (edit.living != null) records = withEdit(records, "living", edit.living, input.date);
    if (edit.roof != null) records = withEdit(records, "roof", edit.roof, input.date);
    if (edit.survey != null) records = withEdit(records, "footprint", edit.survey, input.date);
    if (edit.firstFloor != null) records = withEdit(records, "firstFloor", edit.firstFloor, input.date);
    var bundle = assemble({ lot: input.lot, records: records, manual: input.manual || [], skipOpen: true });
    var list = bundle.measures;
    var roof = pickPoint(list, "roof");
    var survey = pickPoint(list, "footprint");
    var detached = pickPoint(list, "detachedGarage");
    var other = pickPoint(list, "otherBuilding");
    var buildings = survey != null ? survey : roof;
    if (detached != null) buildings = (buildings || 0) + detached;
    if (other != null) buildings = (buildings || 0) + other;
    var userHard = list.some(function (m) { return !m.automatic && (m.kind === "hardscape" || m.kind === "patio") && m.sf != null; });
    var hard = null;
    if (userHard) {
      hard = 0;
      ["hardscape", "patio"].forEach(function (k) {
        var v = pickPoint(list, k, true);
        if (v != null) hard += v;
      });
    } else hard = pickPoint(list, "hardscape");
    var drive = pickPoint(list, "driveway");
    var living = pickPoint(list, "living");
    var countyFin = pickPoint(list, "countyFinSize");
    if (living != null && countyFin != null && Math.round(living) !== Math.round(countyFin)) {
      bundle.notes.push("FinSize is " + Math.round(countyFin) + " sf and another finished-area figure on this study is " + Math.round(living) + " sf. Both stay visible. FinSize is not substituted for finished living area.");
    }
    var open = openArea(input.lot, { buildings: buildings, drive: drive, hard: hard });
    bundle.open = open;
    if (open.sf != null && !open.verifiedLandscape) bundle.notes.push(open.note);
    var floorCap = input.floorCap != null ? input.floorCap : null;
    var fullCov = input.coverageCap != null ? input.coverageCap : null;
    var roomFar = floorCap != null && living != null ? floorCap - living : null;
    var roomCov = fullCov != null && buildings != null ? fullCov - buildings : null;
    var hasImpervious = input.imperviousCap != null;
    var impParts = buildings != null && drive != null && hard != null ? buildings + drive + hard : null;
    var impBase = input.imperv != null ? input.imperv : impParts;
    var roomImp = hasImpervious && impBase != null ? input.imperviousCap - impBase : null;
    var cards = scenarios({
      lot: input.lot, living: living, roof: roof, zoningCoded: !!input.zoningCoded,
      hasFloorCap: !!input.hasFloorCap, floorCap: floorCap, fullCov: fullCov,
      roomFar: roomFar, roomCov: roomCov, roomImp: roomImp, hasImpervious: hasImpervious,
      envArea: input.envArea != null ? input.envArea : null, aduRule: input.aduRule || "",
      countyFinSize: countyFin, countyFinRows: (auto.countyFinSize && auto.countyFinSize.nDwell) || 0
    });
    return {
      bundle: bundle, cards: cards,
      effective: { living: living, roof: roof, buildings: buildings, drive: drive, hard: hard, impervious: impBase, roomFar: roomFar, roomCov: roomCov, roomImp: roomImp }
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
    readSnoImprovement: readSnoImprovement,
    countyFinSizeRecord: countyFinSizeRecord,
    finSizeNote: finSizeNote
  };
  root.BuildHereMeasures = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
