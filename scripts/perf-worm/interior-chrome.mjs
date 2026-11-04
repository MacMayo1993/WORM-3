// Render the production interior batches in real WebGL with an offline studio
// environment. This tests shader linking, instance tints and portal clipping,
// not phone frame rates. CHROMIUM=/path/to/chrome node .../interior-chrome.mjs
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
const bundle = await build({ bundle: true, write: false, format: 'iife', define: { 'import.meta.env.DEV': 'false' }, stdin: {
  resolveDir: fileURLToPath(new URL('../../', import.meta.url)), contents: `
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeInteriorTileBatches, INTERIOR_TILE_INSET } from './src/worm/healerWorm/interiorTileBatches.js';
import { makeInteriorPortals, syncInteriorPortals } from './src/worm/healerWorm/interiorPortals.js';
import { makeCubies } from './src/game/cubeState.js';
import { getStickerWorldPos } from './src/game/coordinates.js';
window.renderInterior = () => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(800, 600); document.body.style.margin = 0; document.body.appendChild(renderer.domElement);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room); scene.environment = env.texture; scene.background = new THREE.Color('#05060c');
  const camera = new THREE.PerspectiveCamera(85, 800 / 600, .01, 100);
  camera.position.set(.05, -.1, .45); camera.lookAt(1, .35, -1.5);
  const portals = makeInteriorPortals(), batches = makeInteriorTileBatches(portals.uniforms), cubies = makeCubies(3), layout = [];
  const rotations = { PZ: [0,Math.PI,0], NZ: [0,0,0], PX: [0,-Math.PI/2,0], NX: [0,Math.PI/2,0], PY: [Math.PI/2,0,0], NY: [-Math.PI/2,0,0] };
  for (let sx=0;sx<3;sx++) for(let sy=0;sy<3;sy++) for(let sz=0;sz<3;sz++) {
    for(const dirKey of Object.keys(cubies[sx][sy][sz].stickers)) {
      const position = getStickerWorldPos(sx,sy,sz,dirKey,3,0), [rx,ry,rz] = rotations[dirKey];
      position[{X:0,Y:1,Z:2}[dirKey[1]]] -= (dirKey[0]==='P'?1:-1)*INTERIOR_TILE_INSET;
      const [px,py,pz] = position;
      layout.push({sx,sy,sz,dirKey,px,py,pz,rx,ry,rz});
    }
  }
  batches.sync(layout,cubies,{},9999); scene.add(batches.group);
  renderer.render(scene,camera);
  const calls = renderer.info.render.calls, pixels = new Uint8Array(800*600*4), gl = renderer.getContext();
  gl.readPixels(0,0,800,600,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let bright=0, dark=0;
  for(let i=0;i<pixels.length;i+=4) { const max=Math.max(pixels[i],pixels[i+1],pixels[i+2]); if(max>140)bright++; if(max<45)dark++; }
  if(calls!==1 || bright<1000 || dark<1000)throw Error('Interior chrome did not render its highlights and seams: '+JSON.stringify({calls,bright,dark}));
  const pose = camera.position.clone(), rotation = camera.quaternion.clone();
  camera.position.set(0,0,0); camera.lookAt(0,0,-1);
  const pixel = () => { renderer.render(scene,camera); const p=new Uint8Array(4); gl.readPixels(400,300,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p); return Array.from(p).join(','); };
  batches.group.visible=false; const background=pixel(); batches.group.visible=true; const closed=pixel();
  syncInteriorPortals(portals,{entry:{x:1,y:1,z:0,dirKey:'NZ'},exit:{x:1,y:1,z:2,dirKey:'PZ'}},3,0);
  const opened=pixel();
  if(opened!==background || closed===background)throw Error('Chrome portal did not open: '+JSON.stringify({background,closed,opened}));
  syncInteriorPortals(portals,null,3,0); camera.position.copy(pose); camera.quaternion.copy(rotation); renderer.render(scene,camera);
  if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL error');
  return {calls,tiles:batches.group.children[0].count,bright,dark,portal:true};
};` } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setContent('<title>Chrome interior regression</title>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  console.log(JSON.stringify(await page.evaluate(() => window.renderInterior())));
  if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT });
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
