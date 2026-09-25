import { describe, it, expect } from 'vitest';
import { makeTileTrail, ttPush, ttAt, ttReset } from '../worm/circularBuffers.js';
import { makeGlowTrail, tickGlowTrail, breakGlowTrail } from '../worm/healerWorm/glowTrail.js';

function movingWorm() {
  const pathHistory = makeTileTrail(1024);
  for (let x = 0; x < 15; x++) ttPush(pathHistory, `${x},0,14,PZ`);
  return { phase: 'crawling', interpT: 0.5, tailLength: 40, pathHistory,
    signature: { character: 'glow', active: 8, glowTrail: makeGlowTrail() } };
}

describe('Glow tail paint', () => {
  it('starts behind the full body, even while the head is partway between tiles', () => {
    const sim = movingWorm();
    tickGlowTrail(sim, 0.1);
    const path = sim.signature.glowTrail.path;
    expect(path.count).toBe(1); // does not light up the entire old route
    expect(ttAt(path, 0)).toBe('9,0,14,PZ');
    ttPush(sim.pathHistory, '15,0,14,PZ');
    tickGlowTrail(sim, 0.1);
    expect(ttAt(path, 0)).toBe('10,0,14,PZ');
    expect(ttAt(path, 1)).toBe('9,0,14,PZ');
  });

  it('retains paint for twelve seconds after emission stops and freezes in tunnels', () => {
    const sim = movingWorm();
    tickGlowTrail(sim, 0.1);
    sim.signature.active = 0;
    const paint = sim.signature.glowTrail;
    tickGlowTrail(sim, 9);
    expect(paint.life).toBe(3);
    sim.phase = 'tunnel'; tickGlowTrail(sim, 20);
    expect(paint.life).toBe(3);
    sim.phase = 'crawling'; tickGlowTrail(sim, 3);
    expect(paint.life).toBe(0);
  });

  it('does not repaint old tiles after body growth moves the tail backward', () => {
    const sim = movingWorm();
    tickGlowTrail(sim, 0.1);
    const paint = sim.signature.glowTrail;
    sim.tailLength = 70;
    tickGlowTrail(sim, 0.1);
    expect(paint.path.count).toBe(1);
    sim.tailLength = 40;
    tickGlowTrail(sim, 0.1);
    expect(paint.path.count).toBe(1);
  });

  it('preserves old paint when the crawl route resets, with a break before new paint', () => {
    const sim = movingWorm();
    tickGlowTrail(sim, 0.1);
    breakGlowTrail(sim.signature);
    ttReset(sim.pathHistory, '0,0,0,NZ');
    sim.tailLength = 4;
    for (let x = 1; x < 4; x++) ttPush(sim.pathHistory, `${x},0,0,NZ`);
    tickGlowTrail(sim, 0.1);
    const path = sim.signature.glowTrail.path;
    expect(ttAt(path, 0)).toBe('2,0,0,NZ');
    expect(ttAt(path, 1)).toBe('');
    expect(ttAt(path, 2)).toBe('9,0,14,PZ');
  });

  it('bounds retained paint even on long fast runs', () => {
    const sim = movingWorm();
    tickGlowTrail(sim, 0.1);
    for (let i = 0; i < 1000; i++) {
      ttPush(sim.pathHistory, `${i % 15},0,14,PZ`);
      tickGlowTrail(sim, 0.001);
    }
    expect(sim.signature.glowTrail.path.count).toBe(256);
  });
});
