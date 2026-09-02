// src/worm/healerWorm/wormSim.js
//
// Pure(-ish) worm simulation core, extracted from useWormCrawler.js (2026-07).
//
// All gameplay state lives in ONE plain object (makeWormSim) and is advanced by
// module-level functions — no React, no Zustand import, no audio. Everything the
// sim needs from the outside world comes through a `ctx` port supplied by the
// caller (useWormCrawler in production, a stub in tests):
//
//   reads  — ctx.getCubies(), getGamePhase(), isPaused(), getSpeed(),
//            getControlMode(), getWormholeInterval(), isPrismCharacter(),
//            getOrbInventory(), getHealingProgress(), getOrbColor(faceId),
//            resolveTunnel(x, y, z, dirKey)
//   writes — ctx.feel(name, opts), onDeath(details, timeAlive),
//            onTunnelEnter(tunnel), onCrawlResume(), onPhase(phase),
//            onBoostState(state), onSurvivalTick(), spawnWormholePair(tile),
//            onFlippedTile(bool), applyDeposit(deposit, stableKey, faceId),
//            onOrbPickup(faceId, orbCount), onPowerupsChanged(list),
//            applyHeal(entry, exitTile, stableKey, healedCount),
//            onSpecialsChanged(list), onRocketState(bool), onMagnetState(seconds)
//
// Each ctx write method corresponds 1:1 to a store/feel call-site in the
// pre-extraction hook, so the control flow in here is a verbatim translation of
// the original tick (refs → sim fields). The split makes the crawl/turn/tunnel
// state machine deterministic and unit-testable: drive stepWormSim with fixed
// dt values and a stubbed ctx, then assert on the sim object.
//
// The sim DOES read the shared `liveRotation` bridge (mid-rotation slice state
// written by CubeAssembly each frame) — it is a plain mutable module, settable
// from tests, and injecting it through ctx would only obscure the contract.

import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getStickerSafe } from '../../game/cubeState.js';
import { rotateVec90 } from '../../game/cubeRotation.js';
import {
    getNextSurfacePosition,
    getTunnelWorldPosSmoothInto,
    getWindWorldPosInto,
    turnWorm,
    getStableKey,
    isTileInSlice,
    nextRestRead,
    nextRestReadDuringStep,
    rotateMoveDir,
    collectManifoldRing,
    findCoveredWormholeRing,
} from '../wormLogic.js';
import { liveRotation } from '../liveRotation.js';
import { rotateTilePosition, parseTileKey, _parseTile } from '../wormHelpers.js';
import { remapWormPress } from '../tilePressBridge.js';
import {
    makeStepHistory, shPush, shAt, shReset,
    makeTileTrail, ttPush, ttAt, ttReset, ttMapInPlace, ttFilterInPlace,
} from '../circularBuffers.js';
import { isSurfaceTilePos, randomFreeTile, randomUnflippedTile } from './surfaceTiles.js';
import { computeOrbDeposit, classifyTraversal, orbsCarried, isHealReady } from './economy.js';
import {
    makeSpecialPicker,
    drawSpecialType,
    countOrbsWithin,
    buildSpawnCandidates,
    pickSpawnTile,
    tileKeyOf,
} from './specialSpawn.js';
import { SURVIVAL_TICK_INTERVAL } from '../../utils/economyConstants.js';
import { isElementalType, ELEMENTAL_TYPES } from './specialDefs.js';
import {
    WORM_LIFT,
    TUNNEL_SPEED_SCALE,
    FACE_NORMALS,
    INITIAL_DIR,
    INITIAL_POS,
    ORB_SEGMENT_GROWTH,
    STEPS_PER_TILE,
    BODY_BALL_SPACING,
    BASE_TAIL_LENGTH,
    windoutHeadS,
    DEFAULT_WORMHOLE_FLIP_INTERVAL,
    MAX_JUMPS,
    HEAL_PAUSE_DURATION,
    TUNNEL_TRIGGER_PROGRESS,
    SELF_COLLISION_TRIGGER_PROGRESS,
    SELF_COLLISION_GRACE_STEPS_AFTER_TUNNEL,
    MAX_TAIL,
    SURFACE_JUMP_HEIGHT,
    SURFACE_JUMP_TILE_SPAN,
    BOOST_MULTIPLIER,
    BOOST_DURATION,
    BOOST_COOLDOWN,
    MAX_TICK_DELTA,
    TRAIL_HISTORY_CAP,
    SPECIAL_MAX_ON_BOARD,
    SPECIAL_SPAWN_INTERVAL,
    SPECIAL_LIFETIME,
    ROCKET_DURATION,
    ROCKET_SPEED_MULT,
    MAGNET_DURATION,
    MAGNET_RADIUS,
    ELEMENTAL_DURATION,
    ELEMENTAL_FOCUS_DURATION,
    ELEMENTAL_SPAWN_INTERVAL,
    ELEMENTAL_OFFER_COUNT,
    ELEMENTAL_CLAIM_COOLDOWN,
    ELEMENTAL_LIFETIME,
    SPECIAL_SPAWN_RADIUS,
    SPECIAL_JUMP_REACH,
    SPECIAL_TUNNEL_RADIUS,
    SPECIAL_SPAWN_RETRY,
    MAX_ORB_ATTRACTION_FX,
    activeTunnelCap,
} from './constants.js';

// Axis scratch for baking a committed turn into the worm's position history.
const _bakeAxis = new THREE.Vector3();

// ─── Scratch vectors for evaluatePosAndNormal (avoids per-sub-step allocations) ──
const _evalHPos = new THREE.Vector3();
const _evalCornerVtx = new THREE.Vector3();
const _evalCornerNorm = new THREE.Vector3(); // reused for face-crossing normal blend
// Extra scratch for computing the lifted position before writing into stepHistory
const _evalLiftedPos = new THREE.Vector3();

export const tileKey = (p) => `${p.x},${p.y},${p.z},${p.dirKey}`;

/**
 * Allocate a fresh worm simulation state object. All gameplay state — position,
 * phase, trails, timers, tunnel bookkeeping — lives here as plain fields
 * (plus a few owned THREE.Vector3 / ring-buffer instances). One sim per run;
 * reuse across runs via resetWormSim.
 */
export function makeWormSim(size) {
    const sim = {
        // ── Core movement ──────────────────────────────────────────────────────
        pos: INITIAL_POS(size),
        moveDir: INITIAL_DIR,
        phase: 'crawling',
        prevPhase: 'crawling',
        alive: true,
        stepAcc: 0,
        pendingTurns: [],
        // Reverse-guard: the last direction the worm turned and how many tiles it has
        // crawled since, so a same-direction second turn taken before the worm has moved
        // (which would fold into a 180 into its own neck) can be HELD to the next tile
        // instead of firing in place. Starts ≥1 so the first turn of a run fires at once.
        lastTurnDir: null,
        tilesSinceTurn: 1,
        // Tracks the previous frame's STEP_SEC so stepAcc can be rescaled when the crawl
        // speed changes mid-step (boost toggling, or the speed slider) — keeps
        // stepAcc/STEP_SEC (which equals interpT) consistent so a speed change never
        // force-crosses a tile early and scatters the body trail.
        prevStepSec: null,
        // Smooth inter-tile interpolation
        interpT: 1,               // 0→1 between prev and current tile
        prevWorldPos: null,       // null = no prev yet; otherwise aliases _prevWP below
        curWorldPos: null,        // always aliases _curWP below (set in makeWormSim tail)
        headInterpPos: new THREE.Vector3(),
        currentNormal: new THREE.Vector3(0, 0, 1),
        // Owned world-position slots — two dedicated vectors so prevWorldPos and
        // curWorldPos never alias the same object.
        _curWP: new THREE.Vector3(),
        _prevWP: new THREE.Vector3(),
        prevDirKey: null,
        // The grid tile the head is interpolating FROM (the lerp source). Tracked
        // explicitly so a mid-step rotation can rotate this source in lockstep with the
        // slice — otherwise the head would lerp from the tile's pre-rotation world
        // position and snap when the turn commits.
        prevTile: null,
        crossingCorner: false,
        lastRecordedT: 0,

        // ── Rest-read (mid-rotation slice crossing) ───────────────────────────
        // Non-null while the current step must read a mid-rotation slice at its
        // committed (end-of-rotation) state. See nextRestRead in wormLogic.js.
        restReadSlice: null,
        // Trail keys laid down while rest-reading — skipped by the commit-time remap.
        restReadTileKeys: new Set(),

        // ── Jump ───────────────────────────────────────────────────────────────
        jumpT: 0,                 // 0 = grounded, >0 = in air
        isJumping: false,
        jumpCount: 0,
        // Span (in tiles) and apex height of the CURRENT flight. A normal jump uses the
        // SURFACE_* defaults; a rocket swaps in a longer, taller arc and restores these
        // on landing. Everything downstream (jumpT advance rate, the chain-fountain lift
        // baked into stepHistory, jumpLiftOf) reads these rather than the constants, so a
        // rocket is "a jump with different numbers" instead of a parallel code path.
        jumpSpan: SURFACE_JUMP_TILE_SPAN,
        jumpHeight: SURFACE_JUMP_HEIGHT,

        // ── Boost ──────────────────────────────────────────────────────────────
        boostActiveT: 0,
        boostCooldownT: 0,

        // ── Special power-ups (rocket / magnet) ────────────────────────────────
        specials: [],             // hovering rocket/magnet + elemental orbs on the board
        specialTimer: SPECIAL_SPAWN_INTERVAL,
        elementalSpawnTimer: ELEMENTAL_SPAWN_INTERVAL, // own clock for the elemental offering
        specialSeq: 0,            // monotonic id source for spawned specials
        specialPicker: makeSpecialPicker(),
        rocketActive: false,      // protected three-second overdrive
        rocketT: 0,
        magnetT: 0,               // seconds of magnet reach remaining
        magnetMaxT: 0,            // duration of the active magnet, for the HUD's fill
        elementalType: null,      // active elemental wash ('water'|'fire'|'grass'|'ice'|null)
        elementalT: 0,            // seconds of elemental wash remaining
        elementalMaxT: 0,         // duration of the active wash, for the HUD's fill
        elementalFocusT: 0,       // seconds remaining of the claim camera beat (pull out to the overview)
        // The tile the wash was claimed on, {x,y,z,dirKey}. Render-only: the cube
        // skin sweeps the element outward from here across the six faces instead of
        // having it appear everywhere at once. Nothing in the simulation reads it.
        elementalOrigin: null,
        landingGraceT: 0,         // post-rocket window where a landing can't kill
        // Injected RNG — every random draw in the special system goes through this so
        // tests can make spawn type and placement deterministic. Set once at
        // construction and deliberately NOT touched by resetWormSim, so a test's
        // override survives a run reset.
        rand: Math.random,

        // ── Tunnels / wormholes ────────────────────────────────────────────────
        tunnelProgress: 0,
        activeTunnel: null,
        pendingTunnelTrigger: null,
        onFlippedTile: false,
        lastFlipped: false,
        wormholeTimer: DEFAULT_WORMHOLE_FLIP_INTERVAL,
        wormholeCountdown: DEFAULT_WORMHOLE_FLIP_INTERVAL,
        tunnelUseCounts: new Map(),
        voidTunnelKeys: new Set(),
        pendingVoidKill: null,
        currentTunnelStableKey: null, // stable key of the tunnel being traversed
        currentTunnelKey: null,       // canonical key (for use-count cleanup on heal)
        pendingTunnelHeal: null,      // resolved only after the tail clears the exit
        windoutTailCleared: false,    // holds one rendered frame at full emergence before heal FX
        ringHealedTunnelKeys: new Set(), // suppress repeat fires while the healed lookup retires

        // ── Collision ──────────────────────────────────────────────────────────
        pendingSelfCollision: null,
        selfCollisionGraceSteps: 0,

        // ── Body / trails ──────────────────────────────────────────────────────
        tailLength: BASE_TAIL_LENGTH,
        powerups: [],
        stepHistory: makeStepHistory(MAX_TAIL * STEPS_PER_TILE),
        tileTrail: makeTileTrail(MAX_TAIL),
        // Render-only full-route history for the persistent worm trail.
        pathHistory: makeTileTrail(TRAIL_HISTORY_CAP),
        orbPickupColors: [],
        orbPickupFaceIds: [],
        colorEpoch: 0,

        // ── Session counters ───────────────────────────────────────────────────
        timeAlive: 0,
        survivalTick: 0,
        healed: 0,
        // Orb-pickup combo: consecutive pickups within 2 s escalate pitch + haptic.
        orbCombo: 0,
        lastOrbTime: -999,

        // ── One-shot flags consumed by renderers ──────────────────────────────
        willHeal: false,
        healFired: false,
        pendingHealBurst: null,
        healPauseT: 0,            // seconds the crawl is frozen to show a ring-heal pop
        healFocusTile: null,      // the surrounded tile the camera pushes in on during that pause
        cutFocusT: 0,             // seconds remaining of the "WORM'D" body-cut camera beat
        cutFocusPos: null,        // world-space impact point the camera swings out to watch
        pendingOrbFlash: null,
        pendingSpecialFlash: null,
        // Queue of magnet attraction visuals awaiting a renderer; drained each frame.
        pendingOrbAttractions: [],
        attractionSeq: 0,
    };
    sim.curWorldPos = sim._curWP;
    return sim;
}

