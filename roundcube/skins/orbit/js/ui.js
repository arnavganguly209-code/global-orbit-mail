/**
 * GLOBAL ORBIT MAIL — post-login chrome polish (frontend only)
 */
(function () {
  'use strict';

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function hideRoundcubeTraces() {
    qsa('a[href*="roundcube.net"], .aboutlink, #login-footer .product-info').forEach(function (el) {
      el.style.display = 'none';
    });
  }

  function polishCompose() {
    qsa('a.compose, #composebtn, .button.create, a.button.create').forEach(function (el) {
      el.classList.add('orbit-compose');
      if (!/\bcompose\b/i.test(el.textContent || '') && !(el.getAttribute('title') || '').match(/compose/i)) {
        return;
      }
      if (!(el.textContent || '').trim()) {
        el.setAttribute('aria-label', 'Compose');
      }
    });
  }

  function polishSearch() {
    var input = qs('.searchbar input, #mailsearchform input, input[name="_q"]');
    if (!input) return;
    input.setAttribute('placeholder', input.getAttribute('placeholder') || 'Search mail');
    var bar = input.closest('.searchbar, .header, form') || input.parentElement;
    if (bar && !qs('.orbit-kbd', bar)) {
      var kbd = document.createElement('span');
      kbd.className = 'orbit-kbd';
      kbd.textContent = '⌘ K';
      kbd.setAttribute('aria-hidden', 'true');
      bar.appendChild(kbd);
    }
  }

  function themeToggle() {
    if (qs('#orbit-theme-toggle')) return;
    var host = qs('#taskmenu, .header, #layout-menu') || document.body;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'orbit-theme-toggle';
    btn.className = 'orbit-theme-toggle';
    btn.title = 'Toggle theme';
    btn.setAttribute('aria-label', 'Toggle light/dark theme');
    btn.innerHTML = '◐';
    btn.addEventListener('click', function () {
      var root = document.documentElement;
      var light = root.classList.toggle('light-mode');
      document.body.classList.toggle('light-mode', light);
      try { localStorage.setItem('gom_theme', light ? 'light' : 'dark'); } catch (e) {}
    });
    host.appendChild(btn);
    try {
      if (localStorage.getItem('gom_theme') === 'light') {
        document.documentElement.classList.add('light-mode');
        document.body.classList.add('light-mode');
      }
    } catch (e) {}
  }

  function boot() {
    if (document.body.classList.contains('task-login')) return;
    document.body.classList.add('orbit-mail');
    hideRoundcubeTraces();
    polishCompose();
    polishSearch();
    themeToggle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
