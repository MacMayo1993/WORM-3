import { useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FLIP_CAP } from '../utils/constants.js';

const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

const FACE_OFFSET   = 0.52;
const RIBBON_WIDTH  = 0.85;
const RIBBON_SEGS   = 32;   // must be even
const REBUILD_EPS_SQ = 1e-4;
const MINI_FACE_R   = 0.25; // must match MINI_S in VoidCore.jsx
const TAPER_MIN     = 0.15; // narrowest fraction of full width at the mini-cube
const BUMPER_HEIGHT = 0.22; // guard-rail height at full width (world units)

// Module-level cached objects — no per-frame allocation.
const _wPos1         = new THREE.Vector3();
const _wPos2         = new THREE.Vector3();
const _wQuat1        = new THREE.Quaternion();
const _wQuat2        = new THREE.Quaternion();
const _faceNorm1     = new THREE.Vector3();
const _faceNorm2     = new THREE.Vector3();
const _vStart        = new THREE.Vector3();
const _vEnd          = new THREE.Vector3();
const _midA          = new THREE.Vector3();
const _midB          = new THREE.Vector3();
const _axis          = new THREE.Vector3();
const _perpBase      = new THREE.Vector3();
const _perpCurrent   = new THREE.Vector3();
const _segTangent    = new THREE.Vector3();
const _surfaceNormal = new THREE.Vector3();
const _up            = new THREE.Vector3(0, 1, 0);
const _side          = new THREE.Vector3(0, 0, 1);

// Vertex shader: pass UV through to fragment.
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Racing-stripes fragment shader.
// Both halves of the ribbon scroll toward the center mini-cube (halfPos mirrors
// vUv.y so t=0 at tile ends, t=1 at the crossing).  Three coloured lanes
// separated by white dividers race inward like Mario Kart Rainbow Road lanes.
// uGrowT (0→1): tunnel birth grow-in — clips the ribbon so beams grow from each
//   tile portal toward the center, meeting when uGrowT reaches 1.
// uPulseBoost (0→1→0): subsequent-flip brightness burst.
const fragmentShader = `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uGrowT;
  uniform float uPulseBoost;
  varying vec2  vUv;

  void main() {
    // Tunnel birth grow-in: vUv.y 0=tile1 end, 0.5=centre, 1=tile2 end.
    // Left beam grows from 0 toward 0.5; right beam grows from 1 toward 0.5.
    // Discard the ungrown middle until both beams meet at the centre.
    float leftFront  = uGrowT * 0.5;
    float rightFront = 1.0 - uGrowT * 0.5;
    if (vUv.y > leftFront && vUv.y < rightFront) discard;

    // Mirror so stripes flow toward the centre from both tile ends.
    float halfPos = vUv.y < 0.5 ? vUv.y * 2.0 : (1.0 - vUv.y) * 2.0;
    float scroll  = fract(halfPos * 5.0 - uTime * 2.5);
    float pos     = scroll * 5.0; // 0 → 5 within one repeat

    vec3  col  = vec3(0.0);
    float mask = 0.0;

    // Velocity spark: white-hot flash at the leading edge of each repeat
    float spark = (1.0 - smoothstep(0.0, 0.06, pos)) * 0.9;

    if (pos < 1.1) {
      // Lane A — colorA
      mask = 1.0 - smoothstep(0.85, 1.1, pos);
      col  = mix(uColorA * 1.5, vec3(1.2), spark);
    } else if (pos < 1.5) {
      // White lane divider
      float d = (pos - 1.1) / 0.4;
      mask = (1.0 - abs(d * 2.0 - 1.0)) * 0.75;
      col  = vec3(1.0);
    } else if (pos < 3.1) {
      // Lane mid — blend of both antipodal colors
      mask = 1.0 - smoothstep(2.85, 3.1, pos);
      col  = mix(uColorA, uColorB, 0.5) * 1.6;
    } else if (pos < 3.5) {
      // White lane divider
      float d = (pos - 3.1) / 0.4;
      mask = (1.0 - abs(d * 2.0 - 1.0)) * 0.75;
      col  = vec3(1.0);
    } else if (pos < 4.6) {
      // Lane B — colorB
      mask = 1.0 - smoothstep(4.35, 4.6, pos);
      col  = uColorB * 1.5;
    }
    // else: fully transparent gap — cube geometry shows through (space feel)

    float edgeFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
    // Pulse boost brightens color and bumps opacity on subsequent flips
    float boostOpacity = uOpacity + uPulseBoost * 0.45;

    // Black border stripe along each ribbon edge — makes the tunnel feel solid underfoot
    float leftEdge    = 1.0 - smoothstep(0.0, 0.055, vUv.x);
    float rightEdge   = 1.0 - smoothstep(1.0, 0.945, vUv.x);
    float edgeOutline = clamp(leftEdge + rightEdge, 0.0, 1.0);

    vec3  finalCol   = mix(col * (1.0 + uPulseBoost * 1.2), vec3(0.0), edgeOutline);
    float finalAlpha = max(boostOpacity * edgeFade * mask, edgeOutline * 0.88);
    gl_FragColor = vec4(finalCol, finalAlpha);
  }
`;

