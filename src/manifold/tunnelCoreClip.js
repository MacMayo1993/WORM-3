import { Vector3 } from 'three';

// VoidCore publishes its displayed bounds before ribbons render, including zoom.
export const tunnelCoreClipUniforms = {
  uTunnelCoreHalf: { value: 0 },
  uTunnelCoreCenter: { value: new Vector3() },
};
export const tunnelCoreClipGLSL = `
uniform float uTunnelCoreHalf;
uniform vec3 uTunnelCoreCenter;
float outsideTunnelCore(vec3 point) {
  vec3 p = abs(point - uTunnelCoreCenter);
  return uTunnelCoreHalf <= 0.0 || max(p.x, max(p.y, p.z)) >= uTunnelCoreHalf ? 1.0 : 0.0;
}`;
