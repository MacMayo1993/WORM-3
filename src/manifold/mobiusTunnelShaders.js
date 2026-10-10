import * as THREE from 'three';
import { tunnelFinishGLSL } from './tunnelFinish.js';
import { tunnelCameraClearanceGLSL } from './tunnelCameraClearance.js';
import { veilVertexShader, veilFragmentShader } from './tunnelRibbonVeil.js';
import { tunnelEnergyGLSL } from './tunnelEnergy.js';

// Vertex shader: pass UV + world position through to fragment.
// vWorldPos feeds the fresnel silhouette glow (needs a view direction).
export const vertexShader = `
  uniform vec3  uWhipAxis;   // world-space direction the ribbon snaps along
  uniform float uWhipAmp;    // 0 when idle; decaying envelope during a flip
  uniform float uWhipPhase;  // advances with the soliton, so the wave travels
  attribute float aDistance;

  varying vec2 vUv;
  varying float vDistance;
  varying vec3 vWorldPos;
  varying vec3 vSurfaceNormal;

  void main() {
    vUv = uv;
    vDistance = aDistance;
    vSurfaceNormal = normalize(mat3(modelMatrix) * normal);
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
               * smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y)
               * smoothstep(0.0, 0.10, abs(vUv.y - 0.5));
    wp.xyz += uWhipAxis * (sin(vUv.y * 12.0 - uWhipPhase) * uWhipAmp * ends);

    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Ribbon fragment shader.
// vUv.y: 0 = tile1 end, 0.5 = centre (VoidCore), 1 = tile2 end.
// Each half is the solid color of its own tile — no cross-blending.
// Slow spiral light echoes the intro without moving the physical floor.
const rideColorShader = `
  vec3 rideColor(float trip) {
    // Two solid endpoint colors, with only pixel-width filtering at the core.
    float aa = max(fwidth(trip), 0.00001);
    return mix(uColorA, uColorB, smoothstep(uRideCore - aa, uRideCore + aa, trip));
  }
`;
export const fragmentShader = `
  uniform vec3 uColorA, uColorB;
  uniform float uOpacity, uRideMode, uRideCore, uTime;
  uniform float uGrowT, uPulseBoost, uSolitonProgress, uSolitonAmp;
  uniform float uIdlePadProgress, uIdlePadAmp;
  varying vec2 vUv;
  varying float vDistance;
  varying vec3 vWorldPos, vSurfaceNormal;
  ${tunnelFinishGLSL}
  ${tunnelCameraClearanceGLSL}
  ${tunnelEnergyGLSL}
  void main() {
    clearTunnelCamera(vWorldPos);
    float leftFront = uGrowT * 0.5, rightFront = 1.0 - leftFront;
    if (vUv.y > leftFront && vUv.y < rightFront) discard;
    float core = uRideMode > 0.5 ? uRideCore : 0.5;
    float aa = max(fwidth(vUv.y), 0.00001);
    vec3 base = mix(uColorA, uColorB, smoothstep(core - aa, core + aa, vUv.y));
    // Opposite charges: each half leans toward its partner's colour at the core.
    float bleed;
    vec3 energy = tunnelEnergy(vUv.y, core, vUv.x, vDistance, uTime, uColorA, uColorB, bleed);
    base = mix(base, vUv.y < core ? uColorB : uColorA, bleed * 0.5);
    vec3 color = tunnelSatin(base, vSurfaceNormal, normalize(cameraPosition - vWorldPos), vUv, vDistance, uTime);
    color += energy;
    float pulse = exp(-pow((vUv.y - uSolitonProgress) / 0.055, 2.0)) * uSolitonAmp;
    float idle = min(abs(vUv.y - uIdlePadProgress), abs(vUv.y - (1.0 - uIdlePadProgress)));
    pulse += exp(-pow(idle / 0.055, 2.0)) * uIdlePadAmp;
    float front = min(abs(vUv.y - leftFront), abs(vUv.y - rightFront));
    float birth = (1.0 - smoothstep(0.0, 0.025, front)) * (1.0 - step(1.0, uGrowT));
    color += mix(base, vec3(0.9, 0.96, 1.0), 0.35) * (pulse * 0.35 + birth * 0.3 + uPulseBoost * 0.15);
    gl_FragColor = vec4(color, uRideMode > 0.5 ? 1.0 : min(1.0, uOpacity + 0.12));
    #include <colorspace_fragment>
  }
