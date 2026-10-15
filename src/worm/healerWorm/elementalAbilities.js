// Enemy-independent elemental abilities. All clocks and budgets belong to the
// simulation; rendering reads this state without driving gameplay or store churn.
import { hasElement, activeFusion } from './elementalFusion.js';
import { addElementalPatch, postFusionBurst } from './elementalGameplay.js';
import { collectManifoldRing, getNextSurfacePosition, turnWorm } from '../wormLogic.js';
import { makeGrowthOrb } from './orbSpawning.js';
import { CASCADE_FLIGHT } from './orbCascade.js';
import { ORB_SEGMENT_GROWTH } from './constants.js';

export const ELEMENT_ABILITIES = Object.freeze({
    heatTiles: 6, fireDash: 0.75, fireBonus: 6, gardenBudget: 6,
    gardenRipen: 1.5, lightningCooldown: 4, chainCount: 3,
    driftDuration: 0.55, icePhase: 1.2, pickupDuration: 1.1,
    // Core-loop powers: each element helps heal the cube with no enemies or bombs
    // on it (see elementalDefs.js for the player-facing copy).
    riptideReach: 3,     // Water: dropped orbs this many steps away wash back
    smeltBudget: 3,      // Fire: heal segments the forge pays per Fire pickup
    smeltPerRide: 1,     // ...per tunnel ride, or smeltDash during a flame dash
    smeltDash: 2,
    coldSnapRate: 0.5,   // Ice: the slice-turn clock's pace while Ice is up
    overchargeReach: 3,  // Lightning: a discharge charges a mouth this close
    galeFlight: 0.5,     // Air: seconds of flight that make a landing a gale
    galeReach: 2,        // ...which sweeps orbs this many steps away
});
const keyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
const tileOf = key => { const [x, y, z, dirKey] = key.split(','); return { x: +x, y: +y, z: +z, dirKey }; };
export function makeElementalAbilities() {
    return { heat: new Set(), fireReady: false, fireDashT: 0, fireBonus: 0,
        gardenBudget: 0, lightningT: 0, chainPending: false, scanT: 0,
        iceShield: false, icePhaseT: 0, driftT: 0, jumpHeld: false,
        flying: false, visualTime: 0, events: [], seq: 0,
        smeltBudget: 0, flightT: 0, regrown: 0, overcharged: 0 };
}
export function abilityEvent(sim, kind, tiles = [sim.pos], element = null) {
    const a = sim.elementalAbilities;
    const duration = kind === 'pickup' ? ELEMENT_ABILITIES.pickupDuration : 0.65;
    a.events.push({ id: ++a.seq, kind, element, duration, tiles: tiles.map(t => ({ x: t.x, y: t.y, z: t.z, dirKey: t.dirKey })), ttl: duration });
    if (a.events.length > 12) a.events.shift();
}
export const ripeOrb = orb => (!orb.garden || orb.garden.remaining <= 0)
    && (!orb.cascade || orb.cascade.age >= CASCADE_FLIGHT);

