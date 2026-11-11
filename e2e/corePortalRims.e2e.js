import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Exercise the actual materials in WebGL: geometry-only checks cannot detect a
// broken instancing shader, a capped sleeve, or a rim hiding the aperture.
let source;
test.beforeAll(async () => {
  const bundle = await build({ bundle: true, write: false, format: 'iife', define: { 'import.meta.env.DEV': 'false' }, stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
import * as THREE from 'three';
import { makeCorePassage, updateCorePassage, coreOpeningRadius, CORE_MIRROR_HALF } from './src/3d/corePassage.js';
import { createCoreMirrorRoom } from './src/3d/coreMirrorRoom.js';
import { createCorePortalRims } from './src/3d/corePortalRims.js';
import { makeInteriorPortals, syncInteriorPortals } from './src/worm/healerWorm/interiorPortals.js';
window.renderPortalRims = () => {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(512, 512); document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#d000a0');
  const passage = makeCorePassage(), zoom = 1.5, size = 3;
  updateCorePassage(passage, {entry:{x:1,y:2,z:1,dirKey:'PY'},exit:{x:0,y:1,z:1,dirKey:'NX'}}, size, 0);
  passage.uniforms.uCoreRoomCenter.value.copy(passage.path.midA).multiplyScalar(1-zoom);
  passage.uniforms.uPassageRadius.value=coreOpeningRadius(size,zoom);
  const room=createCoreMirrorRoom(size,passage.uniforms), rims=createCorePortalRims(passage.uniforms);
  room.updateLayout(passage,zoom); room.group.position.copy(passage.uniforms.uCoreRoomCenter.value); room.group.scale.setScalar(zoom);
  rims.update(passage,size,zoom); scene.add(room.group,rims.group);
  const point=room.passageEnds.exit.clone().multiplyScalar(zoom).add(room.group.position);
  const span=CORE_MIRROR_HALF*zoom*2.5;
  const camera=new THREE.OrthographicCamera(-span/2,span/2,span/2,-span/2,.001,10);
  camera.position.copy(point).add(new THREE.Vector3(CORE_MIRROR_HALF*zoom,0,0)); camera.lookAt(point);
  renderer.render(scene,camera);
  const gl=renderer.getContext(), pixels=new Uint8Array(512*512*4);
  gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const pixel=(x,y)=>Array.from(pixels.slice((y*512+x)*4,(y*512+x)*4+3));
  const radius=passage.uniforms.uPassageRadius.value/span*512;
  const result={center:pixel(256,256),inner:pixel(256+Math.round(radius*.7),256),rim:pixel(256+Math.round(radius*1.045),256),wall:pixel(256+Math.round(radius*1.3),256),calls:renderer.info.render.calls,error:gl.getError()};
  // Also link/draw the redesigned pooled inner mouths, then restore the core
  // view for the optional screenshot retained with this test.
  const portals=makeInteriorPortals(); syncInteriorPortals(portals,{entry:{x:1,y:1,z:0,dirKey:'NZ'},exit:{x:1,y:1,z:2,dirKey:'PZ'}},3,0);
  const outer=new THREE.Scene();outer.background=new THREE.Color('#d000a0');outer.add(portals.group);camera.position.set(0,0,0);camera.lookAt(0,0,-1);renderer.render(outer,camera);
  gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const mouthRadius=.325/span*512;
  result.mouthCenter=pixel(256,256);result.mouthInner=pixel(256+Math.round(mouthRadius*.7),256);
  result.mouthRim=pixel(256+Math.round(mouthRadius*1.06),256);
  result.mouthError=gl.getError();portals.dispose();
  camera.position.copy(point).add(new THREE.Vector3(CORE_MIRROR_HALF*zoom,0,0));camera.lookAt(point);renderer.render(scene,camera);
  return result;
};` } });
  source = bundle.outputFiles[0].text;
});

test('adaptive mirror opening and its concentric rim render with a genuinely empty centre', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent('<title>Centred portal material regression</title>');
  await page.addScriptTag({ content: source });
  const result = await page.evaluate(() => window.renderPortalRims());
  expect(errors).toEqual([]);
  expect(result.error).toBe(0); expect(result.mouthError).toBe(0);
  expect(result.center).toEqual([208, 0, 160]);
  expect(result.inner).toEqual(result.center);
  expect(result.rim).not.toEqual(result.center);
  expect(result.wall).not.toEqual(result.center);
  expect(result.mouthCenter).toEqual(result.center);
  expect(result.mouthInner).toEqual(result.center);
  expect(result.mouthRim).not.toEqual(result.center);
  expect(result.calls).toBeLessThanOrEqual(4);
  await testInfo.attach('centred-bent-exit', { body: await page.screenshot(), contentType: 'image/png' });
});
