// The guide: which items are worth crawling to next, and where they are.
//
// On a big board the chase camera frames the head, so most of the cube is off
// screen, and half of it is always round the back. The guide picks the items that
// matter now and GuideBeams.jsx stands a beam of light out of the cube from each
// one's tile, so they can be found from anywhere; the nearest also gets a turn word
// for the HUD. It only advises: nothing here writes to the sim.
//
// What it lights, in order (the first kind with any reachable item wins):
//   1. tunnel mouths whose heal is paid for ('heal');
//   2. orbs whose colour an open tunnel still needs ('orb');
//   3. any orbs ('orb');
//   4. in the final heal, every open pair's mouths ('pair'), so the last pairs are
//      never a hunt.
// Dangerous, locked and collapsed tunnels are never lit.
//
// "Nearest" is the shortest crawl that would not kill the worm, over the cube's own
// surface (it wraps over edges like the worm does): pits and other tunnel mouths
// (crawling onto one dives) are walls, a tile of the body is a wall until the tail
// will have left it, and with jump-to-ride the raised pieces are walls too unless
// no other route exists (they can be jumped). An item with no route is not lit.
import * as THREE from 'three';
import { getNextSurfacePosition } from '../wormLogic.js';
import { getAllSurfaceTiles } from './surfaceTiles.js';
import { tunnelAt, tunnelDanger } from './tunnelReadout.js';
import { orbCreditFace } from './economy.js';
import { ripeOrb } from './elementalAbilities.js';
import { BODY_BALL_SPACING } from './constants.js';
import { ttAt } from '../circularBuffers.js';

export const GUIDE = Object.freeze({
  beams: 4,         // items lit at once, nearest first
  autoFromSize: 6,  // 'auto' shows the beams from this board size up
  refresh: 0.25,    // seconds of sim time between re-routes on the same tile
});

// Settings → Guide beams. 'auto' is the default: big boards, where the head framing
// leaves most of the cube off screen.
export const GUIDE_MODES = Object.freeze(['off', 'auto', 'always']);
export const guideMode = settings => (GUIDE_MODES.includes(settings?.wormGuideBeams) ? settings.wormGuideBeams : 'auto');
export const guideOn = (mode, size) => mode === 'always' || (mode === 'auto' && size >= GUIDE.autoFromSize);

const DIRS = ['up', 'right', 'down', 'left'];
const TURNS = ['ahead', 'right', 'behind', 'left'];
export const tileKeyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;

/** Which way `dir` lies from a worm heading `heading`, both in the same face's frame. */
export function relativeTurn(heading, dir) {
  const a = DIRS.indexOf(heading), b = DIRS.indexOf(dir);
  return a < 0 || b < 0 ? 'ahead' : TURNS[(b - a + 4) % 4];
}

// The surface as an index graph, built once per board size: next[i * 4 + d] is the
// tile one step from i in direction d (of i's face).
const graphs = new Map();
function surfaceGraph(size) {
  let graph = graphs.get(size);
  if (graph) return graph;
  const tiles = getAllSurfaceTiles(size);
  const keys = tiles.map(tileKeyOf);
  const index = new Map(keys.map((key, i) => [key, i]));
  const next = new Int32Array(tiles.length * 4).fill(-1);
  tiles.forEach((tile, i) => DIRS.forEach((dir, d) => {
    const step = getNextSurfacePosition(tile, dir, size);
    const j = step ? index.get(tileKeyOf(step)) : undefined;
    if (j !== undefined) next[i * 4 + d] = j;
  }));
  graph = { keys, index, next };
  graphs.set(size, graph);
  return graph;
}

/**
 * The nearest `limit` keys of `targets` by crawl from `from`, heading `heading`.
 * `blocked(key, step)` says a tile cannot be entered on that step of the route; a
 * target may always be entered, and the search goes on through it unless it is
 * blocked (an orb can be crossed, a mouth dives). Ties go straight ahead first,
 * then left, right and back.
 *
 * @returns {Array<{ key: string, steps: number, firstDir: string, turn: string }>} nearest first
 */
export function guideRoutes(from, heading, targets, size, blocked = () => false, limit = 1) {
  const found = [];
  if (!targets.size || limit <= 0) return found;
  const { keys, index, next } = surfaceGraph(size);
  const start = index.get(tileKeyOf(from));
  if (start === undefined) return found;
  const h = Math.max(0, DIRS.indexOf(heading));
  const order = [h, (h + 3) % 4, (h + 1) % 4, (h + 2) % 4];
  const seen = new Uint8Array(keys.length);
  const first = new Int8Array(keys.length);
  const depth = new Int32Array(keys.length);
  seen[start] = 1;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const d of i === start ? order : [0, 1, 2, 3]) {
      const j = next[i * 4 + d];
      if (j < 0 || seen[j]) continue;
      const key = keys[j], step = depth[i] + 1;
      const target = targets.has(key);
      const wall = blocked(key, step);
      if (wall && !target) continue;
      seen[j] = 1; depth[j] = step; first[j] = i === start ? d : first[i];
      if (target) {
        const firstDir = DIRS[first[j]];
        found.push({ key, steps: step, firstDir, turn: relativeTurn(heading, firstDir) });
        if (found.length >= limit) return found;
      }
      if (!wall) queue.push(j);
    }
  }
  return found;
}

