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
  const lessonId = lesson.practiceId ?? lesson.id;
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  const c = Math.floor(size / 2);
  const ring = ['surround', 'bomb'].includes(lessonId);
  const caution = ['caution-fall', 'caution-rescue'].includes(lessonId);
  const portal = caution || ['tunnel', 'heal', 'collect-heal'].includes(lessonId);
  const target = { x: c, y: ring ? c : Math.min(size - 2, 3), z: size - 1, dirKey: 'PZ' };
  if (lessonId === 'collect-heal') target.y = size - 2;
  // Start within the live two-tile jump aim window. One deliberate press can
  // reach the pad, even while its two-second formation is still playing.
  sim.pos = { x: ring ? c - 1 : c, y: lessonId === 'collect-heal' ? 0 : ring ? c - 1 : portal ? Math.max(0, target.y - 2) : 0, z: size - 1, dirKey: 'PZ' };
  sim.moveDir = ring ? 'right' : 'up';
  sim._curWP.fromArray(getStickerWorldPos(sim.pos.x, sim.pos.y, sim.pos.z, 'PZ', size, 0));
  sim.headInterpPos.copy(sim._curWP);
  ttReset(sim.tileTrail, tileKey(sim.pos)); ttReset(sim.pathHistory, tileKey(sim.pos));
  sim.tailLength = ring ? Math.ceil(8 / BODY_BALL_SPACING) : BASE_TAIL_LENGTH;
  if (lesson.challenge && lessonId === 'surround') {
    // ceil(reach) must remain below eight after three pickups. The fourth
    // supplies the missing coverage, so the starting body cannot seal it.
    sim.tailLength = Math.floor(7 / BODY_BALL_SPACING) - (lesson.orbGoal - 1) * ORB_SEGMENT_GROWTH;
  }
  if (lessonId === 'body-jump') {
    const path = lesson.challenge ? [[2,0],[1,0],[0,0],[0,1],[0,2],[1,2],[2,2],[2,3],[2,4],[3,4],[4,4],[4,3],[4,2],[3,2]] : BODY_JUMP_PATH;
    seedPracticeBody(sim, size, path.map(([x, y]) => [x + c - 2, y]));
    sim.tailLength = Math.ceil(10 / BODY_BALL_SPACING);
    target.y = 2;
    if (lesson.challenge) sim.powerups = [[size - 1, 2], [size - 1, size - 1], [c, size - 1]]
      .map(([x, y]) => makeGrowthOrb({ x, y, z: size - 1, dirKey: 'PZ' }));
  }
  let cubies = makeCubies(size);
  if (portal || lessonId === 'surround') {
    cubies = flipStickerPair(cubies, size, target.x, target.y, target.z, target.dirKey, buildManifoldGridMap(cubies, size));
  }
  const inventory = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  if (lessonId === 'heal') {
    const face = cubies[target.x][target.y][target.z].stickers.PZ.curr;
    inventory[face] = 2 * ORB_SEGMENT_GROWTH;
    sim.tailLength += 2 * ORB_SEGMENT_GROWTH;
    sim.orbPickupFaceIds = Array(2).fill(face);
    sim.orbPickupColors = Array(2).fill(orbColor(face));
  }
  if (lessonId === 'collect-heal') {
    // On the front face, growth cores have the antipodal colour: exactly the
    // colour of this flipped entrance. No free inventory or random supply.
    sim.powerups = (lesson.challenge ? [[c, 1], [size - 1, 1], [size - 1, size - 1], [c, size - 1]] : [[c, 1], [c, 2]])
      .map(([x, y]) => makeGrowthOrb({ x, y, z: size - 1, dirKey: 'PZ' }));
  }
  if (lesson.challenge && lessonId === 'surround') {
    sim.powerups = [[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]]
      .map(([x, y]) => makeGrowthOrb({ x, y, z: size - 1, dirKey: 'PZ' }));
  }
  if (lessonId === 'orbs') {
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
  if (lessonId === 'magnet' || lessonId === 'signature') {
    sim.powerups = [-1, 1].map(dx => makeGrowthOrb({ x: c + dx, y: 2, z: size - 1, dirKey: 'PZ' }));
  }
  if (['rocket', 'magnet', 'orb-shower', 'water', 'fire', 'grass', 'ice', 'lightning', 'air'].includes(lessonId)) {
    sim.specials = [{ x: c, y: 2, z: size - 1, dirKey: 'PZ', type: lessonId, id: `demo-${lessonId}`, ttl: 9999, maxTtl: 9999 }];
  }
  if (lesson.challenge) for (const orb of sim.powerups) orb.challengeSupply = true;
  const marked = ring || portal || lessonId === 'body-jump' ? { ...target, ring } : null;
  return { cubies, inventory, target: marked, elapsed: 0, lastTime: 0, sawJump: false, jumps: 0, sawBoost: false, sawRocket: false, sawShower: false, elementTime: 0, airborne: false, crossedThisJump: false, bodyJumps: 0 };
}

