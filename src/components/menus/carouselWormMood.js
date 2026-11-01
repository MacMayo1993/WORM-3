// Each mode face gives the carousel worm a mood, so turning the cube to a mode
// changes how your worm behaves on it. Pure: a mood is read each frame from
// the presented face and the worm's own clock.
//
//   WORM (NX)       its ordinary happy crawl
//   FLIP CUBE (NY)  every few seconds it barrel-rolls, the roll running down its body
//   TEACH (PX)      studious: slower, in a mortarboard if it wears no hat of its own
//   CHAOS (NZ)      jittery and quick, crackling with sparks
//   RANDOM (PZ)     dizzy, wandering eyes and a pace that speeds and slows
//   STORE (PY)      pleased with itself: a gold coin on its back, a gold trail
//                   and the odd glint

export const CAROUSEL_MOOD_FACES = ['NX', 'NY', 'PX', 'NZ', 'PZ', 'PY'];

const ROLL_PERIOD = 3.4;
const ROLL_TIME = 0.75;
const ZAP_PERIOD = 1.35;
const GLINT_PERIOD = 2.1;

const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };

const moods = new Map();
/** The mood for a face (the same object every call: read every frame). */
export function carouselWormMood(face) {
  let mood = moods.get(face);
  if (!mood) moods.set(face, mood = buildMood(face));
  return mood;
}

function buildMood(face) {
  return Object.freeze({
    speed: face === 'PX' ? 0.75 : face === 'NZ' ? 1.45 : 1,
    hat: face === 'PX' ? 'grad' : null,
    prop: face === 'PY' ? 'coin' : null,
    glow: face === 'PY' ? '#ffd34d' : face === 'NZ' ? '#ffb14a' : null,
    dizzy: face === 'PZ' ? 0.85 : 0,
    rolls: face === 'NY',
    jitters: face === 'NZ',
    glints: face === 'PY',
    wanders: face === 'PZ',
  });
}

/** Pace multiplier at clock `time` (RANDOM's drifts; the rest are steady). */
export function carouselMoodPace(mood, time) {
  return mood.wanders ? mood.speed * (0.7 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.3) * Math.sin(time * 0.47 + 1))) : mood.speed;
}

/** Barrel-roll angle for segment `i` (FLIP CUBE): the head rolls first. */
export function carouselMoodRoll(mood, i, time) {
  if (!mood.rolls) return 0;
  const phase = ((time % ROLL_PERIOD) + ROLL_PERIOD) % ROLL_PERIOD - i * 0.05;
  return phase > 0 && phase < ROLL_TIME ? smooth(phase / ROLL_TIME) * Math.PI * 2 : 0;
}

/** CHAOS: a nervous tremor, sideways, per segment. */
export function carouselMoodJitter(mood, i, time, radius) {
  if (!mood.jitters) return 0;
  return radius * 0.09 * Math.sin(time * 47 + i * 2.3) * Math.sin(time * 5.1 + i);
}

/**
 * True once per beat when the mood fires its accent (a CHAOS zap, a STORE
 * glint): `last` is the beat index already fired, returned updated.
 */
export function carouselMoodBeat(mood, time, last) {
  const period = mood.jitters ? ZAP_PERIOD : mood.glints ? GLINT_PERIOD : 0;
  if (!period) return { fire: false, beat: last };
  const beat = Math.floor(time / period);
  return { fire: beat !== last && last !== null, beat };
}
