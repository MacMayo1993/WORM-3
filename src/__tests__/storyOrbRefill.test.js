import { beforeEach, expect, it } from 'vitest';
import { makeWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { BODY_BALL_SPACING } from '../worm/healerWorm/constants.js';
import { ttAt } from '../worm/circularBuffers.js';
import { resetLiveRotation, liveRotation } from '../worm/liveRotation.js';
import { getActiveTunnels, findStickerByStableKey } from '../worm/wormLogic.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { WORM_STORY_LEVELS, storyLevel, storyChecklist, storyLaunchSettings, storyOutcome } from '../worm/story/levels.js';
import { stageStory, replenishStoryOrbs, STORY_ORB_REFILL_INTERVAL } from '../worm/story/runtime.js';

beforeEach(() => resetLiveRotation());
function setup(id = 6, character = 'glow') {
  const level = storyLevel(id), size = level.cubeSize, sim = makeWormSim(size);
  sim.rand = () => 0.42;
  const practice = stageStory(sim, size, level, character);
  const state = { cubies: practice.cubies, wormPaused: false, animState: null };
  const refill = (delta = 0.1) => replenishStoryOrbs(sim, practice, state, size, delta);
  const pulse = () => { practice.orbRefillDelay = 0; return refill(); };
  const colors = () => sim.powerups.reduce((counts, orb) => {
    const color = state.cubies[orb.x][orb.y][orb.z].stickers[orb.dirKey].orig;
    counts[color] = (counts[color] ?? 0) + 1;
    return counts;
  }, {});
  return { size, sim, practice, state, refill, pulse, colors };
}

it('launches all ten Chapter 1 levels on 6x6 and gives the finale four achievable goals', () => {
  for (const level of WORM_STORY_LEVELS.slice(0, 10)) expect(storyLaunchSettings(level).cubeSize).toBe(6);
  const level = storyLevel(10);
  expect(storyChecklist(level).map(({ key, target }) => [key, target])).toEqual([
    ['kills', 1], ['healed', 3], ['orbs', 24], ['rotations', 4],
  ]);
  const metrics = { alive: true, elapsed: 200, cuts: 0, kills: 1, healed: 3, orbs: 24, rotations: 4,
    remaining: 0, tailClear: true, landed: true, rotationSettled: true };
  expect(storyOutcome(level, metrics)).toMatchObject({ stars: 3 });
  for (const key of ['kills', 'healed', 'orbs', 'rotations']) expect(storyOutcome(level, { ...metrics, [key]: metrics[key] - 1 })).toBeNull();
});

it.each(['glow', 'classic'])('keeps all six colors available after repeatedly exhausting the opening supply (%s)', character => {
  const { sim, practice, refill, pulse, colors } = setup(6, character);
  const opening = sim.powerups.length;
  expect(pulse()).toBe(false); // no density growth while nothing has been picked up
  for (let round = 0; round < 10; round++) {
    sim.powerups = [];
    for (let tick = 0; tick < 14; tick++) expect(refill()).toBe(false);
    expect(sim.powerups).toHaveLength(0);
    expect(refill()).toBe(true);
    expect(Object.values(colors())).toEqual([1, 1, 1, 1, 1, 1]);
    for (let tick = 0; tick < 20; tick++) pulse();
    expect(colors()).toEqual(practice.orbTargets);
    expect(sim.powerups).toHaveLength(opening);
    expect(pulse()).toBe(false);
  }
});

it('keeps current and future tunnel mouths, the body, and special pickups clear after layer turns', () => {
  const { size, sim, practice, state, pulse, colors } = setup();
  state.cubies = rotateSliceCubies(rotateSliceCubies(state.cubies, size, 'row', 3, 1), size, 'col', 2, -1);
  sim.powerups = [];
  sim.specials = [{ x: 0, y: 0, z: 0, dirKey: 'NZ', type: 'rocket' }];
  sim.prevTile = { x: 4, y: 0, z: 5, dirKey: 'PZ' };
  const blocked = new Set([sim.pos, sim.prevTile, ...sim.specials].map(tileKey));
  for (let i = 0; i < Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) blocked.add(ttAt(sim.tileTrail, i));
  for (const tunnel of getActiveTunnels(state.cubies, size)) {
    blocked.add(tileKey(tunnel.entry)); blocked.add(tileKey(tunnel.exit));
  }
  const map = buildManifoldGridMap(state.cubies, size);
  for (const key of practice.pendingMouths) {
    const mouth = findStickerByStableKey(state.cubies, size, key, map);
    const twin = findAntipodalStickerByGrid(map, state.cubies[mouth.x][mouth.y][mouth.z].stickers[mouth.dirKey], size);
    blocked.add(tileKey(mouth)); blocked.add(tileKey(twin));
  }
  for (let tick = 0; tick < 20; tick++) pulse();
  expect(colors()).toEqual(practice.orbTargets);
  expect(new Set(sim.powerups.map(tileKey)).size).toBe(sim.powerups.length);
  for (const orb of sim.powerups) expect(blocked.has(tileKey(orb))).toBe(false);
});

it('defers a crowded board and retries once safe tiles become available', () => {
  const { size, sim, practice, pulse } = setup();
  sim.powerups = [];
  sim.specials = getAllSurfaceTiles(size).map(tile => ({ ...tile, type: 'rocket' }));
  expect(pulse()).toBe(false);
  expect(sim.powerups).toHaveLength(0);
  expect(practice.orbRefillDelay).toBe(STORY_ORB_REFILL_INTERVAL);
  sim.specials = [];
  expect(pulse()).toBe(true);
  expect(sim.powerups).toHaveLength(6);
});

it.each(['pause', 'rotation', 'transit', 'heal', 'cut', 'rescue', 'reveal', 'death'])('holds the refill clock during %s', hold => {
  const { sim, practice, state, refill } = setup();
  sim.powerups = [];
  if (hold === 'pause') state.wormPaused = true;
  if (hold === 'rotation') liveRotation.active = true;
  if (hold === 'transit') sim.phase = 'tunneling';
  if (hold === 'heal') sim.healPauseT = 1;
  if (hold === 'cut') sim.cutFocusT = 1;
  if (hold === 'rescue') sim.jumpRescueHeld = true;
  if (hold === 'reveal') sim.elementalFocusT = 1;
  if (hold === 'death') sim.alive = false;
  for (let tick = 0; tick < 100; tick++) expect(refill()).toBe(false);
  expect(practice.orbRefillDelay).toBe(STORY_ORB_REFILL_INTERVAL);
  expect(sim.powerups).toHaveLength(0);
});
