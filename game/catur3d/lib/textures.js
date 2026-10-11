import * as THREE from "three";

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function toTexture(canvas, { repeat = 1, colorSpace = THREE.SRGBColorSpace } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  tex.colorSpace = colorSpace;
  tex.needsUpdate = true;
  return tex;
}

function addNoise(ctx, size, amount, rand) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

/** Transparent texture containing a single label character (file/rank). */
export function createLabelTexture(text, { color = "#f0e2bf", size = 128 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.floor(size * 0.62)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size / 2 + size * 0.03);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}


/** Wood grain: returns { map, roughnessMap } textures. */
export function createWoodMaps({
  base = [110, 70, 42],
  dark = [60, 36, 20],
  light = [150, 104, 62],
  seed = 1,
  size = 512,
} = {}) {
  const rand = mulberry32(seed);
  const colorCanvas = makeCanvas(size);
  const c = colorCanvas.getContext("2d");
  const roughCanvas = makeCanvas(size);
  const r = roughCanvas.getContext("2d");

  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  c.fillStyle = rgb(base);
  c.fillRect(0, 0, size, size);
  r.fillStyle = "#8a8a8a";
  r.fillRect(0, 0, size, size);

  const bands = 70;
  const phase = rand() * Math.PI * 2;
  for (let i = 0; i < bands; i++) {
    const y0 = (i / bands) * size;
    const isDark = rand() > 0.45;
    const col = isDark ? dark : light;
    const alpha = 0.05 + rand() * 0.12;
    const w = 0.8 + rand() * 3.2;
    const freq = 1.5 + rand() * 2.5;
    const amp = 3 + rand() * 7;

    c.globalAlpha = alpha;
    r.globalAlpha = alpha * 0.8;
    c.strokeStyle = rgb(col);
    r.strokeStyle = isDark ? "#5a5a5a" : "#c0c0c0";
    c.lineWidth = w;
    r.lineWidth = w;
    c.beginPath();
    r.beginPath();
    for (let x = 0; x <= size; x += 6) {
      const yy = y0 + Math.sin((x / size) * Math.PI * freq + phase + i) * amp;
      if (x === 0) {
        c.moveTo(x, yy);
        r.moveTo(x, yy);
      } else {
        c.lineTo(x, yy);
        r.lineTo(x, yy);
      }
    }
    c.stroke();
    r.stroke();
  }

  // a few knots
  c.globalAlpha = 0.5;
  for (let k = 0; k < 3; k++) {
    const kx = rand() * size;
    const ky = rand() * size;
    const grad = c.createRadialGradient(kx, ky, 1, kx, ky, 16 + rand() * 16);
    grad.addColorStop(0, rgb(dark));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = grad;
    c.beginPath();
    c.arc(kx, ky, 34, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;

  addNoise(c, size, 16, rand);
  addNoise(r, size, 20, rand);

  return {
    map: toTexture(colorCanvas),
    roughnessMap: toTexture(roughCanvas, { colorSpace: THREE.NoColorSpace }),
  };
}

/** Marble: soft base with translucent veins. */
export function createMarbleMaps({
  base = [238, 233, 222],
  vein = [150, 152, 160],
  seed = 7,
  size = 512,
} = {}) {
  const rand = mulberry32(seed);
  const colorCanvas = makeCanvas(size);
  const c = colorCanvas.getContext("2d");
  const roughCanvas = makeCanvas(size);
  const r = roughCanvas.getContext("2d");

  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  c.fillStyle = rgb(base);
  c.fillRect(0, 0, size, size);
  r.fillStyle = "#6f6f6f";
  r.fillRect(0, 0, size, size);

  // large soft clouds
  for (let i = 0; i < 14; i++) {
    const gx = rand() * size;
    const gy = rand() * size;
    const grd = c.createRadialGradient(gx, gy, 2, gx, gy, 90 + rand() * 140);
    const shade = 200 + Math.floor(rand() * 45);
    grd.addColorStop(0, `rgba(${shade},${shade},${shade - 6},0.5)`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = grd;
    c.fillRect(0, 0, size, size);
  }

  // veins
  for (let v = 0; v < 10; v++) {
    let x = rand() * size;
    let y = rand() * size;
    let ang = rand() * Math.PI * 2;
    c.strokeStyle = rgb(vein);
    r.strokeStyle = "#3f3f3f";
    c.lineWidth = 0.6 + rand() * 2;
    r.lineWidth = c.lineWidth;
    c.globalAlpha = 0.18 + rand() * 0.22;
    r.globalAlpha = c.globalAlpha;
    c.beginPath();
    r.beginPath();
    c.moveTo(x, y);
    r.moveTo(x, y);
    const steps = 90;
    for (let s = 0; s < steps; s++) {
      ang += (rand() - 0.5) * 0.7;
      x += Math.cos(ang) * 10;
      y += Math.sin(ang) * 10;
      c.lineTo(x, y);
      r.lineTo(x, y);
    }
    c.stroke();
    r.stroke();
  }
  c.globalAlpha = 1;

  addNoise(c, size, 8, rand);
  addNoise(r, size, 14, rand);

  return {
    map: toTexture(colorCanvas),
    roughnessMap: toTexture(roughCanvas, { colorSpace: THREE.NoColorSpace }),
  };
}

/** Dark marble/ebony for the black pieces and dark squares. */
export function createDarkStoneMaps({ seed = 21, size = 512 } = {}) {
  return createMarbleMaps({
    base: [42, 46, 56],
    vein: [104, 110, 130],
    seed,
    size,
  });
}
