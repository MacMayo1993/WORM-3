// A two-value contour inside the existing lit material. The dark outer edge
// separates a worm from bright stickers; the soft inner rim keeps it readable
// against dark tiles. It follows the actual surface, including instancing,
// skin displacement and tunnel poses, without an enlarged outline hull or
// another draw. The dark edge never thins below a pixel and a half, so the
// worm keeps its outline at phone size. Keep colour in linear space until
// Three's output conversion.
export function finishWormBodyShader(shader, strength = { value: 1 }) {
  shader.uniforms.uWormContourStrength = strength;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uWormContourStrength;')
    .replace('#include <opaque_fragment>', `
      float wormFacing = clamp(abs(dot(normal, geometryViewDir)), 0.0, 1.0);
      float wormInk = 1.0 - smoothstep(0.06, 0.34, wormFacing);
      // The band above is a share of the bead: ~6% of its radius, so under one
      // pixel once a bead is ~20 px across, which is a phone's whole play view.
      // Hold the ink a pixel and a half wide there instead. On a sphere the
      // distance to the silhouette in pixels is facing / (2 * fwidth(facing));
      // the unperturbed normal keeps skin bump out of the derivative, and a
      // flat face (books, MOBI) has no derivative, so it gains nothing.
      // (A flat-shaded skin has no smooth normal to read, and keeps the band.)
      #ifndef FLAT_SHADED
        float wormEdgeFacing = clamp(abs(dot(normalize(vNormal), geometryViewDir)), 0.0, 1.0);
        float wormEdgePx = 0.5 * wormEdgeFacing / max(fwidth(wormEdgeFacing), 0.0001);
        wormInk = max(wormInk, 1.0 - smoothstep(0.8, 1.8, wormEdgePx));
      #endif
      float wormRim = smoothstep(0.12, 0.32, wormFacing)
        * (1.0 - smoothstep(0.38, 0.70, wormFacing));
      outgoingLight = mix(outgoingLight, diffuseColor.rgb * 0.055,
        wormInk * 0.82 * uWormContourStrength);
      outgoingLight += (vec3(0.045) + diffuseColor.rgb * 0.16)
        * wormRim * uWormContourStrength;
      #include <opaque_fragment>`);
}
