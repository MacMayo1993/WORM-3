import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  orbProximity, orbPerkInto, beaconPoseInto, beaconTexture, createOrbBeacons,
  PROXIMITY_FAR, PROXIMITY_NEAR, PING_PERIOD
} from '../worm/orbBeacon.js';
import { PARITY_ORB_GEOMETRIES } from '../worm/parityOrbGeometries.js';
import { PARITY_ORB_SCALE } from '../worm/healerWorm/constants.js';
import { getOrbMaterials } from '../worm/orbMaterials.js';

describe('parity orb size', () => {
  it('is 15% smaller than the original design, every part in proportion', () => {
    expect(PARITY_ORB_SCALE).toBe(0.85);
    const radius = geometry => { geometry.computeBoundingSphere(); return geometry.boundingSphere.radius; };
    expect(radius(PARITY_ORB_GEOMETRIES.normal.shell)).toBeCloseTo(0.21 * 0.85, 4);
    expect(radius(PARITY_ORB_GEOMETRIES.normal.innerCore)).toBeCloseTo(0.115 * 0.85, 4);
    expect(radius(PARITY_ORB_GEOMETRIES.target.shell)).toBeCloseTo(0.27 * 0.85, 4);
    // Torus: outer radius = ring radius + tube.
    expect(radius(PARITY_ORB_GEOMETRIES.normal.ringA)).toBeCloseTo((0.37 + 0.011) * 0.85, 3);
    // The merged cage is built from the scaled pieces, not scaled twice.
    expect(radius(PARITY_ORB_GEOMETRIES.normal.cage)).toBeLessThan(0.32 * 0.85);
    expect(radius(PARITY_ORB_GEOMETRIES.normal.cage)).toBeGreaterThan(0.27 * 0.85);
  });
});

describe('glass shell rim', () => {
  it('patches every shell with one shared rim program', () => {
    const a = getOrbMaterials('#ff0000', '#00ff00', false).shell;
    const b = getOrbMaterials('#0000ff', '#ffff00', true).shell;
    expect(a.customProgramCacheKey()).toBe('parity-orb-rim');
    expect(b.customProgramCacheKey()).toBe(a.customProgramCacheKey());
    const shader = { fragmentShader: 'void main(){\n#include <emissivemap_fragment>\n}', vertexShader: '', uniforms: {} };
    a.onBeforeCompile(shader);
    expect(shader.fragmentShader).toContain('orbRim');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += emissive * orbRim');
  });
});

