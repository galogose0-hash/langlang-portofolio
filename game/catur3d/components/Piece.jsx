"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getPieceParts } from "@/lib/pieceGeometry";
import { squareToPosition } from "@/lib/board";

const _target = new THREE.Vector3();

export default function Piece({
  piece,
  baseMaterial,
  tint,
  selected,
  orientation,
  onSelect,
  onDead,
  dragRef,
}) {
  const group = useRef(null);
  const parts = useMemo(() => getPieceParts(piece.type), [piece.type]);
  const material = useMemo(() => baseMaterial.clone(), [baseMaterial]);

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.emissive.set(selected ? tint : "#000000");
    material.emissiveIntensity = selected ? 0.65 : 0.0;
  }, [selected, material, tint]);

  const [x, baseY, z] = useMemo(() => {
    const p = squareToPosition(piece.square);
    const flip = orientation === "b";
    return [flip ? -p[0] : p[0], p[1], flip ? -p[2] : p[2]];
  }, [piece.square, orientation]);

  const scaleRef = useRef(piece.spawn ? 0.001 : 1);
  const ready = useRef(false);
  const removed = useRef(false);

  useLayoutEffect(() => {
    if (group.current && !ready.current) {
      group.current.position.set(x, baseY, z);
      group.current.scale.setScalar(scaleRef.current);
      ready.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.exp(-9 * delta);

    g.position.x += (x - g.position.x) * k;
    g.position.z += (z - g.position.z) * k;

    const distXZ = Math.hypot(x - g.position.x, z - g.position.z);
    const lift = Math.min(distXZ * 1.4, 0.42);
    g.position.y += (baseY + lift - g.position.y) * k;

    const targetScale = piece.dead ? 0 : 1;
    scaleRef.current += (targetScale - scaleRef.current) * Math.min(1, delta * 6);
    const s = Math.max(0.0001, scaleRef.current);
    g.scale.setScalar(s);

    if (piece.dead) {
      g.position.y += delta * 1.6;
      if (s < 0.03 && !removed.current) {
        removed.current = true;
        onDead(piece.id);
      }
    }
  });

  return (
    <group
      ref={group}
      onClick={(e) => {
        if (dragRef?.current || piece.dead) return;
        e.stopPropagation();
        onSelect(piece.square);
      }}
      onPointerOver={(e) => {
        if (piece.dead) return;
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <group rotation={[0, piece.color === "w" ? Math.PI / 2 : -Math.PI / 2, 0]}>
        {parts.map((part, i) => (
          <mesh
            key={i}
            geometry={part.geometry}
            material={material}
            position={part.position || [0, 0, 0]}
            rotation={part.rotation || [0, 0, 0]}
            scale={part.scale || [1, 1, 1]}
            castShadow
            receiveShadow
          />
        ))}
      </group>
    </group>
  );
}
