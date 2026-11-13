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

  function stripTag(html, tag) {
    return String(html || "").replace(new RegExp("<" + tag + "\\b[\\s\\S]*?<\\/" + tag + ">", "gi"), "");
  }
  function stripWithDom(html) {
    if (typeof DOMParser === "undefined") return null;
    var doc = new DOMParser().parseFromString("<div id=\"bh-export-root\">" + html + "</div>", "text/html");
    var root = doc.getElementById("bh-export-root");
    if (!root) return null;
    root.querySelectorAll("script,iframe,video,button,textarea,input,a.bh-btn,.bh-map-frame,.bh-print-only,.bh-noprint,.bh-cta,a[href='#bh-confirm']").forEach(function (el) { el.remove(); });
    return root.innerHTML;
  }
  function stripControls(html) {
    var dommed = stripWithDom(html);
    var out = dommed == null ? String(html || "") : dommed;
    if (dommed == null) {
      ["script", "iframe", "video", "button", "textarea"].forEach(function (tag) { out = stripTag(out, tag); });
      out = out.replace(/<input\b[^>]*>/gi, "");
      out = out.replace(/<a\b[^>]*\bbh-btn\b[^>]*>[\s\S]*?<\/a>/gi, "");
      out = out.replace(/<a\b[^>]*href=(["'])#bh-confirm\1[^>]*>[\s\S]*?<\/a>/gi, "");
      out = out.replace(/<div\b[^>]*\bbh-map-frame\b[^>]*>[\s\S]*?<\/div>/gi, "");
      out = out.replace(/<div\b[^>]*\bbh-cta\b[^>]*>[\s\S]*?<\/div>/gi, "");
      out = out.replace(/<p\b[^>]*\bbh-print-only\b[^>]*>[\s\S]*?<\/p>/gi, "");
      out = out.replace(/<(div|section|p)\b[^>]*\bbh-noprint\b[^>]*>[\s\S]*?<\/\1>/gi, "");
    }
    if (!/Map embed omitted/.test(out)) {
      out += '<p class="bh-fallback">Map embed omitted from this file. Use the site plan diagram. An aerial photo, when the study included one, still needs a network connection. The diagram itself is drawn in this file.</p>';
    }
    return out.replace(/Nothing here is a permit\.\s*\./g, "Nothing here is a permit.");
  }

  function sourceItems(sources) {
    return (sources || []).map(function (x) {
      var name = x && (x.name || x.label) || "Source";
      var note = x && x.note || "";
      var how = x && x.how ? x.how : (x && x.ok === false ? "No data from: " : "Read: ");
      var link = x && x.url && /^https?:\/\//i.test(x.url) ? ' <a href="' + esc(x.url) + '">' + esc(x.url) + "</a>" : "";
      return "<li>" + esc(how + name + (note ? " · " + note : "")) + link + "</li>";
    }).join("");
  }

  var PRINT_CSS = [
    "body{margin:0;background:#fff;color:#102a1c;font:15px/1.45 Georgia, 'Iowan Old Style', serif;overflow-wrap:anywhere}",
    "@media screen{body{padding:16px}}",
    "header,article,footer,.bh-limit,.bh-sources{max-width:7.2in;margin-left:auto;margin-right:auto}",
    "h1,h2,h3{color:#102a1c}",
    "h1{font-size:1.35rem;line-height:1.25}",
    "h2{font-size:1rem;margin:1rem 0 .35rem}",
    "a{color:#14532d}",
    "table,.bh-table{width:100%;border-collapse:collapse}",
    ".bh-table th,.bh-table td,th,td{text-align:left;vertical-align:top;border-bottom:1px solid #e4e1d8;padding:.2rem .35rem}",
    "td[data-label]::before{content:attr(data-label) \": \";font-weight:700;color:#166534}",
    "img,svg{max-width:100%;height:auto;background:#fff}",
    ".bh-lot{fill:#f3f1ea;stroke:#1f2933;stroke-width:2}",
    ".bh-env{fill:rgba(22,101,52,.28)}",
    ".bh-edge{stroke-width:3}.bh-edge-front{stroke:#b45309}.bh-edge-side{stroke:#1f2933}.bh-edge-rear{stroke:#1d4ed8}.bh-edge-street{stroke:#b45309;stroke-dasharray:7 5}",
    ".bh-plan-key{list-style:none;margin:.4rem 0;padding:0}.bh-plan-key li{margin:.1rem 0}",
    ".bh-key{display:inline-block;width:1.5rem;height:0;border-top:3px solid #1f2933;margin-right:.4rem;vertical-align:middle;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    ".bh-key-front{border-top-color:#b45309}.bh-key-street{border-top:3px dashed #b45309}.bh-key-rear{border-top-color:#1d4ed8}.bh-key-env{height:.7rem;border:0;background:rgba(22,101,52,.28)}",
    ".bh-outline{fill:rgba(255,255,255,.12);stroke:#fff;stroke-width:2}",
    ".bh-front,.bh-envlabel,.bh-note{fill:#14532d;font-size:11px}",
    ".bh-stage-map{position:static;height:auto;background:#fff}",
    ".bh-stage-fade{position:static;background:#eef5ef;color:#102a1c;padding:.6rem}",
    ".bh-stage-fade h2,.bh-stage-fade .bh-kicker,.bh-stage-fade .bh-stage-place,.bh-stage-fade .bh-stage-date,.bh-stage-fade p{color:#102a1c}",
    // The parcel outline sits on top of the photo. Without these the SVG fell below the photo as a
    // blank block (white outline on a white page), and the caption still said it was drawn on top.
    ".bh-aerial{margin:0}",
    ".bh-aerial-frame{position:relative;line-height:0}",
    ".bh-aerial-frame img{display:block;width:100%;height:auto;background:#d9d6cc}",
    ".bh-aerial-frame svg{position:absolute;inset:0;width:100%;height:100%;background:transparent}",
    ".bh-aerial figcaption{font-size:.8rem;line-height:1.4;margin-top:.3rem}",
    ".bh-siteplan{max-width:5.5in}",
    // The schematic icons are small figures beside the card text, not full-width drawings.
    ".bh-scenario{display:grid;grid-template-columns:5.5rem 1fr;gap:.6rem;align-items:center;break-inside:avoid;border:1px solid #d6d3cb;padding:.4rem .6rem;margin:.35rem 0}",
    ".bh-scenario-svg{width:100%;height:auto}",
    ".bh-scenario h3,.bh-scenario h4{margin:0}.bh-scenario p{margin:.2rem 0}",
    ".bh-verify{color:#8a4b08;font-weight:700}",
    ".bh-stage-warn{border-left:4px solid #b45309;background:#fff7ed;padding:.5rem .7rem}",
    ".bh-muted{color:#52606d;font-size:.9em}",
    ".bh-tbd{background:#fef3c7;color:#92400e;font-weight:700;padding:0 .35em}",
    ".bh-page-foot{display:flex;flex-wrap:wrap;gap:.4rem 1rem;border-top:1px solid #d6d3cb;margin:.6rem 0 1.4rem;padding-top:.35rem;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#52606d}",
    // Phone width: each table row becomes a labeled block, as it does on the page.
    "@media screen and (max-width:699px){table,thead,tbody,tr,th,td{display:block;width:auto}thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}tr{border-bottom:1px solid #e4e1d8;padding:.3rem 0}.bh-table th,.bh-table td,th,td{border-bottom:0;padding:.1rem 0}}",
    ".bh-page{break-after:auto;page-break-after:auto;break-inside:auto}",
    ".bh-disclaimer,.bh-limit{border-left:4px solid #166534;background:#eef5ef;color:#102a1c;padding:.6rem .8rem}",
    "@page{size:auto;margin:0.6in}"
  ].join("");

  function buildStudyFile(o) {
    o = o || {};
    var address = o.address || "Address not matched";
    var date = o.date || "";
    var body = stripControls(o.bodyHtml || "");
    var limits = o.limitations || "Planning estimate only. This is not a legal, zoning, or permit determination. Where zoning is not coded, the study does not say a project is allowed.";
    var sources = sourceItems(o.sources);
    return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><base href=\"" + esc(o.baseHref || "https://boardofprojectstewardship.com/") + "\"><title>Feasibility study: " + esc(address) + "</title><style>" + PRINT_CSS + "</style></head><body>" +
      "<header><p>" + esc(o.brand || "Board of Project Stewardship") + "</p><h1>" + esc(address) + "</h1><p>Prepared " + esc(date) + "</p></header>" +
      "<section class=\"bh-limit\"><h2>Limitations and confidence</h2><p>" + esc(limits) + "</p></section>" +
      "<section class=\"bh-sources\"><h2>Sources</h2><ul>" + (sources || "<li>No source list was attached to this file.</li>") + "</ul></section>" +
      "<article>" + body + "</article>" +
      "<footer><p>End of study. " + esc(address) + ". " + esc(date) + ".</p>" + (o.contact ? "<p>" + esc(o.contact) + "</p>" : "") + "</footer></body></html>";
  }

  var api = { buildStudyFile: buildStudyFile, stripControls: stripControls };
  root.BuildHereExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
