/* Step viewer for /learn/. Uses the homepage house model.
   Original controller. It does not share code with any other illustrated guide. */
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", api.boot);
  else api.boot();
})(function () {
  var DEG = Math.PI / 180;
  var AXON = { lockAngle: 52 * DEG, lockHeading: -36 * DEG };
  var FRONT = { lockAngle: 76 * DEG, lockHeading: Math.PI };
  var PLAN = { lockAngle: 0.08, lockHeading: -0.2 };
  var LOW = { lockAngle: 22 * DEG, lockHeading: -28 * DEG };
  var IDS = ["site", "lower", "upperfloor", "upper", "roof", "garageRoof", "porchRoof", "finish"];
  var PITCH_MIN = -0.35;
  var PITCH_MAX = 0.45;
  var ORBIT_SLOP = 10;

  function clampPitch(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) n = 0;
    return Math.max(PITCH_MIN, Math.min(PITCH_MAX, n));
  }

  function clampIndex(index, count) {
    var n = Number(index);
    if (!Number.isFinite(n)) n = 0;
    n = Math.trunc(n);
    if (count < 1) return 0;
    if (n < 0) return 0;
    if (n > count - 1) return count - 1;
    return n;
  }

  function stepFromQuery(raw, count) {
    if (raw === null || raw === undefined) return null;
    var text = String(raw).trim();
    if (!/^-?\d+$/.test(text)) return null;
    var n = Number(text);
    if (!Number.isInteger(n) || n < 1 || n > count) return null;
    return n - 1;
  }

  function gestureMode(pointerType, dx, dy, captured) {
    if (captured) return "orbit";
    if (pointerType === "mouse" || pointerType === "pen") return "orbit";
    var adx = Math.abs(dx);
    var ady = Math.abs(dy);
    if (adx < ORBIT_SLOP && ady < ORBIT_SLOP) return "pending";
    if (adx > ady) return "orbit";
    return "scroll";
  }

  function shouldPaintStep(previous, next) {
    return previous !== next;
  }

  function showGroups(map) {
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

  var WHOLE = showGroups({
    site: true, lower: true, upperfloor: true, upper: true,
    roof: true, garageRoof: true, porchRoof: true, finish: true
  });
  var FRAME = showGroups({
    site: true, lower: true, upperfloor: true, upper: true,
    roof: true, garageRoof: true, porchRoof: true
  });
  var FLOORS = showGroups({ site: true, lower: true, upperfloor: true, upper: true });
  var MAIN = showGroups({ site: true, lower: 10.6 });
  var BASE = showGroups({ site: true, lower: 0.55 });

  var PRESETS = {
    survey: { progress: 0, focus: "", orbit: PLAN, groups: showGroups({ site: true }) },
    stake: { progress: 0, focus: "", orbit: PLAN, groups: showGroups({ site: true }) },
    clear: { progress: 0, focus: "", orbit: AXON, groups: showGroups({ site: true }) },
    excavate: { progress: 0, focus: "foundation", orbit: LOW, groups: showGroups({ site: true }) },
    footings: { progress: 0.93, focus: "footings", orbit: LOW, groups: showGroups({ site: true, lower: 0.42 }) },
    foundwall: { progress: 0.9, focus: "foundation", orbit: AXON, groups: showGroups({ site: true, lower: 3.4 }) },
    damp: { progress: 0.9, focus: "foundation", orbit: FRONT, groups: showGroups({ site: true, lower: 4.2 }) },
    slab: { progress: 0.93, focus: "foundation", orbit: PLAN, groups: BASE },
    sill: { progress: 0.74, focus: "bearing", orbit: AXON, groups: MAIN },
    backfill: { progress: 0.4, focus: "foundation", orbit: LOW, groups: MAIN },
    frame1: { progress: 0.74, focus: "framing", orbit: AXON, groups: MAIN },
    frame2: { progress: 0.56, focus: "structure", orbit: AXON, groups: FLOORS },
    roof: { progress: 0.22, focus: "roof", orbit: AXON, groups: FRAME },
    dryin: { progress: 0.12, focus: "roof", orbit: FRONT, groups: FRAME },
    rough: { progress: 0.74, focus: "partition", orbit: PLAN, groups: showGroups({ site: true, lower: 10.35 }) },
    insulate: { progress: 0.56, focus: "structure", orbit: AXON, groups: showGroups({ site: true, lower: true, upperfloor: true, upper: 16.5 }) },
    siding: { progress: 0.08, focus: "", orbit: FRONT, groups: WHOLE },
    drywall: { progress: 0.74, focus: "partition", orbit: PLAN, groups: showGroups({ site: true, lower: 10.35 }) },
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

  function largeText() {
    var size = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    return size > 20;
  }

  function shortViewport() {
    return window.matchMedia && window.matchMedia("(max-height: 520px)").matches;
  }

  function bootMenu() {
    var button = document.querySelector(".learn-menu");
    var panel = document.getElementById("learn-menu-panel");
    if (!button || !panel) return;
    function closeMenu() {
      document.body.classList.remove("learn-nav-open");
      button.setAttribute("aria-expanded", "false");
    }
    button.addEventListener("click", function () {
      var open = document.body.classList.toggle("learn-nav-open");
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !document.body.classList.contains("learn-nav-open")) return;
      closeMenu();
      button.focus();
    });
    document.addEventListener("click", function (event) {
      if (!document.body.classList.contains("learn-nav-open")) return;
      var target = event.target;
      if (target === button || button.contains(target) || panel.contains(target)) return;
      closeMenu();
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
    this.zoom = 1;
    this.armed = false;
    this.dead = false;
    this.presetName = "";
    this.spec = PRESETS.grade;
    this.pointerId = null;
    var self = this;
    var host = canvas.closest("[data-learn-view]") || canvas.parentElement;
    var pending = null;
    canvas.addEventListener("click", function () {
      self.armed = true;
      canvas.classList.add("is-armed");
    });
    canvas.addEventListener("keydown", function (event) {
      var step = 0.08;
      if (event.key === "ArrowLeft") self.yaw -= step;
      else if (event.key === "ArrowRight") self.yaw += step;
      else if (event.key === "ArrowUp") self.pitch = clampPitch(self.pitch + step);
      else if (event.key === "ArrowDown") self.pitch = clampPitch(self.pitch - step);
      else if (event.key === "+" || event.key === "=") self.zoom = Math.min(2.4, self.zoom * 1.12);
      else if (event.key === "-" || event.key === "_") self.zoom = Math.max(0.7, self.zoom / 1.12);
      else return;
      event.preventDefault();
      self.armed = true;
      canvas.classList.add("is-armed");
      self.paint();
    });
    canvas.addEventListener("pointerdown", function (event) {
      if (!self.armed || self.pointerId !== null) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pending = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        yaw: self.yaw,
        pitch: self.pitch,
        type: event.pointerType
      };
      if (gestureMode(event.pointerType, 0, 0, false) === "orbit") capture(event, pending);
    });
    function capture(event, origin) {
      pending = null;
      self.pointerId = event.pointerId;
      origin.id = event.pointerId;
      self._drag = origin;
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* already released */ }
      }
    }
    canvas.addEventListener("pointermove", function (event) {
      if (pending && event.pointerId === pending.id) {
        var dx = event.clientX - pending.x;
        var dy = event.clientY - pending.y;
        var mode = gestureMode(pending.type, dx, dy, false);
        if (mode === "pending") return;
        if (mode === "scroll") { pending = null; return; }
        capture(event, pending || {
          id: event.pointerId, x: event.clientX, y: event.clientY,
          yaw: self.yaw, pitch: self.pitch, type: event.pointerType
        });
      }
      if (self.pointerId !== event.pointerId || !self._drag) return;
      self.yaw = self._drag.yaw + (event.clientX - self._drag.x) * 0.005;
      self.pitch = clampPitch(self._drag.pitch + (self._drag.y - event.clientY) * 0.003);
      self.paint();
    });
    function end(event) {
      if (pending && (!event || event.pointerId === pending.id)) pending = null;
      if (!event || self.pointerId === event.pointerId) {
        self.pointerId = null;
        self._drag = null;
      }
    }
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      self.dead = true;
      if (host) host.classList.add("is-fallback");
    });
    if (host) {
      var reset = host.querySelector("[data-learn-reset]");
      if (reset) reset.addEventListener("click", function () { self.resetView(); });
      var zoomIn = host.querySelector("[data-learn-zoom='in']");
      var zoomOut = host.querySelector("[data-learn-zoom='out']");
      if (zoomIn) zoomIn.addEventListener("click", function () {
        self.zoom = Math.min(2.4, self.zoom * 1.12);
        self.paint();
      });
      if (zoomOut) zoomOut.addEventListener("click", function () {
        self.zoom = Math.max(0.7, self.zoom / 1.12);
        self.paint();
      });
    }
  }

  View.prototype.paint = function () {
    if (this.dead) return;
    var size = fit(this.canvas);
    var orbit = {
      lockAngle: this.spec.orbit.lockAngle,
      lockHeading: this.spec.orbit.lockHeading,
      yaw: this.armed ? this.yaw : 0,
      pitch: this.armed ? this.pitch : 0,
      zoom: this.zoom
    };
    try {
      var drawn = this.engine.draw({
        progress: this.spec.progress,
        focus: this.spec.focus,
        groups: this.spec.groups,
        orbit: orbit,
        width: size.width,
        height: size.height
      });
      if (!drawn) throw new Error("The drawing context was lost.");
    } catch (error) {
      this.dead = true;
      var host = this.canvas.closest("[data-learn-view]") || this.canvas.parentElement;
      if (host) host.classList.add("is-fallback");
      return;
    }
    this.canvas.setAttribute("data-ready", "1");
  };

  View.prototype.setPreset = function (name) {
    if (this.presetName === name) return;
    this.presetName = name;
    this.spec = PRESETS[name] || PRESETS.grade;
    this.yaw = 0;
    this.pitch = 0;
    this.zoom = 1;
    this.paint();
  };

  View.prototype.resetView = function () {
    this.yaw = 0;
    this.pitch = 0;
    this.zoom = 1;
    this.paint();
  };

  function watchSize(canvas, view) {
    var paint = function () { if (!view.dead) view.paint(); };
    if (!window.ResizeObserver) {
      window.addEventListener("resize", paint);
      return;
    }
    var observer = new ResizeObserver(paint);
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
    var view = null;
    try {
      view = new View(canvas);
      watchSize(canvas, view);
    } catch (error) {
      root.classList.add("is-fallback");
    }
    var title = document.getElementById("learn-step-title");
    var body = document.getElementById("learn-step-body");
    var phase = document.getElementById("learn-step-phase");
    var count = document.getElementById("learn-step-count");
    var rail = root.querySelector(".learn-rail");
    var range = root.querySelector(".learn-scrub input");
    var buttons = rail ? rail.querySelectorAll("button") : [];
    var index = -1;
    var onscreen = true;
    var frame = 0;
    var prevBtn = root.querySelector("[data-learn-dir='-1']");
    var nextBtn = root.querySelector("[data-learn-dir='1']");

    function reveal(button) {
      if (!rail || !button) return;
      var left = button.offsetLeft - (rail.clientWidth - button.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, left), behavior: "instant" });
    }

    function show(next, fromScroll) {
      var clamped = clampIndex(next, steps.length);
      if (!shouldPaintStep(index, clamped)) return;
      index = clamped;
      var step = steps[index];
      if (view && !view.dead) view.setPreset(step.preset);
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
        if (on && !fromScroll) reveal(buttons[i]);
      }
      if (prevBtn) prevBtn.disabled = index <= 0;
      if (nextBtn) nextBtn.disabled = index >= steps.length - 1;
      root.setAttribute("data-step", step.id);
    }

    function scrollToIndex(next) {
      next = clampIndex(next, steps.length);
      if (reducedMotion() || !root.classList.contains("is-enhanced")) {
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
      window.scrollTo({ top: start + t * span, behavior: "instant" });
      show(next, false);
    }

    function applyFromScroll() {
      if (!root.classList.contains("is-enhanced") || !onscreen) return;
      var track = root.querySelector(".learn-seq-track");
      var sticky = root.querySelector(".learn-seq-sticky");
      if (!track || !sticky) return;
      var span = Math.max(1, track.offsetHeight - sticky.offsetHeight);
      var scrolled = Math.min(span, Math.max(0, -track.getBoundingClientRect().top));
      show(Math.round((scrolled / span) * (steps.length - 1)), true);
    }

    function fromScroll() {
      if (reducedMotion() || !onscreen) return;
      if (frame) return;
      frame = window.requestAnimationFrame(function () {
        frame = 0;
        applyFromScroll();
      });
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
    if (prevBtn) prevBtn.addEventListener("click", function () { scrollToIndex(index - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { scrollToIndex(index + 1); });
    window.addEventListener("scroll", fromScroll, { passive: true });
    window.addEventListener("resize", applyFromScroll);
    window.addEventListener("orientationchange", applyFromScroll);
    if (window.IntersectionObserver) {
      var observer = new IntersectionObserver(function (entries) {
        onscreen = entries.some(function (entry) { return entry.isIntersecting; });
      }, { rootMargin: "80px" });
      observer.observe(root);
    }

    function maybeEnhance() {
      var sticky = root.querySelector(".learn-seq-sticky");
      if (!view || view.dead || reducedMotion() || shortViewport() || largeText() || !sticky) {
        root.classList.remove("is-enhanced");
        return;
      }
      root.classList.remove("is-enhanced");
      if (sticky.scrollHeight > window.innerHeight - 8) return;
      root.classList.add("is-enhanced");
    }
    window.addEventListener("resize", maybeEnhance);

    var params = new URLSearchParams(window.location.search);
    var queried = stepFromQuery(params.get("step"), steps.length);
    var hash = (window.location.hash || "").replace("#", "");
    var start = queried === null ? 0 : queried;
    if (queried === null && hash) {
      for (var h = 0; h < steps.length; h++) if (steps[h].id === hash) start = h;
    }
    show(start, false);
    if (view && !view.dead) {
      maybeEnhance();
      if (start > 0) scrollToIndex(start);
    }
  }

  function bootExplore(root) {
    var data = document.getElementById("learn-parts");
    var canvas = root.querySelector("canvas");
    if (!data || !canvas) return;
    var parts = JSON.parse(data.textContent);
    var view = null;
    try {
      view = new View(canvas);
      watchSize(canvas, view);
    } catch (error) {
      root.classList.add("is-fallback");
    }
    var title = document.getElementById("learn-part-title");
    var body = document.getElementById("learn-part-body");
    var link = document.getElementById("learn-part-link");
    var status = document.getElementById("learn-status");
    var buttons = root.querySelectorAll("[data-part]");

    function show(id) {
      var part = parts[0];
      for (var i = 0; i < parts.length; i++) if (parts[i].id === id) part = parts[i];
      if (view && !view.dead) view.setPreset(part.preset);
      if (title) title.textContent = part.title;
      if (body) body.textContent = part.body;
      if (link) {
        link.textContent = part.link;
        link.setAttribute("href", part.href);
      }
      if (status) status.textContent = part.title + " selected.";
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

  return {
    boot: boot,
    clampPitch: clampPitch,
    clampIndex: clampIndex,
    stepFromQuery: stepFromQuery,
    gestureMode: gestureMode,
    shouldPaintStep: shouldPaintStep,
    PITCH_MIN: PITCH_MIN,
    PITCH_MAX: PITCH_MAX
  };
});
