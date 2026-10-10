import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import TurnGuide from '../teach/TurnGuide.jsx';
import { buildTurnGuideGeometry, turnGuidePoint } from '../teach/turnGuideGeometry.js';
import { getSliceRimGeometry } from '../teach/layerGlow.js';
import { prefersReducedMotion } from '../utils/device.js';
vi.mock('../utils/device.js',async original => ({ ...(await original()),prefersReducedMotion:vi.fn(()=>false) }));
extend(THREE);
it.each([2,3,7,15])('clears the cube on all axes at size %i with a fixed geometry budget', size => {
  for(const reduced of [false,true]) for(const axis of ['col','row','depth']) {
    const g=buildTurnGuideGeometry(size,axis,0,reduced), p=g.attributes.position;
    expect(p.count).toBeLessThanOrEqual(reduced?116:212);
    expect(g.index.count/3).toBeLessThanOrEqual(reduced?112:208);
    const axial=axis==='col'?0:axis==='row'?1:2;
    for(let i=0;i<p.count;i++) {
      const point=new THREE.Vector3().fromBufferAttribute(p,i).toArray();
      expect(Math.abs(point[axial]+(size-1)/2)).toBeLessThanOrEqual(.211);
      expect(Math.max(...point.filter((_,j)=>j!==axial).map(Math.abs))).toBeGreaterThan(size/2+.05);
      expect(Number.isFinite(g.attributes.uv.getX(i))).toBe(true);
    }
    g.dispose();
  }
});
it.each(['col','row','depth'])('increasing path phase matches a positive %s layer rotation',axis=>{
  const axisV=new THREE.Vector3(...(axis==='col'?[1,0,0]:axis==='row'?[0,1,0]:[0,0,1]));
  const a=new THREE.Vector3(...turnGuidePoint(axis,0,1,0));
  const b=new THREE.Vector3(...turnGuidePoint(axis,0,Math.cos(.01),Math.sin(.01)));
  expect(a.clone().applyAxisAngle(axisV,.01).distanceTo(b)).toBeLessThan(1e-10);
});
it.each([false,true])('keeps two meshes, reverses without rebuilding, hides during turns and cleans up (calm=%s)',async calm=>{
  vi.mocked(prefersReducedMotion).mockReturnValue(calm);
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const canvas=document.createElement('canvas');
  const gl={render:vi.fn(),setSize:vi.fn(),setPixelRatio:vi.fn(),domElement:canvas,xr:{addEventListener:vi.fn(),removeEventListener:vi.fn()},shadowMap:{},renderLists:{dispose:vi.fn()},forceContextLoss:vi.fn()};
  const root=createRoot(canvas);root.configure({gl,frameloop:'never',size:{width:390,height:844}});
  let store,time=0;
  const render=async props=>act(async()=>{store=root.render(<TurnGuide axis="row" sliceIndex={2} size={3} dir={1} reduced {...props}/>)});
  const tick=async()=>act(async()=>{store.getState().advance(time+=1/60)});
  const template=getSliceRimGeometry(3,'row',2),templateDispose=vi.spyOn(template,'dispose');
  try {
    await render();
    for(let i=0;i<30;i++)await tick();
    const scene=store.getState().scene, rim=scene.getObjectByName('teach-turn-rim'),track=scene.getObjectByName('teach-turn-track');
    const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
    expect(meshes).toHaveLength(2);
    expect(track.material.forceSinglePass).toBe(true);
    expect(rim.material.side).toBe(THREE.FrontSide);
    expect(rim.geometry).toBe(template);
    expect(track.material.uniforms.uOpacity.value).toBe(1);
    expect(track.material.uniforms.uTime.value===0).toBe(calm);
    const geometry=track.geometry,material=track.material,dispose=vi.spyOn(geometry,'dispose');
    await render({dir:-1});await tick();
    expect(track.geometry).toBe(geometry);expect(track.material).toBe(material);
    expect(track.material.uniforms.uDir.value).toBe(-1);
    await render({dir:-1,turning:true});await tick();
    expect(track.material.uniforms.uOpacity.value).toBe(0);
    await render({axis:'col',sliceIndex:1});await tick();
    expect(dispose).toHaveBeenCalledOnce();
    expect(templateDispose).not.toHaveBeenCalled();
  } finally {
    await act(async()=>root.unmount());expect(templateDispose).not.toHaveBeenCalled();templateDispose.mockRestore();delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
