import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createArchGeometry } from '../worm/craftGeometry.js';
import { getHandmadeParts } from '../worm/handmadeParts.js';
import { COVER_CAPACITY, createAccessoryRig, beginAccessoryBody, poseBodyAccessories, finishAccessoryBody } from '../worm/wormAccessories.js';
import { setWormSharedRenderer, drawDirectWormPreview, wormPreviewLooksAlike } from '../3d/WormPreviewRenderer.js';

const COVERS = ['leafCape', 'quiltPatches', 'buttonTrail'];

// Pose a straight worm of `segments` beads the way the game does: one call per
// body segment, nearest the head first.
function pose(rig, segments, { time = 0, transit = false } = {}) {
  const up = new THREE.Vector3(0, 1, 0), forward = new THREE.Vector3(1, 0, 0), centre = new THREE.Vector3();
  beginAccessoryBody(rig);
  for (let i = 1; i <= segments; i++) {
    centre.set(-i * 0.09, 0.105, 0);
    poseBodyAccessories(rig, i, centre, forward, up, 0.105, time, transit, '#33f08e', null);
  }
  finishAccessoryBody(rig, time, transit, '#33f08e', null);
}
const instances = rig => rig.strip.meshes.map(m => m.mesh.count);
const draws = rig => rig.strip.meshes.filter(m => m.mesh.visible).length;
const matrixOf = (m, i) => new THREE.Matrix4().fromArray(m.mesh.instanceMatrix.array, i * 16);
const scaleOf = (m, i) => new THREE.Vector3().setFromMatrixScale(matrixOf(m, i));

describe('the arch a cape or quilt is cut from', () => {
  it('is a closed solid with every face wound outward and finite', () => {
    const g = createArchGeometry(1.1, 0.14, 1.3, 2.5, 10);
    const p = g.attributes.position, n = g.attributes.normal, index = g.index.array;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), sum = new THREE.Vector3(), tmp = new THREE.Vector3();
    for (let t = 0; t < index.length; t += 3) {
      a.fromBufferAttribute(p, index[t]); b.fromBufferAttribute(p, index[t + 1]); c.fromBufferAttribute(p, index[t + 2]);
      sum.fromBufferAttribute(n, index[t]).add(tmp.fromBufferAttribute(n, index[t + 1])).add(tmp.fromBufferAttribute(n, index[t + 2]));
      // The ink hull is built from the winding; one inward face would turn it inside out.
      expect(b.clone().sub(a).cross(c.clone().sub(a)).dot(sum)).toBeGreaterThan(0);
    }
    expect([...p.array].every(Number.isFinite)).toBe(true);
  });
});

describe.each(COVERS)('%s runs the length of the body', id => {
  it('is drawn as one piece per segment and no piece is a hidden extra', () => {
    const parts = getHandmadeParts(id);
    expect(parts.cover).toMatchObject({ gap: expect.any(Number) });
    for (const part of parts) expect(part.rig).toBeUndefined();
  });

  it('grows with the worm and keeps its draw calls flat', () => {
    const rig = createAccessoryRig({ body: id });
    pose(rig, 6);
    const short = instances(rig), shortDraws = draws(rig);
    pose(rig, 60);
    const long = instances(rig);
    // The instance counts grow; the number of draws does not.
    expect(Math.max(...long)).toBeGreaterThan(Math.max(...short));
    // (a button trail has a button on every other segment; the rest have a piece on each)
    expect(Math.max(...long)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...long)).toBeLessThanOrEqual(60);
    expect(draws(rig)).toBe(shortDraws);
    expect(draws(rig)).toBeLessThanOrEqual(8);
    expect(rig.root.children).toHaveLength(1);
    pose(rig, 0);
    expect(instances(rig).every(count => count === 0)).toBe(true);
    expect(rig.strip.group.visible).toBe(false);
    rig.dispose();
  });

  it('lays one piece on every segment, in the worm\'s own frame', () => {
    const rig = createAccessoryRig({ body: id });
    pose(rig, 12);
    // The widest-coverage mesh (the hull, or the arch/disc) sits on each segment it is picked for.
    const hull = rig.strip.meshes.find(m => m.mesh.userData.role === 'outline');
    expect(hull.mesh.count).toBeGreaterThan(0);
    for (let i = 0; i < hull.mesh.count; i++) {
      const position = new THREE.Vector3().setFromMatrixPosition(matrixOf(hull, i));
      expect(position.y).toBeCloseTo(0.105);
      expect(position.z).toBeCloseTo(0);
    }
    expect([...hull.mesh.instanceMatrix.array.slice(0, hull.mesh.count * 16)].every(Number.isFinite)).toBe(true);
    rig.dispose();
  });

  it('stays finite through degenerate frames and tunnel transit', () => {
    const rig = createAccessoryRig({ body: id });
    const centre = new THREE.Vector3(1, 2, 3), up = new THREE.Vector3(0, 1, 0);
    for (const forward of [new THREE.Vector3(0, 0, 0), up.clone(), new THREE.Vector3(1, 1, 1).normalize()]) {
      beginAccessoryBody(rig);
      for (let i = 1; i <= 5; i++) poseBodyAccessories(rig, i, centre, forward, up, 0.1, 1.3, true, null, null);
      finishAccessoryBody(rig, 1.3, true);
      for (const m of rig.strip.meshes) expect([...m.mesh.instanceMatrix.array.slice(0, m.mesh.count * 16)].every(Number.isFinite)).toBe(true);
    }
    rig.dispose();
  });

  it('frees its instance buffers and leaves the shared geometry alone', () => {
    const rig = createAccessoryRig({ body: id });
    const geometry = rig.strip.meshes[0].mesh.geometry, dispose = vi.fn();
    geometry.addEventListener('dispose', dispose);
    rig.dispose();
    expect(dispose).not.toHaveBeenCalled();
    expect(rig.root.children).toHaveLength(0);
    const again = createAccessoryRig({ body: id });
    expect(again.strip.meshes[0].mesh.geometry).toBe(geometry);
    again.dispose();
  });
});

