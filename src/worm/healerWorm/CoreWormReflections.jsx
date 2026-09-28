import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { tunnelState } from '../tunnelProgressBridge.js';
import { createCoreWormReflections } from '../../3d/coreWormReflections.js';

export function CoreWormReflections({ source }) {
  const reflections = useMemo(() => createCoreWormReflections(), []);
  useEffect(() => () => reflections.dispose(), [reflections]);
  // Mounted after WormBody/WormFace: reflect this frame's face, skin and pose.
  useFrame(({ scene, camera, gl }) => {
    if (!tunnelState.active) { reflections.group.visible = false; return; }
    reflections.sync(source.current, scene.getObjectByName('anticube-mirror-room'), camera, gl);
  });
  return <primitive object={reflections.group} dispose={null} />;
}
