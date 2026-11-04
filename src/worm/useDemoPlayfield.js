import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../hooks/useGameStore.js';

// The camera's aim belongs in the clear space between the two docks, not
// behind the taller top lesson card. Shift projection, never the gameplay pose;
// picking and tunnel geometry continue to use the same camera.
export function demoPlayfieldOffset(height, topBottom = 0, trayTop = height) {
  const top = Math.min(height * 0.5, Math.max(0, topBottom));
  const bottom = Math.min(height * 0.4, Math.max(0, height - trayTop));
  return Math.round((bottom - top) / 2);
}

export default function useDemoPlayfield() {
  const active = useGameStore(s => s.demoMode && s.demoStep === 'worm-traversal' && !s.captureMode);
  const { camera, size: { width, height } } = useThree();
  useEffect(() => {
    if (!active) return undefined;
    let offset;
    const update = () => {
      const top = document.querySelector('.worm-hud-top');
      const tray = document.querySelector('.worm-hud-bottom');
      const next = demoPlayfieldOffset(height, top?.getBoundingClientRect().bottom, tray?.getBoundingClientRect().top);
      if (next === offset) return;
      offset = next;
      if (next) camera.setViewOffset(width, height, 0, next, width, height);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    // The lazy HUD and lesson content may mount after the camera. Sampling also
    // handles font loading, text zoom and scene changes without DOM reads per frame.
    update();
    const timer = setInterval(update, 250);
    return () => {
      clearInterval(timer);
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
  }, [active, camera, width, height]);
}
