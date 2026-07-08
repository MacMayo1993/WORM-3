// New tile style shaders: stainedGlass, fingerprint, topographic, mandelbrot, penrose,
//                         oilSlick, constellation, waveform, dnaHelix, neonSign,
//                         prismBloom, magnetFlux, liquidChrome, auroraWeave, plasmaCells,
//                         quantumScanlines, emberstorm, fractalPulse, bioLattice, stellarLensing,
//                         orbChamber

export const newStyleShaders = {
  // Stained Glass - cathedral leaded glass with radial + concentric segments
  stainedGlass: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    float sgHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv - 0.5;
      float angle  = atan(uv.y, uv.x);
      float radius = length(uv);

      float segments = 8.0;
      float segA     = (angle + 3.14159265) / 6.28318530 * segments;
      float segId    = floor(segA);
      float segFract = fract(segA);

      float radialLead = smoothstep(0.04, 0.008, min(segFract, 1.0 - segFract));
      float ring1Lead  = smoothstep(0.018, 0.003, abs(radius - 0.22));
      float ring2Lead  = smoothstep(0.018, 0.003, abs(radius - 0.40));
      float lead = clamp(radialLead + ring1Lead + ring2Lead, 0.0, 1.0);

      float ringId = step(0.22, radius) + step(0.40, radius);
      float tint   = sgHash(vec2(segId, ringId));

      vec3 col      = mix(baseColor * (0.62 + tint * 0.72), baseColor * 1.45, tint * 0.36);
      vec3 leadCol  = vec3(0.07, 0.06, 0.05);
      gl_FragColor  = vec4(mix(col, leadCol, lead), 1.0);
    }
  `,

  // Fingerprint - concentric friction-ridge whorls from an offset core
  fingerprint: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      vec2 core    = vec2(0.42, 0.47);
      float r      = length(vUv - core) * 9.5;
      float ridge  = sin(r * 3.14159) * 0.5 + 0.5;
      float pattern = smoothstep(0.28, 0.72, ridge);

      vec3 ridgeCol  = baseColor * 1.12;
      vec3 valleyCol = baseColor * 0.22;
      gl_FragColor   = vec4(mix(valleyCol, ridgeCol, pattern), 1.0);
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

  // Penrose - 5-fold quasicrystal tiling (golden-ratio wave interference)
  penrose: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      vec2 uv = (vUv - 0.5) * 7.0;
      float p = 0.0;
      for (float i = 0.0; i < 5.0; i++) {
        float a = i * 1.25663706; // 2π/5
        p += sin(dot(uv, vec2(cos(a), sin(a))) * 1.6180339887);
      }
      float thresh = smoothstep(-0.4, 0.4, p);
      float edge   = smoothstep(0.06, 0.018, abs(fract(p * 0.5) - 0.5));
      vec3 col     = mix(baseColor * 0.28, baseColor, thresh);
      col          = mix(col, baseColor * 0.07, edge);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
  orbChamber: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec2 p = vUv - 0.5;              // position on the glass surface, -0.5..0.5
      float r = length(p);

      // ── Tangent frame aligned to UV (cotangent frame from screen derivatives).
      // Maps tangent space (x=U, y=V, z=surface normal toward viewer) to view space.
      vec3 pos = -vViewPosition;       // view-space fragment position
      vec3 dpdx = dFdx(pos);
      vec3 dpdy = dFdy(pos);
      vec2 duvx = dFdx(vUv);
      vec2 duvy = dFdy(vUv);
      vec3 N = normalize(vNormal);
      vec3 dp2perp = cross(dpdy, N);
      vec3 dp1perp = cross(N, dpdx);
      vec3 T = dp2perp * duvx.x + dp1perp * duvy.x;
      vec3 B = dp2perp * duvx.y + dp1perp * duvy.y;
      float invmax = inversesqrt(max(dot(T, T), dot(B, B)));
      T *= invmax; B *= invmax;

      // View direction (fragment → camera) transformed into tangent space.
      vec3 V = normalize(vViewPosition);
      vec3 vT = vec3(dot(V, T), dot(V, B), dot(V, N));

      // ── Ray from the glass surface into the recessed chamber (−z is deeper).
      vec3 ro = vec3(p, 0.0);
      vec3 rd = normalize(-vT);        // rd.z < 0: marches away from the viewer

      // Chamber: a box of half-extent 0.5 in the plane, depth 0..-boxDepth.
      float boxDepth = 0.6;
      // Ball recessed inside, drifting on a slow Lissajous orbit + depth bob so
      // it visibly floats around within the chamber.
      float R = 0.15;
      vec3 sc = vec3(
        sin(time * 0.55) * 0.17,
        cos(time * 0.43) * 0.13 - 0.02,
        -0.34 + sin(time * 0.37) * 0.07
      );

      // Fixed light in tangent space → stable regardless of face orientation.
      vec3 L = normalize(vec3(-0.4, 0.5, 0.72));

      // Analytic ray/sphere intersection (rd normalized).
      vec3 oc = ro - sc;
      float b = dot(oc, rd);
      float c = dot(oc, oc) - R * R;
      float h = b * b - c;
      float tHit = (h > 0.0) ? (-b - sqrt(h)) : -1.0;
      bool hitBall = tHit > 0.0;

      vec3 interior;
      if (hitBall) {
        vec3 hp = ro + rd * tHit;
        vec3 nrm = normalize(hp - sc);
        vec3 toEye = -rd;              // toward the viewer
        vec3 hlf = normalize(L + toEye);
        float diff = max(dot(nrm, L), 0.0);
        float spec = pow(max(dot(nrm, hlf), 0.0), 48.0);
        float fres = pow(1.0 - max(dot(nrm, toEye), 0.0), 3.0);
        // Occlusion: darker on the underside where it meets the chamber floor.
        float ao = smoothstep(-R * 0.9, R * 0.6, hp.y - sc.y) * 0.5 + 0.5;

        // The ball is the antipodal (opposite-face) color — the chamber shows
        // this face's color, so each porthole reads as "the other side inside".
        vec3 ballDark = antipodalColor * 0.16;
        vec3 ballLit  = antipodalColor * 1.05;
        interior = mix(ballDark, ballLit, diff) * ao;
        interior += vec3(1.0) * spec * 0.8;                          // hot highlight
        interior += mix(antipodalColor * 1.3, vec3(1.0), 0.4) * fres * 0.4; // rim light
      } else {
        // Missed the ball → hit the back wall of the chamber.
        float tb = -boxDepth / min(rd.z, -0.001);
        vec3 wp = ro + rd * tb;
        float wv = 1.0 - smoothstep(0.15, 0.72, length(wp.xy));  // centre vignette
        // Chamber interior clearly shows THIS face's color (the "inside view").
        interior = baseColor * (0.16 + wv * 0.34);
        // Soft contact shadow the ball casts onto the wall (light ≈ from front).
        float shad = smoothstep(R * 1.5, R * 0.55, length(wp.xy - sc.xy));
        interior *= 1.0 - shad * 0.5;
        // Faint animated bokeh haze deep in the chamber.
        float haze = 0.5 + 0.5 * sin((wp.x + wp.y) * 10.0 + time * 0.5);
        interior += baseColor * haze * 0.04 * wv;
      }

      // ── Glass front (locked to the surface, not parallaxed → reads as a pane).
      float rim = smoothstep(0.34, 0.49, r) * (1.0 - smoothstep(0.48, 0.51, r));
      vec3 rimCol = mix(baseColor * 1.2, vec3(0.75, 0.95, 1.0), 0.65);

      float slash = smoothstep(0.035, 0.0, abs((p.x + p.y * 0.55) - 0.1));
      slash *= smoothstep(0.46, 0.08, r);

      float glint = smoothstep(0.06, 0.0, length(p - vec2(-0.17, 0.19)));
      glint *= 0.75 + 0.25 * sin(time * 1.4);

      // Rounded porthole mask.
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
};
