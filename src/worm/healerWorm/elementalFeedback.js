export function elementalFeedback(type, buffs, fusion = null) {
    const momentum = buffs.rocketActive ? 0 : Math.max(0, Math.min(1, buffs.waterMomentum || 0));
    // A fused pair's own rule leads the readout (elementalFusion.js).
    if (fusion === 'slipstream') return { text: `Slipstream +${Math.round(momentum * 40)}% · Turns keep momentum`, fraction: momentum };
    if (fusion === 'quench') return { text: 'Obsidian blocks blasts · Turns on it keep momentum', fraction: momentum };
    if (fusion === 'steam') return { text: 'Steam trail scalds enemies · Puts out bombs', fraction: 0 };
    if (fusion === 'wildfire') return { text: buffs.springReady ? 'SPRING READY · Landing bursts into flame' : `${buffs.springCount || 0} springs · Spring landings burn`, fraction: buffs.springReady ? 1 : 0 };
    if (fusion === 'thunderpad') return { text: buffs.springReady ? 'SPRING READY · A struck pad launches rocket-high' : 'Lightning charges your spring pads', fraction: buffs.springReady ? 1 : 0 };
    if (type === 'water') return { text: `Momentum +${Math.round(momentum * 25)}% · Turns slow you`, fraction: momentum };
    if (type === 'grass') return { text: buffs.springReady ? 'SPRING READY · Jump for a longer leap' : `${buffs.springCount || 0} springs · Land to grow one`, fraction: buffs.springReady ? 1 : 0 };
    if (type === 'fire') return { text: 'Shield tiles block blasts · Flames still hurt', fraction: 0 };
    if (type === 'ice') return { text: 'Slide to the next tile · Jump to steer sooner', fraction: 0 };
    return { text: 'Marked tiles strike · Get off them, or jump', fraction: 0 };
}
export const patchOpacity = ttl => Math.min(1, Math.max(0, ttl / 0.6));
export const springStretch = (ttl, reducedMotion) => reducedMotion ? 1 : 0.88 + 0.12 * Math.sin((8 - ttl) * 5);
