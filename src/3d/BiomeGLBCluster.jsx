// BiomeGLBCluster.jsx — GLB-based biome city renderer.
//
// Drop-in replacement for CityBuildings when an authored .glb model is available.
// Falls back to procedural CityBuildings automatically when no GLB is configured.
//
// ── Activation ────────────────────────────────────────────────────────────────
// 1. Place the .glb in  public/models/biomes/<name>.glb
// 2. Uncomment its entry in BIOME_GLB_PATHS below
// 3. The GLB renderer activates automatically — no other changes needed
//
// ── How it works ──────────────────────────────────────────────────────────────
// useGLTF loads and caches the scene once globally (shared across all tiles).
// Each tile calls scene.clone(true) inside a useMemo — this creates a new
// Object3D/Mesh tree but SHARES the underlying geometry and material buffers,
// so 9 bio tiles = 9 Object3D trees + 1 set of geometry/material GPU buffers.
// Per-tile variation (Z rotation, scale jitter, XY positional jitter) is driven
// by the same mulberry32 seed system used by the procedural builders so each
// tile looks meaningfully different without authoring 9 separate models.
//
// ── Flip mechanism ────────────────────────────────────────────────────────────
// GLB buildings live inside the same cityGroupRef group in StickerPlane that
// currently holds CityBuildings. The flip animation rotates the entire sticker
// group (groupRef), which includes cityGroupRef as a child — so GLB buildings
// rotate with the tile identically to procedural buildings.
// All GLB geometry MUST sit above z = 0 in model space (see README.md) so
// nothing pokes through the sticker face during rotation.
//
// ── Performance ───────────────────────────────────────────────────────────────
// Clone approach: O(meshCount × tileCount) draw calls.
// Acceptable for 3×3 grids (9 tiles × ~6 meshes = 54 draw calls per biome face).
// For 4×4 / 5×5 grids, upgrade to the InstancedGLB pattern documented at the
// bottom of this file — O(meshCount) regardless of tile count.

import React, { Suspense, useMemo, Component } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { mulberry32 } from '../modes/CityBiomeMode.js';

// Scratch objects — reused across all tiles, never added to a scene.
const _box    = new THREE.Box3();
const _size   = new THREE.Vector3();
const _center = new THREE.Vector3();

// ── GLB asset registry ────────────────────────────────────────────────────────
// null  = use procedural CityBuildings (no change to existing behaviour)
// string = path relative to public/, resolved through ASSET_BASE (Vite's
//          import.meta.env.BASE_URL) so a preview/CDN base needs no source edits
//
// Blender export checklist (see public/models/biomes/README.md for full spec):
//   □ Format: GLB binary
//   □ Transform: +Y Up, Apply All Transforms
//   □ Geometry: Triangulate Faces, Apply Modifiers
//   □ All geometry above z = 0 in model space
//   □ Footprint: XY ≤ ±0.42 units, Height Z ≤ 0.65 units
//   □ Target: < 3 000 triangles, ≤ 4 materials
const ASSET_BASE = import.meta.env.BASE_URL;

export const BIOME_GLB_PATHS = {
  bioDome:         `${ASSET_BASE}models/biomes/Green/GreenManifold4-tree.glb`,
  frozenCitadel:   `${ASSET_BASE}models/biomes/White/snowglobe.glb`,
  deepStation:     `${ASSET_BASE}models/biomes/Blue/island.glb`,
  volcanicFoundry: `${ASSET_BASE}models/biomes/Red/volcano.glb`,
  neuralHub:       `${ASSET_BASE}models/biomes/Orange/colosseum.glb`,
  solarArcology:   `${ASSET_BASE}models/biomes/Yellow/floatingisland.glb`,
};

// Secondary per-tile structure — one instance placed alongside the main GLB cluster.
// null = no secondary structure for this biome.
export const BIOME_CABIN_PATHS = {
  bioDome:         null, // cabin.glb is a 1-byte placeholder — not a valid GLB
  frozenCitadel:   null,
  deepStation:     null,
  volcanicFoundry: null,
  neuralHub:       null,
  solarArcology:   null,
};

