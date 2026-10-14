(function () {
  var moreBtn = document.getElementById("more-toggle");
  var morePanel = document.getElementById("more-dropdown");
  var burger = document.getElementById("nav-toggle");
  var drawer = document.getElementById("mobile-nav");

  function setOpen(btn, panel, open) {
    if (!btn || !panel) return;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) panel.hidden = false;
    if (open) panel.classList.add("is-open");
    else panel.classList.remove("is-open");
    if (!open) panel.hidden = true;
  }

  if (moreBtn && morePanel) {
    moreBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(moreBtn, morePanel, moreBtn.getAttribute("aria-expanded") !== "true");
    });
    morePanel.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(moreBtn, morePanel, false);
      });
    });
    morePanel.addEventListener("focusout", function () {
      setTimeout(function () {
        var active = document.activeElement;
        if (active === moreBtn || morePanel.contains(active)) return;
        setOpen(moreBtn, morePanel, false);
      }, 0);
    });
  }
  if (burger && drawer) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") !== "true";
      setOpen(burger, drawer, open);
      document.body.classList.toggle("nav-open", open);
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open) {
        var first = drawer.querySelector("a");
        if (first) first.focus();
      }
    });
    drawer.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        setOpen(burger, drawer, false);
        document.body.classList.remove("nav-open");
        burger.setAttribute("aria-label", "Open menu");
      });
    });
  }
  document.addEventListener("click", function (e) {
    if (moreBtn && morePanel && e.target !== moreBtn && !morePanel.contains(e.target)) {
      setOpen(moreBtn, morePanel, false);
    }
    var btn = e.target.closest && e.target.closest("[data-embed-src]");
    if (!btn) return;
    var src = btn.getAttribute("data-embed-src");
    if (!src) return;
    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = btn.getAttribute("data-embed-title") || "Embedded content";
    iframe.loading = "lazy";
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    );
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    iframe.className = "absolute inset-0 w-full h-full border-0";
    var host = btn.closest(".video-embed, .hub-video-embed, .embed-facade-frame") || btn.parentElement;
    if (!host) return;
    host.textContent = "";
    host.appendChild(iframe);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (moreBtn && morePanel && moreBtn.getAttribute("aria-expanded") === "true") {
        setOpen(moreBtn, morePanel, false);
        moreBtn.focus();
      }
      if (burger && burger.getAttribute("aria-expanded") === "true") {
        setOpen(burger, drawer, false);
        document.body.classList.remove("nav-open");
        burger.setAttribute("aria-label", "Open menu");
        burger.focus();
      }
      return;
    }
    if (e.key !== "Tab" || !drawer || !burger) return;
    if (burger.getAttribute("aria-expanded") !== "true") return;
    var focusable = [burger].concat(Array.prototype.slice.call(drawer.querySelectorAll("a, button")));
    if (!focusable.length) return;
    var firstEl = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      firstEl.focus();
    }
  });
})();

(function () {
  var scope = document.getElementById("calc-scope");
  var drivers = document.getElementById("calc-drivers");
  var el = document.getElementById("calc-result");
  if (!scope || !drivers || !el) return;
  var tips = {
    kitchen: {
      site: "Ask how demo dust, temporary kitchen plans, and cabinet lead times are handled in the written schedule.",
      structure: "Confirm whether walls are load-bearing, if an engineer is needed, and who owns framing inspections.",
      finish: "Separate allowances from fixed packages; get brand/model lists and lead-time assumptions in writing.",
      ahj: "Verify whether the kitchen triggers a building permit only, or also electrical/plumbing/mechanical permits in your AHJ."
    },
    bath: {
      site: "In coastal King/Snohomish homes, press on waterproofing stacks, fan ducting to exterior, and moisture detailing.",
      structure: "Ask how pan, curb, and blocking are detailed before tile; get the waterproofing product stack in the scope.",
      finish: "Tile layout, niches, and glass lead times drive duration — require a finish schedule before deposit.",
      ahj: "Confirm bathroom fan, GFCI, and waterproofing inspection holds with your city or county AHJ."
    },
    addition: {
      site: "Discuss setbacks, drainage, tree protection, and construction access before design is locked.",
      structure: "Second-story and opening enlargements need clear engineering ownership and dry-in milestones.",
      finish: "Exterior cladding and window packages often gate dry-in — get lead times on the critical path.",
      ahj: "Use the Board permit hub, then your AHJ portal for fees/timelines — Board pages do not invent calendars."
    },
    adu: {
      site: "Confirm lot coverage, parking, and utility taps early; Edmonds and Seattle rules are not interchangeable.",
      structure: "Detached vs attached ADUs change foundation and fire-separation details — put the typology in the contract.",
      finish: "Kitchenette and bath packages inside an ADU still need allowance rules and inspection sequencing.",
      ahj: "Read the Board ADU notes for the parcel's AHJ. The Edmonds ADU hub is one city example. Then finish on the official portal."
    },
    custom: {
      site: "Custom homes hinge on site surveys, soils, and coastal exposure — ask who owns each diligence item.",
      structure: "Demand a single steward for drawings, engineering, and field changes so RFIs do not orphan the schedule.",
      finish: "Finish boards and long-lead items should be frozen before framing when possible; document exceptions.",
      ahj: "Large permits move through multiple reviews — ask for a responsibility matrix, not a promised month count."
    }
  };
  function update() {
    var row = tips[scope.value] || {};
    el.textContent = row[drivers.value] || "Compare written scopes; verify every firm at WA L&I before deposits.";
  }
  scope.addEventListener("change", update);
  drivers.addEventListener("change", update);
  update();
})();
