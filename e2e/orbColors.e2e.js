import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Compile the shipped material in real WebGL, with an old-behavior comparison.
// The last bead in each row is uncollected skin and must keep its native glow.
const bundle = await build({ bundle: true, write: false, format: 'iife', stdin: {
  resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
import * as THREE from 'three';
import { createWormSkinMaterial, applySkinMaterialProfile, applyBioluminescence } from './src/worm/wormSkinMaterial.js';
import { createCharacterGeometry, applyCharacterFinish } from './src/worm/wormCharacterVisuals.js';
import { getSkinFX } from './src/worm/wormSkinFX.js';
window.verifyOrbColors = mobile => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  const width = mobile ? 360 : 900, height = mobile ? 220 : 420;
  renderer.setSize(width, height); document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#101922');
  const camera = new THREE.OrthographicCamera(-4.5, 4.5, 2.1, -2.1, .1, 100);
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
  const colors = ['#ff4040', '#ff8c00', '#28b8ff', '#54de70', '#b5aaff', '#ffe058', '#ff4040'];
  for (const [row, carriedOrbColors] of [false, true].entries()) {
    const geometry = createCharacterGeometry('glow');
    geometry.setAttribute('wormOrbAccent', new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1, 1, 1, 1, 0]), 1));
    const material = createWormSkinMaterial({ carriedOrbColors });
    applySkinMaterialProfile(material, getSkinFX('slime'));
    applyBioluminescence(material, '#54ff96', true); applyCharacterFinish(material, 'glow');
    const mesh = new THREE.InstancedMesh(geometry, material, 7);
    const pose = new THREE.Object3D();
    colors.forEach((color, i) => {
      pose.position.set(-3.6 + i * 1.2, row === 0 ? .9 : -.9, 0);
      pose.scale.setScalar(.46); pose.updateMatrix();
      mesh.setMatrixAt(i, pose.matrix); mesh.setColorAt(i, new THREE.Color(color));
    });
    scene.add(mesh);
  }
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const samples = y => colors.map((_, i) => {
    const point = new THREE.Vector3(-3.6 + i * 1.2, y, 0).project(camera);
    const p = new Uint8Array(4); gl.readPixels(Math.round((point.x + 1) * width / 2), Math.round((point.y + 1) * height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return [...p].slice(0, 3);
  });
  const before = samples(.9), after = samples(-.9);
  return { before, after, drawCalls: renderer.info.render.calls, error: gl.getError() };
};` } });

async function verify(page, info, mobile) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/orb-colors-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<meta name="viewport" content="width=device-width, initial-scale=1"><style>body { margin: 0; background: #101922; color: #eee; font: 15px sans-serif; } p { margin: 12px; } canvas { display: block; }</style><p>Glow Worm: before (top), fixed (bottom).<br>Six carried colors; native skin at the right.</p>' }));
  await page.goto('/orb-colors-fixture');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(mobile => window.verifyOrbColors(mobile), mobile);
  const screenshot = info.outputPath('glow-orb-colors.png');
  await page.screenshot({ path: screenshot });
  await info.attach('Glow Worm carried colors before and after', { path: screenshot, contentType: 'image/png' });
  console.log('Glow orb colors', JSON.stringify({ mobile, ...result }));
  const { before, after } = result;
  expect(before[0][1]).toBeGreaterThan(before[0][0]);
  expect(after[0][0]).toBeGreaterThan(after[0][1] + 80);
  expect(after[2][2]).toBeGreaterThan(after[2][0] + 80);
  expect(after[5][0]).toBeGreaterThan(after[5][2] + 80);
  expect(after[6]).toEqual(before[6]);
  expect(result.drawCalls).toBe(2);
  expect(result.error).toBe(0);
  expect(errors).toEqual([]);
}

test('Glow Worm preserves carried hues without repainting its native glow', async ({ page }, info) => verify(page, info, false));
test('Glow Worm preserves carried hues without repainting its native glow @phone', async ({ page }, info) => verify(page, info, true));
