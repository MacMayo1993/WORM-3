import { makeCubies } from '../../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../../game/manifoldLogic.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getWormholeHealRing } from '../wormLogic.js';
import { ttReset, ttAt } from '../circularBuffers.js';
import { resetWormSim, tileKey } from './wormSim.js';
import { BODY_BALL_SPACING, BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from './constants.js';
import { FACE_COLORS } from '../../utils/constants.js';

export function stageWormPractice(sim, size, lesson, orbColor = face => FACE_COLORS[face]) {
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  const c = Math.floor(size / 2);
  const ring = ['surround', 'bomb'].includes(lesson.id);
  const portal = ['tunnel', 'heal'].includes(lesson.id);
  const target = { x: c, y: ring ? c : Math.min(size - 2, 3), z: size - 1, dirKey: 'PZ' };
  // Start within the live two-tile jump aim window. One deliberate press can
  // reach the pad, even while its two-second formation is still playing.
  sim.pos = { x: ring ? c - 1 : c, y: ring ? c - 1 : portal ? Math.max(0, target.y - 2) : 0, z: size - 1, dirKey: 'PZ' };
  sim.moveDir = ring ? 'right' : 'up';
  sim._curWP.fromArray(getStickerWorldPos(sim.pos.x, sim.pos.y, sim.pos.z, 'PZ', size, 0));
  sim.headInterpPos.copy(sim._curWP);
  ttReset(sim.tileTrail, tileKey(sim.pos)); ttReset(sim.pathHistory, tileKey(sim.pos));
  sim.tailLength = ring ? Math.ceil(8 / BODY_BALL_SPACING) : BASE_TAIL_LENGTH;
  let cubies = makeCubies(size);
  if (['tunnel', 'heal', 'surround'].includes(lesson.id)) {
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
  if (lesson.id === 'orbs') sim.powerups = [1, 2].map(y => ({ x: c, y, z: size - 1, dirKey: 'PZ', type: 'apple' }));
  if (lesson.id === 'magnet' || lesson.id === 'signature') {
    sim.powerups = [-1, 1].map(dx => ({ x: c + dx, y: 2, z: size - 1, dirKey: 'PZ', type: 'apple' }));
  }
  if (['rocket', 'magnet', 'water', 'fire', 'grass', 'ice', 'lightning'].includes(lesson.id)) {
    sim.specials = [{ x: c, y: 2, z: size - 1, dirKey: 'PZ', type: lesson.id, id: `demo-${lesson.id}`, ttl: 9999, maxTtl: 9999 }];
  }
  const marked = ring || ['tunnel', 'heal'].includes(lesson.id) ? { ...target, ring } : null;
  return { cubies, inventory, target: marked, sawJump: false, sawBoost: false, sawRocket: false, elementTime: 0 };
}

// Reads actual outcomes after a physics tick. No input press alone completes a
// jump, pickup, tunnel, ring or hazard lesson.
export function readWormPractice(sim, practice, lesson, state, size, delta) {
  practice.sawJump ||= sim.isJumping;
  practice.sawBoost ||= sim.boostActiveT > 0;
  practice.sawRocket ||= sim.rocketActive;
  if (sim.elementalType === lesson.id && sim.elementalFocusT <= 0) practice.elementTime += Math.min(delta, 0.05);
  let done = false, progress = '';
  switch (lesson.id) {
    case 'steer': done = !!state.demoWormSteered; break;
    case 'orbs': done = state.wormSessionOrbs >= 2; progress = `${Math.min(2, state.wormSessionOrbs)} / 2 orbs`; break;
    case 'jump': done = practice.sawJump && !sim.isJumping; break;
    case 'boost': done = practice.sawBoost && sim.boostActiveT <= 0; break;
    case 'tunnel':
    case 'heal': done = state.wormTunnelCount > 0 && sim.phase === 'crawling' && state.wormPhase === 'crawling' && sim.tunnelPassages.length === 0 && (lesson.id !== 'heal' || sim.healed > 0); break;
    case 'surround':
    case 'bomb': {
      const occupied = new Set();
      for (let i = 0; i < Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) occupied.add(ttAt(sim.tileTrail, i));
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
