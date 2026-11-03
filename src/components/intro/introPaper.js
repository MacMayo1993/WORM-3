import { RUBIKS_CLASSIC } from '../../utils/constants.js';

// One full tour in twelve seconds, within the 13.5-second opening. Each face
// gets a clear hold before a gentle crossfade; white is a real stop, not gold.
export const INTRO_PAPER_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'white'].map(name => RUBIKS_CLASSIC[name]);
export const INTRO_PAPER_STEP = 2;
export const INTRO_PAPER_HOLD = 1.25;
export const INTRO_PAPER_PERIOD = INTRO_PAPER_STEP * INTRO_PAPER_COLORS.length;
const DISPLAY_COLORS = INTRO_PAPER_COLORS.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255));

/** Raw display RGB for the un-tonemapped paper. No per-frame allocation.
 * Use the intro's visible-page clock so replay, backgrounding and slow frames
 * stay in sync with the cinematic. Reduced motion rests on white paper. */
export function introPaperTintInto(out, time, reducedMotion = false) {
  const t = Number.isFinite(time) ? Math.max(0, time) % INTRO_PAPER_PERIOD : 0;
  const index = reducedMotion ? 5 : Math.floor(t / INTRO_PAPER_STEP);
  const phase = t % INTRO_PAPER_STEP;
  const u = reducedMotion ? 0 : Math.max(0, (phase - INTRO_PAPER_HOLD) / (INTRO_PAPER_STEP - INTRO_PAPER_HOLD));
  const blend = u * u * (3 - 2 * u);
  const a = DISPLAY_COLORS[index], b = DISPLAY_COLORS[(index + 1) % DISPLAY_COLORS.length];
  out.r = a[0] + (b[0] - a[0]) * blend;
  out.g = a[1] + (b[1] - a[1]) * blend;
  out.b = a[2] + (b[2] - a[2]) * blend;
  return out;
}

// One dominant hue across the whole sheet, with a modest central light pool.
// The previous simultaneous edge washes read as a static two-color gradient.
export const INTRO_PAPER_SHADER = `
  float openingLight = 1.0 - smoothstep(0.05, 0.65, distance(paperUv, vec2(0.5, 0.55)));
  paper = mix(uOpeningTint, vec3(1.0), 0.20 + 0.20 * openingLight);
`;
