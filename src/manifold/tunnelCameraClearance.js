import { Vector3 } from 'three';
import { tunnelCoreClipGLSL } from './tunnelCoreClip.js';
import { cautionOpeningGLSL } from '../worm/healerWorm/cautionOpening.js';

// The rider's lens position and direction, shared by every band and render pass.
// MobiusTunnel writes them each frame while a WORM ride is under way.
export const tunnelCameraUniforms = {
  uCameraAhead: { value: new Vector3(0, 0, -1) },
  uTunnelCameraPosition: { value: new Vector3() },
};

// Opaque ribbons can cross the on-route lens while the worm twists. During a
// WORM ride reserve a short capsule around and ahead of the lens. There is no
// floor exemption: the camera banks more gently than the ribbon and sits on its
// centerline at the core docks, so even a "floor" can intersect the lens. The
// cut is local; track farther ahead and the other routes remain visible. Using
// the rider's published position also keeps mirror captures from moving this
// opening to their own probe camera.
//
// Bands are cut away inside the antipodal core (it is solid), except the one
// being ridden (uCoreClipOff): that one runs through the mirror room carved
// for the ride, and without it the worm crossed the room on nothing.
export const tunnelCameraClearanceGLSL = `
  ${tunnelCoreClipGLSL}
  ${cautionOpeningGLSL}
  uniform float uCameraClearance;
  uniform float uCoreClipOff;
  uniform vec3 uCameraAhead, uTunnelCameraPosition;
  float tunnelCameraVisibility(vec3 worldPoint) {
    if ((uCoreClipOff < 0.5 && outsideTunnelCore(worldPoint) < 0.5) || insideCautionOpening(worldPoint)) return 0.0;
    if (uCameraClearance < 0.5) return 1.0;
    vec3 toPoint = worldPoint - uTunnelCameraPosition;
    float along = clamp(dot(toPoint, uCameraAhead), 0.0, 0.35);
    float clearance = length(toPoint - uCameraAhead * along);
    return smoothstep(0.38, 0.5, clearance);
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
