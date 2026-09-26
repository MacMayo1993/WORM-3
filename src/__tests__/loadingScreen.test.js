import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { PAPER_GRID, glslFloat, glslVec3, paperShiftX, paperShiftY } from '../utils/paperGrid.js';
import { LOADING_CUBE, RING, WAVE_SPREAD } from '../components/screens/loadingCube.js';
import {
  BEAT,
  THROAT,
  MOTE_COUNT,
  WORM_SEGMENTS,
  funnelPoint,
  landingPulse,
  landings,
  lensPaperPoint,
  mote,
  spinAngle,
  wormPose
} from '../components/screens/loadingWormhole.js';

const css = readFileSync('src/components/screens/LoadingScene.css', 'utf8');
const well = { cx: 400, cy: 300, a: 200, b: 72 };
const faces = LOADING_CUBE.flatMap((layer) => layer.faces);
const stickers = faces.flatMap((face) => face.stickers.map((s) => ({ ...s, face })));

describe('paper grid', () => {
  it('writes GLSL float literals', () => {
    expect(glslFloat(26)).toBe('26.0');
    expect(glslFloat(0.3)).toBe('0.3');
    expect(glslVec3([1, 0.5, 0])).toBe('vec3(1.0, 0.5, 0.0)');
  });

  it('bends lines by at most the wave plus the drift', () => {
    const limit = PAPER_GRID.bend + PAPER_GRID.drift;
    for (let i = 0; i < 200; i++) {
      expect(Math.abs(paperShiftX(i * 0.37, i * 0.21))).toBeLessThanOrEqual(limit + 1e-9);
      expect(Math.abs(paperShiftY(i * 0.53, i * 0.17))).toBeLessThanOrEqual(limit + 1e-9);
    }
  });
});

describe('loading cube', () => {
  it('carries all 54 stickers, nine to a colour', () => {
    expect(stickers).toHaveLength(54);
    expect(new Set(stickers.map((s) => s.key)).size).toBe(54);
    for (let id = 1; id <= 6; id++) expect(stickers.filter((s) => s.face.color === id)).toHaveLength(9);
  });

  it('flips every sticker to its antipodal colour', () => {
    for (const face of faces) expect(face.antipode).toBe(ANTIPODAL_COLOR[face.color]);
  });

  it('twists only the top layer, which carries a full ring of strips and a cap', () => {
    const [top, mid, bottom] = LOADING_CUBE;
    expect(top.faces.map((f) => f.side)).toEqual([...RING, 'top']);
    expect(mid.faces.map((f) => f.side)).toEqual(RING);
    expect(mid.plastic).toEqual(['top']);
    expect(bottom.faces.map((f) => f.side)).toEqual([...RING, 'bottom']);
  });

  it('sends the flip wave from the top of the cube to the bottom within its spread', () => {
    for (const s of stickers) {
      expect(s.delay).toBeGreaterThanOrEqual(0);
      expect(s.delay).toBeLessThanOrEqual(WAVE_SPREAD);
    }
    const capDelays = (side) => stickers.filter((s) => s.face.side === side).map((s) => s.delay);
    expect(Math.max(...capDelays('top'))).toBeLessThan(Math.min(...capDelays('bottom')));
  });
});

describe('loading screen timing', () => {
  it('shares its hop with the stylesheet', () => {
    expect(css).toContain(`--wl-beat: ${BEAT.period}s;`);
    // The top layer turns a quarter per hop, so the full cycle is four hops.
    expect(css).toContain(`--wl-cycle: ${BEAT.period * 4}s;`);
    const hop = css.slice(css.indexOf('@keyframes wl-hop'));
    const landing = hop.match(/(\d+(?:\.\d+)?)% \{ transform: translateY\(0\)/);
    expect(Number(landing[1])).toBeCloseTo((BEAT.land / BEAT.period) * 100, 6);
  });

  it('pulses when the cube lands and not before', () => {
    expect(landingPulse(0)).toBe(0);
    expect(landingPulse(BEAT.land - 0.01)).toBe(0);
    expect(landingPulse(BEAT.land)).toBeCloseTo(1, 6);
    expect(landingPulse(BEAT.land + BEAT.period)).toBeCloseTo(1, 6);
    expect(landingPulse(BEAT.land + 1)).toBeLessThan(0.1);
    expect(landings(BEAT.land + 2 * BEAT.period + 0.1)).toBe(3);
  });

  it('spins the vortex forward without a jump at any landing', () => {
    let last = spinAngle(0);
    for (let t = 0.005; t < 4 * BEAT.period; t += 0.005) {
      const angle = spinAngle(t);
      expect(angle).toBeGreaterThan(last);
      expect(angle - last).toBeLessThan(0.05);
      last = angle;
    }
  });
});

describe('wormhole geometry', () => {
  it('opens the funnel at the rim and narrows it to the throat', () => {
    const rim = funnelPoint(well, 0, 0);
    expect(rim.x).toBeCloseTo(well.cx + well.a, 6);
    expect(rim.y).toBeCloseTo(well.cy, 6);
    const throat = funnelPoint(well, 1, 0);
    expect(throat.r).toBeCloseTo(THROAT, 6);
    // The throat sits inside the mouth as seen, so the front lip never hides it all.
    const front = funnelPoint(well, 1, Math.PI / 2);
    expect(front.y).toBeLessThan(well.cy + well.b);
  });

  it('leaves distant paper alone and drags the rim into the mouth', () => {
    const far = lensPaperPoint(well, well.cx + 6 * well.a, well.cy, 0);
    expect(far).toEqual({ x: well.cx + 6 * well.a, y: well.cy });
    const rim = lensPaperPoint(well, well.cx, well.cy - well.b, 0);
    expect(Math.hypot((rim.x - well.cx) / well.a, (rim.y - well.cy) / well.b)).toBeLessThan(1);
  });

  it('never folds the paper over itself along a ray', () => {
    for (const pulse of [0, 1]) {
      let last = 0;
      for (let rho = 0.02; rho < 5; rho += 0.02) {
        const p = lensPaperPoint(well, well.cx + rho * well.a, well.cy, pulse);
        const reach = Math.hypot((p.x - well.cx) / well.a, (p.y - well.cy) / well.b);
        expect(reach).toBeGreaterThan(last);
        last = reach;
      }
    }
  });

  it('drifts confetti in from the paper and down to the throat', () => {
    for (let i = 0; i < MOTE_COUNT; i++) {
      for (let t = 0; t < 12; t += 0.25) {
        const m = mote(i, t);
        expect(m).toEqual(mote(i, t));
        if (m.outside) expect(m.rho).toBeGreaterThanOrEqual(1);
        else expect(m.s).toBeGreaterThanOrEqual(0);
        expect(m.s).toBeLessThanOrEqual(1);
        expect(m.alpha).toBeGreaterThanOrEqual(0);
        expect(m.alpha).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the worm in the throat between trips and brings it up the wall during one', () => {
    const hidden = wormPose(0.5);
    expect(hidden.segments).toHaveLength(WORM_SEGMENTS);
    expect(hidden.segments.every((seg) => seg.s === 1)).toBe(true);
    const out = wormPose(3.2);
    expect(out.segments[0].s).toBeLessThan(0.5);
    // Its body trails the head back down toward the throat.
    expect(out.segments[WORM_SEGMENTS - 1].s).toBeGreaterThanOrEqual(out.segments[0].s - 0.05);
    expect(ANTIPODAL_COLOR[out.colors[0]]).toBe(out.colors[1]);
  });
});
