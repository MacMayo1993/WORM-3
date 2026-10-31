// The scent trail: which way to crawl for the thing you need next.
//
// On a big board the chase camera frames the head, so most of the cube is off
// screen, and half of it is always round the back. The trail points the way along
// the cube's own surface (it wraps over edges like the worm does): a few chevrons
// on the tiles ahead of the head, and a turn word for the HUD. It only advises:
// nothing here writes to the sim.
//
// What it points at, in order:
//   1. a tunnel mouth whose heal is paid for ('heal');
//   2. an orb whose colour an open tunnel still needs ('orb');
//   3. any orb ('orb');
//   4. in the final heal, any open pair ('pair'), so the last pairs are never a hunt.
// Dangerous, locked and collapsed tunnels are never targets.
//
// The route is the shortest crawl that would not kill the worm: pits and other
// tunnel mouths (crawling onto one dives) are walls, a tile of the body is a wall
// until the tail will have left it, and with jump-to-ride the raised pieces are
// walls too unless no other route exists (they can be jumped).
import * as THREE from 'three';
import { getNextSurfacePosition } from '../wormLogic.js';
import { getAllSurfaceTiles } from './surfaceTiles.js';
import { tunnelAt, tunnelDanger } from './tunnelReadout.js';
import { orbCreditFace } from './economy.js';
import { ripeOrb } from './elementalAbilities.js';
import { BODY_BALL_SPACING } from './constants.js';
import { ttAt } from '../circularBuffers.js';

export const SCENT = Object.freeze({
  cells: 4,         // chevrons laid ahead of the head
  near: 2,          // a target this many steps away needs no trail
  autoFromSize: 6,  // 'auto' shows the trail from this board size up
  refresh: 0.25,    // seconds of sim time between re-routes on the same tile
});

// Settings → Guide trail. 'auto' is the default: big boards, where the head framing
// leaves most of the cube off screen.
export const SCENT_MODES = Object.freeze(['off', 'auto', 'always']);
export const scentTrailMode = settings => (SCENT_MODES.includes(settings?.wormGuideTrail) ? settings.wormGuideTrail : 'auto');
export const scentTrailOn = (mode, size) => mode === 'always' || (mode === 'auto' && size >= SCENT.autoFromSize);

const DIRS = ['up', 'right', 'down', 'left'];
const TURNS = ['ahead', 'right', 'behind', 'left'];
export const tileKeyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;

/** Which way `dir` lies from a worm heading `heading`, both in the same face's frame. */
export function relativeTurn(heading, dir) {
  const a = DIRS.indexOf(heading), b = DIRS.indexOf(dir);
  return a < 0 || b < 0 ? 'ahead' : TURNS[(b - a + 4) % 4];
}

// The surface as an index graph, built once per board size: next[i * 4 + d] is the
// tile one step from i in direction d (of i's face), arrive[] that step's heading
// on the new tile (it changes over an edge).
const graphs = new Map();
function surfaceGraph(size) {
  let graph = graphs.get(size);
  if (graph) return graph;
  const tiles = getAllSurfaceTiles(size);
  const keys = tiles.map(tileKeyOf);
  const index = new Map(keys.map((key, i) => [key, i]));
  const next = new Int32Array(tiles.length * 4).fill(-1);
  const arrive = new Int8Array(tiles.length * 4);
  tiles.forEach((tile, i) => DIRS.forEach((dir, d) => {
    const step = getNextSurfacePosition(tile, dir, size);
    const j = step ? index.get(tileKeyOf(step)) : undefined;
    if (j === undefined) return;
    next[i * 4 + d] = j;
    arrive[i * 4 + d] = DIRS.indexOf(step.moveDir ?? dir);
  }));
  graph = { tiles, keys, index, next, arrive };
  graphs.set(size, graph);
  return graph;
}

/**
 * Shortest crawl from `from`, heading `heading`, to the nearest key of `targets`.
 * `blocked(key, step)` says a tile cannot be entered on that step of the route.
 * Ties go straight ahead first, then left, right and back.
 *
 * @returns {{ key: string, steps: number, firstDir: string, turn: string,
 *   path: Array<{x:number, y:number, z:number, dirKey:string, dir:string}> } | null}
 *   `path` runs from the first step to the target; each tile's `dir` is the heading
 *   that leaves it along the route (the target keeps its arrival heading).
 */
