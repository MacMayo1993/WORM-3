import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeWormSim, resetWormSim, jumpLiftOf } from '../worm/healerWorm/wormSim.js';
import { shPush, shReset } from '../worm/circularBuffers.js';
import { BASE_TAIL_LENGTH } from '../worm/healerWorm/constants.js';
import { checkWormHitBySlice } from '../worm/wormHelpers.js';
import { animateWormFace } from '../worm/wormFaceExpression.js';
import {
  WORMD_STYLES, wormdKindForDeath, wormdStyle, wormdLetterInto, wormdShakeInto, wormdBurstInto, wormdRingInto,
  starburstPoints, seededRandom, seedSparks, sparkOffsetInto, sampleSeveredTail, severedBeadColor,
  severedPieceInto, SEVERED_HOLD, SEVERED_RIPPLE, SEVERED_TOTAL, MAX_SEVERED_PIECES
} from '../worm/healerWorm/wormdFx.js';

function wormAlong(points, count = 100, size = 7) {
  const sim = makeWormSim(size);
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  sim.tailLength = count;
  sim.currentNormal.set(0, 0, 1);
  sim.headInterpPos.copy(points[0]).addScaledVector(sim.currentNormal, -0.08);
  shReset(sim.stepHistory);
  for (let i = points.length - 1; i >= 0; i--) shPush(sim.stepHistory, points[i], sim.currentNormal, 3, 3, 6);
  const worm = Object.fromEntries(Object.keys(sim).map(key => [key, {
    get current() { return sim[key]; }, set current(value) { sim[key] = value; }
  }]));
  worm.jumpLift = () => jumpLiftOf(sim);
  return { sim, worm };
}

describe("WORM'D styles", () => {
  it('gives every hit a word, caption, colours and a finite duration', () => {
    for (const style of Object.values(WORMD_STYLES)) {
      expect(style.word.length).toBeGreaterThan(2);
      expect(style.sub.length).toBeGreaterThan(2);
      for (const key of ['fill', 'ink', 'burst']) expect(style[key]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.sparks.length).toBeGreaterThan(0);
      expect(style.duration).toBeGreaterThan(1);
    }
    expect(wormdStyle('nope')).toBe(WORMD_STYLES.sliced);
  });

  it('maps every death that is a hit to a beat, and the clock running out to none', () => {
    expect(wormdKindForDeath('slice-rotation')).toBe('sliced');
    expect(wormdKindForDeath('bomb')).toBe('blasted');
    expect(wormdKindForDeath('self')).toBe('bite');
    expect(wormdKindForDeath('self-collision')).toBe('bite');
    expect(wormdKindForDeath('void-tunnel-exhausted')).toBe('void');
    expect(wormdKindForDeath('portal-crawler')).toBe('overrun');
    expect(wormdKindForDeath('story-timeout')).toBeNull();
  });
});

