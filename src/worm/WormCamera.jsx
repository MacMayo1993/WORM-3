// src/worm/WormCamera.jsx
// First-person camera that follows the worm's perspective
// Creates a disorienting effect as the worm crosses faces and teleports through wormholes

import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getSegmentWorldPos } from './wormLogic.js';
import { DIR_TO_VEC } from '../utils/constants.js';

// Map face direction to its normal vector (outward from cube)
const FACE_NORMALS = {
  PX: new THREE.Vector3(1, 0, 0),
  NX: new THREE.Vector3(-1, 0, 0),
  PY: new THREE.Vector3(0, 1, 0),
  NY: new THREE.Vector3(0, -1, 0),
  PZ: new THREE.Vector3(0, 0, 1),
  NZ: new THREE.Vector3(0, 0, -1)
};

// Map movement direction to world direction for each face
// When looking at the face, these are the directions on that face
const FACE_MOVE_VECTORS = {
  PZ: { // Front face - looking at it from +Z
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0)
  },
  NZ: { // Back face - looking at it from -Z (mirrored)
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
    left: new THREE.Vector3(1, 0, 0),
    right: new THREE.Vector3(-1, 0, 0)
  },
  PX: { // Right face
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
    left: new THREE.Vector3(0, 0, 1),
    right: new THREE.Vector3(0, 0, -1)
  },
  NX: { // Left face
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
    left: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(0, 0, 1)
  },
  PY: { // Top face - looking down from +Y
    up: new THREE.Vector3(0, 0, -1),
    down: new THREE.Vector3(0, 0, 1),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0)
  },
  NY: { // Bottom face - looking up from -Y
    up: new THREE.Vector3(0, 0, 1),
    down: new THREE.Vector3(0, 0, -1),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0)
  }
};

export default function WormCamera({
  worm,
  moveDir,
  size,
  explosionFactor = 0,
  enabled = true,
  lerpSpeed = 0.08 // How smoothly the camera follows (lower = smoother but laggier)
}) {
  const { camera } = useThree();

  // Store target position/rotation for smooth interpolation
  const targetPos = useRef(new THREE.Vector3(0, 0, 10));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetUp = useRef(new THREE.Vector3(0, 1, 0));

  // Store original camera settings to restore when disabled
  const originalPos = useRef(null);
  const wasEnabled = useRef(false);

  useFrame(() => {
    if (!enabled) {
      // If just disabled, we could restore original position
      // For now, let OrbitControls handle it
      wasEnabled.current = false;
      return;
    }

    // Store original position on first enable
    if (!wasEnabled.current) {
      originalPos.current = camera.position.clone();
      wasEnabled.current = true;
    }

    if (!worm || worm.length < 1) return;

    const head = worm[0];
    const headPos = getSegmentWorldPos(head, size, explosionFactor);
    const headVec = new THREE.Vector3(headPos[0], headPos[1], headPos[2]);

    // Get face normal (camera "up" relative to the surface)
    const faceNormal = FACE_NORMALS[head.dirKey]?.clone() || new THREE.Vector3(0, 0, 1);

    // Get forward direction based on movement direction on this face
    const faceMoveDirs = FACE_MOVE_VECTORS[head.dirKey];
    const forward = faceMoveDirs?.[moveDir]?.clone() || new THREE.Vector3(0, 1, 0);

    // Position camera behind and above the worm head
    // "Behind" = opposite of forward direction
    // "Above" = along face normal (away from cube surface)
    const behindOffset = forward.clone().multiplyScalar(-1.8);
    const aboveOffset = faceNormal.clone().multiplyScalar(1.2);

    targetPos.current.copy(headVec).add(behindOffset).add(aboveOffset);

    // Look ahead of the worm
    const lookAheadOffset = forward.clone().multiplyScalar(2);
    targetLookAt.current.copy(headVec).add(lookAheadOffset);

    // Up vector is the face normal
    targetUp.current.copy(faceNormal);

    // Smoothly interpolate camera position
    camera.position.lerp(targetPos.current, lerpSpeed);

    // Smoothly interpolate up vector
    camera.up.lerp(targetUp.current, lerpSpeed);

    // Look at target
    camera.lookAt(targetLookAt.current);
  });

  return null; // This component only manipulates the camera, doesn't render anything
}

// Helper component that shows a mini-map or indicator of worm orientation
export function WormOrientationIndicator({ worm, moveDir }) {
  if (!worm || worm.length < 1) return null;

  const head = worm[0];

  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
      right: 'calc(20px + env(safe-area-inset-right, 0px))',
      background: 'rgba(0, 0, 0, 0.7)',
      border: '2px solid #00ff88',
      borderRadius: '8px',
      padding: '12px',
      color: '#00ff88',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      pointerEvents: 'none'
    }}>
      <div>Face: {head.dirKey}</div>
      <div>Dir: {moveDir}</div>
      <div style={{ marginTop: '8px', fontSize: '20px', textAlign: 'center' }}>
        {moveDir === 'up' && '↑'}
        {moveDir === 'down' && '↓'}
        {moveDir === 'left' && '←'}
        {moveDir === 'right' && '→'}
      </div>
    </div>
  );
}
