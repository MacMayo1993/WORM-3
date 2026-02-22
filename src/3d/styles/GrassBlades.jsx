// GrassBlades.jsx — 3D grass overlay for sticker planes
// Renders instanced grass blades that sway with wind animation.
// Placed as a child of the sticker group so orientation is automatic.

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from './TileStyleMaterials.jsx';

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
  varying vec2 vUv;
  varying float vBladeTint;

  void main() {
    vUv = uv;

    vec3 pos = position;

    // Transform vertex into sticker-local space (includes per-instance pos/rot/scale)
    vec4 localPos = instanceMatrix * vec4(pos, 1.0);

    // Phase offset per blade based on its position on the sticker
    float phase = localPos.x * 12.0 + localPos.y * 9.0;

    // Height factor: quadratic so base stays anchored, tip moves most
    float hf = uv.y * uv.y;

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
  uniform vec3 rootColor;
  uniform vec3 tipColor;
  varying vec2 vUv;
  varying float vBladeTint;

  void main() {
    // Gradient from dark root to bright tip
    vec3 color = mix(rootColor, tipColor, vUv.y);

    // Per-blade hue/brightness variation
    color *= 0.85 + vBladeTint * 0.3;

    // Darken at very base (soil shadow)
    color *= 0.6 + 0.4 * smoothstep(0.0, 0.12, vUv.y);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function GrassBlades({ faceColor }) {
  const meshRef = useRef();

  const geometry = useMemo(() => getBladeGeometry(), []);

  const material = useMemo(() => {
    // Green palette with subtle face-color tinting
    const fc = new THREE.Color(faceColor || '#22c55e');
    const root = new THREE.Color(0x1a3d0f);
    const tip = new THREE.Color(0x6abf3a);
    root.lerp(fc, 0.12);
    tip.lerp(fc, 0.08);

    return new THREE.ShaderMaterial({
      uniforms: {
        time: sharedUniforms.time,
        rootColor: { value: root },
        tipColor: { value: tip },
      },
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      side: THREE.DoubleSide,
    });
  }, [faceColor]);

  // Populate instance matrices once on mount
  useEffect(() => {
    if (!meshRef.current) return;

    const dummy = new THREE.Object3D();
    const range = STICKER_HALF - 0.04; // small margin from edge

    for (let i = 0; i < BLADE_COUNT; i++) {
      const x = (Math.random() * 2 - 1) * range;
      const y = (Math.random() * 2 - 1) * range;
      const height = 0.06 + Math.random() * 0.14;          // 0.06 – 0.20
      const widthScale = 0.6 + Math.random() * 0.8;        // width variation
      const angle = Math.random() * Math.PI;                // random facing

      dummy.position.set(x, y, 0);
      dummy.rotation.set(0, 0, angle);
      dummy.scale.set(widthScale, 1, height);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, BLADE_COUNT]}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}
