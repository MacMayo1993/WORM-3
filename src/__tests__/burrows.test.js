import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { makeCubies, healSticker } from '../game/cubeState.js';
import { flipStickerPair } from '../game/manifoldLogic.js';
import { getManifoldMap, resetManifoldMap } from '../game/manifoldMapStore.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { startBurrow, tickBurrows, BURROW_TIMING } from '../worm/healerWorm/burrows.js';
import { burrowBridge, burrowEntryOpen, burrowTileOpen, burrowCubieLift } from '../worm/burrowBridge.js';
import { getWormTunnelSnapshot, resetWormTunnelSnapshots } from '../worm/tunnelSnapshot.js';
import { raisedPlatformPosition } from '../worm/healerWorm/raisedPlatforms.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
import { resetLiveRotation, liveRotation } from '../worm/liveRotation.js';
import { ttReset } from '../worm/circularBuffers.js';

const SIZE = 6;
beforeEach(() => { resetManifoldMap(); resetWormTunnelSnapshots(); resetLiveRotation(); });
afterEach(() => { burrowBridge.current = null; resetLiveRotation(); });

function setup() {
    let cubies = makeCubies(SIZE), epoch = 0, phase = 'active', paused = false;
    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 10 });
    let seed = 2931;
    sim.rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const ctx = {
        getCubies: () => cubies, getRotationEpoch: () => epoch, getGamePhase: () => phase,
        isPaused: () => paused, getFlipCap: () => 9999, getTunnelEntry: () => 'pad',
        getActiveTunnels: () => getWormTunnelSnapshot(cubies, SIZE, epoch).tunnels,
        isBurrowFaceOpen: sticker => burrowTileOpen(sticker, SIZE),
        spawnWormholePair: vi.fn(tile => { cubies = flipStickerPair(cubies, SIZE, tile.x, tile.y, tile.z, tile.dirKey, getManifoldMap(cubies, SIZE, epoch)); }),
    };
    burrowBridge.current = sim.burrows;
    const tick = seconds => { for (let i = 0; i < Math.ceil(seconds / 0.05); i++) tickBurrows(sim, SIZE, ctx, 0.05); };
    const until = (pair, target) => {
        for (let i = 0; i < 1000 && pair.phase !== target; i++) tick(0.05);
        expect(pair.phase).toBe(target);
    };
    const ends = pair => pair.ids.map(id => getManifoldMap(cubies, SIZE, epoch).get(id));
    return { sim, ctx, tick, until, ends,
        pause: value => { paused = value; }, phase: value => { phase = value; },
        heal: pair => { for (const p of ends(pair)) cubies = healSticker(cubies, SIZE, p.x, p.y, p.z, p.dirKey); },
        rotate: (axis, sliceIndex, dir) => { cubies = rotateSliceCubies(cubies, SIZE, axis, sliceIndex, dir); epoch++; },
    };
}

