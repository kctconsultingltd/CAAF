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

  /* ── What We Do Carousel (infinite scroll) ───────── */
  (function () {
    var track = document.querySelector(".carousel-slides");
    if (!track) return;

    var realSlides = Array.from(track.querySelectorAll(".carousel-slide"));
    var realCount = realSlides.length;
    if (!realCount) return;

    // Append a clone of slide 0 so the loop can scroll past it seamlessly
    var firstClone = realSlides[0].cloneNode(true);
    firstClone.setAttribute("aria-hidden", "true");
    firstClone.classList.remove("is-active");
    track.appendChild(firstClone);

    var allSlides = Array.from(track.querySelectorAll(".carousel-slide"));
    var totalCount = allSlides.length; // realCount + 1

    var currentIndex = 0;
    var busy = false;
    var slideInterval = null;
    var TRANSITION_MS = 650; // slightly over the CSS 0.6s

    function isMobile() { return window.innerWidth <= 900; }

    // Set track/slide widths so each slide fills the viewport on mobile
    function setMobileWidths() {
      if (isMobile()) {
        track.style.width = (totalCount * 100) + "%";
        allSlides.forEach(function (s) {
          s.style.width = (100 / totalCount) + "%";
        });
      } else {
        track.style.width = "";
        allSlides.forEach(function (s) { s.style.width = ""; });
      }
    }

    function updateActive() {
      var idx = currentIndex % realCount;
      realSlides.forEach(function (s) { s.classList.remove("is-active"); });
      realSlides[idx].classList.add("is-active");
      firstClone.classList.toggle("is-active", idx === 0);
    }

    function setPosition(idx, animate) {
      if (!animate) {
        track.style.transition = "none";
        void track.offsetWidth; // flush so "none" takes effect immediately
      } else {
        track.style.transition = "";
      }
      track.style.transform = isMobile()
        ? "translateX(-" + (idx / totalCount * 100) + "%)"
        : "";
      if (!animate) {
        void track.offsetWidth; // flush the transform before re-enabling
        track.style.transition = "";
      }
    }

    function advance() {
      if (busy) return;
      busy = true;

      currentIndex++;
      updateActive();
      setPosition(currentIndex, true);

      if (isMobile() && currentIndex === realCount) {
        // We're on the clone — after the animation, silently snap to real slide 0
        setTimeout(function () {
          currentIndex = 0;
          setPosition(0, false);
          busy = false;
        }, TRANSITION_MS);
      } else {
        setTimeout(function () { busy = false; }, TRANSITION_MS);
      }
    }

    function startInterval() {
      if (slideInterval) clearInterval(slideInterval);
      slideInterval = setInterval(advance, 3000);
    }

    window.addEventListener("resize", function () {
      setMobileWidths();
      setPosition(currentIndex, false);
    });

    setMobileWidths();
    updateActive();
    setPosition(0, false);
    startInterval();
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
