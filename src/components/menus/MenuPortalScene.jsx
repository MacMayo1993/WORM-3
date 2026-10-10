import React, { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { createMenuPortalFrames, updateMenuPortalFrames } from './menuPortalFrames.js';
import { MENU_PORTAL_OVERLAY_Z } from './menuCenterPortals.js';
import { createSurfaceBatches } from '../../3d/surfaceBatches.js';
import { createFlipPortalMaterial } from '../../3d/flipPortal.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { isCarouselActive } from './menuCarouselState.js';
import { MenuPortalContext, MenuFlipPortalContext } from './menuPortalContext.js';

export function MenuPortalScene({ children }) {
  const root = useRef();
  const frames = useMemo(() => createMenuPortalFrames(), []);
  const portals = useMemo(() => {
    const time = { value: 0 }, motion = { value: 1 };
    return { pool: createSurfaceBatches(54), material: createFlipPortalMaterial(time, motion), time, motion };
  }, []);
  useLayoutEffect(() => () => { portals.pool.dispose(); portals.material.dispose(); }, [portals]);
  useFrame(({ clock }) => {
    portals.time.value = clock.elapsedTime;
    portals.motion.value = prefersReducedMotion() || useGameStore.getState().settings?.reducedMotion ? 0 : 1;
    portals.pool.group.visible = !isCarouselActive();
    portals.pool.update();
  });
  // After pad springs (-0.5) and sticker flips (-0.35), before worm sampling (0).
  useFrame(() => updateMenuPortalFrames(root.current, frames), -0.25);
  return <MenuPortalContext.Provider value={frames}><MenuFlipPortalContext.Provider value={portals}><group ref={root}>{children}<primitive object={portals.pool.group} /></group></MenuFlipPortalContext.Provider></MenuPortalContext.Provider>;
}

export function MenuPortalAnchor({ dir, children }) {
  const frames = useContext(MenuPortalContext);
  const ref = useRef();
  useLayoutEffect(() => {
    const frame = frames.find(item => item.dir === dir);
    const node = ref.current;
    frame.node = node;
    return () => { if (frame.node === node) frame.node = null; };
  }, [frames, dir]);
  return <group ref={ref} position={[0, 0, MENU_PORTAL_OVERLAY_Z]}>{children}</group>;
}
