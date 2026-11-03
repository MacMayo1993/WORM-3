import { Vector3 } from 'three';
import { tunnelCoreClipGLSL } from './tunnelCoreClip.js';
import { cautionOpeningGLSL } from '../worm/healerWorm/cautionOpening.js';

// The capsule's radius on the route (the band wrapping the lens) and its floor
// for a raised lens (anything nearer than this would fill the frame).
export const TUNNEL_CAMERA_CLEAR_MAX = 0.5;
export const TUNNEL_CAMERA_CLEAR_MIN = 0.16;

// The rider's lens position and direction, shared by every band and render pass.
// MobiusTunnel writes them each frame while a WORM ride is under way.
export const tunnelCameraUniforms = {
  uCameraAhead: { value: new Vector3(0, 0, -1) },
  uTunnelCameraPosition: { value: new Vector3() },
  // Radius of the lens's clearance capsule (see tunnelCameraClearRadius).
  uCameraClearRadius: { value: TUNNEL_CAMERA_CLEAR_MAX },
};

/**
 * The capsule's radius for a lens `lift` off the ridden route. On the route (the
 * outer mouths) the band wraps the lens and everything within half a unit must
 * go. The ride camera rides raised everywhere else (tunnelCameraRails), so the
 * band lies below it and only what would actually reach the lens is cleared:
 * cutting the full half unit there took bites out of the band under a raised
 * lens for no reason.
 */
export function tunnelCameraClearRadius(lift = 0) {
  return Math.min(TUNNEL_CAMERA_CLEAR_MAX, Math.max(TUNNEL_CAMERA_CLEAR_MIN, TUNNEL_CAMERA_CLEAR_MAX - Math.max(0, lift)));
}

// Opaque ribbons can cross the on-route lens while the worm twists. During a
// WORM ride reserve a short capsule around and ahead of the lens. There is no
// floor exemption: at the outer mouths the camera sits on the centerline and
// banks more gently than the ribbon, so even a "floor" can intersect the lens.
// The cut is local; track farther ahead and the other routes remain visible.
// Using the rider's published position also keeps mirror captures from moving
// this opening to their own probe camera.
//
// Every visual band stops at the displayed core shell, including the occupied
// route and recorded tail. Only the worm crosses the uncluttered mirror room;
// its simulation path and camera route remain continuous behind this clip.
export const tunnelCameraClearanceGLSL = `
  ${tunnelCoreClipGLSL}
  ${cautionOpeningGLSL}
  uniform float uCameraClearance, uCameraClearRadius;
  uniform vec3 uCameraAhead, uTunnelCameraPosition;
  bool tunnelCoreHides(vec3 worldPoint) {
    return outsideTunnelCore(worldPoint) < 0.5;
  }
  float tunnelCameraVisibility(vec3 worldPoint) {
    if (tunnelCoreHides(worldPoint) || insideCautionOpening(worldPoint)) return 0.0;
    if (uCameraClearance < 0.5) return 1.0;
    vec3 toPoint = worldPoint - uTunnelCameraPosition;
    float along = clamp(dot(toPoint, uCameraAhead), 0.0, 0.35);
    float clearance = length(toPoint - uCameraAhead * along);
    return smoothstep(uCameraClearRadius * 0.76, uCameraClearRadius, clearance);
  }
  void clearTunnelCamera(vec3 worldPoint) {
    if (tunnelCoreHides(worldPoint) || insideCautionOpening(worldPoint)) discard;
    if (uCameraClearance < 0.5) return;
    float visibility = tunnelCameraVisibility(worldPoint);
    // A single world-space contour replaces the noisy pixel dissolve. The
    // transparent veil still uses continuous visibility for its soft boundary.
    if (visibility < 0.5) discard;
  }
`;
