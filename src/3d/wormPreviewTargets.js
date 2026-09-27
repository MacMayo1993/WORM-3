import { HalfFloatType, UnsignedByteType, LinearFilter, NearestFilter, RGBAFormat } from 'three';

// Renderability, filtering and multisampling are separate capabilities. Keep
// half-float precision even when a device can only sample it with NEAREST.
export function wormPreviewTargetOptions(renderer) {
  const webgl2 = renderer?.capabilities?.isWebGL2 === true;
  const has = name => renderer?.extensions?.has?.(name) === true;
  const halfFloat = webgl2
    ? has('EXT_color_buffer_float') || has('EXT_color_buffer_half_float')
    : has('OES_texture_half_float') && has('EXT_color_buffer_half_float');
  const type = halfFloat ? HalfFloatType : UnsignedByteType;
  const filter = !halfFloat || webgl2 || has('OES_texture_half_float_linear') ? LinearFilter : NearestFilter;
  let samples = 0;
  const gl = renderer?.getContext?.();
  if (webgl2 && gl?.getInternalformatParameter) {
    try {
      const colorSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, halfFloat ? gl.RGBA16F : gl.RGBA8, gl.SAMPLES);
      // Three r159 uses DEPTH_COMPONENT24 for this target's default depth
      // renderbuffer. All attachments must support the same sample count.
      const depthSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES);
      const limit = Math.min(4, renderer.capabilities.maxSamples ?? 0);
      for (const count of colorSamples ?? []) {
        if (count > samples && count <= limit && depthSamples?.includes(count)) samples = count;
      }
    } catch {
      // If the driver cannot report format support, use a single-sample FBO.
    }
  }
  return { format: RGBAFormat, type, minFilter: filter, magFilter: filter, samples };
}
