import { useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { createCubieBodyBatches } from './cubieBodyBatches.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { CubieBodyBatchContext } from './cubieBodyBatchContext.js';

// See cubieBodyBatches.js. WORM's transparent shells were the reason it was built;
// the other modes' opaque bodies join it too, one draw per look instead of one per
// piece. Only WORM passes `materialFor` (the exterior portal bore).
export function CubieBodyBatchProvider({ enabled, materialFor, children }) {
  const pool = useMemo(() => enabled ? createCubieBodyBatches(4096, materialFor) : null, [enabled, materialFor]);
  useLayoutEffect(() => () => pool?.dispose(), [pool]);
  // Priority 0: after slice turns, raised pieces and live expansion (negative
  // priorities) have moved the cubies, and after the exterior's visibility is set.
  useFrame(({ camera }) => {
    if (!pool) return;
    const state = useGameStore.getState();
    pool.setShadows(!state.perfReducedFX);
    // Picture-in-picture views render the cube from other cameras.
    pool.update(state.showAntipodalPiP || state.settings?.livePortalViews === true ? null : camera);
  });
  return <CubieBodyBatchContext.Provider value={pool}>
    {children}
    {pool && <primitive object={pool.group} />}
  </CubieBodyBatchContext.Provider>;
}
