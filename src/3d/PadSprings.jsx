import { createPadStalkGeometry, PAD_STALK_DEPTH, PAD_BACK_CLEARANCE } from './padStalkGeometry.js';
import { RaisedCubieContext } from './raisedCubieContext.js';
import { removeRaisedCubie } from './raisedCubieMotion.js';
import { isLiveFlippedFace, padBackFace } from '../game/raisedCubie.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { FACE_COLORS } from '../utils/constants.js';
import React, { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import { flipPadPair, pairFlips, padIsWorn } from '../game/flipPad.js';
import { padPose, pairPhase, advancePadSpring, WORN_EASE } from './padPose.js';
import { padMotion, removePadMotion } from './padMotionBridge.js';
import { PadEnergy } from './PadEnergy.jsx';
import { padTremble, createEnergyFrames, MAX_ENERGY_PADS } from './padEnergy.js';

const PadContext = createContext(null);
const MAX_PADS = 2048;

// One scheduler and two instanced draws per scene, regardless of pad count.
export function PadProvider({ children, profile: profileOverride = null }) {
  const entries = useMemo(() => new Set(), []);
  const pairs = useMemo(() => new Map(), []);
  const cubieSprings = useMemo(() => new Map(), []);
  // WORM pads hover on an unstable wormhole; PadEnergy draws it from these records.
  const energyOn = useGameStore(s => !profileOverride && !!s.wormHealerMode && !s.demoMode);
  const frames = useMemo(() => createEnergyFrames(), []);
  const energyClock = useRef(0);
  const stalkRef = useRef(), mouthRef = useRef();
  const resources = useMemo(() => ({
    stalk: createPadStalkGeometry(), mouth: new THREE.PlaneGeometry(0.76, 0.76),
    stalkMaterial: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#000000', emissiveIntensity: 0, side: THREE.DoubleSide }),
    mouthMaterial: new THREE.MeshBasicMaterial({ color: '#16161a', side: THREE.DoubleSide }),
    matrix: new THREE.Matrix4(), slot: new THREE.Matrix4(), local: new THREE.Matrix4(), inverse: new THREE.Matrix4(),
    position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(), color: new THREE.Color(),
    // One pose input reused for every pair, so the frame loop allocates nothing.
    poseInput: { phase: 0, wear: 0, profile: 'cube', worn: 0, seed: 0, reducedMotion: false, subtle: false, big: false },
    tremble: { n: 0, u: 0, v: 0 }
  }), []);
  const reduced = useRef(false);
  const paletteCache = useRef({ settings: null, colors: FACE_COLORS });
  useLayoutEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = media?.matches ?? false; };
    update();
    media?.addEventListener?.('change', update);
    return () => media?.removeEventListener?.('change', update);
  }, []);
  useLayoutEffect(() => () => {
    resources.stalk.dispose(); resources.mouth.dispose();
    resources.stalkMaterial.dispose(); resources.mouthMaterial.dispose();
    for (const [key, pair] of pairs) removePadMotion(key, pair);
    pairs.clear();
    for (const spring of cubieSprings.values()) removeRaisedCubie(spring);
    cubieSprings.clear();
  }, [resources, entries, pairs, cubieSprings]);

  useFrame((_state, delta) => {
    const state = useGameStore.getState();
    const dt = !profileOverride && state.wormPauseMenuOpen ? 0 : Math.min(delta, 0.05);
    if (paletteCache.current.settings !== state.settings) {
      paletteCache.current = { settings: state.settings,
        colors: resolveColors(state.settings, state.settings?.biomeMode?.faceAssignment) ?? FACE_COLORS };
    }
    const cap = profileOverride ? 6 : selectEffectiveFlipCap(state);
    const wormMode = !profileOverride && state.wormHealerMode;
    const wormPads = wormMode && !state.demoMode;
    const motionOff = wormPads || reduced.current || state.settings?.reducedMotion;
    // The WORM landing height stays fixed for the sim; only the look is unstable.
    const energyMotion = wormPads && !reduced.current && !state.settings?.reducedMotion;
    if (wormPads) energyClock.current += dt;
    for (const pair of pairs.values()) { pair.members.length = 0; }
    for (const entry of entries) {
      const d = entry.data.current;
      let pair = pairs.get(d.pair);
      if (!pair) {
        const phase = pairPhase(d.pair);
        pair = { phase, seed: Math.floor(phase * 4294967296), worn: 0, members: [], pose: {}, lift: 0, velocity: 0 };
        pairs.set(d.pair, pair);
      }
      pair.members.push(entry);
    }
    const input = resources.poseInput;
    for (const [key, pair] of pairs) {
      if (!pair.members.length) { removePadMotion(key, pair); pairs.delete(key); continue; }
      const a = pair.members[0].data.current;
      const b = pair.members[1]?.data.current;
      const flips = pairFlips(a.meta.flips ?? 0, b ? b.meta.flips ?? 0 : null);
      pair.wear = flips / cap;
      // Ease across the worn threshold rather than snapping the rhythm.
      const wornTarget = padIsWorn(pair.wear, cap - flips) ? 1 : 0;
      pair.worn += Math.max(-dt * WORN_EASE, Math.min(dt * WORN_EASE, wornTarget - pair.worn));
      input.phase = pair.phase;
      input.wear = pair.wear;
      input.profile = profileOverride ?? (wormMode ? 'worm' : state.chaosLevel > 0 ? 'chaos' : 'cube');
      input.worn = pair.worn;
      input.seed = pair.seed;
      input.reducedMotion = motionOff;
      input.subtle = state.settings?.flipPads === 'subtle';
      input.big = !profileOverride && state.size >= 7;
      padPose(input, pair.pose);
      pair.phase += dt * pair.pose.frequency;
      let lifted = false;
      for (const member of pair.members) {
        if (isLiveFlippedFace(member.data.current.meta, cap)) { lifted = true; break; }
      }
      pair.active = (wormPads || (state.settings?.flipPads !== 'off' && !wormMode)) && lifted;
      const target = pair.active ? pair.pose.lift : 0;
      if (motionOff) { pair.lift = target; pair.velocity = 0; }
      else advancePadSpring(pair, target, dt);
      pair.animated = !motionOff;
      pair.cycle = pair.pose.cycle;
      pair.impact = pair.pose.impact;
      if (pair.active && !profileOverride) padMotion.set(key, pair);
      else removePadMotion(key, pair);
    }
    let count = 0;
    let inverseReady = false;
    for (const entry of entries) {
      const d = entry.data.current, group = entry.group.current;
      if (!group) continue;
      const pair = pairs.get(d.pair);
      // WORM uses a fixed physical landing height; cube/menu pads keep their idle bounce.
      const enabled = (wormPads || (state.settings?.flipPads !== 'off' && !wormMode));
      const lifted = enabled && isLiveFlippedFace(d.meta, cap);
      const target = lifted ? pair.pose.lift : 0;
      if (lifted) { entry.lift = pair.lift; entry.velocity = pair.velocity; }
      else if (motionOff) { entry.lift = target; entry.velocity = 0; }
      else advancePadSpring(entry, target, dt);
      group.position.copy(d.normal).multiplyScalar(entry.lift);
      let lift = entry.lift;
      if (wormPads && lifted && energyMotion) {
        // Twins share the pair seed, so they shudder together.
        const shake = padTremble(resources.tremble, energyClock.current, pair.seed);
        group.position.addScaledVector(d.normal, shake.n).addScaledVector(d.right, shake.u).addScaledVector(d.up, shake.v);
        lift += shake.n;
      }
      entry.cycle = pair.pose.cycle;
      entry.impact = pair.pose.impact;
      entry.wear = pair.wear;
      entry.active = lifted;

      if (entry.lift <= 0.001 || count >= (wormPads ? MAX_ENERGY_PADS : MAX_PADS)) continue;
      let visible = true;
      for (let parent = group; parent; parent = parent.parent) {
        if (!parent.visible) { visible = false; break; }
      }
      if (!visible) continue;
      // Parent contains live cubie/layer/explode transforms. The small bounce
      // changes only this instance, never the main tunnel geometry.
      group.parent.updateWorldMatrix(true, false);
      resources.position.fromArray(d.pos);
      resources.quaternion.setFromEuler(d.rotation);
      resources.scale.set(1, 1, 1);
      resources.slot.compose(resources.position, resources.quaternion, resources.scale);
      resources.matrix.multiplyMatrices(group.parent.matrixWorld, resources.slot);
      // The instances live at the provider's local origin, not necessarily scene
      // root. That frame is the same for every pad, so invert it once per frame.
      if (!inverseReady) {
        stalkRef.current.parent.updateWorldMatrix(true, false);
        resources.inverse.copy(stalkRef.current.parent.matrixWorld).invert();
        inverseReady = true;
      }
      resources.matrix.premultiply(resources.inverse);
      resources.color.set(paletteCache.current.colors[padBackFace(d.meta)] ?? '#ffffff');
      if (wormPads) {
        resources.matrix.toArray(frames.matrix, count * 16);
        frames.lift[count] = lift;
        frames.color[count * 3] = resources.color.r;
        frames.color[count * 3 + 1] = resources.color.g;
        frames.color[count * 3 + 2] = resources.color.b;
        // Per tile, so twins crackle differently while shuddering together.
        frames.seed[count] = (pair.seed + Math.imul(d.meta.orig ?? 0, 0x9e3779b1)) | 0;
        count++;
        continue;
      }
      mouthRef.current.setMatrixAt(count, resources.matrix);
      // Start behind the cubie's inner face and end against the entire tile
      // back. The fixed through-body section remains when the pad compresses.
      resources.local.makeTranslation(0, 0, -PAD_STALK_DEPTH);
      resources.matrix.multiply(resources.local);
      resources.scale.set(1, 1, PAD_STALK_DEPTH + Math.max(0, entry.lift) - PAD_BACK_CLEARANCE);
      resources.matrix.scale(resources.scale);
      stalkRef.current.setMatrixAt(count, resources.matrix);
      stalkRef.current.setColorAt(count, resources.color);
      count++;
    }
    frames.count = wormPads ? count : 0;
    frames.time = energyClock.current;
    frames.dt = dt;
    frames.motion = energyMotion ? 1 : 0;
    for (const ref of [stalkRef, mouthRef]) {
      ref.current.count = wormPads ? 0 : count;
      ref.current.instanceMatrix.needsUpdate = true;
    }
    if (stalkRef.current.instanceColor) stalkRef.current.instanceColor.needsUpdate = true;
  }, -0.5);

  return <PadContext.Provider value={entries}>
    <RaisedCubieContext.Provider value={cubieSprings}>{children}</RaisedCubieContext.Provider>
    <instancedMesh ref={stalkRef} args={[resources.stalk, resources.stalkMaterial, MAX_PADS]} count={0} frustumCulled={false} raycast={() => null} dispose={null} />
    <instancedMesh ref={mouthRef} args={[resources.mouth, resources.mouthMaterial, MAX_PADS]} count={0} frustumCulled={false} raycast={() => null} dispose={null} />
    {energyOn && <PadEnergy frames={frames} />}
  </PadContext.Provider>;
}

