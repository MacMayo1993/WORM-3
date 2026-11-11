import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Actual production shaders in WebGL, with bounded reflection captures. This is
// a rendering regression, not a hardware/mobile frame-rate claim.
const bundle = await build({ bundle: true, write: false, format: 'iife',
  define: { 'import.meta.env.DEV': 'false' }, stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
import * as THREE from 'three';
import { createCoreMirrorRoom, createCoreMirrorProbe } from './src/3d/coreMirrorRoom.js';
import { makeCorePassage, updateCorePassage } from './src/3d/corePassage.js';
import { createCorePortalRims } from './src/3d/corePortalRims.js';
import { updateCoreChamberLight } from './src/3d/coreChamberLight.js';
import { addMirrorSubject } from './src/3d/mirrorSubjects.js';
window.checkPrismaticChamber = ({ mobile = false, size = 3 } = {}) => {
  const width = mobile ? 300 : 480, height = mobile ? 400 : 320;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height); renderer.setPixelRatio(1);
  document.body.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene(), passage = makeCorePassage();
  const room = createCoreMirrorRoom(size, passage.uniforms);
  const probe = createCoreMirrorProbe(mobile ? 32 : 64);
  const rims = createCorePortalRims(passage.uniforms, room.lighting);
  scene.add(room.group, rims.group);
  const unregisterRims = addMirrorSubject(rims.layers[1].mesh);
  const worm = new THREE.Group(); scene.add(worm);
  const geometry = new THREE.SphereGeometry(.022, 16, 12);
  const material = new THREE.MeshBasicMaterial({ color: '#79d145' });
  for (let i = 0; i < 4; i++) {
    const bead = new THREE.Mesh(geometry, material);
    bead.position.set(Math.sin(i * .3) * .01, -.055, .04 - i * .035);
    bead.scale.setScalar(i ? .76 : 1);
    worm.add(bead);
  }
  const eyeGeometry = new THREE.SphereGeometry(.005, 12, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#18231c' });
  for (const x of [-.009, .009]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial); eye.position.set(x, -.044, .058); worm.add(eye);
  }
  const unregister = addMirrorSubject(worm);
  const camera = new THREE.PerspectiveCamera(100, width / height, .001, 10);
  camera.position.set(.015, .012, .135); camera.lookAt(.006, -.015, -.09);
  const middle = Math.floor(size / 2);
  const tunnel = { entry: { x: middle, y: middle, z: size - 1, dirKey: 'PZ' },
    exit: { x: middle, y: middle, z: 0, dirKey: 'NZ' }, entryColor: 1, exitColor: 2 };
  const palette = { 1: '#26b9ff', 2: '#ff7551' };
  updateCorePassage(passage, tunnel, size, 0);
  rims.update(passage, size, 1); room.updateLayout(passage, 1);
  const faces = mobile ? 2 : 3;
  const update = (t, options) => updateCoreChamberLight(room.lighting, tunnel, size, palette, t, { ...options, passageEnds: room.passageEnds });
  const take = (refresh = true) => {
    scene.updateMatrixWorld(true);
    if (refresh) for (let i = 0; i < 18 / faces; i++) probe.capture(renderer, scene, room, { faces });
    renderer.setRenderTarget(null); renderer.render(scene, camera);
    const pixels = new Uint8Array(width * height * 4);
    renderer.getContext().readPixels(0, 0, width, height, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, pixels);
    return pixels;
  };
  const diff = (a, b) => a.reduce((total, v, i) => total + (i % 4 !== 3 && Math.abs(v - b[i]) > 2 ? 1 : 0), 0);
  try {
    const images = {};
    const save = name => { images[name] = renderer.domElement.toDataURL('image/png').split(',')[1]; };
    update(.42); const entry = take(); save('entry');
    update(.5); const centre = take(); save('centre');
    update(.58); const exit = take(); save('exit');
    // Hold the reflection snapshot to isolate direct shader motion. Existing
    // infinity reflections can still settle on subsequent production captures.
    update(.5, { reducedMotion: true }); const calm = take();
    update(.56, { reducedMotion: true }); const calmLater = take(false);
    update(.45, { reduceFlashing: true }); const flashCalm = take();
    update(.55, { reduceFlashing: true }); const flashCalmLater = take(false);
    update(.48); const beforePause = take();
    update(.57, { paused: true }); const paused = take(false);
    update(.5); const direct = take();
    room.uniforms.uChamberLevel.value = 0; const unlit = take(false);
    // The center subject should remain distinguishable, not a white flare.
    const whiteFraction = pixels => {
      let white = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 245 && pixels[i + 1] > 245 && pixels[i + 2] > 245) white++;
      return white / (width * height);
    };
    // Keep peak light through repeated complete capture cycles too: a single
    // frame can look restrained while additive infinity reflections wash out.
    update(.5);
    for (let i = 0; i < 8; i++) take();
    const settled = take(); save('settled');
    return { images, entryToCentre: diff(entry, centre), centreToExit: diff(centre, exit),
      staticReducedMotion: diff(calm, calmLater), staticReducedFlashing: diff(flashCalm, flashCalmLater), staticPaused: diff(beforePause, paused),
      visibleLight: diff(direct, unlit), whiteFraction: whiteFraction(centre), settledWhiteFraction: whiteFraction(settled),
      error: renderer.getContext().getError(), programs: renderer.info.programs.length,
      meshes: room.group.children.length, rimPools: rims.group.children.length, rimCount: rims.layers[1].mesh.count };
  } finally {
    unregister(); unregisterRims(); rims.dispose(); room.dispose(); probe.dispose(); geometry.dispose(); material.dispose();
    eyeGeometry.dispose(); eyeMaterial.dispose(); renderer.dispose();
  }
};` }
});

async function verify(page, info, mobile) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><title>Prismatic mirror chamber</title><style>body { margin: 0; background: #05080e; } canvas { width: 100vw !important; height: 100vh !important; object-fit: contain; }</style>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const size of [3, 15]) {
    const result = await page.evaluate(options => window.checkPrismaticChamber(options), { mobile, size });
    const { images } = result; delete result.images;
    for (const [phase, png] of Object.entries(images))
      await info.attach('prismatic-chamber-' + size + '-' + phase + '.png', { body: Buffer.from(png, 'base64'), contentType: 'image/png' });
    await info.attach('prismatic-chamber-' + size + '.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    console.log('Mirror readability', JSON.stringify({ mobile, size, ...result }));
    expect(errors).toEqual([]);
    expect(result.error).toBe(0);
    expect(result.entryToCentre, JSON.stringify(result)).toBeGreaterThan(100);
    expect(result.centreToExit).toBeGreaterThan(100);
    expect(result.visibleLight).toBeGreaterThan(100);
    expect(result.staticReducedMotion).toBe(0);
    expect(result.staticPaused).toBe(0);
    expect(result.staticReducedFlashing).toBe(0);
    expect(result.whiteFraction).toBeLessThan(.08);
    expect(result.settledWhiteFraction).toBeLessThan(.08);
    expect(result.meshes).toBe(2);
    expect(result.rimPools).toBe(2);
    expect(result.rimCount).toBe(2);
    expect(result.programs).toBeLessThanOrEqual(7);
    await page.screenshot({ path: info.outputPath('prismatic-chamber-' + size + '.png') });
  }
}

test('prismatic chamber stays readable and light ribbons freeze on pause', async ({ page }, info) => verify(page, info, false));
test('prismatic chamber stays readable and light ribbons freeze on pause @phone', async ({ page }, info) => verify(page, info, true));
