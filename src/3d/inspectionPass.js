import { Color, LinearFilter, RGBAFormat, UnsignedByteType, Vector4, WebGLRenderTarget } from 'three';

// Every device supports this baseline: no floating-point filtering or MSAA
// assumptions. The normal main-scene renderer still performs its own AA.
export function createInspectionTarget(size) {
  return new WebGLRenderTarget(size, size, {
    type: UnsignedByteType, format: RGBAFormat, minFilter: LinearFilter,
    magFilter: LinearFilter, samples: 0, generateMipmaps: false,
  });
}

export function renderInspectionPass(renderer, scene, camera, target, hidden = [], shown = []) {
  const oldTarget = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace?.() ?? 0, level = renderer.getActiveMipmapLevel?.() ?? 0;
  const viewport = renderer.getViewport(new Vector4()), scissor = renderer.getScissor(new Vector4());
  const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
  const clear = renderer.getClearColor(new Color()), alpha = renderer.getClearAlpha();
  const xr = renderer.xr.enabled, shadowUpdate = renderer.shadowMap.autoUpdate;
  const visibility = new Map([...hidden, ...shown].filter(Boolean).map(object => [object, object.visible]));
  try {
    for (const object of hidden) if (object) object.visible = false;
    for (const object of shown) if (object) object.visible = true;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = true;
    renderer.setRenderTarget(target);
    renderer.setScissorTest(false);
    renderer.setClearColor(0x142d2b, 1);
    renderer.clear();
    renderer.render(scene, camera);
  } finally {
    for (const [object, visible] of visibility) object.visible = visible;
    renderer.setRenderTarget(oldTarget, face, level);
    renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
    renderer.setClearColor(clear, alpha);
    renderer.autoClear = autoClear;
    renderer.xr.enabled = xr;
    renderer.shadowMap.autoUpdate = shadowUpdate;
  }
}
