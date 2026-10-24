import { createContext, useContext } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { cubieKicks } from './cubieKick.js';
import { burrowBridge } from '../worm/burrowBridge.js';

// Every cubie used to carry a frame callback of its own for its lift, kick and
// pop offsets: 1,178 on a 15×15, nearly all returning on the first check because
// the piece was at rest. CubeAssembly now runs one callback (CubieTickDriver) over
// the cubies that are moving. A cubie's tick returns whether it is still moving;
// one that is not leaves the active set until something wakes it: its own render
// raising it, or a board-wide cause (a kick, a pop, a burrow), on whose frames
// every cubie ticks as each used to.

// Cube-pop bursts (the little outward hops on a disparity heal tap) touch only a
// handful of cubies and never fire in Worm/Mega mode at all. One module-level
// subscription flips this flag whenever the pop map gains or loses entries.
// subscribeWithSelector (used by the store) fires the listener only when the
// cubiePops reference actually changes, so Object.keys runs rarely.
let anyPops = false;
useGameStore.subscribe(
  (s) => s.cubiePops,
  (pops) => { anyPops = !!pops && Object.keys(pops).length > 0; }
);
export const anyCubiePops = () => anyPops;

export function createCubieTicks() {
  const ticks = new Set(), active = new Set();
  return {
    register(tick) {
      ticks.add(tick); active.add(tick);
      return () => { ticks.delete(tick); active.delete(tick); };
    },
    wake(tick) { if (ticks.has(tick)) active.add(tick); },
    run(delta) {
      const everyone = cubieKicks.size > 0 || anyPops || (burrowBridge.current?.wakeCubies?.size ?? 0) > 0;
      // Deleting the entry being visited is safe in a Set's for-of.
      for (const tick of everyone ? ticks : active) {
        if (tick(delta)) active.add(tick);
        else active.delete(tick);
      }
    },
    activeCount: () => active.size
  };
}

const CubieTicksContext = createContext(null);
export const CubieTicksProvider = CubieTicksContext.Provider;
export const useCubieTicks = () => useContext(CubieTicksContext);
