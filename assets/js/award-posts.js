/* Award posts widgets. Vanilla, no dependencies, no scroll capture. */
(function () {
  "use strict";
  // Live regions are attached after first render so screen readers stay quiet on load.
  function liveLater(el) { if (el && !el.hasAttribute("aria-live")) setTimeout(function () { el.setAttribute("aria-live", "polite"); }, 500); }
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Looping clips: autoplay muted only when motion is OK; a button pauses or plays.
  document.querySelectorAll(".ap-loop").forEach(function (fig) {
    var v = fig.querySelector("video"), b = fig.querySelector("button");
    if (!v || !b) return;
    function label() { b.textContent = v.paused ? "Play" : "Pause"; b.setAttribute("aria-label", (v.paused ? "Play" : "Pause") + " clip: " + (v.getAttribute("aria-label") || "")); }
    if (!reduce && "IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (fig.dataset.user === "paused") return;
          if (e.isIntersecting) { v.play().catch(function () {}); } else { v.pause(); }
        });
      }, { threshold: 0.25 }).observe(v);
    }
    v.addEventListener("play", label); v.addEventListener("pause", label);
    b.addEventListener("click", function () {
      if (v.paused) { fig.dataset.user = ""; v.play().catch(function () {}); } else { fig.dataset.user = "paused"; v.pause(); }
    });
    label();
  });

  // Timeline tabs (roving tabindex, arrow keys).
  document.querySelectorAll(".ap-tl").forEach(function (tl) {
    var tabs = Array.prototype.slice.call(tl.querySelectorAll('[role="tab"]'));
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j, p = document.getElementById(t.getAttribute("aria-controls"));
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        if (p) p.hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i, false); });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = null;
        if (k === "ArrowRight" || k === "ArrowDown") n = (i + 1) % tabs.length;
        if (k === "ArrowLeft" || k === "ArrowUp") n = (i - 1 + tabs.length) % tabs.length;
        if (k === "Home") n = 0; if (k === "End") n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); select(n, true); }
      });
    });
    select(0, false);
  });

  // Hiring checklist saved to localStorage.
  document.querySelectorAll(".ap-check").forEach(function (box) {
    var key = "bops-" + (box.dataset.key || "checklist");
    var inputs = Array.prototype.slice.call(box.querySelectorAll('input[type="checkbox"]'));
    var out = box.querySelector(".ap-progress"), reset = box.querySelector(".ap-reset");
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { saved = {}; }
    function update() {
      var n = 0, state = {};
      inputs.forEach(function (i) { state[i.value] = i.checked; if (i.checked) n++; });
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
      if (out) out.textContent = n + " of " + inputs.length + " checked";
    }
    inputs.forEach(function (i) { i.checked = !!saved[i.value]; i.addEventListener("change", update); });
    if (reset) reset.addEventListener("click", function () { inputs.forEach(function (i) { i.checked = false; }); update(); });
    update(); liveLater(out);
  });

  // Scope builder: maps choices to the closest published benchmark and lists scope questions.
  document.querySelectorAll(".ap-scope").forEach(function (w) {
    var data = { mid: ["Bath Remodel, Midrange", "$26,138"], uni: ["Bath Remodel, Universal Design", "$42,183"], up: ["Bath Remodel, Upscale", "$81,612"], addm: ["Bathroom Addition, Midrange", "$60,645"], addu: ["Bathroom Addition, Upscale", "$111,255"] };
    var sel = w.querySelectorAll("select"), out = w.querySelector(".ap-out");
    function v(name) { var s = w.querySelector('select[name="' + name + '"]'); return s ? s.value : ""; }
    function render() {
      var footprint = v("footprint"), finish = v("finish"), access = v("access"), key;
      if (footprint === "add") key = finish === "high" ? "addu" : "addm";
      else if (access === "yes") key = "uni";
      else key = (finish === "high" || footprint === "expand") ? "up" : "mid";
      var q = [];
      if (footprint !== "same") q.push("Ask who draws and stamps any framing changes, and which permit the city will require.");
      if (footprint === "add") q.push("An addition brings foundation, roof and exterior work. Ask for a feasibility study before design.");
      if (access === "yes") q.push("Ask about blocking for future grab bars, a curbless or low-curb entry, and door width.");
      if (finish === "high") q.push("Ask which selections are final before the estimate, and how allowances are handled.");
      if (v("fan") === "no") q.push("Ask what exhaust fan is planned and where it will vent to the outside.");
      q.push("Ask which waterproofing system goes behind the tile, and whether it is flood tested before tile.");
      var b = data[key];
      out.innerHTML = "<p><b>Closest published benchmark:</b> " + b[0] + ", 2025 national average job cost " + b[1] + ".</p><p class=\"ap-note\">This is an estimate reference, not a quote. National averages from the Journal of Light Construction 2025 Cost vs. Value Report. Seattle-area bids can land well above or below it.</p><p><b>Questions to bring to a first meeting:</b></p><ul>" + q.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
    }
    Array.prototype.forEach.call(sel, function (s) { s.addEventListener("change", render); });
    render(); liveLater(out);
  });

  // Shower layers: buttons and SVG shapes toggle a description.
  document.querySelectorAll(".ap-layers").forEach(function (w) {
    var btns = Array.prototype.slice.call(w.querySelectorAll("[data-show]"));
    var shapes = w.querySelectorAll("svg [data-layer]"), detail = w.querySelector(".ap-layer-detail");
    function show(id) {
      btns.forEach(function (b) { var on = b.dataset.show === id; b.setAttribute("aria-pressed", on ? "true" : "false"); if (on && detail) detail.innerHTML = "<b>" + b.dataset.title + ".</b> " + b.dataset.text; });
      Array.prototype.forEach.call(shapes, function (s) { s.classList.toggle("on", s.getAttribute("data-layer") === id); });
    }
    btns.forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.show); }); });
    Array.prototype.forEach.call(shapes, function (s) { s.addEventListener("click", function () { show(s.getAttribute("data-layer")); }); });
    if (btns[0]) show(btns[0].dataset.show);
    liveLater(detail);
  });
})();
