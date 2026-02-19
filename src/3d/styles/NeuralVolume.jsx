// NeuralVolume.jsx — volumetric neural network for the 'neural' tile style
//
// Three layers in local +Z space:
//   1. Sticker base: neural floor (axon web, soma nodes — existing shader)
//   2. Synapse body (transparent box): dark interior with drifting signal pulses
//   3. Soma cloud (instanced spheres): 24 pulsing nodes floating at various heights
//      above the surface, each firing at its own rate
//   4. Signal layer (top plane): high-contrast synaptic arcs with traveling sparks

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from './TileStyleMaterials.jsx';

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

export default function NeuralVolume({ faceColor }) {
  const meshRef = useRef();

  const neuCol = useMemo(() => {
    const fc = new THREE.Color(faceColor || '#3b82f6');
    const nc = new THREE.Color(0.10, 0.28, 0.85);
    nc.lerp(fc, 0.35);
    return nc;
  }, [faceColor]);

  const bodyMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { neuColor: { value: neuCol }, time: sharedUniforms.time },
    vertexShader: bodyVertexShader, fragmentShader: bodyFragmentShader,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  }), [neuCol]);

  // somaMat is intentionally stable (no neuCol dep) so that the instancedMesh
  // args never change — R3F destroys and recreates the underlying Three.js object
  // when args change, which would discard the instance matrices set below.
  // Color updates are pushed imperatively via the useEffect that follows.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const somaMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { neuColor: { value: neuCol.clone() }, time: sharedUniforms.time },
    vertexShader: somaVertexShader, fragmentShader: somaFragmentShader,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []); // mount-only — color kept in sync below

  // Sync colour uniform without recreating the material (and thus the mesh)
  useEffect(() => {
    somaMat.uniforms.neuColor.value.copy(neuCol);
  }, [neuCol, somaMat]);

  const signalMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { neuColor: { value: neuCol }, time: sharedUniforms.time },
    vertexShader: signalVertexShader, fragmentShader: signalFragmentShader,
    transparent: true, side: THREE.FrontSide, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [neuCol]);

  const bodyGeo  = useMemo(() => new THREE.BoxGeometry(NEU_W, NEU_W, NEU_D), []);
  const somaGeo  = useMemo(() => new THREE.IcosahedronGeometry(0.028, 1), []);
  const planGeo  = useMemo(() => new THREE.PlaneGeometry(NEU_W, NEU_W), []);

  // Build instanced soma nodes with per-instance attributes
  const somaInstGeo = useMemo(() => {
    const geo = somaGeo.clone();
    const phase    = new Float32Array(NODE_COUNT);
    const fireRate = new Float32Array(NODE_COUNT);
    for (let i = 0; i < NODE_COUNT; i++) {
      phase[i]    = Math.random() * Math.PI * 2;
      fireRate[i] = 1.2 + Math.random() * 2.5;
    }
    geo.setAttribute('phase',    new THREE.InstancedBufferAttribute(phase, 1));
    geo.setAttribute('fireRate', new THREE.InstancedBufferAttribute(fireRate, 1));
    return geo;
  }, [somaGeo]);

  // Position nodes randomly in XY, varying Z heights above the surface
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
  }, []);

  return (
    <>
      {/* Synapse volume — dark box with signal pulses on walls */}
      <mesh geometry={bodyGeo} material={bodyMat}
        position={[0, 0, NEU_D / 2 + 0.002]}
        frustumCulled={false} raycast={() => null} />

      {/* Floating soma nodes — pulsing icosahedra at random heights */}
      <instancedMesh ref={meshRef}
        args={[somaInstGeo, somaMat, NODE_COUNT]}
        position={[0, 0, NEU_D / 2 + 0.002]}
        frustumCulled={false} raycast={() => null} />

      {/* Signal arc canopy — top surface with traveling sparks */}
      <mesh geometry={planGeo} material={signalMat}
        position={[0, 0, NEU_D + 0.003]}
        frustumCulled={false} raycast={() => null} />
    </>
  );
}
