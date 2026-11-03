import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import MobiusTunnel from '../manifold/MobiusTunnel.jsx';
import VoidCore from '../3d/VoidCore.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { tunnelCoreClipUniforms } from '../manifold/tunnelCoreClip.js';
import { tunnelCameraClearanceGLSL } from '../manifold/tunnelCameraClearance.js';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { makeTunnelPath } from '../utils/tunnelPath.js';
import { mirrorSubjects, tagMirrorSubjects, MIRROR_LAYER } from '../3d/mirrorSubjects.js';
import { WORM_PAD_HEIGHT } from '../game/raisedCubie.js';

extend(THREE);

it.each(['solid', 'checkerboard'])('clips all %s tunnel materials at the live core shell, including occupied routes', async style => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), bridge = { ...tunnelState };
  const clipHalf = tunnelCoreClipUniforms.uTunnelCoreHalf.value;
  const clipCenter = tunnelCoreClipUniforms.uTunnelCoreCenter.value.clone();
  useGameStore.setState({ size: 3, cubies: makeCubies(3), wormHealerMode: true, wormAlive: true,
    wormPaused: false, perfReducedFX: false, explosionT: 0 });
  const entry = { x: 2, y: 1, z: 1, dirKey: 'PX' }, exit = { x: 0, y: 1, z: 1, dirKey: 'NX' };
  const tunnel = { entry, exit, padHeight: WORM_PAD_HEIGHT, padExpansion: 0 };
  const path = buildTunnelPathForTunnel(makeTunnelPath(), tunnel, 3);
  const refs = [], index = cell => cell.x * 9 + cell.y * 3 + cell.z;
  for (const cell of [entry, exit]) {
    const mesh = new THREE.Group();
    mesh.position.set(cell.x - 1, cell.y - 1, cell.z - 1);
    refs[index(cell)] = mesh;
  }
  const canvas = document.createElement('canvas');
  const gl = { compile: vi.fn(), render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let store, time = 0;
  try {
    Object.assign(tunnelState, { active: true, activeTunnelId: 'clip', occupiedTunnelIds: new Set(),
      tunnel, coreZoom: 1, coreZoomAnchor: path.midA.clone() });
    await act(async () => { store = root.render(<><VoidCore /><group name="test-route"><MobiusTunnel
      meshIdx1={index(entry)} meshIdx2={index(exit)} dirKey1="PX" dirKey2="NX" cubieRefs={refs}
      tunnelId="clip" flips={1} color1="#ff0000" color2="#0000ff" style1={style} style2={style} /></group></>); });
    for (const zoom of [1, 6, 1]) {
      tunnelState.coreZoom = zoom;
      for (const occupancy of ['head', 'tail', 'tail-outside', 'idle']) {
        tunnelState.active = occupancy !== 'tail-outside';
        tunnelState.activeTunnelId = occupancy === 'head' ? 'clip' : 'other';
        tunnelState.occupiedTunnelIds = new Set(occupancy.startsWith('tail') ? ['clip'] : []);
        await act(async () => store.getState().advance(time += 1 / 60));
        const route = store.getState().scene.getObjectByName('test-route');
        tagMirrorSubjects(store.getState().scene);
        route.traverse(object => {
          expect(mirrorSubjects().has(object)).toBe(false);
          expect(object.layers.isEnabled(MIRROR_LAYER)).toBe(false);
        });
        // Still prewarm the on-screen program once, not a mirror variant.
        expect(gl.compile.mock.calls.filter(([object]) => object === route.children[0])).toHaveLength(1);
        const meshes = [];
        route.traverse(object => { if (object.isMesh && object.visible) meshes.push(object); });
        expect(meshes).toHaveLength(style === 'solid' ? 3 : 4);
        const half = tunnelCoreClipUniforms.uTunnelCoreHalf.value;
        expect(half).toBeGreaterThan(0);
        for (const mesh of meshes) {
          const { material, geometry } = mesh;
          expect(geometry.attributes.position.count).toBeGreaterThan(0);
          expect(material.uniforms.uTunnelCoreHalf).toBe(tunnelCoreClipUniforms.uTunnelCoreHalf);
          expect(material.uniforms.uTunnelCoreCenter).toBe(tunnelCoreClipUniforms.uTunnelCoreCenter);
          // Check the actual material handed to the renderer, including styled
          // surfaces and the translucent curls.
          expect(material.uniforms.uRiddenCore).toBeUndefined();
          expect(material.fragmentShader).toContain(tunnelCameraClearanceGLSL);
          expect(material.fragmentShader).toMatch(/bool tunnelCoreHides\(vec3 worldPoint\)\s*\{\s*return outsideTunnelCore\(worldPoint\) < 0\.5;/);
          expect(material.fragmentShader).not.toContain('tunnelRiddenUnderside');
          if (mesh.name === 'tunnel-open-veil') {
            expect(material.fragmentShader).toContain('alpha *= tunnelCameraVisibility(vWorldPos);');
          } else {
            expect(material.fragmentShader).toMatch(/void main\(\)\s*\{\s*clearTunnelCamera\(/);
          }
        }
        if (occupancy === 'head' && zoom === 1) {
          // The complete route is retained for traversal; clipping is visual,
          // not removal of simulation samples or either connecting arm.
          const positions = meshes[0].geometry.attributes.position;
          let inside = 0, outside = 0;
          const point = new THREE.Vector3();
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).sub(tunnelCoreClipUniforms.uTunnelCoreCenter.value);
            if (Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) < half) inside++;
            else outside++;
          }
          expect(inside).toBeGreaterThan(0);
          expect(outside).toBeGreaterThan(0);
        }
      }
    }
  } finally {
    Object.assign(tunnelState, bridge);
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    tunnelCoreClipUniforms.uTunnelCoreHalf.value = clipHalf;
    tunnelCoreClipUniforms.uTunnelCoreCenter.value.copy(clipCenter);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
