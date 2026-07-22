// Shared HDRI/photo panorama background with a deliberately subtle drift.
import React from 'react';
import { useFrame } from '@react-three/fiber';
import SafeEnvironment from './SafeEnvironment.jsx';

export default function InteractivePhotoBackground({ preset, files, rotationSpeed = 0.1, intensity = 1.2, blurriness = 0 }) {
  useFrame((state, delta) => {
    if (state.scene.backgroundRotation) state.scene.backgroundRotation.y += delta * rotationSpeed;
  });

  return (
    <SafeEnvironment
      preset={files ? undefined : preset}
      files={files}
      background
      backgroundBlurriness={blurriness}
      backgroundIntensity={intensity}
    />
  );
}