// The body is a wall where it will still lie when the head gets there: tile i of
// the trail (0 is the head) is clear once the tail has moved up past it, from step
// covered − i on, plus one step of margin because the body is beads, not tiles.
// The margin keeps the neck a wall on the first step, so the guide never says to
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
 * Pick the items to light this frame. `snapshot` is the tunnel snapshot
 * (`getWormTunnelSnapshot`): its open pairs and every flipped tile.
 *
 * @returns {{ kind: 'heal'|'orb'|'pair', final: boolean, color: string, steps: number, turn: string,
 *   target: object, beams: Array<{ x, y, z, dirKey, color: string, steps: number }> } | null}
 *   The first beam is the nearest item; kind, color, steps, turn and target describe it.
 */
export function findGuide(sim, size, ctx, snapshot) {
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
      const item = { kind: need.ready ? 'heal' : 'pair', color: need.color, tile: need.pos };
      if (need.ready) ready.set(key, item);
      else { pending.set(key, item); needFaces.add(need.faceId); }
    }
  }
  const useful = new Map(), orbs = new Map();
  const prism = ctx.isPrismCharacter?.() ?? false;
  for (const orb of sim.powerups ?? []) {
    if (!ripeOrb(orb)) continue;
    const sticker = cubies?.[orb.x]?.[orb.y]?.[orb.z]?.stickers?.[orb.dirKey];
    if (!sticker) continue;
    const face = orbCreditFace(sticker.curr);
    const item = { kind: 'orb', color: ctx.getOrbColor(face), tile: orb };
    const key = tileKeyOf(orb);
    orbs.set(key, item);
    if (needFaces.size && (prism || needFaces.has(face))) useful.set(key, item);
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

  for (const items of [ready, useful, orbs, final ? pending : null]) {
    if (!items?.size) continue;
    let routes = guideRoutes(sim.pos, sim.moveDir, items, size, strict, GUIDE.beams);
    if (!routes.length && padRoute) routes = guideRoutes(sim.pos, sim.moveDir, items, size, loose, GUIDE.beams);
    if (!routes.length) continue;
    const beams = routes.map(({ key, steps }) => {
      const { color, tile } = items.get(key);
      return { x: tile.x, y: tile.y, z: tile.z, dirKey: tile.dirKey, color, steps };
    });
    const nearest = items.get(routes[0].key);
    const { x, y, z, dirKey } = beams[0];
    return { kind: nearest.kind, final, color: nearest.color, steps: routes[0].steps, turn: routes[0].turn,
      target: { x, y, z, dirKey }, beams };
  }
  return null;
}

/** Per-run memory for `stepGuide`, so it re-routes only when something moved. */
export const makeGuideState = () => ({ key: null, dir: null, snapshot: null, t: 0, goal: null });
export function resetGuideState(state) {
  state.key = null; state.dir = null; state.snapshot = null; state.t = 0; state.goal = null;
}

/**
 * Re-route when the head reaches a new tile, turns, or the tunnels change, and
 * otherwise every GUIDE.refresh seconds of sim time (orbs come and go).
 */
export function stepGuide(state, sim, size, ctx, snapshot, delta) {
  state.t += delta;
  const key = tileKeyOf(sim.pos);
  if (key === state.key && sim.moveDir === state.dir && snapshot === state.snapshot && state.t < GUIDE.refresh) return state.goal;
  state.key = key; state.dir = sim.moveDir; state.snapshot = snapshot; state.t = 0;
  state.goal = findGuide(sim, size, ctx, snapshot);
  return state.goal;
}

/** HUD words for the nearest item: { turn: 'Left', tiles: '6 tiles', label } (label is read aloud). */
const TURN_WORDS = { ahead: 'Ahead', left: 'Left', right: 'Right', behind: 'Back' };
const TURN_SPOKEN = { ahead: 'straight ahead', left: 'turn left', right: 'turn right', behind: 'turn back' };
const KIND_SPOKEN = { heal: 'paid heal', orb: 'orb', pair: 'open pair' };
export function guideWords(goal) {
  if (!goal) return null;
  const tiles = `${goal.steps} ${goal.steps === 1 ? 'tile' : 'tiles'}`;
  return { turn: TURN_WORDS[goal.turn], tiles, label: `Nearest ${KIND_SPOKEN[goal.kind]}: ${TURN_SPOKEN[goal.turn]}, ${tiles}` };
}

// A beam stands straight out of its item's tile along that face's outward normal:
// up from the face above, out to the left from the face on the left, down from the
// face underneath. It is long enough to stand clear past the cube's edge from a
// tile round the side.
export const guideBeamLength = size => Math.max(8, size * 2.5);
export function guideBeamTipInto(out, foot, normal, size) {
  return out.copy(foot).addScaledVector(normal, guideBeamLength(size));
}

// An item is in view when it projects inside the frame (less a margin) and its
// face turns toward the camera: the cube is convex, so a face turned away is hidden.
const _ndc = new THREE.Vector3();
const _toCamera = new THREE.Vector3();
export function guideTargetInView(camera, position, normal, margin = 0.1) {
  _toCamera.setFromMatrixPosition(camera.matrixWorld).sub(position);
  if (_toCamera.dot(normal) <= 0) return false;
  _ndc.copy(position).project(camera);
  const edge = 1 - margin;
  return _ndc.z > -1 && _ndc.z < 1 && Math.abs(_ndc.x) <= edge && Math.abs(_ndc.y) <= edge;
}
