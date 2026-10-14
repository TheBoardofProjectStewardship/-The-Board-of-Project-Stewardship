/* Step viewer for /learn/. Uses the homepage house model.
   Original controller. It does not share code with any other illustrated guide. */
(function () {
  var DEG = Math.PI / 180;
  var AXON = { lockAngle: 52 * DEG, lockHeading: -36 * DEG };
  var FRONT = { lockAngle: 76 * DEG, lockHeading: Math.PI };
  var PLAN = { lockAngle: 0.08, lockHeading: -0.2 };
  var LOW = { lockAngle: 22 * DEG, lockHeading: -28 * DEG };
  var IDS = ["site", "lower", "upperfloor", "upper", "roof", "garageRoof", "porchRoof", "finish"];

  function show(map) {
    var out = {};
    for (var i = 0; i < IDS.length; i++) {
      var id = IDS[i];
      var value = map[id];
      if (value === undefined || value === false) out[id] = { visible: false, cut: 0, opacity: 0 };
      else if (value === true) out[id] = { visible: true, cut: 100, opacity: 1 };
      else out[id] = { visible: true, cut: value, opacity: 1 };
    }
    return out;
  }

  var WHOLE = show({
    site: true, lower: true, upperfloor: true, upper: true,
    roof: true, garageRoof: true, porchRoof: true, finish: true
  });
  var FRAME = show({
    site: true, lower: true, upperfloor: true, upper: true,
    roof: true, garageRoof: true, porchRoof: true
  });
  var FLOORS = show({ site: true, lower: true, upperfloor: true, upper: true });
  var MAIN = show({ site: true, lower: 10.6 });
  var BASE = show({ site: true, lower: 0.55 });

  var PRESETS = {
    survey: { progress: 0, focus: "", orbit: PLAN, groups: show({ site: true }) },
    stake: { progress: 0, focus: "", orbit: PLAN, groups: show({ site: true }) },
    clear: { progress: 0, focus: "", orbit: AXON, groups: show({ site: true }) },
    excavate: { progress: 0, focus: "foundation", orbit: LOW, groups: show({ site: true }) },
    footings: { progress: 0.93, focus: "footings", orbit: LOW, groups: show({ site: true, lower: 0.42 }) },
    foundwall: { progress: 0.9, focus: "foundation", orbit: AXON, groups: show({ site: true, lower: 3.4 }) },
    damp: { progress: 0.9, focus: "foundation", orbit: FRONT, groups: show({ site: true, lower: 4.2 }) },
    slab: { progress: 0.93, focus: "foundation", orbit: PLAN, groups: BASE },
    sill: { progress: 0.74, focus: "bearing", orbit: AXON, groups: MAIN },
    backfill: { progress: 0.4, focus: "foundation", orbit: LOW, groups: MAIN },
    frame1: { progress: 0.74, focus: "framing", orbit: AXON, groups: MAIN },
    frame2: { progress: 0.56, focus: "structure", orbit: AXON, groups: FLOORS },
    roof: { progress: 0.22, focus: "roof", orbit: AXON, groups: FRAME },
    dryin: { progress: 0.12, focus: "roof", orbit: FRONT, groups: FRAME },
    rough: { progress: 0.74, focus: "partition", orbit: PLAN, groups: show({ site: true, lower: 10.35 }) },
    insulate: { progress: 0.56, focus: "structure", orbit: AXON, groups: show({ site: true, lower: true, upperfloor: true, upper: 16.5 }) },
    siding: { progress: 0.08, focus: "", orbit: FRONT, groups: WHOLE },
    drywall: { progress: 0.74, focus: "partition", orbit: PLAN, groups: show({ site: true, lower: 10.35 }) },
    grade: { progress: 0.04, focus: "", orbit: AXON, groups: WHOLE },
    load: { progress: 0.05, focus: "bearing", orbit: AXON, groups: WHOLE },
    columns: { progress: 0.08, focus: "porch", orbit: FRONT, groups: WHOLE },
    beams: { progress: 0.22, focus: "header", orbit: FRONT, groups: WHOLE },
    stairs: { progress: 0.56, focus: "stairs", orbit: AXON, groups: FLOORS },
    balcony: { progress: 0.5, focus: "balcony", orbit: AXON, groups: FLOORS },
    systemsFrame: { progress: 0.2, focus: "bearing", orbit: AXON, groups: FRAME },
    systemsSkin: { progress: 0.06, focus: "", orbit: FRONT, groups: WHOLE }
  };

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function bootMenu() {
    var button = document.querySelector(".learn-menu");
    var panel = document.getElementById("learn-menu-panel");
    if (!button || !panel) return;
    button.addEventListener("click", function () {
      var open = document.body.classList.toggle("learn-nav-open");
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function fit(canvas) {
    var rect = canvas.getBoundingClientRect();
    return {
      width: Math.max(2, rect.width || canvas.clientWidth || 320),
      height: Math.max(2, rect.height || canvas.clientHeight || 180)
    };
  }

  function View(canvas) {
    if (!window.BoardHouse || typeof window.BoardHouse.openViewer !== "function") {
      throw new Error("The house model is not available.");
    }
    this.canvas = canvas;
    this.engine = window.BoardHouse.openViewer(canvas);
    this.yaw = 0;
    this.pitch = 0;
    this.armed = false;
    this.spec = PRESETS.grade;
    var self = this;
    canvas.addEventListener("click", function () {
      self.armed = true;
      canvas.classList.add("is-armed");
    });
    canvas.addEventListener("keydown", function (event) {
      var step = 0.08;
      if (event.key === "ArrowLeft") self.yaw -= step;
      else if (event.key === "ArrowRight") self.yaw += step;
      else if (event.key === "ArrowUp") self.pitch += step;
      else if (event.key === "ArrowDown") self.pitch -= step;
      else return;
      event.preventDefault();
      self.armed = true;
      canvas.classList.add("is-armed");
      self.paint();
    });
    var drag = null;
    canvas.addEventListener("pointerdown", function (event) {
      if (!self.armed) return;
      drag = { x: event.clientX, y: event.clientY, yaw: self.yaw, pitch: self.pitch };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", function (event) {
      if (!drag) return;
      self.yaw = drag.yaw + (event.clientX - drag.x) * 0.005;
      self.pitch = Math.max(-0.35, Math.min(0.45, drag.pitch + (drag.y - event.clientY) * 0.003));
      self.paint();
    });
    function end() { drag = null; }
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  View.prototype.paint = function () {
    var size = fit(this.canvas);
    var orbit = {
      lockAngle: this.spec.orbit.lockAngle,
      lockHeading: this.spec.orbit.lockHeading,
      yaw: this.armed ? this.yaw : 0,
      pitch: this.armed ? this.pitch : 0
    };
    this.engine.draw({
      progress: this.spec.progress,
      focus: this.spec.focus,
      groups: this.spec.groups,
      orbit: orbit,
      width: size.width,
      height: size.height
    });
    this.canvas.setAttribute("data-ready", "1");
  };

  View.prototype.setPreset = function (name) {
    this.spec = PRESETS[name] || PRESETS.grade;
    this.yaw = 0;
    this.pitch = 0;
    this.paint();
  };

  function watchSize(canvas, view) {
    if (!window.ResizeObserver) {
      window.addEventListener("resize", function () { view.paint(); });
      return;
    }
    var observer = new ResizeObserver(function () { view.paint(); });
    observer.observe(canvas.parentElement || canvas);
  }

  function bootStill(root) {
    var canvas = root.querySelector("canvas");
    if (!canvas) return;
    var view;
    try { view = new View(canvas); }
    catch (error) {
      root.classList.add("is-fallback");
      return;
    }
    view.setPreset(root.getAttribute("data-preset") || "grade");
    watchSize(canvas, view);
    var buttons = document.querySelectorAll("[data-learn-preset]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (event) {
        var name = event.currentTarget.getAttribute("data-learn-preset");
        view.setPreset(name);
        for (var j = 0; j < buttons.length; j++) {
          buttons[j].setAttribute("aria-pressed", buttons[j] === event.currentTarget ? "true" : "false");
        }
      });
    }
  }

  function bootSequence(root) {
    var data = document.getElementById("learn-steps");
    var canvas = root.querySelector("canvas");
    if (!data || !canvas) return;
    var steps = JSON.parse(data.textContent);
    var view;
    try { view = new View(canvas); }
    catch (error) {
      root.classList.add("is-fallback");
      return;
    }
    watchSize(canvas, view);
    var title = document.getElementById("learn-step-title");
    var body = document.getElementById("learn-step-body");
    var phase = document.getElementById("learn-step-phase");
    var count = document.getElementById("learn-step-count");
    var rail = root.querySelector(".learn-rail");
    var range = root.querySelector(".learn-scrub input");
    var buttons = rail ? rail.querySelectorAll("button") : [];
    var index = 0;

    function show(next, fromScroll) {
      index = Math.max(0, Math.min(steps.length - 1, next));
      var step = steps[index];
      view.setPreset(step.preset);
      if (title) title.textContent = step.title;
      if (body) body.textContent = step.body;
      if (phase) phase.textContent = step.phase;
      if (count) count.textContent = step.kicker + " of " + String(steps.length).padStart(2, "0");
      if (range) {
        range.value = String(index + 1);
        range.setAttribute("aria-valuetext", step.title);
      }
      for (var i = 0; i < buttons.length; i++) {
        var on = i === index;
        buttons[i].setAttribute("aria-current", on ? "step" : "false");
        if (on && !fromScroll) buttons[i].scrollIntoView({ inline: "center", block: "nearest" });
      }
      root.setAttribute("data-step", step.id);
    }

    function scrollToIndex(next) {
      if (reducedMotion()) {
        show(next, false);
        return;
      }
      var track = root.querySelector(".learn-seq-track");
      var sticky = root.querySelector(".learn-seq-sticky");
      if (!track || !sticky) {
        show(next, false);
        return;
      }
      var span = Math.max(1, track.offsetHeight - sticky.offsetHeight);
      var start = track.getBoundingClientRect().top + window.scrollY;
      var t = steps.length === 1 ? 0 : next / (steps.length - 1);
      window.scrollTo({ top: start + t * span, behavior: "auto" });
      show(next, false);
    }

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (event) {
        scrollToIndex(Number(event.currentTarget.getAttribute("data-index")));
      });
    }
    if (range) {
      range.addEventListener("input", function () {
        scrollToIndex(Number(range.value) - 1);
      });
    }
    var prev = root.querySelector("[data-learn-dir='-1']");
    var nextBtn = root.querySelector("[data-learn-dir='1']");
    if (prev) prev.addEventListener("click", function () { scrollToIndex(index - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { scrollToIndex(index + 1); });

    function fromScroll() {
      if (reducedMotion()) return;
      var track = root.querySelector(".learn-seq-track");
      var sticky = root.querySelector(".learn-seq-sticky");
      if (!track || !sticky) return;
      var span = Math.max(1, track.offsetHeight - sticky.offsetHeight);
      var scrolled = Math.min(span, Math.max(0, -track.getBoundingClientRect().top));
      var t = scrolled / span;
      show(Math.round(t * (steps.length - 1)), true);
    }
    window.addEventListener("scroll", fromScroll, { passive: true });

    var params = new URLSearchParams(window.location.search);
    var query = Number(params.get("step"));
    var hash = (window.location.hash || "").replace("#", "");
    var start = 0;
    if (query >= 1 && query <= steps.length) start = query - 1;
    else if (hash) {
      for (var h = 0; h < steps.length; h++) if (steps[h].id === hash) start = h;
    }
    if (start > 0 && !reducedMotion()) scrollToIndex(start);
    else show(start, false);
    window.addEventListener("load", function () {
      if (start > 0 && !reducedMotion()) scrollToIndex(start);
    });
  }

  function bootExplore(root) {
    var data = document.getElementById("learn-parts");
    var canvas = root.querySelector("canvas");
    if (!data || !canvas) return;
    var parts = JSON.parse(data.textContent);
    var view;
    try { view = new View(canvas); }
    catch (error) {
      root.classList.add("is-fallback");
      return;
    }
    watchSize(canvas, view);
    var title = document.getElementById("learn-part-title");
    var body = document.getElementById("learn-part-body");
    var link = document.getElementById("learn-part-link");
    var buttons = root.querySelectorAll("[data-part]");

    function show(id) {
      var part = parts[0];
      for (var i = 0; i < parts.length; i++) if (parts[i].id === id) part = parts[i];
      view.setPreset(part.preset);
      if (title) title.textContent = part.title;
      if (body) body.textContent = part.body;
      if (link) {
        link.textContent = part.link;
        link.setAttribute("href", part.href);
      }
      for (var j = 0; j < buttons.length; j++) {
        buttons[j].setAttribute("aria-pressed", buttons[j].getAttribute("data-part") === part.id ? "true" : "false");
      }
      root.setAttribute("data-part", part.id);
    }

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (event) {
        show(event.currentTarget.getAttribute("data-part"));
      });
    }
    var hash = (window.location.hash || "").replace("#", "");
    show(hash || parts[0].id);
  }

  function boot() {
    bootMenu();
    var root = document.querySelector("[data-learn-view]");
    if (!root) return;
    var mode = root.getAttribute("data-learn-view");
    if (mode === "sequence") bootSequence(root);
    else if (mode === "explore") bootExplore(root);
    else bootStill(root);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
