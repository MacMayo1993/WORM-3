// src/worm/HealerWormMode.jsx
// WORM Chase-Cam Mode — complete rewrite.
// Chase camera follows the worm crawling on the cube exterior.
// Disparity Level 1 runs in background. Flipped tiles are instant wormholes; jump to clear them.

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getStickerWorldPos, getManifoldGridId } from '../game/coordinates.js';
import { getNextSurfacePosition, getActiveTunnels, getTunnelWorldPosInto, turnWorm, getStableKey, findStickerByStableKey } from './wormLogic.js';
import { setWormTurnCallback } from './wormTurnBridge.js';
import { buildManifoldGridMap, flipStickerPair, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { healSticker, getStickerSafe } from '../game/cubeState.js';
import { rotateVec90 } from '../game/cubeRotation.js';
import { DIR_TO_VEC, VEC_TO_DIR, ANTIPODAL_COLOR, FACE_COLORS } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import {
    CAM_HEIGHT_BASE,
    CAM_BACK_BASE,
    LOOK_AHEAD,
    CAM_LERP,
    WORM_LIFT,
    ZOOM_BURST,
    MAX_EXTRA_ZOOM,
    GLASS_MIN_OPACITY,
    GLASS_MAX_OPACITY,
    GLASS_MIN_TRANSMISSION,
    GLASS_MAX_TRANSMISSION,
    TUNNEL_SURF_FOV,
    TUNNEL_SURF_BACK,
    TUNNEL_SURF_UP,
    TUNNEL_LOOK_AHEAD,
    TUNNEL_SURF_SWAY,
    TUNNEL_SPEED_SCALE,
    FACE_NORMALS,
    DIR_FORWARD,
    INITIAL_DIR,
    INITIAL_POS,
    DEFAULT_POWERUP_COUNT,
    ORB_SEGMENT_GROWTH,
    STEPS_PER_TILE,
    BODY_BALL_SPACING,
    BASE_TAIL_LENGTH,
    DEFAULT_WORMHOLE_FLIP_INTERVAL,
    MAX_JUMPS,
    TUNNEL_TRIGGER_PROGRESS,
    SELF_COLLISION_TRIGGER_PROGRESS,
    SELF_COLLISION_GRACE_STEPS_AFTER_TUNNEL,
    WORMHOLE_MAX_TRAVERSALS,
    MAX_TAIL,
    HEAL_COST,
    SURFACE_JUMP_HEIGHT,
    SURFACE_JUMP_TILE_SPAN,
    AUTO_ROTATE_INTERVAL_MIN,
    AUTO_ROTATE_INTERVAL_MAX,
    AUTO_ROTATE_WARNING,
    SCRAMBLE_STEPS,
    ACTIVE_ROTATE_INTERVAL,
    COUNTDOWN_STEP_DURATION,
} from './healerWorm/constants.js';
import {
    isSurfaceTilePos,
    randomFreeTile,
    randomUnflippedTile,
} from './healerWorm/surfaceTiles.js';
import ParityOrbs, { OrbCollectEffect } from './ParityOrb.jsx';
import { isMobile as _isMobile } from '../utils/device.js';
import { healBurstMap } from '../3d/styles/TileStyleMaterials.jsx';
import WormHat3D from './wormCosmetics.jsx';
import { getSkin, _hatAlignQuat, _hatYUp } from './wormCosmeticsData.js';
import { getWormCharacter } from './wormCharacterData.js';
import { EARN_ORB_COLLECT, EARN_WORM_SURVIVAL_TICK, EARN_WORM_HEALED_FACE, SURVIVAL_TICK_INTERVAL } from '../utils/economyConstants.js';
import { liveRotation } from './liveRotation.js';
import { tunnelState } from './tunnelProgressBridge.js';
import { liveCubies } from './liveCubies.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

// Pre-allocated axis vector for applying liveRotation to the worm during scramble
const _liveAxis = new THREE.Vector3();
const _tunnelDirScratch = new THREE.Vector3();
// Duration of the worm's entrance wiggle after the shuffle finishes
const SPAWN_DURATION = 0.75;

// ─── Orb contrast helper ─────────────────────────────────────────────────────
// Ensures orb colors are always visible regardless of color scheme.
// Near-white face colors (e.g. face 3 in pastel/ghibli) wash out to invisible
// against the bright orb emissive — clamp perceived luminance to ≤ 0.72.
function ensureOrbContrast(hex) {
    if (!hex || hex.length < 7) return hex;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum <= 0.72) return hex;
    const factor = 0.55 / Math.max(lum, 0.01);
    const nr = Math.min(255, Math.round(r * factor * 255));
    const ng = Math.min(255, Math.round(g * factor * 255));
    const nb = Math.min(255, Math.round(b * factor * 255));
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

// ─── Tile position rotation helper ───────────────────────────────────────────
// Transforms a {x, y, z, dirKey} surface tile through a cube slice rotation.
// Mirrors the math in rotateSliceCubies + rotateStickers.
function rotateTilePosition(tile, axis, sliceIndex, dir, size) {
    const { x, y, z, dirKey } = tile;
    const inSlice = (axis === 'col' && x === sliceIndex) ||
        (axis === 'row' && y === sliceIndex) ||
        (axis === 'depth' && z === sliceIndex);
    if (!inSlice) return tile;

    const k = (size - 1) / 2;
    const cx = x - k, cy = y - k, cz = z - k;
    const [nx, ny, nz] = rotateVec90(cx, cy, cz, axis, dir);
    const newX = Math.round(nx + k), newY = Math.round(ny + k), newZ = Math.round(nz + k);

    const [vx, vy, vz] = DIR_TO_VEC[dirKey];
    const [rvx, rvy, rvz] = rotateVec90(vx, vy, vz, axis, dir);
    const newDirKey = VEC_TO_DIR(rvx, rvy, rvz);

    return { ...tile, x: newX, y: newY, z: newZ, dirKey: newDirKey };
}

// All surface sticker positions in the rotating slice — used for beam placement and hit detection.
function getSliceSurfaceStickers(size, axis, sliceIndex) {
    const stickers = [];
    for (let a = 0; a < size; a++) {
        for (let b = 0; b < size; b++) {
            let x, y, z;
            if (axis === 'col') { x = sliceIndex; y = a; z = b; }
            else if (axis === 'row') { x = a; y = sliceIndex; z = b; }
            else { x = a; y = b; z = sliceIndex; }
            if (x === 0) stickers.push({ x, y, z, dirKey: 'NX' });
            if (x === size - 1) stickers.push({ x, y, z, dirKey: 'PX' });
            if (y === 0) stickers.push({ x, y, z, dirKey: 'NY' });
            if (y === size - 1) stickers.push({ x, y, z, dirKey: 'PY' });
            if (z === 0) stickers.push({ x, y, z, dirKey: 'NZ' });
            if (z === size - 1) stickers.push({ x, y, z, dirKey: 'PZ' });
        }
    }
    return stickers;
}

// Scratch object reused by parseTileKey — avoids per-entry object allocation
const _parseTile = { x: 0, y: 0, z: 0, dirKey: '' };

// Parse a "x,y,z,dirKey" tile key into out without allocating an array.
function parseTileKey(key, out) {
    const c1 = key.indexOf(',');
    const c2 = key.indexOf(',', c1 + 1);
    const c3 = key.indexOf(',', c2 + 1);
    out.x = parseInt(key, 10);
    out.y = parseInt(key.substring(c1 + 1), 10);
    out.z = parseInt(key.substring(c2 + 1), 10);
    out.dirKey = key.substring(c3 + 1);
    return out;
}

// Extract a single coordinate (0=x,1=y,2=z) from a tile key without allocating.
function tileKeyCoordAt(key, idx) {
    let commasSeen = 0, start = 0;
    for (let i = 0; i < key.length; i++) {
        if (key.charCodeAt(i) === 44) { // ','
            if (commasSeen === idx) return parseInt(key.substring(start, i), 10);
            commasSeen++;
            start = i + 1;
        }
    }
    return parseInt(key.substring(start), 10);
}

// Returns null | { type:'death' } | { type:'cut', cutTrailIdx }
// Rules:
//   - Entire worm on slice → travels with rotation, null (no harm)
//   - Head on slice but body spans boundary → death (head gets clipped)
//   - Head off slice, body segment on slice → cut at first hit segment
function checkWormHitBySlice(worm, axis, sliceIndex) {
    const head = worm.pos.current;
    const axisCoord = axis === 'col' ? 'x' : axis === 'row' ? 'y' : 'z';
    const coordIdx  = axis === 'col' ? 0 : axis === 'row' ? 1 : 2;
    const headOnSlice = head[axisCoord] === sliceIndex;
    const trail = worm.tileTrail.current;

    // Only scan the ACTIVE body — the portion the player can see.
    // tileTrail can hold up to MAX_TAIL=1200 historical entries but the visible snake
    // body is ceil(tailLength × BODY_BALL_SPACING) tiles, matching the self-collision check.
    const activeTiles = Math.max(1, Math.ceil(worm.tailLength.current * BODY_BALL_SPACING));
    const bodyEnd = Math.min(activeTiles, trail.count); // exclusive upper bound for body scan

    if (!headOnSlice) {
        // Head is off the slice — cut if any active body tile is on it
        for (let i = 1; i < bodyEnd; i++) {
            if (tileKeyCoordAt(ttAt(trail, i), coordIdx) === sliceIndex) {
                return { type: 'cut', cutTrailIdx: i };
            }
        }
        return null;
    }

    // Head is on the slice — death only if any active body tile is OFF the slice
    // (if the entire active body is on the slice the worm travels with the rotation)
    for (let i = 1; i < bodyEnd; i++) {
        if (tileKeyCoordAt(ttAt(trail, i), coordIdx) !== sliceIndex) {
            return { type: 'death' };
        }
    }
    return null; // whole active body on slice — travels safely
}

// Remove all worm segments at and beyond cutTrailIdx.
function cutWormTail(worm, cutTrailIdx) {
    ttTrimTo(worm.tileTrail.current, cutTrailIdx);
    const histLen = cutTrailIdx * STEPS_PER_TILE;
    shTrimTo(worm.stepHistory.current, histLen);
    // cutTrailIdx is in tile units; tailLength is in visual-ball units.
    // BODY_BALL_SPACING = 0.14 converts: tailLength = tiles / BODY_BALL_SPACING
    worm.tailLength.current = Math.max(BASE_TAIL_LENGTH, Math.round(cutTrailIdx / BODY_BALL_SPACING));
    const orbsLeft = Math.max(0, Math.floor((worm.tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
    if (worm.orbPickupColorsRef.current.length > orbsLeft) worm.orbPickupColorsRef.current.length = orbsLeft;
    useGameStore.getState().setWormBodyTiles(orbsLeft);
}

// ─── Scratch vectors for world-position writes (avoids per-tile-step Vector3 allocation) ──
// Two dedicated slots so prevWorldPos and curWorldPos never alias the same object.
const _curWP  = new THREE.Vector3();
const _prevWP = new THREE.Vector3();

// ─── Scratch vectors for evaluatePosAndNormal (avoids per-sub-step allocations) ──
const _evalHPos = new THREE.Vector3();
const _evalCornerVtx = new THREE.Vector3();
const _evalCornerNorm = new THREE.Vector3(); // reused for face-crossing normal blend
// Extra scratch for computing the lifted position before writing into stepHistory
const _evalLiftedPos = new THREE.Vector3();

// ─── Step History Circular Buffer ────────────────────────────────────────────
// Pre-allocated ring of {pos, normal} objects — eliminates per-step Vector3
// allocations and O(N) unshift that grows to 60 000 elements at MAX_TAIL.
function makeStepHistory(capacity) {
    return {
        buf: Array.from({ length: capacity }, () => ({ pos: new THREE.Vector3(), normal: new THREE.Vector3() })),
        head: 0,   // next write slot; newest entry is at (head-1+capacity)%capacity
        count: 0,
        capacity,
    };
}
function shPush(sh, pos, normal) {
    const slot = sh.buf[sh.head];
    slot.pos.copy(pos);
    slot.normal.copy(normal);
    sh.head = (sh.head + 1) % sh.capacity;
    if (sh.count < sh.capacity) sh.count++;
}
// i=0 → newest, i=count-1 → oldest
function shAt(sh, i) {
    return sh.buf[(sh.head - 1 - i + sh.capacity) % sh.capacity];
}
function shTrimTo(sh, maxCount) {
    if (maxCount < sh.count) sh.count = maxCount;
}
function shReset(sh) { sh.head = 0; sh.count = 0; }

// ─── Tile Trail Circular Buffer ───────────────────────────────────────────────
// O(1) push replaces the O(N) unshift on a 1 200-entry string array.
function makeTileTrail(capacity) {
    return {
        buf: new Array(capacity).fill(''),
        head: 0,   // head is the slot of index-0 (newest entry)
        count: 0,
        capacity,
    };
}
// Push new key as newest (index 0). Ring automatically evicts oldest when full.
function ttPush(tt, key) {
    tt.head = (tt.head - 1 + tt.capacity) % tt.capacity;
    tt.buf[tt.head] = key;
    if (tt.count < tt.capacity) tt.count++;
}
// i=0 → newest (current tile), i=count-1 → oldest
function ttAt(tt, i) { return tt.buf[(tt.head + i) % tt.capacity]; }
function ttTrimTo(tt, maxCount) { if (maxCount < tt.count) tt.count = maxCount; }
function ttReset(tt, initialKey) { tt.head = 0; tt.buf[0] = initialKey; tt.count = 1; }
// Transform every key in place (used when cube rotates to re-encode tile coords).
function ttMapInPlace(tt, fn) {
    for (let i = 0; i < tt.count; i++) {
        const idx = (tt.head + i) % tt.capacity;
        tt.buf[idx] = fn(tt.buf[idx]);
    }
}
// Keep only entries matching predicate, compacting the ring (rare: tunnel entry).
function ttFilterInPlace(tt, fn) {
    let keep = 0;
    for (let i = 0; i < tt.count; i++) {
        const src = (tt.head + i) % tt.capacity;
        if (fn(tt.buf[src])) {
            const dst = (tt.head + keep) % tt.capacity;
            if (dst !== src) tt.buf[dst] = tt.buf[src];
            keep++;
        }
    }
    tt.count = keep;
}

// ─── Worm Crawler Hook ────────────────────────────────────────────────────────
function useWormCrawler(size, cubies) {
    const { wormSpeed, wormControlMode, wormRunId, wormOrbCount, wormholeInterval, wormPaused } = useGameStore(
        useShallow(s => ({
            wormSpeed: s.wormSpeed ?? 1.0,
            wormControlMode: s.wormControlMode ?? 'non-oriented',
            wormRunId: s.wormRunId ?? 0,
            wormOrbCount: s.wormOrbCount ?? DEFAULT_POWERUP_COUNT,
            wormholeInterval: s.wormholeInterval ?? DEFAULT_WORMHOLE_FLIP_INTERVAL,
            wormPaused: s.wormPaused ?? false,
        }))
    );
    const wormPausedRef = useRef(false);
    wormPausedRef.current = wormPaused;

    // Mutable refs for values captured by tick/PHASE_HANDLERS that change between renders.
    // Reading via ref avoids adding them to tick's useCallback deps, preventing tick from
    // being recreated (and the callback reference replaced) on every cube rotation or setting change.
    const cubiesRef = useRef(cubies);
    cubiesRef.current = cubies;
    const wormControlModeRef = useRef(wormControlMode);
    wormControlModeRef.current = wormControlMode;
    const wormholeIntervalRef = useRef(wormholeInterval);
    wormholeIntervalRef.current = wormholeInterval;
    const wormSpeedRef = useRef(wormSpeed);
    wormSpeedRef.current = wormSpeed;
    const timeAliveRef = useRef(0);
    const survivalTickRef = useRef(0);
    const healedRef = useRef(0);
    // willHealRef: true when the active tunnel has enough deposited orbs to heal on exit.
    // Consumed by TunnelPortalRings to show the pop-and-seal animation instead of a fade.
    const willHealRef = useRef(false);
    // healFiredRef: set true for one frame when a heal fires; consumed by TunnelPortalRings.
    const healFiredRef = useRef(false);

    const pos = useRef(INITIAL_POS(size));
    const moveDir = useRef(INITIAL_DIR);
    const phase = useRef('crawling');
    const tunnelProgress = useRef(0);
    const activeTunnel = useRef(null);
    const prevVisualModeRef = useRef('classic');
    const prevShowTunnelsRef = useRef(false);
    const stepAcc = useRef(0);
    const pendingTurns = useRef([]);
    const onFlippedTile = useRef(false);
    const lastFlippedRef = useRef(false);
    const prevDirKey = useRef(null);
    const lastRecordedT = useRef(0);
    const crossingCorner = useRef(false);
    const pendingSelfCollision = useRef(null);
    const selfCollisionGraceStepsRef = useRef(0);
    // Tracks the phase on the previous tick so enter()/exit() hooks fire exactly once
    // per transition rather than every frame.
    const prevPhaseRef = useRef('crawling');

    // Smooth inter-tile interpolation
    const interpT = useRef(1);          // 0→1 between prev and current tile
    const prevWorldPos = useRef(null);  // null = no prev yet; otherwise = _prevWP (module-level)
    const curWorldPos = useRef(_curWP); // always valid; writes go through _curWP.set()
    const headInterpPos = useRef(new THREE.Vector3());
    const currentNormal = useRef(new THREE.Vector3(0, 0, 1));

    // Jump state
    const jumpT = useRef(0);            // 0 = grounded, >0 = in air
    const isJumping = useRef(false);
    const jumpCount = useRef(0);
    const pendingTunnelTrigger = useRef(null);
    const JUMP_HEIGHT = SURFACE_JUMP_HEIGHT;
    const JUMP_TILE_SPAN = SURFACE_JUMP_TILE_SPAN;

    // Growing tail + powerups
    const tailLength = useRef(BASE_TAIL_LENGTH);
    const powerupsRef = useRef([]);  // local fast-access copy of wormPowerups
    const stepHistory = useRef(makeStepHistory(MAX_TAIL * STEPS_PER_TILE)); // pre-allocated ring, used by WormBody
    const wormholeTimer = useRef(DEFAULT_WORMHOLE_FLIP_INTERVAL);
    const lastCountdownDeci = useRef(-1);
    const alive = useRef(true);
    const tileTrail = useRef(makeTileTrail(MAX_TAIL));
    const deathMenuTimer = useRef(null);
    const tunnelUseCountsRef = useRef(new Map());
    const voidTunnelKeysRef = useRef(new Set());
    const pendingVoidKillRef = useRef(null);
    const currentTunnelStableKeyRef = useRef(null); // stable key of the tunnel being traversed
    const pendingHealBurstRef = useRef(null);  // set when a heal fires; consumed by HeartBurstSystem
    const pendingOrbFlashRef = useRef(null);   // set when glow worm picks up orb; consumed by OrbFlashSystem
    // O(1) tunnel endpoint lookup — rebuilt whenever cubies change via the effect below.
    // Both the manifold map and tunnel list are built in one pass to avoid a second O(size³×6) scan.
    const tunnelLookupRef = useRef(new Map());
    React.useEffect(() => {
        // Build manifold map once and share it with getActiveTunnels to avoid a second rebuild
        const manifoldMap = buildManifoldGridMap(cubies, size);
        const tunnels = getActiveTunnels(cubies, size, manifoldMap);

        const encodeTile = (p) => `${p.x},${p.y},${p.z},${p.dirKey}`;
        const canonical = (tunnel) => {
            const a = encodeTile(tunnel.entry);
            const b = encodeTile(tunnel.exit);
            return a < b ? `${a}|${b}` : `${b}|${a}`;
        };

        const lookup = new Map();
        for (const tunnel of tunnels) {
            const tunnelKey = canonical(tunnel);
            lookup.set(encodeTile(tunnel.entry), { tunnel, tunnelKey, reversed: false });
            lookup.set(encodeTile(tunnel.exit), { tunnel, tunnelKey, reversed: true });
        }
        tunnelLookupRef.current = lookup;
    }, [cubies, size]);

    // Jump offset height at current jumpT
    const jumpLift = () => isJumping.current
        ? Math.sin(jumpT.current * Math.PI) * JUMP_HEIGHT
        : 0;

    const startJump = useCallback(() => {
        if (jumpCount.current >= MAX_JUMPS) return;
        isJumping.current = true;
        jumpT.current = 0.001;
        jumpCount.current += 1;
        // If the player jumps early on a flipped tile, don't auto-enter the tunnel.
        pendingTunnelTrigger.current = null;
    }, []);

    const tileKey = useCallback((p) => `${p.x},${p.y},${p.z},${p.dirKey}`, []);

    const resolveTunnelAtTile = useCallback((x, y, z, dirKey) => {
        const hit = tunnelLookupRef.current.get(tileKey({ x, y, z, dirKey }));
        if (!hit) return null;

        if (hit.reversed) {
            return {
                tunnel: { ...hit.tunnel, entry: hit.tunnel.exit, exit: hit.tunnel.entry },
                tunnelKey: hit.tunnelKey,
            };
        }

        return {
            tunnel: hit.tunnel,
            tunnelKey: hit.tunnelKey,
        };
    }, [tileKey]);

    const killWorm = useCallback((details = null) => {
        if (!alive.current) return;
        alive.current = false;
        phase.current = 'dead';

        if (deathMenuTimer.current) {
            clearTimeout(deathMenuTimer.current);
            deathMenuTimer.current = null;
        }

        useGameStore.setState({
            wormPhase: 'dead',
            wormOnFlippedTile: false,
            wormAlive: false,
            showWormDeathMenu: false,
            wormDeathDetails: details,
            wormTimeAlive: Math.floor(timeAliveRef.current),
        });

        // Let death state land first, then reveal menu for clearer sequencing.
        deathMenuTimer.current = setTimeout(() => {
            useGameStore.setState({ showWormDeathMenu: true });
            deathMenuTimer.current = null;
        }, 520);
    }, []);

    const beginTunnelTransition = useCallback((x, y, z, dirKey) => {
        const resolved = resolveTunnelAtTile(x, y, z, dirKey);
        if (!resolved) return;

        const { tunnel, tunnelKey } = resolved;

        if (voidTunnelKeysRef.current.has(tunnelKey)) {
            killWorm({
                reason: 'voided',
                tunnelKey,
                headTile: tileKey({ x, y, z, dirKey }),
            });
            return;
        }

        const traversals = tunnelUseCountsRef.current.get(tunnelKey) ?? 0;
        const nextTraversals = traversals + 1;
        tunnelUseCountsRef.current.set(tunnelKey, nextTraversals);
        if (nextTraversals === WORMHOLE_MAX_TRAVERSALS) {
            // Final free traversal — worm completes this tunnel, then dies when it steps
            // off the exit tile. Arms the deferred kill checked in the crawling phase.
            pendingVoidKillRef.current = {
                tunnelKey,
                exitTileKey: tileKey(tunnel.exit),
                armed: false,
            };
        }
        if (nextTraversals > WORMHOLE_MAX_TRAVERSALS) {
            // 4th touch: this tunnel is now fully void and kills immediately on contact.
            voidTunnelKeysRef.current.add(tunnelKey);
            pendingVoidKillRef.current = null;
            killWorm({
                reason: 'voided',
                tunnelKey,
                headTile: tileKey({ x, y, z, dirKey }),
                traversals: nextTraversals,
            });
            return;
        }

        // ── DEPOSIT ORBS ──────────────────────────────────────────────────────
        const liveCubies = useGameStore.getState().cubies;
        const entrySticker = liveCubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
        const entryFaceId = entrySticker?.curr ?? 0;
        const stableKey = getStableKey(x, y, z, dirKey, liveCubies);
        currentTunnelStableKeyRef.current = stableKey;

        if (stableKey && entryFaceId) {
            const depositState = useGameStore.getState();
            const healingProgress = depositState.wormHealingProgress ?? {};
            const progress = healingProgress[stableKey] ?? { deposited: 0, faceId: entryFaceId };
            const segmentsOnWorm = tailLength.current - BASE_TAIL_LENGTH;
            const available = depositState.wormOrbInventory?.[entryFaceId] ?? 0;
            const n = Math.min(available, HEAL_COST - progress.deposited, segmentsOnWorm);

            if (n > 0) {
                tailLength.current = Math.max(BASE_TAIL_LENGTH, tailLength.current - n);
                orbPickupColorsRef.current.length = Math.max(0, orbPickupColorsRef.current.length - Math.round(n / ORB_SEGMENT_GROWTH));
                const orbsLeft = Math.max(0, Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
                useGameStore.setState({
                    wormBodyTiles: orbsLeft,
                    wormOrbInventory: {
                        ...(depositState.wormOrbInventory ?? {}),
                        [entryFaceId]: (depositState.wormOrbInventory?.[entryFaceId] ?? 0) - n,
                    },
                    wormHealingProgress: {
                        ...healingProgress,
                        [stableKey]: { deposited: progress.deposited + n, faceId: entryFaceId },
                    },
                });
            }
        }
        // ── END DEPOSIT ───────────────────────────────────────────────────────

        // Determine whether this tunnel traversal will heal on exit (for portal ring pop fx).
        const postDepositProgress = useGameStore.getState().wormHealingProgress?.[stableKey];
        willHealRef.current = (postDepositProgress?.deposited ?? 0) >= HEAL_COST;

        activeTunnel.current = tunnel;
        pendingTunnelTrigger.current = null;
        pendingSelfCollision.current = null;
        // Remove the exit portal tile from the trail so the head landing on it after
        // exiting the tunnel doesn't immediately trigger a false self-collision.
        const exitTileKey = tileKey(tunnel.exit);
        ttFilterInPlace(tileTrail.current, k => k !== exitTileKey);
        tunnelProgress.current = 0;
        phase.current = 'entering';
        onFlippedTile.current = false;
        lastFlippedRef.current = false;
        const prevState = useGameStore.getState();
        prevVisualModeRef.current = prevState.visualMode;
        prevShowTunnelsRef.current = prevState.showTunnels ?? false;
        const nextTunnelCount = (prevState.wormTunnelCount ?? 0) + 1;
        const fc = resolveColors(prevState.settings, prevState.settings?.biomeMode?.faceAssignment) || FACE_COLORS;
        useGameStore.setState({
            wormPhase: 'entering',
            wormOnFlippedTile: false,
            wormTunnelCount: nextTunnelCount,
            showTunnels: true,
            wormActiveTunnelColors: {
                entryColor: fc[tunnel.entryColor] ?? FACE_COLORS[tunnel.entryColor] ?? '#00aaff',
                exitColor: fc[tunnel.exitColor] ?? FACE_COLORS[tunnel.exitColor] ?? '#ff8800',
            },
        });
    }, [killWorm, resolveTunnelAtTile, tileKey]);

    // Colors of each collected orb, in pickup order — used by WormBody to color segments
    const orbPickupColorsRef = useRef([]);

    const applyOrbPickupGrowth = (color, faceId) => {
        tailLength.current = Math.min(tailLength.current + ORB_SEGMENT_GROWTH, MAX_TAIL);
        orbPickupColorsRef.current.push(color);
        const orbCountOnWorm = Math.max(0, Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
        // PP are NOT awarded on pickup — only banked when the player wins (cube solved).
        // Track session total separately for the in-game counter.
        useGameStore.setState((state) => ({
            wormBodyTiles: orbCountOnWorm,
            wormSessionOrbs: (state.wormSessionOrbs ?? 0) + 1,
            ...(faceId ? {
                wormOrbInventory: {
                    ...(state.wormOrbInventory ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }),
                    [faceId]: (state.wormOrbInventory?.[faceId] ?? 0) + ORB_SEGMENT_GROWTH,
                },
            } : {}),
        }));
    };

    const spawnWormholePair = () => {
        const tile = randomUnflippedTile(cubiesRef.current, size, [pos.current]);
        if (!tile) return;
        useGameStore.setState((state) => {
            const mm = buildManifoldGridMap(state.cubies, size);
            return {
                cubies: flipStickerPair(state.cubies, size, tile.x, tile.y, tile.z, tile.dirKey, mm)
            };
        });
    };

    // ── Per-frame simulation ──────────────────────────────────────────────────
    const tick = useCallback((delta) => {
        const STEP_SEC = 1.0 / wormSpeedRef.current;

        if (!alive.current) return;
        if (wormPausedRef.current) return;

        const st = useGameStore.getState();

        // Track time alive in a ref only; published to the store on death or win
        // to avoid 10Hz Zustand updates that would re-render the entire HUD tree.
        timeAliveRef.current += delta;

        // Earn parity points for surviving (1 PP per SURVIVAL_TICK_INTERVAL seconds)
        survivalTickRef.current += delta;
        if (survivalTickRef.current >= SURVIVAL_TICK_INTERVAL) {
            survivalTickRef.current -= SURVIVAL_TICK_INTERVAL;
            st.earnCoins(EARN_WORM_SURVIVAL_TICK);
        }

        // In finalHealing / solved phases no new wormholes spawn — player heals the remaining ones.
        const gamePhaseNow = st.wormGamePhase;
        const noMoreSpawns = gamePhaseNow === 'finalHealing' || gamePhaseNow === 'solved';
        wormholeTimer.current -= delta;
        if (wormholeTimer.current <= 0) {
            if (!noMoreSpawns) spawnWormholePair();
            wormholeTimer.current = wormholeIntervalRef.current;
        }
        const countdown = noMoreSpawns ? 0 : Math.max(0, Math.ceil(wormholeTimer.current * 10) / 10);
        const countdownDeci = Math.round(countdown * 10);
        if (countdownDeci !== lastCountdownDeci.current) {
            lastCountdownDeci.current = countdownDeci;
            st.setWormholeCountdown(countdown);
        }

        // Always advance jump
        if (isJumping.current) {
            // Tie jump progress to tile-traverse progress so speed slider never changes jump distance.
            jumpT.current += (delta / STEP_SEC) / JUMP_TILE_SPAN;
            if (jumpT.current >= 1) {
                jumpT.current = 0;
                isJumping.current = false;
                jumpCount.current = 0;
            }
        }

        // ── Phase handlers ───────────────────────────────────────────────────────
        // Each phase owns its update logic plus optional enter()/exit() hooks that
        // fire exactly once per phase transition (detected via prevPhaseRef).
        // Defined inline so they always close over the current cubies, wormSpeed, etc.
        // update() returns true to signal an early exit (replaces bare `return`s).
        const PHASE_HANDLERS = {
            crawling: {
                // enter() fires once when transitioning back from 'exiting'.
                enter() {
                    selfCollisionGraceStepsRef.current = SELF_COLLISION_GRACE_STEPS_AFTER_TUNNEL;
                    // Clear the pre-tunnel tile trail. The body traveled through the tunnel so those
                    // old surface positions no longer reliably reflect where body segments are.
                    // Resetting to just the exit tile lets the collision window rebuild naturally,
                    // preventing false-positive self-collision deaths in the post-tunnel window.
                    // The grace period covers the initial steps where the trail is too short to
                    // reliably catch real collisions.
                    ttReset(tileTrail.current, tileKey(pos.current));
                    useGameStore.setState({
                        wormPhase: 'crawling',
                        wormOnFlippedTile: false,
                        showTunnels: true,
                        wormActiveTunnelColors: null,
                    });
                    onFlippedTile.current = false;
                    lastFlippedRef.current = false;
                },
                update(delta, STEP_SEC) {
                    const headOnSurface = isSurfaceTilePos(pos.current, size);
                    if (!headOnSurface) {
                        pendingSelfCollision.current = null;
                        pendingTunnelTrigger.current = null;
                    }

                    // Apply pending turn — RELATIVE to current heading
                    if (pendingTurns.current.length > 0) {
                        const t = pendingTurns.current.shift();
                        if (t === 'jump') {
                            startJump();
                        } else if (wormControlModeRef.current === 'oriented') {
                            if (t === 'up' || t === 'down' || t === 'left' || t === 'right') {
                                moveDir.current = t;
                            }
                        } else {
                            if (t === 'left' || t === 'right') {
                                moveDir.current = turnWorm(moveDir.current, t);
                            }
                            if (t === 'down') moveDir.current = turnWorm(turnWorm(moveDir.current, 'left'), 'left');
                        }
                    }

                    // Advance interpolation
                    if (interpT.current < 1) {
                        interpT.current = Math.min(1, interpT.current + delta / STEP_SEC);
                    }

                    if (pendingVoidKillRef.current?.armed) {
                        const { tunnelKey, exitTileKey } = pendingVoidKillRef.current;
                        const headTileKey = tileKey(pos.current);
                        const hasClearedExitTile = headTileKey !== exitTileKey;
                        const fullyOnNextTile = interpT.current >= 1;

                        if (headOnSurface && hasClearedExitTile && fullyOnNextTile) {
                            pendingVoidKillRef.current = null;
                            voidTunnelKeysRef.current.add(tunnelKey);
                            killWorm({ reason: 'voided', tunnelKey, exitTileKey, headTile: headTileKey });
                            return true;
                        }
                    }

                    if (headOnSurface && pendingTunnelTrigger.current) {
                        const { x, y, z, dirKey } = pendingTunnelTrigger.current;
                        if (interpT.current >= TUNNEL_TRIGGER_PROGRESS && !isJumping.current) {
                            beginTunnelTransition(x, y, z, dirKey);
                            return true;
                        }
                    }

                    if (headOnSurface && pendingSelfCollision.current) {
                        if (selfCollisionGraceStepsRef.current > 0) {
                            pendingSelfCollision.current = null;
                        } else if (isJumping.current) {
                            // Allow jumping over your own body tile before impact threshold.
                            pendingSelfCollision.current = null;
                        } else if (pendingTunnelTrigger.current) {
                            // Prioritize wormhole entry over self-collision on the same tile.
                            // This fixes the bug where entering a wormhole whose entrance is occupied by your tail
                            // (which is almost always true for the first few tiles of a jump) kills you.
                            pendingSelfCollision.current = null;
                        } else if (interpT.current >= SELF_COLLISION_TRIGGER_PROGRESS) {
                            killWorm({
                                reason: 'self-collision',
                                progress: Number(interpT.current.toFixed(2)),
                                headTile: tileKey(pos.current),
                                collisionTile: pendingSelfCollision.current?.key ?? null,
                            });
                            return true;
                        }
                    }

                    // --- Continuous path recording for contiguous touching clones ---
                    const pWorld = prevWorldPos.current;
                    const cWorld = curWorldPos.current;

                    // Writes the interpolated ground position into outPos (module-level scratch or a direct ref).
                    // Returns cNorm — a direct reference to a FACE_NORMALS constant in the straight-crawl case
                    // (no allocation), or a newly allocated Vector3 only for the rare corner-lerp midpoint.
                    const evaluatePosAndNormal = (tValue, outPos) => {
                        outPos.copy(cWorld);
                        let cNorm = FACE_NORMALS[pos.current.dirKey] ?? new THREE.Vector3(0, 0, 1);

                        if (pWorld && tValue < 1) {
                            if (crossingCorner.current) {
                                const oldNormal = FACE_NORMALS[prevDirKey.current];
                                const newNormal = FACE_NORMALS[pos.current.dirKey];
                                _evalCornerVtx.copy(pWorld).addScaledVector(newNormal, 0.52);

                                if (tValue < 0.45) {
                                    outPos.copy(pWorld).lerp(_evalCornerVtx, tValue / 0.45);
                                    cNorm = oldNormal;
                                } else if (tValue > 0.55) {
                                    outPos.copy(_evalCornerVtx).lerp(cWorld, (tValue - 0.55) / 0.45);
                                    cNorm = newNormal;
                                } else {
                                    outPos.copy(_evalCornerVtx);
                                    _evalCornerNorm.lerpVectors(oldNormal, newNormal, (tValue - 0.45) / 0.10).normalize();
                                    cNorm = _evalCornerNorm;
                                }
                            } else {
                                outPos.copy(pWorld).lerp(cWorld, tValue);
                            }
                        }
                        return cNorm;
                    };

                    // Write head position directly into the live refs — zero allocations.
                    const headNorm = evaluatePosAndNormal(interpT.current, headInterpPos.current);
                    currentNormal.current.copy(headNorm);

                    // Back-fill step history so it is completely framerate independent
                    // If the game lags and skips 0.3 seconds, this perfectly reconstructs the 15 missing physics frames along the true 3D edge curve
                    while (lastRecordedT.current <= interpT.current) {
                        // _evalHPos is a module-level scratch; ptNorm is a FACE_NORMALS ref (no alloc) except at corner midpoint.
                        const ptNorm = evaluatePosAndNormal(lastRecordedT.current, _evalHPos);

                        // Chain-fountain: each history entry records the jump height that was active at THAT spatial position.
                        // Since jumpT and interpT advance at identical rates (both scale by delta/STEP_SEC), the jumpT at
                        // any recorded position r is: jumpT_now - (interpT_now - r). Clamping to [0,1] naturally zeroes
                        // out positions before the jump started or after it ended. Body segments then inherit the arc as
                        // they travel through this stored lift — exactly like beads lifting off one-by-one in a chain fountain.
                        const jumpTAtR = isJumping.current
                            ? Math.max(0, Math.min(1, jumpT.current - (interpT.current - lastRecordedT.current)))
                            : 0;
                        const ptJump = jumpTAtR > 0 ? Math.sin(jumpTAtR * Math.PI) * JUMP_HEIGHT : 0;
                        // Compute lifted pos into module-level scratch, then copy into pre-allocated ring slot.
                        _evalLiftedPos.copy(_evalHPos).addScaledVector(ptNorm, WORM_LIFT + ptJump);
                        shPush(stepHistory.current, _evalLiftedPos, ptNorm);
                        lastRecordedT.current += 0.02; // A guaranteed resolution of 50 mathematical sub-steps per tile traverse
                    }
                    // -----------------------------------------------------------

                    stepAcc.current += delta;
                    // When navigating a corner, traversing double the distance means we should theoretically
                    // give it more time so the speed looks constant, but the Bezier arc covers it nicely.
                    if (stepAcc.current >= STEP_SEC) {
                        stepAcc.current -= STEP_SEC;
                        interpT.current = 0;
                        lastRecordedT.current = 0;
                        _prevWP.copy(_curWP);
                        prevWorldPos.current = _prevWP;
                        prevDirKey.current = pos.current.dirKey;

                        const oldDirKey = pos.current.dirKey;
                        const next = getNextSurfacePosition(pos.current, moveDir.current, size);

                        // We clear the corner navigation flag unless we're about to cross one right now
                        crossingCorner.current = false;

                        if (next) {
                            const crossedFace = next.dirKey !== oldDirKey;
                            const nextPos = { x: next.x, y: next.y, z: next.z, dirKey: next.dirKey };
                            const nextKey = tileKey(nextPos);
                            // tailLength is measured in visual balls, not tiles.
                            // Convert to approximate occupied tile count so collision checks align with what players see.
                            const occupiedTiles = Math.max(1, Math.ceil((tailLength.current * BODY_BALL_SPACING) / 1.0));
                            const bodyTilesBehindHead = Math.max(0, occupiedTiles - 1);
                            // Direct indexed scan over tileTrail avoids allocating an intermediate
                            // slice just for Array.includes().  bodyTilesBehindHead ≤ ~167 at MAX_TAIL.
                            const trailLimit = Math.min(1 + bodyTilesBehindHead, tileTrail.current.count);
                            let bodyHit = false;
                            for (let ti = 1; ti < trailLimit; ti++) {
                                if (ttAt(tileTrail.current, ti) === nextKey) { bodyHit = true; break; }
                            }
                            const nextOnSurface = isSurfaceTilePos(nextPos, size);
                            const selfHit = nextOnSurface && selfCollisionGraceStepsRef.current <= 0 && bodyHit;
                            if (selfHit) {
                                // Defer self-hit until we've penetrated the tile by 40%.
                                // This gives players a short reaction window to jump over their body.
                                pendingSelfCollision.current = { key: nextKey };
                            }

                            pos.current = nextPos;
                            if (nextOnSurface) {
                                ttPush(tileTrail.current, nextKey);
                            }
                            if (next.moveDir) moveDir.current = next.moveDir;

                            if (crossedFace) {
                                crossingCorner.current = true;
                            }

                            pendingTunnelTrigger.current = null;
                            if (!selfHit) {
                                pendingSelfCollision.current = null;
                            }
                            if (selfCollisionGraceStepsRef.current > 0) {
                                selfCollisionGraceStepsRef.current -= 1;
                            }
                        } else {
                            moveDir.current = turnWorm(turnWorm(moveDir.current, 'left'), 'left');
                            pendingTunnelTrigger.current = null;
                            pendingSelfCollision.current = null;
                        }

                        // Immediately update curWorldPos so the interpolation target is correct
                        { const _wp = getStickerWorldPos(pos.current.x, pos.current.y, pos.current.z, pos.current.dirKey, size, 0); _curWP.set(_wp[0], _wp[1], _wp[2]); curWorldPos.current = _curWP; }

                        // Powerup collision
                        const { x, y, z, dirKey } = pos.current;
                        const puIdx = powerupsRef.current.findIndex(p => p.x === x && p.y === y && p.z === z && p.dirKey === dirKey);
                        if (puIdx !== -1) {
                            const pickedUp = powerupsRef.current[puIdx];
                            const liveCubies = st.cubies;
                            const pickedSticker = getStickerSafe(liveCubies, pickedUp.x, pickedUp.y, pickedUp.z, pickedUp.dirKey);
                            // Orbs on flipped tiles hover above the surface — worm must jump to reach them
                            const tileIsFlipped = !!(pickedSticker && pickedSticker.curr !== pickedSticker.orig);
                            if (tileIsFlipped && !isJumping.current) {
                                // Worm crawled onto the tile but didn't jump — orb is out of reach
                            } else {
                                const pickedFaceId = pickedSticker ? pickedSticker.curr : 0;
                                const liveColors = resolveColors(st.settings);
                                const pickedColor = ensureOrbContrast((pickedFaceId && liveColors[pickedFaceId]) ?? '#22ff88');
                                applyOrbPickupGrowth(pickedColor, pickedFaceId);
                                pendingOrbFlashRef.current = { color: pickedColor, pos: curWorldPos.current.toArray() };
                                const newPowerup = { ...randomFreeTile(size, [...powerupsRef.current, pos.current]), type: 'apple' };
                                powerupsRef.current[puIdx] = newPowerup;
                                st.setWormPowerups(powerupsRef.current.slice());
                            }
                        }

                        // Flipped tile detection
                        const sticker = cubiesRef.current?.[x]?.[y]?.[z]?.stickers?.[dirKey];
                        const isFlipped = !!(sticker && sticker.curr !== sticker.orig);
                        const resolved = isFlipped ? resolveTunnelAtTile(x, y, z, dirKey) : null;
                        const isVoidZone = !!(resolved && voidTunnelKeysRef.current.has(resolved.tunnelKey));
                        onFlippedTile.current = isFlipped && !isVoidZone;

                        // Flipped tiles are instant wormholes unless the player is currently jumping over them.

                        if (onFlippedTile.current !== lastFlippedRef.current) {
                            lastFlippedRef.current = onFlippedTile.current;
                            st.setWormOnFlippedTile(onFlippedTile.current);
                        }

                        if (isFlipped) {
                            pendingTunnelTrigger.current = { x, y, z, dirKey };
                            // Swept-entry guard: if the step accumulator remainder indicates the worm has already
                            // spent ≥ TUNNEL_TRIGGER_PROGRESS of this tile's step time on the flipped tile
                            // (possible after a lag spike where delta > STEP_SEC), fire the tunnel transition
                            // immediately. Without this, the deferred trigger can be cleared by a second step
                            // firing in the following frame before interpT reaches the threshold.
                            if (!isJumping.current && stepAcc.current / STEP_SEC >= TUNNEL_TRIGGER_PROGRESS) {
                                pendingTunnelTrigger.current = null;
                                beginTunnelTransition(x, y, z, dirKey);
                                return true;
                            }
                        }
                    }
                    return false;
                },
            },

            entering: {
                // enter() is intentionally absent: beginTunnelTransition sets wormPhase/'glass'
                // immediately on the same tick the transition is triggered — no one-frame delay.
                update(delta) {
                    tunnelProgress.current += delta * (2.5 * TUNNEL_SPEED_SCALE);
                    if (activeTunnel.current) {
                        // Head travels first third of the tunnel (entry face → cube interior)
                        const tunnelT = tunnelProgress.current * 0.33;
                        getTunnelWorldPosInto(headInterpPos.current, activeTunnel.current, tunnelT, size);
                        const entryN = FACE_NORMALS[activeTunnel.current.entry.dirKey];
                        if (entryN) currentNormal.current.copy(entryN);
                    }
                    if (tunnelProgress.current >= 1) {
                        tunnelProgress.current = 0;
                        phase.current = 'tunnel';
                        // tunnel.enter() fires next tick → setWormPhase('tunnel')
                    }
                    return false;
                },
            },

            tunnel: {
                enter() {
                    useGameStore.getState().setWormPhase('tunnel');
                },
                update(delta) {
                    tunnelProgress.current += delta * (0.65 * TUNNEL_SPEED_SCALE);
                    if (activeTunnel.current) {
                        // Head travels middle third of the tunnel (through cube core)
                        const tunnelT = 0.33 + tunnelProgress.current * 0.34;
                        getTunnelWorldPosInto(headInterpPos.current, activeTunnel.current, tunnelT, size);
                        // Switch normal to exit face at the midpoint
                        const n = tunnelProgress.current > 0.5
                            ? FACE_NORMALS[activeTunnel.current.exit.dirKey]
                            : FACE_NORMALS[activeTunnel.current.entry.dirKey];
                        if (n) currentNormal.current.copy(n);
                    }
                    if (tunnelProgress.current >= 1) {
                        tunnelProgress.current = 0;
                        phase.current = 'exiting';
                        // exiting.enter() fires next tick → setWormPhase + pos snap to exit tile
                    }
                    return false;
                },
            },

            exiting: {
                enter() {
                    useGameStore.getState().setWormPhase('exiting');
                    // Snap the logical grid position to the exit tile so crawling
                    // resumes from the correct sticker when this phase completes.
                    if (activeTunnel.current) {
                        const ex = activeTunnel.current.exit;
                        pos.current = { x: ex.x, y: ex.y, z: ex.z, dirKey: ex.dirKey };
                        { const _wp = getStickerWorldPos(pos.current.x, pos.current.y, pos.current.z, pos.current.dirKey, size, 0); _curWP.set(_wp[0], _wp[1], _wp[2]); curWorldPos.current = _curWP; }
                    }
                },
                update(delta) {
                    tunnelProgress.current += delta * (2.0 * TUNNEL_SPEED_SCALE);
                    if (activeTunnel.current) {
                        // Head travels final third of the tunnel (cube interior → exit face)
                        const tunnelT = 0.67 + tunnelProgress.current * 0.33;
                        getTunnelWorldPosInto(headInterpPos.current, activeTunnel.current, tunnelT, size);
                        const exitN = FACE_NORMALS[activeTunnel.current.exit.dirKey];
                        if (exitN) currentNormal.current.copy(exitN);
                    }
                    if (tunnelProgress.current >= 1) {
                        const voidKillState = pendingVoidKillRef.current;
                        const exitedTunnel = activeTunnel.current; // capture before null
                        const exitStableKey = currentTunnelStableKeyRef.current;
                        tunnelProgress.current = 0;
                        activeTunnel.current = null;
                        currentTunnelStableKeyRef.current = null;
                        if (voidKillState) {
                            pendingVoidKillRef.current = { ...voidKillState, armed: true };
                        }

                        phase.current = 'crawling';
                        // crawling.enter() fires next tick → grace steps + Zustand crawling reset

                        // Heal immediately at exit completion (not deferred) when enough orbs deposited.
                        const exitStore = useGameStore.getState();
                        const exitProgress = exitStableKey ? (exitStore.wormHealingProgress?.[exitStableKey]) : null;
                        if (exitProgress?.deposited >= HEAL_COST && exitedTunnel) {
                            const { entry, exit: exitTile } = exitedTunnel;
                            // Write healBurstMap for both tiles BEFORE healing (sticker orig fields intact)
                            const entrySticker = getStickerSafe(exitStore.cubies, entry.x, entry.y, entry.z, entry.dirKey);
                            const exitStickerData = getStickerSafe(exitStore.cubies, exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey);
                            if (entrySticker) healBurstMap.set(getManifoldGridId(entrySticker, size), 1);
                            if (exitStickerData) healBurstMap.set(getManifoldGridId(exitStickerData, size), 1);
                            healFiredRef.current = true;
                            let healed = healSticker(exitStore.cubies, size, entry.x, entry.y, entry.z, entry.dirKey);
                            healed = healSticker(healed, size, exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey);
                            exitStore.setCubies(healed);
                            const newProgress = { ...(exitStore.wormHealingProgress ?? {}) };
                            delete newProgress[exitStableKey];
                            exitStore.setWormHealingProgress(newProgress);
                            healedRef.current += 1;
                            exitStore.setWormHealedCount(healedRef.current);
                            useGameStore.getState().earnCoins(EARN_WORM_HEALED_FACE);
                            pendingHealBurstRef.current = { exitTile: exitedTunnel.exit, entryTile: exitedTunnel.entry };
                        }
                        // else: partial/no deposit — tunnel stays flipped, progress persists
                    }
                    return false;
                },
            },
        };

        // ── Dispatch: detect phase transitions, then run the active handler ──────
        const currentPhase = phase.current;
        if (prevPhaseRef.current !== currentPhase) {
            PHASE_HANDLERS[prevPhaseRef.current]?.exit?.();
            PHASE_HANDLERS[currentPhase]?.enter?.();
            prevPhaseRef.current = currentPhase;
        }
        if (PHASE_HANDLERS[currentPhase].update(delta, STEP_SEC)) return;

    }, [size, beginTunnelTransition, resolveTunnelAtTile, killWorm]);



    const queueTurn = useCallback((dir) => {
        const q = pendingTurns.current;
        if (q.length >= 3) q.shift();
        if (q[q.length - 1] !== dir) q.push(dir);
    }, []);

    // Spawn initial powerups once on mount
    useEffect(() => {
        const initial = [];
        const startPos = INITIAL_POS(size);
        for (let i = 0; i < wormOrbCount; i++) {
            initial.push({ ...randomFreeTile(size, [...initial, startPos]), type: 'apple' });
        }

        // Full local-state reset for new runs (retry/new setup), not only on size changes.
        pos.current = startPos;
        moveDir.current = INITIAL_DIR;
        phase.current = 'crawling';
        tunnelProgress.current = 0;
        activeTunnel.current = null;
        stepAcc.current = 0;
        pendingTurns.current = [];
        onFlippedTile.current = false;
        lastFlippedRef.current = false;
        prevDirKey.current = null;
        crossingCorner.current = false;
        interpT.current = 1;
        prevWorldPos.current = null;
        { const _wp = getStickerWorldPos(startPos.x, startPos.y, startPos.z, startPos.dirKey, size, 0); _curWP.set(_wp[0], _wp[1], _wp[2]); curWorldPos.current = _curWP; }
        headInterpPos.current.copy(curWorldPos.current);
        currentNormal.current.copy(FACE_NORMALS[startPos.dirKey] ?? new THREE.Vector3(0, 0, 1));
        isJumping.current = false;
        jumpT.current = 0;
        jumpCount.current = 0;
        pendingTunnelTrigger.current = null;
        pendingSelfCollision.current = null;
        selfCollisionGraceStepsRef.current = 0;
        tailLength.current = BASE_TAIL_LENGTH;
        orbPickupColorsRef.current = [];
        shReset(stepHistory.current);
        lastRecordedT.current = 0;
        healedRef.current = 0;
        tunnelUseCountsRef.current = new Map();
        voidTunnelKeysRef.current = new Set();
        pendingVoidKillRef.current = null;
        prevPhaseRef.current = 'crawling';

        powerupsRef.current = initial;
        alive.current = true;
        ttReset(tileTrail.current, tileKey(startPos));
        timeAliveRef.current = 0;
        survivalTickRef.current = 0;
        useGameStore.setState({
            wormPowerups: initial,
            wormBodyTiles: 0,
            wormOrbInventory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
            wormHealingProgress: {},
            wormHealedCount: 0,
            wormholeCountdown: wormholeInterval,
            wormAlive: true,
            showWormDeathMenu: false,
            wormDeathDetails: null,
            wormPhase: 'crawling',
            wormOnFlippedTile: false,
            // NOTE: do NOT reset wormPaused here. initWormMode sets it to true so
            // the scramble animation plays before gameplay begins; HealerWormMode3DWrapper
            // releases it to false after the countdown finishes.
            wormTimeAlive: 0,
            wormTunnelCount: 0,
        });
        wormholeTimer.current = wormholeInterval;
        lastCountdownDeci.current = Math.round(wormholeInterval * 10);
    }, [size, wormRunId, wormOrbCount, wormholeInterval]);

    useEffect(() => () => {
        if (deathMenuTimer.current) {
            clearTimeout(deathMenuTimer.current);
            deathMenuTimer.current = null;
        }
    }, []);

    // Track the last pending rotation so we can apply it to powerup positions when
    // the animation commits (rotationEpoch increments).
    const lastPendingMoveRef = useRef(null);
    useEffect(() => {
        const unsub = useGameStore.subscribe(
            s => s.animState,
            animState => { if (animState) lastPendingMoveRef.current = animState; }
        );
        return unsub;
    }, []);

    // When a cube rotation commits, transform every powerup so it follows its tile.
    useEffect(() => {
        const unsub = useGameStore.subscribe(
            s => s.rotationEpoch,
            () => {
                const rot = lastPendingMoveRef.current;
                if (!rot) return;
                const { axis, dir, sliceIndex } = rot;

                // Rotate powerups
                if (powerupsRef.current.length) {
                    const pu = powerupsRef.current;
                    for (let i = 0; i < pu.length; i++) pu[i] = rotateTilePosition(pu[i], axis, sliceIndex, dir, size);
                    useGameStore.getState().setWormPowerups(pu.slice());
                }

                // Rotate the worm's logical grid position so it stays on its tile
                const newPos = rotateTilePosition(pos.current, axis, sliceIndex, dir, size);
                pos.current = newPos;
                { const _wp = getStickerWorldPos(newPos.x, newPos.y, newPos.z, newPos.dirKey, size, 0); _curWP.set(_wp[0], _wp[1], _wp[2]); curWorldPos.current = _curWP; }
                // When paused (e.g. during opening scramble), snap the render position too so
                // the worm lands correctly on its tile after the rotation animation finishes.
                if (wormPausedRef.current) {
                    headInterpPos.current.copy(curWorldPos.current);
                }

                // Rotate the self-collision tile trail
                ttMapInPlace(tileTrail.current, key => {
                    parseTileKey(key, _parseTile);
                    const r = rotateTilePosition(_parseTile, axis, sliceIndex, dir, size);
                    return `${r.x},${r.y},${r.z},${r.dirKey}`;
                });

                // If mid-tunnel, rotate active tunnel endpoints so exit snap lands on the correct tile
                if (activeTunnel.current) {
                    activeTunnel.current = {
                        ...activeTunnel.current,
                        entry: rotateTilePosition(activeTunnel.current.entry, axis, sliceIndex, dir, size),
                        exit: rotateTilePosition(activeTunnel.current.exit, axis, sliceIndex, dir, size),
                    };
                }
            }
        );
        return unsub;
    }, [size]);

    return {
        pos, moveDir, phase, tunnelProgress, activeTunnel, onFlippedTile,
        interpT, prevWorldPos, curWorldPos, jumpT, isJumping, jumpLift,
        headInterpPos, currentNormal,
        tailLength, stepHistory, orbPickupColorsRef, tick, queueTurn,
        voidTunnelKeysRef, tunnelUseCountsRef,
        willHealRef, healFiredRef, pendingHealBurstRef, pendingOrbFlashRef,
        tileTrail, killWorm,
        timeAliveRef,
    };
}

// Pre-allocated scratch vectors for WormChaseCamera — avoids per-frame allocations
const _camForward = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _camWormWorld = new THREE.Vector3();
const _camNormal = new THREE.Vector3();
const _camTargetCam = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _camUpVec = new THREE.Vector3();
const _camVec = new THREE.Vector3();
const _camLookVec = new THREE.Vector3();
const _camLookAheadVec = new THREE.Vector3();
const _camTunnelTangent = new THREE.Vector3();
const _camTunnelRight = new THREE.Vector3();
const _camSurfCam = new THREE.Vector3();
// Ribbon-camera scratch vectors — recomputed each frame from tunnel geometry
const _ribVStart = new THREE.Vector3();
const _ribVEnd   = new THREE.Vector3();
const _ribMidA   = new THREE.Vector3();
const _ribMidB   = new THREE.Vector3();
const _ribAxis   = new THREE.Vector3();
const _ribPerp   = new THREE.Vector3();

// ─── Chase Camera (dynamic zoom based on tail length) ───────────────────────
function WormChaseCamera({ worm, size }) {
    const { camera, size: viewportSize } = useThree();
    const camPosRef = useRef(new THREE.Vector3(0, 6, 10));
    const lookAtRef = useRef(new THREE.Vector3(0, 0, 0));
    const camUpRef = useRef(new THREE.Vector3(0, 1, 0));  // smoothed up — prevents instant snap
    const prevPhaseRef = useRef('crawling');              // detect phase transitions for snap logic
    const zoomExtraRef = useRef(0);   // burst zoom accumulated
    const prevTailLen = useRef(BASE_TAIL_LENGTH);   // detect new parity pickups

    useFrame((_, delta) => {
        const gamePhase = useGameStore.getState().wormGamePhase ?? 'active';
        const phase = worm.phase.current;
        const tailLen = worm.tailLength.current;
        const viewportAspect = viewportSize.width / Math.max(1, viewportSize.height);

        // Only use the overview during the INITIAL scramble (worm has never moved).
        // Mid-game auto-rotation scrambles keep the follow camera so the view doesn't snap away.
        if (gamePhase === 'scrambling' && !worm.prevWorldPos.current) {
            const dist = 5 + size * 4.0;
            _camTargetCam.set(0.6, 1.1, 1).normalize().multiplyScalar(dist);
            _camTargetLook.set(0, 0, 0);
            camPosRef.current.lerp(_camTargetCam, Math.min(1, delta * 2.5));
            lookAtRef.current.lerp(_camTargetLook, Math.min(1, delta * 2.5));
            camera.position.copy(camPosRef.current);
            camera.up.set(0, 1, 0);
            camera.lookAt(lookAtRef.current);
            return;
        }

        // Use a continuous portrait factor so camera framing doesn't jump at aspect=1.
        const portraitFactor = THREE.MathUtils.clamp((1 - viewportAspect) / 0.45, 0, 1);
        const baseFov = THREE.MathUtils.lerp(70, 82, portraitFactor);
        const tunnelMix = phase === 'tunnel' ? 1 : (phase === 'entering' || phase === 'exiting' ? 0.35 : 0);
        const targetFov = THREE.MathUtils.lerp(baseFov, TUNNEL_SURF_FOV, tunnelMix);
        const fovAlpha = Math.min(1, delta * 6);
        const nextFov = THREE.MathUtils.lerp(camera.fov, targetFov, fovAlpha);
        if (Math.abs(nextFov - camera.fov) > 0.01) {
            camera.fov = nextFov;
            camera.updateProjectionMatrix();
        }

        // Detect new pickup → brief burst zoom that decays quickly
        if (tailLen > prevTailLen.current) {
            prevTailLen.current = tailLen;
            zoomExtraRef.current = Math.min(zoomExtraRef.current + ZOOM_BURST, MAX_EXTRA_ZOOM);
        }
        // Decay burst zoom over time
        if (zoomExtraRef.current > 0) {
            zoomExtraRef.current = Math.max(0, zoomExtraRef.current - delta * 3.0);
        }

        // Permanent zoom scales with orbs collected so the longer worm always fits in frame.
        // Each orb adds 0.18 units of pull-back; cap is size-relative.
        const MAX_PERM_ZOOM = size * 2.6;
        const orbCount = Math.max(0, Math.floor((tailLen - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
        const permZoom = Math.min(orbCount * 0.18, MAX_PERM_ZOOM);
        const aspectZoomBoost = THREE.MathUtils.lerp(0, 0.4, portraitFactor);
        const extraZoom = permZoom + Math.min(zoomExtraRef.current, MAX_EXTRA_ZOOM);
        const camHeight = CAM_HEIGHT_BASE + extraZoom + aspectZoomBoost;
        const camBack = CAM_BACK_BASE + extraZoom * 0.8 + aspectZoomBoost * 0.9;

        if (phase === 'crawling' || !worm.activeTunnel.current) {
            // Smooth interpolated worm world position (copy into scratch — no .clone())
            _camWormWorld.copy(worm.headInterpPos.current);
            _camNormal.copy(worm.currentNormal.current);

            const { dirKey } = worm.pos.current;

            // Derive forward from actual tile displacement — guaranteed correct direction
            // regardless of face/moveDir coordinate conventions.
            if (worm.prevWorldPos.current && worm.curWorldPos.current) {
                _camForward.subVectors(worm.curWorldPos.current, worm.prevWorldPos.current);
                if (_camForward.lengthSq() < 0.0001) {
                    // Worm hasn't moved yet — fall back to DIR_FORWARD lookup
                    const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 0, -1];
                    _camForward.set(fwdArr[0], fwdArr[1], fwdArr[2]);
                } else {
                    _camForward.normalize();
                }
            } else {
                const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 0, -1];
                _camForward.set(fwdArr[0], fwdArr[1], fwdArr[2]);
            }

            // Camera: behind worm (opposite of forward) + above face (along normal).
            _camTargetCam.copy(_camWormWorld)
                .addScaledVector(_camNormal, camHeight)
                .addScaledVector(_camForward, -camBack);
            _camTargetLook.copy(_camWormWorld).addScaledVector(_camForward, LOOK_AHEAD);

            // Camera UP: always world-Y so the horizon stays level.
            // Bottom face is the only case where Y-up would flip the view.
            _camUp.set(0, _camNormal.y < -0.8 ? -1 : 1, 0);

            const alpha = Math.min(1, CAM_LERP * delta);
            camPosRef.current.lerp(_camTargetCam, alpha);
            lookAtRef.current.lerp(_camTargetLook, alpha);
            camera.position.copy(camPosRef.current);
            camUpRef.current.lerp(_camUp, Math.min(1, CAM_LERP * delta)).normalize();
            camera.up.copy(camUpRef.current);
            camera.lookAt(lookAtRef.current);
        } else if ((phase === 'entering' || phase === 'tunnel' || phase === 'exiting') && worm.activeTunnel.current) {
            // Map phase+progress to a single [0,1] parameter along the Möbius ribbon.
            const tp = worm.tunnelProgress.current;
            const t = phase === 'entering' ? tp * 0.33 :
                      phase === 'tunnel'   ? 0.33 + tp * 0.34 :
                                             0.67 + tp * 0.33;

            const tunnel = worm.activeTunnel.current;

            // Publish to MobiusHUD's DOM RAF loop and MobiusTunnel dim system.
            tunnelState.active = true;
            tunnelState.t = t;
            tunnelState.activeTunnelId = tunnel.pairId ?? null;
            const entN = FACE_NORMALS[tunnel.entry.dirKey] ?? FACE_NORMALS.PY;
            const extN = FACE_NORMALS[tunnel.exit.dirKey]  ?? FACE_NORMALS.PY;

            // Ribbon anchor points — exactly matches MobiusTunnel.jsx geometry:
            //   vStart/vEnd = cubie-centre stepped inward by FACE_OFFSET (0.52)
            //   midA/midB   = face-normal × MINI_FACE_R (0.25), mini-cube docking
            const FACE_OFF = 0.52, MINI_R = 0.25;
            const ew = getStickerWorldPos(tunnel.entry.x, tunnel.entry.y, tunnel.entry.z, tunnel.entry.dirKey, size, 0);
            const xw = getStickerWorldPos(tunnel.exit.x,  tunnel.exit.y,  tunnel.exit.z,  tunnel.exit.dirKey,  size, 0);
            _ribVStart.set(ew[0] - entN.x * FACE_OFF, ew[1] - entN.y * FACE_OFF, ew[2] - entN.z * FACE_OFF);
            _ribVEnd  .set(xw[0] - extN.x * FACE_OFF, xw[1] - extN.y * FACE_OFF, xw[2] - extN.z * FACE_OFF);
            _ribMidA  .set(entN.x * MINI_R, entN.y * MINI_R, entN.z * MINI_R);
            _ribMidB  .set(extN.x * MINI_R, extN.y * MINI_R, extN.z * MINI_R);

            // Twist axis and initial perp (matching fillRibbon's perpBase in MobiusTunnel)
            _ribAxis.subVectors(_ribVEnd, _ribVStart).normalize();
            _ribPerp.crossVectors(_ribAxis, entN);
            if (_ribPerp.lengthSq() < 0.001) { _ribPerp.set(0, 1, 0); _ribPerp.crossVectors(_ribAxis, _ribPerp); }
            if (_ribPerp.lengthSq() < 0.001) { _ribPerp.set(0, 0, 1); _ribPerp.crossVectors(_ribAxis, _ribPerp); }
            _ribPerp.normalize();

            // Worm position at current t; a point slightly ahead gives the forward tangent.
            const tAhead = Math.min(t + 0.05, 1.0);
            getTunnelWorldPosInto(_camLookVec, tunnel, t, size);
            getTunnelWorldPosInto(_camSurfCam, tunnel, tAhead, size);

            // Tunnel forward direction (worm's heading toward exit).
            _camTunnelTangent.subVectors(_camSurfCam, _camLookVec);
            if (_camTunnelTangent.lengthSq() < 0.0001) _camTunnelTangent.copy(_ribAxis);
            _camTunnelTangent.normalize();

            // Möbius half-twist: perpBase rotates π over [0,1] for the RP² roll.
            _camTunnelRight.copy(_ribPerp).applyAxisAngle(_ribAxis, t * Math.PI);
            _camUpVec.crossVectors(_camTunnelTangent, _camTunnelRight).normalize();
            // Guard: degenerate cross product (tangent ∥ right) would give zero up → NaN matrices.
            if (_camUpVec.lengthSq() < 0.01) _camUpVec.set(0, 1, 0);

            // Camera: close behind and above the worm on the ribbon surface.
            _camSurfCam.copy(_camLookVec)
                .addScaledVector(_camTunnelTangent, -TUNNEL_SURF_BACK)
                .addScaledVector(_camUpVec, TUNNEL_SURF_UP);

            // Look-ahead: look forward along the tunnel rather than at the worm's current
            // position.  Without this, when the worm is at the cube centre (t=0.5) the
            // camera stares directly at the convergence point of all tunnel arms, producing
            // a starburst.  Shifting the target ahead keeps the view looking into the tunnel.
            _camLookVec.addScaledVector(_camTunnelTangent, TUNNEL_LOOK_AHEAD);

            // Snap position AND up on the first frame we enter the tunnel.
            // Position snap prevents multi-frame lerp swing. Up snap is critical: at
            // tunnel entry the Möbius formula evaluates to an up vector that can be
            // exactly antiparallel to the surface up — lerping through zero magnitude
            // produces garbage orientations and the visible stutter.
            if (prevPhaseRef.current === 'crawling' && phase === 'entering') {
                camPosRef.current.copy(_camSurfCam);
                lookAtRef.current.copy(_camLookVec);
                camUpRef.current.copy(_camUpVec);
            }
            const alpha = Math.min(1, CAM_LERP * delta * 4.0);
            camPosRef.current.lerp(_camSurfCam, alpha);
            lookAtRef.current.lerp(_camLookVec, alpha);
            camera.position.copy(camPosRef.current);
            // Smooth the up vector so the Möbius 180° flip is gradual rather than instant.
            camUpRef.current.lerp(_camUpVec, Math.min(1, CAM_LERP * delta * 3.0)).normalize();
            camera.up.copy(camUpRef.current);
            camera.lookAt(lookAtRef.current);
        } else {
            tunnelState.active = false;
            tunnelState.t = 0;
            tunnelState.activeTunnelId = null;
        }

        prevPhaseRef.current = phase;
    });

    return null;
}


// Pre-allocated scratch vectors for TunnelSurfFX sparks
const _sparkCenter = new THREE.Vector3();
const _sparkForward = new THREE.Vector3();
const _sparkUp = new THREE.Vector3();
const _sparkRight = new THREE.Vector3();

// Pre-allocated scratch vectors for mapOrientedDirection (called on every input event)
const _mapCamForward = new THREE.Vector3();
const _mapCamUp = new THREE.Vector3();
const _mapCamRight = new THREE.Vector3();
const _mapDesired = new THREE.Vector3();
const _mapCandVec = new THREE.Vector3();

function TunnelSurfFX({ worm, size }) {
    const sparksRef = useRef([]);

    useFrame(({ clock }) => {
        const phase = worm.phase.current;
        const tunnel = worm.activeTunnel.current;
        if (!tunnel) return;

        const active = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';
        const sparkMeshes = sparksRef.current;
        if (!active) {
            for (let i = 0; i < sparkMeshes.length; i++) {
                if (sparkMeshes[i]) sparkMeshes[i].visible = false;
            }
            return;
        }

        const baseT = worm.tunnelProgress.current;
        const tt = clock.elapsedTime;
        const exitNormal = FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY;
        const entryNormal = FACE_NORMALS[tunnel.entry.dirKey] ?? FACE_NORMALS.PY;

        for (let i = 0; i < sparkMeshes.length; i++) {
            const mesh = sparkMeshes[i];
            if (!mesh) continue;
            const trailOffset = i * 0.06;
            const travel = (baseT + trailOffset + tt * 0.8) % 1;
            getTunnelWorldPosInto(_sparkCenter, tunnel, travel, size);
            getTunnelWorldPosInto(_tunnelDirScratch, tunnel, Math.min(travel + 0.03, 1), size);
            // Reuse scratch vectors instead of allocating new arrays/vectors each iteration
            _sparkForward.copy(_tunnelDirScratch).sub(_sparkCenter).normalize();
            _sparkUp.lerpVectors(entryNormal, exitNormal, travel).normalize();
            _sparkRight.crossVectors(_sparkForward, _sparkUp).normalize();

            const angle = tt * 5 + i * 0.9;
            const radius = 0.35 + Math.sin(tt * 2.4 + i) * 0.08;
            mesh.position.copy(_sparkCenter)
                .addScaledVector(_sparkRight, Math.cos(angle) * radius)
                .addScaledVector(_sparkUp, Math.sin(angle) * radius * 0.6);
            mesh.scale.setScalar(0.035 + Math.sin(tt * 8 + i * 1.3) * 0.01);
            mesh.visible = true;
            mesh.material.opacity = 0.35 + Math.sin(tt * 10 + i) * 0.25;
        }
    });

    return (
        <group>
            {Array.from({ length: 14 }).map((_, i) => (
                <mesh
                    key={i}
                    ref={(el) => {
                        sparksRef.current[i] = el;
                    }}
                >
                    <sphereGeometry args={[1, 8, 8]} />
                    <meshBasicMaterial color="#80eaff" transparent opacity={0.4} />
                </mesh>
            ))}
        </group>
    );
}

// ─── Tunnel Interior View — all 6 inner faces of the Rubik's cube ────────────
// During wormhole traversal shows the coloured back-sides of every sticker on
// all 6 faces so the camera looks like it is inside the cube.

// Maps each face direction to its antipodal (opposite) face direction.

// Euler angles to rotate a PlaneGeometry (default +Z normal) so its front face
// points INWARD (toward the cube centre) for each cube face direction.
const _INWARD_FACE_EULER = {
    PZ: [0, Math.PI, 0],
    NZ: [0, 0, 0],
    PX: [0, -Math.PI / 2, 0],
    NX: [0, Math.PI / 2, 0],
    PY: [Math.PI / 2, 0, 0],
    NY: [-Math.PI / 2, 0, 0],
};
// All 6 faces with their (a,b) → (sx,sy,sz) mapping.
const _FACE_DEFS = [
    { dirKey: 'PZ', pos: (a, b, n) => [a, b, n] },
    { dirKey: 'NZ', pos: (a, b)    => [a, b, 0] },
    { dirKey: 'PX', pos: (a, b, n) => [n, a, b] },
    { dirKey: 'NX', pos: (a, b)    => [0, a, b] },
    { dirKey: 'PY', pos: (a, b, n) => [a, n, b] },
    { dirKey: 'NY', pos: (a, b)    => [a, 0, b] },
];

function TunnelInteriorView({ worm, size }) {
    const wireMatRef = useRef();
    const stickerMeshesRef = useRef([]);
    const opacityRef = useRef(0);
    const prevPhaseRef = useRef('crawling');
    const stickerMatsAssigned = useRef(false);

    // Precompute every surface sticker's world position and rotation (size-dependent only).
    // Antipodal partner resolution is deferred to tunnel-entry time so it always reflects
    // the current manifold map rather than the geometric (n-sx, n-sy, n-sz) position that
    // becomes wrong after any slice rotation or scramble.
    const stickerLayout = useMemo(() => {
        const n = size - 1;
        const layout = [];
        for (const { dirKey, pos } of _FACE_DEFS) {
            const [rx, ry, rz] = _INWARD_FACE_EULER[dirKey];
            for (let a = 0; a < size; a++) {
                for (let b = 0; b < size; b++) {
                    const [sx, sy, sz] = pos(a, b, n);
                    const wp = getStickerWorldPos(sx, sy, sz, dirKey, size, 0);
                    if (!wp) continue;
                    layout.push({
                        sx, sy, sz, dirKey, px: wp[0], py: wp[1], pz: wp[2], rx, ry, rz,
                    });
                }
            }
        }
        return layout;
    }, [size]);

    // One merged BufferGeometry of 12-edge outlines for every cubie.
    const edgeGeo = useMemo(() => {
        const k = (size - 1) / 2;
        const hs = 0.46;
        const pts = new Float32Array(size ** 3 * 72);
        let i = 0;
        const ln = (ax, ay, az, bx, by, bz) => {
            pts[i++]=ax; pts[i++]=ay; pts[i++]=az;
            pts[i++]=bx; pts[i++]=by; pts[i++]=bz;
        };
        for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
            const cx=x-k, cy=y-k, cz=z-k;
            ln(cx-hs,cy-hs,cz-hs, cx+hs,cy-hs,cz-hs); ln(cx-hs,cy+hs,cz-hs, cx+hs,cy+hs,cz-hs);
            ln(cx-hs,cy-hs,cz+hs, cx+hs,cy-hs,cz+hs); ln(cx-hs,cy+hs,cz+hs, cx+hs,cy+hs,cz+hs);
            ln(cx-hs,cy-hs,cz-hs, cx-hs,cy+hs,cz-hs); ln(cx+hs,cy-hs,cz-hs, cx+hs,cy+hs,cz-hs);
            ln(cx-hs,cy-hs,cz+hs, cx-hs,cy+hs,cz+hs); ln(cx+hs,cy-hs,cz+hs, cx+hs,cy+hs,cz+hs);
            ln(cx-hs,cy-hs,cz-hs, cx-hs,cy-hs,cz+hs); ln(cx+hs,cy-hs,cz-hs, cx+hs,cy-hs,cz+hs);
            ln(cx-hs,cy+hs,cz-hs, cx-hs,cy+hs,cz+hs); ln(cx+hs,cy+hs,cz-hs, cx+hs,cy+hs,cz+hs);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        return geo;
    }, [size]);

    const planeGeo = useMemo(() => new THREE.PlaneGeometry(0.88, 0.88), []);

    // Set static positions/rotations after mount (or size change).
    useEffect(() => {
        stickerLayout.forEach(({ px, py, pz, rx, ry, rz }, i) => {
            const m = stickerMeshesRef.current[i];
            if (!m) return;
            m.position.set(px, py, pz);
            m.rotation.set(rx, ry, rz);
        });
    }, [stickerLayout]);

    useEffect(() => () => { edgeGeo.dispose(); planeGeo.dispose(); }, [edgeGeo, planeGeo]);

    useFrame((_, delta) => {
        const phase = worm.phase.current;
        const prevPhase = prevPhaseRef.current;
        const active = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';

        // Batch-assign sticker materials ONCE on tunnel entry (opacity still ~0, so no visible pop).
        // Avoids 54+ per-frame GPU state changes that caused hitching on the first visible frame.
        // Partner sticker is resolved via the manifold map so scrambled/rotated states are correct.
        if (prevPhase === 'crawling' && phase === 'entering') {
            const st = useGameStore.getState();
            const { cubies, settings } = st;
            const fc = resolveColors(settings, settings?.biomeMode?.faceAssignment) || FACE_COLORS;
            const manifoldStyles = settings?.manifoldStyles ?? {};
            const manifoldMap = buildManifoldGridMap(cubies, size);
            for (let i = 0; i < stickerLayout.length; i++) {
                const { sx, sy, sz, dirKey } = stickerLayout[i];
                const mesh = stickerMeshesRef.current[i];
                if (!mesh) continue;
                const sticker = cubies?.[sx]?.[sy]?.[sz]?.stickers?.[dirKey];
                if (!sticker) { mesh.visible = false; continue; }
                const antipodalLoc = findAntipodalStickerByGrid(manifoldMap, sticker, size);
                const antipodalFaceId = antipodalLoc?.sticker?.curr;
                if (!antipodalFaceId) { mesh.visible = false; continue; }
                const colorHex = fc[antipodalFaceId] ?? '#444';
                const style = manifoldStyles[antipodalFaceId] ?? 'solid';
                const antiColorHex = fc[ANTIPODAL_COLOR[antipodalFaceId]] ?? '#ffffff';
                mesh.material = getTileStyleMaterial(style, colorHex, false, null, antiColorHex);
                mesh.visible = false; // revealed gradually by opacity ramp
            }
            stickerMatsAssigned.current = true;
        }
        // Clear assignment flag on tunnel exit so the next transit gets fresh sticker colors
        if (!active && prevPhase !== 'crawling') stickerMatsAssigned.current = false;

        prevPhaseRef.current = phase;

        opacityRef.current += ((active ? 1 : 0) - opacityRef.current) * Math.min(1, delta * (active ? 10 : 5));
        const opacity = opacityRef.current;

        if (wireMatRef.current) wireMatRef.current.opacity = opacity * 0.45;

        const meshes = stickerMeshesRef.current;
        if (!active || opacity < 0.01 || !stickerMatsAssigned.current) {
            for (const m of meshes) if (m) m.visible = false;
            return;
        }

        // Materials already assigned — just reveal stickers as opacity ramps in
        for (let i = 0; i < stickerLayout.length; i++) {
            const mesh = meshes[i];
            if (mesh) mesh.visible = true;
        }
    });

    return (
        <>
            {/* Black plastic skeleton — all cubie edges in one draw call */}
            <lineSegments geometry={edgeGeo} frustumCulled={false}>
                <lineBasicMaterial ref={wireMatRef} color="#222222" transparent opacity={0} depthWrite={false} />
            </lineSegments>
            {/* All 6 faces × size² sticker planes, coloured imperatively */}
            {stickerLayout.map((_, i) => (
                <mesh
                    key={i}
                    ref={el => { stickerMeshesRef.current[i] = el; }}
                    visible={false}
                    frustumCulled={false}
                >
                    <primitive object={planeGeo} attach="geometry" />
                    <meshBasicMaterial color="#1a1a1a" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
            ))}
        </>
    );
}

// ─── Swipe Controls ───────────────────────────────────────────────────────────
function WormSwipeControls({ onTurn, worm }) {
    const { camera } = useThree();
    const wormControlMode = useGameStore(s => s.wormControlMode ?? 'non-oriented');
    const touchStart = useRef(null);

    const mapOrientedDirection = useCallback((inputDir) => {
        const dirKey = worm.pos.current?.dirKey;
        if (!dirKey) return inputDir;

        const faceNormal = FACE_NORMALS[dirKey] ?? new THREE.Vector3(0, 0, 1);
        camera.getWorldDirection(_mapCamForward);
        _mapCamUp.copy(camera.up).normalize();
        _mapCamRight.crossVectors(_mapCamForward, _mapCamUp).normalize();

        if (inputDir === 'up') _mapDesired.copy(_mapCamUp);
        else if (inputDir === 'down') _mapDesired.copy(_mapCamUp).multiplyScalar(-1);
        else if (inputDir === 'left') _mapDesired.copy(_mapCamRight).multiplyScalar(-1);
        else if (inputDir === 'right') _mapDesired.copy(_mapCamRight);
        else return inputDir;

        // Project onto face plane (remove normal component)
        _mapDesired.addScaledVector(faceNormal, -_mapDesired.dot(faceNormal));
        if (_mapDesired.lengthSq() < 1e-6) return inputDir;
        _mapDesired.normalize();

        const candidates = ['up', 'down', 'left', 'right'];
        let bestDir = 'up';
        let bestDot = -Infinity;
        for (const dir of candidates) {
            const arr = DIR_FORWARD[dirKey]?.[dir] ?? [0, 0, -1];
            _mapCandVec.set(arr[0], arr[1], arr[2]).normalize();
            const d = _mapCandVec.dot(_mapDesired);
            if (d > bestDot) {
                bestDot = d;
                bestDir = dir;
            }
        }

        return bestDir;
    }, [camera, worm]);

    const emitDirection = useCallback((dir) => {
        if (wormControlMode === 'oriented') {
            onTurn(mapOrientedDirection(dir));
            return;
        }
        onTurn(dir);
    }, [wormControlMode, onTurn, mapOrientedDirection]);

    useEffect(() => {
        const onTouchStart = (e) => {
            const t = e.touches[0];
            touchStart.current = { x: t.clientX, y: t.clientY };
        };
        const onTouchEnd = (e) => {
            if (!touchStart.current) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - touchStart.current.x;
            const dy = t.clientY - touchStart.current.y;
            touchStart.current = null;

            const adx = Math.abs(dx), ady = Math.abs(dy);
            if (adx < 12 && ady < 12) return;

            if (adx > ady) {
                emitDirection(dx > 0 ? 'right' : 'left');
            } else if (wormControlMode === 'oriented') {
                emitDirection(dy > 0 ? 'down' : 'up');
            } else if (dy > 0) {
                // non-oriented mode supports 180° turn via downward swipe
                emitDirection('down');
            }
        };
        const onKey = (e) => {
            if (e.repeat && e.key !== ' ') return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); emitDirection('left'); }
            if (e.key === 'ArrowRight') { e.preventDefault(); emitDirection('right'); }
            if (e.key === 'ArrowDown') { e.preventDefault(); emitDirection('down'); }
            if (e.key === 'ArrowUp' && wormControlMode === 'oriented') { e.preventDefault(); emitDirection('up'); }
            if (e.key === ' ') {
                e.preventDefault();
                e.stopImmediatePropagation();
                onTurn('jump');
            }
        };
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('keydown', onKey, { capture: true });
        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('keydown', onKey, { capture: true });
        };
    }, [onTurn, emitDirection, wormControlMode]);

    return null;
}

// ─── Worm Trail scratch — zero per-frame allocation ───────────────────────────
const _trailDummy = new THREE.Object3D();
const _trailPos   = new THREE.Vector3();
const _trailNorm  = new THREE.Vector3();
const _trailColor = new THREE.Color();
const _trailRingZ = new THREE.Vector3(0, 0, 1); // ringGeometry default normal
const TRAIL_CAP   = 80;   // newest N tile visits rendered
const TRAIL_LIFT  = 0.025; // hover distance above tile surface

// ─── Worm Body (head = smooth lerp; body = per-step tile history) ─────────────
const _wormDummy = new THREE.Object3D();
// Pre-allocated scratch objects — avoids per-frame GC pressure from WormBody loop
const _bodyColor = new THREE.Color();
const _bodyHeadPos = new THREE.Vector3();
const _bodyNormal = new THREE.Vector3();
const _bodyClonePos = new THREE.Vector3();
const _bodyCloneNormal = new THREE.Vector3();
const _bodySegForward = new THREE.Vector3();
const _bodySideVec = new THREE.Vector3();
// Stable path-points buffer: reused every frame to avoid spread-array allocation
const _pathPointsBuffer = [];
const _headPathPoint = { pos: _bodyHeadPos, normal: _bodyNormal };

function WormBody({ worm }) {
    const meshRef = useRef();       // sphere body (classic / inch / glow)
    const boxMeshRef = useRef();    // box body (book worm only)
    const glowAltRef = useRef();    // additive overlay — even glow segments only
    const transitScaleRef = useRef(1); // dissolve: 1 on surface, 0 inside tunnel
    const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const wormCharacter = getWormCharacter(wormCharacterId);
    const isInch = wormCharacter.id === 'inch';
    const isGlow = wormCharacter.id === 'glow';
    const isBook = wormCharacter.id === 'book';
    const skin = getSkin(wormSkinId);
    const wormColor = skin.body;
    const bellyColor = skin.belly;
    // Refs so useFrame always reads latest values without closure staleness
    const wormColorRef = useRef(wormColor);
    wormColorRef.current = wormColor;
    const bellyColorRef = useRef(bellyColor);
    bellyColorRef.current = bellyColor;
    const isInchRef = useRef(isInch);
    isInchRef.current = isInch;
    const isGlowRef = useRef(isGlow);
    isGlowRef.current = isGlow;
    const isBookRef = useRef(isBook);
    isBookRef.current = isBook;

    useFrame((state, delta) => {
        // Copy head/normal into scratch vectors (avoids .clone() allocation)
        _bodyHeadPos.copy(worm.headInterpPos.current);
        _bodyNormal.copy(worm.currentNormal.current);

        const currentJumpVal = worm.isJumping.current ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0;
        _bodyHeadPos.addScaledVector(_bodyNormal, WORM_LIFT + currentJumpVal);

        const _isInch = isInchRef.current;
        const _isGlow = isGlowRef.current;
        const _isBook = isBookRef.current;
        const mesh = _isBook ? boxMeshRef.current : meshRef.current;
        if (!mesh) return;

        const tLen = worm.tailLength.current;
        const steps = worm.stepHistory.current;
        const time = state.clock.getElapsedTime();

        // Rebuild path-points buffer in-place (no array allocation or spread)
        _pathPointsBuffer.length = steps.count + 1;
        _pathPointsBuffer[0] = _headPathPoint;
        for (let j = 0; j < steps.count; j++) _pathPointsBuffer[j + 1] = shAt(steps, j);

        // Dissolve: shrink all segments only while inside the Möbius ribbon (tunnel phase).
        // Worm remains visible during entering and exiting so the player sees it approach
        // and emerge. Tunnel → 0.0, all other phases → 1.0.
        const _phase = worm.phase.current;
        const targetTS = _phase === 'tunnel' ? 0.0 : 1.0;
        transitScaleRef.current += (targetTS - transitScaleRef.current) * Math.min(1, delta * 9);
        const transitScale = transitScaleRef.current;

        if (transitScale < 0.015) {
            mesh.count = 0;
            if (glowAltRef.current) glowAltRef.current.count = 0;
            return;
        }

        let walkIndex = 0;
        let cumulativeDist = 0;
        let altIdx = 0; // index into glowAltRef (even glow segments)

        const visibleCount = Math.min(MAX_TAIL, tLen);
        mesh.count = visibleCount;

        const orbColors = worm.orbPickupColorsRef.current;
        const baseColor = wormColorRef.current;
        const bellyCol = bellyColorRef.current;

        for (let i = 0; i < visibleCount; i++) {
            const fade = 1 - i / tLen;

            if (i === 0) {
                // Head
                _wormDummy.position.copy(_bodyHeadPos);
                _wormDummy.scale.setScalar(0.092);
            } else {
                // Inch worm: asymmetric 2-phase traveling wave — rear bunches up fast (arch),
                // releases slowly (extend), so segments gather then lunge rather than sine-oscillate.
                const targetDist = _isInch ? (() => {
                    const ph = ((time * 1.5 - i * 0.6) % 1.0 + 1.0) % 1.0;
                    const wL = ph < 0.35 ? ph / 0.35 : 1.0 - (ph - 0.35) / 0.65;
                    const wave = wL * wL * (3 - 2 * wL); // smoothstep, no sinusoid
                    return i * 0.085 - wave * 0.038;      // tighter spacing — segments merge
                })() : i * 0.09;

                // Clones — parametrically walk backwards along the curve to exact target distance
                let foundPosition = false;

                while (walkIndex < _pathPointsBuffer.length - 1) {
                    const ptA = _pathPointsBuffer[walkIndex];
                    const ptB = _pathPointsBuffer[walkIndex + 1];
                    const distToNext = ptA.pos.distanceTo(ptB.pos);

                    if (cumulativeDist + distToNext >= targetDist) {
                        // Found the bracket on the curve! Interpolate exact point.
                        const t = distToNext > 0 ? (targetDist - cumulativeDist) / distToNext : 0;
                        // Use scratch vectors instead of .clone() to avoid GC pressure
                        _bodyClonePos.lerpVectors(ptA.pos, ptB.pos, t);
                        _bodyCloneNormal.lerpVectors(ptA.normal, ptB.normal, t).normalize();

                        // Calculate forward/side vector for the wiggle at this exact localized point
                        _bodySegForward.subVectors(ptA.pos, ptB.pos).normalize();
                        _bodySideVec.crossVectors(_bodyCloneNormal, _bodySegForward).normalize();

                        const wiggleAmp = _isInch ? 0.0 : 0.08 * Math.sin(fade * Math.PI);
                        const wigglePhase = i * 0.8 - time * 6.0;
                        _bodyClonePos.addScaledVector(_bodySideVec, Math.sin(wigglePhase) * wiggleAmp);
                        foundPosition = true;
                        break;
                    }
                    cumulativeDist += distToNext;
                    walkIndex++;
                }

                // If the track runs out (just spawned and moving), freeze at the last known point.
                if (!foundPosition && _pathPointsBuffer.length > 0) {
                    _bodyClonePos.copy(_pathPointsBuffer[_pathPointsBuffer.length - 1].pos);
                }

                _wormDummy.position.copy(_bodyClonePos);
                if (_isInch) {
                    // Scale mirrors the same 2-phase wave: compressed (gathered) = smaller
                    const ph = ((time * 1.5 - i * 0.6) % 1.0 + 1.0) % 1.0;
                    const wL = ph < 0.35 ? ph / 0.35 : 1.0 - (ph - 0.35) / 0.65;
                    const wave = wL * wL * (3 - 2 * wL);
                    const sc = 0.085 - wave * 0.025; // 0.085 (extended) → 0.060 (gathered)
                    _wormDummy.scale.setScalar(sc);
                } else if (_isBook) {
                    _wormDummy.scale.set(0.088, 0.055, 0.1);
                } else if (_isGlow) {
                    // Slightly varied glow segment sizes
                    const glowSc = 0.088 + Math.sin(time * 3.5 + i * 1.6) * 0.01;
                    _wormDummy.scale.setScalar(glowSc);
                } else {
                    _wormDummy.scale.setScalar(0.09);
                }
            }

            if (transitScale < 1) _wormDummy.scale.multiplyScalar(transitScale);
            _wormDummy.updateMatrix();
            mesh.setMatrixAt(i, _wormDummy.matrix);

            // Glow worm: write even segments to additive overlay at 1.4× scale
            if (_isGlow && i % 2 === 0) {
                const altMesh = glowAltRef.current;
                if (altMesh) {
                    _wormDummy.scale.setScalar(_wormDummy.scale.x * 1.4);
                    _wormDummy.updateMatrix();
                    altMesh.setMatrixAt(altIdx++, _wormDummy.matrix);
                }
            }

            // Color per segment
            const orbPickupIndex = Math.floor((i - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH);
            const hasOrbColor = orbPickupIndex >= 0 && orbPickupIndex < orbColors.length;
            if (i === 0 && _isGlow) {
                // Glow head — use base worm color; GlowWormAura point light provides visible glow
                _bodyColor.set(baseColor);
            } else if (hasOrbColor) {
                _bodyColor.set(orbColors[orbPickupIndex]);
            } else if (_isInch) {
                // Alternating body/belly bands for visible ring pattern
                _bodyColor.set(i % 2 === 0 ? baseColor : bellyCol);
            } else {
                _bodyColor.set(baseColor);
            }
            mesh.setColorAt(i, _bodyColor);
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        // Update glow overlay count
        if (_isGlow) {
            const altMesh = glowAltRef.current;
            if (altMesh) { altMesh.count = altIdx; altMesh.instanceMatrix.needsUpdate = true; }
        }
    });

    return isBook ? (
        /* Box body — Book Worm only. Conditionally mounted so the sphere instancedMesh
           (MAX_TAIL=1200 instances) is not allocated in GPU memory when unused. */
        <instancedMesh ref={boxMeshRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
            <boxGeometry args={[1, 0.68, 1.12]} />
            <meshStandardMaterial
                color="white"
                emissive="white"
                emissiveIntensity={0.18}
                roughness={0.58}
                metalness={0.2}
            />
        </instancedMesh>
    ) : (
        /* Sphere body — Classic, Inch Worm, Glow Worm.
           IMPORTANT: material color must be white so per-instance colors (setColorAt)
           pass through unmodified. Three.js multiplies instanceColor × material.color,
           so any non-white material color taints every orb pickup color. */
        <>
            <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshStandardMaterial
                    color="white"
                    emissive="white"
                    emissiveIntensity={0.22}
                    roughness={0.28}
                    metalness={0}
                    toneMapped={false}
                />
            </instancedMesh>
            {isGlow && (
                <instancedMesh ref={glowAltRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
                    <sphereGeometry args={[1, 10, 10]} />
                    <meshBasicMaterial color={skin.glow} transparent opacity={0.7}
                        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
                </instancedMesh>
            )}
        </>
    );
}

// ─── Glow Worm Aura ───────────────────────────────────────────────────────────
// Pulsing point light that follows the Glow Worm's head.
function GlowWormAura({ worm }) {
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
    const isGlow = wormCharacterId === 'glow';
    const glowColor = getSkin(wormSkinId).glow;
    const lightRef = useRef();

    useFrame(({ clock }) => {
        if (!isGlow) return;
        const t = clock.elapsedTime;

        // Soft pulsing light — illuminates the worm face only.
        // Kept below the 0.82 bloom threshold so nearby cube tiles don't bloom.
        if (lightRef.current) {
            lightRef.current.position.copy(worm.headInterpPos.current)
                .addScaledVector(worm.currentNormal.current, WORM_LIFT + 0.1);
            // Zero out only while inside the Möbius ribbon — worm is visible during entering/exiting
            const inTunnel = worm.phase.current === 'tunnel';
            lightRef.current.intensity = inTunnel ? 0 : 1.2 + Math.sin(t * 4.0) * 0.4;
        }
    });

    if (!isGlow) return null;

    return <pointLight ref={lightRef} color={glowColor} intensity={2.0} distance={5.5} decay={2} />;
}

// Pre-allocated scratch vector for PortalGlow
const _glowPos = new THREE.Vector3();

// ─── Portal indicator (glows when on a flipped tile) ─────────────────────────
function PortalGlow({ worm, size }) {
    const meshRef = useRef();
    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const { x, y, z, dirKey } = worm.pos.current;
        const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
        const n = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
        _glowPos.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.2);
        meshRef.current.position.copy(_glowPos);
        const inTunnel = worm.phase.current !== 'crawling';
        meshRef.current.material.opacity = (!inTunnel && worm.onFlippedTile.current)
            ? 0.3 + Math.sin(clock.elapsedTime * 6) * 0.2
            : 0;
    });

    return (
        <mesh ref={meshRef}>
            <ringGeometry args={[0.4, 0.7, 32]} />
            <meshBasicMaterial color="#ff00ff" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
    );
}

// ─── Worm Trail ───────────────────────────────────────────────────────────────
// Renders a fading ring at each tile the worm has visited — newest = bright + large,
// oldest = dim + small. Rings stick to their tiles and follow cube rotations via liveCubies.
function WormTrail({ worm, size: _size }) {
    const meshRef = useRef();
    const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
    const wormShowTrail = useGameStore(s => s.wormShowTrail ?? true);
    const skin = getSkin(wormSkinId);
    const skinRef = useRef(skin);
    skinRef.current = skin;

    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh) return;

        if (!wormShowTrail) { mesh.count = 0; return; }

        const trail = worm.tileTrail.current;
        const count = trail.count;
        if (count === 0) { mesh.count = 0; return; }

        const lSize = liveCubies.size;
        const capCount = Math.min(count, TRAIL_CAP);
        let visible = 0;
        const currentSkin = skinRef.current;

        for (let i = 0; i < capCount; i++) {
            const key = ttAt(trail, i); // i=0 is newest
            if (!key) continue;

            // Parse "x,y,z,dirKey" without split() to avoid string allocations
            const c1 = key.indexOf(',');
            const c2 = key.indexOf(',', c1 + 1);
            const c3 = key.indexOf(',', c2 + 1);
            const tx  = parseInt(key.substring(0, c1));
            const ty  = parseInt(key.substring(c1 + 1, c2));
            const tz  = parseInt(key.substring(c2 + 1, c3));
            const tdk = key.substring(c3 + 1);

            // Get live cubie mesh so ring follows cube rotations
            const cubie = (lSize > 0 && liveCubies.refs)
                ? liveCubies.refs[tx * lSize * lSize + ty * lSize + tz]
                : null;
            if (!cubie) continue;

            const localNorm = FACE_NORMALS[tdk];
            if (!localNorm) continue;

            // Face normal in world space (accounts for current cube rotation)
            _trailNorm.copy(localNorm).applyQuaternion(cubie.quaternion);
            // Place ring just above the tile surface
            _trailPos.copy(cubie.position).addScaledVector(_trailNorm, SURFACE_OFFSET + TRAIL_LIFT);

            // Orient ring to lie flat on the tile (align ring +Z normal to face normal)
            _trailDummy.position.copy(_trailPos);
            _trailDummy.quaternion.setFromUnitVectors(_trailRingZ, _trailNorm);

            // Smoothstep fade: newest (i=0) = full size, oldest = tiny
            const fade = 1 - i / capCount;
            const fs   = fade * fade * (3 - 2 * fade); // smoothstep
            _trailDummy.scale.setScalar(fs * 0.82 + 0.04);
            _trailDummy.updateMatrix();
            mesh.setMatrixAt(visible, _trailDummy.matrix);

            // Encode fade as color brightness — works naturally with AdditiveBlending
            _trailColor.set(currentSkin.body).multiplyScalar(0.20 + fs * 0.80);
            mesh.setColorAt(visible, _trailColor);
            visible++;
        }

        mesh.count = visible;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, TRAIL_CAP]} frustumCulled={false}>
            <ringGeometry args={[0.20, 0.42, 24]} />
            <meshBasicMaterial
                color="white"
                transparent
                opacity={0.55}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
            />
        </instancedMesh>
    );
}

