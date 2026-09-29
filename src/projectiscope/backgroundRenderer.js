import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { createProjectiscopeDome, DOME_DRIFT_SPEED } from './dome.js';
import { PROJECTISCOPE_URL, projectiscopeConfig } from './design.js';

// Bake the chosen artwork once, then move the dome in the existing renderer.
// Repainting paths, bloom and a megapixel texture during play steals frame time
// from the game. A parent-owned snapshot also lets us release the entire editor.
export function createProjectiscopeBackground(scene, design) {
  const frame = document.createElement('iframe');
  frame.title = 'Projectiscope background renderer';
  frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: '1024px', height: '1024px', border: '0', pointerEvents: 'none' });
  let texture, dome, disposed = false;
  let motionAt, elapsed = 0;
  const message = e => {
    if (disposed || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    if (e.data?.type === 'projectiscope:ready') frame.contentWindow.postMessage(projectiscopeConfig(design, true), location.origin);
    if (e.data?.type !== 'projectiscope:configured' || texture) return;
    const api = frame.contentWindow.__projectiscope;
    if (!api) return;
    const canvas = api.renderBackground();
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width; snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);
    texture = new CanvasTexture(snapshot);
    texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    dome = createProjectiscopeDome(texture);
    scene.add(dome);
    window.removeEventListener('message', message);
    frame.remove();
  };
  window.addEventListener('message', message);
  frame.src = `${PROJECTISCOPE_URL}#background=1`;
  document.body.appendChild(frame);
  return {
    update(now, paused, camera) {
      if (disposed) return;
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
      }
    },
    dispose() {
      disposed = true; window.removeEventListener('message', message);
      if (dome) { scene.remove(dome); dome.geometry.dispose(); dome.material.dispose(); }
      texture?.dispose(); frame.remove();
    },
  };
}
