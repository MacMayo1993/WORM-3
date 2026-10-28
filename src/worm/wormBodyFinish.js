// A two-value contour inside the existing lit material. The dark outer edge
// separates a worm from bright stickers; the soft inner rim keeps it readable
// against dark tiles. It follows the actual surface, including instancing,
// skin displacement and tunnel poses, without an enlarged outline hull or
// another draw. Keep colour in linear space until Three's output conversion.
export function finishWormBodyShader(shader, strength = { value: 1 }) {
  shader.uniforms.uWormContourStrength = strength;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uWormContourStrength;')
    .replace('#include <opaque_fragment>', `
      float wormFacing = clamp(abs(dot(normal, geometryViewDir)), 0.0, 1.0);
      float wormInk = 1.0 - smoothstep(0.06, 0.34, wormFacing);
      float wormRim = smoothstep(0.12, 0.32, wormFacing)
        * (1.0 - smoothstep(0.38, 0.70, wormFacing));
      outgoingLight = mix(outgoingLight, diffuseColor.rgb * 0.055,
        wormInk * 0.82 * uWormContourStrength);
      outgoingLight += (vec3(0.045) + diffuseColor.rgb * 0.16)
        * wormRim * uWormContourStrength;
      #include <opaque_fragment>`);
}
