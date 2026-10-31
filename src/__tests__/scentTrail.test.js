import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeCubies } from '../game/cubeState.js';
import { makeTileTrail, ttPush } from '../worm/circularBuffers.js';
import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from '../worm/healerWorm/constants.js';
import {
  SCENT, scentTrailMode, scentTrailOn, relativeTurn, scentRoute, findScent, makeScentState, stepScent,
  scentWords, scentTargetInView, tileKeyOf,
} from '../worm/healerWorm/scentTrail.js';

const SIZE = 6;
const Z = SIZE - 1;
const pz = (x, y) => ({ x, y, z: Z, dirKey: 'PZ' });
const targetsAt = (...tiles) => new Map(tiles.map(tile => [tileKeyOf(tile), tile]));

// A worm on the front face whose body runs straight down behind the head.
function makeSim({ pos = pz(2, 2), moveDir = 'up', body = [], tailLength = BASE_TAIL_LENGTH, powerups = [] } = {}) {
  const tileTrail = makeTileTrail(64);
  for (const tile of [...body].reverse()) ttPush(tileTrail, tileKeyOf(tile));
  ttPush(tileTrail, tileKeyOf(pos));
  return { pos, moveDir, tileTrail, tailLength, powerups, pitTiles: new Set(), voidTunnelKeys: new Set(),
    tunnelUseCounts: new Map(), signature: {} };
}

// Flip one front tile and its partner on the back into an open pair.
function makeBoard(pairs = []) {
  const cubies = makeCubies(SIZE);
  const tunnels = [], positions = [];
  pairs.forEach(([entry, exit], i) => {
    for (const mouth of [entry, exit]) {
      const sticker = cubies[mouth.x][mouth.y][mouth.z].stickers[mouth.dirKey];
      sticker.curr = mouth.dirKey === 'PZ' ? 4 : 1;
      positions.push({ ...mouth, key: tileKeyOf(mouth), faceId: sticker.curr, tunnelKey: `t${i}` });
    }
    tunnels.push({ tunnel: { entry, exit }, tunnelKey: `t${i}`, reversed: false });
  });
  return { cubies, snapshot: { tunnels, positions } };
}

function makeCtx(cubies, { phase = 'active', inventory = {}, entry = 'crawl' } = {}) {
  return {
    getCubies: () => cubies,
    getGamePhase: () => phase,
    getTunnelEntry: () => entry,
    resolveTunnel: (x, y, z, dirKey) => ({ tunnelKey: `${x},${y},${z},${dirKey}` }),
    getHealingProgress: () => ({}),
    getOrbInventory: () => inventory,
    getOrbColor: faceId => `#face${faceId}`,
    isPrismCharacter: () => false,
    isStoryTunnelTrial: () => false,
  };
}

describe('guide trail setting', () => {
  it('defaults to big boards and honours off and always', () => {
    expect(scentTrailMode(undefined)).toBe('auto');
    expect(scentTrailMode({ wormGuideTrail: 'bogus' })).toBe('auto');
    expect(scentTrailOn('auto', SCENT.autoFromSize - 1)).toBe(false);
    expect(scentTrailOn('auto', SCENT.autoFromSize)).toBe(true);
    expect(scentTrailOn('always', 3)).toBe(true);
    expect(scentTrailOn('off', 15)).toBe(false);
  });
});

describe('relativeTurn', () => {
  it('names a direction from the heading', () => {
    expect(relativeTurn('up', 'up')).toBe('ahead');
    expect(relativeTurn('up', 'right')).toBe('right');
    expect(relativeTurn('up', 'left')).toBe('left');
    expect(relativeTurn('right', 'up')).toBe('left');
    expect(relativeTurn('left', 'right')).toBe('behind');
  });
});

describe('scentRoute', () => {
  it('finds the shortest crawl and the turn that starts it', () => {
    const route = scentRoute(pz(2, 2), 'up', targetsAt(pz(0, 2)), SIZE);
    expect(route).toMatchObject({ steps: 2, firstDir: 'left', turn: 'left' });
    expect(route.path.map(t => [t.x, t.y, t.dir])).toEqual([[1, 2, 'left'], [0, 2, 'left']]);
  });

  it('prefers straight ahead when two routes tie', () => {
    // (3, 3) is two steps either way: up then right, or right then up.
    expect(scentRoute(pz(2, 2), 'up', targetsAt(pz(3, 3)), SIZE).turn).toBe('ahead');
  });

  it('wraps over a cube edge onto the next face', () => {
    const top = { x: 2, y: Z, z: Z - 1, dirKey: 'PY' };
    const route = scentRoute(pz(2, Z - 1), 'up', targetsAt(top), SIZE);
    expect(route.steps).toBe(3);
    expect(route.path[1]).toMatchObject({ dirKey: 'PY', x: 2, y: Z, z: Z });
    expect(route.path.at(-1)).toMatchObject({ dirKey: 'PY', z: Z - 1 });
  });

  it('goes round a wall and returns null when walled in', () => {
    const wall = new Set([tileKeyOf(pz(2, 3))]);
    const around = scentRoute(pz(2, 2), 'up', targetsAt(pz(2, 4)), SIZE, key => wall.has(key));
    expect(around.steps).toBe(4);
    expect(around.path.some(t => tileKeyOf(t) === tileKeyOf(pz(2, 3)))).toBe(false);
    expect(scentRoute(pz(2, 2), 'up', targetsAt(pz(2, 4)), SIZE, () => true)).toBeNull();
  });

  it('has nothing to show when the head is already on the target', () => {
    expect(scentRoute(pz(2, 2), 'up', targetsAt(pz(2, 2)), SIZE)).toBeNull();
    expect(scentRoute(pz(2, 2), 'up', new Map(), SIZE)).toBeNull();
  });
});