export function FlipPadOffset({ meta, size, pos, rot, children }) {
  const entries = useContext(PadContext);
  const group = useRef();
  const rotation = useMemo(() => new THREE.Euler(...rot), [rot]);
  const normal = useMemo(() => new THREE.Vector3(0, 0, 1).applyEuler(rotation), [rotation]);
  // The tile's own axes, for WORM's in-plane shudder.
  const right = useMemo(() => new THREE.Vector3(1, 0, 0).applyEuler(rotation), [rotation]);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0).applyEuler(rotation), [rotation]);
  const pair = flipPadPair(meta, size);
  const data = useRef();
  data.current = { meta, pos, normal, right, up, rotation, pair };
  const key = meta?.origPos ? `${meta.orig}:${meta.origDir}:${meta.origPos.x},${meta.origPos.y},${meta.origPos.z}` : null;
  // Only tiles with history participate; untouched Mega stickers have zero ticks.
  const history = useRef(false);
  history.current ||= (meta?.flips ?? 0) > 0;
  const hasHistory = history.current;
  useLayoutEffect(() => {
    if (!entries || !pair || !hasHistory) return;
    const entry = { key: pair, data, group, lift: 0, velocity: 0 };
    const node = group.current;
    entries.add(entry);
    return () => { entries.delete(entry); node?.position.set(0, 0, 0); };
  }, [entries, key, pair, hasHistory]);
  return <group ref={group}>{children}</group>;
}
