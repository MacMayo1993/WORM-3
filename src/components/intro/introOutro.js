import { clamp01, ramp } from './introChoreography.js';
import { DISSOLVE_START, DISSOLVE_END, INTRO_FINISH } from './introTiming.js';

// The ending, as a function of the intro clock. The title card lingers; then the
// cube, the wordmark, the first clause and the screen chrome all dissolve, and
// only "flip through the cube" is left. It drifts to the middle of the empty
// paper, dissolves THROUGH THE, joins the stickers and flips them together
// before handing over to the menu.

export const GLIDE_START = 9.4;
export const GLIDE_END = DISSOLVE_END;
/** FLIP turns, then CUBE: the same two-sticker wave as the trailer line. */
export const OUTRO_TURNS = [10.5, 10.7];
export const OUTRO_TURN_TIME = 0.45;
export const THROUGH_FADE = [11.05, 11.65];
export const JOIN_WORDS = [11.55, 12.15];
export const FINAL_TURN = 12.25;
export const OUTRO_EXIT = 0.32;

const LEAD_WORD_START = DISSOLVE_START + 0.2;
const LEAD_WORD_STAGGER = 0.1;
const LEAD_WORD_FADE = 0.7;

/**
 * 0→1 progress of each part of the ending. Fades are kept for reduced motion;
 * the glide and the sticker turns are motion, so they stay at rest there.
 *   cube   — the 3D cube's dissolve front (and its shadow);
 *   chrome — brand badge, Skip, Play, progress bar and the page vignette;
 *   title  — the WORM³ wordmark;
 *   glide  — the surviving phrase moving to the centre;
 *   turns  — FLIP's and CUBE's stickers turning to their antipodes;
 *   exit   — the phrase itself, pushing through into the menu.
 */
export function introOutro(t, reducedMotion = false) {
  return {
    // Linear, not eased: the grain already softens both ends, and an eased front
    // crowds the whole dissolve into the middle of its window.
    cube: clamp01((t - DISSOLVE_START) / (DISSOLVE_END - DISSOLVE_START)),
    chrome: ramp(t, DISSOLVE_START, DISSOLVE_START + 0.6),
    title: ramp(t, DISSOLVE_START, DISSOLVE_START + 1.0),
    glide: reducedMotion ? 0 : ramp(t, GLIDE_START, GLIDE_END),
    through: ramp(t, ...THROUGH_FADE),
    join: reducedMotion ? +(t >= JOIN_WORDS[1]) : ramp(t, ...JOIN_WORDS),
    turns: OUTRO_TURNS.map(at => reducedMotion ? 0 : ramp(t, at, at + OUTRO_TURN_TIME)
      + ramp(t, FINAL_TURN, FINAL_TURN + OUTRO_TURN_TIME)),
    exit: ramp(t, INTRO_FINISH - OUTRO_EXIT, INTRO_FINISH)
  };
}

/** Word `index` of the tagline's first clause dissolving, left to right. */
export const outroWordFade = (t, index) =>
  ramp(t, LEAD_WORD_START + index * LEAD_WORD_STAGGER, LEAD_WORD_START + index * LEAD_WORD_STAGGER + LEAD_WORD_FADE);
