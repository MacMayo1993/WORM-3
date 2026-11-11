import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Exercise the real cutouts on black plastic: an open centre, a white lit edge,
// and no change to the rest of the tile. Both sides of the wall use these shaders.
const bundle = await build({ bundle: true, write: false, format: 'iife',
  define: { 'import.meta.env.DEV': 'false' }, stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
import * as THREE from 'three';
import { createExteriorPortals } from './src/3d/exteriorPortals.js';
import { withPortalCutout } from './src/3d/portalCutout.js';
import { makeInteriorPortals, syncInteriorPortals, interiorPortalGLSL } from './src/worm/healerWorm/interiorPortals.js';
window.checkMouth = (inside, exit, size) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(320, 320); renderer.setPixelRatio(1);
  document.body.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#36784b');
  const middle = Math.floor(size / 2);
  const tunnel = { entry: { x: middle, y: middle, z: size - 1, dirKey: 'PZ' },
    exit: { x: middle, y: middle, z: 0, dirKey: 'NZ' } };
  const outer = createExteriorPortals(), inner = makeInteriorPortals();
  outer.update(tunnel, size, 0); syncInteriorPortals(inner, tunnel, size, 0);
  const side = exit ? 1 : 0, normal = inner.normals[side];
  const center = inside ? inner.centers[side] : outer.uniforms.uExteriorPoints.value[side * 9];
  const material = new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.DoubleSide });
  if (inside) withPortalCutout(material, inner.uniforms, interiorPortalGLSL, 'interior', 'pearl');
  else outer.materialFor(material);
  const geometry = new THREE.PlaneGeometry(1.2, 1.2), wall = new THREE.Mesh(geometry, material);
  wall.position.copy(center); wall.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  scene.add(wall);
  const camera = new THREE.OrthographicCamera(-.6, .6, .6, -.6, .001, 4);
  camera.position.copy(center).addScaledVector(normal, inside ? -1 : 1); camera.lookAt(center);
  const pixel = new Uint8Array(4), gl = renderer.getContext();
  const sample = radius => {
    gl.readPixels(Math.round(160 + radius / 1.2 * 320), 160, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return [...pixel];
  };
  try {
    renderer.render(scene, camera);
    const result = { centre: sample(0), lip: sample(.34), tile: sample(.55), error: gl.getError() };
    if (inside) {
      scene.add(inner.group);
      for (const mouth of inner.mouths) mouth.material.uniforms.uColor.value.set('#71baff');
      renderer.render(scene, camera);
      result.sleeve = sample(.345);
    }
    return result;
  } finally { outer.dispose(); inner.dispose(); material.dispose(); geometry.dispose(); renderer.dispose(); }
};` }
});

async function verify(page, info) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent('<title>Pearl wormhole mouths</title><style>body{margin:0;background:#05080e}canvas{width:100vw!important;height:100vh!important;object-fit:contain}</style>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const size of [3, 15]) for (const inside of [false, true]) for (const exit of [false, true]) {
    const result = await page.evaluate(({ inside, exit, size }) => window.checkMouth(inside, exit, size), { inside, exit, size });
    console.log('Mouth readability', JSON.stringify({ inside, exit, size, ...result }));
    expect(errors).toEqual([]);
    expect(result.error).toBe(0);
    // The centre still sees the green room beyond, rather than a black/white cap.
    expect(result.centre[1]).toBeGreaterThan(result.centre[0] * 1.5);
    expect(Math.min(...result.lip.slice(0, 3))).toBeGreaterThan(200);
    expect(Math.max(...result.tile.slice(0, 3))).toBeLessThan(10);
    if (inside) expect(Math.min(...result.sleeve.slice(0, 3))).toBeGreaterThan(180);
    await page.screenshot({ path: info.outputPath('mouth-' + size + '-' + inside + '-' + exit + '.png') });
  }
}

test('wormhole entry and exit keep an open centre and white sleeve', async ({ page }, info) => verify(page, info));
test('wormhole entry and exit keep an open centre and white sleeve @phone', async ({ page }, info) => verify(page, info));
