/* First screen of the full report: this lot, then the five paths side by side.
   Each card shows a small drawing of this lot with the concept footprint where one fits (from
   build-here-siteplan.js). When no lot outline was found, the card falls back to a schematic icon,
   labeled as one. Nothing here invents a surveyed shape. */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* A link target from the page: a section of this tool, a path on this site, or an http(s) address. */
  function safeHref(u) {
    u = String(u == null ? "" : u).trim();
    if (/^#[A-Za-z][\w-]*$/.test(u)) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return /^[a-z][a-z0-9+.-]*:/i.test(u) ? "" : u;
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

  /* opts: { address, date, placeLine, edited, mapHtml, warn, cards,
             thumbs: { cardId: "<svg ...>" },   a drawing of this lot per card, from the site plan module
             hideIcons: true leaves the schematic icon off a card that has no drawing,
             planLabel, planUrl: a button on each card that leads to the lead form or a booking page } */
  function renderStage(opts) {
    opts = opts || {};
    var cards = opts.cards || [], thumbs = opts.thumbs || {}, anyThumb = false;
    var planUrl = opts.planLabel ? safeHref(opts.planUrl || "#bh-lead-card") : "";
    var map = opts.mapHtml || '<div class="bh-stage-fallback"><p>No aerial photo or parcel outline was returned for this lookup. Options below stay in the partial or no-data state instead of guessing a lot.</p></div>';
    var cardsHtml = cards.map(function (card) {
      var state = STATE_LABEL[card.state] || "Partial", thumb = thumbs[card.id] || "", fig = "";
      if (thumb) { anyThumb = true; fig = '<div class="bh-scenario-fig bh-scenario-thumb">' + thumb + "</div>"; }
      else if (!opts.hideIcons) fig = '<div class="bh-scenario-fig">' + figure(card) + "</div>";
      return '<article class="bh-scenario' + (fig ? "" : " bh-scenario-nofig") + '" data-state="' + esc(card.state) + '">' + fig +
        '<div class="bh-scenario-copy"><h4 class="bh-scenario-kicker">' + esc(card.title) + '</h4>' +
        (thumb ? '<p class="bh-scenario-figlabel">This lot from public outlines. Concept only, not a design.</p>' : (fig ? '<p class="bh-scenario-figlabel">Schematic icon, not this lot.</p>' : "")) +
        '<p class="bh-scenario-state">' + esc(state) + "</p>" +
        "<p>" + esc(card.line) + "</p>" +
        '<p class="bh-scenario-metric">' + esc(card.metric) + "</p>" +
        (planUrl ? '<p class="bh-noprint"><a class="bh-btn bh-btn-ghost bh-scenario-cta" href="' + esc(planUrl) + '" data-bh-cta="option" data-bh-place="card" data-bh-plan="' + esc(card.id) + '">' + esc(opts.planLabel) + "</a></p>" : "") +
        "</div></article>";
    }).join("");
    var intro = anyThumb
      ? "The map above is this parcel. Each card shows this lot with a concept footprint where one fits inside the setbacks; the site plan sheets in this study show the same concepts to scale. A card stays partial or empty when a measurement or a zoning rule is missing. Nothing here is a permit."
      : "The map above is this parcel when an outline or aerial was returned. The five diagrams are schematic icons, not a scaled plan. A card stays partial or empty when a measurement or a zoning rule is missing. Nothing here is a permit.";
    return '<div class="bh-stage">' +
      '<div class="bh-stage-map">' + map + "</div>" +
      '<div class="bh-stage-fade"><p class="bh-kicker">See what you can build</p><h2>' + esc(opts.address || "") + "</h2>" +
      '<p class="bh-stage-place">' + esc(opts.placeLine || "") + "</p>" +
      '<p class="bh-stage-date">Prepared ' + esc(opts.date || "") + "</p></div>" +
      (opts.warn ? '<p class="bh-verify bh-stage-warn" role="alert"><strong>' + esc(opts.warn) + "</strong></p>" : "") +
      (opts.edited ? '<p class="bh-verify bh-stage-warn">' + esc(opts.edited) + "</p>" : "") +
      '<p class="bh-disclaimer"><strong>Planning estimate only.</strong> This is not a legal, zoning or permit determination. Confirm every number with the jurisdiction and a licensed professional before you design, buy or build.</p>' +
      '<h3>Ways this property could go</h3>' +
      '<p class="bh-muted">' + intro + ' <a href="#bh-confirm">Edit the facts used on these cards.</a></p>' +
      '<div class="bh-scenario-grid">' + cardsHtml + "</div></div>";
  }

  var api = { renderStage: renderStage, figure: figure };
  root.BuildHereStage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
