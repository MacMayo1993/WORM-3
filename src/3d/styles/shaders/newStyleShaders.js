import { eyeTileFragmentShader } from './eyeTileShader.js';

// New tile style shaders: stainedGlass, fingerprint, topographic, mandelbrot, penrose,
//                         oilSlick, constellation, waveform, dnaHelix, neonSign,
//                         prismBloom, magnetFlux, liquidChrome, auroraWeave, plasmaCells,
//                         quantumScanlines, emberstorm, fractalPulse, bioLattice, stellarLensing,
//                         orbChamber, liquidTank, dice, sandChamber, lavaLamp, eyeball

import { CRAFT_GLSL, BORDERS_GLSL } from './craftGlsl.js';

export const newStyleShaders = {
  // Stained Glass - a leaded window cut across the whole face: panes in shades
  // of the face colour with a few of the partner colour and pale amber, each
  // glowing brighter at its heart, held in lead came of an even width. A solved
  // face is one window.
  stainedGlass: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
  ` + CRAFT_GLSL + BORDERS_GLSL + `
    void main() {
      vec2 p = crSlab() * 2.2;
      vec3 pane = crBorder(p + 0.15 * vec2(crNoise(p * 2.0), crNoise(p * 2.0 + 3.0)));
      float h = crHash(pane.yz), pick = crHash(pane.yz + 7.1);
      vec3 glass = baseColor * (0.68 + 0.5 * h);
      if (pick > 0.8) glass = antipodalColor * (0.78 + 0.32 * h);
      else if (pick > 0.68) glass = mix(baseColor, vec3(1.0, 0.94, 0.78), 0.6);
      glass *= 0.72 + 0.42 * smoothstep(0.0, 0.35, pane.x);
      glass *= 0.9 + 0.14 * crNoise(p * 18.0 + h * 9.0);
      float lead = crLine(pane.x, 0.05);
      float bead = 1.0 - clamp(pane.x / 0.05, 0.0, 1.0);
      vec3 came = vec3(0.08, 0.075, 0.07) * (1.0 + 1.6 * bead);
      gl_FragColor = vec4(mix(glass, came, lead), 1.0);
    }
  `,

  // Fingerprint - an inked print: a spiralled whorl round the core blending
  // into arches over it (where the two ridge fields disagree, ridges fork and
  // end, as real minutiae do), with broken ridges and pores. Every tile's print
  // is different.
  fingerprint: `
    uniform vec3 baseColor;
  ` + CRAFT_GLSL + `
    void main() {
      float seed = crHash(tileHome.xy * 1.3 + vec2(tileHome.z, tileFace) * 2.7);
      vec2 core = vec2(0.47, 0.5) + (crHash2(vec2(seed, 3.0)) - 0.5) * 0.12;
      float tilt = (seed - 0.5) * 0.8;
      vec2 p = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * (vUv - core);
      p += 0.03 * (vec2(crNoise(vUv * 7.0 + seed * 10.0), crNoise(vUv * 7.0 + 4.0 + seed * 10.0)) - 0.5);
      float r = length(p / vec2(0.8, 1.0));
      float turn = atan(p.y, p.x) / 6.28318 * (seed > 0.5 ? 1.0 : -1.0);
      float whorl = r * 26.0 + turn;
      float arch = (p.y + 0.55 * sqrt(p.x * p.x + 0.004) * smoothstep(-0.2, 0.1, p.y)) * 26.0;
      float phase = mix(whorl, arch, smoothstep(0.16, 0.3, r));
      float s = sin(phase * 6.28318);
      float fw = fwidth(s);
      float ink = smoothstep(0.05 - fw, 0.05 + fw, s);
      ink *= smoothstep(0.18, 0.32, crNoise(vUv * 13.0 + seed * 20.0));
      ink *= 1.0 - step(0.93, crHash(floor(vUv * 85.0) + seed)) * 0.8;
      vec2 o = (vUv - core) / vec2(0.82, 1.0);
      ink *= 1.0 - smoothstep(0.4, 0.48, length(o));
      vec3 paper = mix(baseColor, vec3(1.0), 0.5);
      gl_FragColor = vec4(mix(paper, baseColor * 0.42, ink), 1.0);
    }
  `,

  // Topographic - contour map elevation lines from layered sine terrain
  topographic: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      vec2 uv   = vUv;
      float elev = sin(uv.x * 9.1 + uv.y * 5.3) * 0.45
                 + sin(uv.x * 3.7 - uv.y * 8.1) * 0.33
                 + sin(uv.x * 14.2 + uv.y * 2.9) * 0.22;

      float cf    = 9.0;
      float line  = smoothstep(0.07, 0.028, abs(fract(elev * cf) - 0.5));
      float major = smoothstep(0.07, 0.028, abs(fract(elev * cf * 0.25) - 0.5));

      vec3 bg  = baseColor * 0.82;
      vec3 lc  = baseColor * 0.25;
      float l  = clamp(line + major * 1.7, 0.0, 1.0);
      gl_FragColor = vec4(mix(bg, lc, l), 1.0);
    }
  `,

  // Mandelbrot - fractal set colored with base palette
  mandelbrot: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      vec2 c = (vUv - 0.5) * 3.2 + vec2(-0.5, 0.0);
      vec2 z = vec2(0.0);
      float iter = 0.0;
      for (int i = 0; i < 64; i++) {
        if (dot(z, z) > 4.0) break;
        z    = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        iter += 1.0;
      }
      float t   = iter / 64.0;
      float lum = sin(t * 18.84956) * 0.5 + 0.5;
      vec3 col  = (iter >= 64.0) ? baseColor * 0.55 : mix(baseColor * 0.08, baseColor * 1.55, lum);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Penrose - a true P3 tiling of thick and thin rhombi across the whole face,
  // grown from a sun of ten Robinson triangles by golden-ratio deflation (the
  // two triangles of a rhombus are shaded apart so it reads folded). Aperiodic:
  // no two tiles of a solved face show the same patch.
  penrose: `
    uniform vec3 baseColor;
  ` + CRAFT_GLSL + `
    float pnCross(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
    bool pnInside(vec2 p, vec2 a, vec2 b, vec2 c) {
      float d1 = pnCross(b - a, p - a), d2 = pnCross(c - b, p - b), d3 = pnCross(a - c, p - c);
      return !((d1 < 0.0 || d2 < 0.0 || d3 < 0.0) && (d1 > 0.0 || d2 > 0.0 || d3 > 0.0));
    }
    float pnSegment(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a, ba = b - a;
      return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
    }
    void main() {
      const float PHI = 1.6180339887;
      vec2 p = crFacePlane();
      float R = crFaceHalf() * 1.5;
      float steps = ceil(log(R / 0.42) / log(PHI));
      float i = floor(mod(atan(p.y, p.x) + 0.31415927, 6.2831853) / 0.62831853);
      vec2 A = vec2(0.0);
      vec2 B = R * vec2(cos((2.0 * i - 1.0) * 0.31415927), sin((2.0 * i - 1.0) * 0.31415927));
      vec2 C = R * vec2(cos((2.0 * i + 1.0) * 0.31415927), sin((2.0 * i + 1.0) * 0.31415927));
      if (mod(i, 2.0) < 0.5) { vec2 t = B; B = C; C = t; }
      // Robinson triangles (kind, A, B, C): A is the apex, B-C the diagonal the
      // triangle shares with its mirror half; only C-A and A-B are tile edges.
      float kind = 0.0;
      for (int it = 0; it < 8; it++) {
        if (float(it) >= steps) break;
        vec2 a2, b2, c2;
        if (kind < 0.5) {
          vec2 P = A + (B - A) / PHI;
          if (pnInside(p, C, P, B)) { a2 = C; b2 = P; c2 = B; }
          else { a2 = P; b2 = C; c2 = A; kind = 1.0; }
        } else {
          vec2 Q = B + (A - B) / PHI;
          vec2 S = B + (C - B) / PHI;
          if (pnInside(p, S, C, A)) { a2 = S; b2 = C; c2 = A; }
          else if (pnInside(p, Q, S, B)) { a2 = Q; b2 = S; c2 = B; }
          else { a2 = S; b2 = Q; c2 = A; kind = 0.0; }
        }
        A = a2; B = b2; C = c2;
      }
      float fold = pnCross(B - A, C - A) > 0.0 ? 1.0 : 0.88;
      vec3 col = (kind > 0.5 ? baseColor : mix(baseColor, vec3(1.0), 0.45)) * fold;
      float d = min(pnSegment(p, C, A), pnSegment(p, A, B));
      col = mix(col, baseColor * 0.25, crLine(d, 0.018));
      gl_FragColor = vec4(col, 1.0);
    }
  `,

  // Oil Slick - animated iridescent thin-film interference rainbow
  oilSlick: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      float d = time * 0.07;
      float thickness = sin(uv.x * 4.1 + d) * 0.5
                      + sin(uv.y * 3.3 + d * 0.8) * 0.5
                      + sin((uv.x + uv.y) * 5.7 + d * 0.5) * 0.35;
      float hue = fract(thickness * 0.28 + time * 0.025);
      vec3 k   = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      float blend = 0.5 + sin(thickness * 3.14159 + time * 0.18) * 0.45;
      vec3 col = mix(baseColor * 0.55, k, blend * 0.55) + baseColor * 0.25;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Constellation - twinkling star field with drawn connecting lines
  constellation: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main() {
      vec2 uv   = vUv * 4.0;
      vec2 cell = floor(uv);
      vec2 loc  = fract(uv) - 0.5;

      vec2 spos  = vec2(cHash(cell) - 0.5, cHash(cell + vec2(17.3, 3.7)) - 0.5) * 0.68;
      float bri  = cHash(cell + vec2(5.1, 9.4));
      float twkl = 0.85 + 0.15 * sin(time * (2.0 + bri * 3.0) + bri * 6.28318);
      float star = smoothstep(0.07, 0.01, length(loc - spos)) * bri * twkl;

      float line = 0.0;
      for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
        for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
          if (abs(dx) + abs(dy) < 0.5) continue;
          vec2 nc   = cell + vec2(dx, dy);
          vec2 npos = vec2(cHash(nc) - 0.5, cHash(nc + vec2(17.3, 3.7)) - 0.5) * 0.68 + vec2(dx, dy);
          float con = step(0.63, cHash((cell + nc) * 0.5));
          vec2 pa   = loc - spos;
          vec2 ba   = npos - spos;
          float t2  = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          line += smoothstep(0.028, 0.006, length(pa - ba * t2)) * con * 0.35;
        }
      }

      vec3 bg  = baseColor * 0.11;
      vec3 sc  = mix(baseColor, vec3(1.0), 0.65);
      vec3 lc  = baseColor * 0.42;
      vec3 col = bg + lc * clamp(line, 0.0, 1.0) + sc * clamp(star, 0.0, 1.0);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Waveform - animated oscilloscope lines pulsing between antipodal colors
  waveform: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      float pattern = 0.0;
      for (float i = 1.0; i <= 3.0; i++) {
        float ly   = i * 0.25;
        float amp  = 0.055 - i * 0.01;
        float wave = sin(vUv.x * (3.0 + i * 2.0) * 6.28318 + time * (0.8 + i * 0.3)) * amp + ly;
        pattern   += smoothstep(0.018, 0.003, abs(vUv.y - wave)) * (1.1 - i * 0.2);
      }
      float pulse = 0.5 + 0.5 * sin(time * 1.6);
      vec3 wc     = mix(baseColor * 1.6, antipodalColor * 1.6, pulse);
      vec3 bg     = baseColor * 0.18;
      gl_FragColor = vec4(mix(bg, wc, clamp(pattern, 0.0, 1.0)), 1.0);
    }
  `,

  // DNA Helix - animated double helix with antipodal-colored strands
  dnaHelix: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      float x   = vUv.x;
      float y   = vUv.y * 5.0;
      float s1x = sin(y * 3.14159 + time * 0.75) * 0.27 + 0.5;
      float s2x = sin(y * 3.14159 + time * 0.75 + 3.14159) * 0.27 + 0.5;
      float s1  = smoothstep(0.038, 0.007, abs(x - s1x));
      float s2  = smoothstep(0.038, 0.007, abs(x - s2x));

      float rp   = fract((y + time * 0.75 / 3.14159) * 0.5);
      float rl   = smoothstep(0.10, 0.045, abs(rp - 0.5));
      float lo   = min(s1x, s2x);
      float hi   = max(s1x, s2x);
      float rb   = step(lo - 0.005, x) * step(x, hi + 0.005);
      float rung = rl * rb * 0.72;

      vec3 bg  = mix(baseColor, antipodalColor, 0.05) * 0.10;
      vec3 col = bg;
      col = mix(col, baseColor * 1.6, s1);
      col = mix(col, antipodalColor * 1.6, s2);
      col += mix(baseColor, antipodalColor, 0.5) * rung * (1.0 - max(s1, s2));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Neon Sign - glowing neon-tube border + inner diamond with flicker
  neonSign: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 c    = vUv - 0.5;
      vec2 bd   = abs(c) - vec2(0.38);
      float bSDF  = max(bd.x, bd.y);
      float bRing = abs(bSDF + 0.04);
      float border  = smoothstep(0.035, 0.001, bRing);

      float dSDF  = abs(c.x) + abs(c.y);
      float dRing = abs(dSDF - 0.21);
      float diamond = smoothstep(0.025, 0.001, dRing);

      float flicker = 0.88 + 0.12 * sin(time * 8.1) * sin(time * 14.3 + 1.9);
      float pulse   = 0.78 + 0.22 * sin(time * 1.8);

      float neon = max(border, diamond) * flicker;
      float glow = smoothstep(0.14, 0.0, bRing) * 0.28
                 + smoothstep(0.09, 0.0, dRing) * 0.28;

      vec3 nc  = baseColor * 2.8 + vec3(0.35);
      vec3 gc  = baseColor * 0.75;
      vec3 bg  = baseColor * 0.04;
      vec3 col = bg + gc * glow * pulse + nc * neon;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  prismBloom: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    vec3 hsv2rgb(vec3 c) {
      vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
      vec3 rgb = clamp(p - 1.0, 0.0, 1.0);
      return c.z * mix(vec3(1.0), rgb, c.y);
    }

    void main() {
      vec2 uv = vUv - 0.5;
      float r = length(uv);
      float a = atan(uv.y, uv.x);
      float petals = sin(a * 8.0 + time * 0.8) * 0.5 + 0.5;
      float bloom = smoothstep(0.52, 0.04, r) * petals;
      float hue = fract(a / 6.28318 + time * 0.035 + r * 0.25);
      vec3 prism = hsv2rgb(vec3(hue, 0.75, 1.0));
      vec3 col = mix(baseColor * 0.28, prism * 0.95 + baseColor * 0.2, bloom);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  magnetFlux: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 uv = (vUv - 0.5) * 2.0;
      vec2 p1 = vec2(sin(time * 0.7) * 0.45, cos(time * 0.8) * 0.45);
      vec2 p2 = -p1;
      float d1 = length(uv - p1);
      float d2 = length(uv - p2);
      float flux = sin((d1 - d2) * 20.0 - time * 2.0) * 0.5 + 0.5;
      float lines = smoothstep(0.62, 0.9, flux);
      vec3 col = baseColor * (0.16 + lines * 1.2);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  liquidChrome: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      float n = sin((uv.x + time * 0.15) * 16.0) * 0.35
              + sin((uv.y - time * 0.11) * 14.0) * 0.35
              + sin((uv.x + uv.y + time * 0.09) * 22.0) * 0.25;
      float metal = smoothstep(-0.1, 0.8, n);
      vec3 chrome = mix(baseColor * 0.12, baseColor * 0.85 + vec3(0.15), metal);
      float shimmer = sin(time * 0.9) * 0.5 + 0.5;
      vec3 col = chrome + baseColor * 0.12 * shimmer;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  auroraWeave: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      float r1 = sin((uv.x * 5.0 + uv.y * 1.8) + time * 0.8);
      float r2 = sin((uv.x * -4.3 + uv.y * 2.2) - time * 0.65);
      float weave = smoothstep(-0.3, 0.7, r1 * 0.55 + r2 * 0.45);
      vec3 a = baseColor * 1.35 + vec3(0.1, 0.15, 0.1);
      vec3 b = baseColor * 0.7 + vec3(0.15, 0.1, 0.3);
      vec3 ribbon = mix(a, b, 0.5 + 0.5 * sin(time * 0.35 + uv.y * 3.5));
      vec3 col = baseColor * 0.15 + ribbon * weave * 0.85;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  plasmaCells: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float cell(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p) - 0.5;
      float h = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
      vec2 o = vec2(cos(h * 6.28318), sin(h * 6.28318)) * 0.25;
      return length(f - o);
    }

    void main() {
      vec2 uv = vUv * 5.0 + vec2(time * 0.18, -time * 0.14);
      float d = 1.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          d = min(d, cell(uv + vec2(float(x), float(y))));
        }
      }
      float edge = smoothstep(0.32, 0.18, d);
      vec3 glow = mix(baseColor * 0.12, baseColor * 1.35, edge);
      gl_FragColor = vec4(clamp(glow, 0.0, 1.0), 1.0);
    }
  `,

  quantumScanlines: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      float scan = sin((vUv.y + time * 0.85) * 180.0) * 0.5 + 0.5;
      float tear = step(0.86, fract(vUv.x * 8.0 + time * 0.6)) * step(0.45, fract(vUv.y * 12.0 + time * 0.25));
      float glow = smoothstep(0.55, 1.0, scan) + tear * 0.7;
      vec3 scanCol = baseColor * 1.85 + vec3(0.22);
      vec3 col = baseColor * 0.13 + scanCol * glow * 0.8;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  emberstorm: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(41.0, 289.0))) * 45758.5453); }

    void main() {
      vec2 uv = vUv * 6.0;
      vec2 id = floor(uv);
      vec2 fr = fract(uv) - 0.5;
      float h = hash(id);
      vec2 drift = vec2(sin(time * (0.6 + h)), cos(time * (0.5 + h))) * 0.18;
      float spark = smoothstep(0.19, 0.02, length(fr - drift)) * step(0.74, h);
      float smoke = sin((vUv.x * 4.0 + vUv.y * 7.0) + time * 0.25) * 0.5 + 0.5;
      vec3 ember = mix(baseColor * 1.8, vec3(1.0, 0.82, 0.35), 0.28);
      vec3 col = baseColor * 0.08 + baseColor * smoke * 0.35 + ember * spark * 1.2;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  fractalPulse: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 z = (vUv - 0.5) * 2.2;
      vec2 c = vec2(-0.62 + sin(time * 0.2) * 0.08, 0.34 + cos(time * 0.17) * 0.06);
      float it = 0.0;
      for (int i = 0; i < 38; i++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (dot(z, z) > 4.0) break;
        it += 1.0;
      }
      float t = it / 38.0;
      float pulse = 0.5 + 0.5 * sin(time * 1.25 + t * 9.0);
      vec3 col = mix(baseColor * 0.08, baseColor * (0.75 + pulse), t);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  bioLattice: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 uv = (vUv - 0.5) * 2.0;
      float veins = 0.0;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float a = fi * 1.5708 + time * 0.12;
        vec2 dir = vec2(cos(a), sin(a));
        veins += smoothstep(0.11, 0.01, abs(dot(uv, dir) + sin(dot(uv.yx, dir) * 7.5 + time * (0.5 + fi * 0.2)) * 0.08));
      }
      veins = clamp(veins / 2.8, 0.0, 1.0);
      vec3 veinCol = baseColor * 1.45 + vec3(0.1, 0.15, 0.08);
      vec3 col = mix(baseColor * 0.11, veinCol * 0.85, veins);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  stellarLensing: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float star(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p) - 0.5;
      float h = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
      return smoothstep(0.17, 0.01, length(f)) * step(0.86, h);
    }

    void main() {
      vec2 uv = (vUv - 0.5) * 2.0;
      vec2 lens = vec2(sin(time * 0.31) * 0.22, cos(time * 0.27) * 0.22);
      vec2 d = uv - lens;
      float r = max(0.08, dot(d, d));
      vec2 warped = uv + d * (0.08 / r);

      float stars = 0.0;
      vec2 p = warped * 6.0 + vec2(time * 0.06, -time * 0.04);
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          stars += star(p + vec2(float(x), float(y)));
        }
      }
      float ring = smoothstep(0.34, 0.30, abs(length(d) - 0.28));
      vec3 starColor = mix(vec3(1.0), baseColor * 1.5, 0.5);
      vec3 col = baseColor * 0.06 + starColor * stars + baseColor * ring * 0.9;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Orb Chamber - glass porthole with a recessed, face-colored sphere inside.
  // On a corner cubelet the three exposed stickers read as three colored balls.
  // The ball is genuinely ray-traced behind the glass in the tile's tangent
  // space, so it parallaxes against its chamber wall as the cube rotates — the
  // depth cue that actually sells the 3D illusion (a flat painted sphere can't).
  // Three balls sitting on the chamber floor, rolling and bouncing off walls
  // and each other. Triangle-wave paths give sharp wall ricochets; pairwise
  // repulsion handles ball-ball collisions. Spin jostle scatters them hard.
  orbChamber: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    uniform float spin;
    uniform float spinAxis;
    uniform float spinSlice;
    uniform float diceRoll;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    uniform vec3 tileHome;
    uniform float tileFace;
    varying vec3 vTileCenter;

    float raySphere(vec3 ro, vec3 rd, vec3 sc, float sr) {
      vec3 oc = ro - sc;
      float b = dot(oc, rd);
      float c = dot(oc, oc) - sr * sr;
      float h = b * b - c;
      return (h > 0.0) ? (-b - sqrt(h)) : -1.0;
    }

    // Triangle wave: linear motion with sharp reversals at walls → [-1, 1].
    float tri(float t) { return abs(fract(t * 0.5 + 0.25) * 2.0 - 1.0) * 2.0 - 1.0; }

    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p);

      vec3 pos = -vViewPosition;
      vec3 dpdx = dFdx(pos);
      vec3 dpdy = dFdy(pos);
      vec2 duvx = dFdx(vUv);
      vec2 duvy = dFdy(vUv);
      vec3 N = normalize(vNormal);
      vec3 dp2perp = cross(dpdy, N);
      vec3 dp1perp = cross(N, dpdx);
      vec3 T = dp2perp * duvx.x + dp1perp * duvy.x;
      vec3 B = dp2perp * duvx.y + dp1perp * duvy.y;
      float invmax = inversesqrt(max(1e-10, max(dot(T, T), dot(B, B))));
      T *= invmax; B *= invmax;

      vec3 V = normalize(vViewPosition);
      vec3 vT = vec3(dot(V, T), dot(V, B), dot(V, N));

      vec3 ro = vec3(p, 0.0);
      vec3 rd = normalize(-vT);

      float boxDepth = 0.6;
      float bR = 0.09;
      float floorZ = -(boxDepth - bR - 0.01);
      float wallExtent = 0.34;

      // diceRoll accumulates during every rotation → each ball uses it as a
      // phase offset with different multipliers so rotations scramble all
      // three paths independently instead of orbiting in sync.
      float dr = diceRoll;

      vec3 c0 = vec3(tri(time * 0.37 + dr * 1.13       ) * wallExtent,
                     tri(time * 0.29 + dr * 0.87 + 0.73) * wallExtent,
                     floorZ);
      vec3 c1 = vec3(tri(time * 0.43 + dr * 1.51 + 1.90) * wallExtent,
                     tri(time * 0.31 + dr * 0.63 + 2.50) * wallExtent,
                     floorZ);
      vec3 c2 = vec3(tri(time * 0.33 + dr * 1.29 + 3.80) * wallExtent,
                     tri(time * 0.41 + dr * 0.97 + 4.30) * wallExtent,
                     floorZ);

      // Slice membership.
      float axisCoord = spinAxis < 0.5 ? vTileCenter.x
                      : spinAxis < 1.5 ? vTileCenter.y
                      : vTileCenter.z;
      float member = 1.0 - smoothstep(0.55, 0.78, abs(axisCoord - spinSlice));
      float sp = clamp(spin * member, 0.0, 1.0);

      // sqrt extends the tail so balls keep knocking around well after
      // the layer settles (sp=0.04 → spSlow=0.2 → still visible bounce).
      float spSlow = sqrt(sp);
      float bounce = spSlow * 0.38;
      c0.x += sin(time * 21.0) * bounce + sin(time * 13.3 + 1.7) * bounce * 0.7;
      c0.y += cos(time * 18.5 + 0.6) * bounce + sin(time * 11.1) * bounce * 0.5;

      c1.x += cos(time * 19.3 + 0.9) * bounce + sin(time * 14.7) * bounce * 0.6;
      c1.y += sin(time * 22.1 + 1.4) * bounce + cos(time * 12.3) * bounce * 0.5;

      c2.x += sin(time * 17.9 + 2.4) * bounce + cos(time * 15.9 + 0.3) * bounce * 0.7;
      c2.y += cos(time * 24.3 + 3.7) * bounce + sin(time * 10.7) * bounce * 0.4;

      // Clamp to walls FIRST so jostle can't push balls outside before collision
      // resolution — otherwise two balls jostled past the same wall snap onto the
      // same clamped corner and render as one merged sphere.
      float wlo = -wallExtent; float whi = wallExtent;
      c0.xy = clamp(c0.xy, vec2(wlo), vec2(whi));
      c1.xy = clamp(c1.xy, vec2(wlo), vec2(whi));
      c2.xy = clamp(c2.xy, vec2(wlo), vec2(whi));

      // Pairwise collision repulsion (2D since they share the floor).
      float minSep = bR * 2.3;
      vec2 d01 = c1.xy - c0.xy; float len01 = max(length(d01), 0.001);
      float push01 = max(0.0, minSep - len01) * 0.55;
      vec2 n01 = d01 / len01;
      c0.xy -= n01 * push01; c1.xy += n01 * push01;

      vec2 d02 = c2.xy - c0.xy; float len02 = max(length(d02), 0.001);
      float push02 = max(0.0, minSep - len02) * 0.55;
      vec2 n02 = d02 / len02;
      c0.xy -= n02 * push02; c2.xy += n02 * push02;

      vec2 d12 = c2.xy - c1.xy; float len12 = max(length(d12), 0.001);
      float push12 = max(0.0, minSep - len12) * 0.55;
      vec2 n12 = d12 / len12;
      c1.xy -= n12 * push12; c2.xy += n12 * push12;

      // Final clamp after collision resolution (repulsion can push past walls).
      c0.xy = clamp(c0.xy, vec2(wlo), vec2(whi));
      c1.xy = clamp(c1.xy, vec2(wlo), vec2(whi));
      c2.xy = clamp(c2.xy, vec2(wlo), vec2(whi));

      // Light angled from above-left.
      vec3 L = normalize(vec3(-0.4, 0.55, 0.72));

      // Ray-sphere intersection: test all 3, pick nearest hit.
      float t0 = raySphere(ro, rd, c0, bR);
      float t1 = raySphere(ro, rd, c1, bR);
      float t2 = raySphere(ro, rd, c2, bR);

      float tHit = -1.0;
      vec3 hitCenter = c0;
      if (t0 > 0.0) { tHit = t0; hitCenter = c0; }
      if (t1 > 0.0 && (tHit < 0.0 || t1 < tHit)) { tHit = t1; hitCenter = c1; }
      if (t2 > 0.0 && (tHit < 0.0 || t2 < tHit)) { tHit = t2; hitCenter = c2; }

      vec3 interior;
      if (tHit > 0.0) {
        vec3 hp = ro + rd * tHit;
        vec3 nrm = normalize(hp - hitCenter);
        vec3 toEye = -rd;
        vec3 hlf = normalize(L + toEye);
        float diff = max(dot(nrm, L), 0.0);
        float spec = pow(max(dot(nrm, hlf), 0.0), 48.0);
        float fres = pow(1.0 - max(dot(nrm, toEye), 0.0), 3.0);

        vec3 ballDark = antipodalColor * 0.16;
        vec3 ballLit  = antipodalColor * 1.05;
        interior = mix(ballDark, ballLit, diff);
        interior += vec3(1.0) * spec * 0.8;
        interior += mix(antipodalColor * 1.3, vec3(1.0), 0.4) * fres * 0.4;
      } else {
        // Missed all balls → floor with contact shadows beneath each ball.
        float tb = -boxDepth / min(rd.z, -0.001);
        vec3 wp = ro + rd * tb;
        float wv = 1.0 - smoothstep(0.15, 0.72, length(wp.xy));
        interior = baseColor * (0.18 + wv * 0.32);

        // Contact shadows: tight dark circles directly under each ball.
        float shad = smoothstep(bR * 1.4, bR * 0.3, length(wp.xy - c0.xy))
                   + smoothstep(bR * 1.4, bR * 0.3, length(wp.xy - c1.xy))
                   + smoothstep(bR * 1.4, bR * 0.3, length(wp.xy - c2.xy));
        interior *= 1.0 - min(shad, 1.0) * 0.6;

        float haze = 0.5 + 0.5 * sin((wp.x + wp.y) * 10.0 + time * 0.5);
        interior += baseColor * haze * 0.04 * wv;
      }

      // ── Glass front.
      float rim = smoothstep(0.34, 0.49, r) * (1.0 - smoothstep(0.48, 0.51, r));
      vec3 rimCol = mix(baseColor * 1.2, vec3(0.75, 0.95, 1.0), 0.65);

      float slash = smoothstep(0.035, 0.0, abs((p.x + p.y * 0.55) - 0.1));
      slash *= smoothstep(0.46, 0.08, r);

      float glint = smoothstep(0.06, 0.0, length(p - vec2(-0.17, 0.19)));
      glint *= 0.75 + 0.25 * sin(time * 1.4);

      float chamber = 1.0 - smoothstep(0.47, 0.505, r);

      vec3 col = interior;
      col += rimCol * rim * 0.75;
      col += vec3(1.0) * slash * 0.1;
      col += vec3(1.0, 0.95, 0.82) * glint * 0.45;

      vec3 frame = baseColor * 0.03;
      col = mix(frame, col, chamber);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Liquid Tank - each tile is a little glass tank. The liquid (antipodal color)
  // stays level to real-world gravity as you orbit the cube, refracts a parallax
  // caustic floor, and sloshes when its slice is turned. Side faces show a
  // waterline; top/bottom faces show a top-down shimmering pool. The liquid is
  // the antipodal color; the tank/air/frame is this face's color (no black).
  liquidTank: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    uniform float spin;
    uniform float spinAxis;
    uniform float spinSlice;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    uniform vec3 tileHome;
    uniform float tileFace;
    varying vec3 vTileCenter;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;

    // Cheap domain-warped caustic web (bright thin lines).
    float caustic(vec2 pt, float t) {
      vec2 q = pt;
      q += 0.4 * vec2(sin(q.y * 3.0 + t), cos(q.x * 3.1 - t * 0.9));
      float v = sin(q.x * 6.0 + t * 1.3) + sin(q.y * 6.3 - t * 1.1) + sin((q.x + q.y) * 4.0 + t * 0.7);
      return pow(0.5 + 0.5 * sin(v * 1.2), 4.0);
    }

    void main() {
      vec2 p = vUv - 0.5;

      // Rounded-rectangle tank window (SDF: <0 inside).
      vec2 qd = abs(p) - vec2(0.44);
      float rr = min(max(qd.x, qd.y), 0.0) + length(max(qd, vec2(0.0))) - 0.05;
      float chamber = 1.0 - smoothstep(0.0, 0.015, rr);

      // Tangent frame from screen derivatives (UV-aligned) → maps tangent→view.
      vec3 pos = -vViewPosition;
      vec3 dpdx = dFdx(pos);
      vec3 dpdy = dFdy(pos);
      vec2 duvx = dFdx(vUv);
      vec2 duvy = dFdy(vUv);
      vec3 N = normalize(vNormal);
      vec3 dp2perp = cross(dpdy, N);
      vec3 dp1perp = cross(N, dpdx);
      vec3 T = dp2perp * duvx.x + dp1perp * duvy.x;
      vec3 B = dp2perp * duvx.y + dp1perp * duvy.y;
      float invmax = inversesqrt(max(1e-10, max(dot(T, T), dot(B, B))));
      T *= invmax; B *= invmax;
      vec3 V = normalize(vViewPosition);
      vec3 vT = vec3(dot(V, T), dot(V, B), dot(V, N));

      // Ray into the tank; the back wall gives the floor a parallax depth cue.
      vec3 ro = vec3(p, 0.0);
      vec3 rd = normalize(-vT);
      float boxDepth = 0.5;
      float tb = -boxDepth / min(rd.z, -0.001);
      vec2 floorUv = (ro + rd * tb).xy;   // parallaxed floor sample point

      // Slice membership → only the tiles being turned slosh.
      float axisCoord = spinAxis < 0.5 ? vTileCenter.x
                      : spinAxis < 1.5 ? vTileCenter.y
                      : vTileCenter.z;
      float member = 1.0 - smoothstep(0.55, 0.78, abs(axisCoord - spinSlice));
      float sp = clamp(spin * member, 0.0, 1.0);

      // Face orientation: 1 on top/bottom (gravity-perpendicular), 0 on sides.
      float gUp = abs(dot(normalize(vWorldNormal), vec3(0.0, 1.0, 0.0)));

      // Gravity-aligned coords (vertical = world Y) so the waterline stays level.
      vec3 wofs = vWorldPos - vTileCenter;
      float hv = wofs.y;
      float hh = wofs.x - wofs.z;

      // Waterline height (world-vertical): idle ripple + violent slosh on turns.
      float surface = 0.06
        + sin(hh * 8.0 + time * 1.6) * 0.016
        + sin(hh * 5.0 - time * 1.1) * 0.010
        + hh * sin(time * 8.0) * 0.55 * sp
        + sin(hh * 15.0 - time * 20.0) * 0.05 * sp;
      float belowness = surface - hv;
      float waterSide = smoothstep(-0.015, 0.02, belowness);
      // Top/bottom faces read as a full pool viewed from above.
      float water = mix(waterSide, 1.0, gUp);

      // Depth drives color richness + how much the caustic floor shows through.
      float depth = mix(clamp(belowness * 1.1, 0.05, 1.0), 0.5, gUp);

      // Parallax caustic floor (two octaves; shifts with view = real depth).
      float ca = caustic(floorUv * 3.2 + tileHome.xy * 2.0, time * 0.8)
               + 0.5 * caustic(floorUv * 6.0 - tileHome.xy, time * 1.15);

      // Liquid (antipodal): bright shallow → saturated deep. Never black.
      vec3 shallow = mix(antipodalColor, vec3(1.0), 0.30);
      vec3 deep    = antipodalColor * 0.6;
      vec3 liquid  = mix(shallow, deep, depth);
      liquid += antipodalColor * ca * (0.55 - depth * 0.3);
      liquid = max(liquid, antipodalColor * 0.42);
      // Sunlit band just under the surface (side faces).
      liquid += mix(antipodalColor * 1.2, vec3(1.0), 0.4) * smoothstep(0.09, 0.0, belowness) * (1.0 - gUp) * 0.4;

      // Air above the waterline (side faces): this face's color, bright, with a
      // faint hint of the caustic floor. No black.
      vec3 air = baseColor * 0.82 + baseColor * ca * 0.06;

      vec3 col = mix(air, liquid, water);

      // Reflective surface: glancing fresnel sheen + moving specular streaks.
      float fres = pow(1.0 - max(vT.z, 0.0), 3.0);
      float streak = pow(0.5 + 0.5 * sin(hh * 22.0 - time * 4.0 + ca * 3.0), 12.0);
      vec3 sheen = mix(vec3(1.0), shallow, 0.3);
      col += sheen * (fres * 0.22 + streak * 0.35 * water);

      // Meniscus surface line (side faces only).
      float surfBand = smoothstep(0.03, 0.0, abs(belowness)) * (1.0 - gUp);
      col += mix(antipodalColor * 1.3, vec3(1.0), 0.6) * surfBand * 0.85;

      // Rising bubbles as bright rings (no black centers), only within liquid.
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float speed = 0.2 + fi * 0.1 + sp * 0.7;
        vec2 bp = vec2(sin(fi * 2.7 + time * (0.4 + fi * 0.2)) * 0.26,
                       fract(fi * 0.4 + time * speed) * 0.72 - 0.4);
        float d = length(p - bp);
        float ring = smoothstep(0.03, 0.023, d) - smoothstep(0.019, 0.012, d);
        col += vec3(1.0) * max(ring, 0.0) * water * 0.5;
      }

      // Glass tank front: bright inner rim + a diagonal reflection.
      float rimEdge = smoothstep(0.05, 0.0, abs(rr + 0.025));
      col += mix(baseColor * 1.3, vec3(1.0), 0.5) * rimEdge * 0.5;
      float slash = smoothstep(0.03, 0.0, abs((p.x + p.y * 0.5) - 0.14)) * smoothstep(0.42, 0.05, length(p));
      col += vec3(1.0) * slash * 0.08;

      // Frame outside the tank: this face's color (bright), never black.
      vec3 frame = baseColor * 0.72;
      col = mix(frame, col, chamber);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Dice - a ray-traced six-sided die floating in each tile's glass chamber.
  // Every tile seeds its own tumble from its physical identity, so all dice rotate
  // independently; a slice turn spins that slice's dice up hard. Die body is the
  // antipodal color, chamber is this face's color.
  dice: `
    precision highp float;                 // box intersection needs highp on mobile
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    uniform float spin;
    uniform float spinAxis;
    uniform float spinSlice;
    uniform sampler2D cellRoll;             // per-cell roll count (R channel, 0..255)
    uniform float cellGridN;                // grid cells per axis (cube size)
    uniform float cellK;                    // (size-1)/2 → maps world coord to cell index
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    uniform vec3 tileHome;
    uniform float tileFace;
    varying vec3 vTileCenter;

    mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
    mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }

    // Antialiased pip: smoothstep width follows the on-screen pixel size so the
    // dots don't shimmer/speckle when the die is small or spinning fast.
    float pipDot(vec2 fc, vec2 c) {
      float d = length(fc - c);
      float w = fwidth(d) + 0.006;
      return smoothstep(0.15 + w, 0.15 - w, d);
    }
    // Standard die pip layout for face value v (1..6).
    float pipMask(vec2 fc, float v) {
      float m = 0.0;
      if (mod(v, 2.0) > 0.5) m = max(m, pipDot(fc, vec2(0.0)));            // center: 1,3,5
      if (v > 1.5) { m = max(m, pipDot(fc, vec2(-0.5, 0.5)));             // TL+BR: 2+
                     m = max(m, pipDot(fc, vec2(0.5, -0.5))); }
      if (v > 3.5) { m = max(m, pipDot(fc, vec2(0.5, 0.5)));              // TR+BL: 4+
                     m = max(m, pipDot(fc, vec2(-0.5, -0.5))); }
      if (v > 5.5) { m = max(m, pipDot(fc, vec2(-0.5, 0.0)));             // ML+MR: 6
                     m = max(m, pipDot(fc, vec2(0.5, 0.0))); }
      return m;
    }

    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p);

      // Tangent frame (UV-aligned) from screen derivatives → tangent→view.
      vec3 pos = -vViewPosition;
      vec3 dpdx = dFdx(pos); vec3 dpdy = dFdy(pos);
      vec2 duvx = dFdx(vUv); vec2 duvy = dFdy(vUv);
      vec3 N = normalize(vNormal);
      vec3 dp2perp = cross(dpdy, N);
      vec3 dp1perp = cross(N, dpdx);
      vec3 T = dp2perp * duvx.x + dp1perp * duvy.x;
      vec3 B = dp2perp * duvx.y + dp1perp * duvy.y;
      float invmax = inversesqrt(max(1e-10, max(dot(T, T), dot(B, B))));
      T *= invmax; B *= invmax;
      vec3 V = normalize(vViewPosition);
      vec3 vT = vec3(dot(V, T), dot(V, B), dot(V, N));

      vec3 ro = vec3(p, 0.0);
      vec3 rd = normalize(-vT);
      float boxDepth = 0.6;

      // Physical identity is invariant through turns, expansion and grid commits.
      vec3 snapped = tileHome + vec3(tileFace * 0.173);

      // Slice membership → only the tiles being turned spin up / get thrown.
      // axisCoord uses the raw vTileCenter: the coordinate along the rotation
      // axis is invariant under that rotation, so it's always exact.
      float axisCoord = spinAxis < 0.5 ? vTileCenter.x
                      : spinAxis < 1.5 ? vTileCenter.y
                      : vTileCenter.z;
      float member = 1.0 - smoothstep(0.55, 0.78, abs(axisCoord - spinSlice));
      float sp = clamp(spin * member, 0.0, 1.0);

      // How many times this die's grid cell has been rotated through. Folded
      // into the seed so a cell that returns later shows a FRESH face (the count
      // only ever rises), while non-rotated cells keep their count → same face.
      vec3 gcell = clamp(tileHome, vec3(0.0), vec3(cellGridN - 1.0));
      float texelX = gcell.x + gcell.y * cellGridN;
      float u = (texelX + 0.5) / (cellGridN * cellGridN);
      float v = (gcell.z + 0.5) / cellGridN;
      float rollN = texture2D(cellRoll, vec2(u, v)).r * 255.0;

      // Per-tile seed from home identity + roll count → stable during rotation.
      float seed = fract(sin(dot(snapped.xy + snapped.z * 1.7 + rollN * 1.7, vec2(12.9898, 78.233))) * 43758.5453);
      float seed2 = fract(seed * 7.31 + 0.137 + rollN * 0.313);

      // Rest orientation follows the piece's roll count. Moving through other
      // grid cells never changes the seed; only a new turn rerolls the die.
      float sp2 = sp * sp;
      float ra = seed * 20.0 + sp2 * (6.283 + seed * 3.0);
      float rb = seed2 * 20.0 + sp2 * (4.712 + seed2 * 2.5);
      mat3 R    = rotY(rb) * rotX(ra);          // die local → chamber space
      mat3 Rinv = rotX(-ra) * rotY(-rb);        // inverse (avoids transpose())

      // Die center: only jostle while its slice turns.
      vec3 sc = vec3(sin(time * 15.0) * 0.15 * sp2,
                     -0.02 + cos(time * 13.0) * 0.15 * sp2,
                     -0.34 + sin(time * 11.0) * 0.06 * sp2);
      float bhalf = 0.22;

      // Ray/box (slab) intersection in the die's local space.
      vec3 roL = Rinv * (ro - sc);
      vec3 rdL = Rinv * rd;
      // Guard the reciprocal: as the die tumbles, rdL components pass through 0,
      // and 1.0/0 overflows to Inf/NaN (garbage speckle in mediump on mobile).
      // Nudge near-zero components to a small finite value → ray treated as
      // parallel to that slab, which is the correct limit.
      vec3 rdSafe = rdL + step(abs(rdL), vec3(1e-3)) * 1e-3;
      vec3 mi = 1.0 / rdSafe;
      vec3 nq = mi * roL;
      vec3 kq = abs(mi) * bhalf;
      vec3 t1 = -nq - kq;
      vec3 t2 = -nq + kq;
      float tN = max(max(t1.x, t1.y), t1.z);
      float tF = min(min(t2.x, t2.y), t2.z);

      vec3 interior;
      if (tN <= tF && tF > 0.0) {
        // Local face normal (exactly one axis).
        vec3 oN = -sign(rdL) * step(t1.yzx, t1.xyz) * step(t1.zxy, t1.xyz);
        vec3 hitL = roL + rdL * tN;
        // Face value (opposite faces sum to 7) and in-face coords.
        float faceVal; vec2 fc;
        if (abs(oN.x) > 0.5)      { faceVal = oN.x > 0.0 ? 1.0 : 6.0; fc = hitL.zy; }
        else if (abs(oN.y) > 0.5) { faceVal = oN.y > 0.0 ? 2.0 : 5.0; fc = hitL.xz; }
        else                      { faceVal = oN.z > 0.0 ? 3.0 : 4.0; fc = hitL.xy; }
        fc /= bhalf;

        vec3 nrm = R * oN;
        vec3 L = normalize(vec3(-0.4, 0.55, 0.75));
        vec3 toEye = -rd;
        vec3 hlf = normalize(L + toEye);
        float diff = max(dot(nrm, L), 0.0);
        float spec = pow(max(dot(nrm, hlf), 0.0), 36.0);

        vec3 dieBody = mix(antipodalColor, vec3(1.0), 0.55);   // colored die body
        vec3 pipCol  = antipodalColor * 0.22;                  // dark (not black) pips
        vec3 faceCol = mix(dieBody, pipCol, pipMask(fc, faceVal));
        // Bevel: darken toward face edges so the cube edges read.
        float edge = smoothstep(1.0, 0.86, max(abs(fc.x), abs(fc.y)));
        faceCol *= 0.72 + 0.28 * edge;

        interior = faceCol * (0.32 + 0.68 * diff);
        interior += vec3(1.0) * spec * 0.5;
      } else {
        // Miss → chamber back wall.
        float tb = -boxDepth / min(rd.z, -0.001);
        vec3 wp = ro + rd * tb;
        float wv = 1.0 - smoothstep(0.15, 0.72, length(wp.xy));
        interior = baseColor * (0.14 + wv * 0.30);
        float haze = 0.5 + 0.5 * sin((wp.x + wp.y) * 10.0 + time * 0.5);
        interior += baseColor * haze * 0.03 * wv;
      }

      // Glass front (surface-locked): rim, reflection slash, glint.
      float rim = smoothstep(0.34, 0.49, r) * (1.0 - smoothstep(0.48, 0.51, r));
      vec3 rimCol = mix(baseColor * 1.2, vec3(0.8, 0.95, 1.0), 0.6);
      float slash = smoothstep(0.035, 0.0, abs((p.x + p.y * 0.55) - 0.1));
      slash *= smoothstep(0.46, 0.08, r);
      float glint = smoothstep(0.06, 0.0, length(p - vec2(-0.17, 0.19)));
      glint *= 0.75 + 0.25 * sin(time * 1.4);
      float chamber = 1.0 - smoothstep(0.47, 0.505, r);

      vec3 col = interior;
      col += rimCol * rim * 0.7;
      col += vec3(1.0) * slash * 0.1;
      col += vec3(1.0, 0.95, 0.82) * glint * 0.4;
      vec3 frame = baseColor * 0.03;
      col = mix(frame, col, chamber);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Sand Chamber - a jar of grainy sand that piles at real-world down and stays
  // level as you orbit. When a slice turns, the tile reorients, so the sand
  // pours to the new low side and re-settles (and grains kick up mid-turn).
  // Sand is the antipodal color; jar/air/frame is this face's color (no black).
  sandChamber: `
    precision highp float;
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    uniform float spin;
    uniform float spinAxis;
    uniform float spinSlice;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    uniform vec3 tileHome;
    uniform float tileFace;
    varying vec3 vTileCenter;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;

    float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      vec2 p = vUv - 0.5;

      // Rounded-rectangle jar.
      vec2 qd = abs(p) - vec2(0.44);
      float rr = min(max(qd.x, qd.y), 0.0) + length(max(qd, vec2(0.0))) - 0.05;
      float chamber = 1.0 - smoothstep(0.0, 0.015, rr);

      // Tangent frame → parallax back wall for the empty region.
      vec3 pos = -vViewPosition;
      vec3 dpdx = dFdx(pos); vec3 dpdy = dFdy(pos);
      vec2 duvx = dFdx(vUv); vec2 duvy = dFdy(vUv);
      vec3 N = normalize(vNormal);
      vec3 dp2perp = cross(dpdy, N);
      vec3 dp1perp = cross(N, dpdx);
      vec3 T = dp2perp * duvx.x + dp1perp * duvy.x;
      vec3 Bt = dp2perp * duvx.y + dp1perp * duvy.y;
      float invmax = inversesqrt(max(dot(T, T), dot(Bt, Bt)));
      T *= invmax; Bt *= invmax;
      vec3 V = normalize(vViewPosition);
      vec3 vT = vec3(dot(V, T), dot(V, Bt), dot(V, N));
      vec3 ro = vec3(p, 0.0);
      vec3 rd = normalize(-vT);
      float tb = -0.5 / min(rd.z, -0.001);
      vec2 wallUv = (ro + rd * tb).xy;

      // Slice membership → only turning tiles pour / kick up grains.
      float axisCoord = spinAxis < 0.5 ? vTileCenter.x
                      : spinAxis < 1.5 ? vTileCenter.y
                      : vTileCenter.z;
      float member = 1.0 - smoothstep(0.55, 0.78, abs(axisCoord - spinSlice));
      float sp = clamp(spin * member, 0.0, 1.0);

      // Face orientation + gravity-aligned coords (vertical = world Y).
      float gUp = abs(dot(normalize(vWorldNormal), vec3(0.0, 1.0, 0.0)));
      vec3 wofs = vWorldPos - vTileCenter;
      float hv = wofs.y;
      float hh = wofs.x - wofs.z;

      // Sand surface (world-vertical): jagged grainy crest, churned + tilted
      // while the slice turns (the world-level pour itself is automatic — the
      // tile reorients, so hv sweeps and the sand region follows gravity).
      float jag   = (vnoise(vec2(hh * 7.0 + tileHome.x * 5.0, time * 0.3)) - 0.5) * 0.05;
      float churn = (vnoise(vec2(hh * 10.0, time * 3.0)) - 0.5) * 0.06 * sp;
      float slope = hh * 0.5 * sp;
      float sandLevel = 0.02 + jag + churn + slope;
      float belowness = sandLevel - hv;
      float sandSide = smoothstep(-0.02, 0.02, belowness);
      float sand = mix(sandSide, 1.0, gUp);   // top/bottom faces = a full sand bed

      // Grain texture (per-tile varied, stable on the tile face).
      vec2 gco = (p + 0.5) * 55.0 + tileHome.xy * 17.0;
      float grain = vnoise(gco * 0.5) * 0.6 + hash21(floor(gco)) * 0.4;
      vec3 sandDark  = antipodalColor * 0.55;
      vec3 sandLight = mix(antipodalColor, vec3(1.0), 0.38);
      vec3 sandCol = mix(sandDark, sandLight, grain);
      float depthT = clamp(belowness, 0.0, 1.0);
      sandCol *= mix(1.0, 0.72, depthT * (1.0 - gUp));                        // deeper = darker (sides)
      sandCol += sandLight * smoothstep(0.05, 0.0, belowness) * (1.0 - gUp) * 0.35; // sunlit crest
      sandCol = max(sandCol, antipodalColor * 0.45);                         // never black

      // Air above the sand: this face's color with a faint parallax back wall.
      vec3 air = baseColor * 0.8 + baseColor * (vnoise(wallUv * 6.0) - 0.5) * 0.06;

      vec3 col = mix(air, sandCol, sand);

      // Grainy crest highlight (side faces).
      col += sandLight * smoothstep(0.03, 0.0, abs(belowness)) * (1.0 - gUp) * 0.4;

      // Falling grains during a pour (only while the slice turns).
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float gx = (hash21(vec2(fi, 3.1)) - 0.5) * 0.55;
        float gy = 0.42 - fract(hash21(vec2(fi, 7.7)) + time * (1.6 + fi * 0.25)) * 0.85;
        col += sandLight * smoothstep(0.018, 0.006, length(p - vec2(gx, gy))) * sp * 0.7;
      }

      // Glass jar front: bright inner rim + a diagonal reflection.
      float rimEdge = smoothstep(0.05, 0.0, abs(rr + 0.025));
      col += mix(baseColor * 1.3, vec3(1.0), 0.5) * rimEdge * 0.5;
      float slash = smoothstep(0.03, 0.0, abs((p.x + p.y * 0.5) - 0.14)) * smoothstep(0.42, 0.05, length(p));
      col += vec3(1.0) * slash * 0.06;

      // Frame outside the jar: this face's color (bright), never black.
      vec3 frame = baseColor * 0.72;
      col = mix(frame, col, chamber);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Lava Lamp - metaball blobs raymarched in true depth behind the glass. The
  // blobs rise/fall along real-world gravity, morph (pulsing radii), and merge /
  // pinch off as they pass — the classic lava-lamp motion. Lava is the antipodal
  // color; the fluid/glass/frame is this face's color (no black).
  lavaLamp: `
    precision highp float;
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    uniform float spin;
    uniform float spinAxis;
    uniform float spinSlice;
    varying vec2 vUv;
    uniform vec3 tileHome;
    uniform float tileFace;
    varying vec3 vTileCenter;

    // Smooth, bounded 2D metaball field in tile-local UV space.
    //
    // The blobs are computed entirely from vUv and a per-tile phase, so the
    // pattern rides the sticker and never re-seeds from screen-space derivatives
    // (the old raymarched version did, which is what made it glitch on drags and
    // zooms). Each blob's contribution is a SOFT metaball: dividing by
    // (d² + r²·k) with k≈0.55 keeps every term bounded to ~1/k at the centre, so
    // the summed field is smooth everywhere. The old field divided by a tiny
    // constant (d² + 0.012), which spiked near a blob's centre and made the
    // threshold isoline flicker frame-to-frame — the "spazzing" being fixed here.
    //
    // Blobs rise and fall on a slow eased loop (cos), pausing at the top and
    // bottom like real wax, wobbling gently sideways and necking thinner at the
    // ends of their travel.
    float lavaField(vec2 p, float t, float ph, float sway) {
      float f = 0.0;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float phase = ph + fi * 1.7;
        // Slow vertical loop, eased at both ends (~16–24s period per blob).
        float speed = 0.22 + 0.045 * fi;
        float climb = 0.5 - 0.5 * cos(t * speed + phase);   // 0 bottom → 1 top
        float yc = -0.34 + 0.68 * climb;
        // Gentle horizontal wobble; a touch more while the slice is turning.
        float xc = sin(t * (0.33 + 0.07 * fi) + phase) * 0.09
                 + sin(t * 1.6 + phase) * 0.03 * sway;
        // Fuller through the middle of the climb, thinner (necking) at the ends.
        float neck = 0.5 + 0.5 * sin(climb * 3.14159);
        float r = (0.105 + 0.02 * sin(t * 0.5 + phase)) * neck;
        vec2 d = p - vec2(xc, yc);
        f += (r * r) / (dot(d, d) + r * r * 0.55);
      }

      // Wide, flat heated reservoir at the base for blobs to neck off from.
      vec2 dr = p - vec2(0.0, -0.44);
      float rr = 0.17;
      f += (rr * rr) / (dr.x * dr.x * 0.5 + dr.y * dr.y * 3.5 + rr * rr * 0.5);
      return f;
    }

    void main() {
      vec2 p = vUv - 0.5;

      // Tall rounded-rect lamp vessel.
      vec2 qd = abs(p) - vec2(0.34, 0.45);
      float rr = min(max(qd.x, qd.y), 0.0) + length(max(qd, vec2(0.0))) - 0.06;
      float chamber = 1.0 - smoothstep(0.0, 0.015, rr);

      // Slice membership → only the turning slice's lamps sway a little more.
      float axisCoord = spinAxis < 0.5 ? vTileCenter.x
                      : spinAxis < 1.5 ? vTileCenter.y
                      : vTileCenter.z;
      float member = 1.0 - smoothstep(0.55, 0.78, abs(axisCoord - spinSlice));
      float sp = clamp(spin * member, 0.0, 1.0);

      // Per-tile phase so no two lamps are in sync.
      float ph = fract(sin(dot(tileHome.xy + tileHome.z * 1.7 + tileFace * 0.173, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;

      float F = lavaField(p, time, ph, sp);
      // The field is smooth and bounded now, so fwidth stays modest; clamp it to a
      // tight band anyway so the blob edge can never shimmer at grazing angles.
      float aa = clamp(fwidth(F) * 0.8, 0.008, 0.05);
      float cover = smoothstep(1.0 - aa, 1.0 + aa, F);
      // How deep inside a blob a pixel is — drives the hot glowing core.
      float depth = smoothstep(1.0, 2.1, F);

      // ── Background fluid ─────────────────────────────────────────────────────
      float grad = smoothstep(0.5, -0.5, p.y);      // 1 at the bottom
      vec3 fluid = mix(baseColor * 0.20, mix(baseColor, antipodalColor, 0.30) * 0.5, grad);
      // Warm halo cast by the bulb/heater at the very bottom.
      float heater = smoothstep(0.32, 0.0, length(p - vec2(0.0, -0.46)));
      fluid += mix(antipodalColor, vec3(1.0, 0.86, 0.5), 0.5) * heater * 0.32;

      // ── Lava blobs ───────────────────────────────────────────────────────────
      // Palette-faithful: deep antipodal edge → soft glowing core, so any face
      // colour reads as molten wax rather than being forced orange.
      vec3 lavaEdge = antipodalColor * 0.6;
      vec3 lavaCore = mix(antipodalColor, vec3(1.0, 0.95, 0.8), 0.5);
      vec3 lava = mix(lavaEdge, lavaCore, depth);
      lava += lavaCore * depth * 0.18;              // inner glow
      // Bright necking rim where a blob meets the fluid.
      float rimGlow = cover * (1.0 - depth);
      lava += mix(antipodalColor, vec3(1.0), 0.5) * rimGlow * 0.14;

      vec3 col = mix(fluid, lava, cover);

      // ── Glass vessel: bright rim + a diagonal reflection ─────────────────────
      float rimEdge = smoothstep(0.05, 0.0, abs(rr + 0.03));
      col += mix(baseColor * 1.3, vec3(1.0), 0.5) * rimEdge * 0.45;
      float slash = smoothstep(0.035, 0.0, abs((p.x + p.y * 0.5) - 0.14)) * smoothstep(0.42, 0.05, length(p));
      col += vec3(1.0) * slash * 0.06;

      vec3 frame = baseColor * 0.7;
      col = mix(frame, col, chamber);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  eyeball: eyeTileFragmentShader,
};