// ─── Worm Face (eyes + smile) ─────────────────────────────────────────────────
const _faceRight = new THREE.Vector3();
const _faceForward = new THREE.Vector3();
const _faceHeadPos = new THREE.Vector3();
const _faceTunnelAhead = new THREE.Vector3(); // scratch for tunnel tangent during enter/exit
// Glasses orientation — torus axis (Y) aligned to face-forward so ring appears circular
const _glassAxisY = new THREE.Vector3(0, 1, 0);
const _glassQuat = new THREE.Quaternion();

function WormFace({ worm, size }) {
    const leftEyeRef = useRef();
    const rightEyeRef = useRef();
    const smile0 = useRef(), smile1 = useRef(), smile2 = useRef();
    const smileRefs = [smile0, smile1, smile2];
    const hatGroupRef = useRef();
    const glassLeftRef = useRef();
    const glassRightRef = useRef();
    const faceOpacityRef = useRef(1);
    const wormHatId = useGameStore(s => s.wormHat ?? 'none');
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const isBook = wormCharacterId === 'book';

    useFrame((_, delta) => {
        // Match the worm body dissolve: hide face only while inside the Möbius ribbon
        const crawling = worm.phase.current !== 'tunnel';
        faceOpacityRef.current += ((crawling ? 1 : 0) - faceOpacityRef.current) * Math.min(1, delta * 9);
        const faceVisible = faceOpacityRef.current > 0.05;
        if (leftEyeRef.current)  leftEyeRef.current.visible  = faceVisible;
        if (rightEyeRef.current) rightEyeRef.current.visible = faceVisible;
        for (const ref of smileRefs) if (ref.current) ref.current.visible = faceVisible;
        if (hatGroupRef.current)    hatGroupRef.current.visible    = faceVisible;
        if (glassLeftRef.current)   glassLeftRef.current.visible   = faceVisible;
        if (glassRightRef.current)  glassRightRef.current.visible  = faceVisible;
        if (!faceVisible) return;

        const phase = worm.phase.current;
        const inTransit = (phase === 'entering' || phase === 'exiting') && worm.activeTunnel.current;

        let normal;
        if (inTransit) {
            // During entering/exiting the head is driven by getTunnelWorldPosInto, not surface
            // interp. Read headInterpPos/currentNormal which are always current.
            _faceHeadPos.copy(worm.headInterpPos.current);
            normal = worm.currentNormal.current;

            // Derive forward from the tunnel tangent at the current parametric position.
            const tp = worm.tunnelProgress.current;
            const t = phase === 'entering' ? tp * 0.33 : 0.67 + tp * 0.33;
            const tAhead = Math.min(t + 0.02, 1.0);
            getTunnelWorldPosInto(_faceTunnelAhead, worm.activeTunnel.current, tAhead, size);
            _faceForward.copy(_faceTunnelAhead).sub(_faceHeadPos);
            if (_faceForward.lengthSq() < 0.0001) _faceForward.set(0, 0, 1);
            _faceForward.normalize();

            _faceHeadPos.addScaledVector(normal, WORM_LIFT + 0.09);
        } else {
            const { dirKey } = worm.pos.current;
            normal = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
            const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 1, 0];
            _faceForward.set(fwdArr[0], fwdArr[1], fwdArr[2]);

            // Interpolated head world pos (copy into scratch — no .clone())
            const prev = worm.prevWorldPos.current;
            const cur = worm.curWorldPos.current;
            if (!cur) {
                const wp = getStickerWorldPos(worm.pos.current.x, worm.pos.current.y,
                    worm.pos.current.z, dirKey, size, 0);
                _faceHeadPos.set(wp[0], wp[1], wp[2]);
            } else if (prev && worm.interpT.current < 1) {
                _faceHeadPos.lerpVectors(prev, cur, worm.interpT.current);
            } else {
                _faceHeadPos.copy(cur);
            }
            const jumpLiftVal = worm.isJumping.current
                ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0;
            _faceHeadPos.addScaledVector(normal, WORM_LIFT + jumpLiftVal + 0.09);
        }

        // Rightward axis in the face plane
        _faceRight.crossVectors(_faceForward, normal).normalize();
        if (_faceRight.lengthSq() < 0.001) _faceRight.set(1, 0, 0);

        const S = 0.022;
        if (leftEyeRef.current) {
            leftEyeRef.current.position.copy(_faceHeadPos)
                .addScaledVector(_faceRight, 0.028)
                .addScaledVector(_faceForward, 0.025);
            leftEyeRef.current.scale.setScalar(S);
        }
        if (rightEyeRef.current) {
            rightEyeRef.current.position.copy(_faceHeadPos)
                .addScaledVector(_faceRight, -0.028)
                .addScaledVector(_faceForward, 0.025);
            rightEyeRef.current.scale.setScalar(S);
        }
        const smileOffsets = [-0.022, 0, 0.022];
        for (let i = 0; i < smileRefs.length; i++) {
            const ref = smileRefs[i];
            if (!ref.current) continue;
            const xo = smileOffsets[i];
            const yo = i === 1 ? -0.028 : -0.022;
            ref.current.position.copy(_faceHeadPos)
                .addScaledVector(_faceRight, xo)
                .addScaledVector(normal, yo * 0.3)
                .addScaledVector(_faceForward, 0.025);
            ref.current.scale.setScalar(S * 0.55);
        }

        // Hat: position above head, orient Y to face normal
        if (hatGroupRef.current) {
            hatGroupRef.current.position.copy(_faceHeadPos)
                .addScaledVector(normal, 0.04);
            _hatAlignQuat.setFromUnitVectors(_hatYUp, normal);
            hatGroupRef.current.quaternion.copy(_hatAlignQuat);
        }

        // Book worm glasses — torus rings in front of each eye, axis aligned to forward
        if (isBook) {
            _glassQuat.setFromUnitVectors(_glassAxisY, _faceForward);
            const GS = 0.054;
            if (glassLeftRef.current) {
                glassLeftRef.current.position.copy(_faceHeadPos)
                    .addScaledVector(_faceRight, 0.028)
                    .addScaledVector(_faceForward, 0.029);
                glassLeftRef.current.quaternion.copy(_glassQuat);
                glassLeftRef.current.scale.setScalar(GS);
            }
            if (glassRightRef.current) {
                glassRightRef.current.position.copy(_faceHeadPos)
                    .addScaledVector(_faceRight, -0.028)
                    .addScaledVector(_faceForward, 0.029);
                glassRightRef.current.quaternion.copy(_glassQuat);
                glassRightRef.current.scale.setScalar(GS);
            }
        }
    });

    return (
        <>
            <mesh ref={leftEyeRef}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color="white" />
            </mesh>
            <mesh ref={rightEyeRef}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color="white" />
            </mesh>
            {smileRefs.map((ref, i) => (
                <mesh key={i} ref={ref}>
                    <sphereGeometry args={[1, 6, 6]} />
                    <meshBasicMaterial color="#111" />
                </mesh>
            ))}
            {wormHatId !== 'none' && (
                <group ref={hatGroupRef}>
                    <WormHat3D type={wormHatId} scale={0.07} />
                </group>
            )}
            {/* Book worm glasses — two torus rings, only rendered for book character */}
            {isBook && (
                <>
                    <mesh ref={glassLeftRef}>
                        <torusGeometry args={[1, 0.13, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
                    </mesh>
                    <mesh ref={glassRightRef}>
                        <torusGeometry args={[1, 0.13, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
                    </mesh>
                </>
            )}
        </>
    );
}

// ─── Powerup Orbs ─────────────────────────────────────────────────────────────
// Each orb inherits the color of the sticker tile it sits on and follows
// that tile through cube rotations. Rendered using the shared ParityOrbs component.
function PowerupOrbs({ size }) {
    const { wormPowerups, cubies, settings, wormCharacter } = useGameStore(useShallow(s => ({
        wormPowerups: s.wormPowerups,
        cubies: s.cubies,
        settings: s.settings,
        wormCharacter: s.wormCharacter ?? 'classic',
    })));
    const faceColors = useMemo(() => resolveColors(settings), [settings]);

    const orbs = useMemo(() => {
        if (!wormPowerups || !cubies) return [];
        return wormPowerups.map(p => {
            const sticker = getStickerSafe(cubies, p.x, p.y, p.z, p.dirKey);
            const faceId = sticker?.curr ?? 0;
            const color = ensureOrbContrast((faceId && faceColors[faceId]) ?? '#22ff88');
            const antipodalFaceId = ANTIPODAL_COLOR[faceId];
            const antipodalColor = ensureOrbContrast((antipodalFaceId && faceColors[antipodalFaceId]) ?? color);
            // Orbs on flipped tiles hover above the surface — worm must jump to collect
            const elevated = !!(sticker && sticker.curr !== sticker.orig);
            return { ...p, color, antipodalColor, elevated };
        });
    }, [wormPowerups, cubies, faceColors]);

    return <ParityOrbs orbs={orbs} size={size} isGlowWorm={wormCharacter === 'glow'} />;
}

// Watches for orb pickups by the glow worm and renders a color bloom at the collect point.
// Follows the same pendingRef + useFrame polling pattern as HeartBurstSystem.
function OrbFlashSystem({ worm }) {
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const [flashes, setFlashes] = useState([]);

    useFrame(() => {
        if (!worm.pendingOrbFlashRef.current) return;
        const { color, pos } = worm.pendingOrbFlashRef.current;
        worm.pendingOrbFlashRef.current = null;
        // Only the glow worm gets the color bloom
        if (wormCharacterId !== 'glow') return;
        const id = Date.now() + Math.random();
        setFlashes(prev => [...prev, { id, pos, color }]);
    });

    if (flashes.length === 0) return null;
    return (
        <>
            {flashes.map(f => (
                <OrbCollectEffect
                    key={f.id}
                    position={f.pos}
                    color={f.color}
                    onDone={() => setFlashes(prev => prev.filter(x => x.id !== f.id))}
                />
            ))}
        </>
    );
}

function WormInteriorGlass({ worm, size }) {
    const glassRef = useRef();

    useFrame(({ clock }) => {
        if (!glassRef.current) return;

        const phase = worm.phase.current;
        const isTunnelPhase = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';
        const tunnelBoost = isTunnelPhase ? 1 : 0;
        const pulse = (Math.sin(clock.elapsedTime * 4.2) + 1) * 0.5;
        const transmission = THREE.MathUtils.lerp(GLASS_MIN_TRANSMISSION, GLASS_MAX_TRANSMISSION, tunnelBoost * 0.7 + pulse * 0.3);
        const opacity = THREE.MathUtils.lerp(GLASS_MIN_OPACITY, GLASS_MAX_OPACITY, tunnelBoost * 0.85 + pulse * 0.15);

        glassRef.current.transmission = transmission;
        glassRef.current.opacity = opacity;
        glassRef.current.emissiveIntensity = tunnelBoost * 0.35 + pulse * 0.08;
    });

    // Keep a thin margin from outer stickers so we read it as an interior shell.
    const innerSize = Math.max(0.8, size - 1.1);

    return (
        <mesh>
            <boxGeometry args={[innerSize, innerSize, innerSize]} />
            <meshPhysicalMaterial
                ref={glassRef}
                color="#b8f6ff"
                emissive="#4ccfe6"
                emissiveIntensity={0.06}
                roughness={0.06}
                metalness={0.02}
                transmission={GLASS_MIN_TRANSMISSION}
                thickness={1.2}
                ior={1.23}
                transparent
                opacity={GLASS_MIN_OPACITY}
                depthWrite={false}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// ─── Module-level helpers for canonical tunnel key (mirrors useWormCrawler logic) ─
// Used by WormholeRings to check void-tunnel membership without prop-drilling.
const _tileKeyStr = (p) => `${p.x},${p.y},${p.z},${p.dirKey}`;
const _canonicalTunnelKeyStr = (tunnel) => {
    const a = _tileKeyStr(tunnel.entry);
    const b = _tileKeyStr(tunnel.exit);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
};

// ─── Wormhole portal rings — spinning neon rings at every flipped tile ────────
// Gives players a clear visual cue for all wormhole locations on the cube surface.
const _ringDummy = new THREE.Object3D();
const _ringUp = new THREE.Vector3();
const _bubbleDummy = new THREE.Object3D();
const _sparkDummy = new THREE.Object3D();
const _cautionDummy = new THREE.Object3D();
const _voidFrameDummy = new THREE.Object3D();
const _voidArcAxisY = new THREE.Vector3(0, 1, 0);
const _voidArcRight = new THREE.Vector3();
const _voidArcForward = new THREE.Vector3();
const _tapeRight = new THREE.Vector3();
const _tapeForward = new THREE.Vector3();
const _liveBaseColor = new THREE.Color('#ff44ff');
const _liveColor = new THREE.Color();

// Void swamp palette — sickly, stagnant, antipodality-gone-wrong
const VOID_OUTER_COLOR = '#b8b1ff';   // inverted-feel rim over dark tiles
const VOID_INNER_COLOR = '#121a3b';   // cool inverted core
const VOID_BUBBLE_COLOR = '#39ff14';  // neon green ooze
const CRITICAL_ARC_COLOR = '#7dff2a';  // electrical warning before full void
const _criticalArcColor = new THREE.Color(CRITICAL_ARC_COLOR);
const _tapeYellow = new THREE.Color('#ffe000');
const _tapeBlack = new THREE.Color('#111111');
// Scratch objects for the per-tape instanced-mesh loop — avoids per-frame allocations
const _tapeEdgeDir = new THREE.Vector3();
const _tapeOutwardDir = new THREE.Vector3();
const _tapeUp = new THREE.Vector3();
const _tapeNormal = new THREE.Vector3();
const _tapeCrossRight = new THREE.Vector3();
const _tapeMat4 = new THREE.Matrix4();
// Static empty collections used as safe fallbacks (never mutated)
const _EMPTY_SET = new Set();
const _EMPTY_MAP = new Map();
const BUBBLES_PER_VOID = 5;          // rising gas bubbles per dead portal
const SPARKS_PER_CRITICAL = 7;
const POLES_PER_TILE = 4;
const TAPES_PER_TILE = 4;
const FRAME_SEGMENTS_PER_VOID = 4;

// ─── Heart Burst Effect — green hearts fly out of healed tiles ────────────────
// Emits a burst of 💚 hearts when the worm exits a healed tunnel.
// Each heart gets its own CSS @keyframes rule injected once so the browser handles
// the smooth per-heart arc entirely on the compositor thread.

const HEART_COUNT = 10;
const HEART_LIFETIME_MS = 1800;

function HeartBurst({ id, wp, onDone }) {
    // Generate stable per-heart motion data once (spread outward, biased upward)
    // Generate stable random motion data once per burst. Using useRef so the data is
    // computed exactly once on mount — useMemo with Math.random() is unsafe because
    // React may evict the cache and recompute, which would re-inject duplicate <style> tags.
    const heartsRef = useRef(null);
    if (heartsRef.current === null) {
        heartsRef.current = Array.from({ length: HEART_COUNT }, (_, i) => {
            const baseAngle = (i / HEART_COUNT) * Math.PI * 2;
            const angle = baseAngle + (Math.random() - 0.5) * 0.7;
            const dist = 50 + Math.random() * 40;
            const dx = Math.cos(angle) * dist;
            const dy = -Math.abs(Math.sin(angle) * dist) - 25 - Math.random() * 30;
            const delay = i * 55 + Math.random() * 40;
            const scale = 0.85 + Math.random() * 0.5;
            const heartId = `wh-${id}-${i}`;
            const cssText = `@keyframes ${heartId}{` +
                `0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg);opacity:0;}` +
                `18%{transform:translate(-50%,-50%) scale(${(scale * 1.6).toFixed(2)}) rotate(10deg);opacity:1;}` +
                `100%{transform:translate(calc(-50% + ${dx.toFixed(1)}px),calc(-50% + ${dy.toFixed(1)}px)) ` +
                `scale(${(scale * 0.25).toFixed(2)}) rotate(${Math.round((Math.random() - 0.5) * 40)}deg);opacity:0;}}`;
            return { heartId, delay, cssText };
        });
    }
    const hearts = heartsRef.current;

    // DOM mutations in useEffect so they are guarded by mount and always cleaned up.
    // useMemo must not mutate the DOM — React may rerun it without a corresponding cleanup.
    useEffect(() => {
        const styleEls = hearts.map(({ heartId, cssText }) => {
            const el = document.createElement('style');
            el.setAttribute('data-worm-heart', heartId);
            el.textContent = cssText;
            document.head.appendChild(el);
            return el;
        });
        const timer = setTimeout(() => {
            styleEls.forEach(el => el.remove());
            onDone();
        }, HEART_LIFETIME_MS + 300);
        return () => {
            clearTimeout(timer);
            styleEls.forEach(el => el.remove());
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fontSize = _isMobile ? '22px' : '18px';
    return (
        <Html position={wp} center>
            <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
                {hearts.map(h => (
                    <div
                        key={h.heartId}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            fontSize,
                            animation: `${h.heartId} ${HEART_LIFETIME_MS}ms ease-out ${h.delay}ms both`,
                            willChange: 'transform, opacity',
                            textShadow: '0 0 6px #22ff66, 0 0 12px #00cc44',
                            lineHeight: 1,
                            userSelect: 'none',
                            filter: 'drop-shadow(0 0 4px #00ff55)',
                        }}
                    >
                        💚
                    </div>
                ))}
            </div>
        </Html>
    );
}

// Watches for heal events from the worm hook and manages active HeartBurst instances.
function HeartBurstSystem({ worm, size }) {
    const [bursts, setBursts] = useState([]);

    useFrame(() => {
        if (!worm.pendingHealBurstRef.current) return;
        const { exitTile } = worm.pendingHealBurstRef.current;
        worm.pendingHealBurstRef.current = null;
        const wp = getStickerWorldPos(exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey, size, 0);
        if (!wp) return;
        const id = Date.now();
        setBursts(prev => [...prev, { id, wp: [wp[0], wp[1], wp[2]] }]);
    });

    if (bursts.length === 0) return null;
    return (
        <>
            {bursts.map(burst => (
                <HeartBurst
                    key={burst.id}
                    id={burst.id}
                    wp={burst.wp}
                    onDone={() => setBursts(prev => prev.filter(b => b.id !== burst.id))}
                />
            ))}
        </>
    );
}

function TunnelHealProgress({ size }) {
    const healingProgress = useGameStore((s) => s.wormHealingProgress ?? {});
    const cubies = useGameStore((s) => s.debouncedCubies ?? s.cubies);
    const settings = useGameStore((s) => s.settings);
    const faceColors = useMemo(
        () => resolveColors(settings, settings?.biomeMode?.faceAssignment) || {},
        [settings]
    );

    const entries = useMemo(() => {
        const partial = Object.entries(healingProgress).filter(([, p]) => p.deposited > 0 && p.deposited < HEAL_COST);
        if (partial.length === 0) return [];
        // Build the manifold map once and share it across all findStickerByStableKey calls.
        // Without this, each call rebuilt an O(size³×6) map — 3 tunnels = 3× the work.
        const mm = buildManifoldGridMap(cubies, size);
        return partial
            .map(([key, p]) => {
                const pos = findStickerByStableKey(cubies, size, key, mm);
                if (!pos) return null;
                const wp = getStickerWorldPos(pos.x, pos.y, pos.z, pos.dirKey, size, 0);
                if (!wp) return null;
                return { key, wp, remaining: HEAL_COST - p.deposited, faceId: p.faceId };
            })
            .filter(Boolean);
    }, [healingProgress, cubies, size]);

    if (entries.length === 0) return null;

    return (
        <>
            {entries.map(({ key, wp, remaining, faceId }) => {
                const color = faceColors[faceId] ?? '#ffffff';
                return (
                    <Html key={key} position={[wp[0], wp[1], wp[2]]} center>
                        <div style={{
                            background: color,
                            color: '#ffffff',
                            width: _isMobile ? '32px' : '26px',
                            height: _isMobile ? '32px' : '26px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: _isMobile ? '15px' : '13px',
                            fontWeight: 900,
                            fontFamily: "'Arial Rounded MT Bold', 'Nunito', Arial, sans-serif",
                            border: '2.5px solid #ffffff',
                            boxShadow: `0 0 10px ${color}, 0 2px 6px rgba(0,0,0,0.5)`,
                            lineHeight: 1,
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}>
                            {remaining}
                        </div>
                    </Html>
                );
            })}
        </>
    );
}

function WormholeRings({ cubies, size, worm, voidTunnelKeysRef, tunnelUseCountsRef }) {
    const liveRef = useRef();       // live wormhole rings (neon pink)
    const voidOuterRef = useRef();  // void outer ring (sickly green, slow reverse)
    const voidInnerRef = useRef();  // void inner ring (near-black, counter-rotating)
    const bubblesRef = useRef();    // void swamp gas rising from dead portals
    const sparkRef = useRef();      // warning electricity when tunnel is one trip from void
    const poleRef = useRef();       // caution poles
    const tapeRef = useRef();       // caution tape strips
    const voidFrameRef = useRef();  // bright square frame on fully voided tiles

    const cautionTexture = React.useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffe000';
        ctx.fillRect(0, 0, 512, 64);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 44px "Arial Black", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CAUTION', 256, 36);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 1);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);

    // Stable random seeds per (position × bubble) slot — no per-frame allocation
    const MAX_RINGS = 6 * size * size;
    const bubbleSeeds = React.useMemo(() => {
        const s = new Float32Array(MAX_RINGS * Math.max(BUBBLES_PER_VOID, SPARKS_PER_CRITICAL, Math.max(POLES_PER_TILE, TAPES_PER_TILE)) * 3);
        for (let i = 0; i < s.length / 3; i++) {
            s[i * 3]     = (Math.random() - 0.5) * 0.18; // lateral x jitter
            s[i * 3 + 1] = (Math.random() - 0.5) * 0.18; // lateral y jitter
            s[i * 3 + 2] = Math.random();                 // phase start offset
        }
        return s;
    }, [MAX_RINGS]);

    // Debounce cubies so the O(size³×6) scan only reruns every 200 ms instead
    // of on every individual sticker flip (~12×/sec at chaos L4).
    const [debouncedCubies, setDebouncedCubies] = useState(cubies);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedCubies(cubies), 200);
        return () => clearTimeout(timer);
    }, [cubies]);

    // All flipped surface positions, augmented with canonical tunnel key so
    // WormholeRings can tell live vs void without re-running manifold logic per frame.
    const allPositions = React.useMemo(() => {
        const manifoldMap = buildManifoldGridMap(debouncedCubies, size);
        const tunnels = getActiveTunnels(debouncedCubies, size, manifoldMap);
        // Build tile-key → canonical-tunnel-key lookup (covers both entry and exit)
        const tunnelKeyMap = new Map();
        for (const t of tunnels) {
            const ck = _canonicalTunnelKeyStr(t);
            tunnelKeyMap.set(_tileKeyStr(t.entry), ck);
            tunnelKeyMap.set(_tileKeyStr(t.exit), ck);
        }

        const result = [];
        const dirs = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                for (let z = 0; z < size; z++) {
                    const cubie = debouncedCubies?.[x]?.[y]?.[z];
                    if (!cubie) continue;
                    for (const dk of dirs) {
                        const st = cubie.stickers?.[dk];
                        if (!st || st.curr === st.orig) continue;
                        const isVisible = (
                            (dk === 'PX' && x === size - 1) || (dk === 'NX' && x === 0) ||
                            (dk === 'PY' && y === size - 1) || (dk === 'NY' && y === 0) ||
                            (dk === 'PZ' && z === size - 1) || (dk === 'NZ' && z === 0)
                        );
                        if (!isVisible) continue;
                        result.push({
                            x, y, z, dirKey: dk,
                            tunnelKey: tunnelKeyMap.get(`${x},${y},${z},${dk}`) ?? null,
                            // Cache world position + normal once — constant for the lifetime
                            // of this entry, so the frame loop never recomputes/reallocates.
                            wp: getStickerWorldPos(x, y, z, dk, size, 0),
                            normal: FACE_NORMALS[dk] ?? FACE_NORMALS.PZ
                        });
                    }
                }
            }
        }
        return result;
    }, [debouncedCubies, size]);

    // Performance throttle:
    // - During active tunnel travel, update at full frame rate for smooth motion.
    // - During normal crawling, animate rings at a lower cadence to cut per-frame CPU load.
    const frameBudgetRef = useRef(0);
    const lastPhaseRef = useRef('crawling');
    // High-water marks of slots written last frame, so the zero-out pass only
    // touches slots that could hold stale data instead of every unused slot.
    const prevIdxRef = useRef({ live: 0, void: 0, bubble: 0, spark: 0, pole: 0, tape: 0, frame: 0 });
    const clearedRef = useRef(false);

    useFrame(({ clock }, delta) => {
        const phase = worm?.phase?.current ?? 'crawling';
        const inTunnelPhase = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';
        const targetStep = inTunnelPhase ? (1 / 60) : (1 / 20);

        if (lastPhaseRef.current !== phase) {
            // Prevent carrying large accumulated delta across phase changes.
            frameBudgetRef.current = 0;
            lastPhaseRef.current = phase;
        }

        frameBudgetRef.current += delta;
        if (frameBudgetRef.current < targetStep) return;
        frameBudgetRef.current = 0;

        // Nothing to render and previous slots already zeroed — skip all work.
        if (allPositions.length === 0 && clearedRef.current) return;

        const liveMesh = liveRef.current;
        const voidOuter = voidOuterRef.current;
        const voidInner = voidInnerRef.current;
        const bubbles = bubblesRef.current;
        const sparks = sparkRef.current;
        const poles = poleRef.current;
        const tapes = tapeRef.current;
        const voidFrames = voidFrameRef.current;
        if (!liveMesh || !voidOuter || !voidInner || !bubbles || !sparks || !poles || !tapes || !voidFrames) return;

        const t = clock.elapsedTime;
        const voidKeys = voidTunnelKeysRef?.current ?? _EMPTY_SET;
        const useCounts = tunnelUseCountsRef?.current ?? _EMPTY_MAP;

        let liveIdx = 0;
        let voidIdx = 0;
        let bubbleIdx = 0;
        let sparkIdx = 0;
        let poleIdx = 0;
        let tapeIdx = 0;
        let frameIdx = 0;

        for (let i = 0; i < allPositions.length; i++) {
            const { tunnelKey, wp, normal: n } = allPositions[i];
            const isVoid = !!(tunnelKey && voidKeys.has(tunnelKey));
            const traversals = tunnelKey ? (useCounts.get(tunnelKey) ?? 0) : 0;
            const isCritical = !isVoid && traversals >= WORMHOLE_MAX_TRAVERSALS;

            _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08);
            _ringUp.set(0, 1, 0);
            if (Math.abs(n.y) > 0.9) _ringUp.set(1, 0, 0);
            _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);

            if (isVoid) {
                // ── Void swamp portal ───────────────────────────────────────
                // Outer ring: slow reverse rotation, sluggish dying pulse
                _ringDummy.rotateOnAxis(n, -t * 0.35 + voidIdx * 1.1);
                const outerPulse = 0.9 + Math.sin(t * 0.85 + voidIdx * 2.3) * 0.1;
                _ringDummy.scale.setScalar(outerPulse);
                _ringDummy.updateMatrix();
                voidOuter.setMatrixAt(voidIdx, _ringDummy.matrix);

                // Inner ring: slightly different counter-rotation phase, smaller
                _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08);
                _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);
                _ringDummy.rotateOnAxis(n, t * 0.2 - voidIdx * 0.9); // counter-phase
                const innerPulse = 0.7 + Math.sin(t * 1.1 + voidIdx * 1.7) * 0.08;
                _ringDummy.scale.setScalar(innerPulse);
                _ringDummy.updateMatrix();
                voidInner.setMatrixAt(voidIdx, _ringDummy.matrix);

                // Void swamp bubbles — rising gas from the dead portal
                for (let b = 0; b < BUBBLES_PER_VOID && bubbleIdx < bubbles.count; b++) {
                    const si = (i * BUBBLES_PER_VOID + b) * 3;
                    const phase = (t * 0.55 + bubbleSeeds[si + 2]) % 1;
                    const lift = phase * 0.72;
                    const envelope = Math.sin(phase * Math.PI); // 0→1→0 over lifetime
                    _bubbleDummy.position.set(
                        wp[0] + n.x * lift + bubbleSeeds[si] * envelope,
                        wp[1] + n.y * lift + bubbleSeeds[si + 1] * envelope,
                        wp[2] + n.z * lift
                    );
                    _bubbleDummy.scale.setScalar(Math.max(0, envelope * 0.038));
                    _bubbleDummy.updateMatrix();
                    bubbles.setMatrixAt(bubbleIdx, _bubbleDummy.matrix);
                    bubbleIdx++;
                }

                voidIdx++;
            } else {
                // ── Live wormhole ring — gets severe warning at 3rd traversal ─
                const intensityTier = Math.min(Math.max(traversals, 0), WORMHOLE_MAX_TRAVERSALS);
                const speedMul = 1 + (intensityTier * 0.35) + (isCritical ? 0.55 : 0);
                const glowMul = 1 + (intensityTier * 0.35) + (isCritical ? 0.75 : 0);
                const wobble = Math.sin(t * (9.0 * speedMul) + i * 1.4) * (0.03 + 0.03 * intensityTier);
                _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08 + wobble);
                _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);
                _ringDummy.rotateOnAxis(n, t * (2.1 * speedMul) + i * 0.9);
                const pulse = glowMul + Math.sin(t * (4.8 * speedMul) + i * 1.7) * (0.16 * glowMul);
                _ringDummy.scale.setScalar(pulse);
                _ringDummy.updateMatrix();
                liveMesh.setMatrixAt(liveIdx, _ringDummy.matrix);
                _liveColor.copy(_liveBaseColor).lerp(_criticalArcColor, isCritical ? 0.45 : 0).multiplyScalar(glowMul);
                liveMesh.setColorAt(liveIdx, _liveColor);
                liveIdx++;

                if (isCritical) {
                    _voidArcRight.crossVectors(n, _voidArcAxisY);
                    if (_voidArcRight.lengthSq() < 1e-4) _voidArcRight.set(1, 0, 0);
                    _voidArcRight.normalize();
                    _voidArcForward.crossVectors(n, _voidArcRight).normalize();
                    for (let sp = 0; sp < SPARKS_PER_CRITICAL && sparkIdx < sparks.count; sp++) {
                        const si = (i * SPARKS_PER_CRITICAL + sp) * 3;
                        const phase = (t * (2.5 + sp * 0.15) + bubbleSeeds[si + 2]) % 1;
                        const radial = 0.08 + Math.sin(phase * Math.PI * 2 + sp) * 0.035;
                        const lift = 0.18 + phase * 0.95;
                        const thickness = 0.010 + Math.sin(phase * Math.PI) * 0.010;
                        const height = 0.10 + Math.sin(phase * Math.PI) * 0.28;

                        _sparkDummy.position.set(
                            wp[0] + n.x * lift + _voidArcRight.x * radial + _voidArcForward.x * bubbleSeeds[si] * 0.12,
                            wp[1] + n.y * lift + _voidArcRight.y * radial + _voidArcForward.y * bubbleSeeds[si + 1] * 0.12,
                            wp[2] + n.z * lift + _voidArcRight.z * radial + _voidArcForward.z * bubbleSeeds[si] * 0.12
                        );
                        _sparkDummy.quaternion.setFromUnitVectors(_voidArcAxisY, n);
                        _sparkDummy.rotateOnAxis(n, phase * Math.PI * 8 + sp * 0.9);
                        _sparkDummy.scale.set(thickness, height, thickness);
                        _sparkDummy.updateMatrix();
                        sparks.setMatrixAt(sparkIdx, _sparkDummy.matrix);
                        sparkIdx++;
                    }
                }
            }

            if (isVoid || isCritical) {
                _tapeRight.crossVectors(n, _voidArcAxisY);
                if (_tapeRight.lengthSq() < 1e-4) _tapeRight.set(1, 0, 0);
                _tapeRight.normalize();
                _tapeForward.crossVectors(n, _tapeRight).normalize();
                
                const half = 0.45;
                const corners = [
                    [half, half],
                    [half, -half],
                    [-half, -half],
                    [-half, half]
                ];
                
                for (let c = 0; c < 4 && poleIdx < poles.count; c++) {
                    const cx = corners[c][0];
                    const cy = corners[c][1];
                    _cautionDummy.position.set(
                        wp[0] + _tapeRight.x * cx + _tapeForward.x * cy + n.x * 0.2,
                        wp[1] + _tapeRight.y * cx + _tapeForward.y * cy + n.y * 0.2,
                        wp[2] + _tapeRight.z * cx + _tapeForward.z * cy + n.z * 0.2
                    );
                    _cautionDummy.quaternion.setFromUnitVectors(_voidArcAxisY, n);
                    _cautionDummy.scale.set(1, 1, 1);
                    _cautionDummy.updateMatrix();
                    poles.setMatrixAt(poleIdx++, _cautionDummy.matrix);
                }
                
                const poleHeight = 0.4;
                const tapeWidth = 0.07;
                // Place tapes near the top of the poles, slightly below the tip
                const tapeLift = 0.2 + (poleHeight / 2) - (tapeWidth / 2) - 0.02;
                
                const loopT = t * 0.8 + i * 2.3;

                for (let e = 0; e < 4 && tapeIdx < tapes.count; e++) {
                    const si = (i * TAPES_PER_TILE + e) * 3;
                    const c1 = corners[e];
                    const c2 = corners[(e + 1) % 4];
                    const mx = (c1[0] + c2[0]) / 2;
                    const my = (c1[1] + c2[1]) / 2;
                    
                    const edgeVecX = c2[0] - c1[0];
                    const edgeVecY = c2[1] - c1[1];
                    const eD_x = _tapeRight.x * edgeVecX + _tapeForward.x * edgeVecY;
                    const eD_y = _tapeRight.y * edgeVecX + _tapeForward.y * edgeVecY;
                    const eD_z = _tapeRight.z * edgeVecX + _tapeForward.z * edgeVecY;
                    _tapeEdgeDir.set(eD_x, eD_y, eD_z).normalize();

                    // Background: A Three.js PlaneGeometry is created on the XY plane and faces +Z.
                    // To hang like a fence around the perimeter:
                    // Width (X-axis) should run along the edge: edgeDir
                    // Height (Y-axis) should point UP relative to the cube surface: tapeUp
                    // Normal (Z-axis) should point OUTWARD from the tile center: tapeNormal

                    // The outward vector for this edge
                    const outwardVecX = mx;
                    const outwardVecY = my;
                    const out_x = _tapeRight.x * outwardVecX + _tapeForward.x * outwardVecY;
                    const out_y = _tapeRight.y * outwardVecX + _tapeForward.y * outwardVecY;
                    const out_z = _tapeRight.z * outwardVecX + _tapeForward.z * outwardVecY;
                    _tapeOutwardDir.set(out_x, out_y, out_z).normalize();

                    // The UP vector is the surface normal 'n'
                    // We want the tape to stand up like a fence, so its Y axis is 'n'
                    _tapeUp.copy(n);

                    // The OUTWARD normal of the tape is 'outwardDir'
                    // We add flutter to it so the tape blows in the wind
                    const flutter = Math.sin(loopT * 15 + e * 2.1) * 0.08;
                    _tapeNormal.copy(_tapeOutwardDir).addScaledVector(n, flutter).normalize();

                    // Re-derive the exact edge direction that is perpendicular to both UP and NORMAL
                    // to ensure an orthogonal basis
                    _tapeCrossRight.crossVectors(_tapeUp, _tapeNormal).normalize();

                    // If _tapeCrossRight points opposite to edgeDir, flip it to keep texture orientation consistent
                    if (_tapeCrossRight.dot(_tapeEdgeDir) < 0) {
                        _tapeCrossRight.negate();
                        _tapeNormal.negate(); // Flip normal too to keep right-handed coordinate system
                    }

                    // X = _tapeCrossRight (along edge), Y = _tapeUp (height), Z = _tapeNormal (outward)
                    _tapeMat4.makeBasis(_tapeCrossRight, _tapeUp, _tapeNormal);
                    
                    // Tape spans from pole to pole. Distance between them is 0.9
                    const tapeLength = 0.9;
                    
                    // Add slight downward sag in the middle of the tape
                    const sag = Math.sin(loopT * 2 + e + bubbleSeeds[si + 2] * Math.PI * 2) * 0.015 - 0.015;
                    _cautionDummy.position.set(
                        wp[0] + _tapeRight.x * mx + _tapeForward.x * my + n.x * (tapeLift + sag),
                        wp[1] + _tapeRight.y * mx + _tapeForward.y * my + n.y * (tapeLift + sag),
                        wp[2] + _tapeRight.z * mx + _tapeForward.z * my + n.z * (tapeLift + sag)
                    );
                    _cautionDummy.quaternion.setFromRotationMatrix(_tapeMat4);
                    // Scale X ensures it reaches exactly pole to pole
                    _cautionDummy.scale.set(tapeLength, tapeWidth, 1);
                    _cautionDummy.updateMatrix();
                    tapes.setMatrixAt(tapeIdx++, _cautionDummy.matrix);
                }
            }


            if (isVoid) {
                const framePulse = 1 + Math.sin(t * 6.5 + i * 0.9) * 0.22;
                const half = 0.50;
                const lift = 0.11;
                const thickness = 0.028 * framePulse;
                const longEdge = 0.96;

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeRight, half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeForward);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < voidFrames.count) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeRight, -half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeForward);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < voidFrames.count) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeForward, half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeRight);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < voidFrames.count) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeForward, -half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeRight);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < voidFrames.count) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);
            }
        }

        // Zero out stale slots so nothing stale renders — only up to last frame's
        // high-water mark instead of the full instance count (which is 6n² × up to
        // 7 sub-instances and would mean thousands of writes per frame when idle).
        const prev = prevIdxRef.current;
        _ringDummy.position.set(0, 0, 0);
        _ringDummy.scale.setScalar(0);
        _ringDummy.updateMatrix();
        for (let i = liveIdx; i < prev.live; i++) liveMesh.setMatrixAt(i, _ringDummy.matrix);
        for (let i = voidIdx; i < prev.void; i++) {
            voidOuter.setMatrixAt(i, _ringDummy.matrix);
            voidInner.setMatrixAt(i, _ringDummy.matrix);
        }
        _bubbleDummy.scale.setScalar(0);
        _bubbleDummy.updateMatrix();
        for (let i = bubbleIdx; i < prev.bubble; i++) bubbles.setMatrixAt(i, _bubbleDummy.matrix);
        _sparkDummy.scale.setScalar(0);
        _sparkDummy.updateMatrix();
        for (let i = sparkIdx; i < prev.spark; i++) sparks.setMatrixAt(i, _sparkDummy.matrix);
        _cautionDummy.scale.setScalar(0);
        _cautionDummy.updateMatrix();
        for (let i = poleIdx; i < prev.pole; i++) poles.setMatrixAt(i, _cautionDummy.matrix);
        for (let i = tapeIdx; i < prev.tape; i++) tapes.setMatrixAt(i, _cautionDummy.matrix);
        _voidFrameDummy.scale.setScalar(0);
        _voidFrameDummy.updateMatrix();
        for (let i = frameIdx; i < prev.frame; i++) voidFrames.setMatrixAt(i, _voidFrameDummy.matrix);

        // Re-upload only buffers that were written this frame (active instances or
        // a stale range that just got zeroed) — skips idle GPU uploads entirely.
        if (liveIdx > 0 || prev.live > liveIdx) {
            liveMesh.instanceMatrix.needsUpdate = true;
            if (liveMesh.instanceColor) liveMesh.instanceColor.needsUpdate = true;
        }
        if (voidIdx > 0 || prev.void > voidIdx) {
            voidOuter.instanceMatrix.needsUpdate = true;
            voidInner.instanceMatrix.needsUpdate = true;
        }
        if (bubbleIdx > 0 || prev.bubble > bubbleIdx) bubbles.instanceMatrix.needsUpdate = true;
        if (sparkIdx > 0 || prev.spark > sparkIdx) sparks.instanceMatrix.needsUpdate = true;
        if (poleIdx > 0 || prev.pole > poleIdx) poles.instanceMatrix.needsUpdate = true;
        if (tapeIdx > 0 || prev.tape > tapeIdx) tapes.instanceMatrix.needsUpdate = true;
        if (frameIdx > 0 || prev.frame > frameIdx) voidFrames.instanceMatrix.needsUpdate = true;

        prev.live = liveIdx;
        prev.void = voidIdx;
        prev.bubble = bubbleIdx;
        prev.spark = sparkIdx;
        prev.pole = poleIdx;
        prev.tape = tapeIdx;
        prev.frame = frameIdx;
        clearedRef.current = allPositions.length === 0;
    });

    const MAX_BUBBLES = MAX_RINGS * BUBBLES_PER_VOID;
    const MAX_SPARKS = MAX_RINGS * SPARKS_PER_CRITICAL;
    const MAX_POLES = MAX_RINGS * POLES_PER_TILE;
    const MAX_TAPES = MAX_RINGS * TAPES_PER_TILE;
    const MAX_VOID_FRAME_SEGMENTS = MAX_RINGS * FRAME_SEGMENTS_PER_VOID;
    return (
        <>
            {/* Live wormhole rings — bright neon pink, fast spin */}
            <instancedMesh ref={liveRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
                <torusGeometry args={[0.42, 0.025, 8, 32]} />
                <meshBasicMaterial color="#ff44ff" vertexColors transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Dead void outer ring — sickly swamp green, slow reverse rotation */}
            <instancedMesh ref={voidOuterRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
                <torusGeometry args={[0.44, 0.030, 8, 32]} />
                <meshBasicMaterial color={VOID_OUTER_COLOR} transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Dead void inner ring — near-black green, barely alive counter-rotation */}
            <instancedMesh ref={voidInnerRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
                <torusGeometry args={[0.28, 0.018, 6, 24]} />
                <meshBasicMaterial color={VOID_INNER_COLOR} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Void swamp gas bubbles — dark orbs seeping out of dead portals */}
            <instancedMesh ref={bubblesRef} args={[undefined, undefined, MAX_BUBBLES]} frustumCulled={false}>
                <sphereGeometry args={[1, 5, 5]} />
                <meshBasicMaterial color={VOID_BUBBLE_COLOR} transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Critical escape arcs — electricity venting from near-void portals */}
            <instancedMesh ref={sparkRef} args={[undefined, undefined, MAX_SPARKS]} frustumCulled={false}>
                <cylinderGeometry args={[1, 1, 1, 5]} />
                <meshBasicMaterial color={CRITICAL_ARC_COLOR} transparent opacity={0.88} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Caution poles */}
            <instancedMesh ref={poleRef} args={[undefined, undefined, MAX_POLES]} frustumCulled={false}>
                <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
                <meshBasicMaterial color="#111111" transparent opacity={0.98} depthWrite={false} />
            </instancedMesh>

            {/* Caution tape strips */}
            <instancedMesh ref={tapeRef} args={[undefined, undefined, MAX_TAPES]} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={cautionTexture} color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.98} depthWrite={false} />
            </instancedMesh>

            {/* Void tile frame booster — brighter than neighbor tile frames */}
            <instancedMesh ref={voidFrameRef} args={[undefined, undefined, MAX_VOID_FRAME_SEGMENTS]} frustumCulled={false}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#9aff00" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>
        </>
    );
}

