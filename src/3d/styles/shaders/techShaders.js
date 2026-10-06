// Sci-fi / tech tile shaders: circuit, holographic, pulse, neural
import { shaderUtils } from './shaderBase.js';

export const techShaders = {
  // Circuit Board - tech traces
  circuit: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv * 10.0;

      // Grid lines
      vec2 grid = abs(fract(uv) - 0.5);
      float lines = step(0.45, max(grid.x, grid.y));

      // Random traces
      vec2 cell = floor(uv);
      float r = hash(cell);
      float trace = 0.0;
      if (r > 0.7) {
        trace = step(0.4, grid.x) * step(grid.y, 0.1);
      } else if (r > 0.4) {
        trace = step(0.4, grid.y) * step(grid.x, 0.1);
      }

      // Solder points
      float point = 1.0 - smoothstep(0.0, 0.15, length(fract(uv) - 0.5));
      point *= step(0.8, hash(cell + 100.0));

      // Animated pulse along traces
      float pulse = sin(time * 3.0 + cell.x * 2.0 + cell.y * 3.0) * 0.5 + 0.5;

      vec3 traceColor = baseColor * 1.5;
      vec3 bgColor = baseColor * 0.3;
      vec3 color = bgColor;
      color = mix(color, baseColor * 0.6, lines);
      color = mix(color, traceColor, trace);
      color = mix(color, traceColor * (1.0 + pulse * 0.5), point);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Holographic - a foil sticker: a lattice of embossed four-point stars, every
  // star and every background diamond with its own diffraction grating, so
  // neighbouring cells flash different colours as the tile turns against the
  // camera; glitter twinkles on top. The face colour stays the ground.
  holographic: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;

    float hgHash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    vec3 hgSpectrum(float x) {
      return clamp(abs(mod(x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    }

    void main() {
      // The view's slant across the foil, in the tile's own uv frame.
      vec3 dp1 = dFdx(vWorldPos), dp2 = dFdy(vWorldPos);
      vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);
      vec3 T = normalize(dp1 * du2.y - dp2 * du1.y);
      vec3 B = normalize(dp2 * du1.x - dp1 * du2.x);
      vec3 v = normalize(cameraPosition - vWorldPos);
      vec2 slant = vec2(dot(v, T), dot(v, B));

      vec2 g = vUv * 4.0;
      vec2 cell = floor(g + 0.5);
      vec2 c = g - cell;
      vec2 ac = abs(c);
      float star = min(ac.x, ac.y) * 2.6 + max(ac.x, ac.y) * 0.55;
      float inStar = 1.0 - smoothstep(0.3 - fwidth(star), 0.3 + fwidth(star), star);
      float region = inStar > 0.5 ? hgHash(cell) : hgHash(cell + vec2(c.x > 0.0 ? 7.0 : 3.0, c.y > 0.0 ? 11.0 : 5.0));
      float ang = region * 3.14159;
      vec2 grating = vec2(cos(ang), sin(ang));
      float phase = dot(slant, grating) * 2.6 + dot(vUv, grating) * 0.6 + region + time * 0.05;
      vec3 rainbow = hgSpectrum(fract(phase));

      vec3 col = mix(baseColor, rainbow * mix(0.85, 1.1, inStar), mix(0.14, 0.36, inStar));
      col *= 1.0 + 0.35 * (1.0 - smoothstep(0.0, 0.06, abs(star - 0.3)));

      vec2 gl = floor(vUv * 90.0);
      float sparkle = step(0.965, hgHash(gl)) * pow(0.5 + 0.5 * sin(time * 2.0 + hgHash(gl + 3.0) * 30.0 + slant.x * 40.0), 8.0);
      col += vec3(sparkle * 0.8);
      gl_FragColor = vec4(col, 1.0);
    }
  `,

  // Pulse - animated brightness wave (square rings via Chebyshev distance)
  pulse: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      // Chebyshev (L-inf) distance — produces square concentric rings instead of circular
      vec2 d = abs(vUv - 0.5);
      float dist = max(d.x, d.y) * 2.0;
      float wave = sin(dist * 10.0 - time * 4.0) * 0.5 + 0.5;
      wave *= 1.0 - dist; // Fade at edges

      vec3 color = baseColor * (0.7 + wave * 0.5);

      // Bright center
      float center = 1.0 - smoothstep(0.0, 0.3, dist);
      color += baseColor * center * 0.3 * (sin(time * 2.0) * 0.5 + 0.5);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Neural — synaptic soma nodes with animated signal pulses along the dendrite web
  // Connects to: neuroscience (action potentials), graph theory, machine learning
  neural: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv * 6.0;
      vec2 cell = floor(uv);
      vec2 f    = fract(uv);

      // Soma nodes: one per Voronoi cell, pulsing at individual rates
      float glow = 0.0;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec2 n   = vec2(float(x), float(y));
          vec2 pos = n + vec2(hash(cell + n), hash(cell + n + 50.0));
          float d  = length(f - pos);
          float hz = 1.4 + hash(cell + n + 20.0) * 2.2;
          float ph = hash(cell + n) * 6.28;
          float pulse = sin(time * hz + ph) * 0.5 + 0.5;
          glow += smoothstep(0.14, 0.0, d) * (0.55 + pulse * 0.9);
        }
      }

      // Axon web: fbm-shaped filaments carry traveling signals
      float webN = fbm(uv * 0.85 + time * 0.04);
      float web  = abs(sin(uv.x * 4.2 + webN * 3.1) * sin(uv.y * 4.2 + webN * 2.3));
      web = smoothstep(0.82, 0.93, web) * 0.45;

      float signal = web * (sin(uv.x * 4.2 + uv.y * 3.3 - time * 2.8) * 0.5 + 0.5);

      // Dark neural background (slightly lighter so patterns read on all colors)
      vec3 bg    = mix(vec3(0.06, 0.10, 0.25), baseColor * 0.22, 0.55);
      vec3 color = bg;
      color += baseColor * glow * 0.85;
      color += baseColor * 0.45 * web;
      color += vec3(0.55, 0.78, 1.0) * signal * 0.55;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
};
