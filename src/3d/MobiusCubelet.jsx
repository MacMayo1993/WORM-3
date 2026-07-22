// src/3d/MobiusCubelet.jsx
// Visualization of a 1x1 cubelet with Möbius bands connecting antipodal face pairs.
//
// In RP2 topology, opposite faces are identified with a half-twist (Möbius band):
//   Red (PZ/Front) ↔ Orange (NZ/Back)     — Z-axis Möbius band
//   Green (NX/Left) ↔ Blue (PX/Right)     — X-axis Möbius band
//   White (PY/Top) ↔ Yellow (NY/Bottom)   — Y-axis Möbius band
//
// Each band orbits its axis and has a 180° twist over one full circuit, showing how
// traveling "through" the cube face reappears on the antipodal face with mirrored orientation.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Antipodal face pairs — colors match game constants
const ANTIPODAL_PAIRS = [
  { colorA: '#ef4444', colorB: '#f97316', axis: 'Z', label: 'Front ↔ Back' },   // Red ↔ Orange
  { colorA: '#22c55e', colorB: '#3b82f6', axis: 'X', label: 'Left ↔ Right' },   // Green ↔ Blue
  { colorA: '#f8f8f8', colorB: '#FFD500', axis: 'Y', label: 'Top ↔ Bottom' },   // White ↔ Yellow
];

// Face definitions for the 1x1 cube — position, rotation, color
const CUBE_FACES = [
  { pos: [0, 0, 0.5],  rot: [0, 0, 0],            color: '#ef4444' }, // PZ Front Red
  { pos: [0, 0, -0.5], rot: [0, Math.PI, 0],       color: '#f97316' }, // NZ Back Orange
  { pos: [-0.5, 0, 0], rot: [0, -Math.PI / 2, 0],  color: '#22c55e' }, // NX Left Green
  { pos: [0.5, 0, 0],  rot: [0, Math.PI / 2, 0],   color: '#3b82f6' }, // PX Right Blue
  { pos: [0, 0.5, 0],  rot: [-Math.PI / 2, 0, 0],  color: '#f8f8f8' }, // PY Top White
  { pos: [0, -0.5, 0], rot: [Math.PI / 2, 0, 0],   color: '#FFD500' }, // NY Bottom Yellow
];

/**
 * Build Möbius strip geometry as a BufferGeometry mesh.
 *
 * The strip orbits around `axis` with radius `r` and makes exactly one half-twist
 * (π radians) over the full 2π circuit. This means any path that crosses the strip's
 * centre line will arrive on the opposite side — exactly what RP2 identification does.
 *
 * Vertex colors interpolate from colorA to colorB over the strip so the two face
 * colors visually "flow" into each other through the twist.
 */
