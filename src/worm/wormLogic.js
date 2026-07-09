// src/worm/wormLogic.js
// Core game logic for WORM mode: tunnel geometry/centerline math, the active-tunnel
// scan + O(1) tile→tunnel lookup, and grid-based surface navigation.
// The legacy segment-based worm (discrete surface snake + in-tunnel snake) was removed
// 2026-07 — it had no production callers; recover from git history if ever needed.

import { getManifoldNeighbors, findAntipodalStickerByGrid, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { getStickerWorldPos, getManifoldGridId } from '../game/coordinates.js';
import { isSurfaceSticker } from '../game/cubeState.js';
import { rotateVec90 } from '../game/cubeRotation.js';
import { DIR_FORWARD } from './healerWorm/constants.js';
import * as THREE from 'three';

// ============================================================================
// TUNNELS - Antipodal wormhole tunnels through the cube interior
// ============================================================================

/**
 * Whether a grid cell lies in the slice being rotated.
 *
 * The axis names map to grid coordinates the same way they do everywhere in the
 * rotation pipeline (CubeAssembly, cubeRotation): 'col' → x, 'row' → y, 'depth' → z.
 * Used to decide whether the worm (or any tile-anchored object) should ride a slice
 * that is mid-rotation so it turns with the cube instead of snapping at commit time.
 */
export function isTileInSlice(axis, sliceIndex, x, y, z) {
  if (axis === 'col') return x === sliceIndex;
  if (axis === 'row') return y === sliceIndex;
  if (axis === 'depth') return z === sliceIndex;
  return false;
}

/**
 * Advance the worm's "rest-read" state at a step commit.
 *
 * While a slice is mid-rotation, a worm crossing onto one of its cells from static ground
 * is stepping onto the CELL — whose occupant is still in flight — not riding the slice.
 * That step must read the slice at its end-of-rotation state: lerp to the cell's rest
 * position and stay on the cell when the rotation commits, instead of chasing the outgoing
 * tile and being carried to wherever it lands (a visible teleport, then a snap at commit).
 *
 * Transition rules for the returned descriptor (null | {axis, sliceIndex}):
 *   • crossing from static ground onto the rotating slice arms it,
 *   • steps that still touch the same rotating slice (along it, or back off it) keep the
 *     current state — a rider keeps riding, a rest-read crosser keeps rest-reading,
 *   • a step fully on static ground, no active rotation, or a different rotation clears it.
 *
 * @param {null|{axis:string,sliceIndex:number}} current - descriptor from the previous step
 * @param {boolean} rotationActive - is a slice rotation currently animating
 * @param {string} axis - active rotation axis ('col'|'row'|'depth')
 * @param {number} sliceIndex - active rotation slice index
 * @param {null|{x,y,z}} prevTile - tile the step leaves from (null on the first step)
 * @param {{x,y,z}} nextTile - tile the step lands on
 * @returns {null|{axis:string,sliceIndex:number}} the new rest-read descriptor
 */
export function nextRestRead(current, rotationActive, axis, sliceIndex, prevTile, nextTile) {
  if (!rotationActive) return null;
  const kept = current && current.axis === axis && current.sliceIndex === sliceIndex ? current : null;
  const prevIn = !!prevTile && isTileInSlice(axis, sliceIndex, prevTile.x, prevTile.y, prevTile.z);
  const nextIn = isTileInSlice(axis, sliceIndex, nextTile.x, nextTile.y, nextTile.z);
  if (!prevIn && nextIn) return kept ?? { axis, sliceIndex };
  if (!prevIn && !nextIn) return null;
  return kept;
}

/**
 * Returns a rotation-stable key for a surface sticker using origPos + origDir.
 * The key survives cube rotations because origPos/origDir never change.
 * Returns null if the sticker cannot be found.
 */
export function getStableKey(x, y, z, dirKey, cubies) {
  const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!sticker || !sticker.origPos) return null;
  const { origPos, origDir } = sticker;
  return `${origDir}-${origPos.x}-${origPos.y}-${origPos.z}`;
}

/**
 * Scans cubies to find the current grid position of a sticker by its stable key.
 * Returns { x, y, z, dirKey } or null.
 */
