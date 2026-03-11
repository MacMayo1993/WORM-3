// src/3d/AntipodalPiP.jsx
/**
 * AntipodalPiP — Picture-in-Picture second camera view.
 *
 * Renders the scene from the antipodal position of the main camera
 * (negated through the origin) into a scissored viewport in the top-left.
 *
 * Mount/unmount strategy: this component is only rendered when the PiP is
 * enabled. Keeping it always mounted (with priority 1) would suppress R3F's
 * auto-render even when the PiP is off, breaking touch-event raycasting on
 * mobile. By conditionally mounting, R3F resumes its own render loop when
 * the PiP is hidden.
 *
 * Coordinate note: Three.js setViewport/setScissor accept CSS pixels and
 * multiply by pixelRatio internally. DO NOT pre-multiply by dpr — pass
 * logical CSS values only.
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';

// PiP dimensions in CSS pixels
const PIP_W = 240;
const PIP_H = 180;
const PIP_MARGIN_LEFT = 8;
const PIP_GAP = 8; // gap below the top bar

// Top-bar height varies by viewport size — must match App.css breakpoints
function getTopBarHeight() {
  if (typeof window === 'undefined') return 56;
  if (window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches) return 36;
  if (window.matchMedia('(max-width: 768px)').matches) return 44;
  return 56;
}

export default function AntipodalPiP() {
  const { camera } = useThree();
  const pipCamRef = useRef(null);

  // Create the antipodal PerspectiveCamera once, matching main camera FOV
  useEffect(() => {
    const cam = new PerspectiveCamera(
      camera.fov,
      PIP_W / PIP_H,
      camera.near,
      camera.far
    );
    pipCamRef.current = cam;
  }, [camera.fov, camera.near, camera.far]);

  // Priority 1 — disables R3F auto-render; this component drives both passes.
  // Only mounted when PiP is enabled, so R3F resumes auto-render when hidden.
  useFrame(({ gl, scene, camera: mainCam }) => {
    const pipCam = pipCamRef.current;
    if (!pipCam) return;

    // Canvas size in CSS pixels (Three.js setViewport/setScissor expect CSS px)
    const dpr = gl.getPixelRatio();
    const cssW = gl.domElement.width / dpr;
    const cssH = gl.domElement.height / dpr;

    // ── 1. Main render — full canvas ─────────────────────────────────────────
    gl.autoClear = true;
    gl.setScissorTest(false);
    gl.setViewport(0, 0, cssW, cssH);
    gl.render(scene, mainCam);

    // ── 2. PiP render — antipodal camera into scissored region ───────────────
    pipCam.position.set(-mainCam.position.x, -mainCam.position.y, -mainCam.position.z);
    pipCam.lookAt(0, 0, 0);
    pipCam.fov = mainCam.fov;
    pipCam.updateProjectionMatrix();

    // Y is from canvas bottom (GL convention). Top-bar height varies by breakpoint.
    const topBarH = getTopBarHeight();
    const pipTop = topBarH + PIP_GAP; // CSS px from canvas top
    const x = PIP_MARGIN_LEFT;
    const y = cssH - pipTop - PIP_H; // CSS px from canvas bottom

    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.setScissor(x, y, PIP_W, PIP_H);
    gl.setViewport(x, y, PIP_W, PIP_H);
    gl.clearDepth();
    gl.render(scene, pipCam);

    // ── Restore ───────────────────────────────────────────────────────────────
    gl.setScissorTest(false);
    gl.autoClear = true;
    gl.setViewport(0, 0, cssW, cssH);
  }, 1);

  return null;
}
