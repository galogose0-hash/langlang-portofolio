/* ==========================================================================
   Night starfield + shooting stars (dark mode only)
   - Twinkling stars on a fixed canvas behind the page content
   - Occasional shooting stars
   - Only animates when <html> has the "dark" class and the tab is visible
   - Respects prefers-reduced-motion (renders a static sky instead)
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("starfield");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var w = 0;
  var h = 0;
  var stars = [];
  var shooting = [];
  var running = false;
  var rafId = null;
  var last = 0;
  var spawnTimer = 0;

  function buildStars() {
    var count = Math.round((w * h) / 9000);
    count = Math.max(60, Math.min(count, 240));
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        base: Math.random() * 0.45 + 0.3,
        amp: Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.6 + 0.4
      });
    }
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
    if (reduceMotion) render(0, true);
  }

  function spawnShooting() {
    var angle = Math.PI * 0.25 + (Math.random() - 0.5) * 0.6;
    var speed = Math.random() * 6 + 7;
    shooting.push({
      x: Math.random() * w * 0.8 + w * 0.1,
      y: Math.random() * h * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      len: Math.random() * 90 + 80,
      life: 1
    });
  }

  function render(t, staticFrame) {
    ctx.clearRect(0, 0, w, h);
    var time = t / 1000;
    var i;

    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = staticFrame
        ? s.base + s.amp * 0.5
        : s.base + s.amp * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase));
      ctx.beginPath();
      ctx.fillStyle = "rgba(237,234,228," + a.toFixed(3) + ")";
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (i = shooting.length - 1; i >= 0; i--) {
      var m = shooting[i];
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.012;
      if (m.life <= 0 || m.x > w + 140 || m.y > h + 140) {
        shooting.splice(i, 1);
        continue;
      }
      var tailX = m.x - m.vx * (m.len / 10);
      var tailY = m.y - m.vy * (m.len / 10);
      var grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, "rgba(255,255,255," + (0.9 * m.life).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255," + (0.9 * m.life).toFixed(3) + ")";
      ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(t) {
    if (!running) return;
    var dt = last ? (t - last) / 1000 : 0;
    last = t;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnShooting();
      spawnTimer = Math.random() * 2.5 + 1.6;
    }
    render(t, false);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (reduceMotion) {
      render(0, true);
      return;
    }
    if (running) return;
    running = true;
    last = 0;
    spawnTimer = Math.random() * 1.5;
    render(0, false);
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    shooting.length = 0;
    ctx.clearRect(0, 0, w, h);
  }

  function sync() {
    if (document.documentElement.classList.contains("dark")) start();
    else stop();
  }

  window.addEventListener("resize", resize);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else sync();
  });

  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"]
  });

  resize();
  sync();
})();