describe("WORM'D motion", () => {
  const pose = { scale: 0, rot: 0, y: 0, opacity: 0 };

  it('slams letters in one after another and settles them', () => {
    wormdLetterInto(pose, 0.01, 3, 6);
    expect(pose.opacity).toBe(0); // not landed yet
    wormdLetterInto(pose, 0.02, 0, 6);
    expect(pose.scale).toBeGreaterThan(1.5); // lands oversized
    wormdLetterInto(pose, 1.2, 0, 6);
    expect(pose.scale).toBeCloseTo(1, 5);
    expect(pose.y).toBeCloseTo(0, 5);
    expect(pose.opacity).toBe(1);
    wormdLetterInto(pose, 4.2, 0, 6, { duration: 4.2 });
    expect(pose.opacity).toBe(0);
  });

  it('only fades under reduced motion', () => {
    wormdLetterInto(pose, 0.02, 0, 6, { reducedMotion: true });
    expect(pose.scale).toBe(1);
    expect(pose.y).toBe(0);
    const shake = wormdShakeInto({ x: 0, y: 0 }, 0.01, { reducedMotion: true });
    expect(shake).toEqual({ x: 0, y: 0 });
    expect(wormdRingInto({}, 0.1, { reducedMotion: true }).visible).toBe(false);
  });

  it('kicks the word on impact and lets the shake die away', () => {
    const early = wormdShakeInto({ x: 0, y: 0 }, 0.02, { fatal: true });
    const late = wormdShakeInto({ x: 0, y: 0 }, 0.8, { fatal: true });
    expect(Math.hypot(early.x, early.y)).toBeGreaterThan(1);
    expect(Math.hypot(late.x, late.y)).toBeLessThan(0.01);
  });

  it('punches the starburst past full size and fades it by the end', () => {
    const burst = { scale: 0, rot: 0, opacity: 0 };
    expect(wormdBurstInto(burst, 0, {}).scale).toBeCloseTo(0, 5);
    expect(wormdBurstInto(burst, 0.14, {}).scale).toBeGreaterThan(0.5);
    expect(wormdBurstInto(burst, 4.2, { duration: 4.2 }).opacity).toBeCloseTo(0, 6);
  });

  it('races the shockwave out and retires it', () => {
    const ring = {};
    wormdRingInto(ring, 0.05, {});
    const small = ring.scale;
    wormdRingInto(ring, 0.4, {});
    expect(ring.scale).toBeGreaterThan(small);
    expect(wormdRingInto(ring, 1, {}).visible).toBe(false);
  });

  it('draws a closed spiky starburst', () => {
    const points = starburstPoints(14, 7).split(' ');
    expect(points).toHaveLength(28);
    expect(starburstPoints(14, 7)).toBe(starburstPoints(14, 7));
  });
});