// Ground base layer rendered beneath the main GLB — covers the sticker plane surface.
// Scaled to fill the full 0.85×0.85 tile, placed flush at z=0 before the main model.
// null = no base override (sticker plane surface shows as-is).
export const BIOME_BASE_PATHS = {
  bioDome:         `${ASSET_BASE}models/biomes/Green/grass.glb`,
  frozenCitadel:   null,
  deepStation:     `${ASSET_BASE}models/biomes/Blue/oceanwave.glb`,
  volcanicFoundry: null,
  neuralHub:       `${ASSET_BASE}models/biomes/Orange/base.sand.glb`,
  solarArcology:   `${ASSET_BASE}models/biomes/Yellow/cloud.glb`,
};

// Per-biome base layer overrides.
// flattenY : squish factor on the model Y axis (→ world Z height). 1.0 = unchanged.
// zPos     : world Z position of the base layer (lifts it off the tile surface).
const BIOME_BASE_CONFIG = {
  bioDome:         { flattenY: 0.12, zPos: 0,   fit: true }, // thin grass carpet
  frozenCitadel:   { flattenY: 1.0,  zPos: 0    },
  deepStation:     { flattenY: 1.0,  zPos: 0    },
  volcanicFoundry: { flattenY: 1.0,  zPos: 0    },
  neuralHub:       { flattenY: 1.0,  zPos: 0    },
  solarArcology:   {                               // flat cloud layer — 4 copies, same orientation, all within tile
    flattenY: 0.12, zPos: 0.05, fit: true, fitSize: 0.50,
    copies: [
      { dx:  0.00, dy:  0.00, rz: 0 },            // center
      { dx:  0.15, dy:  0.12, rz: 0 },            // upper-right
      { dx: -0.14, dy: -0.13, rz: 0 },            // lower-left
      { dx:  0.13, dy: -0.15, rz: 0 },            // lower-right
    ],
  },
};

// Per-biome variation — controls how much each tile differs from the base model.
// rotateZ:    randomise Z-axis spin so tiles face different directions
// scaleRange: [min, max] multiplier on the base scale prop
// jitter:     max XY displacement from tile center (units)
const BIOME_VARIATION = {
  bioDome:         { rotateZ: false, scaleRange: [1.0, 1.0],   jitter: 0    },
  frozenCitadel:   { rotateZ: false, scaleRange: [0.92, 1.08], jitter: 0.02 },
  deepStation:     { rotateZ: true,  scaleRange: [0.90, 1.10], jitter: 0.04 },
  volcanicFoundry: { rotateZ: false, scaleRange: [0.92, 1.08], jitter: 0.02 },
  neuralHub:       { rotateZ: false, scaleRange: [0.94, 1.06], jitter: 0.02 },
  solarArcology:   { rotateZ: false, scaleRange: [0.90, 1.10], jitter: 0.03 },
};

// Called once when the player activates biome mode (from App.jsx).
// Preloading here — not at module init — avoids kicking off ~100 MB of
// network requests on every page load regardless of whether biome mode is used.
// On mobile, base-layer GLBs (grass 13 MB, oceanwave 25 MB, cloud 5 MB) are
// skipped because they're large, squished flat, and invisible at mobile resolution.
export function preloadBiomeAssets() {
  const isMobile = typeof window !== 'undefined' &&
    (window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 4) <= 2);

  Object.values(BIOME_GLB_PATHS).forEach(path => {
    if (path) useGLTF.preload(path);
  });
  Object.values(BIOME_CABIN_PATHS).forEach(path => {
    if (path) useGLTF.preload(path);
  });
  if (!isMobile) {
    Object.values(BIOME_BASE_PATHS).forEach(path => {
      if (path) useGLTF.preload(path);
    });
  }
}

