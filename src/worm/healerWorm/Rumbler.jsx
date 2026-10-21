// src/worm/healerWorm/Rumbler.jsx
//
// The Rumbler, drawn (model and contract in rumbler.js). Each frame, after the sim
// tick and the slice rotation and before the stickers tick:
//
//   1. advance the model, or hold it while the game is held;
//   2. publish the few cells its crests lift (rumbleBridge.js) and wake their
//      stickers, which add the lift to their fronts like the worm's press;
//   3. draw each crest as a dark band running through the grout channels of its
//      belt: one mesh per belt from a small pool, geometry built once per belt.
//
// A crest that rolls under the head gives a low rumble and a light buzz through
// the worm's feedback (held with the game like every other cue), and the first one
// a player ever meets gets a line from Mobi. Writes nothing to the simulation.

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { getManifoldGridId } from '../../game/gridIds.js';
import { activateSticker } from '../../3d/StickerAnimationManager.js';
import { liveRotation } from '../liveRotation.js';
import { wormExpansion } from '../wormExpansion.js';
import { rumbleLifts, resetRumble } from '../rumbleBridge.js';
import { rotationClock } from './rotationClockBridge.js';
import { makeRumbler, stepRumbler, collectRumbleLifts, rumbleBands, rumbleLive, MAX_RUMBLE_TILES, RUMBLE_FIRST_LINE } from './rumbler.js';
import { getBeltGeometry, makeBandMesh } from './rumbleBand.js';

// Lane, cross line, and two threatened layers (a hazard turn spins at most two).
const POOL = 4;
const SEEN_KEY = 'worm3_rumble_seen';
const AXIS_VEC = { col: new THREE.Vector3(1, 0, 0), row: new THREE.Vector3(0, 1, 0), depth: new THREE.Vector3(0, 0, 1) };

export default function Rumbler({ worm, size }) {
  const model = useRef(null);
  if (!model.current || model.current.size !== size) {
    model.current = makeRumbler(0x5eed ^ (size * 7919));
    model.current.size = size;
  }
  const meshes = useMemo(() => Array.from({ length: POOL }, makeBandMesh), []);
  const gridIds = useRef({ cubies: null, ids: new Map() });
  const passes = useRef(0);
  // The model's input, refilled in place every frame.
  const frameInput = useRef({ size, live: false, reduced: false, clock: rotationClock, head: null,
    headSlot: { tile: null, moveDir: 'up', interpT: 1 } });
  const runId = useGameStore(s => s.wormRunId);

  // A run, size or scene change starts flat and from a fresh, seeded Rumbler.
  useEffect(() => {
    model.current = makeRumbler(0x5eed ^ (size * 7919) ^ ((runId ?? 0) * 104729));
    model.current.size = size;
    passes.current = 0;
    resetRumble();
    return () => resetRumble();
  }, [size, runId]);
  useEffect(() => () => { for (const mesh of meshes) mesh.material.dispose(); }, [meshes]);

  useFrame((_state, delta) => {
    const store = useGameStore.getState();
    // Paused: everything holds exactly where it is.
    if (store.wormPaused && store.wormAlive) return;
    const state = model.current;
    const reduced = !!store.settings?.reducedMotion || prefersReducedMotion();
    const live = rumbleLive(store, worm);
    const pos = worm.pos?.current;
    const input = frameInput.current;
    input.size = size; input.live = live; input.reduced = reduced;
    input.headSlot.tile = pos; input.headSlot.moveDir = worm.moveDir?.current; input.headSlot.interpT = worm.interpT?.current ?? 1;
    input.head = pos ? input.headSlot : null;
    stepRumbler(state, input, delta);

    // ── The cells under the crests ──────────────────────────────────────────
    // Nothing lifts while a layer turns (the tiles are on the move) or the cube
    // is spread out; the bands carry the crest alone then.
    const still = liveRotation.active || wormExpansion.amount > 0.01;
    collectRumbleLifts(state, size, rumbleLifts, { reduced, max: live && !still ? MAX_RUMBLE_TILES : 0 });
    if (rumbleLifts.size) {
      const cubies = store.cubies;
      const cache = gridIds.current;
      if (cache.cubies !== cubies) { cache.cubies = cubies; cache.ids.clear(); }
      for (const key of rumbleLifts.keys()) {
        let id = cache.ids.get(key);
        if (id === undefined) {
          const [x, y, z, dirKey] = key.split(',');
          const sticker = cubies?.[+x]?.[+y]?.[+z]?.stickers?.[dirKey];
          id = sticker ? getManifoldGridId(sticker, size) : null;
          cache.ids.set(key, id);
        }
        if (id) activateSticker(id);
      }
    }

    // ── The crest rolls under the head ──────────────────────────────────────
    if (state.passes > passes.current) {
      passes.current = state.passes;
      if (live && !reduced) {
        worm.feel?.('rumble');
        let seen = true;
        try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { seen = true; }
        if (!seen) {
          try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked: say it once this run */ }
          useGameStore.setState({ wormMobiLine: { id: 'rumble', text: RUMBLE_FIRST_LINE, seq: (store.wormMobiLine?.seq ?? 0) + 1 } });
        }
      }
    }

    // ── The bands ───────────────────────────────────────────────────────────
    const bands = rumbleBands(state, input);
    const turning = liveRotation.active ? liveRotation : null;
    let used = 0;
    for (const band of bands) {
      if (used >= POOL) break;
      // A crossing layer would tear a band in two: let it go until the turn is done.
      // A band on the turning layer itself rides it round.
      const rides = turning && turning.axis === band.axis && turning.sliceIndices.includes(band.index);
      if ((turning && !rides && turning.axis !== band.axis) || wormExpansion.amount > 0.01) continue;
      const mesh = meshes[used++];
      const geometry = getBeltGeometry(size, band.axis, band.index);
      if (mesh.geometry !== geometry) mesh.geometry = geometry;
      const u = mesh.material.uniforms;
      u.uCrest.value = band.crest;
      u.uLength.value = 4 * size;
      u.uStrength.value = band.strength * (band.kind === 'threat' ? 0.95 : 0.7);
      u.uStill.value = band.still ? 1 : 0;
      if (rides) {
        const slot = turning.sliceIndices.indexOf(band.index);
        mesh.quaternion.setFromAxisAngle(AXIS_VEC[band.axis], turning.angles?.[slot] ?? turning.angle ?? 0);
      } else mesh.quaternion.identity();
      mesh.visible = true;
    }
    for (let i = used; i < POOL; i++) meshes[i].visible = false;
  }, -0.3);

  return <group name="rumbler">{meshes.map((mesh, i) => <primitive key={i} object={mesh} />)}</group>;
}
