import React from 'react';
import { Environment } from '@react-three/drei';
import useOptionalEnvironment from './useOptionalEnvironment.js';

// Optional HDR/EXR requests resolve to a map or null instead of suspending and
// throwing into React. Pending/failed reflections must never block gameplay.
export default function SafeEnvironment({ preset, files, path, map, ...props }) {
  const loaded = useOptionalEnvironment(map ? undefined : { preset, files, path });
  const texture = map || loaded;
  return texture ? <Environment {...props} map={texture} /> : null;
}