describe('sparks', () => {
  it('are seeded, so a replayed hit sprays the same way', () => {
    const a = seededRandom(42), b = seededRandom(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
    expect(seedSparks([], 8, [0, 0, 1], 3)).toEqual(seedSparks([], 8, [0, 0, 1], 3));
  });

  it('fly out of the struck face, then fall', () => {
    const sparks = seedSparks([], 20, [0, 0, 1], 9);
    for (const spark of sparks) expect(spark.v[2]).toBeGreaterThan(0);
    const out = [0, 0, 0];
    const spark = { v: [0, 0, 0], size: 0.1 };
    sparkOffsetInto(out, spark, 0.5);
    expect(out[1]).toBeLessThan(0);
  });
});

describe('severed tail', () => {
  const line = n => Array.from({ length: n + 1 }, (_, i) => new THREE.Vector3(-2 + i * 5 / n, 0, 3.6));

  it('samples the beads beyond the cut, along the body path, from the cut to the tip', () => {
    const { worm } = wormAlong(line(200), 40);
    const out = [];
    const n = sampleSeveredTail(worm, 20, out);
    expect(n).toBe(20);
    expect(out[0].bead).toBe(20);
    // Bead 20 sits 20 × 0.09 = 1.8 along the straight body from the head.
    expect(out[0].pos[0]).toBeCloseTo(-2 + 1.8, 1);
    for (let i = 1; i < n; i++) expect(out[i].pos[0]).toBeGreaterThan(out[i - 1].pos[0]);
    expect(out[0].normal).toEqual([0, 0, 1]);
  });

  it('keeps the piece count bounded for a long worm', () => {
    const long = Array.from({ length: 1001 }, (_, i) => new THREE.Vector3(-2 + i * 0.1, 0, 3.6));
    const { worm } = wormAlong(long, 1000);
    const out = [];
    const n = sampleSeveredTail(worm, 10, out);
    expect(n).toBeLessThanOrEqual(MAX_SEVERED_PIECES);
    expect(n).toBeGreaterThan(MAX_SEVERED_PIECES / 2);
  });

  it('samples exactly what a physical slice cut removes', () => {
    const { worm } = wormAlong(line(500), 100);
    const hit = checkWormHitBySlice(worm, 'col', 3, 7);
    const out = [];
    expect(sampleSeveredTail(worm, hit.keepCount, out)).toBeGreaterThan(0);
    expect(out[0].bead).toBe(hit.keepCount);
    // The first removed bead is on the far side of the seam at x = -0.5.
    expect(out[0].pos[0]).toBeGreaterThan(-0.5 - 0.1);
  });

  it('samples nothing when nothing is removed', () => {
    const { worm } = wormAlong(line(50), 30);
    expect(sampleSeveredTail(worm, 30, [])).toBe(0);
  });

  it('colours beads the way the body does', () => {
    const orbs = ['#ff0000', '#00ff00'];
    expect(severedBeadColor(0, orbs, '#123456')).toBe('#123456');
    expect(severedBeadColor(BASE_TAIL_LENGTH, orbs, '#123456')).toBe('#123456');
    expect(severedBeadColor(BASE_TAIL_LENGTH + 1, orbs, '#123456')).toBe('#ff0000');
    expect(severedBeadColor(BASE_TAIL_LENGTH + 4, orbs, '#123456')).toBe('#00ff00');
    expect(severedBeadColor(BASE_TAIL_LENGTH + 7, orbs, '#123456')).toBe('#123456');
  });

  it('holds, pops in a ripple from the cut to the tip, flies off and is gone', () => {
    const near = { pos: [1, 0, 3.6], normal: [0, 0, 1], rank: 0, spin: [0, 0, 0] };
    const far = { pos: [2, 0, 3.6], normal: [0, 0, 1], rank: 1, spin: [0, 0, 0] };
    const pose = {};
    severedPieceInto(pose, near, 0.02);
    expect([pose.x, pose.y, pose.z]).toEqual(near.pos);
    // The piece nearest the cut is airborne while the tip still waits.
    const t = SEVERED_HOLD + SEVERED_RIPPLE * 0.5;
    severedPieceInto(pose, near, t);
    expect(pose.z).toBeGreaterThan(3.6);
    severedPieceInto(pose, far, t);
    expect(pose.z).toBe(3.6);
    severedPieceInto(pose, far, SEVERED_TOTAL);
    expect(pose.scale).toBeCloseTo(0, 5);
  });

  it('only shrinks in place under reduced motion', () => {
    const piece = { pos: [1, 0, 3.6], normal: [0, 0, 1], rank: 0.5, spin: [1, 1, 1] };
    const pose = severedPieceInto({}, piece, 0.6, true);
    expect([pose.x, pose.y, pose.z]).toEqual(piece.pos);
    expect(pose.scale).toBeLessThan(1);
    expect(severedPieceInto({}, piece, SEVERED_TOTAL, true).scale).toBe(0);
  });
});

describe('knocked-out face', () => {
  const part = () => { const o = new THREE.Object3D(); o.scale.setScalar(1); return o; };
  const faceParts = () => ({ eyes: [part(), part()], pupils: [part(), part()], mouth: part() });

  it('leaves the living face untouched', () => {
    const a = faceParts(), b = faceParts();
    animateWormFace(a, 'classic', 1.3, {});
    animateWormFace(b, 'classic', 1.3, { ko: 0, koTime: 5 });
    expect(b.pupils[0].position.toArray()).toEqual(a.pupils[0].position.toArray());
    expect(b.mouth.scale.toArray()).toEqual(a.mouth.scale.toArray());
  });

  it('droops the eyes, spins the pupils and drops the mouth open', () => {
    const alive = faceParts(), ko = faceParts(), later = faceParts();
    animateWormFace(alive, 'classic', 1.3, {});
    animateWormFace(ko, 'classic', 1.3, { ko: 1, koTime: 0.1 });
    animateWormFace(later, 'classic', 1.3, { ko: 1, koTime: 0.3 });
    expect(ko.eyes[0].scale.y).toBeLessThan(alive.eyes[0].scale.y);
    expect(ko.mouth.scale.y).toBeGreaterThan(alive.mouth.scale.y);
    expect(ko.mouth.scale.x).toBeLessThan(alive.mouth.scale.x);
    expect(later.pupils[0].position.distanceTo(ko.pupils[0].position)).toBeGreaterThan(0.01);
    // Opposite spin directions.
    expect(ko.pupils[0].position.y - alive.pupils[0].position.y)
      .not.toBeCloseTo(ko.pupils[1].position.y - alive.pupils[1].position.y, 5);
  });
});