// Bumper vertex shader: passes height fraction for the top-edge fade.
const bumperVertexShader = `
  attribute float aHeightFrac;
  varying  float vHeightFrac;
  void main() {
    vHeightFrac = aHeightFrac;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Bumper fragment shader: solid neon colour, fading at the top edge.
// The Möbius half-twist continuously rotates the surface normal, so the
// bumper that starts pointing "up" at tile 1 ends pointing "down" at tile 2
// — the non-orientability of RP2 made physically visible.
const bumperFragmentShader = `
  uniform vec3  uColor;
  uniform float uOpacity;
  varying float vHeightFrac;

  void main() {
    float topFade = 1.0 - smoothstep(0.6, 1.0, vHeightFrac);

    // Black outline at base and top of each guard rail — makes bumpers feel like solid barriers
    float baseOutline = 1.0 - smoothstep(0.0, 0.15, vHeightFrac);
    float topOutline  = (1.0 - smoothstep(1.0, 0.80, vHeightFrac)) * topFade;
    float outline     = clamp(baseOutline + topOutline, 0.0, 1.0);

    vec3  finalCol   = mix(uColor * 1.8, vec3(0.0), outline);
    float finalAlpha = max(uOpacity * topFade, outline * 0.92);
    gl_FragColor = vec4(finalCol, finalAlpha);
  }
