// A bounded head-to-tail pulse, independent of frame rate and body length.
export const PICKUP_PULSE_DURATION = 0.85;
export function pickupPulse(age, index, count) {
    const delay = 0.6 * index / Math.max(1, count - 1);
    const t = (age - delay) / 0.25;
    return t > 0 && t < 1 ? Math.sin(Math.PI * t) ** 2 : 0;
}
