import { describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { createMenuCubeSwipe } from '../components/menus/menuCubeSwipe.js';

function setup({ reduced = false, allowed = true, camera = new PerspectiveCamera() } = {}) {
  const onTap = vi.fn(), onPress = vi.fn(), onRelease = vi.fn();
  const capture = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };
  const options = { reduced, allowed };
  const swipe = createMenuCubeSwipe({ camera: () => camera, span: () => 390,
    canInteract: () => options.allowed, reducedMotion: () => options.reduced, onTap, onPress, onRelease });
  const send = (type, x = 100, y = 100, timeStamp = 0, extra = {}) => swipe.handlers[type]({
    pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y,
    timeStamp, target: capture, stopPropagation: vi.fn(), ...extra,
  });
  return { swipe, send, onTap, onPress, onRelease, capture, camera, options };
}

describe('menu cube touch gestures', () => {
  it.each([[100, 0, 'x', 1], [-100, 0, 'x', -1], [0, -100, 'y', 1], [0, 100, 'y', -1]])(
    'follows a swipe of %s,%s in screen coordinates and coasts the same way', (dx, dy, component, sign) => {
      const camera = new PerspectiveCamera(); camera.position.set(0, 3, 12); camera.lookAt(0, 0, 0);
      const { swipe, send, onTap, capture } = setup({ camera });
      // A point on the near side must move in the finger's screen direction,
      // even with the menu's elevated camera rather than identity axes.
      const near = new Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
      const screen = () => near.clone().applyQuaternion(swipe.offset).applyQuaternion(camera.quaternion.clone().invert());
      send('onPointerDown'); send('onPointerMove', 100 + dx, 100 + dy, 100);
      const dragged = screen()[component] * sign;
      expect(dragged).toBeGreaterThan(.5);
      send('onPointerUp', 100 + dx, 100 + dy, 110);
      swipe.step(1 / 60);
      expect(screen()[component] * sign).toBeGreaterThan(dragged);
      send('onClick', 100 + dx, 100 + dy, 111);
      expect(onTap).not.toHaveBeenCalled();
      expect(capture.releasePointerCapture).toHaveBeenCalledWith(1);
      for (let i = 0; i < 240; i++) swipe.step(1 / 60);
      expect(swipe.active).toBe(false);
      expect(swipe.offset.length()).toBeCloseTo(1, 10);
    }
  );

  it('keeps a slightly jittery tap as one shake/flip, including its compatibility click', () => {
    const { send, onTap, swipe } = setup();
    send('onPointerDown'); send('onPointerMove', 103, 102, 30);
    send('onPointerUp', 102, 103, 80); send('onClick', 102, 103, 81);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(swipe.offset.angleTo(new Quaternion())).toBe(0);
    expect(swipe.active).toBe(false);
  });

  it('never flips after an out-and-back swipe or a fast release-only swipe', () => {
    const { send, onTap } = setup();
    send('onPointerDown'); send('onPointerMove', 200, 100, 60);
    send('onPointerMove', 100, 100, 120); send('onPointerUp', 100, 100, 130); send('onClick');
    expect(onTap).not.toHaveBeenCalled();
    send('onPointerDown', 100, 100, 200); send('onPointerUp', 200, 100, 230); send('onClick');
    expect(onTap).not.toHaveBeenCalled();
    send('onPointerDown', 100, 100, 300); send('onPointerUp', 100, 100, 330);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('holds capture off the cube and ignores unrelated pointer releases', () => {
    const { send, swipe, onTap, capture } = setup();
    send('onPointerDown'); send('onPointerMove', 180, 100, 50); send('onPointerLeave');
    send('onPointerUp', 180, 100, 55, { pointerId: 2 });
    expect(swipe.active).toBe(true);
    expect(capture.releasePointerCapture).not.toHaveBeenCalled();
    send('onPointerUp', 400, 100, 80);
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(onTap).not.toHaveBeenCalled();
  });

  it.each(['onPointerCancel', 'onLostPointerCapture'])('cancels %s without flipping or coasting', type => {
    const { send, swipe, onTap } = setup();
    send('onPointerDown'); send('onPointerMove', 180, 100, 50); send(type);
    const stopped = swipe.offset.clone(); swipe.step(.05); send('onClick');
    expect(swipe.offset.equals(stopped)).toBe(true);
    expect(swipe.active).toBe(false);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('cancels a second finger and a newly opened mode selector without triggering a tap', () => {
    const { send, swipe, options, onTap } = setup();
    send('onPointerDown'); send('onPointerDown', 130, 100, 20, { pointerId: 2, isPrimary: false });
    send('onPointerUp'); send('onClick');
    expect(onTap).not.toHaveBeenCalled();
    expect(swipe.active).toBe(false);
    send('onPointerDown'); options.allowed = false; send('onPointerMove', 200, 100, 50);
    send('onPointerUp'); send('onClick');
    expect(swipe.active).toBe(false);
    expect(onTap).not.toHaveBeenCalled();
  });

  it.each([true, false])('stops after release with reduced motion=%s or a deliberate hold', reduced => {
    const { send, swipe } = setup({ reduced });
    send('onPointerDown'); send('onPointerMove', 180, 100, 50);
    send('onPointerUp', 180, 100, reduced ? 60 : 300);
    const pose = swipe.offset.clone(); swipe.step(.05);
    expect(swipe.offset.equals(pose)).toBe(true);
    expect(swipe.active).toBe(false);
  });

  it('keeps desktop clicks working after touch and never treats a mouse drag as a mobile swipe', () => {
    const { send, swipe, onTap } = setup();
    send('onPointerDown'); send('onPointerUp'); send('onClick');
    send('onPointerDown', 100, 100, 100, { pointerType: 'mouse' });
    send('onPointerMove', 200, 100, 130, { pointerType: 'mouse' });
    send('onPointerUp', 200, 100, 150, { pointerType: 'mouse' }); send('onClick');
    expect(onTap).toHaveBeenCalledTimes(2);
    expect(swipe.offset.angleTo(new Quaternion())).toBe(0);
  });

  it('keeps the released pose and consistent momentum across frame rates', () => {
    const frames = [30, 60].map(hz => {
      const { send, swipe } = setup();
      send('onPointerDown'); send('onPointerMove', 190, 60, 100); send('onPointerUp', 190, 60, 110);
      for (let i = 0; i < hz; i++) swipe.step(1 / hz);
      return swipe;
    });
    expect(frames[0].offset.angleTo(frames[1].offset)).toBeLessThan(1e-7);
    for (const swipe of frames) {
      for (let i = 0; i < 180; i++) swipe.step(1 / 60);
      const settled = swipe.offset.clone();
      swipe.step(.05);
      expect(swipe.offset.equals(settled)).toBe(true);
      expect(settled.angleTo(new Quaternion())).toBeGreaterThan(.5);
    }
  });

  it('cleans up native cancellations and a second finger outside the R3F mesh', () => {
    const { send, swipe, onTap } = setup();
    const canvas = document.createElement('canvas');
    const event = (type, pointerId) => Object.assign(new Event(type), { pointerId, pointerType: 'touch' });
    const nativeEvent = { target: canvas };
    send('onPointerDown', 100, 100, 0, { nativeEvent });
    canvas.dispatchEvent(event('pointercancel', 1));
    send('onClick');
    expect(swipe.active).toBe(false);
    expect(onTap).not.toHaveBeenCalled();
    send('onPointerDown', 100, 100, 100, { nativeEvent });
    window.dispatchEvent(event('pointerdown', 2));
    expect(swipe.active).toBe(false);
    send('onPointerUp'); send('onClick');
    expect(onTap).not.toHaveBeenCalled();
    send('onPointerDown', 100, 100, 200, { nativeEvent });
    send('onPointerUp', 100, 100, 250);
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
