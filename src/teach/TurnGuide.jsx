import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ACTION_CUES } from '../game/actionCues.js';
import { prefersReducedMotion } from '../utils/device.js';
import { getSliceRimGeometry, EDGE_UV, NOISE_GLSL } from './layerGlow.js';
import { rimVertexShader } from './LayerHighlight.jsx';
import { buildTurnGuideGeometry } from './turnGuideGeometry.js';

// The solver's (and Teach's) "turn THIS layer, THIS way" hint, drawn as light
// rather than ink: a frayed glow round the layer's tiles with a sweep running the
// way it turns, and a ribbon of mist outside the cube where wisps drift and soft
// comet-chevrons stream in the direction of travel. Nothing has a hard edge.
//
// `LITE` (phones, reduced FX, big boards) swaps the fbm for one octave of value
// noise and drops a wisp; the shapes and the direction cue are unchanged.

const glf = (n) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

const rimFragment = (lite) => `
  ${lite ? '#define LITE' : ''}
  uniform vec3 uDeep, uCore;
  uniform float uTime, uDir, uOpacity;
  varying vec2 vUv;
  varying float vPhase;
  ${NOISE_GLSL}
  void main() {
    vec2 p = vUv - .5;
    // Signed distance to the tile's rounded outline (negative inside the tile).
    vec2 q = abs(p) - vec2(${glf(EDGE_UV)} - .035);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - .035;
    // Noise drifts round the layer with the turn, so the fraying flows too.
    vec2 drift = vec2(vPhase * 9.0 - uDir * uTime * .55, uTime * .18);
    #ifdef LITE
      float n = vnoise(p * 6.0 + drift);
    #else
      float n = fbm(p * 7.0 + drift);
    #endif
    float dw = d + (n - .5) * .018;
    // Light streams round the outline in strands rather than one drawn line.
    float stream = .3 + .7 * smoothstep(.25, .75, vnoise(vec2(vPhase * 24.0 - uDir * uTime * 1.1, (p.x + p.y) * 3.0)));
    float filament = exp(-pow(dw / .011, 2.0)) * stream;
    float outside = max(dw, 0.0);
    float halo = exp(-outside * 20.0) * smoothstep(-.015, .004, dw) * (.15 + .45 * n);
    float veil = (1.0 - smoothstep(-.03, 0.0, dw)) * .06;
    float phase = fract(vPhase * 2.0 - uDir * uTime * .28);
    float pulse = pow(max(0.0, 1.0 - abs(phase - .5) * 4.0), 2.0);
    float light = filament * (.5 + .5 * pulse) + halo * (.55 + .8 * pulse) + veil * (1.0 + pulse);
    // The quads overlap their neighbours; fade before their square edge shows.
    float border = 1.0 - smoothstep(.4, .5, max(abs(p.x), abs(p.y)));
    float alpha = clamp(light, 0.0, 1.0) * border * uOpacity;
    if (alpha < .004) discard;
    vec3 color = mix(uDeep, uCore, clamp(filament + pulse * .6 + veil * 4.0, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
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

const trackFragment = (lite) => `
  ${lite ? '#define LITE' : ''}
  uniform vec3 uDeep, uCore;
  uniform float uTime, uDir, uOpacity, uLength;
  varying vec2 vUv;
  varying float vFacing;
  ${NOISE_GLSL}
  #ifdef LITE
    #define WISPS 2
  #else
    #define WISPS 3
  #endif
  void main() {
    float y = vUv.y * 2.0 - 1.0;           // -1..1 across the ribbon
    float ay = abs(y);
    float flow = vUv.x * uLength - uDir * uTime * .8; // world units, drifting with the turn
    float edge = 1.0 - smoothstep(.3, 1.0, ay);

    // A faint breath of mist the whole way round.
    #ifdef LITE
      float mist = .1 + .12 * vnoise(vec2(flow * 1.2, y * 1.5 + uTime * .25));
    #else
      float mist = .1 + .14 * fbm(vec2(flow * 1.1, y * 1.5 + uTime * .25));
    #endif

    // Wisps: thin strands that wander across the ribbon and break apart.
    float wisps = 0.0;
    for (int i = 0; i < WISPS; i++) {
      float fi = float(i);
      float lane = (vnoise(vec2(flow * .8 + fi * 7.1, fi * 3.7 + uTime * .3)) - .5) * 1.2;
      float width = .1 + .05 * fi;
      float strand = exp(-pow((y - lane) / width, 2.0));
      float gaps = smoothstep(.25, .7, vnoise(vec2(flow * 1.7 - fi * 2.3, fi * 5.3)));
      wisps += strand * gaps * (.55 - .13 * fi);
    }

    // Comets: soft chevrons pointing (and streaming) with the turn, each
    // trailing a feathered tail. u > 0 is ahead along the direction of travel.
    float cells = max(8.0, floor(uLength / .85));
    float u = (fract(vUv.x * cells - uDir * uTime * 1.5) - .5) * uDir;
    float ahead = u - (.17 - ay * .42);
    float arms = 1.0 - smoothstep(.55, .95, ay);
    float head = exp(-pow(ahead / .05, 2.0)) * arms * .9;
    float tail = exp(min(ahead, 0.0) * 4.5) * (1.0 - step(0.0, ahead)) * arms
      * smoothstep(-.5, -.3, u) * (.25 + .35 * wisps + .2 * mist);
    float light = wisps + head + tail;

    vec3 color = mix(uDeep, uCore, smoothstep(0.0, .9, light));
    color = mix(color, vec3(1.0), smoothstep(.9, 1.5, light) * .55);
    float alpha = clamp(mist * .6 + light, 0.0, 1.0) * edge * uOpacity * smoothstep(.1, .75, vFacing);
    if (alpha < .004) discard;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

// Warm cream to soft amber: the cue's own colours, the deep tone lifted a
// little toward the core so the whole guide reads as light, not paint.
const CORE = new THREE.Color(ACTION_CUES.turn.color);
const DEEP = new THREE.Color(ACTION_CUES.turn.deep).lerp(CORE, 0.4);

// Two bounded draws; no lights, texture loads, points, or frame allocations.
// Hazard warnings keep their own LayerHighlight and quality policy.
export default function TurnGuide({ axis, sliceIndex, dir, size, reduced = false, turning = false }) {
  const [calm] = useState(prefersReducedMotion);
  const age = useRef(0);
  const rim = useMemo(() => getSliceRimGeometry(size, axis, sliceIndex), [size, axis, sliceIndex]);
  const track = useMemo(() => buildTurnGuideGeometry(size, axis, sliceIndex, reduced), [size, axis, sliceIndex, reduced]);
  // ONE uniforms object for the guide's life. three keeps the object a program
  // was first drawn with (WebGLRenderer's materialProperties.uniforms), so
  // handing the material a new one on the next move left the renderer reading
  // the old object, frozen at the opacity 0 it was given when the first move
  // turned: the guide showed the first move and never another.
  const uniforms = useMemo(() => ({
    uDeep: { value: DEEP.clone() },
    uCore: { value: CORE.clone() },
    uTime: { value: 0 },
    uDir: { value: 1 },
    uOpacity: { value: calm ? 1 : 0 },
    uLength: { value: 1 },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  uniforms.uDir.value = dir === 1 ? 1 : -1;
  uniforms.uLength.value = track.userData.trackLength;
  const rimShader = useMemo(() => rimFragment(reduced), [reduced]);
  const trackShader = useMemo(() => trackFragment(reduced), [reduced]);
  useEffect(() => { age.current = 0; }, [axis, sliceIndex, dir, size]);
  useEffect(() => () => track.dispose(), [track]);
  useFrame((_, delta) => {
    age.current += Math.min(delta, .05);
    uniforms.uTime.value = calm ? 0 : age.current;
    // A static preview must not cut across the pieces while the real layer turns.
    uniforms.uOpacity.value = turning ? 0 : calm ? 1 : THREE.MathUtils.smoothstep(age.current, 0, .45);
  });
  const lite = reduced ? 'lite' : 'full';
  return <group name="teach-turn-guide">
    <mesh name="teach-turn-rim" raycast={() => null}>
      <primitive object={rim} attach="geometry" />
      {/* Keyed by variant: a new shader string on a live material is not recompiled. */}
      <shaderMaterial key={lite} uniforms={uniforms} vertexShader={rimVertexShader} fragmentShader={rimShader}
        transparent depthWrite={false} toneMapped={false} blending={THREE.NormalBlending} />
    </mesh>
    <mesh name="teach-turn-track" raycast={() => null}>
      <primitive object={track} attach="geometry" />
      <shaderMaterial key={lite} uniforms={uniforms} vertexShader={trackVertex} fragmentShader={trackShader}
        transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} forceSinglePass />
    </mesh>
  </group>;
}
