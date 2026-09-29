import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { PROJECTISCOPE_URL, projectiscopeConfig } from './design.js';

// One bounded 2D drawing surface feeds the existing WebGL renderer. The hidden
// document has no animation loop of its own: the game supplies its clock.
export function createProjectiscopeBackground(scene, design) {
  const frame = document.createElement('iframe');
  frame.title = 'Projectiscope background renderer';
  frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: '512px', height: '512px', border: '0', pointerEvents: 'none' });
  let texture, canvas, api, revision, last = -Infinity, lastPaused, disposed = false;
  const previous = scene.background;
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
    scene.background = texture;
  };
  window.addEventListener('message', message);
  frame.src = `${PROJECTISCOPE_URL}#background=1`;
  document.body.appendChild(frame);
  return {
    update(now, paused) {
      if (!api || disposed || now - last < 125) return;
      last = now;
      if (lastPaused !== paused) { api.setPaused(paused); lastPaused = paused; }
      api.stepBackground(now);
      if (canvas.dataset.frame !== revision) { revision = canvas.dataset.frame; texture.needsUpdate = true; }
    },
    dispose() {
      disposed = true; window.removeEventListener('message', message);
      if (texture && scene.background === texture) scene.background = previous;
      texture?.dispose(); frame.remove();
    },
  };
}