export function findStickerByStableKey(cubies, size, stableKey, manifoldMap = null) {
  // Use the provided manifoldMap or build one (O(size³) scan, but only once per series of calls)
  const map = manifoldMap || buildManifoldGridMap(cubies, size);
  
  // Scans the map values (all facelets) for a matching stable key.
  // This is O(size² * 6) which is much faster than the previous O(size³ * 6) nested search.
  for (const entry of map.values()) {
    const st = entry.sticker;
    if (st && `${st.origDir}-${st.origPos.x}-${st.origPos.y}-${st.origPos.z}` === stableKey) {
      return { x: entry.x, y: entry.y, z: entry.z, dirKey: entry.dirKey };
    }
  }
  return null;
}

/**
 * Get all active tunnels (connections between flipped stickers and their antipodals)
 * @param {Array} cubies - Cube state
 * @param {number} size - Cube size
 * @returns {Array} Array of tunnel objects {id, entry, exit, flips}
 */
/**
 * @param {Array} cubies - Cube state
 * @param {number} size - Cube size
 * @param {Map|null} [cachedManifoldMap] - Optional pre-built manifold map. When the caller
 *   already holds one (e.g. HealerWormMode), passing it avoids an O(size³×6) rebuild.
 */
export const getActiveTunnels = (cubies, size, cachedManifoldMap = null) => {
  const tunnels = [];
  const seen = new Set();
  const manifoldMap = cachedManifoldMap ?? buildManifoldGridMap(cubies, size);

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const cubie = cubies[x]?.[y]?.[z];
        if (!cubie) continue;

        for (const dirKey of Object.keys(cubie.stickers || {})) {
          const sticker = cubie.stickers[dirKey];
          if (!sticker) continue;

          // Check if sticker is on surface and flipped
          if (!isSurfaceSticker(x, y, z, dirKey, size)) continue;

          const isFlipped = sticker.curr !== sticker.orig;
          if (!isFlipped) continue;

          // Create tunnel ID (use sorted positions to avoid duplicates)
          const entryKey = `${x},${y},${z},${dirKey}`;
          if (seen.has(entryKey)) continue;

          // Find antipodal
          const antipodal = findAntipodalStickerByGrid(manifoldMap, sticker, size);
          if (!antipodal) continue;

          const exitKey = `${antipodal.x},${antipodal.y},${antipodal.z},${antipodal.dirKey}`;

          // Mark both ends as seen
          seen.add(entryKey);
          seen.add(exitKey);

          // Count flips for intensity
          const flips = (sticker.flips || 0) + (antipodal.sticker?.flips || 0);

          // Canonical (order-independent) tunnel ID: sort both endpoint keys so the same
          // antipodal pair always yields the same ID regardless of which end the scan
          // discovers first.  After a cube rotation the scan may encounter the pair in
          // the opposite order, so a positional ID like `tunnel-${x}-${y}-${z}-${dirKey}`
          // would change, breaking any tunnel-ID-based lookups.
          // No Object.freeze — frozen objects prevent V8 property-access optimisation
          // and tunnel objects are already treated as immutable by all consumers.
          const id = entryKey < exitKey ? `${entryKey}|${exitKey}` : `${exitKey}|${entryKey}`;
          // pairId matches WormholeNetwork's format so HealerWormMode can tell MobiusTunnel
          // which tunnel is active for the 5 % → 100 % opacity dim system.
          const entryGridId = getManifoldGridId(sticker, size);
          const exitGridId  = getManifoldGridId(antipodal.sticker, size);
          const pairId = [entryGridId, exitGridId].sort().join('|');
          tunnels.push({
            id,
            pairId,
            entry: { x, y, z, dirKey },
            exit: { x: antipodal.x, y: antipodal.y, z: antipodal.z, dirKey: antipodal.dirKey },
            flips: Math.max(1, flips),
            entryColor: sticker.curr,
            exitColor: antipodal.sticker?.curr || sticker.curr,
          });
        }
      }
    }
  }

  return tunnels;
};

// ─── Worm tunnel-entry lookup (tileKey → { tunnel, tunnelKey, reversed }) ──────
// The crawler resolves "is the tile under my head a wormhole, and where does it
// exit?" every step, so it keeps an O(1) tileKey lookup rather than rescanning.
// Two builders share one core so the cheap incremental update is guaranteed to
// produce byte-identical entries to a from-scratch full rebuild.
//
// Canonical orientation: the endpoint with the smaller tileKey is always the
// `entry` (reversed:false) and its partner the `exit` (reversed:true). This
// matches the x→y→z scan order of a full rebuild (single-digit coords make string
// order == numeric order), so either path yields the same lookup for a given cube.

const _TUNNEL_DIRS = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

