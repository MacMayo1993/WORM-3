import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WORM_FACE_PROFILES, animateWormFace, wormBlink } from '../worm/wormFaceExpression.js';
import { layoutWormFace } from '../worm/wormFaceLayout.js';
import { finishWormEyes } from '../worm/wormCharacterFinish.js';

function rig() {
  const geometry = new THREE.SphereGeometry(1, 8, 6);
  const material = new THREE.MeshBasicMaterial();
  const parts = { eyes: [0, 1].map(() => new THREE.Mesh(geometry, material)),
    pupils: [0, 1].map(() => new THREE.Mesh(geometry, material)), mouth: new THREE.Mesh(geometry, material) };
  return { parts, dispose() { geometry.dispose(); material.dispose(); } };
}
const center = new THREE.Vector3(), forward = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0);
function pose(parts, character, time, options) {
  layoutWormFace(center, forward, up, 0.092, parts);
  animateWormFace(parts, character, time, options);
  return [...parts.eyes, ...parts.pupils, parts.mouth].flatMap(part => [...part.position.toArray(), ...part.scale.toArray()]);
}

describe('shared worm expressions', () => {
  it('briefly closes then opens smoothly without staying squashed', () => {
    const middle = 4.7 * 0.72;
    expect(wormBlink(0)).toBe(1);
    expect(wormBlink(middle)).toBeCloseTo(0.08);
    expect(wormBlink(middle - 0.06)).toBeCloseTo(wormBlink(middle + 0.06));
    expect(wormBlink(middle + 0.2)).toBe(1);
  });

  for (const character of Object.keys(WORM_FACE_PROFILES)) {
    it(`${character} holds a paused pose, recovers from pickup and stays still with reduced motion`, () => {
      const { parts, dispose } = rig();
      const neutral = pose(parts, character, 1.5);
      const excited = pose(parts, character, 1.5, { pulse: 1 });
      expect(excited).not.toEqual(neutral);
      expect(pose(parts, character, 1.5, { pulse: 1 })).toEqual(excited);
      expect(pose(parts, character, 1.5)).toEqual(neutral);
      expect(pose(parts, character, 10, { reducedMotion: true, pulse: 1, transit: true }))
        .toEqual(pose(parts, character, 0, { reducedMotion: true }));
      dispose();
    });
  }

  it('switching characters removes old details and releases all owned resources', () => {
    const { parts, dispose } = rig();
    const original = parts.mouth.geometry;
    for (const character of Object.keys(WORM_FACE_PROFILES)) {
      const cleanup = finishWormEyes(parts.eyes, parts.pupils, character, parts.mouth);
      const resources = new Set();
      for (const part of [...parts.eyes, ...parts.pupils, parts.mouth]) {
        part.traverse(child => {
          if (child.geometry && child.geometry !== original) resources.add(child.geometry);
          if (child.material && child.material !== part.material) resources.add(child.material);
        });
      }
      const disposed = new Set();
      resources.forEach(resource => resource.addEventListener('dispose', () => disposed.add(resource)));
      cleanup();
      expect(disposed.size).toBe(resources.size);
      expect(parts.mouth.geometry).toBe(original);
      expect(parts.eyes.every(eye => !eye.userData.wormBrow && eye.children.length === 0)).toBe(true);
      expect(parts.pupils.every(pupil => pupil.children.length === 0)).toBe(true);
    }
    dispose();
  });
});