// ─── Tunnel Portal Rings — 3 gyroscope rings during antipodal traversal ──────
// Stacked torus rings rotating around X, Y, Z axes respectively; shown every
// time the worm travels through an antipodal tunnel.
const _portalRingPos = new THREE.Vector3();

function TunnelPortalRings({ worm, size }) {
    const ringXRef = useRef();
    const ringYRef = useRef();
    const ringZRef = useRef();
    // popT: -1 = idle, 0→1 = contracting-and-popping
    const popTRef = useRef(-1);
    // Saved world position for the pop (rings may have been repositioned)
    const popPosRef = useRef(new THREE.Vector3());

    useFrame(({ clock }, delta) => {
        const phase = worm.phase.current;
        const tunnel = worm.activeTunnel.current;
        const active = (phase === 'entering' || phase === 'tunnel' || phase === 'exiting') && tunnel;

        const rings = [ringXRef.current, ringYRef.current, ringZRef.current];

        // Consume healFiredRef → start pop
        if (worm.healFiredRef.current) {
            worm.healFiredRef.current = false;
            popTRef.current = 0;
            popPosRef.current.copy(_portalRingPos);
        }

        // Pop animation: rings spin fast, contract, then vanish
        if (popTRef.current >= 0) {
            popTRef.current = Math.min(1, popTRef.current + delta / 0.30);
            const pt = popTRef.current;
            const scale = Math.max(0, 1 - pt * pt); // quadratic collapse
            const t = clock.elapsedTime;
            const spinBoost = 6.0; // 6× faster spin during pop
            for (const r of rings) {
                if (!r) continue;
                r.visible = pt < 1;
                r.position.copy(popPosRef.current);
                r.scale.setScalar(scale);
            }
            if (ringXRef.current) {
                ringXRef.current.rotation.set(t * 2.2 * spinBoost, t * 0.3 * spinBoost, 0);
                ringXRef.current.material.opacity = 0.75 * (1 - pt);
            }
            if (ringYRef.current) {
                ringYRef.current.rotation.set(t * 0.4 * spinBoost, t * 1.8 * spinBoost, 0);
                ringYRef.current.material.opacity = 0.65 * (1 - pt);
            }
            if (ringZRef.current) {
                ringZRef.current.rotation.set(0, t * 0.5 * spinBoost, t * 2.5 * spinBoost);
                ringZRef.current.material.opacity = 0.55 * (1 - pt);
            }
            if (popTRef.current >= 1) {
                for (const r of rings) if (r) { r.visible = false; r.scale.setScalar(1); }
                popTRef.current = -1;
            }
            return;
        }

        if (!active) {
            for (const r of rings) if (r) r.visible = false;
            return;
        }

        // Map phase progress → tunnel t (same mapping as WormChaseCamera)
        const prog = worm.tunnelProgress.current;
        let tunnelT;
        if (phase === 'entering') tunnelT = prog * 0.35;
        else if (phase === 'exiting') tunnelT = 0.65 + prog * 0.35;
        else tunnelT = 0.35 + prog * 0.30;

        getTunnelWorldPosInto(_portalRingPos, tunnel, Math.min(tunnelT, 1), size);

        const t = clock.elapsedTime;
        // Healing exits: keep rings visible until the pop fires; normal exits fade out.
        let fadeIn;
        if (phase === 'entering') {
            fadeIn = Math.min(1, prog * 5);
        } else if (phase === 'exiting') {
            fadeIn = worm.willHealRef.current ? 1.0 : Math.max(0, 1 - prog * 3);
        } else {
            fadeIn = 1;
        }

        if (ringXRef.current) {
            ringXRef.current.position.copy(_portalRingPos);
            ringXRef.current.rotation.set(t * 2.2, t * 0.3, 0);
            ringXRef.current.material.opacity = 0.75 * fadeIn;
            ringXRef.current.visible = true;
        }
        if (ringYRef.current) {
            ringYRef.current.position.copy(_portalRingPos);
            ringYRef.current.rotation.set(t * 0.4, t * 1.8, 0);
            ringYRef.current.material.opacity = 0.65 * fadeIn;
            ringYRef.current.visible = true;
        }
        if (ringZRef.current) {
            ringZRef.current.position.copy(_portalRingPos);
            ringZRef.current.rotation.set(0, t * 0.5, t * 2.5);
            ringZRef.current.material.opacity = 0.55 * fadeIn;
            ringZRef.current.visible = true;
        }
    });

    return (
        <>
            {/* X-axis ring */}
            <mesh ref={ringXRef} visible={false}>
                <torusGeometry args={[0.40, 0.026, 8, 32]} />
                <meshBasicMaterial color="#cc44ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Y-axis ring */}
            <mesh ref={ringYRef} visible={false}>
                <torusGeometry args={[0.36, 0.022, 8, 32]} />
                <meshBasicMaterial color="#aa22ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Z-axis ring */}
            <mesh ref={ringZRef} visible={false}>
                <torusGeometry args={[0.32, 0.020, 8, 32]} />
                <meshBasicMaterial color="#ff44ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </>
    );
}

