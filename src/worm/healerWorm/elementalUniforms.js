// src/worm/healerWorm/elementalUniforms.js
//
// Uniform objects every elemental skin material shares by reference.
//
// ElementalCubeSkin's frame loop writes these once per frame; every layer of every
// element reads them. Sharing the objects (rather than copying values into each
// material) is what keeps a three-layer skin to one write.
//
// The worm is published as four points along the front of its body — the head and
// three samples behind it — so a skin can part around the body the camera is
// looking past, not just the head: flames lie down, grass bends away, water rings
// out from the head. Render-only: nothing here reaches the simulation.

import * as THREE from 'three';
import { wormSegments } from '../wormSegments.js';

export const WORM_POINTS = 4;

/** xyz: worm head, w: 1 while a live worm is on the surface. */
export const uWormHead = { value: new THREE.Vector4(0, 0, 0, 0) };
/** Head plus three samples down the front of the body, world space. */
export const uWormBody = { value: Array.from({ length: WORM_POINTS }, () => new THREE.Vector3()) };

// How far down the body the samples reach. The camera sits behind the head, so the
// stretch nearest the head is what an effect would hide; the far tail is off-screen.
const BODY_REACH = 16;

// Claim origins belong to each skin material: fused elements keep independent
// sweeps. Only the worm positions and cube dimensions are shared across layers.
/** Gap between adjacent cubies; shell borders open as the lattice expands. */
export const uCubeGap = { value: 0 };
/** Half the current expanded hull, world units — how far a flood has to reach. */
export const uCubeHalf = { value: 1.5 };

// Settings → Scene → Flashing. Lightning's arcs and the storm coat's cloud flashes
// read this: at 1 they keep their full strike, at the reduced cap they swell and
// fade at a slow beat (≤ 1 a second) and at a fraction of the brightness, so no part
// of the cube flashes on and off. One shared value, so the setting reaches every
// coat without a new program.
export const FLASH_CAP_REDUCED = 0.3;
export const uFlashCap = { value: 1 };

// Peak brightness of a lightning strike's disc and column under reduced flashing
// (LightningStrikes.jsx); a full strike lands at 1.
export const GENTLE_STRIKE = { disc: 0.45, column: 0.3 };

/** Point every flashing coat at the player's flashing setting. */
export function publishFlashCap(reduced) {
  uFlashCap.value = reduced ? FLASH_CAP_REDUCED : 1;
}

/**
 * Copy the published worm into the shared uniforms. `active` is false under
 * reduced motion or when nothing is published, which disables every proximity
 * response in one place.
 */
export function publishWormUniforms(active) {
  const n = wormSegments.count;
  const p = wormSegments.positions;
  const on = active && n > 0;
  uWormHead.value.set(p[0], p[1], p[2], on ? 1 : 0);
  const reach = Math.max(0, Math.min(n, BODY_REACH) - 1);
  for (let s = 0; s < WORM_POINTS; s++) {
    const i = on ? Math.round((s / (WORM_POINTS - 1)) * reach) : 0;
    uWormBody.value[s].set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  }
}

/**
 * GLSL for the shared worm uniforms: the declarations plus the distance from a
 * point to the body polyline. Spliced into any vertex shader that reacts to the
 * worm.
 */
export const GLSL_WORM = /* glsl */ `
  uniform vec4 uWormHead;
  uniform vec3 uWormBody[${WORM_POINTS}];

  float segDist(vec3 p, vec3 a, vec3 b) {
    vec3 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
    return length(p - (a + ab * t));
  }
  // Distance from p to the front of the worm's body; large when there is no worm.
  float wormDist(vec3 p) {
    if (uWormHead.w < 0.5) return 1e3;
    float d = segDist(p, uWormBody[0], uWormBody[1]);
    d = min(d, segDist(p, uWormBody[1], uWormBody[2]));
    d = min(d, segDist(p, uWormBody[2], uWormBody[3]));
    return d;
  }
  // Unit direction from the body toward p (in the plane of whatever calls it), for
  // things that lean away from the worm.
  vec3 wormAway(vec3 p) {
    vec3 a = uWormBody[0];
    vec3 b = uWormBody[3];
    vec3 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
    vec3 d = p - (a + ab * t);
    float l = length(d);
    return l > 1e-4 ? d / l : vec3(0.0);
  }
`;
