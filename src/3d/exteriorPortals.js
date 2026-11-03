import * as THREE from 'three';
import { withPortalCutout } from './portalCutout.js';
import { makeTunnelPath, tunnelPathArcPointInto } from '../utils/tunnelPath.js';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { interiorPortalFrameInto, INTERIOR_PORTAL_RADIUS } from '../worm/healerWorm/interiorPortals.js';
import { SURFACE_OFFSET } from '../utils/constants.js';
import { CAUTION_OPENING_RADIUS, CAUTION_OPENING_TOP } from '../worm/healerWorm/cautionOpening.js';

const SAMPLES = 9;
// Bore through the lifted tile, plastic underside and resting shell, using
// exactly the same circular radius as the inner entry/exit mouths.
export const exteriorPortalGLSL = `
uniform float uExteriorOpen;
uniform float uExteriorRadius;
uniform vec3 uExteriorPoints[${SAMPLES * 2}];
uniform vec3 uExteriorNormals[2];
float exteriorPlaneDistance(vec3 point, vec3 start, vec3 end, vec3 normal) {
  // Only the mouth's own face can open. A corner throat used to drill through
  // the neighboring perpendicular face as well as its intended sticker.
  vec3 wall = abs(point);
  float depth = dot(wall, abs(normal));
  if (depth + 0.00001 < max(wall.x, max(wall.y, wall.z))) return 1000.0;
  vec3 edge = end - start;
  float axial = dot(edge, normal);
  if (abs(axial) < 0.00000001) return 1000.0;
  float t = dot(point - start, normal) / axial;
  if (t < 0.0 || t > 1.0) return 1000.0;
  // Slice in the face plane, not perpendicular to the curve: oblique routes
  // must not stretch a circular mouth into a neighboring tile.
  return length(point - (start + t * edge)) - uExteriorRadius;
}
float portalDistance(vec3 point) {
  if (uExteriorOpen < 0.5) return 1000.0;
  float gap = 1000.0;
  for (int i = 0; i < ${SAMPLES - 1}; i++) {
    gap = min(gap, exteriorPlaneDistance(point, uExteriorPoints[i],
      uExteriorPoints[i + 1], uExteriorNormals[0]));
    // WebGL1 array indices must contain constants/loop symbols directly.
    gap = min(gap, exteriorPlaneDistance(point, uExteriorPoints[i + ${SAMPLES}],
      uExteriorPoints[i + ${SAMPLES + 1}], uExteriorNormals[1]));
  }
  return gap;
}`;

// A program is keyed by its source, never by uniform values, so a copy patched
// against these stand-in uniforms shares the program of every live bore. The WORM
// warm-up compiles such copies of the effects that only mount when a tile flips;
// unpatched copies were warming programs the cube never uses, and the first flip
// of a run linked two dozen programs in one frame.
const warmupUniforms = { uExteriorOpen: { value: 0 }, uExteriorRadius: { value: INTERIOR_PORTAL_RADIUS },
  uExteriorNormals: { value: [new THREE.Vector3(), new THREE.Vector3()] },
  uExteriorPoints: { value: Array.from({ length: SAMPLES * 2 }, () => new THREE.Vector3()) } };
export function exteriorPortalWarmupMaterial(source) {
  const material = source.clone();
  if (source.isShaderMaterial) material.uniforms = { ...source.uniforms };
  return withPortalCutout(material, warmupUniforms, exteriorPortalGLSL, 'outer-mouth');
}

export function createExteriorPortals() {
  const uniforms = { uExteriorOpen: { value: 0 }, uExteriorRadius: { value: INTERIOR_PORTAL_RADIUS },
    uExteriorNormals: { value: [new THREE.Vector3(), new THREE.Vector3()] },
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
      if (source.isShaderMaterial) {
        material.uniforms = { ...source.uniforms };
        material.onBeforeRender = source.onBeforeRender;
      }
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
      uniforms.uExteriorRadius.value = fall ? CAUTION_OPENING_RADIUS : INTERIOR_PORTAL_RADIUS;
      if (fall) {
        if (snapshot?.fall === fall) return;
        snapshot = { fall };
        uniforms.uExteriorNormals.value.forEach(normal => normal.copy(fall.normal));
        // A single, tile-sized bore follows the actual inward fall. Duplicate
        // it into both shader slots so no unrelated exit tile opens up.
        for (let side = 0; side < 2; side++) for (let i = 0; i < SAMPLES; i++) {
          uniforms.uExteriorPoints.value[side * SAMPLES + i].copy(fall.mouth)
            .addScaledVector(fall.normal, THREE.MathUtils.lerp(CAUTION_OPENING_TOP, -fall.depth - 0.3, i / (SAMPLES - 1)));
        }
        return;
      }
      if (!tunnel) return;
      if (snapshot?.tunnel === tunnel && snapshot.size === size && snapshot.expansion === expansion
        && snapshot.padHeight === tunnel.padHeight && snapshot.padExpansion === tunnel.padExpansion) return;
      snapshot = { tunnel, size, expansion, padHeight: tunnel.padHeight, padExpansion: tunnel.padExpansion };
      buildTunnelPathForTunnel(path, tunnel, size, expansion);
      uniforms.uExteriorNormals.value[0].copy(path.nStart);
      uniforms.uExteriorNormals.value[1].copy(path.nEnd);
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
