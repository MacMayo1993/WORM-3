import * as THREE from 'three';
import { withPortalCutout } from './portalCutout.js';
import { makeTunnelPath, tunnelPathArcPointInto } from '../utils/tunnelPath.js';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { interiorPortalFrameInto, INTERIOR_PORTAL_RADIUS } from '../worm/healerWorm/interiorPortals.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

const SAMPLES = 9;
// Bore through the lifted tile, plastic underside and resting shell, using
// exactly the same circular radius as the inner entry/exit mouths.
export const exteriorPortalGLSL = `
uniform float uExteriorOpen;
uniform vec3 uExteriorPoints[${SAMPLES * 2}];
float portalDistance(vec3 point) {
  if (uExteriorOpen < 0.5) return 1000.0;
  // These materials also cover raised pads, buildings and energy effects.
  // Clip only inside either bore, regardless of the fragment's orientation.
  float distanceSq = 1000000.0;
  for (int i = 0; i < ${SAMPLES - 1}; i++) {
    vec3 edge = uExteriorPoints[i + 1] - uExteriorPoints[i];
    vec3 offset = point - uExteriorPoints[i];
    vec3 radial = offset - edge * clamp(dot(offset, edge) / max(dot(edge, edge), 0.000001), 0.0, 1.0);
    distanceSq = min(distanceSq, dot(radial, radial));
    // WebGL1 array indices must contain constants/loop symbols directly.
    edge = uExteriorPoints[i + ${SAMPLES + 1}] - uExteriorPoints[i + ${SAMPLES}];
    offset = point - uExteriorPoints[i + ${SAMPLES}];
    radial = offset - edge * clamp(dot(offset, edge) / max(dot(edge, edge), 0.000001), 0.0, 1.0);
    distanceSq = min(distanceSq, dot(radial, radial));
  }
  return sqrt(distanceSq) - ${INTERIOR_PORTAL_RADIUS};
}`;

export function createExteriorPortals() {
  const uniforms = { uExteriorOpen: { value: 0 },
    uExteriorPoints: { value: Array.from({ length: SAMPLES * 2 }, () => new THREE.Vector3()) } };
  const path = makeTunnelPath(), center = new THREE.Vector3(), axis = new THREE.Vector3();
  const materials = new Map(), owned = new Set(), originals = new Map();
  const releases = new Map();
  const restore = source => {
    const original = originals.get(source);
    if (!original) return;
    source.onBeforeCompile = original.onBeforeCompile;
    source.customProgramCacheKey = original.customProgramCacheKey;
    if (original.portalCutout === undefined) delete source.userData.portalCutout;
    else source.userData.portalCutout = original.portalCutout;
    source.needsUpdate = true;
    originals.delete(source);
  };
  let snapshot = null;
  const materialFor = source => {
    if (!source) return source;
    if (source.userData.portalCutout === uniforms) { owned.add(source); return source; }
    if (!materials.has(source)) {
      // Built-in materials are owned by their meshes/providers. Patch them in
      // place so React material refs and live opacity/map updates keep working.
      // Shader tiles may come from the shared style cache, so isolate those.
      const material = source.isShaderMaterial ? source.clone() : source;
      if (source.isShaderMaterial) material.uniforms = { ...source.uniforms };
      else originals.set(source, { onBeforeCompile: source.onBeforeCompile,
        customProgramCacheKey: source.customProgramCacheKey, portalCutout: source.userData.portalCutout });
      withPortalCutout(material, uniforms, exteriorPortalGLSL, 'outer-mouth');
      material.needsUpdate = true;
      materials.set(source, material); owned.add(material);
      // Random view changes dispose private glass/body materials; cache
      // eviction disposes old style sources. Release their portal copies too.
      const release = () => {
        source.removeEventListener('dispose', release);
        releases.delete(source); materials.delete(source); owned.delete(material);
        restore(source);
        if (material !== source) material.dispose();
      };
      releases.set(source, release);
      source.addEventListener('dispose', release);
    }
    return materials.get(source);
  };
  return {
    uniforms, materialFor,
    apply(root) {
      root?.traverse(object => {
        if (!object.isMesh || !object.material) return;
        object.material = Array.isArray(object.material) ? object.material.map(materialFor) : materialFor(object.material);
      });
    },
    update(tunnel, size, expansion, fall = null) {
      uniforms.uExteriorOpen.value = tunnel || fall ? 1 : 0;
      if (fall) {
        if (snapshot?.fall === fall) return;
        snapshot = { fall };
        // A single, tile-sized bore follows the actual inward fall. Duplicate
        // it into both shader slots so no unrelated exit tile opens up.
        for (let side = 0; side < 2; side++) for (let i = 0; i < SAMPLES; i++) {
          uniforms.uExteriorPoints.value[side * SAMPLES + i].copy(fall.mouth)
            .addScaledVector(fall.normal, THREE.MathUtils.lerp(0.8, -fall.depth - 0.3, i / (SAMPLES - 1)));
        }
        return;
      }
      if (!tunnel) return;
      if (snapshot?.tunnel === tunnel && snapshot.size === size && snapshot.expansion === expansion
        && snapshot.padHeight === tunnel.padHeight && snapshot.padExpansion === tunnel.padExpansion) return;
      snapshot = { tunnel, size, expansion, padHeight: tunnel.padHeight, padExpansion: tunnel.padExpansion };
      buildTunnelPathForTunnel(path, tunnel, size, expansion);
      for (let side = 0; side < 2; side++) {
        const mouthArc = side === 0 ? 0 : path.total;
        const innerArc = interiorPortalFrameInto(center, axis, path, side, size / 2 - 1.1);
        for (let i = 0; i < SAMPLES; i++) {
          const point = uniforms.uExteriorPoints.value[side * SAMPLES + i];
          tunnelPathArcPointInto(point, path, THREE.MathUtils.lerp(mouthArc, innerArc, i / (SAMPLES - 1)));
          if (i === 0) point.addScaledVector(side === 0 ? path.nStart : path.nEnd, SURFACE_OFFSET);
        }
      }
    },
    dispose() {
      releases.forEach((release, source) => source.removeEventListener('dispose', release));
      releases.clear();
      owned.forEach(material => { if (material.isShaderMaterial) material.dispose(); });
      originals.forEach((original, material) => restore(material));
      materials.clear(); owned.clear(); originals.clear();
    }
  };
}
