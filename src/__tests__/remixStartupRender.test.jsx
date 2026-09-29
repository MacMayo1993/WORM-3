import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { storyAppearance } from '../worm/story/worlds.js';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { PadProvider } from '../3d/PadSprings.jsx';
import { createExteriorPortals } from '../3d/exteriorPortals.js';
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
const textRender = vi.hoisted(() => vi.fn(() => null));
vi.mock('@react-three/drei', async importOriginal => ({ ...await importOriginal(), Text: textRender }));
extend(THREE);
it('mounts a complete mobile Remix cube and applies its portal materials', async () => {
 globalThis.IS_REACT_ACT_ENVIRONMENT = true;
 const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, clearRect() {}, fillText() {}, strokeText() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} }), measureText: () => ({width: 10}) });
 const { default: Cubie } = await import('../3d/Cubie.jsx');
 const before = useGameStore.getState(), cubies = makeCubies(5), portals = createExteriorPortals();
 useGameStore.setState({size:5, cubies, wormHealerMode:true, randomMode:true, perfReducedFX:true, chaosLevel:0, settings:{...before.settings,...storyAppearance(26,true)}});
 const canvas=document.createElement('canvas');
 const gl={render:vi.fn(),setSize:vi.fn(),setPixelRatio:vi.fn(),domElement:canvas,xr:{addEventListener:vi.fn(),removeEventListener:vi.fn()},shadowMap:{},renderLists:{dispose:vi.fn()},forceContextLoss:vi.fn()};
 const root=createRoot(canvas); root.configure({gl,frameloop:'never',size:{width:400,height:800}});
 let store;
 try {
 await act(async()=>{store=root.render(<StickerInstanceProvider exteriorPortals={portals}><PadProvider>{cubies.flat(2).filter(c=>[c.x,c.y,c.z].some(v=>v===0||v===4)).map(c=><Cubie key={`${c.x},${c.y},${c.z}`} cubie={c} position={[c.x-2,c.y-2,c.z-2]} size={5} wormMode />)}</PadProvider></StickerInstanceProvider>)});
 portals.apply(store.getState().scene);
 const scene = store.getState().scene;
 expect(scene.getObjectByName('StickerInstanceMesh').count).toBe(150);
 expect(textRender).not.toHaveBeenCalled();
 const fronts = [];
 scene.traverse(mesh => { if (mesh.name === 'sticker-front') fronts.push(mesh); });
 expect(fronts).toHaveLength(0); // All 150 front faces use the single batch.
 const batch = scene.getObjectByName('StickerInstanceMesh');
 for (const tick of [1, 2, 10, 100]) {
   await act(async () => useGameStore.setState({ randomStyleTick: tick }));
   const next = []; scene.traverse(mesh => { if (mesh.name === 'sticker-front') next.push(mesh); });
   expect(next).toEqual(fronts);
   expect(scene.getObjectByName('StickerInstanceMesh')).toBe(batch);
   expect(batch.count).toBe(150);
   expect(textRender).not.toHaveBeenCalled();
 }
 } finally { await act(async()=>root.unmount());portals.dispose();useGameStore.setState(before); context.mockRestore();delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
});
