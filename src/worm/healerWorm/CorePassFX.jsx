// src/worm/healerWorm/CorePassFX.jsx
//
// The light of a Core pass (corePass.js): when the head meets its own body in the
// Core, a double shockwave goes out from between the two, facing the lens, in gold
// over the worm's green. One pooled heal-burst rig (healBurstRig.js), mounted for
// the mode's life and hidden while idle, so the beat links no program and costs no
// React render. Render-only: it reads the sim's `corePass` and keeps its own clock,
// which holds while the game is paused.
import React, { useMemo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../hooks/useGameStore.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { makeBurstRig, poseBurstRig, tintBurstRig } from './healBurstRig.js';

/** The rig is sized for a tile; the Core's lanes are a fraction of one. */
export const CORE_PASS_FX_SCALE = 0.34;
const PASS_GOLD = '#ffd75e';

export function CorePassFX({ worm }) {
  const rig = useMemo(() => {
    const r = makeBurstRig();
    r.group.name = 'core-pass-burst';
    r.tier = 2;
    tintBurstRig(r, PASS_GOLD);
    r.core.material.color.set('#9dffcf');
    return r;
  }, []);
  const seen = useRef(null);
  useEffect(() => () => {
    for (const mesh of [rig.outer, rig.wave, rig.core, rig.flash]) mesh.material.dispose();
  }, [rig]);

  useFrame(({ camera }, dt) => {
    const pass = worm.corePass?.current;
    if (!pass) return;
    // Adopt the count on mount (and on a new run) without replaying a beat.
    if (seen.current === null || pass.seq < seen.current) seen.current = pass.seq;
    if (pass.seq !== seen.current) {
      seen.current = pass.seq;
      if (!prefersReducedMotion()) {
        rig.active = true;
        rig.t = 0;
        rig.group.position.copy(pass.head).lerp(pass.point, 0.5);
      }
    }
    if (!rig.active) { if (rig.group.visible) rig.group.visible = false; return; }
    if (!useGameStore.getState().wormPaused) rig.t += dt;
    rig.group.visible = true;
    rig.group.quaternion.copy(camera.quaternion);
    rig.group.scale.setScalar(CORE_PASS_FX_SCALE);
    if (!poseBurstRig(rig, rig.t)) { rig.active = false; rig.group.visible = false; }
  });

  return <primitive object={rig.group} />;
}
