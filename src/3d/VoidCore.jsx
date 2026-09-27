/**
 * VoidCore
 *
 * The cube's heart: the one point every wormhole passes through, and the only
 * point the antipodal map leaves where it is. A black-plastic piece carries a
 * glossy portal ring round a porthole on each face (the tunnels dock in them),
 * each porthole swirls with its antipode's colour, and through them you see a
 * heart at the origin showing the faces from the far side, circled by three
 * gimbal rings that each carry a pair of beads that are always antipodal. Flips
 * light the heart, send a front across it from the flipped face to its antipode,
 * flare both ports and spin the gimbals up; the more of the network is alive,
 * the brighter it burns. Once the cube is opened (Explode, glass, gap, hollow)
 * the heart also lights the pieces around it. Parts and shaders live in
 * voidCoreParts.js.
 *
 * Visible on all cube sizes. For odd-sized cubes (3×3, 5×5) the center
 * cubie is skipped in CubeAssembly so VoidCore fills that space. For
 * even-sized cubes (2×2, 4×4) the origin is a natural gap between cubies.
 *
 * It is deliberately axis-aligned (NOT rotated): each ring faces the same way as
 * the matching centre tile of the real cube, so every tunnel docks on its
 * colour's ring and leaves through the antipodal one. WORM closes the portholes
 * so the piece conceals the turn; other modes leave them open onto the heart.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { isMobile } from '../utils/device.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import {
  CORE_FACES, GYRO_AXES, HEART_MAX_SWELL,
  createVoidCoreParts, disposeVoidCoreParts, paintCoreColors,
  countFlippedStickers, networkCharge, interiorExposure, faceForDirKey
} from './voidCoreParts.js';

// Each gimbal holds its own axis: local X is laid on the axis, then the ring
// turns about it while its beads run round the ring.
const GYRO_BASE = { x: [0, 0, 0], y: [0, 0, Math.PI / 2], z: [0, -Math.PI / 2, 0] };
const GYRO_SPIN = [0.32, -0.41, 0.37];
const GYRO_BEADS = [0.9, -1.1, 1.25];
// A resting pose that already reads as three separate rings (and is what
// reduced motion keeps).
const GYRO_SPIN_START = [0.4, 1.3, 2.2];
const GYRO_BEAD_START = [0.3, 1.9, 3.6];

const FLIP_SWEEP_S = 0.9;
const LIGHT_WARM = new THREE.Color('#ffe7c2');
const _tint = new THREE.Color();

function VoidCore() {
  const cubies = useGameStore(s => s.cubies);
  const wormMode = useGameStore(s => s.wormHealerMode);
  const settings = useGameStore(s => s.settings);
  const reducedFX = useGameStore(s => s.perfReducedFX);

  const faceColors = useMemo(
    () => resolveColors(settings, settings?.biomeMode?.faceAssignment) || {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings?.colorScheme, settings?.biomeMode?.faceAssignment, settings?.customColors]
  );
  const charge = useMemo(() => networkCharge(countFlippedStickers(cubies)), [cubies]);

  const parts = useMemo(() => createVoidCoreParts({ performanceMode: isMobile }), []);
  useEffect(() => () => disposeVoidCoreParts(parts), [parts]);
  useLayoutEffect(() => { paintCoreColors(parts, faceColors); }, [parts, faceColors]);
  // Read live each frame without allocating a new query every time.
  const motionQuery = useMemo(() => (typeof window === 'undefined' ? null : window.matchMedia?.('(prefers-reduced-motion: reduce)')), []);

  const heartRef = useRef();
  const lightRef = useRef();
  const spinRefs = useRef([]);
  const ringRefs = useRef([]);
  const fx = useRef(null);
  if (!fx.current) {
    fx.current = {
      time: 0, spin: [...GYRO_SPIN_START], beads: [...GYRO_BEAD_START],
      flash: 0, flipT: 0, flare: new Array(6).fill(0),
      tint: LIGHT_WARM.clone(), tintMix: 0,
      seenPulse: useGameStore.getState().flipPulse?.at ?? null
    };
  }

  useFrame((_, rawDt) => {
    const f = fx.current;
    const state = useGameStore.getState();
    const dt = Math.min(rawDt, 0.05);
    const still = !!(state.settings?.reducedMotion || motionQuery?.matches);
    const held = wormMode && state.wormPaused;

    // A new flip: flash the heart, flare the two ports its tunnel runs through,
    // start the front across the heart and tint the light with its colour.
    const pulse = state.flipPulse;
    if (pulse && pulse.at !== f.seenPulse) {
      f.seenPulse = pulse.at;
      const last = state.moveHistory?.[state.moveHistory.length - 1];
      const face = last?.type === 'flip' && last.timestamp === pulse.at ? faceForDirKey(last.dirKey) : null;
      f.flash = 1;
      if (face) {
        f.flare[face - 1] = 1;
        f.flare[ANTIPODAL_COLOR[face] - 1] = 1;
        const dir = CORE_FACES[face - 1].dir;
        parts.heartUniforms.uFlipDir.value.set(dir[0], dir[1], dir[2]);
      }
      if (!still) f.flipT = 0.0001;
      if (pulse.color) {
        parts.heartUniforms.uFlipColor.value.set(pulse.color);
        f.tint.set(pulse.color);
        f.tintMix = 1;
      }
    }

    if (!held) {
      const boost = 1 + f.flash * 4;
      if (!still) {
        f.time += dt;
        for (let i = 0; i < 3; i++) {
          f.spin[i] += GYRO_SPIN[i] * boost * dt;
          f.beads[i] += GYRO_BEADS[i] * boost * dt;
        }
      }
      f.flash *= Math.exp(-dt * 2.5);
      f.tintMix *= Math.exp(-dt * 1.2);
      for (let i = 0; i < 6; i++) f.flare[i] *= Math.exp(-dt * 1.8);
      if (f.flipT > 0) f.flipT = f.flipT + dt / FLIP_SWEEP_S >= 1 ? 0 : f.flipT + dt / FLIP_SWEEP_S;
    }

    const breath = still ? 1 : 1 + 0.08 * Math.sin(f.time * 1.6);
    const energy = (0.35 + 0.65 * charge) * breath;

    const heart = parts.heartUniforms;
    heart.uTime.value = f.time;
    heart.uEnergy.value = energy;
    heart.uFlash.value = f.flash;
    heart.uFlipT.value = f.flipT;
    const mouth = parts.mouthUniforms;
    mouth.uTime.value = f.time;
    mouth.uEnergy.value = energy;
    for (let i = 0; i < 6; i++) mouth.uFlare.value[i] = f.flare[i];
    parts.portGlow.value = (wormMode ? 0.3 : 0.16) + f.flash * 0.35;

    if (heartRef.current) heartRef.current.scale.setScalar(still ? 1 : 1 + (HEART_MAX_SWELL - 1) * f.flash);
    for (let i = 0; i < 3; i++) {
      const spin = spinRefs.current[i], ring = ringRefs.current[i];
      if (spin) spin.rotation[GYRO_AXES[i].axis] = f.spin[i];
      if (ring) ring.rotation.z = f.beads[i];
    }
    parts.materials.gyro.forEach(m => m.color.setScalar(0.75 + 0.5 * energy + f.flash * 0.6));

    _tint.copy(LIGHT_WARM).lerp(f.tint, 0.65 * f.tintMix);
    parts.haloUniforms.uColor.value.copy(_tint);
    // The corona round the piece grows with the network it anchors.
    parts.haloUniforms.uSize.value = 0.8 + 0.7 * charge + 0.3 * f.flash;
    parts.haloUniforms.uIntensity.value = (0.18 + 0.35 * energy) * (1 + f.flash * 1.5);

    const light = lightRef.current;
    if (light) {
      const exposure = wormMode || state.perfReducedFX ? 0 : interiorExposure(state);
      light.color.copy(_tint);
      light.intensity = exposure * (0.5 + 1.1 * energy) * (1 + f.flash * 1.5);
    }
  });

  const { materials } = parts;

  return (
    <>
      {wormMode ? (
        <group name="worm-solid-core">
          {/* An opaque junction conceals the half-turn. The head and then the tail
              enter one ring's mouth and emerge from the antipodal one, with real
              occlusion. */}
          <mesh name="worm-core-body" geometry={parts.plates} material={materials.plastic} />
          <mesh name="worm-core-edges" geometry={parts.cage} material={materials.plastic} />
          <mesh name="worm-core-ports" geometry={parts.ports} material={materials.port} />
          <mesh name="worm-core-mouths" geometry={parts.mouths} material={materials.mouthSolid} />
        </group>
      ) : (
        <group name="void-core">
          <mesh name="void-core-edges" geometry={parts.cage} material={materials.plastic} />
          <mesh name="void-core-plates" geometry={parts.plates} material={materials.plastic} />
          <mesh name="void-core-ports" geometry={parts.ports} material={materials.port} />
          <mesh name="void-core-mouths" geometry={parts.mouths} material={materials.mouthGlow} />
          <mesh name="void-core-heart" ref={heartRef} geometry={parts.heart} material={materials.heart} />
          {!reducedFX && GYRO_AXES.map(({ axis }, i) => (
            <group key={axis} ref={el => { spinRefs.current[i] = el; }}>
              <group rotation={GYRO_BASE[axis]}>
                <mesh
                  name={`void-core-gimbal-${axis}`}
                  ref={el => { ringRefs.current[i] = el; }}
                  geometry={parts.gyro[i]}
                  material={materials.gyro[i]}
                />
              </group>
            </group>
          ))}
          <mesh name="void-core-halo" geometry={parts.halo} material={materials.halo} frustumCulled={false} />
        </group>
      )}
      {/* Mounted in every mode (dark in WORM) so switching modes never changes
          the scene's light count and recompiles every lit material. No distance
          decay: the heart sits a hair from its own shell, and a physical 1/d²
          falloff would blow that out while barely reaching the pieces around
          it. This lights both evenly, then fades at the edge. */}
      {!isMobile && <pointLight name="void-core-light" ref={lightRef} intensity={0} distance={4.5} decay={0} />}
    </>
  );
}

export default VoidCore;
