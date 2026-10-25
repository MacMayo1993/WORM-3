import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { makeCubies } from '../game/cubeState.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { cubieCenterInto } from '../game/cubeWorldGeometry.js';
import { cubieHasFlippedFace, raisedWormExpansion } from '../game/raisedCubie.js';
import { makeWormSim, resetWormSim, startJump, jumpLiftOf, queueTurn, stepWormSim } from '../worm/healerWorm/wormSim.js';
import { FACE_NORMALS } from '../worm/healerWorm/constants.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

// A raised WORM piece is solid: the worm goes over it or onto it, never through it.
// On small cubes almost every piece is an edge or a corner, so the step off its top
// is usually over a cube edge onto the same piece's next face.

const FACES = { PX: [0, 1], NX: [0, 0], PY: [1, 1], NY: [1, 0], PZ: [2, 1], NZ: [2, 0] };
const surfaceTiles = size => {
  const out = [];
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++)
    for (const [dirKey, [axis, top]] of Object.entries(FACES)) if ([x, y, z][axis] === top * (size - 1)) out.push({ x, y, z, dirKey });
  return out;
};
const sameTile = (a, b) => !!a && a.x === b.x && a.y === b.y && a.z === b.z && a.dirKey === b.dirKey;

function world(size, flipped, start, moveDir) {
  resetLiveRotation();
  const cubies = makeCubies(size);
  for (const t of flipped) cubies[t.x][t.y][t.z].stickers[t.dirKey].flips = 1;
  const pieces = [];
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++)
    if (cubieHasFlippedFace(cubies[x][y][z], 6)) pieces.push(new Vector3(...cubieCenterInto([0, 0, 0], x, y, z, size, raisedWormExpansion(0, size))));
  const sim = makeWormSim(size); resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  sim.pos = { ...start }; sim.moveDir = moveDir; sim.currentNormal.copy(FACE_NORMALS[start.dirKey]);
  sim.headInterpPos.fromArray(getStickerWorldPos(start.x, start.y, start.z, start.dirKey, size));
  sim.curWorldPos.copy(sim.headInterpPos); sim.selfCollisionGraceSteps = 1e9;
  const base = { getCubies: () => cubies, getTunnelEntry: () => 'pad', feel: () => {}, isPaused: () => false, getSpeed: () => 2,
    getGamePhase: () => 'active', getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, resolveTunnel: () => null, getFlipCap: () => 6 };
  const ctx = new Proxy(base, { get: (t, k) => (k in t ? t[k] : k === 'then' ? undefined : () => undefined) });
  // The 0.96 body with a hair of head: deeper than this is through the plastic.
  const head = new Vector3();
  const insidePiece = () => {
    head.copy(sim.headInterpPos).addScaledVector(sim.currentNormal, jumpLiftOf(sim));
    return pieces.some(c => Math.abs(head.x - c.x) < 0.49 && Math.abs(head.y - c.y) < 0.49 && Math.abs(head.z - c.z) < 0.49);
  };
  return { sim, ctx, insidePiece, step: () => stepWormSim(sim, 1 / 60, size, ctx) };
}

// Every approach onto a raised piece, landing and then leaving straight on or turning.
describe.each([2, 3])('leaving a raised piece on a %i cube', size => {
  it('walks on over the cube edge along the same piece and never cuts through it', () => {
    const tiles = surfaceTiles(size);
    let overEdge = 0;
    for (const target of tiles.filter(t => t.dirKey === 'PZ')) {
      for (const start of tiles) for (const moveDir of ['up', 'down', 'left', 'right']) {
        const n = getNextSurfacePosition(start, moveDir, size);
        // A piece only rises once the worm is clear of it (burrows.js), so the
        // approach starts off the piece.
        if (!sameTile(n, target) || (start.x === target.x && start.y === target.y && start.z === target.z)) continue;
        for (const exit of ['straight', 'left', 'right']) {
          const { sim, ctx, insidePiece, step } = world(size, [target], start, moveDir);
          startJump(sim, ctx, size, { allowDive: false });
          expect(sim.padFlight).toBeTruthy();
          let turned = exit === 'straight';
          for (let f = 0; f < 240 && !sim.cautionRescue; f++) {
            if (!turned && !sim.padFlight) { queueTurn(sim, exit); turned = true; }
            step();
            expect(insidePiece()).toBe(false);
            if (sim.onRaisedPlatform && sim.pos.dirKey !== 'PZ') overEdge++;
          }
        }
      }
    }
    // Corner and edge pieces carry the worm onto their next face.
    expect(overEdge).toBeGreaterThan(0);
  });
});