const setCurWorldPosFromTile = (sim, size) => {
    const wp = getStickerWorldPos(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, size, 0);
    sim._curWP.set(wp[0], wp[1], wp[2]);
    sim.curWorldPos = sim._curWP;
};

/**
 * Full run reset (retry / new setup / size change). Spawns the initial powerups
 * into sim.powerups; the caller publishes them to the store.
 */
export function resetWormSim(sim, size, { orbCount, wormholeInterval }) {
    const startPos = INITIAL_POS(size);
    const initial = [];
    for (let i = 0; i < orbCount; i++) {
        initial.push({ ...randomFreeTile(size, [...initial, startPos]), type: 'apple' });
    }

    sim.pos = startPos;
    sim.moveDir = INITIAL_DIR;
    sim.phase = 'crawling';
    sim.prevPhase = 'crawling';
    sim.tunnelProgress = 0;
    sim.activeTunnel = null;
    sim.stepAcc = 0;
    sim.pendingTurns = [];
    sim.lastTurnDir = null;
    sim.tilesSinceTurn = 1;
    sim.boostActiveT = 0;
    sim.boostCooldownT = 0;
    sim.prevStepSec = null;
    sim.onFlippedTile = false;
    sim.lastFlipped = false;
    sim.prevDirKey = null;
    sim.prevTile = null;
    sim.restReadSlice = null;
    sim.restReadTileKeys.clear();
    sim.crossingCorner = false;
    sim.interpT = 1;
    sim.prevWorldPos = null;
    setCurWorldPosFromTile(sim, size);
    sim.headInterpPos.copy(sim.curWorldPos);
    sim.currentNormal.copy(FACE_NORMALS[startPos.dirKey] ?? FACE_NORMALS.PZ);
    sim.isJumping = false;
    sim.jumpT = 0;
    sim.jumpCount = 0;
    sim.jumpSpan = SURFACE_JUMP_TILE_SPAN;
    sim.jumpHeight = SURFACE_JUMP_HEIGHT;
    sim.specials = [];
    sim.specialTimer = SPECIAL_SPAWN_INTERVAL;
    sim.elementalSpawnTimer = ELEMENTAL_SPAWN_INTERVAL;
    sim.specialPicker = makeSpecialPicker();
    sim.rocketActive = false;
    sim.rocketT = 0;
    sim.magnetT = 0;
    sim.magnetMaxT = 0;
    sim.elementalType = null;
    sim.elementalT = 0;
    sim.elementalMaxT = 0;
    sim.elementalFocusT = 0;
    sim.elementalOrigin = null;
    sim.landingGraceT = 0;
    sim.pendingTunnelTrigger = null;
    sim.pendingSelfCollision = null;
    sim.selfCollisionGraceSteps = 0;
    sim.tailLength = BASE_TAIL_LENGTH;
    sim.orbPickupColors = [];
    sim.orbPickupFaceIds = [];
    sim.colorEpoch++;
    shReset(sim.stepHistory);
    sim.lastRecordedT = 0;
    sim.healed = 0;
    sim.tunnelUseCounts = new Map();
    sim.voidTunnelKeys = new Set();
    sim.pendingVoidKill = null;
    sim.currentTunnelStableKey = null;
    sim.currentTunnelKey = null;
    sim.pendingTunnelHeal = null;
    sim.windoutTailCleared = false;
    sim.ringHealedTunnelKeys.clear();
    sim.willHeal = false;
    sim.healFired = false;
    sim.pendingHealBurst = null;
    sim.healPauseT = 0;
    sim.healFocusTile = null;
    sim.cutFocusT = 0;
    sim.cutFocusPos = null;
    sim.pendingOrbFlash = null;
    sim.pendingSpecialFlash = null;
    sim.pendingOrbAttractions = [];
    sim.orbCombo = 0;
    sim.lastOrbTime = -999;

    sim.powerups = initial;
    sim.alive = true;
    ttReset(sim.tileTrail, tileKey(startPos));
    ttReset(sim.pathHistory, tileKey(startPos));
    sim.timeAlive = 0;
    sim.survivalTick = 0;
    sim.wormholeTimer = wormholeInterval;
    sim.wormholeCountdown = wormholeInterval;
    return sim;
}

/** Jump offset height at current jumpT. */
export const jumpLiftOf = (sim) => sim.isJumping
    ? Math.sin(sim.jumpT * Math.PI) * sim.jumpHeight
    : 0;

export function startJump(sim, ctx) {
    // A rocket flight owns the arc until it lands — a mid-flight jump press would
    // reset jumpT and cut the launch short.
    if (sim.rocketActive) return;
    if (sim.jumpCount >= MAX_JUMPS) return;
    sim.isJumping = true;
    sim.jumpT = 0.001;
    sim.jumpCount += 1;
    sim.jumpSpan = SURFACE_JUMP_TILE_SPAN;
    sim.jumpHeight = SURFACE_JUMP_HEIGHT;
    ctx.feel('jump');
    // If the player jumps early on a flipped tile, don't auto-enter the tunnel.
    sim.pendingTunnelTrigger = null;
}

/** Start or refresh the grounded, protected rocket overdrive. */
export function startRocket(sim, ctx) {
    if (sim.rocketActive) {
        sim.rocketT = ROCKET_DURATION;
        ctx.feel('rocket');
        return;
    }
    sim.rocketActive = true;
    sim.rocketT = ROCKET_DURATION;
    sim.pendingTunnelTrigger = null;
    sim.pendingSelfCollision = null;
    ctx.feel('rocket');
    ctx.onRocketState(true);
}

/**
 * Start — or refresh — the magnet's widened pickup reach. A second magnet resets the
 * window to full rather than stacking duration, and republishes so the HUD's fill
 * rescales to the new maximum immediately.
 */
export function startMagnet(sim, ctx) {
    sim.magnetT = MAGNET_DURATION;
    sim.magnetMaxT = MAGNET_DURATION;
    ctx.feel('magnet');
    ctx.onMagnetState(MAGNET_DURATION, MAGNET_DURATION);
}

/**
 * Start — or replace — an elemental wash. Unlike the buffs this grants no
 * mechanical advantage; it hands the renderer an element to bathe the cube in
 * for ELEMENTAL_DURATION seconds. Claiming a second element simply swaps the
 * active one, so the cube never shows two elements at once.
 */
export function startElemental(sim, ctx, type) {
    sim.elementalType = type;
    sim.elementalT = ELEMENTAL_DURATION;
    sim.elementalMaxT = ELEMENTAL_DURATION;
    // Where the element enters the world. The orb is claimed by the head, so the
    // head's tile IS the claim point; the skin sweeps outward from it. Snapshotted
    // rather than referenced, since sim.pos keeps moving once the beat ends.
    const { x, y, z, dirKey } = sim.pos;
    sim.elementalOrigin = { x, y, z, dirKey };
    // Kick off the claim camera beat: the wash bathes the WHOLE cube, so the
    // camera pulls out to the opening-overview framing for a moment to show the
    // cube transform, then eases back to the chase (WormChaseCamera reads this).
    sim.elementalFocusT = ELEMENTAL_FOCUS_DURATION;
    ctx.feel('orb');
    ctx.onElementalTheme(type, ELEMENTAL_DURATION);
}

/** Apply a claimed special orb's effect. */
export function activateSpecial(sim, ctx, type) {
    if (type === 'rocket') startRocket(sim, ctx);
    else if (type === 'magnet') startMagnet(sim, ctx);
    else if (isElementalType(type)) startElemental(sim, ctx, type);
}

/** Whether `next` is a 180° reversal of the current heading. */
export const isReversal = (current, next) =>
    turnWorm(turnWorm(current, 'left'), 'left') === next;

export function queueTurn(sim, dir) {
    const q = sim.pendingTurns;
    if (q.length >= 3) q.shift();
    if (q[q.length - 1] !== dir) q.push(dir);
}

export function killWormSim(sim, ctx, details = null) {
    if (!sim.alive) return;
    sim.alive = false;
    sim.phase = 'dead';
    ctx.feel('death');
    ctx.onDeath(details, Math.floor(sim.timeAlive));
}

function beginTunnelTransition(sim, size, ctx, x, y, z, dirKey) {
    const resolved = ctx.resolveTunnel(x, y, z, dirKey);
    if (!resolved) return;

    const { tunnel, tunnelKey } = resolved;

    if (sim.voidTunnelKeys.has(tunnelKey)) {
        killWormSim(sim, ctx, {
            reason: 'voided',
            tunnelKey,
            headTile: tileKey({ x, y, z, dirKey }),
        });
        return;
    }

    const nextTraversals = (sim.tunnelUseCounts.get(tunnelKey) ?? 0) + 1;
    sim.tunnelUseCounts.set(tunnelKey, nextTraversals);
    // Safe/void-arm/collapse thresholds live in economy.js — see classifyTraversal
    // for the "void on the 4th traversal" rule.
    const traversalVerdict = classifyTraversal(nextTraversals);
    if (traversalVerdict === 'void-arm') {
        // The worm completes this tunnel, then collapses when it steps off the
        // exit tile (deferred kill, checked in the crawling phase).
        sim.pendingVoidKill = {
            tunnelKey,
            exitTileKey: tileKey(tunnel.exit),
            armed: false,
        };
    } else if (traversalVerdict === 'collapse') {
        // Past the void traversal the tunnel is fully collapsed and kills on contact.
        sim.voidTunnelKeys.add(tunnelKey);
        sim.pendingVoidKill = null;
        killWormSim(sim, ctx, {
            reason: 'voided',
            tunnelKey,
            headTile: tileKey({ x, y, z, dirKey }),
            traversals: nextTraversals,
        });
        return;
    }

    // ── DEPOSIT ORBS ──────────────────────────────────────────────────────
    const liveCubies = ctx.getCubies();
    const entrySticker = liveCubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
    const entryFaceId = entrySticker?.curr ?? 0;
    const stableKey = getStableKey(x, y, z, dirKey, liveCubies);
    sim.currentTunnelStableKey = stableKey;
    sim.currentTunnelKey = tunnelKey;

    if (stableKey && entryFaceId) {
        const healingProgress = ctx.getHealingProgress() ?? {};
        const progress = healingProgress[stableKey] ?? { deposited: 0, faceId: entryFaceId };
        // Deposit rules (caps + Prism Worm wildcard drain) are pure functions in
        // economy.js; here we only apply the result to the sim + (via ctx) the store.
        const deposit = computeOrbDeposit({
            inventory: ctx.getOrbInventory(),
            deposited: progress.deposited,
            entryFaceId,
            tailLength: sim.tailLength,
            isPrism: ctx.isPrismCharacter(),
        });

        if (deposit) {
            sim.tailLength = deposit.nextTailLength;
            sim.orbPickupColors.length = Math.max(0, sim.orbPickupColors.length - deposit.colorsToDrop);
            sim.orbPickupFaceIds.length = Math.max(0, sim.orbPickupFaceIds.length - deposit.colorsToDrop);
            sim.colorEpoch++;
            ctx.applyDeposit(deposit, stableKey, entryFaceId);
        }
    }
    // ── END DEPOSIT ───────────────────────────────────────────────────────

    // Determine whether this tunnel traversal will heal on exit (for portal ring pop fx).
    const postDepositProgress = ctx.getHealingProgress()?.[stableKey];
    sim.willHeal = isHealReady(postDepositProgress?.deposited);

    sim.activeTunnel = tunnel;
    sim.pendingTunnelTrigger = null;
    sim.pendingSelfCollision = null;
    // Remove the exit portal tile from the trail so the head landing on it after
    // exiting the tunnel doesn't immediately trigger a false self-collision.
    const exitTileKey = tileKey(tunnel.exit);
    ttFilterInPlace(sim.tileTrail, k => k !== exitTileKey);
    sim.tunnelProgress = 0;
    // Start with the wind-up flourish (spiral circle above the entry hole) before the dive.
    sim.phase = 'windup';
    ctx.feel('dive');
    sim.onFlippedTile = false;
    sim.lastFlipped = false;
    ctx.onTunnelEnter(tunnel);
}

