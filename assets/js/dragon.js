/* ==========================================================================
   Day dragon - free-roaming cute baby dragon (LIGHT MODE ONLY)
   - A big, soft pastel-mint baby dragon with warm cream scales and
     yellow/orange feathered wings.
   - While the user scrolls it glides along a smooth path down the page.
   - When the user stops scrolling it roams the whole viewport on its own,
     drifting to random points (always kept fully on screen), then heads back
     to the scroll path as soon as scrolling resumes.
   - Hidden in dark mode (dark mode uses the night starfield instead).
   - Motion is smoothed (lerped) and drawn with requestAnimationFrame so it
     stays light and smooth; respects prefers-reduced-motion (static dragon).
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("dragonLayer");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var w = 0;
  var h = 0;
  var mobile = false;
  var running = false;
  var rafId = null;

  var progress = 0;        // smoothed 0..1 position along the page path
  var target = 0;          // raw scroll progress
  var maxScroll = 1;
  var lastScrollAt = -1e9; // timestamp of the last scroll event
  var lastT = 0;
  var flapPhase = 0;
  var idleMix = 0;         // 0 = actively scrolling, 1 = idle (roaming)
  var face = 1;            // smoothed facing: 1 = right, -1 = left (mirrored)
  var bank = 0;            // smoothed pitch (radians)

  var curX = 0;            // smoothed dragon position (viewport px)
  var curY = 0;
  var prevX = 0;           // previous frame position (for velocity/facing)
  var prevY = 0;
  var inited = false;
  var wasIdle = true;
  var wander = { x: 0, y: 0, timer: 0 }; // current idle roaming target

  /* ---------------------------- Pastel palette ---------------------------- */
  var C = {
    mintL: "#D6F0E1", mint: "#AFDCC4", mintM: "#8FC9AC", mintD: "#6FB394",
    line: "#5E9179",
    cream: "#FFF7E9", creamM: "#FBE7C6", creamD: "#EBCF93",
    wingL: "#FFEFC0", wingM: "#FFCF8C", wingD: "#FFA968", wingLine: "#E9A45F",
    blush: "#F6BDB2",
    eye: "#2E4A3D", gold: "#FFE7A6"
  };

  function isDark() {
    return document.documentElement.classList.contains("dark");
  }

  function computeScroll() {
    var top = window.pageYOffset || document.documentElement.scrollTop || 0;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - h);
    target = Math.min(1, Math.max(0, top / maxScroll));
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    mobile = w < 768;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeScroll();
    if (!inited) {
      var p0 = pathAt(progress);
      curX = p0.x;
      curY = p0.y;
      prevX = curX;
      prevY = curY;
      inited = true;
      pickWander();
    }
    clampToScreen();
    if (!running && !isDark()) render(0);
  }

  /* ---------------------------- Path definition ---------------------------- */
  // A gentle, flowing glide: the dragon drifts diagonally downward across the
  // page with a soft sway and vertical undulation. The horizontal heading stays
  // forward the whole way, so it never has to turn around or flip.
  function pathAt(p) {
    var drift = mobile ? w * 0.34 : w * 0.38;
    var amp = mobile ? w * 0.09 : Math.min(w * 0.10, 140);
    var sway = Math.sin(p * Math.PI * 1.05 + 0.4);
    return {
      x: w * 0.30 + p * drift + sway * amp,
      y: h * 0.15 + p * (h * 0.74) +
        Math.sin(p * Math.PI * 2.0 + 1.2) * (h * 0.02)
    };
  }

  /* ------------------------- Roaming area helpers ------------------------- */
  function baseScale() {
    return mobile ? 1.05 : (w >= 1440 ? 1.9 : 1.65);
  }

  // How far the drawn dragon reaches from its origin, so it can be kept fully
  // inside the viewport while roaming (accounts for the tail on the left).
  function extents() {
    var s = baseScale();
    return { hx: 155 * s, hy: 68 * s };
  }

  function boundsX() {
    var e = extents();
    return { lo: Math.min(e.hx, w - e.hx), hi: Math.max(e.hx, w - e.hx) };
  }

  function boundsY() {
    var e = extents();
    return { lo: Math.min(e.hy, h - e.hy), hi: Math.max(e.hy, h - e.hy) };
  }

  // Pick a new random roaming target inside the visible area.
  function pickWander() {
    var bx = boundsX();
    var by = boundsY();
    wander.x = bx.lo + Math.random() * (bx.hi - bx.lo);
    wander.y = by.lo + Math.random() * (by.hi - by.lo);
    wander.timer = 2.4 + Math.random() * 2.8;
  }

  function clampToScreen() {
    var bx = boundsX();
    var by = boundsY();
    curX = Math.min(bx.hi, Math.max(bx.lo, curX));
    curY = Math.min(by.hi, Math.max(by.lo, curY));
  }

  /* ----------------------------- Body spine ----------------------------- */
  function spine(t) {
    var N = 26;
    var seg = 5.6;
    var i;
    var pts = [];
    for (i = 0; i <= N; i++) {
      var f = i / N;
      pts.push({
        x: -i * seg,
        y: Math.sin(t * 2.6 - i * 0.55) * (5 + 5 * f) * f - f * f * 18,
        f: f
      });
    }
    var ww = [];
    var upN = [];
    for (i = 0; i <= N; i++) {
      var a = pts[Math.max(0, i - 1)];
      var b = pts[Math.min(N, i + 1)];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len;
      var ny = dx / len;
      upN.push(ny <= 0 ? { x: nx, y: ny } : { x: -nx, y: -ny });
      var f = pts[i].f;
      var hw = f < 0.1
        ? 15 * (0.5 + f * 4.6)
        : 15 * (1 - Math.pow((f - 0.1) / 0.9, 1.4) * 0.86);
      ww.push(Math.max(hw, 1.4));
    }
    return { pts: pts, w: ww, upN: upN, N: N };
  }

  /* ------------------------------ Helpers ------------------------------ */
  function feather(x, y, ang, len, wid, c1, c2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    var g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.55, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.55, wid, 0, 0);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.wingLine;
    ctx.stroke();
    ctx.restore();
  }

  function star(x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* --------------------------- Dragon parts --------------------------- */
  function drawGlow() {
    var g = ctx.createRadialGradient(0, -6, 6, 0, -6, 150);
    g.addColorStop(0, "rgba(255,240,200,0.55)");
    g.addColorStop(0.55, "rgba(205,238,218,0.28)");
    g.addColorStop(1, "rgba(205,238,218,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -6, 150, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWing(flapVal, dy, rotBase, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(-6, -3 + dy);
    ctx.rotate(-(rotBase + Math.sin(flapVal) * 0.5));

    ctx.beginPath();
    ctx.moveTo(2, 4);
    ctx.quadraticCurveTo(6, -30, -14, -52);
    ctx.quadraticCurveTo(-40, -58, -52, -34);
    ctx.quadraticCurveTo(-46, -16, -20, -6);
    ctx.quadraticCurveTo(-6, -1, 2, 4);
    ctx.closePath();
    var mg = ctx.createLinearGradient(0, -50, -50, 0);
    mg.addColorStop(0, C.wingL);
    mg.addColorStop(1, C.wingM);
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = C.wingLine;
    ctx.stroke();

    feather(-2, 2, -1.05, 42, 9, C.wingL, C.wingM);
    feather(-4, 2, -0.9, 52, 10, C.wingM, C.wingD);
    feather(-6, 1, -0.75, 46, 9, C.wingL, C.wingM);
    feather(-7, 0, -0.62, 36, 8, C.wingM, C.wingD);
    ctx.restore();
  }

  function drawTailFin(s) {
    var p = s.pts[s.N];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.5);
    feather(0, 0, -0.15, 34, 12, C.wingL, C.wingD);
    feather(-2, 0, -0.55, 30, 10, C.wingM, C.wingL);
    ctx.restore();
  }

  function drawBody(s) {
    var pts = s.pts;
    var ww = s.w;
    var upN = s.upN;
    var N = s.N;
    var i;

    /* dorsal crest spikes */
    ctx.fillStyle = "#FFD9A3";
    for (i = 2; i <= N - 2; i += 2) {
      var sp = 7 * (1 - pts[i].f) + 3;
      var bx = pts[i].x + upN[i].x * ww[i];
      var by = pts[i].y + upN[i].y * ww[i];
      var ang = Math.atan2(upN[i].y, upN[i].x);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(ang - Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-4, 1);
      ctx.quadraticCurveTo(0, -sp, 4, 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /* body */
    ctx.beginPath();
    ctx.moveTo(pts[0].x + upN[0].x * ww[0], pts[0].y + upN[0].y * ww[0]);
    for (i = 1; i <= N; i++) ctx.lineTo(pts[i].x + upN[i].x * ww[i], pts[i].y + upN[i].y * ww[i]);
    for (i = N; i >= 0; i--) ctx.lineTo(pts[i].x - upN[i].x * ww[i], pts[i].y - upN[i].y * ww[i]);
    ctx.closePath();
    var bg = ctx.createLinearGradient(0, -18, 0, 20);
    bg.addColorStop(0, C.mintL);
    bg.addColorStop(0.55, C.mint);
    bg.addColorStop(1, C.mintM);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = C.line;
    ctx.stroke();

    /* warm cream belly band */
    ctx.beginPath();
    for (i = 0; i <= N; i++) {
      var px = pts[i].x - upN[i].x * ww[i] * 0.12;
      var py = pts[i].y - upN[i].y * ww[i] * 0.12;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (i = N; i >= 0; i--) {
      ctx.lineTo(pts[i].x - upN[i].x * ww[i] * 0.62, pts[i].y - upN[i].y * ww[i] * 0.62);
    }
    ctx.closePath();
    var cg = ctx.createLinearGradient(0, 0, 0, 18);
    cg.addColorStop(0, C.cream);
    cg.addColorStop(1, C.creamM);
    ctx.fillStyle = cg;
    ctx.fill();

    /* soft scale accents */
    ctx.strokeStyle = C.creamM;
    ctx.lineWidth = 1.2;
    for (i = 4; i <= N - 3; i += 3) {
      var sx = pts[i].x + upN[i].x * ww[i] * 0.35;
      var sy = pts[i].y + upN[i].y * ww[i] * 0.35;
      ctx.beginPath();
      ctx.arc(sx, sy, ww[i] * 0.32, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }

  function paw(x, y) {
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.mintM;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.arc(x - 3, y + 3, 1.2, 0, Math.PI * 2);
    ctx.arc(x, y + 4, 1.2, 0, Math.PI * 2);
    ctx.arc(x + 3, y + 3, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLegs() {
    paw(3, 13);
    paw(-11, 14);
  }

  function drawHorn(x, y, ang, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.quadraticCurveTo(2, -10, 0, -18 * a);
    ctx.quadraticCurveTo(-3, -10, -6, 2);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, 0, 0, -18 * a);
    g.addColorStop(0, C.creamD);
    g.addColorStop(1, C.cream);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = C.creamD;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawEye(x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y, 5 * s, 6.2 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, 3.6 * s, 0, Math.PI * 2);
    ctx.fillStyle = C.eye;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.9, 1.9 * s, 0, Math.PI * 2);
    ctx.fillStyle = "#16302A";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 1.3 * s, y - 1.7 * s, 1.4 * s, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 1.5 * s, y + 1.5 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHead() {
    /* small back fin behind the head */
    ctx.save();
    ctx.translate(-4, -12);
    ctx.rotate(-0.9);
    feather(0, 0, -0.2, 20, 6, C.cream, C.creamD);
    ctx.restore();

    drawHorn(2, -13, -0.5, 1);
    drawHorn(-8, -11, -0.95, 0.82);

    /* head */
    ctx.beginPath();
    ctx.ellipse(14, -1, 16, 15, 0, 0, Math.PI * 2);
    var hg = ctx.createLinearGradient(0, -16, 0, 14);
    hg.addColorStop(0, C.mintL);
    hg.addColorStop(1, C.mintM);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = C.line;
    ctx.stroke();

    /* snout */
    ctx.beginPath();
    ctx.ellipse(31, 5, 10, 8, -0.2, 0, Math.PI * 2);
    var sg = ctx.createLinearGradient(0, -3, 0, 13);
    sg.addColorStop(0, C.cream);
    sg.addColorStop(1, C.creamM);
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.stroke();

    /* chubby cheeks */
    ctx.save();
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = C.blush;
    ctx.beginPath();
    ctx.ellipse(9, 8, 6, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(25, 9.5, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* big sparkling eyes */
    drawEye(15, -4, 1);
    drawEye(28, -3.5, 1);

    /* nostrils */
    ctx.fillStyle = C.line;
    ctx.beginPath();
    ctx.arc(35.5, 3, 1, 0, Math.PI * 2);
    ctx.arc(35.5, 7, 1, 0, Math.PI * 2);
    ctx.fill();

    /* smile */
    ctx.beginPath();
    ctx.moveTo(38, 10);
    ctx.quadraticCurveTo(31, 13, 23, 11.5);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function drawSparkles(t) {
    var sp = [
      [-72, -44, 1.0], [66, -34, 1.4], [-42, 26, 1.2],
      [42, 22, 0.85], [-98, 2, 1.1], [90, 8, 1.3]
    ];
    for (var k = 0; k < sp.length; k++) {
      var a = 0.5 + 0.5 * Math.sin(t * 3 + k * 1.7);
      star(sp[k][0], sp[k][1], 5 * sp[k][2] * (0.7 + 0.5 * a), a * 0.9);
    }
  }

  function paintDragon(t, flap) {
    var s = spine(t);
    drawGlow();
    drawWing(flap + 0.7, -2, 0.34, 0.7);
    drawTailFin(s);
    drawBody(s);
    drawLegs();
    drawHead();
    drawWing(flap, 1, 0.24, 1);
    drawSparkles(t);
  }

  /* ---------------------------- Render loop ---------------------------- */
  function render(tMs) {
    ctx.clearRect(0, 0, w, h);
    if (isDark()) return;

    var t = tMs / 1000;
    var px, py, f, bnk;
    if (reduceMotion) {
      var pp = pathAt(progress);
      px = pp.x;
      py = pp.y;
      f = 1;
      bnk = 0;
    } else {
      px = curX;
      py = curY;
      f = face;
      bnk = bank;
    }

    var bob = reduceMotion ? 0 : Math.sin(t * 1.5) * (3 + idleMix * 5);
    var sway = reduceMotion ? 0 : Math.sin(t * 0.9) * idleMix * 0.05;
    var scale = baseScale() * (reduceMotion ? 1 : 1 + Math.sin(t * 1.1) * 0.02);

    ctx.save();
    ctx.translate(px, py + bob);
    ctx.scale(f * scale, scale);
    ctx.rotate(reduceMotion ? 0 : bnk + sway);
    paintDragon(t, reduceMotion ? 0 : flapPhase);
    ctx.restore();
  }

  function loop(tMs) {
    if (!running) return;
    var dt = lastT ? Math.min(0.05, (tMs - lastT) / 1000) : 0.016;
    lastT = tMs;
    progress += (target - progress) * 0.08;

    var idle = (tMs - lastScrollAt) > 200;
    idleMix += ((idle ? 1 : 0) - idleMix) * 0.06;
    flapPhase += dt * (2.4 + idleMix * 2.2);

    // Choose where the dragon wants to be: the scroll path, or - when idle - a
    // random point anywhere on screen (the whole viewport is its playground).
    var wantX, wantY;
    if (idle) {
      if (!wasIdle) pickWander();
      wander.timer -= dt;
      var dx = wander.x - curX;
      var dy = wander.y - curY;
      if (wander.timer <= 0 || Math.abs(dx) + Math.abs(dy) < 24) pickWander();
      wantX = wander.x;
      wantY = wander.y;
    } else {
      var p = pathAt(progress);
      wantX = p.x;
      wantY = p.y;
    }
    wasIdle = idle;

    // Glide toward the target (slow & floaty when roaming, snappier on scroll).
    var ease = idle ? 0.02 : 0.09;
    curX += (wantX - curX) * ease;
    curY += (wantY - curY) * ease;
    clampToScreen();

    var vx = curX - prevX;
    var vy = curY - prevY;
    prevX = curX;
    prevY = curY;

    // Facing follows the direction of travel by mirroring (never upside-down).
    var tFace = face >= 0 ? 1 : -1;
    if (Math.abs(vx) > 0.2) tFace = vx >= 0 ? 1 : -1;
    face += (tFace - face) * 0.06;

    // Gentle pitch that follows the vertical motion, damped at low speed so a
    // slow roam stays calm (and it can never flip over).
    var sp = Math.sqrt(vx * vx + vy * vy);
    var tBank = Math.atan2(vy, Math.abs(vx) + 0.001);
    tBank = Math.max(-0.9, Math.min(0.9, tBank)) * 0.5 * Math.min(1, sp / 3);
    bank += (tBank - bank) * 0.12;

    render(tMs);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (isDark()) return;
    if (reduceMotion) {
      progress = target;
      render(0);
      return;
    }
    if (running) return;
    running = true;
    lastT = 0;
    render(0);
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    ctx.clearRect(0, 0, w, h);
  }

  function sync() {
    if (isDark()) stop();
    else start();
  }

  window.addEventListener("scroll", function () {
    lastScrollAt = performance.now();
    computeScroll();
    if (reduceMotion && !running && !isDark()) {
      progress = target;
      render(0);
    }
  }, { passive: true });
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
