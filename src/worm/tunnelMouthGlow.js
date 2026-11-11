import { MathUtils, Vector3 } from 'three';
import { buildTunnelPathForTunnel } from './wormLogic.js';
import { makeTunnelPath } from '../utils/tunnelPath.js';
import { interiorPortalFrameInto } from './healerWorm/interiorPortals.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

const path = makeTunnelPath(), center = new Vector3(), axis = new Vector3(), offset = new Vector3();

// Follow the lens through the entire wall thickness, including a raised pad.
// Head progress is already well down the arm when the camera reaches the mouth;
// using it made the old entry pulse miss the black backing and omitted the exit.
export function tunnelMouthGlow(position, tunnel, size, expansion = 0) {
  if (!tunnel) return 0;
  buildTunnelPathForTunnel(path, tunnel, size, expansion);
  const inner = (size - 1) / 2 * cubeExpansionScale(size, expansion) + SURFACE_OFFSET - 0.13;
  let glow = 0;
  for (let side = 0; side < 2; side++) {
    const normal = side ? path.nEnd : path.nStart;
    const mouth = side ? path.vEnd : path.vStart;
    const height = position.dot(normal), outer = mouth.dot(normal) + 0.04;
    const distance = Math.max(inner - height, height - outer, 0);
    if (distance >= 0.42) continue;
    if (height >= mouth.dot(normal)) center.copy(mouth);
    else interiorPortalFrameInto(center, axis, path, side, height);
    offset.subVectors(position, center);
    offset.addScaledVector(normal, -offset.dot(normal));
    const radial = 1 - MathUtils.smoothstep(offset.length(), 0.34, 0.85);
    glow = Math.max(glow, radial * (1 - MathUtils.smoothstep(distance, 0, 0.42)));
  }
  return glow;
}