// ── BiomeModel ─────────────────────────────────────────────────────────────────
// Inner component — only rendered inside a Suspense boundary once the GLB is
// fully loaded. Never rendered directly; always via BiomeGLBCluster below.
//
// ── Per-biome model config ─────────────────────────────────────────────────────
// targetXY : max XY footprint the model should occupy (tile face = 0.85 × 0.85 units)
// targetZ  : max height above the sticker face
// secondary: number of scatter copies around the main model (0 = single centered only)
// cover    : true → "fill" scaling (smallest footprint dim fills targetXY, may overflow)
//            Hides the sticker-plane shader style + 3D style volumes underneath.
const BIOME_MODEL_CONFIG = {
  bioDome:         { targetXY: 0.45, targetZ: 0.42, secondary: 20, cover: false, zAdjust: 0     }, // woods scatter
  volcanicFoundry: { targetXY: 0.85, targetZ: 0.70, secondary: 0,  cover: true,  zAdjust: 0     }, // full-face
  frozenCitadel:   { targetXY: 0.60, targetZ: 0.60, secondary: 0,  cover: false, zAdjust: 0     }, // single snowglobe, ice shader shows through
  deepStation:     { targetXY: 0.85, targetZ: 0.70, secondary: 0,  cover: true,  zAdjust: 0.10, forceOpaque: true }, // full-face
  neuralHub:       { targetXY: 0.72, targetZ: 0.70, secondary: 0,  cover: true,  zAdjust: 0.13  }, // full-face
  solarArcology:   { targetXY: 0.43,  targetZ: 0.50, secondary: 0,  cover: false, zAdjust: 0.24, forceOpaque: true },
};
const _DEFAULT_CFG = { targetXY: 0.51, targetZ: 0.40, secondary: 12, cover: false };

// Returns true for biomes whose GLB covers the entire tile face —
// used by StickerPlane to suppress the shader style + 3D style volumes underneath.
export function isGLBFullFace(cityKey) {
  return (BIOME_MODEL_CONFIG[cityKey] ?? _DEFAULT_CFG).cover === true;
}

