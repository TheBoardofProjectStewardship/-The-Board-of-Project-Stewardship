/**
 * See your addition / remodel.
 * Demo mode when data-api-base and window.BOPS_VISUALIZER_API are both empty:
 * no network calls; sample illustrations only.
 */
const root = document.getElementById("plan-home-hero");
if (root) {
  const SAMPLES = {
    addition: ["exterior-before.webp", "exterior-after.webp"],
    kitchen: ["kitchen-before.webp", "kitchen-after.webp"],
    bathroom: ["bathroom-before.webp", "bathroom-after.webp"],
  };
  const LEARN = {
    addition: ["./home-addition-planning.html", "Home addition planning"],
    kitchen: ["./kitchen-remodel-planning.html", "Kitchen remodel planning"],
    bathroom: ["./bathroom-waterproofing-guide.html", "Bathroom waterproofing"],
  };
  const PROJECT_BY_MODE = {
    addition: "Second story",
    kitchen: "Kitchen remodel",
    bathroom: "Bathroom remodel",
  };

  const statusEl = document.getElementById("see-status");
  const resultEl = document.getElementById("see-result");
  const leadEl = document.getElementById("see-lead");
  const step1 = document.getElementById("see-step-1");
  const step2 = document.getElementById("see-step-2");
  const fileInput = document.getElementById("see-file");
  const preview = document.getElementById("see-preview");
  const form = document.getElementById("see-lead-form");
  let mode = "addition";
  let prepared = null;
  let demoSuccess = false;

  function apiBase() {
    const fromWindow = typeof window.BOPS_VISUALIZER_API === "string" ? window.BOPS_VISUALIZER_API.trim() : "";
    const fromAttr = (root.getAttribute("data-api-base") || "").trim();
    return fromWindow || fromAttr;
  }

  function isDemo() {
    return apiBase() === "";
  }

  function mapsKey() {
    return (root.getAttribute("data-maps-key") || "").trim();
  }

  function say(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function sampleSrc(file) {
    return "/assets/images/visualizer/" + file;
  }

  function selected(group, multi) {
    const buttons = [...root.querySelectorAll('.see-chip[data-group="' + group + '"][aria-pressed="true"]')];
    const values = buttons.map((button) => button.getAttribute("data-value") || button.textContent.trim());
    return multi ? values : values[0] || "";
  }

  function wireChips(scope) {
    scope.querySelectorAll(".see-chip").forEach((button) => {
      button.addEventListener("click", () => {
        const group = button.getAttribute("data-group");
        const multi = button.getAttribute("data-multi") === "true";
        if (!multi) {
          scope.querySelectorAll('.see-chip[data-group="' + group + '"]').forEach((peer) => {
            if (peer !== button) peer.setAttribute("aria-pressed", "false");
          });
        }
        const next = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", next ? "true" : "false");
        if (group === "kitchen-scope") {
          const flag = document.getElementById("see-layout-flag");
          if (flag) flag.hidden = selected("kitchen-scope") !== "layout-change";
        }
      });
    });
  }

  function showMode(next) {
    mode = next;
    root.querySelectorAll("[data-mode-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-mode-panel") !== next;
    });
    root.querySelectorAll(".see-tab").forEach((tab) => {
      const on = tab.getAttribute("data-mode") === next;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
    root.querySelectorAll("[data-sample]").forEach((block) => {
      block.hidden = block.getAttribute("data-sample") !== next;
    });
    const modeField = document.getElementById("see-mode-field");
    if (modeField) modeField.value = next;
    const addressWrap = document.getElementById("see-lead-address-wrap");
    const addressInput = document.getElementById("see-lead-address");
    if (addressWrap && addressInput) {
      const required = next === "addition";
      addressInput.required = required;
      addressWrap.querySelector("span").textContent = required ? "Property address" : "Property address (optional)";
    }
    document.querySelectorAll('.see-chip[data-group="project-type"]').forEach((chip) => {
      const match = chip.getAttribute("data-value") === PROJECT_BY_MODE[next];
      if (match) chip.setAttribute("aria-pressed", "true");
    });
    const tip = document.getElementById("see-photo-tip");
    if (tip) {
      tip.textContent = next === "addition"
        ? "Straight-on curbside photo. JPEG, PNG, or WebP, up to 8 MB. The browser re-encodes it and removes location data."
        : "Stand in a corner, use a wide angle, turn the lights on, and leave people out of the frame. JPEG, PNG, or WebP, up to 8 MB.";
    }
  }

  function wireTabs() {
    const tabs = [...root.querySelectorAll(".see-tab")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => showMode(tab.getAttribute("data-mode")));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const next = tabs[(index + delta + tabs.length) % tabs.length];
        next.focus();
        showMode(next.getAttribute("data-mode"));
      });
    });
  }

  function wireRanges(scope) {
    scope.querySelectorAll("[data-range]").forEach((input) => {
      const frame = document.getElementById(input.getAttribute("data-range"));
      const apply = () => {
        if (frame) frame.style.setProperty("--pos", input.value + "%");
      };
      input.addEventListener("input", apply);
      apply();
    });
  }

  function hideMapsUi() {
    const places = document.getElementById("see-places");
    const street = document.getElementById("see-streetview");
    const plain = document.getElementById("see-address-plain");
    const enabled = Boolean(mapsKey()) && !isDemo();
    if (places) places.hidden = !enabled;
    if (street) street.hidden = true;
    if (plain) plain.hidden = enabled;
    const brand = document.getElementById("see-powered-by");
    if (brand) brand.hidden = !enabled;
  }

  function showStreetViewEmbed(meta) {
    // Maps Embed is display-only. Do not draw the frame into a canvas or upload it.
    if (!mapsKey() || !meta || !meta.coverage || meta.lat == null || meta.lng == null) return;
    const frame = document.getElementById("see-streetview-frame");
    const wrap = document.getElementById("see-streetview");
    if (!frame || !wrap) return;
    const params = new URLSearchParams({
      key: mapsKey(),
      location: String(meta.lat) + "," + String(meta.lng),
      heading: "0",
      pitch: "0",
      fov: "80",
    });
    frame.removeAttribute("srcdoc");
    frame.src = "https://www.google.com/maps/embed/v1/streetview?" + params.toString();
    wrap.hidden = false;
  }

  function loadPlaces() {
    if (!mapsKey() || isDemo() || window.google?.maps?.places) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(mapsKey()) + "&libraries=places&callback=__seePlacesReady&loading=async";
    window.__seePlacesReady = () => {
      const input = document.getElementById("see-places-input");
      const plain = document.getElementById("see-address");
      if (!input || !window.google?.maps?.places?.Autocomplete) return;
      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["formatted_address", "place_id"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (plain && place.formatted_address) plain.value = place.formatted_address;
        const placeId = document.getElementById("see-place-id");
        if (placeId) placeId.value = place.place_id || "";
      });
    };
    document.head.appendChild(script);
  }

  async function reencode(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error("Use a JPEG, PNG, or WebP photo.");
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error("Photo must be 8 MB or smaller.");
    }
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (bitmap.close) bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("Could not prepare that photo.");
    return blob;
  }

  function showPreview(blob) {
    if (!preview) return;
    const url = URL.createObjectURL(blob);
    preview.hidden = false;
    let img = preview.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.alt = "Your photo, re-encoded in this browser. Not uploaded while the demo is on.";
      img.width = 1200;
      img.height = 800;
      preview.appendChild(img);
    }
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    img.dataset.url = url;
    img.src = url;
  }

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    prepared = null;
    if (!file) return;
    try {
      prepared = await reencode(file);
      showPreview(prepared);
      say("Photo ready. Location data was removed in this browser.");
    } catch (err) {
      say(err.message || "That photo could not be used.");
    }
  });

  function optionsPayload() {
    return {
      mode,
      additionType: selected("addition-type"),
      additionStyle: selected("addition-style"),
      roof: selected("roof"),
      kitchenScope: selected("kitchen-scope"),
      kitchenStyle: selected("kitchen-style"),
      bathScope: selected("bath-scope"),
      bathStyle: selected("bath-style"),
      color: selected("color"),
      note: (document.getElementById("see-note")?.value || "").slice(0, 140),
    };
  }

  function fillResult() {
    const pair = SAMPLES[mode];
    const before = document.getElementById("see-result-before");
    const after = document.getElementById("see-result-after");
    before.src = sampleSrc(pair[0]);
    after.src = sampleSrc(pair[1]);
    before.alt = "Sample — illustrative " + mode + " starting picture. Not a customer house and not a Pacific Pro Group project.";
    after.alt = "Sample — illustrative " + mode + " concept picture. Not a customer house and not a Pacific Pro Group project.";
    const learn = document.getElementById("see-learn-link");
    if (learn) {
      learn.href = LEARN[mode][0];
      learn.textContent = LEARN[mode][1];
    }
    resultEl.hidden = false;
    resultEl.scrollIntoView({ block: "start" });
  }

  document.getElementById("see-render")?.addEventListener("click", async () => {
    if (mode === "addition") {
      const address = (document.getElementById("see-address")?.value || "").trim();
      if (!address) {
        say("Add the property address, then choose a photo.");
        document.getElementById("see-address")?.focus();
        return;
      }
      const leadAddress = document.getElementById("see-lead-address");
      if (leadAddress && !leadAddress.value) leadAddress.value = address;
    }
    if (!prepared) {
      say("Choose a JPEG, PNG, or WebP photo first.");
      fileInput?.focus();
      return;
    }
    say("Preparing the concept…");
    if (isDemo()) {
      fillResult();
      say("Demo preview. Sample — illustrative. This is not a concept of your photo.");
      const model = document.getElementById("see-model-used");
      if (model) model.value = "demo-sample";
      const opts = document.getElementById("see-prompt-options");
      if (opts) opts.value = JSON.stringify(optionsPayload());
      return;
    }
    say("Live concepts need the API base. Nothing was sent.");
  });

  document.getElementById("see-unlock")?.addEventListener("click", () => {
    if (leadEl) leadEl.hidden = false;
    if (step1) step1.hidden = false;
    if (step2) step2.hidden = true;
    document.getElementById("see-step-1-title")?.focus();
  });

  function groupChosen(group) {
    return root.querySelector('.see-chip[data-group="' + group + '"][aria-pressed="true"]');
  }

  document.getElementById("see-to-step-2")?.addEventListener("click", () => {
    const missing = [];
    if (!groupChosen("project-type")) missing.push("project type");
    if (!groupChosen("timeline")) missing.push("timeline");
    if (!groupChosen("budget")) missing.push("budget");
    if (!groupChosen("relationship")) missing.push("relationship to the property");
    const city = document.getElementById("see-city");
    const zip = document.getElementById("see-zip");
    if (!city?.value) missing.push("city");
    if (!/^\d{5}$/.test((zip?.value || "").trim())) missing.push("a 5-digit ZIP");
    if (mode === "addition" && !(document.getElementById("see-lead-address")?.value || "").trim()) {
      missing.push("property address");
    }
    if (missing.length) {
      say("Add " + missing.join(", ") + " before continuing.");
      return;
    }
    if (step1) step1.hidden = true;
    if (step2) step2.hidden = false;
    say("");
    document.getElementById("see-step-2-title")?.focus();
  });

  document.getElementById("see-back-step")?.addEventListener("click", () => {
    if (step2) step2.hidden = true;
    if (step1) step1.hidden = false;
    document.getElementById("see-step-1-title")?.focus();
  });

  const phone = document.getElementById("see-phone");
  const textConsent = document.getElementById("see-text-consent");
  phone?.addEventListener("input", () => {
    if (!textConsent) return;
    const show = phone.value.trim().length > 0;
    textConsent.hidden = !show;
    if (!show) {
      const box = textConsent.querySelector("input");
      if (box) box.checked = false;
    }
  });

  function checkboxState() {
    const read = (id) => Boolean(document.getElementById(id)?.checked);
    return {
      consent_share: read("see-consent-share"),
      consent_text: read("see-consent-text"),
      consent_newsletter: read("see-consent-news"),
    };
  }

  function stampHidden() {
    const params = new URLSearchParams(window.location.search);
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    set("see-utm-source", params.get("utm_source") || "");
    set("see-utm-medium", params.get("utm_medium") || "");
    set("see-utm-campaign", params.get("utm_campaign") || "");
    set("see-referrer", document.referrer || "");
    set("see-landing", window.location.href);
    set("see-timestamp-pt", new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      dateStyle: "full",
      timeStyle: "long",
    }).format(new Date()));
    set("see-checkbox-state", JSON.stringify(checkboxState()));
    set("see-project-types", JSON.stringify(selected("project-type", true)));
    set("see-timeline", selected("timeline"));
    set("see-budget", selected("budget"));
    set("see-relationship", selected("relationship"));
    set("see-plans", selected("plans"));
    set("see-contact-pref", selected("contact-pref"));
    set("see-best-time", selected("best-time"));
  }

  form?.addEventListener("submit", (event) => {
    stampHidden();
    const honey = form.querySelector('[name="company_website"]');
    if (honey && honey.value) {
      event.preventDefault();
      return;
    }
    const share = document.getElementById("see-consent-share");
    if (!share?.checked) {
      event.preventDefault();
      say("Check the box to share this request with Pacific Pro Group.");
      share?.focus();
      return;
    }
    if (!isDemo()) return;
    event.preventDefault();
    demoSuccess = true;
    const ok = document.getElementById("see-demo-success");
    if (ok) ok.hidden = false;
    say("Demo only. Nothing was sent.");
    document.getElementById("see-more-styles").hidden = false;
  });

  document.getElementById("see-more-styles")?.addEventListener("click", () => {
    if (!demoSuccess && isDemo()) {
      say("Share the request in the form before another sample.");
      return;
    }
    const order = ["addition", "kitchen", "bathroom"];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    showMode(next);
    fillResult();
    say("Another sample — illustrative. Still not a concept of your photo.");
  });

  async function maybeStreetMeta() {
    if (isDemo() || !mapsKey()) return;
    const address = (document.getElementById("see-address")?.value || "").trim();
    if (!address) return;
    const response = await fetch(apiBase().replace(/\/$/, "") + "/api/streetview-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    showStreetViewEmbed(await response.json());
  }

  function captureAddressSync() {
    const source = document.getElementById("see-address");
    const target = document.getElementById("see-lead-address");
    source?.addEventListener("input", () => {
      if (target && document.activeElement !== target) target.value = source.value;
    });
    source?.addEventListener("change", () => { maybeStreetMeta(); });
  }

  hideMapsUi();
  loadPlaces();
  wireTabs();
  wireChips(root);
  wireRanges(root);
  captureAddressSync();
  showMode("addition");
  if (isDemo()) {
    const renderBtn = document.getElementById("see-render");
    if (renderBtn) renderBtn.textContent = "Preview sample concept";
  }
}
