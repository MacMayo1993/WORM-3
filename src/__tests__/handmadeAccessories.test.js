import { afterEach, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { WORM_HATS } from '../worm/wormCosmeticsData.js';
import { HANDMADE_HATS, WORM_ACCESSORIES, safeAccessories, EMPTY_ACCESSORIES } from '../worm/handmadeAccessoriesData.js';
import { STORE_ITEMS, getStoreItem } from '../utils/storeCatalog.js';
import { chestItemTier } from '../economy/chests.js';
import { createAccessoryRig, buildCraftModel, poseHeadAccessories, beginAccessoryBody, poseBodyAccessories, finishAccessoryBody } from '../worm/wormAccessories.js';

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
    expect(model.children.length).toBeGreaterThan(0);
    expect(model.children.length).toBeLessThanOrEqual(6);
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