// Reads actual outcomes after a physics tick. No input press alone completes a
// jump, pickup, tunnel, ring or hazard lesson.
export function readWormPractice(sim, practice, lesson, state, size, delta) {
  const lessonId = lesson.practiceId ?? lesson.id;
  practice.sawAirJump ||= sim.isJumping && sim.elementalT > 0 && sim.elementalType === 'air' && !sim.rocketActive;
  practice.sawJump ||= sim.isJumping;
  practice.sawBoost ||= sim.boostActiveT > 0;
  practice.sawRocket ||= sim.rocketActive;
  practice.sawShower ||= sim.orbShowerT > 0;
  if (sim.elementalType === lessonId && sim.elementalFocusT <= 0) practice.elementTime += Math.min(delta, 0.05);
  let done = false, progress = '';
  switch (lessonId) {
    case 'steer': done = !!state.demoWormSteered; break;
    case 'orbs': done = state.wormSessionOrbs >= DEMO_ORB_GOAL; progress = `${Math.min(DEMO_ORB_GOAL, state.wormSessionOrbs)} / ${DEMO_ORB_GOAL} orbs — watch your tail grow`; break;
    case 'orb-shower':
      done = practice.sawShower && sim.orbShowerT === 0;
      progress = practice.sawShower ? (sim.orbShowerT > 0 ? `Orb rain: ${Math.ceil(sim.orbShowerT)}s — collect and grow` : 'Shower complete — keep collecting the extra orbs') : 'Collect the rain-cloud power-up ahead';
      break;
    case 'jump': done = practice.sawJump && !sim.isJumping; break;
    case 'body-jump':
      trackPracticeBodyJump(sim, practice, size);
      practice.doubleCrossing ||= practice.crossedThisJump && sim.jumpCount >= 2;
      done = practice.bodyJumps >= (lesson.jumpGoal ?? 1) && (!lesson.requireDouble || practice.doubleCrossing);
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
      progress = sim.cautionFall ? 'Watch the worm fall into the cube, then dissolve'
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
    case 'collect-heal':
      done = state.wormTunnelCount > 0 && sim.phase === 'crawling' && state.wormPhase === 'crawling' && sim.tunnelPassages.length === 0 && (!['heal', 'collect-heal'].includes(lessonId) || sim.healed > 0) && (lessonId !== 'collect-heal' || state.wormSessionOrbs >= (lesson.orbGoal ?? 2));
      progress = lessonId === 'collect-heal' && state.wormSessionOrbs < 2 ? `${state.wormSessionOrbs} / 2 orbs collected — stay on the floor until both are yours` : state.wormTunnelCount === 0 ? 'Jump onto the raised pad ahead; Retry resets your approach'
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
      done = lessonId === 'surround' ? sim.healed > 0 && sim.healPauseT <= 0 : state.demoWormHazardCleared === 'bomb';
      break;
    }
    case 'rocket': done = practice.sawRocket && !sim.rocketActive && !sim.isJumping; break;
    case 'magnet': done = sim.magnetT > 0 && state.wormSessionOrbs >= 2; break;
    case 'water': done = practice.elementTime >= 3 && sim.waterMomentum > 0.75; break;
    case 'fire': done = practice.elementTime >= 3 && [...sim.elementalPatches.values()].some(p => p.type === 'fire'); break;
    // Height alone cannot distinguish a normal jump from consuming a spring.
    case 'grass': done = sim.elementalType === 'grass' && sim.isJumping && !!practice.grassLaunch; break;
    case 'ice': done = sim.elementalType === 'ice' && sim.isJumping; break;
    case 'air': done = practice.sawAirJump && !sim.isJumping && sim.phase === 'crawling' && sim.alive; break;
    case 'lightning': done = practice.elementTime >= 4; break;
    case 'signature': done = sim.signature.seq > 0 && (sim.signature.glowTrail?.path.count ?? 0) >= 2; break;
    case 'rotation': done = state.rotationEpoch > practice.rotationEpoch; break;
  }
  if (lesson.challenge) {
    // Use the simulation clock, not render delta or wall time. Pause, tab blur,
    // rescue and focus holds stop it; tunnel travel is excluded explicitly.
    const elapsed = Math.max(0, sim.timeAlive - practice.lastTime);
    practice.lastTime = sim.timeAlive;
    if (sim.phase === 'crawling' && state.wormPhase === 'crawling' && !sim.tunnelPassages.length) practice.elapsed += elapsed;
    const orbs = Math.max(0, (lesson.orbGoal ?? 0) - sim.powerups.filter(orb => orb.challengeSupply).length);
    if (lesson.orbGoal) done &&= orbs >= lesson.orbGoal;
    const goalProgress = lessonId === 'body-jump' ? `${practice.doubleCrossing && practice.bodyJumps ? 'Crossing cleared' : 'Double-jump'} · ${orbs}/${lesson.orbGoal} orbs`
      : lessonId === 'surround' ? `${orbs}/${lesson.orbGoal} orbs · ${sim.healed > 0 ? 'Ring sealed' : 'Close the ring'}`
        : `${orbs}/${lesson.orbGoal} orbs · ${sim.healed > 0 ? 'Sealed' : 'Seal the tunnel'}`;
    done &&= practice.elapsed <= lesson.timeLimit;
    const failed = !done && practice.elapsed >= lesson.timeLimit;
    return { done, failed, progress: `${goalProgress} · ${Math.max(0, Math.ceil(lesson.timeLimit - practice.elapsed))}s` };
  }
  return { done, progress };
}
