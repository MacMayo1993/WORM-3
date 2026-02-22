// SeamPulseOverlay.jsx — emissive pulse overlay for biome-mode border tiles.
//
// Each border tile renders one of these, positioned at z+0.012 above the sticker.
// The pulse color is the tile's OWN city color (meta.orig → FACE_CITIES → pulseColor).
// The pulse shape and frequency come from the seam interaction table between this
// tile's city and the city of the adjacent physical face.
//
// Only useFrame does work here — geometry/materials are created once in module scope.
// Disposal is handled by R3F since materials are declared as JSX children.

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CITY_CONFIG, FACE_CITIES, getSeamInteraction } from '../modes/CityBiomeMode.js';

// ── Adjacency lookup ──────────────────────────────────────────────────────────
// For a tile at (faceRow, faceCol) on a given physical face (currentDir),
// which face ID is at the adjacent edge?
//
// The mapping reflects the faceRCFor coordinate system used in Cubie.jsx:
//   row 0   = top edge    (highest Y for side faces; Z=0 for PY; Z=max for NY)
//   row max = bottom edge
//   col 0   = left edge   (varies by face due to mirroring)
//   col max = right edge
//
// Face IDs:  PZ=1 NX=2 PY=3 NZ=4 PX=5 NY=6
const EDGE_ADJACENT = {
  PZ: { rowMin: 3, rowMax: 6, colMin: 2, colMax: 5 }, // top→PY, bottom→NY, left→NX, right→PX
  NZ: { rowMin: 3, rowMax: 6, colMin: 5, colMax: 2 }, // top→PY, bottom→NY, left→PX, right→NX (horiz-mirrored)
  PX: { rowMin: 3, rowMax: 6, colMin: 1, colMax: 4 }, // top→PY, bottom→NY, left→PZ, right→NZ
  NX: { rowMin: 3, rowMax: 6, colMin: 4, colMax: 1 }, // top→PY, bottom→NY, left→NZ, right→PZ (horiz-mirrored)
  PY: { rowMin: 4, rowMax: 1, colMin: 2, colMax: 5 }, // top→NZ, bottom→PZ, left→NX, right→PX
  NY: { rowMin: 1, rowMax: 4, colMin: 2, colMax: 5 }, // top→PZ, bottom→NZ, left→NX, right→PX
};

// Returns the face ID of the physical face adjacent at this tile's border edge,
// or null if the tile is interior (not on any edge).
export function getAdjacentFaceId(dir, row, col, size) {
  const adj = EDGE_ADJACENT[dir];
  if (!adj) return null;
  if (row === 0) return adj.rowMin;
  if (row === size - 1) return adj.rowMax;
  if (col === 0) return adj.colMin;
  if (col === size - 1) return adj.colMax;
  return null;
}

// ── Pulse shape math ──────────────────────────────────────────────────────────
const TAU = Math.PI * 2;

function computeOpacity(shape, freq, t, max) {
  switch (shape) {
    case 'hard-alternate':
    case 'gold-violet':
      // Square wave — fully on for half the period, fully off for the other half
      return (t % (1 / freq)) < (0.5 / freq) ? max : 0;

    case 'soft-breathe':
    case 'warm-organic':
      // Smooth sine, always positive
      return max * (0.5 + 0.5 * Math.sin(t * freq * TAU));

    case 'chaotic-flicker':
      // Fast irregular flutter — sine modulated by a slower sine
      return max * Math.abs(Math.sin(t * freq * TAU + Math.sin(t * 7.3)));

    case 'lead-follow':
      // Phase-shifted sine (faceA leads, faceB follows by 0.6π).
      // Both sides use the same formula here; the offset is baked into the spec's
      // faceB side. For the single-tile overlay we just use the main phase.
      return max * (0.5 + 0.5 * Math.sin(t * freq * TAU));

    case 'hot-overlap':
      // Always bright — minimum 60%, surges to 100%
      return max * (0.6 + 0.4 * Math.sin(t * freq * TAU));

    case 'third-color':
      // At peak, colour shifts toward mix — opacity drives the effect
      return max * Math.abs(Math.sin(t * freq * TAU));

    case 'slow-build': {
      // Ramps from 0→max over 2 s, then resets
      const cycleT = t % 2.0;
      return (cycleT / 2.0) * max;
    }

    case 'gentle-overlap':
      // Softer version of soft-breathe
      return 0.7 * max * (0.5 + 0.5 * Math.sin(t * freq * TAU));

    case 'deep-interference': {
      // Beat frequency — product of two close sinusoids
      const f2 = freq * 1.07;
      return max * Math.abs(Math.sin(t * freq * TAU) * Math.sin(t * f2 * TAU));
    }

    case 'warm-cool-inter':
      // Fast sine, direction of colour oscillation is baked into material
      return max * Math.abs(Math.sin(t * freq * TAU));

    default:
      return max * (0.5 + 0.5 * Math.sin(t * freq * TAU));
  }
}

// Shared plane geometry — created once, reused across all pulse overlay instances.
// Same 0.84×0.84 size gives a slight inset from the 0.85 sticker to avoid z-fighting.
const _sharedPulseGeo = new THREE.PlaneGeometry(0.84, 0.84);

// ── Component ─────────────────────────────────────────────────────────────────
// Props:
//   origFaceId  {number}  — meta.orig of the sticker (1–6); drives city + pulse color
//   adjFaceId   {number}  — face ID of the physically adjacent face at this seam edge
//
// Mounted inside StickerPlane for border tiles in biome mode.
// Position [0,0,0.012] places the overlay just above the sticker surface.
export function SeamPulseOverlay({ origFaceId, adjFaceId }) {
  const meshRef = useRef();

  // Derive pulse color and interaction once; stable unless props change.
  const { pulseColor, interaction } = useMemo(() => {
    const cityKey = FACE_CITIES[origFaceId];
    const color = CITY_CONFIG[cityKey]?.pulseColor ?? '#ffffff';
    const inter = getSeamInteraction(origFaceId, adjFaceId);
    return { pulseColor: color, interaction: inter };
  }, [origFaceId, adjFaceId]);

  useFrame((state) => {
    const mat = meshRef.current?.material;
    if (!mat) return;
    mat.opacity = computeOpacity(interaction.shape, interaction.frequency, state.clock.elapsedTime, 0.85);
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, 0, 0.012]}
      geometry={_sharedPulseGeo}
      castShadow={false}
      receiveShadow={false}
    >
      <meshBasicMaterial
        color={pulseColor}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

export default SeamPulseOverlay;
