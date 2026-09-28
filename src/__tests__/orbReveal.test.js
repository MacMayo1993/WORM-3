import { it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createOrbReveal, orbRevealProgress, orbRainLift } from '../worm/orbReveal.js';

function compile(material) {
  const builtIn = THREE.ShaderLib[material.isMeshStandardMaterial ? 'standard' : 'basic'];
  const shader = { uniforms: {}, vertexShader: material.vertexShader ?? builtIn.vertexShader, fragmentShader: material.fragmentShader ?? builtIn.fragmentShader };
  material.onBeforeCompile(shader);
  return shader;
}

it('reverses the bomb field across all parts in one moving orb frame without changing shared materials', () => {
  const source = new THREE.MeshStandardMaterial({ color: '#65ffd0' });
  const group = new THREE.Group(), part = new THREE.Mesh(new THREE.SphereGeometry(0.2), source);
  group.add(part); group.position.set(4, 2, 1);
  const reveal = createOrbReveal(group);
  reveal.update(0);
  const shader = compile(part.material);
  expect(shader.uniforms.uDissolve.value).toBe(1);
  expect(shader.fragmentShader).toContain('dissolveNoise(p * 23.0 + 5.3)');
  expect(source.onBeforeCompile.toString()).not.toContain('uDissolve');
  reveal.update(0.5);
  expect(shader.uniforms.uDissolve.value).toBe(0.5);
  group.position.set(-3, 7, 1); reveal.update(0.75);
  expect(group.position.clone().applyMatrix4(shader.uniforms.uDissolveFrame.value).length()).toBeCloseTo(0);
  expect(reveal.update(1)).toBe(false);
  expect(part.material).toBe(source);
});

it('retains custom shaders and their live uniforms, and reuses compiled variants after arrival', () => {
  const time = { value: 4 };
  const source = new THREE.ShaderMaterial({ uniforms: { time }, vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform float time; void main() { gl_FragColor = vec4(time); }' });
  source.onBeforeCompile = vi.fn();
  const part = new THREE.Mesh(new THREE.SphereGeometry(0.2), source), group = new THREE.Group(); group.add(part);
  const first = createOrbReveal(group), variant = part.material;
  expect(variant.uniforms.time).toBe(time);
  const shader = compile(variant);
  expect(source.onBeforeCompile).toHaveBeenCalledOnce();
  expect(shader.vertexShader).toContain('vDissolvePos =');
  expect(shader.fragmentShader).toContain('discard');
  first.dispose(); first.dispose();
  const next = createOrbReveal(group);
  expect(part.material).toBe(variant);
  next.dispose();
});

it('uses a soft fade without falling motion for reduced motion and restores the original opacity rules', () => {
  const source = new THREE.MeshBasicMaterial(), part = new THREE.Mesh(new THREE.SphereGeometry(0.2), source);
  const group = new THREE.Group(); group.add(part);
  const reveal = createOrbReveal(group, { reducedMotion: true });
  reveal.update(0.5);
  const shader = compile(part.material);
  expect(shader.uniforms.uDissolve.value).toBe(0);
  expect(shader.uniforms.uOrbOpacity.value).toBe(0.5);
  expect(part.material.transparent).toBe(true);
  expect(orbRainLift(0.25, true)).toBe(0);
  reveal.update(1);
  expect(part.material.transparent).toBe(false);
  expect(orbRevealProgress(0)).toBe(0);
  expect(orbRevealProgress(1)).toBe(1);
  expect(orbRainLift(0)).toBeGreaterThan(1);
  expect(orbRainLift(1)).toBe(0);
});
