(function () {
  /* ── Nav Scroll ────────────────────────────────── */
  const nav = document.getElementById("mainNav");
  var backToTopBtn = document.getElementById("backToTop");
  function checkScroll() {
    if (window.scrollY > 40) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
    if (backToTopBtn) {
      if (window.scrollY > 400) backToTopBtn.classList.add("visible");
      else backToTopBtn.classList.remove("visible");
    }
  }
  window.addEventListener("scroll", checkScroll, { passive: true });
  checkScroll();
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ── Mobile Menu Toggle ───────────────────────── */
  var hamburger = document.getElementById("navHamburger");
  var mobileMenu = document.getElementById("mobileMenu");

  if (hamburger && mobileMenu) {
    function toggleMobileMenu() {
      var isOpen = mobileMenu.classList.toggle("open");
      hamburger.classList.toggle("active");
      hamburger.setAttribute("aria-expanded", isOpen);
      document.body.style.overflow = isOpen ? "hidden" : "";
    }

    var _toggleLock = false;
    hamburger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (_toggleLock) return;
      _toggleLock = true;
      toggleMobileMenu();
      setTimeout(function () {
        _toggleLock = false;
      }, 300);
    });

    // Close menu when clicking on a link
    var links = mobileMenu.querySelectorAll("a");
    links.forEach(function (link) {
      link.addEventListener("click", function () {
        if (mobileMenu.classList.contains("open")) {
          toggleMobileMenu();
        }
      });
    });

    // Close menu when clicking outside or on the overlay itself
    mobileMenu.addEventListener("click", function (e) {
      if (e.target === mobileMenu) {
        if (mobileMenu.classList.contains("open")) {
          toggleMobileMenu();
        }
      }
    });

    // Close button inside mobile overlay
    var closeBtn = document.getElementById("mobileMenuClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (mobileMenu.classList.contains("open")) {
          toggleMobileMenu();
        }
      });
    }
  }

  /* ── Bio "See More / See Less" Toggle ──────────── */
  function toggleBio(btn) {
    var text = btn.previousElementSibling;

    if (!text || !text.classList.contains("bio-text")) {
      console.warn("Toggle failed: .bio-text not found next to button");
      return;
    }

    text.classList.toggle("expanded");
    var isExpanded = text.classList.contains("expanded");

    btn.textContent = isExpanded ? "See less" : "See more";
    btn.classList.toggle("expanded", isExpanded);
  }

  // Run once DOM is completely ready
  document.addEventListener("DOMContentLoaded", function () {
    // console.log("DOM fully loaded → attaching see-more listeners");

    var buttons = document.querySelectorAll(".see-more-btn");
    // console.log("Found " + buttons.length + " see-more buttons");

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        // console.log("See more button clicked!");
        toggleBio(this);
      });
    });
  });

  /* ── Smooth Scroll for Anchor Links ────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var t = document.querySelector(this.getAttribute("href"));
      if (t) {
        e.preventDefault();
        t.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  /* ── What We Do Accordion ───────────────────────── */
  (function () {
    var items   = document.querySelectorAll(".acc-item");
    if (!items.length) return;
    var images  = document.querySelectorAll(".services-img");
    var caption = document.getElementById("servicesImgCaption");
    var leftCol = document.getElementById("servicesLeft");
    var panel   = document.getElementById("servicesImgPanel");
    var titles  = ["Finance", "Development", "Impact"];

    function calibrateHeight() {
      if (!leftCol || !panel) return;
      if (window.innerWidth <= 860) { panel.style.height = ""; return; }
      leftCol.classList.add("measuring");
      var savedIdx = (document.querySelector(".acc-item.is-open") || items[0]).dataset.idx;
      var maxH = 0;
      items.forEach(function (item) {
        items.forEach(function (i) { i.classList.remove("is-open"); });
        item.classList.add("is-open");
        leftCol.getBoundingClientRect();
        maxH = Math.max(maxH, leftCol.scrollHeight);
      });
      items.forEach(function (i) { i.classList.remove("is-open"); });
      var restore = document.querySelector(".acc-item[data-idx='" + savedIdx + "']");
      if (restore) restore.classList.add("is-open");
      leftCol.classList.remove("measuring");
      panel.style.height = maxH + "px";
    }

    items.forEach(function (item) {
      item.querySelector(".acc-header").addEventListener("click", function () {
        var idx = +item.dataset.idx;
        var wasOpen = item.classList.contains("is-open");
        items.forEach(function (i) { i.classList.remove("is-open"); });
        images.forEach(function (img) { img.classList.remove("is-active"); });
        var activeIdx = wasOpen ? 0 : idx;
        document.querySelector(".acc-item[data-idx='" + activeIdx + "']").classList.add("is-open");
        document.querySelector(".services-img[data-idx='" + activeIdx + "']").classList.add("is-active");
        if (caption) caption.textContent = titles[activeIdx];
      });
    });

    window.addEventListener("load", calibrateHeight);
    window.addEventListener("resize", calibrateHeight);
  })();

  /* ── Intersection Observer — Reveal ────────────── */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("visible");
            obs.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    reveals.forEach(function (el) {
      obs.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("visible");
    });
  }
})();
