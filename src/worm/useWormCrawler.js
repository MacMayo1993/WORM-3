// src/worm/useWormCrawler.js
//
// React adapter around the pure worm simulation core (healerWorm/wormSim.js).
//
// The sim owns ALL gameplay state in one plain object and is advanced by
// store-free functions; this hook supplies the `ctx` port (store reads, store
// writes, audio/haptics, tunnel lookup), wires the rotation-commit and reset
// lifecycles, and exposes the exact same `{ field: { current } }` API the
// renderers and wormHelpers have always consumed — each field is a live
// getter/setter alias onto the sim object, so consumers are unaffected by the
// extraction. See wormSim.js for the ctx contract.

import { useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getManifoldGridId } from '../game/coordinates.js';
import { buildTunnelLookup, updateTunnelLookupIncremental } from './wormLogic.js';
import { flipStickerPair } from '../game/manifoldLogic.js';
import { getManifoldMap } from '../game/manifoldMapStore.js';
import { healSticker } from '../game/cubeState.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { FACE_COLORS } from '../utils/constants.js';
import { EARN_WORM_SURVIVAL_TICK, EARN_WORM_HEALED_FACE } from '../utils/economyConstants.js';
import { pruneExpiredFx } from '../utils/transientFx.js';
import { activateSticker } from '../3d/StickerAnimationManager.js';
import { feel } from '../utils/feel.js';
import {
    ORB_SEGMENT_GROWTH,
    DEFAULT_POWERUP_COUNT,
    DEFAULT_WORMHOLE_FLIP_INTERVAL,
} from './healerWorm/constants.js';
import {
    makeWormSim,
    resetWormSim,
    stepWormSim,
    applyRotationToSim,
    killWormSim,
    queueTurn as queueTurnSim,
    jumpLiftOf,
} from './healerWorm/wormSim.js';
import { getOrbColor, parseTileKey, _parseTile } from './wormHelpers.js';
import { wormClock } from './wormClock.js';
import { wormBuffs, resetWormBuffs } from './wormBuffs.js';
import { ttAt } from './circularBuffers.js';
import { getSkin } from './wormCosmeticsData.js';
import { wormPress, pressTile, tickWormPress, resetWormPress, pressedTileCount } from './tilePressBridge.js';
import { BODY_BALL_SPACING } from './healerWorm/constants.js';

// ── Tile press: the worm's weight, handed to the cube's stickers ──────────────
// The body lies along the tiles in sim.tileTrail (index 0 = the head's tile), and
// covers as many of them as its length reaches — the same span the self-collision
// check walks. Each covered tile is pressed, hardest under the head, so the dent
// tapers off down the body instead of every tile carrying the full weight.
//
// Gentle on purpose. At 0.55 the tail end sank to less than half depth, and since
// the tile's light is gated on contact it left a line of touched tiles visibly
// lighting to different degrees — the worm looked like it was pressing some tiles
// and merely brushing others. The taper is now enough to feel the weight fall off
// toward the tail, and not enough to split the lit path into strong and weak
// halves.
const PRESS_TAIL_FALLOFF = 0.22; // tail-end tiles press at (1 − this) of the head's

// Cached so the skin's colour is only looked up when the player actually changes it.
let _pressSkinId = null;

