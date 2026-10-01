// Preview registries outlive the Canvas (including its error-boundary remounts).
// A lost context silently ignores renders/readbacks, leaving old pixels in the
// CPU buffer. Never publish those pixels as a new thumbnail.
export function previewContextAvailable(renderer) {
  return !!renderer && !renderer.getContext?.()?.isContextLost?.();
}

export function observePreviewContext(renderer, reset) {
  const canvas = renderer.domElement;
  const lost = event => {
    event.preventDefault(); // Allow the browser to restore this context.
    reset();
  };
  canvas?.addEventListener('webglcontextlost', lost);
  canvas?.addEventListener('webglcontextrestored', reset);
  return () => {
    canvas?.removeEventListener('webglcontextlost', lost);
    canvas?.removeEventListener('webglcontextrestored', reset);
  };
}
