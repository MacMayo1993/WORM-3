import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createCoreWormReflections } from '../3d/coreWormReflections.js';
import { createCoreMirrorRoom } from '../3d/coreMirrorRoom.js';
import { makeCorePassage } from '../3d/corePassage.js';

it('reflects the live worm buffers and face across each wall without mutating the originals', () => {
  const passage=makeCorePassage(), room=createCoreMirrorRoom(6,passage.uniforms,null), mirrors=createCoreWormReflections();
  const source=new THREE.Group(), geometry=new THREE.SphereGeometry(.03,8,8), material=new THREE.MeshBasicMaterial({color:'#2bee98'});
  const body=new THREE.InstancedMesh(geometry,material,8), eye=new THREE.Mesh(geometry,material);
  body.count=4;body.setColorAt(0,new THREE.Color('red'));eye.position.set(.02,.03,-.04);source.add(body,eye);
  const camera=new THREE.PerspectiveCamera(90,1,.002,100);camera.position.set(0,0,.02);camera.lookAt(0,0,-1);
  room.group.visible=true;room.group.scale.setScalar(6);
  const geometryDisposed=vi.fn();geometry.addEventListener('dispose',geometryDisposed);
  try {
    mirrors.sync(source,room.group,camera);
    expect(mirrors.group.visible).toBe(true);
    let checked=0;
    for(const face of mirrors.faces) if(face.surface.visible){
      checked++;
      expect(face.target.texture.type).toBe(THREE.UnsignedByteType);
      const copy=face.meshes.get(body).mesh;
      expect(copy.geometry).toBe(geometry);expect(copy.instanceMatrix).toBe(body.instanceMatrix);expect(copy.instanceColor).toBe(body.instanceColor);
      expect(copy.count).toBe(4);expect(copy.material).not.toBe(material);
      const point=new THREE.Vector3().setFromMatrixPosition(face.meshes.get(eye).mesh.matrix);
      const d=face.uniforms.uMirrorPlane.value.w;
      expect(point.dot(face.normal)-d).toBeCloseTo(-(eye.position.dot(face.normal)-d));
      expect(face.scene.children).not.toContain(room.group);
      expect(face.surface.renderOrder).toBeLessThan(body.renderOrder); // transparent skins draw over their mirrors
    }
    expect(checked).toBeGreaterThan(0);
    eye.position.x=.07;body.count=2;material.color.set('blue');
    mirrors.sync(source,room.group,camera);
    for(const face of mirrors.faces) if(face.surface.visible){
      expect(face.meshes.get(body).mesh.count).toBe(2);
      expect(face.meshes.get(eye).mesh.material.color.equals(material.color)).toBe(true);
    }
    room.group.visible=false;mirrors.sync(source,room.group,camera);expect(mirrors.group.visible).toBe(false);
    mirrors.dispose();expect(geometryDisposed).not.toHaveBeenCalled();
  } finally { room.dispose();geometry.dispose();material.dispose(); }
});

it('restores renderer state even if a worm-only reflection render fails', () => {
  const room=createCoreMirrorRoom(3,makeCorePassage().uniforms,null), mirrors=createCoreWormReflections(), source=new THREE.Group();
  const camera=new THREE.PerspectiveCamera(90,1,.002,100);camera.position.set(0,0,.01);camera.lookAt(0,0,-1);
  room.group.visible=true;
  const previous={target:{},alpha:.6,color:new THREE.Color('#153247'),viewport:new THREE.Vector4(3,4,800,600),scissor:new THREE.Vector4(1,2,20,30)};
  const gl={autoClear:false,xr:{enabled:true},shadowMap:{autoUpdate:true},
    getRenderTarget:()=>previous.target,getClearAlpha:()=>previous.alpha,getClearColor:c=>c.copy(previous.color),
    getViewport:v=>v.copy(previous.viewport),getScissor:v=>v.copy(previous.scissor),getScissorTest:()=>true,
    setRenderTarget:vi.fn(),setViewport:vi.fn(),setScissor:vi.fn(),setScissorTest:vi.fn(),setClearColor:vi.fn(),render:vi.fn(()=>{throw new Error('capture failed');})};
  try {
    expect(()=>mirrors.sync(source,room.group,camera,gl)).toThrow('capture failed');
    expect(gl.setRenderTarget).toHaveBeenLastCalledWith(previous.target);
    expect(gl.setViewport).toHaveBeenLastCalledWith(previous.viewport);
    expect(gl.setScissor).toHaveBeenLastCalledWith(previous.scissor);
    expect(gl.setScissorTest).toHaveBeenLastCalledWith(true);
    expect(gl.setClearColor).toHaveBeenLastCalledWith(previous.color,.6);
    expect(gl.autoClear).toBe(false);expect(gl.xr.enabled).toBe(true);expect(gl.shadowMap.autoUpdate).toBe(true);
  } finally {mirrors.dispose();room.dispose();}
});

it('keeps the live skin shader handle and shares its animated uniforms with reflections', () => {
  const room=createCoreMirrorRoom(3,makeCorePassage().uniforms,null), mirrors=createCoreWormReflections();
  const material=new THREE.MeshStandardMaterial(), geometry=new THREE.SphereGeometry(.03,8,8), source=new THREE.Group();
  const live={uniforms:{uTime:{value:12}}};material.userData.shader=live;
  material.onBeforeCompile=shader=>{shader.uniforms.uTime={value:0};material.userData.shader=shader;};
  const mesh=new THREE.Mesh(geometry,material);source.add(mesh);
  const camera=new THREE.PerspectiveCamera(90,1,.002,100);camera.position.set(0,0,.01);camera.lookAt(0,0,-1);room.group.visible=true;
  try {
    mirrors.sync(source,room.group,camera);
    const clone=mirrors.faces.find(face=>face.surface.visible).meshes.get(mesh).mesh.material;
    const shader={uniforms:{},vertexShader:'void main() { gl_Position=vec4(0.0); }',fragmentShader:'void main() { gl_FragColor=vec4(1.0); }'};
    clone.onBeforeCompile(shader,{});
    expect(material.userData.shader).toBe(live);
    expect(shader.uniforms.uTime).toBe(live.uniforms.uTime);
    material.userData.shader={uniforms:{uTime:{value:24}}};mirrors.sync(source,room.group,camera);
    expect(shader.uniforms.uTime).toBe(material.userData.shader.uniforms.uTime);
  } finally {mirrors.dispose();room.dispose();geometry.dispose();material.dispose();}
});
