import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { createProjectiscopeDome, DOME_DRIFT_SPEED } from './dome.js';
import { PROJECTISCOPE_URL, projectiscopeConfig } from './design.js';
import { createGpuArt } from './gpuRenderer.js';

// The creator supplies seeded curves once; GPU geometry animates those curves.
// Only the unchanging custom drawing/mirrors use a one-time canvas upload.
export function createProjectiscopeBackground(scene, design, gl) {
  const frame = document.createElement('iframe');
  frame.title = 'Projectiscope background renderer';
  frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: '1024px', height: '1024px', border: '0', pointerEvents: 'none' });
  let texture, art, dome, disposed = false, reduced = false;
  let motionAt, elapsed = 0;
  const message = e => {
    if (disposed || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    if (e.data?.type === 'projectiscope:ready') frame.contentWindow.postMessage(projectiscopeConfig(design, true), location.origin);
    if (e.data?.type !== 'projectiscope:configured' || texture) return;
    const api = frame.contentWindow.__projectiscope;
    if (!api) return;
    const { model, canvas } = api.gpuBackground();
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width; snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);
    texture = new CanvasTexture(snapshot);
    texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    // Avoid retaining the detached iframe's objects or JS realm.
    art = createGpuArt(gl, structuredClone(model), reduced);
    dome = createProjectiscopeDome(art.texture, texture);
    scene.add(dome);
    window.removeEventListener('message', message);
    frame.remove();
  };
  window.addEventListener('message', message);
  frame.src = `${PROJECTISCOPE_URL}#background=1`;
  document.body.appendChild(frame);
  return {
    update(now, paused, camera, reducedEffects = false) {
      if (disposed) return;
      reduced = reducedEffects;
      const dt = motionAt == null ? 0 : Math.min(0.05, Math.max(0, (now - motionAt) / 1000));
      motionAt = now;
      // Camera-relative position, world-relative orientation: looking around
      // reveals the dome instead of dragging a flat picture with the viewport.
      if (dome) {
        camera?.getWorldPosition(dome.position);
        if (!paused) {
          elapsed += dt;
          dome.rotation.y += dt * DOME_DRIFT_SPEED;
          dome.rotation.x = 0.35 + Math.sin(elapsed * 0.11) * 0.10;
          dome.rotation.z = 0.15 + Math.sin(elapsed * 0.07) * 0.08;
        }
        if (art.update(now, elapsed, paused, reducedEffects)) dome.material.uniforms.designMap.value = art.texture;
      }
    },
    dispose() {
      disposed = true; window.removeEventListener('message', message);
      if (dome) { scene.remove(dome); dome.geometry.dispose(); dome.material.dispose(); }
      art?.dispose(); texture?.dispose(); frame.remove();
    },
  };
}