function publishTilePress(sim, size, ctx, delta) {
    // Only while the worm is out on the surface: mid-traversal it is inside the
    // cube, and the tiles it *was* on should be springing back, not held down.
    if (sim.alive && sim.phase === 'crawling') {
        const skinId = useGameStore.getState().wormSkin ?? 'slime';
        if (skinId !== _pressSkinId) {
            _pressSkinId = skinId;
            wormPress.color = getSkin(skinId).body;
        }

        const cubies = ctx.getCubies();
        const covered = pressedTileCount(sim.tailLength * BODY_BALL_SPACING, sim.tileTrail.count);
        const span = covered > 1 ? covered - 1 : 1;
        for (let i = 0; i < covered; i++) {
            const key = ttAt(sim.tileTrail, i);
            if (!key) continue;
            parseTileKey(key, _parseTile);
            const sticker = cubies?.[_parseTile.x]?.[_parseTile.y]?.[_parseTile.z]?.stickers?.[_parseTile.dirKey];
            if (!sticker) continue;
            const gridId = getManifoldGridId(sticker, size);
            // Pressure follows the occupied grid cell—the same canonical key the
            // body trail and StickerPlane use. The manifold ID is still the right
            // key for the animation registry because it identifies that sticker's
            // mounted tick callback.
            pressTile(key, 1 - PRESS_TAIL_FALLOFF * (i / span));
            // The sticker's own per-frame tick is opt-in (StickerAnimationManager),
            // so a tile has to be woken before it can sink. It puts itself back to
            // sleep once it has finished rebounding.
            activateSticker(gridId);
        }
    }

    // Runs even when the worm is not on the surface — that is exactly when the
    // tiles it just left need to be springing back.
    tickWormPress(delta);
}

