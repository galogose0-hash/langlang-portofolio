/* ==========================================================================
   Day goldfish - interactive 3D koi / goldfish (LIGHT MODE ONLY)
   --------------------------------------------------------------------------
   Built with Three.js. It replaces the old 2D dragon doodle for light mode.

   Highlights
   - Fully procedural 3D goldfish: plump body (lathe), orange -> gold gradient
     via vertex colours, translucent "veil" fins drawn from canvas textures.
   - Organic swimming: the body and every fin are deformed in the *vertex
     shader* with a travelling sine wave, so nothing ever looks stiff.
   - Gentle idle floating (bobbing + micro yaw/roll) even when the page is
     still, and a lively tail beat while the user scrolls.
   - Scroll aware: a smoothed (lerped) progress drives a swimming path across
     the viewport. The body orientation is built from its own velocity vector
     (lookAt-like) so it always faces the direction it is travelling.
   - Lightweight (a handful of meshes, no shadows), responsive (resize) and
     properly disposed (geometries, materials, textures, renderer).
   - Hidden / paused in dark mode, and when the tab is not visible.
   - Respects prefers-reduced-motion (renders a calm static pose).

   Loaded as a classic script, after the global Three.js build:
     <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
     <script src="assets/js/goldfish.js"></script>
   (A classic script is used so everything keeps working when the page is
   opened directly from disk via file://, which blocks ES modules.)
   ========================================================================== */
