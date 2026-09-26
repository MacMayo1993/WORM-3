// The chaos storm is told WHICH tile every event touched, never where it was.
// These tests pin that translation: bolts carry live tile identity (the fix for
// bolts that stayed behind when flipped cubies rose to their Explode position),
// every flip becomes a surge from the struck tile to its antipodal twin, and the
// per-tick caps bound what the storm's fixed pools are ever asked to draw.
import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { getManifoldGridId, getStickerWorldPos } from '../game/gridIds.js';
import { flipPadPair } from '../game/flipPad.js';
import { createChaosSim } from '../game/chaosSim.js';
import {
  chaosStormEvents,
  stormPairId,
  stormPairKey,
  stormSeed,
  stormMeshIndex,
  STORM_EVENT_CAPS
} from '../game/chaosStormEvents.js';

const SIZE = 3;
const CAP = 6;

const board = () => {
  const cubies = makeCubies(SIZE);
  return { cubies, map: buildManifoldGridMap(cubies, SIZE) };
};

const twinOf = (cubies, map, x, y, z, dirKey) => findAntipodalStickerByGrid(map, cubies[x][y][z].stickers[dirKey], SIZE);

describe('chaosStormEvents — bolts', () => {
  it('names the live tiles a chain hop joined, not only where they were', () => {
    const { cubies, map } = board();
    const payload = {
      cascades: [{ from: [0, 0, 1.52], to: [1, 0, 1.52], crossFace: false, fromTile: [1, 1, 2, 'PZ'], toTile: [2, 1, 2, 'PZ'] }]
    };
    const { events } = chaosStormEvents(payload, cubies, SIZE, map, CAP, { cascadeIds: [42] });
    expect(events).toHaveLength(1);
    const [bolt] = events;
    expect(bolt.type).toBe('bolt');
    expect(bolt.cascadeId).toBe(42);
    expect(bolt.from).toMatchObject({ x: 1, y: 1, z: 2, dirKey: 'PZ', gridId: getManifoldGridId(cubies[1][1][2].stickers.PZ, SIZE) });
    expect(bolt.to).toMatchObject({ x: 2, y: 1, z: 2, dirKey: 'PZ' });
    // The frozen positions ride along only as a fallback.
    expect(bolt.fromPos).toEqual([0, 0, 1.52]);
  });

  it('still draws a hop the worker described only in world space', () => {
    const { cubies, map } = board();
    const { events } = chaosStormEvents({ cascades: [{ from: [0, 0, 1], to: [1, 0, 1] }] }, cubies, SIZE, map, CAP);
    expect(events[0]).toMatchObject({ type: 'bolt', from: null, to: null, fromPos: [0, 0, 1], toPos: [1, 0, 1] });
  });

  it('caps bolts per tick', () => {
    const { cubies, map } = board();
    const hop = { from: [0, 0, 1], to: [1, 0, 1], fromTile: [1, 1, 2, 'PZ'], toTile: [2, 1, 2, 'PZ'] };
    const { events } = chaosStormEvents({ cascades: Array(9).fill(hop) }, cubies, SIZE, map, CAP);
    expect(events.filter((e) => e.type === 'bolt')).toHaveLength(STORM_EVENT_CAPS.bolts);
  });

  it('chaosSim cascades carry tile coordinates that match their frozen positions', () => {
    const sim = createChaosSim({ cubies: makeCubies(SIZE), size: SIZE, chaosLevel: 5, flipCap: CAP, explosionT: 0 });
    let seen = 0;
    for (let i = 0; i < 400 && seen < 5; i++) {
      for (const payload of [sim.chainTick(200), sim.conwayTick()]) {
        for (const c of payload?.cascades ?? []) {
          const [fx, fy, fz, fd] = c.fromTile;
          const [tx, ty, tz, td] = c.toTile;
          expect(getStickerWorldPos(fx, fy, fz, fd, SIZE, 0)).toEqual(c.from);
          expect(getStickerWorldPos(tx, ty, tz, td, SIZE, 0)).toEqual(c.to);
          seen++;
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('chaosStormEvents — wormhole charges', () => {
  it('sends every flip down its wormhole to the antipodal twin', () => {
    const { cubies, map } = board();
    const { events } = chaosStormEvents({ flips: [[1, 1, 2, 'PZ']] }, cubies, SIZE, map, CAP);
    expect(events).toHaveLength(1);
    const [charge] = events;
    const twin = twinOf(cubies, map, 1, 1, 2, 'PZ');
    const gridId = getManifoldGridId(cubies[1][1][2].stickers.PZ, SIZE);
    const twinId = getManifoldGridId(twin.sticker, SIZE);
    expect(charge).toMatchObject({ type: 'charge', kind: 'birth', from: { gridId }, to: { x: twin.x, y: twin.y, z: twin.z, dirKey: twin.dirKey } });
    // Same pair key WormholeNetwork builds, so the tunnel renderers light the right cord.
    expect(charge.pairId).toBe([gridId, twinId].sort().join('|'));
  });

  it('marks a first flip as a wormhole birth and later ones as surges, with heat', () => {
    const { cubies, map } = board();
    cubies[1][1][2].stickers.PZ.flips = 3;
    const { events } = chaosStormEvents({ flips: [[1, 1, 2, 'PZ']] }, cubies, SIZE, map, CAP);
    expect(events[0].kind).toBe('surge');
    expect(events[0].heat).toBeCloseTo(4 / CAP);
  });

  it('never charges a dead tile and never charges one pair twice in a tick', () => {
    const { cubies, map } = board();
    cubies[0][0][2].stickers.PZ.flips = CAP;
    const twin = twinOf(cubies, map, 1, 1, 2, 'PZ');
    const { events } = chaosStormEvents(
      { flips: [[0, 0, 2, 'PZ'], [1, 1, 2, 'PZ'], [twin.x, twin.y, twin.z, twin.dirKey]] },
      cubies, SIZE, map, CAP
    );
    expect(events).toHaveLength(1);
    expect(events[0].from).toMatchObject({ x: 1, y: 1, z: 2 });
  });

  it('caps charges per tick', () => {
    const { cubies, map } = board();
    const flips = [];
    for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) flips.push([x, y, 2, 'PZ']);
    const { events } = chaosStormEvents({ flips }, cubies, SIZE, map, CAP);
    expect(events).toHaveLength(STORM_EVENT_CAPS.charges);
  });

  it('drains a recovery back out from the twin to the tile', () => {
    const { cubies, map } = board();
    cubies[1][1][2].stickers.PZ.flips = 2;
    const twin = twinOf(cubies, map, 1, 1, 2, 'PZ');
    const { events } = chaosStormEvents({ recoveries: [[1, 1, 2, 'PZ']] }, cubies, SIZE, map, CAP);
    expect(events[0]).toMatchObject({ type: 'charge', kind: 'recover', from: { x: twin.x, y: twin.y, z: twin.z }, to: { x: 1, y: 1, z: 2 } });
  });

  it('reads flip counts from the board, not from a stale manifold map', () => {
    const { cubies, map } = board();
    // The map was built before these flips; its sticker objects are stale.
    const twin = twinOf(cubies, map, 1, 1, 2, 'PZ');
    cubies[1][1][2].stickers.PZ = { ...cubies[1][1][2].stickers.PZ, flips: 2 };
    cubies[twin.x][twin.y][twin.z].stickers[twin.dirKey] = { ...twin.sticker, flips: 2 };
    const { events } = chaosStormEvents({ flips: [[1, 1, 2, 'PZ']] }, cubies, SIZE, map, CAP);
    expect(events[0].kind).toBe('surge');
    expect(events[0].to.flips).toBe(2);
  });
});

describe('chaosStormEvents — overloads', () => {
  it('blows one wormhole per dead pair, even when both members die together', () => {
    const { cubies, map } = board();
    const gridId = getManifoldGridId(cubies[1][1][2].stickers.PZ, SIZE);
    const twin = twinOf(cubies, map, 1, 1, 2, 'PZ');
    const twinId = getManifoldGridId(twin.sticker, SIZE);
    const { events } = chaosStormEvents({ deaths: [{ gridId }, { gridId: twinId }] }, cubies, SIZE, map, CAP);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'overload', pairId: stormPairId(gridId, twinId), from: { gridId }, to: { gridId: twinId } });
  });
});

describe('chaosStormEvents — determinism and keys', () => {
  it('draws every seed from the caller counter', () => {
    const { cubies, map } = board();
    const payload = { flips: [[1, 1, 2, 'PZ'], [0, 1, 2, 'PZ']] };
    const a = chaosStormEvents(payload, cubies, SIZE, map, CAP, { seed: 7 });
    const b = chaosStormEvents(payload, cubies, SIZE, map, CAP, { seed: 7 });
    expect(a).toEqual(b);
    expect(a.nextSeed).toBe(9);
    expect(a.events.map((e) => e.seed)).toEqual([stormSeed(7), stormSeed(8)]);
  });

  it('keys a tile by the same pair PadSprings publishes its lift under', () => {
    const cubies = makeCubies(SIZE);
    for (const [x, y, z] of [[1, 1, 2], [0, 2, 2], [2, 0, 0]]) {
      for (const [dirKey, st] of Object.entries(cubies[x][y][z].stickers)) {
        expect(stormPairKey(getManifoldGridId(st, SIZE)), dirKey).toBe(flipPadPair(st, SIZE));
      }
    }
    expect(stormPairKey('nonsense')).toBeNull();
  });

  it('indexes cubie refs the way CubeAssembly lays them out', () => {
    expect(stormMeshIndex({ x: 2, y: 1, z: 0 }, 3)).toBe(2 * 9 + 1 * 3 + 0);
  });
});
