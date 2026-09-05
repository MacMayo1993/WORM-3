// src/teach/LayerHighlight.jsx
// The instructor's hint for "turn THIS layer, THIS way", drawn as light in the
// world rather than as UI chrome pasted over it.
//
// Three pieces, all the same warm gold:
//   1. A soft gold rim that hugs every exposed tile of the target slice and
//      bleeds a little off the tile edge, with brighter light sweeping around
//      the belt in the direction of the turn.
//   2. Wispy comet streamers orbiting the layer, tapering to a bright point at
//      the leading tip so the shape itself reads as an arrowhead. They ride a
//      belt wide enough to clear the cube's corner diagonal — nothing cuts
//      through the cube.
//   3. Gold motes drifting along the same belt, carried the way the layer turns.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// Face basis, quad sizing, gold palette, noise and the merged-quad builder are
// shared with the menu's ambient grid glow — see teach/layerGlow.js.
import { EDGE_UV, GOLD_DEEP, GOLD_CORE, NOISE_GLSL, buildRimGeometry } from './layerGlow.js';

// ─── 1. Layer rim ─────────────────────────────────────────────────────────────

const rimVertexShader = `
  attribute float aPhase;
  varying vec2 vUv;
  varying float vPhase;
  void main() {
    vUv = uv;
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rimFragmentShader = `
  uniform vec3  uDeep;
  uniform vec3  uCore;
  uniform float uTime;
  uniform float uDir;    // +1 / -1 → the sweep travels with the turn
  uniform float uEdge;   // tile outline in uv space
  uniform float uOpacity;
  uniform float uGain;   // thickens the rim itself (1 = the solver's hint)
  varying vec2  vUv;
  varying float vPhase;  // this face's angular position around the turn axis, [0,1)
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

    // The rim breathes and frays instead of sitting still.
    float wander = 1.0 + 0.20 * sin(s * TAU * 3.0 - uTime * 2.0)
                       + 0.45 * (fbm(vec2(s * 6.0, uTime * 0.5)) - 0.5);
    float bw   = 0.052 * wander;
    float line = exp(-pow(abs(d) / max(bw, 0.012), 1.7));       // filament on the outline
    float halo = exp(-pow(max(d, 0.0) / (bw * 3.0), 2.0)) * 0.4; // soft bleed outward
    float fill = 1.0 - smoothstep(uEdge - 0.03, uEdge, m);       // faint sheen inside the tile

    // Light runs around the whole belt in the turn direction; each face lights
    // up as it passes. This is what makes the layer read as *going somewhere*.
    float sweep = 0.0;
    for (int i = 0; i < 3; i++) {
      float wp = fract(float(i) / 3.0 + uDir * uTime * 0.13);
      float dd = abs(fract(vPhase - wp + 0.5) - 0.5);
      sweep += exp(-(dd * dd) / (0.09 * 0.09));
    }
    sweep = clamp(sweep, 0.0, 1.25);

    float glow = ((line * 0.40 + halo * 0.60) * (0.45 + sweep * 1.05) + fill * (0.03 + sweep * 0.055)) * uGain;
    if (glow < 0.004) discard;

    vec3 col = mix(uDeep, uCore, clamp(sweep * 0.6 + line * 0.3, 0.0, 1.0));
    gl_FragColor = vec4(col * 1.15, clamp(glow, 0.0, 1.0) * uOpacity);
  }
