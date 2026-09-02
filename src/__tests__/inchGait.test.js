// The Inch Worm's gait. It has to read as inching: a localized loop that stays put
// on the ground while the body pours through it, with flat body either side of it
// — not a shimmer, not one balloon over the whole worm, and never a loop bigger
// than the animal carrying it.
//
// Three of these tests are load-bearing rather than cosmetic:
//
//  * the crest must stay put on the CUBE as the worm crawls. The previous version
//    had the sign of the phase term inverted, which sent every crest sprinting
//    along the ground at twice the worm's own speed. That was the visible bug.
//  * bead spacing must stay near INCH_BALL_SPACING in 3D. Lift and ground position
//    are two halves of one arc-length budget; solved separately they disagree, and
//    beads pile up three deep at the crests.
//  * `dist` must strictly increase with segment index, because the renderer's curve
//    walk marches forward through the path buffer and cannot step back.
import { describe, it, expect } from 'vitest';
import {
  inchGaitInto,
  inchLoopShape,
  inchHumpCount,
  INCH_BALL_SPACING,
  INCH_ARCH_ASPECT,
  INCH_ARCH_DUTY,
  INCH_MAX_PITCH,
  INCH_SKEW
} from '../worm/healerWorm/inchGait.js';

const gait = (i, count, phase, move = 1) => {
  const out = { dist: 0, arch: 0 };
  inchGaitInto(out, i, count, phase, move, inchLoopShape(count));
  return out;
};

const archProfile = (count, phase) => {
  const a = [];
  for (let i = 0; i < count; i++) a.push(gait(i, count, phase).arch);
  return a;
};

// A loop the player can see: a run of lifted body with a single peak in it.
const countLoops = (count, phase) => {
  const a = archProfile(count, phase);
  let loops = 0;
  for (let i = 1; i < count - 1; i++) {
    if (a[i] > 0.05 && a[i] >= a[i - 1] && a[i] > a[i + 1]) loops++;
  }
  return loops;
};