// Build the two lookup entries for a flipped surface sticker, or null if it has no
// resolvable antipodal partner. Pure — does not touch any Map.
function _tunnelEntriesForSticker(x, y, z, dirKey, sticker, manifoldMap, size) {
  const antipodal = findAntipodalStickerByGrid(manifoldMap, sticker, size);
  if (!antipodal) return null;
  const keyA = `${x},${y},${z},${dirKey}`;
  const keyB = `${antipodal.x},${antipodal.y},${antipodal.z},${antipodal.dirKey}`;
  // Smaller tileKey is the canonical entry (matches the full-scan iteration order).
  const aIsEntry = keyA <= keyB;
  const entryKey = aIsEntry ? keyA : keyB;
  const exitKey = aIsEntry ? keyB : keyA;
  const entryLoc = aIsEntry
    ? { x, y, z, dirKey }
    : { x: antipodal.x, y: antipodal.y, z: antipodal.z, dirKey: antipodal.dirKey };
  const exitLoc = aIsEntry
    ? { x: antipodal.x, y: antipodal.y, z: antipodal.z, dirKey: antipodal.dirKey }
    : { x, y, z, dirKey };
  const entrySticker = aIsEntry ? sticker : antipodal.sticker;
  const exitSticker = aIsEntry ? antipodal.sticker : sticker;
  const tunnelKey = `${entryKey}|${exitKey}`;
  const entryGridId = getManifoldGridId(entrySticker, size);
  const exitGridId = getManifoldGridId(exitSticker, size);
  const pairId = [entryGridId, exitGridId].sort().join('|');
  const tunnel = {
    entry: entryLoc,
    exit: exitLoc,
    entryColor: entrySticker.curr,
    exitColor: exitSticker?.curr || entrySticker.curr,
    pairId,
  };
  return { tunnel, tunnelKey, entryKey, exitKey };
}

// Re-add the tunnels for every flipped surface sticker on `cubie` into `lookup`,
// skipping any tunnelKey already added this pass (each tunnel is set once, from its
// canonical entry endpoint — both endpoint entries are written together).
function _addTunnelsForCubie(lookup, cubie, x, y, z, manifoldMap, size, seen) {
  if (!cubie) return;
  for (const dirKey of Object.keys(cubie.stickers || {})) {
    const sticker = cubie.stickers[dirKey];
    if (!sticker || sticker.curr === sticker.orig) continue;
    if (!isSurfaceSticker(x, y, z, dirKey, size)) continue;
    const built = _tunnelEntriesForSticker(x, y, z, dirKey, sticker, manifoldMap, size);
    if (!built) continue;
    if (seen.has(built.tunnelKey)) continue;
    seen.add(built.tunnelKey);
    lookup.set(built.entryKey, { tunnel: built.tunnel, tunnelKey: built.tunnelKey, reversed: false });
    lookup.set(built.exitKey, { tunnel: built.tunnel, tunnelKey: built.tunnelKey, reversed: true });
  }
}

// Full rebuild — scans every cubie. Used on first build, size change, and after any
// rotation (which changes geometry and so the cached manifold map's epoch).
export function buildTunnelLookup(cubies, size, manifoldMap) {
  const lookup = new Map();
  const seen = new Set();
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        _addTunnelsForCubie(lookup, cubies[x]?.[y]?.[z], x, y, z, manifoldMap, size, seen);
      }
    }
  }
  return lookup;
}

// Incremental update — only re-examines cubies whose object identity changed since
// `prevCubies`. Valid ONLY when geometry is unchanged (same rotation epoch): a flip
// or heal swaps the two endpoint cubie objects together, so any tunnel touching a
// changed cubie is fully rebuilt below, and tunnels on untouched cubies keep their
// (still-correct) entries. Mutates `lookup` in place and returns it.
export function updateTunnelLookupIncremental(lookup, cubies, prevCubies, size, manifoldMap) {
  const changed = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x]?.[y]?.[z];
        if (c === prevCubies?.[x]?.[y]?.[z]) continue;
        changed.push(x, y, z);
        // Drop every tileKey this cubie could own; pass 2 re-adds whatever is still a
        // tunnel. Deleting a non-existent key is a harmless no-op.
        for (let d = 0; d < _TUNNEL_DIRS.length; d++) lookup.delete(`${x},${y},${z},${_TUNNEL_DIRS[d]}`);
      }
    }
  }
  if (changed.length === 0) return lookup;
  // Pass 2 after all deletes, so a tunnel spanning two changed cubies isn't clobbered
  // by the second cubie's delete sweep after the first cubie re-adds it.
  const seen = new Set();
  for (let i = 0; i < changed.length; i += 3) {
    const x = changed[i], y = changed[i + 1], z = changed[i + 2];
    _addTunnelsForCubie(lookup, cubies[x]?.[y]?.[z], x, y, z, manifoldMap, size, seen);
  }
  return lookup;
}