export function growGarden(sim, size, ctx, count = 2, origin = sim.pos) {
    const a = sim.elementalAbilities;
    if (!size || !a.gardenBudget || !hasElement(sim, 'grass')) return 0;
    const blocked = new Set([...sim.powerups, ...sim.specials, sim.pos,
        ...(sim.orbCascadeBombTiles ?? [])].map(keyOf));
    const cubies = ctx.getCubies?.();
    const fusion = activeFusion(sim);
    let planted = 0;
    for (const key of collectManifoldRing(origin.x, origin.y, origin.z, origin.dirKey, size, 1)) {
        if (blocked.has(key)) continue;
        const tile = tileOf(key), sticker = cubies?.[tile.x]?.[tile.y]?.[tile.z]?.stickers?.[tile.dirKey];
        if (!sticker || sticker.curr !== sticker.orig) continue;
        sim.powerups.push(makeGrowthOrb(tile, { garden: { remaining: ELEMENT_ABILITIES.gardenRipen, ember: fusion === 'emberseed' } }));
        blocked.add(key); a.gardenBudget--; planted++;
        if (planted >= count || !a.gardenBudget) break;
    }
    if (planted) { abilityEvent(sim, 'garden', [origin]); ctx.onPowerupsChanged?.(sim.powerups.slice()); }
    return planted;
}
export function igniteNearbyOrbs(sim, size) {
    if (!size || !hasElement(sim, 'fire') || !sim.elementalAbilities.fireBonus) return;
    const near = collectManifoldRing(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, size, 1);
    // At most six burning pickups exist at once, matching the bonus budget.
    let room = sim.elementalAbilities.fireBonus - sim.powerups.filter(o => o.ignited).length;
    for (const orb of sim.powerups) if (room > 0 && !orb.ignited && ripeOrb(orb) && near.has(keyOf(orb))) {
        orb.ignited = true; room--;
    }
}
export function claimElementalAbility(sim, type, size, ctx) {
    const a = sim.elementalAbilities;
    abilityEvent(sim, 'pickup', [sim.pos], type);
    if (type === 'fire') { a.fireReady = true; a.heat.clear(); a.fireBonus = ELEMENT_ABILITIES.fireBonus; a.smeltBudget = ELEMENT_ABILITIES.smeltBudget; }
    if (type === 'water') sim.waterMomentum = 1;
    if (type === 'grass') {
        // A new Earth pickup refreshes the budget, but already-growing buds count
        // against it. Fusion refreshes from other elements never refill it.
        a.gardenBudget = Math.max(0, ELEMENT_ABILITIES.gardenBudget - sim.powerups.filter(o => o.garden).length);
        if (size) { addElementalPatch(sim, sim.pos, 'grass'); growGarden(sim, size, ctx); }
    }
    if (type === 'ice') a.iceShield = true;
    if (type === 'lightning') { a.lightningT = 0; a.scanT = 0; }
    if (activeFusion(sim) === 'emberseed') for (const orb of sim.powerups) if (orb.garden) orb.garden.ember = true;
    igniteNearbyOrbs(sim, size);
}
export function startFlameDash(sim, size) {
    const a = sim.elementalAbilities;
    if (!hasElement(sim, 'fire') || !a.fireReady || a.fireDashT > 0 || sim.rocketActive || sim.isJumping) return false;
    a.fireReady = false; a.heat.clear(); a.fireDashT = ELEMENT_ABILITIES.fireDash;
    igniteNearbyOrbs(sim, size); abilityEvent(sim, 'fire');
    return true;
}
export function elementalStep(sim, size, ctx) {
    const a = sim.elementalAbilities;
    if (hasElement(sim, 'fire')) {
        if (!a.fireReady) { a.heat.add(keyOf(sim.pos)); if (a.heat.size >= ELEMENT_ABILITIES.heatTiles) a.fireReady = true; }
        igniteNearbyOrbs(sim, size);
        if (a.fireDashT > 0) {
            const fusion = activeFusion(sim);
            if (fusion === 'wildfire') growGarden(sim, size, ctx, 1);
            if (fusion === 'quench') addElementalPatch(sim, sim.pos, 'fire', { obsidian: true, ttl: 8 });
        }
    }
}
export function elementalLanding(sim, size, ctx) {
    if (hasElement(sim, 'grass')) growGarden(sim, size, ctx, activeFusion(sim) === 'air-grass' ? 3 : 2);
}
export function elementalDrift(sim) {
    if (!hasElement(sim, 'ice') || sim.isJumping) return;
    sim.elementalAbilities.driftT = ELEMENT_ABILITIES.driftDuration;
    abilityEvent(sim, 'ice');
    if (activeFusion(sim) === 'static') { sim.elementalAbilities.chainPending = true; sim.elementalAbilities.scanT = 0; }
}
export function spendIceShield(sim) {
    const a = sim.elementalAbilities;
    if (a.icePhaseT > 0) return true;
    if (!hasElement(sim, 'ice') || !a.iceShield) return false;
    a.iceShield = false; a.icePhaseT = ELEMENT_ABILITIES.icePhase;
    abilityEvent(sim, 'shatter');
    return true;
}
export function fireOrbBonus(sim, orb) {
    if (!hasElement(sim, 'fire') || !orb.ignited || sim.elementalAbilities.fireBonus <= 0) return 0;
    sim.elementalAbilities.fireBonus--;
    return ORB_SEGMENT_GROWTH;
}
// Water sweeps its two neighbouring lanes. Air widens airborne reach on the
// actual cube surface, including across seams, rather than a world-space ball.
export function elementalPickupReach(sim, size) {
    if (hasElement(sim, 'air') && sim.isJumping && !sim.rocketActive)
        return collectManifoldRing(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, size, 1);
    if (hasElement(sim, 'water') && sim.waterMomentum >= 0.8 && !sim.isJumping) {
        const reach = new Set([keyOf(sim.pos)]);
        for (const side of ['left', 'right']) {
            const tile = getNextSurfacePosition(sim.pos, turnWorm(sim.moveDir, side), size);
            if (tile) reach.add(keyOf(tile));
        }
        return reach;
    }
    return null;
}
export function chainTargets(sim, size) {
    const chosen = [], used = new Set();
    let origin = sim.pos;
    for (let i = 0; i < ELEMENT_ABILITIES.chainCount; i++) {
        const near = collectManifoldRing(origin.x, origin.y, origin.z, origin.dirKey, size, i ? 2 : 3);
        const target = sim.powerups.find(o => ripeOrb(o) && !used.has(o) && near.has(keyOf(o)));
        if (!target) break;
        chosen.push(target); used.add(target); origin = target;
    }
    return chosen;
}
// Visual-only clock also runs through the pickup camera beat, after the pause
// guard. It never advances flight, maturity, cooldowns or the buff lifetime.
export function tickAbilityVisuals(sim, delta) {
    const a = sim.elementalAbilities;
    a.visualTime += delta;
    for (let i = a.events.length - 1; i >= 0; i--) { a.events[i].ttl -= delta; if (a.events[i].ttl <= 0) a.events.splice(i, 1); }
}
export function tickElementalAbilities(sim, delta, size, ctx, collect) {
    if (sim.phase !== 'crawling') return;
    const a = sim.elementalAbilities;
    for (const key of ['fireDashT', 'driftT', 'icePhaseT', 'lightningT', 'scanT']) a[key] = Math.max(0, a[key] - delta);
    tickAbilityVisuals(sim, delta);
    if (!hasElement(sim, 'fire')) { a.fireReady = false; a.fireDashT = 0; a.smeltBudget = 0; for (const o of sim.powerups) o.ignited = false; }
    if (!hasElement(sim, 'ice')) { a.iceShield = false; a.driftT = 0; }
    if (!hasElement(sim, 'air')) a.flying = false;
    if (a.flying) a.flightT += delta;
    let changed = false;
    for (const orb of sim.powerups) if (orb.garden?.remaining > 0) {
        orb.garden.remaining = Math.max(0, orb.garden.remaining - delta);
        if (orb.garden.remaining === 0) {
            changed = true;
            // Emberseed ripens into a small shower of the already-budgeted buds:
            // no extra spawn or recursive rewards, and the familiar cascade FX.
            if (orb.garden.ember) {
                growGarden(sim, size, ctx, 2, orb);
                orb.cascade = { kind: 'garden', origin: { x: orb.x, y: orb.y, z: orb.z, dirKey: orb.dirKey }, age: 0 };
                abilityEvent(sim, 'fire', [orb]);
            }
        }
    }
    if (changed) ctx.onPowerupsChanged?.(sim.powerups.slice());
    if (!hasElement(sim, 'lightning')) a.chainPending = false;
    if (size && hasElement(sim, 'lightning') && (a.chainPending || a.lightningT === 0) && a.scanT === 0) {
        a.scanT = 0.2;
        const targets = chainTargets(sim, size);
        // Discharges also act against nearby enemies and bombs on boards without food.
        {
            collect(sim, size, ctx, targets, 'lightning');
            a.chainPending = false; a.lightningT = ELEMENT_ABILITIES.lightningCooldown;
            const reach = collectManifoldRing(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, size, 2);
            postFusionBurst(sim, { kind: 'element-discharge', tile: { ...sim.pos }, tiles: [...reach], defuse: true, hit: 'kill' });
            overchargeTunnel(sim, size, ctx);
        }
    }
}
// Hold the jump at its apex while Air lasts. Clamping the advance, rather than
// resetting jumpT, makes takeoff, release, re-hold and buff expiry continuous.
// Surface movement and steering continue normally beneath this held arc.
export function airJumpAdvance(sim, tileTravel) {
    const a = sim.elementalAbilities;
    a.flying = hasElement(sim, 'air') && a.jumpHeld && sim.isJumping && !sim.rocketActive && !sim.padFlight;
    const advance = tileTravel / sim.jumpSpan;
    return a.flying ? Math.min(advance, Math.max(0, 0.5 - sim.jumpT)) : advance;
}
export function elementalSpeedBonus(sim) {
    const a = sim.elementalAbilities;
    return hasElement(sim, 'ice') && a.driftT > 0 ? 0.25 : 0;
}

