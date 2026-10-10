import { tunnelCoreClipGLSL } from './tunnelCoreClip.js';
import { cautionOpeningGLSL } from '../worm/healerWorm/cautionOpening.js';
// Opaque ribbons can cross the on-route lens while the worm twists. Clear only
// the near-camera part during a WORM ride; the track ahead keeps its normal
// depth and materials. The screen-space dissolve needs no transparent pass.
export const tunnelCameraClearanceGLSL = `
  ${tunnelCoreClipGLSL}
  ${cautionOpeningGLSL}
  uniform float uCameraClearance;
  float tunnelCameraVisibility(vec3 worldPoint) {
    if (outsideTunnelCore(worldPoint) < 0.5 || insideCautionOpening(worldPoint)) return 0.0;
    if (uCameraClearance < 0.5) return 1.0;
    return smoothstep(0.55, 0.85, distance(worldPoint, cameraPosition));
  }
  void clearTunnelCamera(vec3 worldPoint) {
    if (outsideTunnelCore(worldPoint) < 0.5 || insideCautionOpening(worldPoint)) discard;
    if (uCameraClearance < 0.5) return;
    float visibility = tunnelCameraVisibility(worldPoint);
    float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (visibility <= grain) discard;
  }
`;
