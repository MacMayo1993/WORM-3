// Basic/Classic tile shaders: solid, glossy, matte, metallic, carbonFiber, hexGrid
import { shaderUtils } from './shaderBase.js';

export const basicShaders = {
  // Solid - simple flat color
  solid: `
    uniform vec3 baseColor;

    void main() {
      gl_FragColor = vec4(baseColor, 1.0);
    }
  `,

  // Glossy - specular highlights
  glossy: `
    uniform vec3 baseColor;
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

  // Carbon Fiber - 2×2 twill of tows dyed in the face colour. Each tow is a
  // bundle of fibres with its own anisotropic sheen, so the over-and-under
  // checker flashes as the tile turns against the light.
  carbonFiber: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vec2 g = vUv * 9.0;
      vec2 cell = floor(g), f = fract(g);
      // A tow passes over two and under two, stepping one each row.
      float alongX = step(mod(cell.x + cell.y, 4.0), 1.5);
      float across = alongX > 0.5 ? f.y : f.x;
      float along = alongX > 0.5 ? g.x : g.y;
      float bulge = sin(across * 3.14159);
      float fibres = 0.86 + 0.14 * sin(across * 44.0 + sin(along * 3.0) * 0.6);

      vec3 dp1 = dFdx(vWorldPos), dp2 = dFdy(vWorldPos);
      vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);
      vec3 T = normalize(dp1 * du2.y - dp2 * du1.y);
      vec3 B = normalize(dp2 * du1.x - dp1 * du2.x);
      vec3 v = normalize(cameraPosition - vWorldPos);
      vec3 H = normalize(normalize(vec3(4.0, 6.0, 8.0)) + v);
      float th = dot(alongX > 0.5 ? T : B, H);
      float sheen = pow(sqrt(max(0.0, 1.0 - th * th)), 36.0);

      vec3 col = baseColor * (0.2 + 0.26 * bulge) * fibres;
      col += mix(baseColor, vec3(1.0), 0.45) * sheen * (0.2 + 0.4 * bulge);
      col *= 0.8 + 0.2 * smoothstep(0.0, 0.12, min(f.x, f.y) * (1.0 - max(f.x, f.y)) * 4.0 + 0.04);
      gl_FragColor = vec4(col, 1.0);
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
