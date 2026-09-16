import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createMobiModel, animateMobi, orientMobi, disposeMobi } from '../worm/mobiModel.js';
import { WORM_CHARACTERS, getWormCharacter } from '../worm/wormCharacterData.js';
import { createMobiSegmentAssets, createMobiSegment, disposeMobiSegmentAssets } from '../worm/mobiSegments.js';

describe('playable MOBI', () => {
  it('gives tail segments the head glass with a separate colored core', () => {
    const head = createMobiModel();
    const assets = createMobiSegmentAssets();
    const segment = createMobiSegment(assets);
    expect(assets.shellMaterial.opacity).toBe(head.shellMaterial.opacity);
    expect(assets.shellMaterial.depthWrite).toBe(false);
    expect(assets.shellMaterial.color.equals(head.shellMaterial.color)).toBe(true);
    const glassColor = assets.shellMaterial.color.clone();
    segment.core.material.color.set('#aa33ff');
    expect(assets.shellMaterial.color.equals(glassColor)).toBe(true);
    assets.coreGeometry.computeBoundingBox();
    assets.shellGeometry.computeBoundingBox();
    expect(assets.shellGeometry.boundingBox.containsBox(assets.coreGeometry.boundingBox)).toBe(true);
    expect(assets.frameGeometry.attributes.position.count).toBeGreaterThan(0);
    expect(assets.coreGeometry.attributes.color.count).toBe(assets.coreGeometry.attributes.position.count);
    segment.core.material.dispose();
    disposeMobiSegmentAssets(assets);
    disposeMobi(head);
  });

  it('is selectable without changing the fallback for old or invalid saves', () => {
    expect(WORM_CHARACTERS.filter(c => c.id === 'mobi')).toHaveLength(1);
    expect(getWormCharacter('mobi').label).toBe('MOBI');
    expect(getWormCharacter('old-save').id).toBe('classic');
  });

  it('keeps the complete animated parity core inside the transparent body', () => {
    const rig = createMobiModel();
    rig.group.scale.setScalar(1);
    expect(rig.shellMaterial.transparent).toBe(true);
    expect(rig.shellMaterial.depthWrite).toBe(false);
    for (let t = 0; t < 20; t += 0.5) {
      animateMobi(rig, t, { pulse: 1, transit: true });
      rig.group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(rig.core, true);
      for (const axis of ['x', 'y', 'z']) {
        expect(bounds.min[axis]).toBeGreaterThan(-0.98);
        expect(bounds.max[axis]).toBeLessThan(0.98);
      }
      const a = rig.core.getObjectByName('positive-pole').getWorldPosition(new THREE.Vector3());
      const b = rig.core.getObjectByName('negative-pole').getWorldPosition(new THREE.Vector3());
      expect(a.add(b).length()).toBeLessThan(1e-10);
    }
    disposeMobi(rig);
  });

  it('follows all six face normals and rotating slices with an orthonormal frame', () => {
    const object = new THREE.Object3D();
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    for (const axis of axes) for (const sign of [-1, 1]) for (const turnAxis of axes) {
      for (const angle of [0, 0.4, Math.PI / 2, Math.PI]) {
        const up = axis.clone().multiplyScalar(sign);
        const forward = axes.find(a => Math.abs(a.dot(up)) < 0.5).clone();
        up.applyAxisAngle(turnAxis, angle);
        forward.applyAxisAngle(turnAxis, angle);
        orientMobi(object, forward, up);
        expect(new THREE.Vector3(0, 1, 0).applyQuaternion(object.quaternion).distanceTo(up)).toBeLessThan(1e-10);
        expect(new THREE.Vector3(0, 0, -1).applyQuaternion(object.quaternion).distanceTo(forward)).toBeLessThan(1e-10);
        expect(object.quaternion.length()).toBeCloseTo(1, 10);
      }
    }
    // Degenerate tangent at a tunnel endpoint must still give a finite frame.
    orientMobi(object, axes[1], axes[1]);
    expect(object.quaternion.length()).toBeCloseTo(1, 10);
  });

  it('holds animation when the caller freezes its clock', () => {
    const rig = createMobiModel();
    animateMobi(rig, 3.2);
    const rotation = rig.core.quaternion.clone();
    animateMobi(rig, 3.2);
    expect(rig.core.quaternion.equals(rotation)).toBe(true);
    disposeMobi(rig);
  });
});

it('preserves actual antipodal pickup colors and patterned bands without recoloring the glass or eyes', async () => {
  const { createMobiOrbPalette } = await import('../worm/mobiOrbAppearance.js');
  const { setMobiOrbAppearance } = await import('../worm/mobiModel.js');
  const { getTileStyleMaterial } = await import('../3d/styles/TileStyleMaterials.jsx');
  const settings = { colorScheme: 'custom', customColors: { 1: '#ee4455', 2: '#44dd88', 3: '#eeeeee', 4: '#ff9900', 5: '#4477ff', 6: '#ffdd22' }, manifoldStyles: { 1: 'checkerboard' } };
  const palette = createMobiOrbPalette(settings);
  const rig = createMobiModel(), other = createMobiModel();
  const shell = rig.shellMaterial.color.clone(), eyes = rig.eyes[0].children[0].material.color.clone();
  setMobiOrbAppearance(rig, palette[1]);
  expect(rig.primary.color.getHexString()).toBe(palette[1].gemColor.slice(1));
  expect(rig.band.material).toBe(getTileStyleMaterial('checkerboard', palette[1].bandColor, false, null, palette[1].gemColor));
  setMobiOrbAppearance(other, palette[2]);
  expect(rig.primary.color.equals(other.primary.color)).toBe(false);
  expect(rig.band.material).not.toBe(other.band.material);
  expect(rig.shellMaterial.color.equals(shell)).toBe(true);
  expect(rig.eyes[0].children[0].material.color.equals(eyes)).toBe(true);
  let disposed = false;
  palette[1].bandMaterial.addEventListener('dispose', () => { disposed = true; });
  disposeMobi(rig); disposeMobi(other);
  expect(disposed).toBe(false);
});
