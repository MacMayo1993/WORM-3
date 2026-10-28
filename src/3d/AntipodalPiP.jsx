import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, PerspectiveCamera, Vector3 } from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { currentExplosion } from '../worm/wormExpansion.js';
import { raisedCubieExtent } from './raisedCubieMotion.js';
import { antipodalViewport, antipodalScissor } from './antipodalViewport.js';
import { createStudioRigPass } from './studioRig.js';

export default function AntipodalPiP() {
  const rig = useMemo(() => ({ camera: new PerspectiveCamera(), point: new Vector3(), color: new Color(), cube: null, nextBounds: 0 }), []);
  useEffect(() => () => { antipodalViewport.cube = null; }, []);
  // The rig turned to this window's camera, with shadows of its own (studioRig.js).
  const rigPass = useMemo(() => createStudioRigPass(), []);
  useEffect(() => () => rigPass.dispose(), [rigPass]);

  // Priority 1 takes over R3F rendering. Always draw the main pass, including
  // while the DOM panel is folded, hidden by a lesson, or absent in Capture.
  useFrame(({ gl, scene, camera: main, clock }) => {
    const dpr = gl.getPixelRatio();
    const width = gl.domElement.width / dpr, height = gl.domElement.height / dpr;
    gl.autoClear = true;
    gl.setScissorTest(false);
    gl.setViewport(0, 0, width, height);
    // Whether shadows are redrawn this frame: the main pass clears the request.
    const shadowRefresh = gl.shadowMap.autoUpdate || gl.shadowMap.needsUpdate;
    gl.render(scene, main);

    const state = useGameStore.getState();
    const size = state.size || 3;
    const amount = Math.max(currentExplosion(state), state.wormHealerMode ? 0 : raisedCubieExtent());
    const half = (size - 1) * cubeExpansionScale(size, amount) / 2 + 0.65;
    if (!rig.cube?.parent) rig.cube = scene.getObjectByName('game-cube');
    const worldCorner = i => {
      rig.point.set(i & 1 ? half : -half, i & 2 ? half : -half, i & 4 ? half : -half);
      if (rig.cube) rig.point.applyMatrix4(rig.cube.matrixWorld);
      return rig.point;
    };
    if (clock.elapsedTime >= rig.nextBounds) {
      rig.nextBounds = clock.elapsedTime + 0.2;
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, inside = false;
      for (let i = 0; i < 8; i++) {
        const p = worldCorner(i).applyMatrix4(main.matrixWorldInverse);
        if (p.z >= -main.near) { inside = true; break; }
        p.applyMatrix4(main.projectionMatrix);
        const x = (p.x + 1) / 2, y = (1 - p.y) / 2;
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      antipodalViewport.cube = inside ? { x: 0, y: 0, width: 1, height: 1 }
        : { x: left, y: top, width: right - left, height: bottom - top };
    }
    if (state.captureMode || state.showWelcome || state.showMainMenu || state.showSettings || state.showHelp) { rigPass.idle(); return; }
    const view = antipodalScissor(antipodalViewport.rect, antipodalViewport.canvas, width, height);
    if (!view) { rigPass.idle(); return; }

    const camera = rig.camera;
    main.getWorldPosition(camera.position).negate();
    camera.up.copy(main.up);
    camera.near = main.near; camera.far = main.far;
    camera.aspect = view.width / view.height;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    // Keep the exact antipodal position, but fit the cube to the small window
    // instead of inheriting a phone's wide field of view and showing a tiny dot.
    let tangent = 0, canFit = true;
    for (let i = 0; i < 8; i++) {
      const p = worldCorner(i).applyMatrix4(camera.matrixWorldInverse);
      if (p.z >= -camera.near) { canFit = false; break; }
      tangent = Math.max(tangent, Math.abs(p.y / p.z), Math.abs(p.x / p.z) / camera.aspect);
    }
    camera.fov = canFit && tangent > 0 ? Math.min(120, Math.max(12, 2 * Math.atan(tangent * 1.12) * 180 / Math.PI)) : main.fov;
    camera.updateProjectionMatrix();

    gl.getClearColor(rig.color);
    const alpha = gl.getClearAlpha();
    try {
      gl.autoClear = false;
      gl.setScissorTest(true);
      gl.setScissor(view.x, view.y, view.width, view.height);
      gl.setViewport(view.x, view.y, view.width, view.height);
      gl.setClearColor('#e8e3d0', 1);
      gl.clear(true, true, true); // Clear color too, so the main cube cannot bleed through.
      // The far side is lit as the near side is: the studio rig turns to this
      // camera for its pass, with its own shadows, then back to the main one.
      rigPass.begin(gl, camera.quaternion, shadowRefresh);
      gl.render(scene, camera);
    } finally {
      rigPass.end(main.quaternion);
      gl.setClearColor(rig.color, alpha);
      gl.setScissorTest(false);
      gl.autoClear = true;
      gl.setViewport(0, 0, width, height);
    }
  }, 1);
  return null;
}
