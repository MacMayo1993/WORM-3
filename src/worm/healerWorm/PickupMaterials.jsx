import { useEffect, useRef, useState } from 'react';
import { createPickupMaterialPool } from './pickupMaterials.js';
import { PickupContext } from './usePickupMaterials.js';

export function PickupMaterialProvider({ children }) {
  const [pool] = useState(createPickupMaterialPool);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    return () => {
      // StrictMode's effect rehearsal must not destroy the retained warm set.
      // Read the live generation deliberately: a StrictMode re-setup cancels disposal.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      queueMicrotask(() => { if (generation.current === current) pool.dispose(); });
    };
  }, [pool]);
  return <PickupContext.Provider value={pool}>{children}</PickupContext.Provider>;
}

