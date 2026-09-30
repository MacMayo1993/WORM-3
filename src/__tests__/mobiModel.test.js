import { describe, expect, it, vi } from 'vitest';
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
    // The shell bobs and tilts with MOBI's gait, so measure in its own frame.
    const toBody = new THREE.Matrix4(), local = new THREE.Matrix4();
    for (let t = 0; t < 20; t += 0.5) {
      rig.group.position.z -= 0.4;
      animateMobi(rig, t, { pulse: 1, transit: true });
      rig.group.updateMatrixWorld(true);
      toBody.copy(rig.body.matrixWorld).invert();
      const bounds = new THREE.Box3();
      const vertex = new THREE.Vector3();
      rig.core.traverse(mesh => {
        if (!mesh.isMesh) return;
        local.multiplyMatrices(toBody, mesh.matrixWorld);
        const position = mesh.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) bounds.expandByPoint(vertex.fromBufferAttribute(position, i).applyMatrix4(local));
      });
      for (const axis of ['x', 'y', 'z']) {
        expect(bounds.min[axis]).toBeGreaterThan(-0.98);
        expect(bounds.max[axis]).toBeLessThan(0.98);
      }
      const a = rig.core.getObjectByName('positive-pole').getWorldPosition(new THREE.Vector3()).applyMatrix4(toBody);
      const b = rig.core.getObjectByName('negative-pole').getWorldPosition(new THREE.Vector3()).applyMatrix4(toBody);
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
  // An orb eaten off a red (checkerboard) tile has an orange body and credits orange:
  // MOBI carries it as palette[4], orange core in the red tile's patterned band.
  setMobiOrbAppearance(rig, palette[4]);
  expect(palette[4].gemColor).toBe('#ff9900');
  expect(palette[4].bandColor).toBe('#ee4455');
  expect(rig.primary.color.getHexString()).toBe(palette[4].gemColor.slice(1));
  expect(rig.band.material).toBe(getTileStyleMaterial('checkerboard', palette[4].bandColor, false, null, palette[4].gemColor));
  setMobiOrbAppearance(other, palette[2]);
  expect(rig.primary.color.equals(other.primary.color)).toBe(false);
  expect(rig.band.material).not.toBe(other.band.material);
  expect(rig.shellMaterial.color.equals(shell)).toBe(true);
  expect(rig.eyes[0].children[0].material.color.equals(eyes)).toBe(true);
  let disposed = false;
  palette[4].bandMaterial.addEventListener('dispose', () => { disposed = true; });
  disposeMobi(rig); disposeMobi(other);
  expect(disposed).toBe(false);
});

it('fills starter capsules with bounded gas and keeps instance colors independent', async () => {
  const assets = createMobiSegmentAssets(1200);
  assets.gasGeometry.computeBoundingBox();
  assets.shellGeometry.computeBoundingBox();
  expect(assets.shellGeometry.boundingBox.containsBox(assets.gasGeometry.boundingBox)).toBe(true);
  expect(assets.gasGeometry.attributes.mobiBandColor.count).toBe(1200);
  expect(assets.coreGeometry.attributes.mobiBandColor.count).toBe(1200);
  expect(assets.gasMaterial.depthWrite).toBe(false);
  expect(assets.gasMaterial.uniforms.uTime.value).toBe(0);
  assets.gasGeometry.attributes.mobiBandColor.setXYZ(0, 1, 0, 0);
  assets.gasGeometry.attributes.mobiBandColor.setXYZ(1, 0, 1, 0);
  expect(assets.gasGeometry.attributes.mobiBandColor.getX(0)).toBe(1);
  expect(assets.gasGeometry.attributes.mobiBandColor.getX(1)).toBe(0);
  disposeMobiSegmentAssets(assets);
});