describe('hops and steps near raised pieces', () => {
  it('lands a hop that turns onto a raised piece on top of it', () => {
    // 3x3, PZ face: start at (0,0) heading right; the raised piece is up the
    // column at (1,1). Neither jump is aimed at it: the second goes on along the
    // row, and only the turn left in mid-air brings the worm down onto the piece.
    const raised = { x: 1, y: 1, z: 2, dirKey: 'PZ' };
    const { sim, ctx, insidePiece, step } = world(3, [raised], { x: 0, y: 0, z: 2, dirKey: 'PZ' }, 'right');
    startJump(sim, ctx, 3, { allowDive: false });
    expect(sim.padFlight).toBeNull();
    expect(sim.isJumping).toBe(true);
    let caught = false, pressed = false;
    for (let f = 0; f < 200; f++) {
      if (!pressed && sameTile(sim.pos, { x: 1, y: 0, z: 2, dirKey: 'PZ' })) {
        expect(sim.isJumping).toBe(true);
        queueTurn(sim, 'jump'); queueTurn(sim, 'left'); pressed = true;
      }
      step();
      expect(caught || !sim.padFlight || sim.moveDir === 'up').toBe(true);
      caught ||= !!sim.padFlight;
      expect(insidePiece()).toBe(false);
      if (caught && !sim.padFlight) break;
    }
    expect(caught).toBe(true);
    expect(sim.onRaisedPlatform).toBe(true);
    expect(sim.pos).toMatchObject(raised);
  });

  it('stops a worm fresh off one raised piece at the tape of the next', () => {
    // Two raised pieces one tile apart along the bottom row of PZ on a 4x4.
    const first = { x: 0, y: 0, z: 3, dirKey: 'PZ' }, second = { x: 2, y: 0, z: 3, dirKey: 'PZ' };
    const { sim, ctx, insidePiece, step } = world(4, [first, second], { x: 0, y: 1, z: 3, dirKey: 'PZ' }, 'down');
    startJump(sim, ctx, 4, { allowDive: false });
    for (let f = 0; f < 120 && sim.padFlight; f++) step();
    expect(sim.onRaisedPlatform).toBe(true);
    queueTurn(sim, 'left'); // now heading right along the row, towards the second piece
    for (let f = 0; f < 240 && !sim.cautionRescue; f++) { step(); expect(insidePiece()).toBe(false); }
    expect(sim.cautionRescue?.tile).toMatchObject(second);
    expect(sim.pos).toMatchObject({ x: 1, y: 0, z: 3, dirKey: 'PZ' });
  });

  // Seeded random play: turns, hops and answers to the caution stop.
  it.each([2, 3, 4])('never puts the head inside a raised piece in random play on a %i cube', size => {
    let seed = 11 + size;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rand() * a.length)];
    const tiles = surfaceTiles(size);
    let raisedFrames = 0;
    for (let run = 0; run < 40; run++) {
      const flipped = [pick(tiles), pick(tiles)];
      const flippedCubies = new Set(flipped.map(t => `${t.x},${t.y},${t.z}`));
      const free = tiles.filter(t => !flippedCubies.has(`${t.x},${t.y},${t.z}`));
      const { sim, insidePiece, step } = world(size, flipped, pick(free), pick(['up', 'down', 'left', 'right']));
      for (let f = 0; f < 600 && sim.alive && sim.phase !== 'falling'; f++) {
        if (sim.cautionRescue) { if (!sim.jumpRescueRequested) queueTurn(sim, pick(['jump', 'left', 'right'])); }
        else if (rand() < 0.03) queueTurn(sim, pick(['left', 'right']));
        else if (rand() < 0.02) queueTurn(sim, 'jump');
        step();
        if (sim.phase === 'falling') break;
        expect(insidePiece()).toBe(false);
        if (sim.onRaisedPlatform) raisedFrames++;
      }
    }
    expect(raisedFrames).toBeGreaterThan(0);
  });
});
