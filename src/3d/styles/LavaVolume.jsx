// LavaVolume.jsx — volumetric molten lava for the 'lava' tile style
//
// Three layers in local +Z space:
//   1. Sticker base: lava floor shader (crusted, flowing)
//   2. Lava body (box mesh): semi-transparent glow, convection heat shimmer on walls
//   3. Lava surface (displaced plane): FBM-bubbling vertex displacement, specular on hot spots
//   4. Embers (instanced sprites): 36 tiny glowing particles floating upward

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from './TileStyleMaterials.jsx';

const LAVA_W  = 0.78;
const LAVA_D  = 0.10;
const SURF_SEGS = 16;
const EMBER_COUNT = 36;

// ─── Lava body shaders ────────────────────────────────────────────────────────

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
  uniform vec3  lavaColor;
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
  float fbm(vec2 p) {
    float v = 0.0;
    v += 0.500 * noise(p); p *= 2.01;
    v += 0.250 * noise(p); p *= 2.02;
    v += 0.125 * noise(p); p *= 2.03;
    v += 0.063 * noise(p);
    return v;
  }

  void main() {
    // Convection columns: bright upwelling streaks
    float flow  = fbm(vec2(vUv.x * 4.0, vUv.y * 2.0 - time * 0.35));
    float flow2 = fbm(vec2(vUv.x * 3.5 + 0.7, vUv.y * 1.8 + time * 0.28));
    float hot   = pow(flow * flow2, 1.6) * 4.2;

    vec3 col = lavaColor;
    // Bright yellow-white hot spots
    col = mix(col, vec3(1.0, 0.85, 0.3), hot * 0.55);
    col = mix(col, vec3(1.0, 1.0, 0.9), pow(hot, 3.0) * 0.40);

    // Internal Fresnel — walls facing away from view glow brighter
    float rim = 1.0 - abs(dot(normalize(vNormal), vec3(0,0,1)));
    col += lavaColor * rim * 0.30;

    gl_FragColor = vec4(col, 0.52);
  }
`;

// ─── Lava surface shaders ─────────────────────────────────────────────────────

const surfaceVertexShader = `
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewPosition;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    v += 0.500 * noise(p); p *= 2.01;
    v += 0.250 * noise(p); p *= 2.02;
    v += 0.125 * noise(p); p *= 2.03;
    v += 0.063 * noise(p);
    return v;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Bubbling: FBM-based upward displacement
    float bubble1 = fbm(pos.xy * 5.0 + time * 0.40) * 0.018;
    float bubble2 = fbm(pos.xy * 8.0 - time * 0.30) * 0.010;
    float bubble3 = noise(pos.xy * 14.0 + time * 0.70) * 0.006;
    pos.z += bubble1 + bubble2 + bubble3;

    // Approximate normal from partial derivatives
    float dx = (fbm((pos.xy + vec2(0.01,0)) * 5.0 + time*0.40)
              - fbm((pos.xy - vec2(0.01,0)) * 5.0 + time*0.40)) * 0.5 / 0.01;
    float dy = (fbm((pos.xy + vec2(0,0.01)) * 5.0 + time*0.40)
              - fbm((pos.xy - vec2(0,0.01)) * 5.0 + time*0.40)) * 0.5 / 0.01;
    vNormal = normalize(normalMatrix * normalize(vec3(-dx*0.018, -dy*0.018, 1.0)));

    vec4 mvPos    = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPos.xyz;
    gl_Position   = projectionMatrix * mvPos;
  }
`;

const surfaceFragmentShader = `
  uniform vec3  lavaColor;
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewPosition;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    v += 0.500 * noise(p); p *= 2.01;
    v += 0.250 * noise(p); p *= 2.02;
    v += 0.125 * noise(p); p *= 2.03;
    v += 0.063 * noise(p);
    return v;
  }

  void main() {
    vec3 normal  = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Lava flow pattern for coloring hot/cool regions
    float flow = fbm(vUv * 3.5 + time * 0.22);
    float hot  = pow(flow, 2.2);

    // Crust color: mix dark char → hot orange → white-hot
    vec3 crust  = lavaColor * 0.18;
    vec3 molten = lavaColor * 1.2 + vec3(0.25, 0.08, 0.0);
    vec3 blaze  = vec3(1.0, 0.92, 0.5);

    vec3 col = mix(crust, molten, flow);
    col = mix(col, blaze, hot * 0.55);

    // Specular — light glinting off molten puddles
    vec3 lightDir = normalize(vec3(0.4, 0.7, 1.0));
    float spec    = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 16.0);
    col += vec3(1.0, 0.7, 0.3) * spec * 0.70;

    // Emissive rim glow at edges
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
    col += lavaColor * fresnel * 0.60;

    float alpha = 0.72 + fresnel * 0.18;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Ember sprite shaders ─────────────────────────────────────────────────────

