import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FLIP_CAP, TUNNEL_ANCHOR_OFFSET } from '../utils/constants.js';
import { makeTileGuard, setTileGuard, tileRoom } from './tunnelTileGuard.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { applyTileFlipMotion, flipWidthPulse } from './tunnelAnchorMotion.js';

/**
 * RestingCords — the whole wormhole network as ONE draw call.
 *
 * Every active antipodal pair used to render a full Möbius ribbon plus two
 * bumper walls plus two portal quads (5 transparent meshes running a fragment
 * shader with dFdx/dFdy fresnel). At ~27 pairs on a 3×3 that is ~135 stacked
 * transparent draws, all converging on the single mini-cube focus — which is
 * what produced the white blow-out at the centre of the screen and the "too
 * busy" read.
 *
 * This component draws the resting majority instead: one merged buffer, one
 * trivial shader, normal alpha blending (not additive, so overlapping cords
 * cannot accumulate to white), and a density-scaled alpha ramp that hollows
 * each cord out before it reaches the core. That ramp is driven by how many
 * cords are actually live: with a handful there is no pile-up to prevent and
 * they cross the core intact, and only as the network fills does the middle
 * drop out, so the N² pile-up is never drawn but a lone tunnel still visibly
 * threads the centre.
 *
 * Full Möbius detail is reserved for the focus tier (see WormholeNetwork).
 *
 * Cords are camera-facing: the vertex shader expands the centerline into a
 * screen-facing strip, so a hairline cord keeps a constant apparent width
 * instead of vanishing when viewed edge-on. The Möbius half-twist is not
 * legible at this width anyway — the focus tier carries it.
 */

// Must be even: the segment at CORD_SEGS/2 is the gap hidden by the mini-cube body.
const CORD_SEGS = 12;
const VERTS_PER_STRAND   = (CORD_SEGS + 1) * 2;
const INDICES_PER_STRAND = (CORD_SEGS - 1) * 6;

// Geometry constants — must match MobiusTunnel.jsx so a cord and the full
// ribbon for the same pair trace the same centerline (no jump on promotion).
const MINI_FACE_R = 0.25;
// Narrowing toward the core reads as "diving in", but 0.15 took the cord to
// sub-pixel width exactly where it crosses the middle of the screen.
const TAPER_MIN   = 0.35;

// Width ramp by flip count. A resting cord stays quiet; a pair one flip from
// FLIP_CAP is visibly fat and hot. This is the visual rank the old render
// lacked entirely — every strand looked identical regardless of its state.
// The floor is what a freshly-opened pair gets, so it has to be legible on its
// own: at 1 of 6 flips the previous 0.05/0.20 ramp produced a 0.075-wide
// strand that was effectively invisible.
const CORD_W_MIN = 0.15;
const CORD_W_MAX = 0.30;

// Density at which the core-crossing fade reaches full strength. The fade
// exists to stop N cords piling up alpha on the one point they all share; with
// only a handful active there is no pile-up to prevent, and hiding the crossing
// throws away the very thing the tunnel is demonstrating.
const MID_FADE_FROM = 3;   // at or below this many cords: no fade at all
const MID_FADE_FULL = 12;  // at or above this many: full fade

const REBUILD_EPS_SQ = 1e-4;

// Cords recede while the worm is inside a tunnel so the active ribbon reads.
const IDLE_OPACITY = 1.0;
const DIM_OPACITY  = 0.28;
const DIM_LERP     = 6;

const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

// Module-level scratch — this runs every frame over every strand, so nothing
// here may allocate.
const _wPos1     = new THREE.Vector3();
const _wPos2     = new THREE.Vector3();
const _wQuat1    = new THREE.Quaternion();
const _wQuat2    = new THREE.Quaternion();
const _faceNorm1 = new THREE.Vector3();
const _faceNorm2 = new THREE.Vector3();
const _vStart    = new THREE.Vector3();
const _vEnd      = new THREE.Vector3();
const _midA      = new THREE.Vector3();
const _midB      = new THREE.Vector3();
const _colorA    = new THREE.Color();
const _colorB    = new THREE.Color();
// Half-space pair keeping each cord behind the two stickers it hangs off.
const _tileGuard = makeTileGuard();

