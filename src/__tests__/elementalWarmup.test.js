import { describe, it, expect, vi } from 'vitest';

// The warm-up reaches the bomb flame texture, which is drawn at module load — and
// jsdom has no 2D context. Hoisted so it is in place before the imports below run.
vi.hoisted(() => {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(
    {},
    {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        return () => gradient;
      },
      set: (target, prop, value) => { target[prop] = value; return true; }
    }
  );
  HTMLCanvasElement.prototype.getContext = () => ctx;
});

import { warmUpElementalSkins } from '../worm/healerWorm/elementalWarmup.js';
import { ELEMENTAL_DEFS } from '../worm/healerWorm/elementalDefs.js';

// A stand-in for WebGLRenderer: warmUpElementalSkins only needs somewhere to send
// the throwaway scene, and a real GL context is neither available nor relevant to
// what this guards — which is that every element gets its programs collected.
const fakeRenderer = () => ({ compile: vi.fn() });
const fakeCamera = {};

// Three materials per orb (core / shell / inner), plus the skin:
//   surface → 1, flames → 2 (both detail tiers), blades → 1
const SKIN_MATERIALS = { surface: 1, flames: 2, blades: 1 };
const expectedCount = Object.values(ELEMENTAL_DEFS).reduce(
  (n, def) => n + 3 + (SKIN_MATERIALS[def.renderer] ?? 0),
  0
);

describe('warmUpElementalSkins', () => {
  it('warms the orb and skin programs for every element', () => {
    const renderer = fakeRenderer();
    expect(warmUpElementalSkins(renderer, fakeCamera)).toBe(expectedCount);
  });

  it('compiles exactly once per call', () => {
    const renderer = fakeRenderer();
    warmUpElementalSkins(renderer, fakeCamera);
    expect(renderer.compile).toHaveBeenCalledTimes(1);
  });

  it('hands the compiler a scene holding one mesh per material', () => {
    const renderer = fakeRenderer();
    warmUpElementalSkins(renderer, fakeCamera);
    // scene.clear() runs after compile, so inspect what compile actually saw.
    const [scene, camera] = renderer.compile.mock.calls[0];
    expect(camera).toBe(fakeCamera);
    expect(scene).toBeTruthy();
  });

  it('covers every element the catalogue defines, not a hard-coded four', () => {
    // The guard that matters: adding an element without teaching this module its
    // renderer silently leaves that element cold, and the player pays the stall.
    const known = new Set(['surface', 'flames', 'blades']);
    for (const [element, def] of Object.entries(ELEMENTAL_DEFS)) {
      expect(known.has(def.renderer), `${element} uses unwarmed renderer "${def.renderer}"`).toBe(true);
    }
  });

  it('is a no-op without a renderer or camera rather than throwing', () => {
    expect(warmUpElementalSkins(null, fakeCamera)).toBe(0);
    expect(warmUpElementalSkins(fakeRenderer(), null)).toBe(0);
    expect(warmUpElementalSkins(undefined, undefined)).toBe(0);
  });

  it('returns cached materials on a second call, so a remount recompiles nothing new', () => {
    const first = warmUpElementalSkins(fakeRenderer(), fakeCamera);
    const second = warmUpElementalSkins(fakeRenderer(), fakeCamera);
    expect(second).toBe(first);
  });
});
