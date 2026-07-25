import { describe, it, expect } from 'vitest';
import { basicShaders } from '../3d/styles/shaders/basicShaders.js';
import { techShaders } from '../3d/styles/shaders/techShaders.js';
import { natureShaders } from '../3d/styles/shaders/natureShaders.js';
import { opArtShaders } from '../3d/styles/shaders/opArtShaders.js';
import { antipodalShaders } from '../3d/styles/shaders/antipodalShaders.js';
import { craftShaders } from '../3d/styles/shaders/craftShaders.js';

const modules = [
  ['basicShaders', basicShaders],
  ['techShaders', techShaders],
  ['natureShaders', natureShaders],
  ['opArtShaders', opArtShaders],
  ['antipodalShaders', antipodalShaders],
  ['craftShaders', craftShaders],
];

describe('shader modules', () => {
  it('every key exports a non-empty GLSL string with a main()', () => {
    for (const [name, mod] of modules) {
      expect(Object.keys(mod).length).toBeGreaterThan(0);
      for (const [key, shader] of Object.entries(mod)) {
        expect(typeof shader, `${name}.${key}`).toBe('string');
        expect(shader.trim().length, `${name}.${key} is empty`).toBeGreaterThan(0);
        expect(shader, `${name}.${key} missing void main()`).toContain('void main()');
      }
    }
  });

  it('has no duplicate keys across modules', () => {
    const seen = new Map();
    for (const [name, mod] of modules) {
      for (const key of Object.keys(mod)) {
        expect(seen.has(key), `"${key}" in ${name} collides with ${seen.get(key)}`).toBe(false);
        seen.set(key, name);
      }
    }
  });

  it('checkerboard alternates tiles via floor-parity (not a grout grid)', () => {
    // Must use mod(floor(...) + floor(...), 2.0) pattern for true alternation
    expect(antipodalShaders.checkerboard).toContain('mod(floor(');
  });

  it('neural shader has no dead closestCell variable', () => {
    expect(techShaders.neural).not.toContain('closestCell');
  });

  it('solid shader does not declare unused vUv varying', () => {
    expect(basicShaders.solid).not.toContain('varying vec2 vUv');
  });

  it('glossy shader does not declare unused vUv varying', () => {
    expect(basicShaders.glossy).not.toContain('varying vec2 vUv');
  });

  it('matte shader does not declare unused vUv varying', () => {
    expect(basicShaders.matte).not.toContain('varying vec2 vUv');
  });

  it('all antipodal shaders declare both baseColor and antipodalColor uniforms', () => {
    for (const [key, shader] of Object.entries(antipodalShaders)) {
      expect(shader, `${key} missing baseColor uniform`).toContain('uniform vec3 baseColor');
      expect(shader, `${key} missing antipodalColor uniform`).toContain('uniform vec3 antipodalColor');
    }
  });
});
