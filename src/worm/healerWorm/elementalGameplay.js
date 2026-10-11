import { hasElement, activeFusion } from './elementalFusion.js';
import { springSlamTiles } from './jumpLanding.js';

const keyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
export const ELEMENTAL_PATCH_LIMIT = 32;

/** Bursts kept for the mode to read. Several can land in one tick; it drains them each frame. */
export const FUSION_BURST_LIMIT = 16;

/**
 * Post a fusion's one-shot beat ({ kind, tile, ... }) for the mode to resolve once,
 * stamped with the next `seq`. Bursts queue rather than replace each other, so a pad
 * withering and a fusion igniting in the same tick are both resolved. Returns the burst.
 */
export function postFusionBurst(sim, burst) {
    const posted = { seq: ++sim.fusionSeq, ...burst };
    sim.fusionBursts.push(posted);
    if (sim.fusionBursts.length > FUSION_BURST_LIMIT) sim.fusionBursts.shift();
    return posted;
}

/**
 * The bursts in `bursts` posted after seq `seen`, oldest first, and the new last-seen
 * seq. A sim that restarted its count (a fresh run) is read from the start.
 */
export function unseenFusionBursts(bursts, seen) {
    if (!bursts?.length) return { fresh: [], seen };
    const from = bursts[bursts.length - 1].seq < seen ? 0 : seen;
    const fresh = bursts.filter(burst => burst.seq > from);
    return { fresh, seen: fresh.length ? fresh[fresh.length - 1].seq : from };
}

/** The numbers the fusions' own rules run on (elementalFusion.js names them). */
export const FUSION = Object.freeze({
    bloomEvery: 4,        // Bloom: a pad grows behind every Nth tile crawled
    bloomPadTtl: 12,
    coldfireTtl: 5,       // Coldfire: the blue trail's life
    plasmaTtl: 8,         // Plasma: a struck tile burns this long
    firestormTtl: 5,      // Firestorm: the cross of flame's life
    emberseedPadTtl: 4,   // Emberseed: pads wither (and burst) this fast
    frostTtl: 5,          // Frozen Wake / Frostbloom / Cryostorm frost
    frostbloomPadTtl: 12,
    frostFreeze: 2.2,     // seconds an enemy stepping on frost stays frozen (the ice shot's)
    meltdownDash: 0.3,    // Meltdown: speed bonus while the dash runs
    meltdownDashT: 0.6,
    staticBurst: 0.35,    // Static: speed bonus after a discharge
    staticBurstT: 1.5,
    geyserSpan: 1,        // Geyser: extra tiles and lift on a full-momentum launch
    geyserHeight: 0.8,
    geyserMomentum: 0.8,  // momentum that counts as "full" for Geyser and Current
    surge: 0.3,           // an ignition's speed surge (Slipstream)
});

/**
 * Lay a trail tile or a pad. `type` is 'fire' (trail, firebreak), 'grass' (spring pad)
 * or 'frost' (a frozen tile: bombs on it stop ticking, enemies stepping on it freeze).
 * The active fusion decides the flavour: Quench sets fire into obsidian, Coldfire
 * burns it blue, Bloom/Emberseed/Frostbloom change how long pads live. `extra`
 * overrides fields (a Plasma strike's longer ttl, Meltdown's melt flag).
 */
export function addElementalPatch(sim, tile, type, extra = null) {
    const key = keyOf(tile);
    const previous = sim.elementalPatches.get(key);
    sim.elementalPatches.delete(key);
    const fusion = activeFusion(sim);
    const obsidian = type === 'fire' && fusion === 'quench';
    const cold = type === 'fire' && fusion === 'coldfire';
    let ttl = type === 'fire' ? (obsidian ? 8 : cold ? FUSION.coldfireTtl : 3)
        : type === 'frost' ? FUSION.frostTtl : 8;
    if (type === 'grass') {
        if (fusion === 'bloom') ttl = FUSION.bloomPadTtl;
        else if (fusion === 'emberseed') ttl = FUSION.emberseedPadTtl;
        else if (fusion === 'frostbloom') ttl = FUSION.frostbloomPadTtl;
    }
    const patch = { ...tile, type, ttl };
    // Meltdown's melted tile stays melted when the trail is laid over it on the way out.
    if (type === 'fire' && previous?.type === 'fire' && previous.melt && previous.ttl > 0) patch.melt = true;
    if (obsidian) patch.obsidian = true;
    if (cold) patch.cold = true;
    if (type === 'grass' && fusion === 'emberseed') patch.ember = true;
    if (type === 'grass' && fusion === 'frostbloom') patch.iced = true;
    if (extra) Object.assign(patch, extra);
    sim.elementalPatches.set(key, patch);
    while (sim.elementalPatches.size > ELEMENTAL_PATCH_LIMIT) {
        sim.elementalPatches.delete(sim.elementalPatches.keys().next().value);
    }
}

