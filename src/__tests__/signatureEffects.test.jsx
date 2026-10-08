import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { Matrix4 } from 'three';
import { applyProps } from '@react-three/fiber';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { makeGlowTrail } from '../worm/healerWorm/glowTrail.js';
import { ttPush } from '../worm/circularBuffers.js';
import { makeSignature } from '../worm/healerWorm/signatures.js';
import { springLanding } from '../worm/healerWorm/jumpLanding.js';
import { setLiveRotation, resetLiveRotation } from '../worm/liveRotation.js';
const { cleanups, frames } = vi.hoisted(() => ({ cleanups: [], frames: [] }));
vi.mock('react', async original => ({ ...await original(), useMemo: fn => fn(), useEffect: fn => { cleanups.push(fn()); } }));
vi.mock('@react-three/fiber', async original => ({ ...await original(), useFrame: fn => frames.push(fn) }));
import { SignatureEffects } from '../worm/healerWorm/SignatureEffects.jsx';
let worm, meshes;
beforeEach(() => {
  resetLiveRotation(); frames.length = 0;
  const cubies = makeCubies(5); cubies[2][3][4].stickers.PZ.curr = 4;
  useGameStore.setState({ cubies, wormAlive: true, wormGamePhase: 'active', wormPowerups: [{ x: 2, y: 3, z: 4, dirKey: 'PZ' }] });
  worm = { signature: { current: { ...makeSignature(), character: 'glow', active: 3, seq: 1 } },
    pos: { current: { x: 2, y: 2, z: 4, dirKey: 'PZ' } }, phase: { current: 'crawling' } };
  worm.signature.current.glowTrail = makeGlowTrail();
  ttPush(worm.signature.current.glowTrail.path, '0,0,4,PZ');
  meshes = SignatureEffects({ worm, size: 5 }).props.children.map(child => {
    const { object, ...props } = child.props; applyProps(object, props); return object;
  });
});
afterEach(() => { while (cleanups.length) cleanups.pop()(); resetLiveRotation(); });
it('removes Glow pulses on expiry, death and tunnel entry', () => {
  frames[0](); expect(meshes[1].count).toBe(3);
  expect(meshes[1].material.depthTest).toBe(true);
  const tailPulse = new Matrix4(); meshes[1].getMatrixAt(0, tailPulse);
  expect(tailPulse.elements[12]).toBe(-2);
  expect(tailPulse.elements[13]).toBe(-2);
  worm.signature.current.active = 0; frames[0](); expect(meshes.every(m => m.count === 0)).toBe(true);
  worm.signature.current.active = 4; worm.phase.current = 'tunnel'; frames[0](); expect(meshes.every(m => m.count === 0)).toBe(true);
  worm.phase.current = 'crawling'; useGameStore.setState({ wormAlive: false }); frames[0]();
  expect(meshes.every(m => m.count === 0)).toBe(true);
});
it('depth-tests the MOBI tunnel marker and follows its own rotating slice', () => {
  worm.signature.current = { ...makeSignature(), character: 'mobi', mobiTunnel: { reentryT: 10 }, target: { x: 2, y: 3, z: 4, dirKey: 'PZ' } };
  frames[0](); const initial = new Matrix4(); meshes[2].getMatrixAt(0, initial);
  expect(meshes[2].material.depthTest).toBe(true);
  setLiveRotation('row', [1, 3], [0.6, -0.6], 1, 0.6); frames[0]();
  const rotated = new Matrix4(); meshes[2].getMatrixAt(0, rotated);
  expect(rotated.equals(initial)).toBe(false); expect(meshes[2].count).toBe(1);
});
it('disposes every mesh, geometry and material on retry/unmount', () => {
  const listeners = meshes.flatMap(mesh => [mesh, mesh.geometry, mesh.material]).map(resource => {
    const listener = vi.fn(); resource.addEventListener('dispose', listener); return listener;
  });
  cleanups.pop()(); listeners.forEach(listener => expect(listener).toHaveBeenCalledTimes(1));
});

it('shows Classic attraction rings on the current face and removes them after the effect', () => {
  worm.signature.current = { ...makeSignature(), character: 'classic', active: 6, seq: 1 };
  frames[0](); expect(meshes[1].count).toBe(3); expect(meshes[1].material.depthTest).toBe(true);
  const ring = new Matrix4(); meshes[1].getMatrixAt(0, ring);
  expect(ring.elements[12]).toBe(0); expect(ring.elements[13]).toBe(0);
  worm.signature.current.active = 0; frames[0](); expect(meshes[1].count).toBe(0);
});

