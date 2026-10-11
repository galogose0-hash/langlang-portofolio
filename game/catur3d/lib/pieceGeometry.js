import * as THREE from "three";

/* ------------------------------------------------------------------ *
 * Shared primitive geometries (created once, reused by every piece).  *
 * ------------------------------------------------------------------ */
const SPHERE = new THREE.SphereGeometry(1, 20, 16);
const BOX = new THREE.BoxGeometry(1, 1, 1);

function lathe(points, segments = 72) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  );
}

/* Profiles are [radius, height] pairs from bottom -> top. */
const PROFILES = {
  pawn: [
    [0.0, 0.0],
    [0.24, 0.0],
    [0.24, 0.045],
    [0.3, 0.06],
    [0.3, 0.105],
    [0.2, 0.15],
    [0.135, 0.21],
    [0.12, 0.34],
    [0.155, 0.4],
    [0.175, 0.46],
    [0.12, 0.5],
    [0.155, 0.545],
    [0.19, 0.6],
    [0.2, 0.66],
    [0.165, 0.72],
    [0.09, 0.77],
    [0.0, 0.8],
  ],
  rook: [
    [0.0, 0.0],
    [0.27, 0.0],
    [0.27, 0.05],
    [0.33, 0.065],
    [0.33, 0.115],
    [0.22, 0.17],
    [0.19, 0.26],
    [0.21, 0.36],
    [0.185, 0.5],
    [0.178, 0.62],
    [0.2, 0.66],
    [0.255, 0.7],
    [0.265, 0.8],
    [0.265, 0.83],
    [0.19, 0.83],
    [0.0, 0.83],
  ],
  bishop: [
    [0.0, 0.0],
    [0.26, 0.0],
    [0.26, 0.05],
    [0.32, 0.065],
    [0.32, 0.115],
    [0.21, 0.17],
    [0.185, 0.25],
    [0.2, 0.34],
    [0.155, 0.43],
    [0.14, 0.52],
    [0.09, 0.56],
    [0.175, 0.6],
    [0.185, 0.65],
    [0.125, 0.7],
    [0.105, 0.76],
    [0.095, 0.82],
    [0.075, 0.88],
    [0.045, 0.92],
    [0.0, 0.94],
  ],
  queen: [
    [0.0, 0.0],
    [0.28, 0.0],
    [0.28, 0.05],
    [0.35, 0.07],
    [0.35, 0.12],
    [0.23, 0.18],
    [0.2, 0.27],
    [0.215, 0.37],
    [0.17, 0.49],
    [0.15, 0.6],
    [0.155, 0.68],
    [0.2, 0.73],
    [0.23, 0.79],
    [0.17, 0.85],
    [0.14, 0.92],
    [0.105, 0.99],
    [0.125, 1.04],
    [0.16, 1.07],
    [0.1, 1.1],
    [0.0, 1.12],
  ],
  king: [
    [0.0, 0.0],
    [0.29, 0.0],
    [0.29, 0.05],
    [0.36, 0.07],
    [0.36, 0.12],
    [0.24, 0.18],
    [0.21, 0.28],
    [0.225, 0.38],
    [0.175, 0.5],
    [0.155, 0.63],
    [0.16, 0.72],
    [0.205, 0.77],
    [0.235, 0.84],
    [0.175, 0.9],
    [0.15, 0.98],
    [0.115, 1.06],
    [0.138, 1.12],
    [0.17, 1.16],
    [0.11, 1.19],
    [0.0, 1.21],
  ],
};

/* Knight horse-head silhouette (x right = nose, y up). */
const KNIGHT_SHAPE = [
  [0.1, 0.0],
  [0.44, 0.0],
  [0.46, 0.12],
  [0.3, 0.22],
  [0.26, 0.42],
  [0.3, 0.62],
  [0.38, 0.78],
  [0.36, 0.92],
  [0.46, 0.86],
  [0.58, 0.92],
  [0.7, 0.84],
  [0.84, 0.74],
  [0.8, 0.6],
  [0.64, 0.6],
  [0.52, 0.66],
  [0.46, 0.56],
  [0.42, 0.4],
  [0.34, 0.26],
  [0.24, 0.14],
  [0.14, 0.06],
];

function makeKnightHead() {
  const shape = new THREE.Shape();
  KNIGHT_SHAPE.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const depth = 0.34;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.translate(-0.47, 0, -depth / 2); // center on origin
  return geo;
}

let PARTS = null;

function buildParts() {
  const p = {};

  p.p = [{ geometry: lathe(PROFILES.pawn) }];

  /* Rook: body + 6 crenellations */
  const rookParts = [{ geometry: lathe(PROFILES.rook) }];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rookParts.push({
      geometry: BOX,
      position: [Math.cos(a) * 0.2, 0.9, Math.sin(a) * 0.2],
      rotation: [0, -a, 0],
      scale: [0.115, 0.13, 0.115],
    });
  }
  p.r = rookParts;

  /* Bishop: body + finial + slit */
  p.b = [
    { geometry: lathe(PROFILES.bishop) },
    { geometry: SPHERE, position: [0, 1.0, 0], scale: [0.07, 0.09, 0.07] },
    {
      geometry: BOX,
      position: [0, 0.72, 0.0],
      rotation: [0, 0, -0.5],
      scale: [0.02, 0.16, 0.28],
    },
  ];

  /* Knight: pedestal + extruded head */
  p.n = [
    { geometry: lathe(PROFILES.rook.slice(0, 9)), scale: [1.02, 0.42, 1.02] },
    {
      geometry: makeKnightHead(),
      position: [-0.02, 0.16, 0],
      scale: [0.82, 0.82, 0.82],
    },
  ];

  /* Queen: body + crown + finial */
  const queenParts = [{ geometry: lathe(PROFILES.queen) }];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    queenParts.push({
      geometry: SPHERE,
      position: [Math.cos(a) * 0.13, 1.1, Math.sin(a) * 0.13],
      scale: [0.032, 0.05, 0.032],
    });
  }
  queenParts.push({
    geometry: SPHERE,
    position: [0, 1.19, 0],
    scale: [0.055, 0.06, 0.055],
  });
  p.q = queenParts;

  /* King: body + cross */
  p.k = [
    { geometry: lathe(PROFILES.king) },
    { geometry: BOX, position: [0, 1.31, 0], scale: [0.055, 0.24, 0.055] },
    { geometry: BOX, position: [0, 1.35, 0], scale: [0.19, 0.055, 0.055] },
    { geometry: SPHERE, position: [0, 1.22, 0], scale: [0.075, 0.05, 0.075] },
  ];

  return p;
}

export function getPieceParts(type) {
  if (!PARTS) PARTS = buildParts();
  return PARTS[type] || PARTS.p;
}

export const PIECE_BASE_HEIGHT = {
  p: 0.8,
  r: 0.83,
  b: 0.94,
  n: 0.94,
  q: 1.12,
  k: 1.21,
};
