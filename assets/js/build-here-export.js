/* Downloadable feasibility study file. Separate from the browser print dialog.
   The file is HTML with print rules for Letter or A4. It drops buttons, videos,
   and map iframes so a saved copy has no on-screen controls. */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function stripControls(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .replace(/<video[\s\S]*?<\/video>/gi, "")
      .replace(/<button\b[\s\S]*?<\/button>/gi, "")
      .replace(/<textarea\b[\s\S]*?<\/textarea>/gi, "")
      .replace(/<input\b[^>]*>/gi, "")
      .replace(/<a\b[^>]*\bbh-btn\b[^>]*>[\s\S]*?<\/a>/gi, "")
      .replace(/<div class="bh-map-frame"[\s\S]*?<\/div>/gi, '<p class="bh-fallback">Map embed omitted from this file. Use the site plan diagram in the study. The aerial photo, when present, still needs a network connection.</p>');
  }

  function sourceItems(sources) {
    return (sources || []).map(function (x) {
      var name = x && (x.name || x.label) || "Source";
      var note = x && (x.note || x.url) || "";
      var how = x && x.ok === false ? "Did not answer: " : "Read: ";
      return "<li>" + esc(how + name + (note ? " · " + note : "")) + "</li>";
    }).join("");
  }

  var PRINT_CSS = [
    "body{margin:0;background:#fff;color:#1f2933;font:15px/1.45 Georgia, 'Iowan Old Style', serif}",
    "header,section,footer{max-width:40rem;margin:0 auto;padding:0 0.2in}",
    "h1{font-size:1.4rem;line-height:1.25;font-weight:700}",
    "h2{font-size:1rem;margin:1.2rem 0 .4rem}",
    "table,.bh-table{width:100%;border-collapse:collapse}",
    ".bh-table th,.bh-table td,th,td{display:block;width:auto;text-align:left;border-bottom:1px solid #e4e1d8;padding:.25rem 0}",
    "img,svg{max-width:100%;height:auto}",
    ".bh-page{break-after:page;page-break-after:always}",
    ".bh-page:last-child{break-after:auto;page-break-after:auto}",
    ".bh-scenario,.bh-opt-card,figure,tr{break-inside:avoid;page-break-inside:avoid}",
    ".bh-disclaimer,.bh-limit{border-left:4px solid #166534;background:#eef5ef;padding:.6rem .8rem}",
    "@page{size:auto;margin:0.6in}"
  ].join("");

  function buildStudyFile(o) {
    o = o || {};
    var address = o.address || "Address not matched";
    var date = o.date || "";
    var body = stripControls(o.bodyHtml || "");
    var limits = o.limitations || "Planning estimate only. This is not a legal, zoning, or permit determination. Where zoning is not coded, the study does not say a project is allowed.";
    var sources = sourceItems(o.sources);
    return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Feasibility study</title><style>" + PRINT_CSS + "</style></head><body>" +
      "<header><p>Board of Project Stewardship</p><h1>" + esc(address) + "</h1><p>Prepared " + esc(date) + "</p></header>" +
      "<section class=\"bh-limit\"><h2>Limitations and confidence</h2><p>" + esc(limits) + "</p></section>" +
      "<section class=\"bh-sources\"><h2>Sources</h2><ul>" + (sources || "<li>No source list was attached to this file.</li>") + "</ul></section>" +
      "<article>" + body + "</article>" +
      "<footer><p>End of study. " + esc(address) + ". " + esc(date) + ".</p></footer></body></html>";
  }

  var api = { buildStudyFile: buildStudyFile, stripControls: stripControls };
  root.BuildHereExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
