// src/worm/healerWorm/elementalLifecycle.js
//
// The one envelope every elemental visual runs on.
//
// Before this module the cube skin, the particle field and the fill light each
// re-derived their own fade from `wormBuffs.elementalT`, with the ramp constants
// copy-pasted into all three files. They agreed only by accident: the skin used a
// smoothstepped scale, the light a raw linear ramp, the particles a bare opacity
// multiply, so a claim lit the cube before the skin had welled up and an expiry
// dropped the light while the surface was still at full alpha.
//
// Everything now asks this module instead. It is deliberately pure — no React, no
// Three, no store — so the phase rules are testable headlessly and a renderer can
// call it once per frame and hand the result to its children.
//
// ── The shape of a wash ──────────────────────────────────────────────────────
//   claim   the orb is taken: the sim freezes for the focus beat and the element
//           sweeps outward from the claimed tile across the six faces
//   hold    calm ambient motion, rare accents
//   release the last FADE_OUT seconds: accents stop spawning FIRST, then the
//           cube-scale geometry, sticker detail, light and particles dissolve
//           together
//
// `remaining` is the sim's own countdown (wormBuffs.elementalT), which freezes on
// pause and during tunnel transit, so the envelope freezes with gameplay. `elapsed`
// is a renderer-side accumulator reset on each new element.

/** Seconds for a claimed element to well up out of the faces. */
export const ELEMENTAL_FADE_IN = 0.55;
/** Seconds of dissolve at the end of a wash — matched across skin, light, particles. */
export const ELEMENTAL_FADE_OUT = 1.25;

/** Smoothstep. Kept here so every consumer eases identically. */
export const smoothstep01 = (t) => {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * (3 - 2 * x);
};

const clamp01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v);

/**
 * Derive the shared visual envelope for the active elemental wash.
 *
 * @param {object}  o
 * @param {number}  o.elapsed    seconds since this element was claimed (renderer clock)
 * @param {number}  o.remaining  seconds of wash left (wormBuffs.elementalT — sim clock)
 * @param {number} [o.focus]     seconds left of the claim camera beat (sim frozen while > 0)
 * @param {number} [o.fadeIn]
 * @param {number} [o.fadeOut]
 * @param {number} [o.sweep]     seconds the claim sweep takes to cross the cube
 * @returns {{
 *   phase: 'claim'|'hold'|'release',
 *   claim: number, hold: boolean, release: number,
 *   intensity: number, grow: number, sweep: number, accents: boolean
 * }}
 */
export function elementalEnvelope({
  elapsed = 0,
  remaining = 0,
  focus = 0,
  fadeIn = ELEMENTAL_FADE_IN,
  fadeOut = ELEMENTAL_FADE_OUT,
  sweep = 1.8
} = {}) {
  const rise = fadeIn > 0 ? clamp01(elapsed / fadeIn) : 1;
  const fall = fadeOut > 0 ? clamp01(remaining / fadeOut) : 1;
  // The wash is only ever as strong as its weaker end, so a wash claimed with less
  // than FADE_OUT left on the clock never blooms to full and then snaps off.
  const intensity = Math.min(rise, fall);

  // Claim owns the beat while the camera is pulled out OR the layer is still
  // welling up; release owns the tail. A wash shorter than fadeIn + fadeOut is
  // still ordered claim → release, never release → claim.
  const phase = focus > 0 || rise < 1 ? 'claim' : fall < 1 ? 'release' : 'hold';

  return {
    phase,
    // 0 → 1 as the element travels outward from the claimed tile. Renderers offset
    // each cell's own start by its distance from the claim so the cube charges up
    // face by face instead of appearing uniformly.
    claim: sweep > 0 ? clamp01(elapsed / sweep) : 1,
    hold: phase === 'hold',
    // 0 while alive, → 1 as it dissolves. The inverse of `fall`, so a renderer can
    // drive a retreat (frost pulling back, blades wilting) off one rising number.
    release: 1 - fall,
    intensity,
    // Coverage + thickness ramp. Floored so a zero-scale matrix never yields NaN
    // normals, and smoothstepped so the layer wells up rather than lerping in.
    grow: Math.max(0.01, smoothstep01(intensity)),
    sweep,
    // Accents (droplets, ember vortices, pollen, strikes) stop spawning as soon as
    // the tail starts, so nothing is born that would be cut off mid-life.
    accents: phase !== 'release' && focus <= 0
  };
}
