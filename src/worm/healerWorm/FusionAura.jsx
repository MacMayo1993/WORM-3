import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../hooks/useGameStore.js';
import { wormSegments } from '../wormSegments.js';
import { wormBuffs } from '../wormBuffs.js';
import { getElementalDef } from './elementalDefs.js';

// Two small energy bands follow the head, so fusion stays visible even when the
// camera cannot see the whole cube. Fixed two-draw budget; no particle spawning.
export default function FusionAura({ base, catalyst, animate }) {
  const group = useRef();
  const elapsed = useRef(0);
  useFrame(({ camera }, delta) => {
    const root = group.current;
    if (!root) return;
    const state = useGameStore.getState();
    root.visible = state.wormAlive && state.wormPhase === 'crawling' && wormSegments.count > 0 && wormBuffs.elementalT > 0;
    if (!root.visible || state.wormPaused) return;
    elapsed.current += Math.min(delta, 0.05);
    root.position.fromArray(wormSegments.positions);
    root.quaternion.copy(camera.quaternion);
    const bloom = animate ? Math.max(0, 1 - elapsed.current / 0.8) : 0;
    root.scale.setScalar(1 + bloom * 0.7);
    root.children.forEach((band, index) => {
      band.rotation.z = index * Math.PI / 2 + (animate ? elapsed.current * (index ? -0.8 : 0.8) : 0);
      band.material.opacity = (0.5 + bloom * 0.25) * Math.min(1, wormBuffs.elementalT / 1.25);
    });
  });
  return <group ref={group} visible={false}>
    {[base, catalyst].map(type => <mesh key={type} scale={[1, 0.55, 1]} raycast={() => null}>
      <torusGeometry args={[0.38, 0.022, 4, 32]} />
      <meshBasicMaterial color={getElementalDef(type).color} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>)}
  </group>;
}
