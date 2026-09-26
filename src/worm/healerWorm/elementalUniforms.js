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

/**
 * Where the wash entered the world: xyz is the claimed tile's world position, w is
 * 1 while there is one. Shell skins flood outward from it continuously in world
 * space — per-cell delays would make neighbouring cells disagree about how deep the
 * water is along a shared edge, and crack the shell open.
 */
export const uClaimOrigin = { value: new THREE.Vector4(0, 0, 0, 0) };
/** Half the cube's edge length, world units — how far a flood has to reach. */
export const uCubeHalf = { value: 1.5 };

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
