// GalaxyVolume.jsx — volumetric deep-space parallax for the 'galaxy' tile style
//
// Three depth layers in local +Z space:
//   Layer A (Z=0.04): distant stars — tiny, dense, slow parallax drift
//   Layer B (Z=0.09): mid stars + nebula wisps — medium density, drift
//   Layer C (Z=0.15): close bright stars + foreground glow — large, sparse, fast
//
// All layers are animated shader planes.  Each has a slightly different UV scroll
// speed driven by the shared time uniform — giving true parallax when you view the
// tile from different angles as the cube rotates.

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from './TileStyleMaterials.jsx';

const GAL_W = 0.78;

// ─── Per-layer star field + nebula fragment shader ────────────────────────────
// `density`  controls how many stars appear (star threshold in hash space)
// `starSize` controls point-spread radius
// `driftSpeed` controls how fast the layer scrolls
// `nebulaAmt` controls nebula brightness contribution

function makeLayerShader(density, starSize, driftSpeedX, driftSpeedY, nebulaAmt, gridScale) {
  return /* glsl */ `
    uniform vec3  galaxyColor;
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
      // Parallax drift
      vec2 uv = vUv + vec2(time * ${driftSpeedX.toFixed(4)}, time * ${driftSpeedY.toFixed(4)});
      vec2 starUv   = uv * float(${gridScale});
      vec2 starCell = floor(starUv);

      float stars = 0.0;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec2 cell    = starCell + vec2(float(x), float(y));
          vec2 starPos = cell + vec2(hash(cell), hash(cell + 50.0));
          float d      = length(starUv - starPos);
          // Only render stars above the density threshold
          if (hash(cell + 100.0) > float(${(1.0 - density).toFixed(3)})) {
            float twinkle = sin(time * (1.5 + hash(cell)*2.5) + hash(cell)*6.28)*0.3 + 0.7;
            stars += smoothstep(float(${starSize.toFixed(3)}), 0.0, d) * twinkle;
          }
        }
      }

      // Nebula cloud
      float neb = fbm(uv * 3.5 + time * 0.012) * float(${nebulaAmt.toFixed(3)});
      vec3  nebCol = mix(galaxyColor * 0.35, galaxyColor, neb);

      vec3  col   = nebCol;
      col += vec3(stars);
      // Slight color-temperature variation — hotter stars tinted blue-white
      float hotness = hash(floor(starUv));
      col += vec3(stars) * mix(vec3(0.9,0.85,0.7), vec3(0.7,0.85,1.0), hotness) * 0.5;

      gl_FragColor = vec4(col, min(0.90, stars * 0.95 + neb * 0.55));
    }
  `;
}

// Shared simple vertex shader for all planes
const layerVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function GalaxyVolume({ faceColor }) {
  const galaxyCol = useMemo(() => {
    const fc = new THREE.Color(faceColor || '#3b82f6');
    const gc = new THREE.Color(0.08, 0.04, 0.28);
    gc.lerp(fc, 0.30);
    return gc;
  }, [faceColor]);

  // Three layers: distant, mid, close
  const [matA, matB, matC] = useMemo(() => {
    const make = (fragSrc) => new THREE.ShaderMaterial({
      uniforms: { galaxyColor: { value: galaxyCol }, time: sharedUniforms.time },
      vertexShader:   layerVertexShader,
      fragmentShader: fragSrc,
      transparent: true, side: THREE.FrontSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return [
      // Layer A — distant: many tiny dim stars, slow drift, subtle nebula
      make(makeLayerShader(0.08, 0.12,  0.0015, -0.0008, 0.25, 28)),
      // Layer B — mid: medium density, wider stars, gentle drift, more nebula
      make(makeLayerShader(0.12, 0.18,  0.0032,  0.0018, 0.45, 18)),
      // Layer C — close: few large bright stars, fast drift, vivid nebula
      make(makeLayerShader(0.18, 0.28, -0.0060,  0.0035, 0.70, 10)),
    ];
  }, [galaxyCol]);

  const planeGeo = useMemo(() => new THREE.PlaneGeometry(GAL_W, GAL_W), []);

  return (
    <>
      {/* Distant star field */}
      <mesh geometry={planeGeo} material={matA}
        position={[0, 0, 0.04]} frustumCulled={false} raycast={() => null} />

      {/* Mid star field + nebula */}
      <mesh geometry={planeGeo} material={matB}
        position={[0, 0, 0.09]} frustumCulled={false} raycast={() => null} />

      {/* Close bright stars + foreground glow */}
      <mesh geometry={planeGeo} material={matC}
        position={[0, 0, 0.15]} frustumCulled={false} raycast={() => null} />
    </>
  );
}
