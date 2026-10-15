// Execute both production core cutout shaders in WebGL, including oblique
// views, bounded corridor ends, inactive rides and the retained distant walls.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
const bundle = await build({ bundle:true, write:false, format:'iife', stdin:{
  resolveDir:fileURLToPath(new URL('../../',import.meta.url)), contents:`
import * as THREE from 'three';
import {makeCorePassage,updateCoreSightline,corePassageGLSL,coreRoomCutoutGLSL} from './src/3d/corePassage.js';
window.checkSightline = () => {
  const gl=new THREE.WebGLRenderer({antialias:false}); gl.setSize(1,1);
  const target=new THREE.WebGLRenderTarget(1,1); gl.setRenderTarget(target);
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(), passage=makeCorePassage();
  const u={...passage.uniforms,point:{value:new THREE.Vector3()}};
  u.uPassageOpen.value=1;
  // Disable route bores so these checks isolate the new sight corridor.
  for(const p of u.uPassagePoints.value) p.set(20,20,20);
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));quad.frustumCulled=false;scene.add(quad);
  const pixel=new Uint8Array(4);let checks=0;
  const check=(point,clear)=>{
    u.point.value.copy(point);gl.render(scene,camera);gl.readRenderTargetPixels(target,0,0,1,1,pixel);
    if((pixel[0]===0)!==clear) throw Error('cutaway mismatch '+point.toArray()+' clear='+clear);
    checks++;
  };
  for(const shader of [corePassageGLSL,coreRoomCutoutGLSL]) {
    quad.material.dispose();quad.material=new THREE.ShaderMaterial({uniforms:u,
      vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:'uniform vec3 point;'+shader+'void main(){gl_FragColor=vec4(vec3(step(0.,portalDistance(point))),1.);}'});
    for(const size of [3,7,15]) for(let i=0;i<24;i++) {
      const angle=i*Math.PI/12;
      const head=new THREE.Vector3(0,.02,0), lens=new THREE.Vector3(Math.cos(angle),.4,Math.sin(angle));
      updateCoreSightline(passage,lens,head,size);
      const direction=head.clone().sub(lens).normalize();
      const side=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize();
      const mid=lens.clone().lerp(head,.6), radius=u.uSightRadius.value;
      check(mid,true);
      check(mid.clone().addScaledVector(side,radius*.8),true);
      check(mid.clone().addScaledVector(side,radius*1.3),false);
      check(head.clone().addScaledVector(direction,radius*1.3),false);
      check(lens.clone().addScaledVector(direction,-radius*1.3),false);
      updateCoreSightline(passage,lens,null,size);check(mid,false);
    }
  }
  quad.geometry.dispose();quad.material.dispose();target.dispose();gl.dispose();return {checks};
};`}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setContent('<title>Core sightline regression</title>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  console.log(JSON.stringify(await page.evaluate(()=>window.checkSightline())));
  if(errors.length)throw Error(errors.join('\n'));
} finally {await browser.close();}
