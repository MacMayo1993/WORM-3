import { cancelAmbientEncounter, makeAmbientCombat, stepAmbientCombat } from './combat/ambientCombat.js';
import { makeCombat, stepCombat, combatBridge } from './combat/portalCombat.js';
import { wormDemoActive, wormDemoLesson } from '../game/wormDemoLessons.js';
import { stageWormPractice, readWormPractice } from './healerWorm/demoPractice.js';
import { tunnelReadout } from './healerWorm/tunnelReadout.js';
import { signatureReadout } from './healerWorm/signatures.js';
import { liveRotation } from './liveRotation.js';
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
import { getWormTunnelSnapshot } from './tunnelSnapshot.js';
import { flipStickerPair } from '../game/manifoldLogic.js';
import { getManifoldMap } from '../game/manifoldMapStore.js';
import { healSticker } from '../game/cubeState.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { FACE_COLORS } from '../utils/constants.js';
import { EARN_WORM_SURVIVAL_TICK, EARN_WORM_HEALED_FACE } from '../utils/economyConstants.js';
import { pruneExpiredFx } from '../utils/transientFx.js';
import { activateSticker } from '../3d/StickerAnimationManager.js';
import { createWormFeedback } from './wormFeedback.js';
import { setFeelEnabled, resumeFeel } from '../utils/feel.js';
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
import { resetWormSegments } from './wormSegments.js';
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

    const feedbackRef = useRef(null);
    if (!feedbackRef.current) feedbackRef.current = createWormFeedback();
    useEffect(() => {
        const sync = () => {
            const state = useGameStore.getState();
            setFeelEnabled({ sfx: state.settings?.sfx ?? true, haptics: state.settings?.haptics ?? true });
            feedbackRef.current.hold(!!state.wormPaused || document.hidden);
        };
        sync();
        resumeFeel();
        const unsubscribe = useGameStore.subscribe(sync);
        document.addEventListener('visibilitychange', sync);
        return () => { unsubscribe(); document.removeEventListener('visibilitychange', sync); feedbackRef.current.reset(); };
    }, []);

    const deathMenuTimer = useRef(null);
    const demoPracticeRef = useRef(null);
    const combatRunRef = useRef(null);
    useEffect(() => () => { combatBridge.current = null; }, []);

    // Simulation and portal visuals share one exact snapshot of committed cubies.
    // Rotation commits refresh this synchronously below; flips refresh in this effect.
    const tunnelLookupRef = useRef(new Map());
    const activeTunnelsRef = useRef([]);
    useEffect(() => {
        const snapshot = getWormTunnelSnapshot(cubies, size, rotationEpoch);
        tunnelLookupRef.current = snapshot.lookup;
        activeTunnelsRef.current = snapshot.tunnels;
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
            isDemoLesson: () => { const s = useGameStore.getState(); return s.demoMode && s.demoStep === 'worm-traversal'; },
            isCombatMode: () => useGameStore.getState().wormCombatMode,
            allowDemoSignature: () => wormDemoLesson(useGameStore.getState()).id === 'signature',
            isPaused: () => useGameStore.getState().wormPaused ?? false,
            getSpeed: () => useGameStore.getState().wormSpeed ?? 2.0,
            getControlMode: () => useGameStore.getState().wormControlMode ?? 'non-oriented',
            getWormholeInterval: () => useGameStore.getState().wormholeInterval ?? DEFAULT_WORMHOLE_FLIP_INTERVAL,
            getCharacter: () => useGameStore.getState().wormCharacter ?? 'classic',
            isPrismCharacter: () => (useGameStore.getState().wormCharacter ?? 'classic') === 'prism',
            getOrbInventory: () => useGameStore.getState().wormOrbInventory,
            getHealingProgress: () => useGameStore.getState().wormHealingProgress ?? {},
            getOrbColor: (faceId) => {
                const liveColors = resolveColors(useGameStore.getState().settings);
                return getOrbColor(faceId, liveColors);
            },
            getActiveTunnels: () => activeTunnelsRef.current,
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
            feel: (event, opts) => feedbackRef.current.emit(event, opts),
            onDeath: (details, timeAlive) => {
                const ending = useGameStore.getState();
                ending.finishWormXp(false, ending.wormRunId);
                // A run ending mid-buff must not leave a pill stranded on the death
                // screen — clear both the live readout and the store transitions.
                resetWormBuffs();
                resetWormSegments();
                useGameStore.setState({ wormRocketActive: false, wormMagnetActive: false, wormSpecialNotice: null, wormElementalTheme: null });
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
                    const current = useGameStore.getState();
                    if (!current.demoMode) useGameStore.setState({ showWormDeathMenu: true });
                    deathMenuTimer.current = null;
                }, 520);
            },
            onTunnelEnter: (tunnel) => {
                const prevState = useGameStore.getState();
                prevState.recordWormXp('entry', 0, [tunnel.entryColor, tunnel.exitColor].sort().join(':'), prevState.wormRunId);
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
                const resumed = useGameStore.getState();
                if (resumed.wormPhase === 'windout') {
                    resumed.recordWormXp('tunnels', resumed.wormTunnelCount, null, resumed.wormRunId);
                    resumed.recordWormMission('tunnels', resumed.wormTunnelCount, null, resumed.wormRunId);
                }
                useGameStore.setState({
                    wormPhase: 'crawling',
                    wormOnFlippedTile: false,
                    showTunnels: true,
                    wormActiveTunnelColors: null,
                });
            },
            onPhase: (phase) => useGameStore.getState().setWormPhase(phase),
            onSteer: () => {
                const state = useGameStore.getState();
                if (state.demoMode && state.demoStep === 'worm-traversal' && !state.demoWormSteered) {
                    useGameStore.setState({ demoWormSteered: true });
                }
            },
            onBoostState: (state) => useGameStore.getState().setWormBoostState(state),
            onSurvivalTick: () => { const s = useGameStore.getState(); if (!s.demoMode && !s.wormCombatMode) s.earnCoins(EARN_WORM_SURVIVAL_TICK); },
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
            onTailShed: (inventory, orbCount) => useGameStore.setState({ wormOrbInventory: inventory, wormBodyTiles: orbCount }),
            onOrbPickup: (faceId, orbCount, color, combo, segments = ORB_SEGMENT_GROWTH) => {
                const pickup = useGameStore.getState();
                pickup.recordWormXp('orbs', (pickup.wormSessionOrbs ?? 0) + 1, faceId, pickup.wormRunId);
                pickup.recordWormMission('orbs', (pickup.wormSessionOrbs ?? 0) + 1, faceId, pickup.wormRunId);
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
                            [faceId]: (state.wormOrbInventory?.[faceId] ?? 0) + segments,
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
            // Elemental wash: the store carries only the active element key (null when
            // none), enough for the atmosphere overlay to mount/unmount and the HUD to
            // show a pill. The remaining seconds ride the wormBuffs bridge like the
            // magnet's, so the countdown freezes with the simulation.
            onElementalTheme: (type, maxSeconds) => {
                const state = useGameStore.getState();
                state.recordWormXp('element', 0, type ?? null, state.wormRunId);
                wormBuffs.elementalT = type ? (maxSeconds ?? 0) : 0;
                wormBuffs.elementalMaxT = type ? (maxSeconds ?? 0) : 0;
                if (useGameStore.getState().wormElementalTheme !== (type ?? null)) {
                    useGameStore.setState({ wormElementalTheme: type ?? null });
                }
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
                // A worm heal during a chaos round edits the cube behind the chaos
                // worker's back — push it across, or the worker keeps spreading the
                // damage that was just cleared and its death ledger drifts away from
                // the tiles on screen.
                if (st.chaosLevel > 0) useGameStore.getState().requestChaosResync();
                const newProgress = { ...(st.wormHealingProgress ?? {}) };
                const healedProgressKeys = Array.isArray(stableKey) ? stableKey : [stableKey];
                for (const key of healedProgressKeys) if (key) delete newProgress[key];
                st.setWormHealingProgress(newProgress);
                st.setWormHealedCount(healedCount);
                st.recordWormXp('healed', healedCount, null, st.wormRunId);
                st.recordWormMission('healed', healedCount, null, st.wormRunId);
                if (!st.demoMode && !st.wormCombatMode) st.earnCoins(EARN_WORM_HEALED_FACE);
            },
        };
    }

    // ── Per-frame drive ──────────────────────────────────────────────────────────
    const tick = useCallback((delta, hazards = {}) => {
        const sim = simRef.current;
        const state = useGameStore.getState();
        feedbackRef.current.advance(delta);
        const demo = wormDemoActive(state) && !state.demoWormFinished;
        const lesson = wormDemoLesson(state);
        const attempt = `${state.wormRunId}:${state.demoWormLessonIndex}:${state.demoWormAttempt}`;
        if (demo && ['active', 'finalHealing'].includes(state.wormGamePhase) && !state.wormPauseMenuOpen && !liveRotation.active && demoPracticeRef.current?.attempt !== attempt) {
            if (deathMenuTimer.current) { clearTimeout(deathMenuTimer.current); deathMenuTimer.current = null; }
            const practice = stageWormPractice(sim, sizeRef.current, lesson);
            demoPracticeRef.current = { ...practice, attempt, rotationEpoch: state.rotationEpoch };
            resetWormBuffs(); resetWormSegments(); resetWormPress();
            useGameStore.setState({ cubies: practice.cubies, wormPowerups: sim.powerups, wormSpecials: sim.specials,
                wormOrbInventory: practice.inventory, wormBodyTiles: lesson.id === 'heal' ? 2 : 0,
                wormSessionOrbs: 0, wormTunnelCount: 0, wormHealedCount: 0, wormHealingProgress: {},
                wormPhase: 'crawling', wormAlive: true, wormPaused: true, demoWormStarted: false, demoWormPrepared: true, wormOnFlippedTile: false, wormDeathDetails: null,
                wormRocketActive: false, wormMagnetActive: false, wormElementalTheme: null, wormSpecialNotice: null,
                wormBoostState: 'ready', wormOrbFlash: null, demoWormSteered: false, demoWormTarget: practice.target,
                demoWormProgress: '', demoWormHazardCleared: null });
            return; // Let the shared tunnel snapshot observe the staged board first.
        }
        if (state.wormCombatMode && state.wormGamePhase === 'active' && combatRunRef.current !== state.wormRunId) {
            const practice = stageWormPractice(sim, sizeRef.current, { id: 'heal' });
            sim.moveDir = 'right';
            sim.combat = makeCombat(sizeRef.current, practice.target);
            combatBridge.current = sim.combat;
            combatRunRef.current = state.wormRunId;
            resetWormBuffs(); resetWormSegments(); resetWormPress();
            useGameStore.setState({ cubies: practice.cubies, wormOrbInventory: practice.inventory,
                wormBodyTiles: 2, wormPowerups: [], wormSpecials: [], wormPhase: 'crawling',
                wormPaused: true, wormHealedCount: 0, wormHealingProgress: {}, wormOnFlippedTile: false });
            return;
        }
        if (state.wormEnemiesEnabled && !state.wormCombatMode && !state.demoMode && state.wormHealerMode &&
            state.wormGamePhase === 'active' && !sim.combat) {
            sim.combat = makeAmbientCombat(sizeRef.current);
            combatBridge.current = sim.combat;
        }
        const combatHeld = state.wormPaused || !sim.alive || sim.phase !== 'crawling' ||
            sim.tunnelPassages.length > 0 || sim.healPauseT > 0 || sim.cutFocusT > 0 ||
            sim.elementalFocusT > 0 || sim.signature.charge > 0 || sim.rocketActive || liveRotation.active ||
            state.wormGamePhase !== 'active';
        stepWormSim(sim, delta, sizeRef.current, ctxRef.current);
        feedbackRef.current.tunnel(sim.phase, sim.tunnelProgress, sim.alive);
        if (sim.combat) {
            const c = sim.combat;
            c.held = combatHeld || sim.phase !== 'crawling' || sim.tunnelPassages.length > 0 || !sim.alive;
            const previousKills = c.kills, previousShots = c.shotsFired, previousDrops = c.dropsCollected;
            const previousHits = c.shotsHit, previousAmmo = c.ammo;
            const combatPlayer = {
                head: sim.pos, heading: sim.moveDir, position: sim.headInterpPos.toArray(),
                // The destination tile is committed before the visible head finishes
                // crossing. Read this AFTER stepWormSim, including the entry frame.
                aimBlocked: sim.interpT < 1 && (sim.crossingCorner ||
                    !!(sim.prevTile && sim.prevTile.dirKey !== sim.pos.dirKey)),
                blocked: c.held, protected: sim.isJumping || sim.rocketActive || sim.landingGraceT > 0,
                portalOpen: sim.healed === 0, canFinish: sim.phase === 'crawling' && sim.tunnelPassages.length === 0,
                phase: state.wormGamePhase, alive: sim.alive, healed: sim.healed,
                rotating: liveRotation.active, hazardBusy: !!hazards.busy,
                element: sim.elementalType, elementT: sim.elementalT,
                lockedTile: sim.signature.character === 'mobi' && sim.signature.active > 0 ? sim.signature.target : null,
            };
            const onContact = health => {
                if (health <= 0) killWormSim(sim, ctxRef.current, { reason: 'portal-crawler' });
                else ctxRef.current.feel('shieldHit');
            };
            if (c.ambient) {
                const current = useGameStore.getState();
                const tunnels = getWormTunnelSnapshot(current.cubies,sizeRef.current,current.rotationEpoch).tunnels;
                stepAmbientCombat(c,delta,combatPlayer,tunnels.filter(hit => !sim.voidTunnelKeys.has(hit.tunnelKey)),onContact);
            } else stepCombat(c,delta,combatPlayer,onContact);
            if (sim.alive) {
                if (c.shotsFired > previousShots) ctxRef.current.feel('shot');
                if (c.kills > previousKills) ctxRef.current.feel('enemyDown');
                else if (c.shotsHit > previousHits) ctxRef.current.feel('shotHit');
                if (c.dropsCollected > previousDrops) ctxRef.current.feel('orb');
                else if (previousAmmo === 0 && c.ammo > 0) ctxRef.current.feel('recharge');
            }
            if (c.won && !state.wormPaused) useGameStore.setState({ wormPaused: true, wormTimeAlive: Math.floor(sim.timeAlive) });
        }

        if (demo && state.demoWormStarted && demoPracticeRef.current?.attempt === attempt && !state.wormPaused && sim.alive && !state.demoWormComplete) {
            const result = readWormPractice(sim, demoPracticeRef.current, lesson, useGameStore.getState(), sizeRef.current, delta);
            if (result.done || result.progress !== state.demoWormProgress) {
                useGameStore.setState({ demoWormProgress: result.progress,
                    ...(result.done ? { demoWormComplete: true, wormPaused: true,
                        demoWormCompleted: [...new Set([...state.demoWormCompleted, lesson.id])] } : {}) });
            }
        }
        // Publish the wormhole countdown through the plain bridge (pause menu snapshot).
        wormClock.countdown = sim.wormholeCountdown;
        // Mirror the authoritative buff clocks for the HUD. Plain field writes, so a
        // per-frame refresh costs nothing and freezes whenever the sim does.
        wormBuffs.tunnelNeeds = tunnelReadout(sim, sizeRef.current, ctxRef.current);
        wormBuffs.signature = sim.alive ? signatureReadout(sim, sizeRef.current, ctxRef.current) : null;
        wormBuffs.waterMomentum = sim.waterMomentum;
        const tile = sim.pos;
        wormBuffs.springReady = !sim.isJumping && !sim.rocketActive && !liveRotation.active && !sim.restRead
            && sim.phase === 'crawling' && sim.elementalPatches.get(`${tile.x},${tile.y},${tile.z},${tile.dirKey}`)?.type === 'grass';
        let springs = 0;
        for (const patch of sim.elementalPatches.values()) if (patch.type === 'grass') springs++;
        wormBuffs.springCount = springs;
        wormBuffs.magnetT = sim.magnetT;
        wormBuffs.magnetMaxT = sim.magnetMaxT;
        wormBuffs.rocketActive = sim.rocketActive;
        wormBuffs.elementalT = sim.elementalT;
        wormBuffs.elementalMaxT = sim.elementalMaxT;
        // Reference-copied, not cloned: the sim snapshots a fresh object per claim
        // and never mutates it, so the skin can compare identity to detect a new
        // claim without allocating anything per frame.
        wormBuffs.elementalOrigin = sim.elementalOrigin;
        publishTilePress(sim, sizeRef.current, ctxRef.current, delta);
    }, []);

    const queueTurn = useCallback((dir) => {
        const sim = simRef.current, state = useGameStore.getState(), c = sim.combat;
        if (state.wormCombatMode && dir === 'combat-start') {
            if (c && !c.started && state.wormGamePhase === 'active' && !state.wormPauseMenuOpen) {
                c.started = true; useGameStore.setState({ wormPaused: false });
            }
            return;
        }
        if (dir === 'fire-stop') { if (c) c.fireHeld = false; return; }
        if (dir === 'fire' || dir === 'fire-start') {
            if (c?.started && (!c.ambient || c.encounter) && !c.won && sim.alive && !state.wormPaused && !c.held && sim.phase === 'crawling') { c.fireRequested = true; if (dir === 'fire-start') c.fireHeld = true; }
            return;
        }
        if (state.wormCombatMode && (!c?.started || c.won || state.wormPaused)) return;
        queueTurnSim(sim, dir);
    }, []);

    const killWorm = useCallback((details = null) => {
        killWormSim(simRef.current, ctxRef.current, details);
    }, []);

    const jumpLift = useCallback(() => jumpLiftOf(simRef.current), []);

    // ── Run reset (retry / new setup / size change) ─────────────────────────────
    useEffect(() => {
        const sim = simRef.current;
        demoPracticeRef.current = null;
        combatRunRef.current = null; sim.combat = null; combatBridge.current = null;
        feedbackRef.current.reset();
        resetWormSim(sim, size, { orbCount: wormOrbCount, wormholeInterval });
        resetWormBuffs();
        resetWormSegments();
        resetWormPress();
        useGameStore.getState().setWormBoostState('ready');
        useGameStore.setState({
            wormPowerups: sim.powerups,
            wormSpecials: [],
            wormRocketActive: false,
            wormMagnetActive: false,
            wormMagnetSeq: 0,
            wormSpecialNotice: null,
            wormElementalTheme: null,
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
        resetWormSegments();
        resetWormPress();
        useGameStore.setState({ wormRocketActive: false, wormMagnetActive: false, wormSpecialNotice: null });
    }, []);

    // When a cube rotation commits, transform the whole sim (worm, powerups, trails,
    // step-history bake, in-flight tunnel) so everything follows its tile.
    useEffect(() => {
        let lastCommittedRotation = useGameStore.getState().lastRotation;
        const unsub = useGameStore.subscribe(
            s => s.rotationEpoch,
            () => {
                const st = useGameStore.getState();
                const rot = st.lastRotation;
                if (!rot || rot === lastCommittedRotation) return;
                lastCommittedRotation = rot;
                cancelAmbientEncounter(simRef.current.combat);
                // Keep coordinate readers synchronous with the committed cubies.
                // applyRotationToSim may immediately re-check a rest-read ring; waiting
                // for the React effect below would expose the pre-commit tunnel mouths.
                const snapshot = getWormTunnelSnapshot(st.cubies, sizeRef.current, st.rotationEpoch);
                tunnelLookupRef.current = snapshot.lookup;
                activeTunnelsRef.current = snapshot.tunnels;
                // ONE call for the whole move, however many planes it turned. This used
                // to loop applyRotationToSim once per layer, and the first layer cleared
                // the worm's crossing protection before the second was applied — so a
                // worm crossing into the second plane had its destination rotated away
                // (size 3, protected destination {0,2,2,PZ}, commit row 0 then row 2:
                // it came out at {0,2,0,NX}). Each plane still remaps its own cells by
                // its own direction; that now happens inside the transaction.
                applyRotationToSim(
                    simRef.current, sizeRef.current, ctxRef.current, rot,
                    {
                        inOpeningScramble: st.wormGamePhase === 'scrambling',
                        paused: st.wormPaused ?? false,
                    }
                );
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
            signature: f('signature'),
            elementalPatches: f('elementalPatches'),
            pos: f('pos'),
            moveDir: f('moveDir'),
            phase: f('phase'),
            tunnelProgress: f('tunnelProgress'),
            activeTunnel: f('activeTunnel'),
            tunnelPassages: f('tunnelPassages'),
            onFlippedTile: f('onFlippedTile'),
            interpT: f('interpT'),
            crawlDistance: f('crawlDistance'),
            prevWorldPos: f('prevWorldPos'),
            curWorldPos: f('curWorldPos'),
            prevTile: f('prevTile'),
            restRead: f('restRead'),
            crossingCorner: f('crossingCorner'),
            jumpT: f('jumpT'),
            jumpSpan: f('jumpSpan'),
            isJumping: f('isJumping'),
            rocketActive: f('rocketActive'),
            rocketT: f('rocketT'),
            rocketFlight: f('rocketFlight'),
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
            elementalFocusT: f('elementalFocusT'),
            elementalT: f('elementalT'),
            elementalMaxT: f('elementalMaxT'),
            pendingOrbFlashRef: f('pendingOrbFlash'),
            tileTrail: f('tileTrail'),
            pathHistory: f('pathHistory'),
            timeAliveRef: f('timeAlive'),
            feel: ctxRef.current.feel,
            jumpLift,
            tick,
            queueTurn,
            killWorm,
        };
    }
    return apiRef.current;
}
