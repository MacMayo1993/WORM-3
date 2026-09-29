import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { createProjectiscopeDome, DOME_DRIFT_SPEED } from './dome.js';
import { PROJECTISCOPE_URL, projectiscopeConfig } from './design.js';

// One bounded 2D drawing surface feeds the existing WebGL renderer. The hidden
// document has no animation loop of its own: the game supplies its clock.
export function createProjectiscopeBackground(scene, design) {
  const frame = document.createElement('iframe');
  frame.title = 'Projectiscope background renderer';
  frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: '1024px', height: '1024px', border: '0', pointerEvents: 'none' });
  let texture, dome, canvas, api, revision, last = -Infinity, lastPaused, disposed = false;
  let motionAt, elapsed = 0;
  const message = e => {
    if (disposed || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    if (e.data?.type === 'projectiscope:ready') frame.contentWindow.postMessage(projectiscopeConfig(design), location.origin);
    if (e.data?.type !== 'projectiscope:configured' || texture) return;
    canvas = frame.contentDocument.getElementById('paint');
    api = frame.contentWindow.__projectiscope;
    if (!canvas || !api) return;
    texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    dome = createProjectiscopeDome(texture);
    scene.add(dome);
  };
  window.addEventListener('message', message);
  frame.src = `${PROJECTISCOPE_URL}#background=1`;
  document.body.appendChild(frame);
  return {
    update(now, paused, camera, reducedEffects = false) {
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
      // Keep dome drift smooth even when the CPU canvas or quality tier is slow.
      if (!api || now - last < (reducedEffects ? 500 : 125)) return;
      last = now;
      if (lastPaused !== paused) { api.setPaused(paused); lastPaused = paused; }
      api.stepBackground(now);
      if (canvas.dataset.frame !== revision) { revision = canvas.dataset.frame; texture.needsUpdate = true; }
    },
    dispose() {
      disposed = true; window.removeEventListener('message', message);
      if (dome) { scene.remove(dome); dome.geometry.dispose(); dome.material.dispose(); }
      texture?.dispose(); frame.remove();
    },
  };
}
