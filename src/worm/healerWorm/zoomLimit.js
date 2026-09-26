// Follow the head even on Mega: body growth must not become a board overview.
// Retain the small-board bound, but cap growth at 1.5 world units on every board.
export function wormZoomLimit(size, baseBack) {
    const previousGrowthLimit = size * 2.6 * 0.8;
    return Math.max(0, Math.min(1.5, previousGrowthLimit * 0.8 - baseBack * 0.25));
}

export function boundedWormZoom(size, baseBack, orbCount, burst) {
    const limit = wormZoomLimit(size, baseBack);
    if (limit === 0) return 0;
    // Diminishing returns avoid an abrupt stop at the ceiling. The initial slope
    // is 0.08 units/orb (formerly 0.18), tending smoothly to zero with growth.
    const growth = -limit * Math.expm1(-Math.max(0, orbCount) * 0.08 / limit);
    return Math.min(limit, growth + Math.max(0, burst));
}

// Widen the standard surface view by 20% from its previous 0.9 framing.
// Perspective extent is distance * tan(FOV / 2), so 0.9 × 1.2 = 1.08.
// Adjusting the lens preserves the existing surface and tunnel clearance.
export function wormSurfaceFov(baseFov) {
    return 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) * 1.08) * 180 / Math.PI;
}
