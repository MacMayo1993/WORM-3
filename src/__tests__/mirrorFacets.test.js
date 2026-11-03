import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getTileStyleMaterial, isAnimatedStyle } from '../3d/styles/TileStyleMaterials.jsx';
import { impossibleShaders } from '../3d/styles/shaders/impossibleShaders.js';
import { TILE_STYLES } from '../utils/colorSchemes.js';
import { ALL_TILE_STYLE_KEYS } from '../utils/tileStyleCatalog.js';
import { STORE_TILES } from '../utils/storeCatalog.js';
import { resolveWizardTileStyles } from '../utils/wizardTileStyles.js';
import { STORY_WORLDS } from '../worm/story/worlds.js';
import { availableRewards, rewardChoices } from '../progression/rewards.js';
import { PLAYER_SAVE_KEY, readPlayerSave, savePlayerState, xpForLevel } from '../progression/model.js';

beforeEach(() => { vi.resetModules(); vi.stubEnv('DEV', false); localStorage.clear(); });
afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); });

it('replaces the retired tile in the store, random pool, rewards and authored worlds', () => {
  expect(STORE_TILES.find(item => item.id === 'tile_mirrorFacets'))
    .toMatchObject({ label: 'Mirror Facets', price: 225, tileKey: 'mirrorFacets' });
  expect(STORE_TILES.some(item => item.id === 'tile_mobiusBand')).toBe(false);
  expect(ALL_TILE_STYLE_KEYS).not.toContain('mobiusBand');
  expect(ALL_TILE_STYLE_KEYS.filter(key => key === 'mirrorFacets')).toHaveLength(1);
  expect(rewardChoices(30).map(item => item.id)).toContain('tile_mirrorFacets');
  for (const id of [38, 100]) expect(Object.values(STORY_WORLDS[id].styles)).toEqual(Array(6).fill('mirrorFacets'));
  for (const world of Object.values(STORY_WORLDS)) expect(Object.values(world.styles)).not.toContain('mobiusBand');
});

it('keeps the replacement static and analytic, including legacy material requests', () => {
  expect(TILE_STYLES.mirrorFacets).toMatchObject({ cost: 'low', type: 'procedural' });
  expect(TILE_STYLES.mobiusBand).toBeUndefined();
  expect(impossibleShaders.mobiusBand).toBeUndefined();
  expect(isAnimatedStyle('mirrorFacets')).toBe(false);
  // Guard against reintroducing iterative per-fragment work on the large finale.
  expect(impossibleShaders.mirrorFacets).not.toMatch(/\b(for|while|time)\b/);
  const material = getTileStyleMaterial('mirrorFacets', '#79a3e1');
  expect(getTileStyleMaterial('mobiusBand', '#79a3e1')).toBe(material);
});

it('translates legacy wizard selections without disturbing other faces', () => {
  expect(resolveWizardTileStyles({ tileStyle: 'mobiusBand', perFaceStyles: { 2: 'comic' } }))
    .toEqual({ 1: 'mirrorFacets', 2: 'comic', 3: 'mirrorFacets', 4: 'mirrorFacets', 5: 'mirrorFacets', 6: 'mirrorFacets' });
  expect(resolveWizardTileStyles({ tileStyle: 'solid', perFaceStyles: { 2: 'mobiusBand' } })[2]).toBe('mirrorFacets');
});

it.each(['legacy', 'snapshot'])('carries %s ownership and equipped faces forward without charging again', async source => {
  const owned = ['tile_mobiusBand', 'tile_mobiusBand', 'tile_comic'];
  if (source === 'legacy') {
    localStorage.setItem('worm3_owned_items', JSON.stringify(owned));
    localStorage.setItem('worm3_parity_points', '123');
  } else {
    localStorage.setItem(PLAYER_SAVE_KEY, JSON.stringify({ version: 1, progress: { xp: xpForLevel(30), claimedRewards: { 30: 'tile_mobiusBand' } }, points: 123, ownedItems: owned }));
  }
  localStorage.setItem('worm3_settings_version', '2');
  localStorage.setItem('worm3_settings', JSON.stringify({ manifoldStyles: { 1: 'mobiusBand', 2: 'comic', 3: 'solid' } }));
  const { persistedState: state } = await import('../hooks/storeSlices/persistedState.js');
  expect(state.ownedItems).not.toContain('tile_mobiusBand');
  expect(state.ownedItems.filter(id => id === 'tile_mirrorFacets')).toHaveLength(1);
  expect(state.settings.manifoldStyles).toEqual({ 1: 'mirrorFacets', 2: 'comic', 3: 'solid' });
  expect(state.parityPoints).toBe(123);
  if (source === 'snapshot') {
    expect(state.playerProgress.claimedRewards[30]).toBe('tile_mirrorFacets');
    expect(availableRewards(state.playerProgress)).not.toContain(30);
  }
  savePlayerState(state);
  expect(readPlayerSave()).toMatchObject({ points: 123, ownedItems: state.ownedItems });
  expect(JSON.parse(localStorage.getItem(PLAYER_SAVE_KEY)).ownedItems).not.toContain('tile_mobiusBand');
});

it('does not grant the replacement to players who never owned the retired tile', async () => {
  localStorage.setItem('worm3_settings', JSON.stringify({ manifoldStyles: { 1: 'mobiusBand' } }));
  const { persistedState: state } = await import('../hooks/storeSlices/persistedState.js');
  expect(state.ownedItems).not.toContain('tile_mirrorFacets');
  expect(state.settings.manifoldStyles[1]).toBe('solid');
});

it('deduplicates saves that already contain both the old and new purchase IDs', () => {
  localStorage.setItem(PLAYER_SAVE_KEY, JSON.stringify({ version: 1, progress: {}, points: 0,
    ownedItems: ['tile_mobiusBand', 'tile_mirrorFacets', 'tile_comic'] }));
  expect(readPlayerSave().ownedItems).toEqual(['tile_mirrorFacets', 'tile_comic']);
});
