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
    var items  = document.querySelectorAll(".acc-item");
    if (!items.length) return;
    var images  = document.querySelectorAll(".services-img");
    var caption = document.getElementById("servicesImgCaption");
    var titles  = ["Finance", "Development", "Impact", "Africa Investment Gateway"];

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
  })();

  /* ── Event Speakers Carousel ───────────────────── */
  (function () {
    var track    = document.getElementById("speakersTrack");
    var dotsWrap = document.getElementById("speakersDots");
    if (!track) return;

    var realSlides = Array.prototype.slice.call(track.querySelectorAll(".speaker-slide"));
    var N       = realSlides.length;
    var prevBtn = document.querySelector(".speakers-prev");
    var nextBtn = document.querySelector(".speakers-next");
    var current = N; // starts at first real slide
    var timer   = null;

    // Build clone buffers so the loop never has to jump back visually.
    // Layout after cloning: [prepend clones 0..N-1] [real 0..N-1] [append clones 0..N-1]
    // Prepend in reverse so index 0 = clone of real[0], index N-1 = clone of real[N-1]
    for (var i = N - 1; i >= 0; i--) {
      var pre = realSlides[i].cloneNode(true);
      pre.setAttribute("aria-hidden", "true");
      track.insertBefore(pre, track.firstChild);
    }
    realSlides.forEach(function (s) {
      var app = s.cloneNode(true);
      app.setAttribute("aria-hidden", "true");
      track.appendChild(app);
    });

    // Build dots (one per real slide only)
    for (var d = 0; d < N; d++) {
      var dot = document.createElement("button");
      dot.className = "speakers-dot";
      dot.setAttribute("aria-label", "Slide " + (d + 1));
      dot.dataset.idx = d;
      dotsWrap.appendChild(dot);
    }
    var dots = dotsWrap.querySelectorAll(".speakers-dot");

    function sw() {
      return track.querySelector(".speaker-slide").offsetWidth + 20;
    }

    function updateDots() {
      var ri = ((current - N) % N + N) % N;
      dots.forEach(function (d, i) { d.classList.toggle("is-active", i === ri); });
    }

    // Move without animation (used to silently reset after crossing a boundary)
    function snap(idx) {
      track.style.transition = "none";
      current = idx;
      track.style.transform = "translateX(-" + (current * sw()) + "px)";
      track.offsetHeight; // force reflow before re-enabling transition
      track.style.transition = "";
      updateDots();
    }

    function goTo(idx) {
      current = idx;
      track.style.transform = "translateX(-" + (current * sw()) + "px)";
      updateDots();
    }

    // After each animated transition, silently snap into the real-slide zone if needed
    track.addEventListener("transitionend", function (e) {
      if (e.propertyName !== "transform") return;
      if (current >= 2 * N) snap(current - N);
      else if (current < N) snap(current + N);
    });

    function startAuto() {
      clearInterval(timer);
      timer = setInterval(function () { goTo(current + 1); }, 3500);
    }
    function stopAuto() { clearInterval(timer); }

    if (prevBtn) prevBtn.addEventListener("click", function () { stopAuto(); goTo(current - 1); startAuto(); });
    if (nextBtn) nextBtn.addEventListener("click", function () { stopAuto(); goTo(current + 1); startAuto(); });
    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        stopAuto();
        goTo(N + +this.dataset.idx);
        startAuto();
      });
    });

    var wrap = track.closest(".speakers-carousel-wrap");
    wrap.addEventListener("mouseenter", stopAuto);
    wrap.addEventListener("mouseleave", startAuto);

    var startX = 0;
    track.addEventListener("touchstart", function (e) { stopAuto(); startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", function (e) {
      var diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) goTo(current + (diff > 0 ? 1 : -1));
      startAuto();
    });

    snap(N); // initialise at real slide 0 without animation
    startAuto();
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
