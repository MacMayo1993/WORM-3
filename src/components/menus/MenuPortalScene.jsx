import React, { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { createMenuPortalFrames, updateMenuPortalFrames } from './menuPortalFrames.js';
import { MENU_PORTAL_OVERLAY_Z } from './menuCenterPortals.js';
import { MenuPortalContext } from './menuPortalContext.js';

export function MenuPortalScene({ children }) {
  const root = useRef();
  const frames = useMemo(() => createMenuPortalFrames(), []);
  // After pad springs (-0.5) and sticker flips (-0.35), before worm sampling (0).
  useFrame(() => updateMenuPortalFrames(root.current, frames), -0.25);
  return <MenuPortalContext.Provider value={frames}><group ref={root}>{children}</group></MenuPortalContext.Provider>;
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