/**
 * Write the world position along a tunnel at parameter t (0-1) into `out`.
 * Use this in render/physics loops to avoid allocating a throwaway [x, y, z] array.
 * @param {THREE.Vector3} out - Destination vector
 * @param {Object} tunnel - Tunnel object with entry/exit positions
 * @param {number} t - Parameter along tunnel (0 = entry, 1 = exit)
 * @param {number} size - Cube size
 * @param {number} explosionFactor - Explosion animation factor
 * @returns {THREE.Vector3} The `out` vector
 */
export const getTunnelWorldPosInto = (out, tunnel, t, size, explosionFactor = 0) => {
  const k = (size - 1) / 2;
  const scale = 1 + explosionFactor * 1.8;

  // Cube-cell centers of the entry/exit tiles (scaled out during the explosion anim).
  _tunnelEntry.set(
    (tunnel.entry.x - k) * scale,
    (tunnel.entry.y - k) * scale,
    (tunnel.entry.z - k) * scale
  );
  _tunnelExit.set(
    (tunnel.exit.x - k) * scale,
    (tunnel.exit.y - k) * scale,
    (tunnel.exit.z - k) * scale
  );

  // Reconstruct the SAME centerline the ribbon mesh is built from (MobiusTunnel fillRibbon):
  //   vStart = entryCenter − entryNormal·FACE_OFFSET ,  midA = entryNormal·MINI_FACE_R
  //   vEnd   = exitCenter  − exitNormal·FACE_OFFSET  ,  midB = exitNormal·MINI_FACE_R
  // Path: vStart → midA over t∈[0,0.5], then midB → vEnd over t∈[0.5,1]. The mini-cube
  // docking points (midA/midB) stay fixed near the core regardless of the explosion scale.
  const en = TUNNEL_FACE_NORMALS[tunnel.entry.dirKey] || ZERO3;
  const xn = TUNNEL_FACE_NORMALS[tunnel.exit.dirKey] || ZERO3;
  _tunVStart.set(
    _tunnelEntry.x - en[0] * TUNNEL_FACE_OFFSET,
    _tunnelEntry.y - en[1] * TUNNEL_FACE_OFFSET,
    _tunnelEntry.z - en[2] * TUNNEL_FACE_OFFSET
  );
  _tunVEnd.set(
    _tunnelExit.x - xn[0] * TUNNEL_FACE_OFFSET,
    _tunnelExit.y - xn[1] * TUNNEL_FACE_OFFSET,
    _tunnelExit.z - xn[2] * TUNNEL_FACE_OFFSET
  );
  _tunMidA.set(en[0] * TUNNEL_MINI_FACE_R, en[1] * TUNNEL_MINI_FACE_R, en[2] * TUNNEL_MINI_FACE_R);
  _tunMidB.set(xn[0] * TUNNEL_MINI_FACE_R, xn[1] * TUNNEL_MINI_FACE_R, xn[2] * TUNNEL_MINI_FACE_R);

  // Continuous 3-part route so there is no teleport across the core:
  //   t∈[0,0.4]  vStart → midA  (entry ribbon arm — matches the rendered mesh)
  //   t∈[0.4,0.6] midA  → midB  (through the mini-cube void core)
  //   t∈[0.6,1]  midB  → vEnd   (exit ribbon arm — matches the rendered mesh)
  if (t <= 0.4) {
    return out.lerpVectors(_tunVStart, _tunMidA, Math.max(0, t) / 0.4);
  }
  if (t <= 0.6) {
    return out.lerpVectors(_tunMidA, _tunMidB, (t - 0.4) / 0.2);
  }
  return out.lerpVectors(_tunMidB, _tunVEnd, (Math.min(1, t) - 0.6) / 0.4);
};

