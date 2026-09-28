import * as THREE from 'three';
import { addOrbReveal } from '../components/intro/introDissolve.js';

export const ORB_REVEAL_SECONDS = 0.7;
export const ORB_RAIN_SECONDS = 0.9;
export const orbRevealProgress = (age, shower = false) => Math.min(1, Math.max(0, age / (shower ? ORB_RAIN_SECONDS : ORB_REVEAL_SECONDS)));
export const orbRainLift = (progress, reducedMotion = false) => reducedMotion ? 0 : 1.8 * (1 - progress) ** 2;

// Keep compiled arrival variants resident for subsequent waves. Only new orbs
// borrow them; settled orbs return to the existing shared materials and batches.
// The pool grows only to simultaneous arrivals, not the total number collected.
const pools = new WeakMap();
function borrow(source, uniforms, reducedMotion) {
  let variants = pools.get(source);
  if (!variants) { variants = [[], []]; pools.set(source, variants); }
  const pool = variants[+reducedMotion];
  const material = pool.pop() ?? source.clone();
  material.copy(source);
  // Share animated time/palette uniforms with the original custom shader.
  if (source.isShaderMaterial) material.uniforms = { ...source.uniforms };
  material.onBeforeCompile = source.onBeforeCompile;
  if (reducedMotion) { material.transparent = true; material.depthWrite = false; }
  addOrbReveal(material, uniforms, source.customProgramCacheKey());
  return { material, release: () => pool.push(material) };
}

export function createOrbReveal(group, { radius = 0.6, reducedMotion = false } = {}) {
  const uniforms = { uDissolve: { value: reducedMotion ? 0 : 1 }, uDissolveFrame: { value: new THREE.Matrix4() }, uOrbOpacity: { value: 0 } };
  const scale = new THREE.Matrix4().makeScale(1.7 / radius, 1.7 / radius, 1.7 / radius);
  const entries = [];
  let finished = false;
  group.traverse(object => {
    if (!object.material || Array.isArray(object.material)) return;
    const source = object.material;
    const variant = borrow(source, uniforms, reducedMotion);
    object.material = variant.material;
    entries.push({ object, source, ...variant });
  });
  const release = () => {
    if (finished) return;
    finished = true;
    for (const entry of entries) {
      if (entry.object.material === entry.material) entry.object.material = entry.source;
      entry.release();
    }
  };
  return {
    update(progress) {
      if (finished) return false;
      if (progress >= 1) { release(); return false; }
      uniforms.uDissolve.value = reducedMotion ? 0 : 1 - progress;
      uniforms.uOrbOpacity.value = reducedMotion ? progress * progress * (3 - 2 * progress) : 1;
      group.updateWorldMatrix(true, false);
      uniforms.uDissolveFrame.value.copy(group.matrixWorld).invert().premultiply(scale);
      return true;
    },
    dispose: release,
  };
}
