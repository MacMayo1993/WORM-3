/**
 * useParityDecay Hook
 *
 * Spontaneous sticker flips intentionally disabled — tile identity must
 * remain stable regardless of flip history.  The hook is kept mounted
 * (but inert) so it can be re-enabled without touching import sites.
 */

import { useEffect } from 'react';
import { useGameStore } from './useGameStore.js';

export function useParityDecay() {
  const showMainMenu = useGameStore((s) => s.showMainMenu);
  const showWelcome = useGameStore((s) => s.showWelcome);
  const chaosLevel = useGameStore((s) => s.chaosLevel);

  useEffect(() => {
    // Body intentionally empty — spontaneous flips disabled.
    // Re-enable by restoring the decay loop here.
  }, [showMainMenu, showWelcome, chaosLevel]);
}
