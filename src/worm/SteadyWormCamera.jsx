import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Matrix4, Vector3 } from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { FACE_NORMALS, MAX_TICK_DELTA } from './healerWorm/constants.js';
import { rocketOrbitInto, rocketOrbitT } from './healerWorm/rocketOrbit.js';
import { bodyPathHeadInto } from './healerWorm/sliceBodyPath.js';
import { syncExteriorTunnelView, tunnelState } from './tunnelProgressBridge.js';
import { clampWormCameraZoom } from './wormCameraZoom.js';
import { victoryView, VICTORY_PITCH } from './story/victoryFrame.js';

const FOV = 55;
const MIN_DISTANCE_OUTSIDE = Math.sqrt(3) / 2;
const MAX_TURN_RATE = Math.PI * 2 / 3; // 120°/s, including the longest opposite-face crossing
const UP = new Vector3(0, 1, 0);
const NORTH = new Vector3(0, 0, 1);
const ORIGIN = new Vector3();

// Precompute authored view orientations, independent of the worm's movement
// heading. Each shows the current surface from a readable, level angle.
const facePoses = Object.fromEntries(Object.entries(FACE_NORMALS).map(([face, normal]) => {
  const eye = new Vector3();
  return [face, Array.from({ length: 8 }, (_, step) => {
    const tangent = Math.abs(normal.y) > .5 ? NORTH : UP;
    eye.copy(tangent).applyAxisAngle(normal, step * Math.PI / 4).multiplyScalar(.45).add(normal);
    return { yaw: Math.atan2(eye.x, eye.z), pitch: Math.asin(eye.y / eye.length()) };
  })];
}));
const facePose = (face, step) => (facePoses[face] ?? facePoses.PZ)[step];
const polarFace = face => face === 'PY' || face === 'NY';
const yawDelta = (from, to) => MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;

export default function SteadyWormCamera({ worm, size }) {
  const { camera } = useThree();
  const initial = useRef(true);
  const scratch = useRef(null);
  if (!scratch.current) scratch.current = {
    head: new Vector3(), eye: new Vector3(), basis: new Matrix4(), yaw: 0, pitch: 0, polarYaw: 0,
  };
  const pose = scratch.current;

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

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    const route = syncExteriorTunnelView(worm);
    // No arrival sweeps, victory orbits, death shots or camera kicks.
    const inspecting = !initial.current && state.wormGamePhase === 'solved';
    if (!initial.current && state.wormAlive === false && !inspecting) return;
    if (!inspecting) {
      const transit = !!route;
      const step = state.wormSteadyViewStep ?? 0;
      bodyPathHeadInto(pose.head, worm, transit);
      if (!transit) rocketOrbitInto(pose.head, size, rocketOrbitT(
        worm.rocketActive?.current, worm.rocketT?.current, worm.rocketFlight?.current));
      const face = transit ? route.entry.dirKey : worm.pos.current?.dirKey;
      // The top and bottom have no inherent compass bearing. Keep the approach
      // side's azimuth there instead of flipping 180° to an arbitrary north.
      if (!polarFace(face)) pose.polarYaw = facePose(face, 0).yaw;
      const start = facePose(face, step);
      let { yaw, pitch } = start;
      if (polarFace(face)) yaw += pose.polarYaw;
      if (transit) {
        // Watch the entry, turn toward the exit while the cube hides the head,
        // then watch the real exit. Interpolate yaw and pitch, never roll.
        const end = facePose(route.exit.dirKey, step);
        const blend = MathUtils.smoothstep(tunnelState.t, .12, .75);
        yaw += yawDelta(yaw, end.yaw + (polarFace(route.exit.dirKey) ? pose.polarYaw : 0)) * blend;
        pitch = MathUtils.lerp(pitch, end.pitch, blend);
      }
      if (initial.current) {
        initial.current = false;
        pose.yaw = yaw;
        pose.pitch = pitch;
      } else if (!state.wormPaused) {
        const dt = Math.min(Math.max(0, delta), MAX_TICK_DELTA);
        const dx = yawDelta(pose.yaw, yaw);
        const dy = pitch - pose.pitch;
        const remaining = Math.hypot(dx, dy);
        if (remaining < 1e-6) {
          // Make the settled frame bit-stable as the head translates.
          pose.yaw = yaw;
          pose.pitch = pitch;
        } else {
          const blend = Math.min(MAX_TURN_RATE * dt / remaining, 1 - Math.exp(-dt * 11));
          pose.yaw += dx * blend;
          pose.pitch += dy * blend;
        }
      }
    }

    // Victory inspection is user input only; it does not start an orbit.
    const manual = inspecting && victoryView.manual;
    const yaw = pose.yaw + (manual ? victoryView.yaw : 0);
    const pitch = MathUtils.clamp(pose.pitch + (manual ? victoryView.pitch - VICTORY_PITCH : 0), -1.35, 1.35);
    const horizontal = Math.cos(pitch);
    pose.eye.set(Math.sin(yaw) * horizontal, Math.sin(pitch), Math.cos(yaw) * horizontal);

    // An outward tilt keeps even top/bottom views off the poles, so deriving
    // the basis from world-up each frame holds the horizon level between faces.
    const fittedDistance = size * MIN_DISTANCE_OUTSIDE + 1.1 + (1.75 + size * .05) * clampWormCameraZoom(state.wormCameraZoom);
    camera.quaternion.setFromRotationMatrix(pose.basis.lookAt(pose.eye, ORIGIN, UP));
    camera.up.copy(UP).applyQuaternion(camera.quaternion); // oriented swipe controls use the screen basis
    camera.position.copy(pose.head).addScaledVector(pose.eye, fittedDistance * (manual ? victoryView.zoom : 1));
    if (camera.fov !== FOV || camera.zoom !== 1) {
      camera.fov = FOV;
      camera.zoom = 1;
      camera.updateProjectionMatrix();
    }
  }, -0.25);

  return null;
}
