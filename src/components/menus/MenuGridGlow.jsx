// src/components/menus/MenuGridGlow.jsx
// The menu cube's tile grid, lit with the same wispy gold light the instructor
// uses to say "turn THIS layer" — but standing still.
//
// LayerHighlight is a piece of teaching: it lights one slice and sweeps the
// light around the turn axis so the layer reads as *going somewhere*, with
// comet streamers and motes riding a belt around it to point the way. None of
// that belongs on a menu, where nothing is being asked of the player. So this
// keeps the rim — the part that is just light lying on the cube — and drops the
// sweep, the streamers, the motes and the direction entirely.
//
// Two other differences from the teaching rim:
//   • It reads as sunlight escaping from inside the cube rather than a gold
//     line drawn on the outside of it. That is two layers, not one: a thin
//     white-hot seam where the light comes through, and a wide warm spill
//     either side of it, the way light behaves coming through a crack. The
//     seam stays inside the black gap between tiles; the spill is allowed to
//     wash a little onto the sticker faces, because that is what light does.
//   • The light breathes rather than travelling. A slow swell moves across the
//     cube on a diagonal and every tile has its own drift, so the grid is never
//     uniform and never still — alive, not animated *toward* anything.
//
// Purely presentational: no raycast (the cube underneath keeps its tap), no
// store writes, and it rides inside the cube's own group so it turns and scales
// with it.

import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EDGE_UV, NOISE_GLSL, buildRimGeometry } from '../../teach/layerGlow.js';

// Sunlight, not the instructor's gold: a near-white core with warm amber in the
// spill. Additive blending pushes the core to white where the light is
// strongest, which is what sells it as coming through rather than lying on.
const SUN_CORE = '#fff6de';
const SUN_WARM = '#ffab33';

const vertexShader = `
  attribute float aPhase;
  varying vec2 vUv;
  varying float vPhase;
  void main() {
    vUv = uv;
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The teaching rim's fray, with the directional sweep replaced by a breath and
// the single filament split into seam + spill. Band width is halved (0.026
// against the instructor's 0.052) so the hot part stays inside the grid gap.
const fragmentShader = `
  uniform vec3  uDeep;
  uniform vec3  uCore;
  uniform float uTime;
  uniform float uEdge;    // tile outline in uv space
  uniform float uOpacity;
  varying vec2  vUv;
  varying float vPhase;   // this face's own place in the flow, [0,1)
  #define TAU 6.28318530718
  ${NOISE_GLSL}

  void main() {
    vec2 p = vUv - 0.5;
    vec2 a = abs(p);
    float m = max(a.x, a.y);
    float d = m - uEdge;   // <0 inside the tile, >0 out in the bleed margin

    // Perimeter coordinate around the tile outline, for the wander.
    float s;
    if (p.y >= a.x)       s = (p.x + 0.5) * 0.25;
    else if (p.x >= a.y)  s = 0.25 + (0.5 - p.y) * 0.25;
    else if (-p.y >= a.x) s = 0.50 + (0.5 - p.x) * 0.25;
    else                  s = 0.75 + (p.y + 0.5) * 0.25;

    // The rim frays and wanders rather than sitting still, offset per face so no
    // two tiles fray in step. The noise carries most of the weight: it is what
    // thins a run of the line to nothing and swells the next, which is the
    // difference between light lying in the gap and a gold bar sitting in it.
    float wander = 1.0 + 0.26 * sin(s * TAU * 3.0 - uTime * 1.3 + vPhase * TAU)
                       + 0.72 * (fbm(vec2(s * 6.0, uTime * 0.35 + vPhase * 4.0)) - 0.5);
    float bw = 0.026 * wander;

    // The crack itself: a thin, white-hot seam, kept narrower than the gap so
    // it never sits on a sticker.
    float seam = exp(-pow(abs(d) / max(bw * 0.7, 0.006), 1.9));

    // The light coming through it. Wide, soft, and falling off on both sides —
    // outward into the air and inward across the edge of the tile, which is the
    // half that makes it read as light landing on a surface rather than a line
    // drawn along one. Slightly wider outward than inward.
    float outward = exp(-pow(max(d, 0.0) / (bw * 5.5), 1.5));
    float inward  = exp(-pow(max(-d, 0.0) / (bw * 3.2), 1.5));
    float spill = max(outward, inward);

    // The breath: a slow swell crossing the cube plus each tile's own drift, so
    // the grid pulses unevenly the way something alive does. Slower and deeper
    // than a flicker — the floor is low on purpose, so a tile the swell has
    // passed nearly goes out and the grid is never lit evenly all over.
    float swell = 0.5 + 0.5 * sin(uTime * 0.42 - vPhase * TAU);
    float drift = fbm(vec2(vPhase * 9.0, uTime * 0.20));
    float breath = 0.30 + swell * 0.95 + (drift - 0.5) * 0.55;

    float glow = (seam * 0.95 + spill * 0.42) * max(breath, 0.0);
    if (glow < 0.004) discard;

    // Amber through most of the spill, running to near-white in the seam and
    // wherever the swell is strongest. Additive blending finishes the job.
    vec3 col = mix(uDeep, uCore, clamp(seam * 1.15 + swell * 0.25, 0.0, 1.0));
    gl_FragColor = vec4(col * 1.25, clamp(glow, 0.0, 1.0) * uOpacity);
  }
`;

/**
 * @param {number} size     cube edge length in cubies
 * @param {number} opacity  global alpha, so a caller can fade the whole grid
 * @param {(x,y,z)=>boolean} [includeCubie]  which cubies light up. The menu
 *        renders two of these while a slice turns — one for the still cubies
 *        and one parented to the turning group — so the light rides the slice
 *        instead of leaving its grid behind. Must be referentially stable
 *        across frames; the geometry rebuilds whenever it changes.
 */
const MenuGridGlow = ({ size = 3, opacity = 1, includeCubie }) => {
  const uTime = useMemo(() => ({ value: 0 }), []);
  const uOpacity = useMemo(() => ({ value: opacity }), []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { uOpacity.value = opacity; }, [opacity, uOpacity]);

  // Every exposed face of the whole cube. The phase is a diagonal across the
  // cube rather than an angle around an axis — there is no axis here, and a
  // diagonal is what makes the swell cross the silhouette instead of circling
  // it.
  const geometry = useMemo(() => {
    const span = Math.max(1, size) * 1.5;
    return buildRimGeometry(size, {
      includeCubie,
      phaseOf: ({ fx, fy, fz }) => {
        const t = (fx + fy + fz) / (2 * span) + 0.5;
        return t - Math.floor(t);
      }
    });
  }, [size, includeCubie]);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(() => ({
    uDeep: { value: new THREE.Color(SUN_WARM) },
    uCore: { value: new THREE.Color(SUN_CORE) },
    uTime,
    uOpacity,
    uEdge: { value: EDGE_UV }
  }), [uTime, uOpacity]);

  useFrame((state) => { uTime.value = state.clock.elapsedTime; });

  return (
    <mesh geometry={geometry} raycast={() => null}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

export default MenuGridGlow;
