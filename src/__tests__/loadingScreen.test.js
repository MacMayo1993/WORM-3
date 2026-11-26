import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { PAPER_GRID, glslFloat, glslVec3, paperShiftX, paperShiftY } from '../utils/paperGrid.js';
import { LOADING_CUBE, RING, WAVE_SPREAD } from '../components/screens/loadingCube.js';
import {
  FALL,
  EXIT_RIM_DEPTH,
  LOADING_START_PHASE,
  PASS_AT,
  crossing,
  THROAT,
  MOTE_COUNT,
  WORM_SEGMENTS,
  funnelPoint,
  lensPaperPoint,
  mote,
  passPulse,
  passes,
  shaftClipPath,
  shaftFadeMask,
  FLOOR_FADE_END,
  spinAngle,
  wormPose
} from '../components/screens/loadingWormhole.js';

const css = readFileSync('src/components/screens/LoadingScene.css', 'utf8');
const shellCss = readFileSync('src/components/screens/LoadingScreen.css', 'utf8');
const keyframes = (name) => css.slice(css.indexOf(`@keyframes ${name}`), css.indexOf('\n}\n', css.indexOf(`@keyframes ${name}`)));
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

  it('gives only the exterior sticker faces a static, inset colour backing', () => {
    const scene = readFileSync('src/components/screens/LoadingScene.jsx', 'utf8');
    expect(scene).toContain('wl-face wl-sticker-bed');
    expect(scene).toContain('wl-face wl-cap wl-${side}');
    const backing = css.match(/\.wl-sticker-bed::before\s*\{([^}]+)\}/)?.[1];
    expect(backing).toContain('background: var(--wl-sc)');
    expect(backing).toContain('var(--wl-c) var(--wl-c) repeat');
    expect(backing).not.toContain('animation');
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
  it('shares the fall between the portals with the stylesheets', () => {
    expect(css).toContain(`--wl-beat: ${FALL.period}s;`);
    // The top layer turns a half twist every other fall, so the full cycle is four.
    expect(css).toContain(`--wl-cycle: ${FALL.period * 4}s;`);
    expect(shellCss).toContain(`--wl-drop: calc(var(--wl-cube) * ${FALL.drop});`);
    const fall = keyframes('wl-fall');
    expect(fall).toContain(`from { transform: translateY(calc(var(--wl-cube) * -${FALL.lead})); }`);
    expect(fall).toContain(`to { transform: translateY(calc(var(--wl-cube) * -${FALL.lead} + 2 * var(--wl-drop))); }`);
    expect(css).toContain('animation: wl-fall calc(var(--wl-beat) * 2) linear infinite backwards;');
    expect(css).toMatch(/\.wl-twin \{\s*animation-delay: calc\(var\(--wl-beat\) - var\(--wl-start-phase\)\);/);
    expect(css).not.toContain('wl-first-fall');
  });

  it('shows both halves of the first real transfer in the first fraction of a second', () => {
    const sharedPass = FALL.period + PASS_AT - LOADING_START_PHASE;
    expect(LOADING_START_PHASE).toBeGreaterThan(FALL.period);
    expect(sharedPass).toBeGreaterThan(0);
    expect(sharedPass).toBeLessThan(0.3);
    expect(crossing(LOADING_START_PHASE)).toBeGreaterThan(0.5);
    expect(crossing(sharedPass + LOADING_START_PHASE)).toBeCloseTo(1, 6);
    expect(css.match(/animation-delay: calc\(0s - var\(--wl-start-phase\)\);/g)).toHaveLength(3);
  });

  it('ripples the paper as the cube passes through, when the vortex kicks', () => {
    const passPercent = (PASS_AT / FALL.period) * 100;
    expect(FALL.lead + FALL.cut).toBeCloseTo(FALL.drop / 2, 6);
    expect(passPercent).toBeCloseTo(50, 6);
    const cssPassPercent = keyframes('wl-shock').match(/0%, ([\d.]+)% \{[^}]*opacity: 0; \}/);
    expect(cssPassPercent).not.toBeNull();
    expect(Number(cssPassPercent[1])).toBeCloseTo(passPercent, 6);
  });

  it('pulses as the cube passes through the portals and not before', () => {
    expect(passPulse(0)).toBe(0);
    expect(passPulse(PASS_AT - 0.01)).toBe(0);
    expect(passPulse(PASS_AT)).toBeCloseTo(1, 6);
    expect(passPulse(PASS_AT + FALL.period)).toBeCloseTo(1, 6);
    expect(passPulse(PASS_AT + 1)).toBeLessThan(0.1);
    expect(passes(PASS_AT + 2 * FALL.period + 0.1)).toBe(3);
  });

  it('spins the vortex forward without a jump at any pass', () => {
    let last = spinAngle(0);
    for (let t = 0.005; t < 4 * FALL.period; t += 0.005) {
      const angle = spinAngle(t);
      expect(angle).toBeGreaterThan(last);
      expect(angle - last).toBeLessThan(0.05);
      last = angle;
    }
  });
});

