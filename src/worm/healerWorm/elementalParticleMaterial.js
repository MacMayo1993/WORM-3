import { ShaderMaterial, Color, AdditiveBlending, NormalBlending } from 'three';

const MODES = { bubbles: 0, embers: 1, spores: 2, flakes: 3, ions: 4 };
export function makeElementalParticleMaterial(kind, color, size) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: 0 },
      uSize: { value: size }, uScale: { value: 500 }, uTime: { value: 0 }, uKind: { value: MODES[kind] ?? 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
    blending: kind === 'spores' || kind === 'flakes' ? NormalBlending : AdditiveBlending,
    vertexShader: `
      uniform float uSize; uniform float uScale;
      varying float vSeed;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vSeed = sin(position.x * 13.0 + position.z * 7.0);
        gl_PointSize = clamp(uSize * uScale / max(0.1, -mv.z), 2.0, 48.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform int uKind;
      varying float vSeed;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float angle = uTime * 0.35 + vSeed * 3.0;
        p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
        float r = length(p); float a = 0.0;
        vec3 color = uColor;
        if (uKind == 0) {
          a = exp(-pow((r - 0.72) / 0.12, 2.0)) * 0.75;
          a += exp(-dot(p - vec2(-0.3, -0.35), p - vec2(-0.3, -0.35)) * 45.0);
        } else if (uKind == 1) {
          a = exp(-dot(p * vec2(2.8, 0.9), p * vec2(2.8, 0.9)) * 3.0);
          color = mix(uColor, vec3(1.0, 0.93, 0.6), exp(-r * 5.0));
        } else if (uKind == 2) {
          float leaf = p.x * p.x * 3.0 + abs(p.y) * 0.9;
          a = 1.0 - smoothstep(0.55, 0.8, leaf);
          color = mix(uColor, vec3(0.95, 0.89, 0.45), step(0.55, vSeed));
        } else if (uKind == 3) {
          float ray = abs(sin(atan(p.y, p.x + 0.00001) * 3.0)) * r;
          a = (1.0 - smoothstep(0.03, 0.10, ray)) * (1.0 - smoothstep(0.65, 0.85, r));
        } else { a = exp(-r * r * 7.0); }
        gl_FragColor = vec4(color, clamp(a, 0.0, 1.0) * uOpacity);
      }`,
  });
}

// Bounded by the five element palettes. Warm-up and live effects share programs.
const particleMaterials = new Map();
export function getElementalParticleMaterial(kind, color, size = 0.1) {
  const key = `${kind}:${color}`;
  if (!particleMaterials.has(key)) particleMaterials.set(key, makeElementalParticleMaterial(kind, color, size));
  const material = particleMaterials.get(key);
  material.uniforms.uSize.value = size;
  return material;
}
