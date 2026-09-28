import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPickupMaterials, resetPickupMaterials } from './pickupMaterials.js';

export const PickupContext = createContext(null);

export function usePickupPool() { return useContext(PickupContext); }

export function usePickupMaterials(color) {
  const pool = usePickupPool();
  const [materials, setMaterials] = useState(null);
  const leaseRef = useRef(null);
  useLayoutEffect(() => {
    // Acquire only after commit: abandoned/concurrent renders own no pool slots.
    // Keep the same lease through StrictMode's effect rehearsal. A real return
    // waits until host detachment, so old material primitives cannot clobber a
    // new burst that borrows the set in the same React commit.
    if (!leaseRef.current || leaseRef.current.pool !== pool) {
      leaseRef.current = { pool, set: pool ? pool.acquire() : createPickupMaterials(), generation: 0 };
    }
    const lease = leaseRef.current, generation = ++lease.generation;
    setMaterials(lease.set);
    return () => queueMicrotask(() => {
      if (lease.generation !== generation) return;
      if (pool) pool.release(lease.set);
      else Object.values(lease.set).forEach(material => material.dispose());
      if (leaseRef.current === lease) leaseRef.current = null;
    });
  }, [pool]);
  useLayoutEffect(() => { if (materials) resetPickupMaterials(materials, color); }, [materials, color]);
  return materials;
}