describe('cover behaviour', () => {
  it('narrows the cape to a point at the real tail and not at a preview\'s crop', () => {
    const rig = createAccessoryRig({ body: 'leafCape' });
    pose(rig, 30);
    const arch = rig.strip.meshes.find(m => m.mesh.userData.role === 'outline');
    const girth = i => scaleOf(arch, i).x;
    expect(girth(0)).toBeCloseTo(0.105);
    expect(girth(29)).toBeLessThan(girth(0) * 0.5);
    rig.dispose();
    // A preview draws only the first few pieces, but the worm still has its tail.
    const preview = createAccessoryRig({ body: 'leafCape' }, 16);
    preview.coverLimit = 5;
    pose(preview, 9);
    const hull = preview.strip.meshes.find(m => m.mesh.userData.role === 'outline');
    expect(hull.mesh.count).toBe(5);
    expect(scaleOf(hull, 0).x).toBeCloseTo(0.105);
    expect(scaleOf(hull, 2).x).toBeCloseTo(0.105);
    expect(scaleOf(hull, 4).x).toBeLessThan(0.105);
    preview.dispose();
  });

  it('is rippled by the clock and still when the clock is frozen', () => {
    const rig = createAccessoryRig({ body: 'leafCape' });
    const hull = () => rig.strip.meshes.find(m => m.mesh.userData.role === 'outline');
    pose(rig, 8, { time: 0 });
    const still = [...hull().mesh.instanceMatrix.array.slice(0, 8 * 16)];
    pose(rig, 8, { time: 0 });
    expect([...hull().mesh.instanceMatrix.array.slice(0, 8 * 16)]).toEqual(still);
    pose(rig, 8, { time: 0.7 });
    expect([...hull().mesh.instanceMatrix.array.slice(0, 8 * 16)]).not.toEqual(still);
    rig.dispose();
  });

  it('stretches a cape over a thinned segment but never a button', () => {
    const lengthOf = (id, gap) => {
      const rig = createAccessoryRig({ body: id }), up = new THREE.Vector3(0, 1, 0), forward = new THREE.Vector3(1, 0, 0);
      beginAccessoryBody(rig);
      for (let i = 1; i <= 4; i++) poseBodyAccessories(rig, i, new THREE.Vector3(-i * gap, 0.105, 0), forward, up, 0.105, 0, false);
      finishAccessoryBody(rig, 0, false);
      const hull = rig.strip.meshes.find(m => m.mesh.userData.role === 'outline');
      const z = scaleOf(hull, 2).z;
      rig.dispose();
      return z;
    };
    expect(lengthOf('leafCape', 0.18)).toBeGreaterThan(lengthOf('leafCape', 0.09) * 1.8);
    expect(lengthOf('buttonTrail', 0.18)).toBeCloseTo(lengthOf('buttonTrail', 0.09));
  });

  it('keeps the colour cycle: every fourth quilt patch is the same cloth', () => {
    const rig = createAccessoryRig({ body: 'quiltPatches' });
    pose(rig, 17);
    const patches = rig.strip.meshes.filter(m => m.n === 4 && m.mesh.userData.role !== 'outline');
    expect(patches.map(m => m.c).sort()).toEqual([0, 1, 2, 3]);
    expect(patches.map(m => m.mesh.count)).toEqual(patches.map(m => Math.ceil((17 - m.c) / 4)));
    rig.dispose();
  });

  it('is bounded by its capacity however long the worm gets', () => {
    const rig = createAccessoryRig({ body: 'leafCape' });
    pose(rig, COVER_CAPACITY + 200);
    for (const m of rig.strip.meshes) expect(m.mesh.count).toBeLessThanOrEqual(m.mesh.instanceMatrix.count);
    rig.dispose();
  });
});

