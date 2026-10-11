/**
 * See your addition / remodel.
 * Demo mode when data-api-base and window.BOPS_VISUALIZER_API are both empty:
 * no network calls; sample illustrations only.
 * Live mode posts only to the Worker. The form never submits to a static page.
 */
const root = document.getElementById("plan-home-hero");
if (root) {
  const BEFORE = {
    addition: "exterior-before.webp",
    kitchen: "kitchen-before.webp",
    bathroom: "bathroom-before.webp",
  };
  const AFTER = {
    addition: ["exterior-after.webp", "exterior-after-b.webp"],
    kitchen: ["kitchen-after.webp", "kitchen-after-b.webp"],
    bathroom: ["bathroom-after.webp", "bathroom-after-b.webp"],
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
  const styleIndex = { addition: 0, kitchen: 0, bathroom: 0 };
  let mode = "addition";
  let prepared = null;
  let photoRevision = 0;
  let streetRev = 0;
  let demoSuccess = false;
  let phase = "demo";
  let sessionToken = "";
  let renderBusy = false;

  function apiBase() {
    const fromWindow = typeof window.BOPS_VISUALIZER_API === "string" ? window.BOPS_VISUALIZER_API.trim() : "";
    const fromAttr = (root.getAttribute("data-api-base") || "").trim();
    return (fromWindow || fromAttr).replace(/\/$/, "");
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
        ? "Straight-on curbside photo. JPEG, PNG, or WebP, up to 8 MB."
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

  function applyRange(input) {
    const frame = document.getElementById(input.getAttribute("data-range"));
    const before = Number(input.value);
    if (frame) frame.style.setProperty("--pos", before + "%");
    input.setAttribute("aria-valuetext", before + "% before, " + (100 - before) + "% concept");
  }

  function wireRanges(scope) {
    scope.querySelectorAll("[data-range]").forEach((input) => {
      input.addEventListener("input", () => applyRange(input));
      applyRange(input);
      if (input.parentElement.querySelector(".see-compare-actions")) return;
      const actions = document.createElement("div");
      actions.className = "see-compare-actions";
      [["Show before", "0"], ["Show concept", "100"]].forEach(([label, value]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "see-btn-secondary";
        button.textContent = label;
        button.addEventListener("click", () => {
          input.value = value;
          applyRange(input);
        });
        actions.appendChild(button);
      });
      input.parentElement.appendChild(actions);
    });
  }

  function hideMapsUi() {
    const places = document.getElementById("see-places");
    const street = document.getElementById("see-streetview");
    const plain = document.getElementById("see-address-plain");
    const enabled = Boolean(mapsKey()) && !isDemo();
    if (places) places.hidden = !enabled;
    if (street) street.hidden = true;
    if (plain) plain.hidden = false;
    const brand = document.getElementById("see-powered-by");
    if (brand) {
      brand.hidden = !enabled;
      brand.textContent = "Google Maps";
    }
  }

  function showStreetViewEmbed(meta) {
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

  function setAddress(value, nextPlaceId) {
    streetRev += 1;
    const placeField = document.getElementById("see-place-id");
    if (placeField) placeField.value = nextPlaceId || "";
    const source = document.getElementById("see-address");
    const target = document.getElementById("see-lead-address");
    if (source) source.value = value;
    if (target) target.value = value;
    const wrap = document.getElementById("see-streetview");
    const frame = document.getElementById("see-streetview-frame");
    if (wrap) wrap.hidden = true;
    if (frame) frame.removeAttribute("src");
  }

  function loadPlaces() {
    if (!mapsKey() || isDemo()) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(mapsKey()) + "&libraries=places&callback=__seePlacesReady&loading=async";
    window.__seePlacesReady = () => {
      const host = document.getElementById("see-places-host");
      const places = window.google?.maps?.places;
      const Element = places?.PlaceAutocompleteElement;
      if (host && Element) {
        const widget = new Element({});
        widget.addEventListener("gmp-select", async (event) => {
          const prediction = event.placePrediction;
          if (!prediction || typeof prediction.toPlace !== "function") return;
          const place = prediction.toPlace();
          await place.fetchFields({ fields: ["formattedAddress", "id"] });
          setAddress(place.formattedAddress || "", place.id || "");
          maybeStreetMeta();
        });
        host.appendChild(widget);
        return;
      }
      const input = document.getElementById("see-places-input");
      if (!input || !places?.Autocomplete) return;
      const autocomplete = new places.Autocomplete(input, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["formatted_address", "place_id"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        setAddress(place.formatted_address || input.value, place.place_id || "");
        maybeStreetMeta();
      });
    };
    document.head.appendChild(script);
  }

  function loadTurnstile() {
    const sitekey = (root.getAttribute("data-turnstile-sitekey") || "").trim();
    if (!sitekey) return Promise.resolve(null);
    if (window.turnstile) return Promise.resolve(window.turnstile);
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve(window.turnstile || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  function turnstileToken(action) {
    const sitekey = (root.getAttribute("data-turnstile-sitekey") || "").trim();
    const widget = document.getElementById("see-turnstile-widget");
    if (!sitekey || !widget) return Promise.resolve("");
    return loadTurnstile().then((turnstile) => {
      if (!turnstile) return "";
      return new Promise((resolve) => {
        if (widget.dataset.widget) turnstile.remove(widget.dataset.widget);
        widget.dataset.widget = turnstile.render(widget, {
          sitekey,
          action,
          callback: (token) => resolve(token || ""),
          "error-callback": () => resolve(""),
          "expired-callback": () => resolve(""),
        });
      });
    });
  }

  async function reencode(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use a JPEG, PNG, or WebP photo.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Photo must be 8 MB or smaller.");
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
    blob.seeWidth = width;
    blob.seeHeight = height;
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
      preview.appendChild(img);
    }
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    img.dataset.url = url;
    img.src = url;
    if (blob.seeWidth && blob.seeHeight) img.style.aspectRatio = blob.seeWidth + " / " + blob.seeHeight;
  }

  fileInput?.addEventListener("change", async () => {
    const revision = ++photoRevision;
    prepared = null;
    const renderBtn = document.getElementById("see-render");
    if (renderBtn && phase === "ready") renderBtn.disabled = true;
    if (preview) {
      const img = preview.querySelector("img");
      if (img && img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      preview.hidden = true;
    }
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      if (renderBtn && phase !== "unavailable") renderBtn.disabled = false;
      return;
    }
    try {
      const blob = await reencode(file);
      if (revision !== photoRevision) return;
      prepared = blob;
      showPreview(blob);
      say("Embedded photo metadata was removed. Details visible in the photo remain.");
    } catch (err) {
      if (revision !== photoRevision) return;
      say(err.message || "That photo could not be used.");
    } finally {
      if (revision === photoRevision && renderBtn && phase !== "unavailable") renderBtn.disabled = false;
    }
  });

  function optionsPayload() {
    return {
      additionType: selected("addition-type"),
      additionStyle: selected("addition-style"),
      roof: selected("roof"),
      kitchenScope: selected("kitchen-scope"),
      kitchenStyle: selected("kitchen-style"),
      bathScope: selected("bath-scope"),
      bathStyle: selected("bath-style"),
      color: selected("color"),
    };
  }

  function fillResult() {
    const before = document.getElementById("see-result-before");
    const after = document.getElementById("see-result-after");
    const afterFile = AFTER[mode][styleIndex[mode] % AFTER[mode].length];
    before.src = sampleSrc(BEFORE[mode]);
    after.src = sampleSrc(afterFile);
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

  async function uploadPhoto(blob) {
    const formData = new FormData();
    formData.set("photo", blob, "photo.jpg");
    const response = await fetch(apiBase() + "/api/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + sessionToken },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok || !data.imageId) throw new Error("The photo was not accepted.");
    return data.imageId;
  }

  document.getElementById("see-render")?.addEventListener("click", async () => {
    if (renderBusy) return;
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
    if (phase === "demo") {
      fillResult();
      say("Demo preview. Sample — illustrative. This is not a concept of your photo.");
      const model = document.getElementById("see-model-used");
      if (model) model.value = "demo-sample";
      const opts = document.getElementById("see-prompt-options");
      if (opts) opts.value = JSON.stringify({ ...optionsPayload(), note: (document.getElementById("see-note")?.value || "").slice(0, 140) });
      return;
    }
    if (phase !== "ready") {
      say("The live tool is not available. Use the contact page. Nothing was sent.");
      return;
    }
    const attest = document.getElementById("see-attest");
    if (attest && !attest.checked) {
      say("Confirm that you took the photo or have permission to upload it.");
      attest.focus();
      return;
    }
    const revision = photoRevision;
    const snapshot = prepared;
    const snapshotMode = mode;
    const note = (document.getElementById("see-note")?.value || "").slice(0, 140);
    renderBusy = true;
    say("Preparing the concept…");
    try {
      const imageId = await uploadPhoto(snapshot);
      if (revision !== photoRevision || snapshotMode !== mode) {
        say("The photo changed. Choose Preview again.");
        return;
      }
      const response = await fetch(apiBase() + "/api/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessionToken,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ imageId, mode: snapshotMode, options: optionsPayload(), note }),
      });
      const data = await response.json();
      if (revision !== photoRevision) return;
      const ids = document.getElementById("see-render-ids");
      if (ids && data.renderId) ids.value = data.renderId;
      const imageField = document.getElementById("see-place-id");
      if (imageField && imageField.dataset) imageField.dataset.imageId = imageId;
      root.dataset.imageId = imageId;
      if (!response.ok) {
        say("The live concept service is not available yet. Nothing was charged.");
        return;
      }
      say("Request received. The concept is processing.");
    } catch {
      say("The live tool is not available. Use the contact page. Nothing was sent.");
    } finally {
      renderBusy = false;
    }
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

  function showStepErrors(missing) {
    const box = document.getElementById("see-step-errors");
    if (!box) {
      say("Add " + missing.map((item) => item.label).join(", ") + " before continuing.");
      return;
    }
    box.hidden = false;
    box.innerHTML = "";
    const title = document.createElement("p");
    title.textContent = "Add the missing items before continuing.";
    box.appendChild(title);
    missing.forEach((item) => {
      const link = document.createElement("a");
      link.href = "#" + item.id;
      link.textContent = item.label;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = document.getElementById(item.id);
        if (!target) return;
        target.setAttribute("aria-invalid", "true");
        target.focus();
      });
      box.appendChild(document.createElement("br"));
      box.appendChild(link);
    });
    box.focus?.();
    say("Add the missing items before continuing.");
  }

  document.getElementById("see-to-step-2")?.addEventListener("click", () => {
    const missing = [];
    if (!groupChosen("project-type")) missing.push({ id: "see-step-1-title", label: "project type" });
    if (!groupChosen("timeline")) missing.push({ id: "see-step-1-title", label: "timeline" });
    if (!groupChosen("budget")) missing.push({ id: "see-step-1-title", label: "budget" });
    if (!groupChosen("relationship")) missing.push({ id: "see-step-1-title", label: "relationship to the property" });
    const city = document.getElementById("see-city");
    const zip = document.getElementById("see-zip");
    if (!city?.value) missing.push({ id: "see-city", label: "city" });
    if (!/^\d{5}$/.test((zip?.value || "").trim())) missing.push({ id: "see-zip", label: "a 5-digit ZIP" });
    if (mode === "addition" && !(document.getElementById("see-lead-address")?.value || "").trim()) {
      missing.push({ id: "see-lead-address", label: "property address" });
    }
    if (missing.length) {
      showStepErrors(missing);
      return;
    }
    const errors = document.getElementById("see-step-errors");
    if (errors) errors.hidden = true;
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

  function stampHidden() {
    const params = new URLSearchParams(window.location.search);
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    ["utm_source", "utm_medium", "utm_campaign"].forEach((key) => {
      set("see-" + key.replace(/_/g, "-"), (params.get(key) || "").slice(0, 80));
    });
    let referrer = "";
    if (document.referrer) {
      try {
        const url = new URL(document.referrer);
        referrer = url.origin + url.pathname;
      } catch { referrer = ""; }
    }
    set("see-referrer", referrer);
    set("see-landing", window.location.origin + window.location.pathname);
    set("see-project-types", JSON.stringify(selected("project-type", true)));
    set("see-timeline", selected("timeline"));
    set("see-budget", selected("budget"));
    set("see-relationship", selected("relationship"));
    set("see-plans", selected("plans"));
    set("see-contact-pref", selected("contact-pref"));
    set("see-best-time", selected("best-time"));
    set("see-mode-field", mode);
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    stampHidden();
    const honey = form.querySelector('[name="company_website"]');
    if (honey && honey.value) return;
    const share = document.getElementById("see-consent-share");
    if (!share?.checked) {
      say("Check the box to share this request with Pacific Pro Group.");
      share?.focus();
      return;
    }
    if (phase !== "ready") {
      if (phase === "demo") {
        demoSuccess = true;
        const ok = document.getElementById("see-demo-success");
        if (ok) ok.hidden = false;
        say("Demo only. Nothing was sent.");
        document.getElementById("see-more-styles").hidden = false;
      } else {
        say("The live tool is not available. Use the contact page. Nothing was sent.");
      }
      return;
    }
    say("Sending the request…");
    try {
      const token = await turnstileToken("lead");
      if (!token) {
        say("The check did not finish. Nothing was sent.");
        return;
      }
      const extra = document.getElementById("see-more-photos");
      const imageIds = root.dataset.imageId ? [root.dataset.imageId] : [];
      const files = extra?.files ? [...extra.files].slice(0, 5) : [];
      for (const file of files) {
        const blob = await reencode(file);
        imageIds.push(await uploadPhoto(blob));
      }
      const response = await fetch(apiBase() + "/api/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessionToken,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          turnstile_token: token,
          name: document.getElementById("see-name")?.value || "",
          email: document.getElementById("see-email")?.value || "",
          phone: document.getElementById("see-phone")?.value || "",
          address: document.getElementById("see-lead-address")?.value || "",
          city: document.getElementById("see-city")?.value || "",
          zip: document.getElementById("see-zip")?.value || "",
          mode,
          project_types: selected("project-type", true),
          timeline: selected("timeline"),
          budget: selected("budget"),
          relationship: selected("relationship"),
          plans: selected("plans"),
          contact_pref: selected("contact-pref"),
          best_time: selected("best-time"),
          note: document.getElementById("see-else")?.value || "",
          consent_share: true,
          consent_text: Boolean(document.getElementById("see-consent-text")?.checked),
          consent_newsletter: Boolean(document.getElementById("see-consent-news")?.checked),
          consent_text_version: form.querySelector('[name="consent_text_version"]')?.value || "",
          company_website: honey?.value || "",
          image_ids: imageIds,
          utm_source: document.getElementById("see-utm-source")?.value || "",
          utm_medium: document.getElementById("see-utm-medium")?.value || "",
          utm_campaign: document.getElementById("see-utm-campaign")?.value || "",
          referrer: document.getElementById("see-referrer")?.value || "",
          landing_page: document.getElementById("see-landing")?.value || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        say("The request was not accepted. Nothing else was sent.");
        return;
      }
      say(data.status === "received" ? "Request received." : "Request received.");
      document.getElementById("see-more-styles").hidden = false;
    } catch {
      say("The live tool is not available. Use the contact page. Nothing was sent.");
    }
  });

  document.getElementById("see-more-styles")?.addEventListener("click", () => {
    if (!demoSuccess && phase === "demo") {
      say("Share the request in the form before another sample.");
      return;
    }
    styleIndex[mode] = (styleIndex[mode] + 1) % AFTER[mode].length;
    fillResult();
    say("Another sample style — illustrative. Still this project type, and still not a concept of your photo.");
  });

  async function maybeStreetMeta() {
    if (isDemo() || !mapsKey() || !sessionToken) return;
    const revision = streetRev;
    const address = (document.getElementById("see-address")?.value || "").trim();
    if (!address) return;
    const response = await fetch(apiBase() + "/api/streetview-meta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + sessionToken,
      },
      body: JSON.stringify({ address }),
    });
    if (revision !== streetRev) return;
    showStreetViewEmbed(await response.json());
  }

  function captureAddressSync() {
    const source = document.getElementById("see-address");
    const target = document.getElementById("see-lead-address");
    const placeField = document.getElementById("see-place-id");
    source?.addEventListener("input", () => {
      if (placeField) placeField.value = "";
      if (target && document.activeElement !== target) target.value = source.value;
    });
    source?.addEventListener("change", () => { maybeStreetMeta(); });
  }

  async function initLive() {
    if (isDemo()) {
      phase = "demo";
      const renderBtn = document.getElementById("see-render");
      if (renderBtn) renderBtn.textContent = "Preview sample concept";
      return;
    }
    phase = "initializing";
    const renderBtn = document.getElementById("see-render");
    if (renderBtn) renderBtn.disabled = true;
    const attest = document.getElementById("see-attest-wrap");
    if (attest) attest.hidden = false;
    say("Preparing the live tool…");
    try {
      const token = await turnstileToken("session");
      if (!token) {
        phase = "unavailable";
        say("The live tool is not available. Use the contact page. Nothing was sent.");
        return;
      }
      const response = await fetch(apiBase() + "/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstile_token: token }),
      });
      const data = await response.json();
      if (!response.ok || !data.token) {
        phase = "unavailable";
        say("The live tool is not available. Use the contact page. Nothing was sent.");
        return;
      }
      sessionToken = data.token;
      phase = "ready";
      if (renderBtn) renderBtn.disabled = false;
      say("");
    } catch {
      phase = "unavailable";
      say("The live tool is not available. Use the contact page. Nothing was sent.");
    }
  }

  hideMapsUi();
  loadPlaces();
  wireTabs();
  wireChips(root);
  wireRanges(root);
  captureAddressSync();
  showMode("addition");
  initLive();
}
