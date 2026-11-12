import { makeGrowthOrb } from './orbSpawning.js';
import { flipStickerPair, buildManifoldGridMap } from '../../game/manifoldLogic.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { BASE_TAIL_LENGTH, BODY_BALL_SPACING, ORB_SEGMENT_GROWTH } from './constants.js';
import { seedPracticeBody, BODY_JUMP_PATH } from './bodyJumpPractice.js';
import { ttReset } from '../circularBuffers.js';
import { rotationClock } from './rotationClockBridge.js';
import { FACE_COLORS } from '../../utils/constants.js';

export { DEMO_SIGNATURE_LESSONS } from '../../game/demoSignatureLessons.js';

export const isDemoSignatureLesson = lesson => lesson?.practiceId === 'signature-showcase';
const key = tile => `${tile.x},${tile.y},${tile.z},${tile.dirKey}`;
const total = inventory => Object.values(inventory ?? {}).reduce((sum, value) => sum + value, 0);

/** Call after basic practice staging; use the returned cubies. */
export function stageDemoSignature(sim, size, lesson, practice, cubies, inventory, orbColor = face => FACE_COLORS[face]) {
  if (!isDemoSignatureLesson(lesson)) return cubies;
  const c = Math.floor(size / 2), character = lesson.character;
  sim.pos = { x: c, y: character === 'wiggle' ? Math.min(3, size - 2) : 0, z: size - 1, dirKey: 'PZ' };
  sim.moveDir = 'up';
  sim._curWP.fromArray(getStickerWorldPos(sim.pos.x, sim.pos.y, sim.pos.z, 'PZ', size, 0));
  sim.headInterpPos.copy(sim._curWP);
  ttReset(sim.tileTrail, key(sim.pos)); ttReset(sim.pathHistory, key(sim.pos));
  sim.powerups = []; sim.specials = [];
  practice.signature = { character, seen: false, remoteCaught: false, sweptCatch: false, slamCatch: false,
    slipped: false, owned: false, clockMoved: false, heldTime: 0, lastClock: null,
    inventory: { ...inventory }, healed: sim.healed ?? 0 };
  if (['classic', 'inch', 'wiggle'].includes(character)) {
    const y = character === 'inch' ? Math.min(4, size - 1) : 1;
    sim.powerups = [-1, 1].map(dx => makeGrowthOrb({ x: c + dx, y, z: size - 1, dirKey: 'PZ' }));
  }
  if (character === 'wiggle') {
    seedPracticeBody(sim, size, Array.from({ length: sim.pos.y + 1 }, (_, i) => [c, sim.pos.y - i]));
    sim.tailLength = Math.ceil(3 / BODY_BALL_SPACING);
  }
  if (character === 'glow') {
    seedPracticeBody(sim, size, BODY_JUMP_PATH.map(([x, y]) => [x + c - 2, y]));
    sim.tailLength = Math.ceil(10 / BODY_BALL_SPACING);
    practice.target = { x: c, y: 2, z: size - 1, dirKey: 'PZ' };
  }
  if (character === 'prism') {
    const target = { x: c, y: Math.min(3, size - 2), z: size - 1, dirKey: 'PZ' };
    // Two nonmatching colors force Spectrum's wildcard path; no matching stock
    // and no growth pickups can accidentally satisfy an ordinary color heal.
    cubies = flipStickerPair(cubies, size, target.x, target.y, target.z, target.dirKey, buildManifoldGridMap(cubies, size));
    const face = cubies[target.x][target.y][target.z].stickers.PZ.curr;
    const colors = [1, 2, 3, 4, 5, 6].filter(id => id !== face).slice(0, 2);
    Object.keys(inventory).forEach(id => { inventory[id] = 0; });
    colors.forEach(id => { inventory[id] = ORB_SEGMENT_GROWTH; });
    sim.tailLength = BASE_TAIL_LENGTH + 2 * ORB_SEGMENT_GROWTH;
    sim.orbPickupFaceIds = colors; sim.orbPickupColors = colors.map(orbColor);
    sim.orbPickupSegments = Array(2).fill(ORB_SEGMENT_GROWTH);
    practice.target = target;
    practice.signature.inventory = { ...inventory };
    practice.signature.entryFace = face;
  }
  practice.signature.orbs = sim.powerups.map(orb => ({ ...orb }));
  return cubies;
}