// ── Arc-length-aware tunnel sampling ──────────────────────────────────────────
// The centerline above is piecewise-linear with THREE legs of UNEQUAL world
// length but FIXED parameter spans (0.4 / 0.2 / 0.4). Stepping uniformly in `t`
// therefore spaces points unevenly in world space — bunched on the short core
// leg, stretched out on the long entry/exit arms. Body segments sampled that way
// read as stretched, separated beads instead of a continuous worm. These helpers
// sample by true world arc-length so segments stay evenly spaced (matching the
// on-surface body spacing) all the way through the tunnel.

/** Allocate a reusable centerline scratch object. Fill via buildTunnelCenterlineInto. */
export const makeTunnelCenterline = () => ({
  vStart: new THREE.Vector3(),
  midA: new THREE.Vector3(),
  midB: new THREE.Vector3(),
  vEnd: new THREE.Vector3(),
  l1: 0,
  l2: 0,
  l3: 0,
  total: 0
});

/**
 * Fill `cl` (from makeTunnelCenterline) with the tunnel's centerline control
 * points and per-leg world lengths. Reuses module scratch — call once per frame.
 */
export const buildTunnelCenterlineInto = (cl, tunnel, size, explosionFactor = 0) => {
  const k = (size - 1) / 2;
  const scale = 1 + explosionFactor * 1.8;
  _tunnelEntry.set((tunnel.entry.x - k) * scale, (tunnel.entry.y - k) * scale, (tunnel.entry.z - k) * scale);
  _tunnelExit.set((tunnel.exit.x - k) * scale, (tunnel.exit.y - k) * scale, (tunnel.exit.z - k) * scale);
  const en = TUNNEL_FACE_NORMALS[tunnel.entry.dirKey] || ZERO3;
  const xn = TUNNEL_FACE_NORMALS[tunnel.exit.dirKey] || ZERO3;
  cl.vStart.set(
    _tunnelEntry.x - en[0] * TUNNEL_FACE_OFFSET,
    _tunnelEntry.y - en[1] * TUNNEL_FACE_OFFSET,
    _tunnelEntry.z - en[2] * TUNNEL_FACE_OFFSET
  );
  cl.vEnd.set(
    _tunnelExit.x - xn[0] * TUNNEL_FACE_OFFSET,
    _tunnelExit.y - xn[1] * TUNNEL_FACE_OFFSET,
    _tunnelExit.z - xn[2] * TUNNEL_FACE_OFFSET
  );
  cl.midA.set(en[0] * TUNNEL_MINI_FACE_R, en[1] * TUNNEL_MINI_FACE_R, en[2] * TUNNEL_MINI_FACE_R);
  cl.midB.set(xn[0] * TUNNEL_MINI_FACE_R, xn[1] * TUNNEL_MINI_FACE_R, xn[2] * TUNNEL_MINI_FACE_R);
  cl.l1 = cl.vStart.distanceTo(cl.midA);
  cl.l2 = cl.midA.distanceTo(cl.midB);
  cl.l3 = cl.midB.distanceTo(cl.vEnd);
  cl.total = cl.l1 + cl.l2 + cl.l3;
  return cl;
};

/** Convert a parametric position t (0..1) to world arc-length along a built centerline. */
export const tunnelTToArc = (cl, t) => {
  if (t <= 0.4) return (Math.max(0, t) / 0.4) * cl.l1;
  if (t <= 0.6) return cl.l1 + ((t - 0.4) / 0.2) * cl.l2;
  return cl.l1 + cl.l2 + ((Math.min(1, t) - 0.6) / 0.4) * cl.l3;
};

/** Write the world position at a given world arc-length (clamped to [0,total]) into `out`. */
export const getTunnelArcPosInto = (out, cl, arc) => {
  const a = arc < 0 ? 0 : arc > cl.total ? cl.total : arc;
  if (a <= cl.l1) return out.lerpVectors(cl.vStart, cl.midA, cl.l1 > 0 ? a / cl.l1 : 0);
  if (a <= cl.l1 + cl.l2) return out.lerpVectors(cl.midA, cl.midB, cl.l2 > 0 ? (a - cl.l1) / cl.l2 : 0);
  return out.lerpVectors(cl.midB, cl.vEnd, cl.l3 > 0 ? (a - cl.l1 - cl.l2) / cl.l3 : 0);
};

