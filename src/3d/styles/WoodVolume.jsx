// WoodVolume.jsx — volumetric lacquered wood surface for the 'wood' tile style
//
// Two layers in local +Z space:
//   1. Sticker base: wood floor shader (growth rings, heartwood, grain — existing)
//   2. Lacquer surface (12×12 subdivided plane): subtle ring-aligned height
//      displacement following the annual-ring pattern; strong Fresnel + specular
//      gives a deep hand-rubbed lacquer look.  Tiny dust mote sparkles animate
//      on the surface to suggest depth in the finish.

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from './TileStyleMaterials.jsx';

const WOOD_W    = 0.78;
const SURF_SEGS = 14;

// ─── Lacquer surface shaders ──────────────────────────────────────────────────

const surfaceVertexShader = `
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewPosition;
  varying float vRing;  // ring value at this vertex

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
    vec2 centered = uv - 0.5;

    // Annual ring displacement — follows radial ring structure of wood grain
    float r    = length(centered) * 9.0;
    float warp = fbm(centered * 2.8 + 0.5) * 1.1;
    float ring = sin((r + warp) * 3.14159) * 0.5 + 0.5;
    vRing = ring;

    // Very subtle height variation following the rings
    float h = ring * 0.004 + fbm(centered * 18.0) * 0.0015;
    pos.z += h;

    // Normal approximation
    float eps = 0.005;
    vec2 pu = centered + vec2(eps, 0.0);
    vec2 pv = centered + vec2(0.0, eps);
    float ru = sin((length(pu)*9.0 + warp)*3.14159)*0.5+0.5;
    float rv = sin((length(pv)*9.0 + warp)*3.14159)*0.5+0.5;
    float dx = (ru - ring) * 0.004 / eps;
    float dy = (rv - ring) * 0.004 / eps;
    vNormal = normalize(normalMatrix * normalize(vec3(-dx, -dy, 1.0)));

    vec4 mvPos    = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPos.xyz;
    gl_Position   = projectionMatrix * mvPos;
  }
`;

const surfaceFragmentShader = `
  uniform vec3  woodColor;
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewPosition;
  varying float vRing;

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

    // Lacquer tint: warm amber slightly over the wood tone
    vec3 base = mix(woodColor * 0.72, vec3(0.72, 0.50, 0.28), 0.28);
    // Rings visible through lacquer — lighter at ring peaks
    base = mix(base * 0.88, base * 1.12, vRing);

    // Multi-light specular (lacquer has two highlight lobes)
    vec3 l1 = normalize(vec3(0.6, 0.8, 1.0));
    vec3 l2 = normalize(vec3(-0.5, 0.3, 0.8));
    float s1 = pow(max(dot(reflect(-l1, normal), viewDir), 0.0), 90.0);
    float s2 = pow(max(dot(reflect(-l2, normal), viewDir), 0.0), 45.0);
    vec3 col = base;
    col += vec3(1.0, 0.95, 0.80) * s1 * 1.10;   // sharp glint
    col += vec3(0.85, 0.78, 0.65) * s2 * 0.40;   // soft fill

    // Fresnel: lacquer is very reflective at glancing angles
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.5);
    col += vec3(0.80, 0.70, 0.55) * fresnel * 0.50;

    // Dust motes / micro-sparkle in finish
    float mote = noise(vUv * 55.0 + time * 0.08);
    mote = pow(mote, 16.0) * 3.0;
    col += vec3(mote * 0.90);

    // Medullary rays peeking through lacquer
    vec2 c = vUv - 0.5;
    float angle = atan(c.y, c.x);
    float ray   = pow(smoothstep(0.88, 1.0, sin(angle * 22.0)*0.5+0.5), 2.0);
    col += vec3(0.90, 0.80, 0.60) * ray * 0.10;

    float alpha = 0.55 + fresnel * 0.35;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function WoodVolume({ faceColor }) {
  const woodCol = useMemo(() => {
    const fc = new THREE.Color(faceColor || '#a16207');
    const wc = new THREE.Color(0.62, 0.42, 0.22);
    wc.lerp(fc, 0.30);
    return wc;
  }, [faceColor]);

  const surfMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { woodColor: { value: woodCol }, time: sharedUniforms.time },
    vertexShader: surfaceVertexShader, fragmentShader: surfaceFragmentShader,
    transparent: true, side: THREE.FrontSide, depthWrite: false,
  }), [woodCol]);

  const surfGeo = useMemo(
    () => new THREE.PlaneGeometry(WOOD_W, WOOD_W, SURF_SEGS, SURF_SEGS), []
  );

  return (
    /* Lacquered surface — ring-height displacement + deep specular/Fresnel sheen */
    <mesh geometry={surfGeo} material={surfMat}
      position={[0, 0, 0.003]}
      frustumCulled={false} raycast={() => null} />
  );
}
