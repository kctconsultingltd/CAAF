(function () {
  "use strict";

  var API_BASE = "https://caaf20-production.up.railway.app/api";

  // ─── EmailJS config ───────────────────────────────────────────────────────
  // "To Email" is hardcoded in the EmailJS template dashboard — no variable needed here
  var EJS_SERVICE_ID = "service_loo2y5r";
  var EJS_TEMPLATE_ID = "template_5n5bpht";
  var EJS_PUBLIC_KEY = "7X7DzX8YFDbXSdnyo";

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

  function sendEmail(subject, message) {
    if (typeof window.emailjs === "undefined" || EJS_PUBLIC_KEY === "YOUR_PUBLIC_KEY") return;
    window.emailjs
      .send(EJS_SERVICE_ID, EJS_TEMPLATE_ID, { subject: subject, message: message })
      .then(function () { console.log("[emailjs] sent: " + subject); })
      .catch(function (err) { console.error("[emailjs] failed:", err); });
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
        '" class="team-avatar-img" /></div>'
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
    apiFetch("/team-members?populate=image")
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
      .catch(function (err) {
        setError(el, "Could not load team members: " + err.message);
      });
  }

  // ─── Blog Links ───────────────────────────────────────────────────────────
  // Expected container: <div id="cms-blog-list"></div>

  function renderBlogLink(link) {
    return (
      '<a href="' +
      escHtml(link.url) +
      '" target="_blank" rel="noopener noreferrer" ' +
      'class="cms-blog-card" data-id="' +
      escHtml(link.documentId) +
      '">' +
      '<span class="cms-blog-title">' +
      escHtml(link.title) +
      "</span>" +
      (link.description
        ? '<p class="cms-blog-desc">' + escHtml(link.description) + "</p>"
        : "") +
      "</a>"
    );
  }

  function loadBlogLinks() {
    var el = document.getElementById("cms-blog-list");
    if (!el) return;
    setLoading(el);
    apiFetch("/blog-links")
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) {
          el.innerHTML = "<p>No blog posts found.</p>";
          return;
        }
        el.innerHTML = items.map(renderBlogLink).join("");
      })
      .catch(function (err) {
        setError(el, "Could not load blog posts: " + err.message);
      });
  }

  // ─── Deals ────────────────────────────────────────────────────────────────
  // Preview container (index.html): <div id="cms-deals-preview"></div>
  // Full page container (deals.html): <div id="cms-deals-list"></div>

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
      .catch(function (err) { setError(el, "Could not load deals: " + err.message); });
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
      .catch(function (err) {
        setError(el, "Could not load deals: " + err.message);
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

  // ─── SVG icon map for feature-card and client-type iconName fields ───────
  var ICON_MAP = {
    "field-expertise": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2e9cf5" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12"/></svg>',
    "frameworks": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8962a" stroke-width="2" stroke-linecap="round"><path d="M2 20h20M5 20V10l7-7 7 7v10"/><path d="M9 20v-6h6v6"/></svg>',
    "catalytic-capital": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5cb8e4" stroke-width="2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
    "fund-managers": '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8962a" stroke-width="1.8" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 4 5-8"/></svg>',
    "foundations": '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8962a" stroke-width="1.8" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    "donors": '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8962a" stroke-width="1.8" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>',
    "development-partners": '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8962a" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>',
    "dfi": '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8962a" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
    "private-capital": '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8962a" stroke-width="1.8" stroke-linecap="round"><path d="M12 1v4M12 19v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M1 12h4M19 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>'
  };

  function getIcon(iconName, fallback) {
    return ICON_MAP[iconName] || fallback || '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8962a" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>';
  }

  // ─── Site Config ──────────────────────────────────────────────────────────

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  function loadSiteConfig() {
    apiFetch("/site-config?populate=clientsFeatureImage,visionMissionImage")
      .then(function (json) {
        var d = json.data;
        if (!d) return;

        setText("cms-hero-tag", d.heroTag);
        setText("cms-hero-headline", d.heroHeadline);
        setText("cms-hero-subheading", d.heroSubheading);
        setText("cms-theory-of-change", d.theoryOfChange);
        setText("cms-vision-text", d.visionText);
        setText("cms-mission-text", d.missionText);
        setText("cms-problem-quote", d.problemQuote ? "“" + d.problemQuote + "”" : null);
        setText("cms-core-belief", d.coreBelief);
        setText("cms-footer-description", d.footerDescription);

        if (d.aboutHeading) setText("cms-about-heading", d.aboutHeading);

        if (d.aboutBody) {
          var bodyEl = document.getElementById("cms-about-body");
          if (bodyEl) {
            var paras = d.aboutBody.split(/\n\n+/);
            var theoryBox = bodyEl.querySelector(".theory-box");
            bodyEl.querySelectorAll("p").forEach(function (p) { p.remove(); });
            paras.forEach(function (para) {
              var p = document.createElement("p");
              p.textContent = para.trim();
              bodyEl.insertBefore(p, theoryBox);
            });
          }
        }

        if (d.heroVideoUrl) {
          var vid = document.getElementById("cms-hero-video");
          if (vid) {
            var src = vid.querySelector("source");
            if (src) src.setAttribute("src", d.heroVideoUrl);
            vid.load();
          }
        }

        if (d.contactEmail) {
          var emailEl = document.getElementById("cms-contact-email");
          if (emailEl) {
            emailEl.innerHTML = '<a href="mailto:' + escHtml(d.contactEmail) + '" style="color:inherit;text-decoration:underline;">' + escHtml(d.contactEmail) + "</a>";
          }
        }

        if (d.contactAddress) {
          var addrEl = document.getElementById("cms-contact-address");
          if (addrEl) {
            addrEl.innerHTML = escHtml(d.contactAddress).replace(/\n/g, "<br>");
          }
        }

        var clientsImg = d.clientsFeatureImage && d.clientsFeatureImage.url;
        if (clientsImg) {
          var el = document.getElementById("cms-clients-feature-image");
          if (el) el.src = clientsImg;
        }

        var vmImg = d.visionMissionImage && d.visionMissionImage.url;
        if (vmImg) {
          var el2 = document.getElementById("cms-vm-image");
          if (el2) el2.src = vmImg;
        }
      })
      .catch(function () {});
  }

  // ─── Services ─────────────────────────────────────────────────────────────

  function loadServices() {
    var el = document.getElementById("cms-services-list");
    if (!el) return;
    apiFetch("/services?sort=order:asc")
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) return;
        el.innerHTML = items.map(function (s, i) {
          var num = String(i + 1).padStart(2, "0");
          return '<div class="srv-cell reveal">' +
            '<div class="srv-num">' + escHtml(num) + "</div>" +
            '<div class="srv-title">' + escHtml(s.title) + "</div>" +
            (s.description ? '<div class="srv-desc">' + escHtml(s.description) + "</div>" : "") +
            "</div>";
        }).join("");
      })
      .catch(function () {});
  }

  // ─── Carousel Slides ──────────────────────────────────────────────────────

  function loadCarouselSlides() {
    var el = document.getElementById("cms-carousel-slides");
    if (!el) return;
    apiFetch("/carousel-slides?sort=order:asc&populate=image")
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) return;
        el.innerHTML = items.map(function (s, i) {
          var imgUrl = s.image && s.image.url ? s.image.url : "";
          return '<div class="carousel-slide' + (i === 0 ? " is-active" : "") + '">' +
            (imgUrl ? '<img src="' + escHtml(imgUrl) + '" alt="' + escHtml(s.title) + '">' : "") +
            '<div class="slide-overlay">' +
            "<h3>" + escHtml(s.title) + "</h3>" +
            (s.description ? "<p>" + escHtml(s.description) + "</p>" : "") +
            "</div></div>";
        }).join("");
        // Re-init carousel state after replacing slides
        if (typeof window._carouselInit === "function") window._carouselInit();
      })
      .catch(function () {});
  }

  // ─── Client Types ─────────────────────────────────────────────────────────

  function loadClientTypes() {
    var el = document.getElementById("cms-clients-grid");
    if (!el) return;
    apiFetch("/client-types?sort=order:asc")
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) return;
        el.innerHTML = items.map(function (c) {
          return '<div class="serve-card reveal">' +
            '<div class="serve-badge" aria-hidden="true">' + getIcon(c.iconName) + "</div>" +
            '<div class="serve-name">' + escHtml(c.title) + "</div>" +
            "</div>";
        }).join("");
      })
      .catch(function () {});
  }

  // ─── Feature Cards ────────────────────────────────────────────────────────

  function loadFeatureCards() {
    var el = document.getElementById("cms-feature-cards");
    if (!el) return;
    apiFetch("/feature-cards?sort=order:asc")
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) return;
        el.innerHTML = items.map(function (f) {
          return '<div class="feat-card">' +
            '<div class="feat-icon">' + getIcon(f.iconName) + "</div>" +
            "<div>" +
            '<div class="feat-title">' + escHtml(f.title) + "</div>" +
            (f.description ? '<div class="feat-desc">' + escHtml(f.description) + "</div>" : "") +
            "</div></div>";
        }).join("");
      })
      .catch(function () {});
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof window.emailjs !== "undefined" && EJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
      window.emailjs.init({ publicKey: EJS_PUBLIC_KEY });
    }

    loadSiteConfig();
    loadServices();
    loadCarouselSlides();
    loadClientTypes();
    loadFeatureCards();
    loadTeamMembers();
    loadBlogLinks();

    // index.html: 3-card preview
    if (document.getElementById("cms-deals-preview")) {
      loadDealsPreview();
    }

    // deals.html: paginated full list
    if (document.getElementById("cms-deals-list")) {
      loadIndustryFilter();
      loadDealsPage(true);

      var loadMoreBtn = document.getElementById("deals-load-more");
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", function () {
          _dealsPage++;
          loadDealsPage(false);
        });
      }

      var filterSelect = document.getElementById("deals-industry-filter");
      if (filterSelect) {
        filterSelect.addEventListener("change", function () {
          loadDealsPage(true);
        });
      }
    }

    var dealForm = document.getElementById("cms-deal-form");
    var investorForm = document.getElementById("cms-investor-form");
    if (dealForm) dealForm.addEventListener("submit", handleDealSubmit);
    if (investorForm)
      investorForm.addEventListener("submit", handleInvestorSubmit);

    // Modal: close button, backdrop click, Escape key
    var investorModal = document.getElementById("investor-modal");
    if (investorModal) {
      investorModal
        .querySelector(".investor-modal-close")
        .addEventListener("click", closeInvestorModal);
      investorModal
        .querySelector(".investor-modal-backdrop")
        .addEventListener("click", closeInvestorModal);
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !investorModal.hidden) closeInvestorModal();
      });
    }

    // Number formatting for deal form currency fields
    ["revenue", "fundingNeeded"].forEach(function (name) {
      var input = document.querySelector(
        '#cms-deal-form [name="' + name + '"]',
      );
      if (input)
        input.addEventListener("input", function () {
          formatNumberInput(this);
        });
    });
  });
})();
