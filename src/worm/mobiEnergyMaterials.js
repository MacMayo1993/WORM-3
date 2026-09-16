import * as THREE from 'three';

const vertexShader = `
  uniform vec3 uGemColor;
  uniform vec3 uBandColor;
  varying vec3 vGem;
  varying vec3 vBand;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying float vPhase;
  #ifdef MOBI_CORE
    attribute float mobiRole;
    varying float vRole;
  #endif
  #ifdef USE_INSTANCING
    attribute vec3 mobiBandColor;
    attribute float mobiPhase;
  #endif
  void main() {
    vGem = uGemColor;
    vBand = uBandColor;
    vPhase = 0.0;
    #ifdef USE_INSTANCING_COLOR
      vGem = instanceColor;
    #endif
    #ifdef USE_INSTANCING
      vBand = mobiBandColor;
      vPhase = mobiPhase;
    #endif
    #ifdef MOBI_CORE
      vRole = mobiRole;
    #endif
    vLocal = position;
    vec4 p = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      n = mat3(instanceMatrix) * n;
    #endif
    vNormal = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * modelViewMatrix * p;
  }
`;

const gasFragment = `
  uniform float uTime;
  uniform float uMotion;
  varying vec3 vGem;
  varying vec3 vBand;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying float vPhase;
  void main() {
    vec3 p = vLocal;
    float t = uTime * 0.75 + vPhase;
    // Broad interleaved clouds plus small curls, not a uniformly tinted box.
    float curls = sin(p.x * 6.0 + sin(p.z * 5.0 + t))
      * cos(p.y * 5.0 - t * 0.8 + sin(p.x * 4.0));
    float cloud = 0.5 + 0.5 * sin(p.y * 4.8 + p.z * 2.8 + curls * 1.8 + t);
    vec3 col = mix(vGem, vBand, smoothstep(0.22, 0.78, cloud));
    float facing = abs(normalize(vNormal).z);
    float rim = pow(1.0 - facing, 2.0);
    float density = 0.42 + cloud * 0.22 + curls * curls * 0.12;
    // Short electric forks travel inside the cloud. No particle objects/lights.
    float fork = p.x + 0.20 * sin(p.y * 14.0 + t * 2.0) + 0.08 * sin(p.y * 31.0 - t);
    float line = 1.0 - smoothstep(0.012, 0.045, abs(fork));
    float window = pow(max(0.0, sin(p.y * 5.0 - t * 2.5)), 8.0);
    float spark = line * window * uMotion;
    col *= 0.85 + cloud * 0.35 + rim * 0.25;
    col += mix(col, vec3(1.0, 0.96, 0.86), 0.72) * spark * 1.5;
    gl_FragColor = vec4(col, min(0.82, density + rim * 0.12 + spark * 0.18) * smoothstep(0.0, 0.50, facing));
    #include <colorspace_fragment>
  }
`;

const coreFragment = `
  varying vec3 vGem;
  varying vec3 vBand;
  varying vec3 vNormal;
  varying float vRole;
  void main() {
    vec3 n = normalize(vNormal);
    float diffuse = 0.62 + 0.38 * max(0.0, dot(n, normalize(vec3(-0.4, 0.7, 1.0))));
    float shine = pow(max(0.0, dot(n, normalize(vec3(-0.3, 0.6, 1.0)))), 22.0);
    vec3 col = vRole > 2.5 ? vBand : vGem;
    if (vRole < 0.5) col = mix(col, vec3(1.0), pow(abs(n.z), 12.0) * 0.28);
    if (vRole > 1.5 && vRole < 2.5) col = mix(vGem, vec3(0.85, 0.98, 1.0), 0.8);
    if (vRole > 0.5 && vRole < 1.5) col = mix(vGem, vec3(1.0), 0.35);
    gl_FragColor = vec4(col * diffuse + vec3(shine * 0.7), 1.0);
    #include <colorspace_fragment>
  }
`;

function energyMaterial(core) {
  const material = new THREE.ShaderMaterial({
    defines: core ? { MOBI_CORE: 1 } : {},
    uniforms: {
      uTime: { value: 0 }, uMotion: { value: 1 },
      uGemColor: { value: new THREE.Color('#80e8ff') },
      uBandColor: { value: new THREE.Color('#bd92ff') },
    },
    vertexShader, fragmentShader: core ? coreFragment : gasFragment,
    transparent: !core, depthWrite: core, toneMapped: false,
  });
  // Same color interface as other carried-orb materials and character previews.
  material.color = material.uniforms.uGemColor.value;
  return material;
}
export const createMobiGasMaterial = () => energyMaterial(false);
export const createMobiCoreMaterial = () => energyMaterial(true);

export function addMobiInstanceAttributes(geometry, capacity) {
  geometry.setAttribute('mobiBandColor', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
  geometry.setAttribute('mobiPhase', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1));
}
