export const STRIKE_CHARGE = 0.4;
export const STRIKE_HOLD = 0.15;
export const STRIKE_FADE = 0.7;
export const STRIKE_LIFE = STRIKE_CHARGE + STRIKE_HOLD + STRIKE_FADE;

export function strikeVisuals(age) {
  const charge = Math.max(0, Math.min(1, age / STRIKE_CHARGE));
  const struck = age >= STRIKE_CHARGE;
  const fade = Math.max(0, Math.min(1, (age - STRIKE_CHARGE - STRIKE_HOLD) / STRIKE_FADE));
  const afterglow = (1 - fade) ** 2;
  const contact = (age - STRIKE_CHARGE) / 0.28;
  return {
    leader: charge,
    core: struck ? afterglow : 0.12 * charge,
    glow: struck ? 0.3 * afterglow : 0.08 * charge,
    branches: struck ? 0.7 * afterglow : 0,
    impact: contact > 0 && contact < 1 ? Math.sin(contact * Math.PI) : 0,
  };
}