// Module-level scratch vectors for getTunnelWorldPosInto / buildTunnelCenterlineInto.
// These run for every rendered worm segment every frame, so allocating new Vector3s
// on each call would create significant GC pressure. Safe to reuse because all
// callers run synchronously on the main thread.
const _tunnelEntry = new THREE.Vector3();
const _tunnelExit = new THREE.Vector3();
// Ribbon-centerline anchors — must match MobiusTunnel.jsx fillRibbon exactly so the worm
// rides the rendered Möbius band rather than a separate straight core path.
const _tunVStart = new THREE.Vector3();
const _tunVEnd = new THREE.Vector3();
const _tunMidA = new THREE.Vector3();
const _tunMidB = new THREE.Vector3();
// Face outward normals keyed by dirKey (plain arrays — avoids importing the THREE.Vector3
// table from healerWorm/constants and the circular dependency that would create).
const TUNNEL_FACE_NORMALS = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1]
};
const ZERO3 = [0, 0, 0];
// Geometry constants — keep in sync with MobiusTunnel.jsx.
const TUNNEL_FACE_OFFSET = 0.52;
const TUNNEL_MINI_FACE_R = 0.25;

// ── Wind-up / wind-out spiral flourish above a tunnel mouth ───────────────────
// The worm orbits in a shrinking circle above the hole and descends into it (wind-up),
// or rises out of it and spirals open (wind-out, played in reverse). s ∈ [0,1]:
//   s = 0 → far out on the circle, lifted high above the surface
//   s = 1 → centered on the hole, settled at the face surface
const WIND_RADIUS = 0.72; // circle radius in cube units at s = 0
const WIND_LIFT   = 0.95; // height above the face surface at s = 0
const WIND_TURNS  = 1.5;  // number of orbits over the full spiral
const _windCenter = new THREE.Vector3();
const _windNormal = new THREE.Vector3();
const _windRef = new THREE.Vector3();
const _windT1 = new THREE.Vector3();
const _windT2 = new THREE.Vector3();

/**
 * Write the worm's spiral-flourish world position into `out`.
 * @param {THREE.Vector3} out
 * @param {Object} tunnel
 * @param {'entry'|'exit'} side - which mouth to orbit
 * @param {number} s - 0 = far/lifted, 1 = on the hole at the surface
 * @param {number} size - cube size
 */
export const getWindWorldPosInto = (out, tunnel, side, s, size) => {
  const tile = side === 'exit' ? tunnel.exit : tunnel.entry;
  const n = TUNNEL_FACE_NORMALS[tile.dirKey] || ZERO3;
  const wp = getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0);
  _windCenter.set(wp[0], wp[1], wp[2]);
  _windNormal.set(n[0], n[1], n[2]);
  // In-face basis (t1, t2) ⟂ normal. Use a shuffled reference so it is never parallel to n.
  _windRef.set(n[1], n[2], n[0]);
  _windT1.crossVectors(_windRef, _windNormal);
  if (_windT1.lengthSq() < 1e-4) _windT1.set(1, 0, 0).cross(_windNormal);
  _windT1.normalize();
  _windT2.crossVectors(_windNormal, _windT1).normalize();

  const cl = Math.max(0, Math.min(1, s));
  // Radius + lift follow a smooth 0→1→0 bump so the worm starts AT the hole (no teleport),
  // rises out and orbits at the peak, then is drawn back down into the hole.
  const env = Math.sin(cl * Math.PI);
  const radius = WIND_RADIUS * env;
  const angle = cl * WIND_TURNS * Math.PI * 2;
  const lift = WIND_LIFT * env + 0.06; // just above the surface at both ends
  const cos = Math.cos(angle) * radius;
  const sin = Math.sin(angle) * radius;
  out.set(
    _windCenter.x + _windT1.x * cos + _windT2.x * sin + n[0] * lift,
    _windCenter.y + _windT1.y * cos + _windT2.y * sin + n[1] * lift,
    _windCenter.z + _windT1.z * cos + _windT2.z * sin + n[2] * lift
  );
  return out;
};
// ============================================================================
// SURFACE NAVIGATION - Grid stepping on the cube surface (used by the crawler)
// ============================================================================

