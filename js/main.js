(function () {
  /* ── Nav Scroll ────────────────────────────────── */
  const nav = document.getElementById("mainNav");
  function checkScroll() {
    if (window.scrollY > 40) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
  }
  window.addEventListener("scroll", checkScroll, { passive: true });
  checkScroll();

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

  /* ── What We Do Carousel ──────────────────────────── */
  (function() {
    var wrapper = document.querySelector(".carousel-wrapper");
    var slides = document.querySelectorAll(".carousel-slide");
    var track = document.querySelector(".carousel-slides");
    
    if (!slides.length) return;

    var currentIndex = 0;
    var totalSlides = slides.length;
    var slideInterval = null;
    var isMobile = window.innerWidth <= 900;

    function updateCarousel() {
      slides.forEach(function(slide) {
        slide.classList.remove("is-active");
      });
      slides[currentIndex].classList.add("is-active");
      
      // On mobile: slide the track
      if (isMobile && track) {
        track.style.transform = "translateX(-" + (currentIndex * (100 / 3)) + "%)";
      } else if (!isMobile && track) {
        track.style.transform = "translateX(0)";
      }
    }

    function nextSlide() {
      currentIndex = (currentIndex + 1) % totalSlides;
      updateCarousel();
    }

    function startInterval() {
      if (slideInterval) clearInterval(slideInterval);
      slideInterval = setInterval(nextSlide, 3000);
    }

    // Check for resize (debounced to avoid thrashing on every pixel)
    var resizeTimer;
    window.addEventListener("resize", function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        isMobile = window.innerWidth <= 900;
        updateCarousel();
      }, 150);
    });

    // Start auto-rotate
    startInterval();
    updateCarousel();
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
