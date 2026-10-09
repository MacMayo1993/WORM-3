import { hasElement, activeFusion } from './elementalFusion.js';

const keyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
export const ELEMENTAL_PATCH_LIMIT = 32;

export function addElementalPatch(sim, tile, type) {
    const key = keyOf(tile);
    sim.elementalPatches.delete(key);
    const obsidian = type === 'fire' && activeFusion(sim) === 'quench';
    sim.elementalPatches.set(key, { ...tile, type, ...(obsidian ? { obsidian: true } : {}), ttl: type === 'fire' && !obsidian ? 3 : 8 });
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
    const target = hasElement(sim, 'water') && !sim.isJumping ? 1 : 0;
    sim.waterMomentum += (target - sim.waterMomentum) * (1 - Math.exp(-delta * 2));
}

/** Take the spring pad under the head, if there is one. Returns the pad (truthy) or null. */
export function consumeSpring(sim) {
    const key = keyOf(sim.pos);
    const pad = sim.elementalPatches.get(key);
    if (pad?.type !== 'grass') return null;
    sim.elementalPatches.delete(key);
    return pad;
}

/** A charged pad's leap: tiles of air and lift (a spring pad is 2.2 / 1.8). */
export const CHARGED_SPRING_SPAN = 3.2;
export const CHARGED_SPRING_HEIGHT = 3.0;

/** Seconds a Thunderpad strike keeps a charged spring pad standing. */
export const CHARGED_PAD_TTL = 8;

/**
 * Thunderpad: lightning struck a spring pad. The pad is charged (a leap from it goes
 * rocket-high) instead of the tile being flipped. Returns whether there was a pad.
 */
export function chargeSpringPad(patches, tileOrKey) {
    const pad = patches.get(typeof tileOrKey === 'string' ? tileOrKey : keyOf(tileOrKey));
    if (pad?.type !== 'grass') return false;
    pad.charged = true;
    pad.ttl = Math.max(pad.ttl, CHARGED_PAD_TTL);
    return true;
}

/** Water momentum's speed bonus at full momentum: Slipstream raises it. */
export const waterSpeedBonus = sim => (activeFusion(sim) === 'slipstream' ? 0.4 : 0.25);

/** Whether a turn costs the worm its water momentum. Slipstream keeps it. */
export const turnShedsMomentum = sim => activeFusion(sim) !== 'slipstream'
    && !(activeFusion(sim) === 'quench' && isObsidianTile(sim.elementalPatches, sim.pos));

/** Quench converts the hot trail already on the board as well as future steps. */
export function quenchTrail(sim) {
    for (const patch of sim.elementalPatches.values()) {
        if (patch.type === 'fire' && patch.ttl > 0) { patch.obsidian = true; patch.ttl = 8; }
    }
}

const _steam = new Set();
/**
 * Steam: every tile of the fire trail, as tile keys, while Steam is up; null otherwise.
 * A reused set: read it now. `also` (another set of keys, e.g. the Glow Worm's light)
 * is folded in, so combat reads one wall.
 */
export function steamTiles(sim, also = null) {
    if (activeFusion(sim) !== 'steam') return also;
    _steam.clear();
    for (const [key, patch] of sim.elementalPatches) if (patch.type === 'fire' && !patch.obsidian && patch.ttl > 0) _steam.add(key);
    if (also) for (const key of also) _steam.add(key);
    return _steam.size ? _steam : null;
}

export function iceHoldsTurn(sim, delta, stepSec) {
    return hasElement(sim, 'ice') && !sim.isJumping
        && !sim.rocketActive && sim.interpT > 0.05 && sim.interpT + delta / stepSec < 1;
}

export function isHotTile(patches, tile) {
    const patch = patches.get(typeof tile === 'string' ? tile : keyOf(tile));
    return patch?.type === 'fire' && !patch.obsidian && patch.ttl > 0;
}

export function isObsidianTile(patches, tile) {
    const patch = patches.get(typeof tile === 'string' ? tile : keyOf(tile));
    return patch?.type === 'fire' && !!patch.obsidian && patch.ttl > 0;
}
export const isFirebreakTile = (patches, tile) => isHotTile(patches, tile) || isObsidianTile(patches, tile);

export function rotateElementalPatches(sim, rotate) {
    const patches = [...sim.elementalPatches.values()];
    sim.elementalPatches.clear();
    for (const patch of patches) {
        const tile = rotate(patch);
        sim.elementalPatches.set(keyOf(tile), { ...patch, x: tile.x, y: tile.y, z: tile.z, dirKey: tile.dirKey });
    }
}
