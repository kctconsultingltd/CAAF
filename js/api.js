(function () {
  "use strict";

  var API_BASE = window.location.hostname.includes("staging")
    ? "https://admin-staging.capitalasaforce.com/api"
    : "https://admin.capitalasaforce.com/api";

  // ─── Gallery lightbox state ───────────────────────────────────────────────
  var _eventGalleries = {};
  var _galleryImages  = [];
  var _galleryIdx     = 0;
  var GALLERY_MAX_DOTS = 12;

  // Prefer one of Strapi's generated sizes over the full-size original.
  function mediaUrl(media, size) {
    if (!media) return "";
    var f = media.formats && media.formats[size];
    return (f && f.url) || media.url || "";
  }

  function _galleryShowSlide(idx) {
    _galleryIdx = ((idx % _galleryImages.length) + _galleryImages.length) % _galleryImages.length;
    var img     = document.getElementById("galleryImg");
    var counter = document.getElementById("galleryCounter");
    if (img)     img.src = _galleryImages[_galleryIdx];
    if (counter) counter.textContent = (_galleryIdx + 1) + " / " + _galleryImages.length;
    document.querySelectorAll(".gallery-dot").forEach(function (d, i) {
      d.classList.toggle("is-active", i === _galleryIdx);
    });
    if (_galleryImages.length > 1) {
      new Image().src = _galleryImages[(_galleryIdx + 1) % _galleryImages.length];
    }
  }

  window._galleryOpen = function (images) {
    _galleryImages = images;
    var dotsEl = document.getElementById("galleryDots");
    if (dotsEl) {
      dotsEl.innerHTML = images.length > 1 && images.length <= GALLERY_MAX_DOTS ? images.map(function (_, i) {
        return '<button class="gallery-dot" aria-label="Slide ' + (i + 1) + '"></button>';
      }).join("") : "";
      dotsEl.querySelectorAll(".gallery-dot").forEach(function (d, i) {
        d.addEventListener("click", function () { _galleryShowSlide(i); });
      });
    }
    var single = images.length < 2;
    document.querySelectorAll(".gallery-prev, .gallery-next, #galleryCounter").forEach(function (el) { el.hidden = single; });
    _galleryShowSlide(0);
    var lb = document.getElementById("galleryLightbox");
    if (lb) { lb.removeAttribute("hidden"); document.body.style.overflow = "hidden"; }
  };

  window._galleryClose = function () {
    var lb = document.getElementById("galleryLightbox");
    if (lb) { lb.setAttribute("hidden", ""); document.body.style.overflow = ""; }
    _galleryImages = [];
  };

  window._galleryPrev = function () { _galleryShowSlide(_galleryIdx - 1); };
  window._galleryNext = function () { _galleryShowSlide(_galleryIdx + 1); };

  document.addEventListener("keydown", function (e) {
    var lb = document.getElementById("galleryLightbox");
    if (!lb || lb.hidden) return;
    if (e.key === "Escape")     window._galleryClose();
    if (e.key === "ArrowLeft")  window._galleryPrev();
    if (e.key === "ArrowRight") window._galleryNext();
  });

  // A CMS cover that fails to load is removed rather than shown as a broken image.
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.classList.contains("cms-blog-img")) t.remove();
  }, true);

  document.addEventListener("click", function (e) {
    var card = e.target.closest && e.target.closest("[data-gallery-key]");
    if (!card) return;
    var key = card.getAttribute("data-gallery-key");
    if (_eventGalleries[key] && _eventGalleries[key].length) {
      window._galleryOpen(_eventGalleries[key]);
    }
  });

  // ─── Core fetch wrapper ───────────────────────────────────────────────────

  function apiFetch(path, options) {
    var opts = Object.assign(
      { headers: { "Content-Type": "application/json" } },
      options || {},
    );
    return fetch(API_BASE + path, opts).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) {
          var msg =
            json && json.error && json.error.message
              ? json.error.message
              : "Request failed (" + res.status + ")";
          throw new Error(msg);
        }
        return json;
      });
    });
  }

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  function setLoading(el) {
    if (el) el.innerHTML = '<p class="cms-loading">Loading&hellip;</p>';
  }

  function setError(el, msg) {
    if (el) el.innerHTML = '<p class="cms-error">' + escHtml(msg) + "</p>";
  }

  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = "cms-status" + (type ? " cms-status--" + type : "");
  }

  function showConfirmModal(msg, type) {
    var existing = document.getElementById("cms-confirm-modal");
    if (existing) existing.remove();

    var modal = document.createElement("div");
    modal.id = "cms-confirm-modal";
    modal.className =
      "cms-confirm-modal cms-confirm-modal--" + (type || "info");
    modal.innerHTML =
      '<div class="cms-confirm-backdrop"></div>' +
      '<div class="cms-confirm-box">' +
      '<button class="cms-confirm-close" aria-label="Close">&times;</button>' +
      '<p class="cms-confirm-msg">' +
      escHtml(msg) +
      "</p>" +
      "</div>";

    document.body.appendChild(modal);

    var timer;
    function dismiss() {
      clearTimeout(timer);
      modal.classList.remove("cms-confirm--visible");
      setTimeout(function () {
        if (modal.parentNode) modal.remove();
      }, 300);
    }

    modal
      .querySelector(".cms-confirm-close")
      .addEventListener("click", dismiss);
    modal
      .querySelector(".cms-confirm-backdrop")
      .addEventListener("click", dismiss);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        modal.classList.add("cms-confirm--visible");
      });
    });

    timer = setTimeout(dismiss, 5000);
  }

  function formatNumberInput(input) {
    var raw = input.value.replace(/[^0-9]/g, "");
    input.value = raw ? Number(raw).toLocaleString("en-US") : "";
  }

  function parseFormattedNumber(val) {
    var raw = String(val || "").replace(/[^0-9]/g, "");
    return raw ? Number(raw) : null;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── Team Members ─────────────────────────────────────────────────────────
  // Expected container: <div id="cms-team-list"></div>

  function renderTeamMember(member) {
    var imgUrl = member.image && member.image.url ? member.image.url : null;
    var avatar = imgUrl
      ? '<div class="team-avatar"><img src="' +
        escHtml(imgUrl) +
        '" alt="' +
        escHtml(member.name) +
        '" class="team-avatar-img" loading="lazy" /></div>'
      : '<div class="team-avatar"><div class="avatar-ring-2" aria-hidden="true"></div><div class="avatar-ring" aria-hidden="true"></div><span class="avatar-initials">' +
        escHtml(member.name.charAt(0)) +
        "</span></div>";
    var bio = member.bio ? escHtml(member.bio).replace(/\n/g, "<br>") : "";
    return (
      '<div class="team-card cms-team-card" data-id="' +
      escHtml(member.documentId) +
      '">' +
      avatar +
      '<div class="team-info">' +
      '<div class="team-name">' +
      escHtml(member.name) +
      "</div>" +
      '<div class="team-role">' +
      escHtml(member.role) +
      "</div>" +
      (bio
        ? '<div class="team-bio"><p class="bio-text">' +
          bio +
          "</p>" +
          '<button class="see-more-btn">See more</button></div>'
        : "") +
      "</div>" +
      "</div>"
    );
  }

  function loadTeamMembers() {
    var el = document.getElementById("cms-team-list");
    if (!el) return;
    setLoading(el);
    apiFetch("/team-members?populate=image&sort=order:asc")
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) {
          el.innerHTML = "";
          return;
        }
        el.innerHTML = items.map(renderTeamMember).join("");
        // Wire up see-more toggles for dynamically added bios
        el.querySelectorAll(".see-more-btn").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var bioText = btn.previousElementSibling;
            if (!bioText) return;
            var expanded = bioText.classList.toggle("expanded");
            btn.textContent = expanded ? "See less" : "See more";
          });
        });

        // Equalize card heights so buttons stay aligned while expansion only affects the clicked card
        var cards = Array.from(el.querySelectorAll(".cms-team-card"));
        if (cards.length > 1) {
          var maxH = Math.max.apply(
            null,
            cards.map(function (c) {
              return c.offsetHeight;
            }),
          );
          cards.forEach(function (c) {
            c.style.minHeight = maxH + "px";
          });
        }
      })
      .catch(function () {
        el.innerHTML = "";
      });
  }

  // ─── Featured Deals ───────────────────────────────────────────────────────
  // Expected container: <div id="cms-featured-deals"></div> inside <section id="deals" hidden>

  var _featuredDeals = [];

  function dealImage(deal) {
    return deal.image && deal.image.url ? deal.image.url : "";
  }

  function renderFeaturedDeal(deal, idx) {
    var imgSrc = dealImage(deal);
    return (
      '<div class="cms-blog-card deal-card" data-deal-idx="' + idx + '" role="button" tabindex="0" aria-label="View details: ' + escHtml(deal.title) + '">' +
      '<span class="deal-expand" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></span>' +
      (imgSrc
        ? '<img src="' + escHtml(imgSrc) + '" alt="' + escHtml(deal.title) + '" class="cms-blog-img" loading="lazy" />'
        : "") +
      (deal.dealType ? '<span class="deal-type">' + escHtml(deal.dealType) + "</span>" : "") +
      '<span class="cms-blog-title">' + escHtml(deal.title) + "</span>" +
      (deal.amount ? '<div class="deal-amount">' + escHtml(deal.amount) + "</div>" : "") +
      (deal.description ? '<p class="cms-blog-desc deal-desc">' + escHtml(deal.description) + "</p>" : "") +
      '<div class="deal-cta-wrap"><a class="btn-gold deal-cta" href="#contact">Engage <span class="arrow" aria-hidden="true">&rarr;</span></a></div>' +
      "</div>"
    );
  }

  function openDealModal(deal) {
    if (document.getElementById("deal-modal-overlay")) return;
    var opener = document.activeElement;
    var imgSrc = dealImage(deal);
    var desc = deal.description ? escHtml(deal.description).replace(/\n/g, "<br>") : "";

    var overlay = document.createElement("div");
    overlay.id = "deal-modal-overlay";
    overlay.innerHTML =
      '<div id="deal-modal" role="dialog" aria-modal="true" aria-label="' + escHtml(deal.title) + '">' +
      '<button id="deal-modal-close" aria-label="Close">&times;</button>' +
      '<div class="deal-modal-scroll">' +
      (imgSrc ? '<img src="' + escHtml(imgSrc) + '" alt="' + escHtml(deal.title) + '" class="deal-modal-img" />' : "") +
      '<div class="deal-modal-body">' +
      (deal.dealType ? '<div class="deal-modal-meta"><span class="deal-type">' + escHtml(deal.dealType) + "</span></div>" : "") +
      '<h2 class="deal-modal-title">' + escHtml(deal.title) + "</h2>" +
      (deal.amount ? '<div class="deal-modal-amount">' + escHtml(deal.amount) + "</div>" : "") +
      (desc ? '<p class="deal-modal-desc">' + desc + "</p>" : "") +
      '<a class="btn-gold deal-modal-cta" href="#contact">Engage <span class="arrow" aria-hidden="true">&rarr;</span></a>' +
      "</div></div></div>";

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    function close() {
      overlay.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onEsc);
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    }
    function onEsc(e) {
      if (e.key === "Escape") close();
    }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector("#deal-modal-close").addEventListener("click", close);
    overlay.querySelector(".deal-modal-cta").addEventListener("click", function (e) {
      e.preventDefault();
      close();
      var contact = document.getElementById("contact");
      if (contact) contact.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.addEventListener("keydown", onEsc);
    overlay.querySelector("#deal-modal-close").focus();
  }

  function loadFeaturedDeals() {
    var el = document.getElementById("cms-featured-deals");
    var section = document.getElementById("deals");
    if (!el || !section) return;
    apiFetch("/featured-deals?populate=image&sort=order:asc")
      .then(function (json) {
        _featuredDeals = json.data || [];
        if (!_featuredDeals.length) return;
        el.innerHTML = _featuredDeals.map(renderFeaturedDeal).join("");
        section.hidden = false;
      })
      .catch(function () {});

    function openFromCard(card) {
      var deal = _featuredDeals[+card.getAttribute("data-deal-idx")];
      if (deal) openDealModal(deal);
    }
    el.addEventListener("click", function (e) {
      if (e.target.closest("a")) return; // Engage goes straight to Get in Touch
      var card = e.target.closest(".deal-card");
      if (card) openFromCard(card);
    });
    el.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("deal-card")) {
        e.preventDefault();
        openFromCard(e.target);
      }
    });
  }

  // ─── Blog Links ───────────────────────────────────────────────────────────
  // Expected container: <div id="cms-blog-list"></div>

  function renderBlogLink(link) {
    var imgSrc =
      (link.coverImage && link.coverImage.url) || link.coverImageUrl || "";
    var imgHtml = imgSrc
      ? '<img src="' +
        escHtml(imgSrc) +
        '" alt="' +
        escHtml(link.title) +
        '" class="cms-blog-img" loading="lazy" />'
      : "";
    return (
      '<a href="' +
      escHtml(link.url) +
      '" target="_blank" rel="noopener noreferrer" ' +
      'class="cms-blog-card" data-id="' +
      escHtml(link.documentId) +
      '">' +
      imgHtml +
      '<span class="cms-blog-title">' +
      escHtml(link.title) +
      "</span>" +
      (link.description
        ? '<p class="cms-blog-desc">' + escHtml(link.description) + "</p>"
        : "") +
      "</a>"
    );
  }

  function sortByPostDateDesc(items) {
    items.sort(function (a, b) {
      var da = a.postDate ? new Date(a.postDate).getTime() : -Infinity;
      var db = b.postDate ? new Date(b.postDate).getTime() : -Infinity;
      return db - da;
    });
  }

  function loadBlogLinks() {
    var el = document.getElementById("cms-blog-list");
    if (!el) return;
    setLoading(el);
    apiFetch("/blog-links?populate=coverImage&fields[0]=title&fields[1]=url&fields[2]=description&fields[3]=postDate&fields[4]=coverImageUrl&sort=postDate:desc&pagination[pageSize]=100")
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) {
          el.innerHTML = "";
          return;
        }
        sortByPostDateDesc(items);
        var rotateIndex = 0;
        function renderWindow() {
          var window = [];
          for (var i = 0; i < 3 && i < items.length; i++) {
            window.push(items[(rotateIndex + i) % items.length]);
          }
          el.innerHTML = window.map(renderBlogLink).join("");
        }
        renderWindow();
        if (items.length > 3) {
          var wrap = document.getElementById("cms-blog-more-wrap");
          if (wrap) wrap.hidden = false;
          setInterval(function () {
            el.style.opacity = "0";
            setTimeout(function () {
              rotateIndex = (rotateIndex + 1) % items.length;
              renderWindow();
              el.style.opacity = "1";
            }, 300);
          }, 8000);
        }
      })
      .catch(function () {
        el.innerHTML = "";
      });
  }

  function loadBlogPage() {
    var el = document.getElementById("cms-blog-page-list");
    if (!el) return;
    setLoading(el);
    apiFetch("/blog-links?populate=coverImage&fields[0]=title&fields[1]=url&fields[2]=description&fields[3]=postDate&fields[4]=coverImageUrl&sort=postDate:desc&pagination[pageSize]=100")
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) {
          el.innerHTML = "<p style=\"color:var(--muted)\">No posts yet.</p>";
          return;
        }
        sortByPostDateDesc(items);
        el.innerHTML = items.map(renderBlogLink).join("");
      })
      .catch(function () {
        el.innerHTML = "";
      });
  }

  // ─── Deals & Investor Interest (commented out — not live yet) ────────────
  /*

  function renderDeal(deal, opts) {
    var preview = opts && opts.previewMode;
    var card =
      '<div class="cms-deal-card" data-id="' +
      escHtml(deal.documentId) +
      '">' +
      '<div class="cms-deal-header">' +
      '<h3 class="cms-deal-name">' +
      escHtml(deal.businessName) +
      "</h3>" +
      '<span class="cms-deal-industry">' +
      escHtml(deal.industry) +
      "</span>" +
      "</div>" +
      (deal.fundingRequired != null
        ? '<p class="cms-deal-funding">Funding Required: $' +
          Number(deal.fundingRequired).toLocaleString() +
          "</p>"
        : "") +
      (deal.description
        ? '<p class="cms-deal-desc">' + escHtml(deal.description) + "</p>"
        : "") +
      (preview
        ? ""
        : '<button class="btn-gold cms-invest-btn" ' +
          'data-deal-id="' +
          escHtml(deal.documentId) +
          '" ' +
          'data-deal-name="' +
          escHtml(deal.businessName) +
          '">' +
          "Express Interest" +
          "</button>") +
      "</div>";
    return card;
  }

  // ─── Index.html: rotating 3-card preview ─────────────────────────────────

  var _previewPool = [];
  var _previewTimer = null;

  function pickPreviewDeals() {
    var el = document.getElementById("cms-deals-preview");
    if (!el || !_previewPool.length) return;
    var shuffled = _previewPool.slice().sort(function () { return Math.random() - 0.5; });
    var three = shuffled.slice(0, Math.min(3, shuffled.length));
    el.style.opacity = "0";
    setTimeout(function () {
      el.innerHTML = three.map(function (d) { return renderDeal(d, { previewMode: true }); }).join("");
      el.style.opacity = "1";
    }, 300);
  }

  function loadDealsPreview() {
    var el = document.getElementById("cms-deals-preview");
    if (!el) return;
    setLoading(el);
    apiFetch("/deals?filters[reviewStatus]=approved&pagination[pageSize]=50")
      .then(function (json) {
        _previewPool = json.data || [];
        if (!_previewPool.length) { el.innerHTML = ""; return; }
        pickPreviewDeals();
        if (_previewTimer) clearInterval(_previewTimer);
        _previewTimer = setInterval(pickPreviewDeals, 30000);
      })
      .catch(function () { el.innerHTML = ""; });
  }

  // ─── Deals.html: paginated list with industry filter ──────────────────────

  var _dealsPage = 1;
  var _dealsTotalPages = 1;
  var _dealsIndustry = "";

  function loadDealsPage(reset) {
    var el = document.getElementById("cms-deals-list");
    var loadMoreBtn = document.getElementById("deals-load-more");
    var countEl = document.getElementById("deals-result-count");
    if (!el) return;

    if (reset) {
      _dealsPage = 1;
      var filterSelect = document.getElementById("deals-industry-filter");
      _dealsIndustry = filterSelect ? filterSelect.value : "";
      setLoading(el);
    }

    var qs =
      "/deals?filters[reviewStatus]=approved" +
      "&pagination[page]=" +
      _dealsPage +
      "&pagination[pageSize]=9";
    if (_dealsIndustry)
      qs += "&filters[industry][$eq]=" + encodeURIComponent(_dealsIndustry);

    apiFetch(qs)
      .then(function (json) {
        var items = json.data || [];
        var meta = json.meta && json.meta.pagination;
        _dealsTotalPages = meta ? meta.pageCount : 1;

        if (reset) el.innerHTML = "";

        if (!items.length && reset) {
          el.innerHTML = '<p style="color:var(--muted)">No deals found.</p>';
          if (loadMoreBtn) loadMoreBtn.hidden = true;
          if (countEl) countEl.textContent = "";
          return;
        }

        el.insertAdjacentHTML(
          "beforeend",
          items
            .map(function (d) {
              return renderDeal(d);
            })
            .join(""),
        );

        el.querySelectorAll(".cms-invest-btn:not([data-wired])").forEach(
          function (btn) {
            btn.dataset.wired = "1";
            btn.addEventListener("click", function () {
              openInvestorForm(btn.dataset.dealId, btn.dataset.dealName);
            });
          },
        );

        if (countEl && meta) {
          countEl.textContent =
            meta.total + " deal" + (meta.total !== 1 ? "s" : "");
        }
        if (loadMoreBtn) loadMoreBtn.hidden = _dealsPage >= _dealsTotalPages;
      })
      .catch(function () {
        if (reset) el.innerHTML = '<p style="color:var(--muted)">No deals available at this time.</p>';
      });
  }

  function loadIndustryFilter() {
    apiFetch(
      "/deals?filters[reviewStatus]=approved&fields[0]=industry&pagination[pageSize]=200",
    ).then(function (json) {
      var seen = {};
      (json.data || []).forEach(function (d) {
        if (d.industry) seen[d.industry] = 1;
      });
      var select = document.getElementById("deals-industry-filter");
      if (!select) return;
      Object.keys(seen)
        .sort()
        .forEach(function (ind) {
          var opt = document.createElement("option");
          opt.value = ind;
          opt.textContent = ind;
          select.appendChild(opt);
        });
    });
  }

  // ─── Deal Submission Form ─────────────────────────────────────────────────
  // Expected form:  <form id="cms-deal-form"> ... </form>
  // Required inputs (name attr): businessName, industry, contactEmail, description
  // Optional inputs (name attr): revenue, fundingNeeded

  function handleDealSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var btn = form.querySelector('[type="submit"]');
    var originalLabel = btn ? btn.textContent : "";

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting…";
    }

    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var contactEmail = form.contactEmail.value.trim();
    var description = form.description && form.description.value.trim();

    if (!contactEmail || !emailRe.test(contactEmail)) {
      showConfirmModal("Please enter a valid email address.", "error");
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
      return;
    }
    if (!description) {
      showConfirmModal("Please provide a business description.", "error");
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
      return;
    }

    var phoneCode = form.phoneCode ? form.phoneCode.value : "";
    var phoneNum = form.phone ? form.phone.value.trim() : "";
    var body = {
      businessName: form.businessName.value.trim(),
      industry: form.industry.value.trim(),
      contactEmail: contactEmail,
      phone: phoneNum ? phoneCode + " " + phoneNum : null,
      revenue: parseFormattedNumber(form.revenue && form.revenue.value),
      fundingNeeded: parseFormattedNumber(
        form.fundingNeeded && form.fundingNeeded.value,
      ),
      description: description,
    };

    apiFetch("/deal-submissions", {
      method: "POST",
      body: JSON.stringify(body),
    })
      .then(function (json) {
        showConfirmModal(json.message || "Submission received.", "success");
        form.reset();
        var biz = body.businessName;
        var lines = [
          "Business: " + biz,
          "Industry: " + body.industry,
          "Contact: " + body.contactEmail,
          body.phone ? "Phone: " + body.phone : null,
          body.revenue != null
            ? "Revenue: $" + Number(body.revenue).toLocaleString()
            : null,
          body.fundingNeeded != null
            ? "Funding Required: $" +
              Number(body.fundingNeeded).toLocaleString()
            : null,
          body.description ? "\nDescription:\n" + body.description : null,
        ]
          .filter(Boolean)
          .join("\n");
        sendEmail(
          "New Deal Submission: " + biz,
          "A new deal submission has been received.\n\n" + lines + "\n\nLog in to the admin panel to review."
        );
      })
      .catch(function (err) {
        showConfirmModal(err.message, "error");
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalLabel;
        }
      });
  }

  // ─── Investor Interest Modal ──────────────────────────────────────────────
  // Expected modal:      <div id="investor-modal"> ... </div>
  // Expected deal label: <span id="cms-investor-deal-name"></span>
  // Expected form:       <form id="cms-investor-form"> ... </form>
  // Required inputs (name attr): investorName, email, dealId (hidden)
  // Optional inputs (name attr): phone, investmentRange, notes

  function closeInvestorModal() {
    var modal = document.getElementById("investor-modal");
    if (!modal) return;
    modal.classList.remove("investor-modal--open");
    setTimeout(function () {
      modal.hidden = true;
    }, 280);
    document.body.style.overflow = "";
  }

  function openInvestorForm(dealId, dealName) {
    var modal = document.getElementById("investor-modal");
    var form = document.getElementById("cms-investor-form");
    if (!modal || !form) return;

    var dealIdInput = form.querySelector('[name="dealId"]');
    var dealNameSpan = document.getElementById("cms-investor-deal-name");

    form.reset();
    if (dealIdInput) dealIdInput.value = dealId;
    if (dealNameSpan) dealNameSpan.textContent = dealName;

    modal.hidden = false;
    requestAnimationFrame(function () {
      modal.classList.add("investor-modal--open");
    });
    document.body.style.overflow = "hidden";

    // Focus first input for accessibility
    var firstInput = form.querySelector('input:not([type="hidden"])');
    if (firstInput)
      setTimeout(function () {
        firstInput.focus();
      }, 50);
  }

  function handleInvestorSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var btn = form.querySelector('[type="submit"]');
    var originalLabel = btn ? btn.textContent : "";

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting…";
    }

    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var email = form.email.value.trim();
    if (!email || !emailRe.test(email)) {
      showConfirmModal("Please enter a valid email address.", "error");
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
      return;
    }

    var phoneCode = form.phoneCode ? form.phoneCode.value : "";
    var phoneNum = form.phone ? form.phone.value.trim() : "";
    var body = {
      investorName: form.investorName.value.trim(),
      email: email,
      phone: phoneNum ? phoneCode + " " + phoneNum : null,
      dealId: form.dealId.value,
      investmentRange:
        (form.investmentRange && form.investmentRange.value.trim()) || null,
      notes: (form.notes && form.notes.value.trim()) || null,
    };

    apiFetch("/investor-interests", {
      method: "POST",
      body: JSON.stringify(body),
    })
      .then(function (json) {
        showConfirmModal(json.message || "Interest submitted.", "success");
        form.reset();
        closeInvestorModal();
        var inv = body.investorName;
        var dealName = document.getElementById("cms-investor-deal-name");
        var deal = dealName ? dealName.textContent : body.dealId;
        var lines = [
          "Investor: " + inv,
          "Email: " + body.email,
          body.phone ? "Phone: " + body.phone : null,
          "Deal: " + deal,
          body.investmentRange
            ? "Investment Range: " + body.investmentRange
            : null,
          body.notes ? "\nNotes:\n" + body.notes : null,
        ]
          .filter(Boolean)
          .join("\n");
        sendEmail(
          "New Investor Interest: " + inv + " → " + deal,
          "A new investor has expressed interest.\n\n" + lines + "\n\nLog in to the admin panel to review."
        );
      })
      .catch(function (err) {
        showConfirmModal(err.message, "error");
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalLabel;
        }
      });
  }

  */ // end deals & investor interest

  // ─── Events ───────────────────────────────────────────────────────────────

  function formatEventDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url || "");
  }

  function renderEvent(evt) {
    var imgSrc = mediaUrl(evt.coverImage, "medium") || evt.coverImageUrl || "";
    var imgHtml = imgSrc
      ? '<img src="' + escHtml(imgSrc) + '" alt="' + escHtml(evt.title) + '" class="cms-blog-img" loading="lazy" />'
      : "";
    var dateText = evt.dateLabel || formatEventDate(evt.eventDate);
    var dateHtml = dateText
      ? '<span class="cms-events-date">' + escHtml(dateText) + "</span>"
      : "";
    var locationHtml = evt.location
      ? '<span class="cms-events-location">' + escHtml(evt.location) + "</span>"
      : "";
    var descHtml = evt.description
      ? '<p class="cms-blog-desc">' + escHtml(evt.description) + "</p>"
      : "";

    var galleryImages = (evt.gallery || []).map(function (img) { return mediaUrl(img, "large"); }).filter(Boolean);
    var cta = "View photos →";
    // An event whose link is just its poster image opens the poster in the
    // lightbox instead of navigating to a raw image file.
    if (!galleryImages.length && isImageUrl(evt.url)) {
      galleryImages = [mediaUrl(evt.coverImage, "large") || evt.url];
      cta = "View poster →";
    }

    var inner = imgHtml + dateHtml +
      '<span class="cms-blog-title">' + escHtml(evt.title) + "</span>" +
      descHtml + locationHtml;

    if (galleryImages.length > 0) {
      var key = evt.documentId || String(evt.id);
      _eventGalleries[key] = galleryImages;
      return '<div class="cms-blog-card event-has-gallery" data-gallery-key="' + escHtml(key) + '">' +
        inner +
        '<span class="gallery-cta">' + cta + "</span>" +
        "</div>";
    }

    return '<a href="' + escHtml(evt.url || "#") + '" target="_blank" rel="noopener noreferrer" class="cms-blog-card">' +
      inner + "</a>";
  }

  function loadEventsPage() {
    var el = document.getElementById("cms-events-page-list");
    if (!el) return;
    var pastEl = document.getElementById("cms-events-past-list");
    apiFetch(
      "/events?populate[0]=coverImage&populate[1]=gallery" +
        "&fields[0]=title&fields[1]=url&fields[2]=description" +
        "&fields[3]=eventDate&fields[4]=location&fields[5]=coverImageUrl&fields[6]=dateLabel" +
        "&sort=eventDate:asc&pagination[pageSize]=100"
    )
      .then(function (json) {
        var items = json.data || [];
        var now = Date.now();
        // Upcoming: a future date, or a month/year-only event (dateLabel, no fixed date)
        function isUpcoming(e) {
          if (e.eventDate) return new Date(e.eventDate).getTime() > now;
          return !!e.dateLabel;
        }
        var upcoming = items.filter(isUpcoming);
        var past = items.filter(function (e) { return !isUpcoming(e); });
        // Dated events first (soonest first); month/year-only events after them
        upcoming.sort(function (a, b) {
          var ta = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
          var tb = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
          return ta - tb;
        });
        past.sort(function (a, b) {
          return (
            new Date(b.eventDate || 0).getTime() -
            new Date(a.eventDate || 0).getTime()
          );
        });
        el.innerHTML = upcoming.length
          ? upcoming.map(renderEvent).join("")
          : '<p style="color:var(--muted)">No upcoming events at this time.</p>';
        if (pastEl) {
          pastEl.innerHTML = past.length
            ? past.map(renderEvent).join("")
            : '<p style="color:var(--muted)">No past events.</p>';
        }
      })
      .catch(function () {
        el.innerHTML =
          '<p style="color:var(--muted)">Could not load events.</p>';
      });
  }

  function loadEventModal() {
    if (!document.querySelector(".hero")) return;
    var now = new Date().toISOString();
    apiFetch(
      "/events?filters[eventDate][$gt]=" +
        encodeURIComponent(now) +
        "&sort=eventDate:asc&pagination[pageSize]=1&populate=coverImage" +
        "&fields[0]=title&fields[1]=description&fields[2]=eventDate" +
        "&fields[3]=location&fields[4]=url&fields[5]=coverImageUrl&fields[6]=dateLabel"
    )
      .then(function (json) {
        var events = json.data || [];
        if (!events.length) return;
        var evt = events[0];

        var imgSrc =
          (evt.coverImage && evt.coverImage.url) || evt.coverImageUrl || "";
        var meta = evt.dateLabel || formatEventDate(evt.eventDate);
        if (evt.location) meta += " · " + evt.location;

        var overlay = document.createElement("div");
        overlay.id = "event-modal-overlay";
        overlay.innerHTML =
          '<div id="event-modal">' +
          '<button id="event-modal-close" aria-label="Close">&times;</button>' +
          (imgSrc
            ? '<img src="' +
              escHtml(imgSrc) +
              '" alt="' +
              escHtml(evt.title) +
              '" />'
            : "") +
          '<div class="event-modal-body">' +
          '<p class="event-modal-label">Upcoming Event</p>' +
          '<h2 class="event-modal-title">' +
          escHtml(evt.title) +
          "</h2>" +
          (meta
            ? '<p class="event-modal-meta">' + escHtml(meta) + "</p>"
            : "") +
          '<a href="' +
          escHtml(evt.url) +
          '" target="_blank" rel="noopener noreferrer" class="btn-gold">' +
          'Register <span class="arrow" aria-hidden="true">&rarr;</span></a>' +
          "</div></div>";

        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";

        // Size modal width to match image aspect ratio so no black bars appear
        var modalImg = overlay.querySelector("img");
        if (modalImg) {
          function sizeModal() {
            var modal = document.getElementById("event-modal");
            var body = modal.querySelector(".event-modal-body");
            var bodyH = body ? body.offsetHeight : 0;
            var availH = window.innerHeight * 0.8 - bodyH;
            if (availH > 0 && modalImg.naturalHeight > 0) {
              var ratio = modalImg.naturalWidth / modalImg.naturalHeight;
              var ideal = Math.round(availH * ratio);
              var max = Math.round(window.innerWidth * 0.92);
              modal.style.width = Math.min(ideal, max) + "px";
            }
          }
          if (modalImg.complete && modalImg.naturalWidth) {
            sizeModal();
          } else {
            modalImg.addEventListener("load", sizeModal);
          }
        }

        function closeModal() {
          overlay.remove();
          document.body.style.overflow = "";
          document.removeEventListener("keydown", onEsc);
        }
        function onEsc(e) {
          if (e.key === "Escape") closeModal();
        }

        overlay.addEventListener("click", function (e) {
          if (e.target === overlay) closeModal();
        });
        overlay
          .querySelector("#event-modal-close")
          .addEventListener("click", closeModal);
        document.addEventListener("keydown", onEsc);
      })
      .catch(function () {});
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", function () {
    loadTeamMembers();
    loadFeaturedDeals();
    loadBlogLinks();
    loadBlogPage();
    loadEventsPage();
    loadEventModal();
  });
})();
