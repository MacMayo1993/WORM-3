import { makeTileTrail, ttAt, ttPush } from '../circularBuffers.js';
import { BODY_BALL_SPACING } from './constants.js';
import { GLOW_TRAIL_LINGER_SECONDS } from '../characterAbilities.js';

// Retain painted tiles independently of the head's route, which resets at a
// tunnel exit. Bounded storage also caps rendering work in fast/boosted runs.
export function makeGlowTrail() {
  return { path: makeTileTrail(256), life: 0, sourceSeq: null };
}

export function breakGlowTrail(signature) {
  const trail = signature.glowTrail;
  if (!trail) return;
  trail.sourceSeq = null;
  if (trail.path.count && ttAt(trail.path, 0)) ttPush(trail.path, '');
}

export function tickGlowTrail(sim, delta) {
  const sig = sim.signature;
  const trail = sig.glowTrail;
  if (sig.character !== 'glow' || !trail || sim.phase !== 'crawling') return;
  trail.life = sig.active > 0 ? GLOW_TRAIL_LINGER_SECONDS : Math.max(0, trail.life - delta);
  if (sig.active <= 0) return;

  const source = sim.pathHistory;
  // Index 0 is the destination, often still ahead of the head. Account for
  // in-flight progress and the entire body before releasing a painted tile.
  const tailIndex = Math.max(1, Math.ceil((sim.tailLength - 1) * BODY_BALL_SPACING + 1 - sim.interpT));
  if (tailIndex >= source.count) return;
  const latest = source.seq[(source.head + tailIndex) % source.capacity];
  const oldest = source.seq[(source.head + source.count - 1) % source.capacity];
  // Seed at the tail on activation, never back-paint the whole pre-ability run.
  const first = Math.max(oldest, latest - trail.path.capacity + 1,
    trail.sourceSeq === null ? latest : trail.sourceSeq + 1);
  for (let seq = first; seq <= latest; seq++) {
    const index = source.nextSeq - 1 - seq;
    ttPush(trail.path, ttAt(source, index));
  }
  trail.sourceSeq = Math.max(trail.sourceSeq ?? latest, latest);
}
