import CautionFallFX from './healerWorm/CautionFallFX.jsx';
import { PickupMaterialProvider } from './healerWorm/PickupMaterials.jsx';
import WormEffectWarmup from './healerWorm/WormEffectWarmup.jsx';
import { WormLighting } from './WormLighting.jsx';
import { CoreWormReflections } from './healerWorm/CoreWormReflections.jsx';
import { holdsRotationTimer } from './characterAbilities.js';
import { springSlamTiles } from './healerWorm/jumpLanding.js';
import { WormTrail } from './healerWorm/WormTrail.jsx';
import { storySurfaceTile } from './story/mastery.js';
import { bodyCoverageCount } from './healerWorm/bodyCoverage.js';
import { storyLevel, storyRotationCycle } from './story/levels.js';
import { combatBridge, strikeEnemies } from './combat/portalCombat.js';
import { STORM, makeStorm, beginStorm, clearStorm, tickStorm, pickStrikeTile } from './healerWorm/lightningStorm.js';
import { getAllSurfaceTiles } from './healerWorm/surfaceTiles.js';
import CombatScene from './combat/CombatScene.jsx';
import { wormDemoActive, wormDemoLesson } from '../game/wormDemoLessons.js';
import DemoPracticeTargets from './healerWorm/DemoPracticeTargets.jsx';
import { SignatureEffects } from './healerWorm/SignatureEffects.jsx';
import { LightningStrikes } from './healerWorm/LightningStrikes.jsx';
import { isHotTile } from './healerWorm/elementalGameplay.js';
import { ElementalPatches } from './healerWorm/ElementalPatches.jsx';
import BurrowEffects from './healerWorm/BurrowEffects.jsx';
// src/worm/HealerWormMode.jsx
// WORM Chase-Cam Mode — top-level wrapper and game-phase driver.
// Chase camera follows the worm crawling on the cube exterior.
// Flipped tiles are instant wormholes; jump to clear them.
//
// This file owns only the scramble → spawning → countdown → active →
// finalHealing → solved phase machine and the inverse-rotation hazard
// scheduler. The rendering subsystems (body, trail, face, rings, portal/heal/
// impact FX, tunnel interior) were split into ./healerWorm/ in 2026-07 — each
// module is verbatim-extracted, so recover pre-split history via this file.
// Dead components removed in the same split (recover from git history if ever
// needed): TunnelSurfFX, WormInteriorGlass, TunnelPortalRings.

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getWormStickerWorldPos as getStickerWorldPos } from './wormExpansion.js';
import { getActiveTunnels, collectManifoldRing } from './wormLogic.js';
import { setWormTurnCallback } from './wormTurnBridge.js';
import { getManifoldMap } from '../game/manifoldMapStore.js';
import {
    WORM_LIFT,
    FACE_NORMALS,
    DIR_FORWARD,
    STEPS_PER_TILE,
    AUTO_ROTATE_WARNING,
    SCRAMBLE_STEPS,
    ACTIVE_ROTATE_INTERVAL,
    COUNTDOWN_STEP_DURATION,
    BASE_TAIL_LENGTH,
    BODY_BALL_SPACING,
    CUT_FOCUS_DURATION,
    ORB_SEGMENT_GROWTH,
} from './healerWorm/constants.js';
import { shPush, ttAt } from './circularBuffers.js';
import { feel, setFeelEnabled } from '../utils/feel.js';
import { EARN_ORB_COLLECT } from '../utils/economyConstants.js';
import { liveRotation } from './liveRotation.js';
import { shAt } from './circularBuffers.js';
import { rideLiveRotation, resolveSliceHits, cutWormTail, parseTileKey } from './wormHelpers.js';
import { armTurnWatch, stepTurnWatch } from './healerWorm/sliceCrossing.js';
import { useWormCrawler } from './useWormCrawler.js';
import WormChaseCamera from './WormChaseCamera.jsx';
import WormSwipeControls from './WormSwipeControls.jsx';
import { TunnelInteriorView } from './healerWorm/TunnelInteriorView.jsx';
import { warmUpElementalSkins } from './healerWorm/elementalWarmup.js';
import { TunnelTube } from './healerWorm/TunnelTube.jsx';
import { JumpLandingMarker } from './healerWorm/JumpLandingMarker.jsx';
import RocketExhaust from './healerWorm/RocketExhaust.jsx';
import { WormBody, GlowWormAura } from './healerWorm/WormBody.jsx';
import { WormFace } from './healerWorm/WormFace.jsx';
import { PowerupOrbs, OrbFlashSystem, SpecialOrbs, SpecialFlashSystem, MagnetFX } from './healerWorm/orbSystems.jsx';
import ElementalAtmosphere from './ElementalAtmosphere.jsx';
import { wormBuffs } from './wormBuffs.js';
import { HealBurstSystem, TunnelHealProgress } from './healerWorm/healFx.jsx';
import { WormholeRings } from './healerWorm/WormholeRings.jsx';
import { HealerBombs } from './healerWorm/HealerBombs.jsx';
import { randomFreeTile } from './healerWorm/surfaceTiles.js';
import {
    BOMB_FUSE_SECONDS,
    BOMB_SPAWN_INTERVAL,
    BOMB_DISARM_REWARD,
    bombCap,
    computeBlastTiles,
    isBombDisarmed,
    isBombSlammed,
    tileKeyOf,
    checkBlastHitWorm,
} from './healerWorm/bombs.js';
import { SliceWarningLights } from './healerWorm/SliceWarningLights.jsx';
import { rotationClock, resetRotationClock } from './healerWorm/rotationClockBridge.js';
import { PortalGlow, TunnelPortalFX } from './healerWorm/portalFx.jsx';
import { ThunkEffect, SeveredTail, CollisionGlow } from './healerWorm/impactFx.jsx';
import { DroppedOrbs } from './healerWorm/DroppedOrbs.jsx';
import { sampleSeveredTail, wormdKindForDeath } from './healerWorm/wormdFx.js';
import { buildWormScramble, invertWormScramble } from './healerWorm/scramble.js';

const SPAWN_DURATION = 0.75;

// Scratch vectors used to seed synthetic body history during spawning.
const _seedPos = new THREE.Vector3();
const _seedNorm = new THREE.Vector3();
const _seedBackDir = new THREE.Vector3();

