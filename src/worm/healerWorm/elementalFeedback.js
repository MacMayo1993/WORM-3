export function elementalFeedback(type, buffs) {
    const momentum = buffs.rocketActive ? 0 : Math.max(0, Math.min(1, buffs.waterMomentum || 0));
    if (type === 'water') return { text: `Momentum +${Math.round(momentum * 25)}% · Turns slow you`, fraction: momentum };
    if (type === 'grass') return { text: buffs.springReady ? 'SPRING READY · Jump for a longer leap' : `${buffs.springCount || 0} springs · Land to grow one`, fraction: buffs.springReady ? 1 : 0 };
    if (type === 'fire') return { text: 'Shield tiles block blasts · Flames still hurt', fraction: 0 };
    if (type === 'ice') return { text: 'Slide to the next tile · Jump to steer sooner', fraction: 0 };
    return { text: 'Lightning charged', fraction: 0 };
}
export const patchOpacity = ttl => Math.min(1, Math.max(0, ttl / 0.6));
export const springStretch = (ttl, reducedMotion) => reducedMotion ? 1 : 0.88 + 0.12 * Math.sin((8 - ttl) * 5);