const _withered = [];
export function tickElementalGameplay(sim, delta, size = 0) {
    if (sim.phase !== 'crawling') return;
    _withered.length = 0;
    for (const [key, patch] of sim.elementalPatches) {
        patch.ttl -= delta;
        if (patch.ttl <= 0) {
            sim.elementalPatches.delete(key);
            if (patch.type === 'grass' && patch.ember) _withered.push(patch);
        }
    }
    // Emberseed: a pad nobody launched from bursts as it withers. The 3x3 burns (a
    // firebreak, like the trail) and the mode defeats the enemies in it.
    if (_withered.length && size && activeFusion(sim) === 'emberseed') {
        for (const pad of _withered) {
            for (const key of springSlamTiles(pad, size)) {
                const [x, y, z, dirKey] = key.split(',');
                addElementalPatch(sim, { x: +x, y: +y, z: +z, dirKey }, 'fire');
            }
            postFusionBurst(sim, { kind: 'emberseed', tile: { x: pad.x, y: pad.y, z: pad.z, dirKey: pad.dirKey } });
        }
    }
    sim.meltdownT = Math.max(0, (sim.meltdownT ?? 0) - delta);
    sim.staticT = Math.max(0, (sim.staticT ?? 0) - delta);
    sim.surgeT = Math.max(0, (sim.surgeT ?? 0) - delta);
    // Geyser: the launch carries the water with it, so a spring leap keeps momentum.
    const carried = !sim.isJumping || (sim.springLaunch && activeFusion(sim) === 'geyser');
    const target = hasElement(sim, 'water') && carried ? 1 : 0;
    sim.waterMomentum += (target - sim.waterMomentum) * (1 - Math.exp(-delta * 2));
}

/** Short speed bursts a fusion grants: Meltdown's dash, Static's discharge, an ignition surge. */
export function fusionSpeedBonus(sim) {
    let bonus = 0;
    if (sim.meltdownT > 0) bonus += FUSION.meltdownDash;
    if (sim.staticT > 0) bonus += FUSION.staticBurst;
    if (sim.surgeT > 0) bonus += FUSION.surge;
    return bonus;
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
    for (const [key, patch] of sim.elementalPatches) if (patch.type === 'fire' && !patch.obsidian && !patch.cold && patch.ttl > 0) _steam.add(key);
    if (also) for (const key of also) _steam.add(key);
    return _steam.size ? _steam : null;
}

export function iceHoldsTurn(sim, delta, stepSec) {
    return hasElement(sim, 'ice') && !sim.isJumping
        && !sim.rocketActive && sim.interpT > 0.05 && sim.interpT + delta / stepSec < 1;
}

export function isHotTile(patches, tile) {
    const patch = patches.get(typeof tile === 'string' ? tile : keyOf(tile));
    return patch?.type === 'fire' && !patch.obsidian && !patch.cold && patch.ttl > 0;
}

/** Coldfire's blue trail: a firebreak that freezes rather than heats. */
export function isColdTile(patches, tile) {
    const patch = patches.get(typeof tile === 'string' ? tile : keyOf(tile));
    return patch?.type === 'fire' && !!patch.cold && patch.ttl > 0;
}

/** A frozen tile: a bomb on it does not tick. */
export function isFrostTile(patches, tile) {
    const patch = patches.get(typeof tile === 'string' ? tile : keyOf(tile));
    return patch?.type === 'frost' && patch.ttl > 0;
}

/** Meltdown: the tile a slide ended on, which puts out a bomb sitting there. */
export function isMeltTile(patches, tile) {
    const patch = patches.get(typeof tile === 'string' ? tile : keyOf(tile));
    return patch?.type === 'fire' && !!patch.melt && patch.ttl > 0;
}

const _frost = new Set();
/**
 * Every tile that freezes an enemy stepping onto it (frost, and Coldfire's blue trail),
 * as tile keys, or null when there are none. A reused set: read it now.
 */
export function frostTiles(sim) {
    _frost.clear();
    for (const [key, patch] of sim.elementalPatches) {
        if (patch.ttl > 0 && (patch.type === 'frost' || (patch.type === 'fire' && patch.cold))) _frost.add(key);
    }
    return _frost.size ? _frost : null;
}

export function isObsidianTile(patches, tile) {
    const patch = patches.get(typeof tile === 'string' ? tile : keyOf(tile));
    return patch?.type === 'fire' && !!patch.obsidian && patch.ttl > 0;
}
export const isFirebreakTile = (patches, tile) => isHotTile(patches, tile) || isObsidianTile(patches, tile) || isColdTile(patches, tile);

export function rotateElementalPatches(sim, rotate) {
    const patches = [...sim.elementalPatches.values()];
    sim.elementalPatches.clear();
    for (const patch of patches) {
        const tile = rotate(patch);
        sim.elementalPatches.set(keyOf(tile), { ...patch, x: tile.x, y: tile.y, z: tile.z, dirKey: tile.dirKey });
    }
}
