import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeCorePassage, updateCorePassage, coreOpeningRadius, CORE_PASSAGE_EXTENT } from '../3d/corePassage.js';
import { makeInteriorPortals, syncInteriorPortals } from '../worm/healerWorm/interiorPortals.js';
import { tunnelPathArcPointInto } from '../utils/tunnelPath.js';
import { WORM_PAD_HEIGHT, wormRaisedAmount } from '../game/raisedCubie.js';
import { SURFACE_OFFSET } from '../utils/constants.js';
import { CORE_ZOOM_MARGIN, CORE_INTERIOR_FILL } from '../3d/antipodalCore.js';

const route = size => ({
  entry: { x: size - 1, y: size - 1, z: size - 1, dirKey: 'PY' },
  exit: { x: Math.floor(size / 2), y: 0, z: 0, dirKey: 'NZ' },
  padExpansion: wormRaisedAmount(size), padHeight: WORM_PAD_HEIGHT
});

describe('interior portal openings', () => {
  it('cuts along the ridden curve, preserving both docks on asymmetric and reversed routes', () => {
    const passage = makeCorePassage(), point = new THREE.Vector3(), closest = new THREE.Vector3(), line = new THREE.Line3();
    for (const size of [2, 3, 6, 15]) for (const reverse of [false, true]) {
      const tunnel = route(size);
      if (reverse) [tunnel.entry, tunnel.exit] = [tunnel.exit, tunnel.entry];
      updateCorePassage(passage, tunnel, size, 0);
      const { path } = passage, points = passage.uniforms.uPassagePoints.value;
      for (const dock of [path.midA, path.core, path.midB]) expect(points.some(p => p.distanceTo(dock) < 1e-10)).toBe(true);
      for (let i = 0; i <= 800; i++) {
        tunnelPathArcPointInto(point, path, path.total * i / 800);
        const extent = Math.min(CORE_PASSAGE_EXTENT, (size / 2 - CORE_ZOOM_MARGIN) * CORE_INTERIOR_FILL + 0.01);
        if (Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) > extent) continue;
        let gap = Infinity;
        for (let j = 1; j < points.length; j++) {
          line.set(points[j - 1], points[j]).closestPointToPoint(point, true, closest);
          gap = Math.min(gap, closest.distanceTo(point));
        }
        // The sampled route stays inside even the smallest tile-sized bore.
        expect(gap).toBeLessThan(coreOpeningRadius(size, 1));
      }
    }
    updateCorePassage(passage, null, 3, 0);
    expect(passage.uniforms.uPassageOpen.value).toBe(0);
  });

  it('puts open-ended back mouths at route/wall intersections, including raised corner offsets', () => {
    const portals = makeInteriorPortals();
    try {
      for (const size of [2, 3, 6, 15]) {
        syncInteriorPortals(portals, route(size), size, 0);
        const half = (size - 1) / 2 + SURFACE_OFFSET;
        for (let side = 0; side < 2; side++) {
          const center = portals.uniforms.uInteriorCenters.value[side];
          const normal = side === 0 ? portals.path.nStart : portals.path.nEnd;
          expect(center.dot(normal)).toBeCloseTo(half, 7);
          expect(portals.mouths[side].position.distanceTo(center)).toBe(0);
          expect(new THREE.Vector3(0, 0, 1).applyQuaternion(portals.mouths[side].quaternion)
            .distanceTo(portals.uniforms.uInteriorAxes.value[side])).toBeLessThan(1e-10);
        }
        expect(portals.mouths[0].geometry.parameters.openEnded).toBe(true);
      }
      syncInteriorPortals(portals, null, 3, 0);
      expect(portals.uniforms.uInteriorOpen.value).toBe(0);
      expect(portals.mouths.every(mesh => !mesh.visible)).toBe(true);
    } finally { portals.dispose(); }
  });
});
