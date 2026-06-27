import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { COLOR_SCHEMES, TILE_STYLES } from '../utils/colorSchemes.js';
import { clearMaterialCache } from '../3d/styles/TileStyleMaterials.jsx';

const CYCLE_MS = 10000;

const SCHEME_KEYS = Object.keys(COLOR_SCHEMES).filter(k => k !== 'biome' && k !== 'custom');
const TILE_KEYS = Object.keys(TILE_STYLES);

// Whole-cube "looks" from the View tab: the visualMode plus the hollow toggle.
// Treated as mutually exclusive options (one per cycle) so random mode never lands
// on an awkward combination such as hollow + wireframe — it just swaps the entire
// cube appearance the same way tapping a single View-tab button would.
const CUBE_LOOKS = [
  { visualMode: 'classic', hollowMode: false },
  { visualMode: 'grid', hollowMode: false },
  { visualMode: 'sudokube', hollowMode: false },
  { visualMode: 'wireframe', hollowMode: false },
  { visualMode: 'glass', hollowMode: false },
  { visualMode: 'classic', hollowMode: true }
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyRandomStyle(setSettings, bumpTick, setVisualMode, setHollowMode) {
  const scheme = pick(SCHEME_KEYS);
  const manifoldStyles = {};
  for (let i = 1; i <= 6; i++) manifoldStyles[i] = pick(TILE_KEYS);
  const look = pick(CUBE_LOOKS);
  clearMaterialCache();
  setSettings(prev => ({ ...prev, colorScheme: scheme, manifoldStyles }));
  // visualMode + hollowMode live on the store root, not in settings.
  setVisualMode(look.visualMode);
  setHollowMode(look.hollowMode);
  bumpTick();
}

export function useRandomMode() {
  const randomMode = useGameStore(s => s.randomMode);
  const setSettings = useGameStore(s => s.setSettings);
  const bumpRandomTick = useGameStore(s => s.bumpRandomTick);
  const setVisualMode = useGameStore(s => s.setVisualMode);
  const setHollowMode = useGameStore(s => s.setHollowMode);
  const showMainMenu = useGameStore(s => s.showMainMenu);
  const showSettings = useGameStore(s => s.showSettings);
  const showWelcome = useGameStore(s => s.showWelcome);
  const showTutorial = useGameStore(s => s.showTutorial);

  const inGame = !showMainMenu && !showSettings && !showWelcome && !showTutorial;

  const activeRef = useRef(false);
  activeRef.current = randomMode && inGame;

  useEffect(() => {
    if (!randomMode || !inGame) return;

    applyRandomStyle(setSettings, bumpRandomTick, setVisualMode, setHollowMode);

    const id = setInterval(() => {
      if (activeRef.current) applyRandomStyle(setSettings, bumpRandomTick, setVisualMode, setHollowMode);
    }, CYCLE_MS);

    return () => clearInterval(id);
  }, [randomMode, inGame, setSettings, bumpRandomTick, setVisualMode, setHollowMode]);
}