describe('inch worm gait', () => {
  it('lays the body out flat at rest', () => {
    for (const count of [4, 40, 400]) {
      for (let i = 0; i < count; i += 7) {
        const g = gait(i, count, 3.7, 0);
        expect(g.dist).toBeCloseTo(i * INCH_BALL_SPACING, 10);
        expect(g.arch).toBe(0);
      }
    }
  });

  it('places segments in order, always — the curve walk cannot go backwards', () => {
    for (const count of [4, 9, 60, 500]) {
      // Including part-way through the ease in and out of the gait, where the flat
      // layout and the looped one are being blended.
      for (const move of [0.05, 0.4, 0.9, 1]) {
        for (let p = 0; p < 40; p++) {
          let prev = -Infinity;
          for (let i = 0; i < count; i++) {
            const d = gait(i, count, p * 0.0973, move).dist;
            expect(d).toBeGreaterThan(prev);
            prev = d;
          }
        }
      }
    }
  });

  it('keeps each loop planted on the cube while the body pours through it', () => {
    // The chain-fountain property, and the one the old gait got backwards: crawling
    // forward must not move the crest along the ground at all. Inverting the sign of
    // the phase sends it forward at twice the crawl speed instead, which is what read
    // as the animation spazzing.
    const count = 400;
    const crestWorld = (phase) => {
      let best = -1;
      let where = 0;
      for (let i = 1; i < count; i++) {
        const g = gait(i, count, phase);
        const w = phase - g.dist;
        if (w > -7 && w < -5 && g.arch > best) {
          best = g.arch;
          where = w;
        }
      }
      expect(best).toBeGreaterThan(0.5); // there really is a crest in that window
      return where;
    };
    const anchor = crestWorld(0);
    for (const crawled of [0.1, 0.3, 0.7, 1.5]) {
      // Within half a bead — the crest is only ever sampled at bead centres.
      expect(Math.abs(crestWorld(crawled) - anchor)).toBeLessThan(INCH_BALL_SPACING);
    }
  });

  it('carries the body through the loop head-first, from its trailing side', () => {
    // The corollary of a planted crest: a given segment index climbs the loop's
    // tail-ward face and comes down its head-ward one, so the arch moves *back* along
    // the body as the worm advances. Track one crest by the world spot it stands on,
    // since every crest away from the head has exactly the same height.
    const count = 400;
    const crestIndex = (phase) => {
      let best = -1;
      let at = 0;
      for (let i = 1; i < count; i++) {
        const g = gait(i, count, phase);
        const w = phase - g.dist;
        if (w > -7 && w < -5 && g.arch > best) { best = g.arch; at = i; }
      }
      expect(best).toBeGreaterThan(0.5);
      return at;
    };
    expect(crestIndex(0.4)).toBeGreaterThan(crestIndex(0));
  });

  it('holds bead spacing near its rest value through a loop', () => {
    // Lift and ground position are two halves of one arc-length budget. Solved
    // independently — as they were — the crest scrunched beads to about a third of
    // their rest spacing while the flanks stretched half again as far apart.
    for (const count of [40, 400, 1200]) {
      const shape = inchLoopShape(count);
      // Skip the head taper, where the rise is deliberately eased in.
      const skip = Math.ceil(Math.min(shape.halfWidth, shape.bodyArc * 0.25) / INCH_BALL_SPACING) + 1;
      let min = Infinity;
      let max = 0;
      for (let p = 0; p < 24; p++) {
        const phase = p * 0.137;
        let prev = null;
        for (let i = skip; i < count; i++) {
          const g = gait(i, count, phase);
          const cur = { x: g.dist, y: g.arch * shape.height };
          if (prev) {
            const d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
            min = Math.min(min, d);
            max = Math.max(max, d);
          }
          prev = cur;
        }
      }
      // A chord across a curve is always a little shorter than the arc it spans.
      expect(min).toBeGreaterThan(INCH_BALL_SPACING * 0.9);
      expect(max).toBeLessThanOrEqual(INCH_BALL_SPACING * 1.02);
    }
  });

  it('sizes the loop from the body, so a loop is never bigger than the worm', () => {
    // The old shape derived the width from a world-space height cap, which made a
    // single loop wider than every worm the game actually produces (it starts at 4
    // balls) and a loop pitch longer than the whole animal. Instead of inching, the
    // worm lay flat for a few tiles and then heaved its entire body a tile into the
    // air at once.
    for (const count of [4, 8, 13, 25, 40, 400]) {
      const shape = inchLoopShape(count);
      expect(2 * shape.halfWidth).toBeLessThan(shape.bodyArc + INCH_BALL_SPACING);
      expect(shape.height).toBeLessThan(shape.halfWidth);
      // Never taller than a third of a cube tile, whatever the body length.
      expect(shape.height).toBeLessThan(0.34);
    }
    // A loop's pitch stops growing once the body outgrows it, so a long worm carries
    // a train of identical loops rather than one enormous one.
    expect(inchLoopShape(1200).spacing).toBeCloseTo(INCH_MAX_PITCH, 10);
    expect(inchLoopShape(1200).halfWidth).toBeCloseTo(inchLoopShape(400).halfWidth, 10);
    // Height follows width at a fixed aspect.
    for (const count of [8, 40, 1200]) {
      const shape = inchLoopShape(count);
      expect(shape.height).toBeCloseTo(shape.halfWidth / INCH_ARCH_ASPECT, 10);
    }
    // Height grows with the body, up to that cap.
    let prev = 0;
    for (const count of [4, 12, 40, 120, 400]) {
      const h = inchLoopShape(count).height;
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
  });

  it('keeps flat body between loops — the loop is only legible against straight worm', () => {
    // A sine along the body left every segment mid-hump at all times, which read as a
    // shimmer rather than an inch. Most of a long body should be down.
    const count = 400;
    let flat = 0;
    for (const v of archProfile(count, 0.37)) if (v < 0.02) flat++;
    expect(flat / count).toBeGreaterThan(1 - INCH_ARCH_DUTY - 0.05);
  });

  it('leaves body between the loops lying still and flat', () => {
    const count = 400;
    const shape = inchLoopShape(count);
    // Past the head taper, which eases beads into the gait on purpose.
    const skip = Math.ceil(shape.halfWidth / INCH_BALL_SPACING) + 1;
    let flatPairs = 0;
    let lifted = 0;
    for (let p = 0; p < 30; p++) {
      const phase = p * 0.37;
      for (let i = skip; i + 1 < count; i++) {
        const here = gait(i, count, phase);
        const behind = gait(i + 1, count, phase);
        if (here.arch > 0) { lifted++; continue; }
        if (behind.arch > 0) continue;
        // Two consecutive segments of down body sit one rest spacing apart: no
        // creeping accordion reaching out of a loop into the straight worm. (The
        // slack is the resolution of the ground↔arc table, ~1e-5 of a world unit.)
        expect(behind.dist - here.dist).toBeCloseTo(INCH_BALL_SPACING, 4);
        flatPairs++;
      }
    }
    expect(lifted).toBeGreaterThan(0);
    expect(flatPairs).toBeGreaterThan(0);
  });

  it('grows more loops as the body grows', () => {
    const counts = [120, 400, 800, 1600];
    const loops = counts.map((c) => countLoops(c, 0.21));
    for (let k = 1; k < loops.length; k++) {
      expect(loops[k]).toBeGreaterThan(loops[k - 1]);
    }
    for (let k = 0; k < counts.length; k++) {
      expect(Math.abs(loops[k] - inchHumpCount(counts[k]))).toBeLessThanOrEqual(1);
    }
    // A fresh worm still inches — one loop passes over it at a time.
    let sawALoop = false;
    for (let p = 0; p < 60; p++) if (countLoops(8, p * 0.05) >= 1) sawALoop = true;
    expect(sawALoop).toBe(true);
  });

  it('rears up gently and tips over forward', () => {
    // Asymmetry is the push: the trailing face of the loop is longer than the leading
    // one, so a bead climbs slowly and is thrown off the front. Both faces still have
    // to reach zero at their edge — the old profile culled the trailing face while it
    // was still at 11% of full height, and every bead leaving a loop popped.
    expect(INCH_SKEW).toBeGreaterThan(0);
    const count = 400;
    const a = archProfile(count, 0);
    let crest = -1;
    let best = 0;
    for (let i = 1; i < count - 1; i++) if (a[i] > best) { best = a[i]; crest = i; }
    expect(crest).toBeGreaterThan(0);
    let behind = 0;
    let ahead = 0;
    for (let i = crest; i < count && a[i] > 0.02; i++) behind++;
    for (let i = crest; i >= 0 && a[i] > 0.02; i--) ahead++;
    expect(behind).toBeGreaterThan(ahead);
    // No cliff at either edge of a loop.
    for (let i = 1; i < count; i++) expect(Math.abs(a[i] - a[i - 1])).toBeLessThan(0.35);
  });

  it('never slides a segment more than one loop can account for', () => {
    // The gait before last scaled compression by the segment's own arc, so the tail of
    // a 400-segment worm slid ~10 world units per cycle. The ground a segment gives up
    // is only ever the arc the loops between it and the head are standing in.
    for (const count of [4, 100, 1200]) {
      const shape = inchLoopShape(count);
      const loops = Math.ceil(shape.bodyArc / shape.spacing) + 1;
      for (let p = 0; p < 12; p++) {
        for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 40))) {
          const slip = i * INCH_BALL_SPACING - gait(i, count, p * 0.31).dist;
          expect(slip).toBeGreaterThanOrEqual(-1e-9);
          expect(slip).toBeLessThanOrEqual(loops * shape.halfWidth);
        }
      }
    }
  });

  it('anchors the head — the simulation plants it flat on its tile', () => {
    const count = 400;
    for (let p = 0; p < 16; p++) {
      const phase = p * 0.19;
      expect(gait(0, count, phase).arch).toBe(0);
      expect(gait(0, count, phase).dist).toBe(0);
      // ...and the bead right behind it is eased in rather than snapped up.
      expect(gait(1, count, phase).arch).toBeLessThan(0.25);
    }
  });

  it('never returns an arch outside 0..1', () => {
    for (const count of [4, 50, 600]) {
      for (let p = 0; p < 10; p++) {
        for (let i = 0; i < count; i += 3) {
          for (const move of [0, 0.3, 1]) {
            const a = gait(i, count, p * 0.41, move).arch;
            expect(a).toBeGreaterThanOrEqual(0);
            expect(a).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('reuses one shape per body length instead of rebuilding its tables every frame', () => {
    expect(inchLoopShape(40)).toBe(inchLoopShape(40));
  });

  it('degenerates safely on a one-ball worm', () => {
    expect(gait(0, 1, 2.5)).toEqual({ dist: 0, arch: 0 });
    expect(inchHumpCount(1)).toBe(0);
    expect(inchHumpCount(0)).toBe(0);
  });
});
