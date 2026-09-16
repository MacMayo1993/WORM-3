// A bounded head-to-tail pulse, independent of frame rate and body length.
export const PICKUP_PULSE_DURATION = 0.85;
export function pickupPulse(age, index, count) {
    const delay = 0.6 * index / Math.max(1, count - 1);
    const t = (age - delay) / 0.25;
    return t > 0 && t < 1 ? Math.sin(Math.PI * t) ** 2 : 0;
}

// Keep recent colours alive through rapid pickups; memory and per-segment work
// stay bounded even during a magnet sweep.
export const MAX_PICKUP_PULSES = 8;
export function advancePickupPulses(pulses, delta) {
    for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i].age += delta;
        if (pulses[i].age >= PICKUP_PULSE_DURATION) pulses.splice(i, 1);
    }
}
export function enqueuePickupPulse(pulses, color, count, growthStart) {
    if (pulses.length === MAX_PICKUP_PULSES) pulses.shift();
    pulses.push({ age: 0, color, count, growthStart });
}

// A quick squeeze, then a smaller rebound; returns exactly to rest.
export function pickupGulpScale(age) {
    if (age < 0 || age >= 0.32) return 1;
    if (age < 0.12) return 1 - 0.17 * Math.sin(Math.PI * age / 0.12);
    return 1 + 0.13 * Math.sin(Math.PI * (age - 0.12) / 0.20);
}
export const ORB_GULP_DURATION = 0.24;