// ── Inch Worm: Spring ────────────────────────────────────────────────────────
// meshes: 0 target ring, 1 pulse rings, 2 lock, 3 pages, 4 arc dots.
function springWorm(extra = {}, interpT = 0.4) {
  const pos = { x: 2, y: 0, z: 4, dirKey: 'PZ' };
  worm.pos = { current: pos };
  worm.interpT = { current: interpT };
  worm.prevTile = { current: { x: 2, y: 0, z: 4, dirKey: 'PZ' } };
  worm.moveDir = { current: 'up' };
  worm.restRead = { current: false };
  worm.isJumping = { current: false };
  worm.signature.current = { ...makeSignature(), character: 'inch', preview: springLanding(pos, 'up', 5, interpT).tile, ...extra };
}
const heightOf = (mesh, i) => { const m = new Matrix4(); mesh.getMatrixAt(i, m); return m.elements[14] - 2.5; };   // above the +Z face

it('draws the leap before it is taken: dots along the arc, rising to the apex and back to the landing', () => {
  springWorm(); frames[0]();
  expect(meshes[0].count).toBe(1);                      // the landing ring
  expect(meshes[4].count).toBe(16);
  const lifts = Array.from({ length: 16 }, (_, i) => heightOf(meshes[4], i));
  const top = Math.max(...lifts);
  expect(top).toBeGreaterThan(2);                       // an arc taller than the plain jump's 1.3
  expect(lifts.indexOf(top)).toBeGreaterThanOrEqual(6); expect(lifts.indexOf(top)).toBeLessThanOrEqual(9);
  expect(lifts[0]).toBeLessThan(top / 2); expect(lifts[15]).toBeLessThan(top / 2);
  for (let i = 1; i <= lifts.indexOf(top); i++) expect(lifts[i]).toBeGreaterThanOrEqual(lifts[i - 1]);
});
it('draws the arc over a cube edge without cutting through the cube', () => {
  springWorm({}, 0.4); worm.pos.current = { x: 2, y: 3, z: 4, dirKey: 'PZ' }; worm.prevTile.current = { x: 2, y: 2, z: 4, dirKey: 'PZ' };
  worm.signature.current.preview = springLanding(worm.pos.current, 'up', 5, 0.4).tile;
  expect(worm.signature.current.preview.dirKey).toBe('PY');
  frames[0]();
  expect(meshes[4].count).toBe(16);
  for (let i = 0; i < 16; i++) {
    const m = new Matrix4(); meshes[4].getMatrixAt(i, m);
    expect(Math.max(Math.abs(m.elements[12]), Math.abs(m.elements[13]), Math.abs(m.elements[14]))).toBeGreaterThan(2.5);   // always outside the cube
  }
});
it('marks a blocked landing in orange, and hides the whole preview once airborne or while a layer turns', () => {
  springWorm({ reason: 'Body blocks landing' }); frames[0]();
  expect(meshes[0].material.color.getHexString()).toBe('ffbb72'); expect(meshes[4].material.color.getHexString()).toBe('ffbb72');
  springWorm(); worm.isJumping.current = true; frames[0]();
  expect(meshes[0].count).toBe(0); expect(meshes[4].count).toBe(0);
  worm.isJumping.current = false; setLiveRotation('row', [1], [0.4], 1, 0.4); frames[0]();
  expect(meshes[4].count).toBe(0);
});
it('springs rings out of the launch tile, then runs a shockwave out of the landing', () => {
  springWorm({ active: 1, fxT: 0.6, fxTile: { x: 2, y: 0, z: 4, dirKey: 'PZ' } }); worm.isJumping.current = true; frames[0]();
  expect(meshes[1].count).toBe(3); expect(meshes[1].material.color.getHexString()).toBe('c6ec86'); expect(meshes[4].count).toBe(0);
  springWorm({ slam: { seq: 1, tile: { x: 2, y: 3, z: 4, dirKey: 'PZ' } }, slamT: 0.5 }); frames[0]();
  expect(meshes[1].count).toBe(3);
  const early = new Matrix4(); meshes[1].getMatrixAt(0, early); const s0 = early.elements[0];
  worm.signature.current.slamT = 0.1; frames[0]();
  const late = new Matrix4(); meshes[1].getMatrixAt(0, late);
  expect(late.elements[0]).toBeGreaterThan(s0 * 1.5);      // the wave has run outward
  expect(meshes[1].material.opacity).toBeLessThan(0.4);    // and thinned
  worm.signature.current.slamT = 0; frames[0](); expect(meshes[1].count).toBe(0);
});