const emberVertexShader = `
  uniform float time;
  attribute float phase;    // per-ember float in [0,1]
  attribute float speed;    // drift speed
  attribute vec3  startPos; // origin on sticker surface
  varying float vAlpha;
  varying float vGlow;

  void main() {
    // Life cycle in [0,1] looping, offset by phase
    float t = fract(time * speed + phase);
    // Rise in +Z, gentle lateral drift
    float z = t * 0.22;
    float x = startPos.x + sin(time * 1.3 + phase * 6.28) * 0.04 * t;
    float y = startPos.y + cos(time * 1.1 + phase * 6.28) * 0.03 * t;

    vAlpha = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.65, 1.0, t));
    vGlow  = 1.0 - t;

    vec4 mvPos = modelViewMatrix * vec4(x, y, z, 1.0);
    // Billboard: fixed size in screen space
    gl_PointSize = (3.0 + vGlow * 4.0) * (1.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const emberFragmentShader = `
  uniform vec3  lavaColor;
  varying float vAlpha;
  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    if (d > 1.0) discard;
    float core = 1.0 - smoothstep(0.0, 0.5, d);
    vec3  col  = mix(lavaColor, vec3(1.0, 0.95, 0.7), core * vGlow);
    gl_FragColor = vec4(col, vAlpha * core);
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function LavaVolume({ faceColor }) {
  const emberMeshRef = useRef();

  const lavaCol = useMemo(() => {
    const fc = new THREE.Color(faceColor || '#ef4444');
    const lc = new THREE.Color(0.80, 0.20, 0.02);
    lc.lerp(fc, 0.30);
    return lc;
  }, [faceColor]);

  const bodyMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { lavaColor: { value: lavaCol }, time: sharedUniforms.time },
    vertexShader:   bodyVertexShader,
    fragmentShader: bodyFragmentShader,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  }), [lavaCol]);

  const surfMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { lavaColor: { value: lavaCol }, time: sharedUniforms.time },
    vertexShader:   surfaceVertexShader,
    fragmentShader: surfaceFragmentShader,
    transparent: true, side: THREE.FrontSide, depthWrite: false,
  }), [lavaCol]);

  const emberMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { lavaColor: { value: lavaCol }, time: sharedUniforms.time },
    vertexShader:   emberVertexShader,
    fragmentShader: emberFragmentShader,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [lavaCol]);

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(LAVA_W, LAVA_W, LAVA_D), []);
  const surfGeo = useMemo(
    () => new THREE.PlaneGeometry(LAVA_W, LAVA_W, SURF_SEGS, SURF_SEGS), []
  );

  // Build ember geometry once
  const emberGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(EMBER_COUNT * 3);
    const phase     = new Float32Array(EMBER_COUNT);
    const speed     = new Float32Array(EMBER_COUNT);
    const startPos  = new Float32Array(EMBER_COUNT * 3);
    const half = LAVA_W / 2 - 0.04;
    for (let i = 0; i < EMBER_COUNT; i++) {
      const x = (Math.random() * 2 - 1) * half;
      const y = (Math.random() * 2 - 1) * half;
      positions[i*3]   = x; positions[i*3+1] = y; positions[i*3+2] = 0;
      startPos[i*3]    = x; startPos[i*3+1]  = y; startPos[i*3+2]  = 0;
      phase[i]  = Math.random();
      speed[i]  = 0.3 + Math.random() * 0.4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('phase',    new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('speed',    new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('startPos', new THREE.BufferAttribute(startPos, 3));
    return geo;
  }, []);

  return (
    <>
      {/* Lava body — glowing molten volume */}
      <mesh geometry={bodyGeo} material={bodyMat}
        position={[0, 0, LAVA_D / 2 + 0.002]}
        frustumCulled={false} raycast={() => null} />

      {/* Lava surface — FBM-bubbling displaced plane */}
      <mesh geometry={surfGeo} material={surfMat}
        position={[0, 0, LAVA_D + 0.003]}
        frustumCulled={false} raycast={() => null} />

      {/* Floating embers — additive point sprites */}
      <points ref={emberMeshRef} geometry={emberGeo} material={emberMat}
        position={[0, 0, LAVA_D + 0.004]}
        frustumCulled={false} raycast={() => null} />
    </>
  );
}
