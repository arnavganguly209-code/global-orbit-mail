/**
 * GLOBAL ORBIT MAIL — Roundcube login UI enhancements
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
      user.setAttribute('placeholder', 'Email Address');
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

  function wireSubmitLoading() {
    var form = qs('#login-form');
    var btn = qs('#rcmloginsubmit');
    if (!form || !btn) return;

    form.addEventListener('submit', function () {
      btn.classList.add('orbit-loading');
      btn.setAttribute('aria-busy', 'true');
    });
  }

  function moveExtras() {
    var extras = qs('#orbit-extras');
    var submitRow = qs('#login-form .formbuttons, #login-form .button.mainaction, #rcmloginsubmit');
    var form = qs('#login-form');
    if (!extras || !form) return;

    var passRow = qs('#rcmloginpwd');
    if (passRow && passRow.closest('tr')) {
      var tr = passRow.closest('tr');
      if (tr && tr.parentNode) {
        var wrap = document.createElement('tr');
        wrap.className = 'orbit-extras-row';
        var td = document.createElement('td');
        td.colSpan = 2;
        td.appendChild(extras);
        wrap.appendChild(td);
        if (tr.nextSibling) {
          tr.parentNode.insertBefore(wrap, tr.nextSibling);
        } else {
          tr.parentNode.appendChild(wrap);
        }
      }
    } else if (passRow && passRow.parentNode) {
      passRow.parentNode.insertBefore(extras, passRow.nextSibling);
    }
  }

  function initStars() {
    var canvas = qs('#orbit-stars');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var stars = [];
    var particles = [];
    var w = 0;
    var h = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var raf = 0;
    var linkDist = 110;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      linkDist = Math.max(90, Math.min(140, Math.floor(Math.min(w, h) * 0.12)));
    }

    function seed() {
      stars = [];
      particles = [];
      var n = Math.floor((w * h) / 12000);
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.5 + 0.2,
          a: Math.random() * 0.55 + 0.18,
          tw: Math.random() * Math.PI * 2,
          sp: 0.0035 + Math.random() * 0.01
        });
      }
      var pc = Math.min(42, Math.max(24, Math.floor((w * h) / 55000)));
      for (var j = 0; j < pc; j++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 2.4 + 0.7,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -0.04 - Math.random() * 0.2,
          a: Math.random() * 0.4 + 0.1,
          pulse: Math.random() * Math.PI * 2
        });
      }
    }

    function drawLinks() {
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var a = particles[i];
          var b = particles[j];
          var dx = a.x - b.x;
          var dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          var max = linkDist * linkDist;
          if (d2 > max) continue;
          var alpha = (1 - d2 / max) * 0.18;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(96, 165, 250,' + alpha + ')';
          ctx.lineWidth = 1;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    function frame(t) {
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.tw);
        ctx.beginPath();
        ctx.fillStyle = 'rgba(180, 210, 255,' + (s.a * tw) + ')';
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      drawLinks();

      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.02;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        var glow = 0.75 + 0.25 * Math.sin(p.pulse);
        var grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grd.addColorStop(0, 'rgba(147, 197, 253,' + (p.a * glow * 0.55) + ')');
        grd.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.beginPath();
        ctx.fillStyle = grd;
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = 'rgba(96, 165, 250,' + (p.a * glow) + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    seed();
    if (!reduced) raf = requestAnimationFrame(frame);
    else {
      ctx.clearRect(0, 0, w, h);
      for (var k = 0; k < stars.length; k++) {
        var st = stars[k];
        ctx.beginPath();
        ctx.fillStyle = 'rgba(180, 210, 255,' + st.a + ')';
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        seed();
      }, 120);
    });
  }

  function boot() {
    enhancePlaceholders();
    moveExtras();
    wireRemember();
    wireShowPassword();
    wireSubmitLoading();
    initStars();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
