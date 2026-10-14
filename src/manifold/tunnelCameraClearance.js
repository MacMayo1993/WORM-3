import { Vector3 } from 'three';
import { tunnelCoreClipGLSL } from './tunnelCoreClip.js';
import { cautionOpeningGLSL } from '../worm/healerWorm/cautionOpening.js';

// The lens's direction of view and its screen-up, shared by every band.
// MobiusTunnel writes them each frame while a WORM ride is under way.
export const tunnelCameraUniforms = {
  uCameraAhead: { value: new Vector3(0, 0, -1) },
  uCameraUp: { value: new Vector3(0, 1, 0) },
};

// Opaque ribbons can cross the on-route lens while the worm twists. During a
// WORM ride clear what comes close enough to the lens to fill the screen (the
// band curling up round it as it twists, a wall right ahead), except what lies
// below it: the track under the rider always stays, so it is seen riding the
// band. A geometric cut keeps that opening stable as the camera moves, without
// a screen-space stipple crawling across the track or an extra blending pass.
//
// Bands are cut away inside the antipodal core (it is solid), except the one
// being ridden (uCoreClipOff): that one runs through the mirror room carved
// for the ride, and without it the worm crossed the room on nothing.
export const tunnelCameraClearanceGLSL = `
  ${tunnelCoreClipGLSL}
  ${cautionOpeningGLSL}
  uniform float uCameraClearance;
  uniform float uCoreClipOff;
  uniform vec3 uCameraAhead, uCameraUp;
  float tunnelCameraVisibility(vec3 worldPoint) {
    if ((uCoreClipOff < 0.5 && outsideTunnelCore(worldPoint) < 0.5) || insideCautionOpening(worldPoint)) return 0.0;
    if (uCameraClearance < 0.5) return 1.0;
    vec3 toPoint = worldPoint - cameraPosition;
    float dist = length(toPoint);
    vec3 dir = toPoint / max(dist, 1e-4);
    float near = 1.0 - smoothstep(0.2, 0.36, dist);
    // Straight ahead clears a little further out; underneath never clears.
    float ahead = smoothstep(0.55, 0.85, dot(dir, uCameraAhead)) * (1.0 - smoothstep(0.36, 0.5, dist));
    float below = smoothstep(0.3, 0.6, dot(dir, -uCameraUp));
    return 1.0 - max(near, ahead) * (1.0 - below);
  }
  void clearTunnelCamera(vec3 worldPoint) {
    if ((uCoreClipOff < 0.5 && outsideTunnelCore(worldPoint) < 0.5) || insideCautionOpening(worldPoint)) discard;
    if (uCameraClearance < 0.5) return;
    float visibility = tunnelCameraVisibility(worldPoint);
    // A single world-space contour replaces the noisy pixel dissolve. The
    // transparent veil still uses continuous visibility for its soft boundary.
    if (visibility < 0.5) discard;
  }
`;