describe('single body pieces', () => {
  it('ride the shoulders, and a worm too short for that segment wears them on its last', () => {
    const rig = createAccessoryRig({ body: 'spoolBackpack' });
    expect(rig.entries[0].index).toBe(2);
    pose(rig, 5);
    expect(rig.entries[0].group.visible).toBe(true);
    expect(rig.entries[0].group.position.x).toBeCloseTo(-2 * 0.09);
    pose(rig, 1);
    expect(rig.entries[0].group.visible).toBe(true);
    expect(rig.entries[0].group.position.x).toBeCloseTo(-0.09);
    pose(rig, 0);
    expect(rig.entries[0].group.visible).toBe(false);
    rig.dispose();
  });

  it('keeps friendship beads in their three spaced rings', () => {
    const rig = createAccessoryRig({ body: 'friendshipBeads' });
    expect(rig.entries.map(e => e.index)).toEqual([1, 3, 5]);
    pose(rig, 8);
    expect(rig.entries.filter(e => e.group.visible)).toHaveLength(3);
    pose(rig, 2);
    expect(rig.entries.filter(e => e.group.visible)).toHaveLength(1);
    rig.dispose();
  });
});

describe('preview redraws and caches', () => {
  it('only redraws a thumbnail when what it would draw has changed', () => {
    const base = { characterId: 'classic', skinId: 'slime', hatId: 'none', framing: 'body', accessories: { body: 'leafCape' } };
    // A parent re-render rebuilds the options object and the equipment inside it.
    expect(wormPreviewLooksAlike(base, { ...base, accessories: { body: 'leafCape' } })).toBe(true);
    expect(wormPreviewLooksAlike(base, { ...base, accessories: { body: 'leafCape', face: 'none' } })).toBe(true);
    expect(wormPreviewLooksAlike(base, { ...base, accessories: { body: 'fireflyJar' } })).toBe(false);
    expect(wormPreviewLooksAlike(base, { ...base, accessories: { body: 'leafCape', tail: 'ribbonTail' } })).toBe(false);
    expect(wormPreviewLooksAlike(base, { ...base, skinId: 'lava' })).toBe(false);
    expect(wormPreviewLooksAlike(base, { ...base, hatId: 'acorn' })).toBe(false);
    expect(wormPreviewLooksAlike(base, { ...base, framing: 'portrait' })).toBe(false);
    expect(wormPreviewLooksAlike(base, { ...base, animated: true })).toBe(false);
  });

  describe('through the picker rig', () => {
    let scene;
    const gl = {
      getRenderTarget: () => null, getScissorTest: () => false, getClearAlpha: () => 0,
      getViewport: v => v.set(0, 0, 360, 360), getScissor: v => v.set(0, 0, 360, 360),
      getClearColor: c => c.set('black'), getSize: v => v.set(360, 360),
      setRenderTarget() {}, setScissorTest() {}, setViewport() {}, setClearColor() {}, setScissor() {},
      render: s => { scene = s; },
    };
    beforeAll(() => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} });
      setWormSharedRenderer(gl);
    });
    afterAll(() => vi.restoreAllMocks());
    const draw = (accessories, hatId = 'none') => {
      drawDirectWormPreview(gl, { characterId: 'classic', skinId: 'slime', hatId, accessories, framing: 'body' }, 0);
      return scene.getObjectByName('worm-accessories');
    };

    it('keeps a built outfit when the grid moves on to another, instead of rebuilding it', () => {
      const cape = draw({ body: 'leafCape' });
      const jar = draw({ body: 'fireflyJar' });
      expect(jar).not.toBe(cape);
      expect(draw({ body: 'leafCape' })).toBe(cape);
      expect(draw({ body: 'fireflyJar' })).toBe(jar);
      // And a cached outfit still draws: the cape covers the visible stretch of body.
      draw({ body: 'leafCape' });
      expect(cape.children.some(child => child.visible)).toBe(true);
    });

    it('releases the oldest outfit rather than growing without bound', () => {
      const first = draw({ face: 'bottlecapGlasses' });
      const spy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
      const slots = [['face', 'yarnMustache'], ['face', 'buttonGoggles'], ['neck', 'daisyCollar'], ['neck', 'knittedScarf'], ['neck', 'patchworkBandana'], ['neck', 'crookedBow'],
        ['body', 'spoolBackpack'], ['body', 'matchboxBackpack'], ['body', 'buttonTrail'], ['body', 'leafCape'], ['body', 'fireflyJar'], ['body', 'seedSatchel'],
        ['body', 'friendshipBeads'], ['body', 'quiltPatches'], ['tail', 'windupKey'], ['tail', 'paperPinwheel'], ['tail', 'ribbonTail'], ['tail', 'paintbrushTail']];
      for (const [slot, id] of slots) draw({ [slot]: id });
      expect(draw({ face: 'bottlecapGlasses' })).not.toBe(first);
      spy.mockRestore();
    });

    it('keeps built hats and shows the right one', () => {
      const hatOf = hat => { draw({}, hat); return scene.getObjectByName('worm-hat'); };
      const acorn = hatOf('acorn').children[0];
      expect(hatOf('none').children).toHaveLength(0);
      expect(hatOf('toadstool').children[0]).not.toBe(acorn);
      expect(hatOf('acorn').children[0]).toBe(acorn);
    });
  });
});
