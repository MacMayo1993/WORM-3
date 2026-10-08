import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { combatBridge, combatKey, surfaceRoute } from '../worm/combat/portalCombat.js';
import { makeGlowTrail } from '../worm/healerWorm/glowTrail.js';
import { ttPush } from '../worm/circularBuffers.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { setWormTurnCallback } from '../worm/wormTurnBridge.js';
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));

// The link the combat tests cannot see: the real crawler hands the Glow Worm's painted
// trail to Portal Combat, and an enemy that runs into it is burned.
let root, host, worm;
const state = () => useGameStore.getState();
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; setWormTurnCallback(api.queueTurn); return () => setWormTurnCallback(null); }, [api]);
  return null;
}
const frame = () => act(() => worm.tick(0.05));
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; resetLiveRotation();
  useGameStore.setState({ cubies: makeCubies(5), size: 5, demoMode: false, wormPauseMenuOpen: false });
});
afterEach(() => { act(() => root.unmount()); host.remove(); state().clearDisparityGame(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
function start(character) {
  useGameStore.setState({ wormCharacter: character });
  state().initWormMode(undefined, undefined, 1.25, 2, 30, null, true);
  useGameStore.setState({ wormGamePhase: 'active' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />)); frame(); frame();
  act(() => worm.queueTurn('combat-start')); frame();
}
// An enemy two steps from the head, with the first step of its walk to the head painted.
function ambush() {
  const c = combatBridge.current, head = worm.pos.current;
  const from = getAllSurfaceTiles(5).find(t => t.dirKey === head.dirKey && surfaceRoute(t, head, 5)?.length === 2);
  const wall = surfaceRoute(from, head, 5)[0];
  const e = { id: ++c.seq, type: 'crawler', hp: 1, tile: { ...from }, next: null, t: 0, emerging: 0, stun: 0 };
  c.enemies.push(e);
  return { c, e, wall: combatKey(wall) };
}
function paint(key) {
  const sig = worm.signature.current;
  Object.assign(sig, { character: 'glow', glowTrail: makeGlowTrail() });
  sig.glowTrail.life = 12; ttPush(sig.glowTrail.path, key);
}

it('burns an enemy that runs into the Glow Worm\'s painted trail', () => {
  start('glow');
  const { c, wall } = ambush();
  paint(wall);
  for (let i = 0; i < 6; i++) frame();
  expect(c.lightHits).toBeGreaterThan(0);
  expect(c.kills).toBe(1);
});
it('does nothing for a worm that has painted no trail', () => {
  start('glow');
  const { c, e } = ambush();
  for (let i = 0; i < 6; i++) frame();
  expect(c.lightHits).toBe(0);
  expect(c.enemies).toContain(e);
});
it('ignores a trail once the paint has faded', () => {
  start('glow');
  const { c, wall } = ambush();
  paint(wall); worm.signature.current.glowTrail.life = 0.1;
  for (let i = 0; i < 6; i++) frame();
  expect(c.lightHits).toBe(0);
});

// ── Inch Worm: Spring's touchdown reaches combat through the same crawler ────
function beside() {
  const c = combatBridge.current, head = worm.pos.current;
  const near = getAllSurfaceTiles(5).find(t => t.dirKey === head.dirKey && surfaceRoute(t, head, 5)?.length === 1);
  const e = { id: ++c.seq, type: 'crawler', hp: 1, tile: { ...near }, next: null, t: 0, emerging: 0, stun: 0 };
  c.enemies.push(e);
  return { c, e };
}
it("stuns the enemies around Spring's landing, once", () => {
  start('inch');
  const { c, e } = beside();
  const brute = { ...e, id: ++c.seq, type: 'brute', hp: 3, tile: { ...e.tile } }; c.enemies.push(brute);
  const sig = worm.signature.current;
  Object.assign(sig, { character: 'inch', slam: { seq: 1, tile: { ...worm.pos.current } }, slamT: 0.5 });
  frame();
  expect(c.slamHits).toBeGreaterThan(0);
  expect(c.enemies).not.toContain(e);                   // the crawler is down
  expect(brute.hp).toBe(2); expect(brute.stun).toBeGreaterThan(0);
  const hits = c.slamHits;
  for (let i = 0; i < 4; i++) frame();
  expect(c.slamHits).toBe(hits);                        // the window outlives the frame, the slam does not repeat
});
it('does not slam once the window has closed', () => {
  start('inch');
  const { c } = beside();
  Object.assign(worm.signature.current, { character: 'inch', slam: { seq: 1, tile: { ...worm.pos.current } }, slamT: 0 });
  frame();
  expect(c.slamHits).toBe(0);
});
it('keeps crawling through the coil instead of holding combat', () => {
  start('inch');
  const c = combatBridge.current, sig = worm.signature.current;
  Object.assign(sig, { character: 'inch', charge: 0.2 });
  const time = c.time; frame(); frame();
  expect(c.held).toBe(false);
  expect(c.time).toBeGreaterThan(time);                 // combat's clock runs; the coil is not a pause
});
