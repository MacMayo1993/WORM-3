// Keep the starting camera distance while bringing the fully grown worm's
// maximum backward distance 20% closer. Solve base + 0.8 * extra = 0.8 * oldMax.
export function wormZoomLimit(size, baseBack) {
    const previousGrowthLimit = size * 2.6 * 0.8;
    return Math.max(0, previousGrowthLimit * 0.8 - baseBack * 0.25);
}

export function boundedWormZoom(size, baseBack, orbCount, burst) {
    return Math.min(wormZoomLimit(size, baseBack),
        Math.max(0, orbCount) * 0.18 + Math.max(0, burst));
}
