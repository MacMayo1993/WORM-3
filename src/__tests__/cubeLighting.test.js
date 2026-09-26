import { describe, it, expect } from 'vitest';
import { CUBE_LIGHT_RIG, usesCubeLightRig, needsCubeReflections } from '../3d/cubeLighting.js';

describe('cube lighting', () => {
  it('lights the cube with a key brighter than its fill, from in front', () => {
    expect(CUBE_LIGHT_RIG.key.intensity).toBeGreaterThan(CUBE_LIGHT_RIG.fill.intensity);
    expect(CUBE_LIGHT_RIG.key.position[2]).toBeGreaterThan(0);
    // The rim comes from behind to pick out the silhouette.
    expect(CUBE_LIGHT_RIG.rim.position[2]).toBeLessThan(0);
  });

  it('gives every look the shared rig except wireframe and glass', () => {
    for (const mode of ['classic', 'grid', 'sudokube', 'gap', 'chrome', 'neon', 'lego']) expect(usesCubeLightRig(mode)).toBe(true);
    expect(usesCubeLightRig('wireframe')).toBe(false);
    expect(usesCubeLightRig('glass')).toBe(false);
  });

  it('adds reflections only where no photo panorama supplies them', () => {
    // Free play: space scenes need them, photo scenes bring their own.
    expect(needsCubeReflections({})).toBe(true);
    expect(needsCubeReflections({ backgroundFile: 'paris.hdr' })).toBe(false);
    expect(needsCubeReflections({ photoPreset: true })).toBe(false);
    // Levels: only a chapter cast to a panorama has its own.
    expect(needsCubeReflections({ inLevel: true })).toBe(true);
    expect(needsCubeReflections({ inLevel: true, storyEnvFile: 'forest.hdr' })).toBe(false);
  });
});
