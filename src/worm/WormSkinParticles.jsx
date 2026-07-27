// src/worm/WormSkinParticles.jsx
// Thin R3F wrapper around wormSkinParticles.js's WormParticleSystem — mount
// as a child of the worm's head transform (or reposition manually, see the
// Healer-mode usage in WormBody.jsx) and it drives the ambient FX every frame.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getSkinFX } from './wormSkinFX.js';
import { WormParticleSystem } from './wormSkinParticles.js';

export default function WormSkinParticles({ skinId, glowColor }) {
  const system = useMemo(() => new WormParticleSystem(), []);
  const ref = useRef();

  useEffect(() => {
    system.configure(getSkinFX(skinId).particle, glowColor);
  }, [system, skinId, glowColor]);

  useEffect(() => () => system.dispose(), [system]);

  useFrame(({ clock }) => {
    system.update(clock.getElapsedTime());
  });

  return <primitive ref={ref} object={system.mesh} />;
}
