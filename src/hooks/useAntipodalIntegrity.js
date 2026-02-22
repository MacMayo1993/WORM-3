// src/hooks/useAntipodalIntegrity.js
// Custom hook for computing and tracking antipodal integrity in real-time.

import { useMemo } from 'react';
import { useGameStore } from './useGameStore.js';
import { computeAntipodalIntegrity, K_STAR, getRegime } from '../game/antipodalIntegrity.js';

export function useAntipodalIntegrity() {
  const cubies = useGameStore((state) => state.cubies);
  const size = useGameStore((state) => state.size);

  const result = useMemo(() => {
    const metrics = computeAntipodalIntegrity(cubies, size);
    const regime = getRegime(metrics.integrity);
    return { ...metrics, regime, kStar: K_STAR };
  }, [cubies, size]);

  return result;
}
