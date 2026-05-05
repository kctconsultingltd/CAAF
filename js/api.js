(function () {
  'use strict';

  var API_BASE = 'https://caaf20-production.up.railway.app/api';

  // ─── Core fetch wrapper ───────────────────────────────────────────────────

  function apiFetch(path, options) {
    var opts = Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {});
    return fetch(API_BASE + path, opts).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) {
          var msg = (json && json.error && json.error.message)
            ? json.error.message
            : 'Request failed (' + res.status + ')';
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
    if (el) el.innerHTML = '<p class="cms-error">' + escHtml(msg) + '</p>';
  }

  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'cms-status' + (type ? ' cms-status--' + type : '');
  }

  function showToast(msg, type) {
    var existing = document.getElementById('cms-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'cms-toast';
    toast.className = 'cms-toast cms-toast--' + (type || 'info');
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { toast.classList.add('cms-toast--visible'); });
    });
    setTimeout(function () {
      toast.classList.remove('cms-toast--visible');
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 400);
    }, 5000);
  }

  function formatNumberInput(input) {
    var raw = input.value.replace(/[^0-9]/g, '');
    input.value = raw ? Number(raw).toLocaleString('en-US') : '';
  }

  function parseFormattedNumber(val) {
    var raw = String(val || '').replace(/[^0-9]/g, '');
    return raw ? Number(raw) : null;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Team Members ─────────────────────────────────────────────────────────
  // Expected container: <div id="cms-team-list"></div>

  function renderTeamMember(member) {
    var imgUrl = member.image && member.image.url
      ? member.image.url
      : null;
    var avatar = imgUrl
      ? '<div class="team-avatar"><img src="' + escHtml(imgUrl) + '" alt="' + escHtml(member.name) + '" class="team-avatar-img" /></div>'
      : '<div class="team-avatar"><div class="avatar-ring-2" aria-hidden="true"></div><div class="avatar-ring" aria-hidden="true"></div><span class="avatar-initials">' + escHtml(member.name.charAt(0)) + '</span></div>';
    var bio = member.bio
      ? escHtml(member.bio).replace(/\n/g, '<br>')
      : '';
    return (
      '<div class="team-card cms-team-card" data-id="' + escHtml(member.documentId) + '">' +
        avatar +
        '<div class="team-info">' +
          '<div class="team-name">' + escHtml(member.name) + '</div>' +
          '<div class="team-role">' + escHtml(member.role) + '</div>' +
          (bio
            ? '<div class="team-bio"><p class="bio-text">' + bio + '</p>' +
              '<button class="see-more-btn">See more</button></div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  function loadTeamMembers() {
    var el = document.getElementById('cms-team-list');
    if (!el) return;
    setLoading(el);
    apiFetch('/team-members?populate=image')
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) { el.innerHTML = ''; return; }
        el.innerHTML = items.map(renderTeamMember).join('');
        // Wire up see-more toggles for dynamically added bios
        el.querySelectorAll('.see-more-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var bioText = btn.previousElementSibling;
            if (!bioText) return;
            var expanded = bioText.classList.toggle('expanded');
            btn.textContent = expanded ? 'See less' : 'See more';
          });
        });

        // Equalize card heights so buttons stay aligned while expansion only affects the clicked card
        var cards = Array.from(el.querySelectorAll('.cms-team-card'));
        if (cards.length > 1) {
          var maxH = Math.max.apply(null, cards.map(function (c) { return c.offsetHeight; }));
          cards.forEach(function (c) { c.style.minHeight = maxH + 'px'; });
        }
      })
      .catch(function (err) { setError(el, 'Could not load team members: ' + err.message); });
  }

  // ─── Blog Links ───────────────────────────────────────────────────────────
  // Expected container: <div id="cms-blog-list"></div>

  function renderBlogLink(link) {
    return (
      '<article class="cms-blog-card" data-id="' + escHtml(link.documentId) + '">' +
        '<a href="' + escHtml(link.url) + '" target="_blank" rel="noopener noreferrer" class="cms-blog-title">' +
          escHtml(link.title) +
        '</a>' +
        (link.description ? '<p class="cms-blog-desc">' + escHtml(link.description) + '</p>' : '') +
      '</article>'
    );
  }

  function loadBlogLinks() {
    var el = document.getElementById('cms-blog-list');
    if (!el) return;
    setLoading(el);
    apiFetch('/blog-links')
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) { el.innerHTML = '<p>No blog posts found.</p>'; return; }
        el.innerHTML = items.map(renderBlogLink).join('');
      })
      .catch(function (err) { setError(el, 'Could not load blog posts: ' + err.message); });
  }

  // ─── Deals ────────────────────────────────────────────────────────────────
  // Expected container: <div id="cms-deals-list"></div>

  function renderDeal(deal) {
    return (
      '<div class="cms-deal-card" data-id="' + escHtml(deal.documentId) + '">' +
        '<div class="cms-deal-header">' +
          '<h3 class="cms-deal-name">' + escHtml(deal.businessName) + '</h3>' +
          '<span class="cms-deal-industry">' + escHtml(deal.industry) + '</span>' +
        '</div>' +
        (deal.fundingRequired != null
          ? '<p class="cms-deal-funding">Funding Required: $' +
              Number(deal.fundingRequired).toLocaleString() + '</p>'
          : '') +
        (deal.description ? '<p class="cms-deal-desc">' + escHtml(deal.description) + '</p>' : '') +
        '<button class="btn-gold cms-invest-btn" ' +
          'data-deal-id="' + escHtml(deal.documentId) + '" ' +
          'data-deal-name="' + escHtml(deal.businessName) + '">' +
          'Express Interest' +
        '</button>' +
      '</div>'
    );
  }

  function loadDeals() {
    var el = document.getElementById('cms-deals-list');
    if (!el) return;
    setLoading(el);
    // Server enforces approved-only for public requests; filter is a belt-and-suspenders hint
    apiFetch('/deals?filters[reviewStatus]=approved')
      .then(function (json) {
        var items = json.data || [];
        if (!items.length) { el.innerHTML = '<p>No active deals at this time.</p>'; return; }
        el.innerHTML = items.map(renderDeal).join('');
        el.querySelectorAll('.cms-invest-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            openInvestorForm(btn.dataset.dealId, btn.dataset.dealName);
          });
        });
      })
      .catch(function (err) { setError(el, 'Could not load deals: ' + err.message); });
  }

  // ─── Deal Submission Form ─────────────────────────────────────────────────
  // Expected form:  <form id="cms-deal-form"> ... </form>
  // Required inputs (name attr): businessName, industry, contactEmail, description
  // Optional inputs (name attr): revenue, fundingNeeded

  function handleDealSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var btn = form.querySelector('[type="submit"]');
    var originalLabel = btn ? btn.textContent : '';

    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var contactEmail = form.contactEmail.value.trim();
    var description = form.description && form.description.value.trim();

    if (!contactEmail || !emailRe.test(contactEmail)) {
      showToast('Please enter a valid email address.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
      return;
    }
    if (!description) {
      showToast('Please provide a business description.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
      return;
    }

    var body = {
      businessName:  form.businessName.value.trim(),
      industry:      form.industry.value.trim(),
      contactEmail:  contactEmail,
      revenue:       parseFormattedNumber(form.revenue && form.revenue.value),
      fundingNeeded: parseFormattedNumber(form.fundingNeeded && form.fundingNeeded.value),
      description:   description,
    };

    apiFetch('/deal-submissions', { method: 'POST', body: JSON.stringify(body) })
      .then(function (json) {
        showToast(json.message || 'Submission received.', 'success');
        form.reset();
      })
      .catch(function (err) {
        showToast(err.message, 'error');
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
      });
  }

  // ─── Investor Interest Form ───────────────────────────────────────────────
  // Expected form:  <form id="cms-investor-form"> ... </form>
  // Expected status: <p id="cms-investor-status"></p>
  // Expected deal label: <span id="cms-investor-deal-name"></span>
  // Required inputs (name attr): investorName, email, dealId (hidden)
  // Optional inputs (name attr): investmentRange, notes

  function openInvestorForm(dealId, dealName) {
    var form = document.getElementById('cms-investor-form');
    if (!form) return;

    var dealIdInput  = form.querySelector('[name="dealId"]');
    var dealNameSpan = document.getElementById('cms-investor-deal-name');
    var statusEl     = document.getElementById('cms-investor-status');

    if (dealIdInput)  dealIdInput.value = dealId;
    if (dealNameSpan) dealNameSpan.textContent = dealName;
    if (statusEl)     setStatus(statusEl, '', '');

    form.reset();
    if (dealIdInput)  dealIdInput.value = dealId; // re-set after reset

    // Reveal form if hidden, then scroll to it
    form.closest('[hidden]') && (form.closest('[hidden]').hidden = false);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleInvestorSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var btn = form.querySelector('[type="submit"]');
    var statusEl = document.getElementById('cms-investor-status');
    var originalLabel = btn ? btn.textContent : '';

    setStatus(statusEl, '', '');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    var body = {
      investorName:    form.investorName.value.trim(),
      email:           form.email.value.trim(),
      dealId:          form.dealId.value,
      investmentRange: form.investmentRange && form.investmentRange.value.trim() || null,
      notes:           form.notes && form.notes.value.trim() || null,
    };

    apiFetch('/investor-interests', { method: 'POST', body: JSON.stringify(body) })
      .then(function (json) {
        setStatus(statusEl, json.message || 'Interest submitted.', 'success');
        form.reset();
      })
      .catch(function (err) {
        setStatus(statusEl, err.message, 'error');
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
      });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    loadTeamMembers();
    loadBlogLinks();
    loadDeals();

    var dealForm     = document.getElementById('cms-deal-form');
    var investorForm = document.getElementById('cms-investor-form');
    if (dealForm)     dealForm.addEventListener('submit', handleDealSubmit);
    if (investorForm) investorForm.addEventListener('submit', handleInvestorSubmit);

    // Number formatting for deal form currency fields
    ['revenue', 'fundingNeeded'].forEach(function (name) {
      var input = document.querySelector('#cms-deal-form [name="' + name + '"]');
      if (input) input.addEventListener('input', function () { formatNumberInput(this); });
    });
  });

})();
