import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { Matrix4 } from 'three';
import { applyProps } from '@react-three/fiber';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { makeGlowTrail } from '../worm/healerWorm/glowTrail.js';
import { ttPush } from '../worm/circularBuffers.js';
import { makeSignature } from '../worm/healerWorm/signatures.js';
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
