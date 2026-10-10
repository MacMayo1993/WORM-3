import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion } from '../utils/device.js';
import { getSliceRimGeometry, EDGE_UV } from './layerGlow.js';
import { rimVertexShader } from './LayerHighlight.jsx';
import { buildTurnGuideGeometry } from './turnGuideGeometry.js';

const rimFragment = `
  uniform float uTime, uDir, uOpacity;
  varying vec2 vUv;
  varying float vPhase;
  void main() {
    vec2 q = abs(vUv - .5) - vec2(${EDGE_UV} - .035);
    float d = length(max(q, 0.0)) + min(max(q.x,q.y), 0.0) - .035;
    float line = 1.0 - smoothstep(.004,.014,abs(d));
    float halo = (1.0 - smoothstep(.014,.055,abs(d))) * .2;
    float phase = fract(vPhase * 2.0 - uDir * uTime * .28);
    float pulse = pow(max(0.0,1.0 - abs(phase - .5) * 5.0),2.0);
    float alpha = (line * .7 + halo) * (.65 + .35 * pulse) * uOpacity;
    if (alpha < .005) discard;
    gl_FragColor = vec4(mix(vec3(1.0,.43,.025),vec3(1.0,.86,.38),pulse),alpha);
    #include <colorspace_fragment>
  }
`;
const trackVertex = `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    vFacing = abs(dot(normalize(normalMatrix * normal),normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const trackFragment = `
  uniform float uTime, uDir, uOpacity, uLength;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    // Signed phase and signed arrow shape both reverse with the actual turn.
    float cells = max(8.0, floor(uLength / .85));
    float x = (fract(vUv.x * cells - uDir * uTime * 1.5) - .5) * uDir;
    float y = abs(vUv.y - .5);
    float arrowDist = abs(x + y * .85 - .17);
    float end = 1.0 - smoothstep(.32,.4,y);
    float arrow = (1.0 - smoothstep(.085,.12,arrowDist)) * end;
    float outline = (1.0 - smoothstep(.12,.16,arrowDist)) * end;
    float rail = 1.0 - smoothstep(.012,.032,abs(y - .43));
    float phase = fract(vUv.x * 2.0 - uDir * uTime * .28);
    float pulse = pow(max(0.0,1.0 - abs(phase - .5) * 5.0),2.0);
    float ink = max(arrow, rail * .75);
    vec3 gold = mix(vec3(1.0,.49,.025),vec3(1.0,.92,.54),pulse);
    vec3 color = mix(vec3(.16,.075,.018),gold,ink);
    float alpha = max(outline,rail * (.55 + pulse * .4)) * uOpacity
      * smoothstep(.1,.75,vFacing);
    if (alpha < .005) discard;
    gl_FragColor = vec4(color,alpha);
    #include <colorspace_fragment>
  }
`;

// Two bounded draws; no lights, texture loads, noise octaves, points, or frame
// allocations. Hazard warnings keep their own LayerHighlight and quality policy.
export default function TurnGuide({ axis, sliceIndex, dir, size, reduced = false, turning = false }) {
  const [calm] = useState(prefersReducedMotion);
  const age = useRef(0);
  const rim = useMemo(() => getSliceRimGeometry(size,axis,sliceIndex),[size,axis,sliceIndex]);
  const track = useMemo(() => buildTurnGuideGeometry(size,axis,sliceIndex,reduced),[size,axis,sliceIndex,reduced]);
  const uniforms = useMemo(() => ({ uTime:{value:0},uDir:{value:dir === 1 ? 1 : -1},uOpacity:{value:calm ? 1 : 0},uLength:{value:track.userData.trackLength} }),[dir,calm,track]);
  useEffect(() => { age.current = 0; },[axis,sliceIndex,dir,size]);
  useEffect(() => () => track.dispose(),[track]);
  useFrame((_,delta) => {
    age.current += Math.min(delta,.05);
    uniforms.uTime.value = calm ? 0 : age.current;
    // A static preview must not cut across the pieces while the real layer turns.
    uniforms.uOpacity.value = turning ? 0 : calm ? 1 : THREE.MathUtils.smoothstep(age.current,0,.35);
  });
  return <group name="teach-turn-guide">
    <mesh name="teach-turn-rim" raycast={() => null}>
      <primitive object={rim} attach="geometry" />
      <shaderMaterial uniforms={uniforms} vertexShader={rimVertexShader} fragmentShader={rimFragment}
        transparent depthWrite={false} toneMapped={false} blending={THREE.NormalBlending} />
    </mesh>
    <mesh name="teach-turn-track" raycast={() => null}>
      <primitive object={track} attach="geometry" />
      <shaderMaterial uniforms={uniforms} vertexShader={trackVertex} fragmentShader={trackFragment}
        transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} forceSinglePass />
    </mesh>
  </group>;
}
