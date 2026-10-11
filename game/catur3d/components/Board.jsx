"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { FILES, squareToPosition } from "@/lib/board";
import { createLabelTexture } from "@/lib/textures";

const SQUARE_GEO = new THREE.BoxGeometry(0.98, 0.24, 0.98);
const DOT_GEO = new THREE.CircleGeometry(0.15, 28);
const CAPTURE_RING_GEO = new THREE.RingGeometry(0.4, 0.5, 40);
const SELECT_RING_GEO = new THREE.RingGeometry(0.4, 0.5, 40);
const QUAD_GEO = new THREE.PlaneGeometry(0.96, 0.96);
const LABEL_GEO = new THREE.PlaneGeometry(0.62, 0.62);
const FLAT = [-Math.PI / 2, 0, 0];
const LABEL_RADIUS = 4.55;

export default function Board({
  orientation,
  selected,
  legalMoves,
  lastMove,
  onSquareClick,
  dragRef,
  materials,
}) {
  const flip = orientation === "b";

  const squares = useMemo(() => {
    const list = [];
    for (let f = 0; f < 8; f++) {
      for (let r = 1; r <= 8; r++) {
        const name = `${FILES[f]}${r}`;
        const dark = (f + (r - 1)) % 2 === 0;
        const p = squareToPosition(name);
        list.push({ name, dark, x: flip ? -p[0] : p[0], z: flip ? -p[2] : p[2] });
      }
    }
    return list;
  }, [flip]);

  const labels = useMemo(() => {
    const list = [];
    for (let f = 0; f < 8; f++) {
      const x = (f - 3.5);
      list.push({
        key: `file-${f}`,
        text: FILES[f],
        texture: createLabelTexture(FILES[f]),
        x: flip ? -x : x,
        z: flip ? -LABEL_RADIUS : LABEL_RADIUS,
      });
    }
    for (let r = 1; r <= 8; r++) {
      const z = 3.5 - (r - 1);
      list.push({
        key: `rank-${r}`,
        text: String(r),
        texture: createLabelTexture(String(r)),
        x: flip ? LABEL_RADIUS : -LABEL_RADIUS,
        z: flip ? -z : z,
      });
    }
    return list;
  }, [flip]);

  const toPos = (square) => {
    const p = squareToPosition(square);
    return [flip ? -p[0] : p[0], flip ? -p[2] : p[2]];
  };

  return (
    <group>
      {/* wooden frame (top sits below the play slab) */}
      <mesh position={[0, -0.42, 0]} material={materials.frame} receiveShadow castShadow>
        <boxGeometry args={[10.4, 0.6, 10.4]} />
      </mesh>

      {/* raised dark slab: shows through the gaps as a crisp grid + inner border */}
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[8.2, 0.34, 8.2]} />
        <meshStandardMaterial color="#17120c" roughness={0.85} metalness={0} />
      </mesh>

      {/* squares */}
      {squares.map((s) => (
        <mesh
          key={s.name}
          geometry={SQUARE_GEO}
          material={s.dark ? materials.dark : materials.light}
          position={[s.x, -0.12, s.z]}
          receiveShadow
          onClick={(e) => {
            if (dragRef?.current) return;
            e.stopPropagation();
            onSquareClick(s.name);
          }}
        />
      ))}

      {/* coordinate labels on the frame */}
      {labels.map((l) => (
        <mesh
          key={l.key}
          geometry={LABEL_GEO}
          position={[l.x, -0.1, l.z]}
          rotation={[-Math.PI / 2, 0, flip ? Math.PI : 0]}
        >
          <meshBasicMaterial map={l.texture} transparent opacity={0.92} depthWrite={false} />
        </mesh>
      ))}

      {/* last move markers */}
      {lastMove &&
        [lastMove.from, lastMove.to].map((sq, i) => {
          const [x, z] = toPos(sq);
          return (
            <mesh key={`lm${i}`} geometry={QUAD_GEO} position={[x, 0.012, z]} rotation={FLAT}>
              <meshBasicMaterial color="#6ea8fe" transparent opacity={0.24} depthWrite={false} />
            </mesh>
          );
        })}

      {/* selected square */}
      {selected &&
        (() => {
          const [x, z] = toPos(selected);
          return (
            <mesh geometry={SELECT_RING_GEO} position={[x, 0.02, z]} rotation={FLAT}>
              <meshBasicMaterial color="#7db1ff" transparent opacity={0.95} depthWrite={false} />
            </mesh>
          );
        })()}

      {/* legal move hints */}
      {legalMoves.map((m) => {
        const [x, z] = toPos(m.to);
        if (m.capture) {
          return (
            <mesh
              key={`hint-${m.to}`}
              geometry={CAPTURE_RING_GEO}
              position={[x, 0.02, z]}
              rotation={FLAT}
            >
              <meshBasicMaterial color="#ff6b6b" transparent opacity={0.9} depthWrite={false} />
            </mesh>
          );
        }
        return (
          <mesh key={`hint-${m.to}`} geometry={DOT_GEO} position={[x, 0.02, z]} rotation={FLAT}>
            <meshBasicMaterial color="#7ff0b4" transparent opacity={0.9} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}
