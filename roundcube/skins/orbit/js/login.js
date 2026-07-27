/**
 * GLOBAL ORBIT MAIL — login UX only (does not alter auth fields names/ids)
 */
(function () {
  'use strict';
  var REMEMBER_KEY = 'gom_remember_user';

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function forceLogoSize() {
    var logo = qs('.orbit-logo-mark');
    if (!logo) return;
    logo.style.setProperty('width', 'min(560px, 72%)', 'important');
    logo.style.setProperty('max-width', '560px', 'important');
    logo.style.setProperty('max-height', 'none', 'important');
    logo.style.setProperty('height', 'auto', 'important');
  }

  function enhanceFields() {
    var user = qs('#rcmloginuser');
    var pass = qs('#rcmloginpwd');
    if (user) {
      // Never allow help-link text to leak into the field
      if (/need help|contact our support/i.test(user.value || '')) user.value = '';
      if (/need help|contact our support/i.test(user.getAttribute('placeholder') || '')) {
        user.setAttribute('placeholder', 'name@yourdomain.com');
      }
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
      if (saved && !/need help/i.test(saved)) {
        user.value = saved;
        box.checked = true;
      }
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
    var group = pass.closest('.input-group, .input, td') || pass.parentNode;
    if (group && group.style) {
      group.style.position = 'relative';
      if (!group.contains(btn)) group.appendChild(btn);
      btn.style.position = 'absolute';
      btn.style.right = '10px';
      btn.style.top = '50%';
      btn.style.transform = 'translateY(-50%)';
      btn.style.zIndex = '6';
    }
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
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

  function placeActions() {
    var extras = qs('#orbit-extras');
    var submit = qs('#rcmloginsubmit');
    if (!extras || !submit || !submit.parentNode) return;
    // Place remember/forgot immediately before the submit control
    submit.parentNode.insertBefore(extras, submit);
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

  function killSso() {
    var nodes = document.querySelectorAll('button, a, .btn, .button, .orbit-sso, .orbit-or');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var t = ((el.textContent || '') + ' ' + (el.getAttribute('title') || '')).toLowerCase();
      if (t.indexOf('sso') !== -1 || t.indexOf('coming soon') !== -1) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    }
    var foot = qs('#login-footer');
    if (foot) foot.setAttribute('hidden', 'hidden');
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

  function boot() {
    document.body.classList.add('task-login', 'orbit-login');
    forceLogoSize();
    enhanceFields();
    placeActions();
    wireRemember();
    wireShowPassword();
    wireCaps();
    wireSubmit();
    setYear();
    killSso();
    setTimeout(function () { enhanceFields(); killSso(); forceLogoSize(); }, 80);
    stars();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