function BiomeModel({ path, seed, scale, cityKey, secondaryCap }) {
  const { scene } = useGLTF(path);
  const { targetXY, targetZ, secondary: _secondary, cover, zAdjust = 0, forceOpaque = false } = BIOME_MODEL_CONFIG[cityKey] ?? _DEFAULT_CFG;
  // secondaryCap lets BiomeGLBCluster throttle clone count on mobile/low-end devices.
  const SECONDARY_COUNT = secondaryCap != null ? Math.min(_secondary, secondaryCap) : _secondary;

  // Compute normalising scale from bounding box — runs once per unique GLB.
  // GLB/glTF uses Y-up (Blender default). The tile face normal is +Z, so we
  // apply Rx(+90°) to stand the model up. After that rotation:
  //   old X  → new X  (footprint width, unchanged)
  //   old Y  → new Z  (height above tile face)
  //   old Z  → new -Y (footprint depth)
  // We measure the bounding box in the original Y-up space and map accordingly.
  // zOffset aligns the model base (old Y min) to z = 0 on the tile surface.
  const { autoScale, zOffset, cx, cz } = useMemo(() => {
    scene.updateMatrixWorld(true);
    _box.setFromObject(scene);
    _box.getSize(_size);
    const footprintX = _size.x;   // unchanged by Rx rotation
    const footprintY = _size.z;   // old Z becomes footprint depth after Rx(+90°)
    const height     = _size.y;   // old Y becomes height (Z) after Rx(+90°)
    const maxXY = Math.max(footprintX, footprintY);
    const minXY = Math.min(footprintX, footprintY);
    if (maxXY === 0) return { autoScale: 1, zOffset: 0 };
    // cover=true: scale so the SMALLER footprint dim fills targetXY — guarantees full tile
    // coverage even when the model isn't square (may overflow on the wider axis).
    // cover=false: fit within targetXY/targetZ with no overflow.
    const byXY = cover ? targetXY / (minXY || maxXY) : targetXY / maxXY;
    const byZ  = height > 0 ? targetZ / height : byXY;
    const s = cover ? byXY : Math.min(byXY, byZ);
    // Place the base of the model flush with the tile surface (z = 0).
    // cover=true: use zAdjust to manually position the model flush with the tile.
    //   zAdjust=0 places the model origin exactly on the tile surface.
    //   Positive values raise the model (use when origin is below visual base).
    //   Any underground geometry hides below the tile naturally.
    // cover=false: align the bounding-box floor to z=0 via the standard formula.
    const zOffset = cover ? zAdjust : -_box.min.y * s;
    // Compute bbox center so we can zero it out when placing the model.
    // After Rx(+90°): model X → world X, model Z → world -Y.
    // To center on tile: position.x = -cx*s, position.y = +cz*s.
    _box.getCenter(_center);
    return { autoScale: s, zOffset, cx: _center.x, cz: _center.z };
  }, [scene, targetXY, targetZ, cover, zAdjust]);

  // Build instances for this tile.
  // SECONDARY_COUNT = 0 → single centered model only (e.g. volcanicFoundry).
  // Layout for multi-scatter: i 0–1 = large (65–85%), i 2–8 = medium, i 9–14 = outer ring, i 15+ = tiny.
  const SECONDARY_MAX_R   = 0.215;
  const trees = useMemo(() => {
    const rng = mulberry32(seed);
    const result = [];

    function makeClone() {
      const clone = scene.clone(true);
      clone.traverse(child => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          if (forceOpaque && child.material) {
            child.material = child.material.clone();
            child.material.transparent = false;
            child.material.opacity = 1;
            child.material.depthWrite = true;
            child.material.needsUpdate = true;
          }
        }
      });
      return clone;
    }

    // Main model — bbox-centered on the tile.
    // After Rx(+90°): model X → world X, model Z → world -Y.
    // Subtract bbox center to zero out the offset in world XY.
    const s0 = autoScale * scale;
    result.push({
      obj:      makeClone(),
      position: [-cx * s0, cz * s0, zOffset],
      rotation: [Math.PI / 2, 0, 0],
      scale:    s0,
    });

    // Secondary trees — four tiers around the center tree and cabin:
    //   i 0–1  : large accent trees (65–85%) — placed close, visible as canopy peers
    //   i 2–8  : medium fill trees  (22–56%) — ring scatter around the whole cluster
    //   i 9–14 : outer edge ring    (20–40%) — near tile boundary for surrounding woods feel
    //   i 15+  : tiny undergrowth   (10–20%) — tight to center, add depth
    for (let i = 0; i < SECONDARY_COUNT; i++) {
      const baseAngle = (i / SECONDARY_COUNT) * Math.PI * 2;
      const jitter    = (rng() - 0.5) * 0.8;           // ±0.40 rad random offset
      const angle     = baseAngle + jitter;

      let sv, r;
      if (i < 2) {
        // Large — sit close so they overlap the canopy nicely
        sv = 0.65 + rng() * 0.20;                       // 65–85%
        r  = Math.min(0.08 + rng() * 0.08, 0.165);      // 0.08–0.16, hard cap
      } else if (i < 9) {
        // Medium — existing spread
        sv = 0.22 + rng() * 0.34;                       // 22–56%
        r  = Math.min(0.07 + rng() * 0.10, SECONDARY_MAX_R);
      } else if (i < 15) {
        // Outer edge ring — near tile boundary for "surrounding woods" effect
        sv = 0.20 + rng() * 0.20;                       // 20–40%
        r  = Math.min(0.15 + rng() * 0.07, SECONDARY_MAX_R); // 0.15–0.215, near tile edge
      } else {
        // Tiny undergrowth — tucked in close
        sv = 0.10 + rng() * 0.10;                       // 10–20%
        r  = Math.min(0.04 + rng() * 0.07, 0.12);       // 0.04–0.11, very tight
      }

      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      const rz = rng() * Math.PI * 2;                   // full random spin per tree
      result.push({
        obj:      makeClone(),
        position: [px, py, zOffset],
        rotation: [Math.PI / 2, rz, 0],
        scale:    autoScale * scale * sv,
      });
    }

    return result;
  }, [scene, autoScale, zOffset, cx, cz, seed, scale, SECONDARY_COUNT]);

  return (
    <group>
      {trees.map((tree, i) => (
        <primitive
          key={i}
          object={tree.obj}
          position={tree.position}
          rotation={tree.rotation}
          scale={tree.scale}
          dispose={null}
        />
      ))}
    </group>
  );
}

