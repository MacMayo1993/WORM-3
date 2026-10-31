import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion } from '../../utils/device.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { isCarouselActive } from './menuCarouselState.js';
import { sampleWigglingCubeWorm, carouselWormMotion, CUBE_WORM_CLEARANCE, CAROUSEL_WORM_SEGMENTS, CAROUSEL_WORM_STEP, CAROUSEL_WORM_HEAD, CAROUSEL_WORM_BODY } from './cubeWormPath.js';
import { createMenuCharacterRig } from './menuCharacterRig.js';

const CAROUSEL_WORM_SPEED = 1.1;

// Mounted INSIDE the cube's transform. No screen coordinates or independent
// world-space movement: carousel turns, wobble, scale and dive carry every part.
function CarouselCompanion({ distance, character, skinId, antipodal = false }) {
  const model = useMemo(() => {
    const rig = createMenuCharacterRig(character, {
      skinId,
      segments: CAROUSEL_WORM_SEGMENTS,
      headRadius: CAROUSEL_WORM_HEAD,
      bodyRadius: CAROUSEL_WORM_BODY,
      clearance: CUBE_WORM_CLEARANCE,
      // The carousel cube is shown big: a heavier line keeps the same weight.
      inkWidth: 0.024,
    });
    rig.group.renderOrder = 40;
    return rig;
  }, [character, skinId]);
  const pose = useMemo(() => ({ position: new THREE.Vector3(), normal: new THREE.Vector3(), forward: new THREE.Vector3(), motion: {} }), []);
  useEffect(() => () => model.dispose(), [model]);
  useFrame(() => {
    model.group.visible = isCarouselActive();
    if (!model.group.visible) return;
    const time = distance.current / CAROUSEL_WORM_SPEED;
    const reduced = prefersReducedMotion() || useGameStore.getState().settings?.reducedMotion;
    for (let i = 0; i < CAROUSEL_WORM_SEGMENTS; i++) {
      // Compression travels down the body; spacing stays positive and beads overlap.
      const contraction = reduced ? 0 : Math.sin(time * 6 - i * 0.7);
      const lag = i * CAROUSEL_WORM_STEP + 0.04 * (contraction - (reduced ? 0 : Math.sin(time * 6)));
      sampleWigglingCubeWorm(distance.current - lag, i, time, pose.position, pose.normal, pose.forward, antipodal);
      carouselWormMotion(i, time, pose.motion, reduced);
      model.pose(i, pose.position, pose.normal, pose.forward, true, time, pose.motion, reduced);
    }
    model.endFrame(time, reduced);
  });
  return <primitive object={model.group} dispose={null} />;
}

// The player's own worm, in its equipped skin, crawls the mode cube. One clock
// drives it and its twin at the antipode: each corresponding body segment is
// antipodal, even at rounded edges and while reduced motion holds the pair still.
export default function CubeGlowWorm() {
  const distance = useRef(1.8);
  const character = useGameStore(state => state.wormCharacter) || 'classic';
  const skinId = useGameStore(state => state.wormSkin) || 'slime';
  useFrame((_state, delta) => {
    const reduced = prefersReducedMotion() || useGameStore.getState().settings?.reducedMotion;
    if (isCarouselActive() && !reduced && !document.hidden) {
      distance.current += Math.min(delta, 0.05) * CAROUSEL_WORM_SPEED;
    }
  });
  return <>
    <CarouselCompanion distance={distance} character={character} skinId={skinId} />
    <CarouselCompanion distance={distance} character={character} skinId={skinId} antipodal />
  </>;
}
