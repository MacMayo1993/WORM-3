import React, { useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getStickerWorldPos, getManifoldGridId } from '../game/coordinates.js';
import { getNextSurfacePosition, getTunnelWorldPosInto, getWindWorldPosInto, turnWorm, getStableKey, isTileInSlice, rotateMoveDir, buildTunnelLookup, updateTunnelLookupIncremental } from './wormLogic.js';
import { flipStickerPair } from '../game/manifoldLogic.js';
import { getManifoldMap } from '../game/manifoldMapStore.js';
import { healSticker, getStickerSafe } from '../game/cubeState.js';
import { rotateVec90 } from '../game/cubeRotation.js';
import { DIR_TO_VEC, VEC_TO_DIR, FACE_COLORS } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { healBurstMap } from '../3d/styles/TileStyleMaterials.jsx';
import { activateSticker } from '../3d/StickerAnimationManager.js';
import { EARN_ORB_COLLECT, EARN_WORM_SURVIVAL_TICK, EARN_WORM_HEALED_FACE, SURVIVAL_TICK_INTERVAL } from '../utils/economyConstants.js';
import { vibrate } from '../utils/audio.js';
import {
    WORM_LIFT,
    TUNNEL_SPEED_SCALE,
    FACE_NORMALS,
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
    BOOST_MULTIPLIER,
    BOOST_DURATION,
    BOOST_COOLDOWN,
    MAX_TICK_DELTA,
    TRAIL_HISTORY_CAP,
} from './healerWorm/constants.js';
import {
    isSurfaceTilePos,
    randomFreeTile,
    randomUnflippedTile,
} from './healerWorm/surfaceTiles.js';
import { makeStepHistory, shPush, shReset, makeTileTrail, ttPush, ttAt, ttReset, ttMapInPlace, ttFilterInPlace } from './circularBuffers.js';
import { rotateTilePosition, parseTileKey, _parseTile, ensureOrbContrast } from './wormHelpers.js';

// Axis scratch for baking a committed turn into the worm's position history.
const _bakeAxis = new THREE.Vector3();
const _tunnelDirScratch = new THREE.Vector3();

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