export function scentRoute(from, heading, targets, size, blocked = () => false) {
  if (!targets.size) return null;
  const { tiles, keys, index, next, arrive } = surfaceGraph(size);
  const start = index.get(tileKeyOf(from));
  if (start === undefined || targets.has(tileKeyOf(from))) return null;
  const h = Math.max(0, DIRS.indexOf(heading));
  const order = [h, (h + 3) % 4, (h + 1) % 4, (h + 2) % 4];
  const parent = new Int32Array(tiles.length).fill(-1);
  const via = new Int8Array(tiles.length);
  const depth = new Int32Array(tiles.length);
  parent[start] = start;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const d of i === start ? order : [0, 1, 2, 3]) {
      const j = next[i * 4 + d];
      if (j < 0 || parent[j] >= 0) continue;
      const key = keys[j];
      const step = depth[i] + 1;
      if (!targets.has(key) && blocked(key, step)) continue;
      parent[j] = i; via[j] = d; depth[j] = step;
      if (targets.has(key)) return traceRoute(j, key, start, heading, { tiles, arrive, parent, via, depth });
      queue.push(j);
    }
  }
  return null;
}

function traceRoute(end, key, start, heading, { tiles, arrive, parent, via, depth }) {
  const chain = [];
  for (let i = end; i !== start; i = parent[i]) chain.push(i);
  chain.reverse();
  const path = chain.map((i, k) => {
    const leaving = chain[k + 1];
    const d = leaving === undefined ? arrive[parent[i] * 4 + via[i]] : via[leaving];
    return { ...tiles[i], dir: DIRS[d] };
  });
  const firstDir = DIRS[via[chain[0]]];
  return { key, steps: depth[end], firstDir, turn: relativeTurn(heading, firstDir), path };
}

// The body is a wall where it will still lie when the head gets there: tile i of
// the trail (0 is the head) is clear once the tail has moved up past it, from step
// covered − i on, plus one step of margin because the body is beads, not tiles.
// The margin keeps the neck a wall on the first step, so the trail never says to
// turn back into the worm.
function bodyClock(sim) {
  const trail = sim.tileTrail;
  const clock = new Map();
  if (!trail?.count) return clock;
  const covered = Math.min(trail.count, 1 + Math.ceil(Math.max(0, sim.tailLength * BODY_BALL_SPACING)));
  for (let i = covered - 1; i >= 1; i--) {
    const key = ttAt(trail, i);
    if (key) clock.set(key, covered - i + 1);
  }
  return clock;
}

/**
 * Pick the target and route for this frame. `snapshot` is the tunnel snapshot
 * (`getWormTunnelSnapshot`): its open pairs and every flipped tile.
 *
 * @returns {{ kind: 'heal'|'orb'|'pair', color: string, final: boolean, steps: number,
 *   turn: string, target: object, path: object[] } | null}
 */