// ── BiomeCabin ────────────────────────────────────────────────────────────────
// One cabin per tile — positioned at a deterministic offset from the center tree
// so each tile looks unique while keeping the scene legible.
// Uses the same Rx(+90°) coordinate correction as BiomeModel.
// Cabin targets are intentionally smaller than tree targets so the structure
// reads as a focal landmark rather than dominating the tile footprint.
const CABIN_XY = 0.32;  // max XY footprint for the cabin — larger for clear visibility
const CABIN_Z  = 0.26;  // max height for the cabin — taller for clear visibility

function BiomeCabin({ path, seed, scale }) {
  const { scene } = useGLTF(path);

  const { autoScale, zOffset } = useMemo(() => {
    _box.setFromObject(scene);
    _box.getSize(_size);
    const footprintX = _size.x;
    const footprintY = _size.z;   // old Z → footprint depth after Rx(+90°)
    const height     = _size.y;   // old Y → height after Rx(+90°)
    const maxXY = Math.max(footprintX, footprintY);
    if (maxXY === 0) return { autoScale: 1, zOffset: 0 };
    const byXY = CABIN_XY / maxXY;
    const byZ  = height > 0 ? CABIN_Z / height : byXY;
    const s = Math.min(byXY, byZ);
    return { autoScale: s, zOffset: -_box.min.y * s };
  }, [scene]);

  const { obj, position, rotation } = useMemo(() => {
    // Seed offset chosen to be independent of the tree rng sequence
    const rng   = mulberry32(seed + 55555);
    const angle = rng() * Math.PI * 2;             // random compass direction
    const r     = Math.min(0.06 + rng() * 0.07, 0.12); // 0.06–0.13, hard-capped at 0.12
    const px    = Math.cos(angle) * r;
    const py    = Math.sin(angle) * r;
    const rz    = rng() * Math.PI * 2;             // random facing direction

    const clone = scene.clone(true);
    clone.traverse(child => {
      if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; }
    });

    return {
      obj:      clone,
      position: [px, py, zOffset],
      rotation: [Math.PI / 2, rz, 0],
    };
  }, [scene, zOffset, seed]);

  return (
    <primitive
      object={obj}
      position={position}
      rotation={rotation}
      scale={autoScale * scale}
      dispose={null}
    />
  );
}

// ── BiomeBase ─────────────────────────────────────────────────────────────────
// Full-tile ground layer rendered BELOW the main BiomeModel.
// Scaled to fill the entire 0.85×0.85 sticker face, placed flush at z=0.
// flattenY squishes the model height (Y → world Z after Rx rotation) for flat layers like clouds.
// zPos lifts the base off the tile surface so it sits at a custom world Z.
function BiomeBase({ path, scale, cityKey }) {
  const { scene } = useGLTF(path);
  const { flattenY = 1.0, zPos = 0, fit = false, fitSize = 0.85, copies = null } = BIOME_BASE_CONFIG[cityKey] ?? {};

  const { autoScale, cx, cz } = useMemo(() => {
    scene.updateMatrixWorld(true);
    _box.setFromObject(scene);
    _box.getSize(_size);
    _box.getCenter(_center);
    const footprintX = _size.x;
    const footprintY = _size.z;   // old Z → footprint depth after Rx(+90°)
    const maxXY = Math.max(footprintX, footprintY);
    const minXY = Math.min(footprintX, footprintY);
    if (maxXY === 0) return { autoScale: 1, cx: 0, cz: 0 };
    // fit=true  → scale by larger dim so model stays within fitSize units (no overflow)
    // fit=false → scale by smaller dim so model fills the 0.85 tile (may overflow on wider axis)
    return { autoScale: fit ? fitSize / maxXY : 0.85 / (minXY || maxXY), cx: _center.x, cz: _center.z };
  }, [scene, fit, fitSize]);

  const cloneList = useMemo(() => {
    const count = copies ? copies.length : 1;
    return Array.from({ length: count }, () => {
      const clone = scene.clone(true);
      clone.traverse(child => {
        if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; }
      });
      return clone;
    });
  }, [scene, copies]);

  const s = autoScale * scale;
  const list = copies ?? [{ dx: 0, dy: 0, rz: 0 }];
  return (
    <group>
      {list.map((c, i) => (
        // Outer group handles face-normal spin (rz) independently from the Rx flatten.
        // Combining rz into the Euler [π/2, 0, rz] causes axis coupling that tilts the cloud.
        <group key={i} position={[-cx * s + c.dx, cz * s + c.dy, zPos]} rotation={[0, 0, c.rz ?? 0]}>
          <primitive
            object={cloneList[i]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[s, s * flattenY, s]}
            dispose={null}
          />
        </group>
      ))}
    </group>
  );
}

