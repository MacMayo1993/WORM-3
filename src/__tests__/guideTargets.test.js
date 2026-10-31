import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeCubies } from '../game/cubeState.js';
import { makeTileTrail, ttPush } from '../worm/circularBuffers.js';
import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from '../worm/healerWorm/constants.js';
import {
  GUIDE, guideMode, guideOn, relativeTurn, guideRoutes, findGuide, makeGuideState, stepGuide,
  guideWords, guideTargetInView, tileKeyOf, guideBeamTipInto, guideBeamLength,
  storyGuide, stepStoryGuide, STORY_BEAM_COLOR,
} from '../worm/healerWorm/guideTargets.js';
import { ACTION_CUES } from '../game/actionCues.js';

const SIZE = 6;
const Z = SIZE - 1;
const pz = (x, y) => ({ x, y, z: Z, dirKey: 'PZ' });
const targetsAt = (...tiles) => new Map(tiles.map(tile => [tileKeyOf(tile), tile]));
const keyAt = tile => tileKeyOf(tile);
const orbAt = tile => ({ ...tile, type: 'apple', spawnId: tileKeyOf(tile) });

// A worm on the front face whose body runs behind the head.
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

describe('guide beams setting', () => {
  it('defaults to big boards and honours off and always', () => {
    expect(guideMode(undefined)).toBe('auto');
    expect(guideMode({ wormGuideBeams: 'bogus' })).toBe('auto');
    expect(guideOn('auto', GUIDE.autoFromSize - 1)).toBe(false);
    expect(guideOn('auto', GUIDE.autoFromSize)).toBe(true);
    expect(guideOn('always', 3)).toBe(true);
    expect(guideOn('off', 15)).toBe(false);
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

describe('guideRoutes', () => {
  it('finds the shortest crawl and the turn that starts it', () => {
    expect(guideRoutes(pz(2, 2), 'up', targetsAt(pz(0, 2)), SIZE)).toEqual([{ key: keyAt(pz(0, 2)), steps: 2, firstDir: 'left', turn: 'left' }]);
  });

  it('ranks several items nearest first, up to the limit', () => {
    const targets = targetsAt(pz(2, 5), pz(4, 2), pz(0, 0));
    const routes = guideRoutes(pz(2, 2), 'up', targets, SIZE, undefined, 2);
    expect(routes.map(r => [r.key, r.steps])).toEqual([[keyAt(pz(4, 2)), 2], [keyAt(pz(2, 5)), 3]]);
  });

  it('prefers straight ahead when two routes tie', () => {
    // (3, 3) is two steps either way: up then right, or right then up.
    expect(guideRoutes(pz(2, 2), 'up', targetsAt(pz(3, 3)), SIZE)[0].turn).toBe('ahead');
  });

  it('wraps over a cube edge onto the next face', () => {
    const top = { x: 2, y: Z, z: Z - 1, dirKey: 'PY' };
    expect(guideRoutes(pz(2, Z - 1), 'up', targetsAt(top), SIZE)[0]).toMatchObject({ steps: 3, turn: 'ahead' });
  });

  it('goes round a wall, through an item but never through a blocked one', () => {
    const wall = new Set([keyAt(pz(2, 3))]);
    expect(guideRoutes(pz(2, 2), 'up', targetsAt(pz(2, 4)), SIZE, key => wall.has(key))[0].steps).toBe(4);
    expect(guideRoutes(pz(2, 2), 'up', targetsAt(pz(2, 4)), SIZE, () => true)).toEqual([]);
    // An orb on the way is crossed to reach the one behind it; a blocked item (a mouth) is not.
    const pair = targetsAt(pz(2, 3), pz(2, 4));
    expect(guideRoutes(pz(2, 2), 'up', pair, SIZE, undefined, 2).map(r => r.steps)).toEqual([1, 2]);
    const behindMouth = guideRoutes(pz(2, 2), 'up', pair, SIZE, key => key === keyAt(pz(2, 3)), 2);
    expect(behindMouth.map(r => r.steps)).toEqual([1, 4]);
  });

  it('skips an item under the head and finds nothing with no targets', () => {
    expect(guideRoutes(pz(2, 2), 'up', targetsAt(pz(2, 2)), SIZE)).toEqual([]);
    expect(guideRoutes(pz(2, 2), 'up', new Map(), SIZE)).toEqual([]);
  });
});

describe('findGuide', () => {
  it('lights the nearest orbs when no tunnel needs anything', () => {
    const { cubies, snapshot } = makeBoard();
    const sim = makeSim({ powerups: [orbAt(pz(2, 5)), orbAt(pz(4, 2))] });
    const goal = findGuide(sim, SIZE, makeCtx(cubies), snapshot);
    expect(goal).toMatchObject({ kind: 'orb', steps: 2, turn: 'right', target: pz(4, 2), final: false });
    expect(goal.beams.map(b => [b.x, b.y, b.steps])).toEqual([[4, 2, 2], [2, 5, 3]]);
    // An orb on a red (1) tile credits its antipode, orange (4).
    expect(goal.beams.every(b => b.color === '#face4')).toBe(true);
  });

  it('lights at most GUIDE.beams items', () => {
    const { cubies, snapshot } = makeBoard();
    const powerups = [0, 1, 2, 3, 4, 5].map(x => orbAt(pz(x, 5)));
    expect(findGuide(makeSim({ powerups }), SIZE, makeCtx(cubies), snapshot).beams).toHaveLength(GUIDE.beams);
  });

  it('lights orbs an open tunnel needs over nearer ones it does not', () => {
    // The pair's front mouth now shows orange (4); an orb on a red tile credits orange.
    const { cubies, snapshot } = makeBoard([[pz(0, 0), { x: 0, y: 0, z: 0, dirKey: 'NZ' }]]);
    const nearOnTop = { x: 2, y: Z, z: Z, dirKey: 'PY' };   // credits yellow (6): not needed
    const sim = makeSim({ pos: pz(2, Z - 1), powerups: [orbAt(nearOnTop), orbAt(pz(5, 1))] });
    const goal = findGuide(sim, SIZE, makeCtx(cubies), snapshot);
    expect(goal).toMatchObject({ kind: 'orb', target: pz(5, 1) });
    expect(goal.beams).toHaveLength(1);
  });

  it('lights a paid tunnel before any orb', () => {
    const { cubies, snapshot } = makeBoard([[pz(0, 2), { x: 0, y: 2, z: 0, dirKey: 'NZ' }]]);
    const sim = makeSim({ tailLength: BASE_TAIL_LENGTH + 2 * ORB_SEGMENT_GROWTH, powerups: [orbAt(pz(2, 3))] });
    const goal = findGuide(sim, SIZE, makeCtx(cubies, { inventory: { 4: 2 * ORB_SEGMENT_GROWTH } }), snapshot);
    expect(goal).toMatchObject({ kind: 'heal', target: pz(0, 2), turn: 'left', steps: 2 });
  });

  it('lights the open pairs in the final heal, never before it', () => {
    const back = { x: 0, y: 2, z: 0, dirKey: 'NZ' };
    const { cubies, snapshot } = makeBoard([[pz(0, 2), back]]);
    const sim = makeSim();
    expect(findGuide(sim, SIZE, makeCtx(cubies), snapshot)).toBeNull();
    const goal = findGuide(sim, SIZE, makeCtx(cubies, { phase: 'finalHealing' }), snapshot);
    expect(goal).toMatchObject({ kind: 'pair', final: true, target: pz(0, 2) });
    // Both mouths of the pair are lit; either ride heals it.
    expect(goal.beams.map(b => b.dirKey)).toEqual(['PZ', 'NZ']);
  });

  it('never lights a fatal, locked or collapsed tunnel', () => {
    const back = { x: 0, y: 2, z: 0, dirKey: 'NZ' };
    const { cubies, snapshot } = makeBoard([[pz(0, 2), back]]);
    const ctx = makeCtx(cubies, { phase: 'finalHealing' });
    const worn = makeSim();
    worn.tunnelUseCounts.set(keyAt(pz(0, 2)), 3);
    worn.tunnelUseCounts.set(keyAt(back), 3);
    expect(findGuide(worn, SIZE, ctx, snapshot)).toBeNull();
    const collapsed = makeSim();
    collapsed.voidTunnelKeys.add('t0');
    expect(findGuide(collapsed, SIZE, ctx, snapshot)).toBeNull();
  });

  it('treats other mouths and pits as walls', () => {
    // The orb sits behind a mouth in the head's column; the way round avoids the pit too.
    const { cubies, snapshot } = makeBoard([[pz(2, 3), { x: 2, y: 3, z: 0, dirKey: 'NZ' }]]);
    const sim = makeSim({ powerups: [orbAt(pz(2, 4))] });
    sim.pitTiles.add(keyAt(pz(1, 3)));
    expect(findGuide(sim, SIZE, makeCtx(cubies), snapshot)).toMatchObject({ steps: 4, turn: 'right' });
  });

  it('never says to turn back into the neck', () => {
    const { cubies, snapshot } = makeBoard();
    const sim = makeSim({ body: [pz(2, 1)], powerups: [orbAt(pz(2, 0))] });
    expect(findGuide(sim, SIZE, makeCtx(cubies), snapshot)).toMatchObject({ steps: 4, turn: 'left' });
  });

  it('keeps off the body until the tail will have left it', () => {
    // The worm came down column 4 and along row 1 to the head at (2, 2). The orb at
    // (5, 2) is three steps right, through (4, 2), which the body still holds then;
    // the way round over (4, 3), which the tail has left by then, takes five.
    const body = [pz(2, 1), pz(3, 1), pz(4, 1), pz(4, 2), pz(4, 3)];
    const { cubies, snapshot } = makeBoard();
    const sim = makeSim({ body, tailLength: 60, powerups: [orbAt(pz(5, 2))] });
    expect(findGuide(sim, SIZE, makeCtx(cubies), snapshot).steps).toBe(5);
  });

  it('routes round raised pieces with jump-to-ride', () => {
    // The mouth at (3, 2) raises its piece; the orb just past it is reached round it.
    const { cubies, snapshot } = makeBoard([[pz(3, 2), { x: 3, y: 2, z: 0, dirKey: 'NZ' }]]);
    const sim = makeSim({ pos: pz(1, 2), moveDir: 'right', powerups: [orbAt(pz(4, 2))] });
    expect(findGuide(sim, SIZE, makeCtx(cubies, { entry: 'pad' }), snapshot).steps).toBe(5);
  });
});

describe('stepGuide', () => {
  it('re-routes on a new tile, a turn or a new snapshot, and otherwise on its own clock', () => {
    const { cubies, snapshot } = makeBoard();
    const sim = makeSim({ powerups: [orbAt(pz(2, 5))] });
    let routes = 0;
    const ctx = { ...makeCtx(cubies), getCubies: () => { routes++; return cubies; } };
    const state = makeGuideState();
    expect(stepGuide(state, sim, SIZE, ctx, snapshot, 0.01)).toMatchObject({ kind: 'orb', steps: 3 });
    stepGuide(state, sim, SIZE, ctx, snapshot, 0.01);
    expect(routes).toBe(1);
    sim.moveDir = 'left';
    expect(stepGuide(state, sim, SIZE, ctx, snapshot, 0.01).turn).toBe('right');
    expect(routes).toBe(2);
    stepGuide(state, sim, SIZE, ctx, snapshot, GUIDE.refresh);
    expect(routes).toBe(3);
    stepGuide(state, sim, SIZE, ctx, { ...snapshot }, 0);
    expect(routes).toBe(4);
  });
});

describe('guideWords', () => {
  it('reads the turn and distance', () => {
    expect(guideWords(null)).toBeNull();
    expect(guideWords({ kind: 'pair', turn: 'left', steps: 6 })).toEqual({ turn: 'Left', tiles: '6 tiles', label: 'Nearest open pair: turn left, 6 tiles' });
    expect(guideWords({ kind: 'orb', turn: 'behind', steps: 1 }).label).toBe('Nearest orb: turn back, 1 tile');
  });
});

describe('guideTargetInView', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  it('sees a front tile, not one round the back or off the frame', () => {
    expect(guideTargetInView(camera, new THREE.Vector3(0.5, 0.5, 1.5), new THREE.Vector3(0, 0, 1))).toBe(true);
    expect(guideTargetInView(camera, new THREE.Vector3(0.5, 0.5, -1.5), new THREE.Vector3(0, 0, -1))).toBe(false);
    expect(guideTargetInView(camera, new THREE.Vector3(20, 0, 1.5), new THREE.Vector3(0, 0, 1))).toBe(false);
  });
});

describe('guideBeamTipInto', () => {
  const size = 8, half = size / 2 + 0.04;

  it('points each beam the way its face faces, clear past the cube', () => {
    const faces = [
      [new THREE.Vector3(1.5, half, -2.5), new THREE.Vector3(0, 1, 0)],    // above: up
      [new THREE.Vector3(-half, 0.5, 1.5), new THREE.Vector3(-1, 0, 0)],   // left: out to the left
      [new THREE.Vector3(2.5, -half, 0.5), new THREE.Vector3(0, -1, 0)],   // below: down
      [new THREE.Vector3(0.5, -1.5, half), new THREE.Vector3(0, 0, 1)],
    ];
    for (const [foot, normal] of faces) {
      const tip = guideBeamTipInto(new THREE.Vector3(), foot, normal, size);
      const along = tip.clone().sub(foot);
      expect(along.clone().normalize().dot(normal)).toBeCloseTo(1);
      expect(along.length()).toBe(guideBeamLength(size));
      expect(tip.dot(normal)).toBeGreaterThan(size * 2);
    }
  });

  it('grows with the board and never falls short of 8 units', () => {
    expect(guideBeamLength(3)).toBe(8);
    expect(guideBeamLength(15)).toBeGreaterThan(guideBeamLength(8));
  });
});

describe('storyGuide', () => {
  it('lights the level’s own target alone, in the target diamond’s colour', () => {
    const goal = storyGuide({ x: 2, y: 5, z: Z, dirKey: 'PZ', type: 'magnet', spawnId: 's1' });
    expect(STORY_BEAM_COLOR).toBe(ACTION_CUES.target.color);
    expect(goal).toMatchObject({ kind: 'story', final: false, target: pz(2, 5) });
    expect(goal.beams).toEqual([{ ...pz(2, 5), color: STORY_BEAM_COLOR, steps: null }]);
    // A surround heal names the mouth its ring goes round: the beam stands on the mouth.
    expect(storyGuide({ ...pz(1, 1), ring: true }).beams[0]).toMatchObject(pz(1, 1));
    expect(storyGuide(null)).toBeNull();
    expect(storyGuide({ x: 1, y: 1, z: 1 })).toBeNull();
  });

  it('rebuilds only when the level moves its target, and hands back cleanly to free play', () => {
    const state = makeGuideState();
    const first = pz(2, 5), second = pz(4, 1);
    const goal = stepStoryGuide(state, first);
    expect(stepStoryGuide(state, first)).toBe(goal);
    expect(stepStoryGuide(state, second).target).toEqual(pz(4, 1));
    expect(stepStoryGuide(state, null)).toBeNull();
    // Free play's routing state starts afresh after a Story target.
    stepStoryGuide(state, first);
    const { cubies, snapshot } = makeBoard();
    expect(stepGuide(state, makeSim({ powerups: [orbAt(pz(2, 5))] }), SIZE, makeCtx(cubies), snapshot, 0)).toMatchObject({ kind: 'orb' });
    expect(state.storyTarget).toBeNull();
  });
});