`;

// Bumper vertex shader: passes height fraction and trip fraction to fragment.
// vTripFrac (0→1 along ribbon length) lets the fragment highlight the Möbius flip point.
export const bumperVertexShader = `
  uniform vec3  uWhipAxis;
  uniform float uWhipAmp;
  uniform float uWhipPhase;

  attribute float aHeightFrac;
  attribute float aTripFrac;
  varying  float vHeightFrac;
  varying  float vTripFrac;
  varying vec3 vCameraPoint;

  void main() {
    vHeightFrac = aHeightFrac;
    vTripFrac   = aTripFrac;

    // Same whip displacement as the ribbon, driven by the SAME uniform objects
    // (shared by reference below) — otherwise the guard rails would stay put
    // while the ribbon snapped out from under them.
    vec3  p    = position;
    float ends = sin(aTripFrac * 3.14159265)
               * smoothstep(0.0, 0.14, aTripFrac) * smoothstep(1.0, 0.86, aTripFrac)
               * smoothstep(0.0, 0.10, abs(aTripFrac - 0.5));
    p += uWhipAxis * (sin(aTripFrac * 12.0 - uWhipPhase) * uWhipAmp * ends);

    vCameraPoint = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// Pearly lips follow the same half-twist and endpoint colors as the spine.
export const bumperFragmentShader = `
  uniform vec3 uColorA, uColorB;
  uniform float uRideCore, uOpacity, uRideMode, uGrowT, uTime;
  varying float vHeightFrac, vTripFrac;
  varying vec3 vCameraPoint;
  ${rideColorShader}
  ${tunnelCameraClearanceGLSL}
  ${tunnelEnergyGLSL}
  void main() {
    clearTunnelCamera(vCameraPoint);
    if (vTripFrac > uGrowT * 0.5 && vTripFrac < 1.0 - uGrowT * 0.5) discard;
    vec3 base = rideColor(vTripFrac);
    vec3 lip = mix(base, vec3(0.9, 0.96, 1.0), 0.38);
    vec3 color = mix(base * 0.6, lip * 0.9, smoothstep(0.4, 1.0, vHeightFrac));
    // The rails are the field's conduits: the same charge, carried a little hotter.
    float bleed;
    float core = uRideMode > 0.5 ? uRideCore : 0.5;
    color += tunnelEnergy(vTripFrac, core, 0.5, vTripFrac * uTunnelLength, uTime, uColorA, uColorB, bleed) * 1.35;
    gl_FragColor = vec4(color, uRideMode > 0.5 ? 1.0 : uOpacity * 0.85);
    #include <colorspace_fragment>
  }
`;


export function createMobiusWarmupMaterials() {
  const shared = { side: THREE.DoubleSide, toneMapped: false, extensions: { derivatives: true } };
  const materials = [];
  for (const ribbonMode of [false, true]) {
    const props = { ...shared, transparent: !ribbonMode, depthWrite: ribbonMode };
    materials.push(new THREE.ShaderMaterial({ ...props, vertexShader, fragmentShader }),
      new THREE.ShaderMaterial({ ...props, vertexShader: bumperVertexShader, fragmentShader: bumperFragmentShader }));
  }
  materials.push(new THREE.ShaderMaterial({ ...shared, transparent: true, depthWrite: false,
    vertexShader: veilVertexShader, fragmentShader: veilFragmentShader }));
  return materials;
}
