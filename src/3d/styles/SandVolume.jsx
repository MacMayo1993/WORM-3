// SandVolume.jsx — volumetric wind-sculpted desert for the 'sand' tile style
//
// Two layers in local +Z space:
//   1. Sticker base: sand floor shader (existing aeolian ripple pattern)
//   2. Dune surface (16×16 displaced plane): cross-bedded ripple vertex displacement,
//      specular glint on crest ridges, shadow in troughs, heat shimmer at tips
//   3. Blowing dust (point sprites): 50 tiny particles drifting sideways in wind

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from './TileStyleMaterials.jsx';

const SAND_W    = 0.78;
const SURF_SEGS = 20;
const DUST_COUNT = 50;

// ─── Dune surface shaders ─────────────────────────────────────────────────────

const surfaceVertexShader = `
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewPosition;
  varying float vHeight;  // relative crest height for coloring

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
    vUv = uv;
    vec3 pos = position;

    // Two overlapping ripple systems at different scales (cross-bedding)
    float warp1 = fbm(pos.xy * 0.6) * 3.5;
    float warp2 = fbm(pos.xy + 12.0) * 2.0;

    float r1 = sin(pos.x * 9.0 + warp1 - time * 0.18) * 0.5 + 0.5;
    float r2 = sin(pos.x * 4.5 + pos.y * 0.7 + warp2 - time * 0.09) * 0.5 + 0.5;

    float h = r1 * 0.012 + r2 * 0.005;
    pos.z  += h;
    vHeight = h / 0.017;

    // Approximate normal
    float eps = 0.01;
    float r1dx = sin((pos.x+eps)*9.0 + warp1 - time*0.18) * 0.5 + 0.5;
    float r1dy = sin(pos.x*9.0 + warp1 - time*0.18) * 0.5 + 0.5; // same warp
    float dx = (r1dx - r1) * 9.0 * 0.012 / eps;
    float dy = 0.0;
    vNormal = normalize(normalMatrix * normalize(vec3(-dx, -dy, 1.0)));

    vec4 mvPos    = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPos.xyz;
    gl_Position   = projectionMatrix * mvPos;
  }
`;

const surfaceFragmentShader = `
  uniform vec3  sandColor;
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewPosition;
  varying float vHeight;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main() {
    vec3 normal  = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Sand palette: pale gold at crests, darker in troughs
    vec3 paleGold = mix(vec3(0.88, 0.76, 0.52), sandColor * 0.55 + vec3(0.4,0.32,0.18), 0.35);
    vec3 deepTan  = paleGold * 0.58;
    vec3 col      = mix(deepTan, paleGold, vHeight);

    // Shadow deepening in troughs
    col -= pow(1.0 - vHeight, 2.5) * 0.18;

    // Fine grain noise
    col += (noise(vUv * 130.0) - 0.5) * 0.04;

    // Specular glint on crest ridges (wind-polished grains)
    vec3 lightDir = normalize(vec3(0.8, 0.3, 1.0));
    float spec    = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 22.0);
    col += vec3(1.0, 0.95, 0.80) * spec * 0.45 * vHeight;

    // Fresnel shimmer
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
    col += sandColor * fresnel * 0.18;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 0.88);
  }
`;

// ─── Blowing dust shaders ─────────────────────────────────────────────────────

const dustVertexShader = `
  uniform float time;
  attribute float phase;
  attribute float speed;
  attribute float size;
  attribute vec3  startPos;
  varying float vAlpha;

  void main() {
    float t  = fract(time * speed * 0.4 + phase);
    // Wind direction: +X with slight upward arc
    float x  = startPos.x + (t - 0.5) * 0.80;
    float y  = startPos.y + sin(time * 1.5 + phase * 5.0) * 0.02;
    float z  = startPos.z + sin(t * 3.14159) * 0.06;  // arc up and settle

    vAlpha = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.70, 1.0, t)) * 0.55;

    vec4 mvPos   = modelViewMatrix * vec4(x, y, z, 1.0);
    gl_PointSize = size * (1.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const dustFragmentShader = `
  uniform vec3 sandColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    if (d > 1.0) discard;
    float fade = 1.0 - smoothstep(0.3, 1.0, d);
    vec3 col = mix(sandColor * 1.1, vec3(0.92, 0.86, 0.68), 0.55);
    gl_FragColor = vec4(col, vAlpha * fade);
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function SandVolume({ faceColor }) {
  const sandCol = useMemo(() => {
    const fc = new THREE.Color(faceColor || '#eab308');
    const sc = new THREE.Color(0.80, 0.68, 0.42);
    sc.lerp(fc, 0.28);
    return sc;
  }, [faceColor]);

  const surfMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { sandColor: { value: sandCol }, time: sharedUniforms.time },
    vertexShader: surfaceVertexShader, fragmentShader: surfaceFragmentShader,
    transparent: true, side: THREE.FrontSide, depthWrite: false,
  }), [sandCol]);

  const dustMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { sandColor: { value: sandCol }, time: sharedUniforms.time },
    vertexShader: dustVertexShader, fragmentShader: dustFragmentShader,
    transparent: true, depthWrite: false,
    blending: THREE.NormalBlending,
  }), [sandCol]);

  const surfGeo = useMemo(
    () => new THREE.PlaneGeometry(SAND_W, SAND_W, SURF_SEGS, SURF_SEGS), []
  );

  const dustGeo = useMemo(() => {
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(DUST_COUNT * 3);
    const phase = new Float32Array(DUST_COUNT);
    const speed = new Float32Array(DUST_COUNT);
    const size  = new Float32Array(DUST_COUNT);
    const start = new Float32Array(DUST_COUNT * 3);
    const half  = SAND_W / 2 - 0.03;
    for (let i = 0; i < DUST_COUNT; i++) {
      const x = (Math.random() * 2 - 1) * half;
      const y = (Math.random() * 2 - 1) * half;
      pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = 0;
      start[i*3] = x; start[i*3+1] = y; start[i*3+2] = 0.005 + Math.random() * 0.025;
      phase[i] = Math.random();
      speed[i] = 0.5 + Math.random() * 0.7;
      size[i]  = 3.0 + Math.random() * 4.0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('phase',    new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('speed',    new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('size',     new THREE.BufferAttribute(size, 1));
    geo.setAttribute('startPos', new THREE.BufferAttribute(start, 3));
    return geo;
  }, []);

  return (
    <>
      {/* Dune surface — cross-bedded ripple displacement with crest specular */}
      <mesh geometry={surfGeo} material={surfMat}
        position={[0, 0, 0.003]}
        frustumCulled={false} raycast={() => null} />

      {/* Blowing dust — point sprite particles drifting on wind */}
      <points geometry={dustGeo} material={dustMat}
        position={[0, 0, 0.004]}
        frustumCulled={false} raycast={() => null} />
    </>
  );
}
