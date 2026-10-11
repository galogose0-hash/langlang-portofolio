"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import Scene from "./Scene";

export default function GameCanvas(props) {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ position: [4.8, 9, 9.8], fov: 40, near: 0.5, far: 120 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