// ─── Main exported wrapper ────────────────────────────────────────────────────
export function HealerWormMode3DWrapper({ cubies, size, _explosionFactor, _animState, onRotate, _onHeal, onAnimatedShuffle }) {
    const reflectionSource = useRef();
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
    const glowCharacter = useGameStore(s => s.wormCharacter === 'glow');
    const demoMode = useGameStore(s => s.demoMode);
    const combatMode = useGameStore(s => s.wormCombatMode);
    const enemiesEnabled = useGameStore(s => s.wormEnemiesEnabled);
    const wormGamePhase = useGameStore(s => s.wormGamePhase ?? 'scrambling');
    const wormPhaseReactive = useGameStore(s => s.wormPhase ?? 'crawling');

    // Compile every elemental skin's GLSL now, while the board is still scrambling
    // and the player cannot act. Without this the first claim of each element paid
    // the driver's shader compile in the same frame the wash mounted, which is the
    // hitch players reported when a power-up appeared. Same treatment CubeAssembly
    // gives tile styles and HealerBombs' <WarmUp> gives bombs.
    const { gl, camera, scene } = useThree();
    useEffect(() => {
        warmUpElementalSkins(gl, camera, scene);
    }, [gl, camera, scene]);

    // Keep the feel layer's SFX/haptics channels in sync with the player's settings.
    const sfxOn = useGameStore(s => s.settings?.sfx ?? true);
    const hapticsOn = useGameStore(s => s.settings?.haptics ?? true);
    useEffect(() => { setFeelEnabled({ sfx: sfxOn, haptics: hapticsOn }); }, [sfxOn, hapticsOn]);

    // ── Auto-rotation hazard state ─────────────────────────────────────────────
    const autoTimerRef      = useRef(0);
    // The next move, armed as soon as the cycle starts rather than only for the
    // last few seconds: the layer it names is lit the whole time, so the player can
    // see which slice is coming and plan around it instead of being told about it
    // once the turn is nearly on top of them.
    const pendingRotRef     = useRef(null);   // {axis,dir,sliceIndex} for the whole cycle
    const warningProgressRef = useRef(0);     // 0→1 through warning window
    const liveDeathRef = useRef(null);
    const thunkRef = useRef({ active: false, pos: [0, 0, 0], colors: [] });
    // The hazard code fires its own shout for the deaths it causes; the death
    // watch below only covers the rest (tail bites, the void, portal crawlers).
    const deathThunkFiredRef = useRef(false);
    const severedRef = useRef({ active: false, pieces: [], count: 0, orbColors: [] });
    // Snapshot the beads a cut is about to remove so SeveredTail can pop them off
    // the cube. Must run before cutWormTail trims the history they live on.
    const captureSeveredTail = (cut) => {
        const fromBead = typeof cut === 'object' && Number.isFinite(cut.cutDistance)
            ? cut.keepCount
            : Math.max(BASE_TAIL_LENGTH, Math.round((typeof cut === 'object' ? cut.cutTrailIdx : cut) / BODY_BALL_SPACING));
        const sev = severedRef.current;
        sev.count = sampleSeveredTail(worm, fromBead, sev.pieces);
        for (let i = 0; i < sev.count; i++) sev.pieces[i].ring = false;
        sev.orbColors = worm.orbPickupColorsRef.current.slice();
        sev.active = sev.count > 0;
    };
    // A cut the worm survives: sever the tail, then burst the orbs it carried out
    // of their severed beads onto nearby tiles, Sonic-ring style, to be taken back
    // before they crumble (droppedOrbs.js, DroppedOrbs.jsx).
    const severAndScatter = (cut, at) => {
        const trail = worm.tileTrail.current;
        const idx = Math.min(typeof cut === 'object' ? cut.cutTrailIdx : cut, trail.count - 1);
        const origin = parseTileKey(ttAt(trail, Math.max(0, idx)), {});
        captureSeveredTail(cut);
        const lost = cutWormTail(worm, cut);
        if (!lost?.faceIds.length && !lost?.colors.length) return;
        // Lost orb j rode the middle bead of its trio; it bursts out of the severed
        // piece nearest that bead, which then stays hidden (it became the orb).
        const sev = severedRef.current;
        const orbsLeft = worm.orbPickupColorsRef.current.length;
        const froms = [];
        for (let j = 0; j < lost.colors.length; j++) {
            const bead = BASE_TAIL_LENGTH + (orbsLeft + j) * ORB_SEGMENT_GROWTH + 1;
            let best = null;
            for (let i = 0; i < sev.count; i++) {
                if (!best || Math.abs(sev.pieces[i].bead - bead) < Math.abs(best.bead - bead)) best = sev.pieces[i];
            }
            if (best) best.ring = true;
            froms.push(best ? best.pos.slice() : at);
        }
        worm.dropOrbs?.({ origin, faceIds: lost.faceIds, colors: lost.colors, segments: lost.segments, froms, at });
    };
    // Early-turn crossing watch for the hazard turn in flight (see sliceCrossing.js).
    const turnWatchRef = useRef(null);

    // One set of consequences for a slice hit, whether it is decided when the
    // hazard fires or when the head crosses a seam early in the turn.
    // Returns true when the worm died.
    const applySliceHit = (hit, axis, fallbackSlice, details = null) => {
        const hitPos = hit.cutPosition ?? worm.headInterpPos.current.toArray();
        const cutColors = worm.orbPickupColorsRef.current.slice(0, 5);
        const fatal = hit.type === 'death';
        thunkRef.current = { active: true, pos: hitPos, kind: fatal ? 'sliced' : 'cut', colors: cutColors };
        const layer = hit.sliceIndex ?? fallbackSlice;
        if (fatal) {
            deathThunkFiredRef.current = true;
            if (Number.isFinite(hit.cutDistance)) {
                captureSeveredTail(hit);
                cutWormTail(worm, hit);
            }
            // The plane that actually caught the worm, not the anchor.
            worm.killWorm({ reason: 'slice-rotation', axis, sliceIndex: layer, impactPosition: hitPos, ...details });
            return true;
        }
        severAndScatter(hit, hitPos);
        worm.feel('cut');
        // Cue the chase camera to swing out to the slice shot for the WORM'D beat,
        // then ease back to the chase (see WormChaseCamera / sliceShot.js).
        worm.cutFocusT.current = CUT_FOCUS_DURATION;
        worm.cutFocusPos.current = hitPos;
        worm.cutFocusSlice.current = { axis, layer };
        return false;
    };

    // ── Lightning storm ────────────────────────────────────────────────────────
    // While a Lightning orb's wash is up the sky marks tiles and, STORM.telegraph seconds
    // later, strikes them (lightningStorm.js decides when and where). A strike on the head
    // kills, on the body cuts the tail off there, on an enemy kills it, and on a bare tile
    // flips it into a charged wormhole that carries the worm for free. It is held by the
    // same things that hold the rest of the sim: pause, tunnels, turns, freeze beats.
    const runStorm = (store, delta) => {
        const storm = stormRef.current;
        if (stormRunRef.current !== store.wormRunId) {
            stormRunRef.current = store.wormRunId;
            clearStorm(storm);
            stormLastTRef.current = 0;
        }
        const demo = wormDemoActive(store);
        const lightning = worm.elementalType.current === 'lightning' && wormBuffs.elementalT > 0;
        // A fresh orb (or a second one claimed mid-wash) restarts the marks.
        if (lightning && wormBuffs.elementalT > stormLastTRef.current + 0.5) beginStorm(storm);
        stormLastTRef.current = lightning ? wormBuffs.elementalT : 0;
        if (storm.spots.length === 0 && storm.flashes.length === 0 && !lightning) return;
        const live = worm.phase.current === 'crawling' && !store.animState && worm.tunnelPassages.current.length === 0 &&
            !worm.padFlight?.current && worm.cutFocusT.current <= 0 && !worm.signature.current.sweep &&
            (worm.elementalFocusT?.current ?? 0) <= 0 && (worm.healPauseT?.current ?? 0) <= 0;
        if (!live) return;
        const rng = worm.rand?.current ?? Math.random;
        const fired = tickStorm(storm, Math.min(delta, 0.1), {
            spawning: lightning && !demo,
            rng,
            pick: r => {
                const trail = worm.tileTrail.current;
                const bodyCount = bodyCoverageCount(worm.tailLength.current, trail.count, size, worm.expansionAmount.current);
                const body = [];
                for (let i = 0; i < bodyCount; i++) body.push(ttAt(trail, i));
                const head = worm.pos.current;
                const avoid = collectManifoldRing(head.x, head.y, head.z, head.dirKey, size, STORM.headSafeTiles);
                for (const orb of worm.powerups.current) avoid.add(tileKeyOf(orb));
                for (const orb of worm.specials.current) avoid.add(tileKeyOf(orb));
                for (const bomb of bombsRef.current) avoid.add(tileKeyOf(bomb.tile));
                for (const spot of storm.spots) avoid.add(tileKeyOf(spot.tile));
                return pickStrikeTile({ tiles: getAllSurfaceTiles(size), body, avoid }, r);
            },
        });
        for (const spot of fired) {
            if (!useGameStore.getState().wormAlive) break;
            const key = tileKeyOf(spot.tile);
            worm.feel('cut');
            const hit = checkBlastHitWorm(worm, new Set([key]), size);
            if (hit) {
                const histEntry = hit.type === 'cut' ? shAt(worm.stepHistory.current, hit.cutTrailIdx * STEPS_PER_TILE) : null;
                const hitPos = histEntry ? histEntry.pos.toArray() : worm.headInterpPos.current.toArray();
                thunkRef.current = { active: true, pos: hitPos, kind: hit.type === 'death' ? 'struck' : 'struck-cut' };
                if (hit.type === 'death') {
                    deathThunkFiredRef.current = true;
                    worm.killWorm({ reason: 'lightning' });
                } else {
                    severAndScatter(hit.cutTrailIdx, hitPos);
                    worm.cutFocusT.current = CUT_FOCUS_DURATION;
                    worm.cutFocusPos.current = hitPos;
                    worm.cutFocusSlice.current = null;
                }
            }
            if (combatBridge.current) strikeEnemies(combatBridge.current, springSlamTiles(spot.tile, size));
            // Nothing on the tile to hurt: it flips, like any flip, but charged. An orb or a
            // bomb sitting there is left whole, and a struck worm takes the bolt instead.
            const crowded = worm.powerups.current.some(o => tileKeyOf(o) === key) ||
                worm.specials.current.some(o => tileKeyOf(o) === key) || bombsRef.current.some(b => tileKeyOf(b.tile) === key);
            if (!hit && !crowded) worm.strikeTile(spot.tile);
        }
    };

    // ── Bomb hazard state ──────────────────────────────────────────────────────
    // Bombs are a separate scheduled hazard, kept in a ref (written from the frame
    // loop, read by <HealerBombs>). Each: { id, tile:{x,y,z,dirKey}, fuse, maxFuse }.
    const bombsRef      = useRef([]);
    const bombTimerRef  = useRef(BOMB_SPAWN_INTERVAL);
    const bombSeqRef    = useRef(0);          // monotonic bomb id source
    const blastApiRef   = useRef(null);       // imperative detonation-flash handle from HealerBombs
    const occupiedTilesRef = useRef(new Set()); // scratch: body-covered tiles, rebuilt each frame
    // The Lightning orb's storm: marks, flashes and the bookkeeping that starts it. Read by
    // <LightningStrikes>; written only here, from the frame loop.
    const stormRef = useRef(null);
    if (stormRef.current === null) stormRef.current = makeStorm();
    const stormRunRef = useRef(null);
    const stormLastTRef = useRef(0);
    const slamTilesRef = useRef({ id: '', keys: new Set() }); // the tiles Spring's last landing covers
    // Bumped whenever the live bomb set gains or loses a member, so <HealerBombs>
    // can notice the change without serialising the id list every frame.
    const bombMembershipRef = useRef(0);
    const demoHazardAttemptRef = useRef(null);

    useEffect(() => {
        setWormTurnCallback(worm.queueTurn);
        return () => { setWormTurnCallback(null); };
    }, [worm.queueTurn]);

    // The countdown readout lives in the DOM HUD and reads this bridge, so leaving
    // the mode has to blank it — otherwise the last run's clock is still showing
    // when the next one mounts.
    useEffect(() => () => resetRotationClock(), []);

    // Build a fresh scramble whenever a new run starts (or on first mount).
    useEffect(() => {
        const generateScramble = () => {
            const state = useGameStore.getState();
            const story = storyLevel(state.wormStoryLevel);
            const practice = wormDemoActive(state);
            const seq = story || practice ? [] : buildWormScramble(size, SCRAMBLE_STEPS);
            scrambleSeqRef.current  = seq;
            // Reverse the sequence and every turn so the timed hazard solves the board.
            inverseQueueRef.current = story ? (story.rotateEvery ? storyRotationCycle(size) : []) : invertWormScramble(seq);

            // Reset all phase state
            gameModePhaseRef.current  = 'scrambling';
            spawnTimerRef.current     = 0;
            countdownTimerRef.current = 0;
            countdownStepRef.current  = -1;
            autoTimerRef.current      = 0;
            pendingRotRef.current     = null;
            warningProgressRef.current = 0;
            resetRotationClock();
            bombsRef.current          = [];
            bombMembershipRef.current++;
            blastApiRef.current?.clear();
            bombTimerRef.current      = BOMB_SPAWN_INTERVAL;
            // Freeze the worm until the countdown completes
            useGameStore.setState({ wormGamePhase: 'scrambling', wormCountdownStep: null, wormPaused: true });

            // Keep the full scramble and its inverse. CubeAssembly presents these
            // turns on the render clock with size-aware, non-overshooting easing;
            // the shared shuffle queue commits them without counting player moves.
            // When done, go to 'spawning' so the worm can emerge before the countdown.
            const afterShuffle = () => {
                gameModePhaseRef.current = 'spawning';
                spawnTimerRef.current    = 0;
                useGameStore.setState({ wormGamePhase: 'spawning', wormCountdownStep: null });
            };
            if (story || practice) {
                // Story reset stages its authored board before paint. Its ready
                // card requests the countdown; demo lessons stage on their next tick.
                gameModePhaseRef.current = 'active';
                useGameStore.setState({ wormGamePhase: 'active', wormPaused: true, wormCountdownStep: null });
            }
            else onAnimatedShuffle(seq, afterShuffle);
        };

        // Run immediately so the first game (where initWormMode fires before this
        // component mounts) gets a valid scramble — not just on future runId changes.
        generateScramble();

        const unsub = useGameStore.subscribe(s => s.wormRunId, generateScramble);
        return unsub;
    }, [size, onAnimatedShuffle]);

    const beginCountdown = () => {
        gameModePhaseRef.current = 'countdown';
        countdownTimerRef.current = 0;
        countdownStepRef.current = 0;
        useGameStore.setState({ wormGamePhase: 'countdown', wormCountdownStep: 3, wormPaused: true });
        feel('countdownBeat');
    };

    useFrame((_, delta) => {
        const startState = useGameStore.getState();
        const story = storyLevel(startState.wormStoryLevel);
        // Story starts with an authored body/board already staged behind its
        // briefing. Enter directly, without scrambling or reseeding that body.
        if (story && startState.wormGamePhase === 'countdown' && gameModePhaseRef.current === 'active') {
            beginCountdown();
            return;
        }
        const rotationInterval = story?.rotateEvery || ACTIVE_ROTATE_INTERVAL;
        worm.tick(delta, { bombTiles: bombsRef.current.map(b => b.tile), busy: bombsRef.current.length > 0 || warningProgressRef.current > 0 ||
            autoTimerRef.current >= rotationInterval - AUTO_ROTATE_WARNING - 0.2 });

        const deathState = useGameStore.getState();
        if (deathState.wormAlive) { liveDeathRef.current = null; deathThunkFiredRef.current = false; }
        else if (deathState.wormDeathDetails && liveDeathRef.current !== deathState.wormDeathDetails) {
            // A death the sim decided on its own (a live seam crossing, a tail bite,
            // the void) gets its shout here; hazard kills already fired theirs.
            const details = deathState.wormDeathDetails;
            liveDeathRef.current = details;
            const kind = wormdKindForDeath(details.reason);
            if (kind && !deathThunkFiredRef.current) {
                deathThunkFiredRef.current = true;
                thunkRef.current = { active: true, kind,
                    pos: details.impactPosition ?? worm.headInterpPos.current.toArray(),
                    colors: worm.orbPickupColorsRef.current.slice(0, 5) };
            }
        }

        // While a slice the worm sits on is mid-rotation during live play, ride it so the
        // worm visually turns with the cube rather than snapping into place only when the
        // rotation commits. Only meaningful on the surface (crawling); tunnel phases aren't
        // anchored to a slice, and other game phases position the worm themselves.
        if (gameModePhaseRef.current === 'active' && worm.phase.current === 'crawling') {
            rideLiveRotation(worm);
        }

        const store = useGameStore.getState();
        if (store.wormJumpRescueActive || worm.jumpRescueHeld?.current) {
            rotationClock.held = true;
            return;
        }

        // ── Phase: scrambling ──────────────────────────────────────────────────
        // Moves are sequenced by startAnimatedShuffle (called from generateScramble).
        // Here we only track the worm's visual position so it rides along with each
        // rotating slice instead of staying frozen in world space.
        if (gameModePhaseRef.current === 'scrambling') {
            if (liveRotation.active) {
                // The worm is frozen during the scramble, so tick() didn't refresh
                // headInterpPos — seed it from the flat tile position before riding the slice.
                const { x, y, z, dirKey } = worm.pos.current;
                const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
                worm.headInterpPos.current.set(wp[0], wp[1], wp[2]);
                rideLiveRotation(worm);
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
                // Seed step history so the full worm body is visible during countdown.
                // Push points trailing behind the head along the face surface (opposite
                // to the initial move direction), spaced at BODY_BALL_SPACING intervals.
                _seedNorm.copy(norm);
                const fwd = DIR_FORWARD[dirKey]?.up ?? [0, 1, 0];
                _seedBackDir.set(-fwd[0], -fwd[1], -fwd[2]);
                const segCount = BASE_TAIL_LENGTH * STEPS_PER_TILE;
                const stepSize = BODY_BALL_SPACING / STEPS_PER_TILE;
                for (let i = segCount - 1; i >= 0; i--) {
                    const d = (i + 1) * stepSize;
                    _seedPos.set(
                        wp[0] + _seedBackDir.x * d,
                        wp[1] + _seedBackDir.y * d,
                        wp[2] + _seedBackDir.z * d,
                    );
                    shPush(worm.stepHistory.current, _seedPos, _seedNorm, x, y, z);
                }

                beginCountdown();
            }
            return;
        }

        // ── Phase: countdown ──────────────────────────────────────────────────
        if (gameModePhaseRef.current === 'countdown') {
            countdownTimerRef.current += delta;

            // Idle breathing animation — gentle bob on the surface normal
            const { x, y, z, dirKey } = worm.pos.current;
            const norm = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
            const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
            const breathe = Math.sin(countdownTimerRef.current * 3.5) * 0.03;
            worm.headInterpPos.current.set(wp[0], wp[1], wp[2]).addScaledVector(norm, WORM_LIFT + breathe);

            const step = Math.floor(countdownTimerRef.current / COUNTDOWN_STEP_DURATION);
            if (step !== countdownStepRef.current) {
                countdownStepRef.current = step;
                if      (step === 0) { useGameStore.setState({ wormCountdownStep: 3 }); feel('countdownBeat'); }
                else if (step === 1) { useGameStore.setState({ wormCountdownStep: 2 }); feel('countdownBeat'); }
                else if (step === 2) { useGameStore.setState({ wormCountdownStep: 1 }); feel('countdownBeat'); }
                else if (step === 3) {
                    useGameStore.setState({ wormCountdownStep: 'go' });
                    feel('countdownGo');
                } else if (step === 4) {
                    // The final beat pulls WORM into the portal and closes it.
                    // Its staggered CSS exit fits entirely inside this beat.
                    useGameStore.setState({ wormCountdownStep: 'hold' });
                } else if (step >= 5) {
                    // Countdown done — release the worm
                    gameModePhaseRef.current = 'active';
                    autoTimerRef.current = 0;
                    pendingRotRef.current = null;
                    warningProgressRef.current = 0;
                    resetRotationClock();
                    // Give the player a full interval of breathing room before the
                    // first bomb spawns (the rotation hazard already ramps in slowly).
                    bombTimerRef.current = BOMB_SPAWN_INTERVAL;
                    useGameStore.setState({ wormGamePhase: 'active', wormCountdownStep: null, wormPaused: false });
                }
            }
            return;
        }

        // Story objectives own their ending; later challenges repeat the warned slice cycle.
        if (store.wormStoryLevel && (!story?.rotateEvery || store.wormStoryResult)) { resetRotationClock(); return; }

        // The combat arena owns its ending; ordinary bombs and solving turns stay off.
        if (store.wormCombatMode) { resetRotationClock(); return; }

        // ── Phase: solved ──────────────────────────────────────────────────────
        if (gameModePhaseRef.current === 'solved') return;

        // ── Phase: finalHealing — all rotations done, heal remaining tunnels ───
        if (gameModePhaseRef.current === 'finalHealing') {
            if (store.wormStoryLevel) return;
            if (!store.wormAlive) return;
            // Throttle the expensive tunnel scan to once every 0.5 s
            finalHealCheckTimer.current += delta;
            if (finalHealCheckTimer.current >= 0.5) {
                finalHealCheckTimer.current = 0;
                const liveState = useGameStore.getState();
                const remaining = getActiveTunnels(
                    liveState.cubies,
                    size,
                    getManifoldMap(liveState.cubies, size, liveState.rotationEpoch)
                );
                if (remaining.length === 0) {
                    gameModePhaseRef.current = 'solved';
                    liveState.finishWormXp(true, liveState.wormRunId);
                    const bodyOrbs = useGameStore.getState().wormBodyTiles ?? 0;
                    // 2× multiplier: reward for clearing all tunnels before the clock ran out
                    if (!liveState.demoMode && bodyOrbs > 0) liveState.earnCoins(bodyOrbs * EARN_ORB_COLLECT * 2);
                    // Freeze the worm — game is over; publish final time for WinnerScreen
                    useGameStore.setState({ wormGamePhase: 'solved', wormPaused: true, wormTimeAlive: Math.floor(worm.timeAliveRef.current) });
                }
            }
            return;
        }

        // ── Phase: active — inverse-rotation hazard ────────────────────────────
        if (!store.wormAlive || store.wormPaused) return;
        runStorm(store, delta);
        if (combatBridge.current?.ambient && combatBridge.current.encounter) { rotationClock.held = true; return; }
        // A head that changed sides of the turning layer early in the turn is
        // resolved as if it had been there when the turn fired. This must run
        // before the animState guard below: the hazard's own tween sets animState
        // for its whole length, which is exactly when the watch has to look.
        if (turnWatchRef.current && worm.phase.current === 'crawling') {
            const watch = turnWatchRef.current;
            const step = stepTurnWatch(watch, worm, store.rotationEpoch);
            if (step === 'done') turnWatchRef.current = null;
            else if (step === 'crossed') {
                // Stepping onto the turning layer is a crossing (fatal); stepping off it
                // leaves the body on the layer behind, which is only a tail cut.
                const hit = resolveSliceHits(worm, watch.axis, watch.layers, size, { entering: watch.headOn });
                if (hit && applySliceHit(hit, watch.axis, watch.layers[0], { liveCrossing: true })) {
                    turnWatchRef.current = null;
                    return;
                }
            }
        }

        // Do not replace an uncommitted move or classify damage in its
        // intermediate geometry. Resume the queued hazard after that commit.
        if (store.animState) { rotationClock.held = true; return; }

        // Pause the rotation hazard until the whole worm clears its wormhole: freeze the
        // clock and warning beam while even the trailing segments are still inside.
        if (worm.padFlight?.current || worm.phase.current !== 'crawling' || worm.tunnelPassages.current.length > 0) { rotationClock.held = true; return; }

        // Freeze the hazard clock in lockstep with the body-cut freeze frame: the sim is
        // frozen for this beat (see stepWormSim), so hold the auto-rotate timer and warning
        // beam steady too — otherwise the clock keeps charging behind the camera swing and
        // the next turn can fire the instant the worm resumes.
        if (worm.signature.current.sweep || worm.cutFocusT.current > 0) { rotationClock.held = true; return; }

        // Same for the elemental-claim beat — the sim is frozen for it, so the
        // auto-rotate clock must not keep charging behind the camera move.
        if ((worm.elementalFocusT?.current ?? 0) > 0) { rotationClock.held = true; return; }

        const demo = wormDemoActive(store);
        const practiceLesson = wormDemoLesson(store).id;
        if (demo) {
            const attempt = `${store.wormRunId}:${store.demoWormLessonIndex}:${store.demoWormAttempt}`;
            if (demoHazardAttemptRef.current !== attempt) {
                demoHazardAttemptRef.current = attempt;
                bombsRef.current = []; bombMembershipRef.current++;
                blastApiRef.current?.clear();
                autoTimerRef.current = 0; pendingRotRef.current = null; warningProgressRef.current = 0;
                resetRotationClock();
                if (practiceLesson === 'bomb' && store.demoWormTarget) {
                    bombsRef.current.push({ id: bombSeqRef.current++, tile: store.demoWormTarget, fuse: 25, maxFuse: 25 });
                    bombMembershipRef.current++;
                }
                if (practiceLesson === 'rotation') inverseQueueRef.current = [{ axis: 'col', sliceIndex: 0, dir: 1 }];
            }
            if (!['bomb', 'rotation'].includes(practiceLesson)) { rotationClock.held = true; return; }
        }

        // ── Bomb hazard: spawn → fuse → disarm-by-encircle → detonation ────────
        {
            // Clamp the timestep so a render stall (tab switch, GC pause) can't burn a
            // whole fuse — or the spawn clock — in one giant frame.
            const bdelta = Math.min(delta, 0.1);
            // Tiles the visible body currently covers — the same reach the wormhole
            // ring-heal uses, so surrounding a bomb reads identically to sealing a hole.
            const trail = worm.tileTrail.current;
            const occupiedCount = bodyCoverageCount(worm.tailLength.current, trail.count, size, worm.expansionAmount.current);
            // Reused across frames: a long worm rebuilds this every frame for the
            // whole run, and a fresh Set per frame is garbage the collector has to
            // come back for mid-crawl. Cleared and refilled instead.
            const occupied = occupiedTilesRef.current;
            occupied.clear();
            for (let i = 0; i < occupiedCount; i++) occupied.add(ttAt(trail, i));

            if (story?.mechanics?.bombs && worm.storyBombsNeeded?.() && bombsRef.current.length === 0 &&
                wormBuffs.elementalT <= 0) {
                bombTimerRef.current -= bdelta;
                if (bombTimerRef.current <= 0 && warningProgressRef.current <= 0) {
                    const tile = storySurfaceTile({ pos: worm.pos.current }, size, store.cubies, occupied);
                    if (tile) {
                        bombsRef.current.push({ id: bombSeqRef.current++, tile, fuse: 25, maxFuse: 25 });
                        bombMembershipRef.current++;
                        bombTimerRef.current = 10;
                    }
                }
            }

            // Spawn clock — one attempt per interval, capped by board size.
            //
            // An active elemental wash suspends it entirely: the cube is re-skinned,
            // the camera has pulled out and the player is reading a transformed
            // board, which is the worst possible moment to drop a five-second fuse
            // on them. The clock is reset to a full interval on the skip, so the
            // wash ending does not immediately hand over a bomb either.
            if (!demo && !store.wormStoryLevel) bombTimerRef.current -= bdelta;
            if (!demo && !store.wormStoryLevel && bombTimerRef.current <= 0) {
                bombTimerRef.current = BOMB_SPAWN_INTERVAL;
                if (wormBuffs.elementalT > 0) {
                    // suspended for the wash — fall through to the fuse loop below
                } else if (bombsRef.current.length < bombCap(size)) {
                    // Never spawn on or right next to the worm: exclude a no-spawn ring
                    // around the head (size-scaled), the visible body, and live bombs, so
                    // every bomb lands with room to react and detonates in open view.
                    const head = worm.pos.current;
                    const safeRadius = size <= 3 ? 1 : 2;
                    const exclSet = collectManifoldRing(head.x, head.y, head.z, head.dirKey, size, safeRadius);
                    for (const key of occupied) exclSet.add(key);
                    for (const b of bombsRef.current) exclSet.add(`${b.tile.x},${b.tile.y},${b.tile.z},${b.tile.dirKey}`);
                    const exclude = [...exclSet].map((k) => {
                        const [x, y, z, dirKey] = k.split(',');
                        return { x: +x, y: +y, z: +z, dirKey };
                    });
                    const tile = randomFreeTile(size, exclude);
                    if (tile) {
                        bombsRef.current.push({ id: bombSeqRef.current++, tile, fuse: BOMB_FUSE_SECONDS, maxFuse: BOMB_FUSE_SECONDS });
                        bombMembershipRef.current++;
                    }
                }
            }

            // Fuse / disarm / detonate. Survivors are compacted toward the front of
            // the existing array rather than collected into a new one — this runs on
            // every active frame, and the list it was rebuilding is almost always
            // unchanged.
            // Spring's landing defuses every bomb within a tile of where it touched down. The
            // covered tiles are worked out once per landing and read for as long as its window stands.
            const slamSig = worm.signature.current;
            let slamTiles = null;
            if (slamSig.slamT > 0 && slamSig.slam) {
                const slamRef = slamTilesRef.current;
                // A retry restarts the sequence at 1, so the tile is part of what makes a landing new.
                const slamId = `${slamSig.slam.seq}|${tileKeyOf(slamSig.slam.tile)}`;
                if (slamRef.id !== slamId) {
                    springSlamTiles(slamSig.slam.tile, size, slamRef.keys);
                    slamRef.id = slamId;
                }
                slamTiles = slamRef.keys;
            }
            if (bombsRef.current.length > 0) {
                const bombs = bombsRef.current;
                let kept = 0;
                for (let read = 0; read < bombs.length; read++) {
                    const bomb = bombs[read];
                    // onDeath synchronously updates the store. Preserve remaining
                    // bombs without disarms, damage or rewards after a fatal hit.
                    if (!useGameStore.getState().wormAlive) { bombs[kept++] = bomb; continue; }
                    // Disarm: body fully encircles the bomb — reward and remove it.
                    if (isBombDisarmed(bomb, occupied, size) || isBombSlammed(bomb, slamTiles)) {
                        blastApiRef.current?.disarm(bomb);
                        worm.rewardBombDisarm(bomb.tile);
                        if (demo) useGameStore.setState({ demoWormHazardCleared: 'bomb' });
                        else if (store.wormStoryLevel) worm.recordStoryBomb?.(bomb.id);
                        else useGameStore.getState().earnCoins(BOMB_DISARM_REWARD);
                        worm.feel('heal');
                        continue;
                    }
                    bomb.fuse -= bdelta * (isHotTile(worm.elementalPatches.current, bomb.tile) ? 3 : 1);
                    if (bomb.fuse > 0) { bombs[kept++] = bomb; continue; }

                    // Detonate: shoot fire out along the arms, then resolve the hit.
                    // All arms ignite on the damage frame so a distant hit never
                    // kills before its flame appears.
                    const { keys, arms, center } = computeBlastTiles(bomb, size);
                    const flames = [];
                    const pushFlame = (t, delay) => {
                        if (isHotTile(worm.elementalPatches.current, t)) return;
                        const wp = getStickerWorldPos(t.x, t.y, t.z, t.dirKey, size, 0);
                        const n = FACE_NORMALS[t.dirKey] ?? FACE_NORMALS.PZ;
                        // Flames sit just off the surface (along the normal) but lick UP
                        // along the face's "up" so they read as flames, not blobs.
                        const u = DIR_FORWARD[t.dirKey]?.up ?? [0, 1, 0];
                        flames.push({ pos: [wp[0] + n.x * 0.35, wp[1] + n.y * 0.35, wp[2] + n.z * 0.35], up: u, delay });
                    };
                    pushFlame(center, 0);
                    for (const arm of arms) arm.forEach(t => pushFlame(t, 0));
                    blastApiRef.current?.spawn(flames);
                    worm.feel('cut');

                    // The hot route is a firebreak, not blanket blast immunity.
                    for (const key of keys) {
                        if (isHotTile(worm.elementalPatches.current, key)) keys.delete(key);
                    }
                    const hit = checkBlastHitWorm(worm, keys, size);
                    if (hit) {
                        const histEntry = hit.type === 'cut'
                            ? shAt(worm.stepHistory.current, hit.cutTrailIdx * STEPS_PER_TILE)
                            : null;
                        const hitPos = histEntry ? histEntry.pos.toArray() : worm.headInterpPos.current.toArray();
                        thunkRef.current = { active: true, pos: hitPos, kind: hit.type === 'death' ? 'blasted' : 'blast-cut' };
                        if (hit.type === 'death') {
                            deathThunkFiredRef.current = true;
                            worm.killWorm({ reason: 'bomb', bombId: bomb.id });
                        } else {
                            severAndScatter(hit.cutTrailIdx, hitPos);
                            worm.cutFocusT.current = CUT_FOCUS_DURATION;
                            worm.cutFocusPos.current = hitPos;
                            worm.cutFocusSlice.current = null; // a blast, not a layer
                        }
                    }
                    // bomb consumed — not compacted into the kept range
                }
                if (kept !== bombs.length) {
                    bombs.length = kept;
                    bombMembershipRef.current++;
                }
            }
        }

        // The store snapshot above predates bomb damage. A lethal explosion must
        // not dequeue a slice or overwrite its death cue in the same frame.
        if (!useGameStore.getState().wormAlive) return;

        if (demo && (practiceLesson !== 'rotation' || (!pendingRotRef.current && inverseQueueRef.current.length === 0))) return;
        if (holdsRotationTimer(worm.signature.current)) { rotationClock.held = true; return; }
        rotationClock.held = false;
        autoTimerRef.current += Math.min(delta, 0.1);
        const warningStart = rotationInterval - AUTO_ROTATE_WARNING;

        // Arm with the NEXT inverse move the moment the cycle starts (peek, don't
        // dequeue yet). The layer stays lit for the whole ten seconds — softly at
        // first, hard through the telegraph window — so "which slice, which way"
        // is answered before the countdown gets short.
        if (!pendingRotRef.current) {
            if (inverseQueueRef.current.length === 0) {
                // All inverse moves exhausted — enter final healing phase.
                // Wormhole spawning is now blocked (checked in worm.tick).
                // Game ends only when the player heals all remaining tunnels.
                gameModePhaseRef.current = 'finalHealing';
                finalHealCheckTimer.current = 0.5; // check immediately next frame batch
                pendingRotRef.current = null;
                warningProgressRef.current = 0;
                resetRotationClock();
                useGameStore.setState({ wormGamePhase: 'finalHealing' });
                return;
            }
            // Peek the next inverse move (a parallel pair only in Mega Mode).
            pendingRotRef.current = inverseQueueRef.current[0];
        }

        // Update warning progress (0→1)
        if (pendingRotRef.current) {
            const elapsed = autoTimerRef.current - warningStart;
            warningProgressRef.current = Math.min(1, Math.max(0, elapsed / AUTO_ROTATE_WARNING));
        }

        // Publish the clock for the HUD's countdown. A plain object rather than
        // store state — this changes every frame and the readout paints itself
        // from a ref (see rotationClockBridge).
        rotationClock.armed = !!pendingRotRef.current;
        rotationClock.secondsLeft = Math.max(0, rotationInterval - autoTimerRef.current);
        rotationClock.total = rotationInterval;
        rotationClock.warning = warningProgressRef.current;
        rotationClock.axis = pendingRotRef.current?.axis ?? null;
        rotationClock.sliceIndex = pendingRotRef.current?.sliceIndex ?? null;
        // Publish every plane the armed move turns, not just the anchor — the safe
        // lane has to exclude all of them. Copied in place: the sim reads this every
        // respawn and the pending move object is a ref the queue reuses.
        {
            const _si = rotationClock.sliceIndices;
            const _pending = pendingRotRef.current;
            const _layers = _pending?.sliceIndices?.length
                ? _pending.sliceIndices
                : (typeof _pending?.sliceIndex === 'number' ? [_pending.sliceIndex] : []);
            _si.length = _layers.length;
            for (let i = 0; i < _layers.length; i++) _si[i] = _layers[i];
        }

        // Fire at the authored interval after the full warning.
        if (autoTimerRef.current >= rotationInterval && pendingRotRef.current) {
            // Delay if mid-tunnel
            if (worm.phase.current !== 'crawling') {
                autoTimerRef.current = rotationInterval - 1.5;
                return;
            }

            const { axis, dir, sliceIndex, sliceIndices, sliceDirs } = pendingRotRef.current;
            const dispatched = inverseQueueRef.current.shift();
            if (story?.rotateEvery) inverseQueueRef.current.push(dispatched); // repeat until the objective clears

            // Hit detection — the worm can be caught by EITHER spinning plane, so both
            // are resolved before anything is applied. Taking the first plane that
            // reported a hit made the outcome depend on the order the planes were listed
            // in: a tail cut on plane 0 masked a death on plane 2 and the worm walked
            // away from a turn that had it trapped. See resolveSliceHits.
            //
            // Evaluate before the turn starts, against the occupied body centre-line,
            // including the live head's partial step. It is not re-run every frame
            // (that would re-damage the same body through the tween and punish the
            // crossings rest-read protection exists to allow). Instead the rule is
            // re-applied only when the head changes sides of the turning layer early
            // in the turn (turnWatchRef, stepTurnWatch); mid-turn crossings are the
            // sim's live check (movingSliceCrossing).
            const layers = sliceIndices?.length ? sliceIndices : [sliceIndex];
            const hit = resolveSliceHits(worm, axis, layers, size);
            // Death freezes the severed body; don't keep rotating its history
            // under a stationary head during the death overlay.
            if (hit && applySliceHit(hit, axis, sliceIndex)) return;
            // Watch the head through the start of the turn, where the live check
            // lets it cross aligned faces (see stepTurnWatch).
            turnWatchRef.current = armTurnWatch(worm, axis, layers, useGameStore.getState().rotationEpoch);

            if (onRotate) {
                // liveRotation exposes ONE anchor slice (+ its direction) to the
                // chase/body bridge. If the head sits on one of the two spinning
                // planes, anchor to that plane — and its own turn direction — so the
                // worm rides the correct tween instead of snapping when the move commits.
                const axisCoord = axis === 'col' ? worm.pos.current.x
                    : axis === 'row' ? worm.pos.current.y
                    : worm.pos.current.z;
                const anchorAt = layers.indexOf(axisCoord);
                const anchorSlice = anchorAt !== -1 ? axisCoord : sliceIndex;
                const anchorDir = anchorAt !== -1 && sliceDirs?.length ? sliceDirs[anchorAt] : dir;
                onRotate(axis, anchorDir, anchorSlice, false, sliceIndices, sliceDirs);
            }

            // Reset for next cycle (fixed interval — no randomisation)
            pendingRotRef.current = null;
            warningProgressRef.current = 0;
            autoTimerRef.current = 0;
        }
    }, -0.5); // After live cubie transforms (-1), before chase camera (-0.25) and body (0).

    const wormInTunnel = wormPhaseReactive === 'windup' || wormPhaseReactive === 'entering' || wormPhaseReactive === 'tunnel' || wormPhaseReactive === 'exiting' || wormPhaseReactive === 'windout';
    const wormAlive = wormGamePhase !== 'scrambling';

    return (
        <WormLighting><PickupMaterialProvider>
            <WormChaseCamera worm={worm} size={size} />
            <DemoPracticeTargets size={size} />
            {!demoMode && (combatMode || enemiesEnabled) && <CombatScene maxEnemies={combatMode ? 4 : 1} />}
            <WormSwipeControls onTurn={worm.queueTurn} worm={worm} />
            {/* Elemental orb wash — bathes the whole cube in the claimed element. */}
            <ElementalAtmosphere size={size} />
            <BurrowEffects size={size} hidden={wormInTunnel || !wormAlive} />
            <TunnelInteriorView worm={worm} size={size} />
            {/* The shaft the camera actually rides inside — encloses the view so the
                trip reads as a tunnel rather than a ribbon crossing an empty room. */}
            <TunnelTube worm={worm} size={size} />
            {/* Always mounted — each component handles its own dissolve via worm.phase.current */}
            <group visible={wormAlive}><ElementalPatches worm={worm} size={size} /><SignatureEffects worm={worm} size={size} /><LightningStrikes stormRef={stormRef} worm={worm} size={size} /></group>
            {/* Keep the equipped body/face and their programs through retries. The
                hidden scramble frame also prepares their instanced attributes. */}
            <group ref={reflectionSource} visible={wormAlive}>
                <WormBody worm={worm} size={size} /><WormFace worm={worm} size={size} />
            </group>
            <CautionFallFX worm={worm} body={reflectionSource} />
            <WormEffectWarmup body={reflectionSource} />
            {wormAlive && <RocketExhaust worm={worm} size={size} />}
            {wormAlive && <JumpLandingMarker worm={worm} size={size} />}
            {wormAlive && glowCharacter && <WormTrail worm={worm} size={size} abilityTrail />}
            {wormAlive && <GlowWormAura worm={worm} size={size} />}
            {wormAlive && <CoreWormReflections source={reflectionSource} />}
            {wormAlive && <PortalGlow worm={worm} size={size} />}
            {wormAlive && <TunnelPortalFX worm={worm} size={size} />}
            {/* Hidden, not unmounted, for the tunnel ride. The camera is inside the
                cube then so none of this exterior decoration is visible either way,
                but tearing it down and rebuilding it cost a rebuild of nine
                InstancedMeshes, a canvas texture and every live bomb's countdown
                texture — twice per trip, once going in and once coming out. That
                rebuild is the stutter players felt entering and leaving a tunnel. */}
            <WormholeRings
                cubies={cubies}
                size={size}
                worm={worm}
                voidTunnelKeysRef={worm.voidTunnelKeysRef}
                tunnelUseCountsRef={worm.tunnelUseCountsRef}
                hidden={wormInTunnel}
            />
            <HealerBombs bombsRef={bombsRef} membershipRef={bombMembershipRef} blastApiRef={blastApiRef} size={size} hidden={wormInTunnel} />
            <TunnelHealProgress size={size} worm={worm} />
            <HealBurstSystem worm={worm} size={size} />
            <OrbFlashSystem worm={worm} />
            <SpecialFlashSystem worm={worm} />
            {wormAlive && <MagnetFX worm={worm} />}
            <PowerupOrbs size={size} worm={worm} />
            <SpecialOrbs size={size} hidden={wormInTunnel} />
            <SliceWarningLights pendingRotRef={pendingRotRef} warningProgressRef={warningProgressRef} size={size} worm={worm} />
            <SeveredTail severedRef={severedRef} />
            <DroppedOrbs worm={worm} size={size} />
            <ThunkEffect thunkRef={thunkRef} />
            <CollisionGlow size={size} />
        </PickupMaterialProvider></WormLighting>
    );
}
