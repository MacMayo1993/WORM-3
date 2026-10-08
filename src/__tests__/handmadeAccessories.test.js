import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { WORM_HATS } from '../worm/wormCosmeticsData.js';
import { HANDMADE_HATS, WORM_ACCESSORIES, safeAccessories, EMPTY_ACCESSORIES } from '../worm/handmadeAccessoriesData.js';
import { STORE_ITEMS, getStoreItem } from '../utils/storeCatalog.js';
import { chestItemTier } from '../economy/chests.js';
import { createAccessoryRig, buildCraftModel, disposeCraftModel, animateCraftModel, poseHandmadeHat, poseHeadAccessories, beginAccessoryBody, poseBodyAccessories, finishAccessoryBody } from '../worm/wormAccessories.js';
import { getHandmadeParts } from '../worm/handmadeParts.js';
import { layoutWormFace } from '../worm/wormFaceLayout.js';

const initial = useGameStore.getState();
afterEach(() => { useGameStore.setState(initial); localStorage.removeItem('worm3_accessories'); });

it('offers all twenty-six handmade models through the real catalog and reward pool', () => {
  expect(HANDMADE_HATS.length + WORM_ACCESSORIES.length).toBe(26);
  for(const item of [...HANDMADE_HATS,...WORM_ACCESSORIES]) {
    const id=`${item.slot?'accessory':'hat'}_${item.id}`, entry=getStoreItem(id);
    expect(entry.label).toBe(item.label); expect(chestItemTier(entry)).toBe(4);
    expect(STORE_ITEMS.filter(x=>x.id===id)).toHaveLength(1);
    if(!item.slot) expect(WORM_HATS.some(h=>h.id===item.id)).toBe(true);
    const model=buildCraftModel(item.id);
    // At most six colour/finish draws, plus one ink outline per moving part.
    const meshes=[];model.traverse(o=>{ if(o.isMesh)meshes.push(o); });
    const rigs=model.children.filter(c=>c.isGroup).length;
    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes.filter(m=>m.userData.role!=='outline').length).toBeLessThanOrEqual(8);
    expect(meshes.length).toBeLessThanOrEqual(8+1+rigs);
    model.traverse(mesh=>{ if(!mesh.isMesh)return;
      expect([...mesh.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
      mesh.geometry.dispose();mesh.material.dispose();
    });
  }
});

it('equips independent slots, saves them, and rejects unowned or mismatched items', () => {
  useGameStore.setState({demoMode:false, wormAccessories:EMPTY_ACCESSORIES, wormHat:'acorn',
    ownedItems:['hat_acorn','accessory_buttonGoggles','accessory_seedSatchel','accessory_ribbonTail']});
  const s=useGameStore.getState();
  expect(s.setWormAccessory('face','buttonGoggles')).toBe(true);
  expect(s.setWormAccessory('body','seedSatchel')).toBe(true);
  expect(s.setWormAccessory('tail','ribbonTail')).toBe(true);
  expect(s.setWormAccessory('neck','crookedBow')).toBe(false);
  expect(s.setWormAccessory('tail','seedSatchel')).toBe(false);
  expect(s.setWormAccessory('__proto__','ribbonTail')).toBe(false);
  expect(s.setWormAccessory('face','madeUp')).toBe(false);
  expect(useGameStore.getState().wormHat).toBe('acorn');
  expect(JSON.parse(localStorage.getItem('worm3_accessories'))).toEqual({face:'buttonGoggles',neck:'none',body:'seedSatchel',tail:'ribbonTail'});
  s.setWormAccessory('body','none');
  expect(useGameStore.getState().wormAccessories.tail).toBe('ribbonTail');
  expect(safeAccessories({body:'seedSatchel',tail:'seedSatchel',face:'buttonGoggles'},['accessory_seedSatchel'])).toEqual({...EMPTY_ACCESSORIES,body:'seedSatchel'});
});

it('keeps a full outfit attached and finite on all surface frames, including degenerate tangents', () => {
  const rig=createAccessoryRig({face:'buttonGoggles',neck:'patchworkBandana',body:'friendshipBeads',tail:'paintbrushTail'});
  const origin=new THREE.Vector3(12,3,-8);
  for(const normal of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]) {
    for(const forward of [new THREE.Vector3(0,0,0),normal,new THREE.Vector3(1,1,1).normalize()]) {
      poseHeadAccessories(rig,origin,forward,normal,.092,0,true);
      beginAccessoryBody(rig);
      for(let i=0;i<8;i++)poseBodyAccessories(rig,i,origin,forward,normal,.08,0,true,'#123456',{1:'#ff0000',6:'#0000ff'});
      finishAccessoryBody(rig,0,true,'#123456');
      for(const entry of rig.entries) {
        expect(entry.group.visible).toBe(true);
        expect(entry.group.position.distanceTo(origin)).toBe(0);
        expect(entry.group.quaternion.length()).toBeCloseTo(1);
        expect(entry.model.scale.x).toBeCloseTo(.76);
      }
      const paint=rig.root.getObjectsByProperty('isMesh',true).filter(m=>m.userData.role==='paint');
      expect(paint[0].material.color.getHexString()).toBe('123456');
    }
  }
  beginAccessoryBody(rig);finishAccessoryBody(rig,0,false);
  expect(rig.entries.filter(e=>e.slot==='body'||e.slot==='tail').every(e=>!e.group.visible)).toBe(true);
  rig.dispose(); expect(rig.root.children).toHaveLength(0);
});

