// Constellations need to read as colored tiles on the 15×15 Mega Storm deck,
// not a single-color deck with sub-pixel glitter. A face-color frame and calm
// center preserve tile identity around broad cyan/violet aurora insets.
export const CONSTELLATION_SURFACE = Object.freeze({
  colorFloor: 0.5,
  colorLift: 0.22,
  auroraMix: 0.84,
  centerMix: 0.24,
  frameWidth: 0.08,
  frameFeather: 0.02,
  centerRadius: 0.16,
  centerFeather: 0.06,
  cyan: Object.freeze([0.08, 0.82, 0.94]),
  violet: Object.freeze([0.62, 0.25, 0.96]),
  starGrid: 2
});

const glVec3 = values => `vec3(${values.map(value => value.toFixed(2)).join(', ')})`;

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
    // Batched identity arrives as an interpolated varying. Round it before the
    // sensitive hash, or perspective interpolation turns a star into speckle.
    // The integer identity still follows the physical sticker through turns.
    vec3 home = floor(tileHome + 0.5);
    float face = floor(tileFace + 0.5);
    vec2 seed = home.xy * 1.37 + vec2(home.z * 3.11, face * 7.13);
    float phase = cHash(seed + 4.7) * 6.28318;
    float t = time * (1.0 - step(0.5, reducedMotion));
    vec2 uv = vUv * ${CONSTELLATION_SURFACE.starGrid.toFixed(1)};
    vec2 cell = floor(uv);
    vec2 loc = fract(uv) - 0.5;
    vec2 spos = cStar(cell, seed);
    float bri = cHash(cell + seed + vec2(5.1, 9.4));
    float dist = length(loc - spos);
    float aa = max(fwidth(dist), 0.008);
    float star = (1.0 - smoothstep(0.035 - aa, 0.085 + aa, dist))
      * (0.7 + 0.3 * bri);

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

    // Broad color survives the shallow chase view. The perimeter stays entirely
    // face-colored, and a quiet center anchors the worm and pickup silhouettes.
    float curtain = 0.5 + 0.5 * sin(vUv.y * 5.5 + vUv.x * 2.2 + phase + t * 0.1);
    float crossGlow = 0.5 + 0.5 * sin(vUv.x * 4.0 - vUv.y * 2.7 + phase - t * 0.08);
    float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float inset = smoothstep(${(CONSTELLATION_SURFACE.frameWidth - CONSTELLATION_SURFACE.frameFeather).toFixed(2)}, ${(CONSTELLATION_SURFACE.frameWidth + CONSTELLATION_SURFACE.frameFeather).toFixed(2)}, edgeDistance);
    float center = 1.0 - smoothstep(${(CONSTELLATION_SURFACE.centerRadius - CONSTELLATION_SURFACE.centerFeather).toFixed(2)}, ${(CONSTELLATION_SURFACE.centerRadius + CONSTELLATION_SURFACE.centerFeather).toFixed(2)}, length(vUv - 0.5));
    vec3 field = baseColor * (${CONSTELLATION_SURFACE.colorFloor.toFixed(2)} + ${CONSTELLATION_SURFACE.colorLift.toFixed(2)} * curtain);
    vec3 aurora = mix(${glVec3(CONSTELLATION_SURFACE.cyan)}, ${glVec3(CONSTELLATION_SURFACE.violet)}, smoothstep(0.2, 0.8, crossGlow));
    field = mix(field, aurora, inset * mix(${CONSTELLATION_SURFACE.auroraMix.toFixed(2)}, ${CONSTELLATION_SURFACE.centerMix.toFixed(2)}, center));
    // Four stable stars, not a field of blinking white points. Leave the frame
    // unmarked and soften the chart under the playable center of each tile.
    float chart = inset * (1.0 - center * 0.8);
    vec3 linkColor = mix(aurora, vec3(0.85, 0.94, 1.0), 0.56);
    vec3 starColor = vec3(1.0, 0.96, 0.82);
    vec3 col = mix(field, linkColor, min(line * 0.24, 0.3) * chart);
    col = mix(col, starColor, star * chart);
    gl_FragColor = vec4(col, 1.0);
  }
`;
