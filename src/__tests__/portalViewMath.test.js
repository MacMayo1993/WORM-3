import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { framePortalCamera, livePortalPairs, PORTAL_RADIUS, PORTAL_OFFSET } from '../3d/portalViewMath.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { inspectionBudget, lensRect } from '../3d/inspectionBridge.js';
import { createInspectionTarget } from '../3d/inspectionPass.js';

describe('portal identity and lifetime', () => {
  it('finds one live pair and retains identities when only one endpoint rotates', () => {
    let cubies = makeCubies(3), map = buildManifoldGridMap(cubies, 3);
    cubies = flipStickerPair(cubies, 3, 2, 2, 2, 'PZ', map);
    const pairs = livePortalPairs(cubies, 3, map, 6);
    expect(pairs).toHaveLength(1);
    const ids = [pairs[0].a, pairs[0].b].sort();
    // The old map contains pre-flip colors; use the committed cube for colors.
    const a = [...map.values()].find(loc => getManifoldGridId(loc.sticker, 3) === pairs[0].a);
    expect(pairs[0].colorA).toBe(cubies[a.x][a.y][a.z].stickers[a.dirKey].curr);
    cubies = rotateSliceCubies(cubies, 3, 'y', 2, 1);
    map = buildManifoldGridMap(cubies, 3);
    const rotated = livePortalPairs(cubies, 3, map, 6);
    expect(rotated).toHaveLength(1);
    expect([rotated[0].a, rotated[0].b].sort()).toEqual(ids);
  });

  it('removes healed, mismatched and capped endpoints using the active cap', () => {
    let cubies = makeCubies(3), map = buildManifoldGridMap(cubies, 3);
    cubies = flipStickerPair(cubies, 3, 2, 2, 2, 'PZ', map);
    const pair = livePortalPairs(cubies, 3, map, 6)[0];
    map = buildManifoldGridMap(cubies, 3);
    const at = map.get(pair.a), sticker = cubies[at.x][at.y][at.z].stickers[at.dirKey];
    sticker.flips = 3;
    expect(livePortalPairs(cubies, 3, map, 3)).toEqual([]);
    expect(livePortalPairs(cubies, 3, map, 8)).toHaveLength(1);
    sticker.flips = 2;
    expect(livePortalPairs(cubies, 3, map, 8)).toEqual([]);
    expect(livePortalPairs(cubies, 4, map, 8)).toEqual([]);
  });
});

describe('off-axis portal camera', () => {
  it.each(['x', 'y', 'z'])('frames a raised, translated destination after a %s layer turn', axis => {
    const source = new THREE.Object3D(), destination = new THREE.Object3D();
    source.position.set(1.2, 2.6, 3.1); source.rotation[axis] = 0.72;
    destination.position.set(-2.4, -3.3, -1.2); destination.rotation.set(0.8, -1.1, 0.5);
    source.updateMatrixWorld(true); destination.updateMatrixWorld(true);
    const viewer = new THREE.PerspectiveCamera(50, 1.5, 0.01, 100);
    viewer.position.set(0.6, -0.2, 4).applyMatrix4(source.matrixWorld); viewer.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera();
    expect(framePortalCamera(camera, viewer, source.matrixWorld, destination.matrixWorld)).toBe(true);
    const localEye = camera.position.clone().applyMatrix4(destination.matrixWorld.clone().invert());
    expect(localEye.distanceTo(new THREE.Vector3(-0.6, -0.2, -4))).toBeLessThan(1e-8);
    for (const [x, y, expectedX, expectedY] of [[PORTAL_RADIUS, -PORTAL_RADIUS, -1, -1], [-PORTAL_RADIUS, -PORTAL_RADIUS, 1, -1], [PORTAL_RADIUS, PORTAL_RADIUS, -1, 1]]) {
      const screen = new THREE.Vector3(x, y, PORTAL_OFFSET).applyMatrix4(destination.matrixWorld).project(camera);
      expect(screen.x).toBeCloseTo(expectedX, 7); expect(screen.y).toBeCloseTo(expectedY, 7);
    }
    // Near plane excludes the destination's opaque backing, not the exit scene.
    const behind = new THREE.Vector3(0, 0, PORTAL_OFFSET - 0.02).applyMatrix4(destination.matrixWorld).project(camera);
    const beyond = new THREE.Vector3(0, 0, PORTAL_OFFSET + 0.1).applyMatrix4(destination.matrixWorld).project(camera);
    expect(behind.z).toBeLessThan(-1); expect(beyond.z).toBeGreaterThan(-1);
  });

  it('rejects a viewer behind or inside the entrance plane', () => {
    const viewer = new THREE.PerspectiveCamera(), camera = new THREE.PerspectiveCamera(), frame = new THREE.Matrix4();
    for (const z of [-3, 0, PORTAL_OFFSET]) {
      viewer.position.z = z; viewer.updateMatrixWorld(true);
      expect(framePortalCamera(camera, viewer, frame, frame)).toBe(false);
    }
  });
});

it('uses universally filterable single-sample targets and bounded mobile budgets', () => {
  const target = createInspectionTarget(192);
  expect(target.texture.type).toBe(THREE.UnsignedByteType);
  expect(target.texture.generateMipmaps).toBe(false);
  expect(target.samples).toBe(0);
  expect(inspectionBudget({ mobile: true }).portals).toBe(1);
  expect(inspectionBudget({ size: 15 }).portals).toBe(0);
  expect(inspectionBudget({ reduced: true }).portals).toBe(0);
  target.dispose();
});

it('keeps the complete lens inside portrait and landscape viewports', () => {
  for (const [width, height] of [[390, 844], [844, 390], [320, 240]]) {
    for (const x of [-2, 0.5, 3]) {
      const r = lensRect(width, height, { x, y: x, radius: 180 });
      expect(r.x - r.radius).toBeGreaterThanOrEqual(0);
      expect(r.y - r.radius).toBeGreaterThanOrEqual(0);
      expect(r.x + r.radius).toBeLessThanOrEqual(width);
      expect(r.y + r.radius).toBeLessThanOrEqual(height);
      expect(r.x - 114).toBeGreaterThanOrEqual(0);
      expect(r.x + 114).toBeLessThanOrEqual(width);
      expect(r.y - r.radius - 60).toBeGreaterThanOrEqual(0);
      expect(r.y + r.radius + 72).toBeLessThanOrEqual(height);
    }
  }
});
