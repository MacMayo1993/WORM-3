const keyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
export const ELEMENTAL_PATCH_LIMIT = 32;

export function addElementalPatch(sim, tile, type) {
    const key = keyOf(tile);
    sim.elementalPatches.delete(key);
    sim.elementalPatches.set(key, { ...tile, type, ttl: type === 'fire' ? 3 : 8 });
    while (sim.elementalPatches.size > ELEMENTAL_PATCH_LIMIT) {
        sim.elementalPatches.delete(sim.elementalPatches.keys().next().value);
    }
}

export function tickElementalGameplay(sim, delta) {
    if (sim.phase !== 'crawling') return;
    for (const [key, patch] of sim.elementalPatches) {
        patch.ttl -= delta;
        if (patch.ttl <= 0) sim.elementalPatches.delete(key);
    }
    const target = sim.elementalType === 'water' && sim.elementalT > 0 && !sim.isJumping ? 1 : 0;
    sim.waterMomentum += (target - sim.waterMomentum) * (1 - Math.exp(-delta * 2));
}

export function consumeSpring(sim) {
    const key = keyOf(sim.pos);
    if (sim.elementalPatches.get(key)?.type !== 'grass') return false;
    sim.elementalPatches.delete(key);
    return true;
}

export function iceHoldsTurn(sim, delta, stepSec) {
    return sim.elementalType === 'ice' && sim.elementalT > 0 && !sim.isJumping
        && !sim.rocketActive && sim.interpT > 0.05 && sim.interpT + delta / stepSec < 1;
}

export function isHotTile(patches, tile) {
    const patch = patches.get(typeof tile === 'string' ? tile : keyOf(tile));
    return patch?.type === 'fire' && patch.ttl > 0;
}

export function rotateElementalPatches(sim, rotate) {
    const patches = [...sim.elementalPatches.values()];
    sim.elementalPatches.clear();
    for (const patch of patches) {
        const tile = rotate(patch);
        sim.elementalPatches.set(keyOf(tile), { ...patch, x: tile.x, y: tile.y, z: tile.z, dirKey: tile.dirKey });
    }
}
