// GrassBlades.jsx — 3D grass overlay for sticker planes
// Renders instanced grass blades that sway with wind animation.
// Placed as a child of the sticker group so orientation is automatic.

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { natureBlade } from '../../utils/elementalGrowth.js';
import { sharedUniforms, getVolumeResource } from './TileStyleMaterials.jsx';

const BLADE_COUNT = 220;
const STICKER_HALF = 0.85 / 2;

// Shared blade geometry — thin plane standing upright in +Z
let _bladeGeo = null;
function getBladeGeometry() {
  if (!_bladeGeo) {
    // 4 height segments allow the vertex shader to bend the blade smoothly
    _bladeGeo = new THREE.PlaneGeometry(0.04, 1.0, 1, 4);
    // Rotate so the blade stands perpendicular to the XY sticker plane, growing in +Z
    _bladeGeo.rotateX(-Math.PI / 2);
    // Shift base to Z=0 (sits on the sticker surface)
    _bladeGeo.translate(0, 0, 0.5);
  }
  return _bladeGeo;
}

// ----- Vertex Shader -----
// Wind bends blades from the tip (uv.y=1) while the base (uv.y=0) stays fixed.
// Wind direction is consistent in sticker-local space across all blades.
const grassVertexShader = `
  uniform float time;
  uniform float elemental;
  varying vec2 vUv;
  varying float vBladeTint;

  void main() {
    // rotateX(-PI/2) puts UV.y=1 at the root. Nature reverses that
    // coordinate so taper and wind act on the tip, leaving the root anchored.
    vUv = vec2(uv.x, mix(uv.y, 1.0 - uv.y, elemental));

    vec3 pos = position;

    // Transform vertex into sticker-local space (includes per-instance pos/rot/scale)
    vec4 localPos = instanceMatrix * vec4(pos, 1.0);

    // Phase offset per blade based on its position on the sticker
    float phase = localPos.x * 12.0 + localPos.y * 9.0;

    // Height factor: quadratic so base stays anchored, tip moves most
    float hf = vUv.y * vUv.y;

    // Extract blade height from instance scale (Z column length)
    float bladeH = length(vec3(instanceMatrix[2][0], instanceMatrix[2][1], instanceMatrix[2][2]));

    // Primary wind gust
    float windX = sin(time * 2.3 + phase) * 0.25 + sin(time * 0.9 + phase * 0.4) * 0.12;
    // Secondary cross-sway
    float windY = cos(time * 1.6 + phase * 0.6) * 0.10;

    localPos.x += windX * hf * bladeH;
    localPos.y += windY * hf * bladeH;

    // Per-blade tint variation (random-ish from position)
    vBladeTint = fract(sin(phase * 43758.5453) * 0.5 + 0.5);

    vec4 mvPosition = modelViewMatrix * localPos;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ----- Fragment Shader -----
const grassFragmentShader = `
  uniform float elemental;
  uniform vec3 rootColor;
  uniform vec3 tipColor;
  varying vec2 vUv;
  varying float vBladeTint;

  void main() {
    // Nature grows tapered leaves, with a fine midrib and occasional gold tips.
    // The ordinary grass tile style retains its existing silhouette.
    float across = abs(vUv.x - 0.5) * 2.0;
    if (elemental > 0.5 && across > pow(1.0 - vUv.y, 0.55)) discard;
    // Gradient from dark root to bright tip
    vec3 color = mix(rootColor, tipColor, vUv.y);

    // Per-blade hue/brightness variation
    color *= 0.85 + vBladeTint * 0.3;

    // Darken at very base (soil shadow)
    color *= 0.6 + 0.4 * smoothstep(0.0, 0.12, vUv.y);

    float vein = 1.0 - smoothstep(0.025, 0.13, across);
    color += vec3(0.12, 0.20, 0.055) * vein * vUv.y * elemental;
    float flower = step(0.965, vBladeTint) * smoothstep(0.78, 1.0, vUv.y) * elemental;
    color = mix(color, vec3(1.0, 0.82, 0.42), flower * 0.85);
    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * The blade material for one face colour, shared across every grass sticker that
 * uses it. Exported so the elemental warm-up can hand it to `renderer.compile()`
 * during the frozen scramble phase — otherwise the NATURE orb pays the GLSL
 * compile the first time a player claims one, mid-crawl.
 */
export function getGrassBladeMaterial(faceColor, elemental = false, animate = true) {
  const colorKey = faceColor || '#22c55e';
  return getVolumeResource(`grass_bladeMat_${colorKey}_${elemental}_${animate}`, () => {
    // Green palette with subtle face-color tinting
    const fc = new THREE.Color(colorKey);
    const root = new THREE.Color(0x1a3d0f);
    const tip = new THREE.Color(0x6abf3a);
    root.lerp(fc, 0.12);
    tip.lerp(fc, 0.08);

    return new THREE.ShaderMaterial({
      uniforms: {
        time: animate ? sharedUniforms.time : { value: 0 },
        elemental: { value: elemental ? 1 : 0 },
        rootColor: { value: root },
        tipColor: { value: tip },
      },
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      side: THREE.DoubleSide,
    });
  });
}

export default function GrassBlades({ faceColor, elemental = false, animate = true, count = BLADE_COUNT, seed = 1 }) {
  const meshRef = useRef();
  const geometry = getBladeGeometry();
  const material = getGrassBladeMaterial(faceColor, elemental, animate);

  // Populate instance matrices. material changes identity when faceColor
  // changes, which makes R3F recreate the instancedMesh (args change) — so
  // this effect re-runs on material to repopulate the new mesh's matrices.
  useEffect(() => {
    if (!meshRef.current) return;

    const dummy = new THREE.Object3D();
    const range = STICKER_HALF - 0.04; // small margin from edge

    for (let i = 0; i < count; i++) {
      const blade = elemental ? natureBlade(seed, i) : null;
      const x = blade ? blade.x : (Math.random() * 2 - 1) * range;
      const y = blade ? blade.y : (Math.random() * 2 - 1) * range;
      const height = blade ? blade.height : 0.06 + Math.random() * 0.14;          // 0.06 – 0.20
      const widthScale = blade ? blade.width : 0.6 + Math.random() * 0.8;        // width variation
      const angle = blade ? blade.angle : Math.random() * Math.PI;                // random facing

      dummy.position.set(x, y, 0);
      dummy.rotation.set(0, 0, angle);
      dummy.scale.set(widthScale, 1, height);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [material, elemental, seed, count]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      dispose={null}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}