/**
 * Fire's Smelter: heal segments the forge pays toward a tunnel the worm is riding,
 * out of the Fire pickup's budget. One a ride, two during a flame dash, never more
 * than the tunnel still `need`s. Spends what it returns.
 */
export function smeltToll(sim, need) {
    const a = sim.elementalAbilities;
    if (!hasElement(sim, 'fire') || need <= 0 || !(a.smeltBudget > 0)) return 0;
    const per = a.fireDashT > 0 ? ELEMENT_ABILITIES.smeltDash : ELEMENT_ABILITIES.smeltPerRide;
    const paid = Math.min(per, a.smeltBudget, need);
    a.smeltBudget -= paid;
    return paid;
}

/** Water's Smooth Passage: a tunnel ridden while Water is up is not worn by the ride. */
export const tunnelRideWears = sim => !hasElement(sim, 'water');

/** Ice's Cold Snap: how fast the slice-turn hazard clock runs (1 = normal). */
export const hazardClockRate = sim => hasElement(sim, 'ice') ? ELEMENT_ABILITIES.coldSnapRate : 1;

/** Water's Riptide: how far dropped orbs are pulled back from, or 0. */
export const riptideReach = sim => hasElement(sim, 'water') ? ELEMENT_ABILITIES.riptideReach : 0;

