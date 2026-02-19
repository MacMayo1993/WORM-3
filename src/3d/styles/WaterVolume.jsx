// WaterVolume.jsx — volumetric water for the 'water' tile style
//
// Renders two meshes in the sticker's local +Z space:
//   1. A transparent box (the water body) — sides show animated caustic light
//   2. An animated surface plane on top — vertex-displaced ripples with Fresnel sheen
//
// The sticker's base 'water' shader renders the underwater floor below.

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from './TileStyleMaterials.jsx';

const WATER_W = 0.78;   // width/height slightly inset from the 0.85 sticker
const WATER_D = 0.13;   // depth of the water volume
const SURF_SEGS = 16;   // surface mesh subdivisions for smooth wave displacement

// ─── Water body (box) shaders ─────────────────────────────────────────────────
// Shows the interior volume: translucent blue-teal with caustic ripple patterns.

const bodyVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv      = uv;
    vNormal  = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const bodyFragmentShader = `
  uniform vec3  waterColor;
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  void main() {
    // Caustic light dancing on the walls
    float c1      = noise(vUv * 7.0 + time * 0.58);
    float c2      = noise(vUv * 7.0 - time * 0.44 + 0.7);
    float caustic = pow(c1 * c2, 2.0) * 3.8;

    vec3 color = waterColor;
    color += vec3(0.25, 0.48, 0.80) * caustic * 0.38;

    // Subtle edge darkening so walls feel enclosed
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    color *= 0.78 + smoothstep(0.0, 0.18, edge) * 0.22;

    // Face-angle tint — faces that glance the view look lighter (internal Fresnel)
    float rim = 1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
    color += waterColor * rim * 0.18;

    gl_FragColor = vec4(color, 0.44);
  }
`;

// ─── Water surface (animated displaced plane) shaders ────────────────────────
// Two-frequency wave interference displaces vertices in +Z.
// Fragment uses Fresnel + specular to fake a glass-clear surface.

const surfaceVertexShader = `
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewPosition;

  void main() {
    vUv = uv;

    vec3 pos = position;

    // Two-frequency wave interference
    float w1 = sin(pos.x * 24.0 + time * 3.4) * 0.006;
    float w2 = sin(pos.y * 20.0 + time * 2.7) * 0.006;
    float w3 = sin((pos.x + pos.y) * 15.0 + time * 1.9) * 0.004;
    float w4 = sin((pos.x - pos.y) * 11.0 + time * 1.4) * 0.003;
    pos.z += w1 + w2 + w3 + w4;

    // Approximate displaced normal for lighting
    float dx = cos(pos.x * 24.0 + time * 3.4) * 0.006 * 24.0
             + cos((pos.x + pos.y) * 15.0 + time * 1.9) * 0.004 * 15.0;
    float dy = cos(pos.y * 20.0 + time * 2.7) * 0.006 * 20.0
             + cos((pos.x + pos.y) * 15.0 + time * 1.9) * 0.004 * 15.0;
    vNormal = normalize(normalMatrix * normalize(vec3(-dx, -dy, 1.0)));

    vec4 mvPos    = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPos.xyz;
    gl_Position   = projectionMatrix * mvPos;
  }
`;

const surfaceFragmentShader = `
  uniform vec3  waterColor;
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewPosition;

  void main() {
    vec3 normal  = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel: edges reflect more (bright rim), center is more transparent
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.4);

    // Specular highlight (simulates sky / ambient light reflection)
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float spec    = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 32.0);

    vec3 color = waterColor;
    color += vec3(0.55, 0.75, 1.0) * fresnel * 0.50;
    color += vec3(0.90, 0.95, 1.0) * spec * 0.85;

    // Slight iridescent tint at peak wavecrest angles
    float crest = smoothstep(0.6, 1.0, fresnel);
    color = mix(color, vec3(0.7, 0.88, 1.0), crest * 0.15);

    float alpha = 0.48 + fresnel * 0.42;
    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function WaterVolume({ faceColor }) {
  // Build water colour from face colour, biased heavily toward blue-teal
  const bodyMat = useMemo(() => {
    const fc = new THREE.Color(faceColor || '#3b82f6');
    const wc = new THREE.Color(0.04, 0.20, 0.55);
    wc.lerp(fc, 0.22);
    return new THREE.ShaderMaterial({
      uniforms: {
        waterColor: { value: wc },
        time:       sharedUniforms.time,
      },
      vertexShader:   bodyVertexShader,
      fragmentShader: bodyFragmentShader,
      transparent:    true,
      side:           THREE.DoubleSide,
      depthWrite:     false,
    });
  }, [faceColor]);

  const surfMat = useMemo(() => {
    const fc = new THREE.Color(faceColor || '#3b82f6');
    const wc = new THREE.Color(0.08, 0.30, 0.70);
    wc.lerp(fc, 0.18);
    return new THREE.ShaderMaterial({
      uniforms: {
        waterColor: { value: wc },
        time:       sharedUniforms.time,
      },
      vertexShader:   surfaceVertexShader,
      fragmentShader: surfaceFragmentShader,
      transparent:    true,
      side:           THREE.FrontSide,
      depthWrite:     false,
    });
  }, [faceColor]);

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(WATER_W, WATER_W, WATER_D), []);
  const surfGeo = useMemo(
    () => new THREE.PlaneGeometry(WATER_W, WATER_W, SURF_SEGS, SURF_SEGS),
    []
  );

  return (
    <>
      {/* Water volume — transparent box sitting just above the sticker floor */}
      <mesh
        geometry={bodyGeo}
        material={bodyMat}
        position={[0, 0, WATER_D / 2 + 0.002]}
        frustumCulled={false}
        raycast={() => null}
      />

      {/* Animated water surface — vertex-displaced plane on top of the volume */}
      <mesh
        geometry={surfGeo}
        material={surfMat}
        position={[0, 0, WATER_D + 0.003]}
        frustumCulled={false}
        raycast={() => null}
      />
    </>
  );
}
