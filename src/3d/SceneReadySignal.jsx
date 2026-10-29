import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';

// Mount inside the scene's Suspense boundary, keyed by the incoming preview.
// Nested panorama/texture boundaries can still be loading after this mounts.
// Allow two rendered frames after they settle so GPU uploads and shader
// compilation happen under the cover, not on Mobi's first visible frame.
export default function SceneReadySignal({ token, onReady }) {
  const frames = useRef(0);
  const reported = useRef(false);
  useFrame(() => {
    if (reported.current) return;
    if (useProgress.getState().active) {
      frames.current = 0;
      return;
    }
    if (++frames.current < 3) return;
    reported.current = true;
    onReady(token);
  });
  return null;
}
