(function () {
  var moreBtn = document.getElementById("more-toggle");
  var morePanel = document.getElementById("more-dropdown");
  var burger = document.getElementById("nav-toggle");
  var drawer = document.getElementById("mobile-nav");

  function setOpen(btn, panel, open) {
    if (!btn || !panel) return;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) panel.classList.add("is-open");
    else panel.classList.remove("is-open");
  }

  if (moreBtn && morePanel) {
    moreBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(moreBtn, morePanel, moreBtn.getAttribute("aria-expanded") !== "true");
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
      setOpen(moreBtn, morePanel, false);
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
