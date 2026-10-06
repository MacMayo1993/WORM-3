// Crafted — real-world sticker materials: stone, glass, metal, fibre, wood and
// shell, each dyed in the face's own colour.
//
// Most of them are cut from one slab per face (craftGlsl.js), so a solved face
// reads as a single piece of marble, one Damascus billet, one mosaic picture,
// and a scrambled face shows the pieces out of place. The artwork still travels
// with the sticker: it is keyed to the tile's home, not to where it is now.
//
// Assembled from standalone templates (no interpolation) so the build's shader
// compaction still strips their comments and indentation.

import { CRAFT_GLSL, CHIPS_GLSL, BORDERS_GLSL } from './craftGlsl.js';

const CRAFT = `
  uniform vec3 baseColor;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
` + CRAFT_GLSL;

const ANTIPODAL = `
  uniform vec3 antipodalColor;
`;

const ANIMATED = `
  uniform float time;
`;

const bodies = {
  // Veined marble: a warped field whose level sets are the veins, with hairline
  // veins of the partner face's colour running across them.
  marble: [true, false, [], `
    void main() {
      vec2 p = crSlab() * 0.9;
      vec2 w = vec2(crFbm(p * 0.7), crFbm(p * 0.7 + vec2(5.2, 1.3)));
      float f = crFbm(p * 0.6 + w * 1.6);
      float s = sin((p.x * 0.5 + p.y * 0.3 + f * 2.6) * 3.14159);
      float width = 0.04 + 0.1 * crNoise(p * 1.7);
      float vein = 1.0 - smoothstep(0.0, width + fwidth(s), abs(s));
      float halo = exp(-abs(s) * 6.0);
      float s2 = sin((p.y * 0.8 - p.x * 0.35 + f * 4.2) * 6.28318);
      float hair = crLine(s2, 0.045) * smoothstep(0.35, 0.6, crNoise(p * 2.3 + 4.0));
      float cloud = crFbm(p * 2.0 + w * 1.5);
      vec3 stone = mix(baseColor * 0.84, mix(baseColor, vec3(1.0), 0.45), cloud);
      stone = mix(stone, baseColor * 0.62, halo * 0.35);
      vec3 col = mix(stone, baseColor * 0.3, vein * 0.85);
      col = mix(col, mix(antipodalColor, vec3(1.0), 0.25), hair * 0.7 * (1.0 - vein));
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Terrazzo: angular chips of the partner colour, white and dark stone set in
  // a pale matrix of the face's own colour.
  terrazzo: [true, false, [CHIPS_GLSL], `
    void main() {
      vec2 p = crSlab();
      vec3 col = mix(baseColor, vec3(0.97, 0.95, 0.92), 0.45);
      col *= 0.95 + 0.08 * crNoise(p * 40.0);
      vec3 a = crChips(p * 3.4 + 11.0);
      float chipA = smoothstep(0.16, 0.16 + fwidth(a.x) * 1.5, a.x) * step(a.y, 0.55);
      vec3 tintA = a.z < 0.4 ? antipodalColor : (a.z < 0.72 ? baseColor * 0.5 : vec3(0.96, 0.95, 0.91));
      tintA *= 0.86 + 0.24 * crNoise(p * 22.0 + a.z * 10.0);
      col = mix(col, tintA, chipA);
      vec3 b = crChips(p * 9.0 + 3.0);
      float chipB = smoothstep(0.24, 0.24 + fwidth(b.x) * 1.5, b.x) * step(b.y, 0.4) * (1.0 - chipA);
      vec3 tintB = b.z < 0.5 ? mix(antipodalColor, vec3(1.0), 0.3) : baseColor * 0.4;
      col = mix(col, tintB, chipB);
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Kintsugi: glazed ceramic broken and mended with gold. The cracks run across
  // the whole face, so the seams join up only when the face is solved; a slow
  // glint travels along the gold.
  kintsugi: [false, true, [CHIPS_GLSL, BORDERS_GLSL], `
    void main() {
      vec2 p = crSlab();
      vec2 q = p * 1.5 + 0.3 * vec2(crNoise(p * 4.0), crNoise(p * 4.0 + 7.7));
      float d = crBorder(q).x;
      float seamW = 0.028 + 0.03 * crNoise(p * 5.0 + 2.0);
      float gold = 1.0 - smoothstep(seamW - fwidth(d), seamW + fwidth(d), d);
      vec3 glaze = mix(baseColor * 0.7, mix(baseColor, vec3(1.0), 0.22), crFbm(p * 2.4));
      float craze = crChips(p * 6.0 + 3.1).x;
      glaze *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.03 + fwidth(craze), craze));
      glaze *= 0.84 + 0.16 * smoothstep(seamW, seamW + 0.1, d);
      float bevel = 1.0 - clamp(d / seamW, 0.0, 1.0);
      float sweep = fract(dot(p, vec2(0.6, 0.8)) * 0.2 - time * 0.05);
      float glint = pow(max(0.0, 1.0 - abs(sweep - 0.5) * 6.0), 4.0);
      vec3 goldCol = vec3(0.86, 0.64, 0.24) * (0.7 + 0.5 * bevel) + vec3(1.0, 0.92, 0.62) * glint;
      gl_FragColor = vec4(mix(glaze, goldCol, gold), 1.0);
    }
  `],

  // Cloisonné: enamel fired between gold wires: a six-petal flower in the
  // partner colour inside a pale ring, quarter-medallions in every corner that
  // meet their neighbours' across the cube.
  cloisonne: [true, false, [], `
    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p), a = atan(p.y, p.x);
      float petalR = 0.24 * (0.55 + 0.45 * abs(cos(a * 3.0)));
      float slope = 0.324 * sin(a * 3.0) / max(r, 0.02);
      float dPetal = (r - petalR) / sqrt(1.0 + slope * slope);
      float sq = max(abs(p.x), abs(p.y));
      float rc = length(abs(p) - 0.5);
      float dWire = min(min(abs(sq - 0.43), abs(r - 0.33)), min(abs(dPetal), abs(r - 0.065)));
      dWire = min(dWire, abs(rc - 0.2));
      vec3 col = sq > 0.43 ? baseColor * 0.62 : baseColor;
      if (r < 0.33) col = mix(baseColor, vec3(1.0), 0.55);
      if (dPetal < 0.0) col = antipodalColor;
      if (r < 0.065) col = vec3(0.98, 0.96, 0.9);
      if (rc < 0.2) col = mix(antipodalColor, vec3(1.0), 0.3);
      col *= 0.9 + 0.14 * crNoise(p * 38.0 + tileHome.xy * 3.0);
      col *= 1.0 - 0.3 * step(0.988, crHash(floor(p * 70.0) + tileHome.yz));
      col *= 0.84 + 0.16 * smoothstep(0.0, 0.05, dWire);
      float wire = crLine(dWire, 0.012);
      float bev = 1.0 - clamp(dWire / 0.012, 0.0, 1.0);
      vec3 metal = vec3(0.88, 0.68, 0.3) * (0.72 + 0.4 * bev);
      gl_FragColor = vec4(mix(col, metal, wire), 1.0);
    }
  `],

  // Marquetry: tumbling blocks — the cube-from-a-corner parquetry — in three
  // cuts of a wood dyed the face's colour, strung with the partner colour.
  marquetry: [true, false, [], `
    float crRay(vec2 p, vec2 d) {
      return length(p - d * max(dot(p, d), 0.0));
    }
    void main() {
      vec2 p = crSlab() * 2.3;
      vec2 s = vec2(1.0, 1.7320508), h = s * 0.5;
      vec2 a = mod(p, s) - h, b = mod(p - h, s) - h;
      vec2 g = dot(a, a) < dot(b, b) ? a : b;
      vec2 cell = p - g;
      float ang = atan(g.y, g.x);
      vec3 wood;
      vec2 dir;
      if (ang > 0.5236 && ang < 2.618) {
        wood = mix(baseColor, vec3(0.95, 0.86, 0.68), 0.4);
        dir = vec2(1.0, 0.0);
      } else if (ang >= 2.618 || ang < -1.5708) {
        wood = baseColor * 0.78;
        dir = vec2(0.5, 0.8660254);
      } else {
        wood = mix(baseColor, vec3(0.22, 0.13, 0.07), 0.5);
        dir = vec2(-0.5, 0.8660254);
      }
      float along = dot(p, dir), across = dot(p, vec2(-dir.y, dir.x));
      float grain = 0.5 + 0.5 * sin(across * 38.0 + crNoise(vec2(along * 2.0, across * 5.0) + cell * 3.1) * 6.0);
      float fleck = crNoise(vec2(along * 1.2, across * 44.0) + cell);
      vec3 col = wood * (0.8 + 0.16 * grain + 0.1 * fleck);
      vec2 ag = abs(g);
      float hexEdge = 0.5 - max(ag.x, dot(ag, vec2(0.5, 0.8660254)));
      float ray = min(min(crRay(g, vec2(0.8660254, 0.5)), crRay(g, vec2(-0.8660254, 0.5))), crRay(g, vec2(0.0, -1.0)));
      float seam = min(hexEdge, ray);
      col = mix(col, wood * 0.35, crLine(seam, 0.03));
      col = mix(col, mix(antipodalColor, vec3(1.0), 0.15), crLine(seam, 0.014));
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Washi: dyed mulberry paper — cloudy thickness, long pale kozo fibres in two
  // layers, and a scatter of gold leaf.
  washi: [false, false, [CHIPS_GLSL], `
    float crFibres(vec2 p, float seed) {
      vec2 n = floor(p), f = fract(p);
      float m = 1.0;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 id = n + g + seed;
          vec2 v = f - g - crHash2(id);
          float an = crHash(id + 4.3) * 6.28318;
          vec2 dir = vec2(cos(an), sin(an));
          float t = clamp(dot(v, dir), -0.85, 0.85);
          vec2 side = vec2(-dir.y, dir.x) * sin(t * 2.6 + seed) * 0.07;
          m = min(m, length(v - dir * t - side));
        }
      }
      return m;
    }
    void main() {
      vec2 p = crSlab();
      vec3 col = mix(baseColor, vec3(0.98, 0.96, 0.9), 0.3);
      col *= 0.86 + 0.18 * crFbm(p * 3.0);
      float da = crFibres(p * 5.0, 0.0), db = crFibres(p * 8.0 + 3.7, 11.0);
      float fibre = max(crLine(da, 0.03), crLine(db, 0.024) * 0.7);
      fibre = max(fibre, 0.35 * exp(-min(da, db) * 22.0));
      col = mix(col, mix(col, vec3(1.0), 0.6), fibre * 0.8);
      vec3 leaf = crChips(p * 13.0);
      float gold = step(leaf.y, 0.07) * smoothstep(0.12, 0.2, leaf.x);
      vec3 goldCol = vec3(0.9, 0.72, 0.32) * (0.8 + 0.4 * leaf.z);
      gl_FragColor = vec4(mix(col, goldCol, gold), 1.0);
    }
  `],

  // Denim: 3/1 twill in the face's colour over pale weft, faded where it is
  // worn, hemmed with double rows of stitching in the partner colour.
  denim: [true, false, [], `
    void main() {
      vec2 t = vUv * 46.0;
      vec2 cell = floor(t), f = fract(t);
      float warpUp = step(0.5, mod(cell.x - cell.y, 4.0));
      float slub = crNoise(vec2(cell.x * 0.7 + tileHome.x * 13.0, t.y * 0.12));
      vec3 indigo = baseColor * (0.68 + 0.3 * slub);
      vec3 weft = mix(vec3(0.9, 0.88, 0.82), baseColor, 0.5);
      float curve = warpUp > 0.5 ? sin(f.x * 3.14159) : sin(f.y * 3.14159);
      vec3 col = mix(weft, indigo, warpUp) * (0.72 + 0.28 * curve);
      vec3 avg = mix(weft, indigo, 0.75) * 0.86;
      col = mix(col, avg, smoothstep(0.3, 0.7, fwidth(t.x)));
      float wear = crFbm(crSlab() * vec2(1.4, 4.0));
      col = mix(col, mix(col, vec3(0.92), 0.35), smoothstep(0.55, 0.85, wear));
      vec2 uv = vUv - 0.5;
      float sq = max(abs(uv.x), abs(uv.y));
      col *= 1.0 - 0.32 * smoothstep(0.42, 0.49, sq);
      float perim = abs(uv.x) > abs(uv.y) ? uv.y : uv.x;
      float dash = smoothstep(0.15, 0.25, fract(perim * 16.0 + sq * 4.0));
      dash *= smoothstep(0.95, 0.85, fract(perim * 16.0 + sq * 4.0));
      float stitch = max(crLine(sq - 0.385, 0.009), crLine(sq - 0.42, 0.009)) * dash;
      col = mix(col, mix(antipodalColor, vec3(1.0), 0.15), stitch);
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Knit: stockinette — rows of V stitches with a fair-isle band of diamonds in
  // the partner colour. Stitches are counted across the whole face, so the band
  // runs straight round a solved face.
  knit: [true, false, [], `
    float crLeg(vec2 f) {
      vec2 q = vec2(abs(f.x), f.y) - vec2(0.22, 0.52);
      q = mat2(0.906, 0.423, -0.423, 0.906) * q;
      return length(q / vec2(0.19, 0.5));
    }
    void main() {
      vec2 g = crFacePlane() * vec2(7.0, 9.0);
      vec2 cell = floor(g);
      vec2 f = fract(g) - vec2(0.5, 0.0);
      float e = crLeg(f);
      float eb = crLeg(f + vec2(0.0, 1.0));
      float ea = crLeg(f - vec2(0.0, 1.0));
      float row = cell.y;
      if (eb < e) { e = eb; row -= 1.0; }
      if (ea < e) { e = ea; row += 1.0; }
      float yarn = 1.0 - smoothstep(0.82, 1.0, e);
      float puff = sqrt(max(0.0, 1.0 - e * e));
      float r = mod(row, 14.0);
      float band = step(4.5, r) * step(r, 9.5);
      float diamond = step(abs(mod(cell.x, 6.0) - 2.5) + abs(r - 7.0), 2.6);
      float dots = (step(3.5, r) * step(r, 4.5) + step(9.5, r) * step(r, 10.5)) * mod(cell.x, 2.0);
      float motif = max(band * diamond, dots);
      vec3 wool = mix(baseColor, mix(antipodalColor, vec3(1.0), 0.1), motif);
      float fuzz = crNoise(g * vec2(9.0, 5.0));
      vec3 col = wool * (0.42 + 0.62 * puff + 0.1 * fuzz);
      col = mix(baseColor * 0.2, col, yarn);
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Mother of pearl: nacre's growth bands and platelets, whose interference
  // colours slide as the tile turns against the camera.
  motherOfPearl: [false, false, [CHIPS_GLSL], `
    void main() {
      vec2 p = crSlab() * 1.5;
      vec3 n = normalize(vWorldNormal);
      vec3 v = normalize(cameraPosition - vWorldPos);
      float ndv = clamp(dot(n, v), 0.0, 1.0);
      float warp = crFbm(p * 1.2);
      float bands = p.y * 3.0 + warp * 4.0 + sin(p.x * 2.0 + warp * 3.0) * 0.6;
      vec3 pl = crChips(p * 14.0);
      float film = fract(bands) * 0.55 + pl.y * 0.22 + (1.0 - ndv) * 1.3 + dot(v.xy, vec2(0.6, 0.4));
      vec3 irid = 0.5 + 0.5 * cos(6.28318 * (film + vec3(0.0, 0.33, 0.67)));
      vec3 pearl = mix(baseColor, vec3(1.0), 0.38);
      vec3 col = mix(pearl, pearl * (0.72 + 0.5 * irid), 0.42);
      col *= 0.88 + 0.12 * smoothstep(0.0, 0.1, pl.x);
      col += 0.07 * crLine(sin(bands * 6.28318), 0.08);
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Damascus steel: a folded billet's layers rippled by the forge and ground
  // into a ladder pattern, etched dark and bright, heat-tinted to the face.
  damascus: [false, false, [], `
    void main() {
      vec2 p = crSlab();
      float w = crFbm(p * 0.9) * 1.1;
      float ladder = 0.07 * sin(p.x * 7.0 + w * 2.0);
      float layer = (p.y + w + ladder + 0.12 * sin(p.x * 1.6 + w * 4.0)) * 40.0;
      float s = 0.5 + 0.5 * sin(layer);
      float nickel = smoothstep(0.58, 0.82, s);
      float fade = smoothstep(0.4, 0.9, fwidth(layer));
      nickel = mix(nickel, 0.3, fade);
      vec3 steel = baseColor * (0.32 + 0.12 * crNoise(p * 6.0)) + vec3(0.025);
      vec3 bright = mix(baseColor, vec3(0.88, 0.89, 0.92), 0.45);
      vec3 col = mix(steel, bright, nickel);
      col *= 0.93 + 0.1 * crNoise(vec2(p.x * 3.0, p.y * 160.0));
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Mosaic: tesserae set in grout, each one stone of a single colour picked from
  // the face's picture — a rosette of the partner colour in a white ring — so
  // the picture only comes together on a solved face.
  mosaic: [true, false, [], `
    void main() {
      vec2 plane = crFacePlane();
      vec2 g = plane * 7.0;
      vec2 cell = floor(g), f = fract(g);
      vec2 jit = (crHash2(cell) - 0.5) * 0.14;
      float an = (crHash(cell + 3.3) - 0.5) * 0.25;
      vec2 c = mat2(cos(an), -sin(an), sin(an), cos(an)) * (f - 0.5 - jit);
      float size = 0.39 + 0.05 * crHash(cell + 2.0);
      float tess = max(abs(c.x), abs(c.y));
      float inside = 1.0 - smoothstep(size - fwidth(tess), size + fwidth(tess), tess);
      vec2 q = (cell + 0.5 + jit) / 7.0 / crFaceHalf();
      float r = length(q), a = atan(q.y, q.x);
      float star = r - (0.4 + 0.12 * cos(a * 8.0));
      vec3 pic = baseColor;
      if (abs(r - 0.72) < 0.065) pic = vec3(0.95, 0.93, 0.88);
      if (star < 0.0) pic = antipodalColor;
      if (star < -0.22) pic = vec3(0.95, 0.93, 0.88);
      if (max(abs(q.x), abs(q.y)) > 0.9) pic = baseColor * 0.55;
      pic *= 0.84 + 0.26 * crHash(cell + 5.0);
      pic *= 1.0 - 0.28 * smoothstep(size - 0.12, size, tess);
      vec3 grout = mix(vec3(0.74, 0.72, 0.67), baseColor, 0.2) * 0.7;
      gl_FragColor = vec4(mix(grout, pic, inside), 1.0);
    }
  `],

  // Tooled leather: pebble grain and dye mottling, a pressed border groove and
  // slanted saddle stitches, the edges burnished dark.
  leather: [false, false, [CHIPS_GLSL], `
    void main() {
      vec2 p = crSlab();
      vec3 v = crChips(p * 20.0);
      float pebble = smoothstep(0.0, 0.3, v.x);
      vec3 col = baseColor * (0.6 + 0.3 * pebble + 0.08 * v.y);
      col *= 0.88 + 0.16 * crFbm(p * 3.0);
      vec2 uv = vUv - 0.5;
      float sq = max(abs(uv.x), abs(uv.y));
      col *= 1.0 - 0.42 * crLine(sq - 0.35, 0.012);
      col *= 1.0 + 0.12 * crLine(sq - 0.335, 0.008);
      float perim = abs(uv.x) > abs(uv.y) ? uv.y : uv.x;
      float seg = fract(perim * 13.0 + (sq - 0.405) * 6.0);
      float stitch = crLine(sq - 0.405, 0.013) * smoothstep(0.12, 0.22, seg) * smoothstep(0.88, 0.78, seg);
      col *= 1.0 - 0.5 * crLine(sq - 0.405, 0.016) * (1.0 - smoothstep(0.0, 0.12, abs(seg - 0.05)));
      col = mix(col, mix(baseColor, vec3(0.96, 0.92, 0.82), 0.7), stitch);
      col *= 1.0 - 0.38 * smoothstep(0.44, 0.5, sq);
      gl_FragColor = vec4(col, 1.0);
    }
  `],
};

// [usesAntipodal, animated, helpers, body]
export const craftedShaders = Object.fromEntries(
  Object.entries(bodies).map(([key, [anti, animated, helpers, body]]) => [
    key,
    CRAFT + (anti ? ANTIPODAL : '') + (animated ? ANIMATED : '') + helpers.join('') + body
  ])
);

export const CRAFTED_ANTIPODAL_KEYS = Object.keys(bodies).filter((key) => bodies[key][0]);
export const CRAFTED_ANIMATED_KEYS = Object.keys(bodies).filter((key) => bodies[key][1]);
