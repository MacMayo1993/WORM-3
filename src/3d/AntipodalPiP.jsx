// src/3d/AntipodalPiP.jsx
/**
 * AntipodalPiP — Picture-in-Picture second camera view.
 *
 * Renders the scene from the antipodal position of the main camera
 * (i.e. camera.position negated through the origin) into a scissored
 * viewport region in the top-left corner of the canvas.
 *
 * Because this component uses useFrame with priority 1, R3F's auto-render
 * is disabled and this component takes over the full render loop — calling
 * gl.render() for both the main view and the PiP overlay every frame.
 *
 * Coordinate note: Three.js scissor/viewport use bottom-left origin,
 * the inverse of CSS (top-left origin). The math below compensates.
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';

// PiP dimensions in CSS pixels
const PIP_W = 240;
const PIP_H = 180;
const PIP_MARGIN_LEFT = 8;
const PIP_MARGIN_TOP = 56; // 48px top-bar + 8px gap

export default function AntipodalPiP({ enabled }) {
  const { camera } = useThree();
  const pipCamRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

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

  // Priority 1 — disables R3F auto-render; we drive both passes manually
  useFrame(({ gl, scene, camera: mainCam }) => {
    const pipCam = pipCamRef.current;
    const dpr = gl.getPixelRatio();
    const cW = gl.domElement.width;
    const cH = gl.domElement.height;

    if (!enabledRef.current || !pipCam) {
      // PiP off — just do the normal main render
      gl.autoClear = true;
      gl.setViewport(0, 0, cW, cH);
      gl.setScissorTest(false);
      gl.render(scene, mainCam);
      return;
    }

    // ── 1. Main render — full viewport ──────────────────────────────────────
    gl.autoClear = true;
    gl.setScissorTest(false);
    gl.setViewport(0, 0, cW, cH);
    gl.render(scene, mainCam);

    // ── 2. PiP render — antipodal camera into scissored region ─────────────
    // Position antipodal camera: negate main camera position through origin
    pipCam.position.set(
      -mainCam.position.x,
      -mainCam.position.y,
      -mainCam.position.z
    );
    pipCam.lookAt(0, 0, 0);
    pipCam.fov = mainCam.fov;
    pipCam.updateProjectionMatrix();

    // Convert CSS pixel region to physical pixels (WebGL bottom-left origin)
    const pipW = Math.floor(PIP_W * dpr);
    const pipH = Math.floor(PIP_H * dpr);
    const x = Math.floor(PIP_MARGIN_LEFT * dpr);
    // In WebGL: y=0 is bottom, so top-left CSS maps to (x, cH - cssTop - cssH)
    const y = Math.floor(cH - PIP_MARGIN_TOP * dpr - pipH);

    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.setScissor(x, y, pipW, pipH);
    gl.setViewport(x, y, pipW, pipH);
    gl.clearDepth();
    gl.render(scene, pipCam);

    // ── Restore state ───────────────────────────────────────────────────────
    gl.setScissorTest(false);
    gl.autoClear = true;
    gl.setViewport(0, 0, cW, cH);
  }, 1);

  return null;
}
