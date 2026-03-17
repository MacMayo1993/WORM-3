// Basic/Classic tile shaders: solid, glossy, matte, metallic, carbonFiber, hexGrid
import { shaderUtils } from './shaderBase.js';

export const basicShaders = {
  // Solid - simple flat color
  solid: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      gl_FragColor = vec4(baseColor, 1.0);
    }
  `,

  // Glossy - specular highlights
  glossy: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Fake specular highlight
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);

      vec3 color = baseColor + vec3(spec * 0.5);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Matte - soft diffuse
  matte: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vec3 normal = normalize(vNormal);
      float diffuse = max(dot(normal, normalize(vec3(0.5, 1.0, 0.5))), 0.3);
      vec3 color = baseColor * (0.7 + diffuse * 0.3);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Metallic - brushed metal with anisotropic highlight
  metallic: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    ${shaderUtils}

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Brushed metal streaks
      float brushed = noise(vUv * vec2(50.0, 5.0)) * 0.1;

      // Anisotropic-style highlight
      vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
      float NdotL = max(dot(normal, lightDir), 0.0);
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);

      vec3 color = baseColor * (0.6 + NdotL * 0.3) + brushed;
      color += vec3(spec * 0.8);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Carbon Fiber - woven pattern
  carbonFiber: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv * 8.0;

      // Woven pattern
      float weave1 = step(0.5, fract(uv.x)) * step(0.5, fract(uv.y + 0.5 * floor(uv.x)));
      float weave2 = step(0.5, fract(uv.x + 0.5)) * step(0.5, fract(uv.y + 0.5 * floor(uv.x + 0.5)));
      float pattern = weave1 + weave2 * 0.5;

      vec3 darkColor = baseColor * 0.3;
      vec3 color = mix(darkColor, baseColor, pattern * 0.7 + 0.3);

      // Subtle sheen
      color += vec3(0.05) * (1.0 - abs(vUv.x - 0.5) * 2.0);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Hexagon Grid - honeycomb pattern
  hexGrid: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    float hexDistance(vec2 p) {
      p = abs(p);
      return max(p.x * 0.866025 + p.y * 0.5, p.y);
    }

    void main() {
      vec2 uv = vUv * 6.0;

      // Hex grid
      vec2 r = vec2(1.0, 1.732);
      vec2 h = r * 0.5;
      vec2 a = mod(uv, r) - h;
      vec2 b = mod(uv - h, r) - h;
      vec2 gv = length(a) < length(b) ? a : b;

      float d = hexDistance(gv);
      float edge = smoothstep(0.4, 0.45, d);

      vec3 edgeColor = baseColor * 0.4;
      vec3 color = mix(baseColor, edgeColor, edge);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