describe('findScent', () => {
  const orbAt = tile => ({ ...tile, type: 'apple', spawnId: tileKeyOf(tile) });

  it('points at the nearest orb when no tunnel needs anything', () => {
    const { cubies, snapshot } = makeBoard();
    const sim = makeSim({ powerups: [orbAt(pz(2, 5)), orbAt(pz(4, 2))] });
    const goal = findScent(sim, SIZE, makeCtx(cubies), snapshot);
    expect(goal).toMatchObject({ kind: 'orb', steps: 2, turn: 'right', target: pz(4, 2), final: false });
    // An orb on a red (1) tile credits its antipode, orange (4).
    expect(goal.color).toBe('#face4');
  });

  it('prefers an orb an open tunnel needs over a nearer one it does not', () => {
    // The pair's front mouth now shows orange (4); an orb on a red tile credits orange.
    const { cubies, snapshot } = makeBoard([[pz(0, 0), { x: 0, y: 0, z: 0, dirKey: 'NZ' }]]);
    const nearOnTop = { x: 2, y: Z, z: Z, dirKey: 'PY' };   // credits yellow (6): not needed
    const sim = makeSim({ pos: pz(2, Z - 1), powerups: [orbAt(nearOnTop), orbAt(pz(5, 1))] });
    const goal = findScent(sim, SIZE, makeCtx(cubies), snapshot);
    expect(goal).toMatchObject({ kind: 'orb', target: pz(5, 1) });
  });

  it('goes to a paid tunnel before any orb', () => {
    const { cubies, snapshot } = makeBoard([[pz(0, 2), { x: 0, y: 2, z: 0, dirKey: 'NZ' }]]);
    const sim = makeSim({ tailLength: BASE_TAIL_LENGTH + 2 * ORB_SEGMENT_GROWTH, powerups: [orbAt(pz(2, 3))] });
    const goal = findScent(sim, SIZE, makeCtx(cubies, { inventory: { 4: 2 * ORB_SEGMENT_GROWTH } }), snapshot);
    expect(goal).toMatchObject({ kind: 'heal', target: pz(0, 2), turn: 'left', steps: 2 });
  });

  it('points at an open pair in the final heal, never before it', () => {
    const { cubies, snapshot } = makeBoard([[pz(0, 2), { x: 0, y: 2, z: 0, dirKey: 'NZ' }]]);
    const sim = makeSim();
    expect(findScent(sim, SIZE, makeCtx(cubies), snapshot)).toBeNull();
    expect(findScent(sim, SIZE, makeCtx(cubies, { phase: 'finalHealing' }), snapshot))
      .toMatchObject({ kind: 'pair', final: true, target: pz(0, 2) });
  });

  it('never leads to a fatal, locked or collapsed tunnel', () => {
    const { cubies, snapshot } = makeBoard([[pz(0, 2), { x: 0, y: 2, z: 0, dirKey: 'NZ' }]]);
    const ctx = makeCtx(cubies, { phase: 'finalHealing' });
    const worn = makeSim();
    worn.tunnelUseCounts.set(tileKeyOf(pz(0, 2)), 3);
    worn.tunnelUseCounts.set(tileKeyOf({ x: 0, y: 2, z: 0, dirKey: 'NZ' }), 3);
    expect(findScent(worn, SIZE, ctx, snapshot)).toBeNull();
    const collapsed = makeSim();
    collapsed.voidTunnelKeys.add('t0');
    expect(findScent(collapsed, SIZE, ctx, snapshot)).toBeNull();
  });

  it('treats other mouths and pits as walls', () => {
    // The orb sits behind a mouth in the head's column; the route steps round it.
    const { cubies, snapshot } = makeBoard([[pz(2, 3), { x: 2, y: 3, z: 0, dirKey: 'NZ' }]]);
    const sim = makeSim({ powerups: [orbAt(pz(2, 4))] });
    sim.pitTiles.add(tileKeyOf(pz(1, 3)));
    const goal = findScent(sim, SIZE, makeCtx(cubies), snapshot);
    expect(goal.steps).toBe(4);
    expect(goal.turn).toBe('right');
    expect(goal.path.some(t => [pz(2, 3), pz(1, 3)].some(w => tileKeyOf(w) === tileKeyOf(t)))).toBe(false);
  });

  it('never turns back into the neck', () => {
    const { cubies, snapshot } = makeBoard();
    const sim = makeSim({ body: [pz(2, 1)], powerups: [orbAt(pz(2, 0))] });
    const goal = findScent(sim, SIZE, makeCtx(cubies), snapshot);
    // Round by the left; the old neck tile is free again by the time the route reaches it.
    expect(goal).toMatchObject({ steps: 4, turn: 'left' });
    expect(tileKeyOf(goal.path[0])).toBe(tileKeyOf(pz(1, 2)));
  });

  it('keeps off the body until the tail will have left it', () => {
    // The worm came down column 4 and along row 1 to the head at (2, 2). The orb at
    // (5, 2) is three steps right, through (4, 2), which the body still holds then;
    // the way round crosses (4, 3) once the tail has left it.
    const body = [pz(2, 1), pz(3, 1), pz(4, 1), pz(4, 2), pz(4, 3)];
    const { cubies, snapshot } = makeBoard();
    const sim = makeSim({ body, tailLength: 60, powerups: [orbAt(pz(5, 2))] });
    const goal = findScent(sim, SIZE, makeCtx(cubies), snapshot);
    const crosses = tile => goal.path.some(t => tileKeyOf(t) === tileKeyOf(tile));
    expect(goal.steps).toBe(5);
    expect(crosses(pz(4, 2))).toBe(false);
    expect(crosses(pz(4, 3))).toBe(true);
  });

  it('routes round raised pieces with jump-to-ride', () => {
    const mouth = pz(3, 2);
    const { cubies, snapshot } = makeBoard([[mouth, { x: 3, y: 2, z: 0, dirKey: 'NZ' }]]);
    const sim = makeSim({ pos: pz(1, 2), moveDir: 'right', powerups: [orbAt(pz(4, 2))] });
    const goal = findScent(sim, SIZE, makeCtx(cubies, { entry: 'pad' }), snapshot);
    expect(goal.path.some(t => t.x === 3 && t.dirKey === 'PZ' && t.y === 2)).toBe(false);
  });
});

