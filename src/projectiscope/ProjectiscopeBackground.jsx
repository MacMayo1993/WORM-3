import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../hooks/useGameStore.js';
import { prefersReducedMotion } from '../utils/device.js';
import { createProjectiscopeBackground } from './backgroundRenderer.js';

export default function ProjectiscopeBackground({ design }) {
  const scene = useThree(s => s.scene), gl = useThree(s => s.gl), renderer = useRef(null);
  useEffect(() => {
    const instance = createProjectiscopeBackground(scene, design, gl);
    renderer.current = instance;
    return () => { renderer.current = null; instance.dispose(); };
  }, [scene, design, gl]);
  useFrame(({ camera }) => {
    const s = useGameStore.getState();
    renderer.current?.update(performance.now(), document.hidden || prefersReducedMotion() ||
      s.projectiscopeEditing || s.showSettings || s.wormPaused && s.wormHealerMode, camera, s.perfReducedFX);
  });
  return null;
}
