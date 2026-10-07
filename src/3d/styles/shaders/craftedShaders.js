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

  // Shibori: itajime — cotton folded both ways into a packet, clamped at one
  // corner between square boards and dipped in the face's dye. Unfolded, the
  // board is a soft undyed square on every other crossing of the folds, its edge
  // feathered where dye wicked along the threads and darkened where it pooled.
  // The open folds took the most dye, the pressed creases the least, and inner
  // layers of the packet less than the outer ones.
  shibori: [false, false, [], `
    float shBoard(vec2 q, float r, float k) {
      vec2 d = abs(q) - vec2(r - k);
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - k;
    }
    void main() {
      vec2 p = crSlab();
      vec2 u = p / 0.45 + 0.16 * vec2(crNoise(p * 0.8 + 3.0), crNoise(p * 0.8 + 8.0));
      vec2 sq = floor(u * 0.5 + 0.5);
      float an = (crHash(sq + 4.1) - 0.5) * 0.14;
      vec2 q = mat2(cos(an), sin(an), -sin(an), cos(an)) * (u - 2.0 * sq);
      vec2 a = abs(q);
      float warp = crFbm(p * 3.0 + 1.7) - 0.5;
      float wickV = crNoise(vec2(p.x * 90.0, p.y * 6.0));
      float wickH = crNoise(vec2(p.x * 6.0, p.y * 90.0));
      float wick = mix(wickH, wickV, step(a.x, a.y));
      float d = shBoard(q, 0.44 + 0.06 * crHash(sq), 0.14) + warp * 0.18 + wick * 0.06;
      float resist = 1.0 - smoothstep(-0.1, 0.05, d);
      float ex = abs(u.x - floor(u.x + 0.5)), ey = abs(u.y - floor(u.y + 0.5));
      float e = min(ex, ey);
      float along = ex < ey ? u.y : u.x + 3.7;
      float creaseW = 0.03 + 0.06 * crNoise(vec2(along * 2.2, e * 3.0) + 5.0);
      float crease = (1.0 - smoothstep(0.0, creaseW, e)) * smoothstep(0.15, 0.6, crNoise(vec2(along * 1.3, 2.0)));
      float layer = mod(floor(u.x) + floor(u.y), 2.0);
      float dye = 0.6 + 0.36 * crFbm(p * 1.4 + 2.0) + 0.3 * smoothstep(0.45, 1.0, max(a.x, a.y)) - 0.1 * layer;
      float halo = exp(-max(d, 0.0) / 0.2) * (0.6 + 0.6 * wick);
      float amt = dye * (1.0 - resist) * (1.0 - 0.4 * halo);
      amt += resist * 0.2 * crFbm(p * 6.0 + 9.0);
      amt += 0.28 * exp(-abs(d - 0.04) / 0.05) * (1.0 - 0.6 * resist);
      amt += 0.12 * exp(-e / 0.1) * (1.0 - resist);
      amt *= 1.0 - 0.5 * crease;
      vec3 cotton = vec3(0.95, 0.93, 0.88);
      float lum = dot(baseColor, vec3(0.299, 0.587, 0.114));
      vec3 dye1 = baseColor * (0.92 - 0.2 * lum);
      vec3 col = mix(cotton, dye1, smoothstep(0.0, 0.9, amt));
      col = mix(col, baseColor * (0.58 - 0.16 * lum), smoothstep(0.85, 1.25, amt) * 0.85);
      vec2 tw = p * 60.0;
      float weave = sin(tw.x * 3.14159) * sin(tw.y * 3.14159);
      float fade = 1.0 - smoothstep(0.25, 0.7, fwidth(tw.x));
      col *= 1.0 + 0.06 * weave * fade;
      col *= 0.95 + 0.07 * crNoise(vec2(p.x * 3.0, p.y * 55.0));
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Hammered metal: a sheet planished by hand, every blow a round, shallow bowl
  // whose rim steepens, the bowls overlapping in curved ridges. Each dent mirrors
  // the studio: a bright crescent on the wall facing the key light, a dark one
  // opposite and a pinpoint glint; the anodised colour drifts from blow to blow.
  hammeredMetal: [false, false, [], `
    vec4 hmDents(vec2 p) {
      vec2 n = floor(p), f = fract(p);
      float best = 0.0, id = 0.0;
      vec2 slope = vec2(0.0);
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 r = g + 0.12 + 0.76 * crHash2(n + g) - f;
          float rho = 0.56 + 0.2 * crHash(n + g + 7.3);
          float q = length(r) / rho;
          float h = (q * q - 1.0) * rho * rho;
          if (h < best) { best = h; slope = r / rho * (0.24 + 0.42 * q * q); id = crHash(n + g + 2.9); }
        }
      }
      return vec4(slope, best, id);
    }
    void main() {
      vec2 p = crSlab() * 3.1;
      vec4 dn = hmDents(p);
      vec3 n = normalize(vec3(dn.xy, 1.0));
      vec3 key = normalize(vec3(-0.55, 0.62, 0.56));
      float diff = max(dot(n, key), 0.0);
      float spec = pow(max(dot(n, normalize(key + vec3(0.0, 0.0, 1.0))), 0.0), 90.0);
      vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
      float t = dot(r.xy, vec2(-0.55, 0.83));
      float box = smoothstep(0.2, 0.6, t);
      float dark = smoothstep(0.15, 0.7, -t);
      vec3 metal = baseColor * (0.9 + 0.18 * dn.w);
      metal = mix(metal, metal * vec3(1.08, 0.98, 0.9), crFbm(p * 0.25));
      metal *= 0.97 + 0.04 * crNoise(vec2(p.x * 26.0, p.y * 2.0));
      vec3 col = metal * (0.6 + 0.42 * box - 0.26 * dark + 0.14 * diff);
      col += mix(metal, vec3(1.0), 0.6) * (spec * 0.6 + box * 0.08);
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Delft tile: tin-glazed earthenware painted by hand in the face's colour —
  // a tulip in a double ring, and a quarter lily in each corner that meets its
  // neighbours' as one ornament. Fine dark outlines filled with a pale, streaky
  // wash that pooled here and there; the partner colour flames the tulip and
  // dots the corners. Fine crackle in the glaze, which thins at the rim.
  delftTile: [true, false, [CHIPS_GLSL], `
    float dfEll(vec2 q, vec2 c, float an, vec2 r) {
      q -= c;
      float cs = cos(an), sn = sin(an);
      q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
      return (length(q / r) - 1.0) * min(r.x, r.y);
    }
    void main() {
      vec2 p = vUv - 0.5;
      vec2 seed = tileHome.xy * 3.1 + tileHome.z * 1.7 + tileFace;
      vec2 hp = p + 0.004 * vec2(crNoise(p * 18.0 + seed), crNoise(p * 18.0 + seed + 4.0));
      float r = length(hp), ang = atan(hp.y, hp.x);
      float head = min(dfEll(hp, vec2(0.0, 0.06), 0.0, vec2(0.055, 0.115)),
                       min(dfEll(hp, vec2(-0.05, 0.035), 0.5, vec2(0.05, 0.1)),
                           dfEll(hp, vec2(0.05, 0.035), -0.5, vec2(0.05, 0.1))));
      vec2 sp = vec2(hp.x - 0.018 * sin(hp.y * 14.0), max(abs(hp.y + 0.13) - 0.1, 0.0));
      float stem = length(sp) - 0.011;
      float leaves = min(dfEll(hp, vec2(-0.075, -0.14), 0.85, vec2(0.032, 0.095)),
                         dfEll(hp, vec2(0.07, -0.12), -0.8, vec2(0.028, 0.085)));
      float band = abs(r - 0.35) - 0.02;
      vec2 c = 0.5 - abs(hp);
      vec2 dg = vec2(c.x + c.y, c.x - c.y) * 0.7071;
      float lily = dfEll(dg, vec2(0.15, 0.0), 0.0, vec2(0.095, 0.036));
      lily = min(lily, min(dfEll(c, vec2(0.0, 0.15), 0.0, vec2(0.03, 0.055)), dfEll(c, vec2(0.15, 0.0), 0.0, vec2(0.055, 0.03))));
      lily = min(lily, abs(length(c) - 0.1) - 0.011);
      float shapes = min(min(min(head, leaves), stem), min(band, lily));
      float flame = min(dfEll(hp, vec2(0.0, 0.075), 0.0, vec2(0.016, 0.07)), length(c) - 0.05);
      float aa = fwidth(r) * 1.2;
      float fill = 1.0 - smoothstep(-aa, aa, shapes);
      float streak = crNoise(vec2(r * 80.0, ang * 5.0) + seed);
      float pool = smoothstep(0.45, 0.9, crNoise(hp * 22.0 + seed + 2.0));
      float wash = fill * (0.48 + 0.2 * streak + 0.28 * pool * exp(shapes / 0.02));
      wash = max(wash, (1.0 - smoothstep(-aa, aa, band)) * (0.78 + 0.14 * streak));
      float lum = dot(baseColor, vec3(0.299, 0.587, 0.114));
      vec3 pigment = baseColor * (1.0 - 0.32 * lum);
      vec3 glaze = vec3(0.96, 0.95, 0.91) * (0.96 + 0.05 * crFbm(p * 5.0 + seed));
      vec3 col = mix(glaze, pigment, wash);
      col = mix(col, pigment * 0.5, crLine(shapes, 0.005) * 0.9);
      float accent = 1.0 - smoothstep(-aa, aa, flame);
      col = mix(col, mix(glaze, antipodalColor, 0.85 + 0.15 * streak), accent);
      col = mix(col, antipodalColor * 0.55, crLine(flame, 0.004) * 0.8);
      float crackle = crChips(p * 9.0 + seed).x;
      col *= 1.0 - 0.07 * (1.0 - smoothstep(0.0, 0.01 + fwidth(crackle), crackle));
      float sq = max(abs(p.x), abs(p.y));
      col = mix(col, col * vec3(0.9, 0.84, 0.76), smoothstep(0.465, 0.5, sq));
      gl_FragColor = vec4(col, 1.0);
    }
  `],

  // Cane webbing: chair cane in the seven-step weave — pairs of strands across
  // and down, two diagonal families threaded over and under them, leaving the
  // octagonal holes the dark backing shows through. Each glossy strand is
  // rounded and streaked with fibre; at every crossing the one beneath ducks
  // into shadow. The weave runs on across a solved face.
  caneWebbing: [false, false, [], `
    vec2 cwPair(float g, float hw) {
      float sub = g - (g < 0.0 ? -0.104 : 0.104);
      return vec2(sub / hw, abs(sub));
    }
    float cwOver(float hi, float hj, float mj) {
      return hj > hi ? 1.0 - mj : 1.0;
    }
    float cwNear(float d, float hw) {
      return 1.0 - smoothstep(hw, hw + 0.12, d);
    }
    vec3 cwCane(float s, float along, float seed, float lightSide, float shade) {
      float prof = sqrt(max(0.0, 1.0 - s * s));
      float fibre = crNoise(vec2(along * 2.5, s * 3.5 + seed * 17.0));
      float lit = 0.5 + 0.45 * prof + 0.18 * s * lightSide;
      vec3 c = baseColor * lit * (0.82 + 0.26 * fibre);
      c += mix(baseColor, vec3(1.0), 0.6) * exp(-pow((s + 0.35 * lightSide) / 0.22, 2.0)) * 0.32;
      return c * (1.0 - 0.6 * shade);
    }
    void main() {
      vec2 slab = crSlab();
      vec2 w = slab * 2.35;
      float aa = length(fwidth(w)) * 0.6;
      float gx = w.x - floor(w.x + 0.5), gy = w.y - floor(w.y + 0.5);
      float a1 = w.x - w.y - 0.5, a2 = w.x + w.y - 0.5;
      float g1 = (a1 - floor(a1 + 0.5)) * 0.7071, g2 = (a2 - floor(a2 + 0.5)) * 0.7071;
      float hwP = 0.084, hwD = 0.074, pairHalf = 0.19;
      vec2 sv = cwPair(gx, hwP), sh = cwPair(gy, hwP);
      float mV = 1.0 - smoothstep(hwP - aa, hwP + aa, sv.y);
      float mH = 1.0 - smoothstep(hwP - aa, hwP + aa, sh.y);
      float m1 = 1.0 - smoothstep(hwD - aa, hwD + aa, abs(g1));
      float m2 = 1.0 - smoothstep(hwD - aa, hwD + aa, abs(g2));
      float par = mod(floor(w.x + 0.5) + floor(w.y + 0.5), 2.0) < 0.5 ? 0.5 : -0.5;
      float hV = 2.0 + par * step(abs(gy), 0.25);
      float hH = 2.0 - par * step(abs(gx), 0.25);
      float nearV = step(abs(gx), abs(gy));
      float h1 = mix(1.0, 3.0, nearV), h2 = mix(3.0, 1.0, nearV);
      float vV = mV * cwOver(hV, hH, mH) * cwOver(hV, h1, m1) * cwOver(hV, h2, m2);
      float vH = mH * cwOver(hH, hV, mV) * cwOver(hH, h1, m1) * cwOver(hH, h2, m2);
      float v1 = m1 * cwOver(h1, hV, mV) * cwOver(h1, hH, mH) * cwOver(h1, h2, m2);
      float v2 = m2 * cwOver(h2, hV, mV) * cwOver(h2, hH, mH) * cwOver(h2, h1, m1);
      float pV = cwNear(abs(gx), pairHalf), pH = cwNear(abs(gy), pairHalf);
      float p1 = cwNear(abs(g1), hwD), p2 = cwNear(abs(g2), hwD);
      float shV = max(max(step(hV, hH) * pH, step(hV, h1) * p1), step(hV, h2) * p2);
      float shH = max(max(step(hH, hV) * pV, step(hH, h1) * p1), step(hH, h2) * p2);
      float sh1 = max(max(step(h1, hV) * pV, step(h1, hH) * pH), step(h1, h2) * p2);
      float sh2 = max(max(step(h2, hV) * pV, step(h2, hH) * pH), step(h2, h1) * p1);
      vec3 cV = cwCane(sv.x, w.y, floor(w.x + 0.5) + step(0.0, gx) * 0.5, -1.0, shV);
      vec3 cH = cwCane(sh.x, w.x, floor(w.y + 0.5) + step(0.0, gy) * 0.5 + 3.0, 1.0, shH);
      vec3 c1 = cwCane(g1 / hwD, w.x + w.y, floor(a1 + 0.5) + 7.0, 1.0, sh1);
      vec3 c2 = cwCane(g2 / hwD, w.x - w.y, floor(a2 + 0.5) + 11.0, -1.0, sh2);
      float prox = max(max(pV, pH), max(p1, p2));
      vec3 backing = baseColor * 0.1 + vec3(0.015);
      backing *= 1.0 - 0.6 * prox;
      float bare = (1.0 - mV) * (1.0 - mH) * (1.0 - m1) * (1.0 - m2);
      vec3 col = cV * vV + cH * vH + c1 * v1 + c2 * v2;
      col *= 0.88 + 0.22 * crFbm(slab * 0.6 + 4.0);
      col += backing * bare;
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
