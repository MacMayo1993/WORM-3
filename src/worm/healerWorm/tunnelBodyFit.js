import { TUNNEL_RIDE_WIDTH } from '../../utils/tunnelRide.js';

export const makeTunnelBodyProfile = () => ({ rideWidth: TUNNEL_RIDE_WIDTH, rideClearance: 0, rideWeight: 0 });

const PROFILE_KEYS = ['rideWidth', 'rideClearance', 'rideWeight'];

// Travel history owns the local gauge, so a trailing bead keeps its fit after
// the head leaves the tunnel, or starts another one. No nearest-path searches.
export function blendTunnelBodyProfile(out, a, b = a, t = 0) {
  for (const key of PROFILE_KEYS) {
    const fallback = key === 'rideWidth' ? TUNNEL_RIDE_WIDTH : 0;
    const from = a?.[key] ?? fallback, to = b?.[key] ?? fallback;
    out[key] = from + (to - from) * t;
  }
  return out;
}

// Reserve room for both the body and its stroke: radius <= 36% of the width,
// lateral swim <= 8%, leaving at least 6% of the width before either rail.
export function tunnelBodyScale(profile, radius) {
  // At a core dock the band is flush with the opening's centre. The seated
  // head is one radius above it, so its full upper extent must fit inside the
  // tile's circular cutout, including the face and swimming stroke.
  const t = Math.max(0, Math.min(1, (profile?.rideClearance ?? 0) / .06));
  const fraction = .19 + .17 * t * t * (3 - 2 * t);
  const fit = Math.min(1, (profile?.rideWidth ?? TUNNEL_RIDE_WIDTH) * fraction / Math.max(radius, 1e-6));
  return 1 + (fit - 1) * (profile?.rideWeight ?? 0);
}

// Shared by rendering and body-contact queries. A narrow stretch consumes more
// of the worm's bead count, while ordinary surface distances stay unchanged.
export function tunnelBodyDistance(length, a, b) {
  return length / ((tunnelBodyScale(a, 0.09) + tunnelBodyScale(b, 0.09)) * 0.5);
}

export function fitTunnelBodyInto(out, profile, radius, side = 0, lift = 0, height = radius) {
  const weight = profile.rideWeight;
  const width = profile.rideWidth;
  out.scale = tunnelBodyScale(profile, radius);
  out.side = side * (1 - weight) + Math.max(-width * 0.08, Math.min(width * 0.08, side)) * weight;
  out.lift = lift * (1 - weight) + Math.min(lift, width * 0.025) * weight;
  out.shift = (height * out.scale - profile.rideClearance) * weight;
  return out;
}