function buildMobiusGeometry(axis, colorA, colorB, { r = 1.25, width = 0.45, uSeg = 128, vSeg = 10 } = {}) {
  const colA = new THREE.Color(colorA);
  const colB = new THREE.Color(colorB);

  const positions = [];
  const colors = [];
  const indices = [];

  for (let i = 0; i <= uSeg; i++) {
    const u = i / uSeg; // 0 → 1
    const angle = u * Math.PI * 2;
    const twist = u * Math.PI; // 0 → π  (the key half-twist)

    // Colour: A → B over the strip, with a gentle ease at the midpoint
    const col = new THREE.Color().lerpColors(colA, colB, u);

    for (let j = 0; j <= vSeg; j++) {
      const v = (j / vSeg - 0.5) * width; // -width/2 → +width/2

      // Displacement of this strip-row from the orbit circle:
      //   radial (within the orbit plane) = v * sin(twist)
      //   out-of-plane                    = v * cos(twist)
      const radialDisplace = v * Math.sin(twist);
      const outOfPlane = v * Math.cos(twist);

      let x, y, z;
      if (axis === 'Z') {
        // Orbit in XY plane, out-of-plane is Z
        x = (r + radialDisplace) * Math.cos(angle);
        y = (r + radialDisplace) * Math.sin(angle);
        z = outOfPlane;
      } else if (axis === 'X') {
        // Orbit in YZ plane, out-of-plane is X
        y = (r + radialDisplace) * Math.cos(angle);
        z = (r + radialDisplace) * Math.sin(angle);
        x = outOfPlane;
      } else {
        // Orbit in XZ plane, out-of-plane is Y
        x = (r + radialDisplace) * Math.cos(angle);
        z = (r + radialDisplace) * Math.sin(angle);
        y = outOfPlane;
      }

      positions.push(x, y, z);
      colors.push(col.r, col.g, col.b);
    }
  }

  // Quad grid of triangles
  const stride = vSeg + 1;
  for (let i = 0; i < uSeg; i++) {
    for (let j = 0; j < vSeg; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** One Möbius band connecting an antipodal face pair. */
function MobiusBand({ colorA, colorB, axis }) {
  const geo = useMemo(() => buildMobiusGeometry(axis, colorA, colorB), [axis, colorA, colorB]);

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.82}
        roughness={0.35}
        metalness={0.1}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Thin glowing edge outline that traces the single boundary of the Möbius strip. */
function MobiusBoundary({ colorA, colorB, axis }) {
  const geo = useMemo(() => {
    const colA = new THREE.Color(colorA);
    const colB = new THREE.Color(colorB);
    const r = 1.25;
    const width = 0.45;
    const uSeg = 256;
    const points = [];
    const cols = [];

    // A Möbius strip has ONE boundary — traced by v = +width/2 from u=0 to u=2 (double circuit)
    for (let i = 0; i <= uSeg * 2; i++) {
      const u = i / uSeg; // goes 0 → 2
      const angle = u * Math.PI * 2;
      const twist = u * Math.PI;
      const v = (width / 2) * (i % 2 === 0 ? 1 : 1); // constant edge

      const radialDisplace = v * Math.sin(twist);
      const outOfPlane = v * Math.cos(twist);
      let x, y, z;
      if (axis === 'Z') {
        x = (r + radialDisplace) * Math.cos(angle);
        y = (r + radialDisplace) * Math.sin(angle);
        z = outOfPlane;
      } else if (axis === 'X') {
        y = (r + radialDisplace) * Math.cos(angle);
        z = (r + radialDisplace) * Math.sin(angle);
        x = outOfPlane;
      } else {
        x = (r + radialDisplace) * Math.cos(angle);
        z = (r + radialDisplace) * Math.sin(angle);
        y = outOfPlane;
      }
      points.push(new THREE.Vector3(x, y, z));
      const t = (u % 1);
      const col = new THREE.Color().lerpColors(colA, colB, t);
      cols.push(col.r, col.g, col.b);
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return geo;
  }, [colorA, colorB, axis]);

  return (
    <line geometry={geo}>
      <lineBasicMaterial vertexColors linewidth={2} transparent opacity={0.9} depthWrite={false} />
    </line>
  );
}

/** The 1×1 cubelet at the centre — six coloured face stickers. */
function CenterCubelet() {
  return (
    <group>
      {/* Dark cube body */}
      <mesh>
        <boxGeometry args={[0.92, 0.92, 0.92]} />
        <meshStandardMaterial color="#111111" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Coloured face stickers */}
      {CUBE_FACES.map(({ pos, rot, color }, i) => (
        <mesh key={i} position={pos} rotation={rot}>
          <planeGeometry args={[0.82, 0.82]} />
          <meshStandardMaterial
            color={color}
            roughness={0.2}
            metalness={0.05}
            emissive={color}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}

      {/* Thin gap lines between faces */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(0.925, 0.925, 0.925)]} />
        <lineBasicMaterial color="#000000" transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}

/**
 * MobiusCubelet — the full 3D scene object.
 *
 * Renders a 1×1 cube with three Möbius bands (one per antipodal axis) and
 * optionally auto-rotates so you can see the topology from all angles.
 *
 * Props:
 *   autoRotate {boolean}  — slowly spin the whole assembly (default true)
 *   rotateSpeed {number}  — radians per second (default 0.35)
 */
export default function MobiusCubelet({ autoRotate = true, rotateSpeed = 0.35 }) {
  const groupRef = useRef();

  useFrame((_state, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * rotateSpeed;
      groupRef.current.rotation.x += delta * rotateSpeed * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <CenterCubelet />
      {ANTIPODAL_PAIRS.map(({ colorA, colorB, axis }) => (
        <React.Fragment key={axis}>
          <MobiusBand colorA={colorA} colorB={colorB} axis={axis} />
          <MobiusBoundary colorA={colorA} colorB={colorB} axis={axis} />
        </React.Fragment>
      ))}
    </group>
  );
}
