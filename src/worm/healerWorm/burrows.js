import { getManifoldMap } from '../../game/manifoldMapStore.js';
import { getManifoldGridId } from '../../game/gridIds.js';
import { flipPadPair } from '../../game/flipPad.js';
import { getNextSurfacePosition } from '../wormLogic.js';
import { getAllSurfaceTiles } from './surfaceTiles.js';
import { activeTunnelCap } from './constants.js';
import { liveRotation } from '../liveRotation.js';
import { tunnelTailReach } from './tunnelTrail.js';
import { bodyCoverageCount } from './bodyCoverage.js';
import { ttAt } from '../circularBuffers.js';

// Simulation seconds, never wall-clock timers. The last three open seconds are
// a closing warning; a jump accepted during that warning reserves the whole ride.
export const BURROW_TIMING = Object.freeze({ step: 0.6, settle: 1.8, opening: 1,
    open: 12, warning: 3, retreat: 1, underground: 2 });
const directions = ['up', 'right', 'down', 'left'];
const smooth = t => { const p = Math.max(0, Math.min(1, t)); return p * p * (3 - 2 * p); };
const tileKey = p => `${p.x},${p.y},${p.z},${p.dirKey}`;
const cellKey = p => `${p.x},${p.y},${p.z}`;
const stickerAt = (cubies, p) => cubies?.[p?.x]?.[p?.y]?.[p?.z]?.stickers?.[p?.dirKey];

export function makeBurrows() {
    return { pairs: new Map(), bySticker: new Map(), wake: new Map(), wakeCubies: new Set(), epoch: null };
}

function location(map, cubies, id) {
    const p = map.get(id);
    return p ? { x: p.x, y: p.y, z: p.z, dirKey: p.dirKey, sticker: stickerAt(cubies, p) } : null;
}

// Walk backwards from the committed destination, then reverse. Consecutive wake
// tiles are actual surface neighbours, including around edges. No teleporting
// random tile flashes, and no flip state is written along this path.
function routeTo(target, size, cubies, rand) {
    const path = [target], seen = new Set([tileKey(target)]);
    for (let i = 0; i < Math.min(4, size + 1); i++) {
        const options = directions.map(dir => getNextSurfacePosition(path.at(-1), dir, size))
            .filter(Boolean).map(p => p.pos ?? p).filter(p => !seen.has(tileKey(p)) && stickerAt(cubies, p));
        if (!options.length) break;
        // Prefer staying on the face so the player can follow most of the wake.
        const face = options.filter(p => p.dirKey === target.dirKey);
        const pool = face.length ? face : options;
        const next = pool[Math.floor(rand() * pool.length)];
        path.push(next); seen.add(tileKey(next));
    }
    return path.reverse().map(p => getManifoldGridId(stickerAt(cubies, p), size));
}

function setPhase(pair, phase) {
    pair.phase = phase; pair.elapsed = 0;
}

function register(burrows, pair) {
    burrows.pairs.set(pair.id, pair);
    for (const id of pair.ids) burrows.bySticker.set(id, pair);
}

function remove(burrows, pair) {
    burrows.pairs.delete(pair.id);
    for (const id of pair.ids) burrows.bySticker.delete(id);
}

