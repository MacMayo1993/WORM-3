import { menuCharacterPair } from './menuCharacterRig.js';
import React, { useRef, useMemo, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MenuPortalContext } from './menuPortalContext.js';
import MenuWormParticle from './MenuWormParticle.jsx';
import { createMenuWormTraffic, advanceMenuWormTraffic } from './menuWormTraffic.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { isCarouselActive } from './menuCarouselState.js';

const waveGeometry = new THREE.RingGeometry(0.8, 1, 32);
const portalGeometry = new THREE.RingGeometry(0.19, 0.23, 40);

// One paused clock and one lock table drive every menu worm and portal.
// There is deliberately no wall-clock timeout that can rotate a cube mid-worm.
export default function MenuFlipWave({ origins, onComplete, characterCycle = 0 }) {
  const frames = useContext(MenuPortalContext);
  const mouths = useRef([]);
  const traffic = useMemo(() => createMenuWormTraffic(characterCycle), [characterCycle]);
  const elapsed = useRef(0);
  const root = useRef();
  const waves = useRef([]);
  const portals = useRef([]);
  const finished = useRef(false);
  useFrame((_state, delta) => {
    if (root.current) root.current.visible = !isCarouselActive();
    if (isCarouselActive() || document.hidden) return;
    elapsed.current += Math.min(delta, 0.05);
    const reduced = prefersReducedMotion() || useGameStore.getState().settings?.reducedMotion;
    const done = advanceMenuWormTraffic(traffic, delta, frames, reduced);
    if (done && !finished.current) { finished.current = true; onComplete?.(); }
    origins?.forEach((origin, i) => {
      const frame = frames?.find(item => item.dir === origin.dir);
      if (frame?.active && mouths.current[i]) mouths.current[i].matrix.copy(frame.matrix);
    });
    const p = Math.min(1, elapsed.current / 0.8);
    const eased = 1 - (1 - p) ** 3;
    waves.current.forEach(ring => {
      if (!ring) return;
      ring.scale.setScalar(0.2 + eased * 0.65);
      ring.material.opacity = (1 - eased) * 0.6;
    });
    portals.current.forEach(ring => {
      if (!ring) return;
      ring.scale.setScalar(1 + Math.sin(elapsed.current * 3) * 0.06);
      ring.material.opacity = 0.38 + Math.sin(elapsed.current * 3) * 0.12;
    });
  }, -0.1);
  if (!origins || origins.length < 2) return null;
  return <group ref={root}>
    {origins.map((origin, i) => <group key={i} ref={el => { mouths.current[i] = el; }} matrixAutoUpdate={false}>
      <mesh position={[0, 0, 0.012]} ref={el => { waves.current[i] = el; }} geometry={waveGeometry} scale={0.01}>
        <meshBasicMaterial color={origin.color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.014]} ref={el => { portals.current[i] = el; }} geometry={portalGeometry}>
        <meshBasicMaterial color={origin.color} transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>)}
    {traffic.routes.map((route, i) => <MenuWormParticle key={route.id}
      route={route} character={menuCharacterPair(characterCycle + i)[0]} elapsed={elapsed}
    />)}
  </group>;
}