it('uses the surviving pickup history and selected antipodal palette for carried capsules', async () => {
  const { mobiCarriedFace, createMobiOrbPalette } = await import('../worm/mobiOrbAppearance.js');
  const { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } = await import('../worm/healerWorm/constants.js');
  const ids = [2, 5, 1];
  expect(mobiCarriedFace(BASE_TAIL_LENGTH - 1, 3, ids)).toBe(0);
  for (let j = 0; j < ORB_SEGMENT_GROWTH; j++) {
    expect(mobiCarriedFace(BASE_TAIL_LENGTH + j, 3, ids)).toBe(2);
    expect(mobiCarriedFace(BASE_TAIL_LENGTH + ORB_SEGMENT_GROWTH + j, 3, ids)).toBe(5);
  }
  expect(mobiCarriedFace(BASE_TAIL_LENGTH + 2 * ORB_SEGMENT_GROWTH, 2, ids)).toBe(0);
  expect(mobiCarriedFace(BASE_TAIL_LENGTH, 1, [99])).toBe(0);
  const palette = createMobiOrbPalette({ colorScheme: 'neon' });
  expect(palette[2].gasGem.equals(palette[5].gasBand)).toBe(true);
  expect(palette[2].gasBand.equals(palette[5].gasGem)).toBe(true);
  expect(palette[0].gasBand.equals(palette[1].gasBand)).toBe(true);
});


it('freezes gas when paused and suppresses sparks with reduced motion', () => {
  const rig = createMobiModel();
  animateMobi(rig, 3.2);
  animateMobi(rig, 3.2);
  expect(rig.gas.material.uniforms.uTime.value).toBe(3.2);
  const previous = window.matchMedia;
  window.matchMedia = vi.fn(() => ({ matches: true }));
  try {
    animateMobi(rig, 10, { transit: true });
    expect(rig.gas.material.uniforms.uTime.value).toBe(0);
    expect(rig.gas.material.uniforms.uMotion.value).toBe(0);
  } finally {
    window.matchMedia = previous;
    disposeMobi(rig);
  }
});

describe('MOBI secondary motion', () => {
  const crawl = (rig, from, to, speed) => {
    for (let t = from; t <= to + 1e-9; t += 1 / 60) {
      rig.group.position.z -= speed / 60;
      animateMobi(rig, t);
    }
  };

  it('hops, leans and swings its antennae while crawling, and settles when it stops', async () => {
    const rig = createMobiModel();
    crawl(rig, 0, 1.5, 3);
    expect(rig.motion.gait).toBeGreaterThan(0.6);
    expect(rig.body.rotation.x).toBeLessThan(-0.03);
    const heights = [];
    for (let t = 1.5; t < 2.2; t += 1 / 60) { rig.group.position.z -= 3 / 60; animateMobi(rig, t); heights.push(rig.body.position.y); }
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.04);
    expect(Math.abs(rig.antennae[0].rotation.x)).toBeGreaterThan(0.05);
    crawl(rig, 2.2, 4, 0);
    expect(rig.motion.gait).toBeLessThan(0.05);
    disposeMobi(rig);
  });

  it('holds its whole pose when the caller freezes its clock', () => {
    const rig = createMobiModel();
    crawl(rig, 0, 1, 3);
    const frozen = rig.lastTime;
    rig.body.updateMatrix();
    const body = rig.body.matrix.clone();
    const antennae = rig.antennae.map(a => a.quaternion.clone());
    const pupil = rig.pupils[0].position.clone();
    for (let i = 0; i < 3; i++) animateMobi(rig, frozen);
    rig.body.updateMatrix();
    expect(rig.body.matrix.equals(body)).toBe(true);
    rig.antennae.forEach((a, i) => expect(a.quaternion.equals(antennae[i])).toBe(true));
    expect(rig.pupils[0].position.equals(pupil)).toBe(true);
    disposeMobi(rig);
  });

  it('stands still and square with reduced motion', () => {
    const previous = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true }));
    const rig = createMobiModel();
    try {
      crawl(rig, 0, 1, 3);
      expect(rig.motion.gait).toBe(0);
      expect(rig.body.rotation.x).toBe(0);
      expect(rig.body.rotation.z).toBe(0);
      expect(rig.body.position.y).toBe(0);
      expect(rig.antennae[0].rotation.x).toBe(0);
    } finally {
      window.matchMedia = previous;
      disposeMobi(rig);
    }
  });

  it('gives hats and glasses the animated head frame', async () => {
    const { mobiHeadFrameInto, MOBI_RADIUS } = await import('../worm/mobiModel.js');
    const rig = createMobiModel();
    crawl(rig, 0, 1.3, 3);
    rig.group.scale.setScalar(MOBI_RADIUS);
    const center = new THREE.Vector3(), forward = new THREE.Vector3(), normal = new THREE.Vector3(), q = new THREE.Quaternion();
    mobiHeadFrameInto(rig, center, forward, normal, q);
    rig.group.updateMatrixWorld(true);
    expect(center.distanceTo(rig.body.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-9);
    expect(normal.distanceTo(new THREE.Vector3(0, 1, 0).applyQuaternion(rig.body.getWorldQuaternion(new THREE.Quaternion())))).toBeLessThan(1e-9);
    expect(forward.dot(normal)).toBeCloseTo(0, 9);
    expect(q.length()).toBeCloseTo(1, 9);
    disposeMobi(rig);
  });
});

