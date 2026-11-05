import { describe, expect, it } from 'vitest';
import { CONSTELLATION_SURFACE, constellationFragmentShader } from '../3d/styles/shaders/constellationShader.js';
import { newStyleShaders } from '../3d/styles/shaders/newStyleShaders.js';
import { getTileStyleMaterial, sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';
import { instancedTileStyleMaterial } from '../3d/styles/instancedTileStyle.js';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
import { storyLevel } from '../worm/story/levels.js';
import { STORY_WORLDS } from '../worm/story/worlds.js';

describe('Mega Storm constellation surface', () => {
  it('keeps the authored 15×15 deck, Aurora palette and constellation identity', () => {
    expect(storyLevel(106)).toMatchObject({ title: 'Mega Storm', cubeSize: 15 });
    expect(STORY_WORLDS[106]).toMatchObject({ palette: 'aurora', background: 'snow' });
    expect(Object.values(STORY_WORLDS[106].styles)).toEqual(Array(6).fill('constellation'));
    expect(newStyleShaders.constellation).toBe(constellationFragmentShader);
  });

  it('retains substantial face color even under the strongest aurora accent', () => {
    // A design guard, not a rendered-image test. The old 0.11 base made the six
    // faces converge on black. These exact parameters generate the GLSL field.
    const { colorFloor, colorLift, auroraMix, starGrid } = CONSTELLATION_SURFACE;
    expect(colorFloor * (1 - auroraMix)).toBeGreaterThanOrEqual(0.4);
    expect(colorFloor + colorLift).toBeLessThanOrEqual(0.8);
    expect(auroraMix).toBeLessThanOrEqual(0.2);
    expect(starGrid).toBe(3);
    expect(constellationFragmentShader).toContain(`baseColor * (${colorFloor.toFixed(2)} + ${colorLift.toFixed(2)} * curtain)`);
    expect(constellationFragmentShader).toContain(`mix(field, aurora, ${auroraMix.toFixed(2)} * edge * curtain)`);
    expect(constellationFragmentShader).toContain('fwidth(dist)');
    expect(constellationFragmentShader).toContain('fwidth(distanceToLine)');
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
      expect(batch.fragmentShader).toContain('vTileIdentity.xyz.xy * 1.37');
      expect(batch.fragmentShader).not.toMatch(/\btileHome\b|\btileFace\b/);
      expect(batch.uniforms.time).toBe(sharedUniforms.time);
      expect(batch.uniforms.reducedMotion).toBe(sharedUniforms.reducedMotion);
    }
  });

  it('freezes both aurora drift and twinkle with reduced motion without adding textures', () => {
    expect(constellationFragmentShader).toContain('float t = time * (1.0 - step(0.5, reducedMotion));');
    expect(constellationFragmentShader.match(/\btime\b/g)).toHaveLength(2);
    expect(constellationFragmentShader).not.toMatch(/sampler2D|texture2D|discard/);
    expect(constellationFragmentShader).toContain('0.92 + 0.08 * sin(t * 0.7');
    expect(constellationFragmentShader).toContain('abs(dx) + abs(dy) > 1.5');
  });
});
