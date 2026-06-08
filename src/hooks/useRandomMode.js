import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { COLOR_SCHEMES, TILE_STYLES } from '../utils/colorSchemes.js';
import { clearMaterialCache } from '../3d/styles/TileStyleMaterials.jsx';

const CYCLE_MS = 10000;

const SCHEME_KEYS = Object.keys(COLOR_SCHEMES).filter(k => k !== 'biome' && k !== 'custom');
const TILE_KEYS = Object.keys(TILE_STYLES);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyRandomStyle(setSettings, bumpTick) {
  const scheme = pick(SCHEME_KEYS);
  const manifoldStyles = {};
  for (let i = 1; i <= 6; i++) manifoldStyles[i] = pick(TILE_KEYS);
  clearMaterialCache();
  setSettings(prev => ({ ...prev, colorScheme: scheme, manifoldStyles }));
  bumpTick();
}

export function useRandomMode() {
  const randomMode = useGameStore(s => s.randomMode);
  const setSettings = useGameStore(s => s.setSettings);
  const bumpRandomTick = useGameStore(s => s.bumpRandomTick);
  const showMainMenu = useGameStore(s => s.showMainMenu);
  const showSettings = useGameStore(s => s.showSettings);
  const showWelcome = useGameStore(s => s.showWelcome);
  const showTutorial = useGameStore(s => s.showTutorial);

  const inGame = !showMainMenu && !showSettings && !showWelcome && !showTutorial;

  const activeRef = useRef(false);
  activeRef.current = randomMode && inGame;

  useEffect(() => {
    if (!randomMode || !inGame) return;

    applyRandomStyle(setSettings, bumpRandomTick);

    const id = setInterval(() => {
      if (activeRef.current) applyRandomStyle(setSettings, bumpRandomTick);
    }, CYCLE_MS);

    return () => clearInterval(id);
  }, [randomMode, inGame, setSettings, bumpRandomTick]);
}