it('centres glasses and goggles on the eyes the face layout draws', () => {
  const center=new THREE.Vector3(0,0,0), forward=new THREE.Vector3(1,0,0), up=new THREE.Vector3(0,1,0);
  const eyes=[new THREE.Object3D(),new THREE.Object3D()];
  layoutWormFace(center,forward,up,1,{eyes});
  for(const id of ['bottlecapGlasses','buttonGoggles']) {
    const rig=createAccessoryRig({face:id});
    poseHeadAccessories(rig,center,forward,up,1,0,false,'classic');
    rig.root.updateMatrixWorld(true);
    // Each lens pane is its own clear disc; one sits over each eye, a little out from it.
    const panes=rig.root.getObjectsByProperty('isMesh',true).filter(m=>m.material.transparent);
    expect(panes).toHaveLength(1);
    const middle=new THREE.Box3().setFromObject(panes[0]).getCenter(new THREE.Vector3());
    // Where the pair should sit: between the eyes, stood a little out along the face.
    const faceDir=up.clone().multiplyScalar(.62).addScaledVector(forward,.79).normalize();
    const expected=eyes[0].position.clone().add(eyes[1].position).multiplyScalar(.5).addScaledVector(faceDir,.17);
    expect(middle.distanceTo(expected),`${id}: lenses centred on the eyes`).toBeLessThan(.08);
    rig.dispose();
  }
});