// ─── Slice Warning Lights ─────────────────────────────────────────────────────
// Visual warning for the about-to-rotate slice:
//   1. Spinning rainbow torus ring — encircles the cube at the slice plane, sized to the
//      cube's actual world-space dimensions so it is always visible on any cube size.
//      Vertex-colored with all 6 face colors. Spins in the rotation direction.
//   2. PointLights per face — antipodal-colored scene lighting.
//
// World-space coordinate formula: tile at grid index i on axis with size n
//   maps to world coord  i - (n-1)/2
// So the cube half-extent is (size-1)/2, and the ring radius must clear
// the face diagonal: (size-1)/2 * sqrt(2) plus margin.
const MAX_SLICE_LIGHTS = 6;
const TUBULAR_SEGS = 96;
const RADIAL_SEGS  = 16;

const _ringSpinQ = new THREE.Quaternion();
const _xAxis     = new THREE.Vector3(1, 0, 0);
const _yAxis     = new THREE.Vector3(0, 1, 0);
const _zAxis     = new THREE.Vector3(0, 0, 1);

function SliceWarningLights({ pendingRotRef, warningProgressRef, size, cubies }) {
    const lightGroupRef = useRef();
    const ringRef       = useRef();
    const customGeoRef  = useRef(null); // tracks geometries we created so we can dispose them
    const dataRef       = useRef(null);
    const lastKeyRef    = useRef(null);
    const spinAngleRef  = useRef(0);

    useFrame(({ clock }, delta) => {
        const lgroup = lightGroupRef.current;
        const ring   = ringRef.current;
        if (!lgroup || !ring) return;

        const pending = pendingRotRef.current;
        const t  = clock.elapsedTime;
        const wp = warningProgressRef.current;

        if (!pending) {
            for (const l of lgroup.children) l.intensity = 0;
            ring.visible = false;
            lastKeyRef.current = null;
            dataRef.current    = null;
            return;
        }

        ring.visible = true;

        // Recompute when the slice identity changes
        const key = `${pending.axis}-${pending.sliceIndex}`;
        if (key !== lastKeyRef.current) {
            lastKeyRef.current = key;
            const { axis, sliceIndex } = pending;
            const stickers   = getSliceSurfaceStickers(size, axis, sliceIndex);
            const faceColors = resolveColors(useGameStore.getState().settings);

            // Per-face center + color for point lights
            const byFace = {};
            for (const { x, y, z, dirKey } of stickers) {
                const [wx, wy, wz] = getStickerWorldPos(x, y, z, dirKey, size, 0);
                if (!byFace[dirKey]) {
                    const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
                    const faceId  = sticker?.curr ?? 0;
                    const antiId  = ANTIPODAL_COLOR[faceId] ?? faceId;
                    const hex     = (antiId && faceColors[antiId]) ?? '#ffcc44';
                    byFace[dirKey] = { wx: 0, wy: 0, wz: 0, n: 0, color: new THREE.Color(hex) };
                }
                byFace[dirKey].wx += wx;
                byFace[dirKey].wy += wy;
                byFace[dirKey].wz += wz;
                byFace[dirKey].n++;
            }
            const faceData = Object.entries(byFace).map(([dirKey, d]) => {
                const nm = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
                return { cx: d.wx / d.n, cy: d.wy / d.n, cz: d.wz / d.n, nx: nm.x, ny: nm.y, nz: nm.z, color: d.color };
            });

            // ── Ring position ─────────────────────────────────────────────────
            // Tile grid index i maps to world coord  i - (size-1)/2
            const sliceW = sliceIndex - (size - 1) / 2;
            if (axis === 'col')        ring.position.set(sliceW, 0, 0);
            else if (axis === 'row')   ring.position.set(0, sliceW, 0);
            else                       ring.position.set(0, 0, sliceW);

            // ── Ring geometry — sized to cube, rainbow vertex colors ───────────
            // Outer corner of any cube face is (size-1)/2 * sqrt(2) from center;
            // add 15% margin so the ring clearly floats outside.
            const halfExt    = (size - 1) / 2;
            const ringRadius = halfExt * Math.SQRT2 * 1.15;
            const ringTube   = Math.max(0.06, halfExt * 0.055);

            if (customGeoRef.current) { customGeoRef.current.dispose(); customGeoRef.current = null; }
            const geo = new THREE.TorusGeometry(ringRadius, ringTube, RADIAL_SEGS, TUBULAR_SEGS);

            // Vertex colors: cycle through all 6 face colors equally around the ring
            const colors6  = [1, 2, 3, 4, 5, 6].map(id => new THREE.Color(faceColors[id] ?? '#ffffff'));
            const vertCount = (RADIAL_SEGS + 1) * (TUBULAR_SEGS + 1);
            const colorArr  = new Float32Array(vertCount * 3);
            let ci = 0;
            for (let i = 0; i <= TUBULAR_SEGS; i++) {
                const c = colors6[Math.floor((i / TUBULAR_SEGS) * 6) % 6];
                for (let j = 0; j <= RADIAL_SEGS; j++) {
                    colorArr[ci++] = c.r;
                    colorArr[ci++] = c.g;
                    colorArr[ci++] = c.b;
                }
            }
            geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
            customGeoRef.current = geo;
            ring.geometry = geo;

            // ── Ring orientation ──────────────────────────────────────────────
            // Default TorusGeometry: XY plane, hole (symmetry axis) along Z.
            //   col  → rotate 90° around Y   → hole along +X
            //   row  → rotate -90° around X  → hole along +Y
            //   depth→ identity               → hole already along Z
            const baseQ = new THREE.Quaternion();
            if (axis === 'col')      baseQ.setFromAxisAngle(_yAxis,  Math.PI / 2);
            else if (axis === 'row') baseQ.setFromAxisAngle(_xAxis, -Math.PI / 2);

            const rotAxis = axis === 'col'   ? _xAxis.clone()
                          : axis === 'row'   ? _yAxis.clone()
                          :                    _zAxis.clone();

            dataRef.current = { faceData, baseQ, rotAxis };
        }

        const { faceData, baseQ, rotAxis } = dataRef.current;

        // ── 1. Point lights ───────────────────────────────────────────────────
        const strobe   = 0.4 + Math.abs(Math.sin(t * (4 + wp * 14))) * 0.6;
        const lightInt = (3 + wp * 10) * strobe;
        for (let i = 0; i < MAX_SLICE_LIGHTS; i++) {
            const l = lgroup.children[i];
            if (!l) continue;
            if (i >= faceData.length) { l.intensity = 0; continue; }
            const { cx, cy, cz, nx, ny, nz, color } = faceData[i];
            l.position.set(cx + nx * 0.15, cy + ny * 0.15, cz + nz * 0.15);
            l.color.copy(color);
            l.intensity = lightInt;
        }

        // ── 2. Ring spin + pulse ──────────────────────────────────────────────
        spinAngleRef.current += delta * (1.2 + wp * 2.5) * pending.dir;
        _ringSpinQ.setFromAxisAngle(rotAxis, spinAngleRef.current);
        ring.quaternion.multiplyQuaternions(_ringSpinQ, baseQ);

        const pulse = 0.7 + 0.3 * Math.sin(t * 7);
        ring.material.opacity = (0.55 + wp * 0.4) * pulse;
        ring.scale.setScalar(1 + Math.sin(t * 4) * 0.02);
    });

    return (
        <>
            <group ref={lightGroupRef}>
                {Array.from({ length: MAX_SLICE_LIGHTS }, (_, i) => (
                    <pointLight key={i} intensity={0} distance={30} decay={2} castShadow={false} />
                ))}
            </group>
            {/* Rainbow spinning ring — geometry set imperatively in useFrame to scale with cube size */}
            <mesh ref={ringRef} visible={false}>
                <torusGeometry args={[1, 0.04, RADIAL_SEGS, TUBULAR_SEGS]} />
                <meshBasicMaterial vertexColors transparent opacity={0.9}
                    blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </>
    );
}