function applyOrbPickupGrowth(sim, ctx, color, faceId) {
    sim.tailLength = Math.min(sim.tailLength + ORB_SEGMENT_GROWTH, MAX_TAIL);
    sim.orbPickupColors.push(color);
    sim.orbPickupFaceIds.push(faceId);
    sim.colorEpoch++;
    // PP are NOT awarded on pickup — only banked when the player wins (cube solved).
    // Colour and combo ride along so the HUD can confirm the pickup on screen at the
    // same intensity the pickup sound plays at.
    ctx.onOrbPickup(faceId, orbsCarried(sim.tailLength), color, sim.orbCombo);
}

// Reusable scratch for the magnet's manifold reach — rebuilt in place per check.
const _magnetReach = new Set();

// Attempt to pick up powerups reachable from the given tile (the worm's current cell).
// Shared by the step-commit path and the rotation-commit path — a rest-read landing
// defers pickup until the slice commits, then re-checks here so an orb that rode the
// rotating slice into the cell the worm occupies is still collected on contact.
//
// Normally "reachable" means the tile directly under the head. While the magnet is
// active the reach widens to a MAGNET_RADIUS manifold ring, which wraps around face
// edges — and the pull also plucks hovering orbs off flipped tiles that would
// otherwise need a jump.
function tryPickupPowerupAt(sim, size, ctx, x, y, z, dirKey) {
    if (sim.powerups.length === 0) return;
    const magnetActive = sim.magnetT > 0;
    const reach = magnetActive
        ? collectManifoldRing(x, y, z, dirKey, size, MAGNET_RADIUS, _magnetReach)
        : null;
    const headKey = `${x},${y},${z},${dirKey}`;
    let collectedAny = false;

    for (let puIdx = 0; puIdx < sim.powerups.length; puIdx++) {
        const pickedUp = sim.powerups[puIdx];
        const puKey = `${pickedUp.x},${pickedUp.y},${pickedUp.z},${pickedUp.dirKey}`;
        if (reach ? !reach.has(puKey) : puKey !== headKey) continue;

        // Read fresh cubies rather than any tick-scope snapshot: spawnWormholePair() may
        // have flipped a sticker pair earlier in the same tick, and a rotation commit may
        // have just replaced the cubies array — a stale read would misjudge the hover rule.
        const liveCubies = ctx.getCubies();
        const pickedSticker = getStickerSafe(liveCubies, pickedUp.x, pickedUp.y, pickedUp.z, pickedUp.dirKey);
        // Orbs on flipped tiles hover above the surface — worm must jump to reach them,
        // unless the magnet is dragging them down.
        const tileIsFlipped = !!(pickedSticker && pickedSticker.curr !== pickedSticker.orig);
        if (tileIsFlipped && !sim.isJumping && !magnetActive) continue; // out of reach
        const pickedFaceId = pickedSticker ? pickedSticker.curr : 0;
        const pickedColor = ctx.getOrbColor(pickedFaceId);
        // Combo climbs when pickups come in quick succession (≤2s apart). A magnet
        // sweep collecting several orbs in one step escalates the same way. Updated
        // BEFORE the growth call so the pickup's sound, haptic and screen flash all
        // read the same (new) combo level.
        sim.orbCombo = (sim.timeAlive - sim.lastOrbTime <= 2.0) ? sim.orbCombo + 1 : 0;
        sim.lastOrbTime = sim.timeAlive;
        applyOrbPickupGrowth(sim, ctx, pickedColor, pickedFaceId);
        sim.pendingOrbFlash = { color: pickedColor, pos: sim.curWorldPos.toArray() };
        // An orb collected off the head tile was dragged in by the magnet. Queue the
        // data the renderer needs to draw it streaking to the worm — without this a
        // magnet sweep reads as several orbs blinking out of existence at once. The
        // gameplay reward is already applied above; only the visual is deferred.
        if (puKey !== headKey) {
            if (sim.pendingOrbAttractions.length < MAX_ORB_ATTRACTION_FX) {
                const from = getStickerWorldPos(pickedUp.x, pickedUp.y, pickedUp.z, pickedUp.dirKey, size, 0);
                sim.pendingOrbAttractions.push({
                    id: `att-${sim.attractionSeq++}`,
                    from,
                    to: sim.curWorldPos.toArray(),
                    color: pickedColor,
                    elevated: tileIsFlipped,
                    dirKey: pickedUp.dirKey,
                });
            }
        }
        ctx.feel('orb', { combo: sim.orbCombo });
        sim.powerups[puIdx] = { ...randomFreeTile(size, [...sim.powerups, sim.pos]), type: 'apple' };
        collectedAny = true;
    }

    if (collectedAny) ctx.onPowerupsChanged(sim.powerups.slice());
}

// Reusable scratch for the special-claim reach.
const _specialReach = new Set();
const _specialClaimExclusion = new Set();
const _ringOccupied = new Set();

// Heal a tunnel when the currently visible body simultaneously covers all eight
// cells around either mouth. Occupancy comes from the logical trail, not the
// footprint spring, whose intentional rebound would otherwise count departed tiles.
function tryWormholeRingHeal(sim, size, ctx) {
    const tunnels = ctx.getActiveTunnels?.() ?? [];
    // Prune stale healed keys, but only when there are any — the common case is an
    // empty set, and materialising an active-key Set every crawl step just to iterate
    // an empty prune list was pure allocation churn on mega cubes with many tunnels.
    // Pruning must still happen when the last tunnel was just healed (tunnels empty):
    // an empty active-key set retires every stale key, so its canonical key no longer
    // survives the empty-list frame to block a later tunnel at the same coordinate pair.
    if (sim.ringHealedTunnelKeys.size > 0) {
        const activeKeys = new Set();
        for (const t of tunnels) if (t.tunnelKey) activeKeys.add(t.tunnelKey);
        for (const key of sim.ringHealedTunnelKeys) {
            if (!activeKeys.has(key)) sim.ringHealedTunnelKeys.delete(key);
        }
    }
    if (tunnels.length === 0) return false;
    _ringOccupied.clear();
    const bodyReach = Math.min(MAX_TAIL, sim.tailLength) * BODY_BALL_SPACING;
    // ceil(bodyReach) is the TOTAL number of occupied trail cells and already
    // includes index 0 (the head), matching bodyTrailKeys and self-collision.
    const occupiedCount = Math.min(sim.tileTrail.count, Math.max(1, Math.ceil(bodyReach)));
    for (let i = 0; i < occupiedCount; i++) _ringOccupied.add(ttAt(sim.tileTrail, i));
    const hit = findCoveredWormholeRing(tunnels, _ringOccupied, size);
    if (!hit || (hit.tunnelKey && sim.ringHealedTunnelKeys.has(hit.tunnelKey))) return false;

    const { tunnel, tunnelKey } = hit;
    if (tunnelKey) sim.ringHealedTunnelKeys.add(tunnelKey);
    const cubies = ctx.getCubies();
    const entryStableKey = getStableKey(
        tunnel.entry.x, tunnel.entry.y, tunnel.entry.z, tunnel.entry.dirKey, cubies
    );
    const exitStableKey = getStableKey(
        tunnel.exit.x, tunnel.exit.y, tunnel.exit.z, tunnel.exit.dirKey, cubies
    );
    sim.healFired = true;
    sim.healed += 1;
    // Deposits can be keyed from either traversal direction. Ring healing seals the
    // whole pair, so retire partial progress stored against both stable endpoints.
    ctx.applyHeal(tunnel.entry, tunnel.exit, [entryStableKey, exitStableKey].filter(Boolean), sim.healed);
    sim.pendingHealBurst = { exitTile: tunnel.exit, entryTile: tunnel.entry };
    // Hold the worm still for a beat so the tile visibly pops out and heals — the reward
    // for surrounding it, and the only way it reads on a mega board where the tile is tiny.
    sim.healPauseT = HEAL_PAUSE_DURATION;
    sim.healFocusTile = hit.mouth; // the tile the camera pushes in on during the pause
    spawnSpecial(sim, size, ctx, hit.mouth);
    if (tunnelKey) {
        sim.tunnelUseCounts.delete(tunnelKey);
        sim.voidTunnelKeys.delete(tunnelKey);
        if (sim.pendingVoidKill?.tunnelKey === tunnelKey) sim.pendingVoidKill = null;
    }
    ctx.feel('heal');
    return true;
}

// Claim a special orb reachable from the given tile.
//
// Contact is enough: crawling onto the orb's tile takes it. Being airborne widens
// the claim by SPECIAL_JUMP_REACH, and an active magnet widens it further — both are
// help, not requirements, so a special is never gated behind a second skill check on
// top of steering onto its tile inside its lifetime.
function trySpecialPickupAt(sim, size, ctx, x, y, z, dirKey) {
    if (sim.specials.length === 0) return;
    const radius = Math.max(
        sim.isJumping ? SPECIAL_JUMP_REACH : 0,
        sim.magnetT > 0 ? MAGNET_RADIUS : 0,
    );
    const reach = radius > 0
        ? collectManifoldRing(x, y, z, dirKey, size, radius, _specialReach)
        : null;
    const headKey = `${x},${y},${z},${dirKey}`;
    const idx = sim.specials.findIndex(s => {
        const key = `${s.x},${s.y},${s.z},${s.dirKey}`;
        return reach ? reach.has(key) : key === headKey;
    });
    if (idx === -1) return;
    const [claimed] = sim.specials.splice(idx, 1);
    sim.pendingSpecialFlash = { type: claimed.type, pos: sim.curWorldPos.toArray() };
    // Claiming an element is a choice: grabbing one wipes the rest of the offering
    // off the board until the next spawn cycle. Rocket/magnet are untouched.
    if (isElementalType(claimed.type)) {
        for (let i = sim.specials.length - 1; i >= 0; i--) {
            if (isElementalType(sim.specials[i].type)) sim.specials.splice(i, 1);
        }
        // ...and it buys a quiet spell. On the spawn clock alone the next offering
        // arrived a breath after the wash ended, so there was always an orb on the
        // cube; this puts a real gap between one element and the next.
        sim.elementalSpawnTimer = Math.max(sim.elementalSpawnTimer, ELEMENTAL_CLAIM_COOLDOWN);
    }
    ctx.onSpecialsChanged(sim.specials.slice());
    activateSpecial(sim, ctx, claimed.type);
}

// Tiles the visible body currently occupies — a special dropped onto one of these
// is either unreachable or claimed instantly, neither of which reads as a reward.
function bodyTrailKeys(sim) {
    const occupiedTiles = Math.max(1, Math.ceil((sim.tailLength * BODY_BALL_SPACING) / 1.0));
    const limit = Math.min(occupiedTiles, sim.tileTrail.count);
    const keys = new Set();
    for (let i = 0; i < limit; i++) keys.add(ttAt(sim.tileTrail, i));
    return keys;
}

