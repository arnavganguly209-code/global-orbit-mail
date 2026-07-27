/**
 * GLOBAL ORBIT MAIL — Roundcube login UI
 * Does not alter authentication fields or submit payload (_user / _pass / _token).
 */
(function () {
  'use strict';

  var REMEMBER_KEY = 'gom_remember_user';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function enhancePlaceholders() {
    var user = qs('#rcmloginuser');
    var pass = qs('#rcmloginpwd');
    if (user) {
      user.setAttribute('placeholder', 'name@yourdomain.com');
      user.setAttribute('autocomplete', 'username');
      if (!user.getAttribute('aria-label')) user.setAttribute('aria-label', 'Email Address');
    }
    if (pass) {
      pass.setAttribute('placeholder', 'Password');
      pass.setAttribute('autocomplete', 'current-password');
      if (!pass.getAttribute('aria-label')) pass.setAttribute('aria-label', 'Password');
    }
  }

  function wireRemember() {
    var box = qs('#orbit-remember');
    var user = qs('#rcmloginuser');
    if (!box || !user) return;

    try {
      var saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        user.value = saved;
        box.checked = true;
      }
    } catch (e) { /* ignore */ }

    var form = qs('#login-form');
    if (!form) return;
    form.addEventListener('submit', function () {
      try {
        if (box.checked && user.value) {
          localStorage.setItem(REMEMBER_KEY, user.value);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch (e) { /* ignore */ }
    });
  }

  function wireShowPassword() {
    var btn = qs('#orbit-toggle-pass');
    var pass = qs('#rcmloginpwd');
    if (!btn || !pass) return;

    btn.addEventListener('click', function () {
      var show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
  }

  function wireCapsLock() {
    var pass = qs('#rcmloginpwd');
    var hint = qs('#orbit-caps');
    if (!pass || !hint) return;
    function check(e) {
      var on = e.getModifierState && e.getModifierState('CapsLock');
      hint.hidden = !on;
    }
    pass.addEventListener('keydown', check);
    pass.addEventListener('keyup', check);
  }

  function wireSubmitLoading() {
    var form = qs('#login-form');
    var btn = qs('#rcmloginsubmit');
    if (!form || !btn) return;

    form.addEventListener('submit', function () {
      btn.classList.add('orbit-loading');
      btn.setAttribute('aria-busy', 'true');
      if (btn.tagName === 'INPUT') {
        btn.dataset.label = btn.value;
        btn.value = 'Signing in…';
      } else {
        btn.dataset.label = btn.textContent;
        btn.textContent = 'Signing in…';
      }
    });
  }

  function moveExtras() {
    var extras = qs('#orbit-extras');
    var form = qs('#login-form');
    var submit = qs('#rcmloginsubmit');
    if (!extras || !form || !submit) return;
    // Place remember/show just above submit when Roundcube renders fields first
    if (submit.parentNode) {
      submit.parentNode.insertBefore(extras, submit);
    }
  }

  function styleSubmitArrow() {
    var btn = qs('#rcmloginsubmit');
    if (!btn) return;
    if (btn.tagName === 'INPUT' && (!btn.value || /login|sign/i.test(btn.value))) {
      btn.value = 'Sign In →';
    } else if (btn.tagName !== 'INPUT' && !/→/.test(btn.textContent || '')) {
      btn.textContent = 'Sign In →';
    }
  }

  function setYear() {
    var el = qs('#orbit-year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function stars() {
    var canvas = qs('#orbit-stars');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var stars = [];
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = [];
      var count = Math.floor((rect.width * rect.height) / 14000);
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          r: Math.random() * 1.4 + 0.2,
          a: Math.random(),
          s: Math.random() * 0.008 + 0.002,
        });
      }
    }

    function frame() {
      var rect = canvas.parentElement.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        st.a += st.s;
        var alpha = 0.25 + Math.abs(Math.sin(st.a)) * 0.75;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(240, 215, 140,' + alpha + ')';
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
    document.body.classList.add('task-login');
    enhancePlaceholders();
    moveExtras();
    wireRemember();
    wireShowPassword();
    wireCapsLock();
    wireSubmitLoading();
    styleSubmitArrow();
    setYear();
    stars();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
