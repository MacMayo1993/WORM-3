const bell = (x, center, width) => Math.exp(-(((x - center) / width) ** 2));
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function menuWormPace(beats, distance, reducedMotion = false) {
  if (reducedMotion) return 1;
  let pace = 1;
  for (const beat of beats) {
    const d = distance - beat.distance;
    pace += beat.kind === 'enter'
      ? -0.65 * bell(d, -0.55, 0.3) + 0.35 * bell(d, 0.08, 0.2)
      : -0.48 * bell(d, -0.05, 0.23) + 0.38 * bell(d, 0.48, 0.26);
  }
  return Math.max(0.3, pace);
}

// Local +Y is up and -Z is forward. Deformations follow each bead through the
// opening, giving a travelling squeeze/release rather than a rigid whole-worm
// pulse. At the mouth all positional wiggle vanishes, preserving its aim.
export function menuWormTransitPose(beats, distance, segment, time, out, reducedMotion = false, waiting = false) {
  out.stretch = out.width = 1;
  out.lift = out.sway = out.roll = out.pulse = 0;
  out.transit = false;
  if (reducedMotion) return out;
  let nearest = null, delta = Infinity;
  for (const beat of beats) {
    const d = distance - beat.distance;
    if (Math.abs(d) < Math.abs(delta)) { nearest = beat; delta = d; }
  }
  if (!nearest) return out;
  const entering = nearest.kind === 'enter';
  const gather = entering ? bell(delta, -0.55, 0.3) : 0;
  const pop = entering ? 0 : bell(delta, 0.42, 0.3);
  const throat = bell(delta, 0, 0.23);
  const active = Math.max(gather, pop, throat, waiting ? 0.5 : 0);
  const ripple = Math.sin(time * 11 - segment * 0.75);
  out.stretch = 1 - gather * 0.19 + throat * 0.3 + pop * 0.16 + ripple * active * 0.055;
  out.width = 1 / Math.sqrt(out.stretch); // preserve body volume
  const outside = entering ? delta < 0 : delta > 0;
  const gate = outside ? smooth(0.12, 0.42, Math.abs(delta)) : 0;
  out.lift = gate * (0.018 + gather * 0.075 + pop * 0.07) * (0.7 + 0.3 * ripple);
  out.sway = gate * (0.012 + active * 0.025) * Math.sin(time * 8 - segment * 0.8);
  out.roll = gate * active * 0.12 * Math.sin(time * 9 - segment * 0.6);
  out.pulse = Math.min(1, pop + gather * 0.3);
  out.transit = Math.abs(delta) < 0.4;
  return out;
}
