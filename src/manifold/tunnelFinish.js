// The intro's spiral light and spaced ribs, filtered for small in-game bands.
// All finish animation is shader-only; it never displaces the travel surface.
export const tunnelFinishGLSL = `
  float tunnelLine(float phase, float width) {
    float aa = max(fwidth(phase), 0.002);
    float d = abs(fract(phase + 0.5) - 0.5);
    return (1.0 - smoothstep(width, width + aa, d))
      * (1.0 - smoothstep(0.12, 0.4, aa));
  }
  float tunnelSpiral(float distance, float across, float time, float width) {
    return tunnelLine(distance * 1.1 - across * 0.7 - time * 0.16, width);
  }
  vec3 tunnelSatin(vec3 base, vec3 normal, vec3 view, vec2 uv, float distance, float time) {
    vec3 n = faceforward(normalize(normal), -view, normalize(normal));
    vec3 key = normalize(vec3(0.4, 0.85, 0.6));
    float light = 0.64 + 0.3 * max(0.0, dot(n, key));
    float gloss = pow(max(0.0, dot(n, normalize(key + view))), 36.0);
    float spiral = tunnelSpiral(distance, uv.x, time, 0.06);
    float edgeDistance = min(uv.x, 1.0 - uv.x);
    float edge = 1.0 - smoothstep(0.018, 0.05, edgeDistance);
    vec3 pearl = mix(base, vec3(0.9, 0.96, 1.0), 0.38);
    vec3 color = base * light + pearl * (gloss * 0.24 + spiral * 0.075);
    return mix(color, pearl * (0.66 + gloss * 0.25), edge * 0.8);
  }
`;
