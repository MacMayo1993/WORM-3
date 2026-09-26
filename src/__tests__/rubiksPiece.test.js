import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  STICKER_OFFSET, PLAY_STICKER_DEPTH, createCubieGeometry, createStickerGeometry, createPlayStickerGeometry, rubiksFinish
} from '../3d/rubiksPiece.js';
import { bodyMaterialProps, CLASSIC_BODY_COAT, CLASSIC_BODY_SIZE } from '../3d/cubeViewStyles.js';

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

  it('makes the play sticker the flat quad\'s size, front at z = 0 and back clear of the cubie face', () => {
    const geometry = createPlayStickerGeometry();
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    expect(max.x - min.x).toBeCloseTo(0.85, 3);
    expect(max.z).toBeCloseTo(0, 4);
    expect(min.z).toBeCloseTo(-PLAY_STICKER_DEPTH, 4);
    // Stickers sit 0.51 out; the classic body face is at 0.48, the others at 0.49.
    expect(0.51 - PLAY_STICKER_DEPTH).toBeGreaterThan(0.49);
    // UVs span 0–1 across the front, like the PlaneGeometry it replaces.
    const uv = geometry.attributes.uv;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < uv.count; i++) { lo = Math.min(lo, uv.getX(i)); hi = Math.max(hi, uv.getX(i)); }
    expect(lo).toBeCloseTo(0, 3);
    expect(hi).toBeCloseTo(1, 3);
  });

  it('builds the classic play cube from the menu cube\'s plastic', () => {
    const { plastic } = rubiksFinish(false);
    const body = bodyMaterialProps('classic');
    expect(body.color).toBe(plastic.color);
    expect(body.roughness).toBe(plastic.roughness);
    expect(CLASSIC_BODY_COAT).toEqual({ clearcoat: plastic.clearcoat, clearcoatRoughness: plastic.clearcoatRoughness });
    expect(CLASSIC_BODY_SIZE).toBeCloseTo(0.96, 5);
  });
});
