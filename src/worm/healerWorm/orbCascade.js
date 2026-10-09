import { getAllSurfaceTiles } from './surfaceTiles.js';
import { makeGrowthOrb } from './orbSpawning.js';
import { bodyCoverageCount } from './bodyCoverage.js';
import { ttAt } from '../circularBuffers.js';

export const CASCADE_REWARDS = Object.freeze({ surround: 9, bomb: 12 });
export const CASCADE_CAP = 48;
export const CASCADE_WAVE = 4;
export const CASCADE_INTERVAL = 0.16;
export const CASCADE_FLIGHT = 0.65;
const keyOf = p => `${p.x},${p.y},${p.z},${p.dirKey}`;

// Called only when a surrounding heal commits or a bomb is disarmed, never on ring contact.
// Keep unplaced food as a balance: small/crowded boards don't forfeit rewards.
export function queueOrbCascade(sim, kind, origin) {
    if (!sim.alive || !origin || !CASCADE_REWARDS[kind]) return;
    sim.orbCascades.push({ kind, origin: { ...origin }, remaining: CASCADE_REWARDS[kind] });
}

export function tickOrbCascades(sim, delta, size, ctx) {
    if (!sim.alive || sim.phase !== 'crawling') return;
    for (const orb of sim.powerups) {
        if (orb.cascade) orb.cascade.age = Math.min(CASCADE_FLIGHT, orb.cascade.age + delta);
    }
    if (!sim.orbCascades.length) { sim.orbCascadeDelay = 0; return; }
    sim.orbCascadeDelay -= delta;
    if (sim.orbCascadeDelay > 0) return;
    // One bounded wave per tick, including after a stall or a multi-pair heal.
    sim.orbCascadeDelay = CASCADE_INTERVAL;
    const live = sim.powerups.reduce((n, p) => n + !!p.cascade, 0);
    if (live >= CASCADE_CAP) return;
    const occupied = new Set([...sim.powerups, ...sim.specials, sim.pos,
        ...(sim.orbCascadeBombTiles ?? [])].map(keyOf));
    if (sim.prevTile) occupied.add(keyOf(sim.prevTile));
    const covered = bodyCoverageCount(sim.tailLength, sim.tileTrail.count, size, sim.expansionAmount);
    for (let i = 0; i < covered; i++) occupied.add(ttAt(sim.tileTrail, i));
    const cubies = ctx.getCubies();
    const reward = sim.orbCascades[0];
    const origin = reward.origin;
    const distance = tile => (tile.dirKey === origin.dirKey ? 0 : size * size * 4) +
        (tile.x - origin.x) ** 2 + (tile.y - origin.y) ** 2 + (tile.z - origin.z) ** 2;
    const free = getAllSurfaceTiles(size).filter(tile => {
        const st = cubies?.[tile.x]?.[tile.y]?.[tile.z]?.stickers?.[tile.dirKey];
        return st && st.curr === st.orig && !occupied.has(keyOf(tile));
    }).sort((a, b) => distance(a) - distance(b));
    const count = Math.min(CASCADE_WAVE, CASCADE_CAP - live, reward.remaining, free.length);
    for (let i = 0; i < count; i++) {
        const tile = free[i];
        // Overflow on another face erupts locally instead of flying through the cube.
        sim.powerups.push(makeGrowthOrb(tile, { cascade: {
            kind: reward.kind, origin: { ...(tile.dirKey === origin.dirKey ? origin : tile) }, age: 0,
        } }));
    }
    reward.remaining -= count;
    if (!reward.remaining) sim.orbCascades.shift();
    if (count) ctx.onPowerupsChanged(sim.powerups.slice());
}
