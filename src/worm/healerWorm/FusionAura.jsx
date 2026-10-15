import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../hooks/useGameStore.js';
import { wormSegments } from '../wormSegments.js';
import { wormBuffs } from '../wormBuffs.js';
import { getElementalDef } from './elementalDefs.js';
import { NOVA, novaAt } from './fusionNova.js';
import { getFusion } from './elementalFusion.js';
import { fusionSigilTexture } from './fusionSigilTexture.js';

// How the fuse itself reads: two shockwaves, the base's then the catalyst's, burst out
// from the head as the ignition lands (fusionIgnition.js), then settle into the two
// small bands that follow the head for the rest of the wash, so the fusion stays
// visible even when the camera cannot see the whole cube. Over the head floats the
// recipe's sigil (fusionSigilTexture.js), the one glyph no other fusion wears, so
// Steam and Quench (the same two elements) never look alike there either.
// Fixed five-draw budget; no particle spawning. Keyed by recipe in ElementalAtmosphere,
// so a new fusion remounts it and the shockwaves play again.
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
    const fade = Math.min(1, wormBuffs.elementalT / 1.25);
    const [bands, novas, sigil] = root.children;
    if (sigil) {
      // Pops in with the fuse, then rides over the head, turning slowly.
      sigil.scale.setScalar(0.42 * (1 + bloom * 0.6));
      sigil.rotation.z = animate ? Math.sin(elapsed.current * 0.9) * 0.18 : 0;
      sigil.material.opacity = (0.9 - bloom * 0.2) * fade;
    }
    bands.scale.setScalar(1 + bloom * 0.7);
    bands.children.forEach((band, index) => {
      band.rotation.z = index * Math.PI / 2 + (animate ? elapsed.current * (index ? -0.8 : 0.8) : 0);
      band.material.opacity = (0.5 + bloom * 0.25) * fade;
    });
    // Reduced motion keeps the bands and drops the shockwaves.
    novas.children.forEach((nova, index) => {
      const wave = animate ? novaAt(elapsed.current - index * NOVA.stagger) : null;
      nova.visible = !!wave;
      if (!wave) return;
      nova.scale.setScalar(wave.radius);
      nova.material.opacity = wave.opacity;
    });
  });
  const types = [base, catalyst];
  const texture = fusionSigilTexture(getFusion(base, catalyst)?.id);
  return <group ref={group} visible={false}>
    <group>
      {types.map(type => <mesh key={type} scale={[1, 0.55, 1]} raycast={() => null}>
        <torusGeometry args={[0.38, 0.022, 4, 32]} />
        <meshBasicMaterial color={getElementalDef(type).color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>)}
    </group>
    <group>
      {types.map(type => <mesh key={type} visible={false} raycast={() => null}>
        <ringGeometry args={[0.86, 1, 48]} />
        <meshBasicMaterial color={getElementalDef(type).color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>)}
    </group>
    {texture && <mesh position={[0, 0.7, 0]} raycast={() => null} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>}
  </group>;
}
