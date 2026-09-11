import { beforeEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { fireFlipImpulse, flipImpulse } from '../3d/flipImpulse.js';
import CameraFlipKick from '../3d/CameraFlipKick.jsx';

const harness = vi.hoisted(() => ({ frame: null, camera: null, refs: [], index: 0 }));
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera: harness.camera }),
  useFrame: fn => { harness.frame = fn; },
}));
vi.mock('react', () => ({ useRef: initial => {
  const i = harness.index++;
  return harness.refs[i] ?? (harness.refs[i] = { current: initial });
} }));
beforeEach(() => {
  harness.camera = new PerspectiveCamera();
  harness.camera.position.set(2, 3, 4);
  harness.refs = []; harness.index = 0;
  flipImpulse.t = 0;
});
function render(props) { harness.index = 0; CameraFlipKick(props); }
it('does not move the chase camera or orbit target during repeated flips', () => {
  const target = new Vector3(1, 2, 3);
  render({ enabled: false, controlsRef: { current: { target } } });
  for (let i = 0; i < 120; i++) {
    fireFlipImpulse(new Vector3(i % 2 ? 1 : -1, 0, 0));
    harness.frame({}, 1 / 60);
    expect(harness.camera.position.toArray()).toEqual([2, 3, 4]);
    expect(target.toArray()).toEqual([1, 2, 3]);
    expect(flipImpulse.t).toBe(0);
  }
});
it('discards an interrupted recoil before orbit controls resume', () => {
  const controlsRef = { current: { target: new Vector3() } };
  render({ controlsRef });
  fireFlipImpulse(new Vector3(1, 0, 0));
  harness.frame({}, 0.07);
  expect(harness.camera.position.x).toBeGreaterThan(2);
  render({ controlsRef, enabled: false });
  harness.camera.position.set(8, 9, 10); // chase controller takes over
  harness.frame({}, 1 / 60);
  render({ controlsRef, enabled: true });
  harness.frame({}, 1 / 60);
  expect(harness.camera.position.toArray()).toEqual([8, 9, 10]);
});
