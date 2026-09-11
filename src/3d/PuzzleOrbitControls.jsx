import React from 'react';
import { TrackballControls } from '@react-three/drei';

// Disabled is not sufficient: pointer-release handlers mutate controls.enabled
// imperatively. While the chase camera owns the scene, remove both the control
// object and its frame subscription so it cannot lookAt the orbit target.
export default function PuzzleOrbitControls({ chaseActive, controlsRef, ...props }) {
  if (chaseActive) return null;
  return <TrackballControls ref={controlsRef} {...props} />;
}
