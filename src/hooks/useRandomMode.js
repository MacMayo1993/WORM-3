import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { COLOR_SCHEMES, TILE_STYLES } from '../utils/colorSchemes.js';

const CYCLE_MS = 10000;

const SCHEME_KEYS = Object.keys(COLOR_SCHEMES).filter(k => k !== 'biome' && k !== 'custom');
const TILE_KEYS = Object.keys(TILE_STYLES);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyRandomStyle() {
  const scheme = pick(SCHEME_KEYS);
  const manifoldStyles = {};
  for (let i = 1; i <= 6; i++) manifoldStyles[i] = pick(TILE_KEYS);
  // The bounded material cache is keyed by style and colors. Retain reusable
  // shaders instead of disposing every program at each ten-second remix.
  // Per-cubelet view styles (classic/grid/sudoku/wireframe/glass) are derived in Cubie
  // from randomStyleTick, so bumping the tick reshuffles them. Force hollow off — it's a
  // whole-cube structural mode that would hide the per-cubelet mix.
  useGameStore.setState(state => ({
    settings: { ...state.settings, colorScheme: scheme, manifoldStyles },
    hollowMode: false, randomStyleTick: state.randomStyleTick + 1,
  }));
}

export function useRandomMode() {
  const randomMode = useGameStore(s => s.randomMode);
  const showMainMenu = useGameStore(s => s.showMainMenu);
  const showSettings = useGameStore(s => s.showSettings);
  const showWelcome = useGameStore(s => s.showWelcome);
  const showTutorial = useGameStore(s => s.showTutorial);
  const wormPaused = useGameStore(s => s.wormPaused);
  const wormHealerMode = useGameStore(s => s.wormHealerMode);

  const inGame = !showMainMenu && !showSettings && !showWelcome && !showTutorial;

  const activeRef = useRef(false);
  activeRef.current = randomMode && inGame && !(wormHealerMode && wormPaused);

  useEffect(() => {
    if (!randomMode || !inGame) return;

    if (activeRef.current) applyRandomStyle();

    const id = setInterval(() => {
      if (activeRef.current) applyRandomStyle();
    }, CYCLE_MS);

    return () => clearInterval(id);
  }, [randomMode, inGame]);
}
