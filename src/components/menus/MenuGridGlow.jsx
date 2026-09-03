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
//     white-hot seam where the light comes through, and a narrow warm spill
//     either side of it, the way light behaves coming through a crack. The
//     seam stays inside the black gap between tiles, and the spill barely
//     reaches the sticker — enough to read as light on a surface, not enough
//     to wash the colour out of it.
//   • It is wisps, not a lattice. The seam breaks along its length and fades
//     out before every corner, so what you see is short lit stretches floating
//     in the gaps rather than a bright box drawn around each tile.
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

    // Thickness wanders along the line so no stretch of it is the same width as
    // the next.
    float wander = 1.0 + 0.26 * sin(s * TAU * 3.0 - uTime * 1.3 + vPhase * TAU)
                       + 0.72 * (fbm(vec2(s * 6.0, uTime * 0.35 + vPhase * 4.0)) - 0.5);
    float bw = 0.021 * wander;

    // What keeps this from reading as a lit box: the line is broken along its
    // length, and every edge fades out before it reaches a corner. Wandering
    // thickness alone was not enough — a line that only gets thinner and fatter
    // is still a continuous line, and four continuous lines meeting at corners
    // is a rectangle drawn around the tile. So:
    //
    //   along  - noise travelling down the edge, thresholded hard enough to take
    //            whole stretches to nothing. What is left is wisps.
    //   corner - s runs 0..1 around the tile with a corner every quarter, so
    //            this fades the last sixth of each edge. Nothing meets at the
    //            corners any more, which is where the eye read "box", and the
    //            bright knots where two edges crossed are gone with it.
    float along = fbm(vec2(s * 5.0 + vPhase * 7.0, uTime * 0.26));
    float e = fract(s * 4.0);
    float wisp = smoothstep(0.30, 0.72, along) * smoothstep(0.0, 0.17, min(e, 1.0 - e));

    // The crack itself: a thin, white-hot seam, kept narrower than the gap so it
    // never sits on a sticker.
    float seam = exp(-pow(abs(d) / max(bw * 0.7, 0.006), 1.9));

    // The light coming through it, falling off on both sides — outward into the
    // air, and a much shorter distance inward across the edge of the tile. The
    // inward half is what reads as light landing on a surface, but it is the
    // half that bleaches the sticker if it is given any room, so it gets very
    // little.
    float outward = exp(-pow(max(d, 0.0) / (bw * 3.4), 1.5));
    float inward  = exp(-pow(max(-d, 0.0) / (bw * 1.3), 1.5));
    float spill = max(outward, inward);

    // The breath: a slow swell crossing the cube plus each tile's own drift, so
    // the grid pulses unevenly the way something alive does. Slower and deeper
    // than a flicker — the floor is low on purpose, so a tile the swell has
    // passed nearly goes out and the grid is never lit evenly all over.
    float swell = 0.5 + 0.5 * sin(uTime * 0.42 - vPhase * TAU);
    float drift = fbm(vec2(vPhase * 9.0, uTime * 0.20));
    float breath = 0.30 + swell * 0.95 + (drift - 0.5) * 0.55;

    // The spill keeps a faint continuous floor where the seam has broken away,
    // so the grid still reads as a grid — but the hot light only exists where
    // there is a wisp to carry it.
    float glow = (seam * 0.52 * wisp + spill * 0.15 * mix(0.30, 1.0, wisp)) * max(breath, 0.0);
    if (glow < 0.004) discard;

    // Amber almost everywhere; only the hottest part of a wisp runs to white.
    vec3 col = mix(uDeep, uCore, clamp(seam * wisp * 0.85, 0.0, 1.0));
    gl_FragColor = vec4(col * 0.95, clamp(glow, 0.0, 1.0) * uOpacity);
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