export function findScent(sim, size, ctx, snapshot) {
  const cubies = ctx.getCubies();
  const final = ctx.getGamePhase() === 'finalHealing';
  const ready = new Map(), pending = new Map(), needFaces = new Set();
  for (const hit of snapshot?.tunnels ?? []) {
    if (sim.voidTunnelKeys?.has(hit.tunnelKey)) continue;
    for (const mouth of [hit.tunnel.entry, hit.tunnel.exit]) {
      const key = tileKeyOf(mouth);
      if (sim.pitTiles?.has(key)) continue;
      const need = tunnelAt(sim, ctx, mouth);
      if (!need || need.locked || tunnelDanger(need)) continue;
      const target = { kind: need.ready ? 'heal' : 'pair', color: need.color, tile: need.pos };
      if (need.ready) ready.set(key, target);
      else { pending.set(key, target); needFaces.add(need.faceId); }
    }
  }
  const useful = new Map(), orbs = new Map();
  const prism = ctx.isPrismCharacter?.() ?? false;
  for (const orb of sim.powerups ?? []) {
    if (!ripeOrb(orb)) continue;
    const sticker = cubies?.[orb.x]?.[orb.y]?.[orb.z]?.stickers?.[orb.dirKey];
    if (!sticker) continue;
    const face = orbCreditFace(sticker.curr);
    const target = { kind: 'orb', color: ctx.getOrbColor(face), tile: orb };
    const key = tileKeyOf(orb);
    orbs.set(key, target);
    if (needFaces.size && (prism || needFaces.has(face))) useful.set(key, target);
  }

  // Walls. Every flipped tile is a tunnel mouth (crawling onto one dives) or a pad.
  const mouths = new Set(), raised = new Set();
  for (const cell of snapshot?.positions ?? []) {
    mouths.add(cell.key);
    raised.add(`${cell.x},${cell.y},${cell.z}`);
  }
  const body = bodyClock(sim);
  const pits = sim.pitTiles ?? new Set();
  const loose = (key, step) => pits.has(key) || mouths.has(key) || step < (body.get(key) ?? 0);
  const padRoute = ctx.getTunnelEntry?.() === 'pad';
  const onRaisedPiece = key => raised.has(key.slice(0, key.lastIndexOf(',')));
  const strict = (key, step) => loose(key, step) || (padRoute && onRaisedPiece(key));

  for (const targets of [ready, useful, orbs, final ? pending : null]) {
    if (!targets?.size) continue;
    const route = scentRoute(sim.pos, sim.moveDir, targets, size, strict)
      ?? (padRoute ? scentRoute(sim.pos, sim.moveDir, targets, size, loose) : null);
    if (!route) continue;
    const { kind, color, tile } = targets.get(route.key);
    // A step over a raised piece is a jump: the renderer leaves it unmarked.
    const path = padRoute ? route.path.map(t => (onRaisedPiece(tileKeyOf(t)) ? { ...t, raised: true } : t)) : route.path;
    return { kind, color, final, steps: route.steps, turn: route.turn,
      target: { x: tile.x, y: tile.y, z: tile.z, dirKey: tile.dirKey }, path };
  }
  return null;
}

/** Per-run memory for `stepScent`, so it re-routes only when something moved. */
export const makeScentState = () => ({ key: null, dir: null, snapshot: null, t: 0, goal: null });
export function resetScentState(state) {
  state.key = null; state.dir = null; state.snapshot = null; state.t = 0; state.goal = null;
}

/**
 * Re-route when the head reaches a new tile, turns, or the tunnels change, and
 * otherwise every SCENT.refresh seconds of sim time (orbs come and go).
 */
export function stepScent(state, sim, size, ctx, snapshot, delta) {
  state.t += delta;
  const key = tileKeyOf(sim.pos);
  if (key === state.key && sim.moveDir === state.dir && snapshot === state.snapshot && state.t < SCENT.refresh) return state.goal;
  state.key = key; state.dir = sim.moveDir; state.snapshot = snapshot; state.t = 0;
  state.goal = findScent(sim, size, ctx, snapshot);
  return state.goal;
}

/** HUD words for a goal: { turn: 'Left', tiles: '6 tiles', label } (label is read aloud). */
const TURN_WORDS = { ahead: 'Ahead', left: 'Left', right: 'Right', behind: 'Back' };
const TURN_SPOKEN = { ahead: 'straight ahead', left: 'turn left', right: 'turn right', behind: 'turn back' };
const KIND_SPOKEN = { heal: 'paid heal', orb: 'orb', pair: 'open pair' };
export function scentWords(goal) {
  if (!goal) return null;
  const tiles = `${goal.steps} ${goal.steps === 1 ? 'tile' : 'tiles'}`;
  return { turn: TURN_WORDS[goal.turn], tiles, label: `Nearest ${KIND_SPOKEN[goal.kind]}: ${TURN_SPOKEN[goal.turn]}, ${tiles}` };
}

// A target is in view when it projects inside the frame (less a margin) and its
// face turns toward the camera: the cube is convex, so a face turned away is hidden.
const _ndc = new THREE.Vector3();
const _toCamera = new THREE.Vector3();
export function scentTargetInView(camera, position, normal, margin = 0.1) {
  _toCamera.setFromMatrixPosition(camera.matrixWorld).sub(position);
  if (_toCamera.dot(normal) <= 0) return false;
  _ndc.copy(position).project(camera);
  const edge = 1 - margin;
  return _ndc.z > -1 && _ndc.z < 1 && Math.abs(_ndc.x) <= edge && Math.abs(_ndc.y) <= edge;
}
