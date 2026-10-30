// Shared dimensions, movement and identity for the pickup and Earth's pads.
export const TRAMPOLINE = Object.freeze({
    radius: 0.39, deck: 0.18, span: 2.2, height: 1.8,
    rim: '#f4c65a', mat: '#123e38', light: '#baffda', metal: '#c4ddd5',
    iconPath: 'M2 12a10 4 0 1 1 20 0 10 4 0 1 1-20 0m3 0a7 2 0 1 0 14 0 7 2 0 1 0-14 0M4 15h3v6H4zm13 0h3v6h-3zM8 16h2v3H8zm6 0h2v3h-2z',
    iconAccent: 'M12 1l-5 5h3v4h4V6h3z',
});

export const springPadAt = (sim, tile = sim.pos) => {
    const key = `${tile.x},${tile.y},${tile.z},${tile.dirKey}`;
    const pad = sim.bouncePads?.get(key) ?? sim.elementalPatches.get(key);
    return pad?.type === 'grass' ? pad : null;
};

// The head records one continuous arc; every trailing bead follows that same
// spatial route. Flex the mat throughout that feed, driven by traveled distance
// rather than wall time so pause, speed changes and reduced motion are stable.
export function trampolineCompression(pad, distance, tailReach, reduced = false) {
    if (pad.bounceDistance == null) return 0;
    const travel = Math.max(0, distance - pad.bounceDistance);
    const end = Math.max(0.2, tailReach);
    if (travel > end + 0.3) return 0;
    const envelope = Math.min(1, Math.max(0, (end + 0.3 - travel) / 0.3));
    return envelope * (reduced ? 0.16 : 0.22 + 0.46 * (0.5 + 0.5 * Math.cos(travel * Math.PI * 2 / 0.54)));
}

// Small, smooth approach onto the mat. Included in the sim's recorded path and
// collision query, not applied as a render-only lift to the visible worm.
export function trampolineSupport(sim, position) {
    if (sim.onRaisedPlatform || sim.raisedDeparture || sim.crossingCorner) return 0;
    let lift = 0;
    for (let i = 0; i < 2; i++) {
        const tile = i === 0 ? sim.pos : sim.prevTile;
        const center = i === 0 ? sim.curWorldPos : sim.prevWorldPos;
        if (!tile || !center || !springPadAt(sim, tile)) continue;
        const normalAxis = tile.dirKey[1].toLowerCase();
        const dx = normalAxis === 'x' ? 0 : position.x - center.x;
        const dy = normalAxis === 'y' ? 0 : position.y - center.y;
        const dz = normalAxis === 'z' ? 0 : position.z - center.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        const t = Math.max(0, Math.min(1, 1 - Math.sqrt(distanceSq) / 0.5));
        lift = Math.max(lift, (TRAMPOLINE.deck + 0.035) * t * t * (3 - 2 * t));
    }
    return lift;
}
