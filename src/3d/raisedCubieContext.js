import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { removeRaisedCubie } from './raisedCubieMotion.js';

export const RaisedCubieContext = createContext(null);

// CubeAssembly reuses grid-slot components on a turn. Spring state must travel
// with the physical piece, not stay in the slot it left. The scene retains this
// bounded identity map until unmount, so sibling effect ordering cannot lose it.
export function useRaisedCubieSpring(identity) {
  const springs = useContext(RaisedCubieContext);
  const ref = useRef({ lift: 0, velocity: 0 });
  useLayoutEffect(() => {
    let spring = springs?.get(identity);
    if (!spring) {
      spring = { lift: 0, velocity: 0 };
      springs?.set(identity, spring);
    }
    ref.current = spring;
    return () => removeRaisedCubie(spring);
  }, [identity, springs]);
  return ref;
}
