import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { STICKER_OFFSET, createCubieGeometry, createStickerGeometry, rubiksFinish } from '../3d/rubiksPiece.js';

// The opening's cube and the main menu cube are built from these parts, so a
// change here changes both — and neither should drift from the other again.
describe('rubiks pieces', () => {
  const size = (geometry) => {
    geometry.computeBoundingBox();
    return geometry.boundingBox.getSize(new THREE.Vector3());
  };

  it('makes a cubie just under one unit, leaving a seam to its neighbours', () => {
    const s = size(createCubieGeometry());
    for (const axis of ['x', 'y', 'z']) expect(s[axis]).toBeCloseTo(0.96, 5);
  });

  it('makes a thin sticker that sits proud of its cubie without touching the next one', () => {
    const s = size(createStickerGeometry());
    expect(s.x).toBeGreaterThan(0.84);
    expect(s.x).toBeLessThan(0.9);
    expect(s.z).toBeLessThan(0.06);
    // The sticker's back face clears the rounded cubie it is glued to.
    expect(STICKER_OFFSET - s.z / 2).toBeGreaterThan(0.48);
  });

  it('gives the stickers a full clearcoat and the plastic a light one', () => {
    const { Material, plastic, sticker } = rubiksFinish(false);
    expect(Material).toBe(THREE.MeshPhysicalMaterial);
    expect(plastic.color).toBe('#141416');
    expect(sticker.clearcoat).toBe(1);
    expect(plastic.clearcoat).toBeLessThan(sticker.clearcoat);
  });

  it('drops the clearcoat in performance mode', () => {
    const { Material, plastic, sticker } = rubiksFinish(true);
    expect(Material).toBe(THREE.MeshStandardMaterial);
    expect(plastic.clearcoat).toBeUndefined();
    expect(sticker.clearcoat).toBeUndefined();
    // Every parameter must still be one MeshStandardMaterial accepts.
    expect(() => new Material(plastic)).not.toThrow();
  });
});
