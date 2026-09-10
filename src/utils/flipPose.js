// Shared membrane snap used by gameplay stickers and the opening cinematic.
export function flipPose(p, danger = 0) {
  const halfT = p < 0.5 ? p * 2 : (p - 0.5) * 2;
  const eased = halfT * halfT * (3 - 2 * halfT);
  const flipSquish = Math.max(0.001, p < 0.5 ? 1 - eased : eased);
  const c1 = 1.70158 * (1 + danger * 0.7);
  const tb = halfT - 1;
  const mainScale = p < 0.5 ? flipSquish : Math.max(0.001, 1 + (c1 + 1) * tb ** 3 + c1 * tb ** 2);
  const crossScale = 1 + (1 - Math.min(1, mainScale)) * 0.16 - Math.max(0, mainScale - 1) * 0.6;
  return { flipSquish, mainScale, crossScale };
}
