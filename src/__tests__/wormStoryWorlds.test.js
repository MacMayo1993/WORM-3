import { beforeEach, expect, it } from 'vitest';
import { STORY_WORLDS, storyAppearance } from '../worm/story/worlds.js';
import { WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { COLOR_SCHEMES, DEFAULT_SETTINGS, TILE_STYLES } from '../utils/colorSchemes.js';
import { BACKGROUNDS } from '../utils/backgrounds.js';
import { makeWormSim, resetWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { stageStory } from '../worm/story/runtime.js';
import { getActiveTunnels } from '../worm/wormLogic.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress } from '../progression/model.js';
const state = () => useGameStore.getState();
const init = id => state().initWormMode(undefined, undefined, null, null, null, null, false, false, id);
beforeEach(() => {
  state().clearDisparityGame();
  useGameStore.setState({ settings: { ...DEFAULT_SETTINGS, colorScheme: 'sunset', backgroundTheme: 'lounge',
    manifoldStyles: {1:'solid',2:'comic',3:'solid',4:'comic',5:'solid',6:'comic'} },
    demoMode: false, playerProgress: { ...newProgress(), wormStory: {
      stars: Object.fromEntries(WORM_STORY_LEVELS.map(level => [level.id, 1])), claimed: {},
    } },
  });
});

it('gives every level a distinct shipped palette, material set, environment, and orb route', () => {
  const worlds = Object.values(STORY_WORLDS);
  for (const key of ['palette', 'background', 'route']) expect(new Set(worlds.map(w => w[key])).size).toBe(10);
  expect(new Set(worlds.map(w => JSON.stringify(w.styles))).size).toBe(10);
  for (const level of WORM_STORY_LEVELS) {
    const world = STORY_WORLDS[level.id];
    expect(COLOR_SCHEMES[world.palette]).toBeTruthy();
    expect(BACKGROUNDS.some(bg => bg.id === world.background)).toBe(true);
    expect(Object.keys(world.styles)).toHaveLength(6);
    for (const style of Object.values(world.styles)) expect(TILE_STYLES[style]).toBeTruthy();
  }
});

it.each(WORM_STORY_LEVELS)('keeps level $id routes unique, on safe tiles, and supplied in all six colors', level => {
  const size = level.cubeSize ?? 5;
  const sim = makeWormSim(size);
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  const staged = stageStory(sim, size, level, 'glow');
  expect(new Set(sim.powerups.map(tileKey)).size).toBe(sim.powerups.length);
  expect(getActiveTunnels(staged.cubies, size)).toHaveLength(['tunnel','collector','restore','mastery'].includes(level.kind) ? level.target : 0);
  const colors = {};
  for (const orb of sim.powerups) {
    const sticker = staged.cubies[orb.x][orb.y][orb.z].stickers[orb.dirKey];
    expect(sticker.curr).toBe(sticker.orig);
    expect(tileKey(orb)).not.toBe(tileKey(sim.pos));
    colors[sticker.curr] = (colors[sticker.curr] ?? 0) + 1;
  }
  expect(Object.keys(colors)).toHaveLength(6);
  for (const count of Object.values(colors)) expect(count).toBeGreaterThanOrEqual(4);
});

it('applies and reapplies each look on launch, retry, and next level without saving it over the player settings', () => {
  const original = structuredClone(state().settings);
  for (const level of WORM_STORY_LEVELS) {
    state().applyWormStoryLook(level.id); // intro preview
    expect(state().settings).toMatchObject(storyAppearance(level.id));
    init(level.id); init(level.id);
    expect(state().settings).toMatchObject(storyAppearance(level.id));
    expect(JSON.parse(localStorage.getItem('worm3_settings'))).toEqual(original);
  }
  state().setSettings({ ...state().settings, sfx: false });
  expect(JSON.parse(localStorage.getItem('worm3_settings'))).toEqual({ ...original, sfx: false });
  state().clearDisparityGame();
  expect(state().settings).toEqual({ ...original, sfx: false });
  expect(state().wormStoryVisualBase).toBeNull();
});

it.each(['free', 'leave'])('restores player visuals on the %s exit path', exit => {
  const original = structuredClone(state().settings);
  init(5);
  if (exit === 'free') init(null); else state().setWormHealerMode(false);
  expect(state().settings).toEqual(original);
  expect(state().wormStoryVisualBase).toBeNull();
});

it('does not apply locked levels or grant themed cosmetics to inventory', () => {
  const original = structuredClone(state().settings), owned = [...state().ownedItems];
  useGameStore.setState({ playerProgress: newProgress() });
  state().applyWormStoryLook(10); init(10);
  expect(state().settings).toEqual(original);
  init(1);
  expect(state().ownedItems).toEqual(owned);
});
