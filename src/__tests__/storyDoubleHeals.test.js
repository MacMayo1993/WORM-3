// Double heals must be fair. A double heal seals one pair while another pair's heal
// still rides in the body. Story opens at most two pairs at a time, so with the old
// supply (the next pair waited for every tail to clear) a level could never earn more
// than one per two pairs: four levels asked for more than that, and eight allowed no
// mistakes at all. And on 3×3/4×4 the two pairs open together sat on one corner cubie,
// twins on the opposite corner, so finishing one pair meant a planned corner jump onto
// the other. Passes come from the same chained rides, so the same spare holds for them.
import { afterEach, describe, it, expect } from 'vitest';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { stageStory, replenishStoryTunnel, storyMouths, storyBodyPath } from '../worm/story/runtime.js';
import { storyLevel } from '../worm/story/levels.js';
import { getActiveTunnels } from '../worm/wormLogic.js';
import { flipStickerPair, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

afterEach(resetLiveRotation);

const LEVELS = Array.from({ length: 120 }, (_, i) => storyLevel(i + 1)).filter(Boolean);
const TUNNEL_KINDS = ['tunnel', 'collector', 'restore', 'mastery'];

describe('double-heal supply', () => {
  it('every double-heal level allows at least one missed double heal', () => {
    for (const level of LEVELS) {
      const need = level.mechanics?.multiHeals ?? 0;
      if (!need) continue;
      expect(TUNNEL_KINDS).toContain(level.kind);
      // Chained, P pairs can give P - 1 double heals; ask for at most P - 2.
      expect(need, `level ${level.id}`).toBeLessThanOrEqual(level.target - 2);
    }
  });

  // A pass is the same move as a double heal: diving into the next pair while the
  // tail is still in the last. P pairs chain P - 1 times, so the same spare applies.
  // (Re-entering a pair from its far end also counts, but no level should need it.)
  it('every pass level allows at least one missed pass', () => {
    for (const level of LEVELS) {
      const need = level.mechanics?.selfPasses ?? 0;
      if (need) expect(need, `level ${level.id}`).toBeLessThanOrEqual(level.target - 2);
    }
  });

  // On a 2×2 or 3×3 every turn sweeps a third of the deck or more, the tunnels sit a
  // face apart and a long body fills the board, so chaining is asked for lightly there.
  it('pocket decks ask for at most two passes and two double heals, with slower turns', () => {
    for (const level of LEVELS.filter(l => l.cubeSize <= 3)) {
      const m = level.mechanics ?? {};
      if (!m.selfPasses && !m.multiHeals) continue;
      expect(m.selfPasses ?? 0, `level ${level.id}`).toBeLessThanOrEqual(2);
      expect(m.multiHeals ?? 0, `level ${level.id}`).toBeLessThanOrEqual(2);
      if (level.rotateEvery) expect(level.rotateEvery, `level ${level.id}`).toBeGreaterThanOrEqual(10);
    }
  });

  const stage = (level) => {
    const size = level.cubeSize;
    const sim = makeWormSim(size);
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    const practice = stageStory(sim, size, level);
    sim.powerups = []; sim.specials = [];
    return { size, sim, practice };
  };
  // Seal the first open pair, as a finished ride does.
  const sealFirst = (cubies, size) => {
    const pair = getActiveTunnels(cubies, size)[0];
    return flipStickerPair(cubies, size, pair.entry.x, pair.entry.y, pair.entry.z, pair.entry.dirKey, buildManifoldGridMap(cubies, size));
  };

  it('on a double-heal level, opens the next pair while a heal still rides, so heals chain', () => {
    const { size, sim, practice } = stage(storyLevel(60));
    expect(practice.chainHeals).toBe(true);
    const cubies = sealFirst(practice.cubies, size);
    // The second pair's heal is still in the body: the next pair opens anyway.
    sim.tunnelPassages.push({ heal: { tunnelKey: 'second' } });
    const next = replenishStoryTunnel(sim, practice, { cubies, animState: null }, size);
    expect(next).not.toBeNull();
    expect(getActiveTunnels(next, size)).toHaveLength(2);
  });

  it('still waits for a ride that heals nothing, and keeps the old pacing on other levels', () => {
    const chain = stage(storyLevel(60));
    const cubies = sealFirst(chain.practice.cubies, chain.size);
    chain.sim.tunnelPassages.push({ heal: null });
    expect(replenishStoryTunnel(chain.sim, chain.practice, { cubies, animState: null }, chain.size)).toBeNull();

    const plain = stage(storyLevel(6));
    expect(plain.practice.chainHeals).toBe(false);
    const plainCubies = sealFirst(plain.practice.cubies, plain.size);
    plain.sim.tunnelPassages.push({ heal: { tunnelKey: 'x' } });
    expect(replenishStoryTunnel(plain.sim, plain.practice, { cubies: plainCubies, animState: null }, plain.size)).toBeNull();
  });
});

describe('small-board tunnel mouths', () => {
  const kind = (size, [x, y, z]) => [x, y, z].filter(t => t === 0 || t === size - 1).length; // outer faces of the cubie

  it.each([3, 4])('size %i: the two pairs open together sit on single-face pieces, apart, on different faces', size => {
    const [a, b] = storyMouths(size, 2);
    expect(kind(size, a)).toBe(1);
    expect(kind(size, b)).toBe(1);
    expect(a[3]).not.toBe(b[3]);
    expect(a.slice(0, 3)).not.toEqual(b.slice(0, 3));
  });

  it.each([2, 3, 4])('size %i: no two mouths, or a mouth and another\'s twin, share a cubie while there is room', size => {
    const edge = size - 1;
    const mouths = storyMouths(size, 4);
    const seen = new Set();
    for (const [x, y, z] of mouths) {
      for (const key of [`${x},${y},${z}`, `${edge - x},${edge - y},${edge - z}`]) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    // Every mouth makes a real pair.
    let cubies = makeCubies(size);
    for (const [x, y, z, d] of mouths) cubies = flipStickerPair(cubies, size, x, y, z, d, buildManifoldGridMap(cubies, size));
    expect(getActiveTunnels(cubies, size)).toHaveLength(4);
  });

  it.each([3, 4])('size %i: no corner mouths while edge and face pieces remain, and the spawn lane stays clear', size => {
    const edge = size - 1, c = Math.floor(size / 2);
    const body = new Set(storyBodyPath(size, { kind: 'tunnel', id: 0 }).map(([u, v]) => `${u},${v}`));
    for (const m of storyMouths(size, 4)) {
      expect(kind(size, m)).toBeLessThan(3);
      if (m[3] === 'PZ') {
        expect(m[2]).toBe(edge);
        expect(m[0]).not.toBe(c);
        expect(m[1]).not.toBe(0);
        expect(body.has(`${m[0]},${m[1]}`)).toBe(false);
      }
    }
  });
});
