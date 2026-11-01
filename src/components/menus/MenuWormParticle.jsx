import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isCarouselActive } from './menuCarouselState.js';
import { createMenuCharacterRig } from './menuCharacterRig.js';
import { menuWormTransitPose, menuWormGround } from './menuWormTransit.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { raisedMenuDistance } from './menuPortalFrames.js';
import { sampleMenuTunnelWorm, MENU_WORM_SPACING, MENU_WORM_RADIUS } from './menuTunnelWormPath.js';
import { registerPokeTarget, retainMenuPointer } from './menuPointer.js';
import { updatePokeTarget, pointerLookPoint } from './menuWormPoke.js';
import { feel } from '../../utils/feel.js';

// Two worms closer than this (world units) notice each other.
const GREET_RANGE = 1.5;
const POKE_POINTS = [0, 4, 8, 12];

export default function MenuWormParticle({ route, character = 'classic', elapsed, heads }) {
  const { trail } = route;
  const motion = useMemo(() => ({}), []);
  const model = useMemo(() => createMenuCharacterRig(character), [character]);
  const pose = useMemo(() => ({
    position: new THREE.Vector3(), normal: new THREE.Vector3(), forward: new THREE.Vector3(),
    look: new THREE.Vector3(), center: new THREE.Vector3(), head: new THREE.Vector3(), mouth: new THREE.Vector3(),
    beats: [false, false], greeting: null, now: 0,
  }), []);
  useEffect(() => () => model.dispose(), [model]);
  useEffect(() => {
    const release = retainMenuPointer();
    const target = registerPokeTarget(() => {
      model.poke(pose.now);
      feel('jump');
    });
    pose.target = target;
    return () => { target.release(); release(); };
  }, [model, pose]);
  useEffect(() => {
    if (!heads) return undefined;
    const entry = { id: route.id, position: pose.head, visible: false };
    heads.add(entry);
    pose.entry = entry;
    return () => heads.delete(entry);
  }, [heads, route.id, pose]);
  useFrame(state => {
    model.group.visible = !isCarouselActive() && !route.done;
    if (pose.target) pose.target.visible = false;
    if (pose.entry) pose.entry.visible = false;
    if (!model.group.visible) return;
    const time = elapsed.current;
    const now = pose.now = state.clock.elapsedTime;
    const reduced = prefersReducedMotion() || useGameStore.getState().settings?.reducedMotion;
    const distance = raisedMenuDistance(trail, route.distance);

    // Look at the player's pointer; failing that, at a worm passing nearby,
    // with a flick of the tail the first time it is spotted.
    model.group.getWorldPosition(pose.center);
    let lookAt = pointerLookPoint(pose.look, state.camera, pose.center);
    if (!lookAt && heads && pose.entry?.position) {
      let nearest = null, best = GREET_RANGE;
      for (const other of heads) {
        if (other === pose.entry || !other.visible) continue;
        const d = other.position.distanceTo(pose.head);
        if (d < best) { best = d; nearest = other; }
      }
      if (nearest) {
        lookAt = pose.look.copy(nearest.position);
        if (pose.greeting !== nearest.id) model.wag(now);
      }
      pose.greeting = nearest?.id ?? null;
    }
    model.react(now, { lookAt });

    model.segments.forEach((_, i) => {
      const segmentDistance = distance - i * MENU_WORM_SPACING;
      const visible = sampleMenuTunnelWorm(trail, segmentDistance, pose.position, pose.normal, pose.forward);
      menuWormTransitPose(route.beats, segmentDistance, i, time, motion, reduced);
      motion.ground = menuWormGround(route.beats, segmentDistance);
      model.pose(i, pose.position, pose.normal, pose.forward, visible, time, motion, reduced);
      if (i === 0) pose.mouth.copy(pose.position);
    });
    // A puff of sparks as the head pops out of its portal, and the sparks
    // sucked in after it as it dives back.
    route.beats.forEach((beat, k) => {
      if (pose.beats[k] || distance < beat.distance + (k ? 0 : 0.04)) return;
      pose.beats[k] = true;
      if (reduced) return;
      // The head is in the mouth's plane the frame it crosses it.
      model.burst(pose.mouth, route.path.normal, time, k === 0 ? { count: 12, speed: 1.0 } : { count: 10, speed: -0.9 });
    });
    model.endFrame(time, reduced);

    model.segmentWorldInto(0, pose.head);
    if (pose.entry) pose.entry.visible = model.segments[0].holder.visible;
    if (pose.target) updatePokeTarget(pose.target, model, state.camera, state.size, POKE_POINTS, Math.max(30, MENU_WORM_RADIUS * 220));
  });
  return <primitive object={model.group} dispose={null} />;
}
