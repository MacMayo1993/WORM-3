import { RaisedCubieContext } from './raisedCubieContext.js';
import { removeRaisedCubie } from './raisedCubieMotion.js';
import { padBackFace } from '../game/raisedCubie.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { FACE_COLORS } from '../utils/constants.js';
import React, { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import { K_STAR, classifyPad, flipPadPair, projectPair } from '../game/flipPad.js';
import { padPose, pairPhase, advancePadSpring } from './padPose.js';
import { padMotion, removePadMotion } from './padMotionBridge.js';

const PadContext = createContext(null);
const MAX_PADS = 2048;

function springGeometry() {
  const points = [], indices = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, angle = t * Math.PI;
    for (const side of [-1, 1]) points.push(side * 0.12 * Math.cos(angle), side * 0.12 * Math.sin(angle), t);
    if (i < 16) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// One scheduler and two instanced draws per scene, regardless of pad count.
export function PadProvider({ children, profile: profileOverride = null }) {
  const entries = useMemo(() => new Set(), []);
  const pairs = useMemo(() => new Map(), []);
  const cubieSprings = useMemo(() => new Map(), []);
  const stalkRef = useRef(), mouthRef = useRef();
  const resources = useMemo(() => ({
    stalk: springGeometry(), mouth: new THREE.PlaneGeometry(0.76, 0.76),
    stalkMaterial: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#000000', emissiveIntensity: 0, side: THREE.DoubleSide }),
    mouthMaterial: new THREE.MeshBasicMaterial({ color: '#16161a', side: THREE.DoubleSide }),
    matrix: new THREE.Matrix4(), slot: new THREE.Matrix4(), local: new THREE.Matrix4(),
    position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(), color: new THREE.Color()
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
    const motionOff = reduced.current || state.settings?.reducedMotion;
    for (const pair of pairs.values()) { pair.members.length = 0; }
    for (const entry of entries) {
      const d = entry.data.current;
      let pair = pairs.get(d.pair);
      if (!pair) { pair = { phase: pairPhase(d.pair), members: [], pose: {}, lift: 0, velocity: 0 }; pairs.set(d.pair, pair); }
      pair.members.push(entry);
    }
    for (const [key, pair] of pairs) {
      if (!pair.members.length) { removePadMotion(key, pair); pairs.delete(key); continue; }
      const a = pair.members[0].data.current;
      const b = pair.members[1]?.data.current;
      pair.wear = projectPair(a.meta.flips ?? 0, b?.meta.flips ?? 0).symmetric / cap;
      const profile = profileOverride ?? (wormMode ? 'worm' : state.chaosLevel > 0 ? 'chaos' : 'cube');
      padPose({ phase: pair.phase, wear: pair.wear, profile, worn: pair.wear >= K_STAR,
        reducedMotion: motionOff, subtle: state.settings?.flipPads === 'subtle', big: !profileOverride && state.size >= 7 }, pair.pose);
      pair.phase += dt * pair.pose.frequency;
      pair.active = state.settings?.flipPads !== 'off' && !wormMode
        && pair.members.some(e => classifyPad({ flips: e.data.current.meta.flips, cap }).lifted);
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
    for (const entry of entries) {
      const d = entry.data.current, group = entry.group.current;
      if (!group) continue;
      const pair = pairs.get(d.pair);
      // WORM stays on its proven surface route until the complete pad handoff ships.
      const enabled = state.settings?.flipPads !== 'off' && !wormMode;
      const pad = classifyPad({ flips: d.meta.flips, cap });
      const target = enabled && pad.lifted ? pair.pose.lift : 0;
      if (enabled && pad.lifted) { entry.lift = pair.lift; entry.velocity = pair.velocity; }
      else if (motionOff) { entry.lift = target; entry.velocity = 0; }
      else advancePadSpring(entry, target, dt);
      group.position.copy(d.normal).multiplyScalar(entry.lift);
      entry.cycle = pair.pose.cycle;
      entry.impact = pair.pose.impact;
      entry.wear = pair.wear;
      entry.active = enabled && pad.lifted;

      if (entry.lift <= 0.001 || count >= MAX_PADS) continue;
      let visible = true;
      for (let parent = group; parent; parent = parent.parent) {
        if (!parent.visible) { visible = false; break; }
      }
      if (!visible) continue;
      // Parent contains live cubie/layer/explode transforms. Never drag anchors.
      group.parent.updateWorldMatrix(true, false);
      resources.position.fromArray(d.pos);
      resources.quaternion.setFromEuler(d.rotation);
      resources.scale.set(1, 1, 1);
      resources.slot.compose(resources.position, resources.quaternion, resources.scale);
      resources.matrix.multiplyMatrices(group.parent.matrixWorld, resources.slot);
      // The instances live at the provider's local origin, not necessarily scene root.
      stalkRef.current.parent.updateWorldMatrix(true, false);
      resources.local.copy(stalkRef.current.parent.matrixWorld).invert();
      resources.matrix.premultiply(resources.local);
      mouthRef.current.setMatrixAt(count, resources.matrix);
      resources.scale.set(1, 1, Math.max(0.001, entry.lift));
      resources.matrix.scale(resources.scale);
      stalkRef.current.setMatrixAt(count, resources.matrix);
      resources.color.set(paletteCache.current.colors[padBackFace(d.meta)] ?? '#ffffff');
      stalkRef.current.setColorAt(count, resources.color);
      count++;
    }
    for (const ref of [stalkRef, mouthRef]) {
      ref.current.count = count;
      ref.current.instanceMatrix.needsUpdate = true;
    }
    if (stalkRef.current.instanceColor) stalkRef.current.instanceColor.needsUpdate = true;
  }, -0.5);

  return <PadContext.Provider value={entries}>
    <RaisedCubieContext.Provider value={cubieSprings}>{children}</RaisedCubieContext.Provider>
    <instancedMesh ref={stalkRef} args={[resources.stalk, resources.stalkMaterial, MAX_PADS]} count={0} frustumCulled={false} raycast={() => null} dispose={null} />
    <instancedMesh ref={mouthRef} args={[resources.mouth, resources.mouthMaterial, MAX_PADS]} count={0} frustumCulled={false} raycast={() => null} dispose={null} />
  </PadContext.Provider>;
}

export function FlipPadOffset({ meta, size, pos, rot, children }) {
  const entries = useContext(PadContext);
  const group = useRef();
  const rotation = useMemo(() => new THREE.Euler(...rot), [rot]);
  const normal = useMemo(() => new THREE.Vector3(0, 0, 1).applyEuler(rotation), [rotation]);
  const pair = flipPadPair(meta, size);
  const data = useRef();
  data.current = { meta, pos, normal, rotation, pair };
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
