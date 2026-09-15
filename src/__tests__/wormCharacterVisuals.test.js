import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCharacterGeometry, applyCharacterFinish, poseCharacterAccents } from '../worm/wormCharacterVisuals.js';
import { createWormSkinMaterial, applySkinMaterialProfile } from '../worm/wormSkinMaterial.js';
import { getSkinFX } from '../worm/wormSkinFX.js';
import { wormBodyTaper } from '../worm/wormCharacterFinish.js';
import { setWormSharedRenderer, drawDirectWormPreview } from '../3d/WormPreviewRenderer.js';
import { inchGaitInto, inchLoopShape } from '../worm/healerWorm/inchGait.js';

describe('character visual safety', () => {
  it.each(['prism', 'inch'])('%s detail stays within the unit collision envelope', character => {
    const geometry = createCharacterGeometry(character);
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      expect(Math.hypot(p.getX(i), p.getY(i), p.getZ(i))).toBeLessThanOrEqual(1.000001);
    }
    expect([...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    geometry.dispose();
  });

  it('restores skin material properties when leaving a crystal character', () => {
    const material = createWormSkinMaterial(), fx = getSkinFX('slime');
    applySkinMaterialProfile(material, fx); applyCharacterFinish(material, 'prism');
    expect(material.flatShading).toBe(true);
    expect(material.transmission).toBe(0);
    applySkinMaterialProfile(material, fx); applyCharacterFinish(material, 'classic');
    expect(material.vertexColors).toBe(false);
    expect(material.flatShading).toBe(!!fx.material.flatShading);
    expect(material.roughness).toBe(fx.material.roughness);
    material.dispose();
  });

  it('carries head accessories through all six surface frames without reflection', () => {
    for (const axis of ['x', 'y', 'z']) for (const sign of [-1, 1]) {
      const up = new THREE.Vector3(); up[axis] = sign;
      const forward = new THREE.Vector3(axis === 'x' ? 0 : 1, axis === 'x' ? 1 : 0, 0);
      const center = up.clone().multiplyScalar(1.6), group = new THREE.Group();
      poseCharacterAccents(group, center, forward, up, 0.092);
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion);
      const expected = up.clone().multiplyScalar(0.62).addScaledVector(forward, 0.79).normalize();
      expect(normal.distanceTo(expected)).toBeLessThan(1e-6);
      expect(group.quaternion.length()).toBeCloseTo(1);
      expect(group.position.distanceTo(center)).toBe(0);
    }
  });
});

// Exercise the real picker rig through its renderer boundary. No WebGL mocks
// stand in for geometry/poses; only the GPU draw and canvas texture are omitted.
describe('picker character switching', () => {
  let scene;
  const gl = {
    getRenderTarget: () => null, getScissorTest: () => false, getClearAlpha: () => 0,
    getViewport: v => v.set(0, 0, 360, 360), getScissor: v => v.set(0, 0, 360, 360),
    getClearColor: c => c.set('black'), getSize: v => v.set(360, 360),
    setRenderTarget() {}, setScissorTest() {}, setViewport() {}, setClearColor() {}, setScissor() {},
    render: s => { scene = s; },
  };
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
    });
    setWormSharedRenderer(gl);
  });
  afterAll(() => vi.restoreAllMocks());
  const draw = (characterId, time = 0.6) => {
    drawDirectWormPreview(gl, { characterId, skinId: 'slime', hatId: 'none', framing: 'character' }, time);
    const bodies = [];
    scene.traverse(o => { if (o.isMesh && o.visible && o.material.userData.seed !== undefined) bodies.push(o); });
    return bodies;
  };
  it('keeps the actual inch arch and compression when roaming around the stage', () => {
    const bodies = draw('inch'), shape = inchLoopShape(9), sample = {};
    expect(bodies).toHaveLength(9);
    for (let i = 0; i < 9; i++) {
      inchGaitInto(sample, i, 9, 0.6 * 0.8, 1, shape);
      expect(bodies[i].position.y).toBeCloseTo(sample.arch * shape.height);
      if (i > 0) expect(bodies[i].scale.x).toBeCloseTo((0.082 + sample.arch * 0.03) * wormBodyTaper(i, 9, 'inch'));
    }
    expect(Math.max(...bodies.map(b => b.position.y))).toBeGreaterThan(0.01);
  });
  it('replaces crystal geometry and material when another character is selected', () => {
    const crystal = draw('prism');
    expect(crystal).toHaveLength(9);
    expect(crystal[0].geometry.type).toBe('IcosahedronGeometry');
    const classic = draw('classic');
    expect(classic[0].geometry.type).toBe('SphereGeometry');
    expect(classic.every(b => !b.material.vertexColors && !b.material.flatShading)).toBe(true);
    expect(draw('book')).toHaveLength(1);
    expect(draw('inch')).toHaveLength(9);
  });
  it('loads a requested hat and clears it when the selection returns to none', async () => {
    const opts = { characterId: 'book', skinId: 'slime', hatId: 'tophat', framing: 'character' };
    drawDirectWormPreview(gl, opts, 0);
    await vi.waitFor(() => {
      drawDirectWormPreview(gl, opts, 0);
      expect(scene.getObjectByName('worm-hat').children.length).toBeGreaterThan(0);
    });
    draw('inch');
    expect(scene.getObjectByName('worm-hat').children).toHaveLength(0);
  });
});