// ── GLBErrorBoundary ──────────────────────────────────────────────────────────
// Catches GLB load failures (missing file, network error, corrupt binary) and
// silently returns null — the tile falls back to procedural CityBuildings.
// Without this, a 404 response (HTML page) causes useGLTF to throw a JSON parse
// error that escapes the Suspense boundary and crashes the entire Canvas.
class GLBErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('BiomeGLBCluster: GLB failed to load —', err.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

// ── BiomeGLBCluster ────────────────────────────────────────────────────────────
// Public component. Used in StickerPlane alongside CityBuildings:
//   - Returns null immediately if no GLB is configured for this biome
//     (CityBuildings procedural fallback takes over — zero overhead)
//   - Returns null during load (Suspense fallback={null})
//   - Returns null on load error (GLBErrorBoundary catches → no Canvas crash)
//   - Each sub-model (base, main, cabin) has its own error boundary so a failed
//     cabin or base layer cannot kill the main model for the entire tile.
//   - On mobile, base layers are skipped (they're large flat carpets invisible
//     at mobile resolution) and the secondary clone count is capped at 4.
export function BiomeGLBCluster({ cityKey, tileIndex, faceId, scale = 1 }) {
  const path = BIOME_GLB_PATHS[cityKey];
  if (!path) return null;

  const seed      = faceId * 10000 + tileIndex;
  const cabinPath = BIOME_CABIN_PATHS[cityKey] ?? null;
  const basePath  = BIOME_BASE_PATHS[cityKey] ?? null;
  const isMobile  = typeof window !== 'undefined' &&
    (window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 4) <= 2);

  return (
    <group>
      {/* Base layer — skipped on mobile (large files, invisible at small scale) */}
      {basePath && !isMobile && (
        <GLBErrorBoundary>
          <Suspense fallback={null}>
            <BiomeBase path={basePath} scale={scale} cityKey={cityKey} />
          </Suspense>
        </GLBErrorBoundary>
      )}
      {/* Main model — always attempted; failure returns null for this tile only */}
      <GLBErrorBoundary>
        <Suspense fallback={null}>
          <BiomeModel
            path={path}
            seed={seed}
            scale={scale}
            cityKey={cityKey}
            secondaryCap={isMobile ? 4 : undefined}
          />
        </Suspense>
      </GLBErrorBoundary>
      {/* Cabin / secondary structure — independent boundary, never kills main model */}
      {cabinPath && (
        <GLBErrorBoundary>
          <Suspense fallback={null}>
            <BiomeCabin path={cabinPath} seed={seed} scale={scale} />
          </Suspense>
        </GLBErrorBoundary>
      )}
    </group>
  );
}

// ── isGLBActive ───────────────────────────────────────────────────────────────
// Used by StickerPlane to decide whether to suppress procedural CityBuildings.
// Returns true only when a path is configured — not merely when the file loads.
export function isGLBActive(cityKey) {
  return Boolean(BIOME_GLB_PATHS[cityKey]);
}

export default BiomeGLBCluster;