// Wormhole mouths among the candidates. A flipped surface sticker IS a tunnel
// entrance, so one cubie read per candidate covers both exclusions.
function tunnelMouthKeys(candidates, ctx) {
    const cubies = ctx.getCubies();
    const keys = new Set();
    if (!cubies) return keys;
    for (const { tile } of candidates) {
        const st = cubies?.[tile.x]?.[tile.y]?.[tile.z]?.stickers?.[tile.dirKey];
        if (st && st.curr !== st.orig) keys.add(tileKeyOf(tile));
    }
    return keys;
}

/**
 * Put a special orb on the board, if there is room under the cap.
 *
 * Placement is scored rather than picked at random (see specialSpawn.js): the orb
 * lands two to four steps from the head, ahead of or beside the worm, preferably on
 * the face the camera is already looking at, and never on the body, another pickup
 * or a wormhole mouth.
 *
 * There is deliberately NO far-side fallback. If the neighbourhood has nothing
 * acceptable the spawn is deferred and retried shortly, because an orb placed
 * somewhere arbitrary is one the player never sees before it times out.
 *
 * @returns {boolean} whether an orb was actually placed
 */
function spawnSpecial(sim, size, ctx, nearTile = null) {
    // Only rocket/magnet count toward this cap — the elemental offering is a
    // separate track with its own board presence, so a full offering must not
    // starve the buffs (or vice versa).
    const buffCount = sim.specials.reduce((n, s) => n + (isElementalType(s.type) ? 0 : 1), 0);
    if (buffCount >= SPECIAL_MAX_ON_BOARD) return false;

    const anchor = nearTile ?? sim.pos;
    const radius = nearTile ? SPECIAL_TUNNEL_RADIUS : SPECIAL_SPAWN_RADIUS;
    const candidates = buildSpawnCandidates(anchor, size, radius);
    if (candidates.length === 0) return false;

    const occupiedKeys = new Set(
        [...sim.powerups, ...sim.specials, sim.pos].map(tileKeyOf)
    );
    // An orb inside the worm's live reach would be swallowed on the tick it appears.
    // Heal-ring rewards search around a mouth that may be several cells from the
    // head, so candidate `dist` (measured from anchor) cannot enforce this exclusion.
    // Build the pickup reach from sim.pos independently and merge it into occupancy.
    const claimRadius = Math.max(
        sim.isJumping ? SPECIAL_JUMP_REACH : 0,
        sim.magnetT > 0 ? MAGNET_RADIUS : 0,
    );
    if (claimRadius > 0) {
        collectManifoldRing(
            sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey,
            size, claimRadius, _specialClaimExclusion
        );
        for (const key of _specialClaimExclusion) occupiedKeys.add(key);
    }

    const tile = pickSpawnTile({
        candidates,
        head: sim.pos,
        moveDir: sim.moveDir,
        size,
        occupiedKeys,
        trailKeys: bodyTrailKeys(sim),
        tunnelKeys: tunnelMouthKeys(candidates, ctx),
        // Live claim reach was excluded above in the head's coordinate frame.
        claimRadius: 0,
    }, sim.rand);
    if (!tile) return false;

    const magnetUseful = countOrbsWithin(sim.powerups, sim.pos, size, MAGNET_RADIUS + 1) > 0;
    const type = drawSpecialType(sim.specialPicker, { magnetUseful, rand: sim.rand });

    // ttl is mutated in place each tick and the published array shares these objects,
    // so the renderer can read a live countdown for its despawn fade without the sim
    // writing to the store every frame.
    const orb = {
        x: tile.x, y: tile.y, z: tile.z, dirKey: tile.dirKey,
        type,
        ttl: SPECIAL_LIFETIME,
        maxTtl: SPECIAL_LIFETIME,
        id: `sp-${sim.specialSeq++}`,
    };
    sim.specials.push(orb);
    sim.specialTimer = SPECIAL_SPAWN_INTERVAL;
    ctx.onSpecialsChanged(sim.specials.slice());
    ctx.onSpecialSpawned(type);
    ctx.feel('specialSpawn');
    return true;
}

// The six manifold faces, each pinned to its outer layer. `fixed` names the axis
// held at the layer, `a`/`b` the two axes that vary across the face.
const ELEMENTAL_FACES = [
    { dirKey: 'PX', fixed: 'x', outer: true, a: 'y', b: 'z' },
    { dirKey: 'NX', fixed: 'x', outer: false, a: 'y', b: 'z' },
    { dirKey: 'PY', fixed: 'y', outer: true, a: 'x', b: 'z' },
    { dirKey: 'NY', fixed: 'y', outer: false, a: 'x', b: 'z' },
    { dirKey: 'PZ', fixed: 'z', outer: true, a: 'x', b: 'y' },
    { dirKey: 'NZ', fixed: 'z', outer: false, a: 'x', b: 'y' },
];

/**
 * The centre tile of one manifold face. Exact for odd cubes; on an even cube any
 * of the four middle tiles is equally central, and this picks one of them
 * consistently.
 *
 * @param {{dirKey:string, fixed:string, outer:boolean, a:string, b:string}} face
 * @param {number} size
 * @returns {{x:number,y:number,z:number,dirKey:string}}
 */
export function faceCenterTile(face, size) {
    const c = Math.floor(size / 2);
    const tile = { x: 0, y: 0, z: 0, dirKey: face.dirKey };
    tile[face.fixed] = face.outer ? size - 1 : 0;
    tile[face.a] = c;
    tile[face.b] = c;
    return tile;
}

/** Every face's centre tile, in face order. */
export function faceCenterTiles(size) {
    return ELEMENTAL_FACES.map((f) => faceCenterTile(f, size));
}

/**
 * Put an elemental OFFERING on the board: one orb of each element, each on the
 * CENTRE tile of a different manifold face. The player crawls to the one they
 * want; the rest are wiped on that claim (see trySpecialPickupAt), or fade on
 * their own before the next offering.
 *
 * Face centres rather than the scored neighbourhood placement spawnSpecial uses:
 * an element re-skins the whole cube, so it should be a landmark you navigate to
 * on a face you can name, not another gem that happens to appear next to you. One
 * per face keeps the offered elements spread across the manifold, and only
 * ELEMENTAL_OFFER_COUNT of them are drawn each cycle so most faces stay empty.
 *
 * Leftovers from a previous offering are cleared first, so the board never carries
 * two offerings at once. Faces whose centre is taken (a parity orb, a live buff,
 * the worm's own body or its live claim reach) are skipped, so an offering can be
 * short if the board is busy.
 *
 * @returns {number} how many elemental orbs were actually placed
 */
function spawnElementalOffering(sim, size, ctx) {
    let changed = false;
    // Clear any un-taken elemental orbs from the last cycle (buffs stay).
    for (let i = sim.specials.length - 1; i >= 0; i--) {
        if (isElementalType(sim.specials[i].type)) { sim.specials.splice(i, 1); changed = true; }
    }

    const occupiedKeys = new Set(
        [...sim.powerups, ...sim.specials, sim.pos].map(tileKeyOf)
    );
    // Exclude the worm's live claim reach so an orb isn't swallowed on the tick it
    // appears (same reasoning as spawnSpecial).
    const claimRadius = Math.max(
        sim.isJumping ? SPECIAL_JUMP_REACH : 0,
        sim.magnetT > 0 ? MAGNET_RADIUS : 0,
    );
    if (claimRadius > 0) {
        collectManifoldRing(
            sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey,
            size, claimRadius, _specialClaimExclusion
        );
        for (const key of _specialClaimExclusion) occupiedKeys.add(key);
    }
    for (const key of bodyTrailKeys(sim)) occupiedKeys.add(key);
    // A face centre that is currently a wormhole mouth is not a place to leave an
    // offering — the worm falls in rather than picking it up.
    const centers = ELEMENTAL_FACES.map((f) => ({ tile: faceCenterTile(f, size) }));
    for (const key of tunnelMouthKeys(centers, ctx)) occupiedKeys.add(key);

    // Shuffle the faces so the same element does not always land on the same face.
    const faces = ELEMENTAL_FACES.slice();
    for (let i = faces.length - 1; i > 0; i--) {
        const j = Math.floor(sim.rand() * (i + 1));
        [faces[i], faces[j]] = [faces[j], faces[i]];
    }

    // Draw the elements on offer, rather than laying out the whole set every time:
    // a menu of every element on every cycle is not a choice, and one orb per face
    // meant there was always one wherever the worm happened to be. Same shuffle,
    // truncated — so the draw is uniform and never repeats a type within a cycle.
    const offered = ELEMENTAL_TYPES.slice();
    for (let i = offered.length - 1; i > 0; i--) {
        const j = Math.floor(sim.rand() * (i + 1));
        [offered[i], offered[j]] = [offered[j], offered[i]];
    }
    offered.length = Math.min(offered.length, Math.max(1, ELEMENTAL_OFFER_COUNT));

    let placed = 0;
    let faceIdx = 0;
    for (const type of offered) {
        // Walk on to the next face until one has a free centre — one orb per face.
        let tile = null;
        while (faceIdx < faces.length) {
            const candidate = faceCenterTile(faces[faceIdx++], size);
            if (!occupiedKeys.has(tileKeyOf(candidate))) { tile = candidate; break; }
        }
        if (!tile) break; // no faces left — offer what fits
        occupiedKeys.add(tileKeyOf(tile));
        sim.specials.push({
            x: tile.x, y: tile.y, z: tile.z, dirKey: tile.dirKey,
            type,
            ttl: ELEMENTAL_LIFETIME,
            maxTtl: ELEMENTAL_LIFETIME,
            id: `el-${sim.specialSeq++}`,
        });
        placed++;
        changed = true;
    }

    if (changed) ctx.onSpecialsChanged(sim.specials.slice());
    if (placed > 0) {
        ctx.feel('specialSpawn');
        sim.elementalSpawnTimer = ELEMENTAL_SPAWN_INTERVAL;
    } else {
        // Nowhere acceptable right now — retry shortly rather than skip a full cycle.
        sim.elementalSpawnTimer = SPECIAL_SPAWN_RETRY;
    }
    return placed;
}

// Writes the interpolated ground position into outPos (module-level scratch or a
// sim-owned vector). Returns the surface normal — a direct reference to a
// FACE_NORMALS constant in the straight-crawl case (no allocation), or the shared
// corner-blend scratch for the rare corner-lerp midpoint.
/**
 * How far off the old face the corner-crossing pivot sits. The head travels out to
 * this vertex and back down onto the new face, so a step around a cube edge is
 * CORNER_STEP_LENGTH of world travel rather than one tile's worth — WormBody needs
 * that to turn the sim's progress through a step into world distance.
 */
export const CORNER_VERTEX_LIFT = 0.52;
export const CORNER_STEP_LENGTH = 2 * CORNER_VERTEX_LIFT;

