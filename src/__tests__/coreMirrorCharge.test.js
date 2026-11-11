import { describe, expect, it } from 'vitest';
import { Color, Vector3 } from 'three';
import { makeCoreMirrorCharge, updateCoreMirrorCharge } from '../3d/coreMirrorCharge.js';
import { createCoreMirrorRoom, createCoreMirrorProbe } from '../3d/coreMirrorRoom.js';
import { CORE_MIRROR_HALF, makeCorePassage } from '../3d/corePassage.js';
import { Scene, WebGLCoordinateSystem } from 'three';

const tunnel = {
  entry: { x: 1, y: 1, z: 2, dirKey: 'PZ' },
  exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' },
  entryColor: 1, exitColor: 2
};
const palette = { 1: '#39c8ff', 2: '#ff8c35' };
const values = charge => Object.fromEntries(Object.entries(charge.uniforms).map(([key, { value }]) =>
  [key, value.toArray ? value.toArray() : value]));
const update = (charge, t, options) => updateCoreMirrorCharge(charge, tunnel, 3, palette, t, options);

describe('charged mirror traversal', () => {
  it('gathers entrance and destination colours, makes one broad exchange and resolves at the exit', () => {
    const charge = makeCoreMirrorCharge(), u = charge.uniforms;
    update(charge, 0);
    expect(u.uChargeColorA.value.equals(new Color(palette[1]))).toBe(true);
    expect(u.uChargeColorB.value.equals(new Color(palette[2]))).toBe(true);
    expect(u.uChargeEntry.value.toArray()).toEqual([0, 0, 1]);
    expect(u.uChargeExit.value.toArray()).toEqual([0, 0, -1]);
    expect(u.uChargeLevel.value).toBe(.18);
    const samples = [];
    for (let i = 0; i <= 100; i++) {
      update(charge, .4 + i * .002);
      samples.push(u.uChargeDischarge.value);
    }
    expect(samples[0]).toBe(0); expect(samples.at(-1)).toBe(0);
    expect(Math.max(...samples)).toBeCloseTo(1);
    const rises = samples.filter((value, i) => i && value > samples[i - 1]);
    const falls = samples.filter((value, i) => i && value < samples[i - 1]);
    expect(rises.length).toBeGreaterThan(15);
    expect(falls.length).toBeGreaterThan(15);
    expect(samples.filter((value, i) => i && i < 100 && value > samples[i - 1] && value > samples[i + 1])).toHaveLength(1);
    expect(u.uChargeExchange.value).toBe(1);
    expect(u.uChargeProgress.value).toBeCloseTo(1);
    update(charge, 1);
    expect(u.uChargeLevel.value).toBe(.18);
    update(charge, .5, { active: false });
    expect(u.uChargeLevel.value).toBe(.18);
    expect(u.uChargeDischarge.value).toBe(0);
  });

  it.each(['reducedMotion', 'reduceFlashing'])('%s gives steady, softly coloured seams throughout a ride', setting => {
    const charge = makeCoreMirrorCharge();
    update(charge, .4, { [setting]: true });
    const first = values(charge);
    for (const t of [.43, .5, .52, .6, .8]) {
      update(charge, t, { [setting]: true });
      expect(values(charge)).toEqual(first);
    }
    expect(charge.uniforms.uChargeDischarge.value).toBe(0);
    expect(charge.uniforms.uChargeCalm.value).toBe(1);
    expect(charge.uniforms.uChargeLevel.value).toBeLessThan(.4);
  });

  it('freezes on pause, resumes from simulation progress, but honors reset and preference changes immediately', () => {
    const charge = makeCoreMirrorCharge();
    update(charge, .475);
    const first = values(charge);
    for (let i = 0; i < 10; i++) update(charge, .55, { paused: true });
    expect(values(charge)).toEqual(first);
    update(charge, .55);
    expect(values(charge)).not.toEqual(first);
    update(charge, .5, { paused: true, reduceFlashing: true });
    expect(charge.uniforms.uChargeCalm.value).toBe(1);
    updateCoreMirrorCharge(charge, null, 3, palette, .5, { paused: true });
    expect(charge.uniforms.uChargeLevel.value).toBe(0);
    expect(charge.uniforms.uChargeDischarge.value).toBe(0);
    update(charge, .4, { paused: true });
    expect(charge.uniforms.uChargeProgress.value).toBe(0);
  });

  it('handles reversed/corner rides, repeated trips, board and palette changes without stale polarity', () => {
    const charge = makeCoreMirrorCharge();
    update(charge, .55);
    const a = charge.uniforms.uChargeColorA.value.clone();
    const reverse = { entry: tunnel.exit, exit: tunnel.entry, entryColor: 2, exitColor: 1 };
    updateCoreMirrorCharge(charge, reverse, 3, palette, .4, { paused: true });
    expect(charge.uniforms.uChargeProgress.value).toBe(0);
    expect(charge.uniforms.uChargeExit.value.toArray()).toEqual([0, 0, 1]);
    expect(charge.uniforms.uChargeColorB.value.equals(a)).toBe(true);
    for (const size of [2, 3, 5, 15]) {
      const corner = { ...tunnel, entry: { x: size - 1, y: size - 1, z: 0, dirKey: 'PX' } };
      updateCoreMirrorCharge(charge, corner, size, { 1: '#fff', 2: '#f00' }, .5);
      const p = charge.uniforms.uChargeEntry.value;
      expect(p.x).toBeCloseTo(1); expect(p.y).toBeGreaterThan(0); expect(p.z).toBeLessThan(0);
      expect(Math.max(...p.toArray().map(Math.abs))).toBeCloseTo(1);
      expect(charge.uniforms.uChargeColorA.value.getHex()).toBe(0xffffff);
    }
  });

  it('anchors charge to the actual zoomed room crossings without advancing the paused event', () => {
    const charge = makeCoreMirrorCharge();
    update(charge, .47);
    const progress = charge.uniforms.uChargeProgress.value;
    const passageEnds = { active: true, entry: new Vector3(.02, .03, CORE_MIRROR_HALF),
      exit: new Vector3(-CORE_MIRROR_HALF, .08, -.04) };
    update(charge, .56, { paused: true, passageEnds });
    expect(charge.uniforms.uChargeProgress.value).toBe(progress);
    expect(charge.uniforms.uChargeEntry.value.toArray()).toEqual(passageEnds.entry.clone().divideScalar(CORE_MIRROR_HALF).toArray());
    expect(charge.uniforms.uChargeExit.value.toArray()).toEqual(passageEnds.exit.clone().divideScalar(CORE_MIRROR_HALF).toArray());
    expect(passageEnds.entry.z).toBe(CORE_MIRROR_HALF);
  });

  it('clamps malformed progress and uses only existing render objects/uniforms', () => {
    const room = createCoreMirrorRoom(3, makeCorePassage().uniforms);
    try {
      const identities = Object.values(room.charge.uniforms);
      for (const t of [NaN, Infinity, -Infinity, -10, 10]) {
        update(room.charge, t);
        for (const { value } of identities) if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        expect(Object.values(room.charge.uniforms)).toEqual(identities);
      }
      expect(room.group.children).toHaveLength(2);
      expect(room.material.uniforms.uChargeProgress).toBe(room.charge.uniforms.uChargeProgress);
      expect(room.material.fragmentShader).toContain('mirrorCharge(vMirrorUv');
      expect(room.material.extensions.derivatives).toBe(true);
      expect(room.material.fragmentShader).not.toContain('uTime');
    } finally { room.dispose(); }
  });

  it('dims reflection echoes within the existing capture budget and restores direct brightness after an error', () => {
    const room = createCoreMirrorRoom(3, makeCorePassage().uniforms), probe = createCoreMirrorProbe(16);
    const scene = new Scene(); scene.add(room.group);
    let draws = 0;
    const renderer = { coordinateSystem: WebGLCoordinateSystem, xr: { enabled: false },
      getRenderTarget: () => null, setRenderTarget() {},
      render() { draws++; expect(room.uniforms.uChargeCapture.value).toBe(1); } };
    try {
      probe.capture(renderer, scene, room, { faces: 2 });
      expect(draws).toBe(2);
      expect(room.uniforms.uChargeCapture.value).toBe(0);
      renderer.render = () => { throw Error('interrupted capture'); };
      expect(() => probe.capture(renderer, scene, room, { faces: 2 })).toThrow('interrupted capture');
      expect(room.uniforms.uChargeCapture.value).toBe(0);
    } finally { room.dispose(); probe.dispose(); }
  });
});
