"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, ContactShadows } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import Board from "./Board";
import Piece from "./Piece";
import { createWoodMaps, createMarbleMaps, createDarkStoneMaps } from "@/lib/textures";

const FLAT = [-Math.PI / 2, 0, 0];

function standardMaterial(maps, { roughness = 0.5, metalness = 0.05 } = {}) {
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    roughness,
    metalness,
    envMapIntensity: 0.9,
  });
}

function CameraRig({ resetSignal, orientation }) {
  const controls = useRef(null);
  const { camera } = useThree();
  const first = useRef(true);
  const dest = useMemo(
    () => (orientation === "b" ? [-4.8, 9, -9.8] : [4.8, 9, 9.8]),
    [orientation],
  );

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (first.current) {
      camera.position.set(dest[0], dest[1], dest[2]);
      c.target.set(0, 0, 0);
      c.update();
      first.current = false;
      return;
    }
    const tween = { onUpdate: () => c.update() };
    gsap.to(camera.position, { x: dest[0], y: dest[1], z: dest[2], duration: 0.9, ease: "power3.inOut", ...tween });
    gsap.to(c.target, { x: 0, y: 0, z: 0, duration: 0.9, ease: "power3.inOut", ...tween });
  }, [resetSignal, orientation, dest, camera]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan
      minDistance={5}
      maxDistance={26}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.04}
      target={[0, 0, 0]}
    />
  );
}

export default function Scene({
  pieces,
  selected,
  legalMoves,
  lastMove,
  orientation,
  onSquareClick,
  onPieceDead,
  resetSignal,
  dragRef,
}) {
  const materials = useMemo(() => {
    const light = createMarbleMaps({ base: [226, 212, 184], vein: [168, 148, 116], seed: 3 });
    const darkSq = createWoodMaps({
      base: [80, 57, 40],
      dark: [40, 26, 17],
      light: [120, 86, 58],
      seed: 9,
    });
    const frame = createWoodMaps({
      base: [112, 78, 50],
      dark: [56, 36, 22],
      light: [156, 112, 74],
      seed: 12,
    });
    const white = createMarbleMaps({ base: [246, 243, 236], vein: [196, 198, 208], seed: 5 });
    const black = createDarkStoneMaps({ seed: 21 });

    const mats = {
      light: standardMaterial(light, { roughness: 0.5, metalness: 0.03 }),
      dark: standardMaterial(darkSq, { roughness: 0.46, metalness: 0.05 }),
      frame: standardMaterial(frame, { roughness: 0.44, metalness: 0.06 }),
      whitePiece: standardMaterial(white, { roughness: 0.26, metalness: 0.06 }),
      blackPiece: standardMaterial(black, { roughness: 0.3, metalness: 0.18 }),
    };
    return mats;
  }, []);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => {
        m.map?.dispose();
        m.roughnessMap?.dispose();
        m.dispose();
      });
    };
  }, [materials]);

  return (
    <>
      <fog attach="fog" args={["#0b0e14", 34, 66]} />
      <color attach="background" args={["#0b0e14"]} />

      <ambientLight intensity={0.62} />
      <hemisphereLight args={["#e6eeff", "#3a2e20", 0.6]} />
      <directionalLight
        position={[6.5, 12, 6.5]}
        intensity={2.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={6}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      >
        <orthographicCamera attach="shadow-camera" args={[-7.5, 7.5, 7.5, -7.5, 0.5, 40]} />
      </directionalLight>
      <directionalLight position={[-8, 8, -6]} intensity={0.5} color="#9db4ff" />

      <Environment resolution={256} frames={1}>
        <Lightformer
          intensity={2.4}
          color="#ffffff"
          position={[0, 7, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[14, 14, 1]}
        />
        <Lightformer
          intensity={1.3}
          color="#bcd2ff"
          position={[-8, 4, 4]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[10, 10, 1]}
        />
        <Lightformer
          intensity={1.1}
          color="#ffd9b0"
          position={[8, 4, -4]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[10, 10, 1]}
        />
      </Environment>

      {/* floor */}
      <mesh rotation={FLAT} position={[0, -0.8, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#0d1119" roughness={0.95} metalness={0} />
      </mesh>

      <ContactShadows
        position={[0, -0.79, 0]}
        scale={24}
        opacity={0.42}
        blur={2.6}
        far={7}
        resolution={1024}
        color="#000000"
      />

      <Board
        orientation={orientation}
        selected={selected}
        legalMoves={legalMoves}
        lastMove={lastMove}
        onSquareClick={onSquareClick}
        dragRef={dragRef}
        materials={materials}
      />

      {pieces.map((p) => (
        <Piece
          key={p.id}
          piece={p}
          baseMaterial={p.color === "w" ? materials.whitePiece : materials.blackPiece}
          tint={p.color === "w" ? "#3f74d6" : "#6a4bd6"}
          selected={selected === p.square && !p.dead}
          orientation={orientation}
          onSelect={onSquareClick}
          onDead={onPieceDead}
          dragRef={dragRef}
        />
      ))}

      <CameraRig resetSignal={resetSignal} orientation={orientation} />
    </>
  );
}
