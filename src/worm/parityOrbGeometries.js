// src/worm/parityOrbGeometries.js
// Shared parity orb geometries — built once, shared by every orb (ParityOrb.jsx).
// Meshes pass them as geometry={} props, which keeps R3F from disposing them.
import * as THREE from 'three';
import { createParityMobiusGeometry } from './parityGeometry.js';
import { createParityCageGeometry } from './parityCage.js';
import { PARITY_ORB_SCALE } from './healerWorm/constants.js';

const _orbGeos = {
  normal: {
    shell:        new THREE.SphereGeometry(0.21, 32, 32),          // smooth glassy, iridescent gem shell
    innerCore:    new THREE.SphereGeometry(0.115, 20, 20),         // bright energy core seen through the shell
    innerGlow:    new THREE.SphereGeometry(0.30, 24, 18),          // soft additive inner halo (smooth, not faceted)
    core:         createParityMobiusGeometry(0.24, 0.08),                           // Möbius strip — smaller accent ring, antipodal color
    ringA:        new THREE.TorusGeometry(0.370, 0.011, 6, 18),    // orbit rings sit just outside the strip
    ringB:        new THREE.TorusGeometry(0.370 * 0.92, 0.009, 6, 18),
    electron:     new THREE.SphereGeometry(0.042, 7, 7),
    glow:         new THREE.SphereGeometry(0.52, 40, 28),          // outer ambient aura — smooth round glow (was octagonal at 8 segs)
    parityCage:   new THREE.TorusGeometry(0.30, 0.012, 10, 48),    // smooth great-circle halo (was a diamond octahedron)
    parityCage2:  new THREE.TorusGeometry(0.30, 0.010, 10, 48),    // cross-tilted second halo
    parityNode:   new THREE.SphereGeometry(0.055, 14, 12),         // antipodal pair at opposite poles
    parityAxis:   new THREE.CylinderGeometry(0.010, 0.010, 0.54, 12),
  },
  target: {
    shell:        new THREE.SphereGeometry(0.27, 36, 36),          // larger smooth gem for target
    innerCore:    new THREE.SphereGeometry(0.15, 24, 24),
    innerGlow:    new THREE.SphereGeometry(0.40, 24, 18),
    core:         createParityMobiusGeometry(0.30, 0.10),                           // Möbius strip, antipodal color
    ringA:        new THREE.TorusGeometry(0.460, 0.015, 8, 24),
    ringB:        new THREE.TorusGeometry(0.460 * 0.92, 0.012, 8, 24),
    ringC:        new THREE.TorusGeometry(0.460 * 1.08, 0.010, 8, 24),
    electron:     new THREE.SphereGeometry(0.052, 8, 8),
    electronGlow: new THREE.SphereGeometry(0.088, 6, 6),
    glow:         new THREE.SphereGeometry(0.66, 40, 28),          // outer ambient aura — smooth round glow (was decagonal at 10 segs)
    lockRing:     new THREE.TorusGeometry(0.56, 0.03, 8, 36),
    parityCage:   new THREE.TorusGeometry(0.38, 0.015, 10, 56),
    parityCage2:  new THREE.TorusGeometry(0.38, 0.012, 10, 56),
    parityNode:   new THREE.SphereGeometry(0.068, 14, 12),
    parityAxis:   new THREE.CylinderGeometry(0.012, 0.012, 0.68, 12),
  },
};

// Every part is authored at the original size and scaled once here, so the
// Möbius band, halos, rings and cage keep their proportions to one another.
for (const set of Object.values(_orbGeos)) {
  for (const geometry of Object.values(set)) geometry.scale(PARITY_ORB_SCALE, PARITY_ORB_SCALE, PARITY_ORB_SCALE);
}

// Shared cage geometry keeps the three additive pieces in one per-orb draw.
for (const [variant, geometry] of Object.entries(_orbGeos)) {
  geometry.cage = createParityCageGeometry(geometry, variant === 'target');
}


/** Every orb part at PARITY_ORB_SCALE, per variant ('normal' / 'target'). */
export const PARITY_ORB_GEOMETRIES = _orbGeos;
