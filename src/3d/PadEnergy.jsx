// src/3d/PadEnergy.jsx
//
// Raised flip pads hover a short hop off the cube on an unstable wormhole: a
// twisting energy column fills the gap, a vortex swirls in the slot, arcs crackle
// across and sparks spit off the rim. PadProvider owns where every pad is and
// writes one record per lifted pad; this draws the storm from those records in
// four draws (columns, vortices, arcs, sparks). Nothing is allocated per frame
// and nothing is written back to the game: the sim lands on the rest height.

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createPadStalkGeometry, PAD_BACK_CLEARANCE } from './padStalkGeometry.js';
import { energyHash, padArc, padSpark, ARCS_PER_PAD, ARC_POINTS, SPARKS_PER_SECOND, MAX_ENERGY_PADS } from './padEnergy.js';
import { createStripGeometry, createStripMaterials, createStripWriter } from '../manifold/stormStrips.js';
import { createSparkPool, createSparkMaterial, spawnSpark, stepSparks, clearSparks } from '../manifold/stormSparks.js';

const MAX_ARCS = MAX_ENERGY_PADS * ARCS_PER_PAD;
const MAX_SPARKS = 320;
const ARC_WIDTH = 0.034;

const instancedVertex = `
  attribute float aSeed;
  varying vec3  vLocal;
  varying vec2  vUv;
  varying float vSeed;
  varying vec3  vTint;
  void main() {
    vLocal = position;
    vUv = uv;
    vSeed = aSeed;
    vTint = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

// The column: the stalk's half-twisted funnel, drawn as light. z runs 0 at the
// slot to 1 under the tile, so bands and surges climb out of the cube.
const columnFragment = `
  uniform float uTime;
  uniform float uMotion;
  varying vec3  vLocal;
  varying float vSeed;
  varying vec3  vTint;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float t = uTime * uMotion;
    float h = vLocal.z;
    float ang = atan(vLocal.y, vLocal.x);
    float band = pow(0.5 + 0.5 * sin(ang * 4.0 + h * 11.0 - t * 9.0 + vSeed * 6.2832), 5.0);
    float surge = exp(-pow((h - fract(t * 2.7 + vSeed)) / 0.08, 2.0));
    // Unstable: a stepped flicker that re-rolls 22 times a second.
    float flick = mix(1.0, 0.45 + hash(floor(t * 22.0) + vSeed * 97.0), uMotion);
    // Brightest where the field grips the slot and the tile.
    float ends = 0.45 + 0.55 * max(smoothstep(0.3, 0.0, h), smoothstep(0.75, 1.0, h));
    vec3 hot = mix(vTint, vec3(1.0), 0.6);
    vec3 col = vTint * 0.7 + hot * (band * 1.5 + surge * 1.8);
    float a = clamp((0.22 + band * 0.55 + surge * 0.6) * ends * flick, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
  }
`;

// The vortex in the slot: spiral arms winding into a dark eye, rimmed in light.
const vortexFragment = `
  uniform float uTime;
  uniform float uMotion;
  varying vec2  vUv;
  varying float vSeed;
  varying vec3  vTint;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    vec2  p = vUv * 2.0 - 1.0;
    float r = length(p);
    float t = uTime * uMotion;
    float swirl = pow(0.5 + 0.5 * sin(atan(p.y, p.x) * 3.0 - r * 9.0 + t * 6.0 + vSeed * 6.2832), 2.5);
    float eye = smoothstep(0.62, 0.05, r);
    float flick = mix(1.0, 0.6 + 0.8 * hash(floor(t * 18.0) + vSeed * 53.0), uMotion);
    float edge = smoothstep(0.55, 1.0, max(abs(p.x), abs(p.y)));
    vec3 col = vec3(0.015, 0.012, 0.03);
    col += vTint * swirl * (1.0 - 0.8 * eye) * 1.3 * flick;
    col += mix(vTint, vec3(1.0), 0.5) * edge * 0.8 * flick;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function seededGeometry(geometry, capacity) {
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1));
  return geometry;
}

const _m = new THREE.Matrix4();
const _column = new THREE.Matrix4();
const _stretch = new THREE.Matrix4();
const _basis = new THREE.Matrix3();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _color = new THREE.Color();
const _pts = new Float32Array(ARC_POINTS * 3);
const _spark = { px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, life: 0, size: 0 };

