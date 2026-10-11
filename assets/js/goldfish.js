/* ==========================================================================
   Day goldfish - living 3D goldfish with skeletal animation (LIGHT MODE ONLY)
   --------------------------------------------------------------------------
   Replaces the old 2D dragon doodle. Built with the Three.js global (UMD)
   build so it also works when index.html is opened straight from file://.

   Anatomy (anti "bloated / stiff / flat")
   - PARAMETRIC EGG BODY: rings along X with an ASYMMETRIC cross-section.
     The back arches high, the belly hangs deep and the sides are laterally
     compressed (narrow in Z) - a real fancy-goldfish silhouette instead of a
     round tube. Catmull-Rom control curves keep every transition smooth.
   - SHARED SKELETON: one THREE.Skeleton of 10 spine bones + a 3-bone tail
     chain drives BOTH the body SkinnedMesh and the flowing veil-tail meshes.
     Linear blend skinning travels the deformation continuously to the fin.
   - WAVE + TURN S-CURVE: a travelling propulsive wave runs head -> tail while
     the mid-body counter-bends against the tail (dynamic S-curve); steering
     adds a gentle S offset so turns look planned, not pivoted.
   - SPRING INERTIA: every bone is driven through a critically-ish damped
     spring, so the body, tail and head visibly LAG the muscle and settle.
     Stiff on the spine, soft on the tail -> secondary motion, no stiffness.
   - TAIL DROOP: the veil tail loses lift and sags down under gravity as the
     fish slows, and streams straight back when it bursts.
   - SHADING: MeshPhysicalMaterial with iridescence, a procedurally generated
     1024px overlapping-scale normal map, sheen and clearcoat on the body;
     translucent transmissive fins for a light-through-membrane (SSS) look.
   - FRESNEL RIM: an onBeforeCompile injection adds a view-dependent bright
     edge (warm gold) so the fish separates from the bright cream page.
   - CONVEX LENS EYES: clear transmissive cornea over a glossy iris + glint.

   Lifecycle: hidden & paused in dark mode, paused when the tab is hidden,
   reacts to resize, respects prefers-reduced-motion and disposes fully.

   Load after the global build:
     <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
     <script src="assets/js/goldfish.js"></script>
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

  var TAU = Math.PI * 2;
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
  renderer.toneMappingExposure = 1.06;

  /* -------------------------------- Scene -------------------------------- */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  camera.lookAt(0, 0, 0);

  var visW = 1;
  var visH = 1;

  /* --------------------- Soft, bright environment map --------------------- */
  var envRT = null;
  (function buildEnvironment() {
    var c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    var g = c.getContext("2d");
    var grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#fff7e8");
    grad.addColorStop(0.46, "#fdf6ec");
    grad.addColorStop(0.5, "#ffffff");
    grad.addColorStop(0.76, "#f0e4d2");
    grad.addColorStop(1, "#e2d3bd");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 512);
    var sun = g.createRadialGradient(300, 140, 8, 300, 140, 240);
    sun.addColorStop(0, "rgba(255,255,255,0.95)");
    sun.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sun;
    g.beginPath();
    g.arc(300, 140, 240, 0, TAU);
    g.fill();
    var cool = g.createRadialGradient(760, 380, 10, 760, 380, 280);
    cool.addColorStop(0, "rgba(214,232,255,0.55)");
    cool.addColorStop(1, "rgba(214,232,255,0)");
    g.fillStyle = cool;
    g.beginPath();
    g.arc(760, 380, 280, 0, TAU);
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
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0xeadcc6, 1.05));
  var keyLight = new THREE.DirectionalLight(0xfff2dd, 2.0);
  keyLight.position.set(4, 6, 6);
  scene.add(keyLight);
  var fillLight = new THREE.DirectionalLight(0xdce8ff, 0.62);
  fillLight.position.set(-6, 2, 4);
  scene.add(fillLight);
  var rimLight = new THREE.DirectionalLight(0xffcf9a, 1.0);
  rimLight.position.set(-3, -4, -6);
  scene.add(rimLight);

  /* ------------------------------ Utilities ------------------------------ */
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }
  function catmull(p0, p1, p2, p3, t) {
    var t2 = t * t;
    var t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  // Smooth Catmull-Rom sample of a scalar control array, u in [0,1].
  function sampleCurve(arr, u) {
    var n = arr.length;
    if (n === 1) return arr[0];
    var f = clamp(u, 0, 1) * (n - 1);
    var i1 = Math.floor(f);
    var i2 = Math.min(i1 + 1, n - 1);
    var i0 = Math.max(i1 - 1, 0);
    var i3 = Math.min(i2 + 1, n - 1);
    return catmull(arr[i0], arr[i1], arr[i2], arr[i3], f - i1);
  }

  /* ------------------------- Scale normal map ---------------------------- */
  function makeScaleNormalMap() {
    var S = 1024;
    var height = document.createElement("canvas");
    height.width = height.height = S;
    var h = height.getContext("2d");
    h.fillStyle = "#808080";
    h.fillRect(0, 0, S, S);
    // Overlapping rhombic (diamond) scales, offset per row like a fish.
    var cols = 26;
    var rows = 34;
    var w = S / cols;
    var hh = S / rows;
    for (var r = -1; r <= rows; r++) {
      for (var i = -1; i <= cols; i++) {
        var x = i * w + (r & 1 ? w * 0.5 : 0);
        var y = r * hh;
        var rad = w * 0.66;
        var grd = h.createRadialGradient(x, y - rad * 0.45, 1, x, y, rad);
        grd.addColorStop(0, "rgba(255,255,255,0.9)");
        grd.addColorStop(0.62, "rgba(150,150,150,0.28)");
        grd.addColorStop(1, "rgba(80,80,80,0.0)");
        h.fillStyle = grd;
        h.beginPath();
        h.arc(x, y, rad, 0, TAU);
        h.fill();
        // darker trailing rim of the scale
        h.strokeStyle = "rgba(52,52,52,0.7)";
        h.lineWidth = 1.6;
        h.beginPath();
        h.arc(x, y, rad * 0.9, 0.12 * Math.PI, 0.88 * Math.PI);
        h.stroke();
      }
    }

    var src = h.getImageData(0, 0, S, S).data;
    var out = h.createImageData(S, S);
    var strength = 2.4;
    function H(x, y) {
      x = (x + S) % S;
      y = (y + S) % S;
      return src[(y * S + x) * 4] / 255;
    }
    for (var yy = 0; yy < S; yy++) {
      for (var xx = 0; xx < S; xx++) {
        var dx = (H(xx - 1, yy) - H(xx + 1, yy)) * strength;
        var dy = (H(xx, yy - 1) - H(xx, yy + 1)) * strength;
        var len = Math.sqrt(dx * dx + dy * dy + 1);
        var o = (yy * S + xx) * 4;
        out.data[o] = Math.round((dx / len) * 127.5 + 127.5);
        out.data[o + 1] = Math.round((dy / len) * 127.5 + 127.5);
        out.data[o + 2] = Math.round((1 / len) * 127.5 + 127.5);
        out.data[o + 3] = 255;
      }
    }
    var nm = document.createElement("canvas");
    nm.width = nm.height = S;
    nm.getContext("2d").putImageData(out, 0, 0);
    var tex = new THREE.CanvasTexture(nm);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5.5, 3.2);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  /* ------------------- Procedural fin textures (canvas) ------------------- */
  function goldRamp(ctx, cx, cy, r0, r1) {
    var g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    g.addColorStop(0.0, "rgba(236,126,22,0.95)");
    g.addColorStop(0.4, "rgba(247,176,72,0.72)");
    g.addColorStop(0.75, "rgba(255,220,150,0.30)");
    g.addColorStop(1.0, "rgba(255,240,205,0.0)");
    return g;
  }
  function drawRays(ctx, cx, cy, spread, len, count, alpha) {
    ctx.save();
    ctx.strokeStyle = "rgba(150,78,20," + alpha + ")";
    ctx.lineWidth = 1.4;
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
  function finTexture(kind) {
    var S = 256;
    var c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    var baseX = 0.5 * S;
    var baseY = 0.99 * S;

    g.beginPath();
    if (kind === "tail") {
      // broad flowing veil with a soft central notch
      g.moveTo(0.42 * S, 0.99 * S);
      g.bezierCurveTo(0.12 * S, 0.86 * S, 0.02 * S, 0.55 * S, 0.08 * S, 0.27 * S);
      g.bezierCurveTo(0.12 * S, 0.1 * S, 0.3 * S, 0.02 * S, 0.4 * S, 0.14 * S);
      g.bezierCurveTo(0.47 * S, 0.24 * S, 0.48 * S, 0.36 * S, 0.5 * S, 0.5 * S);
      g.bezierCurveTo(0.52 * S, 0.36 * S, 0.53 * S, 0.24 * S, 0.6 * S, 0.14 * S);
      g.bezierCurveTo(0.7 * S, 0.02 * S, 0.88 * S, 0.1 * S, 0.92 * S, 0.27 * S);
      g.bezierCurveTo(0.98 * S, 0.55 * S, 0.88 * S, 0.86 * S, 0.58 * S, 0.99 * S);
    } else if (kind === "dorsal") {
      g.moveTo(0.14 * S, 0.99 * S);
      g.bezierCurveTo(0.2 * S, 0.52 * S, 0.32 * S, 0.12 * S, 0.46 * S, 0.05 * S);
      g.bezierCurveTo(0.6 * S, 0.18 * S, 0.74 * S, 0.6 * S, 0.88 * S, 0.99 * S);
    } else if (kind === "pectoral") {
      g.moveTo(0.34 * S, 0.99 * S);
      g.bezierCurveTo(0.1 * S, 0.72 * S, 0.06 * S, 0.34 * S, 0.3 * S, 0.12 * S);
      g.bezierCurveTo(0.58 * S, 0.0 * S, 0.9 * S, 0.22 * S, 0.84 * S, 0.56 * S);
      g.bezierCurveTo(0.8 * S, 0.8 * S, 0.62 * S, 0.94 * S, 0.5 * S, 0.99 * S);
    } else {
      g.moveTo(0.3 * S, 0.99 * S);
      g.bezierCurveTo(0.16 * S, 0.66 * S, 0.24 * S, 0.24 * S, 0.5 * S, 0.14 * S);
      g.bezierCurveTo(0.76 * S, 0.24 * S, 0.84 * S, 0.66 * S, 0.7 * S, 0.99 * S);
    }
    g.closePath();
    g.fillStyle = goldRamp(g, baseX, baseY, 0.02 * S, 0.95 * S);
    g.fill();

    if (kind === "tail") drawRays(g, baseX, baseY, 1.2, 0.9 * S, 15, 0.16);
    else if (kind === "dorsal") drawRays(g, baseX, baseY, 0.62, 0.94 * S, 8, 0.18);
    else if (kind === "pectoral") drawRays(g, baseX, baseY, 0.78, 0.82 * S, 7, 0.18);
    else drawRays(g, baseX, baseY, 0.7, 0.82 * S, 6, 0.18);

    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.18;
    g.fill();
    g.restore();

    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  /* --------------------- Fresnel rim shader injection -------------------- */
  function addRim(material, strength, hex) {
    var uni = {
      uRimStrength: { value: strength },
      uRimColor: { value: new THREE.Color(hex) }
    };
    material.userData.rim = uni;
    material.onBeforeCompile = function (shader) {
      shader.uniforms.uRimStrength = uni.uRimStrength;
      shader.uniforms.uRimColor = uni.uRimColor;
      shader.fragmentShader =
        "uniform vec3 uRimColor;\nuniform float uRimStrength;\n" +
        shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          "vec3 rimDir = normalize( vViewPosition );\n" +
            "float rimF = 1.0 - clamp( dot( normalize( normal ), rimDir ), 0.0, 1.0 );\n" +
            "rimF = pow( rimF, 3.0 );\n" +
            "outgoingLight += uRimColor * ( uRimStrength * rimF );\n" +
            "#include <opaque_fragment>"
        );
    };
    material.customProgramCacheKey = function () {
      return "rim_" + strength;
    };
    return material;
  }

  /* ============================== ARMATURE =============================== */
  var NOSE_X = 1.32; // rounded snout tip
  var TAIL_X = -1.3; // caudal peduncle / tail base
  var BODY_LEN = NOSE_X - TAIL_X;
  var SPINE_COUNT = 10;
  var ROOT_X = 0.95; // head end of the spine
  var TAIL_BONES = 3;
  var TAIL_SEG = 0.6;
  var TAIL_LEN = TAIL_SEG * TAIL_BONES; // 1.8

  // Anatomical profile control curves, u = 0 (tail) .. 1 (nose).
  // High arched back, deep belly, laterally compressed (rZ << rTop).
  var C_TOP = [0.05, 0.22, 0.42, 0.62, 0.74, 0.79, 0.75, 0.64, 0.44, 0.13];
  var C_BOT = [0.05, 0.24, 0.47, 0.66, 0.74, 0.72, 0.66, 0.55, 0.40, 0.15];
  var C_Z = [0.03, 0.13, 0.24, 0.34, 0.41, 0.44, 0.41, 0.35, 0.26, 0.10];

  function bodyU(x) {
    return clamp((x - TAIL_X) / BODY_LEN, 0, 1);
  }

  var spineBones = [];
  var tailBones = [];
  var allBones = [];
  var boneX = [];

  function makeSpring() {
    return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  }
  function springTo(s, tx, ty, tz, k, d, dt) {
    var steps = Math.min(6, Math.max(1, Math.ceil(dt / 0.0167)));
    var h = dt / steps;
    for (var i = 0; i < steps; i++) {
      s.vx += ((tx - s.x) * k - s.vx * d) * h;
      s.x += s.vx * h;
      s.vy += ((ty - s.y) * k - s.vy * d) * h;
      s.y += s.vy * h;
      s.vz += ((tz - s.z) * k - s.vz * d) * h;
      s.z += s.vz * h;
    }
  }

  function buildSpine() {
    var prev = 0;
    for (var i = 0; i < SPINE_COUNT; i++) {
      var t = SPINE_COUNT === 1 ? 0 : i / (SPINE_COUNT - 1);
      var x = ROOT_X + (TAIL_X - ROOT_X) * t;
      boneX.push(x);
      var b = new THREE.Bone();
      b.position.set(i === 0 ? x : x - prev, 0, 0);
      b.userData.spr = makeSpring();
      prev = x;
      spineBones.push(b);
      allBones.push(b);
      if (i > 0) spineBones[i - 1].add(b);
    }
    prev = TAIL_X;
    for (var j = 0; j < TAIL_BONES; j++) {
      var tx = TAIL_X - TAIL_SEG * (j + 1);
      var tb = new THREE.Bone();
      tb.position.set(tx - prev, 0, 0);
      tb.userData.spr = makeSpring();
      prev = tx;
      tailBones.push(tb);
      allBones.push(tb);
      if (j === 0) spineBones[SPINE_COUNT - 1].add(tb);
      else tailBones[j - 1].add(tb);
    }
  }
  function boneIndexAtX(x) {
    var t = clamp((ROOT_X - x) / (ROOT_X - TAIL_X), 0, 1);
    return Math.min(SPINE_COUNT - 1, Math.round(t * (SPINE_COUNT - 1)));
  }

  /* --------------------------- Body geometry ----------------------------- */
  var C_BELLY = new THREE.Color("#ffe9c2");
  var C_MID = new THREE.Color("#f4a233");
  var C_BACK = new THREE.Color("#d9611a");
  var C_HEAD = new THREE.Color("#f8c94e");

  function buildBodyGeometry() {
    var RINGS = 76;
    var SEGS = 48;
    var geo = new THREE.BufferGeometry();
    var posArr = [];
    var uvArr = [];
    var colArr = [];
    var tmp = new THREE.Color();

    function pushRing(u, x, scaleCenter) {
      var rTop = sampleCurve(C_TOP, u);
      var rBot = sampleCurve(C_BOT, u);
      var rZ = sampleCurve(C_Z, u);
      var rMid = 0.5 * (rTop + rBot);
      var rAmp = 0.5 * (rTop - rBot);
      for (var si = 0; si < SEGS; si++) {
        var th = (si / SEGS) * TAU;
        var s = Math.sin(th);
        var cz = Math.cos(th);
        var r = rMid + rAmp * s;
        var y = r * s;
        var z = rZ * cz;
        if (scaleCenter) {
          y *= 0.0;
          z *= 0.0;
        }
        posArr.push(x, y, z);
        uvArr.push(si / SEGS, u);
        // colour by how "top" the vertex is on the cross-section
        var topness = clamp(s * 0.5 + 0.5, 0, 1);
        tmp.copy(C_BELLY);
        tmp.lerp(C_MID, smoothstep(0.24, 0.6, topness));
        tmp.lerp(C_BACK, smoothstep(0.62, 1.0, topness));
        tmp.lerp(C_HEAD, smoothstep(0.72, 1.15, u) * 0.4);
        colArr.push(tmp.r, tmp.g, tmp.b);
      }
    }

    for (var ri = 0; ri < RINGS; ri++) {
      var u = ri / (RINGS - 1);
      pushRing(u, TAIL_X + BODY_LEN * u, false);
    }

    var idx = [];
    for (var rr = 0; rr < RINGS - 1; rr++) {
      for (var sj = 0; sj < SEGS; sj++) {
        var a = rr * SEGS + sj;
        var b = rr * SEGS + ((sj + 1) % SEGS);
        var c2 = (rr + 1) * SEGS + ((sj + 1) % SEGS);
        var d = (rr + 1) * SEGS + sj;
        idx.push(a, b, d, b, c2, d);
      }
    }

    // Nose + tail apex caps.
    var noseIdx = posArr.length / 3;
    posArr.push(NOSE_X + 0.05, 0, 0);
    uvArr.push(0.5, 1);
    colArr.push(C_HEAD.r, C_HEAD.g, C_HEAD.b);
    var tailIdx = posArr.length / 3;
    posArr.push(TAIL_X - 0.04, 0, 0);
    uvArr.push(0.5, 0);
    colArr.push(C_MID.r, C_MID.g, C_MID.b);

    var lastRing = (RINGS - 1) * SEGS;
    var firstRing = 0;
    for (var s2 = 0; s2 < SEGS; s2++) {
      var n0 = lastRing + s2;
      var n1 = lastRing + ((s2 + 1) % SEGS);
      idx.push(noseIdx, n0, n1);
      var t0 = firstRing + ((s2 + 1) % SEGS);
      var t1 = firstRing + s2;
      idx.push(tailIdx, t0, t1);
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colArr, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    // Winding safety: make sure normals face outward (away from the spine axis).
    var nrm = geo.attributes.normal;
    var p = geo.attributes.position;
    var outwardDot = 0;
    var step = Math.max(1, Math.floor(p.count / 200));
    for (var vi = 0; vi < p.count; vi += step) {
      var vx = p.getX(vi);
      var vy = p.getY(vi);
      var vz = p.getZ(vi);
      var rl = Math.sqrt(vy * vy + vz * vz) || 1;
      outwardDot += (nrm.getX(vi) * 0 + nrm.getY(vi) * (vy / rl) + nrm.getZ(vi) * (vz / rl));
    }
    if (outwardDot < 0) {
      var idxArr = geo.index.array;
      for (var f = 0; f < idxArr.length; f += 3) {
        var swap = idxArr[f + 1];
        idxArr[f + 1] = idxArr[f + 2];
        idxArr[f + 2] = swap;
      }
      geo.index.needsUpdate = true;
      geo.computeVertexNormals();
    }
    return geo;
  }

  function skinByX(geo, boneList, x0, x1) {
    var pos = geo.attributes.position;
    var n = pos.count;
    var skinIndex = new Uint16Array(n * 4);
    var skinWeight = new Float32Array(n * 4);
    var span = x0 - x1;
    var last = boneList.length - 1;
    for (var i = 0; i < n; i++) {
      var t = clamp((x0 - pos.getX(i)) / span, 0, 1);
      var p = t * last;
      var i0 = Math.min(last, Math.floor(p));
      var i1 = Math.min(last, i0 + 1);
      var fw = p - i0;
      skinIndex[i * 4] = boneList[i0];
      skinWeight[i * 4] = 1 - fw;
      skinIndex[i * 4 + 1] = boneList[i1];
      skinWeight[i * 4 + 1] = fw;
    }
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  }

  /* ---------------------------- Tail geometry ---------------------------- */
  var tailBoneList = null; // filled after spine exists
  function buildTailMembrane(opts) {
    var ROWS = 18;
    var COLS = 14;
    var geo = new THREE.BufferGeometry();
    var posArr = [];
    var uvArr = [];
    var dir = opts.dir; // +1 upper lobe, -1 lower region
    var zOff = opts.zOff || 0;
    var splay = opts.splay || 0;
    var HALF = opts.half;
    var len = opts.len;
    var edge = opts.flare;

    for (var r = 0; r < ROWS; r++) {
      var t = r / (ROWS - 1); // 0 base .. 1 tip
      var x = TAIL_X - len * t;
      var h = HALF * (0.12 + 0.88 * Math.pow(t, 0.72)) * edge;
      for (var c = 0; c < COLS; c++) {
        var sN = c / (COLS - 1); // 0 .. 1 across
        var s = sN * 2 - 1; // -1 .. 1
        // wavy trailing edge + soft central notch near the tip
        var wave = Math.sin(t * 9.0 + sN * 6.0) * 0.035 * t;
        var notch = t > 0.55 ? (1 - Math.abs(s)) * (t - 0.55) * 0.5 : 0;
        var y = dir * (s * h) * (1 - notch) + wave;
        var z = zOff + splay * t * s;
        posArr.push(x, y, z);
        uvArr.push(sN, t);
      }
    }
    var idx = [];
    for (var rr = 0; rr < ROWS - 1; rr++) {
      for (var cc = 0; cc < COLS - 1; cc++) {
        var a = rr * COLS + cc;
        var b = rr * COLS + cc + 1;
        var d = (rr + 1) * COLS + cc;
        var e = (rr + 1) * COLS + cc + 1;
        idx.push(a, b, d, b, e, d);
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function buildTailGeometries() {
    // three overlapping membranes = translucent veil with volume
    return [
      buildTailMembrane({ dir: 1, half: 0.92, len: TAIL_LEN, flare: 1.0, zOff: 0, splay: 0 }),
      buildTailMembrane({ dir: 1, half: 0.8, len: TAIL_LEN * 0.94, flare: 0.86, zOff: 0.05, splay: 0.16 }),
      buildTailMembrane({ dir: -1, half: 0.8, len: TAIL_LEN * 0.94, flare: 0.86, zOff: -0.05, splay: 0.16 })
    ];
  }

  /* ------------------------------ Materials ------------------------------ */
  var scaleMap = makeScaleNormalMap();
  var bodyMat = addRim(
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.26,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.14,
      sheen: 0.85,
      sheenColor: new THREE.Color("#ffd98a"),
      sheenRoughness: 0.42,
      iridescence: 0.72,
      iridescenceIOR: 1.34,
      iridescenceThicknessRange: [120, 640],
      normalMap: scaleMap,
      normalScale: new THREE.Vector2(0.62, 0.62),
      envMapIntensity: 1.2
    }),
    0.55,
    "#ffb45a"
  );

  var tailMaps = null;
  function tailMaterial() {
    return addRim(
      new THREE.MeshPhysicalMaterial({
        map: tailMaps.tail,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaTest: 0.03,
        roughness: 0.32,
        metalness: 0.0,
        clearcoat: 0.6,
        clearcoatRoughness: 0.3,
        transmission: 0.35,
        thickness: 0.14,
        ior: 1.34,
        attenuationColor: new THREE.Color("#ffb44d"),
        attenuationDistance: 1.1,
        emissive: new THREE.Color("#e8861c"),
        emissiveIntensity: 0.08,
        envMapIntensity: 1.0
      }),
      0.85,
      "#ffcf8a"
    );
  }
  function finMaterial(kind) {
    return addRim(
      new THREE.MeshPhysicalMaterial({
        map: tailMaps[kind],
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaTest: 0.03,
        roughness: 0.36,
        metalness: 0.0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.34,
        transmission: 0.32,
        thickness: 0.14,
        ior: 1.34,
        attenuationColor: new THREE.Color("#ffb44d"),
        attenuationDistance: 1.1,
        emissive: new THREE.Color("#e8861c"),
        emissiveIntensity: 0.07,
        envMapIntensity: 1.0
      }),
      0.75,
      "#ffcf8a"
    );
  }

  /* =============================== BUILD ================================= */
  var fish = new THREE.Group();
  var rig = new THREE.Group();
  fish.add(rig);
  scene.add(fish);

  buildSpine();
  tailBoneList = [SPINE_COUNT - 1, SPINE_COUNT, SPINE_COUNT + 1, SPINE_COUNT + 2];

  rig.add(spineBones[0]);
  rig.updateMatrixWorld(true);
  var skeleton = new THREE.Skeleton(allBones);
  var IDENTITY = new THREE.Matrix4();

  var bodyGeo = buildBodyGeometry();
  skinByX(bodyGeo, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], ROOT_X, TAIL_X);
  var bodyMesh = new THREE.SkinnedMesh(bodyGeo, bodyMat);
  bodyMesh.frustumCulled = false;
  bodyMesh.bind(skeleton, IDENTITY);
  rig.add(bodyMesh);

  tailMaps = { tail: finTexture("tail"), dorsal: finTexture("dorsal"), pectoral: finTexture("pectoral"), anal: finTexture("anal") };
  var tailMat = tailMaterial();
  var tailGeos = buildTailGeometries();
  var tailMeshes = [];
  for (var tg = 0; tg < tailGeos.length; tg++) {
    skinByX(tailGeos[tg], tailBoneList, TAIL_X, TAIL_X - TAIL_LEN);
    var tm = new THREE.SkinnedMesh(tailGeos[tg], tailMat);
    tm.frustumCulled = false;
    tm.renderOrder = 2;
    tm.bind(skeleton, IDENTITY);
    rig.add(tm);
    tailMeshes.push(tm);
  }

  /* ------------------------------ Fin meshes ----------------------------- */
  function makeFinMesh(w, h, kind, segH, bend) {
    var geo = new THREE.PlaneGeometry(w, h, 5, segH || 9);
    // give the fin a gentle backward curl so it never reads as a flat card
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var yy = p.getY(i) + h / 2; // 0 base .. h tip
      var t = yy / h;
      p.setZ(i, p.getZ(i) - bend * t * t);
      p.setX(i, p.getX(i) * (0.75 + 0.25 * (1 - t)));
    }
    p.needsUpdate = true;
    geo.translate(0, h / 2, 0);
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, finMaterial(kind));
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }
  function makeFinBone(parentBone, parentX, px, py, pz) {
    var b = new THREE.Bone();
    b.position.set(px - parentX, py, pz);
    b.userData.spr = makeSpring();
    parentBone.add(b);
    return b;
  }

  var dorsalAtX = 0.18;
  var dorsalIdx = boneIndexAtX(dorsalAtX);
  var dorsalU = bodyU(dorsalAtX);
  var dorsalBone = makeFinBone(spineBones[dorsalIdx], boneX[dorsalIdx], dorsalAtX, sampleCurve(C_TOP, dorsalU) * 0.86, 0);
  var dorsalMesh = makeFinMesh(1.25, 0.66, "dorsal", 10, 0.16);
  dorsalBone.add(dorsalMesh);

  var pecAtX = 0.34;
  var pecIdx = boneIndexAtX(pecAtX);
  var pecU = bodyU(pecAtX);
  var pecSpread = sampleCurve(C_Z, pecU) * 0.94;
  var pecY = -0.06;
  var pecLBone = makeFinBone(spineBones[pecIdx], boneX[pecIdx], pecAtX, pecY, pecSpread);
  var pecLMesh = makeFinMesh(0.54, 0.56, "pectoral", 7, 0.22);
  pecLMesh.rotation.set(-0.5, -0.2, 2.05);
  pecLBone.add(pecLMesh);

  var pecRBone = makeFinBone(spineBones[pecIdx], boneX[pecIdx], pecAtX, pecY, -pecSpread);
  var pecRMesh = makeFinMesh(0.54, 0.56, "pectoral", 7, 0.22);
  pecRMesh.rotation.set(0.5, 0.2, 2.05);
  pecRBone.add(pecRMesh);

  var analAtX = -0.5;
  var analIdx = boneIndexAtX(analAtX);
  var analU = bodyU(analAtX);
  var analBone = makeFinBone(spineBones[analIdx], boneX[analIdx], analAtX, -sampleCurve(C_BOT, analU) * 0.82, 0);
  var analMesh = makeFinMesh(0.56, 0.5, "anal", 7, 0.14);
  analMesh.rotation.z = 2.5;
  analBone.add(analMesh);

  /* ------------------------------- Head parts ------------------------------- */
  var headBone = new THREE.Bone();
  headBone.position.set(0, 0, 0);
  headBone.userData.spr = makeSpring();
  spineBones[0].add(headBone);

  // Eye is authored facing local +Z; the right eye is rotated 180 deg so both
  // pupils bulge outward on their own side instead of into the head.
  function buildEye() {
    var eye = new THREE.Group();
    var ballR = 0.15;
    var ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballR, 26, 22),
      new THREE.MeshPhysicalMaterial({ color: 0xfbf7ec, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 })
    );
    eye.add(ball);
    var iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 22, 18),
      new THREE.MeshPhysicalMaterial({ color: 0x2a2118, roughness: 0.25, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 })
    );
    iris.position.set(0, 0, ballR * 0.74);
    eye.add(iris);
    var pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 14),
      new THREE.MeshPhysicalMaterial({ color: 0x090807, roughness: 0.15, clearcoat: 1 })
    );
    pupil.position.set(0, 0, ballR * 0.86);
    eye.add(pupil);
    // convex clear cornea gives the wet lens dome (patch centred on +Z)
    var cornea = new THREE.Mesh(
      new THREE.SphereGeometry(ballR * 1.16, 24, 20, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.18, Math.PI * 0.64),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        transmission: 0.9,
        thickness: 0.12,
        ior: 1.38,
        transparent: true,
        envMapIntensity: 1.6
      })
    );
    cornea.position.set(0, 0, 0);
    eye.add(cornea);
    var glint = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.02, 0.06, ballR * 1.02);
    eye.add(glint);
    return eye;
  }

  var eyeX = NOSE_X - 0.36;
  var eyeU = bodyU(eyeX);
  var eyeZ = sampleCurve(C_Z, eyeU) * 1.0;
  var eyeY = sampleCurve(C_TOP, eyeU) * 0.42;
  var leftEye = buildEye();
  leftEye.position.set(eyeX - boneX[0], eyeY, eyeZ);
  headBone.add(leftEye);
  var rightEye = buildEye();
  rightEye.position.set(eyeX - boneX[0], eyeY, -eyeZ);
  rightEye.rotation.y = Math.PI;
  headBone.add(rightEye);

  var mouth = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 18, 14),
    new THREE.MeshPhysicalMaterial({ color: 0x9c4310, roughness: 0.5, clearcoat: 0.4 })
  );
  mouth.scale.set(1.0, 0.5, 0.72);
  mouth.position.set(NOSE_X + 0.01 - boneX[0], -0.06, 0);
  headBone.add(mouth);

  var gillL = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.012, 8, 20, Math.PI * 1.1),
    new THREE.MeshPhysicalMaterial({ color: 0xc2591a, roughness: 0.6 })
  );
  gillL.rotation.set(0, Math.PI / 2, -0.4);
  gillL.position.set(0.58 - boneX[0], 0.02, sampleCurve(C_Z, bodyU(0.58)) * 0.98);
  headBone.add(gillL);
  var gillR = gillL.clone();
  gillR.rotation.set(0, -Math.PI / 2, 2.6);
  gillR.position.z *= -1;
  headBone.add(gillR);

  /* ============================ MOTION STATE ============================= */
  var progress = 0;
  var target = 0;
  var maxScroll = 1;
  var lastScrollAt = -1e9;
  var activity = 0;
  var idleMix = 0;
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

  var wavePhase = 0;
  var padPhase = 0;
  var moodTimer = 1.4;
  var mood = "cruise";
  var speed = 1.0;
  var speedNorm = 0.4;
  var turnRate = 0;
  var lastHeading = 0;
  var headingInit = false;

  var w = 0;
  var h = 0;
  var running = false;
  var rafId = null;
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
    marginX = Math.max(0.4, visW * 0.5 - 3.3 * fishScale);
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

  /* --------------------------- Orientation --------------------------- */
  function updateOrientation(dt) {
    vVel.set(curX - prevX, curY - prevY, 0);
    var sp = vVel.length();
    if (sp > 0.015) {
      vDir.copy(vVel).normalize();
      var heading = Math.atan2(vVel.y, vVel.x);
      if (headingInit) turnRate = wrapAngle(heading - lastHeading) / Math.max(dt, 0.001);
      lastHeading = heading;
      headingInit = true;

      vRight.crossVectors(vDir, vUp.set(0, 1, 0));
      if (vRight.lengthSq() < 1e-5) vRight.set(0, 0, 1);
      vRight.normalize();
      vUp.crossVectors(vRight, vDir).normalize();
      tmpMat.makeBasis(vDir, vUp, vRight);
      targetQuat.setFromRotationMatrix(tmpMat);
    } else {
      turnRate += (0 - turnRate) * Math.min(1, dt * 3);
    }
    baseQuat.slerp(targetQuat, Math.min(1, dt * 4.5));
  }

  /* ------------------------- Skeletal animation ------------------------- */
  function animateSkeleton(dt, t) {
    moodTimer -= dt;
    if (moodTimer <= 0) {
      var r = Math.random();
      mood = r < 0.3 ? "glide" : r < 0.75 ? "cruise" : "burst";
      moodTimer = mood === "burst" ? 0.8 + Math.random() * 1.2 : 1.6 + Math.random() * 2.6;
    }
    var moodSpeed = mood === "glide" ? 0.55 : mood === "burst" ? 2.3 : 1.1;
    var targetSpeed = moodSpeed + activity * 1.7;
    speed += (targetSpeed - speed) * Math.min(1, dt * 2.2);
    speedNorm += (clamp((speed - 0.4) / 1.9, 0, 1) - speedNorm) * Math.min(1, dt * 2.4);

    var tailFreq = 0.95 * speed + 0.35;
    var amp = 0.06 + 0.085 * Math.min(speed, 2.6);
    wavePhase += dt * tailFreq * TAU;
    padPhase += dt * (2.0 + speed * 1.3);

    var kSpine = 180;
    var dSpine = 22;
    var kTail = 70;
    var dTail = 13;
    var turn = clamp(turnRate, -3, 3);

    // 1) Travelling propulsive wave along the spine + turn S-curve.
    for (var i = 0; i < SPINE_COUNT; i++) {
      var f = i / (SPINE_COUNT - 1);
      var a = amp * (0.05 + 0.95 * Math.pow(f, 1.7));
      var ph = wavePhase - f * 2.6;
      var ty = a * Math.sin(ph);
      var tx = a * 0.35 * Math.sin(ph - 0.6);
      var tz = amp * 0.2 * Math.sin(ph * 0.5 - f * 3.0);
      ty += turn * 0.05 * (0.1 * f - 0.06 * Math.sin(f * Math.PI));
      var s = spineBones[i].userData.spr;
      springTo(s, tx, ty, tz, kSpine, dSpine, dt);
      spineBones[i].rotation.set(s.x, s.y, s.z);
    }

    // 2) Tail chain: continue the wave with lag, add gravity droop.
    for (var k = 0; k < TAIL_BONES; k++) {
      var tf = (k + 1) / TAIL_BONES;
      var ph2 = wavePhase - (1 + tf) * 2.6;
      var tyy = amp * 1.55 * tf * Math.sin(ph2);
      var tzz = (0.10 + 0.34 * (1 - speedNorm)) * (0.4 + 0.6 * tf) + 0.13 * Math.sin(ph2 - 0.5);
      var txx = 0.4 * tf * Math.sin(ph2 - 0.4);
      var ts = tailBones[k].userData.spr;
      springTo(ts, txx, tyy, tzz, kTail, dTail, dt);
      tailBones[k].rotation.set(ts.x, ts.y, ts.z);
    }

    // 3) Dorsal + anal follow-through.
    dorsalBone.rotation.y = 0.07 * Math.sin(wavePhase * 0.9 - 0.4);
    dorsalBone.rotation.z = 0.05 * Math.sin(t * 0.8);
    analBone.rotation.y = 0.08 * Math.sin(wavePhase * 0.9 + 1.0);

    // 4) Pectoral paddling, asymmetric when turning.
    var turnBias = clamp(turnRate * 0.35, -0.45, 0.45);
    var padL = 0.24 * Math.sin(padPhase) + 0.07 * Math.sin(padPhase * 0.37 + 1.2);
    var padR = 0.24 * Math.sin(padPhase + 2.1) + 0.07 * Math.sin(padPhase * 0.53 - 0.5);
    pecLBone.rotation.y = padL + turnBias;
    pecLBone.rotation.z = 0.08 * Math.sin(padPhase * 1.3);
    pecRBone.rotation.y = -padR + turnBias;
    pecRBone.rotation.z = -0.08 * Math.sin(padPhase * 1.3);

    // 5) Head leads the turn through its own spring (anticipation + settle).
    var lead = clamp(-turnRate * 0.5, -0.4, 0.4) + 0.04 * Math.sin(t * 1.3);
    var hs = headBone.userData.spr;
    springTo(hs, 0, lead, 0, 130, 16, dt);
    headBone.rotation.set(hs.x, hs.y, hs.z);
  }

  /* --------------------------------- Loop --------------------------------- */
  function tick() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    var scrollActive = performance.now() - lastScrollAt < 160;
    activity += ((scrollActive ? 1 : 0) - activity) * 0.07;
    var idle = !scrollActive;
    idleMix += ((idle ? 1 : 0) - idleMix) * 0.05;

    progress += (target - progress) * 0.08;

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
    animateSkeleton(dt, t);

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

    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    tick();
    rafId = requestAnimationFrame(loop);
  }

  /* ------------------------------ Lifecycle ------------------------------ */
  function poseStatic() {
    var p = pathAt(progress);
    curX = p.x;
    curY = p.y;
    fish.position.set(curX, curY, 0);
    if (!inited) {
      baseQuat.identity();
      targetQuat.identity();
      inited = true;
    }
    fish.quaternion.copy(baseQuat);
    for (var i = 0; i < SPINE_COUNT; i++) {
      var f = i / (SPINE_COUNT - 1);
      spineBones[i].rotation.set(0, 0.12 * f * Math.sin(f * 2.4), 0);
    }
    for (var k = 0; k < TAIL_BONES; k++) {
      var tf = (k + 1) / TAIL_BONES;
      tailBones[k].rotation.set(0.1 * tf, 0.22 * tf, 0.12 * tf);
    }
    headBone.rotation.set(0, 0, 0);
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
    if (!running && !isDark()) poseStatic();
  }

  function start() {
    if (isDark()) return;
    if (reduceMotion) {
      progress = target;
      poseStatic();
      return;
    }
    if (running) return;
    running = true;
    clock.start();
    tick();
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
          ["map", "bumpMap", "normalMap", "emissiveMap", "roughnessMap", "metalnessMap", "transmissionMap"].forEach(function (key) {
            if (m[key] && m[key].dispose) m[key].dispose();
          });
          m.dispose();
        });
      }
    });
    if (skeleton && skeleton.dispose) skeleton.dispose();
    if (envRT) envRT.dispose();
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
  }

  /* ------------------------------- Events ------------------------------- */
  function onScroll() {
    lastScrollAt = performance.now();
    computeScroll();
    if (reduceMotion && !running && !isDark()) poseStatic();
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
