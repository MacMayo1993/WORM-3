import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWormShadow, wormShadowFade, WORM_SHADOW_REACH } from '../worm/healerWorm/wormShadow.js';
import { createBodySurface, updateBodySurface, bodySurfaceDrop } from '../worm/healerWorm/bodySurface.js';

const up = new THREE.Vector3(0, 1, 0);
const camera = { quaternion: new THREE.Quaternion() };
const surfaceOf = size => updateBodySurface(createBodySurface(), size, { active: false });

describe('the played worm\'s contact shadow', () => {
  it('finds the cube under a bead, and nothing past its edge', () => {
    const surface = surfaceOf(3); // a 3x3 reaches 1.5 from its centre
    expect(bodySurfaceDrop(new THREE.Vector3(0, 1.6, 0), up, surface)).toBeCloseTo(0.1, 6);
    expect(bodySurfaceDrop(new THREE.Vector3(0.9, 2.5, -0.4), up, surface)).toBeCloseTo(1, 6);
    expect(bodySurfaceDrop(new THREE.Vector3(0, 1.2, 0), up, surface)).toBe(0);
    expect(bodySurfaceDrop(new THREE.Vector3(1.8, 1.6, 0), up, surface)).toBe(Infinity);
  });

  it('lies on the tile while the bead leaves it, and fades with height', () => {
    const surface = surfaceOf(3), shadow = createWormShadow(), matrix = new THREE.Matrix4(), at = new THREE.Vector3();
    const heightOf = y => {
      const bead = new THREE.Vector3(0, y, 0);
      shadow.begin(camera);
      shadow.add(bead, up, 0.105, bodySurfaceDrop(bead, up, surface));
      shadow.end();
      if (!shadow.mesh.count) return null;
      shadow.mesh.getMatrixAt(0, matrix);
      return at.setFromMatrixPosition(matrix).y;
    };
    const resting = heightOf(1.6), jumping = heightOf(2.1);
    // On the cube's face, above the sticker and under the bead, at any bead height.
    expect(resting).toBeGreaterThan(1.51);
    expect(resting).toBeLessThan(1.55);
    expect(jumping).toBeCloseTo(resting, 6);
    expect(shadow.mesh.visible).toBe(true);
    expect(wormShadowFade(0)).toBe(1);
    expect(wormShadowFade(0.5)).toBeLessThan(wormShadowFade(0.1));
    expect(wormShadowFade(WORM_SHADOW_REACH)).toBe(0);
    shadow.dispose();
  });

  it('draws nothing, and costs no program selection, with no bead over the cube', () => {
    const shadow = createWormShadow();
    shadow.begin(camera);
    shadow.add(new THREE.Vector3(3, 1.6, 0), up, 0.105, Infinity); // past the edge
    shadow.add(new THREE.Vector3(0, 4, 0), up, 0.105, 2.5); // far too high
    shadow.end();
    expect(shadow.mesh.count).toBe(0);
    expect(shadow.mesh.visible).toBe(false);
    shadow.dispose();
  });
});