/** Read after a physics tick. Inputs/activation alone cannot complete a task. */
export function readDemoSignature(sim, practice, lesson, state, delta, clock = rotationClock) {
  if (!isDemoSignatureLesson(lesson)) return null;
  const p = practice.signature, sig = sim.signature;
  if (!p || !sig || !sim.alive) return { done: false, progress: 'Retry to set up this signature again' };
  const character = lesson.character;
  const active = sig.character === character && sig.seq > 0;
  p.seen ||= active;
  const remaining = new Set(sim.powerups.map(key));
  const removed = p.orbs.filter(orb => !remaining.has(key(orb)));
  if (active && character === 'classic' && sim.magnetT > 0) p.remoteCaught ||= removed.some(orb => key(orb) !== key(sim.pos));
  if (active && character === 'wiggle' && (sig.sweep || sig.active > 0)) p.sweptCatch ||= removed.length > 0;
  if (active && character === 'inch' && sig.slam?.seq > 0) p.slamCatch ||= removed.length > 0;
  if (active && character === 'glow') p.slipped ||= sig.notice === 'Slipped through the light';
  if (active && character === 'mobi') p.owned ||= !!sig.mobiTunnel;
  // Only compare consecutive observed frames; a press before a live countdown
  // exists is not proof of stopping a clock. Resume is also mandatory.
  if (character === 'book' && clock.total > 0) {
    const moved = p.lastClock !== null && clock.secondsLeft < p.lastClock - 0.00001;
    if (!sig.active && moved && !clock.held) p.clockMoved = true;
    if (active && sig.active > 0 && p.clockMoved && clock.held && p.lastClock !== null && Math.abs(clock.secondsLeft - p.lastClock) < 0.00001) p.heldTime += Math.min(delta, 0.1);
    if (p.heldTime >= 1 && sig.active <= 0 && moved && !clock.held) p.resumed = true;
    p.lastClock = clock.secondsLeft;
  }
  const landed = sim.phase === 'crawling' && !sim.isJumping;
  const tailClear = landed && sim.tunnelPassages.length === 0;
  const spentColors = Object.keys(p.inventory).filter(id => (state.wormOrbInventory?.[id] ?? p.inventory[id]) < p.inventory[id]);
  const done = ({
    classic: p.seen && p.remoteCaught,
    book: p.seen && !!p.resumed,
    prism: sim.healed > p.healed && tailClear && spentColors.length >= 2 &&
      total(p.inventory) - total(state.wormOrbInventory) >= 4 && (p.inventory[p.entryFace] ?? 0) === 0,
    wiggle: p.seen && p.sweptCatch && !sig.sweep && sig.active <= 0,
    inch: p.seen && p.slamCatch && landed && sig.slam?.seq > 0,
    glow: p.seen && p.slipped && landed,
    mobi: p.seen && p.owned && state.wormTunnelCount > 0 && tailClear,
  })[character] ?? false;
  const progress = ({
    classic: 'Call a side-lane orb without touching its tile',
    book: p.heldTime >= 1 ? 'Wait for Time Out to finish and the countdown to resume' : p.clockMoved ? 'Use Pause and watch the live countdown hold' : 'Let the live countdown begin before pressing Pause',
    prism: sim.healed > p.healed ? 'Let the whole tail clear the exit' : 'Jump onto the pad with your mixed-color charges',
    wiggle: p.sweptCatch ? 'Orb swept up — let the sweep finish' : 'Sweep a nearby orb with Wiggle',
    inch: 'Land a Spring leap and collect an orb with its slam',
    glow: 'Use Trail, then keep straight through your body',
    mobi: p.owned ? 'Keep moving until the whole tail exits your tunnel' : 'Create a tunnel on the floor beneath you',
  })[character];
  // A removed orb cannot be credited by a later activation.
  p.orbs = p.orbs.filter(orb => remaining.has(key(orb)));
  return { done: !!done, progress };
}