// Only the ambient spawn clock calls this. Mobi, puzzle flips and scripted
// lessons retain their existing persistent behaviour. Pending pairs reserve a
// cap slot before either endpoint changes colour.
export function startBurrow(sim, size, ctx) {
    const burrows = sim.burrows;
    if ([...burrows.pairs.values()].some(pair => !pair.flipped)) return false;
    if ((ctx.getActiveTunnels?.() ?? []).length >= activeTunnelCap(size)) return false;
    const cubies = ctx.getCubies();
    if (!cubies?.length) return false;
    const map = getManifoldMap(cubies, size, ctx.getRotationEpoch?.() ?? 0);
    const candidates = [];
    for (const tile of getAllSurfaceTiles(size)) {
        const sticker = stickerAt(cubies, tile);
        if (!sticker || sticker.curr !== sticker.orig || sticker.flips !== 0) continue;
        const id = flipPadPair(sticker, size);
        if (!id || burrows.pairs.has(id)) continue;
        const ids = id.split('|'), ends = ids.map(key => location(map, cubies, key));
        if (ends.some(p => !p?.sticker || p.sticker.curr !== p.sticker.orig || p.sticker.flips !== 0)) continue;
        if (ends.some(p => Math.abs(p.x - sim.pos.x) + Math.abs(p.y - sim.pos.y) + Math.abs(p.z - sim.pos.z) < 2)) continue;
        candidates.push({ tile, id, ids });
    }
    if (!candidates.length) return false;
    const near = candidates.filter(({ tile }) => tile.dirKey === sim.pos.dirKey &&
        Math.abs(tile.x - sim.pos.x) + Math.abs(tile.y - sim.pos.y) + Math.abs(tile.z - sim.pos.z) <= 6);
    const pool = near.length ? near : candidates;
    const chosen = pool[Math.floor(sim.rand() * pool.length)];
    const targetId = getManifoldGridId(stickerAt(cubies, chosen.tile), size);
    burrows.epoch = ctx.getRotationEpoch?.() ?? 0;
    register(burrows, { id: chosen.id, ids: chosen.ids, targetId,
        route: routeTo(chosen.tile, size, cubies, sim.rand), phase: 'burrowing', elapsed: 0,
        flipped: false, openness: 0, remaining: BURROW_TIMING.open });
    publishWake(burrows, map, cubies);
    return true;
}

function occupiedCells(sim, size) {
    const result = new Set([cellKey(sim.pos)]);
    if (sim.prevTile) result.add(cellKey(sim.prevTile));
    const ahead = getNextSurfacePosition(sim.pos, sim.moveDir, size);
    if (ahead) result.add(cellKey(ahead.pos ?? ahead));
    const count = bodyCoverageCount(sim.tailLength, sim.tileTrail.count, size, sim.expansionAmount);
    for (let i = 0; i < count; i++) result.add(ttAt(sim.tileTrail, i).split(',').slice(0, 3).join(','));
    return result;
}

function publishWake(burrows, map, cubies) {
    burrows.wake.clear();
    burrows.wakeCubies.clear();
    const mark = (id, strength, phase, remaining = 1) => {
        const p = location(map, cubies, id);
        if (!p || strength <= 0) return;
        const existing = burrows.wake.get(id);
        if (existing && existing.strength >= strength) return;
        burrows.wake.set(id, { ...p, strength, phase, remaining });
        if (p.sticker?.origPos) burrows.wakeCubies.add(cellKey(p.sticker.origPos));
    };
    for (const pair of burrows.pairs.values()) {
        if (pair.phase === 'burrowing') {
            const head = pair.elapsed / BURROW_TIMING.step;
            pair.route.forEach((id, i) => {
                const distance = head - i;
                if (distance > -0.9 && distance < 2) {
                    const strength = distance < 0 ? smooth(1 + distance / 0.9) : 1 - smooth(distance / 2);
                    mark(id, strength, 'burrowing');
                }
            });
        } else if (pair.phase === 'settling') {
            const pulse = 0.65 + 0.35 * Math.sin(pair.elapsed * 7) ** 2;
            for (const id of pair.ids) mark(id, pulse, 'settling');
        } else if (pair.phase === 'open' && pair.remaining <= BURROW_TIMING.warning) {
            for (const id of pair.ids) mark(id, 1, 'closing', pair.remaining / BURROW_TIMING.warning);
        }
    }
}

