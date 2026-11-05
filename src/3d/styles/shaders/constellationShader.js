// Constellations need to read as colored tiles on the 15×15 Mega Storm deck,
// not six almost-black faces with sub-pixel stars. Keep the face hue dominant,
// put restrained aurora color at the edges, and leave room for pickup highlights.
export const CONSTELLATION_SURFACE = Object.freeze({
  colorFloor: 0.5,
  colorLift: 0.22,
  auroraMix: 0.18,
  starGrid: 3
});

export const constellationFragmentShader = `
  uniform vec3 baseColor;
  uniform vec3 tileHome;
  uniform float tileFace;
  uniform float time;
  uniform float reducedMotion;
  varying vec2 vUv;

  float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec2 cStar(vec2 cell, vec2 seed) {
    return (vec2(cHash(cell + seed), cHash(cell + seed + vec2(17.3, 3.7))) - 0.5) * 0.68;
  }

  void main() {
    // A map belongs to its physical sticker, including while a layer turns.
    vec2 seed = tileHome.xy * 1.37 + vec2(tileHome.z * 3.11, tileFace * 7.13);
    float phase = cHash(seed + 4.7) * 6.28318;
    float t = time * (1.0 - step(0.5, reducedMotion));
    vec2 uv = vUv * ${CONSTELLATION_SURFACE.starGrid.toFixed(1)};
    vec2 cell = floor(uv);
    vec2 loc = fract(uv) - 0.5;
    vec2 spos = cStar(cell, seed);
    float bri = cHash(cell + seed + vec2(5.1, 9.4));
    float dist = length(loc - spos);
    float aa = max(fwidth(dist), 0.008);
    float twinkle = 0.92 + 0.08 * sin(t * 0.7 + bri * 6.28318);
    float star = (1.0 - smoothstep(0.035 - aa, 0.085 + aa, dist))
      * (0.7 + 0.3 * bri) * twinkle;

    float line = 0.0;
    // Four neighbors, rather than eight: a lighter, less tangled star chart.
    // Both ends hash the same midpoint so links cross cell boundaries cleanly.
    for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
      for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
        if (abs(dx) + abs(dy) < 0.5 || abs(dx) + abs(dy) > 1.5) continue;
        vec2 nc = cell + vec2(dx, dy);
        vec2 npos = cStar(nc, seed) + vec2(dx, dy);
        float connected = step(0.48, cHash((cell + nc) * 0.5 + seed));
        vec2 pa = loc - spos;
        vec2 ba = npos - spos;
        float along = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float distanceToLine = length(pa - ba * along);
        float lineAA = max(fwidth(distanceToLine), 0.008);
        line += (1.0 - smoothstep(0.012, 0.025 + lineAA, distanceToLine)) * connected;
      }
    }

    // Broad, slow curtains survive the small tile footprint. Accent colors stay
    // near the rim; the center remains the face color under the worm and orbs.
    float curtain = 0.5 + 0.5 * sin(vUv.y * 5.5 + vUv.x * 2.2 + phase + t * 0.1);
    float crossGlow = 0.5 + 0.5 * sin(vUv.x * 4.0 - vUv.y * 2.7 + phase - t * 0.08);
    float edge = smoothstep(0.16, 0.5, length(vUv - 0.5));
    vec3 field = baseColor * (${CONSTELLATION_SURFACE.colorFloor.toFixed(2)} + ${CONSTELLATION_SURFACE.colorLift.toFixed(2)} * curtain);
    vec3 aurora = mix(vec3(0.12, 0.8, 0.72), vec3(0.52, 0.27, 0.88), crossGlow);
    field = mix(field, aurora, ${CONSTELLATION_SURFACE.auroraMix.toFixed(2)} * edge * curtain);
    vec3 linkColor = mix(baseColor, vec3(0.65, 0.88, 1.0), 0.5);
    vec3 starColor = mix(baseColor, vec3(1.0, 0.96, 0.82), 0.82);
    vec3 col = mix(field, linkColor, min(line * 0.28, 0.35));
    col = mix(col, starColor, star);
    gl_FragColor = vec4(col, 1.0);
  }
`;
