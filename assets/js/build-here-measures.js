/* Property measurements for the feasibility study.
   Roof outline, living area, gross floor area, garage floor area, and
   detached footprints stay separate. Unknown paving is never stored as 0,
   and lot-minus-roof is not labeled landscaping unless hard surfaces are known.
   This file does not call listing sites. */
(function (root) {
  "use strict";

  var KINDS = {
    living: "Finished living area",
    gfa: "Gross floor area",
    roof: "Roof outline (includes eaves when the source is a roof layer)",
    footprint: "Surveyed building footprint",
    firstFloor: "First-floor area",
    attachedGarage: "Attached garage floor area",
    detachedGarage: "Detached garage or accessory footprint",
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
        confidence: raw.confidence || (estimate ? "Low" : "Medium"),
        automatic: !!raw.automatic,
        measuredZero: !!raw.measuredZero,
        note: raw.note || ""
      }
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
    var open = openArea(input.lot, {
      buildings: input.coverageSf,
      drive: input.driveSf,
      hard: input.hardSf
    });
    if (open.sf != null && !open.verifiedLandscape) notes.push(open.note);
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
    function card(id, title, state, line, metric) {
      return { id: id, title: title, state: state, line: line, metric: metric };
    }
    var addition;
    if (!any) addition = card("addition", "Addition", "nodata", "No lot or house measurement is on record yet, so an addition cannot be sized.", "Needs a lot size or a house measurement");
    else if (ctx.roomFar != null && ctx.roomFar < 0) addition = card("addition", "Addition", "partial", "Finished living area is already over the coded floor cap as entered. Adding counted floor area may not fit. Below-grade area can change the count.", "Over the coded cap");
    else if (ctx.roomFar != null) addition = card("addition", "Addition", "ready", "Counted floor area left under the coded cap is about " + Math.round(ctx.roomFar) + " sf. Planning figure only, not a permit.", Math.round(ctx.roomFar) + " sf floor room");
    else if (!z) addition = card("addition", "Addition", "partial", "Floor-area and setback math are not coded for this place. This card does not say an addition is allowed.", "Zoning not coded");
    else if (!living) addition = card("addition", "Addition", "partial", "A floor-area cap is coded, and finished living area is missing, so room left is not calculated.", "Needs finished living area");
    else addition = card("addition", "Addition", "partial", "The coded rules do not produce a floor-area room figure for this lot.", "Verify with the jurisdiction");

    var adu;
    if (!any && !z) adu = card("adu", "ADU", "nodata", "No lot facts and no coded ADU rule are on record.", "Needs a lot and a zoning rule");
    else if (z && ctx.aduRule) adu = card("adu", "ADU", "ready", "The coded ADU note for this zone is on the card. Count, size, and parking still have to be confirmed with the jurisdiction.", ctx.aduRule);
    else if (!z) adu = card("adu", "ADU", "partial", "ADU size and count are not coded for this place. State and local rules both matter, and this study does not decide them.", "Zoning not coded");
    else adu = card("adu", "ADU", "partial", "Zoning math is coded for this place, and a specific ADU size was not found in the rule set.", "Verify the ADU standard");

    var shop;
    if (!any) shop = card("shop", "Garage or shop", "nodata", "No lot or coverage fact is on record, so a garage or shop cannot be sized.", "Needs a lot measurement");
    else if (ctx.roomCov != null && ctx.roomImp != null) shop = card("shop", "Garage or shop", "ready", "About " + Math.round(ctx.roomCov) + " sf of coverage room and about " + Math.round(ctx.roomImp) + " sf of impervious room are left under the coded caps. A street-facing vehicle door can also need a driveway length.", Math.round(ctx.roomCov) + " sf coverage room");
    else if (ctx.roomCov != null && ctx.roomImp == null) shop = card("shop", "Garage or shop", "partial", "Coverage room is about " + Math.round(ctx.roomCov) + " sf. Impervious room is unknown because driveway or other paving was not measured. It is not filled in as zero.", Math.round(ctx.roomCov) + " sf coverage room");
    else if (!z) shop = card("shop", "Garage or shop", "partial", "Coverage and impervious caps are not coded here, so a shop size is not calculated.", "Zoning not coded");
    else shop = card("shop", "Garage or shop", "partial", "Enter a building footprint to see coverage room. Paving stays blank until a source measures it.", "Needs a footprint");

    var teardown;
    if (!lot && !z) teardown = card("teardown", "Teardown and new house", "nodata", "No lot size and no coded cap are on record, so a new house cannot be sized.", "Needs a lot and a zoning rule");
    else if (ctx.floorCap != null) teardown = card("teardown", "Teardown and new house", "ready", "A new house is sized to the full coded floor cap, about " + Math.round(ctx.floorCap) + " sf, not to leftover room under the current house. Demolition rules are separate and are not decided here.", Math.round(ctx.floorCap) + " sf full floor cap");
    else if (!z) teardown = card("teardown", "Teardown and new house", "partial", "A rebuild would follow current setbacks and caps. Those numbers are not coded for this place.", "Zoning not coded");
    else teardown = card("teardown", "Teardown and new house", "partial", "The zone is recognized and a full floor cap was not produced from the coded rules.", "Verify the cap");

    var remodel;
    if (!living && !roof) remodel = card("remodel", "Remodel", "nodata", "No existing house size is on record, so a remodel scope cannot be checked.", "Needs living area or a footprint");
    else if (living && roof) remodel = card("remodel", "Remodel", "ready", "Interior work that stays inside the existing walls usually does not change the " + Math.round(living) + " sf living area or the " + Math.round(roof) + " sf roof outline. Those two numbers are not added. Structural, plumbing, electrical, and mechanical permits can still apply.", Math.round(living) + " sf living area");
    else if (living) remodel = card("remodel", "Remodel", "partial", "Finished living area is " + Math.round(living) + " sf. A roof outline was not measured, so coverage change cannot be checked.", Math.round(living) + " sf living area");
    else remodel = card("remodel", "Remodel", "partial", "A roof outline is on record and finished living area is not, so an interior remodel cannot be checked against a floor-area cap.", "Needs finished living area");

    return [addition, adu, shop, teardown, remodel];
  }

  var api = {
    KINDS: KINDS,
    cleanMeasure: cleanMeasure,
    sfOrUnknown: sfOrUnknown,
    openArea: openArea,
    assemble: assemble,
    withEdit: withEdit,
    scenarios: scenarios
  };
  root.BuildHereMeasures = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
