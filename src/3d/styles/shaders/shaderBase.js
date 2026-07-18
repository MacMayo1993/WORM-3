// Shared vertex shader used by all tile styles
export const baseVertexShader = `
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
    vWorldPos = worldPos.xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Eyeball-style vertex shader: same varyings as baseVertexShader, but displaces
// the (tessellated) sticker plane outward along its normal so the eye physically
// bulges off the cube face — a sphere-cap dome over the eyeball plus a broader
// flesh mound, both falling to zero before the tile edge so seams stay flush.
// Requires a subdivided plane (StickerPlane swaps in one for the eyeball style);
// on a 1×1-segment plane the corner vertices sit past the profile and it stays flat.
export const eyeballBulgeVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vTileCenter;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vTileCenter = modelMatrix[3].xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    float du = length(uv - 0.5);
    float ball = sqrt(max(1.0 - pow(du / 0.36, 2.0), 0.0));
    float mound = 1.0 - smoothstep(0.16, 0.44, du);
    vec3 displaced = position + normal * (ball * 0.055 + mound * 0.045);
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPos.xyz;
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
