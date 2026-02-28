/**
 * VoidCore
 *
 * Animated wormhole-color rings at the cube's center void.
 * Renders 3 orbital lineLoop rings that cycle through all active tunnel
 * colors (stickers that have been flipped at least once).
 *
 * Only visible on odd-sized cubes (3×3, 5×5) which have a true center.
 * The center cubie is skipped in CubeAssembly and this component fills
 * that space with a swirling "wormcolorcircle".
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';

const RING_SEGMENTS = 80;
const RING_RADIUS = 0.52;
const RING_COUNT = 3;
// Spin speeds in rad/s — each ring a different speed/direction
const RING_SPEEDS = [0.72, -0.48, 0.95];

// Build a circle geometry with a vertex-color attribute pre-allocated
function buildRingGeo() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(RING_SEGMENTS * 3);
  const col = new Float32Array(RING_SEGMENTS * 3).fill(1); // white until colored in useFrame
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    pos[i * 3]     = Math.cos(a) * RING_RADIUS;
    pos[i * 3 + 1] = Math.sin(a) * RING_RADIUS;
    pos[i * 3 + 2] = 0;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  return geo;
}

// Module-level singleton geometries and materials — created once, never disposed
const _geos = Array.from({ length: RING_COUNT }, buildRingGeo);
const _mats = Array.from({ length: RING_COUNT }, () =>
  new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);

// Scratch color for ring vertex interpolation (avoids GC)
const _cMix = new THREE.Color();

function VoidCore() {
  const cubies = useGameStore(s => s.cubies);
  const settings = useGameStore(s => s.settings);
  const size = useGameStore(s => s.size);

  const ringsRef = useRef([]);
  const tRef = useRef(0);
  // Accumulated spin angle for each ring (separate from wobble, never reset)
  const spinRef = useRef([0, 0, 0]);

  // Collect unique face colors from all flipped stickers
  const palette = useMemo(() => {
    const fc = resolveColors(settings, settings.biomeMode?.faceAssignment);
    const hexSet = new Set();
    for (const L of cubies)
      for (const R of L)
        for (const c of R)
          for (const k of Object.keys(c.stickers)) {
            const s = c.stickers[k];
            if ((s.flips || 0) > 0) {
              if (fc[s.orig]) hexSet.add(fc[s.orig]);
              if (fc[s.curr]) hexSet.add(fc[s.curr]);
            }
          }
    const cols = [...hexSet].map(h => new THREE.Color(h));
    return cols.length > 0 ? cols : null;
  }, [cubies, settings]);

  // Only odd-sized cubes have a true center cubie at [0,0,0]
  const isOdd = size % 2 !== 0;

  useFrame((_, dt) => {
    tRef.current += dt;
    const t = tRef.current;
    const active = palette !== null && isOdd;

    for (let ri = 0; ri < RING_COUNT; ri++) {
      const mesh = ringsRef.current[ri];
      const mat = _mats[ri];
      if (!mesh) continue;

      if (!active) {
        // Fade out gracefully
        if (mat.opacity > 0) mat.opacity = Math.max(0, mat.opacity - dt * 3);
        continue;
      }

      // Fade in
      mat.opacity = Math.min(0.88, mat.opacity + dt * 2.5);

      // Accumulate spin
      spinRef.current[ri] += RING_SPEEDS[ri] * dt;
      const sp = spinRef.current[ri];

      // Slow secondary wobble on the non-spin axes for organic feel
      const wx = Math.sin(t * 0.28 + ri * 2.1) * 0.14;
      const wy = Math.cos(t * 0.22 + ri * 1.7) * 0.14;

      // Place each ring in a different plane:
      //   ring 0 — XY plane, spins around Z
      //   ring 1 — XZ plane, spins around Z (tilted 90° on X)
      //   ring 2 — YZ plane, spins around the tilted Z (YZ plane)
      if (ri === 0) {
        mesh.rotation.set(wx, wy, sp);
      } else if (ri === 1) {
        mesh.rotation.set(Math.PI / 2 + wx, wy, sp);
      } else {
        mesh.rotation.set(wx, Math.PI / 2 + wy, sp);
      }

      // Sweep vertex colors through the active palette along the ring
      const n = palette.length;
      const colorAttr = mesh.geometry.attributes.color;
      const arr = colorAttr.array;
      // Each ring offset 120° in phase so colors don't all align
      const phase = ri / RING_COUNT;

      for (let i = 0; i < RING_SEGMENTS; i++) {
        const u = i / RING_SEGMENTS;
        // Advance slowly over time so colors drift around the ring
        const raw = (u + phase + t * 0.12) * n;
        // Safe modulo for negative values
        const ia = ((Math.floor(raw) % n) + n) % n;
        const ib = (ia + 1) % n;
        _cMix.lerpColors(palette[ia], palette[ib], raw - Math.floor(raw));
        arr[i * 3]     = _cMix.r;
        arr[i * 3 + 1] = _cMix.g;
        arr[i * 3 + 2] = _cMix.b;
      }
      colorAttr.needsUpdate = true;
    }

  });

  // No center on even cubes (2×2, 4×4)
  if (!isOdd) return null;

  return (
    <group>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <lineLoop
          key={i}
          ref={el => { ringsRef.current[i] = el; }}
          geometry={_geos[i]}
          material={_mats[i]}
        />
      ))}
    </group>
  );
}

export default VoidCore;
