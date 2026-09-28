// Original flip burst shaders, also used by the resident WORM warm-up.
import * as THREE from 'three';

export const particleVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const particleFragment = `
  uniform vec3  uColor;
  uniform float uOpacity;
  varying vec2  vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;

    // Rounded-square signed-distance
    float corner = 0.28;
    vec2  q = abs(p) - (1.0 - corner);
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
    float chipAlpha = 1.0 - smoothstep(-0.05, 0.12, dist);

    // Inner highlight radiates from center (chromatic only).
    float highlight = 1.0 - smoothstep(0.0, 0.55, length(p));
    vec3 litColor = uColor * (1.0 + highlight * 0.22);

    // Crisp sticker-edge border
    float border = 1.0 - smoothstep(0.82, 0.98, max(abs(p.x), abs(p.y)));
    litColor += uColor * (border * 0.16);

    gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), chipAlpha * uOpacity);
  }
`;

export const shockVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const shockFragment = `
  uniform vec3  uColor;
  uniform float uProgress; // 0 = birth, 1 = spent (transparent)
  varying vec2  vUv;

  void main() {
    // Plane is 1.5 wide → local space spans -0.75 .. 0.75.
    vec2  p    = (vUv - 0.5) * 1.5;
    float dist = length(p);

    // Expanding ring: radius grows, band thickens slightly, whole thing fades out.
    float R     = uProgress * 0.72;
    float width = 0.055 + uProgress * 0.10;
    float ring  = 1.0 - smoothstep(0.0, width, abs(dist - R));
    float fade  = pow(1.0 - uProgress, 1.6);

    // Central white-hot pop at the very start (first ~25% of the burst).
    float core  = (1.0 - smoothstep(0.0, 0.20, dist)) * pow(max(0.0, 1.0 - uProgress * 4.0), 2.0);

    float alpha = clamp(ring * fade + core * 0.8, 0.0, 1.0);
    if (alpha < 0.004) discard;

    // White-hot at the ring crest + core, colored elsewhere.
    vec3 col = mix(uColor, vec3(1.0), clamp(ring * 0.55 + core, 0.0, 1.0));
    gl_FragColor = vec4(col * 1.8, alpha);
  }
`;

export const flashVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const flashFragment = `
  uniform float uProgress; // 0 = birth (peak), 1 = spent (transparent)
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 1.35;
    float fade = pow(1.0 - uProgress, 1.5);

    // Chromatic split: channels separate hard at birth, converge as it dissipates.
    float split = 0.11 * (1.0 - uProgress);
    float rC = 1.0 - smoothstep(0.0, 0.58, length(p * (1.0 + split)));
    float gC = 1.0 - smoothstep(0.0, 0.58, length(p));
    float bC = 1.0 - smoothstep(0.0, 0.58, length(p * (1.0 - split)));

    vec3 col = vec3(rC, gC, bC);
    float a = fade * max(rC, max(gC, bC));
    if (a < 0.004) discard;
    gl_FragColor = vec4(col * 1.9, clamp(a, 0.0, 1.0));
  }
`;

export function createFlipBurstWarmupMeshes(geometry) {
  const props = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  return [
    new THREE.InstancedMesh(geometry, new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      side: THREE.DoubleSide, vertexShader: particleVertex, fragmentShader: particleFragment }), 1),
    new THREE.Mesh(geometry, new THREE.ShaderMaterial({ ...props, vertexShader: shockVertex, fragmentShader: shockFragment })),
    new THREE.Mesh(geometry, new THREE.ShaderMaterial({ ...props, vertexShader: flashVertex, fragmentShader: flashFragment })),
    new THREE.Mesh(geometry, new THREE.MeshBasicMaterial(props)),
    new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ ...props, side: THREE.DoubleSide })),
  ];
}
