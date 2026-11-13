/* First screen after an address: this lot, then the five paths side by side.
   Diagrams are schematic. They do not invent a surveyed shape. */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var STATE_LABEL = { ready: "Ready to compare", partial: "Partial", nodata: "No data yet" };

  function figure(card) {
    var nodata = card.state === "nodata";
    var house = nodata
      ? '<rect x="46" y="38" width="52" height="34" fill="none" stroke="#52606d" stroke-dasharray="3 2"/>'
      : '<rect x="48" y="40" width="46" height="30" fill="#14532d"/>';
    var mark = "";
    if (!nodata && card.id === "addition") {
      mark = card.state === "ready"
        ? '<rect x="94" y="46" width="28" height="22" fill="#86efac"/>'
        : '<rect x="94" y="46" width="28" height="22" fill="none" stroke="#166534" stroke-dasharray="3 2"/>';
    } else if (!nodata && card.id === "adu") {
      mark = '<rect x="108" y="70" width="22" height="16" fill="' + (card.state === "ready" ? "#86efac" : "none") + '" stroke="#166534" stroke-dasharray="' + (card.state === "ready" ? "0" : "3 2") + '"/>';
    } else if (!nodata && card.id === "shop") {
      mark = '<rect x="28" y="72" width="24" height="16" fill="' + (card.state === "ready" ? "#86efac" : "none") + '" stroke="#166534"/>';
    } else if (!nodata && card.id === "teardown") {
      house = card.state === "ready"
        ? '<rect x="50" y="36" width="50" height="38" fill="#166534"/>'
        : house;
    }
    var label = nodata ? "No lot yet" : "";
    return '<svg class="bh-scenario-svg" viewBox="0 0 160 110" role="img" aria-label="' + esc(card.title + " diagram. " + (STATE_LABEL[card.state] || "") + ". Schematic, not a survey.") + '">' +
      '<rect x="8" y="8" width="144" height="94" rx="2" fill="#f4f1ea" stroke="#102a1c" stroke-width="1.5"/>' +
      house + mark +
      (label ? '<text x="80" y="60" text-anchor="middle" fill="#52606d" font-size="9">' + esc(label) + "</text>" : "") +
      "</svg>";
  }

  function renderStage(opts) {
    opts = opts || {};
    var cards = opts.cards || [];
    var map = opts.mapHtml || '<div class="bh-stage-fallback"><p>No aerial photo or parcel outline was returned for this lookup. Options below stay in the partial or no-data state instead of guessing a lot.</p></div>';
    var cardsHtml = cards.map(function (card) {
      var state = STATE_LABEL[card.state] || "Partial";
      return '<article class="bh-scenario" data-state="' + esc(card.state) + '">' +
        '<div class="bh-scenario-fig">' + figure(card) + "</div>" +
        '<div class="bh-scenario-copy"><h4 class="bh-scenario-kicker">' + esc(card.title) + '</h4>' +
        '<p class="bh-scenario-figlabel">Schematic icon, not this lot.</p>' +
        '<p class="bh-scenario-state">' + esc(state) + "</p>" +
        "<p>" + esc(card.line) + "</p>" +
        '<p class="bh-scenario-metric">' + esc(card.metric) + "</p></div></article>";
    }).join("");
    return '<div class="bh-stage">' +
      '<div class="bh-stage-map">' + map + "</div>" +
      '<div class="bh-stage-fade"><p class="bh-kicker">See what you can build</p><h2>' + esc(opts.address || "") + "</h2>" +
      '<p class="bh-stage-place">' + esc(opts.placeLine || "") + "</p>" +
      '<p class="bh-stage-date">Prepared ' + esc(opts.date || "") + "</p></div>" +
      (opts.warn ? '<p class="bh-verify bh-stage-warn" role="alert"><strong>' + esc(opts.warn) + "</strong></p>" : "") +
      (opts.edited ? '<p class="bh-verify bh-stage-warn">' + esc(opts.edited) + "</p>" : "") +
      '<p class="bh-disclaimer"><strong>Planning estimate only.</strong> This is not a legal, zoning or permit determination. Confirm every number with the jurisdiction and a licensed professional before you design, buy or build.</p>' +
      '<h3>Ways this property could go</h3>' +
      '<p class="bh-muted">The map above is this parcel when an outline or aerial was returned. The five diagrams are schematic icons, not a scaled plan. A card stays partial or empty when a measurement or a zoning rule is missing. Nothing here is a permit. <a href="#bh-confirm">Edit the facts used on these cards.</a></p>' +
      '<div class="bh-scenario-grid">' + cardsHtml + "</div></div>";
  }

  var api = { renderStage: renderStage, figure: figure };
  root.BuildHereStage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
