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

  // Holographic - rainbow iridescence
  holographic: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      vec3 normal = normalize(vNormal);

      // View-dependent color shift
      float fresnel = 1.0 - abs(dot(viewDir, normal));

      // Rainbow based on UV and time
      float hue = fract(vUv.x * 2.0 + vUv.y + time * 0.3);
      vec3 rainbow;
      rainbow.r = abs(hue * 6.0 - 3.0) - 1.0;
      rainbow.g = 2.0 - abs(hue * 6.0 - 2.0);
      rainbow.b = 2.0 - abs(hue * 6.0 - 4.0);
      rainbow = clamp(rainbow, 0.0, 1.0);

      // Blend base color with rainbow
      vec3 color = mix(baseColor, rainbow, fresnel * 0.6);

      // Sparkle
      float sparkle = pow(fresnel, 4.0) * 0.5;
      color += vec3(sparkle);

      gl_FragColor = vec4(color, 1.0);
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
