import { it, expect } from 'vitest';
import { ELEMENTAL_FOCUS_DURATION } from '../worm/healerWorm/constants.js';
import { ELEMENTAL_EXPERIENCE, elementalBodyWave } from '../worm/healerWorm/elementalExperience.js';
import { elementalEnvelope } from '../worm/healerWorm/elementalLifecycle.js';
import { makeElementalParticleMaterial } from '../worm/healerWorm/elementalParticleMaterial.js';

it('finishes every reveal during the camera orbit and fades before expiration', () => {
  for (const element of Object.keys(ELEMENTAL_EXPERIENCE)) {
    expect(elementalEnvelope({ element, elapsed: ELEMENTAL_FOCUS_DURATION, remaining: 15 }).claim).toBe(1);
    expect(elementalEnvelope({ element, elapsed: 8, remaining: 0 }).intensity).toBe(0);
    expect(elementalEnvelope({ element, elapsed: 8, remaining: 0.5 }).phase).toBe('release');
    expect(elementalEnvelope({ element, elapsed: 8, remaining: 0.5 }).accents).toBe(false);
  }
});
it('keeps body feedback finite and bounded for every element and tail length', () => {
  for (const element of Object.keys(ELEMENTAL_EXPERIENCE)) for (const count of [1, 20, 1000]) {
    for (let i = 0; i < count; i++) {
      const wave = elementalBodyWave(element, 7.3, i, count);
      expect(wave).toBeGreaterThanOrEqual(0);
      expect(wave).toBeLessThanOrEqual(1);
    }
  }
  expect(elementalBodyWave(null, 0, 0, 1)).toBe(0);
});
it('gives each ambient particle a distinct silhouette without obscuring geometry behind it', () => {
  const modes = new Set();
  for (const kind of ['bubbles', 'embers', 'spores', 'flakes']) {
    const material = makeElementalParticleMaterial(kind, '#ffffff', 0.1);
    modes.add(material.uniforms.uKind.value);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.uniforms.uOpacity.value).toBe(0);
    material.dispose();
  }
  expect(modes.size).toBe(4);
});
