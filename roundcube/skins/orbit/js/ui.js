/**
 * GLOBAL ORBIT MAIL — post-login chrome (frontend only)
 * Transforms Elastic into enterprise Orbit chrome without touching IMAP/SMTP.
 */
(function () {
  'use strict';

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function hideRoundcubeTraces() {
    qsa('a[href*="roundcube.net"], .aboutlink, #login-footer .product-info, .product-name').forEach(function (el) {
      el.style.display = 'none';
    });
    document.title = (document.title || '').replace(/Roundcube/gi, 'Global Orbit Mail');
  }

  function polishCompose() {
    qsa('a.compose, #composebtn, .button.create, a.button.create, #taskmenu a.compose').forEach(function (el) {
      el.classList.add('orbit-compose');
    });
  }

  function polishSearch() {
    var input = qs('.searchbar input, #mailsearchform input, input[name="_q"]');
    if (!input) return;
    if (!input.getAttribute('placeholder')) input.setAttribute('placeholder', 'Search mail');
    var bar = input.closest('.searchbar, .header, form') || input.parentElement;
    if (bar && !qs('.orbit-kbd', bar)) {
      var kbd = document.createElement('span');
      kbd.className = 'orbit-kbd';
      kbd.textContent = '⌘ K';
      kbd.setAttribute('aria-hidden', 'true');
      bar.style.position = bar.style.position || 'relative';
      bar.appendChild(kbd);
    }
  }

  function ensureOnlinePill() {
    if (qs('#orbit-online')) return;
    var host = qs('.header .buttons, #taskmenu, .header') || null;
    if (!host) return;
    var pill = document.createElement('span');
    pill.id = 'orbit-online';
    pill.className = 'orbit-online';
    pill.innerHTML = '<i></i> Online';
    host.appendChild(pill);
  }

  function themeToggle() {
    if (qs('#orbit-theme-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'orbit-theme-toggle';
    btn.className = 'orbit-theme-toggle';
    btn.title = 'Toggle theme';
    btn.setAttribute('aria-label', 'Toggle light/dark theme');
    btn.textContent = '◐';
    btn.addEventListener('click', function () {
      var light = document.documentElement.classList.toggle('light-mode');
      document.body.classList.toggle('light-mode', light);
      try { localStorage.setItem('gom_theme', light ? 'light' : 'dark'); } catch (e) {}
    });
    document.body.appendChild(btn);
    try {
      if (localStorage.getItem('gom_theme') === 'light') {
        document.documentElement.classList.add('light-mode');
        document.body.classList.add('light-mode');
      }
    } catch (e) {}
  }

  function markMessageRows() {
    qsa('#messagelist tr, .messagelist tr').forEach(function (tr) {
      tr.classList.add('orbit-msg-row');
    });
  }

  function boot() {
    if (document.body.classList.contains('task-login')) return;
    document.body.classList.add('orbit-mail');
    hideRoundcubeTraces();
    polishCompose();
    polishSearch();
    ensureOnlinePill();
    themeToggle();
    markMessageRows();
    // Re-run after Roundcube AJAX list refreshes
    var list = qs('#messagelist, .messagelist, #layout-list');
    if (list && window.MutationObserver) {
      var t;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(markMessageRows, 80);
      }).observe(list, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
