// NeuralVolume.jsx — volumetric neural network for the 'neural' tile style
//
// Three layers in local +Z space:
//   1. Sticker base: neural floor (axon web, soma nodes — existing shader)
//   2. Synapse body (transparent box): dark interior with drifting signal pulses
//   3. Soma cloud (instanced spheres): 24 pulsing nodes floating at various heights
//      above the surface, each firing at its own rate
//   4. Signal layer (top plane): high-contrast synaptic arcs with traveling sparks

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { sharedUniforms, getVolumeResource } from './TileStyleMaterials.jsx';

const NEU_W      = 0.78;
const NEU_D      = 0.14;
const NODE_COUNT = 24;

// ─── Synapse body shaders ─────────────────────────────────────────────────────

const bodyVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv     = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const bodyFragmentShader = `
  uniform vec3  neuColor;
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main() {
    // Traveling signal bands — bright pulses sweeping across walls
    float band1 = sin(vUv.x * 8.0 + vUv.y * 3.0 - time * 3.5) * 0.5 + 0.5;
    float band2 = sin(vUv.x * 5.0 - vUv.y * 7.0 + time * 2.8) * 0.5 + 0.5;
    float signal = pow(band1 * band2, 4.0) * 3.5;

    // Axon threads on walls
    float n = noise(vUv * 9.0 + time * 0.08);
    float axon = smoothstep(0.72, 0.78, abs(sin(vUv.x * 12.0 + n*2.5))
                                      * abs(sin(vUv.y * 10.0 + n*1.8)));

    // Deep blue-dark background
    vec3 bg  = mix(vec3(0.01, 0.02, 0.10), neuColor * 0.15, 0.55);
    vec3 col = bg;
    col += neuColor * 0.55 * axon;
    col += neuColor * signal * 0.80;
    col += vec3(0.45, 0.70, 1.0) * signal * 0.55;

    // Rim brightening
    float rim = 1.0 - abs(dot(normalize(vNormal), vec3(0,0,1)));
    col += neuColor * rim * 0.20;

    gl_FragColor = vec4(col, 0.48);
  }
`;

// ─── Floating soma node shaders (instanced spheres) ───────────────────────────

const somaVertexShader = `
  uniform float time;
  attribute float phase;    // per-node phase offset
  attribute float fireRate; // how fast this node fires
  varying float vPulse;
  varying vec3  vWorldNormal;

  void main() {
    vWorldNormal = normalize(normalMatrix * normal);

    // Subtle pulsing scale per node
    float pulse = sin(time * fireRate + phase) * 0.5 + 0.5;
    vPulse = pulse;

    vec3 pos = position * (0.80 + pulse * 0.40);

    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(pos, 1.0));
  }
`;

const somaFragmentShader = `
  uniform vec3  neuColor;
  varying float vPulse;
  varying vec3  vWorldNormal;

  void main() {
    // Core bright when firing
    vec3 col = mix(neuColor * 0.30, neuColor * 1.60, vPulse);
    col += vec3(0.35, 0.60, 1.0) * vPulse * 0.60;

    // Rim glow
    float rim = 1.0 - abs(dot(normalize(vWorldNormal), vec3(0,0,1)));
    col += vec3(0.50, 0.75, 1.0) * rim * 0.50;

    float alpha = 0.55 + vPulse * 0.40;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Signal arc surface shaders ───────────────────────────────────────────────

const signalVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const signalFragmentShader = `
  uniform vec3  neuColor;
  uniform float time;
  varying vec2  vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    v += 0.500*noise(p); p *= 2.01;
    v += 0.250*noise(p); p *= 2.02;
    v += 0.125*noise(p); p *= 2.03;
    v += 0.063*noise(p);
    return v;
  }

  void main() {
    vec2 uv = vUv * 6.0;
    float warp = fbm(uv * 0.7 + time * 0.05);

    // Axon web: interference of curved sine fields
    float a1 = abs(sin(uv.x * 4.5 + warp * 2.8));
    float a2 = abs(sin(uv.y * 4.0 + warp * 2.2));
    float web = smoothstep(0.85, 0.93, a1) + smoothstep(0.85, 0.93, a2);

    // Traveling signal spark along the web
    float spark = web * (sin(uv.x * 4.5 + uv.y * 3.5 - time * 3.5) * 0.5 + 0.5);
    spark = pow(spark, 1.5);

    vec3 col = neuColor * 0.65 * web;
    col += vec3(0.55, 0.80, 1.0) * spark * 0.90;

    // Soma glow spots
    vec2 cell = floor(uv);
    vec2 f    = fract(uv);
    float soma = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 n   = vec2(float(x), float(y));
        vec2 pos = n + vec2(hash(cell+n), hash(cell+n+50.0));
        float d  = length(f - pos);
        float hz = 1.6 + hash(cell+n+20.0) * 2.0;
        float ph = hash(cell+n) * 6.28;
        soma += smoothstep(0.18, 0.0, d) * (sin(time*hz+ph)*0.5+0.5);
      }
    }
    col += neuColor * soma * 0.90;
    col += vec3(0.45, 0.70, 1.0) * soma * 0.50;

    float alpha = min(0.95, (web * 0.55 + spark * 0.75 + soma * 0.65));
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