// Called from the simulation after its pause/focus gates. Freeze topology while
// any head or tail owns a raised route, including the accepted jump's approach.
export function tickBurrows(sim, size, ctx, delta) {
    const burrows = sim.burrows;
    const cubies = ctx.getCubies();
    if (!cubies?.length || !burrows.pairs.size) return;
    const epoch = ctx.getRotationEpoch?.() ?? 0;
    const map = getManifoldMap(cubies, size, epoch);
    const final = ctx.getGamePhase() === 'finalHealing' || ctx.getGamePhase() === 'solved';
    const held = ctx.isPaused() || !sim.alive || liveRotation.active || sim.phase !== 'crawling' ||
        sim.padFlight || sim.isJumping || sim.rocketActive || sim.restRead || sim.signature?.sweep ||
        sim.tunnelPassages.length > 0 || sim.onRaisedPlatform || sim.raisedDeparture ||
        (sim.raisedRouteDistance != null && sim.stepHistory.distance - sim.raisedRouteDistance < tunnelTailReach(sim.tailLength));
    const dt = held ? 0 : Math.min(0.05, Math.max(0, delta));
    let occupied;
    for (const pair of burrows.pairs.values()) {
        const ends = pair.ids.map(id => location(map, cubies, id));
        if (ends.some(p => !p?.sticker) || (final && !pair.flipped)) { remove(burrows, pair); continue; }
        if (pair.flipped && ends.some(p => p.sticker.curr === p.sticker.orig)) { remove(burrows, pair); continue; }
        // A collapsed tunnel remains a pit. Never hide its danger or reset uses.
        if (pair.flipped && sim.voidTunnelKeys.has(ends.map(tileKey).sort().join('|'))) { remove(burrows, pair); continue; }
        if (epoch !== burrows.epoch && ['burrowing', 'settling'].includes(pair.phase)) {
            pair.route = routeTo(location(map, cubies, pair.targetId), size, cubies, sim.rand);
            setPhase(pair, 'burrowing');
        }
        if (final && ['retreating', 'underground', 'burrowing', 'settling'].includes(pair.phase)) {
            // The remaining heal objective must stay reachable. Reopen smoothly,
            // preserving the current lift instead of snapping out of the cube.
            pair.openingFrom = pair.openness;
            setPhase(pair, 'opening');
        }
        if (pair.phase === 'opening') {
            occupied ??= occupiedCells(sim, size);
            // The crawler can reach either mouth after settling cleared it.
            // Hold the clock as well as the lift so clearing it resumes smoothly.
            if (ends.some(p => occupied.has(cellKey(p)))) continue;
        }
        pair.elapsed += dt;
        if (pair.phase === 'burrowing' && pair.elapsed >= pair.route.length * BURROW_TIMING.step) {
            setPhase(pair, 'settling');
        } else if (pair.phase === 'settling' && pair.elapsed >= BURROW_TIMING.settle && dt > 0) {
            occupied ??= occupiedCells(sim, size);
            if (ends.some(p => occupied.has(cellKey(p)))) continue;
            if (!pair.flipped) {
                if (ends.some(p => p.sticker.curr !== p.sticker.orig || p.sticker.flips !== 0) ||
                    (ctx.getActiveTunnels?.() ?? []).length >= activeTunnelCap(size)) { remove(burrows, pair); continue; }
                const target = location(map, cubies, pair.targetId);
                ctx.spawnWormholePair(target);
                const committed = ctx.getCubies();
                if (ends.some(p => stickerAt(committed, p)?.curr === stickerAt(committed, p)?.orig)) {
                    remove(burrows, pair); continue;
                }
                pair.flipped = true;
            }
            pair.openingFrom = 0;
            setPhase(pair, 'opening');
        } else if (pair.phase === 'opening') {
            pair.openness = (pair.openingFrom ?? 0) + (1 - (pair.openingFrom ?? 0)) * smooth(pair.elapsed / BURROW_TIMING.opening);
            if (pair.elapsed >= BURROW_TIMING.opening) { pair.openness = 1; pair.remaining = BURROW_TIMING.open; setPhase(pair, 'open'); }
        } else if (pair.phase === 'open') {
            pair.remaining = final ? BURROW_TIMING.open : Math.max(0, BURROW_TIMING.open - pair.elapsed);
            if (!final && pair.remaining === 0 && dt > 0) {
                occupied ??= occupiedCells(sim, size);
                if (!ends.some(p => occupied.has(cellKey(p)))) setPhase(pair, 'retreating');
            }
        } else if (pair.phase === 'retreating') {
            pair.openness = 1 - smooth(pair.elapsed / BURROW_TIMING.retreat);
            if (pair.elapsed >= BURROW_TIMING.retreat) { pair.openness = 0; setPhase(pair, 'underground'); }
        } else if (pair.phase === 'underground' && pair.elapsed >= BURROW_TIMING.underground) {
            pair.route = routeTo(location(map, cubies, pair.targetId), size, cubies, sim.rand);
            setPhase(pair, 'burrowing');
        }
    }
    burrows.epoch = epoch;
    publishWake(burrows, map, ctx.getCubies());
}