export function useWormCrawler(size, cubies) {
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

    // Drives the shared manifold-map owner; advances only on geometry changes (rotations).
    const rotationEpoch = useGameStore((s) => s.rotationEpoch);

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
    // Speed-boost timers (seconds): one counts down the active boost, the other its cooldown.
    const boostActiveT = useRef(0);
    const boostCooldownT = useRef(0);
    // Tracks the previous frame's STEP_SEC so stepAcc can be rescaled when the crawl speed
    // changes mid-step (boost toggling, or the speed slider) — keeps stepAcc/STEP_SEC (which
    // equals interpT) consistent so a speed change never force-crosses a tile early and
    // scatters the body trail.
    const prevStepSecRef = useRef(null);
    const onFlippedTile = useRef(false);
    const lastFlippedRef = useRef(false);
    const prevDirKey = useRef(null);
    // The grid tile the head is interpolating FROM (the lerp source). Tracked explicitly so a
    // mid-step rotation can rotate this source in lockstep with the slice — otherwise the head
    // would lerp from the tile's pre-rotation world position and snap when the turn commits.
    const prevTile = useRef(null);
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
    // Render-only full-route history for the persistent worm trail. Kept separate from
    // tileTrail (which gameplay trims on cuts and scans for self-collision) so the painted
    // route can extend far beyond the visible body without affecting gameplay.
    const pathHistory = useRef(makeTileTrail(TRAIL_HISTORY_CAP));
    const deathMenuTimer = useRef(null);
    const phaseHandlersRef = useRef(null);
    const tunnelUseCountsRef = useRef(new Map());
    const voidTunnelKeysRef = useRef(new Set());
    const pendingVoidKillRef = useRef(null);
    const currentTunnelStableKeyRef = useRef(null); // stable key of the tunnel being traversed
    const currentTunnelKeyRef = useRef(null); // canonical position key of the tunnel being traversed (for use-count cleanup on heal)
    const pendingHealBurstRef = useRef(null);  // set when a heal fires; consumed by HeartBurstSystem
    const pendingOrbFlashRef = useRef(null);   // set when glow worm picks up orb; consumed by OrbFlashSystem
    // O(1) tunnel endpoint lookup — kept exact (not debounced) because the crawler resolves it
    // every step. This effect reruns on every cubies change, which is ~12×/sec at chaos L4.
    const tunnelLookupRef = useRef(new Map());
    // Tracks the inputs of the last lookup build so the effect can do a cheap incremental update
    // (only the cubies that actually changed) on a flip, falling back to a full rebuild only on
    // first run, a size change, or a rotation (which advances rotationEpoch and rebuilds the
    // shared manifold map). A flip swaps both antipodal endpoint cubie objects together at a
    // fixed geometry, so the incremental pass stays exact — see updateTunnelLookupIncremental.
    const tunnelLookupCacheRef = useRef({ prevCubies: null, prevEpoch: null, size: null });
    React.useEffect(() => {
        const manifoldMap = getManifoldMap(cubies, size, rotationEpoch);
        const cache = tunnelLookupCacheRef.current;
        const canIncrement = cache.prevCubies && cache.size === size && cache.prevEpoch === rotationEpoch;
        if (canIncrement) {
            updateTunnelLookupIncremental(tunnelLookupRef.current, cubies, cache.prevCubies, size, manifoldMap);
        } else {
            tunnelLookupRef.current = buildTunnelLookup(cubies, size, manifoldMap);
        }
        cache.prevCubies = cubies;
        cache.prevEpoch = rotationEpoch;
        cache.size = size;
    }, [cubies, size, rotationEpoch]);

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
        // The first WORMHOLE_MAX_TRAVERSALS passes through a tunnel are safe. The
        // next one is the "void" traversal: the worm completes the tunnel, then
        // collapses when it steps off the exit tile (deferred kill, checked in the
        // crawling phase). With the default of 3 safe traversals this is the
        // documented "void on the 4th" behavior.
        if (nextTraversals === WORMHOLE_MAX_TRAVERSALS + 1) {
            pendingVoidKillRef.current = {
                tunnelKey,
                exitTileKey: tileKey(tunnel.exit),
                armed: false,
            };
        }
        if (nextTraversals > WORMHOLE_MAX_TRAVERSALS + 1) {
            // Past the void traversal the tunnel is fully collapsed and kills on contact.
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
        currentTunnelKeyRef.current = tunnelKey;

        if (stableKey && entryFaceId) {
            const depositState = useGameStore.getState();
            const healingProgress = depositState.wormHealingProgress ?? {};
            const progress = healingProgress[stableKey] ?? { deposited: 0, faceId: entryFaceId };
            const segmentsOnWorm = tailLength.current - BASE_TAIL_LENGTH;
            const inv = depositState.wormOrbInventory ?? {};
            // Prism Worm — "Spectrum" wildcard: orbs of ANY face color pay toward any
            // tunnel, so it draws from the whole inventory instead of only the matching face.
            const isPrism = (depositState.wormCharacter ?? 'classic') === 'prism';
            const available = isPrism
                ? Object.values(inv).reduce((sum, v) => sum + (v || 0), 0)
                : (inv[entryFaceId] ?? 0);
            const n = Math.min(available, HEAL_COST - progress.deposited, segmentsOnWorm);

            if (n > 0) {
                tailLength.current = Math.max(BASE_TAIL_LENGTH, tailLength.current - n);
                orbPickupColorsRef.current.length = Math.max(0, orbPickupColorsRef.current.length - Math.round(n / ORB_SEGMENT_GROWTH));
                colorEpochRef.current++;
                const orbsLeft = Math.max(0, Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));

                // Deduct n orbs. Non-prism pulls from the matching face; prism drains the
                // matching face first, then spills into the remaining faces (wildcard pay).
                let nextInv;
                if (isPrism) {
                    nextInv = { ...inv };
                    let remaining = n;
                    const drainOrder = [entryFaceId, ...Object.keys(nextInv).map(Number).filter(f => f !== entryFaceId)];
                    for (const f of drainOrder) {
                        if (remaining <= 0) break;
                        const have = nextInv[f] ?? 0;
                        const take = Math.min(have, remaining);
                        nextInv[f] = have - take;
                        remaining -= take;
                    }
                } else {
                    nextInv = { ...inv, [entryFaceId]: (inv[entryFaceId] ?? 0) - n };
                }

                useGameStore.setState({
                    wormBodyTiles: orbsLeft,
                    wormOrbInventory: nextInv,
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
        // Start with the wind-up flourish (spiral circle above the entry hole) before the dive.
        phase.current = 'windup';
        onFlippedTile.current = false;
        lastFlippedRef.current = false;
        const prevState = useGameStore.getState();
        prevVisualModeRef.current = prevState.visualMode;
        prevShowTunnelsRef.current = prevState.showTunnels ?? false;
        const nextTunnelCount = (prevState.wormTunnelCount ?? 0) + 1;
        const fc = resolveColors(prevState.settings, prevState.settings?.biomeMode?.faceAssignment) || FACE_COLORS;
        useGameStore.setState({
            wormPhase: 'windup',
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
    // Bumped whenever orbPickupColorsRef's contents change, so WormBody can skip
    // re-writing the instanced color buffer on frames where nothing changed.
    const colorEpochRef = useRef(0);

    const applyOrbPickupGrowth = (color, faceId) => {
        tailLength.current = Math.min(tailLength.current + ORB_SEGMENT_GROWTH, MAX_TAIL);
        orbPickupColorsRef.current.push(color);
        colorEpochRef.current++;
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
            const mm = getManifoldMap(state.cubies, size, state.rotationEpoch);
            return {
                cubies: flipStickerPair(state.cubies, size, tile.x, tile.y, tile.z, tile.dirKey, mm)
            };
        });
    };

    // ── Per-frame simulation ──────────────────────────────────────────────────
    const tick = useCallback((delta) => {
        if (!alive.current) return;
        if (wormPausedRef.current) return;

        // Clamp the frame delta so a hitch can't advance the simulation by a huge jump. Without
        // this, one long frame inflates interpT and the step accumulator at once, teleporting the
        // head several tiles forward — which in a snake-like mode scatters the body trail and can
        // slam the worm into its own tail unfairly. Every downstream clock in this tick (jump,
        // wormhole spawn, boost, movement) reads this value, so they all pause together through a
        // stall and resume cleanly instead of lurching.
        if (delta > MAX_TICK_DELTA) delta = MAX_TICK_DELTA;

        // ── Speed boost: drain the active window, then run the cooldown, publishing
        // each state transition to the store so the HUD button reflects ready/active/cooldown.
        // Frozen outside the crawling phase — a boost activated right before a wormhole dive
        // shouldn't burn its window (or recharge) during transit, when movement runs at fixed
        // tunnel speed and the buff does nothing.
        if (phase.current === 'crawling') {
            if (boostActiveT.current > 0) {
                boostActiveT.current -= delta;
                if (boostActiveT.current <= 0) {
                    boostActiveT.current = 0;
                    boostCooldownT.current = BOOST_COOLDOWN;
                    useGameStore.getState().setWormBoostState('cooldown');
                }
            } else if (boostCooldownT.current > 0) {
                boostCooldownT.current -= delta;
                if (boostCooldownT.current <= 0) {
                    boostCooldownT.current = 0;
                    useGameStore.getState().setWormBoostState('ready');
                }
            }
        }
        const boostMult = boostActiveT.current > 0 ? BOOST_MULTIPLIER : 1;
        const STEP_SEC = 1.0 / (wormSpeedRef.current * boostMult);

        // If the crawl speed changed since last frame, rescale the in-progress step accumulator
        // so its fraction (== interpT) is preserved across the change. Without this, a speed
        // change mid-step desyncs stepAcc from interpT and force-crosses tiles early, which
        // makes the head jump and the body trail fly around.
        if (prevStepSecRef.current && prevStepSecRef.current !== STEP_SEC && stepAcc.current > 0) {
            stepAcc.current *= STEP_SEC / prevStepSecRef.current;
        }
        prevStepSecRef.current = STEP_SEC;

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
        // Pause wormhole spawning (antipodal tile flips) while the worm is travelling inside a
        // wormhole — freeze the clock so no flips happen until it crawls back out.
        if (phase.current === 'crawling') {
            wormholeTimer.current -= delta;
            if (wormholeTimer.current <= 0) {
                if (!noMoreSpawns) spawnWormholePair();
                wormholeTimer.current = wormholeIntervalRef.current;
            }
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
        // Built once per size change and cached — avoids re-creating ~12 function
        // objects on every frame. Handlers close over stable refs and imported
        // functions; the three `st.*` call-sites were replaced with getState()
        // so the cached closures never hold a stale store snapshot.
        if (!phaseHandlersRef.current || phaseHandlersRef._size !== size) {
        phaseHandlersRef._size = size;
        phaseHandlersRef.current = {
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
                    // Möbius travel teleports the worm to a new surface region, so the painted
                    // route restarts here too (cross-tunnel persistence is a separate follow-up).
                    ttReset(pathHistory.current, tileKey(pos.current));
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
                        if (t === 'boost') {
                            // Ignore if already boosting or recharging.
                            if (boostActiveT.current <= 0 && boostCooldownT.current <= 0) {
                                boostActiveT.current = BOOST_DURATION;
                                useGameStore.getState().setWormBoostState('active');
                                vibrate(18);
                            }
                        } else if (t === 'jump') {
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
                            // Re-validate against the LIVE trail before confirming the kill. A slice-rotation
                            // hazard can call cutWormTail() between the frame that armed pendingSelfCollision
                            // and this confirmation frame, severing the exact body segment that caused the
                            // original detection — without this check that stale flag still fires a kill even
                            // though the colliding tail tile no longer exists ("false tail bite" after a cut).
                            const collisionKey = pendingSelfCollision.current.key;
                            const occupiedTilesNow = Math.max(1, Math.ceil((tailLength.current * BODY_BALL_SPACING) / 1.0));
                            const trailLimitNow = Math.min(occupiedTilesNow, tileTrail.current.count);
                            let stillPresent = false;
                            for (let ti = 1; ti < trailLimitNow; ti++) {
                                if (ttAt(tileTrail.current, ti) === collisionKey) { stillPresent = true; break; }
                            }
                            if (!stillPresent) {
                                pendingSelfCollision.current = null;
                            } else {
                                killWorm({
                                    reason: 'self-collision',
                                    progress: Number(interpT.current.toFixed(2)),
                                    headTile: tileKey(pos.current),
                                    collisionTile: collisionKey,
                                });
                                return true;
                            }
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
                        // Tag the point with the grid cell it occupies, derived from the pre-lift
                        // surface point (origin-centred coords → nearest lattice index). Used to ride
                        // a mid-rotation slice and to bake the turn into history at commit.
                        const _hk = (size - 1) / 2;
                        const _htx = Math.min(size - 1, Math.max(0, Math.round(_evalHPos.x + _hk)));
                        const _hty = Math.min(size - 1, Math.max(0, Math.round(_evalHPos.y + _hk)));
                        const _htz = Math.min(size - 1, Math.max(0, Math.round(_evalHPos.z + _hk)));
                        shPush(stepHistory.current, _evalLiftedPos, ptNorm, _htx, _hty, _htz);
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
                        // Snapshot the tile we're leaving as the interpolation source so a
                        // mid-step slice rotation can ride/commit it correctly.
                        prevTile.current = { x: pos.current.x, y: pos.current.y, z: pos.current.z, dirKey: pos.current.dirKey };

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
                                ttPush(pathHistory.current, nextKey);
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
                            // Re-read fresh state rather than the `st` snapshot captured at the top of
                            // this tick: spawnWormholePair() may have flipped a sticker pair earlier in
                            // this same tick (line ~638), and `st.cubies` would still point at the
                            // pre-spawn snapshot — causing a just-elevated orb tile to be misread as
                            // unflipped and allow a ground pickup instead of requiring a jump.
                            const liveCubies = useGameStore.getState().cubies;
                            const pickedSticker = getStickerSafe(liveCubies, pickedUp.x, pickedUp.y, pickedUp.z, pickedUp.dirKey);
                            // Orbs on flipped tiles hover above the surface — worm must jump to reach them
                            const tileIsFlipped = !!(pickedSticker && pickedSticker.curr !== pickedSticker.orig);
                            if (tileIsFlipped && !isJumping.current) {
                                // Worm crawled onto the tile but didn't jump — orb is out of reach
                            } else {
                                const pickedFaceId = pickedSticker ? pickedSticker.curr : 0;
                                const liveColors = resolveColors(useGameStore.getState().settings);
                                const pickedColor = ensureOrbContrast((pickedFaceId && liveColors[pickedFaceId]) ?? '#22ff88');
                                applyOrbPickupGrowth(pickedColor, pickedFaceId);
                                pendingOrbFlashRef.current = { color: pickedColor, pos: curWorldPos.current.toArray() };
                                const newPowerup = { ...randomFreeTile(size, [...powerupsRef.current, pos.current]), type: 'apple' };
                                powerupsRef.current[puIdx] = newPowerup;
                                useGameStore.getState().setWormPowerups(powerupsRef.current.slice());
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
                            useGameStore.getState().setWormOnFlippedTile(onFlippedTile.current);
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

            // Wind-up: the worm orbits in a shrinking circle above the entry hole, then is
            // pulled into it — a flourish that plays before the dive. beginTunnelTransition sets
            // wormPhase:'windup' directly, so no enter() here (avoids a double set).
            windup: {
                update(delta) {
                    tunnelProgress.current += delta * (1.5 * TUNNEL_SPEED_SCALE);
                    if (activeTunnel.current) {
                        const s = Math.min(1, tunnelProgress.current); // 0 (far/lifted) → 1 (on hole)
                        getWindWorldPosInto(headInterpPos.current, activeTunnel.current, 'entry', s, size);
                        const entryN = FACE_NORMALS[activeTunnel.current.entry.dirKey];
                        if (entryN) currentNormal.current.copy(entryN);
                    }
                    if (tunnelProgress.current >= 1) {
                        tunnelProgress.current = 0;
                        phase.current = 'entering'; // entering.enter() fires next tick
                    }
                    return false;
                },
            },

            entering: {
                enter() {
                    useGameStore.getState().setWormPhase('entering');
                },
                update(delta) {
                    tunnelProgress.current += delta * (1.2 * TUNNEL_SPEED_SCALE);
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
                    tunnelProgress.current += delta * (1.0 * TUNNEL_SPEED_SCALE);
                    if (activeTunnel.current) {
                        // Head travels final third of the tunnel (cube interior → exit face)
                        const tunnelT = 0.67 + tunnelProgress.current * 0.33;
                        getTunnelWorldPosInto(headInterpPos.current, activeTunnel.current, tunnelT, size);
                        const exitN = FACE_NORMALS[activeTunnel.current.exit.dirKey];
                        if (exitN) currentNormal.current.copy(exitN);
                    }
                    if (tunnelProgress.current >= 1) {
                        const voidKillState = pendingVoidKillRef.current;
                        const exitedTunnel = activeTunnel.current; // capture (kept alive for windout)
                        const exitStableKey = currentTunnelStableKeyRef.current;
                        const exitTunnelKey = currentTunnelKeyRef.current;
                        tunnelProgress.current = 0;
                        currentTunnelStableKeyRef.current = null;
                        currentTunnelKeyRef.current = null;
                        if (voidKillState) {
                            pendingVoidKillRef.current = { ...voidKillState, armed: true };
                        }

                        // Heal immediately at exit completion (not deferred) when enough orbs deposited.
                        const exitStore = useGameStore.getState();
                        const exitProgress = exitStableKey ? (exitStore.wormHealingProgress?.[exitStableKey]) : null;
                        if (exitProgress?.deposited >= HEAL_COST && exitedTunnel) {
                            const { entry, exit: exitTile } = exitedTunnel;
                            // Write healBurstMap for both tiles BEFORE healing (sticker orig fields intact)
                            const entrySticker = getStickerSafe(exitStore.cubies, entry.x, entry.y, entry.z, entry.dirKey);
                            const exitStickerData = getStickerSafe(exitStore.cubies, exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey);
                            if (entrySticker) {
                                const entryGridId = getManifoldGridId(entrySticker, size);
                                healBurstMap.set(entryGridId, 1);
                                activateSticker(entryGridId);
                            }
                            if (exitStickerData) {
                                const exitGridId = getManifoldGridId(exitStickerData, size);
                                healBurstMap.set(exitGridId, 1);
                                activateSticker(exitGridId);
                            }
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
                            // Tunnel fully healed → it disappears from the board. Drop its traversal
                            // bookkeeping so a future antipodal flip that lands on the same coordinates
                            // starts fresh, instead of inheriting this tunnel's (possibly critical) use
                            // count or void flag and collapsing the worm prematurely on first re-entry.
                            if (exitTunnelKey) {
                                tunnelUseCountsRef.current.delete(exitTunnelKey);
                                voidTunnelKeysRef.current.delete(exitTunnelKey);
                                // If this heal landed on the void traversal, a void kill was armed
                                // for this same tunnel just above. The tunnel is now healed and gone,
                                // so cancel that pending kill — otherwise the crawling handler still
                                // collapses the worm the moment it leaves the exit tile.
                                if (pendingVoidKillRef.current?.tunnelKey === exitTunnelKey) {
                                    pendingVoidKillRef.current = null;
                                }
                            }
                        }
                        // else: partial/no deposit — tunnel stays flipped, progress persists

                        // Tunnel travel complete — windout spiral plays before resuming crawl.
                        // activeTunnel.current stays alive so windout can animate the exit spiral.
                        phase.current = 'windout';
                    }
                    return false;
                },
            },
            // Wind-out: mirrors windup — the worm spirals UP from the exit hole and settles on
            // the surface, giving the "riding the Möbius strip back up and out" visual.
            // s runs 1→0: start at exit hole (s=1, env=0), rise to peak orbit (s=0.5, env=1),
            // settle on surface tile (s=0, env=0).
            windout: {
                enter() {
                    useGameStore.getState().setWormPhase('windout');
                },
                update(delta) {
                    tunnelProgress.current += delta * (1.5 * TUNNEL_SPEED_SCALE);
                    if (activeTunnel.current) {
                        const s = 1.0 - Math.min(1, tunnelProgress.current);
                        getWindWorldPosInto(headInterpPos.current, activeTunnel.current, 'exit', s, size);
                        const exitN = FACE_NORMALS[activeTunnel.current.exit.dirKey];
                        if (exitN) currentNormal.current.copy(exitN);
                    }
                    if (tunnelProgress.current >= 1) {
                        tunnelProgress.current = 0;
                        activeTunnel.current = null;
                        phase.current = 'crawling';
                        // crawling.enter() fires next tick → grace steps + Zustand crawling reset
                    }
                    return false;
                },
            },
        };
        }
        const PHASE_HANDLERS = phaseHandlersRef.current;

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
        boostActiveT.current = 0;
        boostCooldownT.current = 0;
        prevStepSecRef.current = null;
        useGameStore.getState().setWormBoostState('ready');
        onFlippedTile.current = false;
        lastFlippedRef.current = false;
        prevDirKey.current = null;
        prevTile.current = null;
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
        colorEpochRef.current++;
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
        ttReset(pathHistory.current, tileKey(startPos));
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

                // Rotate the worm's logical grid position so it stays on its tile.
                // rotateTilePosition returns the SAME object when the tile wasn't in the slice,
                // so `newPos !== oldPos` is an exact "did this tile ride the slice" test.
                const oldPos = pos.current;
                const newPos = rotateTilePosition(oldPos, axis, sliceIndex, dir, size);
                pos.current = newPos;
                { const _wp = getStickerWorldPos(newPos.x, newPos.y, newPos.z, newPos.dirKey, size, 0); _curWP.set(_wp[0], _wp[1], _wp[2]); curWorldPos.current = _curWP; }

                // The worm's tile rode the slice: rotate its heading so it keeps the same WORLD
                // direction — "continue in the same direction it was going, but now rotated."
                // Skipped ONLY during the opening scramble, where the pre-game starting heading
                // must stay untouched. This is gated on the game phase, not wormPaused: a user
                // pause also raises wormPaused, but a hazard rotation triggered during live play
                // (they are deliberately slow, and the pause button stays available) still has to
                // commit its heading update — otherwise the worm resumes crawling in the wrong
                // direction after unpause because its logical heading was left in the old face frame.
                const inOpeningScramble = useGameStore.getState().wormGamePhase === 'scrambling';
                if (newPos !== oldPos && !inOpeningScramble) {
                    moveDir.current = rotateMoveDir(moveDir.current, oldPos.dirKey, newPos.dirKey, axis, dir);
                }

                // Keep the interpolation SOURCE glued to the surface: if the worm is mid-step and
                // the tile it is coming FROM also rode the slice, rotate that source tile + world
                // position too. Without this the head lerps from the pre-rotation source and
                // visibly snaps to where the tile used to be at the end of the turn.
                if (prevTile.current) {
                    const rPrev = rotateTilePosition(prevTile.current, axis, sliceIndex, dir, size);
                    if (rPrev !== prevTile.current) {
                        prevTile.current = rPrev;
                        prevDirKey.current = rPrev.dirKey;
                        if (prevWorldPos.current) {
                            const _wp = getStickerWorldPos(rPrev.x, rPrev.y, rPrev.z, rPrev.dirKey, size, 0);
                            prevWorldPos.current.set(_wp[0], _wp[1], _wp[2]);
                        }
                    }
                }

                // When paused (e.g. during opening scramble), snap the render position too so
                // the worm lands correctly on its tile after the rotation animation finishes.
                if (wormPausedRef.current) {
                    headInterpPos.current.copy(curWorldPos.current);
                }

                // Rotate the self-collision tile trail AND the render-only path history so the
                // painted route stays glued to the surface through the turn (same remap fn).
                const _remapTileKey = key => {
                    parseTileKey(key, _parseTile);
                    const r = rotateTilePosition(_parseTile, axis, sliceIndex, dir, size);
                    return `${r.x},${r.y},${r.z},${r.dirKey}`;
                };
                ttMapInPlace(tileTrail.current, _remapTileKey);
                ttMapInPlace(pathHistory.current, _remapTileKey);

                // Bake the committed turn into the body's position history: rotate the world
                // position, surface normal, and grid tag of every recorded point that sat in the
                // rotated slice. This uses the same predicate (isTileInSlice) and the same signed
                // angle the body ride applied mid-tween, so ridden segments land seamlessly with
                // no snap-back to their pre-rotation positions.
                {
                    const sh = stepHistory.current;
                    if (sh.count > 0) {
                        const k = (size - 1) / 2;
                        const ang = dir * (Math.PI / 2);
                        _bakeAxis.set(axis === 'col' ? 1 : 0, axis === 'row' ? 1 : 0, axis === 'depth' ? 1 : 0);
                        for (let i = 0; i < sh.count; i++) {
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
        interpT, prevWorldPos, curWorldPos, prevTile, crossingCorner, jumpT, isJumping, jumpLift,
        headInterpPos, currentNormal,
        tailLength, stepHistory, orbPickupColorsRef, colorEpochRef, tick, queueTurn,
        voidTunnelKeysRef, tunnelUseCountsRef,
        willHealRef, healFiredRef, pendingHealBurstRef, pendingOrbFlashRef,
        tileTrail, pathHistory, killWorm,
        timeAliveRef,
    };
}
