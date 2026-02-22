// IceVolume.jsx — volumetric frozen crystal for the 'ice' tile style
//
// Three layers in local +Z space:
//   1. Sticker base: ice floor shader (cracks, frost, subsurface scattering)
//   2. Ice body (box mesh): crystal-clear depth with Voronoi crack silhouettes on walls
//   3. Ice surface (displaced plane): barely-moving frost undulation, heavy Fresnel sheen,
//      animated sparkle points mimicking light catching on crystal facets

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from './TileStyleMaterials.jsx';

const ICE_W    = 0.78;
const ICE_D    = 0.09;
const SURF_SEGS = 20;

// ─── Ice body shaders ─────────────────────────────────────────────────────────

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
  uniform vec3  iceColor;
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

  // Voronoi — returns (d1, d2) distances to nearest two points
  vec2 voronoi(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float d1 = 9.0; float d2 = 9.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 n = vec2(float(x), float(y));
        vec2 pt = n + vec2(hash(i+n), hash(i+n+50.0));
        float d = length(f - pt);
        if (d < d1) { d2 = d1; d1 = d; }
        else if (d < d2) { d2 = d; }
      }
    }
    return vec2(d1, d2);
  }

  void main() {
    // Crystal crack lines on walls
    vec2 v     = voronoi(vUv * 6.0 + time * 0.006);
    float edge = 1.0 - smoothstep(0.0, 0.06, v.y - v.x);
    // Deep crack = dark blue
    vec3 crackCol = iceColor * 0.22 + vec3(0.0, 0.05, 0.15);

    // Subsurface teal glow between cracks
    float sss = noise(vUv * 5.0 + time * 0.025) * 0.4;
    vec3  col = mix(iceColor, iceColor + vec3(-0.05, 0.05, 0.20), sss);
    col = mix(col, crackCol, edge * 0.65);

    // Internal Fresnel rim
    float rim = 1.0 - abs(dot(normalize(vNormal), vec3(0,0,1)));
    col += vec3(0.55, 0.75, 1.0) * rim * 0.30;

    gl_FragColor = vec4(col, 0.38);
  }
`;

// ─── Ice surface shaders ──────────────────────────────────────────────────────

const surfaceVertexShader = `
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewPosition;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Very shallow undulation — ice doesn't move much
    float u1 = sin(pos.x * 18.0 + time * 0.55) * 0.0025;
    float u2 = sin(pos.y * 16.0 + time * 0.42) * 0.0025;
    float u3 = sin((pos.x - pos.y) * 12.0 + time * 0.28) * 0.0015;
    pos.z += u1 + u2 + u3;

    float dx = cos(pos.x * 18.0 + time * 0.55) * 0.0025 * 18.0;
    float dy = cos(pos.y * 16.0 + time * 0.42) * 0.0025 * 16.0;
    vNormal = normalize(normalMatrix * normalize(vec3(-dx, -dy, 1.0)));

    vec4 mvPos    = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPos.xyz;
    gl_Position   = projectionMatrix * mvPos;
  }
`;

const surfaceFragmentShader = `
  uniform vec3  iceColor;
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

  void main() {
    vec3 normal  = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel — very strong on ice
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.0);

    // Specular — sharp glint like light on polished ice
    vec3 lightDir = normalize(vec3(0.6, 0.8, 1.0));
    float spec    = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 80.0);

    vec3 col = iceColor;
    col += vec3(0.60, 0.80, 1.0) * fresnel * 0.70;
    col += vec3(1.00, 1.00, 1.00) * spec * 1.20;

    // Frost edge crystals
    float edgeDist = min(min(vUv.x, 1.0-vUv.x), min(vUv.y, 1.0-vUv.y));
    float frost = noise(vUv * 22.0 + time * 0.06) * smoothstep(0.14, 0.0, edgeDist);
    col = mix(col, vec3(0.92, 0.97, 1.0), frost * 0.65);

    // Sparkle — tiny bright points animating with time
    float sparkle = noise(vUv * 35.0 + time * 0.40);
    sparkle = pow(sparkle, 14.0) * 4.5;
    col += vec3(sparkle);

    // Iridescent tint at high-fresnel angles (thin-film ice)
    float hue = fract(vUv.x * 1.5 + vUv.y * 0.8 + time * 0.04);
    vec3 irid;
    irid.r = abs(hue * 6.0 - 3.0) - 1.0;
    irid.g = 2.0 - abs(hue * 6.0 - 2.0);
    irid.b = 2.0 - abs(hue * 6.0 - 4.0);
    irid = clamp(irid, 0.0, 1.0);
    col = mix(col, irid, fresnel * 0.12);

    float alpha = 0.35 + fresnel * 0.50;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function IceVolume({ faceColor }) {
  const iceCol = useMemo(() => {
    const fc = new THREE.Color(faceColor || '#93c5fd');
    const ic = new THREE.Color(0.72, 0.88, 1.0);
    ic.lerp(fc, 0.25);
    return ic;
  }, [faceColor]);

  const bodyMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { iceColor: { value: iceCol }, time: sharedUniforms.time },
    vertexShader:   bodyVertexShader,
    fragmentShader: bodyFragmentShader,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  }), [iceCol]);

  const surfMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { iceColor: { value: iceCol }, time: sharedUniforms.time },
    vertexShader:   surfaceVertexShader,
    fragmentShader: surfaceFragmentShader,
    transparent: true, side: THREE.FrontSide, depthWrite: false,
  }), [iceCol]);

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(ICE_W, ICE_W, ICE_D), []);
  const surfGeo = useMemo(
    () => new THREE.PlaneGeometry(ICE_W, ICE_W, SURF_SEGS, SURF_SEGS), []
  );

  return (
    <>
      {/* Ice volume — crystal-clear box with cracked walls */}
      <mesh geometry={bodyGeo} material={bodyMat}
        position={[0, 0, ICE_D / 2 + 0.002]}
        frustumCulled={false} raycast={() => null} />

      {/* Ice surface — barely-moving frost sheet with sparkle sheen */}
      <mesh geometry={surfGeo} material={surfMat}
        position={[0, 0, ICE_D + 0.003]}
        frustumCulled={false} raycast={() => null} />
    </>
  );
}
