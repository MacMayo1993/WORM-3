// Ordered Air reactions. Called only at committed launches, steps and landings;
// pauses, moving slices and tunnel transit cannot manufacture extra reactions.
import { activeFusion } from './elementalFusion.js';
import { addElementalPatch, isHotTile, postFusionBurst } from './elementalGameplay.js';
import { springSlamTiles } from './jumpLanding.js';
import { computeBlastTiles } from './bombs.js';
import { collectManifoldRing } from '../wormLogic.js';

const tileOf = key => {
    const [x, y, z, dirKey] = key.split(',');
    return { x: +x, y: +y, z: +z, dirKey };
};
const burst = (sim, tiles, extra = {}) => postFusionBurst(sim, {
    kind: 'air-reaction', recipe: activeFusion(sim), tile: { ...sim.pos },
    tiles: [...tiles], hit: 'stun', ...extra,
});

export function airFusionLaunch(sim, grounded, size = 0) {
    const fusion = activeFusion(sim);
    if (fusion === 'fire-air' && grounded && isHotTile(sim.elementalPatches, sim.pos)) {
        // Additional lift from the hot tile, after Air's ordinary 1.35 / 1.4 boost.
        sim.jumpSpan += 1;
        sim.jumpHeight += 1.2;
    }
    if (!grounded || !size) return;
    if (fusion === 'grass-air' && sim.springLaunch) {
        burst(sim, collectManifoldRing(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, size, 2));
    }
    if (fusion === 'air-ice') {
        const tiles = computeBlastTiles({ tile: sim.pos }, size, 2).keys;
        for (const key of tiles) addElementalPatch(sim, tileOf(key), 'frost', { ttl: 3 });
        burst(sim, tiles, { hit: 'freeze' });
    }
}

export function airFusionStep(sim) {
    if (!sim.isJumping || sim.rocketActive) return;
    const fusion = activeFusion(sim);
    if (fusion === 'air-fire') addElementalPatch(sim, sim.pos, 'fire', { ttl: 6 });
    if (fusion === 'ice-air') addElementalPatch(sim, sim.pos, 'frost', { ttl: 7 });
}

export function airFusionLanding(sim, size) {
    if (sim.rocketActive || !size) return;
    const fusion = activeFusion(sim);
    if (fusion === 'air-water') {
        sim.waterMomentum = 1;
        burst(sim, springSlamTiles(sim.pos, size), { defuse: true });
    }
    if (fusion === 'air-grass') {
        addElementalPatch(sim, sim.pos, 'grass', { charged: true, ttl: 12 });
        burst(sim, [ `${sim.pos.x},${sim.pos.y},${sim.pos.z},${sim.pos.dirKey}` ]);
    }
    if (fusion === 'air-lightning') {
        burst(sim, computeBlastTiles({ tile: sim.pos }, size, 2).keys, { hit: 'kill', lightning: true });
    }
}
