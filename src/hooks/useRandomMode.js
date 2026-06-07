import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { COLOR_SCHEMES, TILE_STYLES } from '../utils/colorSchemes.js';
import { BACKGROUNDS } from '../utils/backgrounds.js';
import { clearMaterialCache } from '../3d/styles/TileStyleMaterials.jsx';

const CYCLE_MS = 15000;

const SCHEME_KEYS = Object.keys(COLOR_SCHEMES).filter(k => k !== 'biome' && k !== 'custom');
const TILE_KEYS = Object.keys(TILE_STYLES);
const BG_IDS = BACKGROUNDS.map(b => b.id);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyRandomStyle(setSettings) {
  const scheme = pick(SCHEME_KEYS);
  const tile = pick(TILE_KEYS);
  const bg = pick(BG_IDS);
  const manifoldStyles = { 1: tile, 2: tile, 3: tile, 4: tile, 5: tile, 6: tile };
  clearMaterialCache();
  setSettings(prev => ({ ...prev, colorScheme: scheme, manifoldStyles, backgroundTheme: bg }));
}

export function useRandomMode() {
  const randomMode = useGameStore(s => s.randomMode);
  const setSettings = useGameStore(s => s.setSettings);
  const showMainMenu = useGameStore(s => s.showMainMenu);
  const showSettings = useGameStore(s => s.showSettings);
  const showWelcome = useGameStore(s => s.showWelcome);
  const showTutorial = useGameStore(s => s.showTutorial);

  const inGame = !showMainMenu && !showSettings && !showWelcome && !showTutorial;

  const activeRef = useRef(false);
  activeRef.current = randomMode && inGame;

  useEffect(() => {
    if (!randomMode || !inGame) return;

    applyRandomStyle(setSettings);

    const id = setInterval(() => {
      if (activeRef.current) applyRandomStyle(setSettings);
    }, CYCLE_MS);

    return () => clearInterval(id);
  }, [randomMode, inGame, setSettings]);
}
