import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { syncExteriorTunnelView } from './tunnelProgressBridge.js';
import { victoryView, VICTORY_PITCH } from './story/victoryFrame.js';

const FOV = 50;
const ORIGIN = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);
const FACE_VIEW = new Vector3(.82, .59, 1).normalize();
const START_PITCH = Math.asin(FACE_VIEW.y);
const START_YAW = Math.atan2(FACE_VIEW.z, FACE_VIEW.x);
const HALF_FOV = MathUtils.degToRad(FOV / 2);

export default function StationaryWormCamera({ worm, size }) {
  const { camera, size: viewport } = useThree();
  const startRequest = useRef(useGameStore.getState().wormStationaryViewRequest ?? 0);
  const startStep = useRef(useGameStore.getState().wormStationaryViewStep ?? 0);
  const aspect = viewport.width / Math.max(1, viewport.height);
  const distance = useMemo(() => {
    // Use a constant fit that contains an ordinary lattice and its turning
    // slices. Resizing the screen or the board can legitimately reframe it.
    const angle = Math.min(HALF_FOV, Math.atan(Math.tan(HALF_FOV) * Math.max(.1, aspect)));
    return (size / 2 + .35) * Math.sqrt(3) / Math.sin(angle * .89);
  }, [size, aspect]);

  useEffect(() => {
    const { fov, zoom } = camera;
    const up = camera.up.clone();
    return () => {
      camera.fov = fov;
      camera.zoom = zoom;
      camera.up.copy(up);
      camera.updateProjectionMatrix();
    };
  }, [camera]);

  useFrame(() => {
    const state = useGameStore.getState();
    const opposite = ((state.wormStationaryViewRequest ?? 0) - startRequest.current) % 2 !== 0;
    const sign = opposite ? -1 : 1;
    const step = MathUtils.euclideanModulo((state.wormStationaryViewStep ?? 0) - startStep.current, 8);
    const turn = step * Math.PI / 4;
    // The victory screen already offers manual inspection. Keep that deliberate
    // input, but never start the victory orbit or move until a gesture occurs.
    const { yaw, pitch, zoom, manual } = victoryView;
    if (state.wormGamePhase === 'solved' && manual && (yaw !== 0 || pitch !== VICTORY_PITCH || zoom !== 1)) {
      const azimuth = START_YAW - turn + (opposite ? Math.PI : 0) + yaw;
      const elevation = MathUtils.clamp(sign * START_PITCH + pitch - VICTORY_PITCH, -1.35, 1.35);
      const radius = distance * zoom;
      const horizontal = radius * Math.cos(elevation);
      camera.position.set(horizontal * Math.cos(azimuth), radius * Math.sin(elevation), horizontal * Math.sin(azimuth));
    } else {
      camera.position.copy(FACE_VIEW);
      if (step) camera.position.applyAxisAngle(WORLD_UP, turn);
      camera.position.multiplyScalar(sign * distance);
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(ORIGIN);
    if (camera.fov !== FOV || camera.zoom !== 1) {
      camera.fov = FOV;
      camera.zoom = 1;
      camera.updateProjectionMatrix();
    }

    syncExteriorTunnelView(worm);
  }, -0.25);

  return null;
}