export function useWormCrawler(size, cubies) {
    // Only the values that must RESET the run are subscribed reactively; everything
    // the sim reads per-frame (speed, control mode, pause, interval) goes through
    // ctx getters that read the store fresh, so changing them never re-renders here.
    const { wormRunId, wormOrbCount, wormholeInterval } = useGameStore(
        useShallow(s => ({
            wormRunId: s.wormRunId ?? 0,
            wormOrbCount: s.wormOrbCount ?? DEFAULT_POWERUP_COUNT,
            wormholeInterval: s.wormholeInterval ?? DEFAULT_WORMHOLE_FLIP_INTERVAL,
        }))
    );

    const sizeRef = useRef(size);
    sizeRef.current = size;

    // Drives the shared manifold-map owner; advances only on geometry changes (rotations).
    const rotationEpoch = useGameStore((s) => s.rotationEpoch);

    // ── The simulation state — one plain object, created once per mount ─────────
    const simRef = useRef(null);
    if (simRef.current === null) simRef.current = makeWormSim(size);

    const deathMenuTimer = useRef(null);

    // O(1) tunnel endpoint lookup — kept exact (not debounced) because the crawler
    // resolves it every step. This effect reruns on every cubies change, which is
    // ~12×/sec at chaos L4.
    const tunnelLookupRef = useRef(new Map());
    // Tracks the inputs of the last lookup build so the effect can do a cheap
    // incremental update (only the cubies that actually changed) on a flip, falling
    // back to a full rebuild only on first run, a size change, or a rotation (which
    // advances rotationEpoch and rebuilds the shared manifold map). A flip swaps both
    // antipodal endpoint cubie objects together at a fixed geometry, so the
    // incremental pass stays exact — see updateTunnelLookupIncremental.
    const tunnelLookupCacheRef = useRef({ prevCubies: null, prevEpoch: null, size: null });
    useEffect(() => {
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

    // ── The ctx port: everything the sim needs from React-land / the store ──────
    // Built once; every method reads useGameStore.getState() fresh at call time,
    // matching the pre-extraction semantics exactly (the old tick did the same via
    // refs + getState()). Each write method is a 1:1 transplant of a former inline
    // store call-site.
    const ctxRef = useRef(null);
    if (ctxRef.current === null) {
        ctxRef.current = {
            // ── reads ───────────────────────────────────────────────────────────
            getCubies: () => useGameStore.getState().cubies,
            getGamePhase: () => useGameStore.getState().wormGamePhase,
            isPaused: () => useGameStore.getState().wormPaused ?? false,
            getSpeed: () => useGameStore.getState().wormSpeed ?? 2.0,
            getControlMode: () => useGameStore.getState().wormControlMode ?? 'non-oriented',
            getWormholeInterval: () => useGameStore.getState().wormholeInterval ?? DEFAULT_WORMHOLE_FLIP_INTERVAL,
            isPrismCharacter: () => (useGameStore.getState().wormCharacter ?? 'classic') === 'prism',
            getOrbInventory: () => useGameStore.getState().wormOrbInventory,
            getHealingProgress: () => useGameStore.getState().wormHealingProgress ?? {},
            getOrbColor: (faceId) => {
                const liveColors = resolveColors(useGameStore.getState().settings);
                return getOrbColor(faceId, liveColors);
            },
            getActiveTunnels: () => {
                const tunnels = [];
                for (const hit of tunnelLookupRef.current.values()) {
                    if (!hit.reversed) tunnels.push(hit);
                }
                return tunnels;
            },
            resolveTunnel: (x, y, z, dirKey) => {
                const hit = tunnelLookupRef.current.get(`${x},${y},${z},${dirKey}`);
                if (!hit) return null;
                if (hit.reversed) {
                    return {
                        tunnel: { ...hit.tunnel, entry: hit.tunnel.exit, exit: hit.tunnel.entry },
                        tunnelKey: hit.tunnelKey,
                    };
                }
                return { tunnel: hit.tunnel, tunnelKey: hit.tunnelKey };
            },

            // ── effects ─────────────────────────────────────────────────────────
            feel,
            onDeath: (details, timeAlive) => {
                // A run ending mid-buff must not leave a pill stranded on the death
                // screen — clear both the live readout and the store transitions.
                resetWormBuffs();
                useGameStore.setState({ wormRocketActive: false, wormMagnetActive: false, wormSpecialNotice: null });
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
                    wormTimeAlive: timeAlive,
                });
                // Let death state land first, then reveal menu for clearer sequencing.
                deathMenuTimer.current = setTimeout(() => {
                    useGameStore.setState({ showWormDeathMenu: true });
                    deathMenuTimer.current = null;
                }, 520);
            },
            onTunnelEnter: (tunnel) => {
                const prevState = useGameStore.getState();
                const fc = resolveColors(prevState.settings, prevState.settings?.biomeMode?.faceAssignment) || FACE_COLORS;
                useGameStore.setState({
                    wormPhase: 'windup',
                    wormOnFlippedTile: false,
                    wormTunnelCount: (prevState.wormTunnelCount ?? 0) + 1,
                    showTunnels: true,
                    wormActiveTunnelColors: {
                        entryColor: fc[tunnel.entryColor] ?? FACE_COLORS[tunnel.entryColor] ?? '#00aaff',
                        exitColor: fc[tunnel.exitColor] ?? FACE_COLORS[tunnel.exitColor] ?? '#ff8800',
                    },
                });
            },
            onCrawlResume: () => {
                useGameStore.setState({
                    wormPhase: 'crawling',
                    wormOnFlippedTile: false,
                    showTunnels: true,
                    wormActiveTunnelColors: null,
                });
            },
            onPhase: (phase) => useGameStore.getState().setWormPhase(phase),
            onBoostState: (state) => useGameStore.getState().setWormBoostState(state),
            onSurvivalTick: () => useGameStore.getState().earnCoins(EARN_WORM_SURVIVAL_TICK),
            spawnWormholePair: (tile) => {
                useGameStore.setState((state) => {
                    const mm = getManifoldMap(state.cubies, sizeRef.current, state.rotationEpoch);
                    return {
                        cubies: flipStickerPair(state.cubies, sizeRef.current, tile.x, tile.y, tile.z, tile.dirKey, mm),
                    };
                });
            },
            onFlippedTile: (v) => useGameStore.getState().setWormOnFlippedTile(v),
            applyDeposit: (deposit, stableKey, entryFaceId) => {
                useGameStore.setState((state) => ({
                    wormBodyTiles: deposit.orbsLeft,
                    wormOrbInventory: deposit.nextInventory,
                    wormHealingProgress: {
                        ...(state.wormHealingProgress ?? {}),
                        [stableKey]: { deposited: deposit.nextDeposited, faceId: entryFaceId },
                    },
                }));
            },
            onOrbPickup: (faceId, orbCount, color, combo) => {
                useGameStore.setState((state) => ({
                    wormBodyTiles: orbCount,
                    wormSessionOrbs: (state.wormSessionOrbs ?? 0) + 1,
                    // Drives the HUD's screen-edge confirmation flash. `seq` is what the
                    // HUD keys its animation off, so two pickups of the same colour still
                    // replay it. A magnet sweep collects several orbs inside one tick and
                    // React batches those writes, so the burst reads as one flash rather
                    // than a stutter of them.
                    wormOrbFlash: color
                        ? { color, combo: combo ?? 0, seq: (state.wormOrbFlash?.seq ?? 0) + 1 }
                        : state.wormOrbFlash,
                    ...(faceId ? {
                        wormOrbInventory: {
                            ...(state.wormOrbInventory ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }),
                            [faceId]: (state.wormOrbInventory?.[faceId] ?? 0) + ORB_SEGMENT_GROWTH,
                        },
                    } : {}),
                }));
            },
            onPowerupsChanged: (list) => useGameStore.getState().setWormPowerups(list),
            onSpecialsChanged: (list) => useGameStore.getState().setWormSpecials(list),
            // ── Buff publication ────────────────────────────────────────────────
            // The store carries ONLY the transitions that mount/unmount HUD elements.
            // Remaining time lives on the wormBuffs bridge, mirrored from the sim each
            // tick, so the countdown freezes with the simulation during a pause or a
            // tunnel transit instead of running off a wall clock.
            onRocketState: (active) => {
                wormBuffs.rocketActive = active;
                if (useGameStore.getState().wormRocketActive !== active) {
                    useGameStore.setState({ wormRocketActive: active });
                }
            },
            // Called only on real transitions — start, refresh, expiry — so writing
            // unconditionally is still two or three store writes per magnet. `seq`
            // bumps on a refresh as well, which is what lets the strip rescale its
            // fill to the new maximum immediately instead of at the next transition.
            onMagnetState: (seconds, maxSeconds) => {
                wormBuffs.magnetT = seconds;
                wormBuffs.magnetMaxT = maxSeconds ?? seconds;
                useGameStore.setState((state) => ({
                    wormMagnetActive: seconds > 0,
                    wormMagnetSeq: (state.wormMagnetSeq ?? 0) + 1,
                }));
            },
            onSpecialSpawned: (type) => useGameStore.setState((state) => ({
                wormSpecialNotice: { kind: 'spawn', type, seq: (state.wormSpecialNotice?.seq ?? 0) + 1 },
            })),
            onSpecialExpired: (type) => useGameStore.setState((state) => ({
                wormSpecialNotice: { kind: 'expire', type, seq: (state.wormSpecialNotice?.seq ?? 0) + 1 },
            })),
            applyHeal: (entry, exitTile, stableKey, healedCount) => {
                const sz = sizeRef.current;
                const st = useGameStore.getState();
                let healed = healSticker(st.cubies, sz, entry.x, entry.y, entry.z, entry.dirKey);
                healed = healSticker(healed, sz, exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey);
                // Match a manual cube-mode flip: both antipodal endpoint cubies hop
                // outward while their stickers animate back to the restored color.
                const now = performance.now();
                const pops = {
                    [`${entry.x},${entry.y},${entry.z}`]: { startMs: now, durationMs: 500 },
                    [`${exitTile.x},${exitTile.y},${exitTile.z}`]: { startMs: now, durationMs: 500 },
                };
                useGameStore.setState((state) => ({
                    cubies: healed,
                    cubiePops: { ...pruneExpiredFx(state.cubiePops, now), ...pops },
                }));
                const newProgress = { ...(st.wormHealingProgress ?? {}) };
                const healedProgressKeys = Array.isArray(stableKey) ? stableKey : [stableKey];
                for (const key of healedProgressKeys) if (key) delete newProgress[key];
                st.setWormHealingProgress(newProgress);
                st.setWormHealedCount(healedCount);
                useGameStore.getState().earnCoins(EARN_WORM_HEALED_FACE);
            },
        };
    }

    // ── Per-frame drive ──────────────────────────────────────────────────────────
    const tick = useCallback((delta) => {
        const sim = simRef.current;
        stepWormSim(sim, delta, sizeRef.current, ctxRef.current);
        // Publish the wormhole countdown through the plain bridge (pause menu snapshot).
        wormClock.countdown = sim.wormholeCountdown;
        // Mirror the authoritative buff clocks for the HUD. Plain field writes, so a
        // per-frame refresh costs nothing and freezes whenever the sim does.
        wormBuffs.magnetT = sim.magnetT;
        wormBuffs.magnetMaxT = sim.magnetMaxT;
        wormBuffs.rocketActive = sim.rocketActive;
        publishTilePress(sim, sizeRef.current, ctxRef.current, delta);
    }, []);

    const queueTurn = useCallback((dir) => queueTurnSim(simRef.current, dir), []);

    const killWorm = useCallback((details = null) => {
        killWormSim(simRef.current, ctxRef.current, details);
    }, []);

    const jumpLift = useCallback(() => jumpLiftOf(simRef.current), []);

    // ── Run reset (retry / new setup / size change) ─────────────────────────────
    useEffect(() => {
        const sim = simRef.current;
        resetWormSim(sim, size, { orbCount: wormOrbCount, wormholeInterval });
        resetWormBuffs();
        resetWormPress();
        useGameStore.getState().setWormBoostState('ready');
        useGameStore.setState({
            wormPowerups: sim.powerups,
            wormSpecials: [],
            wormRocketActive: false,
            wormMagnetActive: false,
            wormMagnetSeq: 0,
            wormSpecialNotice: null,
            wormOrbFlash: null,
            wormBodyTiles: 0,
            wormOrbInventory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
            wormHealingProgress: {},
            wormHealedCount: 0,
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
        wormClock.countdown = wormholeInterval;
    }, [size, wormRunId, wormOrbCount, wormholeInterval]);

    useEffect(() => () => {
        if (deathMenuTimer.current) {
            clearTimeout(deathMenuTimer.current);
            deathMenuTimer.current = null;
        }
        // Leaving worm mode entirely: the bridges are module-level state that would
        // otherwise still be holding the last run's buff (and its dents) when the
        // mode remounts.
        resetWormBuffs();
        resetWormPress();
        useGameStore.setState({ wormRocketActive: false, wormMagnetActive: false, wormSpecialNotice: null });
    }, []);

    // Track the last pending rotation so we can apply it to the sim when the
    // animation commits (rotationEpoch increments).
    const lastPendingMoveRef = useRef(null);
    useEffect(() => {
        const unsub = useGameStore.subscribe(
            s => s.animState,
            animState => { if (animState) lastPendingMoveRef.current = animState; }
        );
        return unsub;
    }, []);

    // When a cube rotation commits, transform the whole sim (worm, powerups, trails,
    // step-history bake, in-flight tunnel) so everything follows its tile.
    useEffect(() => {
        const unsub = useGameStore.subscribe(
            s => s.rotationEpoch,
            () => {
                const rot = lastPendingMoveRef.current;
                if (!rot) return;
                const st = useGameStore.getState();
                // Keep coordinate readers synchronous with the committed cubies.
                // applyRotationToSim may immediately re-check a rest-read ring; waiting
                // for the React effect below would expose the pre-commit tunnel mouths.
                const committedMap = getManifoldMap(st.cubies, sizeRef.current, st.rotationEpoch);
                tunnelLookupRef.current = buildTunnelLookup(st.cubies, sizeRef.current, committedMap);
                const lookupCache = tunnelLookupCacheRef.current;
                lookupCache.prevCubies = st.cubies;
                lookupCache.prevEpoch = st.rotationEpoch;
                lookupCache.size = sizeRef.current;
                const layers = rot.sliceIndices?.length ? rot.sliceIndices : [rot.sliceIndex];
                // Each plane can turn a DIFFERENT direction (the hazard spins two
                // non-adjacent planes opposite ways). Remap every layer's cells —
                // worm, trail, powerups — by THAT plane's own direction, not the
                // shared anchor `dir`; otherwise the opposite-spinning plane is
                // remapped backwards and whatever sits on it teleports.
                const dirs = rot.sliceDirs?.length ? rot.sliceDirs : layers.map(() => rot.dir);
                const opts = {
                    inOpeningScramble: st.wormGamePhase === 'scrambling',
                    paused: st.wormPaused ?? false,
                };
                layers.forEach((sliceIndex, li) => {
                    applyRotationToSim(
                        simRef.current, sizeRef.current, ctxRef.current,
                        { ...rot, sliceIndex, dir: dirs[li], sliceIndices: null, sliceDirs: null },
                        opts
                    );
                });
            }
        );
        return unsub;
    }, []);

    // ── Public API ───────────────────────────────────────────────────────────────
    // Same shape the renderers/wormHelpers have always used: every field is a
    // { current } accessor. Each one is a live alias onto the sim object (getter +
    // setter), so both reads (renderers) and writes (cutWormTail, rideLiveRotation)
    // hit the single source of truth. Built once — the object identity is stable
    // across renders.
    const apiRef = useRef(null);
    if (apiRef.current === null) {
        const f = (key) => ({
            get current() { return simRef.current[key]; },
            set current(v) { simRef.current[key] = v; },
        });
        apiRef.current = {
            pos: f('pos'),
            moveDir: f('moveDir'),
            phase: f('phase'),
            tunnelProgress: f('tunnelProgress'),
            activeTunnel: f('activeTunnel'),
            onFlippedTile: f('onFlippedTile'),
            interpT: f('interpT'),
            prevWorldPos: f('prevWorldPos'),
            curWorldPos: f('curWorldPos'),
            prevTile: f('prevTile'),
            restReadSlice: f('restReadSlice'),
            crossingCorner: f('crossingCorner'),
            jumpT: f('jumpT'),
            isJumping: f('isJumping'),
            rocketActive: f('rocketActive'),
            rocketT: f('rocketT'),
            landingGraceT: f('landingGraceT'),
            magnetT: f('magnetT'),
            pendingOrbAttractionsRef: f('pendingOrbAttractions'),
            specials: f('specials'),
            pendingSpecialFlashRef: f('pendingSpecialFlash'),
            headInterpPos: f('headInterpPos'),
            currentNormal: f('currentNormal'),
            tailLength: f('tailLength'),
            stepHistory: f('stepHistory'),
            orbPickupColorsRef: f('orbPickupColors'),
            orbPickupFaceIdsRef: f('orbPickupFaceIds'),
            colorEpochRef: f('colorEpoch'),
            voidTunnelKeysRef: f('voidTunnelKeys'),
            tunnelUseCountsRef: f('tunnelUseCounts'),
            willHealRef: f('willHeal'),
            healFiredRef: f('healFired'),
            pendingHealBurstRef: f('pendingHealBurst'),
            healPauseT: f('healPauseT'),
            healFocusTile: f('healFocusTile'),
            cutFocusT: f('cutFocusT'),
            cutFocusPos: f('cutFocusPos'),
            pendingOrbFlashRef: f('pendingOrbFlash'),
            tileTrail: f('tileTrail'),
            pathHistory: f('pathHistory'),
            timeAliveRef: f('timeAlive'),
            jumpLift,
            tick,
            queueTurn,
            killWorm,
        };
    }
    return apiRef.current;
}
