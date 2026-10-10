import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import MobiusTunnel from '../manifold/MobiusTunnel.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { WORM_PAD_HEIGHT } from '../game/raisedCubie.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { buildTunnelPathForTunnel, getTunnelWorldPosSmoothInto } from '../worm/wormLogic.js';
import { makeTunnelCamPose, tunnelCamPoseInto } from '../worm/tunnelCameraRails.js';
import { makeTunnelPath, tunnelPathTToArc, tunnelDockWidth, tunnelGaugeAt, tunnelArmFractionAt } from '../utils/tunnelPath.js';
import { makeTunnelRideFrame, tunnelRideFrameInto, tunnelRideSampleArc, TUNNEL_RIDE_WIDTH } from '../utils/tunnelRide.js';
import { coreOpeningBandWidth } from '../3d/corePassage.js';

extend(THREE);

it.each([3, 6, 15])('keeps the rendered track, rider and camera together through 6x core zoom on size %i', async size => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), bridge = { ...tunnelState };
  useGameStore.setState({ size, wormHealerMode: true, wormAlive: true, wormPaused: false });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 430, height: 932 } });
  const cornerA = { x: 0, y: size - 1, z: 0, dirKey: 'PY' };
  const cornerB = { x: size - 1, y: 0, z: size - 1, dirKey: 'PZ' };
  const id = 'zoom-ride', refs = [], index = cell => cell.x * size * size + cell.y * size + cell.z;
  for (const cell of [cornerA, cornerB]) {
    const mesh = new THREE.Group();
    mesh.position.set(cell.x, cell.y, cell.z).addScalar(-(size - 1) / 2);
    refs[index(cell)] = mesh;
  }
  let store, time = 0;
  const frame = () => store.getState().advance(time += 1 / 60);
  try {
    for (const reverse of [false, true]) {
      const entry = reverse ? cornerB : cornerA, exit = reverse ? cornerA : cornerB;
      const tunnel = { entry, exit, padHeight: WORM_PAD_HEIGHT, padExpansion: 0 };
      const path = buildTunnelPathForTunnel(makeTunnelPath(), tunnel, size);
      Object.assign(tunnelState, { active: true, activeTunnelId: id, occupiedTunnelIds: new Set(),
        tunnel, coreZoom: 1, coreZoomAnchor: path.midA.clone() });
      await act(async () => { store = root.render(<MobiusTunnel meshIdx1={index(entry)} meshIdx2={index(exit)}
        dirKey1={entry.dirKey} dirKey2={exit.dirKey} cubieRefs={refs} tunnelId={id} flips={1} />); });
      frame();
      const ribbon = store.getState().scene.children[0].children[0];
      const positions = ribbon.geometry.attributes.position;
      const segments = positions.count / 2 - 1;
      const ride = makeTunnelRideFrame(), actual = new THREE.Vector3(), expected = new THREE.Vector3();
      // The ridden band widens with the swollen core's opening; a tail-occupied
      // one keeps its tile width. Neither moves off the route.
      const checkFloor = (dockWidth = coreOpeningBandWidth(size, tunnelState.coreZoom)) => {
        let maxError = 0;
        for (let i = 0; i <= segments; i++) {
          const arc = tunnelRideSampleArc(path, i, segments);
          tunnelRideFrameInto(ride, path, arc);
          const halfWidth = 0.5 * tunnelGaugeAt(tunnelArmFractionAt(path, arc), TUNNEL_RIDE_WIDTH, dockWidth);
          for (const side of [0, 1]) {
            actual.fromBufferAttribute(positions, i * 2 + side);
            expected.copy(ride.floor).addScaledVector(ride.right, side === 0 ? -halfWidth : halfWidth);
            maxError = Math.max(maxError, actual.distanceTo(expected));
          }
        }
        expect(maxError).toBeLessThan(1e-6);
      };
      // These samples span both arms and the hidden crossing, not just the docks.
      const progress = [0.2, 0.4, 0.5, 0.6, 0.8, 0.95];
      const poses = progress.map(t => tunnelCamPoseInto(makeTunnelCamPose(), tunnel, t, size));
      for (const zoom of [1, 2, 6, 3, 1]) {
        tunnelState.coreZoom = zoom;
        for (const [i, t] of progress.entries()) {
          tunnelState.t = t;
          frame();
          checkFloor();
          tunnelRideFrameInto(ride, path, tunnelPathTToArc(path, t));
          expect(getTunnelWorldPosSmoothInto(actual, tunnel, t, size).distanceTo(ride.center)).toBeLessThan(1e-10);
          const pose = tunnelCamPoseInto(makeTunnelCamPose(), tunnel, t, size);
          for (const key of ['cam', 'look', 'up', 'tangent']) expect(pose[key].distanceTo(poses[i][key])).toBeLessThan(1e-10);
        }
      }
      // The head can leave this tunnel while its recorded tail still rides it.
      tunnelState.coreZoom = 6;
      tunnelState.activeTunnelId = 'next-tunnel';
      tunnelState.occupiedTunnelIds = new Set([id]);
      frame(); checkFloor(tunnelDockWidth(size));
      expect(ribbon.parent.visible).toBe(true);
      const fixed = positions.array.slice();
      tunnelState.occupiedTunnelIds.clear();
      frame();
      // This route is now an alternate outcome, not part of the worm's body.
      // It must remain visible while another route is occupied.
      expect(ribbon.parent.visible).toBe(true);
      expect(ribbon.material.uniforms.uCameraClearance.value).toBe(1);
      expect(positions.array.some((v, i) => Math.abs(v - fixed[i]) > 0.1)).toBe(true);
      // Acquiring a still-enlarged track must rebuild it onto the fixed route.
      tunnelState.activeTunnelId = id;
      frame(); checkFloor();
    }
  } finally {
    Object.assign(tunnelState, bridge);
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
