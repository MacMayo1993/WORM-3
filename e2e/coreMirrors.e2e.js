import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Compare the production probe with its former full-scene render path in real
// WebGL. Small deterministic targets keep this useful on software-GL runners;
// pixel equality and scene visit counts are not device-FPS measurements.
const bundle = await build({ bundle: true, write: false, format: 'iife',
  define: { 'import.meta.env.DEV': 'false' }, stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
import * as THREE from 'three';
import { createCoreMirrorRoom, createCoreMirrorProbe } from './src/3d/coreMirrorRoom.js';
import { makeCorePassage, updateCorePassage } from './src/3d/corePassage.js';
import { addMirrorSubject } from './src/3d/mirrorSubjects.js';
window.checkCoreMirrors = () => {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(64, 64); renderer.setPixelRatio(1);
  const output = new THREE.WebGLRenderTarget(64, 64);
  const source = new THREE.Scene(), parent = new THREE.Group(), worm = new THREE.Group();
  source.background = new THREE.Color('#253349');
  source.fog = new THREE.Fog('#253349', 2, 10);
  parent.position.set(.1, -.05, .08); parent.scale.setScalar(1.8);
  source.add(parent); parent.add(worm);
  const geometry = new THREE.SphereGeometry(.045, 12, 8);
  const material = new THREE.MeshStandardMaterial({ color: '#83e91c', roughness: .55 });
  const bead = new THREE.Mesh(geometry, material);
  bead.position.set(.08, .05, -.04); worm.add(bead);
  const light = new THREE.DirectionalLight('white', 2);
  light.position.set(.4, .6, .2); parent.add(light, light.target);
  source.add(new THREE.AmbientLight('white', .8));
  const hidden = new THREE.Group(), hiddenWorm = new THREE.Mesh(geometry, material);
  hidden.visible = false; hidden.add(hiddenWorm); parent.add(hidden);
  // Exterior objects must never enter the compact reflection render list.
  const exterior = new THREE.Group(); source.add(exterior);
  for (let i = 0; i < 1000; i++) exterior.add(new THREE.Object3D());
  const unregister = [addMirrorSubject(worm), addMirrorSubject(hiddenWorm)];
  const camera = new THREE.PerspectiveCamera(95, 1, .001, 10);
  camera.position.copy(parent.position).add(new THREE.Vector3(0, .04, -.06));
  camera.lookAt(parent.position.clone().add(new THREE.Vector3(0, 0, 1)));
  const render = renderer.render.bind(renderer), results = [];
  try {
    for (const size of [3, 15]) {
      const passage = makeCorePassage();
      updateCorePassage(passage, {
        entry: { x: size - 1, y: size - 1, z: Math.floor(size / 2), dirKey: 'PX' },
        exit: { x: 0, y: 0, z: Math.floor(size / 2), dirKey: 'NX' }
      }, size, 0);
      const room = createCoreMirrorRoom(size, passage.uniforms); parent.add(room.group);
      const run = fullScene => {
        room.uniforms.uMirrorEnv.value = null; room.uniforms.uMirrorLive.value = 0;
        const probe = createCoreMirrorProbe(16), pixels = new Uint8Array(64 * 64 * 4);
        let visits = 0, views = 0;
        renderer.render = (scene, view) => {
          const drawn = fullScene ? source : scene;
          drawn.traverse(() => visits++); views++;
          // The previous capture also reused world transforms between its faces.
          const auto = drawn.matrixWorldAutoUpdate; drawn.matrixWorldAutoUpdate = false;
          try { render(drawn, view); } finally { drawn.matrixWorldAutoUpdate = auto; }
        };
        try {
          for (let i = 0; i < 2; i++) {
            source.updateMatrixWorld(true);
            probe.capture(renderer, source, room);
          }
          renderer.render = render;
          renderer.setRenderTarget(output); render(source, camera);
          renderer.readRenderTargetPixels(output, 0, 0, 64, 64, pixels);
          if (room.group.parent !== parent || worm.parent !== parent) throw Error('Capture reparented live objects');
          return { pixels, visits, views, live: room.uniforms.uMirrorLive.value };
        } finally { renderer.render = render; probe.dispose(); }
      };
      const reference = run(true), optimized = run(false);
      // The bead sits behind/to the side of the forward lens. Removing it must
      // change the reflected room, not merely leave two matching blank images.
      let subjectPixels = null;
      if (size === 3) {
        worm.visible = false;
        const empty = run(false);
        worm.visible = true;
        subjectPixels = optimized.pixels.reduce((count, value, index) => count + (value !== empty.pixels[index] ? 1 : 0), 0);
      }
      let differences = 0, brightness = 0;
      for (let i = 0; i < reference.pixels.length; i++) {
        if (reference.pixels[i] !== optimized.pixels[i]) differences++;
        if (i % 4 !== 3) brightness += optimized.pixels[i];
      }
      results.push({ size, differences, brightness, subjectPixels, referenceVisits: reference.visits,
        captureVisits: optimized.visits, views: optimized.views, live: optimized.live,
        error: renderer.getContext().getError() });
      parent.remove(room.group); room.dispose();
    }
    return results;
  } finally {
    renderer.render = render; unregister.forEach(remove => remove());
    geometry.dispose(); material.dispose(); output.dispose(); renderer.dispose();
  }
};` }
});

async function verifyMirrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent('<title>Anticube mirror capture regression</title>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(() => window.checkCoreMirrors());
  expect(errors).toEqual([]);
  for (const result of results) {
    expect(result.error).toBe(0);
    expect(result.live).toBe(1);
    expect(result.views).toBe(12);
    expect(result.brightness).toBeGreaterThan(100000);
    expect(result.differences, JSON.stringify(result)).toBe(0);
    if (result.size === 3) expect(result.subjectPixels).toBeGreaterThan(0);
    expect(result.captureVisits).toBeLessThan(result.referenceVisits / 20);
  }
}

test('anticube reflections match the full scene without exterior traversal', async ({ page }) => verifyMirrors(page));
test('anticube reflections match the full scene without exterior traversal @phone', async ({ page }) => verifyMirrors(page));