describe('burrowing ambient tunnels', () => {
    it('moves a contiguous wake, warns both ends, then flips exactly once and reaches a jumpable height', () => {
        const h = setup(), before = h.ctx.getCubies();
        expect(startBurrow(h.sim, SIZE, h.ctx)).toBe(true);
        const pair = [...h.sim.burrows.pairs.values()][0];
        const map = getManifoldMap(before, SIZE, 0);
        const cells = pair.route.map(id => map.get(id));
        for (let i = 1; i < cells.length; i++) {
            const neighbours = ['up', 'down', 'left', 'right'].map(dir => getNextSurfacePosition(cells[i - 1], dir, SIZE)).filter(Boolean).map(p => p.pos ?? p);
            expect(neighbours.some(p => p.x === cells[i].x && p.y === cells[i].y && p.z === cells[i].z && p.dirKey === cells[i].dirKey)).toBe(true);
        }
        h.tick(0.8);
        expect(h.sim.burrows.wake.size).toBeGreaterThan(1);
        expect(h.ctx.getCubies()).toBe(before);
        expect(h.ctx.spawnWormholePair).not.toHaveBeenCalled();
        h.until(pair, 'settling');
        expect([...h.sim.burrows.wake.keys()].sort()).toEqual([...pair.ids].sort());
        h.tick(BURROW_TIMING.settle - 0.2);
        expect(h.ctx.spawnWormholePair).not.toHaveBeenCalled();
        h.until(pair, 'opening'); h.tick(0.5);
        expect(h.ctx.spawnWormholePair).toHaveBeenCalledTimes(1);
        expect(pair.openness).toBeCloseTo(0.5, 4);
        for (const end of h.ends(pair)) expect(raisedPlatformPosition(end, SIZE, h.ctx)).toBe(null);
        h.until(pair, 'open');
        for (const end of h.ends(pair)) {
            expect(raisedPlatformPosition(end, SIZE, h.ctx)).not.toBe(null);
            expect(burrowCubieLift(h.ctx.getCubies()[end.x][end.y][end.z], SIZE, 9999)).toBe(1);
        }
    });

    it('retracts without healing, spawning offspring, losing deposits, or incrementing flip counts on resurfacing', () => {
        const h = setup(); startBurrow(h.sim, SIZE, h.ctx);
        const pair = [...h.sim.burrows.pairs.values()][0]; h.until(pair, 'open');
        const committed = h.ctx.getCubies();
        const hit = h.ctx.getActiveTunnels()[0];
        h.sim.tunnelUseCounts.set(hit.tunnelKey, 2);
        h.tick(BURROW_TIMING.open - 2);
        expect([...h.sim.burrows.wake.values()].every(w => w.phase === 'closing')).toBe(true);
        h.until(pair, 'retreating');
        expect(burrowEntryOpen(pair)).toBe(false);
        h.tick(0.5); expect(pair.openness).toBeCloseTo(0.5, 4);
        h.until(pair, 'underground');
        expect(pair.openness).toBe(0);
        expect(h.ctx.getActiveTunnels()).toHaveLength(1); // Still counts toward the objective and cap.
        for (const end of h.ends(pair)) expect(raisedPlatformPosition(end, SIZE, h.ctx)).toBe(null);
        h.until(pair, 'open');
        expect(h.ctx.getCubies()).toBe(committed);
        expect(h.sim.healed).toBe(0);
        expect(h.sim.tunnelUseCounts.get(hit.tunnelKey)).toBe(2);
        expect(h.ctx.spawnWormholePair).toHaveBeenCalledTimes(1);
        expect(h.sim.burrows.pairs.size).toBe(1);
    });

    it.each(['pause', 'turn', 'jump', 'padFlight', 'tunnel', 'tail', 'platform', 'departure', 'raisedTail'])(
        'freezes closing while %s owns the player route', blocker => {
            const h = setup(); startBurrow(h.sim, SIZE, h.ctx);
            const pair = [...h.sim.burrows.pairs.values()][0]; h.until(pair, 'open');
            h.tick(BURROW_TIMING.open - 1);
            if (blocker === 'pause') h.pause(true);
            if (blocker === 'turn') liveRotation.active = true;
            if (blocker === 'jump') h.sim.isJumping = true;
            if (blocker === 'padFlight') h.sim.padFlight = {};
            if (blocker === 'tunnel') h.sim.phase = 'windup';
            if (blocker === 'tail') h.sim.tunnelPassages.push({});
            if (blocker === 'platform') h.sim.onRaisedPlatform = true;
            if (blocker === 'departure') h.sim.raisedDeparture = {};
            if (blocker === 'raisedTail') h.sim.raisedRouteDistance = h.sim.stepHistory.distance;
            const remaining = pair.remaining; h.tick(10);
            expect(pair.remaining).toBe(remaining); expect(pair.openness).toBe(1);
        });

    it('waits to open if either whole endpoint cubie is occupied, including the opposite mouth', () => {
        const h = setup(); startBurrow(h.sim, SIZE, h.ctx);
        const pair = [...h.sim.burrows.pairs.values()][0]; h.until(pair, 'settling');
        const original = h.sim.pos;
        h.sim.pos = { ...h.ends(pair)[1] };
        ttReset(h.sim.tileTrail, `${h.sim.pos.x},${h.sim.pos.y},${h.sim.pos.z},${h.sim.pos.dirKey}`);
        h.tick(5); expect(pair.phase).toBe('settling');
        expect(h.ctx.spawnWormholePair).not.toHaveBeenCalled();
        h.sim.pos = original; ttReset(h.sim.tileTrail, `${original.x},${original.y},${original.z},${original.dirKey}`);
        h.until(pair, 'open');
    });

    it('keeps final-healing tunnels open and cancels uncommitted arrivals', () => {
        const h = setup(); startBurrow(h.sim, SIZE, h.ctx);
        const pair = [...h.sim.burrows.pairs.values()][0]; h.until(pair, 'underground');
        expect(startBurrow(h.sim, SIZE, h.ctx)).toBe(true);
        h.phase('finalHealing'); h.until(pair, 'open'); h.tick(40);
        expect(h.sim.burrows.pairs.size).toBe(1);
        expect(pair.phase).toBe('open'); expect(pair.openness).toBe(1);
        expect(h.ctx.spawnWormholePair).toHaveBeenCalledTimes(1);
    });

    it('retires healed pairs and clears every pending wake on restart', () => {
        const h = setup(); startBurrow(h.sim, SIZE, h.ctx);
        const pair = [...h.sim.burrows.pairs.values()][0]; h.until(pair, 'open');
        h.heal(pair); h.tick(0.05);
        expect(h.sim.burrows.pairs.size).toBe(0); expect(h.sim.burrows.bySticker.size).toBe(0);
        startBurrow(h.sim, SIZE, h.ctx);
        resetWormSim(h.sim, SIZE, { orbCount: 0, wormholeInterval: 10 });
        expect(h.sim.burrows.pairs.size).toBe(0); expect(h.sim.burrows.wake.size).toBe(0);
    });

    it('tracks physical sticker identity through a rotation and restarts the warning', () => {
        const h = setup(); startBurrow(h.sim, SIZE, h.ctx);
        const pair = [...h.sim.burrows.pairs.values()][0]; h.until(pair, 'settling');
        const before = h.ends(pair).find(p => getManifoldGridId(p.sticker, SIZE) === pair.targetId);
        h.rotate('row', before.y, 1); h.tick(0.05);
        expect(pair.phase).toBe('burrowing');
        expect(pair.elapsed).toBeCloseTo(0.05);
        h.until(pair, 'open');
        const opened = h.ctx.spawnWormholePair.mock.calls[0][0];
        expect(getManifoldGridId(h.ctx.getCubies()[opened.x][opened.y][opened.z].stickers[opened.dirKey], SIZE)).toBe(pair.targetId);
        expect(h.ctx.getActiveTunnels()[0].tunnel.pairId).toBe(pair.id);
    });

    it('reserves one pending slot and never hides a collapsed pit', () => {
        const h = setup(); expect(startBurrow(h.sim, SIZE, h.ctx)).toBe(true);
        expect(startBurrow(h.sim, SIZE, h.ctx)).toBe(false);
        const pair = [...h.sim.burrows.pairs.values()][0]; h.until(pair, 'open');
        h.sim.voidTunnelKeys.add(h.ctx.getActiveTunnels()[0].tunnelKey); h.tick(0.05);
        expect(h.sim.burrows.pairs.size).toBe(0);
        for (const end of h.ends(pair)) expect(burrowTileOpen(h.ctx.getCubies()[end.x][end.y][end.z].stickers[end.dirKey], SIZE)).toBe(true);
    });
});
