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
    var titles  = ["Finance", "Development", "Impact"];

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

  /* ── Pitch Modal ────────────────────────────────── */
  (function () {
    var overlay   = document.getElementById("pitchModalOverlay");
    var closeBtn  = document.getElementById("pitchModalClose");
    var trigger   = document.querySelector(".pitch-trigger");
    var form      = document.getElementById("pitchForm");
    var status    = document.getElementById("pitchFormStatus");
    var submitBtn = document.getElementById("pitchSubmitBtn");
    if (!overlay || !trigger) return;

    var API = "https://admin-staging.capitalasaforce.com/api";

    function openModal()  { overlay.removeAttribute("hidden"); document.body.style.overflow = "hidden"; }
    function closeModal() { overlay.setAttribute("hidden", ""); document.body.style.overflow = ""; }

    trigger.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hasAttribute("hidden")) closeModal();
    });

    // Comma formatting for currency inputs
    function fmtNumber(raw) {
      var digits = raw.replace(/[^0-9]/g, "");
      return digits ? Number(digits).toLocaleString("en-US") : "";
    }
    ["currentTurnover", "fundingRequest"].forEach(function (name) {
      var el = form.querySelector("[name=’" + name + "’]");
      if (!el) return;
      // Block non-digits before the DOM updates (handles keyboard input)
      el.addEventListener("beforeinput", function (e) {
        if (e.data && /[^0-9]/.test(e.data)) e.preventDefault();
      });
      // Strip and reformat after input (handles paste)
      el.addEventListener("input", function () {
        var beforeCursor = this.value.slice(0, this.selectionStart).replace(/[^0-9]/g, "").length;
        var digits = this.value.replace(/[^0-9]/g, "");
        this.value = digits ? Number(digits).toLocaleString("en-US") : "";
        if (digits) {
          var pos = 0, count = 0;
          for (var i = 0; i < this.value.length; i++) {
            if (this.value[i] !== ",") count++;
            if (count === beforeCursor) { pos = i + 1; break; }
          }
          this.setSelectionRange(pos, pos);
        }
      });
    });

    // Full name: strip digits on input
    var nameEl = form.querySelector("[name='fullName']");
    if (nameEl) {
      nameEl.addEventListener("input", function () {
        var pos = this.selectionStart;
        var cleaned = this.value.replace(/[0-9]/g, "");
        if (cleaned !== this.value) {
          this.value = cleaned;
          this.setSelectionRange(pos - 1, pos - 1);
        }
      });
    }

    // Phone: allow only digits, +, -, spaces, parentheses
    var phoneEl = form.querySelector("[name='phone']");
    if (phoneEl) {
      phoneEl.addEventListener("input", function () {
        var pos = this.selectionStart;
        var cleaned = this.value.replace(/[^0-9+\-\s()]/g, "");
        if (cleaned !== this.value) {
          this.value = cleaned;
          this.setSelectionRange(pos - 1, pos - 1);
        }
      });
    }

    // Email: validate format on blur
    var emailEl = form.querySelector("[name='email']");
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailEl) {
      emailEl.addEventListener("blur", function () {
        if (this.value.trim() && !emailRe.test(this.value.trim())) {
          this.setCustomValidity("Please enter a valid email address.");
          this.reportValidity();
        } else {
          this.setCustomValidity("");
        }
      });
      emailEl.addEventListener("input", function () {
        this.setCustomValidity("");
      });
    }

    var successEl  = document.getElementById("pitchSuccess");
    var loadingEl  = document.getElementById("pitchLoading");
    var doneBtnWired = false;

    var modalTitle = document.getElementById("pitchModalTitle");
    var modalSub   = overlay.querySelector(".pitch-modal-sub");

    function hideHeader() {
      if (modalTitle) modalTitle.style.display = "none";
      if (modalSub)   modalSub.style.display   = "none";
    }
    function showHeader() {
      if (modalTitle) modalTitle.style.display = "";
      if (modalSub)   modalSub.style.display   = "";
    }

    function showLoading() {
      form.style.display = "none";
      hideHeader();
      if (loadingEl) loadingEl.removeAttribute("hidden");
    }
    function hideLoading() {
      if (loadingEl) loadingEl.setAttribute("hidden", "");
    }

    function resetModal() {
      form.style.display = "";
      form.reset();
      showHeader();
      hideLoading();
      if (successEl) successEl.setAttribute("hidden", "");
      status.textContent = "";
      status.className = "pitch-form-status";
      submitBtn.disabled = false;
    }

    function showSuccess() {
      hideLoading();
      if (successEl) successEl.removeAttribute("hidden");
      if (!doneBtnWired) {
        doneBtnWired = true;
        document.getElementById("pitchSuccessDone").addEventListener("click", function () {
          closeModal();
          resetModal();
        });
      }
    }

    // Also reset when overlay closes via backdrop/escape
    var _origClose = closeModal;
    closeModal = function () {
      _origClose();
      resetModal();
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(form);

      var requiredNames = ["fullName", "email", "businessName", "dealDescription", "fundingRequest"];
      var incomplete = requiredNames.some(function (n) {
        var v = data.get(n);
        return !v || !v.toString().trim();
      });
      if (incomplete) {
        status.textContent = "Please complete all required fields.";
        status.className = "pitch-form-status error";
        return;
      }
      var emailVal = (data.get("email") || "").toString().trim();
      if (!emailRe.test(emailVal)) {
        status.textContent = "Please enter a valid email address.";
        status.className = "pitch-form-status error";
        return;
      }

      // Strip commas from formatted currency fields before sending
      ["currentTurnover", "fundingRequest"].forEach(function (name) {
        var raw = data.get(name);
        if (raw) data.set(name, raw.toString().replace(/,/g, ""));
      });

      submitBtn.disabled = true;
      showLoading();

      fetch(API + "/pitch-submissions", { method: "POST", body: data })
        .then(function (r) {
          if (!r.ok) throw new Error("Server error " + r.status);
          showSuccess();
        })
        .catch(function () {
          hideLoading();
          form.style.display = "";
          showHeader();
          status.textContent = "Submission failed — please email info@capitalasaforce.com";
          status.className = "pitch-form-status error";
          submitBtn.disabled = false;
        });
    });
  })();

  /* ── Event Speakers Carousel ───────────────────── */
  (function () {
    var track    = document.getElementById("speakersTrack");
    var dotsWrap = document.getElementById("speakersDots");
    if (!track) return;

    var slides   = track.querySelectorAll(".speaker-slide");
    var prevBtn  = document.querySelector(".speakers-prev");
    var nextBtn  = document.querySelector(".speakers-next");
    var total    = slides.length;
    var current  = 0;
    var timer    = null;

    // Build dots
    for (var d = 0; d < total; d++) {
      var dot = document.createElement("button");
      dot.className = "speakers-dot" + (d === 0 ? " is-active" : "");
      dot.setAttribute("aria-label", "Go to slide " + (d + 1));
      dot.dataset.idx = d;
      dotsWrap.appendChild(dot);
    }
    var dots = dotsWrap.querySelectorAll(".speakers-dot");

    function slideWidth() {
      return slides[0].offsetWidth + 20; // 20px matches gap
    }

    function goTo(idx) {
      current = ((idx % total) + total) % total; // wrap around
      track.style.transform = "translateX(-" + (current * slideWidth()) + "px)";
      dots.forEach(function (d, i) { d.classList.toggle("is-active", i === current); });
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
    }

    function startAuto() {
      timer = setInterval(function () { goTo(current + 1); }, 3500);
    }
    function stopAuto() {
      clearInterval(timer);
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { stopAuto(); goTo(current - 1); startAuto(); });
    if (nextBtn) nextBtn.addEventListener("click", function () { stopAuto(); goTo(current + 1); startAuto(); });
    dots.forEach(function (dot) {
      dot.addEventListener("click", function () { stopAuto(); goTo(+this.dataset.idx); startAuto(); });
    });

    // Pause on hover
    track.closest(".speakers-carousel-wrap").addEventListener("mouseenter", stopAuto);
    track.closest(".speakers-carousel-wrap").addEventListener("mouseleave", startAuto);

    // Touch/swipe
    var startX = 0;
    track.addEventListener("touchstart", function (e) { stopAuto(); startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", function (e) {
      var diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) goTo(current + (diff > 0 ? 1 : -1));
      startAuto();
    });

    goTo(0);
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