`;

// ─── 2. Wisp streamers ────────────────────────────────────────────────────────

// One tapered, gently wandering tube swept along an arc of the belt. The tip
// (t = 1) is the leading end: it narrows to a point in the direction of travel.
function buildWisp(radius, span, dir, maxR) {
  const SEG = 72;
  const RING = 8;
  const positions = [];
  const normals = [];
  const ts = [];
  const rings = [];
  const indices = [];

  const centre = (f) => {
    const ang = dir * span * (f - 1.0);
    const rad = radius + 0.09 * Math.sin(f * 8.5 + 0.7);
    return [Math.cos(ang) * rad, Math.sin(ang) * rad, 0.14 * Math.sin(f * 5.3 + 1.9), Math.cos(ang), Math.sin(ang)];
  };

  for (let i = 0; i <= SEG; i++) {
    const f = i / SEG;
    const [cx, cy, cz, nx, ny] = centre(f);
    // Comet profile: nothing at the tail, mass around 2/3 along, a point at the tip.
    const rr = maxR * Math.pow(Math.sin(Math.PI * Math.pow(f, 1.8)), 0.85);
    for (let j = 0; j <= RING; j++) {
      const th = (j / RING) * Math.PI * 2;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      // Flattened cross-section: taller along the turn axis than it is deep.
      positions.push(cx + nx * ct * 0.8 * rr, cy + ny * ct * 0.8 * rr, cz + st * 1.15 * rr);
      const len = Math.hypot(nx * ct, ny * ct, st) || 1;
      normals.push((nx * ct) / len, (ny * ct) / len, st / len);
      ts.push(f);
      rings.push(j / RING);
    }
  }

  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < RING; j++) {
      const a = i * (RING + 1) + j;
      const b = a + RING + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1));
  geo.setAttribute('aRing', new THREE.Float32BufferAttribute(rings, 1));
  geo.setIndex(indices);

  const [tx, ty, tz] = centre(1);
  return { geo, tip: [tx, ty, tz] };
}

const wispVertexShader = `
  attribute float aT;
  attribute float aRing;
  varying float vT;
  varying float vRing;
  varying vec3  vNrm;
  varying vec3  vView;
  void main() {
    vT = aT;
    vRing = aRing;
    vNrm = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const wispFragmentShader = `
  uniform vec3  uDeep;
  uniform vec3  uCore;
  uniform float uTime;
  uniform float uSoft;  // 0 = the streamer itself, 1 = the haze around it
  uniform float uOpacity;
  varying float vT;
  varying float vRing;
  varying vec3  vNrm;
  varying vec3  vView;
  #define TAU 6.28318530718
  ${NOISE_GLSL}

  void main() {
    // Dense at the head, dissolving into nothing at the tail.
    float body = smoothstep(0.0, 0.55, vT) * (0.35 + 0.65 * pow(vT, 1.6));

    // Strands of smoke drifting backwards along the streamer. Sampling the ring
    // coordinate through cos/sin keeps the noise seamless around the tube.
    float n = fbm(vec2(vT * 9.0 - uTime * 1.15, 2.0 + cos(vRing * TAU) * 1.3))
            + fbm(vec2(vT * 5.0 - uTime * 0.55, 7.0 + sin(vRing * TAU) * 1.3));
    float strands = smoothstep(0.42, 0.86, n * 0.5);

    // Grazing angles carry nearly all the light, so the tube reads as something
    // gaseous seen through rather than a solid gold hose.
    float fres = pow(1.0 - abs(dot(normalize(vNrm), normalize(vView))), 1.5);

    float core = body * mix(0.05, 1.0, strands) * (0.12 + 1.05 * fres) * 1.9;
    core += smoothstep(0.78, 1.0, vT) * 0.55 * (0.35 + fres); // hot leading tip
    float haze = body * (0.10 + 0.55 * strands) * pow(fres, 1.4) * 0.45;

    float alpha = mix(core, haze, uSoft);
    if (alpha < 0.004) discard;

    vec3 col = mix(uDeep, uCore, clamp(strands * 0.55 + pow(vT, 2.2) * 0.85, 0.0, 1.0));
    gl_FragColor = vec4(col * mix(1.45, 0.85, uSoft), clamp(alpha, 0.0, 1.0) * uOpacity);
  }
`;

// ─── 3. Tip flares + drifting motes ───────────────────────────────────────────

const flareVertexShader = `
  uniform float uTime;
  uniform float uSize;
  attribute float aSeed;
  varying float vFade;
  void main() {
    vFade = 1.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float pulse = 0.85 + 0.15 * sin(uTime * 3.0 + aSeed * 6.283);
    gl_PointSize = clamp(uSize * pulse * (300.0 / -mv.z), 4.0, 190.0);
    gl_Position = projectionMatrix * mv;
  }
`;

// Motes ride the belt themselves: the orbit is computed here so they keep
// drifting independently of the streamers' rotation.
const moteVertexShader = `
  uniform float uTime;
  uniform float uDir;
  uniform float uSize;
  attribute float aSeed;
  attribute float aAngle;
  varying float vFade;
  void main() {
    float ang = aAngle + uDir * uTime * (0.30 + aSeed * 0.25);
    float r = position.x + 0.10 * sin(uTime * 0.9 + aSeed * 6.283);
    float z = position.z + 0.14 * sin(uTime * 0.7 + aSeed * 4.0);
    vec4 mv = modelViewMatrix * vec4(cos(ang) * r, sin(ang) * r, z, 1.0);
    vFade = 0.30 + 0.70 * pow(0.5 + 0.5 * sin(uTime * 1.4 + aSeed * 6.283), 2.0);
    gl_PointSize = clamp(uSize * (300.0 / -mv.z), 1.0, 60.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const sparkFragmentShader = `
  uniform vec3 uDeep;
  uniform vec3 uCore;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    if (d > 1.0) discard;
    float core = pow(1.0 - d, 2.4);
    float halo = exp(-d * d * 3.2) * 0.5;
    vec3 col = mix(uDeep, uCore, core);
    gl_FragColor = vec4(col, clamp((core * 0.75 + halo) * vFade, 0.0, 1.0) * uOpacity);
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

const STREAMERS = 3;

/**
 * @param opacity     static alpha for the whole effect
 * @param opacityRef  a ref whose current value overrides `opacity` every frame —
 *                    for a caller that ramps the hint (worm mode's turn warning
 *                    breathes, then bears down) without re-rendering it
 * @param gain        thickens the rim on the tiles themselves; 1 is the solver's
 *                    hint, higher reads as a hazard rather than a suggestion
 */
const LayerHighlight = ({ axis, sliceIndex, dir, size, color = null, opacity = 1, opacityRef = null, gain = 1 }) => {
  const spinnerRef = useRef();
  const turn = dir === 1 ? 1 : -1;

  // Shared clock + direction, so every material animates off one source.
  const uTime = useMemo(() => ({ value: 0 }), []);
  const uDir = useMemo(() => ({ value: turn }), []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { uDir.value = turn; }, [turn, uDir]);

  // Global alpha scale, shared by every material so callers can dim the whole
  // effect (worm mode runs it a touch softer than the solver's hints).
  const uOpacity = useMemo(() => ({ value: opacity }), []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { uOpacity.value = opacity; }, [opacity, uOpacity]);

  const uGain = useMemo(() => ({ value: gain }), []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { uGain.value = gain; }, [gain, uGain]);

  // Gold by default (the instructor's hint). When a caller passes a colour — worm
  // mode hands in the player's chosen worm colour — use it for the deep tone and a
  // whiter version of it for the hot core, preserving the deep→pale gradient.
  const palette = useMemo(() => {
    const deep = new THREE.Color(color ?? GOLD_DEEP);
    const core = color ? deep.clone().lerp(new THREE.Color('#ffffff'), 0.55) : new THREE.Color(GOLD_CORE);
    return { uDeep: { value: deep }, uCore: { value: core } };
  }, [color]);

  // One merged geometry of every exposed cubie face in the target slice. The
  // phase is the face's angular position around the rotation axis, which is
  // what makes the sweep read as travelling the way the layer will turn.
  const rimGeometry = useMemo(() => {
    const inSlice = (x, y, z) =>
      axis === 'col' ? x === sliceIndex : axis === 'row' ? y === sliceIndex : z === sliceIndex;

    return buildRimGeometry(size, {
      includeCubie: inSlice,
      phaseOf: ({ fx, fy, fz }) => {
        // In-plane coords depend on the turn axis.
        let c1, c2;
        if (axis === 'col') { c1 = fy; c2 = fz; }        // X axis
        else if (axis === 'row') { c1 = fz; c2 = fx; }   // Y axis
        else { c1 = fx; c2 = fy; }                        // Z axis
        return Math.atan2(c2, c1) / (Math.PI * 2) + 0.5;
      }
    });
  }, [axis, sliceIndex, size]);

  React.useEffect(() => () => rimGeometry.dispose(), [rimGeometry]);

  const rimUniforms = useMemo(() => ({
    ...palette, uTime, uDir, uOpacity, uGain, uEdge: { value: EDGE_UV }
  }), [palette, uTime, uDir, uOpacity, uGain]);

  // The belt the streamers and motes ride: outside the layer's corner diagonal,
  // so nothing ever clips through the cube however it is oriented.
  const belt = useMemo(() => {
    const axisVec =
      axis === 'col' ? new THREE.Vector3(1, 0, 0)
        : axis === 'row' ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisVec);
    const axial = sliceIndex - (size - 1) / 2;
    const pos = axisVec.clone().multiplyScalar(axial);
    // Corner diagonal of the slice, plus room for the streamers' full haze.
    const radius = (size / 2) * Math.SQRT2 + 0.7;
    return {
      quaternion: [q.x, q.y, q.z, q.w],
      position: [pos.x, pos.y, pos.z],
      radius
    };
  }, [axis, sliceIndex, size]);

  // Streamer body, the haze around it, and a flare at each leading tip.
  const streamers = useMemo(() => {
    const thickness = 0.13 + size * 0.03;
    const { geo, tip } = buildWisp(belt.radius, 1.5, turn, thickness);
    const { geo: aura } = buildWisp(belt.radius, 1.5, turn, thickness * 2.4);

    const flare = new THREE.BufferGeometry();
    const pts = [];
    const seeds = [];
    for (let i = 0; i < STREAMERS; i++) {
      const a = (i / STREAMERS) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      pts.push(tip[0] * ca - tip[1] * sa, tip[0] * sa + tip[1] * ca, tip[2]);
      seeds.push(i / STREAMERS);
    }
    flare.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    flare.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    return { geo, aura, flare };
  }, [belt.radius, turn, size]);

  React.useEffect(() => () => {
    streamers.geo.dispose();
    streamers.aura.dispose();
    streamers.flare.dispose();
  }, [streamers]);

  // Loose motes scattered around the belt, always outside the cube.
  const motes = useMemo(() => {
    const COUNT = 44;
    const pts = [];
    const seeds = [];
    const angles = [];
    for (let i = 0; i < COUNT; i++) {
      const t = (i + 0.5) / COUNT;
      pts.push(belt.radius + 0.05 + Math.sin(i * 12.9898) * 0.3, 0, Math.sin(i * 78.233) * 0.45);
      seeds.push(t);
      angles.push(t * Math.PI * 2 + Math.sin(i * 4.1) * 0.4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geo.setAttribute('aAngle', new THREE.Float32BufferAttribute(angles, 1));
    return geo;
  }, [belt.radius]);

  React.useEffect(() => () => motes.dispose(), [motes]);

  const wispUniforms = useMemo(() => ({ ...palette, uTime, uOpacity, uSoft: { value: 0 } }), [palette, uTime, uOpacity]);
  const auraUniforms = useMemo(() => ({ ...palette, uTime, uOpacity, uSoft: { value: 1 } }), [palette, uTime, uOpacity]);
  const flareUniforms = useMemo(() => ({ ...palette, uTime, uOpacity, uSize: { value: 0.26 } }), [palette, uTime, uOpacity]);
  const moteUniforms = useMemo(() => ({ ...palette, uTime, uDir, uOpacity, uSize: { value: 0.075 } }), [palette, uTime, uDir, uOpacity]);

  useFrame((state, delta) => {
    uTime.value = state.clock.elapsedTime;
    // A caller driving the intensity per frame owns it outright — this is the
    // one write, so nothing re-renders to make the hint brighten.
    if (opacityRef) uOpacity.value = opacityRef.current;
    // Carry the streamers around the belt the way the layer will turn.
    if (spinnerRef.current) spinnerRef.current.rotation.z += delta * turn * 0.85;
  });

  return (
    <group>
      {/* Gold rim on the layer's own tiles, sweeping in the turn direction */}
      <mesh geometry={rimGeometry} raycast={() => null}>
        <shaderMaterial
          vertexShader={rimVertexShader}
          fragmentShader={rimFragmentShader}
          uniforms={rimUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <group quaternion={belt.quaternion} position={belt.position}>
        {/* Streamers orbiting the layer, tips leading the way round */}
        <group ref={spinnerRef}>
          {Array.from({ length: STREAMERS }, (_, i) => (
            <group key={i} rotation={[0, 0, (i / STREAMERS) * Math.PI * 2]}>
              <mesh geometry={streamers.aura} raycast={() => null}>
                <shaderMaterial
                  vertexShader={wispVertexShader}
                  fragmentShader={wispFragmentShader}
                  uniforms={auraUniforms}
                  transparent
                  side={THREE.DoubleSide}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
              <mesh geometry={streamers.geo} raycast={() => null}>
                <shaderMaterial
                  vertexShader={wispVertexShader}
                  fragmentShader={wispFragmentShader}
                  uniforms={wispUniforms}
                  transparent
                  side={THREE.DoubleSide}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            </group>
          ))}

          {/* Hot point at each streamer tip — the thing the eye follows */}
          <points geometry={streamers.flare} raycast={() => null}>
            <shaderMaterial
              vertexShader={flareVertexShader}
              fragmentShader={sparkFragmentShader}
              uniforms={flareUniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        </group>

        {/* Motes carried along the same belt */}
        <points geometry={motes} raycast={() => null} frustumCulled={false}>
          <shaderMaterial
            vertexShader={moteVertexShader}
            fragmentShader={sparkFragmentShader}
            uniforms={moteUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </group>
  );
};

export default LayerHighlight;
