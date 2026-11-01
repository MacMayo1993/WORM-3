import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion } from '../../utils/device.js';
import { isCarouselActive } from './menuCarouselState.js';
import { lightSweepAt, LIGHT_SWEEP_PEAK } from './menuLightSweep.js';

// Every few seconds a highlight glides across the menu cube, like a product
// shot: one point light, always mounted (adding or removing a light would
// relink every lit program in the menu), swept diagonally just in front of the
// cube in camera space and dark the rest of the time. The glossy stickers and
// the worms' clearcoat catch it; reduced motion leaves it off.
export default function MenuLightSweep({ target }) {
  const light = useMemo(() => {
    const point = new THREE.PointLight('#fff7e8', 0, 0, 2);
    point.name = 'menu-light-sweep';
    return point;
  }, []);
  const scratch = useMemo(() => ({ center: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), toward: new THREE.Vector3(), sweep: { x: 0, strength: 0 } }), []);
  useFrame(state => {
    const cube = target?.current;
    if (!cube || prefersReducedMotion()) { light.intensity = 0; return; }
    // Start the first sweep a couple of seconds in, once the menu has settled.
    const sweep = lightSweepAt(state.clock.elapsedTime - 2.5, scratch.sweep);
    cube.getWorldPosition(scratch.center);
    const size = cube.scale.x * (isCarouselActive() ? 1.9 : 2.2);
    const m = state.camera.matrixWorld.elements;
    scratch.right.set(m[0], m[1], m[2]);
    scratch.up.set(m[4], m[5], m[6]);
    scratch.toward.subVectors(state.camera.position, scratch.center).normalize();
    // Top-left to bottom-right, a little in front of the cube's near face.
    light.position.copy(scratch.center)
      .addScaledVector(scratch.right, sweep.x * size)
      .addScaledVector(scratch.up, (0.55 - sweep.x * 0.45) * size)
      .addScaledVector(scratch.toward, size * 2.4);
    light.intensity = LIGHT_SWEEP_PEAK * sweep.strength * size * size / 4;
  });
  return <primitive object={light} />;
}
