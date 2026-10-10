import React, { useContext, useLayoutEffect, useRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { getFlipPortalGeometry, flipPortalData } from '../../3d/flipPortal.js';
import { MenuFlipPortalContext } from './menuPortalContext.js';

// The same opaque portal as Flip Cube and WORM. Mutable instance data lets the
// tap wave change faces without React renders, per-tile materials or frame loops.
const MenuTileOverlay = React.forwardRef(({ colorHex, homeColorHex, visible = true }, ref) => {
  const { pool, material } = useContext(MenuFlipPortalContext);
  const anchor = useRef();
  const color = useRef(new THREE.Color(colorHex));
  const data = useRef(flipPortalData(homeColorHex, 1, 0));
  const seed = useRef(-1e6);
  useLayoutEffect(() => {
    color.current.set(colorHex);
    data.current = flipPortalData(homeColorHex, 1, 0);
  }, [colorHex, homeColorHex]);
  useLayoutEffect(() => pool.register(anchor.current, getFlipPortalGeometry(), material, color, seed, data), [pool, material]);
  useImperativeHandle(ref, () => ({
    setFace(hex, shown, start) {
      color.current.set(hex);
      anchor.current.visible = shown;
      if (start !== undefined) seed.current = start;
    }
  }), []);
  return <group name="MenuFlipPortal" ref={anchor} visible={visible} />;
});
MenuTileOverlay.displayName = 'MenuTileOverlay';
export default MenuTileOverlay;