const vertexShader = `
  attribute float aSide;      // -1 / +1 across the strip width
  attribute float aT;         // 0→1 along the strand
  attribute vec3  aTangent;   // strand direction (piecewise constant per arm)
  attribute float aWidth;     // world-space strip width for this vertex
  attribute vec3  aColor;
  attribute float aHeat;      // flips / FLIP_CAP

  varying float vSide;
  varying float vT;
  varying vec3  vColor;
  varying float vHeat;

  void main() {
    vSide  = aSide;
    vT     = aT;
    vColor = aColor;
    vHeat  = aHeat;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);

    // Expand the centerline into a screen-facing strip. In view space the
    // camera looks down -Z, so crossing the tangent with Z gives the on-screen
    // perpendicular. Guard the degenerate case where the strand points almost
    // straight at the camera (cross length → 0, normalize would produce NaN).
    vec3  tView = normalize(mat3(modelViewMatrix) * aTangent);
    vec3  c     = cross(tView, vec3(0.0, 0.0, 1.0));
    float cl    = length(c);
    vec3  perp  = cl > 1e-4 ? c / cl : vec3(1.0, 0.0, 0.0);

    mv.xyz += perp * (aSide * aWidth * 0.5);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uMidFade;   // 0 = draw straight through the core, 1 = full fade

  varying float vSide;
  varying float vT;
  varying vec3  vColor;
  varying float vHeat;

  void main() {
    // Fade out before the core. This is what kills the starburst: the middle
    // ~30% of every resting cord is never rasterised, so the one point all 27
    // strands share stops accumulating alpha.
    //
    // Scaled by density (uMidFade). At low tunnel counts there is no pile-up to
    // prevent, and the crossing is the whole point of the mechanic — so the
    // cord is drawn intact and only starts hollowing out as the network fills.
    float d       = abs(vT - 0.5);
    float midFade = mix(1.0, smoothstep(0.14, 0.34, d), uMidFade);
    if (midFade <= 0.001) discard;

    // Soft edges across the width so a thin cord reads as a filament rather
    // than a hard-edged band.
    float u        = vSide * 0.5 + 0.5;
    float edgeFade = smoothstep(0.0, 0.42, u) * smoothstep(1.0, 0.58, u);

    // Single scroll layer travelling toward the core from each end. No second
    // parallax layer, no fresnel, no derivatives — this tier is fill-rate
    // bound on mobile and the detail is invisible at hairline width anyway.
    float halfPos = vT < 0.5 ? vT * 2.0 : (1.0 - vT) * 2.0;
    float scroll  = fract(halfPos * 3.0 - uTime * 0.55);
    float spark   = (1.0 - smoothstep(0.0, 0.13, scroll)) * 0.5;

    // Heat ladder: cold pairs sit quieter and duller so they stay background,
    // hot pairs saturate and brighten toward the cap. The floors here matter as
    // much as the ramp — a pair at 1 of 6 flips still has to be a thing you can
    // see, or the whole tier reads as switched off.
    float luma = dot(vColor, vec3(0.299, 0.587, 0.114));
    vec3  col  = mix(vec3(luma), vColor, 0.55 + vHeat * 0.45);

    // One flip from death the cord becomes unstable and crackles.
    float danger  = smoothstep(0.72, 1.0, vHeat);
    float crackle = 1.0 + danger * 0.45 * sin(uTime * 26.0 + vT * 34.0);

    float intensity = (0.80 + spark + vHeat * 0.6) * crackle;
    col *= intensity;

    float alpha = (0.42 + vHeat * 0.38) * midFade * edgeFade * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * Allocate the merged geometry once at max capacity.
 *
 * The index buffer is static: every slot gets the same quad-strip pattern
 * (minus the mini-cube gap) offset by its base vertex. Per frame we pack the
 * visible strands into slots 0..n-1 and clamp the draw range, so hidden or
 * unused slots cost nothing beyond the memory.
 */
function createCordGeometry(maxStrands) {
  const vertCount = maxStrands * VERTS_PER_STRAND;
  const geo = new THREE.BufferGeometry();

  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  geo.setAttribute('aTangent', new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  geo.setAttribute('aColor',   new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  geo.setAttribute('aSide',    new THREE.BufferAttribute(new Float32Array(vertCount),     1));
  geo.setAttribute('aT',       new THREE.BufferAttribute(new Float32Array(vertCount),     1));
  geo.setAttribute('aWidth',   new THREE.BufferAttribute(new Float32Array(vertCount),     1));
  geo.setAttribute('aHeat',    new THREE.BufferAttribute(new Float32Array(vertCount),     1));

  const indices = new Uint32Array(maxStrands * INDICES_PER_STRAND);
  let w = 0;
  for (let k = 0; k < maxStrands; k++) {
    const base = k * VERTS_PER_STRAND;
    for (let i = 0; i < CORD_SEGS; i++) {
      if (i === CORD_SEGS / 2) continue; // gap hidden by the mini-cube body
      const a = base + i * 2, b = a + 1, c = a + 2, dd = a + 3;
      indices[w++] = a; indices[w++] = b; indices[w++] = c;
      indices[w++] = b; indices[w++] = dd; indices[w++] = c;
    }
  }
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.setDrawRange(0, 0);
  return geo;
}

/**
 * Write one strand into slot `slot`.
 *
 * Path matches MobiusTunnel.fillRibbon: startPos → midA (first arm), gap,
 * midB → endPos (second arm), with the same TAPER_MIN narrowing toward the
 * core. Tangents are piecewise constant, so each arm needs one normalize.
 */
function fillCord(attrs, slot, startPos, midAPos, midBPos, endPos, width, colorA, colorB, heat, guard, flipP1 = 0, flipP2 = 0) {
  const { pos, tan, col, side, tt, wid, heatArr } = attrs;
  const halfSegs = CORD_SEGS / 2;
  const base = slot * VERTS_PER_STRAND;

  const tAx = midAPos.x - startPos.x, tAy = midAPos.y - startPos.y, tAz = midAPos.z - startPos.z;
  const tALen = Math.sqrt(tAx * tAx + tAy * tAy + tAz * tAz) || 1;
  const tBx = endPos.x - midBPos.x, tBy = endPos.y - midBPos.y, tBz = endPos.z - midBPos.z;
  const tBLen = Math.sqrt(tBx * tBx + tBy * tBy + tBz * tBz) || 1;

  for (let i = 0; i <= CORD_SEGS; i++) {
    const t     = i / CORD_SEGS;
    const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
    // Swell at whichever end is mid-flip, so the cord pulses with the tile
    // rather than only being dragged around by it.
    let w       = width * taper * flipWidthPulse(t, flipP1, flipP2);

    let cx, cy, cz, nx, ny, nz;
    if (i <= halfSegs) {
      const s = i / halfSegs;
      cx = startPos.x + (midAPos.x - startPos.x) * s;
      cy = startPos.y + (midAPos.y - startPos.y) * s;
      cz = startPos.z + (midAPos.z - startPos.z) * s;
      nx = tAx / tALen; ny = tAy / tALen; nz = tAz / tALen;
    } else {
      const s = (i - halfSegs) / halfSegs;
      cx = midBPos.x + (endPos.x - midBPos.x) * s;
      cy = midBPos.y + (endPos.y - midBPos.y) * s;
      cz = midBPos.z + (endPos.z - midBPos.z) * s;
      nx = tBx / tBLen; ny = tBy / tBLen; nz = tBz / tBLen;
    }

    // The strip is expanded camera-facing in the vertex shader, so which way it
    // spreads is not known here — but the offset is always aWidth/2 long, and a
    // displacement of that length can breach a plane by at most that much. Cap
    // it against the clearance to the tiles (see tunnelTileGuard) and the cord
    // cannot cross its own sticker from any viewing angle.
    const room = 2 * tileRoom(guard, cx, cy, cz);
    if (w > room) w = room;

    // Each half carries its own tile's colour — same convention as the ribbon.
    const c = i <= halfSegs ? colorA : colorB;

    for (let sgn = 0; sgn < 2; sgn++) {
      const vi = base + i * 2 + sgn;
      const p3 = vi * 3;
      pos[p3] = cx; pos[p3 + 1] = cy; pos[p3 + 2] = cz;
      tan[p3] = nx; tan[p3 + 1] = ny; tan[p3 + 2] = nz;
      col[p3] = c.r; col[p3 + 1] = c.g; col[p3 + 2] = c.b;
      side[vi]    = sgn === 0 ? -1 : 1;
      tt[vi]      = t;
      wid[vi]     = w;
      heatArr[vi] = heat;
    }
  }
}

const RestingCords = ({ tunnels, cubieRefs, focusIds, maxStrands }) => {
  const meshRef = useRef();
  const dimRef  = useRef(IDLE_OPACITY);
  // Cached endpoints keyed by slot-independent strand index, so we can skip the
  // buffer upload entirely on frames where nothing moved.
  const lastEndpointsRef = useRef(new Float32Array(0));
  const forceRebuildRef  = useRef(true);

  const geo = useMemo(() => createCordGeometry(maxStrands), [maxStrands]);

  const attrs = useMemo(() => ({
    pos:     geo.attributes.position.array,
    tan:     geo.attributes.aTangent.array,
    col:     geo.attributes.aColor.array,
    side:    geo.attributes.aSide.array,
    tt:      geo.attributes.aT.array,
    wid:     geo.attributes.aWidth.array,
    heatArr: geo.attributes.aHeat.array,
  }), [geo]);

  const uniforms = useMemo(() => ({
    uTime:    { value: 0 },
    uOpacity: { value: IDLE_OPACITY },
    uMidFade: { value: 0 },
  }), []);

  useEffect(() => {
    if (lastEndpointsRef.current.length < tunnels.length * 6) {
      lastEndpointsRef.current = new Float32Array(tunnels.length * 6);
    }
    forceRebuildRef.current = true;
  }, [tunnels, focusIds]);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    uniforms.uTime.value += delta;

    const target = tunnelState.active ? DIM_OPACITY : IDLE_OPACITY;
    dimRef.current += (target - dimRef.current) * Math.min(1, delta * DIM_LERP);
    uniforms.uOpacity.value = dimRef.current;

    const cache = lastEndpointsRef.current;
    let moved = forceRebuildRef.current;
    let slot  = 0;

    for (let i = 0; i < tunnels.length && slot < maxStrands; i++) {
      const t = tunnels[i];
      if (focusIds.has(t.pairId)) continue; // drawn at full detail by the focus tier

      const mesh1 = cubieRefs[t.meshIdx1];
      const mesh2 = cubieRefs[t.meshIdx2];
      if (!mesh1 || !mesh2) continue;

      mesh1.getWorldPosition(_wPos1);
      mesh1.getWorldQuaternion(_wQuat1);
      mesh2.getWorldPosition(_wPos2);
      mesh2.getWorldQuaternion(_wQuat2);

      const n1 = FACE_NORM_LOCAL[t.dirKey1];
      const n2 = FACE_NORM_LOCAL[t.dirKey2];
      _faceNorm1.set(n1[0], n1[1], n1[2]).applyQuaternion(_wQuat1);
      _faceNorm2.set(n2[0], n2[1], n2[2]).applyQuaternion(_wQuat2);

      _vStart.copy(_wPos1).addScaledVector(_faceNorm1, TUNNEL_ANCHOR_OFFSET);
      _vEnd.copy(_wPos2).addScaledVector(_faceNorm2, TUNNEL_ANCHOR_OFFSET);

      // Ride the tiles' own flip animation. The anchors move every frame while a
      // flip runs, so the movement check below sees them and rebuilds — the cord
      // shakes in lockstep with the tile instead of staying welded to a still point.
      const flipP1 = applyTileFlipMotion(_vStart, _faceNorm1, t.id);
      const flipP2 = applyTileFlipMotion(_vEnd, _faceNorm2, t.gridId2);
      if (flipP1 > 0 || flipP2 > 0) moved = true;

      // Dock on the mini-cube face in LOCAL colour direction, matching the ribbon.
      _midA.set(n1[0], n1[1], n1[2]).multiplyScalar(MINI_FACE_R);
      _midB.set(n2[0], n2[1], n2[2]).multiplyScalar(MINI_FACE_R);

      const c = slot * 6;
      if (!moved) {
        const dx1 = cache[c] - _vStart.x, dy1 = cache[c + 1] - _vStart.y, dz1 = cache[c + 2] - _vStart.z;
        const dx2 = cache[c + 3] - _vEnd.x, dy2 = cache[c + 4] - _vEnd.y, dz2 = cache[c + 5] - _vEnd.z;
        if (dx1 * dx1 + dy1 * dy1 + dz1 * dz1 > REBUILD_EPS_SQ ||
            dx2 * dx2 + dy2 * dy2 + dz2 * dz2 > REBUILD_EPS_SQ) {
          moved = true;
        }
      }

      if (moved) {
        cache[c]     = _vStart.x; cache[c + 1] = _vStart.y; cache[c + 2] = _vStart.z;
        cache[c + 3] = _vEnd.x;   cache[c + 4] = _vEnd.y;   cache[c + 5] = _vEnd.z;

        const heat  = Math.min(1, t.flips / FLIP_CAP);
        const width = CORD_W_MIN + (CORD_W_MAX - CORD_W_MIN) * heat;
        _colorA.set(t.color1);
        _colorB.set(t.color2);
        // Anchors after flip motion, so a shaking tile carries its guard plane.
        setTileGuard(_tileGuard, _vStart, _faceNorm1, _vEnd, _faceNorm2);
        fillCord(attrs, slot, _vStart, _midA, _midB, _vEnd, width, _colorA, _colorB, heat, _tileGuard, flipP1, flipP2);
      }
      slot++;
    }

    if (moved) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aTangent.needsUpdate = true;
      geo.attributes.aColor.needsUpdate   = true;
      geo.attributes.aSide.needsUpdate    = true;
      geo.attributes.aT.needsUpdate       = true;
      geo.attributes.aWidth.needsUpdate   = true;
      geo.attributes.aHeat.needsUpdate    = true;
      forceRebuildRef.current = false;
    }

    geo.setDrawRange(0, slot * INDICES_PER_STRAND);

    // Density-driven core fade: only hollow the cords out once enough of them
    // share the core for the pile-up to actually matter.
    uniforms.uMidFade.value = Math.min(1, Math.max(0,
      (slot - MID_FADE_FROM) / (MID_FADE_FULL - MID_FADE_FROM)
    ));
  });

  return (
    // Positions are written in world space into a mesh at the origin, so the
    // geometry's bounding sphere is meaningless — culling against it would pop
    // strands in and out. Disable it explicitly.
    <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
};

export default RestingCords;
