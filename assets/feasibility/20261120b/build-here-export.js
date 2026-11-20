/* Downloadable feasibility study file. Separate from the browser print dialog.
   The file is one HTML page that prints on letter, landscape. It opens with the study as drawn (the site plan
   sheet and the facts sheet first, then the full report), and ends with the limitations and the source list.
   Buttons, videos and map frames are dropped, so a saved copy has no on-screen controls. The firm's contact
   block is kept: a saved study that cannot say who made it or how to reach them is no use to the reader. */
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
  /* A link is kept when it still works from a file on someone's disk: a phone, an email, or a full web
     address. A path on the site is made into a full address when the site's address is known. A link to a
     part of the page the file does not have (the lead form, Edit the facts) becomes plain text. */
  function fixLinks(rootEl, baseHref) {
    rootEl.querySelectorAll("a[href]").forEach(function (a) {
      var h = String(a.getAttribute("href") || "").trim(), keep = "";
      if (/^(tel:\+?[0-9][0-9().\- ]{5,22}|mailto:[^\s@<>"'?&]+@[^\s@<>"'?&]+\.[^\s@<>"'?&]+)/i.test(h) || /^https?:\/\//i.test(h)) keep = h;
      else if (h && h.charAt(0) !== "#" && !/^[a-z][a-z0-9+.-]*:/i.test(h) && /^https?:\/\//i.test(String(baseHref || ""))) {
        try { keep = new URL(h, baseHref).href; } catch (e) { keep = ""; }
      }
      if (keep) { a.setAttribute("href", keep); a.removeAttribute("target"); return; }
      var span = a.ownerDocument.createElement("span");
      span.textContent = a.textContent;
      if (a.parentNode) a.parentNode.replaceChild(span, a);
    });
  }
  function stripWithDom(html, baseHref) {
    if (typeof DOMParser === "undefined") return null;
    var doc = new DOMParser().parseFromString("<div id=\"bh-export-root\">" + html + "</div>", "text/html");
    var rootEl = doc.getElementById("bh-export-root");
    if (!rootEl) return null;
    var hadMap = !!rootEl.querySelector(".bh-map-frame");
    rootEl.querySelectorAll("script,iframe,video,button,textarea,input,select,.bh-map-frame,.bh-print-only,.bh-noprint,a[href='#bh-confirm']").forEach(function (el) { el.remove(); });
    fixLinks(rootEl, baseHref);
    // A button-styled link with nowhere to go was turned into text above. An empty paragraph left behind is dropped.
    rootEl.querySelectorAll("p").forEach(function (el) { if (!el.textContent.trim() && !el.children.length) el.remove(); });
    return { html: rootEl.innerHTML, hadMap: hadMap };
  }
  function stripControls(html, baseHref) {
    var dommed = stripWithDom(html, baseHref), out, hadMap;
    if (dommed) { out = dommed.html; hadMap = dommed.hadMap; }
    else {
      // No DOM (a test run, or a very old browser): the same removals by pattern. Links are left as they are.
      out = String(html || "");
      hadMap = /\bbh-map-frame\b/.test(out);
      ["script", "iframe", "video", "button", "textarea", "select"].forEach(function (tag) { out = stripTag(out, tag); });
      out = out.replace(/<input\b[^>]*>/gi, "");
      out = out.replace(/<a\b[^>]*href=(["'])#[^"']*\1[^>]*>([\s\S]*?)<\/a>/gi, "$2");
      out = out.replace(/<div\b[^>]*\bbh-map-frame\b[^>]*>[\s\S]*?<\/div>/gi, "");
      out = out.replace(/<p\b[^>]*\bbh-print-only\b[^>]*>[\s\S]*?<\/p>/gi, "");
      out = out.replace(/<(div|section|p)\b[^>]*\bbh-noprint\b[^>]*>[\s\S]*?<\/\1>/gi, "");
    }
    // Said only when a live map was really left out of this file.
    if (hadMap) out += '<p class="bh-fallback">The live map is left out of this file. The site plan sheet is drawn in the file itself. An aerial photo, when the study had one, needs a network connection to show.</p>';
    return out.replace(/Nothing here is a permit\.\s*\./g, "Nothing here is a permit.");
  }

  function sourceItems(sources, hideLinks) {
    return (sources || []).map(function (x) {
      var name = x && (x.name || x.label) || "Source";
      var note = x && x.note || "";
      var how = x && x.how ? x.how : (x && x.ok === false ? "No data from: " : "Read: ");
      var link = !hideLinks && x && x.url && /^https?:\/\//i.test(x.url) ? ' <a href="' + esc(x.url) + '">' + esc(x.url) + "</a>" : "";
      return "<li>" + esc(how + name + (note ? " · " + note : "")) + link + "</li>";
    }).join("");
  }

  /* Keep the sheet and facts rules in step with assets/css/build-here.css. */
  var PRINT_CSS = [
    "body{margin:0;background:#fff;color:#102a1c;font:15px/1.45 Georgia, 'Iowan Old Style', serif;overflow-wrap:anywhere}",
    "@media screen{body{padding:16px}}",
    "header,article,footer,.bh-limit,.bh-sources{max-width:10.3in;margin-left:auto;margin-right:auto}",
    "h1,h2,h3{color:#102a1c}",
    "h1{font-size:1.35rem;line-height:1.25}",
    "h2{font-size:1rem;margin:1rem 0 .35rem}",
    "a{color:#14532d}",
    "table,.bh-table{width:100%;border-collapse:collapse}",
    ".bh-table th,.bh-table td,th,td{text-align:left;vertical-align:top;border-bottom:1px solid #e4e1d8;padding:.2rem .35rem}",
    "img,svg{max-width:100%;height:auto;background:#fff}",
    ".bh-cols{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}",
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
    // The option cards: a small drawing of the lot beside the card text.
    ".bh-scenario-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem}",
    ".bh-scenario{display:grid;grid-template-columns:6.5rem 1fr;gap:.6rem;align-items:center;break-inside:avoid;border:1px solid #d6d3cb;padding:.4rem .6rem}",
    ".bh-scenario-nofig{grid-template-columns:1fr}",
    ".bh-scenario-svg,.bh-thumb{display:block;width:100%;height:auto}",
    ".bh-scenario h3,.bh-scenario h4{margin:0}.bh-scenario p{margin:.2rem 0}",
    ".bh-verify{color:#8a4b08;font-weight:700}",
    ".bh-stage-warn{border-left:4px solid #b45309;background:#fff7ed;padding:.5rem .7rem}",
    ".bh-muted{color:#52606d;font-size:.9em}",
    ".bh-tbd{background:#fef3c7;color:#92400e;font-weight:700;padding:0 .35em}",
    ".bh-cta{border:1px solid #166534;padding:.5rem .8rem;margin:.6rem 0;background:#f1f7f2;break-inside:avoid}",
    ".bh-cta a{margin-right:1rem;font-weight:700}",
    ".bh-page-foot{display:flex;flex-wrap:wrap;gap:.4rem 1rem;border-top:1px solid #d6d3cb;margin:.6rem 0 1.4rem;padding-top:.35rem;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#52606d}",
    ".bh-page{break-after:auto;page-break-after:auto;break-inside:auto}",
    ".bh-disclaimer,.bh-limit{border-left:4px solid #166534;background:#eef5ef;color:#102a1c;padding:.6rem .8rem}",
    // Summary sheets
    ".bh-s-missing,.bh-s-verify{color:#b8650a}",
    ".bh-sheet{margin:0 0 1rem}",
    ".bh-sheet-svg{display:block;width:100%;height:auto;border:1px solid #d8d7cf}",
    ".bh-sheet-table caption{text-align:left;font-weight:700;letter-spacing:.1em;font-size:.8rem;padding:.3rem 0;border-bottom:2px solid #8b8878}",
    ".bh-sheet-table td{text-align:right}.bh-sheet-table tr.bh-total th,.bh-sheet-table tr.bh-total td{font-weight:700}",
    ".bh-facts{font-family:Helvetica,Arial,sans-serif;font-size:.8rem;line-height:1.35;margin:0 0 1rem}",
    ".bh-facts-head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;border-bottom:4px solid #8b8878;padding-bottom:.3rem}",
    ".bh-facts-head h2{margin:0;font-size:1.3rem;letter-spacing:.16em;text-transform:uppercase}.bh-facts-head p{margin:.2rem 0 0;color:#5b6460}",
    ".bh-facts-id{font-size:1.6rem;font-weight:700}",
    ".bh-facts-key{margin:.3rem 0 .2rem;font-size:.72rem;color:#5b6460}",
    ".bh-facts-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 1.5rem}",
    ".bh-facts-block h3{margin:.6rem 0 .1rem;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;border-bottom:1.5px solid #8b8878;padding-bottom:.1rem}",
    ".bh-facts-table th{width:27%;font-weight:700;padding:.18rem .5rem .18rem 0;border-bottom:1px solid #e7e5dc}",
    ".bh-facts-table td{padding:.18rem 0;border-bottom:1px solid #e7e5dc}",
    ".bh-fn{font-size:.68em;color:#5b6460;line-height:0}.bh-facts-disc{color:#5b6460}",
    ".bh-facts-visit{margin:.7rem 0 .4rem;padding:.4rem .7rem;border-left:4px solid #b8650a;background:#fbf4ea}",
    ".bh-facts-notes{margin:.4rem 0 0;padding-left:1.5rem;columns:2;column-gap:1.5rem;font-size:.68rem;line-height:1.3;color:#5b6460}.bh-facts-notes li{break-inside:avoid}",
    ".bh-facts-foot{margin-top:.5rem;border-top:1.5px solid #2f3a3a;padding-top:.35rem;display:flex;justify-content:space-between;gap:.5rem 1.5rem;flex-wrap:wrap}.bh-facts-foot p{margin:0}",
    // Phone width: each table row becomes a labeled block, as it does on the page. The label text is added
    // only here. It used to be added at every width, so a wide table printed each cell's label twice.
    "@media screen and (max-width:699px){.bh-cols,.bh-facts-cols,.bh-scenario-grid{grid-template-columns:1fr}table,thead,tbody,tr,th,td{display:block;width:auto}thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}tr{border-bottom:1px solid #e4e1d8;padding:.3rem 0}.bh-table th,.bh-table td,th,td{border-bottom:0;padding:.1rem 0}.bh-facts-table th{width:auto}td[data-label]::before{content:attr(data-label) \": \";font-weight:700;color:#166534}.bh-sheet-table td{text-align:left}}",
    "@media screen and (min-width:900px){.bh-screen-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.bh-sheet{position:relative}}",
    "@media print{.bh-screen-only{display:none}.bh-sheet-alert{display:none}.bh-sheet,.bh-facts{break-after:page;page-break-after:always;break-inside:avoid;margin:0}.bh-sheet-svg{width:10.16in;height:7.7in;border:0}",
    ".bh-facts{font-size:6.4pt;line-height:1.16;zoom:var(--bh-fit,1)}.bh-facts-head{border-bottom-width:3px}.bh-facts-head h2{font-size:12pt}.bh-facts-key{font-size:6.6pt;margin:1pt 0}.bh-facts-block h3{font-size:7pt;margin:4pt 0 1pt}.bh-facts-table th,.bh-facts-table td{padding:.7pt 0}.bh-facts-table th{width:22%;padding-right:5pt}.bh-facts-notes{columns:3;font-size:5.4pt;line-height:1.16;margin-top:2pt}.bh-facts-visit{margin:4pt 0 2pt;padding:2pt 6pt}.bh-facts-foot{margin-top:3pt;padding-top:2pt}",
    ".bh-facts,.bh-facts-visit,.bh-cta,.bh-disclaimer,.bh-limit{-webkit-print-color-adjust:exact;print-color-adjust:exact}a{text-decoration:none}}",
    "@page{size:letter landscape;margin:0.35in}"
  ].join("");

  /* o: { address, date, bodyHtml, sources, limitations, baseHref (the site's address, used to complete links),
          brand, contact, hideLinkOnly (true leaves the raw source addresses off the source list) } */
  function buildStudyFile(o) {
    o = o || {};
    var address = o.address || "Address not matched";
    var date = o.date || "";
    var body = stripControls(o.bodyHtml || "", o.baseHref || "");
    if (o.noSources) {
      body = body.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1");
      var css = PRINT_CSS.replace(".bh-page{break-after:auto;page-break-after:auto;break-inside:auto}", ".bh-page{break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid}.bh-page:last-child{break-after:auto;page-break-after:auto}");
      return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Feasibility study: " + esc(address) + "</title><style>" + css + "</style></head><body><article>" + body + "</article></body></html>";
    }
    var limits = o.limitations || "Planning estimate only. This is not a legal, zoning, or permit determination. Where zoning is not coded, the study does not say a project is allowed.";
    var sources = sourceItems(o.sources, !!o.hideLinkOnly);
    return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Feasibility study: " + esc(address) + "</title><style>" + PRINT_CSS + "</style></head><body>" +
      "<header>" + (o.brand ? "<p>" + esc(o.brand) + "</p>" : "") + "<h1>" + esc(address) + "</h1><p>Prepared " + esc(date) + (o.contact ? " · " + esc(o.contact) : "") + "</p></header>" +
      "<article>" + body + "</article>" +
      "<section class=\"bh-limit\"><h2>Limitations and confidence</h2><p>" + esc(limits) + "</p></section>" +
      "<section class=\"bh-sources\"><h2>Sources</h2><ul>" + (sources || "<li>No source list was attached to this file.</li>") + "</ul></section>" +
      "<footer><p>End of study. " + esc(address) + ". " + esc(date) + ".</p>" + (o.contact ? "<p>" + esc(o.contact) + "</p>" : "") + "</footer></body></html>";
  }
  var api = { buildStudyFile: buildStudyFile, stripControls: stripControls };
  root.BuildHereExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