`;

/**
 * Fill position + UV buffers for the Möbius ribbon.
 * Path: startPos → midAPos (first arm) | gap (mini-cube interior) | midBPos → endPos (second arm).
 * Width tapers from full at tile ends to TAPER_MIN fraction at the mini-cube crossing.
 * Cross-section direction (_perpCurrent) rotates π via applyAxisAngle — the Möbius half-twist.
 */
function fillRibbon(posArray, uvArray, startPos, midAPos, midBPos, endPos, axis, perpStart, segs, width) {
  const halfW    = width / 2;
  const halfSegs = segs / 2;

  for (let i = 0; i <= segs; i++) {
    const t     = i / segs;
    const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
    const w     = halfW * taper;

    let cx, cy, cz;
    if (i <= halfSegs) {
      const s = i / halfSegs;
      cx = startPos.x + (midAPos.x - startPos.x) * s;
      cy = startPos.y + (midAPos.y - startPos.y) * s;
      cz = startPos.z + (midAPos.z - startPos.z) * s;
    } else {
      const s = (i - halfSegs) / halfSegs;
      cx = midBPos.x + (endPos.x - midBPos.x) * s;
      cy = midBPos.y + (endPos.y - midBPos.y) * s;
      cz = midBPos.z + (endPos.z - midBPos.z) * s;
    }

    _perpCurrent.copy(perpStart).applyAxisAngle(axis, t * Math.PI);

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -w : w;
      const vi   = (i * 2 + side) * 3;
      posArray[vi]     = cx + _perpCurrent.x * sign;
      posArray[vi + 1] = cy + _perpCurrent.y * sign;
      posArray[vi + 2] = cz + _perpCurrent.z * sign;
      const ui = (i * 2 + side) * 2;
      uvArray[ui]     = side;
      uvArray[ui + 1] = t;
    }
  }
}

/**
 * Fill left and right bumper geometry buffers.
 *
 * Each bumper is a thin wall that rises from a ribbon edge in the direction of the
 * ribbon's surface normal (= segTangent × perpCurrent).  Because perpCurrent rotates
 * π over the full ribbon length (the Möbius half-twist), the surface normal also
 * rotates π — the bumper that is upright at tile 1 ends inverted at tile 2,
 * demonstrating RP2 non-orientability.
 */
function fillBumpers(
  leftPosArr, rightPosArr, leftHFArr, rightHFArr,
  startPos, midAPos, midBPos, endPos,
  axis, perpStart, segs, width
) {
  const halfW    = width / 2;
  const halfSegs = segs / 2;

  // Segment tangents for each arm (constant within each half)
  const tAx = midAPos.x - startPos.x;
  const tAy = midAPos.y - startPos.y;
  const tAz = midAPos.z - startPos.z;
  const tALen = Math.sqrt(tAx * tAx + tAy * tAy + tAz * tAz) || 1;

  const tBx = endPos.x - midBPos.x;
  const tBy = endPos.y - midBPos.y;
  const tBz = endPos.z - midBPos.z;
  const tBLen = Math.sqrt(tBx * tBx + tBy * tBy + tBz * tBz) || 1;

  for (let i = 0; i <= segs; i++) {
    const t     = i / segs;
    const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
    const w     = halfW * taper;
    const bh    = BUMPER_HEIGHT * taper;

    // Centre position (same piecewise formula as fillRibbon)
    let cx, cy, cz;
    if (i <= halfSegs) {
      const s = i / halfSegs;
      cx = startPos.x + (midAPos.x - startPos.x) * s;
      cy = startPos.y + (midAPos.y - startPos.y) * s;
      cz = startPos.z + (midAPos.z - startPos.z) * s;
    } else {
      const s = (i - halfSegs) / halfSegs;
      cx = midBPos.x + (endPos.x - midBPos.x) * s;
      cy = midBPos.y + (endPos.y - midBPos.y) * s;
      cz = midBPos.z + (endPos.z - midBPos.z) * s;
    }

    // Width (cross-section) direction with Möbius half-twist
    _perpCurrent.copy(perpStart).applyAxisAngle(axis, t * Math.PI);

    // Segment tangent for this arm
    if (i <= halfSegs) {
      _segTangent.set(tAx / tALen, tAy / tALen, tAz / tALen);
    } else {
      _segTangent.set(tBx / tBLen, tBy / tBLen, tBz / tBLen);
    }

    // Surface normal: tangent × perpCurrent — rotates 180° over the ribbon length
    _surfaceNormal.crossVectors(_segTangent, _perpCurrent);
    if (_surfaceNormal.lengthSq() < 0.001) {
      _surfaceNormal.crossVectors(_up, _perpCurrent);
    }
    _surfaceNormal.normalize();

    // Ribbon edge positions
    const lx = cx - _perpCurrent.x * w;
    const ly = cy - _perpCurrent.y * w;
    const lz = cz - _perpCurrent.z * w;

    const rx = cx + _perpCurrent.x * w;
    const ry = cy + _perpCurrent.y * w;
    const rz = cz + _perpCurrent.z * w;

    // Bumper top positions (edge + surface-normal * height)
    const ltx = lx + _surfaceNormal.x * bh;
    const lty = ly + _surfaceNormal.y * bh;
    const ltz = lz + _surfaceNormal.z * bh;

    const rtx = rx + _surfaceNormal.x * bh;
    const rty = ry + _surfaceNormal.y * bh;
    const rtz = rz + _surfaceNormal.z * bh;

    const base = i * 2;
    // Left bumper: bottom (hf=0) then top (hf=1)
    leftPosArr[base * 3]       = lx;  leftPosArr[base * 3 + 1]   = ly;  leftPosArr[base * 3 + 2]   = lz;
    leftHFArr[base]            = 0;
    leftPosArr[(base+1)*3]     = ltx; leftPosArr[(base+1)*3 + 1] = lty; leftPosArr[(base+1)*3 + 2] = ltz;
    leftHFArr[base + 1]        = 1;

    // Right bumper: bottom (hf=0) then top (hf=1)
    rightPosArr[base * 3]      = rx;  rightPosArr[base * 3 + 1]  = ry;  rightPosArr[base * 3 + 2]  = rz;
    rightHFArr[base]           = 0;
    rightPosArr[(base+1)*3]    = rtx; rightPosArr[(base+1)*3 + 1] = rty; rightPosArr[(base+1)*3 + 2] = rtz;
    rightHFArr[base + 1]       = 1;
  }
}

function createRibbonGeos(segs) {
  const vertCount = (segs + 1) * 2;

  // Shared quad-strip index pattern (skip the gap at segs/2 hidden by mini-cube body)
  const mainIndices = [];
  const bumpIndices = [];
  for (let i = 0; i < segs; i++) {
    if (i === segs / 2) continue;
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    mainIndices.push(a, b, c, b, d, c);
    bumpIndices.push(a, b, c, b, d, c);
  }

  // Main ribbon
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(vertCount * 2), 2));
  geo.setIndex(mainIndices);

  // Bumper geometries
  function makeBumperGeo() {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position',    new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
    bg.setAttribute('aHeightFrac', new THREE.BufferAttribute(new Float32Array(vertCount),     1));
    bg.setIndex([...bumpIndices]);
    return bg;
  }

  return { geo, leftGeo: makeBumperGeo(), rightGeo: makeBumperGeo() };
}

/**
 * MobiusTunnel — one Möbius ribbon + two guard-rail bumpers per active antipodal sticker pair.
 *
 * Racing stripes scroll toward the center mini-cube from both tile ends (Rainbow Road feel).
 * Bumpers on each ribbon edge physically rotate 180° over the ribbon length due to the
 * Möbius half-twist, going from upright to inverted — demonstrating RP2 non-orientability.
 */
const MobiusTunnel = ({
  meshIdx1, meshIdx2, dirKey1, dirKey2, cubieRefs, flips, color1, color2, tunnelId,
}) => {
  const meshRef  = useRef();
  const pulseT   = useRef(Math.random() * Math.PI * 2);
  const lastStartRef = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const lastEndRef   = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  const { tunnelBirths, tunnelPulses } = useGameStore(
    useShallow(s => ({ tunnelBirths: s.tunnelBirths, tunnelPulses: s.tunnelPulses }))
  );

  const { geo, leftGeo, rightGeo } = useMemo(() => createRibbonGeos(RIBBON_SEGS), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniforms = useMemo(() => ({
    uColorA:     { value: new THREE.Color(color1) },
    uColorB:     { value: new THREE.Color(color2) },
    uOpacity:    { value: 0.80 },
    uTime:       { value: 0.0 },
    uGrowT:      { value: 1.0 },
    uPulseBoost: { value: 0.0 },
  }), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bumperUniformsL = useMemo(() => ({
    uColor:   { value: new THREE.Color(color1) },
    uOpacity: { value: 0.85 },
  }), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bumperUniformsR = useMemo(() => ({
    uColor:   { value: new THREE.Color(color2) },
    uOpacity: { value: 0.85 },
  }), []);

  useEffect(() => {
    const g = geo, lg = leftGeo, rg = rightGeo;
    return () => { g.dispose(); lg.dispose(); rg.dispose(); };
  }, [geo, leftGeo, rightGeo]);

  useFrame((_state, delta) => {
    const mesh1 = cubieRefs[meshIdx1];
    const mesh2 = cubieRefs[meshIdx2];
    if (!mesh1 || !mesh2 || !meshRef.current) return;

    mesh1.getWorldPosition(_wPos1);
    mesh1.getWorldQuaternion(_wQuat1);
    mesh2.getWorldPosition(_wPos2);
    mesh2.getWorldQuaternion(_wQuat2);

    const n1 = FACE_NORM_LOCAL[dirKey1];
    const n2 = FACE_NORM_LOCAL[dirKey2];
    _faceNorm1.set(n1[0], n1[1], n1[2]).applyQuaternion(_wQuat1);
    _faceNorm2.set(n2[0], n2[1], n2[2]).applyQuaternion(_wQuat2);

    // Ribbon anchors: just inside each sticker tile's back surface
    _vStart.copy(_wPos1).addScaledVector(_faceNorm1, -FACE_OFFSET);
    _vEnd  .copy(_wPos2).addScaledVector(_faceNorm2, -FACE_OFFSET);

    // Mini-cube face docking points — centre always at world origin
    _midA.copy(_faceNorm1).multiplyScalar(MINI_FACE_R);
    _midB.copy(_faceNorm2).multiplyScalar(MINI_FACE_R);

    const moved =
      lastStartRef.current.distanceToSquared(_vStart) > REBUILD_EPS_SQ ||
      lastEndRef  .current.distanceToSquared(_vEnd)   > REBUILD_EPS_SQ;

    // Tick the racing-stripes scroll every frame (no geometry rebuild required)
    uniforms.uTime.value += delta;

    if (moved) {
      lastStartRef.current.copy(_vStart);
      lastEndRef  .current.copy(_vEnd);

      // Twist axis: overall start-to-end direction
      _axis.subVectors(_vEnd, _vStart).normalize();

      // Initial cross-section direction: tangent to tile 1's face surface.
      // crossVectors(axis, faceNorm1) is perpendicular to both — the ribbon
      // emerges flush from side/top/bottom tiles instead of cutting through them.
      // Falls back to world-up/side for direct face-to-centre connections.
      _perpBase.crossVectors(_axis, _faceNorm1);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _up);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _side);
      _perpBase.normalize();

      const dead = flips >= FLIP_CAP;
      const cA = dead ? '#555555' : color1;
      const cB = dead ? '#444444' : color2;
      uniforms.uColorA.value.set(cA);
      uniforms.uColorB.value.set(cB);
      bumperUniformsL.uColor.value.set(cA);
      bumperUniformsR.uColor.value.set(cB);

      fillRibbon(
        geo.attributes.position.array,
        geo.attributes.uv.array,
        _vStart, _midA, _midB, _vEnd,
        _axis, _perpBase,
        RIBBON_SEGS, RIBBON_WIDTH
      );
      geo.attributes.position.needsUpdate = true;
      geo.attributes.uv.needsUpdate = true;

      fillBumpers(
        leftGeo.attributes.position.array,
        rightGeo.attributes.position.array,
        leftGeo.attributes.aHeightFrac.array,
        rightGeo.attributes.aHeightFrac.array,
        _vStart, _midA, _midB, _vEnd,
        _axis, _perpBase,
        RIBBON_SEGS, RIBBON_WIDTH
      );
      leftGeo.attributes.position.needsUpdate  = true;
      leftGeo.attributes.aHeightFrac.needsUpdate = true;
      rightGeo.attributes.position.needsUpdate = true;
      rightGeo.attributes.aHeightFrac.needsUpdate = true;
    }

    // Subtle opacity pulse
    pulseT.current += delta * 1.5;
    uniforms.uOpacity.value    = 0.72 + Math.sin(pulseT.current) * 0.08;
    bumperUniformsL.uOpacity.value = 0.80 + Math.sin(pulseT.current) * 0.05;
    bumperUniformsR.uOpacity.value = 0.80 + Math.sin(pulseT.current) * 0.05;

    // Tunnel birth: grow-in from both portal ends toward centre (first flip only)
    const birth = tunnelId ? tunnelBirths?.[tunnelId] : null;
    if (birth) {
      const rawT = (performance.now() - birth.startMs) / birth.durationMs;
      uniforms.uGrowT.value = Math.min(1, Math.max(0, rawT));
    } else {
      uniforms.uGrowT.value = 1.0;
    }

    // Tunnel pulse: brightness burst on subsequent flips
    const pulse = tunnelId ? tunnelPulses?.[tunnelId] : null;
    if (pulse) {
      const rawT = (performance.now() - pulse.startMs) / pulse.durationMs;
      uniforms.uPulseBoost.value = rawT < 1 ? Math.sin(rawT * Math.PI) : 0;
    } else {
      uniforms.uPulseBoost.value = 0;
    }
  });

  return (
    <>
      {/* Main ribbon — racing stripes scroll toward the mini-cube */}
      <mesh ref={meshRef} geometry={geo}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Left guard rail — colorA; rotates to inverted at tile 2 */}
      <mesh geometry={leftGeo}>
        <shaderMaterial
          uniforms={bumperUniformsL}
          vertexShader={bumperVertexShader}
          fragmentShader={bumperFragmentShader}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Right guard rail — colorB; rotates to inverted at tile 2 */}
      <mesh geometry={rightGeo}>
        <shaderMaterial
          uniforms={bumperUniformsR}
          vertexShader={bumperVertexShader}
          fragmentShader={bumperFragmentShader}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
};

export default MobiusTunnel;