describe('stepScent', () => {
  it('re-routes on a new tile, a turn or a new snapshot, and otherwise on its own clock', () => {
    const { cubies, snapshot } = makeBoard();
    const sim = makeSim({ powerups: [{ ...pz(2, 5), type: 'apple' }] });
    const ctx = makeCtx(cubies);
    let routes = 0;
    const counting = { ...ctx, getCubies: () => { routes++; return cubies; } };
    const state = makeScentState();
    const first = stepScent(state, sim, SIZE, counting, snapshot, 0.01);
    expect(first).toMatchObject({ kind: 'orb', steps: 3 });
    stepScent(state, sim, SIZE, counting, snapshot, 0.01);
    expect(routes).toBe(1);
    sim.moveDir = 'left';
    expect(stepScent(state, sim, SIZE, counting, snapshot, 0.01).turn).toBe('right');
    expect(routes).toBe(2);
    stepScent(state, sim, SIZE, counting, snapshot, SCENT.refresh);
    expect(routes).toBe(3);
    stepScent(state, sim, SIZE, counting, { ...snapshot }, 0);
    expect(routes).toBe(4);
  });
});

describe('scentWords', () => {
  it('reads the turn and distance', () => {
    expect(scentWords(null)).toBeNull();
    expect(scentWords({ kind: 'pair', turn: 'left', steps: 6 })).toEqual({ turn: 'Left', tiles: '6 tiles', label: 'Nearest open pair: turn left, 6 tiles' });
    expect(scentWords({ kind: 'orb', turn: 'behind', steps: 1 }).label).toBe('Nearest orb: turn back, 1 tile');
  });
});

describe('scentTargetInView', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  it('sees a front tile, not one round the back or off the frame', () => {
    expect(scentTargetInView(camera, new THREE.Vector3(0.5, 0.5, 1.5), new THREE.Vector3(0, 0, 1))).toBe(true);
    expect(scentTargetInView(camera, new THREE.Vector3(0.5, 0.5, -1.5), new THREE.Vector3(0, 0, -1))).toBe(false);
    expect(scentTargetInView(camera, new THREE.Vector3(20, 0, 1.5), new THREE.Vector3(0, 0, 1))).toBe(false);
  });
});
