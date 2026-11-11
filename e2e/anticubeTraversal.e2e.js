import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

// The approach was missing from the isolated mirror fixture: render the actual
// chrome shell, patterned track, rails, curls and outer walls on the ride camera.
const bundle = await build({ bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': JSON.stringify({DEV:false,PROD:true,BASE_URL:'/WORM-3/'}) }, stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
import React from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import VoidCore from './src/3d/VoidCore.jsx';
import MobiusTunnel from './src/manifold/MobiusTunnel.jsx';
import { TunnelInteriorView } from './src/worm/healerWorm/TunnelInteriorView.jsx';
import { useGameStore } from './src/hooks/useGameStore.js';
import { makeCubies } from './src/game/cubeState.js';
import { tunnelState } from './src/worm/tunnelProgressBridge.js';
import { makeTunnelCamPose, tunnelCamPoseInto } from './src/worm/tunnelCameraRails.js';
import { frameRide } from './src/worm/rideFraming.js';
import { getTunnelWorldPosSmoothInto, buildTunnelPathForTunnel } from './src/worm/wormLogic.js';
import { makeTunnelPath } from './src/utils/tunnelPath.js';
import { tunnelCoreClipUniforms } from './src/manifold/tunnelCoreClip.js';
import { tunnelCameraClearanceGLSL, tunnelCameraUniforms, syncTunnelCamera } from './src/manifold/tunnelCameraClearance.js';
import { makeCautionOpeningUniforms } from './src/worm/healerWorm/cautionOpening.js';
import { WORM_PAD_HEIGHT } from './src/game/raisedCubie.js';
extend(THREE);
window.verifySightClearance = () => {
  const renderer=new THREE.WebGLRenderer({antialias:false}); renderer.setSize(64,64);
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(60,1,.01,10);
  camera.position.set(0,0,2); camera.lookAt(0,0,0); camera.updateMatrixWorld(true);
  const head=new THREE.Vector3(0,0,.8);
  syncTunnelCamera(camera,head,.4);
  tunnelCoreClipUniforms.uTunnelCoreHalf.value=0;
  const uniforms={...tunnelCameraUniforms,...tunnelCoreClipUniforms,...makeCautionOpeningUniforms(),uCameraClearance:{value:1}};
  const geometry=new THREE.PlaneGeometry(1,1);
  const material=new THREE.ShaderMaterial({uniforms,
    vertexShader:'varying vec3 worldPoint; void main(){vec4 p=modelMatrix*vec4(position,1.0);worldPoint=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader:'varying vec3 worldPoint;'+tunnelCameraClearanceGLSL+'void main(){clearTunnelCamera(worldPoint);gl_FragColor=vec4(0.0,0.0,0.0,1.0);}' });
  const strip=new THREE.Mesh(geometry,material);strip.position.z=1.25;scene.add(strip);
  const target=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x00ff00}));target.position.z=.8;scene.add(target);
  const gl=renderer.getContext(), p=new Uint8Array(4);
  const pixel=(x=32,y=32)=>{renderer.render(scene,camera);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);};
  const clear=pixel(), retainedEdge=pixel(6,32);
  tunnelCameraUniforms.uTunnelSightEnd.value.copy(camera.position);
  const oldOcclusion=pixel();
  syncTunnelCamera(camera,head,.4);uniforms.uCameraClearance.value=0;
  const idle=pixel();uniforms.uCameraClearance.value=1;
  strip.position.z=.5;target.visible=false;scene.background=new THREE.Color(0x00ff00);
  const beyondHead=pixel();
  const error=gl.getError();geometry.dispose();material.dispose();target.material.dispose();renderer.dispose();
  return {clear,retainedEdge,oldOcclusion,idle,beyondHead,error};
};
window.startTraversal = async ({ mobile, route = 'corner', size = 9 }) => {
  const width = mobile ? 200 : 320, height = mobile ? 320 : 220;
  const m = Math.floor(size / 2), n = size - 1;
  const entry = route === 'straight' ? { x:m,y:m,z:n,dirKey:'PZ' } : { x:0,y:n,z:0,dirKey:'PY' };
  const exit = route === 'straight' ? { x:m,y:m,z:0,dirKey:'NZ' } : route === 'return'
    ? { x:n,y:n,z:n,dirKey:'PY' } : { x:n,y:0,z:n,dirKey:'PZ' };
  const tunnel = { entry, exit, pairId:'fixture-ride', entryColor:5, exitColor:6, padHeight:WORM_PAD_HEIGHT, padExpansion:0 };
  const index = c => (c.x * size + c.y) * size + c.z;
  const refs = [];
  for (const c of [entry,exit]) { const mesh = new THREE.Group(); mesh.position.set(c.x,c.y,c.z).addScalar(-(size-1)/2); refs[index(c)] = mesh; }
  const state = useGameStore.getState();
  useGameStore.setState({ size, cubies:makeCubies(size), wormHealerMode:true, wormAlive:true, wormPaused:false,
    wormPhase:'tunnel', wormGamePhase:'playing', wormStoryLevel:null, perfReducedFX:false,
    visualMode:'classic', wormViewPower:null, explosionT:0, animState:null, moveHistory:[], flipPulse:null,
    settings:{ ...state.settings, colorScheme:'gemstone', reducedMotion:false, reduceFlashing:false,
      biomeMode:{enabled:false}, manifoldStyles:Object.fromEntries([1,2,3,4,5,6].map(i=>[i,'apollonian'])) } });
  Object.assign(tunnelState,{ active:true, activeTunnelId:tunnel.pairId, tunnel, portalTunnel:tunnel,
    occupiedTunnelIds:new Set(), coreZoom:1, t:.3, lensT:.2 });
  const worm = { phase:{current:'tunnel'}, activeTunnel:{current:tunnel}, tunnelPassages:{current:[]} };
  const canvas=document.createElement('canvas'); document.body.replaceChildren(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  const root=createRoot(canvas);
  const store=root.configure({gl:renderer,size:{width,height},dpr:1,frameloop:'never',
    camera:{fov:70,near:.002,far:100,position:[0,0,8]} }).render(React.createElement(React.Fragment,null,
    React.createElement(VoidCore,{cubieRefs:refs}),
    React.createElement('group',{name:'ridden-band'},React.createElement(MobiusTunnel,{meshIdx1:index(entry),meshIdx2:index(exit),
      dirKey1:entry.dirKey,dirKey2:exit.dirKey,cubieRefs:refs,tunnelId:tunnel.pairId,flips:1,
      color1:'#f5b81c',color2:'#a04de6',style1:'apollonian',style2:'apollonian'})),
    React.createElement(TunnelInteriorView,{worm,size}),
    React.createElement('ambientLight',{intensity:.7}),
    React.createElement('directionalLight',{position:[3,4,5],intensity:2.2})
  ));
  await new Promise(resolve=>setTimeout(resolve,60));
  for(let i=0;!store.getState().scene.getObjectByName('ridden-band')&&i<50;i++) await new Promise(resolve=>setTimeout(resolve,20));
  const {scene,camera}=store.getState();
  const environment=new RoomEnvironment(), pmrem=new THREE.PMREMGenerator(renderer), env=pmrem.fromScene(environment);
  scene.environment=env.texture;
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.07,16,12),new THREE.MeshBasicMaterial({color:'#50ff70'})); scene.add(marker);
  const pose=makeTunnelCamPose(), head=new THREE.Vector3(); let time=0;
  const band=scene.getObjectByName('ridden-band');
  const take = () => { renderer.setRenderTarget(null); renderer.render(scene,camera); return canvas.toDataURL('image/png').split(',')[1]; };
  window.traversalFrame = (t, label) => {
    getTunnelWorldPosSmoothInto(head,tunnel,t,size); marker.position.copy(head);
    tunnelState.rideHead=head;
    for(let i=0;i<2;i++) {
      tunnelCamPoseInto(pose,tunnel,t,size,tunnelState.coreZoom);
      frameRide(camera,pose,head,1);
      Object.assign(tunnelState,{t,lensT:pose.lensT,lensLift:pose.lift});
      store.getState().advance(time+=1/30);
    }
    const pixels=new Uint8Array(width*height*4), gl=renderer.getContext();
    const image=take();
    gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let white=0; for(let i=0;i<pixels.length;i+=4) if(pixels[i]>245&&pixels[i+1]>245&&pixels[i+2]>245)white++;
    // Separate the occupied band's geometry from the chrome/mirror shell.
    band.visible=false; const withoutBand=take(); band.visible=true;
    const path=buildTunnelPathForTunnel(makeTunnelPath(),tunnel,size);
    const shell=tunnelCoreClipUniforms;
    const meshes=[]; band.traverse(o=>{if(o.isMesh&&o.visible&&o.name.startsWith('tunnel-styled'))meshes.push(o);});
    let exposedCrossing=0;
    for(const mesh of meshes.slice(0,1)) {
      const g=mesh.geometry, p=g.attributes.position, uv=g.attributes.uv, idx=g.index;
      const lo=path.armALen/path.total, hi=1-path.armBLen/path.total;
      const point=new THREE.Vector3();
      for(let i=0;i<idx.count;i+=3) {
        const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
        if(!ids.every(v=>uv.getY(v)>=lo-1e-6&&uv.getY(v)<=hi+1e-6))continue;
        for(const v of ids){point.fromBufferAttribute(p,v).sub(shell.uTunnelCoreCenter.value);
          if(Math.max(...point.toArray().map(Math.abs))>shell.uTunnelCoreHalf.value)exposedCrossing++;}
      }
    }
    return {label,image,withoutBand,t,lensT:pose.lensT,zoom:tunnelState.coreZoom,exposedCrossing,
      whiteFraction:white/(width*height),error:gl.getError()};
  };
  window.stopTraversal = async () => { root.unmount(); await new Promise(resolve=>setTimeout(resolve,20)); env.dispose();pmrem.dispose();environment.dispose();marker.geometry.dispose();marker.material.dispose();renderer.dispose(); };
};` }
});

async function verify(page, info, mobile) {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('http://127.0.0.1:4173/anticube-fixture', route => route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#05080e}canvas{display:block}</style>'}));
  await page.goto('http://127.0.0.1:4173/anticube-fixture');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  expect(errors).toEqual([]);
  const sight=await page.evaluate(()=>window.verifySightClearance());
  expect(sight.clear).toEqual([0,255,0,255]);
  for(const key of ['retainedEdge','oldOcclusion','idle','beyondHead']) expect(sight[key],key).toEqual([0,0,0,255]);
  expect(sight.error).toBe(0);
  for(const route of ['corner','return','straight']) {
    await page.evaluate(options=>window.startTraversal(options),{mobile,route,size:9});
    expect(errors).toEqual([]);
    for(const t of (route === 'corner' ? [.39,.50,.72] : route === 'return' ? [.31,.50,.72] : [.39,.50,.72])) {
      const result=await page.evaluate(t=>window.traversalFrame(t),t);
      const {image,withoutBand,...stats}=result;
      console.log('Traversal',JSON.stringify({mobile,route,...stats}));
      const name=route+'-'+Math.round(t*100);
      await writeFile(info.outputPath(name+'.png'),Buffer.from(image,'base64'));
      await writeFile(info.outputPath(name+'-no-band.png'),Buffer.from(withoutBand,'base64'));
      expect(result.error).toBe(0);
      expect(errors).toEqual([]);
    }
    await page.evaluate(()=>window.stopTraversal());
  }
}
test('patterned traversal approaches and crosses the anticube without render artifacts',async({page},info)=>verify(page,info,false));
test('patterned traversal approaches and crosses the anticube without render artifacts @phone',async({page},info)=>verify(page,info,true));