describe('orb proximity', () => {
  it('sleeps far away, wakes fully up close, and rises monotonically between', () => {
    expect(orbProximity(PROXIMITY_FAR + 1)).toBe(0);
    expect(orbProximity(PROXIMITY_NEAR - 0.1)).toBe(1);
    let prev = -1;
    for (let d = PROXIMITY_FAR; d >= PROXIMITY_NEAR; d -= 0.05) {
      const v = orbProximity(d);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('swells and spins faster near the worm, but holds still under reduced motion', () => {
    expect(orbPerkInto({}, 0)).toEqual({ scale: 1, spin: 1 });
    const near = orbPerkInto({}, 1);
    expect(near.scale).toBeGreaterThan(1.1);
    expect(near.spin).toBeGreaterThan(2);
    expect(orbPerkInto({}, 1, true).scale).toBe(1);
  });
});

describe('tile beacon', () => {
  it('fades in with the orb and brightens as the worm nears', () => {
    const far = beaconPoseInto({}, 0, 0, 1);
    const close = beaconPoseInto({}, 0, 1, 1);
    expect(close.ringIntensity).toBeGreaterThan(far.ringIntensity);
    expect(close.ringScale).toBeGreaterThan(far.ringScale);
    expect(beaconPoseInto({}, 0, 1, 0).ringIntensity).toBe(0);
  });

  it('pings only when the worm is close and the orb has arrived, never under reduced motion', () => {
    expect(beaconPoseInto({}, 0.2, 0, 1).pingVisible).toBe(false);
    expect(beaconPoseInto({}, 0.2, 1, 0.5).pingVisible).toBe(false);
    expect(beaconPoseInto({}, 0.2, 1, 1, true).pingVisible).toBe(false);
    const early = beaconPoseInto({}, PING_PERIOD * 0.1, 1, 1);
    const late = beaconPoseInto({}, PING_PERIOD * 0.8, 1, 1);
    expect(early.pingVisible).toBe(true);
    expect(late.pingScale).toBeGreaterThan(early.pingScale);
    expect(late.pingIntensity).toBeLessThan(early.pingIntensity);
  });

  it('draws a coloured band over a soft dark contact shadow, clear at the corners', () => {
    const tex = beaconTexture();
    const n = tex.image.width, data = tex.image.data;
    const at = (r, c) => data[((n / 2) * n + Math.round(n / 2 + (r * n) / 2 - 0.5)) * 4 + c];
    expect(at(0.7, 3)).toBeGreaterThan(200);      // band: opaque…
    expect(at(0.7, 0)).toBeGreaterThan(200);      // …and takes the instance colour
    expect(at(0.7, 3)).toBeGreaterThan(at(0.3, 3));
    expect(at(0.84, 3)).toBeGreaterThan(40);      // shadow: partly covered…
    expect(at(0.84, 0)).toBeLessThan(90);         // …and dark
    expect(data[3]).toBe(0);                      // corner
    expect(beaconTexture()).toBe(tex);
  });

  it('patches opacity per instance into one shared program', () => {
    const beacons = createOrbBeacons(4);
    const material = beacons.mesh.material;
    expect(material.customProgramCacheKey()).toBe('orb-beacon');
    const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' };
    material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('vBeaconIntensity = aIntensity');
    expect(shader.fragmentShader).toContain('diffuseColor.a *= vBeaconIntensity');
    // One pass: a transparent double-sided material would otherwise draw twice a
    // frame and re-select its program each time.
    expect(material.forceSinglePass).toBe(true);
    expect(beacons.mesh.renderOrder).toBeGreaterThan(-1);
    expect(beacons.mesh.renderOrder).toBeLessThan(0);
    beacons.dispose();
  });

  it('batches every beacon into one instanced draw, skipping dark ones and respecting capacity', () => {
    const beacons = createOrbBeacons(2);
    const up = new THREE.Vector3(0, 0, 1);
    beacons.begin();
    beacons.add(new THREE.Vector3(1, 2, 3), up, 0.5, '#ff0000', 0.5);
    beacons.add(new THREE.Vector3(0, 0, 0), up, 0.5, '#00ff00', 0);
    beacons.add(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), 0.5, '#0000ff', 1);
    beacons.add(new THREE.Vector3(0, 0, 0), up, 0.5, '#ffffff', 1); // over capacity
    beacons.end();
    expect(beacons.count).toBe(2);
    expect(beacons.mesh.count).toBe(2);
    expect(beacons.mesh.visible).toBe(true);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    beacons.mesh.getMatrixAt(0, m); m.decompose(p, q, s);
    expect(p.toArray()).toEqual([1, 2, 3]);
    expect(s.x).toBeCloseTo(0.5);
    const c = new THREE.Color();
    beacons.mesh.getColorAt(0, c);
    expect(c.getHex()).toBe(0xff0000);
    expect(beacons.mesh.geometry.getAttribute('aIntensity').array[0]).toBeCloseTo(0.5);
    expect(beacons.mesh.geometry.getAttribute('aIntensity').array[1]).toBe(1);
    // A beacon on a side face lies flat on that face.
    beacons.mesh.getMatrixAt(1, m); m.decompose(p, q, s);
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(q).x).toBeCloseTo(1);
    beacons.begin(); beacons.end();
    expect(beacons.mesh.visible).toBe(false);
    beacons.dispose();
  });
});
