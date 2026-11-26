// src/components/intro/introBeats.js
// The opening's sound: one cue per big beat, fired as the intro clock crosses it
// (feel() in utils/feel.js, so the player's sound and buzz settings apply). Audio
// can't start before the page's first tap, so on a first launch the early beats
// are silent until the player touches the cube or Skip. Every launch plays the
// whole opening, tagline included; returning players can tap PLAY at any time.
import { LAND_TIME } from './introMotion.js';
import { FULL_FLIP_START, EXPLOSION_START, IMPLODE_END, TITLE_END } from './introTiming.js';
import { DIVE_SINK, DIVE_CLOSE } from './introOutro.js';

export const INTRO_BEATS = [
  { at: LAND_TIME, event: 'cubeTurn' },
  { at: FULL_FLIP_START, event: 'cubeFlip' },
  { at: EXPLOSION_START, event: 'tunnelBirth' },
  { at: IMPLODE_END - 0.05, event: 'cubeTurn' },
  { at: TITLE_END, event: 'storyStar' },
  { at: DIVE_SINK[0], event: 'dive', motion: true },
  { at: DIVE_CLOSE[0], event: 'exit', motion: true }
];

/**
 * The beats passed when the clock moves from `from` to `to` (from exclusive,
 * to inclusive), in order. Nothing plays for a jump backwards or a replayed
 * frame; the dive's beats are motion, so reduced motion (which dissolves the
 * cube instead) leaves them out.
 */
export function beatsCrossed(from, to, reducedMotion = false) {
  if (!(to > from)) return [];
  return INTRO_BEATS.filter(beat => beat.at > from && beat.at <= to && !(reducedMotion && beat.motion)).map(beat => beat.event);
}