function evaluatePosAndNormal(sim, tValue, outPos) {
    const pWorld = sim.prevWorldPos;
    const cWorld = sim.curWorldPos;
    outPos.copy(cWorld);
    let cNorm = FACE_NORMALS[sim.pos.dirKey] ?? FACE_NORMALS.PZ;

    if (pWorld && tValue < 1) {
        if (sim.crossingCorner) {
            const oldNormal = FACE_NORMALS[sim.prevDirKey];
            const newNormal = FACE_NORMALS[sim.pos.dirKey];
            _evalCornerVtx.copy(pWorld).addScaledVector(newNormal, CORNER_VERTEX_LIFT);

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
}

// ─── Phase handlers ───────────────────────────────────────────────────────────
// Same dispatch structure as the pre-extraction hook: enter() fires exactly once
// per transition, update() runs every tick; update returning true ends the tick.

const PHASE_HANDLERS = {
    crawling: {
        // enter() fires once when transitioning back from 'exiting'/'windout'.
        enter(sim, _size, ctx) {
            sim.selfCollisionGraceSteps = SELF_COLLISION_GRACE_STEPS_AFTER_TUNNEL;
            // Clear the pre-tunnel tile trail. The body traveled through the tunnel so those
            // old surface positions no longer reliably reflect where body segments are.
            // Resetting to just the exit tile lets the collision window rebuild naturally,
            // preventing false-positive self-collision deaths in the post-tunnel window.
            // The grace period covers the initial steps where the trail is too short to
            // reliably catch real collisions.
            ttReset(sim.tileTrail, tileKey(sim.pos));
            // Möbius travel teleports the worm to a new surface region, so the painted
            // route restarts here too (cross-tunnel persistence is a separate follow-up).
            ttReset(sim.pathHistory, tileKey(sim.pos));
            ctx.onCrawlResume();
            sim.onFlippedTile = false;
            sim.lastFlipped = false;
        },
        update(sim, size, ctx, delta, STEP_SEC) {
            const headOnSurface = isSurfaceTilePos(sim.pos, size);
            if (!headOnSurface) {
                sim.pendingSelfCollision = null;
                sim.pendingTunnelTrigger = null;
            }

            // A hazard turn can begin after this traversal's destination was chosen.
            // Re-evaluate the live crossing every tick so stepping from static ground
            // onto a slice at (for example) 60% rotation reads the cell where it will
            // land, rather than attaching the head to the outgoing cubie and teleporting
            // there. The step-boundary check below remains necessary for turns already
            // active when a new traversal begins.
            const previousRestRead = sim.restReadSlice;
            sim.restReadSlice = nextRestReadDuringStep(
                previousRestRead, liveRotation.active, liveRotation.axis, liveRotation.sliceIndex,
                sim.interpT, sim.prevTile, sim.pos
            );
            if (sim.restReadSlice && sim.restReadSlice !== previousRestRead) {
                sim.restReadTileKeys.add(tileKey(sim.pos));
                // Some samples from this same traversal may have been recorded before
                // the rotation began. Re-tag just those recent samples as rest-space;
                // otherwise the body (though not the head) still gets baked toward the
                // outgoing tile when the turn commits.
                const samplesInStep = Math.min(
                    sim.stepHistory.count,
                    Math.ceil(sim.lastRecordedT * STEPS_PER_TILE) + 1
                );
                for (let i = 0; i < samplesInStep; i++) {
                    const sample = shAt(sim.stepHistory, i);
                    if (sample.tx >= 0 && isTileInSlice(
                        sim.restReadSlice.axis, sim.restReadSlice.sliceIndex,
                        sample.tx, sample.ty, sample.tz
                    )) {
                        sample.tx = sample.ty = sample.tz = -1;
                    }
                }
            } else if (!sim.restReadSlice) {
                sim.restReadTileKeys.clear();
            }

            // Apply pending turn — RELATIVE to current heading
            if (sim.pendingTurns.length > 0) {
                const t = sim.pendingTurns[0]; // peek — a held turn stays queued
                // Two same-direction turns are a 180 relative to the original heading: fine
                // as a staircase if the worm moved a tile between them, but an instant kill
                // (straight back into the neck) if both land before it has moved. The input
                // is identical, so don't drop the second — HOLD it until the next tile, so a
                // fast right-right becomes the L-turn the player meant instead of a self-kill
                // or a skipped layer.
                // 'turnLeft' / 'turnRight' are the touch tray's steering: always a
                // quarter turn from the current heading, whichever control mode is
                // set. The tray has two buttons and no way to name an absolute
                // direction, so it cannot use 'left'/'right' — in oriented mode
                // those are compass points, and a player on that mode would have
                // been left unable to steer up or down at all.
                const relativeTurn = t === 'turnLeft' ? 'left' : t === 'turnRight' ? 'right' : null;
                const holdReversal = (relativeTurn || ((t === 'left' || t === 'right') && ctx.getControlMode() !== 'oriented'))
                    && (relativeTurn ?? t) === sim.lastTurnDir
                    && sim.tilesSinceTurn < 1;
                if (!holdReversal) {
                    sim.pendingTurns.shift();
                    if (t === 'boost') {
                        // Ignore if already boosting or recharging.
                        if (sim.boostActiveT <= 0 && sim.boostCooldownT <= 0) {
                            sim.boostActiveT = BOOST_DURATION;
                            ctx.onBoostState('active');
                            ctx.feel('boost');
                        }
                    } else if (t === 'jump') {
                        startJump(sim, ctx);
                    } else if (relativeTurn) {
                        sim.moveDir = turnWorm(sim.moveDir, relativeTurn);
                        sim.lastTurnDir = relativeTurn;
                        sim.tilesSinceTurn = 0;
                    } else if (ctx.getControlMode() === 'oriented') {
                        // Steering stays live during a rocket — the flight is aimable, which
                        // is most of what makes it a tool rather than a firework. A reversal
                        // is refused mid-flight though: the worm would fly back down its own
                        // launch path, which reads as a bug even though being airborne makes
                        // it survivable.
                        if (t === 'up' || t === 'down' || t === 'left' || t === 'right') {
                            if (!(sim.rocketActive && isReversal(sim.moveDir, t))) sim.moveDir = t;
                        }
                    } else {
                        if (t === 'left' || t === 'right') {
                            sim.moveDir = turnWorm(sim.moveDir, t);
                            sim.lastTurnDir = t;
                            sim.tilesSinceTurn = 0;
                        }
                        // 'down' is a 180 in relative steering — same reversal rule.
                        if (t === 'down' && !sim.rocketActive) {
                            sim.moveDir = turnWorm(turnWorm(sim.moveDir, 'left'), 'left');
                        }
                    }
                }
            }

            // Advance interpolation
            if (sim.interpT < 1) {
                sim.interpT = Math.min(1, sim.interpT + delta / STEP_SEC);
            }

            if (sim.pendingVoidKill?.armed) {
                const { tunnelKey, exitTileKey } = sim.pendingVoidKill;
                const headTileKey = tileKey(sim.pos);
                const hasClearedExitTile = headTileKey !== exitTileKey;
                const fullyOnNextTile = sim.interpT >= 1;

                if (headOnSurface && hasClearedExitTile && fullyOnNextTile) {
                    sim.pendingVoidKill = null;
                    sim.voidTunnelKeys.add(tunnelKey);
                    killWormSim(sim, ctx, { reason: 'voided', tunnelKey, exitTileKey, headTile: headTileKey });
                    return true;
                }
            }

            if (headOnSurface && sim.pendingTunnelTrigger) {
                const { x, y, z, dirKey } = sim.pendingTunnelTrigger;
                // Landing grace also holds off an instant wormhole dive: a rocket that
                // happens to touch down on a mouth shouldn't swallow the player before
                // they can react to where they landed.
                if (sim.rocketActive || sim.landingGraceT > 0) {
                    sim.pendingTunnelTrigger = null;
                } else if (sim.interpT >= TUNNEL_TRIGGER_PROGRESS && !sim.isJumping) {
                    beginTunnelTransition(sim, size, ctx, x, y, z, dirKey);
                    return true;
                }
            }

            if (headOnSurface && sim.pendingSelfCollision) {
                if (sim.selfCollisionGraceSteps > 0) {
                    sim.pendingSelfCollision = null;
                } else if (sim.rocketActive || sim.landingGraceT > 0) {
                    // Protected buffs and post-jump grace both suppress a pending hit.
                    sim.pendingSelfCollision = null;
                } else if (sim.isJumping) {
                    // Allow jumping over your own body tile before impact threshold.
                    sim.pendingSelfCollision = null;
                } else if (sim.pendingTunnelTrigger) {
                    // Prioritize wormhole entry over self-collision on the same tile.
                    // This fixes the bug where entering a wormhole whose entrance is occupied
                    // by your tail (almost always true for the first few tiles of a jump)
                    // kills you.
                    sim.pendingSelfCollision = null;
                } else if (sim.interpT >= SELF_COLLISION_TRIGGER_PROGRESS) {
                    // Re-validate against the LIVE trail before confirming the kill. A
                    // slice-rotation hazard can call cutWormTail() between the frame that
                    // armed pendingSelfCollision and this confirmation frame, severing the
                    // exact body segment that caused the original detection — without this
                    // check that stale flag still fires a kill even though the colliding
                    // tail tile no longer exists ("false tail bite" after a cut).
                    const collisionKey = sim.pendingSelfCollision.key;
                    const occupiedTilesNow = Math.max(1, Math.ceil((sim.tailLength * BODY_BALL_SPACING) / 1.0));
                    const trailLimitNow = Math.min(occupiedTilesNow, sim.tileTrail.count);
                    let stillPresent = false;
                    for (let ti = 1; ti < trailLimitNow; ti++) {
                        if (ttAt(sim.tileTrail, ti) === collisionKey) { stillPresent = true; break; }
                    }
                    if (!stillPresent) {
                        sim.pendingSelfCollision = null;
                    } else {
                        killWormSim(sim, ctx, {
                            reason: 'self-collision',
                            progress: Number(sim.interpT.toFixed(2)),
                            headTile: tileKey(sim.pos),
                            collisionTile: collisionKey,
                        });
                        return true;
                    }
                }
            }

            // --- Continuous path recording for contiguous touching clones ---
            // Write head position directly into the live vectors — zero allocations.
            const headNorm = evaluatePosAndNormal(sim, sim.interpT, sim.headInterpPos);
            sim.currentNormal.copy(headNorm);

            // Back-fill step history so it is completely framerate independent.
            // If the game lags and skips 0.3 seconds, this perfectly reconstructs the 15
            // missing physics frames along the true 3D edge curve.
            while (sim.lastRecordedT <= sim.interpT) {
                // _evalHPos is module scratch; ptNorm is a FACE_NORMALS ref (no alloc)
                // except at the corner midpoint.
                const ptNorm = evaluatePosAndNormal(sim, sim.lastRecordedT, _evalHPos);

                // Chain-fountain: each history entry records the jump height that was active
                // at THAT spatial position. Since jumpT and interpT advance at identical
                // rates (both scale by delta/STEP_SEC), the jumpT at any recorded position r
                // is: jumpT_now - (interpT_now - r). Clamping to [0,1] naturally zeroes out
                // positions before the jump started or after it ended. Body segments then
                // inherit the arc as they travel through this stored lift — exactly like
                // beads lifting off one-by-one in a chain fountain.
                // jumpT advances at (delta/STEP_SEC)/jumpSpan while interpT advances at
                // delta/STEP_SEC, so the lookback is scaled by the span — a 1-tile jump
                // behaves exactly as before, and a 5-tile rocket stretches one arc across
                // the whole flight instead of repeating it per tile.
                const jumpTAtR = sim.isJumping
                    ? Math.max(0, Math.min(1, sim.jumpT - (sim.interpT - sim.lastRecordedT) / sim.jumpSpan))
                    : 0;
                const ptJump = jumpTAtR > 0 ? Math.sin(jumpTAtR * Math.PI) * sim.jumpHeight : 0;
                // Compute lifted pos into module-level scratch, then copy into the ring slot.
                _evalLiftedPos.copy(_evalHPos).addScaledVector(ptNorm, WORM_LIFT + ptJump);
                // Tag the point with the grid cell it occupies, derived from the pre-lift
                // surface point (origin-centred coords → nearest lattice index). Used to ride
                // a mid-rotation slice and to bake the turn into history at commit.
                const _hk = (size - 1) / 2;
                const _htx = Math.min(size - 1, Math.max(0, Math.round(_evalHPos.x + _hk)));
                const _hty = Math.min(size - 1, Math.max(0, Math.round(_evalHPos.y + _hk)));
                const _htz = Math.min(size - 1, Math.max(0, Math.round(_evalHPos.z + _hk)));
                // Points recorded while rest-reading a mid-rotation slice already sit at
                // their committed positions — the -1 sentinel opts them out of the body
                // ride/bake, which would otherwise swing them along with the outgoing slice.
                const _rrs = sim.restReadSlice;
                if (_rrs && isTileInSlice(_rrs.axis, _rrs.sliceIndex, _htx, _hty, _htz)) {
                    shPush(sim.stepHistory, _evalLiftedPos, ptNorm, -1, -1, -1);
                } else {
                    shPush(sim.stepHistory, _evalLiftedPos, ptNorm, _htx, _hty, _htz);
                }
                sim.lastRecordedT += 0.02; // 50 mathematical sub-steps per tile traverse
            }
            // -----------------------------------------------------------

            sim.stepAcc += delta;
            // When navigating a corner, traversing double the distance means we should
            // theoretically give it more time so the speed looks constant, but the Bezier
            // arc covers it nicely.
            if (sim.stepAcc >= STEP_SEC) {
                sim.stepAcc -= STEP_SEC;
                sim.interpT = 0;
                sim.lastRecordedT = 0;
                sim._prevWP.copy(sim._curWP);
                sim.prevWorldPos = sim._prevWP;
                sim.prevDirKey = sim.pos.dirKey;
                // Snapshot the tile we're leaving as the interpolation source so a
                // mid-step slice rotation can ride/commit it correctly.
                sim.prevTile = { x: sim.pos.x, y: sim.pos.y, z: sim.pos.z, dirKey: sim.pos.dirKey };

                const oldDirKey = sim.pos.dirKey;
                const next = getNextSurfacePosition(sim.pos, sim.moveDir, size);

                // We clear the corner navigation flag unless we're about to cross one right now
                sim.crossingCorner = false;

                if (next) {
                    const crossedFace = next.dirKey !== oldDirKey;
                    const nextPos = { x: next.x, y: next.y, z: next.z, dirKey: next.dirKey };
                    const nextKey = tileKey(nextPos);
                    // End-of-rotation read: a step crossing onto a mid-rotation slice
                    // targets the cell's committed state instead of chasing the tile
                    // that is currently rotating away.
                    sim.restReadSlice = nextRestRead(
                        sim.restReadSlice, liveRotation.active, liveRotation.axis, liveRotation.sliceIndex,
                        sim.prevTile, nextPos
                    );
                    if (!sim.restReadSlice) sim.restReadTileKeys.clear();
                    // tailLength is measured in visual balls, not tiles. Convert to
                    // approximate occupied tile count so collision checks align with what
                    // players see.
                    const occupiedTiles = Math.max(1, Math.ceil((sim.tailLength * BODY_BALL_SPACING) / 1.0));
                    const bodyTilesBehindHead = Math.max(0, occupiedTiles - 1);
                    // Direct indexed scan over tileTrail avoids allocating an intermediate
                    // slice just for Array.includes(). bodyTilesBehindHead ≤ ~167 at MAX_TAIL.
                    const trailLimit = Math.min(1 + bodyTilesBehindHead, sim.tileTrail.count);
                    let bodyHit = false;
                    for (let ti = 1; ti < trailLimit; ti++) {
                        if (ttAt(sim.tileTrail, ti) === nextKey) { bodyHit = true; break; }
                    }
                    const nextOnSurface = isSurfaceTilePos(nextPos, size);
                    const selfHit = nextOnSurface && !sim.rocketActive && sim.selfCollisionGraceSteps <= 0 && bodyHit;
                    if (selfHit) {
                        // Defer self-hit until we've penetrated the tile by 40%.
                        // This gives players a short reaction window to jump over their body.
                        sim.pendingSelfCollision = { key: nextKey };
                    }

                    sim.pos = nextPos;
                    if (nextOnSurface) {
                        sim.tilesSinceTurn++;
                        ttPush(sim.tileTrail, nextKey);
                        ttPush(sim.pathHistory, nextKey);
                        const _rr = sim.restReadSlice;
                        if (_rr && isTileInSlice(_rr.axis, _rr.sliceIndex, nextPos.x, nextPos.y, nextPos.z)) {
                            sim.restReadTileKeys.add(nextKey);
                        }
                        // A rest-read destination is already expressed in committed
                        // coordinates, but the cube/tunnel lookup is still pre-commit.
                        // Mixing those frames can heal the outgoing (wrong) tunnel.
                        // applyRotationToSim re-runs this check after the turn commits.
                        if (!(_rr && isTileInSlice(
                            _rr.axis, _rr.sliceIndex, nextPos.x, nextPos.y, nextPos.z
                        ))) {
                            tryWormholeRingHeal(sim, size, ctx);
                        }
                    }
                    if (next.moveDir) sim.moveDir = next.moveDir;

                    if (crossedFace) {
                        sim.crossingCorner = true;
                    }

                    sim.pendingTunnelTrigger = null;
                    if (!selfHit) {
                        sim.pendingSelfCollision = null;
                    }
                    if (sim.selfCollisionGraceSteps > 0) {
                        sim.selfCollisionGraceSteps -= 1;
                    }
                } else {
                    sim.moveDir = turnWorm(turnWorm(sim.moveDir, 'left'), 'left');
                    sim.pendingTunnelTrigger = null;
                    sim.pendingSelfCollision = null;
                }

                // Immediately update curWorldPos so the interpolation target is correct
                setCurWorldPosFromTile(sim, size);

                // Powerup collision
                const { x, y, z, dirKey } = sim.pos;
                // While rest-reading, this cell's occupant (sticker, orb, tunnel mouth) is
                // still mid-flight — what actually lands here is only knowable at commit,
                // so pickup and flipped-tile detection are deferred. applyRotationToSim
                // re-runs both on the landed contents.
                const destMidRotation = !!(sim.restReadSlice &&
                    isTileInSlice(sim.restReadSlice.axis, sim.restReadSlice.sliceIndex, x, y, z));
                if (!destMidRotation) {
                    tryPickupPowerupAt(sim, size, ctx, x, y, z, dirKey);
                    trySpecialPickupAt(sim, size, ctx, x, y, z, dirKey);
                }

                // Flipped tile detection
                const sticker = destMidRotation ? null : ctx.getCubies()?.[x]?.[y]?.[z]?.stickers?.[dirKey];
                const isFlipped = !!(sticker && sticker.curr !== sticker.orig);
                const resolved = isFlipped ? ctx.resolveTunnel(x, y, z, dirKey) : null;
                const isVoidZone = !!(resolved && sim.voidTunnelKeys.has(resolved.tunnelKey));
                sim.onFlippedTile = isFlipped && !isVoidZone;

                // Flipped tiles are instant wormholes unless the player is currently
                // jumping over them.
                if (sim.onFlippedTile !== sim.lastFlipped) {
                    sim.lastFlipped = sim.onFlippedTile;
                    ctx.onFlippedTile(sim.onFlippedTile);
                }

                if (isFlipped && !sim.rocketActive) {
                    sim.pendingTunnelTrigger = { x, y, z, dirKey };
                    // Swept-entry guard: if the step accumulator remainder indicates the worm
                    // has already spent ≥ TUNNEL_TRIGGER_PROGRESS of this tile's step time on
                    // the flipped tile (possible after a lag spike where delta > STEP_SEC),
                    // fire the tunnel transition immediately. Without this, the deferred
                    // trigger can be cleared by a second step firing in the following frame
                    // before interpT reaches the threshold.
                    if (!sim.isJumping && sim.stepAcc / STEP_SEC >= TUNNEL_TRIGGER_PROGRESS) {
                        sim.pendingTunnelTrigger = null;
                        beginTunnelTransition(sim, size, ctx, x, y, z, dirKey);
                        return true;
                    }
                }
            }
            return false;
        },
    },

    // Wind-up: the worm orbits in a shrinking circle above the entry hole, then is
    // pulled into it — a flourish that plays before the dive. beginTunnelTransition
    // publishes wormPhase:'windup' via ctx.onTunnelEnter, so no enter() here.
    windup: {
        update(sim, size, _ctx, delta) {
            sim.tunnelProgress += delta * (1.5 * TUNNEL_SPEED_SCALE);
            if (sim.activeTunnel) {
                const s = Math.min(1, sim.tunnelProgress); // 0 (far/lifted) → 1 (on hole)
                getWindWorldPosInto(sim.headInterpPos, sim.activeTunnel, 'entry', s, size);
                const entryN = FACE_NORMALS[sim.activeTunnel.entry.dirKey];
                if (entryN) sim.currentNormal.copy(entryN);
            }
            if (sim.tunnelProgress >= 1) {
                sim.tunnelProgress = 0;
                sim.phase = 'entering'; // entering.enter() fires next tick
            }
            return false;
        },
    },

    entering: {
        enter(_sim, _size, ctx) {
            ctx.onPhase('entering');
        },
        update(sim, size, _ctx, delta) {
            sim.tunnelProgress += delta * (1.2 * TUNNEL_SPEED_SCALE);
            if (sim.activeTunnel) {
                // Head travels first third of the tunnel (entry face → cube interior)
                const tunnelT = sim.tunnelProgress * 0.33;
                getTunnelWorldPosSmoothInto(sim.headInterpPos, sim.activeTunnel, tunnelT, size);
                const entryN = FACE_NORMALS[sim.activeTunnel.entry.dirKey];
                if (entryN) sim.currentNormal.copy(entryN);
            }
            if (sim.tunnelProgress >= 1) {
                sim.tunnelProgress = 0;
                sim.phase = 'tunnel';
                // tunnel.enter() fires next tick → ctx.onPhase('tunnel')
            }
            return false;
        },
    },

    tunnel: {
        enter(_sim, _size, ctx) {
            ctx.onPhase('tunnel');
        },
        update(sim, size, _ctx, delta) {
            sim.tunnelProgress += delta * (0.65 * TUNNEL_SPEED_SCALE);
            if (sim.activeTunnel) {
                // Head travels middle third of the tunnel (through cube core)
                const tunnelT = 0.33 + sim.tunnelProgress * 0.34;
                getTunnelWorldPosSmoothInto(sim.headInterpPos, sim.activeTunnel, tunnelT, size);
                // Switch normal to exit face at the midpoint
                const n = sim.tunnelProgress > 0.5
                    ? FACE_NORMALS[sim.activeTunnel.exit.dirKey]
                    : FACE_NORMALS[sim.activeTunnel.entry.dirKey];
                if (n) sim.currentNormal.copy(n);
            }
            if (sim.tunnelProgress >= 1) {
                sim.tunnelProgress = 0;
                sim.phase = 'exiting';
                // exiting.enter() fires next tick → ctx.onPhase + pos snap to exit tile
            }
            return false;
        },
    },

    exiting: {
        enter(sim, size, ctx) {
            ctx.onPhase('exiting');
            // Snap the logical grid position to the exit tile so crawling
            // resumes from the correct sticker when this phase completes.
            if (sim.activeTunnel) {
                const ex = sim.activeTunnel.exit;
                sim.pos = { x: ex.x, y: ex.y, z: ex.z, dirKey: ex.dirKey };
                setCurWorldPosFromTile(sim, size);
            }
        },
        update(sim, size, ctx, delta) {
            sim.tunnelProgress += delta * (1.0 * TUNNEL_SPEED_SCALE);
            if (sim.activeTunnel) {
                // Head travels final third of the tunnel (cube interior → exit face)
                const tunnelT = 0.67 + sim.tunnelProgress * 0.33;
                getTunnelWorldPosSmoothInto(sim.headInterpPos, sim.activeTunnel, tunnelT, size);
                const exitN = FACE_NORMALS[sim.activeTunnel.exit.dirKey];
                if (exitN) sim.currentNormal.copy(exitN);
            }
            if (sim.tunnelProgress >= 1) {
                const voidKillState = sim.pendingVoidKill;
                const exitedTunnel = sim.activeTunnel; // capture (kept alive for windout)
                const exitStableKey = sim.currentTunnelStableKey;
                const exitTunnelKey = sim.currentTunnelKey;
                sim.tunnelProgress = 0;
                sim.currentTunnelStableKey = null;
                sim.currentTunnelKey = null;
                if (voidKillState) {
                    sim.pendingVoidKill = { ...voidKillState, armed: true };
                }

                // Arm the heal now, but leave both flipped tiles and the tunnel intact
                // until windout has streamed the worm's final segment through the exit.
                const exitProgress = exitStableKey ? (ctx.getHealingProgress()?.[exitStableKey]) : null;
                const didHeal = isHealReady(exitProgress?.deposited) && !!exitedTunnel;
                if (didHeal) {
                    sim.pendingTunnelHeal = {
                        tunnel: exitedTunnel,
                        stableKey: exitStableKey,
                        tunnelKey: exitTunnelKey,
                    };
                }
                // else: partial/no deposit — tunnel stays flipped, progress persists

                // One resolution cue per traversal: triumphant chime on a heal, otherwise
                // a plain pop as the worm bursts back out of the exit hole.
                if (!didHeal) ctx.feel('exit');

                // Tunnel travel complete — windout spiral plays before resuming crawl.
                // sim.activeTunnel stays alive so windout can animate the exit spiral.
                sim.phase = 'windout';
            }
            return false;
        },
    },

    // Wind-out: mirrors windup — the worm spirals UP from the exit hole and settles on
    // the surface, giving the "riding the Möbius strip back up and out" visual.
    // s runs 1→0: start at exit hole (s=1, env=0), rise to peak orbit (s=0.5, env=1),
    // settle on surface tile (s=0, env=0).
    windout: {
        enter(sim, _size, ctx) {
            ctx.onPhase('windout');
            sim.windoutTailCleared = false;
        },
        update(sim, size, ctx, delta) {
            sim.tunnelProgress += delta * (1.5 * TUNNEL_SPEED_SCALE);
            if (sim.activeTunnel) {
                const s = windoutHeadS(sim.tunnelProgress, sim.tailLength);
                getWindWorldPosInto(sim.headInterpPos, sim.activeTunnel, 'exit', s, size);
                const exitN = FACE_NORMALS[sim.activeTunnel.exit.dirKey];
                if (exitN) sim.currentNormal.copy(exitN);
            }
            if (sim.tunnelProgress >= 1) {
                // Do not close the tunnel on the same simulation tick that brings
                // the tail to the surface. Clamp here for one complete rendered
                // frame so WormBody can draw the very last segment fully out while
                // both endpoint stickers remain flipped. The following tick starts
                // the manual flip + cubie-pop heal animation.
                if (!sim.windoutTailCleared) {
                    sim.tunnelProgress = 1;
                    sim.windoutTailCleared = true;
                    return false;
                }
                const pending = sim.pendingTunnelHeal;
                if (pending) {
                    const { tunnel, stableKey, tunnelKey } = pending;
                    sim.healFired = true;
                    sim.healed += 1;
                    ctx.applyHeal(tunnel.entry, tunnel.exit, stableKey, sim.healed);
                    sim.pendingHealBurst = { exitTile: tunnel.exit, entryTile: tunnel.entry };
                    spawnSpecial(sim, size, ctx, tunnel.exit);
                    if (tunnelKey) {
                        sim.tunnelUseCounts.delete(tunnelKey);
                        sim.voidTunnelKeys.delete(tunnelKey);
                        if (sim.pendingVoidKill?.tunnelKey === tunnelKey) sim.pendingVoidKill = null;
                    }
                    ctx.feel('heal');
                    sim.pendingTunnelHeal = null;
                }
                sim.tunnelProgress = 0;
                sim.windoutTailCleared = false;
                sim.activeTunnel = null;
                sim.phase = 'crawling';
                // crawling.enter() fires next tick → grace steps + crawl-resume publish
            }
            return false;
        },
    },
};

/**
 * Advance the simulation by one frame. Mirrors the pre-extraction tick():
 * clamps the delta, runs boost/wormhole/jump clocks, then dispatches to the
 * active phase handler (firing enter()/exit() exactly once per transition).
 */
export function stepWormSim(sim, delta, size, ctx) {
    if (!sim.alive) return;
    if (ctx.isPaused()) return;

    // Heal pause: freeze the whole crawl for a beat after a ring heal so the tile pops out
    // and heals in view. The pop/particle FX are store- and clock-driven, so they play on
    // through the freeze. Clamp delta first so a hitch can't skip most of the pause.
    if (sim.healPauseT > 0) {
        sim.healPauseT = Math.max(0, sim.healPauseT - Math.min(delta, MAX_TICK_DELTA));
        return;
    }

    // Body-cut freeze: a rotating layer sheared off part of the tail but the worm lived.
    // Freeze the whole crawl for the beat — HealerWormMode freezes the rotation hazard
    // clock in lockstep — so the game stops on a freeze frame while the camera swings out
    // and the severing slice spins into view (the slice rotation is a GSAP tween, so it
    // plays on through the freeze). When the beat expires the worm resumes exactly where
    // it was rather than having crawled off blind while the camera was turned away. Clamp
    // delta first so a hitch can't skip most of the freeze.
    if (sim.cutFocusT > 0) {
        sim.cutFocusT = Math.max(0, sim.cutFocusT - Math.min(delta, MAX_TICK_DELTA));
        if (sim.cutFocusT === 0) sim.cutFocusPos = null;
        return;
    }

    // Elemental-claim freeze: the same treatment as the body-cut beat above.
    // Claiming a wash re-skins the entire cube, and the player could not actually
    // look at it while still crawling — the camera swung out, the worm carried on
    // into whatever was ahead, and the transformation went by unwatched. The whole
    // sim stops for the beat, HealerWormMode holds the rotation hazard in lockstep,
    // and the camera drops to a close first-person shot of the new surface.
    //
    // Returning here also freezes the wash's own clock, so the beat is not taken
    // out of the element's duration — the player gets the full ELEMENTAL_DURATION
    // of crawling afterwards.
    if (sim.elementalFocusT > 0) {
        sim.elementalFocusT = Math.max(0, sim.elementalFocusT - Math.min(delta, MAX_TICK_DELTA));
        return;
    }

    // Clamp the frame delta so a hitch can't advance the simulation by a huge jump.
    // Without this, one long frame inflates interpT and the step accumulator at once,
    // teleporting the head several tiles forward — which in a snake-like mode scatters
    // the body trail and can slam the worm into its own tail unfairly. Every downstream
    // clock in this tick (jump, wormhole spawn, boost, movement) reads this value, so
    // they all pause together through a stall and resume cleanly instead of lurching.
    if (delta > MAX_TICK_DELTA) delta = MAX_TICK_DELTA;

    // ── Speed boost: drain the active window, then run the cooldown, publishing
    // each state transition so the HUD button reflects ready/active/cooldown.
    // Frozen outside the crawling phase — a boost activated right before a wormhole
    // dive shouldn't burn its window (or recharge) during transit, when movement runs
    // at fixed tunnel speed and the buff does nothing.
    if (sim.phase === 'crawling') {
        if (sim.boostActiveT > 0) {
            sim.boostActiveT -= delta;
            if (sim.boostActiveT <= 0) {
                sim.boostActiveT = 0;
                sim.boostCooldownT = BOOST_COOLDOWN;
                ctx.onBoostState('cooldown');
            }
        } else if (sim.boostCooldownT > 0) {
            sim.boostCooldownT -= delta;
            if (sim.boostCooldownT <= 0) {
                sim.boostCooldownT = 0;
                ctx.onBoostState('ready');
            }
        }
    }
    // ── Magnet: drain the reach window. Frozen outside crawling for the same reason
    // boost is — there is nothing to pick up during a wormhole transit, so the buff
    // shouldn't burn while the worm is inside one.
    if (sim.phase === 'crawling' && sim.magnetT > 0) {
        sim.magnetT -= delta;
        if (sim.magnetT <= 0) {
            sim.magnetT = 0;
            sim.magnetMaxT = 0;
            ctx.onMagnetState(0, 0);
        }
    }

    // Elemental wash: drain the mood timer on the same crawling-only clock as the
    // buffs, so a pause or tunnel transit freezes it rather than letting it lapse
    // off-screen. Purely cosmetic — nothing about gameplay reads it.
    if (sim.phase === 'crawling' && sim.elementalT > 0) {
        sim.elementalT -= delta;
        if (sim.elementalT <= 0) {
            sim.elementalT = 0;
            sim.elementalMaxT = 0;
            sim.elementalType = null;
            sim.elementalOrigin = null;
            ctx.onElementalTheme(null, 0);
        }
    }

    // Post-landing protection decays in the same (crawling-only) clock family.
    if (sim.phase === 'crawling' && sim.landingGraceT > 0) {
        sim.landingGraceT = Math.max(0, sim.landingGraceT - delta);
    }
    if (sim.phase === 'crawling' && sim.rocketT > 0) {
        sim.rocketT = Math.max(0, sim.rocketT - delta);
        if (sim.rocketT === 0) {
            sim.rocketActive = false;
            sim.pendingSelfCollision = null;
            sim.pendingTunnelTrigger = null;
            ctx.feel('rocketLand');
            ctx.onRocketState(false);
        }
    }

    const boostMult = sim.boostActiveT > 0 ? BOOST_MULTIPLIER : 1;
    // Rocket is 4× the user's current speed; the normal boost does not stack.
    const speedMult = sim.rocketActive ? ROCKET_SPEED_MULT : boostMult;
    const STEP_SEC = 1.0 / (ctx.getSpeed() * speedMult);

    // If the crawl speed changed since last frame, rescale the in-progress step
    // accumulator so its fraction (== interpT) is preserved across the change. Without
    // this, a speed change mid-step desyncs stepAcc from interpT and force-crosses
    // tiles early, which makes the head jump and the body trail fly around.
    if (sim.prevStepSec && sim.prevStepSec !== STEP_SEC && sim.stepAcc > 0) {
        sim.stepAcc *= STEP_SEC / sim.prevStepSec;
    }
    sim.prevStepSec = STEP_SEC;

    sim.timeAlive += delta;

    // Earn parity points for surviving (1 PP per SURVIVAL_TICK_INTERVAL seconds)
    sim.survivalTick += delta;
    if (sim.survivalTick >= SURVIVAL_TICK_INTERVAL) {
        sim.survivalTick -= SURVIVAL_TICK_INTERVAL;
        ctx.onSurvivalTick();
    }

    // In finalHealing / solved phases no new wormholes spawn — player heals the
    // remaining ones.
    const gamePhaseNow = ctx.getGamePhase();
    const noMoreSpawns = gamePhaseNow === 'finalHealing' || gamePhaseNow === 'solved';
    // Pause wormhole spawning (antipodal tile flips) while the worm is travelling
    // inside a wormhole — freeze the clock so no flips happen until it crawls back out.
    if (sim.phase === 'crawling') {
        sim.wormholeTimer -= delta;
        if (sim.wormholeTimer <= 0) {
            // Hold at the active-pair ceiling: skip the spawn (but still reset the timer)
            // whenever the board is already at its cap, so a fresh pair only appears once
            // the player has healed one back down. This bounds both the difficulty and the
            // per-step heal scan on large boards. The timer resets regardless, so the first
            // interval after a heal refills the slot.
            const atCap = (ctx.getActiveTunnels?.() ?? []).length >= activeTunnelCap(size);
            if (!noMoreSpawns && !atCap) {
                const tile = randomUnflippedTile(ctx.getCubies(), size, [sim.pos]);
                if (tile) ctx.spawnWormholePair(tile);
            }
            sim.wormholeTimer = ctx.getWormholeInterval();
        }
    }
    sim.wormholeCountdown = noMoreSpawns ? 0 : Math.max(0, Math.ceil(sim.wormholeTimer * 10) / 10);

    // ── Special orbs: ambient spawn clock + lifetime ageing. Both run only while
    // crawling, so a special can't appear (or expire unseen) during a tunnel transit.
    if (sim.phase === 'crawling') {
        sim.specialTimer -= delta;
        if (sim.specialTimer <= 0) {
            // spawnSpecial resets the timer on success. A failure means either the
            // board is at its cap or the neighbourhood had no acceptable tile — both
            // are transient, so retry soon rather than skipping a whole interval.
            if (!spawnSpecial(sim, size, ctx)) sim.specialTimer = SPECIAL_SPAWN_RETRY;
        }
        // Elemental offering runs on its own faster clock (spawnElementalOffering
        // resets the timer itself, to the interval on success or a short retry).
        sim.elementalSpawnTimer -= delta;
        if (sim.elementalSpawnTimer <= 0) {
            spawnElementalOffering(sim, size, ctx);
        }
        if (sim.specials.length > 0) {
            let expired = false;
            for (let i = sim.specials.length - 1; i >= 0; i--) {
                sim.specials[i].ttl -= delta;
                if (sim.specials[i].ttl <= 0) {
                    const [gone] = sim.specials.splice(i, 1);
                    expired = true;
                    // Buffs get the "that one got away" notice + cue. An un-taken
                    // elemental offering just fades quietly — firing four expiry
                    // notices and chimes at once would be noise, not information.
                    if (!isElementalType(gone.type)) {
                        ctx.onSpecialExpired(gone.type);
                        ctx.feel('specialExpire');
                    }
                }
            }
            if (expired) ctx.onSpecialsChanged(sim.specials.slice());
        }
    }

    // Always advance jump
    if (sim.isJumping) {
        // Tie jump progress to tile-traverse progress so the speed slider never changes
        // jump distance. Rocket overdrive no longer changes the ordinary jump arc.
        sim.jumpT += (delta / STEP_SEC) / sim.jumpSpan;
        if (sim.jumpT >= 1) {
            sim.jumpT = 0;
            sim.isJumping = false;
            sim.jumpCount = 0;
            sim.jumpSpan = SURFACE_JUMP_TILE_SPAN;
            sim.jumpHeight = SURFACE_JUMP_HEIGHT;
        }
    }

    // ── Dispatch: detect phase transitions, then run the active handler ──────
    const currentPhase = sim.phase;
    if (sim.prevPhase !== currentPhase) {
        PHASE_HANDLERS[sim.prevPhase]?.exit?.(sim, size, ctx);
        PHASE_HANDLERS[currentPhase]?.enter?.(sim, size, ctx);
        sim.prevPhase = currentPhase;
    }
    PHASE_HANDLERS[currentPhase].update(sim, size, ctx, delta, STEP_SEC);
}

/**
 * Apply a committed cube rotation to the sim — the exact logic that previously
 * lived in useWormCrawler's rotationEpoch subscription. Transforms the worm's
 * position/heading, powerups, both trails, the step-history bake, and any
 * in-flight tunnel so everything stays glued to the surface through the turn.
 *
 * @param {object} rot - { axis, dir, sliceIndex } of the committed move
 * @param {object} opts - { inOpeningScramble, paused } snapshot flags
 */
export function applyRotationToSim(sim, size, ctx, rot, { inOpeningScramble, paused }) {
    const { axis, dir, sliceIndex } = rot;

    // Steps taken in rest-read mode did NOT ride this slice: the worm targeted its
    // cells' committed rest positions, so its position, heading, lerp source and the
    // trail entries it laid down stay put at commit instead of being carried 90°.
    const restRead = sim.restReadSlice;
    const restMatches = !!(restRead && restRead.axis === axis && restRead.sliceIndex === sliceIndex);
    sim.restReadSlice = null;
    const restKeys = sim.restReadTileKeys;

    // Rotate powerups
    if (sim.powerups.length) {
        const pu = sim.powerups;
        for (let i = 0; i < pu.length; i++) pu[i] = rotateTilePosition(pu[i], axis, sliceIndex, dir, size);
        ctx.onPowerupsChanged(pu.slice());
    }

    // Rotate special orbs the same way, so a rocket/magnet stays on its tile through
    // the hazard turn (rotateTilePosition carries type/ttl/id across on the copy).
    if (sim.specials.length) {
        const sp = sim.specials;
        for (let i = 0; i < sp.length; i++) sp[i] = rotateTilePosition(sp[i], axis, sliceIndex, dir, size);
        ctx.onSpecialsChanged(sp.slice());
    }

    // Rotate the worm's logical grid position so it stays on its tile.
    // rotateTilePosition returns the SAME object when the tile wasn't in the slice,
    // so `newPos !== oldPos` is an exact "did this tile ride the slice" test.
    const oldPos = sim.pos;
    const newPos = restMatches ? oldPos : rotateTilePosition(oldPos, axis, sliceIndex, dir, size);
    sim.pos = newPos;
    setCurWorldPosFromTile(sim, size);

    // The worm's tile rode the slice: rotate its heading so it keeps the same WORLD
    // direction — "continue in the same direction it was going, but now rotated."
    // Skipped ONLY during the opening scramble, where the pre-game starting heading
    // must stay untouched. This is gated on the game phase, not the pause flag: a user
    // pause also pauses the sim, but a hazard rotation triggered during live play
    // (they are deliberately slow, and the pause button stays available) still has to
    // commit its heading update — otherwise the worm resumes crawling in the wrong
    // direction after unpause because its logical heading was left in the old face frame.
    if (newPos !== oldPos && !inOpeningScramble) {
        sim.moveDir = rotateMoveDir(sim.moveDir, oldPos.dirKey, newPos.dirKey, axis, dir);
    }

    // Keep the interpolation SOURCE glued to the surface: if the worm is mid-step and
    // the tile it is coming FROM also rode the slice, rotate that source tile + world
    // position too. Without this the head lerps from the pre-rotation source and
    // visibly snaps to where the tile used to be at the end of the turn.
    if (sim.prevTile && !restMatches) {
        const rPrev = rotateTilePosition(sim.prevTile, axis, sliceIndex, dir, size);
        if (rPrev !== sim.prevTile) {
            sim.prevTile = rPrev;
            sim.prevDirKey = rPrev.dirKey;
            if (sim.prevWorldPos) {
                const _wp = getStickerWorldPos(rPrev.x, rPrev.y, rPrev.z, rPrev.dirKey, size, 0);
                sim.prevWorldPos.set(_wp[0], _wp[1], _wp[2]);
            }
        }
    }

    // When paused (e.g. during the opening scramble), snap the render position too so
    // the worm lands correctly on its tile after the rotation animation finishes.
    if (paused) {
        sim.headInterpPos.copy(sim.curWorldPos);
    }

    // Rotate the self-collision tile trail AND the render-only path history so the
    // painted route stays glued to the surface through the turn (same remap fn).
    const _remapTileKey = key => {
        // Cells occupied in rest space didn't ride the slice — their keys stay put.
        if (restMatches && restKeys.has(key)) return key;
        parseTileKey(key, _parseTile);
        const r = rotateTilePosition(_parseTile, axis, sliceIndex, dir, size);
        return `${r.x},${r.y},${r.z},${r.dirKey}`;
    };
    ttMapInPlace(sim.tileTrail, _remapTileKey);
    ttMapInPlace(sim.pathHistory, _remapTileKey);
    // Pressure uses the same positional keys as the trail, so its displacement
    // and velocity must ride the slice instead of rebounding in the vacated cell.
    remapWormPress(_remapTileKey);
    restKeys.clear();

    // Deferred pickup + flipped-tile detection for a rest-read landing: the step
    // onto this cell couldn't read its contents (the occupant was mid-flight). Now
    // that the rotation committed, check what actually landed under the worm —
    // including an orb that rode the slice into this cell (sim.powerups was rotated
    // above, so the lookup sees committed coordinates). Void-zone refinement is
    // skipped here — beginTunnelTransition re-resolves the tunnel (and handles
    // void kills) when the trigger actually fires.
    if (restMatches && sim.phase === 'crawling' &&
        isTileInSlice(axis, sliceIndex, sim.pos.x, sim.pos.y, sim.pos.z)) {
        const { x, y, z, dirKey } = sim.pos;
        tryPickupPowerupAt(sim, size, ctx, x, y, z, dirKey);
        trySpecialPickupAt(sim, size, ctx, x, y, z, dirKey);
        const landed = ctx.getCubies()?.[x]?.[y]?.[z]?.stickers?.[dirKey];
        const landedFlipped = !!(landed && landed.curr !== landed.orig);
        sim.onFlippedTile = landedFlipped;
        if (landedFlipped !== sim.lastFlipped) {
            sim.lastFlipped = landedFlipped;
            ctx.onFlippedTile(landedFlipped);
        }
        if (landedFlipped && !sim.rocketActive) sim.pendingTunnelTrigger = { x, y, z, dirKey };
        // The trail and head now share the committed coordinate frame with the
        // refreshed tunnel lookup, so the ring check skipped during traversal is safe.
        tryWormholeRingHeal(sim, size, ctx);
    }

    // Bake the committed turn into the body's position history: rotate the world
    // position, surface normal, and grid tag of every recorded point that sat in the
    // rotated slice. This uses the same predicate (isTileInSlice) and the same signed
    // angle the body ride applied mid-tween, so ridden segments land seamlessly with
    // no snap-back to their pre-rotation positions.
    {
        const sh = sim.stepHistory;
        if (sh.count > 0) {
            const k = (size - 1) / 2;
            const ang = dir * (Math.PI / 2);
            _bakeAxis.set(axis === 'col' ? 1 : 0, axis === 'row' ? 1 : 0, axis === 'depth' ? 1 : 0);
            // Only bake as far back as the visible body can walk — the same reach
            // cap (×2 headroom for corner arcs + 2 spare tiles) WormBody uses for
            // its per-frame path fill. sh.count saturates at capacity (60 000)
            // over a long run regardless of body length, and entries beyond the
            // reach are never rendered or collided against, so rotating them on
            // every hazard turn is pure waste.
            const bakeReach = Math.min(MAX_TAIL, sim.tailLength) * BODY_BALL_SPACING;
            const bakeLimit = Math.min(sh.count, Math.ceil(bakeReach * STEPS_PER_TILE * 2) + STEPS_PER_TILE * 2);
            for (let i = 0; i < bakeLimit; i++) {
                const slot = sh.buf[(sh.head - 1 - i + sh.capacity) % sh.capacity];
                if (slot.tx < 0 || !isTileInSlice(axis, sliceIndex, slot.tx, slot.ty, slot.tz)) continue;
                slot.pos.applyAxisAngle(_bakeAxis, ang);
                slot.normal.applyAxisAngle(_bakeAxis, ang).normalize();
                const [rx, ry, rz] = rotateVec90(slot.tx - k, slot.ty - k, slot.tz - k, axis, dir);
                slot.tx = Math.round(rx + k);
                slot.ty = Math.round(ry + k);
                slot.tz = Math.round(rz + k);
            }
        }
    }

    // If mid-tunnel, rotate active tunnel endpoints so exit snap lands on the correct tile
    const rotateTunnel = (t) => ({
        ...t,
        entry: rotateTilePosition(t.entry, axis, sliceIndex, dir, size),
        exit: rotateTilePosition(t.exit, axis, sliceIndex, dir, size),
    });
    const preRotationTunnel = sim.activeTunnel;
    if (sim.activeTunnel) sim.activeTunnel = rotateTunnel(sim.activeTunnel);

    // ── Deferred work still holding tile coordinates ───────────────────────────
    // These outlive the phase that created them, so a hazard turn can land between
    // the decision and the act. They were the one set of tile references NOT
    // carried through a rotation, and the heal is the expensive one to get wrong:
    // it is applied by grid position, so a stale entry/exit pair resets two
    // bystander tiles to unflipped instead of the pair actually traversed. The
    // traversed pair stays flipped, and a bystander that was itself half of another
    // wormhole gets orphaned from its partner — after which the two ends' flip
    // counters drift apart, and the orphan can be picked for new wormholes over and
    // over until it hits the flip cap and turns into a permanently dead tile.
    //
    // pendingTunnelHeal normally holds the very object activeTunnel does (it is
    // captured from it at the end of 'exiting' and consumed at the end of
    // 'windout'), so re-point it rather than rotating the same coordinates twice.
    if (sim.pendingTunnelHeal?.tunnel) {
        sim.pendingTunnelHeal = {
            ...sim.pendingTunnelHeal,
            tunnel: sim.pendingTunnelHeal.tunnel === preRotationTunnel
                ? sim.activeTunnel
                : rotateTunnel(sim.pendingTunnelHeal.tunnel),
        };
    }

    // The armed void kill compares the head's CURRENT tile against the exit tile it
    // must step off before collapsing. Left un-rotated, the comparison is against a
    // slot the exit no longer occupies, so the collapse fires a step early or late.
    if (sim.pendingVoidKill?.exitTileKey) {
        parseTileKey(sim.pendingVoidKill.exitTileKey, _parseTile);
        const rotated = rotateTilePosition(_parseTile, axis, sliceIndex, dir, size);
        if (rotated !== _parseTile) {
            sim.pendingVoidKill = { ...sim.pendingVoidKill, exitTileKey: tileKey(rotated) };
        }
    }
}
