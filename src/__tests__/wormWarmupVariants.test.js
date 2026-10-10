import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createExteriorPortals, exteriorPortalWarmupMaterial } from '../3d/exteriorPortals.js';
import { ensureInstanceColor } from '../3d/instanceUploads.js';
import { createOrbReveal, warmOrbReveal } from '../worm/orbReveal.js';
import { warmCautionDissolve } from '../worm/healerWorm/cautionDissolve.js';

// A program is chosen by source and cache key, never by uniform values. Each
// warm-up variant must land on the program the live effect uses, or the warm-up
// compiles something nothing draws and the effect still links in its own frame.

it('warms the same portal-bored program the cube exterior patches in', () => {
  const portals = createExteriorPortals();
  const live = portals.materialFor(new THREE.MeshStandardMaterial({ transparent: true }));
  const warm = exteriorPortalWarmupMaterial(new THREE.MeshStandardMaterial({ transparent: true }));
  expect(warm.customProgramCacheKey()).toBe(live.customProgramCacheKey());
  expect(warm.customProgramCacheKey()).toContain('portal');
  const shader = { uniforms: {}, vertexShader: 'void main() { gl_Position = vec4(0.0); }', fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }' };
  const liveShader = portals.materialFor(new THREE.ShaderMaterial(shader));
  const warmShader = exteriorPortalWarmupMaterial(new THREE.ShaderMaterial(shader));
  expect(warmShader.vertexShader).toBe(liveShader.vertexShader);
  expect(warmShader.fragmentShader).toBe(liveShader.fragmentShader);
  expect(warmShader.fragmentShader).toContain('portalDistance');
  portals.dispose();
});

it('allocates an instanced colour buffer up front, once', () => {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial(), 12);
  expect(mesh.instanceColor).toBeNull();
  ensureInstanceColor(mesh);
  const colors = mesh.instanceColor;
  expect(colors.count).toBe(12);
  ensureInstanceColor(mesh);
  expect(mesh.instanceColor).toBe(colors);
  ensureInstanceColor(null);
  ensureInstanceColor(new THREE.Mesh());
});

it('compiles orb arrival variants and hands them back for the first real arrival', () => {
  const source = new THREE.MeshBasicMaterial({ transparent: true });
  const compiled = [];
  const renderer = { compile: vi.fn(root => root.traverse(object => object.material && compiled.push(object.material))) };
  warmOrbReveal(renderer, new THREE.PerspectiveCamera(), new THREE.Scene(), [source]);
  // Settled and arriving looks both compile.
  expect(renderer.compile).toHaveBeenCalledTimes(2);
  expect(compiled[0]).toBe(source);
  const variant = compiled[1];
  expect(variant).not.toBe(source);
  expect(variant.customProgramCacheKey()).toContain('orb-reveal');
  const group = new THREE.Group(), orb = new THREE.Mesh(new THREE.PlaneGeometry(), source);
  group.add(orb);
  const reveal = createOrbReveal(group);
  expect(orb.material).toBe(variant);
  reveal.dispose();
  expect(orb.material).toBe(source);
});

it('warms the caution fall dissolve on the live worm without disturbing it', () => {
  const root = new THREE.Group(), source = new THREE.MeshStandardMaterial();
  const liveHandle = { uniforms: { skin: { value: 1 } } };
  source.userData.shader = liveHandle;
  // A skin factory that keeps its compiled shader on the material it was built for.
  source.onBeforeCompile = shader => { source.userData.shader = shader; };
  const body = new THREE.InstancedMesh(new THREE.SphereGeometry(), source, 4), face = new THREE.Mesh(new THREE.SphereGeometry(), source);
  root.add(body, face);
  const seen = [];
  const renderer = { compile: vi.fn(target => target.traverse(object => {
    if (!object.material) return;
    seen.push(object.material);
    object.material.onBeforeCompile({ uniforms: {}, vertexShader: 'void main() {\n#include <project_vertex>\n}', fragmentShader: 'void main() {\n#include <clipping_planes_fragment>\n}' }, {});
  })) };
  const dispose = warmCautionDissolve(renderer, new THREE.PerspectiveCamera(), new THREE.Scene(), root);
  expect(seen).toHaveLength(2);
  expect(seen.every(material => material !== source && material.customProgramCacheKey().startsWith('worm-fall-dissolve'))).toBe(true);
  // The worm wears its own materials again, with its animation handle intact.
  expect(body.material).toBe(source);
  expect(face.material).toBe(source);
  expect(source.userData.shader).toBe(liveHandle);
  const freed = vi.fn();
  seen.forEach(material => material.addEventListener('dispose', freed));
  dispose();
  expect(freed).toHaveBeenCalledTimes(2);
  expect(warmCautionDissolve(renderer, null, null, null)).toBeTypeOf('function');
});
