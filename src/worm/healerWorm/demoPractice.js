import { makeGrowthOrb, DEMO_ORB_GOAL } from './orbSpawning.js';
import { getAllSurfaceTiles } from './surfaceTiles.js';
import { makeCubies } from '../../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../../game/manifoldLogic.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getWormholeHealRing, getNextSurfacePosition } from '../wormLogic.js';
import { ttReset, ttAt } from '../circularBuffers.js';
import { resetWormSim, tileKey } from './wormSim.js';
import { BODY_BALL_SPACING, BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from './constants.js';
import { BODY_JUMP_PATH, seedPracticeBody, trackPracticeBodyJump } from './bodyJumpPractice.js';
import { bodyCoverageCount } from './bodyCoverage.js';
import { FACE_COLORS } from '../../utils/constants.js';

export function stageWormPractice(sim, size, lesson, orbColor = face => FACE_COLORS[face]) {
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  const c = Math.floor(size / 2);
  const ring = ['surround', 'bomb'].includes(lesson.id);
  const caution = ['caution-fall', 'caution-rescue'].includes(lesson.id);
  const portal = caution || ['tunnel', 'heal'].includes(lesson.id);
  const target = { x: c, y: ring ? c : Math.min(size - 2, 3), z: size - 1, dirKey: 'PZ' };
  // Start within the live two-tile jump aim window. One deliberate press can
  // reach the pad, even while its two-second formation is still playing.
  sim.pos = { x: ring ? c - 1 : c, y: ring ? c - 1 : portal ? Math.max(0, target.y - 2) : 0, z: size - 1, dirKey: 'PZ' };
  sim.moveDir = ring ? 'right' : 'up';
  sim._curWP.fromArray(getStickerWorldPos(sim.pos.x, sim.pos.y, sim.pos.z, 'PZ', size, 0));
  sim.headInterpPos.copy(sim._curWP);
  ttReset(sim.tileTrail, tileKey(sim.pos)); ttReset(sim.pathHistory, tileKey(sim.pos));
  sim.tailLength = ring ? Math.ceil(8 / BODY_BALL_SPACING) : BASE_TAIL_LENGTH;
  if (lesson.id === 'body-jump') {
    seedPracticeBody(sim, size, BODY_JUMP_PATH.map(([x, y]) => [x + c - 2, y]));
    sim.tailLength = Math.ceil(10 / BODY_BALL_SPACING);
    target.y = 2;
  }
  let cubies = makeCubies(size);
  if (portal || lesson.id === 'surround') {
    cubies = flipStickerPair(cubies, size, target.x, target.y, target.z, target.dirKey, buildManifoldGridMap(cubies, size));
  }
  const inventory = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  if (lesson.id === 'heal') {
    const face = cubies[target.x][target.y][target.z].stickers.PZ.curr;
    inventory[face] = 2 * ORB_SEGMENT_GROWTH;
    sim.tailLength += 2 * ORB_SEGMENT_GROWTH;
    sim.orbPickupFaceIds = Array(2).fill(face);
    sim.orbPickupColors = Array(2).fill(orbColor(face));
  }
  if (lesson.id === 'orbs') {
    // A guaranteed trail carries the first growth lesson around the cube's edge.
    // Plenty of side routes remain rewarding if the player chooses to steer.
    const route = new Map();
    let next = sim.pos, heading = sim.moveDir;
    for (let i = 0; i < DEMO_ORB_GOAL; i++) {
      next = getNextSurfacePosition(next, heading, size);
      heading = next.moveDir;
      route.set(tileKey(next), next);
    }
    for (const tile of getAllSurfaceTiles(size)) {
      if ((tile.x + tile.y + tile.z) % 2 === 0) route.set(tileKey(tile), tile);
    }
    route.delete(tileKey(sim.pos));
    sim.powerups = [...route.values()].map(tile => makeGrowthOrb(tile));
  }
  if (lesson.id === 'magnet' || lesson.id === 'signature') {
    sim.powerups = [-1, 1].map(dx => makeGrowthOrb({ x: c + dx, y: 2, z: size - 1, dirKey: 'PZ' }));
  }
  if (['rocket', 'magnet', 'orb-shower', 'water', 'fire', 'grass', 'ice', 'lightning'].includes(lesson.id)) {
    sim.specials = [{ x: c, y: 2, z: size - 1, dirKey: 'PZ', type: lesson.id, id: `demo-${lesson.id}`, ttl: 9999, maxTtl: 9999 }];
  }
  const marked = ring || portal || lesson.id === 'body-jump' ? { ...target, ring } : null;
  return { cubies, inventory, target: marked, sawJump: false, jumps: 0, sawBoost: false, sawRocket: false, sawShower: false, elementTime: 0, airborne: false, crossedThisJump: false, bodyJumps: 0 };
}

// Reads actual outcomes after a physics tick. No input press alone completes a
// jump, pickup, tunnel, ring or hazard lesson.
export function readWormPractice(sim, practice, lesson, state, size, delta) {
  practice.sawJump ||= sim.isJumping;
  practice.sawBoost ||= sim.boostActiveT > 0;
  practice.sawRocket ||= sim.rocketActive;
  practice.sawShower ||= sim.orbShowerT > 0;
  if (sim.elementalType === lesson.id && sim.elementalFocusT <= 0) practice.elementTime += Math.min(delta, 0.05);
  let done = false, progress = '';
  switch (lesson.id) {
    case 'steer': done = !!state.demoWormSteered; break;
    case 'orbs': done = state.wormSessionOrbs >= DEMO_ORB_GOAL; progress = `${Math.min(DEMO_ORB_GOAL, state.wormSessionOrbs)} / ${DEMO_ORB_GOAL} orbs — watch your tail grow`; break;
    case 'orb-shower':
      done = practice.sawShower && sim.orbShowerT === 0;
      progress = practice.sawShower ? (sim.orbShowerT > 0 ? `Orb rain: ${Math.ceil(sim.orbShowerT)}s — collect and grow` : 'Shower complete — keep collecting the extra orbs') : 'Collect the rain-cloud power-up ahead';
      break;
    case 'jump': done = practice.sawJump && !sim.isJumping; break;
    case 'body-jump':
      trackPracticeBodyJump(sim, practice, size);
      done = practice.bodyJumps > 0;
      progress = practice.crossedThisJump ? 'Body cleared — land safely' : 'Jump over the body crossing ahead';
      break;
    // Both presses must land in ONE flight: a single hop that lands resets the
    // count, exactly as landing hands both jumps back in live play.
    case 'double-jump':
      if (sim.isJumping) practice.jumps = Math.max(practice.jumps, sim.jumpCount);
      else if (practice.jumps < 2) practice.jumps = 0;
      done = practice.jumps >= 2 && !sim.isJumping;
      progress = `${practice.jumps} / 2 jumps`;
      break;
    case 'boost': done = practice.sawBoost && sim.boostActiveT <= 0; break;
    case 'caution-fall':
      // Observing this one intentional death is the goal. Never unlock Next
      // at timeout: let the real simulation, camera and dissolve finish first.
      done = !sim.alive && state.wormDeathDetails?.reason === 'caution-fall' && sim.cautionFall?.dissolve === 1;
      progress = sim.cautionFall ? 'Watch the worm pull through the tape and dissolve'
        : sim.cautionRescue ? 'Watch the one-second rescue timer run out' : 'Approaching the taped edge…';
      break;
    case 'caution-rescue':
      if (sim.cautionRescue) practice.cautionHeading = sim.moveDir;
      if (practice.cautionHeading && !sim.cautionRescue && !sim.cautionFall && sim.alive) {
        practice.cautionJump ||= !!sim.padFlight;
        done = practice.cautionJump
          ? !sim.isJumping && (sim.onRaisedPlatform || state.wormTunnelCount > 0)
          : sim.moveDir !== practice.cautionHeading;
      }
      progress = practice.cautionJump ? 'Tape cleared — land on the pad'
        : sim.cautionRescue ? 'LEFT, RIGHT or JUMP — save the worm now'
          : 'Keep straight until the caution-tape cue appears';
      break;
    case 'tunnel':
    case 'heal':
      done = state.wormTunnelCount > 0 && sim.phase === 'crawling' && state.wormPhase === 'crawling' && sim.tunnelPassages.length === 0 && (lesson.id !== 'heal' || sim.healed > 0);
      progress = state.wormTunnelCount === 0 ? 'Jump onto the raised pad ahead; Retry resets your approach'
        : sim.phase !== 'crawling' ? 'Riding through the tunnel…'
          : sim.tunnelPassages.length ? 'Keep moving — your tail is still exiting' : '';
      break;
    case 'surround':
    case 'bomb': {
      const occupied = new Set();
      for (let i = 0; i < bodyCoverageCount(sim.tailLength, sim.tileTrail.count, size, sim.expansionAmount); i++) occupied.add(ttAt(sim.tileTrail, i));
      const ring = getWormholeHealRing(practice.target, size);
      const count = [...ring].filter(key => occupied.has(key)).length;
      progress = `${count} / ${ring.size} tiles covered together`;
      done = lesson.id === 'surround' ? sim.healed > 0 && sim.healPauseT <= 0 : state.demoWormHazardCleared === 'bomb';
      break;
    }
    case 'rocket': done = practice.sawRocket && !sim.rocketActive && !sim.isJumping; break;
    case 'magnet': done = sim.magnetT > 0 && state.wormSessionOrbs >= 2; break;
    case 'water': done = practice.elementTime >= 3 && sim.waterMomentum > 0.75; break;
    case 'fire': done = practice.elementTime >= 3 && [...sim.elementalPatches.values()].some(p => p.type === 'fire'); break;
    // Height alone cannot distinguish a normal jump from consuming a spring.
    case 'grass': done = sim.elementalType === 'grass' && sim.isJumping && !!practice.grassLaunch; break;
    case 'ice': done = sim.elementalType === 'ice' && sim.isJumping; break;
    case 'lightning': done = practice.elementTime >= 4; break;
    case 'signature': done = sim.signature.seq > 0 && (sim.signature.glowTrail?.path.count ?? 0) >= 2; break;
    case 'rotation': done = state.rotationEpoch > practice.rotationEpoch; break;
  }
  return { done, progress };
}