// ─── Thunk Comic Effect ───────────────────────────────────────────────────────
// Comic-book THUNK text + coloured orb burst at the worm cut point.
const MAX_THUNK_ORBS = 10;
const _thunkDummy = new THREE.Object3D();
const _thunkCol = new THREE.Color();

function ThunkEffect({ thunkRef }) {
    const groupRef = useRef();
    const divRef = useRef();
    const orbMeshRef = useRef();
    const animTRef = useRef(0);
    const activeRef = useRef(false);
    const durationRef = useRef(1.4); // seconds — 1.4 for WORM!, 4.2 for WORM'D
    const orbStateRef = useRef({ positions: [], velocities: [], colors: [] });

    useFrame((_, delta) => {
        const pending = thunkRef.current;
        if (pending?.active) {
            pending.active = false;
            activeRef.current = true;
            animTRef.current = 0;
            // Support custom text (e.g. countdown "WORM!" vs collision "WORM'D")
            const text = pending.text ?? "WORM'D";
            if (divRef.current) divRef.current.textContent = text;
            // WORM'D lingers 3× longer so players have time to read it
            durationRef.current = text === "WORM'D" ? 4.2 : 1.4;
            const [px, py, pz] = pending.pos;
            if (groupRef.current) {
                groupRef.current.position.set(px, py, pz);
                groupRef.current.visible = true;
            }
            const st = orbStateRef.current;
            const colors = pending.colors?.length ? pending.colors : ['#ffdd44', '#ff8800', '#ff4444'];
            st.positions = [];
            st.velocities = [];
            st.colors = colors;
            for (let i = 0; i < MAX_THUNK_ORBS; i++) {
                st.positions.push([px, py, pz]);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI;
                const spd = 1.8 + Math.random() * 2.2;
                st.velocities.push([
                    Math.sin(phi) * Math.cos(theta) * spd,
                    Math.sin(phi) * Math.sin(theta) * spd,
                    Math.cos(phi) * spd,
                ]);
            }
        }

        if (!activeRef.current) {
            const mesh = orbMeshRef.current;
            if (mesh) {
                _thunkDummy.scale.setScalar(0);
                _thunkDummy.updateMatrix();
                for (let i = 0; i < MAX_THUNK_ORBS; i++) mesh.setMatrixAt(i, _thunkDummy.matrix);
                mesh.instanceMatrix.needsUpdate = true;
            }
            return;
        }

        animTRef.current += delta;
        const t = Math.min(animTRef.current / durationRef.current, 1);

        // Animate HTML text scale + fade
        if (divRef.current) {
            const scale = t < 0.15 ? (t / 0.15) * 1.5 : t < 0.4 ? 1.5 - ((t - 0.15) / 0.25) * 0.5 : 1.0;
            const opacity = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
            divRef.current.style.transform = `scale(${scale})`;
            divRef.current.style.opacity = String(opacity);
            divRef.current.style.display = 'block';
        }

        // Animate orb burst
        const mesh = orbMeshRef.current;
        if (mesh) {
            const st = orbStateRef.current;
            const et = animTRef.current;
            for (let i = 0; i < MAX_THUNK_ORBS; i++) {
                const [vx, vy, vz] = st.velocities[i] || [0, 0, 0];
                const fade = Math.max(0, 1 - et / 0.75);
                _thunkDummy.position.set(
                    st.positions[i][0] + vx * et,
                    st.positions[i][1] + vy * et,
                    st.positions[i][2] + vz * et,
                );
                _thunkDummy.scale.setScalar(fade * 0.11);
                _thunkDummy.updateMatrix();
                mesh.setMatrixAt(i, _thunkDummy.matrix);
                _thunkCol.set(st.colors[i % st.colors.length] || '#ffdd44');
                mesh.setColorAt(i, _thunkCol);
            }
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }

        if (animTRef.current >= durationRef.current) {
            activeRef.current = false;
            if (groupRef.current) groupRef.current.visible = false;
            if (divRef.current) divRef.current.style.display = 'none';
        }
    });

    return (
        <>
            <group ref={groupRef} visible={false}>
                <Html center distanceFactor={10}>
                    <div ref={divRef} style={{
                        fontFamily: "'Impact', 'Arial Black', sans-serif",
                        fontSize: '54px',
                        fontWeight: 900,
                        color: '#ffdd00',
                        textShadow: '-3px -3px 0 #cc2200, 3px -3px 0 #cc2200, -3px 3px 0 #cc2200, 3px 3px 0 #cc2200',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        letterSpacing: '-2px',
                        transformOrigin: 'center',
                        display: 'none',
                    }}>
                        WORM&apos;D
                    </div>
                    {/* text is overwritten imperatively via divRef.current.textContent */}
                </Html>
            </group>
            <instancedMesh ref={orbMeshRef} args={[undefined, undefined, MAX_THUNK_ORBS]} frustumCulled={false}>
                <sphereGeometry args={[1, 6, 6]} />
                <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>
        </>
    );
}

