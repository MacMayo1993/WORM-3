import React, { useEffect, useMemo, useRef, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isCarouselActive } from './menuCarouselState.js';
import { createMenuCharacterRig } from './menuCharacterRig.js';
import { createRaisedMenuTrail, updateRaisedMenuTrail, raisedMenuDistance } from './menuPortalFrames.js';
import { MenuPortalContext } from './menuPortalContext.js';
import { makeMenuTunnelWormPath, sampleMenuTunnelWorm, MENU_WORM_SPACING, MENU_WORM_SPEED } from './menuTunnelWormPath.js';

export default function MenuWormParticle({ start, character = 'classic', elapsed, arcPhase = 0, antipodal = false, delay = 0, onComplete }) {
  const frames = useContext(MenuPortalContext);
  const path = useMemo(() => makeMenuTunnelWormPath(start, arcPhase), [start, arcPhase]);
  const trail = useMemo(() => createRaisedMenuTrail(path), [path]);
  const completed = useRef(false);
  const model = useMemo(() => createMenuCharacterRig(character), [character]);
  const pose = useMemo(() => ({ position: new THREE.Vector3(), normal: new THREE.Vector3(), forward: new THREE.Vector3() }), []);
  useEffect(() => () => model.dispose(), [model]);
  useFrame(() => {
    model.group.visible = !isCarouselActive();
    if (!model.group.visible) return;
    const time = elapsed.current - delay;
    updateRaisedMenuTrail(path, trail, frames, antipodal);
    const distance = raisedMenuDistance(trail, time * MENU_WORM_SPEED);
    model.segments.forEach((_, i) => {
      const visible = sampleMenuTunnelWorm(trail, distance - i * MENU_WORM_SPACING, pose.position, pose.normal, pose.forward);
      model.pose(i, pose.position, pose.normal, pose.forward, visible, time);
    });
    if (!completed.current && time >= path.duration) { completed.current = true; onComplete?.(); }
  });
  return <primitive object={model.group} dispose={null} />;
}