// ═════════════════════════════════════════════════════════════════════════════
// UPGRADE PATH: InstancedGLB  (activate for 4×4 / 5×5 grid sizes)
// ═════════════════════════════════════════════════════════════════════════════
//
// The Clone approach above creates one Object3D tree per tile and renders each
// mesh as a separate draw call. For a 3×3 cube that's ~54 extra draw calls per
// biome face — fine. For a 5×5 cube (25 tiles × 6 meshes = 150 draw calls per
// face × 6 faces = 900) the GPU overhead becomes meaningful.
//
// The InstancedGLB approach extracts every Mesh from the loaded GLB scene and
// creates one InstancedMesh per unique mesh, then sets one matrix per tile.
// Total draw calls = meshCount regardless of tileCount.
//
// To upgrade:
//
//   1. Replace BiomeModel + BiomeGLBCluster with the implementation below.
//   2. StickerPlane must collect ALL tiles for a given biome and pass them as
//      a single `tiles` array so the InstancedMesh can be built once.
//      (This requires lifting the GLB render up to CubeAssembly or a new
//       BiomeLayer component that sits alongside the cube, not inside each tile.)
//
// ── InstancedGLBMesh ─────────────────────────────────────────────────────────
//
// import { useRef, useEffect, useMemo } from 'react';
// import * as THREE from 'three';
//
// function InstancedGLBMesh({ geo, mat, localMatrix, tileMatrices }) {
//   const ref = useRef();
//   const scratch = useMemo(() => new THREE.Matrix4(), []);
//
//   useEffect(() => {
//     const mesh = ref.current;
//     if (!mesh) return;
//     tileMatrices.forEach((tm, i) => {
//       // Combine per-tile world transform with mesh-local transform from the GLB
//       scratch.multiplyMatrices(tm, localMatrix);
//       mesh.setMatrixAt(i, scratch);
//     });
//     mesh.instanceMatrix.needsUpdate = true;
//   }, [tileMatrices, localMatrix, scratch]);
//
//   return (
//     <instancedMesh
//       ref={ref}
//       args={[geo, mat, tileMatrices.length]}
//       castShadow={false}
//       receiveShadow={false}
//     />
//   );
// }
//
// ── InstancedGLB ─────────────────────────────────────────────────────────────
//
// function InstancedGLB({ cityKey, tiles, scale = 1 }) {
//   const path = BIOME_GLB_PATHS[cityKey];
//   if (!path) return null;
//
//   const { scene } = useGLTF(path);
//
//   // Extract all Mesh nodes with their scene-relative world matrices
//   const meshNodes = useMemo(() => {
//     scene.updateWorldMatrix(true, true);
//     const nodes = [];
//     scene.traverse(child => {
//       if (child.isMesh) {
//         nodes.push({
//           geo: child.geometry,
//           mat: child.material,
//           localMatrix: child.matrixWorld.clone(),
//         });
//       }
//     });
//     return nodes;
//   }, [scene]);
//
//   // Build one Matrix4 per tile from its seed-driven variation
//   const tileMatrices = useMemo(() => {
//     return tiles.map(({ tileIndex, faceId }) => {
//       const seed = faceId * 10000 + tileIndex;
//       const rng = mulberry32(seed);
//       const v = BIOME_VARIATION[cityKey] ?? { rotateZ: true, scaleRange: [0.9, 1.1], jitter: 0.03 };
//       const [sMin, sMax] = v.scaleRange;
//       const sv = sMin + rng() * (sMax - sMin);
//       const rz = v.rotateZ ? rng() * Math.PI * 2 : 0;
//       const j = v.jitter;
//       const pos = new THREE.Vector3((rng() - 0.5) * j * 2, (rng() - 0.5) * j * 2, 0);
//       const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz));
//       const scl = new THREE.Vector3(scale * sv, scale * sv, scale * sv);
//       const m = new THREE.Matrix4();
//       m.compose(pos, quat, scl);
//       return m;
//     });
//   }, [tiles, scale, cityKey]);
//
//   // One InstancedMesh per unique mesh in the GLB — O(meshCount) draw calls total
//   return (
//     <>
//       {meshNodes.map((node, ni) => (
//         <InstancedGLBMesh
//           key={ni}
//           geo={node.geo}
//           mat={node.mat}
//           localMatrix={node.localMatrix}
//           tileMatrices={tileMatrices}
//         />
//       ))}
//     </>
//   );
// }