// Direction vectors for each face - defines "forward/back/left/right" relative to each face
// When looking at the face head-on, these are the local coordinate axes
const FACE_DIRECTIONS = {
  // PZ (Front/Red): X is right, Y is up
  PZ: {
    up: { dx: 0, dy: 1, dz: 0 },
    down: { dx: 0, dy: -1, dz: 0 },
    left: { dx: -1, dy: 0, dz: 0 },
    right: { dx: 1, dy: 0, dz: 0 }
  },
  // NZ (Back/Orange): X is left (flipped), Y is up
  NZ: {
    up: { dx: 0, dy: 1, dz: 0 },
    down: { dx: 0, dy: -1, dz: 0 },
    left: { dx: 1, dy: 0, dz: 0 },
    right: { dx: -1, dy: 0, dz: 0 }
  },
  // PX (Right/Blue): Z is left, Y is up
  PX: {
    up: { dx: 0, dy: 1, dz: 0 },
    down: { dx: 0, dy: -1, dz: 0 },
    left: { dx: 0, dy: 0, dz: 1 },
    right: { dx: 0, dy: 0, dz: -1 }
  },
  // NX (Left/Green): Z is right, Y is up
  NX: {
    up: { dx: 0, dy: 1, dz: 0 },
    down: { dx: 0, dy: -1, dz: 0 },
    left: { dx: 0, dy: 0, dz: -1 },
    right: { dx: 0, dy: 0, dz: 1 }
  },
  // PY (Top/White): X is right, Z is down (looking from above)
  PY: {
    up: { dx: 0, dy: 0, dz: -1 },
    down: { dx: 0, dy: 0, dz: 1 },
    left: { dx: -1, dy: 0, dz: 0 },
    right: { dx: 1, dy: 0, dz: 0 }
  },
  // NY (Bottom/Yellow): X is right, Z is up (looking from below)
  NY: {
    up: { dx: 0, dy: 0, dz: 1 },
    down: { dx: 0, dy: 0, dz: -1 },
    left: { dx: -1, dy: 0, dz: 0 },
    right: { dx: 1, dy: 0, dz: 0 }
  }
};

const FACE_TRANSITION_DIR = {
  'PZ->PY': { up: 'up', down: 'up', left: 'left', right: 'right' },
  'PZ->NY': { up: 'down', down: 'down', left: 'left', right: 'right' },
  'PZ->PX': { up: 'up', down: 'down', left: 'right', right: 'right' },
  'PZ->NX': { up: 'up', down: 'down', left: 'left', right: 'left' },
  'NZ->PY': { up: 'down', down: 'down', left: 'right', right: 'left' },
  'NZ->NY': { up: 'up', down: 'up', left: 'right', right: 'left' },
  'NZ->PX': { up: 'up', down: 'down', left: 'left', right: 'left' },
  'NZ->NX': { up: 'up', down: 'down', left: 'right', right: 'right' },
  'PX->PY': { up: 'left', down: 'left', left: 'down', right: 'up' },
  'PX->NY': { up: 'left', down: 'left', left: 'up', right: 'down' },
  'PX->PZ': { up: 'up', down: 'down', left: 'left', right: 'left' },
  'PX->NZ': { up: 'up', down: 'down', left: 'right', right: 'right' },
  'NX->PY': { up: 'right', down: 'right', left: 'up', right: 'down' },
  'NX->NY': { up: 'right', down: 'right', left: 'down', right: 'up' },
  'NX->PZ': { up: 'up', down: 'down', left: 'right', right: 'right' },
  'NX->NZ': { up: 'up', down: 'down', left: 'left', right: 'left' },
  'PY->PZ': { up: 'down', down: 'down', left: 'left', right: 'right' },
  'PY->NZ': { up: 'down', down: 'down', left: 'right', right: 'left' },
  'PY->PX': { up: 'right', down: 'left', left: 'down', right: 'down' },
  'PY->NX': { up: 'left', down: 'right', left: 'down', right: 'down' },
  'NY->PZ': { up: 'up', down: 'up', left: 'left', right: 'right' },
  'NY->NZ': { up: 'up', down: 'up', left: 'right', right: 'left' },
  'NY->PX': { up: 'left', down: 'right', left: 'up', right: 'up' },
  'NY->NX': { up: 'right', down: 'left', left: 'up', right: 'up' },
};


/**
 * Get the next tile position when moving in a direction on the cube surface
 * @param {Object} pos - Current position {x, y, z, dirKey}
 * @param {string} moveDir - Movement direction: 'up', 'down', 'left', 'right'
 * @param {number} size - Cube size (3, 4, or 5)
 * @returns {Object} New position {x, y, z, dirKey, newMoveDir} or null if invalid
 */