describe('the shaft between the portals', () => {
  const clip = shaftClipPath('R', 'C', 12, 'E');
  const points = clip.slice('polygon('.length, -1).split(', ');

  it('shows the cube in the whole exit mouth as it comes out, never hiding it inside the opening', () => {
    expect(points).toHaveLength(26);
    // Over the exit mouth's back rim: the cube is seen in the whole opening,
    // and hidden only above the mouth.
    expect(points[0]).toBe('0% calc(R + E * 0)');
    expect(points[6]).toBe('50% calc(R + E * -1)'); // the back of the exit mouth
    expect(points[12]).toBe('100% calc(R + E * 0)');
    for (const point of points.slice(0, 13)) expect(point).not.toMatch(/E \* 0\.\d+\)$|E \* 1\)$/);
    // The exit mouth is the flattened ellipse LoadingPortal draws there.
    expect(shaftClipPath()).toContain(`min(var(--wl-wb), calc(var(--wl-cube) * var(--wl-exit-rim, ${EXIT_RIM_DEPTH})))`);
  });

  it('shows the cube in the whole floor mouth as it sinks, hidden only behind the near lip', () => {
    expect(points[13]).toBe('100% calc(100% - R + C * 0)');
    expect(points[19]).toBe('50% calc(100% - R + C * 1)'); // the floor mouth's front rim
    expect(points[25]).toBe('0% calc(100% - R + C * 0)');
    // By default the floor arc is the mouth's own half-height, not a line through its centre.
    expect(shaftClipPath()).toContain('calc(100% - var(--wl-wb) + var(--wl-wb) * 1)');
  });

  it('fades what has gone through the floor surface into the throat, gone before the near lip', () => {
    const mask = shaftFadeMask('R', 'C');
    expect(mask).toBe(`linear-gradient(to bottom, #000 calc(100% - R + C), #0000 calc(100% - R * ${FLOOR_FADE_END}))`);
    // Fully faded inside the opening, below the surface's front.
    expect(FLOOR_FADE_END).toBeGreaterThan(0);
    expect(FLOOR_FADE_END).toBeLessThan(1);
    expect(FALL.cut).toBeLessThan(EXIT_RIM_DEPTH - 0.1);
    expect(shaftFadeMask()).toContain(`calc(var(--wl-cube) * ${FALL.cut})`);
  });

  it('passes through, half in each portal, mid-fall', () => {
    expect(shellCss).toContain('aspect-ratio: 1 / 0.36;');
    expect(css).toContain('--wl-wb: calc(var(--wl-well-w) * 0.18);');
    expect(PASS_AT / FALL.period).toBeCloseTo(0.5, 6);
  });

  it('keeps each cube hidden at both track endpoints, with no mid-shaft reset', () => {
    // Conservative projected half-height of the tilted CSS cube, in cubes.
    const halfCube = 0.9;
    // The cube starting the fall is wholly above the upper portal's cut ...
    expect(-FALL.lead + halfCube).toBeLessThan(FALL.cut - 0.4);
    // ... and the same cube ending it wholly below the floor mouth's near lip
    // (half-height 2.4 × 0.18 cubes).
    expect(2 * FALL.drop - FALL.lead - halfCube).toBeGreaterThan(FALL.drop + 2.4 * 0.18 + 0.1);
  });

  it("lights the portals' surfaces while the cube breaks through them, and not at the restart", () => {
    expect(crossing(PASS_AT)).toBeCloseTo(1, 6);
    expect(crossing(PASS_AT + FALL.period)).toBeCloseTo(1, 6);
    expect(crossing(0)).toBe(0);
    expect(crossing(FALL.period - 0.001)).toBe(0);
    let last = crossing(0);
    for (let t = 0.01; t < 3 * FALL.period; t += 0.01) {
      expect(Math.abs(crossing(t) - last)).toBeLessThan(0.05);
      last = crossing(t);
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
