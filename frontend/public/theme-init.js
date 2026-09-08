/* Shared, non-sensitive appearance preference. Keep both public copies identical. */
(function () {
  'use strict';
  var key = 'jion_theme', memory = 'system';
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  var valid = function (v) { return ['light', 'dark', 'system'].indexOf(v) !== -1; };
  function read() {
    try {
      var match = document.cookie.split('; ').find(function (row) { return row.indexOf(key + '=') === 0; });
      if (match && valid(match.slice(key.length + 1))) return match.slice(key.length + 1);
    } catch { /* Storage may be unavailable; retain the in-memory preference. */ }
    try { var saved = localStorage.getItem(key); if (valid(saved)) return saved; } catch { /* Storage may be unavailable; retain the in-memory preference. */ }
    return memory;
  }
  var state = { preference: 'system', resolved: 'light' };
  function apply() {
    var preference = read();
    var resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    var changed = state.preference !== preference || state.resolved !== resolved;
    state = { preference: preference, resolved: resolved };
    var root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'dark' ? '#151a22' : '#f7f8fa';
    if (changed) window.dispatchEvent(new CustomEvent('jion-theme-change', { detail: state }));
  }
  window.JionTheme = {
    get: function () { return state; },
    set: function (preference) {
      if (!valid(preference)) return;
      memory = preference;
      var shared = ['jionc.com', 'blog.jionc.com', 'www.jionc.com'].indexOf(location.hostname) !== -1;
      try {
        document.cookie = key + '=' + preference + '; Path=/; Max-Age=31536000; SameSite=Lax'
          + (shared ? '; Domain=jionc.com' : '') + (location.protocol === 'https:' ? '; Secure' : '');
      } catch { /* Storage may be unavailable; retain the in-memory preference. */ }
      try { localStorage.setItem(key, preference); } catch { /* Storage may be unavailable; retain the in-memory preference. */ }
      apply();
    }
  };
  apply();
  window.addEventListener('focus', apply);
  window.addEventListener('storage', function (event) { if (event.key === key || event.key === null) apply(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });
  media.addEventListener('change', apply);
  setInterval(function () { if (!document.hidden) apply(); }, 2000);
})();
