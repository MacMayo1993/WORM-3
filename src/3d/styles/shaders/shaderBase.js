import { STICKER_FINISH_VARYINGS, stickerFinishVertex } from './stickerFinish.js';

// Shared vertex shader used by all tile styles
export const baseVertexShader = `${STICKER_FINISH_VARYINGS}
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  // World-space center of this tile (mesh origin). Constant across the tile, so
  // reactive styles (orbChamber) can test which rotation slice the tile is in.
  varying vec3 vTileCenter;
  // World-space position of this fragment — lets styles keep effects level to
  // gravity (liquidTank's waterline) regardless of how the cube is viewed.
  varying vec3 vWorldPos;
  // World-space face normal — lets styles tell a side face from a top/bottom one
  // (liquidTank switches between waterline and top-down pool rendering).
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vTileCenter = modelMatrix[3].xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;${stickerFinishVertex()}
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fixed globe relief. Its footprint and height scale with the sticker so the
// same surface works on game tiles, previews, and the smaller core stickers.
// A smoothed skirt seats the globe in the tile without a vertical rim.
export const eyeballBulgeVertexShader = `${STICKER_FINISH_VARYINGS}
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vTileCenter;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  float eyeRelief(vec2 p) {
    float r = length(p);
    // Rounded cap with a continuous slope at the socket edge. A clipped
    // sphere's near-vertical rim made the coat sparkle along triangle edges.
    float cap = max(1.0 - (r * r) / (0.435 * 0.435), 0.0);
    return 0.28 * cap * cap;
  }

  void main() {
    vUv = uv;
    vec2 p = uv - 0.5;
    // All callers supply a square XY plane. Recover its width, with a safe
    // center-vertex fallback (the center has zero relief gradient).
    float width = abs(p.x) > 0.001 ? abs(position.x / p.x)
                : abs(p.y) > 0.001 ? abs(position.y / p.y) : 0.85;
    float height = eyeRelief(p);
    vec3 displaced = position + normal * height * width;
    const float e = 0.001;
    vec2 slope = vec2(eyeRelief(p + vec2(e, 0.0)) - eyeRelief(p - vec2(e, 0.0)),
                      eyeRelief(p + vec2(0.0, e)) - eyeRelief(p - vec2(0.0, e))) / (2.0 * e);
    vec3 reliefNormal = normalize(vec3(-slope, 1.0));
    vNormal = normalize(normalMatrix * reliefNormal);
    vTileCenter = modelMatrix[3].xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPos.xyz;${stickerFinishVertex('displaced')}
    vStickerNormal = normalize(mat3(modelMatrix) * reliefNormal);
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Utility functions shared across shaders (hash, noise, fbm)
export const shaderUtils = `
  // Hash functions for procedural patterns
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  // Simplex-style noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // FBM for organic patterns
  float fbm(vec2 p) {
    float f = 0.0;
    f += 0.5 * noise(p); p *= 2.01;
    f += 0.25 * noise(p); p *= 2.02;
    f += 0.125 * noise(p); p *= 2.03;
    f += 0.0625 * noise(p);
    return f;
  }
`;