// ─── Main exported wrapper ────────────────────────────────────────────────────
export function HealerWormMode3DWrapper({ cubies, size, _explosionFactor, _animState, onRotate, _onHeal, onAnimatedShuffle }) {
    const worm = useWormCrawler(size, cubies);

    // ── Game phase + scramble state ────────────────────────────────────────────
    // gameModePhaseRef: 'scrambling'|'spawning'|'countdown'|'active'|'finalHealing'|'solved'
    const gameModePhaseRef  = useRef('scrambling');
    const scrambleSeqRef    = useRef([]);   // [{axis,dir,sliceIndex}] × SCRAMBLE_STEPS
    const inverseQueueRef   = useRef([]);   // remaining inverse moves (consumed each rotation)
    const spawnTimerRef     = useRef(0);    // seconds elapsed in spawning entrance animation
    const countdownTimerRef = useRef(0);    // seconds elapsed in countdown phase
    const countdownStepRef  = useRef(-1);   // last store-synced step (avoids redundant setState)
    const finalHealCheckTimer = useRef(0);  // throttle: scan for active tunnels every 0.5s

    // Reactive phase for conditional JSX rendering — only changes on phase transitions
    const wormGamePhase = useGameStore(s => s.wormGamePhase ?? 'scrambling');
    const wormPhaseReactive = useGameStore(s => s.wormPhase ?? 'crawling');

    // ── Auto-rotation hazard state ─────────────────────────────────────────────
    const autoTimerRef      = useRef(0);
    const pendingRotRef     = useRef(null);   // {axis,dir,sliceIndex} during warning window
    const warningProgressRef = useRef(0);     // 0→1 through warning window
    const thunkRef = useRef({ active: false, pos: [0, 0, 0], colors: [] });

    useEffect(() => {
        setWormTurnCallback(worm.queueTurn);
        return () => { setWormTurnCallback(null); };
    }, [worm.queueTurn]);

    // Build a fresh scramble whenever a new run starts (or on first mount).
    useEffect(() => {
        const generateScramble = () => {
            const axes = ['col', 'row', 'depth'];
            const seq = Array.from({ length: SCRAMBLE_STEPS }, () => ({
                axis: axes[Math.floor(Math.random() * 3)],
                dir: Math.random() < 0.5 ? 1 : -1,
                sliceIndex: Math.floor(Math.random() * size),
            }));
            scrambleSeqRef.current  = seq;
            // Inverse = reversed sequence with each dir flipped
            inverseQueueRef.current = [...seq].reverse().map(m => ({ ...m, dir: -m.dir }));

            // Reset all phase state
            gameModePhaseRef.current  = 'scrambling';
            spawnTimerRef.current     = 0;
            countdownTimerRef.current = 0;
            countdownStepRef.current  = -1;
            autoTimerRef.current      = 0;
            pendingRotRef.current     = null;
            warningProgressRef.current = 0;
            // Freeze the worm until the countdown completes
            useGameStore.setState({ wormGamePhase: 'scrambling', wormCountdownStep: null, wormPaused: true });

            // Play all 15 moves through the shared animated-shuffle pipeline:
            // fast 0.12s power2.out animations (no back-easing overshoot → no black layers),
            // properly sequenced, not counted as player moves.
            // When done, go to 'spawning' so the worm can emerge before the countdown.
            onAnimatedShuffle(seq, () => {
                gameModePhaseRef.current = 'spawning';
                spawnTimerRef.current    = 0;
                useGameStore.setState({ wormGamePhase: 'spawning', wormCountdownStep: null });
            });
        };

        // Run immediately so the first game (where initWormMode fires before this
        // component mounts) gets a valid scramble — not just on future runId changes.
        generateScramble();

        const unsub = useGameStore.subscribe(s => s.wormRunId, generateScramble);
        return unsub;
    }, [size, onAnimatedShuffle]);

    useFrame((_, delta) => {
        worm.tick(delta);

        const store = useGameStore.getState();

        // ── Phase: scrambling ──────────────────────────────────────────────────
        // Moves are sequenced by startAnimatedShuffle (called from generateScramble).
        // Here we only track the worm's visual position so it rides along with each
        // rotating slice instead of staying frozen in world space.
        if (gameModePhaseRef.current === 'scrambling') {
            if (liveRotation.active) {
                const { axis, sliceIndex, angle } = liveRotation;
                const { x, y, z, dirKey } = worm.pos.current;
                const wormInSlice = (
                    (axis === 'col'   && x === sliceIndex) ||
                    (axis === 'row'   && y === sliceIndex) ||
                    (axis === 'depth' && z === sliceIndex)
                );
                if (wormInSlice) {
                    const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
                    worm.headInterpPos.current.set(wp[0], wp[1], wp[2]);
                    _liveAxis.set(
                        axis === 'col' ? 1 : 0,
                        axis === 'row' ? 1 : 0,
                        axis === 'depth' ? 1 : 0
                    );
                    worm.headInterpPos.current.applyAxisAngle(_liveAxis, angle);
                }
            }
            return;
        }

        // ── Phase: spawning — worm wiggles out of the face center ─────────────
        if (gameModePhaseRef.current === 'spawning') {
            spawnTimerRef.current += delta;
            const t = Math.min(spawnTimerRef.current / SPAWN_DURATION, 1);
            // Damped spring: shoots out of the face then settles
            const bounce = Math.sin(t * Math.PI * 2.4) * Math.exp(-t * 4.0) * 0.4;
            const { x, y, z, dirKey } = worm.pos.current;
            const norm = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
            const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
            worm.headInterpPos.current.set(wp[0], wp[1], wp[2]).addScaledVector(norm, WORM_LIFT + bounce);
            if (t >= 1) {
                gameModePhaseRef.current  = 'countdown';
                countdownTimerRef.current = 0;
                countdownStepRef.current  = -1;
                useGameStore.setState({ wormGamePhase: 'countdown', wormCountdownStep: 3 });
                countdownStepRef.current  = 0;
            }
            return;
        }

        // ── Phase: countdown ──────────────────────────────────────────────────
        if (gameModePhaseRef.current === 'countdown') {
            countdownTimerRef.current += delta;
            const step = Math.floor(countdownTimerRef.current / COUNTDOWN_STEP_DURATION);
            if (step !== countdownStepRef.current) {
                countdownStepRef.current = step;
                if      (step === 0) useGameStore.setState({ wormCountdownStep: 3 });
                else if (step === 1) useGameStore.setState({ wormCountdownStep: 2 });
                else if (step === 2) useGameStore.setState({ wormCountdownStep: 1 });
                else if (step === 3) {
                    // 'go' beat — HUD displays WORM! in the purple-glow countdown style.
                    // No separate ThunkEffect pop here; the HUD text IS the cool WORM display.
                    useGameStore.setState({ wormCountdownStep: 'go' });
                } else if (step >= 4) {
                    // Countdown done — release the worm
                    gameModePhaseRef.current = 'active';
                    autoTimerRef.current = 0;
                    pendingRotRef.current = null;
                    warningProgressRef.current = 0;
                    useGameStore.setState({ wormGamePhase: 'active', wormCountdownStep: null, wormPaused: false });
                }
            }
            return;
        }

        // ── Phase: solved ──────────────────────────────────────────────────────
        if (gameModePhaseRef.current === 'solved') return;

        // ── Phase: finalHealing — all rotations done, heal remaining tunnels ───
        if (gameModePhaseRef.current === 'finalHealing') {
            if (!store.wormAlive) return;
            // Throttle the expensive tunnel scan to once every 0.5 s
            finalHealCheckTimer.current += delta;
            if (finalHealCheckTimer.current >= 0.5) {
                finalHealCheckTimer.current = 0;
                const remaining = getActiveTunnels(useGameStore.getState().cubies, size);
                if (remaining.length === 0) {
                    gameModePhaseRef.current = 'solved';
                    const bodyOrbs = useGameStore.getState().wormBodyTiles ?? 0;
                    // 2× multiplier: reward for clearing all tunnels before the clock ran out
                    if (bodyOrbs > 0) useGameStore.getState().earnCoins(bodyOrbs * EARN_ORB_COLLECT * 2);
                    // Freeze the worm — game is over; publish final time for WinnerScreen
                    useGameStore.setState({ wormGamePhase: 'solved', wormPaused: true, wormTimeAlive: Math.floor(worm.timeAliveRef.current) });
                }
            }
            return;
        }

        // ── Phase: active — inverse-rotation hazard ────────────────────────────
        if (!store.wormAlive || store.wormPaused) return;

        autoTimerRef.current += delta;
        const warningStart = ACTIVE_ROTATE_INTERVAL - AUTO_ROTATE_WARNING;

        // Arm warning with the NEXT inverse move (peek, don't dequeue yet)
        if (autoTimerRef.current >= warningStart && !pendingRotRef.current) {
            if (inverseQueueRef.current.length === 0) {
                // All inverse moves exhausted — enter final healing phase.
                // Wormhole spawning is now blocked (checked in worm.tick).
                // Game ends only when the player heals all remaining tunnels.
                gameModePhaseRef.current = 'finalHealing';
                finalHealCheckTimer.current = 0.5; // check immediately next frame batch
                pendingRotRef.current = null;
                warningProgressRef.current = 0;
                useGameStore.setState({ wormGamePhase: 'finalHealing' });
                return;
            }
            pendingRotRef.current = inverseQueueRef.current[0]; // peek
        }

        // Update warning progress (0→1)
        if (pendingRotRef.current) {
            const elapsed = autoTimerRef.current - warningStart;
            warningProgressRef.current = Math.min(1, Math.max(0, elapsed / AUTO_ROTATE_WARNING));
        }

        // Fire rotation at the fixed 10-second mark
        if (autoTimerRef.current >= ACTIVE_ROTATE_INTERVAL && pendingRotRef.current) {
            // Delay if mid-tunnel
            if (worm.phase.current !== 'crawling') {
                autoTimerRef.current = ACTIVE_ROTATE_INTERVAL - 1.5;
                return;
            }

            const { axis, dir, sliceIndex } = pendingRotRef.current;
            inverseQueueRef.current.shift(); // now dequeue

            // Hit detection
            const hit = checkWormHitBySlice(worm, axis, sliceIndex);
            if (hit) {
                const histEntry = hit.type === 'cut'
                    ? shAt(worm.stepHistory.current, hit.cutTrailIdx * STEPS_PER_TILE)
                    : null;
                const hitPos = histEntry
                    ? histEntry.pos.toArray()
                    : worm.headInterpPos.current.toArray();
                const cutColors = worm.orbPickupColorsRef.current.slice(0, 5);
                thunkRef.current = {
                    active: true,
                    pos: hitPos,
                    colors: cutColors.length ? cutColors : ['#ffdd44', '#ff8800'],
                };
                if (hit.type === 'death') {
                    worm.killWorm({ reason: 'slice-rotation', axis, sliceIndex });
                } else {
                    cutWormTail(worm, hit.cutTrailIdx);
                }
            }

            if (onRotate) onRotate(axis, dir, sliceIndex);

            // Reset for next cycle (fixed interval — no randomisation)
            pendingRotRef.current = null;
            warningProgressRef.current = 0;
            autoTimerRef.current = 0;
        }
    });

    const wormInTunnel = wormPhaseReactive === 'entering' || wormPhaseReactive === 'tunnel' || wormPhaseReactive === 'exiting';
    const wormAlive = wormGamePhase !== 'scrambling';

    return (
        <>
            <WormChaseCamera worm={worm} size={size} />
            <WormSwipeControls onTurn={worm.queueTurn} worm={worm} />
            <TunnelInteriorView worm={worm} size={size} />
            {/* Always mounted — each component handles its own dissolve via worm.phase.current */}
            {wormAlive && <WormTrail worm={worm} size={size} />}
            {wormAlive && <WormBody worm={worm} />}
            {wormAlive && <GlowWormAura worm={worm} />}
            {wormAlive && <WormFace worm={worm} size={size} />}
            {wormAlive && <PortalGlow worm={worm} size={size} />}
            {!wormInTunnel && <WormholeRings
                cubies={cubies}
                size={size}
                worm={worm}
                voidTunnelKeysRef={worm.voidTunnelKeysRef}
                tunnelUseCountsRef={worm.tunnelUseCountsRef}
            />}
            <TunnelHealProgress size={size} />
            <HeartBurstSystem worm={worm} size={size} />
            <OrbFlashSystem worm={worm} />
            <PowerupOrbs size={size} />
            <SliceWarningLights pendingRotRef={pendingRotRef} warningProgressRef={warningProgressRef} size={size} cubies={cubies} />
            <ThunkEffect thunkRef={thunkRef} />
            <CollisionGlow size={size} />
        </>
    );
}

