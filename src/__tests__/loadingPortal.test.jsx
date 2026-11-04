import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoadingPortal from '../components/screens/LoadingPortal.jsx';
import { introPaperTintInto } from '../components/intro/introPaper.js';
import { FALL } from '../components/screens/loadingWormhole.js';
import { RUBIKS_FACE_COLORS } from '../utils/constants.js';

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('../utils/device.js', () => ({ prefersReducedMotion: () => motion.reduced }));

// Record painted rim segments on each actual canvas, so depth ordering and
// first-frame mouth geometry are checked without relying on CSS source strings.
function context() {
  let path = [];
  const fills = [];
  const noop = () => {};
  const gradients = [];
  const gradient = () => {
    const stops = [];
    gradients.push(stops);
    return { addColorStop: (...stop) => stops.push(stop) };
  };
  const ctx = {
    fills, gradients,
    beginPath: () => { path = []; },
    ellipse: (...args) => path.push(args),
    fill: () => fills.push({ style: ctx.fillStyle, path: [...path] }),
    save: noop, restore: noop, translate: noop, scale: vi.fn(), rotate: noop,
    setTransform: noop, clearRect: noop, fillRect: noop, rect: noop, roundRect: noop,
    clip: noop, moveTo: noop, lineTo: noop, closePath: noop, stroke: noop, arc: noop,
    createRadialGradient: gradient, createLinearGradient: gradient
  };
  return ctx;
}

let host, root, contexts, raf, animation, topMeasure, wellMeasure;
const bounds = (left, top, width, height) => ({ left, top, width, height });
const ref = current => ({ current });
const rimFills = ctx => ctx.fills.filter(fill => Object.values(RUBIKS_FACE_COLORS).includes(fill.style));

beforeEach(() => {
  motion.reduced = false;
  vi.spyOn(performance, 'now').mockReturnValue(0);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  contexts = new Map();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!contexts.has(this)) contexts.set(this, context());
    return contexts.get(this);
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(bounds(0, 0, 400, 800));
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { raf = callback; return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  animation = { animationName: 'wl-fall', currentTime: 0 };
  topMeasure = vi.fn(() => bounds(100, 200, 200, 72));
  wellMeasure = vi.fn(() => bounds(100, 480, 200, 72));
  act(() => root.render(
    <LoadingPortal
      sceneRef={ref(document.createElement('div'))}
      fallRef={ref({ getAnimations: () => [animation], offsetHeight: 80 })}
      topRef={ref({ getBoundingClientRect: topMeasure })}
      wellRef={ref({ getBoundingClientRect: wellMeasure })}
    />
  ));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe('loading portal drawing', () => {
  it('opens at the shaft size on its very first frame, with the exit rim behind the cube', () => {
    act(() => raf(0));
    const canvases = host.querySelectorAll('canvas');
    const back = rimFills(contexts.get(canvases[1]));
    const front = rimFills(contexts.get(canvases[2]));
    // Both halves of the exit + the far half of the entrance are behind the cube.
    expect(back).toHaveLength(36);
    expect(back.filter(fill => fill.path[0][1] === 236)).toHaveLength(24);
    // Only the entrance's near lip can occlude it.
    expect(front).toHaveLength(12);
    expect(front.every(fill => fill.path[0][1] === 516)).toBe(true);
    // No spring from zero width that disagrees with the fixed CSS shaft clip.
    expect(back.every(fill => fill.path[0][2] === 104.5)).toBe(true);
    // The exit edge and emission clip coincide, without a low-hanging wall.
    expect(back.filter(fill => fill.path[0][1] === 236).every(fill => fill.path[0][3] === 80 * FALL.cut * 1.045)).toBe(true);
    expect(contexts.get(canvases[1]).scale).toHaveBeenCalledWith(1, -1);
    expect([...canvases].every(canvas => canvas.classList.contains('wl-ready'))).toBe(true);
  });

  it('paints all six opening hues using real time, independent of dive speed', () => {
    const paper = contexts.get(host.querySelector('canvas'));
    const tint = {};
    for (const seconds of [0, 1.625, 2, 4, 6, 8, 10, 12]) {
      paper.gradients.length = 0;
      animation.currentTime = seconds * 7000; // hold-to-dive must not accelerate colors
      act(() => raf(seconds * 1000));
      introPaperTintInto(tint, seconds);
      const expected = [tint.r, tint.g, tint.b].map(v => Math.round((v + (1 - v) * 0.4) * 255));
      expect(paper.gradients[0][0]).toEqual([0, `rgba(${expected.join(',')},1)`]);
    }
  });

  it('rests on white paper without scheduling an animation frame for reduced motion', () => {
    motion.reduced = true;
    requestAnimationFrame.mockClear();
    const paper = contexts.get(host.querySelector('canvas'));
    paper.gradients.length = 0;
    act(() => root.render(<LoadingPortal />));
    const tint = introPaperTintInto({}, 0, true);
    const expected = [tint.r, tint.g, tint.b].map(v => Math.round((v + (1 - v) * 0.4) * 255));
    expect(paper.gradients[0][0]).toEqual([0, `rgba(${expected.join(',')},1)`]);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('does not force layout reads or redraw the paper on every startup frame', () => {
    act(() => raf(0));
    topMeasure.mockClear();
    wellMeasure.mockClear();
    const paper = contexts.get(host.querySelector('canvas'));
    const clear = vi.spyOn(paper, 'clearRect');
    animation.currentTime = 16;
    act(() => raf(16));
    animation.currentTime = 32;
    act(() => raf(32));
    expect(topMeasure).not.toHaveBeenCalled();
    expect(wellMeasure).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    animation.currentTime = 48;
    act(() => raf(48));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('remeasures the mouths on resize and cancels its frame on unmount', () => {
    topMeasure.mockReturnValue(bounds(100, 220, 200, 72));
    act(() => window.dispatchEvent(new Event('resize')));
    act(() => raf(0));
    const back = rimFills(contexts.get(host.querySelectorAll('canvas')[1]));
    expect(back.filter(fill => fill.path[0][1] === 256)).toHaveLength(24);
    act(() => root.unmount());
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    root = createRoot(host);
  });
});