const neuColorFor = (faceColor) => {
  const fc = new THREE.Color(faceColor || '#3b82f6');
  const nc = new THREE.Color(0.10, 0.28, 0.85);
  nc.lerp(fc, 0.35);
  return nc;
};

// Geometries/materials shared across all stickers via getVolumeResource —
// materials vary only by face colour, geometries (including the per-instance
// phase/fireRate attributes) not at all.  Soma pulse phases are therefore the
// same on every neural tile, but the node *positions* stay per-tile random
// (set per instancedMesh below), so tiles still read as distinct.
// Meshes set dispose={null} so R3F never disposes the shared resources.
export default function NeuralVolume({ faceColor }) {
  const meshRef = useRef();
  const colorKey = faceColor || '#3b82f6';

  const bodyMat = getVolumeResource(`neural_bodyMat_${colorKey}`, () => new THREE.ShaderMaterial({
    uniforms: { neuColor: { value: neuColorFor(colorKey) }, time: sharedUniforms.time },
    vertexShader: bodyVertexShader, fragmentShader: bodyFragmentShader,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  }));

  const somaMat = getVolumeResource(`neural_somaMat_${colorKey}`, () => new THREE.ShaderMaterial({
    uniforms: { neuColor: { value: neuColorFor(colorKey) }, time: sharedUniforms.time },
    vertexShader: somaVertexShader, fragmentShader: somaFragmentShader,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));

  const signalMat = getVolumeResource(`neural_signalMat_${colorKey}`, () => new THREE.ShaderMaterial({
    uniforms: { neuColor: { value: neuColorFor(colorKey) }, time: sharedUniforms.time },
    vertexShader: signalVertexShader, fragmentShader: signalFragmentShader,
    transparent: true, side: THREE.FrontSide, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));

  const bodyGeo = getVolumeResource('neural_bodyGeo', () => new THREE.BoxGeometry(NEU_W, NEU_W, NEU_D));
  const planGeo = getVolumeResource('neural_planGeo', () => new THREE.PlaneGeometry(NEU_W, NEU_W));

  // Instanced soma nodes with per-instance attributes
  const somaInstGeo = getVolumeResource('neural_somaInstGeo', () => {
    const geo = new THREE.IcosahedronGeometry(0.028, 1);
    const phase    = new Float32Array(NODE_COUNT);
    const fireRate = new Float32Array(NODE_COUNT);
    for (let i = 0; i < NODE_COUNT; i++) {
      phase[i]    = Math.random() * Math.PI * 2;
      fireRate[i] = 1.2 + Math.random() * 2.5;
    }
    geo.setAttribute('phase',    new THREE.InstancedBufferAttribute(phase, 1));
    geo.setAttribute('fireRate', new THREE.InstancedBufferAttribute(fireRate, 1));
    return geo;
  });

  // Position nodes randomly in XY, varying Z heights above the surface.
  // somaMat changes identity when faceColor changes, which makes R3F recreate
  // the instancedMesh (args change) — so this effect must re-run on somaMat to
  // repopulate the new mesh's instance matrices.
  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const half = NEU_W / 2 - 0.05;
    for (let i = 0; i < NODE_COUNT; i++) {
      dummy.position.set(
        (Math.random() * 2 - 1) * half,
        (Math.random() * 2 - 1) * half,
        0.01 + Math.random() * (NEU_D - 0.02)
      );
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      dummy.scale.setScalar(0.7 + Math.random() * 0.6);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [somaMat]);

  return (
    <>
      {/* Synapse volume — dark box with signal pulses on walls */}
      <mesh geometry={bodyGeo} material={bodyMat} dispose={null}
        position={[0, 0, NEU_D / 2 + 0.002]}
        frustumCulled={false} raycast={() => null} />

      {/* Floating soma nodes — pulsing icosahedra at random heights */}
      <instancedMesh ref={meshRef}
        args={[somaInstGeo, somaMat, NODE_COUNT]} dispose={null}
        position={[0, 0, NEU_D / 2 + 0.002]}
        frustumCulled={false} raycast={() => null} />

      {/* Signal arc canopy — top surface with traveling sparks */}
      <mesh geometry={planGeo} material={signalMat} dispose={null}
        position={[0, 0, NEU_D + 0.003]}
        frustumCulled={false} raycast={() => null} />
    </>
  );
}