export function PadEnergy({ frames }) {
  const capacity = frames.lift.length;
  const columnRef = useRef(), vortexRef = useRef();
  const res = useMemo(() => {
    const uniforms = { uTime: { value: 0 }, uMotion: { value: 1 } };
    const stripGeo = createStripGeometry(MAX_ARCS);
    const sparks = createSparkPool(MAX_SPARKS);
    return {
      uniforms,
      columnGeo: seededGeometry(createPadStalkGeometry(), capacity),
      vortexGeo: seededGeometry(new THREE.PlaneGeometry(0.76, 0.76), capacity),
      columnMat: new THREE.ShaderMaterial({ uniforms, vertexShader: instancedVertex, fragmentShader: columnFragment,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      vortexMat: new THREE.ShaderMaterial({ uniforms, vertexShader: instancedVertex, fragmentShader: vortexFragment,
        side: THREE.DoubleSide }),
      stripGeo,
      stripMats: createStripMaterials(),
      writer: createStripWriter(stripGeo, MAX_ARCS),
      sparks,
      sparkMat: createSparkMaterial(),
      sparkClock: { acc: 0, n: 0 }
    };
  }, [capacity]);

  useEffect(() => () => {
    for (const k of ['columnGeo', 'vortexGeo', 'columnMat', 'vortexMat', 'stripGeo', 'sparkMat']) res[k].dispose();
    res.stripMats.lit.dispose();
    res.stripMats.xray.dispose();
    res.sparks.geo.dispose();
  }, [res]);

  useFrame((state) => {
    const column = columnRef.current, vortex = vortexRef.current;
    if (!column || !vortex) return;
    const n = Math.min(frames.count, capacity);
    const motion = frames.motion > 0;
    res.uniforms.uTime.value = frames.time;
    res.uniforms.uMotion.value = motion ? 1 : 0;
    const columnSeeds = res.columnGeo.attributes.aSeed.array, vortexSeeds = res.vortexGeo.attributes.aSeed.array;
    res.writer.begin();
    for (let i = 0; i < n; i++) {
      _m.fromArray(frames.matrix, i * 16);
      const lift = frames.lift[i], seed = frames.seed[i];
      _color.setRGB(frames.color[i * 3], frames.color[i * 3 + 1], frames.color[i * 3 + 2]);
      // The column fills only the gap: narrow in the slot, flaring to the tile.
      _column.copy(_m).multiply(_stretch.makeScale(1, 1, Math.max(0.001, lift - PAD_BACK_CLEARANCE)));
      column.setMatrixAt(i, _column);
      column.setColorAt(i, _color);
      vortex.setMatrixAt(i, _m);
      vortex.setColorAt(i, _color);
      columnSeeds[i] = vortexSeeds[i] = energyHash(seed, 7);
      // Every pad gets a column, while the expensive arcs keep a fixed budget.
      if (!motion || i >= MAX_ENERGY_PADS) continue;
      for (let a = 0; a < ARCS_PER_PAD; a++) {
        const glow = padArc(_pts, a, frames.time, seed, lift);
        if (glow <= 0) continue;
        const s = res.writer.open();
        if (s < 0) break;
        for (let k = 0; k < ARC_POINTS; k++) {
          _p.fromArray(_pts, k * 3).applyMatrix4(_m);
          const taper = Math.sin((Math.PI * k) / (ARC_POINTS - 1));
          res.writer.point(s, k, _p.x, _p.y, _p.z, ARC_WIDTH * (0.6 + 0.4 * taper), glow,
            0.35 + 0.65 * _color.r, 0.35 + 0.65 * _color.g, 0.35 + 0.65 * _color.b, 1, 0);
        }
        res.writer.close(s, ARC_POINTS);
      }
    }
    res.writer.end();
    column.count = vortex.count = n;
    column.instanceMatrix.needsUpdate = vortex.instanceMatrix.needsUpdate = true;
    if (column.instanceColor) column.instanceColor.needsUpdate = true;
    if (vortex.instanceColor) vortex.instanceColor.needsUpdate = true;
    res.columnGeo.attributes.aSeed.needsUpdate = res.vortexGeo.attributes.aSeed.needsUpdate = true;

    // Sparks spread round-robin over the pads, a steady rate per pad.
    const clock = res.sparkClock;
    if (motion && n > 0) {
      clock.acc = Math.min(clock.acc + frames.dt * SPARKS_PER_SECOND * n, 24);
      for (; clock.acc >= 1; clock.acc -= 1, clock.n++) {
        const i = clock.n % n;
        _m.fromArray(frames.matrix, i * 16);
        padSpark(_spark, clock.n, frames.seed[i], frames.lift[i]);
        _p.set(_spark.px, _spark.py, _spark.pz).applyMatrix4(_m);
        _v.set(_spark.vx, _spark.vy, _spark.vz).applyMatrix3(_basis.setFromMatrix4(_m));
        spawnSpark(res.sparks, _p.x, _p.y, _p.z, _v.x, _v.y, _v.z, _spark.life, _spark.size,
          0.5 + 0.5 * frames.color[i * 3], 0.5 + 0.5 * frames.color[i * 3 + 1], 0.5 + 0.5 * frames.color[i * 3 + 2],
          { drag: 2.6, gravity: 3.2 });
      }
    } else {
      clock.acc = 0;
      if (!motion && res.sparks.live > 0) clearSparks(res.sparks);
    }
    stepSparks(res.sparks, frames.dt);
    const cam = state.camera;
    const fov = cam?.isPerspectiveCamera ? cam.fov : 50;
    res.sparkMat.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
  }, -0.45);

  return <group>
    <instancedMesh ref={columnRef} args={[res.columnGeo, res.columnMat, capacity]} count={0} frustumCulled={false} raycast={() => null} dispose={null} renderOrder={4} />
    <instancedMesh ref={vortexRef} args={[res.vortexGeo, res.vortexMat, capacity]} count={0} frustumCulled={false} raycast={() => null} dispose={null} />
    <mesh geometry={res.stripGeo} material={res.stripMats.lit} frustumCulled={false} renderOrder={5} raycast={() => null} dispose={null} />
    <points geometry={res.sparks.geo} material={res.sparkMat} frustumCulled={false} renderOrder={6} raycast={() => null} dispose={null} />
  </group>;
}
