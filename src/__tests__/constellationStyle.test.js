import { describe, expect, it } from 'vitest';
import { CONSTELLATION_SURFACE, constellationFragmentShader } from '../3d/styles/shaders/constellationShader.js';
import { newStyleShaders } from '../3d/styles/shaders/newStyleShaders.js';
import { getTileStyleMaterial, sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';
import { instancedTileStyleMaterial } from '../3d/styles/instancedTileStyle.js';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
import { storyLevel } from '../worm/story/levels.js';
import { STORY_WORLDS } from '../worm/story/worlds.js';

// Analytic design checks only: the real shader/draw test and screenshot live in
// megaStorm.e2e.js. These masks mirror the GLSL generated from the same controls.
const smoothstep = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
const accentAt = (u, v) => {
  const s = CONSTELLATION_SURFACE;
  const edge = Math.min(u, 1 - u, v, 1 - v);
  const inset = smoothstep(s.frameWidth - s.frameFeather, s.frameWidth + s.frameFeather, edge);
  const center = 1 - smoothstep(s.centerRadius - s.centerFeather, s.centerRadius + s.centerFeather, Math.hypot(u - 0.5, v - 0.5));
  return inset * (s.auroraMix * (1 - center) + s.centerMix * center);
};

describe('Mega Storm constellation surface', () => {
  it('keeps the authored 15×15 deck, Aurora palette and constellation identity', () => {
    expect(storyLevel(106)).toMatchObject({ title: 'Mega Storm', cubeSize: 15 });
    expect(STORY_WORLDS[106]).toMatchObject({ palette: 'aurora', background: 'snow' });
    expect(Object.values(STORY_WORLDS[106].styles)).toEqual(Array(6).fill('constellation'));
    expect(newStyleShaders.constellation).toBe(constellationFragmentShader);
  });

  it('covers most of the tile with bold cyan/violet rather than near-invisible edge tint', () => {
    const { colorFloor, colorLift, auroraMix, centerMix, cyan, violet, starGrid } = CONSTELLATION_SURFACE;
    const samples = [];
    for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) samples.push(accentAt((x + 0.5) / 64, (y + 0.5) / 64));
    expect(samples.filter(mix => mix >= 0.6).length / samples.length).toBeGreaterThan(0.5);
    expect(Math.hypot(...cyan.map((value, i) => value - violet[i]))).toBeGreaterThan(0.7);
    expect(auroraMix).toBeGreaterThanOrEqual(0.75);
    expect(colorFloor + colorLift).toBeLessThanOrEqual(0.8);
    expect(starGrid).toBe(2);
    expect(constellationFragmentShader).toContain(`baseColor * (${colorFloor.toFixed(2)} + ${colorLift.toFixed(2)} * curtain)`);
    expect(constellationFragmentShader).toContain(`inset * mix(${auroraMix.toFixed(2)}, ${centerMix.toFixed(2)}, center)`);
    for (const color of [cyan, violet]) expect(constellationFragmentShader).toContain(`vec3(${color.map(value => value.toFixed(2)).join(', ')})`);
    expect(constellationFragmentShader).toContain('fwidth(dist)');
    expect(constellationFragmentShader).toContain('fwidth(distanceToLine)');
  });

  it('leaves an unmarked face-color frame and a calm face-dominant center', () => {
    const s = CONSTELLATION_SURFACE;
    expect(s.colorFloor).toBeGreaterThanOrEqual(0.5);
    expect(s.frameWidth - s.frameFeather).toBeGreaterThanOrEqual(0.05);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      for (const [u, v] of [[0.02, t], [0.98, t], [t, 0.02], [t, 0.98]]) expect(accentAt(u, v)).toBe(0);
    }
    expect(accentAt(0.5, 0.5)).toBeLessThanOrEqual(0.25);
    expect(constellationFragmentShader).toContain(`smoothstep(${(s.frameWidth - s.frameFeather).toFixed(2)}, ${(s.frameWidth + s.frameFeather).toFixed(2)}, edgeDistance)`);
    expect(constellationFragmentShader).toContain(`smoothstep(${(s.centerRadius - s.centerFeather).toFixed(2)}, ${(s.centerRadius + s.centerFeather).toFixed(2)}, length(vUv - 0.5))`);
    expect(constellationFragmentShader).toContain('float chart = inset * (1.0 - center * 0.8);');
  });

  it('quantizes physical identity before hashing so perspective interpolation cannot create glitter', () => {
    expect(constellationFragmentShader).toContain('vec3 home = floor(tileHome + 0.5);');
    expect(constellationFragmentShader).toContain('float face = floor(tileFace + 0.5);');
    expect(constellationFragmentShader).toContain('vec2 seed = home.xy * 1.37 + vec2(home.z * 3.11, face * 7.13);');
    expect(constellationFragmentShader.match(/\btileHome\b/g)).toHaveLength(2);
    expect(constellationFragmentShader.match(/\btileFace\b/g)).toHaveLength(2);
    // Integer physical positions and face IDs are stable at both extremes of a
    // mega deck, even with more interpolation error than a fragment should see.
    for (let id = 0; id < 15; id++) {
      for (const noise of [-0.001, -0.00001, 0, 0.00001, 0.001]) expect(Math.floor(id + noise + 0.5)).toBe(id);
    }
  });

  it('shares six opaque materials across the mega board and retains instanced identity', () => {
    const materials = new Set();
    for (let face = 1; face <= 6; face++) {
      for (let tile = 0; tile < 225; tile++) {
        const material = getTileStyleMaterial('constellation', COLOR_SCHEMES.aurora[face]);
        materials.add(material);
        expect(material.transparent).toBe(false);
        expect(material.depthWrite).toBe(true);
      }
    }
    expect(materials.size).toBe(6);
    for (const source of materials) {
      const batch = instancedTileStyleMaterial(source);
      expect(batch.uniforms.baseColor).toBe(source.uniforms.baseColor);
      expect(batch.fragmentShader).toContain('floor(vTileIdentity.xyz + 0.5)');
      expect(batch.fragmentShader).toContain('floor(vTileIdentity.w + 0.5)');
      expect(batch.fragmentShader).not.toMatch(/\btileHome\b|\btileFace\b/);
      expect(batch.uniforms.time).toBe(sharedUniforms.time);
      expect(batch.uniforms.reducedMotion).toBe(sharedUniforms.reducedMotion);
    }
  });

  it('freezes aurora drift with reduced motion and keeps the sparse star chart static', () => {
    expect(constellationFragmentShader).toContain('float t = time * (1.0 - step(0.5, reducedMotion));');
    expect(constellationFragmentShader.match(/\btime\b/g)).toHaveLength(2);
    expect(constellationFragmentShader).not.toMatch(/sampler2D|texture2D|discard/);
    const starChart = constellationFragmentShader.slice(constellationFragmentShader.indexOf('vec2 uv'), constellationFragmentShader.indexOf('float curtain'));
    expect(starChart).not.toMatch(/\bt\b|\btwinkle\b/);
    expect(constellationFragmentShader).toContain('abs(dx) + abs(dy) > 1.5');
  });
});
