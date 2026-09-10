import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../hooks/useGameStore.js';
import { createMobiModel, animateMobi, disposeMobi } from './mobiModel.js';

// Platformer adapter. The parent supplies the existing surface-facing transform.
export default function MobiModel({ radius = 0.28, orbCount = 0, alive = true }) {
  const rig = useMemo(() => createMobiModel(), []);
  const time = useRef(0);
  const pulse = useRef(0);
  const previous = useRef(orbCount);
  useEffect(() => () => disposeMobi(rig), [rig]);
  useFrame((_, delta) => {
    const dt = alive && !useGameStore.getState().wormPaused ? delta : 0;
    time.current += dt;
    if (orbCount > previous.current) pulse.current = 1;
    previous.current = orbCount;
    pulse.current = Math.max(0, pulse.current - dt * 2);
    rig.group.scale.setScalar(radius);
    animateMobi(rig, time.current, { pulse: pulse.current });
  });
  return <primitive object={rig.group} dispose={null} />;
}
