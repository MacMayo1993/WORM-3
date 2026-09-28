import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createExteriorPortals } from '../3d/exteriorPortals.js';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { makeTunnelPath, tunnelPathArcPointInto } from '../utils/tunnelPath.js';
import { INTERIOR_PORTAL_RADIUS, interiorPortalFrameInto } from '../worm/healerWorm/interiorPortals.js';
import { WORM_PAD_HEIGHT, wormRaisedAmount } from '../game/raisedCubie.js';
import { tunnelCameraInside } from '../worm/tunnelVisibility.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';

it('releases portal copies when remix materials are retired', () => {
  const portals = createExteriorPortals();
  const retired = [];
  for (let cycle = 0; cycle < 50; cycle++) {
    const source = new THREE.ShaderMaterial();
    const copy = portals.materialFor(source);
    const disposed = vi.fn(); copy.addEventListener('dispose', disposed);
    source.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
    retired.push(disposed);
  }
  const body = new THREE.MeshStandardMaterial(), original = body.onBeforeCompile;
  portals.materialFor(body); body.dispose();
  expect(body.onBeforeCompile).toBe(original);
  expect(body.userData.portalCutout).toBeUndefined();
  portals.dispose();
  retired.forEach(disposed => expect(disposed).toHaveBeenCalledTimes(1));
});

it('keeps both raised apertures open through plastic, including corner and reversed paths', () => {
  const portals = createExteriorPortals(), point = new THREE.Vector3(), closest = new THREE.Vector3();
  const center = new THREE.Vector3(), axis = new THREE.Vector3(), line = new THREE.Line3();
  try {
    for (const size of [3, 6, 15]) for (const reverse of [false, true]) {
      const tunnel = { entry: { x: 0, y: size - 1, z: 0, dirKey: 'PY' },
        exit: { x: size - 1, y: 0, z: size - 1, dirKey: 'PZ' },
        padHeight: WORM_PAD_HEIGHT, padExpansion: wormRaisedAmount(size) };
      if (reverse) [tunnel.entry, tunnel.exit] = [tunnel.exit, tunnel.entry];
      portals.update(tunnel, size, 0);
      const path = buildTunnelPathForTunnel(makeTunnelPath(), tunnel, size);
      const points = portals.uniforms.uExteriorPoints.value;
      for (const side of [0, 1]) {
        const from = side ? path.total : 0;
        const to = interiorPortalFrameInto(center, axis, path, side, size / 2 - 1.1);
        for (let i = 0; i <= 80; i++) {
          tunnelPathArcPointInto(point, path, THREE.MathUtils.lerp(from, to, i / 80));
          let distance = Infinity;
          for (let j = side * 9; j < side * 9 + 8; j++) {
            line.set(points[j], points[j + 1]).closestPointToPoint(point, true, closest);
            distance = Math.min(distance, point.distanceTo(closest));
          }
          expect(distance).toBeLessThan(INTERIOR_PORTAL_RADIUS * .1);
        }
      }
    }
    portals.update(null, 3, 0);
    expect(portals.uniforms.uExteriorOpen.value).toBe(0);
  } finally { portals.dispose(); }
});

it('switches to the interior at the raised mouth before black cubie backs can fill the lens', () => {
  const point = new THREE.Vector3(0, 3.5 + WORM_PAD_HEIGHT - .01, 0);
  expect(tunnelCameraInside(point, 7, 'entering')).toBe(false);
  expect(tunnelCameraInside(point, 7, 'entering', { padHeight: WORM_PAD_HEIGHT })).toBe(true);
  expect(tunnelCameraInside(point, 7, 'crawling', { padHeight: WORM_PAD_HEIGHT })).toBe(false);
});

it('keeps live built-in material refs and cached tile shaders intact', () => {
  const portals = createExteriorPortals(), plastic = new THREE.MeshStandardMaterial();
  const originalCompile = plastic.onBeforeCompile;
  const source = getTileStyleMaterial('checkerboard', '#4488ee', false, null, '#ee8844');
  const shader = source.fragmentShader;
  const clipped = portals.materialFor(source);
  expect(clipped).not.toBe(source);
  expect(clipped.uniforms.time).toBe(source.uniforms.time);
  expect(source.fragmentShader).toBe(shader);
  expect(portals.materialFor(clipped)).toBe(clipped);
  expect(portals.materialFor(plastic)).toBe(plastic);
  plastic.opacity = .3;
  expect(portals.materialFor(plastic).opacity).toBe(.3);
  portals.dispose();
  expect(plastic.onBeforeCompile).toBe(originalCompile);
  expect(plastic.userData.portalCutout).toBeUndefined();
  // React Strict Mode may clean up and re-run effects on the same scene.
  expect(portals.materialFor(clipped)).toBe(clipped);
  expect(portals.materialFor(plastic)).toBe(plastic);
  expect(clipped.fragmentShader.match(/float portalDistance/g)).toHaveLength(1);
  portals.dispose();
  plastic.dispose();
});
