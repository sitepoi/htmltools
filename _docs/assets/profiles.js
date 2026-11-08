/* ==========================================================================
   Shared Profiles documentation behavior - _docs/assets/profiles.js
   Renders docs/profiles.html from the PROFILES-PAYLOAD, provides Copy JSON,
   mode/search filters and a browser-local usage reminder per profile.
   The authoritative usage register is SSOT section 4.1.
   ========================================================================== */
(function () {
  'use strict';

  var STATUS_OPTIONS = [
    { value: 'not-reviewed', label: 'Not reviewed' },
    { value: 'available', label: 'Available - not used' },
    { value: 'planned', label: 'Planned' },
    { value: 'in-use', label: 'In use in this app' },
    { value: 'retired', label: 'Retired' }
  ];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function boot() {
    var list = document.getElementById('profiles-list');
    if (!list) return;
    var payloadElement = document.getElementById('profiles-payload');
    var payload = [];
    try {
      payload = JSON.parse(payloadElement ? payloadElement.textContent : '[]') || [];
    } catch (error) {
      payload = [];
    }
    if (!Array.isArray(payload)) payload = [];

    var profilesKey = document.body.getAttribute('data-profiles-key') || 'profiles';
    var searchInput = document.getElementById('profiles-search');
    var modeFilter = document.getElementById('profiles-mode-filter');
    var countLabel = document.getElementById('profiles-count');
    var totalNode = document.getElementById('profiles-total');
    var fixedNode = document.getElementById('profiles-fixed');
    var selectableNode = document.getElementById('profiles-selectable');
    var usedNode = document.getElementById('profiles-used');

    function usageStorageKey(profile) {
      return 'uniconhub-profile-usage:' + profilesKey + ':' + profile.key;
    }

    function readUsage(profile) {
      try {
        var saved = localStorage.getItem(usageStorageKey(profile));
        if (saved) return saved;
      } catch (error) { /* storage unavailable */ }
      return 'not-reviewed';
    }

    function writeUsage(profile, value) {
      try { localStorage.setItem(usageStorageKey(profile), value); } catch (error) { /* storage unavailable */ }
    }

    function modeOf(profile) {
      return profile.mode === 'selectable' ? 'selectable' : 'fixed';
    }

    function matches(profile, query) {
      if (!query) return true;
      var text = [profile.name, profile.file, profile.bestFor, profile.notes, (profile.segments || []).join(' ')].join(' ').toLowerCase();
      return text.indexOf(query) > -1;
    }

    function visibleProfiles() {
      var query = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();
      var mode = modeFilter ? modeFilter.value : '';
      return payload.filter(function (profile) {
        return matches(profile, query) && (!mode || modeOf(profile) === mode);
      });
    }

    function usageCount() {
      return payload.filter(function (profile) { return readUsage(profile) === 'in-use'; }).length;
    }

    function updateSummary() {
      if (totalNode) totalNode.textContent = String(payload.length);
      if (fixedNode) fixedNode.textContent = String(payload.filter(function (profile) { return modeOf(profile) === 'fixed'; }).length);
      if (selectableNode) selectableNode.textContent = String(payload.filter(function (profile) { return modeOf(profile) === 'selectable'; }).length);
      if (usedNode) usedNode.textContent = String(usageCount());
    }

    function optionHtml(selected) {
      return STATUS_OPTIONS.map(function (option) {
        return '<option value="' + option.value + '"' + (option.value === selected ? ' selected' : '') + '>' + escapeHtml(option.label) + '</option>';
      }).join('');
    }

    function cardHtml(profile) {
      var mode = modeOf(profile);
      var segments = Array.isArray(profile.segments) ? profile.segments : [];
      var usage = readUsage(profile);
      return '<article class="profiles-card" data-profile-key="' + escapeHtml(profile.key) + '">' +
        '<div class="profiles-card-head"><div>' +
          '<h2>' + escapeHtml(profile.name || profile.key) + '</h2>' +
          '<p class="profiles-card-file">' + escapeHtml(profile.file || '') + '</p>' +
        '</div><span class="profiles-mode' + (mode === 'selectable' ? ' is-selectable' : '') + '">' + escapeHtml(mode) + '</span></div>' +
        (profile.bestFor ? '<p class="profiles-card-desc"><strong>Best for:</strong> ' + escapeHtml(profile.bestFor) + '</p>' : '') +
        (profile.notes ? '<p class="profiles-card-note">' + escapeHtml(profile.notes) + '</p>' : '') +
        (segments.length ? '<div class="profiles-segments">' + segments.map(function (segment) {
          return '<span class="profiles-segment">' + escapeHtml(segment) + '</span>';
        }).join('') + '</div>' : '') +
        '<div class="profiles-card-actions">' +
          '<label class="profiles-usage">Usage reminder<select data-profile-usage="' + escapeHtml(profile.key) + '">' + optionHtml(usage) + '</select></label>' +
          '<button type="button" class="profiles-copy" data-profile-copy="' + escapeHtml(profile.key) + '">Copy JSON</button>' +
          '<a class="profiles-open" href="../profiles/' + encodeURIComponent(profile.file || '') + '" target="_blank" rel="noopener">Open file</a>' +
        '</div>' +
        '<p class="profiles-used-note">Authoritative usage stays in <a href="ssot.html#sec-profile-usage">SSOT section 4.1</a>.</p>' +
      '</article>';
    }

    function render() {
      var profiles = visibleProfiles();
      list.innerHTML = profiles.length
        ? profiles.map(cardHtml).join('')
        : '<p class="profiles-empty">No profile presets match this filter.</p>';
      if (countLabel) countLabel.textContent = profiles.length + ' of ' + payload.length + ' shown';
      updateSummary();
    }

    function copyText(text, button) {
      function done() {
        if (!button) return;
        button.textContent = 'Copied';
        button.classList.add('copied');
        setTimeout(function () {
          button.textContent = 'Copy JSON';
          button.classList.remove('copied');
        }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
      } else {
        fallbackCopy(text, done);
      }
    }

    function fallbackCopy(text, done) {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch (error) { /* copy unavailable */ }
      document.body.removeChild(area);
      done();
    }

    list.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-profile-copy]') : null;
      if (!button) return;
      var key = button.getAttribute('data-profile-copy');
      var profile = payload.find(function (entry) { return entry.key === key; });
      if (!profile) return;
      copyText(JSON.stringify(profile.config || {}, null, 2), button);
    });

    list.addEventListener('change', function (event) {
      var select = event.target.closest ? event.target.closest('[data-profile-usage]') : null;
      if (!select) return;
      var key = select.getAttribute('data-profile-usage');
      var profile = payload.find(function (entry) { return entry.key === key; });
      if (!profile) return;
      writeUsage(profile, select.value);
      updateSummary();
    });

    if (searchInput) searchInput.addEventListener('input', render);
    if (modeFilter) modeFilter.addEventListener('change', render);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