describe('MOBI tail blocks', () => {
  it('draws one block per three segments, clear of the head, one per carried orb', async () => {
    const { isMobiBlockSegment } = await import('../worm/mobiSegments.js');
    const { mobiCarriedFace } = await import('../worm/mobiOrbAppearance.js');
    const { BASE_TAIL_LENGTH: base, ORB_SEGMENT_GROWTH: growth } = await import('../worm/healerWorm/constants.js');
    const orbs = 6, ids = [1, 2, 3, 4, 5, 6];
    const blocks = [];
    for (let i = 0; i < base + orbs * growth; i++) if (isMobiBlockSegment(i, base, growth)) blocks.push(i);
    expect(blocks[0]).toBeGreaterThanOrEqual(growth);
    for (let k = 1; k < blocks.length; k++) expect(blocks[k] - blocks[k - 1]).toBe(growth);
    const carried = blocks.map(i => mobiCarriedFace(i, orbs, ids)).filter(Boolean);
    expect(carried).toEqual(ids);
  });

  it('tumbles within the surface clearance and lies still with reduced motion', async () => {
    const { mobiTailSwayInto } = await import('../worm/mobiSegments.js');
    const out = {};
    for (let block = 0; block < 12; block++) for (let travel = 0; travel < 6; travel += 0.13) {
      mobiTailSwayInto(out, block, travel, travel * 0.7);
      // Half-extent of a unit block along the normal after roll and pitch.
      const reach = Math.cos(out.roll) * Math.cos(out.pitch) + Math.abs(Math.sin(out.roll)) + Math.abs(Math.sin(out.pitch));
      expect(reach * 0.11).toBeLessThan(0.15);
      expect(out.lift).toBeGreaterThanOrEqual(0);
    }
    expect(mobiTailSwayInto(out, 3, 2, 1, true)).toEqual({ roll: 0, pitch: 0, yaw: 0, lift: 0 });
  });

  it('passes each pose back down the tail as MOBI crawls', async () => {
    const { mobiTailSwayInto } = await import('../worm/mobiSegments.js');
    const lead = mobiTailSwayInto({}, 2, 1, 0.5);
    const follow = mobiTailSwayInto({}, 3, 1 + 0.95 / 3.4, 0.5);
    expect(follow.roll).toBeCloseTo(lead.roll, 9);
  });
});

it('keeps the instanced tail bezel cheap and the same shape as the smooth one', async () => {
  const { createMobiFrameGeometry } = await import('../worm/mobiModel.js');
  const smooth = createMobiFrameGeometry(), cheap = createMobiFrameGeometry({ smooth: false });
  expect(cheap.attributes.position.count).toBeLessThan(1500);
  smooth.computeBoundingBox(); cheap.computeBoundingBox();
  expect(cheap.boundingBox.min.distanceTo(smooth.boundingBox.min)).toBeLessThan(0.02);
  expect(cheap.boundingBox.max.distanceTo(smooth.boundingBox.max)).toBeLessThan(0.02);
  for (const geometry of [smooth, cheap]) for (const name of ['normal', 'color', 'mobiGlow']) {
    expect(geometry.attributes[name].count).toBe(geometry.attributes.position.count);
  }
  const glowing = [...cheap.attributes.mobiGlow.array].filter(v => v > 0).length;
  expect(glowing).toBeGreaterThan(0);
  const tail = createMobiSegmentAssets(1200);
  expect(tail.frameGeometry.attributes.position.count).toBe(cheap.attributes.position.count);
  disposeMobiSegmentAssets(tail);
  smooth.dispose(); cheap.dispose();
});