export const getNextSurfacePosition = (pos, moveDir, size) => {
  const { x, y, z, dirKey } = pos;
  const dirs = FACE_DIRECTIONS[dirKey];
  if (!dirs) return null;

  const delta = dirs[moveDir];
  if (!delta) return null;

  // Calculate new position
  const nx = x + delta.dx;
  const ny = y + delta.dy;
  const nz = z + delta.dz;

  // Check if we're still on the same face
  const isOnFace = (px, py, pz, dk) => {
    switch (dk) {
      case 'PX': return px === size - 1;
      case 'NX': return px === 0;
      case 'PY': return py === size - 1;
      case 'NY': return py === 0;
      case 'PZ': return pz === size - 1;
      case 'NZ': return pz === 0;
      default: return false;
    }
  };

  // If still within bounds on same face, simple move
  if (nx >= 0 && nx < size && ny >= 0 && ny < size && nz >= 0 && nz < size) {
    if (isOnFace(nx, ny, nz, dirKey)) {
      return { x: nx, y: ny, z: nz, dirKey, moveDir };
    }
  }

  // Edge crossing - determine which face we crossed onto based on which coordinate went out of bounds
  let expectedDirKey = null;
  if (nx >= size) expectedDirKey = 'PX';
  else if (nx < 0) expectedDirKey = 'NX';
  else if (ny >= size) expectedDirKey = 'PY';
  else if (ny < 0) expectedDirKey = 'NY';
  else if (nz >= size) expectedDirKey = 'PZ';
  else if (nz < 0) expectedDirKey = 'NZ';

  if (expectedDirKey) {
    const neighbors = getManifoldNeighbors(x, y, z, dirKey, size);
    for (const neighbor of neighbors) {
      if (neighbor.dirKey === expectedDirKey) {
        const transitionKey = `${dirKey}->${neighbor.dirKey}`;
        const dirMap = FACE_TRANSITION_DIR[transitionKey];
        const newMoveDir = dirMap ? dirMap[moveDir] : moveDir;

        return {
          x: neighbor.x,
          y: neighbor.y,
          z: neighbor.z,
          dirKey: neighbor.dirKey,
          moveDir: newMoveDir
        };
      }
    }
  }

  return null;
};

/**
 * Turn the worm left or right
 * @param {string} currentDir - Current movement direction
 * @param {string} turn - 'left' or 'right'
 * @returns {string} New movement direction
 */
export const turnWorm = (currentDir, turn) => {
  const dirs = ['up', 'right', 'down', 'left'];
  const idx = dirs.indexOf(currentDir);
  if (idx === -1) return currentDir;

  if (turn === 'right') {
    return dirs[(idx + 1) % 4];
  } else if (turn === 'left') {
    return dirs[(idx + 3) % 4]; // +3 is same as -1 mod 4
  }
  return currentDir;
};

/**
 * Rotate a worm move-direction through a 90° slice rotation so the worm keeps the SAME
 * world-space heading after the cube turns under it — "continue in the same direction it was
 * going, but now rotated." The world-forward vector of the old (direction, face) pair is
 * rotated by the slice turn, then matched to the move-direction on the NEW face whose
 * world-forward is closest. All vectors are axis-aligned, so the best match is exact.
 *
 * @param {'up'|'down'|'left'|'right'} moveDir - heading relative to the old face
 * @param {string} oldDirKey - face the worm sat on before the turn
 * @param {string} newDirKey - face the worm's tile landed on after the turn
 * @param {'col'|'row'|'depth'} axis - rotation axis
 * @param {1|-1} dir - rotation direction
 * @returns {'up'|'down'|'left'|'right'} the rotated move-direction
 */
export const rotateMoveDir = (moveDir, oldDirKey, newDirKey, axis, dir) => {
  const fwd = DIR_FORWARD[oldDirKey]?.[moveDir];
  const candidates = DIR_FORWARD[newDirKey];
  if (!fwd || !candidates) return moveDir;
  const [rx, ry, rz] = rotateVec90(fwd[0], fwd[1], fwd[2], axis, dir);
  let best = moveDir;
  let bestDot = -Infinity;
  for (const m of ['up', 'right', 'down', 'left']) {
    const c = candidates[m];
    const d = c[0] * rx + c[1] * ry + c[2] * rz;
    if (d > bestDot) { bestDot = d; best = m; }
  }
  return best;
};

/**
 * Get world position for a worm segment (for rendering)
 * @param {Object} seg - Segment position {x, y, z, dirKey}
 * @param {number} size - Cube size
 * @param {number} explosionFactor - Explosion animation factor
 * @returns {Array} [x, y, z] world coordinates
 */
export const getSegmentWorldPos = (seg, size, explosionFactor = 0) => {
  return getStickerWorldPos(seg.x, seg.y, seg.z, seg.dirKey, size, explosionFactor);
};