// ─── Collision Glow ───────────────────────────────────────────────────────────
// Renders pulsing glowing spheres at the self-collision head + body tile so the
// player can examine exactly where they died after minimising the death card.
// Reads from the Zustand store imperatively (no React state → no re-render cost).
function CollisionGlow({ size }) {
    const colMeshRef  = useRef();
    const headMeshRef = useRef();
    const cachedRef   = useRef(null);
    const lastDetailsRef = useRef(null);

    useFrame(({ clock }) => {
        const col  = colMeshRef.current;
        const head = headMeshRef.current;
        if (!col || !head) return;

        const st      = useGameStore.getState();
        const details = st.wormDeathDetails;
        const active  = !!(details?.reason === 'self-collision' && !st.wormAlive);

        if (!active) {
            col.visible  = false;
            head.visible = false;
            if (cachedRef.current !== null) cachedRef.current = null;
            return;
        }

        // Cache world positions once per death event
        if (cachedRef.current === null || lastDetailsRef.current !== details) {
            lastDetailsRef.current = details;
            cachedRef.current = {};
            const LIFT = 0.08; // raise slightly off tile surface

            if (details.collisionTile) {
                const [tx, ty, tz, dk] = details.collisionTile.split(',');
                const [wx, wy, wz] = getStickerWorldPos(Number(tx), Number(ty), Number(tz), dk, size, 0);
                const n = FACE_NORMALS[dk] ?? FACE_NORMALS.PZ;
                cachedRef.current.colPos  = new THREE.Vector3(wx + n.x * LIFT, wy + n.y * LIFT, wz + n.z * LIFT);
            }
            if (details.headTile) {
                const [tx, ty, tz, dk] = details.headTile.split(',');
                const [wx, wy, wz] = getStickerWorldPos(Number(tx), Number(ty), Number(tz), dk, size, 0);
                const n = FACE_NORMALS[dk] ?? FACE_NORMALS.PZ;
                cachedRef.current.headPos = new THREE.Vector3(wx + n.x * LIFT, wy + n.y * LIFT, wz + n.z * LIFT);
            }
        }

        const t     = clock.elapsedTime;
        const pulse = 0.55 + 0.45 * Math.sin(t * 4.5);
        const R     = 0.28; // glow sphere radius (world units, ~1 tile)

        if (cachedRef.current.colPos) {
            col.visible = true;
            col.position.copy(cachedRef.current.colPos);
            col.scale.setScalar(R * (0.75 + 0.5 * pulse));
            col.material.opacity = 0.5 + 0.45 * pulse;
        } else {
            col.visible = false;
        }

        if (cachedRef.current.headPos) {
            head.visible = true;
            head.position.copy(cachedRef.current.headPos);
            head.scale.setScalar(R * (0.75 + 0.5 * (1 - pulse))); // opposite phase
            head.material.opacity = 0.4 + 0.35 * (1 - pulse);
        } else {
            head.visible = false;
        }
    });

    return (
        <>
            {/* Body tile that was hit — red */}
            <mesh ref={colMeshRef} visible={false} frustumCulled={false}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color="#ff1a1a" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Head tile at moment of collision — orange */}
            <mesh ref={headMeshRef} visible={false} frustumCulled={false}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color="#ff8800" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </>
    );
}
