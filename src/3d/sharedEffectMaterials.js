// Effects that wait on every tile (the worm's footprint, the heal seal, the heal
// sparks) each owned a ShaderMaterial per tile: on a 15×15 that was ~4,000 of the
// scene's ~4,600 materials, all on three programs. Every material is a program
// lookup for renderer.compile (the run's warm-up walked them all in one frame of
// the scramble) and an entry in the renderer's bookkeeping. One material per
// effect now serves every tile. A tile keeps its own uniform values and copies
// them into the shared material just before its own draw, in its mesh's
// onBeforeRender, as tile styles bind their identity (tileStyleIdentity.js).
// Hidden effects are never drawn, so only the few tiles showing one pay the copy.

/** An onBeforeRender for a mesh that draws `uniforms` (its own) through a shared material. */
export function bindEffectUniforms(uniforms) {
  return function bindEffect(_renderer, _scene, _camera, _geometry, material) {
    const target = material.uniforms;
    if (!target) return;
    for (const name in uniforms) {
      const slot = target[name];
      if (!slot) continue;
      const value = uniforms[name].value;
      if (value !== null && typeof value === 'object' && typeof slot.value?.copy === 'function') slot.value.copy(value);
      else slot.value = value;
    }
    // Consecutive tiles draw the same material and program: force the upload.
    material.uniformsNeedUpdate = true;
  };
}
