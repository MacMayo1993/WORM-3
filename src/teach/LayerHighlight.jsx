// src/teach/LayerHighlight.jsx
// 3D layer highlight that shows which slice will be rotated next.
//
// Renders like the neon view mode, but only on the layer about to turn: every
// exposed cubie face of the target slice gets a glowing neon edge-border drawn
// flush on the cube surface, and bright light-worms sweep around the whole belt
// in the DIRECTION OF THE TURN (uDir), so the preview reads which layer moves
// and which way at a glance.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Face basis: outward normal + two in-plane tangents (u, v) for the quad.
const FACE_DEFS = {
  PX: { n: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  NX: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  PY: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  NY: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  PZ: { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  NZ: { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] }
};

const FACE_OFFSET = 0.52; // just proud of the sticker so the border reads as an edge glow
const HALF = 0.49;        // cubie-face half-extent (matches the neon view-mode frame)

const layerVertexShader = `
  attribute float aPhase;
  varying vec2 vUv;
  varying float vPhase;
  void main() {
    vUv = uv;
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const layerFragmentShader = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uDir;   // +1 / -1 → worms sweep with the turn direction
  varying vec2  vUv;
  varying float vPhase; // this face's angular position around the turn axis, [0,1)
  #define TAU 6.28318530718

  void main() {
    vec2 p = vUv - 0.5;
    vec2 a = abs(p);
    float m = max(a.x, a.y);
    float edgeDist = 0.5 - m;

    // Perimeter coordinate around the square edge (for the wiggle).
    float s;
    if (p.y >= a.x)       s = (p.x + 0.5) * 0.25;
    else if (p.x >= a.y)  s = 0.25 + (0.5 - p.y) * 0.25;
    else if (-p.y >= a.x) s = 0.50 + (0.5 - p.x) * 0.25;
    else                  s = 0.75 + (p.y + 0.5) * 0.25;

    // Neon edge-border hugging the tile outline; thickness wiggles so it looks alive.
    float wig  = 1.0 + 0.25 * sin(s * TAU * 4.0 - uTime * 4.0);
    float bw   = 0.075 * wig;
    float band = 1.0 - smoothstep(0.0, bw, edgeDist);
    if (band < 0.003) discard;

    float glow = band * 0.5;

    // Light-worms sweep around the whole layer belt by angular phase, in the
    // turn direction. Each face brightens as a worm passes its angular position.
    float worms = 0.0;
    for (int i = 0; i < 3; i++) {
      float wp = fract(float(i) / 3.0 + uDir * uTime * 0.14);
      float d  = abs(fract(vPhase - wp + 0.5) - 0.5);
      worms += exp(-(d * d) / (0.10 * 0.10));
    }
    worms = clamp(worms, 0.0, 1.3);

    glow += band * worms * 1.15;
    vec3 col = mix(uColor, vec3(1.0), clamp(worms - 0.3, 0.0, 1.0) * 0.72);
    gl_FragColor = vec4(col * 1.7, clamp(glow, 0.0, 1.0));
  }
`;

// Build one curved arrow (a tube arc + a cone head) lying in the local XY plane,
// curving in `dir`. Returns the shaft geometry plus the head's local transform.
function buildArrowArc(radius, span, dir, tubeR) {
  const seg = 20;
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = dir * (-span / 2 + span * (i / seg));
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const shaft = new THREE.TubeGeometry(curve, seg, tubeR, 8, false);
  const p1 = pts[pts.length - 1];
  const p0 = pts[pts.length - 2];
  const tan = p1.clone().sub(p0).normalize();
  // Cone geometry points +Y by default — rotate +Y onto the arc's end tangent.
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
  return {
    shaft,
    headPos: [p1.x + tan.x * 0.12, p1.y + tan.y * 0.12, p1.z + tan.z * 0.12],
    headQuat: [quat.x, quat.y, quat.z, quat.w]
  };
}

const LayerHighlight = ({ axis, sliceIndex, dir, size }) => {
  const matRef = useRef();
  const spinnerRef = useRef();

  // Build a single merged geometry of all exposed cubie faces in the target slice.
  const geometry = useMemo(() => {
    const k = (size - 1) / 2;
    const positions = [];
    const uvs = [];
    const phases = [];
    const indices = [];
    let vBase = 0;

    const inSlice = (x, y, z) =>
      axis === 'col' ? x === sliceIndex : axis === 'row' ? y === sliceIndex : z === sliceIndex;

    const exposed = {
      PX: (x) => x === size - 1, NX: (x) => x === 0,
      PY: (_x, y) => y === size - 1, NY: (_x, y) => y === 0,
      PZ: (_x, _y, z) => z === size - 1, NZ: (_x, _y, z) => z === 0
    };

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          if (!inSlice(x, y, z)) continue;
          const cx = x - k, cy = y - k, cz = z - k;

          for (const dirKey of Object.keys(FACE_DEFS)) {
            const test = exposed[dirKey];
            if (!test(x, y, z)) continue;

            const { n, u, v } = FACE_DEFS[dirKey];
            const fx = cx + n[0] * FACE_OFFSET;
            const fy = cy + n[1] * FACE_OFFSET;
            const fz = cz + n[2] * FACE_OFFSET;

            // Angular position of this face around the rotation axis → drives the
            // directional worm sweep. In-plane coords depend on the turn axis.
            let c1, c2;
            if (axis === 'col') { c1 = fy; c2 = fz; }        // X axis
            else if (axis === 'row') { c1 = fz; c2 = fx; }   // Y axis
            else { c1 = fx; c2 = fy; }                        // Z axis
            const phase = Math.atan2(c2, c1) / (Math.PI * 2) + 0.5;

            // Four corners (uv 0,0 / 1,0 / 1,1 / 0,1)
            const corners = [
              [-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]
            ];
            for (const [su, sv, tu, tv] of corners) {
              positions.push(
                fx + (u[0] * su + v[0] * sv) * HALF,
                fy + (u[1] * su + v[1] * sv) * HALF,
                fz + (u[2] * su + v[2] * sv) * HALF
              );
              uvs.push(tu, tv);
              phases.push(phase);
            }
            indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
            vBase += 4;
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    geo.setIndex(indices);
    return geo;
  }, [axis, sliceIndex, size]);

  // Dispose the geometry when the slice changes / unmounts.
  React.useEffect(() => () => geometry.dispose(), [geometry]);

  // Ring of curved arrows encircling the layer, oriented to the turn axis and
  // positioned at the layer's slice. The ring spins in the turn direction so the
  // arrows physically travel the way the layer will rotate.
  const arrowRing = useMemo(() => {
    const axisVec =
      axis === 'col' ? new THREE.Vector3(1, 0, 0)
        : axis === 'row' ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisVec);
    const axial = sliceIndex - (size - 1) / 2;
    const pos = axisVec.clone().multiplyScalar(axial);
    const radius = size / 2 + 0.42;
    const arrow = buildArrowArc(radius, 1.25, dir === 1 ? 1 : -1, 0.05);
    return { quaternion: [q.x, q.y, q.z, q.w], position: [pos.x, pos.y, pos.z], arrow };
  }, [axis, sliceIndex, size, dir]);

  React.useEffect(() => () => arrowRing.arrow.shaft.dispose(), [arrowRing]);

  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color('#00e5ff') },
    uTime: { value: 0 },
    uDir: { value: dir === 1 ? 1 : -1 }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep direction in sync if the move flips between renders.
  React.useEffect(() => {
    uniforms.uDir.value = dir === 1 ? 1 : -1;
  }, [dir, uniforms]);

  useFrame((state, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    // Spin the arrow ring around the turn axis (local Z) in the turn direction.
    if (spinnerRef.current) spinnerRef.current.rotation.z += delta * (dir === 1 ? 1 : -1) * 0.7;
  });

  return (
    <group>
      {/* Neon edge-worms on the layer's cubie faces */}
      <mesh geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          vertexShader={layerVertexShader}
          fragmentShader={layerFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Curved arrow ring encircling the layer, spinning in the turn direction */}
      <group quaternion={arrowRing.quaternion} position={arrowRing.position}>
        <group ref={spinnerRef}>
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
              <mesh geometry={arrowRing.arrow.shaft}>
                <meshBasicMaterial color="#3af0ff" toneMapped={false} />
              </mesh>
              <mesh position={arrowRing.arrow.headPos} quaternion={arrowRing.arrow.headQuat}>
                <coneGeometry args={[0.14, 0.26, 14]} />
                <meshBasicMaterial color="#3af0ff" toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
};

export default LayerHighlight;
