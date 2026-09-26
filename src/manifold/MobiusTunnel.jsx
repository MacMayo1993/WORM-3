import { fillTunnelRideGeometry, tunnelRideCoreArc, TUNNEL_RIDE_WIDTH } from '../utils/tunnelRide.js';
import TunnelTileSurface from './TunnelTileSurface.jsx';
import { PLATFORM_FORMATION_SECONDS, platformFormationHeld } from '../worm/platformFormation.js';
import { prefersReducedMotion } from '../utils/device.js';
import { WORM_PAD_HEIGHT } from '../game/raisedCubie.js';
import { padMotion } from '../3d/padMotionBridge.js';
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TUNNEL_ANCHOR_OFFSET } from '../utils/constants.js';
import { useGameStore, selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import {
  makeTunnelPath,
  buildTunnelPathInto,
  tunnelPathRibbonInto,
  tunnelPathRibbonTangentInto,
  TUNNEL_MINI_FACE_R
} from '../utils/tunnelPath.js';
import { makeTileGuard, setTileGuard, tileRoom } from './tunnelTileGuard.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { applyTileFlipMotion, flipWidthPulse } from './tunnelAnchorMotion.js';
import { tunnelCharges, tunnelChargeState } from './chaosStormBridge.js';

// Opacity multiplier when the worm is traversing a different tunnel.
// While a traversal is underway, tunnels the worm is NOT in recede to this
// faint level so the active tunnel reads clearly. When no traversal is
// underway (WORM_IDLE_OPACITY) every tunnel stays comfortably visible.
const DIM_OPACITY       = 0.22;
const WORM_IDLE_OPACITY = 0.75;
const FULL_OPACITY      = 1.0;
const DIM_LERP_DOWN = 6;   // fade-out speed (× delta)
const DIM_LERP_UP   = 20;  // snap-in speed  (× delta) — nearly instant

const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

// Band width and rail height, both taken down 15% from 0.85 / 0.30: at the old
// size the ribbon and its rails crowded the bore they hang inside, and from the
// riding camera the tunnel filled the frame instead of framing the worm in it.
const RIBBON_WIDTH   = 0.72;
const RIBBON_SEGS    = 64;   // must be even — doubled from 32 for smoother curves
const REBUILD_EPS_SQ = 1e-4;
const MINI_FACE_R    = TUNNEL_MINI_FACE_R; // must match MINI_S in VoidCore.jsx
const TAPER_MIN      = 0.15; // narrowest fraction of full width at the mini-cube
const BUMPER_HEIGHT  = 0.255; // guard-rail height at full width

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
const _portalPos     = new THREE.Vector3();
const _whipAxis      = new THREE.Vector3();
const _ribbonPt      = new THREE.Vector3();
const _dockNorm1     = new THREE.Vector3();
const _dockNorm2     = new THREE.Vector3();
// Half-space pair keeping ribbon and rails behind the two stickers they hang off.
const _tileGuard     = makeTileGuard();
// The shared centerline this tunnel's band is swept along. One per module is enough:
// every rebuild fills it and consumes it synchronously inside the same useFrame.
const _tunnelPath    = makeTunnelPath();
const _surge         = { active: false, front: 0, glow: 0, arrived: false };

// Vertex shader: pass UV + world position through to fragment.
// vWorldPos feeds the fresnel silhouette glow (needs a view direction).
const vertexShader = `
  uniform vec3  uWhipAxis;   // world-space direction the ribbon snaps along
  uniform float uWhipAmp;    // 0 when idle; decaying envelope during a flip
  uniform float uWhipPhase;  // advances with the soliton, so the wave travels

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);

    // Whip: a travelling transverse wave along the ribbon, pinned to zero at
    // both tile ends so the anchors stay welded to their stickers. This is what
    // makes a flip read as a physical event rather than only a brightness pop —
    // the ribbon snaps taut as the soliton runs through it.
    //
    // sin() alone is not enough of a pin. It leaves ~8% of the amplitude one
    // segment in from the anchor, and uWhipAxis is the ribbon's surface normal
    // — the same direction that leans out of the tile — so a whip near the
    // mouth wags the band through its own sticker. The CPU-side clearance
    // budget (tunnelTileGuard) cannot see this term, so hold it off the last
    // stretch entirely and let the pin be real.
    float ends = sin(vUv.y * 3.14159265)
               * smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
    wp.xyz += uWhipAxis * (sin(vUv.y * 12.0 - uWhipPhase) * uWhipAmp * ends);

    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Ribbon fragment shader.
// vUv.y: 0 = tile1 end, 0.5 = centre (VoidCore), 1 = tile2 end.
// Each half is the solid color of its own tile — no cross-blending.
// Scroll flows toward the centre from both ends so movement reads as "into the tunnel".
// uScrollSpeed is modulated by tunnel progress so it accelerates at the Möbius midpoint.
const rideColorShader = `
  vec3 rideColor(float trip) {
    // Two solid endpoint colors, with only pixel-width filtering at the core.
    float aa = max(fwidth(trip), 0.00001);
    return mix(uColorA, uColorB, smoothstep(uRideCore - aa, uRideCore + aa, trip));
  }
`;
const fragmentShader = `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uOpacity;
  uniform float uRideMode;
  uniform float uRideCore;
  uniform float uTime;
  uniform float uScrollSpeed;
  uniform float uGrowT;
  uniform float uPulseBoost;
  uniform float uSolitonProgress;  // 0→1 position of the flip pulse along the ribbon
  uniform float uIdlePadProgress;
  uniform float uIdlePadAmp;
  uniform float uSolitonAmp;       // 0 when no pulse, sin-eased envelope while travelling
  varying vec2  vUv;
  varying vec3  vWorldPos;
  ${rideColorShader}

  // Cheap hash for per-column parallax variation (streaks at different "radii").
  float hash(float n) { return fract(sin(n * 91.3458) * 47453.5453); }

  void main() {
    // Tunnel birth grow-in: left beam from tile1 toward centre, right beam from tile2.
    float leftFront  = uGrowT * 0.5;
    float rightFront = 1.0 - uGrowT * 0.5;
    if (vUv.y > leftFront && vUv.y < rightFront) discard;

    // WORM: an opaque, filtered track. No white-hot hash streaks, Fresnel
    // wash or transparent floor drawn over the body from the far side.
    if (uRideMode > 0.5) {
      vec3 base = rideColor(vUv.y);
      float edge = 1.0 - smoothstep(0.035, 0.06, min(vUv.x, 1.0 - vUv.x));
      float phase = vUv.y * 10.0 - uTime * 0.18;
      float footprint = max(fwidth(phase), 0.002);
      float dash = 1.0 - smoothstep(0.055, 0.055 + footprint, abs(fract(phase + 0.5) - 0.5));
      dash *= 1.0 - smoothstep(0.12, 0.4, footprint);
      float lane = smoothstep(0.28, 0.36, abs(vUv.x - 0.5));
      vec3 color = mix(base * 0.65 + vec3(0.045), vec3(0.025, 0.035, 0.045), edge);
      color += base * dash * lane * 0.22;
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
      return;
    }

    // Each half shows its own tile's color …
    vec3 tileColor = vUv.y < 0.5 ? uColorA : uColorB;

    // … but at the Möbius midpoint the two colors fuse into a bright plasma bridge —
    // the visual statement that these two tiles are the SAME point in RP2. (#3)
    float seam = 1.0 - smoothstep(0.0, 0.17, abs(vUv.y - 0.5));
    seam *= seam;
    float seamFlicker = 0.82 + 0.18 * sin(uTime * 6.0 + vUv.x * 12.0);
    vec3  plasmaCol   = mix((uColorA + uColorB) * 0.7, vec3(1.0), 0.35);
    tileColor = mix(tileColor, plasmaCol, seam * seamFlicker);

    // Scroll toward centre from each tile end (halfPos: 0=tile edge, 1=centre).
    float halfPos = vUv.y < 0.5 ? vUv.y * 2.0 : (1.0 - vUv.y) * 2.0;

    // Near racing stripes.
    float scroll = fract(halfPos * 4.0 - uTime * uScrollSpeed);
    float spark  = (1.0 - smoothstep(0.0, 0.08, scroll)) * 0.6;

    // Far parallax warp-streaks: finer, slower, per-column offset. Two speeds read
    // as depth — you're looking INTO a shaft, not at a painted band. (#2)
    float colOff    = hash(floor(vUv.x * 7.0));
    float farScroll = fract(halfPos * 9.0 - uTime * uScrollSpeed * 0.42 + colOff);
    float farStreak = (1.0 - smoothstep(0.0, 0.045, farScroll)) * 0.32;

    // Cylindrical depth illusion: ribbon reads as a 3D tube rather than a flat band.
    // centerBulge peaks at U=0.5 (ribbon centre) and falls off toward edges.
    float centerBulge = 1.0 - pow(abs(vUv.x * 2.0 - 1.0), 0.6);
    float shading = 0.58 + centerBulge * 0.64;

    // Depth fade: full intensity where the worm is (near halfPos=1 / midpoint),
    // softer at tile-end portals so the tunnel has visual perspective depth.
    float depthFade = 0.32 + halfPos * 0.68;

    // Fresnel silhouette glow — reconstruct the flat ribbon normal from screen-space
    // derivatives and glow at grazing angles, so the tunnel reads as a lit volume. (#1)
    vec3  dpdx  = dFdx(vWorldPos);
    vec3  dpdy  = dFdy(vWorldPos);
    vec3  ncr   = cross(dpdx, dpdy);
    vec3  N     = length(ncr) > 1e-6 ? normalize(ncr) : vec3(0.0, 0.0, 1.0);
    vec3  V     = normalize(cameraPosition - vWorldPos);
    float fres  = pow(1.0 - abs(dot(N, V)), 3.0);

    // Travelling light-soliton: a flip fires a bright pulse from the entry tile,
    // through the centre, out to its antipodal partner — the identification event. (#5)
    float sol = exp(-pow((vUv.y - uSolitonProgress) / 0.055, 2.0)) * uSolitonAmp;
    // Idle impacts enter from both mouths and meet at the Core; travel retains
    // the existing one-way soliton. This changes uniforms, never anchor geometry.
    float idleDistance = min(abs(vUv.y - uIdlePadProgress), abs(vUv.y - (1.0 - uIdlePadProgress)));
    sol += exp(-pow(idleDistance / 0.055, 2.0)) * uIdlePadAmp;

    float intensity = (0.75 + spark + farStreak * depthFade + uPulseBoost * 0.3) * shading * depthFade;
    intensity += seam * 0.85;   // plasma bridge blooms
    intensity += fres * 0.9;    // rim glow
    intensity += sol * 1.6;     // travelling pulse

    // A restrained bright leading edge makes the two growing halves legible.
    float frontDistance = min(abs(vUv.y - leftFront), abs(vUv.y - rightFront));
    float birthFront = (1.0 - smoothstep(0.0, 0.035, frontDistance)) * (1.0 - step(1.0, uGrowT));
    vec3 col = tileColor * (intensity + birthFront * 0.8);
    col = mix(col, vec3(1.0), clamp(sol, 0.0, 0.85)); // soliton core reads white-hot

    float edgeFade     = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
    float boostOpacity = uOpacity + uPulseBoost * 0.45 + fres * 0.35 + sol * 0.5;

    // Black border along each ribbon edge
    float leftEdge    = 1.0 - smoothstep(0.0, 0.055, vUv.x);
    float rightEdge   = 1.0 - smoothstep(1.0, 0.945, vUv.x);
    float edgeOutline = clamp(leftEdge + rightEdge, 0.0, 1.0);

    vec3  finalCol   = mix(col * (1.0 + uPulseBoost * 1.2), vec3(0.0), edgeOutline);
    float finalAlpha = max(boostOpacity * edgeFade, edgeOutline * 0.88);
    gl_FragColor = vec4(finalCol, finalAlpha);
  }
`;

// Bumper vertex shader: passes height fraction and trip fraction to fragment.
// vTripFrac (0→1 along ribbon length) lets the fragment highlight the Möbius flip point.
const bumperVertexShader = `
  uniform vec3  uWhipAxis;
  uniform float uWhipAmp;
  uniform float uWhipPhase;

  attribute float aHeightFrac;
  attribute float aTripFrac;
  varying  float vHeightFrac;
  varying  float vTripFrac;

  void main() {
    vHeightFrac = aHeightFrac;
    vTripFrac   = aTripFrac;

    // Same whip displacement as the ribbon, driven by the SAME uniform objects
    // (shared by reference below) — otherwise the guard rails would stay put
    // while the ribbon snapped out from under them.
    vec3  p    = position;
    float ends = sin(aTripFrac * 3.14159265)
               * smoothstep(0.0, 0.14, aTripFrac) * smoothstep(1.0, 0.86, aTripFrac);
    p += uWhipAxis * (sin(aTripFrac * 12.0 - uWhipPhase) * uWhipAmp * ends);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// Bumper fragment shader: solid neon colour, fading at the top edge.
// The Möbius half-twist continuously rotates the surface normal, so the
// bumper that starts pointing "up" at tile 1 ends pointing "down" at tile 2
// — the non-orientability of RP2 made physically visible.
// At the halfway point (vTripFrac ≈ 0.5) a bright glow marks the exact flip moment.
const bumperFragmentShader = `
  uniform vec3  uColor;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uRideCore;
  uniform float uOpacity;
  uniform float uRideMode;
  uniform float uGrowT;
  varying float vHeightFrac;
  varying float vTripFrac;
  ${rideColorShader}

  void main() {
    if (vTripFrac > uGrowT * 0.5 && vTripFrac < 1.0 - uGrowT * 0.5) discard;
    if (uRideMode > 0.5) {
      gl_FragColor = vec4(rideColor(vTripFrac) * 0.7 + vec3(0.06), 1.0);
      #include <colorspace_fragment>
      return;
    }
    float topFade = 1.0 - smoothstep(0.6, 1.0, vHeightFrac);

    // Möbius flip highlight: glows white near the halfway point (t=0.5),
    // where the surface normal has rotated 90° and non-orientability is most dramatic.
    float flipDist = abs(vTripFrac - 0.5);
    float flipGlow = smoothstep(0.10, 0.0, flipDist);

    // Black outline at base and top of each guard rail — makes bumpers feel like solid barriers
    float baseOutline = 1.0 - smoothstep(0.0, 0.15, vHeightFrac);
    float topOutline  = (1.0 - smoothstep(1.0, 0.80, vHeightFrac)) * topFade;
    float outline     = clamp(baseOutline + topOutline, 0.0, 1.0);

    // Flip point brightens toward white; rest of bumper uses neon base color
    vec3 flipColor  = mix(uColor * 2.2, vec3(1.0, 1.0, 1.0), flipGlow * 0.55);
    vec3  finalCol  = mix(flipColor * 1.8, vec3(0.0), outline);
    float finalAlpha = max(uOpacity * topFade * (1.0 + flipGlow * 0.5), outline * 0.92);
    gl_FragColor = vec4(finalCol, finalAlpha);
  }
`;

/**
 * Fill position + UV buffers for the Möbius ribbon.
 *
 * Path: the shared tunnel centerline (src/utils/tunnelPath.js) — a straight throat
 * out of each tile before the arms bend toward the mini-cube, with the core
 * interior skipped at u = 0.5. Sampling the same module the worm and camera ride
 * is what keeps the band welded to the route they take through it.
 *
 * Width tapers from full at tile ends to TAPER_MIN fraction at the mini-cube crossing.
 * Cross-section direction (_perpCurrent) rotates π via applyAxisAngle — the Möbius half-twist.
 */
function fillRibbon(posArray, uvArray, path, axis, perpStart, segs, width, guard, flipP1 = 0, flipP2 = 0) {
  const halfW    = width / 2;

  for (let i = 0; i <= segs; i++) {
    const t     = i / segs;
    const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
    // Swells at whichever end is mid-flip so the ribbon pulses with its tile.
    let w       = halfW * taper * flipWidthPulse(t, flipP1, flipP2);

    tunnelPathRibbonInto(_ribbonPt, path, t);
    const cx = _ribbonPt.x, cy = _ribbonPt.y, cz = _ribbonPt.z;

    // Never wider than it is deep — see tunnelTileGuard. The flip pulse above
    // multiplies the width, so this has to come after it or a swelling tile
    // punches the band straight through its own sticker.
    const room = tileRoom(guard, cx, cy, cz);
    if (w > room) w = room;

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
 * Fill left and right bumper geometry buffers, including aTripFrac (t along ribbon).
 *
 * Each bumper is a thin wall that rises from a ribbon edge in the direction of the
 * ribbon's surface normal (= segTangent × perpCurrent).  Because perpCurrent rotates
 * π over the full ribbon length (the Möbius half-twist), the surface normal also
 * rotates π — the bumper that is upright at tile 1 ends inverted at tile 2,
 * demonstrating RP2 non-orientability.
 */
function fillBumpers(
  leftPosArr, rightPosArr, leftHFArr, rightHFArr, leftTFArr, rightTFArr,
  path, axis, perpStart, segs, width, guard
) {
  const halfW    = width / 2;

  for (let i = 0; i <= segs; i++) {
    const t     = i / segs;
    const taper = TAPER_MIN + (1.0 - TAPER_MIN) * Math.abs(2.0 * t - 1.0);
    let w       = halfW * taper;
    let bh      = BUMPER_HEIGHT * taper;

    // Centre position — the same sampler fillRibbon uses, so the rails sit on the
    // band's edges through the throat bend instead of cutting the corner.
    tunnelPathRibbonInto(_ribbonPt, path, t);
    const cx = _ribbonPt.x, cy = _ribbonPt.y, cz = _ribbonPt.z;

    // The rails are the reason this bug was visible at all: they stand off the
    // ribbon along its surface normal, and where the two tiles sit on different
    // axes that normal leans OUT of the face. Spend the available clearance on
    // the band first, then give the rails whatever is left — at the mouth that
    // is nothing, so they emerge from inside the tile instead of straddling it.
    const room = tileRoom(guard, cx, cy, cz);
    if (w > room) w = room;
    const railRoom = room - w;
    if (bh > railRoom) bh = railRoom;

    // Width (cross-section) direction with Möbius half-twist
    _perpCurrent.copy(perpStart).applyAxisAngle(axis, t * Math.PI);

    // Segment tangent — per leg now, not per arm: the throat and the run to the
    // core point in different directions, and rails built off a single per-arm
    // tangent would lean out of the band at the mouth.
    tunnelPathRibbonTangentInto(_segTangent, path, t);

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
    leftHFArr[base]            = 0;   leftTFArr[base]             = t;
    leftPosArr[(base+1)*3]     = ltx; leftPosArr[(base+1)*3 + 1] = lty; leftPosArr[(base+1)*3 + 2] = ltz;
    leftHFArr[base + 1]        = 1;   leftTFArr[base + 1]         = t;

    // Right bumper: bottom (hf=0) then top (hf=1)
    rightPosArr[base * 3]      = rx;  rightPosArr[base * 3 + 1]  = ry;  rightPosArr[base * 3 + 2]  = rz;
    rightHFArr[base]           = 0;   rightTFArr[base]            = t;
    rightPosArr[(base+1)*3]    = rtx; rightPosArr[(base+1)*3 + 1] = rty; rightPosArr[(base+1)*3 + 2] = rtz;
    rightHFArr[base + 1]       = 1;   rightTFArr[base + 1]        = t;
  }
}

function createRibbonGeos(segs, continuous = false) {
  const vertCount = (segs + 1) * 2;

  // Shared quad-strip index pattern (skip the gap at segs/2 hidden by mini-cube body)
  const mainIndices = [];
  const bumpIndices = [];
  for (let i = 0; i < segs; i++) {
    if (!continuous && i === segs / 2) continue;
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    mainIndices.push(a, b, c, b, d, c);
    bumpIndices.push(a, b, c, b, d, c);
  }

  // Main ribbon
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(vertCount * 2), 2));
  geo.setIndex(mainIndices);

  // Bumper geometries — include aTripFrac (t along ribbon) for the flip-point highlight
  function makeBumperGeo() {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position',    new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
    bg.setAttribute('aHeightFrac', new THREE.BufferAttribute(new Float32Array(vertCount),     1));
    bg.setAttribute('aTripFrac',   new THREE.BufferAttribute(new Float32Array(vertCount),     1));
    bg.setIndex([...bumpIndices]);
    return bg;
  }

  return { geo, leftGeo: makeBumperGeo(), rightGeo: makeBumperGeo() };
}

/**
 * MobiusTunnel — the FOCUS tier: one Möbius ribbon + two guard-rail bumpers + exit portal.
 *
 * This is the expensive, high-fidelity render, and it is deliberately rare. WormholeNetwork
 * mounts at most FOCUS_BUDGET of these — the tunnel the worm is traversing plus the most
 * recent flip events — while every other active pair is drawn by RestingCords as a single
 * merged, cheaply-shaded strand. Nothing here should be made cheaper for density's sake;
 * density is the resting tier's job.
 *
 * Racing stripes scroll toward the center mini-cube from both tile ends (Rainbow Road feel).
 * Scroll speed accelerates at the Möbius midpoint (t=0.5) when the worm is traversing,
 * giving a sense of acceleration through the topological twist.
 *
 * Bumpers on each ribbon edge physically rotate 180° over the ribbon length due to the
 * Möbius half-twist, going from upright to inverted — demonstrating RP2 non-orientability.
 * A bright glow at the halfway point marks the exact flip moment.
 *
 * Exit portal shows a layered glow + orbiting rings — the destination reads as a real place.
 */
const MobiusTunnel = ({
  meshIdx1, meshIdx2, dirKey1, dirKey2, cubieRefs, flips, color1, color2, tunnelId,
  gridId1, gridId2, tunnelBirths, tunnelPulses, raisedPresentation = false, active1 = true, active2 = true,
  style1 = 'solid', style2 = 'solid',
}) => {
  const flipCap          = useGameStore(selectEffectiveFlipCap);
  const wormMode = useGameStore(s => s.wormHealerMode);
  const ribbonMode = wormMode || raisedPresentation;
  const styled = style1 !== 'solid' || style2 !== 'solid';
  const groupRef = useRef();
  const segments = wormMode ? 160 : RIBBON_SEGS;
  const meshRef          = useRef();
  const formationAge = useRef(0);
  const pulseT           = useRef(Math.random() * Math.PI * 2);
  const portalPulseT     = useRef(Math.random() * Math.PI * 2);
  const dimRef           = useRef(WORM_IDLE_OPACITY);
  const lastStartRef     = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const lastEndRef       = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  // Exit portal refs — group holds position/orientation; children animate independently
  const exitPortalGroupRef  = useRef();
  const exitPortalMatRef    = useRef();
  const exitPortalGlowRef   = useRef();

  const { geo, leftGeo, rightGeo } = useMemo(() => createRibbonGeos(segments, ribbonMode), [segments, ribbonMode]);

  // Whip uniforms are created once and spread BY REFERENCE into the ribbon and
  // both bumper materials, so all three read the same {value} objects and stay
  // welded together while the ribbon snaps.
  const whipUniforms = useMemo(() => ({
    uWhipAxis:  { value: new THREE.Vector3(0, 1, 0) },
    uWhipAmp:   { value: 0.0 },
    uWhipPhase: { value: 0.0 },
  }), []);

  // Keep uniform objects stable; endpoint changes update colors in place.
  const uniforms = useMemo(() => ({
    uColorA:      { value: new THREE.Color(color1) },
    uColorB:      { value: new THREE.Color(color2) },
    uOpacity:     { value: 0.92 },
    uRideMode:    { value: 0 },
    uRideCore:    { value: 0.5 },
    uPatternRepeats: { value: 1 },
    uTileCenterA: { value: new THREE.Vector3() },
    uTileCenterB: { value: new THREE.Vector3() },
    uTime:        { value: 0.0 },
    uScrollSpeed: { value: 1.0 },
    uGrowT:       { value: 1.0 },
    uPulseBoost:  { value: 0.0 },
    uIdlePadProgress: { value: 0 },
    uIdlePadAmp: { value: 0 },
    uSolitonProgress: { value: -1.0 },
    uSolitonAmp:      { value: 0.0 },
    ...whipUniforms,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const bumperUniformsL = useMemo(() => ({
    uColor:   { value: new THREE.Color(color1) },
    uColorA: uniforms.uColorA,
    uColorB: uniforms.uColorB,
    uRideCore: uniforms.uRideCore,
    uOpacity: { value: 0.93 },
    uRideMode: uniforms.uRideMode,
    uGrowT: uniforms.uGrowT,
    ...whipUniforms,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const bumperUniformsR = useMemo(() => ({
    uColor:   { value: new THREE.Color(color2) },
    uColorA: uniforms.uColorA,
    uColorB: uniforms.uColorB,
    uRideCore: uniforms.uRideCore,
    uOpacity: { value: 0.93 },
    uRideMode: uniforms.uRideMode,
    uGrowT: uniforms.uGrowT,
    ...whipUniforms,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const dead = flips >= flipCap;
    const cA = dead ? '#555555' : color1;
    const cB = dead ? '#444444' : color2;
    uniforms.uColorA.value.set(cA);
    uniforms.uColorB.value.set(cB);
    bumperUniformsL.uColor.value.set(cA);
    bumperUniformsR.uColor.value.set(cB);
    if (exitPortalMatRef.current) exitPortalMatRef.current.color.set(cB);
    if (exitPortalGlowRef.current) exitPortalGlowRef.current.material.color.set(cB);
  }, [color1, color2, flips, flipCap, uniforms, bumperUniformsL, bumperUniformsR]);

  useEffect(() => {
    lastStartRef.current.set(Infinity, Infinity, Infinity);
    const g = geo, lg = leftGeo, rg = rightGeo;
    return () => { g.dispose(); lg.dispose(); rg.dispose(); };
  }, [geo, leftGeo, rightGeo]);

  useFrame((_state, delta) => {
    const state = useGameStore.getState();
    const occupied = tunnelState.activeTunnelId === tunnelId || tunnelState.occupiedTunnelIds.has(tunnelId);
    // Keep every tail-occupied track; unrelated ribbons cannot cross the ride.
    if (groupRef.current) groupRef.current.visible = !wormMode || !tunnelState.active || occupied;
    uniforms.uRideMode.value = ribbonMode ? 1 : 0;
    if (raisedPresentation && (state.settings?.reducedMotion || prefersReducedMotion())) delta = 0;
    if (wormMode && (state.wormPaused || !state.wormAlive || prefersReducedMotion())) delta = 0;
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

    const formationState = useGameStore.getState();
    const mouthLift = formationState.wormHealerMode && !formationState.demoMode ? WORM_PAD_HEIGHT : 0;
    const cubeLift = raisedPresentation ? Math.max(0, padMotion.get(tunnelId)?.lift ?? 0) : 0;
    // Ribbon anchors: just inside each sticker tile's own surface, so the ribbon
    // reaches the tile the player flipped rather than the far side of its cubie.
    _vStart.copy(_wPos1).addScaledVector(_faceNorm1, TUNNEL_ANCHOR_OFFSET + mouthLift + (active1 ? cubeLift : 0));
    _vEnd  .copy(_wPos2).addScaledVector(_faceNorm2, TUNNEL_ANCHOR_OFFSET + mouthLift + (active2 ? cubeLift : 0));

    // Ride each tile's own flip animation — vibration into the anchors, squash
    // into the width. The anchors change every frame during a flip, so the
    // movement check below rebuilds and the ribbon shakes along with the tile.
    const flipP1 = applyTileFlipMotion(_vStart, _faceNorm1, gridId1);
    const flipP2 = applyTileFlipMotion(_vEnd, _faceNorm2, gridId2);
    const tileFlipping = flipP1 > 0 || flipP2 > 0;

    // Mini-cube face docking points — use LOCAL color direction so the tunnel
    // always routes through the correct colored face regardless of cube rotation.
    _dockNorm1.set(n1[0], n1[1], n1[2]);
    _dockNorm2.set(n2[0], n2[1], n2[2]);
    _midA.copy(_dockNorm1).multiplyScalar(MINI_FACE_R);
    _midB.copy(_dockNorm2).multiplyScalar(MINI_FACE_R);

    const moved = tileFlipping ||
      lastStartRef.current.distanceToSquared(_vStart) > REBUILD_EPS_SQ ||
      lastEndRef  .current.distanceToSquared(_vEnd)   > REBUILD_EPS_SQ;

    // ── Scroll speed: accelerates at midpoint during active traversal ────────
    // When the worm is inside this tunnel, ramp speed up around t=0.5 (the Möbius flip).
    // Outside traversal, constant casual scroll.
    const isActive = tunnelState.active && tunnelState.activeTunnelId === tunnelId;
    const tp = isActive ? (tunnelState.t ?? 0) : 0;
    uniforms.uScrollSpeed.value = isActive
      ? 0.7 + 3.2 * Math.sin(Math.PI * tp)
      : 1.0;
    uniforms.uTime.value += delta;

    if (moved) {
      lastStartRef.current.copy(_vStart);
      lastEndRef  .current.copy(_vEnd);

      // The route itself — throats along each tile's own world normal, docks on the
      // colour-correct mini-cube faces. Everything below sweeps this.
      buildTunnelPathInto(_tunnelPath, _vStart, _faceNorm1, _vEnd, _faceNorm2, _dockNorm1, _dockNorm2);
      uniforms.uPatternRepeats.value = _tunnelPath.total / (ribbonMode ? TUNNEL_RIDE_WIDTH : RIBBON_WIDTH);
      uniforms.uTileCenterA.value.copy(_wPos1);
      uniforms.uTileCenterB.value.copy(_wPos2);

      // Twist axis: overall start-to-end direction
      _axis.subVectors(_vEnd, _vStart).normalize();

      // Initial cross-section direction: tangent to tile 1's face surface.
      _perpBase.crossVectors(_axis, _faceNorm1);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _up);
      if (_perpBase.lengthSq() < 0.001) _perpBase.crossVectors(_axis, _side);
      _perpBase.normalize();

      // Whip displacement runs perpendicular to the ribbon SURFACE (axis × width
      // direction). Displacing along _perpBase itself would only widen the band.
      _whipAxis.crossVectors(_axis, _perpBase);
      if (_whipAxis.lengthSq() < 0.001) _whipAxis.set(0, 1, 0);
      _whipAxis.normalize();
      whipUniforms.uWhipAxis.value.copy(_whipAxis);

      // Anchors after flip motion, so a shaking tile carries its own guard plane
      // with it rather than letting the band slip out from behind the sticker.
      setTileGuard(_tileGuard, _vStart, _faceNorm1, _vEnd, _faceNorm2);

      // Exit portal group: place between VoidCore face and exit cubie, facing inward.
      if (exitPortalGroupRef.current) {
        _portalPos.copy(_midB).addScaledVector(_faceNorm2, 0.15);
        exitPortalGroupRef.current.position.copy(_portalPos);
        exitPortalGroupRef.current.lookAt(
          _portalPos.x - _faceNorm2.x,
          _portalPos.y - _faceNorm2.y,
          _portalPos.z - _faceNorm2.z
        );
      }

      if (ribbonMode) {
        fillTunnelRideGeometry(geo, leftGeo, rightGeo, _tunnelPath, segments);
        uniforms.uRideCore.value = tunnelRideCoreArc(_tunnelPath) / (_tunnelPath.total || 1);
      } else {
        fillRibbon(
          geo.attributes.position.array,
          geo.attributes.uv.array,
          _tunnelPath,
          _axis, _perpBase,
          RIBBON_SEGS, RIBBON_WIDTH, _tileGuard, flipP1, flipP2
        );
        fillBumpers(
          leftGeo.attributes.position.array,
          rightGeo.attributes.position.array,
          leftGeo.attributes.aHeightFrac.array,
          rightGeo.attributes.aHeightFrac.array,
          leftGeo.attributes.aTripFrac.array,
          rightGeo.attributes.aTripFrac.array,
          _tunnelPath,
          _axis, _perpBase,
          RIBBON_SEGS, RIBBON_WIDTH, _tileGuard
        );
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.uv.needsUpdate = true;
      geo.computeVertexNormals();
      leftGeo.attributes.position.needsUpdate    = true;
      leftGeo.attributes.aHeightFrac.needsUpdate  = true;
      leftGeo.attributes.aTripFrac.needsUpdate    = true;
      rightGeo.attributes.position.needsUpdate   = true;
      rightGeo.attributes.aHeightFrac.needsUpdate = true;
      rightGeo.attributes.aTripFrac.needsUpdate   = true;
    }

    // Dim system:
    //  • worm traversing this tunnel  → full brightness (snaps in)
    //  • worm traversing another one  → recede to DIM_OPACITY so it doesn't compete
    //  • no traversal underway        → all tunnels stay at the comfortable idle level
    const targetDim = isActive
      ? FULL_OPACITY
      : tunnelState.active
        ? DIM_OPACITY
        : WORM_IDLE_OPACITY;
    const lerpSpeed = targetDim > dimRef.current ? DIM_LERP_UP : DIM_LERP_DOWN;
    dimRef.current += (targetDim - dimRef.current) * Math.min(1, delta * lerpSpeed);
    const dim = dimRef.current;

    // Subtle opacity pulse, scaled by dim factor
    pulseT.current += delta * 1.5;
    uniforms.uOpacity.value        = (0.90 + Math.sin(pulseT.current) * 0.04) * dim;
    bumperUniformsL.uOpacity.value = (0.92 + Math.sin(pulseT.current) * 0.03) * dim;
    bumperUniformsR.uOpacity.value = (0.92 + Math.sin(pulseT.current) * 0.03) * dim;

    // ── Exit portal animation ────────────────────────────────────────────────
    // Portal pulses and breathes; rings orbit at independent rates.
    // When the active worm is approaching, portal scales up for anticipation.
    portalPulseT.current += delta * 2.2;
    const ppt = portalPulseT.current;
    const proximityBoost = isActive ? 0.18 * Math.max(0, Math.sin(Math.PI * tp)) : 0;
    const portalBreath = 1.0 + 0.08 * Math.sin(ppt) + proximityBoost;

    if (exitPortalGroupRef.current) exitPortalGroupRef.current.scale.setScalar(portalBreath);

    if (exitPortalMatRef.current) {
      exitPortalMatRef.current.opacity = (0.60 + 0.18 * Math.sin(ppt)) * dim;
    }
    if (exitPortalGlowRef.current) {
      exitPortalGlowRef.current.material.opacity = (0.30 + 0.12 * Math.sin(ppt + 0.8)) * dim;
    }

    // Tunnel birth: grow-in from both portal ends toward centre (first flip only)
    const birth = tunnelId ? tunnelBirths?.[tunnelId] : null;
    let whipAmp = 0;
    let whipPhase = 0;
    if (formationState.wormHealerMode && !formationState.demoMode) {
      const reduced = formationState.settings?.reducedMotion || prefersReducedMotion();
      if (reduced) formationAge.current = PLATFORM_FORMATION_SECONDS;
      else if (!platformFormationHeld(formationState)) formationAge.current += Math.min(delta, .05);
      const progress = Math.min(1, formationAge.current / PLATFORM_FORMATION_SECONDS);
      const a = mesh1.userData.wormPlatformFormation;
      const b = mesh2.userData.wormPlatformFormation;
      uniforms.uGrowT.value = reduced ? 1 : Math.min(progress,
        a?.formationTarget === 1 ? a.formationProgress : 1,
        b?.formationTarget === 1 ? b.formationProgress : 1);
      // The portal appears with its emerging ribbon, not as a complete floating ring.
      const portalScale = THREE.MathUtils.smoothstep(uniforms.uGrowT.value, 0, .22);
      if (exitPortalGroupRef.current) exitPortalGroupRef.current.scale.multiplyScalar(portalScale);
    } else if (birth) {
      const rawT = (performance.now() - birth.startMs) / birth.durationMs;
      uniforms.uGrowT.value = Math.min(1, Math.max(0, rawT));
      // A pair's first identification snaps hardest — this happens at most once
      // per pair, so it can afford to be the biggest movement in the scene.
      if (rawT < 1) {
        const env = Math.sin(Math.max(0, rawT) * Math.PI);
        whipAmp = env * env * 0.30;
        whipPhase = rawT * 26.0;
      }
    } else {
      uniforms.uGrowT.value = 1.0;
    }

    // Tunnel pulse: on a flip, fire a travelling light-soliton from the entry tile
    // (vUv.y=0) through the centre to its antipodal partner (vUv.y=1), plus a small
    // overall brightness burst.
    const pulse = tunnelId ? tunnelPulses?.[tunnelId] : null;
    if (pulse) {
      const rawT = (performance.now() - pulse.startMs) / pulse.durationMs;
      if (rawT < 1) {
        const env = Math.sin(rawT * Math.PI);
        uniforms.uPulseBoost.value = env;
        uniforms.uSolitonProgress.value = rawT; // entry → centre → exit
        uniforms.uSolitonAmp.value = env;       // fade in/out over the trip
        // The whip rides the soliton: peaks at mid-travel and dies at both ends,
        // so the ribbon visibly snaps as the pulse runs through it. Squaring the
        // envelope keeps the movement tight rather than a slow wobble.
        whipAmp = Math.max(whipAmp, env * env * 0.16);
        whipPhase = rawT * 22.0;
      } else {
        uniforms.uPulseBoost.value = 0;
        uniforms.uSolitonAmp.value = 0;
      }
    } else {
      uniforms.uPulseBoost.value = 0;
      uniforms.uSolitonAmp.value = 0;
    }

    // Chaos surge (ChaosStorm owns the clock): the same soliton, run from
    // whichever tile the storm struck, with the ribbon crackling bright and
    // snapping as the charge passes through its twist.
    const surge = tunnelId && tunnelCharges.size ? tunnelCharges.get(tunnelId) : undefined;
    if (surge) {
      const nowMs = performance.now();
      if (tunnelChargeState(surge, nowMs, _surge).active) {
        const env = _surge.glow;
        uniforms.uSolitonProgress.value = surge.fromGridId === gridId2 ? 1 - _surge.front : _surge.front;
        uniforms.uSolitonAmp.value = Math.max(uniforms.uSolitonAmp.value, env);
        uniforms.uPulseBoost.value = Math.max(uniforms.uPulseBoost.value, env * (0.75 + 0.25 * Math.sin(nowMs * 0.06)));
        const surgeWhip = env * env * 0.12;
        if (surgeWhip > whipAmp) {
          whipAmp = surgeWhip;
          whipPhase = _surge.front * 22.0;
        }
      }
    }

    const pad = padMotion.get(tunnelId);
    uniforms.uIdlePadProgress.value = (pad?.cycle ?? 0) * 0.5;
    uniforms.uIdlePadAmp.value = pad?.active && pad.animated && !isActive
      ? Math.sin(Math.PI * pad.cycle) * 0.6 : 0;

    // Shared by reference with both bumper materials — write once.
    whipUniforms.uWhipAmp.value = ribbonMode ? 0 : whipAmp;
    whipUniforms.uWhipPhase.value = whipPhase;
  });

  return (
    <group ref={groupRef}>
      {/* Main ribbon — racing stripes scroll toward the mini-cube, speed ramps at midpoint.
          frustumCulled is off on all three meshes here: vertex positions are written in world
          space into meshes parented at the origin, so the lazily-computed bounding sphere goes
          stale on the first rebuild and culling against it pops the ribbon in and out. */}
      <mesh ref={meshRef} geometry={geo} frustumCulled={false} visible={!styled}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={THREE.DoubleSide}
          transparent={!ribbonMode}
          depthWrite={ribbonMode}
          toneMapped={!ribbonMode}
          extensions={{ derivatives: true }}
        />
      </mesh>
      {styled && <>
        <TunnelTileSurface geometry={geo} style={style1} color={color1} antiColor={color2} uniforms={uniforms} side={0} rideMode={ribbonMode} />
        <TunnelTileSurface geometry={geo} style={style2} color={color2} antiColor={color1} uniforms={uniforms} side={1} rideMode={ribbonMode} />
      </>}

      {/* Both WORM rails follow the strip's endpoint colors through the core. */}
      <mesh geometry={leftGeo} frustumCulled={false}>
        <shaderMaterial
          uniforms={bumperUniformsL}
          vertexShader={bumperVertexShader}
          fragmentShader={bumperFragmentShader}
          extensions={{ derivatives: true }}
          side={THREE.DoubleSide}
          transparent={!ribbonMode}
          depthWrite={ribbonMode}
          toneMapped={!ribbonMode}
        />
      </mesh>

      {/* Right guard rail */}
      <mesh geometry={rightGeo} frustumCulled={false}>
        <shaderMaterial
          uniforms={bumperUniformsR}
          vertexShader={bumperVertexShader}
          fragmentShader={bumperFragmentShader}
          extensions={{ derivatives: true }}
          side={THREE.DoubleSide}
          transparent={!ribbonMode}
          depthWrite={ribbonMode}
          toneMapped={!ribbonMode}
        />
      </mesh>

      {/* Exit portal group — positioned/oriented as one unit in useFrame */}
      <group ref={exitPortalGroupRef} visible={!ribbonMode}>
        {/* Additive glow bloom behind the portal face — larger than the portal itself */}
        <mesh ref={exitPortalGlowRef} position={[0, 0, -0.01]}>
          <planeGeometry args={[0.90, 0.90]} />
          <meshBasicMaterial
            color={color2}
            transparent
            opacity={0.30}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>

        {/* Main portal face — solid exit color */}
        <mesh>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial
            ref={exitPortalMatRef}
            color={color2}
            transparent
            opacity={0.60}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>

        {/* Orbiting torus rings removed — every tunnel's exit portal sits on the
            central mini-cube face, so with many active tunnels the rings stacked
            into a cluster of overlapping spinning circles at the cube's core.
            The portal glow + face already read the tunnel mouth without the noise. */}
      </group>

    </group>
  );
};

export default MobiusTunnel;
