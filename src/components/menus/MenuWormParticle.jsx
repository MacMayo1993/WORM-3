import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isCarouselActive } from './menuCarouselState.js';
import { createMenuCharacterRig } from './menuCharacterRig.js';
import { menuWormTransitPose } from './menuWormTransit.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { raisedMenuDistance } from './menuPortalFrames.js';
import { sampleMenuTunnelWorm, MENU_WORM_SPACING } from './menuTunnelWormPath.js';

export default function MenuWormParticle({ route, character = 'classic', elapsed }) {
  const { trail } = route;
  const motion = useMemo(() => ({}), []);
  const model = useMemo(() => createMenuCharacterRig(character), [character]);
  const pose = useMemo(() => ({ position: new THREE.Vector3(), normal: new THREE.Vector3(), forward: new THREE.Vector3() }), []);
  useEffect(() => () => model.dispose(), [model]);
  useFrame(() => {
    model.group.visible = !isCarouselActive() && !route.done;
    if (!model.group.visible) return;
    const time = elapsed.current;
    const reduced = prefersReducedMotion() || useGameStore.getState().settings?.reducedMotion;
    const distance = raisedMenuDistance(trail, route.distance);
    model.segments.forEach((_, i) => {
      const segmentDistance = distance - i * MENU_WORM_SPACING;
      const visible = sampleMenuTunnelWorm(trail, segmentDistance, pose.position, pose.normal, pose.forward);
      menuWormTransitPose(route.beats, segmentDistance, i, time, motion, reduced);
      model.pose(i, pose.position, pose.normal, pose.forward, visible, time, motion, reduced);
    });
  });
  return <primitive object={model.group} dispose={null} />;
}
