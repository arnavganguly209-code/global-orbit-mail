/**
 * GLOBAL ORBIT MAIL — login UX (auth fields untouched)
 */
(function () {
  'use strict';
  var REMEMBER_KEY = 'gom_remember_user';

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function enhanceFields() {
    var user = qs('#rcmloginuser');
    var pass = qs('#rcmloginpwd');
    if (user) {
      user.setAttribute('placeholder', 'name@yourdomain.com');
      user.setAttribute('autocomplete', 'username');
      user.setAttribute('aria-label', 'Email Address');
    }
    if (pass) {
      pass.setAttribute('placeholder', 'Password');
      pass.setAttribute('autocomplete', 'current-password');
      pass.setAttribute('aria-label', 'Password');
    }
  }

  function wireRemember() {
    var box = qs('#orbit-remember');
    var user = qs('#rcmloginuser');
    var form = qs('#login-form');
    if (!box || !user || !form) return;
    try {
      var saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) { user.value = saved; box.checked = true; }
    } catch (e) {}
    form.addEventListener('submit', function () {
      try {
        if (box.checked && user.value) localStorage.setItem(REMEMBER_KEY, user.value);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch (e) {}
    });
  }

  function wireShowPassword() {
    var btn = qs('#orbit-toggle-pass');
    var pass = qs('#rcmloginpwd');
    if (!btn || !pass) return;
    // Place eye control near password field
    var wrap = pass.closest('.form-group, .row, .form-floating, td, label') || pass.parentNode;
    if (wrap && wrap.style) {
      wrap.style.position = 'relative';
      btn.style.position = 'absolute';
      btn.style.right = '12px';
      btn.style.top = '50%';
      btn.style.transform = 'translateY(-50%)';
      btn.style.zIndex = '6';
      if (wrap !== document.body) wrap.appendChild(btn);
    }
    btn.addEventListener('click', function () {
      var show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
  }

  function wireCaps() {
    var pass = qs('#rcmloginpwd');
    var hint = qs('#orbit-caps');
    if (!pass || !hint) return;
    function check(e) {
      hint.hidden = !(e.getModifierState && e.getModifierState('CapsLock'));
    }
    pass.addEventListener('keydown', check);
    pass.addEventListener('keyup', check);
  }

  function wireSubmit() {
    var form = qs('#login-form');
    var btn = qs('#rcmloginsubmit');
    if (!form || !btn) return;
    if (btn.tagName === 'INPUT') btn.value = 'Sign In →';
    else btn.textContent = 'Sign In →';
    form.addEventListener('submit', function () {
      btn.classList.add('orbit-loading');
      btn.setAttribute('aria-busy', 'true');
      if (btn.tagName === 'INPUT') btn.value = 'Signing in…';
      else btn.textContent = 'Signing in…';
    });
  }

  function placeActions() {
    var extras = qs('#orbit-extras');
    var submit = qs('#rcmloginsubmit');
    if (!extras || !submit || !submit.parentNode) return;
    submit.parentNode.insertBefore(extras, submit);
  }

  function setYear() {
    var el = qs('#orbit-year');
    if (el) el.textContent = '2025';
  }

  function stars() {
    var canvas = qs('#orbit-stars');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var starsArr = [];
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      var parent = canvas.parentElement;
      if (!parent) return;
      var rect = parent.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      starsArr = [];
      var n = Math.floor((rect.width * rect.height) / 16000);
      for (var i = 0; i < n; i++) {
        starsArr.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height * 0.55,
          r: Math.random() * 1.2 + 0.2,
          a: Math.random() * Math.PI,
          s: 0.015 + Math.random() * 0.02
        });
      }
    }
    function frame() {
      var parent = canvas.parentElement;
      if (!parent) return;
      var rect = parent.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      for (var i = 0; i < starsArr.length; i++) {
        var st = starsArr[i];
        st.a += st.s;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(240,215,140,' + (0.25 + Math.abs(Math.sin(st.a)) * 0.7) + ')';
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
  }

  function killSso() {
    var nodes = document.querySelectorAll(
      '.orbit-sso, .orbit-or, button[disabled], a, button, .btn, .button'
    );
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var t = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
      if (t.indexOf('sso') !== -1 || t.indexOf('coming soon') !== -1 || /^\s*or\s*$/i.test((el.textContent || '').trim())) {
        el.parentNode && el.parentNode.removeChild(el);
      }
    }
    var foot = document.getElementById('login-footer');
    if (foot) {
      foot.querySelectorAll('a, button, .btn').forEach(function (el) {
        var t = (el.textContent || '').toLowerCase();
        if (t.indexOf('sso') !== -1 || t.indexOf('privacy') !== -1 || t.indexOf('terms') !== -1) {
          el.style.display = 'none';
        }
      });
    }
  }

  function forceLogoSize() {
    var logo = qs('.orbit-logo-mark');
    if (!logo) return;
    logo.style.setProperty('width', 'min(560px, 78vw)', 'important');
    logo.style.setProperty('max-width', '560px', 'important');
    logo.style.setProperty('max-height', 'none', 'important');
    logo.style.setProperty('height', 'auto', 'important');
    logo.style.setProperty('min-width', '280px', 'important');
  }

  function boot() {
    document.body.classList.add('task-login');
    document.documentElement.style.setProperty('--orbit-font', '"Inter", "Segoe UI", system-ui, sans-serif');
    forceLogoSize();
    enhanceFields();
    placeActions();
    wireRemember();
    wireShowPassword();
    wireCaps();
    wireSubmit();
    setYear();
    killSso();
    setTimeout(killSso, 50);
    setTimeout(killSso, 400);
    setTimeout(forceLogoSize, 100);
    stars();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
