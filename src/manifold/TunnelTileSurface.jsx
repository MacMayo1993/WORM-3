import { tunnelCameraClearanceGLSL } from './tunnelCameraClearance.js';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import { tunnelFinishGLSL } from './tunnelFinish.js';

const vertexShader = `
  uniform vec3 uTileCenter;
  uniform vec3 uWhipAxis;
  uniform float uWhipAmp;
  uniform float uWhipPhase;
  attribute float aDistance;
  varying vec2 vUv;
  varying float vDistance;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vTileCenter;
  varying vec3 vWorldPos;
  varying vec3 vTunnelCameraPoint;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vDistance = aDistance;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vTileCenter = uTileCenter;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float ends = sin(uv.y * 3.14159265)
      * smoothstep(0.0, 0.14, uv.y) * smoothstep(1.0, 0.86, uv.y)
      * smoothstep(0.0, 0.10, abs(uv.y - 0.5));
    wp.xyz += uWhipAxis * (sin(uv.y * 12.0 - uWhipPhase) * uWhipAmp * ends);
    vWorldPos = wp.xyz;
    vTunnelCameraPoint = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vViewPosition = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

// Use the tile's real shader, including animated and antipodal patterns. Give
// it square, repeating UVs along the band rather than stretching one tile over
// the whole tunnel. Each half has its own material, avoiding one giant shader
// containing every style, and never mutates the cached sticker material.
function createTunnelTileMaterial(style, color, antiColor, shared, side, rideMode) {
  const tile = getTileStyleMaterial(style, color, false, null, antiColor);
  const tileShader = (tile.userData.styleFragmentShader ?? tile.fragmentShader)
    .replace(/varying\s+vec2\s+vUv\s*;/g, '')
    .replace(/\bvUv\b/g, 'tileUv')
    .replace(/void\s+main\s*\(\s*\)/, 'void tileMain()');
  return new THREE.ShaderMaterial({
    name: `tunnel-tile-${side}-${style}`,
    uniforms: {
      ...tile.uniforms,
      ...shared,
      baseColor: side === 0 ? shared.uColorA : shared.uColorB,
      antipodalColor: side === 0 ? shared.uColorB : shared.uColorA,
      time: shared.uTime,
      uTileCenter: side === 0 ? shared.uTileCenterA : shared.uTileCenterB,
      uTileSide: { value: side },
    },
    vertexShader,
    fragmentShader: `
      uniform float uTileSide;
      uniform float uRideMode;
      uniform float uRideCore;
      uniform float uGrowT;
      uniform float uOpacity;
      uniform float uPatternRepeats;
      uniform float uTime;
      varying vec2 vUv;
      varying float vDistance;
      varying vec3 vTunnelCameraPoint;
      vec2 tileUv;
      ${tileShader}
      ${tunnelFinishGLSL}
      ${tunnelCameraClearanceGLSL}
      void main() {
        clearTunnelCamera(vTunnelCameraPoint);
        float core = uRideMode > 0.5 ? uRideCore : 0.5;
        if (uTileSide < 0.5 ? vUv.y >= core : vUv.y < core) discard;
        if (vUv.y > uGrowT * 0.5 && vUv.y < 1.0 - uGrowT * 0.5) discard;
        float along = uTileSide < 0.5 ? vUv.y : 1.0 - vUv.y;
        tileUv = vec2(vUv.x, fract(along * uPatternRepeats));
        tileMain();
        // Keep the track opaque in WORM, including translucent tile styles.
        gl_FragColor.a = uRideMode > 0.5 ? 1.0 : gl_FragColor.a * uOpacity;
        float edge = 1.0 - smoothstep(0.018, 0.05, min(vUv.x, 1.0 - vUv.x));
        vec3 pearl = mix(baseColor, vec3(0.9, 0.96, 1.0), 0.38);
        float spiral = tunnelSpiral(vDistance, vUv.x, uTime, 0.06);
        gl_FragColor.rgb = mix(gl_FragColor.rgb + pearl * spiral * 0.05, pearl * 0.8, edge * 0.8);
      }
    `,
    side: THREE.DoubleSide,
    transparent: !rideMode,
    depthWrite: rideMode,
    toneMapped: false,
    extensions: { derivatives: true },
  });
}

export default function TunnelTileSurface({ geometry, style, color, antiColor, uniforms, side, rideMode }) {
  const material = useMemo(() => createTunnelTileMaterial(style, color, antiColor, uniforms, side, rideMode),
    [style, color, antiColor, uniforms, side, rideMode]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh name={`tunnel-styled-half-${side}`} geometry={geometry} material={material} frustumCulled={false} dispose={null} />;
}