(function () {
  "use strict";

  var THREE = window.THREE;
  var canvas = document.getElementById("goldfishLayer");
  if (!canvas) return;
  if (!THREE) {
    console.warn("[goldfish] Three.js failed to load, the goldfish is disabled.");
    return;
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ------------------------------ Renderer ------------------------------ */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  /* -------------------------------- Scene -------------------------------- */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  camera.lookAt(0, 0, 0);

  var visW = 1;
  var visH = 1;

  /* --------------------- Soft, bright environment map --------------------- */
  // A warm studio gradient used as scene.environment. This keeps the Physical
  // materials looking glossy and "wet" without needing any external HDR file.
  var envRT = null;
  (function buildEnvironment() {
    var c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    var g = c.getContext("2d");
    var grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#fff6e6");
    grad.addColorStop(0.46, "#fdf6ec");
    grad.addColorStop(0.5, "#ffffff");
    grad.addColorStop(0.76, "#f0e4d2");
    grad.addColorStop(1, "#e2d3bd");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 512);
    var sun = g.createRadialGradient(300, 150, 8, 300, 150, 230);
    sun.addColorStop(0, "rgba(255,255,255,0.95)");
    sun.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sun;
    g.beginPath();
    g.arc(300, 150, 230, 0, Math.PI * 2);
    g.fill();

    var tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;

    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    envRT = pmrem.fromEquirectangular(tex);
    scene.environment = envRT.texture;
    tex.dispose();
    pmrem.dispose();
  })();

  /* ------------------------------- Lighting ------------------------------- */
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0xeadcc6, 1.15));
  var keyLight = new THREE.DirectionalLight(0xfff2dd, 2.0);
  keyLight.position.set(4, 6, 6);
  scene.add(keyLight);
  var fillLight = new THREE.DirectionalLight(0xdce8ff, 0.65);
  fillLight.position.set(-6, 2, 4);
  scene.add(fillLight);
  var rimLight = new THREE.DirectionalLight(0xffcf9a, 0.9);
  rimLight.position.set(-3, -5, -6);
  scene.add(rimLight);

  /* ------------------------------ Utilities ------------------------------ */
  function smoothstep(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  /* ------------------- Procedural fin textures (canvas) ------------------- */
  function goldRamp(ctx, size, cx, cy, r0, r1) {
    var g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    g.addColorStop(0.0, "rgba(238,132,26,0.95)");
    g.addColorStop(0.4, "rgba(247,176,72,0.72)");
    g.addColorStop(0.75, "rgba(255,220,150,0.30)");
    g.addColorStop(1.0, "rgba(255,240,205,0.0)");
    return g;
  }

  function drawRays(ctx, size, cx, cy, spread, len, count, alpha) {
    ctx.save();
    ctx.strokeStyle = "rgba(150,78,20," + alpha + ")";
    ctx.lineWidth = Math.max(1, size * 0.006);
    ctx.lineCap = "round";
    for (var i = 0; i <= count; i++) {
      var a = -spread + (i / count) * spread * 2;
      var l = len * (0.72 + 0.28 * Math.cos(a * 0.9));
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(a) * l, cy - Math.cos(a) * l);
      ctx.stroke();
    }
    ctx.restore();
  }

  function finCanvas(kind) {
    var S = 256;
    var c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    var baseX = 0.5 * S;
    var baseY = 0.99 * S;

    g.save();
    g.beginPath();
    if (kind === "tail") {
      // Elegant veiltail: two rounded lobes with a soft central notch.
      g.moveTo(0.45 * S, 0.99 * S);
      g.bezierCurveTo(0.18 * S, 0.88 * S, 0.03 * S, 0.62 * S, 0.07 * S, 0.31 * S);
      g.bezierCurveTo(0.09 * S, 0.13 * S, 0.24 * S, 0.03 * S, 0.35 * S, 0.11 * S);
      g.bezierCurveTo(0.45 * S, 0.18 * S, 0.47 * S, 0.31 * S, 0.50 * S, 0.42 * S);
      g.bezierCurveTo(0.53 * S, 0.31 * S, 0.55 * S, 0.18 * S, 0.65 * S, 0.11 * S);
      g.bezierCurveTo(0.76 * S, 0.03 * S, 0.91 * S, 0.13 * S, 0.93 * S, 0.31 * S);
      g.bezierCurveTo(0.97 * S, 0.62 * S, 0.82 * S, 0.88 * S, 0.55 * S, 0.99 * S);
      g.closePath();
    } else if (kind === "dorsal") {
      // Sail fin: tall, gently convex front, concave back.
      g.moveTo(0.16 * S, 0.99 * S);
      g.bezierCurveTo(0.22 * S, 0.55 * S, 0.34 * S, 0.14 * S, 0.47 * S, 0.06 * S);
      g.bezierCurveTo(0.60 * S, 0.20 * S, 0.72 * S, 0.62 * S, 0.86 * S, 0.99 * S);
      g.closePath();
    } else if (kind === "pectoral") {
      // Rounded paddle.
      g.moveTo(0.34 * S, 0.99 * S);
      g.bezierCurveTo(0.10 * S, 0.72 * S, 0.06 * S, 0.34 * S, 0.30 * S, 0.12 * S);
      g.bezierCurveTo(0.58 * S, 0.00 * S, 0.90 * S, 0.22 * S, 0.84 * S, 0.56 * S);
      g.bezierCurveTo(0.80 * S, 0.80 * S, 0.62 * S, 0.94 * S, 0.50 * S, 0.99 * S);
      g.closePath();
    } else {
      // Small anal / pelvic fan.
      g.moveTo(0.30 * S, 0.99 * S);
      g.bezierCurveTo(0.16 * S, 0.66 * S, 0.24 * S, 0.24 * S, 0.50 * S, 0.14 * S);
      g.bezierCurveTo(0.76 * S, 0.24 * S, 0.84 * S, 0.66 * S, 0.70 * S, 0.99 * S);
      g.closePath();
    }
    g.fillStyle = goldRamp(g, S, baseX, baseY, 0.02 * S, 0.95 * S);
    g.fill();
    g.restore();

    // Fin rays (ribbing) fanning out from the base.
    if (kind === "tail") drawRays(g, S, baseX, baseY, 1.18, 0.86 * S, 13, 0.16);
    else if (kind === "dorsal") drawRays(g, S, baseX, baseY, 0.62, 0.94 * S, 8, 0.18);
    else if (kind === "pectoral") drawRays(g, S, baseX, baseY, 0.78, 0.82 * S, 7, 0.18);
    else drawRays(g, S, baseX, baseY, 0.7, 0.82 * S, 6, 0.18);

    // Soft luminous rim so the translucent edge catches the light.
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.22;
    g.fillStyle = goldRamp(g, S, baseX, baseY, 0.02 * S, 0.98 * S);
    g.fill();
    g.restore();

    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    return tex;
  }

  /* ----------------------- Procedural scale bump map ----------------------- */
  function makeScaleTexture() {
    var S = 512;
    var c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    g.fillStyle = "#8a8a8a";
    g.fillRect(0, 0, S, S);
    var cols = 11;
    var rows = 15;
    var w = S / cols;
    var h = S / rows;
    for (var r = -1; r <= rows; r++) {
      for (var i = -1; i <= cols; i++) {
        var x = i * w + (r & 1 ? w * 0.5 : 0);
        var y = r * h;
        var rad = w * 0.62;
        var grd = g.createRadialGradient(x, y - rad * 0.35, 1, x, y, rad);
        grd.addColorStop(0, "rgba(255,255,255,0.6)");
        grd.addColorStop(1, "rgba(235,235,235,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, rad, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(104,104,104,0.5)";
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(x, y, rad * 0.9, 0.08 * Math.PI, 0.92 * Math.PI);
        g.stroke();
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 4);
    return tex;
  }

  /* ---------------------- Vertex-shader wave injection ---------------------- */
  // Deforms a material's vertices with a travelling sine wave. `axis` selects
  // which local axis is displaced (0..1), `grow` selects where the amplitude
  // builds up (0 = x/uv.x, 1 = y/uv.y).
  var animatedMaterials = [];

  function addWave(material, opts) {
    var unif = {
      uTime: { value: 0 },
      uAmp: { value: opts.amp },
      uFreq: { value: opts.freq },
      uSpeed: { value: opts.speed },
      uAxis: { value: opts.axis }, // 0 -> z (fin normal), 1 -> z from body x
      uGrow: { value: opts.grow }, // 0 -> uv.y (fin), 1 -> body length
      uHeadX: { value: opts.headX || 0 },
      uLen: { value: opts.len || 1 }
    };

    material.onBeforeCompile = function (shader) {
      shader.uniforms.uTime = unif.uTime;
      shader.uniforms.uAmp = unif.uAmp;
      shader.uniforms.uFreq = unif.uFreq;
      shader.uniforms.uSpeed = unif.uSpeed;
      shader.uniforms.uAxis = unif.uAxis;
      shader.uniforms.uGrow = unif.uGrow;
      shader.uniforms.uHeadX = unif.uHeadX;
      shader.uniforms.uLen = unif.uLen;

      shader.vertexShader =
        "uniform float uTime;\nuniform float uAmp;\nuniform float uFreq;\n" +
        "uniform float uSpeed;\nuniform float uAxis;\nuniform float uGrow;\n" +
        "uniform float uHeadX;\nuniform float uLen;\n" +
        shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        [
          "#include <begin_vertex>",
          "float waveGrow;",
          "float waveCoord;",
          "if (uGrow > 0.5) {",
          "  waveGrow = clamp((uHeadX - transformed.x) / uLen, 0.0, 1.0);",
          "  waveCoord = waveGrow;",
          "} else {",
          "  #ifdef USE_UV",
          "  waveGrow = uv.y;",
          "  waveCoord = uv.x;",
          "  #else",
          "  waveGrow = 0.0;",
          "  waveCoord = 0.0;",
          "  #endif",
          "}",
          "float waveAmp = uAmp * pow(waveGrow, 1.6);",
          "float waveVal = sin(uTime * uSpeed - waveCoord * uFreq + waveGrow * 2.0);",
          "transformed.z += waveAmp * waveVal;",
          "transformed.y += waveAmp * 0.12 * waveVal;"
        ].join("\n")
      );
    };

    material.userData.wave = unif;
    animatedMaterials.push(unif);
    return unif;
  }

  /* ------------------------------- Fish body ------------------------------- */
  var BODY_LEN = 2.6;
  var BODY_R = 0.62;

  function buildBodyGeometry() {
    // Normalised profile (radius, length) from tail base to nose tip.
    var profile = [
      [0.05, 0.0], [0.20, 0.08], [0.42, 0.17], [0.68, 0.28], [0.88, 0.38],
      [0.99, 0.47], [1.0, 0.55], [0.97, 0.63], [0.92, 0.71], [0.86, 0.78],
      [0.78, 0.85], [0.66, 0.91], [0.48, 0.96], [0.26, 1.0], [0.06, 1.02]
    ];
    var pts = profile.map(function (p) {
      return new THREE.Vector2(p[0] * BODY_R, p[1] * BODY_LEN);
    });
    var geo = new THREE.LatheGeometry(pts, 64);
    geo.rotateZ(-Math.PI / 2); // align the body axis with +X (nose forward)
    geo.center();
    geo.computeBoundingBox();

    // Gold gradient painted into vertex colours.
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var cBelly = new THREE.Color("#ffe6b8");
    var cMid = new THREE.Color("#f6a236");
    var cBack = new THREE.Color("#df6317");
    var cHead = new THREE.Color("#f7c34c");
    var tmp = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var topness = clamp((y / BODY_R) * 0.5 + 0.5, 0, 1);
      tmp.copy(cBelly);
      tmp.lerp(cMid, smoothstep(0.26, 0.6, topness));
      tmp.lerp(cBack, smoothstep(0.62, 0.98, topness));
      tmp.lerp(cHead, smoothstep(0.15, 1.32, x) * 0.32);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }

  var fish = new THREE.Group();
  var root = new THREE.Group(); // extra group for idle micro-motion
  fish.add(root);
  scene.add(fish);

  var bodyGeo = buildBodyGeometry();
  var scaleTex = makeScaleTexture();
  var bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.34,
    metalness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.2,
    sheen: 0.7,
    sheenColor: new THREE.Color("#ffd98a"),
    sheenRoughness: 0.5,
    bumpMap: scaleTex,
    bumpScale: 0.016,
    envMapIntensity: 1.15
  });
  var maxX = bodyGeo.boundingBox.max.x;
  var bodyUniform = addWave(bodyMat, {
    amp: 0.13,
    freq: 4.2,
    speed: 2.0,
    grow: 1,
    headX: maxX,
    len: BODY_LEN * 1.02
  });
  var bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  root.add(bodyMesh);

  /* ------------------------------ Fish parts ------------------------------ */
  function addFin(w, h, kind, amp, freq, speed) {
    var geo = new THREE.PlaneGeometry(w, h, 4, 10);
    geo.translate(0, h / 2, 0); // base at y = 0, tip at y = h
    var tex = finCanvas(kind);
    var mat = new THREE.MeshPhysicalMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.4,
      metalness: 0.0,
      alphaTest: 0.02,
      envMapIntensity: 0.9,
      emissive: new THREE.Color("#e8861c"),
      emissiveIntensity: 0.06
    });
    var unif = addWave(mat, { amp: amp, freq: freq, speed: speed, grow: 0 });
    unif.amp0 = amp;
    unif.speed0 = speed;
    var mesh = new THREE.Mesh(geo, mat);
    mesh.userData.unif = unif;
    return mesh;
  }

  // Dorsal (sail on the back).
  var dorsal = addFin(1.25, 0.62, "dorsal", 0.14, 3.0, 3.0);
  dorsal.position.set(-0.16, 0.4, 0);
  root.add(dorsal);

  // Pectoral fins (one per side).
  var pectoralL = addFin(0.52, 0.52, "pectoral", 0.13, 2.2, 4.6);
  pectoralL.position.set(0.32, -0.16, 0.46);
  pectoralL.rotation.set(-0.55, -0.25, 2.15);
  root.add(pectoralL);

  var pectoralR = addFin(0.52, 0.52, "pectoral", 0.13, 2.2, 4.6);
  pectoralR.position.set(0.32, -0.16, -0.46);
  pectoralR.rotation.set(0.55, 0.25, 2.15);
  root.add(pectoralR);

  // Anal / pelvic fin (underside, near the tail).
  var anal = addFin(0.56, 0.5, "anal", 0.13, 2.4, 3.2);
  anal.position.set(-0.68, -0.44, 0);
  anal.rotation.z = 2.55;
  root.add(anal);

  // Veiltail: two flowing lobes forming a soft V.
  var tailGroup = new THREE.Group();
  tailGroup.position.set(-1.24, 0, 0);
  tailGroup.rotation.z = Math.PI / 2; // grow the fin toward -X (backwards)
  root.add(tailGroup);

  var tailA = addFin(1.6, 1.85, "tail", 0.42, 2.4, 2.6);
  tailA.rotation.set(0.45, 0, 0);
  tailGroup.add(tailA);

  var tailB = addFin(1.6, 1.85, "tail", 0.42, 2.4, 2.6);
  tailB.rotation.set(-0.45, 0, 0);
  tailGroup.add(tailB);

  /* --------------------------------- Eyes --------------------------------- */
  function addEye(side) {
    var eye = new THREE.Group();
    var ballR = 0.135;
    var ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballR, 24, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0xfbf7ec,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.2
      })
    );
    eye.add(ball);

    var pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 20, 16),
      new THREE.MeshPhysicalMaterial({ color: 0x141210, roughness: 0.25, clearcoat: 1 })
    );
    pupil.position.set(0.03, 0, ballR * 0.86);
    eye.add(pupil);

    var glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    glint.position.set(0.05, 0.05, ballR * 0.98);
    eye.add(glint);

    eye.position.set(0.94, 0.17, side * 0.4);
    return eye;
  }
  root.add(addEye(1));
  root.add(addEye(-1));

  // Small mouth hint at the nose.
  var mouth = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 12),
    new THREE.MeshPhysicalMaterial({ color: 0x9c4310, roughness: 0.5 })
  );
  mouth.scale.set(1.0, 0.55, 0.7);
  mouth.position.set(1.31, -0.04, 0);
  root.add(mouth);

  /* --------------------------- Motion state --------------------------- */
  var progress = 0;
  var target = 0;
  var maxScroll = 1;
  var lastScrollAt = -1e9;
  var activity = 0; // 0..1 based on recent scroll activity
  var idleMix = 0; // 0..1 idle vs scrolling
  var fishScale = 1;
  var marginX = 1;
  var marginY = 1;

  var curX = 0;
  var curY = 0;
  var prevX = 0;
  var prevY = 0;
  var inited = false;
  var wasIdle = true;
  var wander = { x: 0, y: 0, timer: 0 };

  var baseQuat = new THREE.Quaternion();
  var targetQuat = new THREE.Quaternion();
  var tmpMat = new THREE.Matrix4();
  var vDir = new THREE.Vector3();
  var vRight = new THREE.Vector3();
  var vUp = new THREE.Vector3();
  var vVel = new THREE.Vector3();
  var vOffset = new THREE.Quaternion();
  var eulerOffset = new THREE.Euler();

  var mouseX = 0;
  var mouseY = 0;

  var w = 0;
  var h = 0;
  var running = false;
  var rafId = null;
  var lastT = 0;
  var clock = new THREE.Clock();

  /* ----------------------------- Sizing ----------------------------- */
  function updateDims() {
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    var vfov = (camera.fov * Math.PI) / 180;
    visH = 2 * Math.tan(vfov / 2) * camera.position.z;
    visW = visH * camera.aspect;
    fishScale = clamp((0.42 * Math.min(visW, visH)) / BODY_LEN, 0.5, 1.35);
    fish.scale.setScalar(fishScale);
    // Keep the whole fish (nose + long veiltail) inside the viewport.
    marginX = Math.max(0.4, visW * 0.5 - 3.2 * fishScale);
    marginY = Math.max(0.4, visH * 0.5 - 1.6 * fishScale);
  }

  function computeScroll() {
    var top = window.pageYOffset || document.documentElement.scrollTop || 0;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - h);
    target = clamp(top / maxScroll, 0, 1);
  }

  /* ----------------------- Swimming path / roaming ----------------------- */
  function pathAt(p) {
    var x = (-0.3 + p * 0.6) * visW + Math.sin(p * Math.PI * 1.3 + 0.5) * visW * 0.05;
    var y = (0.24 - p * 0.5) * visH + Math.sin(p * Math.PI * 2.1 + 1.0) * visH * 0.04;
    return { x: clamp(x, -marginX, marginX), y: clamp(y, -marginY, marginY) };
  }

  function pickWander() {
    wander.x = (Math.random() * 2 - 1) * marginX;
    wander.y = (Math.random() * 2 - 1) * marginY;
    wander.timer = 2.6 + Math.random() * 3.0;
  }

  /* --------------------------------- Loop --------------------------------- */
  function updateOrientation(dt) {
    vVel.set(curX - prevX, curY - prevY, 0);
    var sp = vVel.length();
    if (sp > 0.015) {
      vDir.copy(vVel).normalize();
      vRight.crossVectors(vDir, vUp.set(0, 1, 0));
      if (vRight.lengthSq() < 1e-5) vRight.set(0, 0, 1);
      vRight.normalize();
      vUp.crossVectors(vRight, vDir).normalize();
      tmpMat.makeBasis(vDir, vUp, vRight);
      targetQuat.setFromRotationMatrix(tmpMat);
    }
    baseQuat.slerp(targetQuat, Math.min(1, dt * 4.5));
  }

  function tick(t) {
    var dt = Math.min(clock.getDelta(), 0.05);
    var scrollActive = performance.now() - lastScrollAt < 160;
    var targetActivity = scrollActive ? 1 : 0;
    activity += (targetActivity - activity) * 0.07;

    var idle = !scrollActive;
    idleMix += ((idle ? 1 : 0) - idleMix) * 0.05;

    progress += (target - progress) * 0.08;

    // Choose where the fish wants to be.
    var wantX, wantY;
    if (idle) {
      if (!wasIdle) pickWander();
      wander.timer -= dt;
      var dx = wander.x - curX;
      var dy = wander.y - curY;
      if (wander.timer <= 0 || Math.abs(dx) + Math.abs(dy) < 0.2) pickWander();
      wantX = wander.x;
      wantY = wander.y;
    } else {
      var p = pathAt(progress);
      wantX = p.x;
      wantY = p.y;
    }
    wasIdle = idle;

    var ease = idle ? 0.02 : 0.075;
    curX += (wantX - curX) * ease;
    curY += (wantY - curY) * ease;

    updateOrientation(dt);

    // Idle micro-motion: yaw/roll shimmer + floating bob.
    var idleYaw = Math.sin(t * 0.7) * 0.06 * idleMix;
    var idleRoll = Math.sin(t * 0.9 + 1.3) * 0.05 * idleMix;
    eulerOffset.set(idleRoll, idleYaw, 0);
    vOffset.setFromEuler(eulerOffset);
    fish.quaternion.copy(baseQuat).multiply(vOffset);

    var bobY = Math.sin(t * 1.4) * (0.07 + idleMix * 0.13);
    var bobX = Math.sin(t * 1.9 + 0.6) * (0.05 + idleMix * 0.06);
    var fishZ = Math.sin(t * 0.5) * 0.55 * (1 - activity * 0.6);
    var mx = finePointer ? -mouseX * 0.35 : 0;
    var my = finePointer ? mouseY * 0.35 : 0;

    fish.position.set(curX + bobX + mx, curY + bobY + my, fishZ);

    prevX = curX;
    prevY = curY;

    // Drive every vertex-shader wave from the same animation clock.
    for (var i = 0; i < animatedMaterials.length; i++) {
      var u = animatedMaterials[i];
      u.uTime.value = t;
    }
    var act = activity;
    bodyUniform.uAmp.value = 0.12 + 0.09 * act + 0.02 * idleMix;
    bodyUniform.uSpeed.value = 1.7 + 1.7 * act + 0.4 * idleMix;
    for (var j = 0; j < animatedMaterials.length; j++) {
      var fu = animatedMaterials[j];
      if (fu.amp0 !== undefined) {
        fu.uAmp.value = fu.amp0 * (0.8 + 0.9 * act + 0.25 * idleMix);
        fu.uSpeed.value = fu.speed0 * (0.85 + 0.7 * act + 0.2 * idleMix);
      }
    }

    renderer.render(scene, camera);
  }

  function loop(tMs) {
    if (!running) return;
    tick(tMs / 1000);
    rafId = requestAnimationFrame(loop);
  }

  /* ------------------------------ Lifecycle ------------------------------ */
  function renderStatic() {
    // Reduced-motion pose: calm and still, only reflecting scroll position.
    var p = pathAt(progress);
    curX = p.x;
    curY = p.y;
    fish.position.set(curX, curY, 0);
    if (!inited) {
      targetQuat.identity();
      baseQuat.identity();
      inited = true;
    }
    bodyUniform.uTime.value = 0;
    for (var i = 0; i < animatedMaterials.length; i++) animatedMaterials[i].uTime.value = 0;
    renderer.render(scene, camera);
  }

  function resize() {
    updateDims();
    computeScroll();
    if (!inited) {
      var p = pathAt(progress);
      curX = prevX = p.x;
      curY = prevY = p.y;
      baseQuat.identity();
      targetQuat.identity();
      inited = true;
      pickWander();
    }
    curX = clamp(curX, -marginX, marginX);
    curY = clamp(curY, -marginY, marginY);
    if (!running && !isDark()) renderStatic();
  }

  function start() {
    if (isDark()) return;
    if (reduceMotion) {
      progress = target;
      renderStatic();
      return;
    }
    if (running) return;
    running = true;
    lastT = 0;
    clock.start();
    tick(0);
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    clock.stop();
  }

  function sync() {
    if (isDark()) stop();
    else start();
  }

  function isDark() {
    return document.documentElement.classList.contains("dark");
  }

  function dispose() {
    stop();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", resize);
    window.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("visibilitychange", onVisibility);
    if (mutationObserver) mutationObserver.disconnect();

    scene.traverse(function (obj) {
      if (obj.isMesh) {
        if (obj.geometry) obj.geometry.dispose();
        var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(function (m) {
          if (!m) return;
          ["map", "bumpMap", "normalMap", "emissiveMap", "roughnessMap", "metalnessMap"].forEach(function (key) {
            if (m[key] && m[key].dispose) m[key].dispose();
          });
          m.dispose();
        });
      }
    });

    if (envRT) envRT.dispose();
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
  }

  /* ------------------------------- Events ------------------------------- */
  function onScroll() {
    lastScrollAt = performance.now();
    computeScroll();
    if (reduceMotion && !isDark()) {
      if (!running) renderStatic();
    }
  }
  function onMouseMove(e) {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  }
  function onVisibility() {
    if (document.hidden) stop();
    else sync();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", resize);
  if (finePointer) window.addEventListener("mousemove", onMouseMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  var mutationObserver = new MutationObserver(sync);
  mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  window.GoldfishBackground = { dispose: dispose, start: start, stop: stop };

  resize();
  sync();
})();
