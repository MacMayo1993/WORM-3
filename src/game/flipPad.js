import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { getManifoldGridId } from './gridIds.js';

// A perceptual tuning parameter, not a derived topological constant.
export const K_STAR = 0.721;
export const clampWear = value => Math.max(0, Math.min(1, value));

export function flipPadPair(meta, size) {
  if (!meta?.origPos || !meta.origDir) return null;
  const id = getManifoldGridId(meta, size);
  const twin = `M${ANTIPODAL_COLOR[meta.orig]}-${id.split('-')[1]}`;
  return [id, twin].sort().join('|');
}

export function padWear(flips, cap, rides = null, safeRides = 3) {
  return clampWear(rides == null ? flips / Math.max(1, cap) : rides / (safeRides + 1));
}

export function classifyPad({ flips = 0, cap = 6, twinFlips = flips, rides = null, voided = false, locked = false }) {
  const wear = padWear(flips, cap, rides);
  if (voided) return { state: 'pit', wear, lifted: false, worn: true };
  if (flips >= cap) return { state: 'dead', wear, lifted: false, worn: true };
  const worn = wear >= K_STAR || cap - flips <= 1;
  if (flips % 2 === 0) return { state: 'home', wear, lifted: false, worn };
  return { state: locked ? 'locked' : twinFlips % 2 === 0 ? 'lone' : worn ? 'worn' : 'pad', wear, lifted: true, worn };
}

// P+ and P- on a two-element orbit. Apply P+ BEFORE nonlinear pose functions.
export function projectPair(a, b) {
  return { symmetric: (a + b) / 2, antisymmetric: (a - b) / 2 };
}

export function asymmetricEnergy(pairs) {
  let total = 0, asymmetric = 0;
  for (const [a, b] of pairs) {
    total += a * a + b * b;
    asymmetric += (a - b) ** 2 / 2;
  }
  return total === 0 ? 0 : asymmetric / total;
}