// The point of the craft pass: a piece is a few dozen pixels across on a bead
// of any colour in front of any scene, so it has to be big, edged, lit and not
// the worm's own green. These hold every piece to that.
describe('craft pieces stay readable', () => {
  const everyPiece=[...HANDMADE_HATS,...WORM_ACCESSORIES];
  const meshesOf=model=>{ const out=[]; model.traverse(o=>{ if(o.isMesh)out.push(o); }); return out; };

  it('stands well proud of the bead it is worn on', () => {
    for(const item of everyPiece) {
      const model=buildCraftModel(item.id);
      const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      // A bead is two radii across; no piece is smaller than that.
      expect(Math.max(size.x,size.y,size.z),`${item.id} is too small to read`).toBeGreaterThanOrEqual(1.6);
      disposeCraftModel(model);
    }
  });

  it('carries an ink outline hull behind its opaque parts and none round clear glass', () => {
    for(const item of everyPiece) {
      const model=buildCraftModel(item.id), meshes=meshesOf(model);
      const hulls=meshes.filter(m=>m.userData.role==='outline');
      expect(hulls.length,`${item.id} has no outline`).toBeGreaterThan(0);
      for(const hull of hulls) {
        expect(hull.material.side).toBe(THREE.BackSide);
        expect(hull.material.transparent).toBe(false);
        expect(hull.raycast()).toBeNull();
        expect([...hull.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
      }
      // Lenses keep one clear pane each and are never ringed in ink.
      if(item.id==='bottlecapGlasses'||item.id==='buttonGoggles') expect(meshes.filter(m=>m.material.transparent)).toHaveLength(1);
      disposeCraftModel(model);
    }
  });

  it('keeps a small emissive floor on every opaque part so it never goes muddy in a dark scene', () => {
    for(const item of everyPiece) {
      for(const part of getHandmadeParts(item.id)) {
        if(part.mat.transparent) continue;
        expect(part.mat.emissiveIntensity,`${item.id}: ${part.mat.color} has no glow`).toBeGreaterThan(0);
      }
    }
  });

  it('never dresses a leaf in the worm\'s own green', () => {
    const hue=hex=>{ const c=new THREE.Color(hex), hsl={}; c.getHSL(hsl); return {h:hsl.h*360,s:hsl.s}; };
    for(const id of ['leafCape','leafBeret']) {
      for(const part of getHandmadeParts(id)) {
        const {h,s}=hue(part.mat.color);
        expect(h>=70&&h<=170&&s>.3,`${id}: ${part.mat.color} is green`).toBe(false);
      }
    }
  });

  it('moves with the clock and sits still when the clock is frozen', () => {
    const rotation=(model,name)=>model.getObjectByName(`rig-${name}`).rotation;
    const pinwheel=buildCraftModel('paperPinwheel');
    animateCraftModel(pinwheel,0);
    expect(rotation(pinwheel,'blades').z).toBe(0);
    animateCraftModel(pinwheel,.4);
    expect(rotation(pinwheel,'blades').z).toBeCloseTo(2.2);
    animateCraftModel(pinwheel,0);
    expect(rotation(pinwheel,'blades').z).toBe(0);

    const key=buildCraftModel('windupKey');
    animateCraftModel(key,1);
    expect(rotation(key,'key').y).toBeCloseTo(2.4);

    const jar=buildCraftModel('fireflyJar');
    const flies=jar.userData.flies;
    expect(flies).toHaveLength(2);
    animateCraftModel(jar,0);
    const lit=flies.map(f=>f.mesh.material.emissiveIntensity);
    animateCraftModel(jar,.9);
    expect(flies.map(f=>f.mesh.material.emissiveIntensity)).not.toEqual(lit);
    expect(lit.every(v=>v>0)).toBe(true);
    for(const model of [pinwheel,key,jar]) disposeCraftModel(model);
  });

  it('turns the worn pieces through the rig while a pad of equipment is posed', () => {
    const rig=createAccessoryRig({tail:'paperPinwheel'});
    const origin=new THREE.Vector3(),forward=new THREE.Vector3(1,0,0),up=new THREE.Vector3(0,1,0);
    const blades=()=>rig.entries[0].model.getObjectByName('rig-blades').rotation.z;
    beginAccessoryBody(rig);poseBodyAccessories(rig,1,origin,forward,up,.1,0,false);finishAccessoryBody(rig,0,false);
    expect(blades()).toBe(0);
    beginAccessoryBody(rig);poseBodyAccessories(rig,1,origin,forward,up,.1,.5,false);finishAccessoryBody(rig,.5,false);
    expect(blades()).toBeGreaterThan(0);
    rig.dispose();
  });

  it('animates a handmade hat through the same craft model', () => {
    const group=new THREE.Group(),model=buildCraftModel('sprout');
    group.add(model);
    const leaves=model.getObjectByName('rig-leaves');
    poseHandmadeHat(group,'sprout',new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),0);
    expect(leaves.rotation.z).toBe(0);
    poseHandmadeHat(group,'sprout',new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),.5);
    expect(leaves.rotation.z).not.toBe(0);
    disposeCraftModel(model);
  });
});