/** Earth's Regrowth: a cut's lost orbs grow straight back onto the body. */
export const regrowsCut = sim => hasElement(sim, 'grass');

/**
 * Earth's Overgrowth: tiles the garden covers (spring pads and growing buds) count
 * as body for a surround heal. Adds their keys to `out` and returns it.
 */
export function overgrowthTiles(sim, out) {
    if (!hasElement(sim, 'grass')) return out;
    for (const [key, patch] of sim.elementalPatches) if (patch.type === 'grass' && patch.ttl > 0) out.add(key);
    for (const orb of sim.powerups) if (orb.garden) out.add(keyOf(orb));
    return out;
}

/** Air's Gale: whether the landing that ends this jump follows a long enough flight. */
export function takeGale(sim) {
    const a = sim.elementalAbilities;
    const gale = hasElement(sim, 'air') && a.flightT >= ELEMENT_ABILITIES.galeFlight;
    a.flightT = 0;
    return gale;
}

/**
 * Lightning's Overcharge: each discharge also charges the nearest uncharged tunnel
 * mouth within reach, so riding it pays part of its own heal toll (CHARGED_TOLL).
 * Returns the tunnel key it charged, or null.
 */
export function overchargeTunnel(sim, size, ctx) {
    const tunnels = ctx.getActiveTunnels?.();
    if (!size || !tunnels?.length) return null;
    // Balls of growing radius (centre included): a mouth's distance is the first that holds it.
    const balls = [];
    for (let r = 0; r <= ELEMENT_ABILITIES.overchargeReach; r++) balls.push(collectManifoldRing(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, size, r));
    let best = null, bestD = Infinity;
    for (const hit of tunnels) {
        if (!hit?.tunnelKey || sim.chargedTunnels.has(hit.tunnelKey) || sim.voidTunnelKeys?.has(hit.tunnelKey)) continue;
        const tunnel = hit.tunnel ?? hit;
        for (const mouth of [tunnel.entry, tunnel.exit]) {
            if (!mouth) continue;
            const d = balls.findIndex(ball => ball.has(keyOf(mouth)));
            if (d >= 0 && d < bestD) { best = { hit, mouth }; bestD = d; }
        }
    }
    if (!best) return null;
    sim.chargedTunnels.add(best.hit.tunnelKey);
    sim.elementalAbilities.overcharged++;
    abilityEvent(sim, 'lightning', [sim.pos, best.mouth]);
    return best.hit.tunnelKey;
}
